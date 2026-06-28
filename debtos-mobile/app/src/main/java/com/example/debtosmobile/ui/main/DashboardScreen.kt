package com.example.debtosmobile.ui.main

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.debtosmobile.data.DataRepository
import com.example.debtosmobile.data.model.CreditCard
import com.example.debtosmobile.data.model.DashboardSummary
import com.example.debtosmobile.data.model.Loan
import com.example.debtosmobile.data.model.CreditCardPaymentInsert
import com.example.debtosmobile.data.model.LoanPaymentInsert
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(repo: DataRepository) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var summary by remember { mutableStateOf<DashboardSummary?>(null) }
    var isRefreshing by remember { mutableStateOf(false) }
    var showSpendSheet by remember { mutableStateOf(false) }
    var showIncomeSheet by remember { mutableStateOf(false) }
    var cards by remember { mutableStateOf<List<CreditCard>>(emptyList()) }
    var snackMsg by remember { mutableStateOf<String?>(null) }
    val snackbarHostState = remember { SnackbarHostState() }

    fun loadData() {
        scope.launch {
            isRefreshing = true
            try {
                val result = withContext(Dispatchers.IO) { repo.fetchDashboard() }
                summary = result
                cards = withContext(Dispatchers.IO) { repo.fetchAndCacheCards() }
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
        containerColor = Color(0xFF0F172A),
        floatingActionButton = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                SmallFloatingActionButton(
                    onClick = {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("http://localhost:8000/dashboard"))
                        context.startActivity(intent)
                    },
                    containerColor = Color(0xFF8B5CF6)
                ) {
                    Icon(Icons.Default.OpenInBrowser, contentDescription = "Open Web Dashboard", tint = Color.White)
                }
            }
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
                // ── Header ──────────────────────────────────────────────────
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Default.Person,
                                contentDescription = null,
                                tint = Color(0xFFF59E0B),
                                modifier = Modifier.size(28.dp)
                            )
                            Spacer(Modifier.width(8.dp))
                            Column {
                                Text(
                                    summary?.profileName ?: "Loading...",
                                    fontSize = 20.sp, fontWeight = FontWeight.Bold,
                                    color = Color(0xFFF8FAFC)
                                )
                                Text("Personal Debt Controller", color = Color(0xFF64748B), fontSize = 12.sp)
                            }
                        }
                        IconButton(
                            onClick = { loadData() },
                            colors = IconButtonDefaults.iconButtonColors(containerColor = Color(0xFF1E293B))
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = Color(0xFF8B5CF6))
                        }
                    }
                }

                // ── Financial Summary Cards ────────────────────────────────
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        SummaryCard(
                            modifier = Modifier.weight(1f),
                            label = "Cash Balance",
                            value = "₹${summary?.cashBalance?.toLong() ?: "--"}",
                            gradient = listOf(Color(0xFFD97706), Color(0xFFF59E0B)),
                            icon = Icons.Default.AccountBalance
                        )
                        SummaryCard(
                            modifier = Modifier.weight(1f),
                            label = "Credit Used",
                            value = "₹${summary?.totalUtilization?.toLong() ?: "--"}",
                            gradient = listOf(Color(0xFF8B5CF6), Color(0xFF6366F1)),
                            icon = Icons.Default.CreditCard
                        )
                    }
                }

                // ── Quick Action Buttons ───────────────────────────────────
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Button(
                            onClick = { showSpendSheet = true },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(14.dp),
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
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                            contentPadding = PaddingValues(vertical = 12.dp)
                        ) {
                            Icon(Icons.Default.Add, null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Got Money", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }
                }

                // ── Upcoming Loan EMIs ─────────────────────────────────────
                val upLoans = summary?.upcomingLoans ?: emptyList()
                if (upLoans.isNotEmpty()) {
                    item {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.CalendarToday, null, tint = Color(0xFFF59E0B), modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(
                                "Upcoming EMIs",
                                color = Color(0xFFF8FAFC), fontWeight = FontWeight.Bold, fontSize = 15.sp
                            )
                        }
                    }
                    items(upLoans) { loan ->
                        LoanDueCard(loan = loan, onPayClick = {
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
                        })
                    }
                }

                // ── Upcoming Card Dues ─────────────────────────────────────
                val upCards = summary?.upcomingCards ?: emptyList()
                if (upCards.isNotEmpty()) {
                    item {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.CreditCard, null, tint = Color(0xFF8B5CF6), modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(
                                "Credit Card Dues",
                                color = Color(0xFFF8FAFC), fontWeight = FontWeight.Bold, fontSize = 15.sp
                            )
                        }
                    }
                    items(upCards) { card ->
                        CardDueCard(card = card, onPayClick = {
                            scope.launch {
                                val ok = withContext(Dispatchers.IO) {
                                    repo.api.insertCardPayment(repo.token, CreditCardPaymentInsert(
                                        creditCardId = card.id, userId = repo.userId,
                                        amount = card.minimumDue, paymentDate = repo.localTodayStr()
                                    ))
                                }
                                snackMsg = if (ok) "Min due of ${card.cardName} paid!" else "Failed to mark paid"
                                if (ok) loadData()
                            }
                        })
                    }
                }

                if (upLoans.isEmpty() && upCards.isEmpty() && summary != null) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(32.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("No upcoming dues in the next 5 days", color = Color(0xFF64748B), fontSize = 14.sp)
                        }
                    }
                }
            }
        }
    }

    if (showSpendSheet) {
        TransactionBottomSheet(
            isIncome = false, repo = repo, cards = cards,
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
private fun SummaryCard(
    modifier: Modifier = Modifier,
    label: String, value: String,
    gradient: List<Color>,
    icon: androidx.compose.ui.graphics.vector.ImageVector
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        elevation = CardDefaults.cardElevation(0.dp)
    ) {
        Box(
            Modifier
                .background(Brush.linearGradient(gradient))
                .padding(18.dp)
        ) {
            Column {
                Icon(icon, null, tint = Color.White.copy(0.7f), modifier = Modifier.size(24.dp))
                Spacer(Modifier.height(12.dp))
                Text(value, color = Color.White, fontWeight = FontWeight.Black, fontSize = 22.sp)
                Text(label, color = Color.White.copy(0.7f), fontSize = 11.sp, fontWeight = FontWeight.Medium)
            }
        }
    }
}

@Composable
private fun LoanDueCard(loan: Loan, onPayClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B).copy(alpha = 0.5f)),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
    ) {
        Row(
            modifier = Modifier.padding(18.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(loan.name, color = Color(0xFFF8FAFC), fontWeight = FontWeight.Bold, fontSize = 14.sp)
                Text(loan.lender, color = Color(0xFF94A3B8), fontSize = 11.sp)
                Spacer(Modifier.height(4.dp))
                Text("Due Day ${loan.dueDay} • EMI ₹${loan.emi.toLong()}", color = Color(0xFFF59E0B), fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
            Button(
                onClick = onPayClick,
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF59E0B)),
                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
            ) { Text("Pay", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.Black) }
        }
    }
}

@Composable
private fun CardDueCard(card: CreditCard, onPayClick: () -> Unit) {
    val utilPct = if (card.creditLimit > 0) card.currentUtilization / card.creditLimit else 0.0
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B).copy(alpha = 0.5f)),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(card.cardName, color = Color(0xFFF8FAFC), fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Text(card.bank, color = Color(0xFF94A3B8), fontSize = 11.sp)
                    Spacer(Modifier.height(4.dp))
                    Text("Due Day ${card.dueDate} • Min ₹${card.minimumDue.toLong()}", color = Color(0xFF8B5CF6), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
                Button(
                    onClick = onPayClick,
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF8B5CF6)),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
                ) { Text("Pay", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White) }
            }
            Spacer(Modifier.height(10.dp))
            LinearProgressIndicator(
                progress = { utilPct.toFloat().coerceIn(0f, 1f) },
                modifier = Modifier.fillMaxWidth(),
                color = if (utilPct > 0.8) Color(0xFFEF4444) else Color(0xFF8B5CF6),
                trackColor = Color.White.copy(0.1f)
            )
            Spacer(Modifier.height(4.dp))
            Text("${(utilPct * 100).toInt()}% utilized", color = Color(0xFF94A3B8), fontSize = 10.sp)
        }
    }
}
