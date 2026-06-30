package com.example.debtosmobile.ui.main

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.debtosmobile.data.DataRepository
import com.example.debtosmobile.data.model.CreditCard
import com.example.debtosmobile.data.model.DashboardSummary
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LedgerScreen(repo: DataRepository) {
    val scope = rememberCoroutineScope()
    var summary by remember { mutableStateOf<DashboardSummary?>(null) }
    var cards by remember { mutableStateOf<List<CreditCard>>(emptyList()) }
    var isRefreshing by remember { mutableStateOf(false) }

    var showSpendSheet by remember { mutableStateOf(false) }
    var showIncomeSheet by remember { mutableStateOf(false) }
    
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

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = Color(0xFFF8FAFC)
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header
            item {
                Text(
                    "Income & Expense Tracker",
                    color = Color(0xFF09090B),
                    fontWeight = FontWeight.Black,
                    fontSize = 18.sp
                )
            }

            // Cash Balance Card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    elevation = CardDefaults.cardElevation(2.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("Available Cash Balance", color = Color(0xFF64748B), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "₹${summary?.cashBalance?.toLong() ?: "--"}",
                            color = Color(0xFF10B981),
                            fontWeight = FontWeight.Black,
                            fontSize = 32.sp
                        )
                        Spacer(Modifier.height(4.dp))
                        Text("Tracks income minus all expenses and debt repayments.", color = Color(0xFF94A3B8), fontSize = 10.sp)
                    }
                }
            }

            // Quick Actions Row
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

            // Explainer details
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFEFF6FF).copy(alpha = 0.5f)),
                    border = BorderStroke(1.dp, Color(0xFFBFDBFE).copy(alpha = 0.5f))
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.ArrowUpward, null, tint = Color(0xFF10B981), modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(10.dp))
                        Column {
                            Text("Automatic Reconciliation", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color(0xFF1E3A8A))
                            Text("All transaction entries logged directly update your active cash pool balance and credit card utilization metrics instantly.", color = Color(0xFF1E3A8A).copy(alpha = 0.8f), fontSize = 11.sp)
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
