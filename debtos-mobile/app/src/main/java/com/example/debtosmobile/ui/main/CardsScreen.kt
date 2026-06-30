package com.example.debtosmobile.ui.main

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.debtosmobile.data.DataRepository
import com.example.debtosmobile.data.local.CachedCard
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CardsScreen(repo: DataRepository) {
    val scope = rememberCoroutineScope()
    val cards by repo.cachedCards.collectAsState(initial = emptyList())
    
    var cardToRotate by remember { mutableStateOf<CachedCard?>(null) }
    
    var showRotateDialog by remember { mutableStateOf(false) }
    var rotatePaymentAmount by remember { mutableStateOf("") }
    var rotateCashoutAmount by remember { mutableStateOf("") }
    var rotateFeePercent by remember { mutableStateOf("2.0") }
    
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
        if (cards.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                Text("No credit cards mapped", color = Color(0xFF475569), fontSize = 14.sp)
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
                        "Credit Cards",
                        color = Color(0xFF09090B),
                        fontWeight = FontWeight.Black,
                        fontSize = 18.sp,
                        modifier = Modifier.padding(bottom = 4.dp)
                    )
                }

                items(cards) { card ->
                    CardListItem(
                        card = card,
                        onRotateClick = {
                            cardToRotate = card
                            rotatePaymentAmount = card.currentUtilization.toLong().toString()
                            rotateCashoutAmount = card.currentUtilization.toLong().toString()
                            showRotateDialog = true
                        }
                    )
                }
            }
        }
    }

    // Rotate Limit Dialog
    val cardToRotateLocal = cardToRotate
    if (showRotateDialog && cardToRotateLocal != null) {
        val card = cardToRotateLocal
        AlertDialog(
            onDismissRequest = { showRotateDialog = false },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.CreditCard, null, tint = Color(0xFF2563EB), modifier = Modifier.size(22.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Rotate ${card.cardName} Limit", fontWeight = FontWeight.Black, fontSize = 16.sp, color = Color(0xFF09090B))
                }
            },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        "Refinance limit by logging a temporary repayment and immediate cashout.",
                        color = Color(0xFF64748B),
                        fontSize = 11.sp
                    )

                    OutlinedTextField(
                        value = rotatePaymentAmount,
                        onValueChange = { rotatePaymentAmount = it.filter { c -> c.isDigit() } },
                        label = { Text("Repayment Amount (₹)", color = Color(0xFF475569)) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        colors = fieldColors(),
                        shape = RoundedCornerShape(10.dp),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = rotateCashoutAmount,
                        onValueChange = { rotateCashoutAmount = it.filter { c -> c.isDigit() } },
                        label = { Text("Cashout/Draw Amount (₹)", color = Color(0xFF475569)) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        colors = fieldColors(),
                        shape = RoundedCornerShape(10.dp),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = rotateFeePercent,
                        onValueChange = { rotateFeePercent = it },
                        label = { Text("Rotation Fee Percent (%)", color = Color(0xFF475569)) },
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
                        if (pay <= 0 || draw <= 0) {
                            snackMsg = "Please enter valid payment and cashout amounts"
                            return@Button
                        }
                        showRotateDialog = false
                        showConfirmDialog = true
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
                ) { Text("Rotate", color = Color.White) }
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

    // Confirmation Dialog for Rotate Card
    if (showConfirmDialog && cardToRotateLocal != null) {
        val card = cardToRotateLocal
        val pay = rotatePaymentAmount.toDoubleOrNull() ?: 0.0
        val draw = rotateCashoutAmount.toDoubleOrNull() ?: 0.0
        val feePct = rotateFeePercent.toDoubleOrNull() ?: 2.0
        val feeAmt = Math.round((draw * feePct) / 100).toDouble()

        AlertDialog(
            onDismissRequest = { showConfirmDialog = false },
            title = { Text("Confirm Card Rotation?", fontWeight = FontWeight.Bold) },
            text = {
                Text("This action will record:\n" +
                        "1. Repayment of ₹${pay.toLong()} to ${card.cardName}\n" +
                        "2. Cashout income of ₹${draw.toLong()}\n" +
                        "3. Rotation fee expense of ₹${feeAmt.toLong()} (${feePct}%)\n" +
                        "Confirm to execute transaction.")
            },
            confirmButton = {
                Button(
                    onClick = {
                        showConfirmDialog = false
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
                            snackMsg = if (ok) "${card.cardName} limit rotated successfully!" else "Failed to rotate card limit"
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
}

@Composable
private fun CardListItem(
    card: CachedCard,
    onRotateClick: () -> Unit
) {
    val utilPct = if (card.creditLimit > 0) card.currentUtilization / card.creditLimit else 0.0
    val rotationCost = card.currentUtilization * 0.02

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
        elevation = CardDefaults.cardElevation(2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(card.cardName, color = Color(0xFF09090B), fontWeight = FontWeight.Black, fontSize = 16.sp)
                    Text(card.bank, color = Color(0xFF475569), fontSize = 12.sp)
                    Spacer(Modifier.height(8.dp))
                    Text("Rotation Cost (2%): ₹${rotationCost.toLong()}", color = Color(0xFFEF4444), fontSize = 12.sp, fontWeight = FontWeight.Black)
                }
                
                Button(
                    onClick = onRotateClick,
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE2E8F0)),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
                ) {
                    Text("Rotate", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF1E293B))
                }
            }
            Spacer(Modifier.height(14.dp))
            
            // Progress Bar
            LinearProgressIndicator(
                progress = { utilPct.toFloat().coerceIn(0f, 1f) },
                modifier = Modifier.fillMaxWidth().height(6.dp),
                color = if (utilPct > 0.75) Color(0xFFEF4444) else Color(0xFF2563EB),
                trackColor = Color(0xFFF1F5F9)
            )
            Spacer(Modifier.height(6.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    "${(utilPct * 100).toInt()}% Utilized (₹${card.currentUtilization.toLong()} spent)",
                    color = Color(0xFF475569),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    "Limit: ₹${card.creditLimit.toLong()}",
                    color = Color(0xFF64748B),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
            }
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
