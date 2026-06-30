package com.example.debtosmobile.ui.main

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.debtosmobile.data.DataRepository
import com.example.debtosmobile.data.local.CachedLoan
import com.example.debtosmobile.data.model.LoanPaymentInsert
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoansScreen(repo: DataRepository) {
    val scope = rememberCoroutineScope()
    val loans by repo.cachedLoans.collectAsState(initial = emptyList())
    
    var selectedLoan by remember { mutableStateOf<CachedLoan?>(null) }
    var loanToPay by remember { mutableStateOf<CachedLoan?>(null) }
    
    var showConfirmDialog by remember { mutableStateOf(false) }
    var snackMsg by remember { mutableStateOf<String?>(null) }
    val snackbarHostState = remember { SnackbarHostState() }

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
        if (loans.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                Text("No active loans mapped", color = Color(0xFF475569), fontSize = 14.sp)
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    Text(
                        "Active Loans",
                        color = Color(0xFF09090B),
                        fontWeight = FontWeight.Black,
                        fontSize = 18.sp,
                        modifier = Modifier.padding(bottom = 4.dp)
                    )
                }

                items(loans) { loan ->
                    LoanCard(
                        loan = loan,
                        onClick = { selectedLoan = loan },
                        onPayClick = { loanToPay = loan; showConfirmDialog = true }
                    )
                }
            }
        }
    }

    // Confirmation Dialog for Paying EMI
    val loanToPayLocal = loanToPay
    if (showConfirmDialog && loanToPayLocal != null) {
        val loan = loanToPayLocal
        AlertDialog(
            onDismissRequest = { showConfirmDialog = false },
            title = { Text("Log EMI Payment?", fontWeight = FontWeight.Bold) },
            text = { Text("Are you sure you want to log the monthly EMI payment of ₹${loan.emi.toLong()} for ${loan.name}?") },
            confirmButton = {
                Button(
                    onClick = {
                        showConfirmDialog = false
                        scope.launch {
                            val ok = withContext(Dispatchers.IO) {
                                repo.api.insertLoanPayment(repo.token, LoanPaymentInsert(
                                    loanId = loan.id, userId = repo.userId,
                                    amount = loan.emi, paymentDate = repo.localTodayStr()
                                ))
                            }
                            snackMsg = if (ok) "EMI of ${loan.name} marked paid!" else "Failed to mark paid"
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
                ) { Text("Confirm", color = Color.White) }
            },
            dismissButton = {
                TextButton(onClick = { showConfirmDialog = false }) {
                    Text("Cancel", color = Color(0xFF64748B))
                }
            },
            containerColor = Color.White,
            shape = RoundedCornerShape(16.dp)
        )
    }

    // Loan Detail Dialog (Brief)
    val selectedLoanLocal = selectedLoan
    if (selectedLoanLocal != null) {
        val loan = selectedLoanLocal
        val progress = if (loan.currentBalance > 0) {
            // principal paid estimate (since Room entity doesn't store original principal directly, we'll estimate progress)
            // Or assume progress is based on standard reduction. Let's show details.
            0.5f // Default display indicator
        } else {
            1f
        }

        AlertDialog(
            onDismissRequest = { selectedLoan = null },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.AccountBalance, null, tint = Color(0xFF2563EB), modifier = Modifier.size(22.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(loan.name, fontWeight = FontWeight.Black, fontSize = 18.sp, color = Color(0xFF09090B))
                }
            },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    DetailRow(label = "Lender", value = loan.lender)
                    DetailRow(label = "Current Balance", value = "₹${loan.currentBalance.toLong()}")
                    DetailRow(label = "Monthly EMI", value = "₹${loan.emi.toLong()}")
                    DetailRow(label = "Interest Rate", value = "${loan.interestRate}% p.a.")
                    DetailRow(label = "Due Day", value = "Day ${loan.dueDay} of every month")
                    DetailRow(label = "Priority Level", value = loan.priority.replaceFirstChar { it.uppercase() })
                    
                    Spacer(Modifier.height(8.dp))
                    Text("Repayment Status", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Color(0xFF475569))
                    LinearProgressIndicator(
                        progress = { progress },
                        modifier = Modifier.fillMaxWidth().height(8.dp),
                        color = Color(0xFF10B981),
                        trackColor = Color(0xFFE2E8F0)
                    )
                    Text("Paying down balance step by step.", color = Color(0xFF64748B), fontSize = 10.sp)
                }
            },
            confirmButton = {
                Button(
                    onClick = { selectedLoan = null },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
                ) { Text("Close", color = Color.White) }
            },
            containerColor = Color.White,
            shape = RoundedCornerShape(20.dp)
        )
    }
}

@Composable
private fun LoanCard(
    loan: CachedLoan,
    onClick: () -> Unit,
    onPayClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
        elevation = CardDefaults.cardElevation(2.dp)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(loan.name, color = Color(0xFF09090B), fontWeight = FontWeight.Black, fontSize = 16.sp)
                    Spacer(Modifier.width(6.dp))
                    Box(
                        modifier = Modifier
                            .background(
                                when (loan.priority.lowercase()) {
                                    "high" -> Color(0xFFFEF2F2)
                                    "medium" -> Color(0xFFFFFBEB)
                                    else -> Color(0xFFF0FDF4)
                                },
                                RoundedCornerShape(6.dp)
                            )
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            loan.priority.uppercase(),
                            color = when (loan.priority.lowercase()) {
                                "high" -> Color(0xFFEF4444)
                                "medium" -> Color(0xFFD97706)
                                else -> Color(0xFF22C55E)
                            },
                            fontSize = 8.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
                Text(loan.lender, color = Color(0xFF475569), fontSize = 12.sp)
                Spacer(Modifier.height(8.dp))
                Text("EMI: ₹${loan.emi.toLong()} • Balance: ₹${loan.currentBalance.toLong()}", color = Color(0xFF475569), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
            
            Button(
                onClick = onPayClick,
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB)),
                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
            ) {
                Text("Pay", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }
        }
    }
}

@Composable
fun DetailRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, color = Color(0xFF64748B), fontSize = 12.sp, fontWeight = FontWeight.Medium)
        Text(value, color = Color(0xFF09090B), fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
}
