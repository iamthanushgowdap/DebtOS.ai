package com.example.debtosmobile.ui.main

import android.app.Activity
import android.content.Intent
import android.speech.RecognizerIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.debtosmobile.data.DataRepository
import com.example.debtosmobile.data.model.CreditCard
import com.example.debtosmobile.data.model.ExpenseInsert
import com.example.debtosmobile.data.model.IncomeInsert
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale

private val EXPENSE_CATEGORIES = listOf("Home", "Food", "Travel", "Bills", "Entertainment", "Shopping", "Medical", "Education", "Other")
private val INCOME_SOURCES = listOf("Salary", "Freelancing", "Part Time", "Business", "Other")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransactionBottomSheet(
    isIncome: Boolean,
    repo: DataRepository,
    cards: List<CreditCard>,
    onDismiss: () -> Unit,
    onSuccess: (String) -> Unit
) {
    val scope = rememberCoroutineScope()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    var amount by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf(if (isIncome) "Salary" else "Food") }
    var selectedCardId by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    // Voice input launcher
    val speechLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val text = result.data
                ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
                ?.firstOrNull() ?: return@rememberLauncherForActivityResult
            val parsed = repo.parseVoiceCommand(text)
            parsed.amount?.let { amount = it.toLong().toString() }
            parsed.description?.let { description = it }
            parsed.category?.let { selectedCategory = it }
        }
    }

    // Auto-suggest category when description changes
    LaunchedEffect(description) {
        if (!isIncome && description.length >= 3) {
            repo.suggestCategory(description)?.let { selectedCategory = it }
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color.White,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        if (isIncome) Icons.Default.ArrowUpward else Icons.Default.ArrowDownward,
                        contentDescription = null,
                        tint = if (isIncome) Color(0xFF10B981) else Color(0xFFEF4444),
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        if (isIncome) "Log Income" else "Log Expense",
                        fontSize = 20.sp, fontWeight = FontWeight.Black, color = Color(0xFF09090B)
                    )
                }
                // Voice button
                IconButton(
                    onClick = {
                        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
                            putExtra(RecognizerIntent.EXTRA_PROMPT, if (isIncome) "Say e.g. Got 50000 salary" else "Say e.g. Spent 500 on food")
                        }
                        speechLauncher.launch(intent)
                    },
                    colors = IconButtonDefaults.iconButtonColors(containerColor = Color(0xFFF1F5F9))
                ) {
                    Icon(
                        Icons.Default.Mic, contentDescription = "Voice Input",
                        tint = Color(0xFF2563EB), modifier = Modifier.size(24.dp)
                    )
                }
            }

            // Amount
            OutlinedTextField(
                value = amount,
                onValueChange = { amount = it.filter { c -> c.isDigit() } },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Amount (₹)", color = Color(0xFF475569)) },
                leadingIcon = { Text("₹", color = Color(0xFF2563EB), fontWeight = FontWeight.Bold, fontSize = 16.sp, modifier = Modifier.padding(start = 16.dp)) },
                colors = transactionFieldColors(),
                shape = RoundedCornerShape(12.dp),
                singleLine = true
            )

            // Description
            OutlinedTextField(
                value = description,
                onValueChange = { description = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text(if (isIncome) "Notes (optional)" else "What did you spend on?", color = Color(0xFF475569)) },
                colors = transactionFieldColors(),
                shape = RoundedCornerShape(12.dp),
                singleLine = true
            )

            // Category pills
            Text(if (isIncome) "Source" else "Category", color = Color(0xFF475569), fontSize = 12.sp, fontWeight = FontWeight.Bold)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                val options = if (isIncome) INCOME_SOURCES else EXPENSE_CATEGORIES
                items(options) { cat ->
                    val selected = cat == selectedCategory
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(if (selected) Color(0xFF2563EB) else Color(0xFFF1F5F9))
                            .clickable { selectedCategory = cat }
                            .padding(horizontal = 14.dp, vertical = 8.dp)
                    ) {
                        Text(cat, color = if (selected) Color.White else Color(0xFF475569), fontSize = 12.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal)
                    }
                }
            }

            // Credit card picker (only for expenses)
            if (!isIncome && cards.isNotEmpty()) {
                Text("Paid Via", color = Color(0xFF475569), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    item {
                        val selected = selectedCardId == null
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(20.dp))
                                .background(if (selected) Color(0xFF10B981) else Color(0xFFF1F5F9))
                                .clickable { selectedCardId = null }
                                .padding(horizontal = 14.dp, vertical = 8.dp)
                        ) { Text("Cash/Wallet", color = if (selected) Color.White else Color(0xFF475569), fontSize = 12.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal) }
                    }
                    items(cards) { card ->
                        val selected = selectedCardId == card.id
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(20.dp))
                                .background(if (selected) Color(0xFF2563EB) else Color(0xFFF1F5F9))
                                .clickable { selectedCardId = card.id }
                                .padding(horizontal = 14.dp, vertical = 8.dp)
                        ) { Text(card.cardName, color = if (selected) Color.White else Color(0xFF475569), fontSize = 12.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal) }
                    }
                }
            }

            // Error display
            AnimatedVisibility(visible = error != null) {
                Text(error ?: "", color = Color(0xFFEF4444), fontSize = 12.sp)
            }

            // Submit button
            Button(
                onClick = {
                    val amt = amount.toDoubleOrNull()
                    if (amt == null || amt <= 0) { error = "Enter a valid amount"; return@Button }
                    loading = true
                    scope.launch {
                        try {
                            val today = repo.localTodayStr()
                            if (isIncome) {
                                repo.logIncomeOffline(
                                    source = selectedCategory,
                                    expectedAmount = amt, receivedAmount = amt,
                                    status = "received", entryDate = today
                                )
                                withContext(Dispatchers.IO) { repo.syncPendingTransactions() }
                                onSuccess("Income of ₹${amt.toLong()} logged successfully!")
                            } else {
                                repo.logExpenseOffline(
                                    category = selectedCategory, amount = amt,
                                    description = description.ifBlank { null },
                                    creditCardId = selectedCardId, entryDate = today
                                )
                                withContext(Dispatchers.IO) { repo.syncPendingTransactions() }
                                val msg = if (selectedCardId != null) "Credit card expense of ₹${amt.toLong()} logged!" else "Expense of ₹${amt.toLong()} logged!"
                                onSuccess(msg)
                            }
                        } catch (e: Exception) {
                            error = "Saved offline. Will sync when online."
                            onSuccess("Saved offline — will sync later")
                        }
                        loading = false
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                enabled = !loading,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isIncome) Color(0xFF10B981) else Color(0xFF2563EB)
                )
            ) {
                if (loading) CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                else Text("Confirm Transaction", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Color.White)
            }
        }
    }
}

@Composable
private fun transactionFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = Color(0xFF2563EB),
    unfocusedBorderColor = Color(0xFFE2E8F0),
    focusedTextColor = Color(0xFF09090B),
    unfocusedTextColor = Color(0xFF09090B),
    focusedContainerColor = Color.White,
    unfocusedContainerColor = Color.White
)
