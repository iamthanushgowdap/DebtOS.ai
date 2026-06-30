package com.example.debtosmobile.ui.main

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.debtosmobile.data.DataRepository
import com.example.debtosmobile.data.model.CreditCard
import com.example.debtosmobile.data.model.DashboardSummary
import com.example.debtosmobile.data.model.Loan
import com.example.debtosmobile.data.model.LoanPaymentInsert
import com.example.debtosmobile.data.local.CachedLoan
import com.example.debtosmobile.data.local.CachedCard
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(repo: DataRepository) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    val activeLoans by repo.cachedLoans.collectAsState(initial = emptyList())
    val activeCards by repo.cachedCards.collectAsState(initial = emptyList())

    var summary by remember { mutableStateOf<DashboardSummary?>(null) }
    var isRefreshing by remember { mutableStateOf(false) }
    
    var showSpendSheet by remember { mutableStateOf(false) }
    var showIncomeSheet by remember { mutableStateOf(false) }
    
    // Dialog and Sheet State
    var showConfirmEmiDialog by remember { mutableStateOf(false) }
    var loanToPay by remember { mutableStateOf<CachedLoan?>(null) }
    
    var cardToRotate by remember { mutableStateOf<CachedCard?>(null) }
    var showRotateDialog by remember { mutableStateOf(false) }
    var rotatePaymentAmount by remember { mutableStateOf("") }
    var rotateCashoutAmount by remember { mutableStateOf("") }
    var rotateFeePercent by remember { mutableStateOf("2.0") }
    var showConfirmRotateDialog by remember { mutableStateOf(false) }

    var snackMsg by remember { mutableStateOf<String?>(null) }
    val snackbarHostState = remember { SnackbarHostState() }

    // Calculations based on live room caches
    val totalLoanDebt = activeLoans.sumOf { it.currentBalance }
    val totalCardDebt = activeCards.sumOf { it.currentUtilization }
    val totalRemainingDebt = totalLoanDebt + totalCardDebt
    val totalMonthlyLoanEMI = activeLoans.sumOf { it.emi }
    val totalRotationCost = totalCardDebt * 0.02

    fun loadData() {
        scope.launch {
            isRefreshing = true
            try {
                // Background refresh token check
                repo.refreshSessionIfNeeded()
                
                val result = withContext(Dispatchers.IO) { repo.fetchDashboard() }
                summary = result
            } catch (_: Exception) {}
            isRefreshing = false
        }
    }

    LaunchedEffect(Unit) { loadData() }

    LaunchedEffect(snackMsg) {
        snackMsg?.let {
            snackbarHostState.showSnackbar(it)
            snackMsg = null
        }
    }

    val pullRefreshState = rememberPullToRefreshState()

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = Color(0xFFF8FAFC),
        floatingActionButton = {
            ExtendedFloatingActionButton(
                text = { Text("Web Console", color = Color.White, fontWeight = FontWeight.Bold) },
                icon = { Icon(Icons.Default.OpenInBrowser, contentDescription = "Open Web Dashboard", tint = Color.White) },
                onClick = {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://debt-os-ai.vercel.app/dashboard"))
                    context.startActivity(intent)
                },
                containerColor = Color(0xFF2563EB),
                elevation = FloatingActionButtonDefaults.elevation(6.dp)
            )
        }
    ) { paddingValues ->
        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = { loadData() },
            state = pullRefreshState,
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // ── Welcome Header ──────────────────────────────────────────
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(40.dp)
                                    .background(Color(0xFFEFF6FF), shape = RoundedCornerShape(20.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.Person, contentDescription = null, tint = Color(0xFF2563EB), modifier = Modifier.size(20.dp))
                            }
                            Spacer(Modifier.width(12.dp))
                            Column {
                                Text(
                                    summary?.profileName ?: "Command Center",
                                    fontSize = 18.sp, fontWeight = FontWeight.Black,
                                    color = Color(0xFF09090B)
                                )
                                Text("Console Dashboard", color = Color(0xFF475569), fontSize = 12.sp, fontWeight = FontWeight.Medium)
                            }
                        }
                        IconButton(
                            onClick = { loadData() },
                            colors = IconButtonDefaults.iconButtonColors(containerColor = Color(0xFFF1F5F9))
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = Color(0xFF2563EB))
                        }
                    }
                }

                // ── Financial Summary Metrics (2x2 Grid) ─────────────────────
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            // Card 1: Total Remaining Debt
                            MetricCard(
                                modifier = Modifier.weight(1f),
                                label = "Remaining Debt",
                                value = "₹${totalRemainingDebt.toLong()}",
                                subtext = "Loans: ₹${totalLoanDebt.toLong()} • CC: ₹${totalCardDebt.toLong()}",
                                icon = Icons.Default.TrendingDown,
                                color = Color(0xFFEF4444)
                            )
                            // Card 2: Available Cash
                            MetricCard(
                                modifier = Modifier.weight(1f),
                                label = "Available Cash",
                                value = "₹${summary?.cashBalance?.toLong() ?: "--"}",
                                subtext = "Unallocated Funds",
                                icon = Icons.Default.AccountBalance,
                                color = Color(0xFF10B981)
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            // Card 3: Monthly Loan EMI
                            MetricCard(
                                modifier = Modifier.weight(1f),
                                label = "Monthly Loan EMI",
                                value = "₹${totalMonthlyLoanEMI.toLong()}",
                                subtext = "${activeLoans.size} active loans",
                                icon = Icons.Default.CalendarToday,
                                color = Color(0xFFF59E0B)
                            )
                            // Card 4: CC Rotation Cost (2.0%)
                            MetricCard(
                                modifier = Modifier.weight(1f),
                                label = "CC Rotation (2%)",
                                value = "₹${totalRotationCost.toLong()}",
                                subtext = "${activeCards.size} cards mapped",
                                icon = Icons.Default.CreditCard,
                                color = Color(0xFF2563EB)
                            )
                        }
                    }
                }

                // ── Quick Transactions row ──────────────────────────────────
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Button(
                            onClick = { showSpendSheet = true },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444)),
                            contentPadding = PaddingValues(vertical = 12.dp)
                        ) {
                            Icon(Icons.Default.Remove, null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("I Spent", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                        Button(
                            onClick = { showIncomeSheet = true },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                            contentPadding = PaddingValues(vertical = 12.dp)
                        ) {
                            Icon(Icons.Default.Add, null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Got Money", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }
                }

                // ── Upcoming Loan EMIs ──────────────────────────────────────
                val todayDay = java.util.Calendar.getInstance().get(java.util.Calendar.DAY_OF_MONTH)
                val upLoans = activeLoans.filter { it.dueDay >= todayDay && it.dueDay <= todayDay + 5 }
                if (upLoans.isNotEmpty()) {
                    item {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
                            Icon(Icons.Default.CalendarToday, null, tint = Color(0xFFF59E0B), modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(8.dp))
                            Text(
                                "Upcoming Loan EMIs (Next 5 Days)",
                                color = Color(0xFF09090B), fontWeight = FontWeight.Bold, fontSize = 14.sp
                            )
                        }
                    }
                    items(upLoans) { loan ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                            elevation = CardDefaults.cardElevation(1.dp)
                        ) {
                            Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(loan.name, fontWeight = FontWeight.Black, fontSize = 14.sp, color = Color(0xFF09090B))
                                    Text("Lender: ${loan.lender} • Due Day ${loan.dueDay}", fontSize = 11.sp, color = Color(0xFF64748B))
                                }
                                Button(
                                    onClick = { loanToPay = loan; showConfirmEmiDialog = true },
                                    shape = RoundedCornerShape(8.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB)),
                                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
                                ) { Text("Pay", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White) }
                            }
                        }
                    }
                }

                // ── Active Credit Cards (Quick Rotate Option) ────────────────
                if (activeCards.isNotEmpty()) {
                    item {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
                            Icon(Icons.Default.CreditCard, null, tint = Color(0xFF2563EB), modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(8.dp))
                            Text(
                                "Credit Card Command (Limit Refinance)",
                                color = Color(0xFF09090B), fontWeight = FontWeight.Bold, fontSize = 14.sp
                            )
                        }
                    }
                    items(activeCards) { card ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                            elevation = CardDefaults.cardElevation(1.dp)
                        ) {
                            Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(card.cardName, fontWeight = FontWeight.Black, fontSize = 14.sp, color = Color(0xFF09090B))
                                    Text("Spent: ₹${card.currentUtilization.toLong()} / ₹${card.creditLimit.toLong()}", fontSize = 11.sp, color = Color(0xFF64748B))
                                    Text("2% Rotation Fee: ₹${(card.currentUtilization * 0.02).toLong()}", fontSize = 10.sp, color = Color(0xFFEF4444), fontWeight = FontWeight.Bold)
                                }
                                Button(
                                    onClick = {
                                        cardToRotate = card
                                        rotatePaymentAmount = card.currentUtilization.toLong().toString()
                                        rotateCashoutAmount = card.currentUtilization.toLong().toString()
                                        showRotateDialog = true
                                    },
                                    shape = RoundedCornerShape(8.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE2E8F0)),
                                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
                                ) { Text("Rotate", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF1E293B)) }
                            }
                        }
                    }
                }
            }
        }
    }

    // 1. Confirm Loan Payment Dialog
    val loanToPayLocal = loanToPay
    if (showConfirmEmiDialog && loanToPayLocal != null) {
        val loan = loanToPayLocal
        AlertDialog(
            onDismissRequest = { showConfirmEmiDialog = false },
            title = { Text("Log EMI Payment?", fontWeight = FontWeight.Bold) },
            text = { Text("Are you sure you want to log the monthly EMI payment of ₹${loan.emi.toLong()} for ${loan.name}?") },
            confirmButton = {
                Button(
                    onClick = {
                        showConfirmEmiDialog = false
                        scope.launch {
                            val ok = withContext(Dispatchers.IO) {
                                repo.api.insertLoanPayment(repo.token, LoanPaymentInsert(
                                    loanId = loan.id, userId = repo.userId,
                                    amount = loan.emi, paymentDate = repo.localTodayStr()
                                ))
                            }
                            snackMsg = if (ok) "EMI of ${loan.name} marked paid!" else "Failed to mark paid"
                            if (ok) loadData()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
                ) { Text("Confirm", color = Color.White) }
            },
            dismissButton = {
                TextButton(onClick = { showConfirmEmiDialog = false }) {
                    Text("Cancel", color = Color(0xFF64748B))
                }
            },
            containerColor = Color.White,
            shape = RoundedCornerShape(16.dp)
        )
    }

    // 2. Rotate Card dialog
    val cardToRotateLocal = cardToRotate
    if (showRotateDialog && cardToRotateLocal != null) {
        val card = cardToRotateLocal
        AlertDialog(
            onDismissRequest = { showRotateDialog = false },
            title = { Text("Rotate Limit - ${card.cardName}", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = rotatePaymentAmount,
                        onValueChange = { rotatePaymentAmount = it.filter { c -> c.isDigit() } },
                        label = { Text("Repayment (₹)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        colors = fieldColors(),
                        shape = RoundedCornerShape(10.dp),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = rotateCashoutAmount,
                        onValueChange = { rotateCashoutAmount = it.filter { c -> c.isDigit() } },
                        label = { Text("Cashout/Draw (₹)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        colors = fieldColors(),
                        shape = RoundedCornerShape(10.dp),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = rotateFeePercent,
                        onValueChange = { rotateFeePercent = it },
                        label = { Text("Rotation Fee %") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        colors = fieldColors(),
                        shape = RoundedCornerShape(10.dp),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val pay = rotatePaymentAmount.toDoubleOrNull() ?: 0.0
                        val draw = rotateCashoutAmount.toDoubleOrNull() ?: 0.0
                        if (pay <= 0 || draw <= 0) return@Button
                        showRotateDialog = false
                        showConfirmRotateDialog = true
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
                ) { Text("Confirm", color = Color.White) }
            },
            dismissButton = {
                TextButton(onClick = { showRotateDialog = false }) {
                    Text("Cancel", color = Color(0xFF64748B))
                }
            },
            containerColor = Color.White,
            shape = RoundedCornerShape(20.dp)
        )
    }

    // 3. Confirm Card Rotation Dialog
    if (showConfirmRotateDialog && cardToRotateLocal != null) {
        val card = cardToRotateLocal
        val pay = rotatePaymentAmount.toDoubleOrNull() ?: 0.0
        val draw = rotateCashoutAmount.toDoubleOrNull() ?: 0.0
        val feePct = rotateFeePercent.toDoubleOrNull() ?: 2.0
        val feeAmt = Math.round((draw * feePct) / 100).toDouble()

        AlertDialog(
            onDismissRequest = { showConfirmRotateDialog = false },
            title = { Text("Confirm Card Rotation?", fontWeight = FontWeight.Bold) },
            text = {
                Text("This action will record:\n" +
                        "- Repayment: ₹${pay.toLong()}\n" +
                        "- Cashout: ₹${draw.toLong()}\n" +
                        "- Fee: ₹${feeAmt.toLong()} (${feePct}%)\n" +
                        "Confirm to proceed.")
            },
            confirmButton = {
                Button(
                    onClick = {
                        showConfirmRotateDialog = false
                        scope.launch {
                            val ok = repo.rotateCardLimit(
                                cardId = card.id,
                                cardName = card.cardName,
                                currentUtilization = card.currentUtilization,
                                currentBillDue = card.billDue,
                                payAmt = pay,
                                drawAmt = draw,
                                feePct = feePct
                            )
                            snackMsg = if (ok) "Card limit rotated successfully!" else "Failed to rotate limit"
                            if (ok) loadData()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
                ) { Text("Confirm", color = Color.White) }
            },
            dismissButton = {
                TextButton(onClick = { showConfirmRotateDialog = false }) {
                    Text("Cancel", color = Color(0xFF64748B))
                }
            },
            containerColor = Color.White,
            shape = RoundedCornerShape(16.dp)
        )
    }

    if (showSpendSheet) {
        val cardsList = activeCards.map {
            CreditCard(id = it.id, cardName = it.cardName, bank = it.bank, creditLimit = it.creditLimit, currentUtilization = it.currentUtilization, minimumDue = it.minimumDue, status = it.status)
        }
        TransactionBottomSheet(
            isIncome = false, repo = repo, cards = cardsList,
            onDismiss = { showSpendSheet = false },
            onSuccess = { msg -> showSpendSheet = false; snackMsg = msg; loadData() }
        )
    }

    if (showIncomeSheet) {
        TransactionBottomSheet(
            isIncome = true, repo = repo, cards = emptyList(),
            onDismiss = { showIncomeSheet = false },
            onSuccess = { msg -> showIncomeSheet = false; snackMsg = msg; loadData() }
        )
    }
}

@Composable
private fun MetricCard(
    modifier: Modifier = Modifier,
    label: String,
    value: String,
    subtext: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    color: Color
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
        elevation = CardDefaults.cardElevation(2.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .background(color.copy(alpha = 0.1f), RoundedCornerShape(8.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, null, tint = color, modifier = Modifier.size(18.dp))
            }
            Spacer(Modifier.height(12.dp))
            Text(value, color = Color(0xFF09090B), fontWeight = FontWeight.Black, fontSize = 18.sp)
            Text(label, color = Color(0xFF475569), fontSize = 11.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(2.dp))
            Text(subtext, color = Color(0xFF94A3B8), fontSize = 9.sp, fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
private fun fieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = Color(0xFF2563EB),
    unfocusedBorderColor = Color(0xFFE2E8F0),
    focusedTextColor = Color(0xFF09090B),
    unfocusedTextColor = Color(0xFF09090B),
    focusedContainerColor = Color(0xFFF8FAFC),
    unfocusedContainerColor = Color(0xFFF8FAFC)
)
