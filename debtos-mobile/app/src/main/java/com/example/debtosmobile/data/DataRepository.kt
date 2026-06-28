package com.example.debtosmobile.data

import android.content.Context
import android.content.SharedPreferences
import com.example.debtosmobile.data.api.SupabaseClient
import com.example.debtosmobile.data.local.*
import com.example.debtosmobile.data.model.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.doubleOrNull

private const val PREFS_NAME = "debtos_session"
private const val KEY_TOKEN = "access_token"
private const val KEY_USER_ID = "user_id"
private const val KEY_USER_EMAIL = "user_email"

class DataRepository(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val api = SupabaseClient()
    private val db = DebtOSDatabase.getInstance(context)

    // ─── Session ──────────────────────────────────────────────────────────────

    var token: String
        get() = prefs.getString(KEY_TOKEN, "") ?: ""
        set(v) = prefs.edit().putString(KEY_TOKEN, v).apply()

    var userId: String
        get() = prefs.getString(KEY_USER_ID, "") ?: ""
        set(v) = prefs.edit().putString(KEY_USER_ID, v).apply()

    var userEmail: String
        get() = prefs.getString(KEY_USER_EMAIL, "") ?: ""
        set(v) = prefs.edit().putString(KEY_USER_EMAIL, v).apply()

    fun isLoggedIn() = token.isNotEmpty() && userId.isNotEmpty()

    fun saveSession(response: LoginResponse) {
        token = response.accessToken
        userId = response.user?.id ?: ""
        userEmail = response.user?.email ?: ""
    }

    fun clearSession() {
        prefs.edit().clear().apply()
    }

    // ─── Remote Fetch ─────────────────────────────────────────────────────────

    suspend fun fetchAndCacheLoans(): List<Loan> = withContext(Dispatchers.IO) {
        val loans = api.getLoans(token, userId)
        db.cachedLoanDao().clearAll()
        db.cachedLoanDao().insertAll(loans.map {
            CachedLoan(
                id = it.id, name = it.name, lender = it.lender,
                emi = it.emi, dueDay = it.dueDay, currentBalance = it.currentBalance,
                interestRate = it.interestRate, status = it.status, priority = it.priority
            )
        })
        loans
    }

    suspend fun fetchAndCacheCards(): List<CreditCard> = withContext(Dispatchers.IO) {
        val cards = api.getCreditCards(token, userId)
        db.cachedCardDao().clearAll()
        db.cachedCardDao().insertAll(cards.map {
            CachedCard(
                id = it.id, cardName = it.cardName, bank = it.bank,
                creditLimit = it.creditLimit, currentUtilization = it.currentUtilization,
                minimumDue = it.minimumDue, statementDate = it.statementDate,
                dueDate = it.dueDate, status = it.status
            )
        })
        cards
    }

    suspend fun fetchDashboard(): DashboardSummary = withContext(Dispatchers.IO) {
        val profile = api.getProfile(token, userId)
        val loans = fetchAndCacheLoans()
        val cards = fetchAndCacheCards()
        val income = api.getIncome(token, userId)
        val expenses = api.getExpenses(token, userId)
        val loanPayments = api.getLoanPayments(token, userId)
        val cardPayments = api.getCardPayments(token, userId)

        // Load offline pending transactions
        val pendingExpenses = db.pendingExpenseDao().getPending().first()
        val pendingIncome = db.pendingIncomeDao().getPending().first()

        // Calculate cash balance
        val totalIncome = income.filter { it.status == "received" }.sumOf { it.receivedAmount } +
                pendingIncome.sumOf { it.receivedAmount }
        
        val totalExpenses = expenses.filter { it.creditCardId == null }.sumOf { it.amount } +
                pendingExpenses.filter { it.creditCardId == null }.sumOf { it.amount }

        val totalLoanPayments = loanPayments.sumOf { it["amount"]?.jsonPrimitive?.doubleOrNull ?: 0.0 }
        val totalCCPayments = cardPayments.sumOf { it["amount"]?.jsonPrimitive?.doubleOrNull ?: 0.0 }

        val cashBalance = (totalIncome - totalExpenses - totalLoanPayments - totalCCPayments).coerceAtLeast(0.0)

        // Calculate credit utilization including pending local expenses
        val pendingCardExpensesSum = pendingExpenses.filter { it.creditCardId != null }.sumOf { it.amount }
        val totalUtilization = cards.sumOf { it.currentUtilization } + pendingCardExpensesSum

        val today = java.util.Calendar.getInstance().get(java.util.Calendar.DAY_OF_MONTH)
        val upcomingLoans = loans.filter { it.dueDay >= today || it.dueDay <= today + 5 }
        val upcomingCards = cards.filter { it.dueDate >= today || it.dueDate <= today + 5 }

        DashboardSummary(
            profileName = profile?.name ?: userEmail,
            cashBalance = cashBalance,
            totalCreditLimit = cards.sumOf { it.creditLimit },
            totalUtilization = totalUtilization,
            upcomingLoans = upcomingLoans,
            upcomingCards = upcomingCards
        )
    }

    // ─── Offline Transactions ─────────────────────────────────────────────────

    suspend fun logExpenseOffline(
        category: String, amount: Double, description: String?,
        creditCardId: String?, entryDate: String
    ) = withContext(Dispatchers.IO) {
        db.pendingExpenseDao().insert(
            PendingExpense(
                userId = userId, category = category, amount = amount,
                entryDate = entryDate, description = description,
                creditCardId = creditCardId, pendingSync = true
            )
        )
    }

    suspend fun logIncomeOffline(
        source: String, expectedAmount: Double, receivedAmount: Double,
        status: String, entryDate: String
    ) = withContext(Dispatchers.IO) {
        db.pendingIncomeDao().insert(
            PendingIncome(
                userId = userId, source = source,
                expectedAmount = expectedAmount, receivedAmount = receivedAmount,
                status = status, entryDate = entryDate, pendingSync = true
            )
        )
    }

    /** Attempt to upload all pending offline transactions to Supabase */
    suspend fun syncPendingTransactions() = withContext(Dispatchers.IO) {
        // Sync expenses
        db.pendingExpenseDao().getPending().first().forEach { pending ->
            val ok = api.insertExpense(token, ExpenseInsert(
                userId = pending.userId, category = pending.category,
                amount = pending.amount, entryDate = pending.entryDate,
                description = pending.description, creditCardId = pending.creditCardId
            ))
            if (ok) {
                db.pendingExpenseDao().delete(pending.id)
                // If credit card expense, update card utilization
                pending.creditCardId?.let { cardId ->
                    val cards = api.getCreditCards(token, userId)
                    val card = cards.find { it.id == cardId }
                    card?.let {
                        api.patchCardUtilization(token, cardId, it.currentUtilization + pending.amount)
                    }
                }
            }
        }

        // Sync income
        db.pendingIncomeDao().getPending().first().forEach { pending ->
            val ok = api.insertIncome(token, IncomeInsert(
                userId = pending.userId, source = pending.source,
                expectedAmount = pending.expectedAmount,
                receivedAmount = pending.receivedAmount,
                status = pending.status, entryDate = pending.entryDate
            ))
            if (ok) db.pendingIncomeDao().delete(pending.id)
        }
    }

    // ─── Smart Category Auto-Suggestions ─────────────────────────────────────

    fun suggestCategory(description: String): String? {
        val lower = description.lowercase()
        return when {
            lower.containsAny("swiggy", "zomato", "food", "restaurant", "eat", "lunch", "dinner", "breakfast", "cafe", "pizza", "burger", "coffee", "starbucks", "hotel") -> "Food"
            lower.containsAny("uber", "ola", "petrol", "diesel", "fuel", "bus", "train", "metro", "auto", "taxi", "flight", "travel", "trip", "makemytrip", "irctc") -> "Travel"
            lower.containsAny("electricity", "internet", "mobile", "recharge", "broadband", "wifi", "gas", "bill", "jio", "airtel", "bsnl") -> "Bills"
            lower.containsAny("amazon", "flipkart", "myntra", "shopping", "clothes", "shoe", "buy", "meesho", "ajio") -> "Shopping"
            lower.containsAny("movie", "netflix", "prime", "hotstar", "game", "spotify", "music", "entertainment", "party", "pub") -> "Entertainment"
            lower.containsAny("doctor", "hospital", "pharmacy", "medicine", "clinic", "health", "dental", "medical") -> "Medical"
            lower.containsAny("school", "college", "course", "book", "fees", "tuition", "coaching", "education") -> "Education"
            lower.containsAny("rent", "maintenance", "water", "grocery", "house", "home", "maid", "cook", "maids") -> "Home"
            else -> null
        }
    }

    // ─── Voice Parser ─────────────────────────────────────────────────────────

    data class ParsedVoiceCommand(
        val amount: Double?,
        val category: String?,
        val description: String?,
        val isIncome: Boolean
    )

    fun parseVoiceCommand(transcript: String): ParsedVoiceCommand {
        val lower = transcript.lowercase().trim()
        val isIncome = lower.containsAny("received", "got", "earned", "salary", "income", "credited")

        // Extract numeric amount
        val amountRegex = Regex("""(\d+(?:[,.]\d{1,2})?)""")
        val rawAmount = amountRegex.find(lower)?.groupValues?.getOrNull(1)
            ?.replace(",", "")
        val amount = rawAmount?.toDoubleOrNull()

        // Extract potential description words after 'on' or 'for'
        val descRegex = Regex("""(?:on|for)\s+(.+)""")
        val descMatch = descRegex.find(lower)?.groupValues?.getOrNull(1)
            ?.trim()?.replaceFirstChar { it.uppercase() }

        val category = if (descMatch != null) suggestCategory(descMatch) else null

        return ParsedVoiceCommand(
            amount = amount,
            category = category,
            description = descMatch,
            isIncome = isIncome
        )
    }

    // ─── Today's Date (local, IST-safe) ───────────────────────────────────────

    fun localTodayStr(): String {
        val cal = java.util.Calendar.getInstance()
        return "%04d-%02d-%02d".format(
            cal.get(java.util.Calendar.YEAR),
            cal.get(java.util.Calendar.MONTH) + 1,
            cal.get(java.util.Calendar.DAY_OF_MONTH)
        )
    }

    // ─── Cached Flows ─────────────────────────────────────────────────────────

    val cachedLoans: Flow<List<CachedLoan>> = db.cachedLoanDao().getAll()
    val cachedCards: Flow<List<CachedCard>> = db.cachedCardDao().getAll()
}

private fun String.containsAny(vararg words: String): Boolean = words.any { this.contains(it) }
