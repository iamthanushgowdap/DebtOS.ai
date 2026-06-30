package com.example.debtosmobile.ui.main

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.debtosmobile.data.DataRepository
import com.example.debtosmobile.data.local.CachedCard
import com.example.debtosmobile.data.local.CachedLoan
import java.util.Calendar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalendarScreen(repo: DataRepository) {
    val loans by repo.cachedLoans.collectAsState(initial = emptyList())
    val cards by repo.cachedCards.collectAsState(initial = emptyList())

    val today = Calendar.getInstance()
    var selectedDay by remember { mutableStateOf(today.get(Calendar.DAY_OF_MONTH)) }
    
    // We'll render a simple calendar grid for the current month
    val daysInMonth = today.getActualMaximum(Calendar.DAY_OF_MONTH)
    
    // Determine month string
    val monthName = when (today.get(Calendar.MONTH)) {
        Calendar.JANUARY -> "January"
        Calendar.FEBRUARY -> "February"
        Calendar.MARCH -> "March"
        Calendar.APRIL -> "April"
        Calendar.MAY -> "May"
        Calendar.JUNE -> "June"
        Calendar.JULY -> "July"
        Calendar.AUGUST -> "August"
        Calendar.SEPTEMBER -> "September"
        Calendar.OCTOBER -> "October"
        Calendar.NOVEMBER -> "November"
        else -> "December"
    }
    val year = today.get(Calendar.YEAR)

    // Items due on the selected day
    val loansDueOnSelected = loans.filter { it.dueDay == selectedDay }
    val cardsDueOnSelected = cards.filter { it.dueDate == selectedDay }

    Scaffold(
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
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "Payment Calendar",
                        color = Color(0xFF09090B),
                        fontWeight = FontWeight.Black,
                        fontSize = 18.sp
                    )
                    Text(
                        "$monthName $year",
                        color = Color(0xFF2563EB),
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                }
            }

            // Calendar Grid
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    elevation = CardDefaults.cardElevation(2.dp)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        // Weekday labels
                        Row(modifier = Modifier.fillMaxWidth()) {
                            val daysOfWeek = listOf("S", "M", "T", "W", "T", "F", "S")
                            daysOfWeek.forEach { day ->
                                Text(
                                    text = day,
                                    modifier = Modifier.weight(1f),
                                    textAlign = TextAlign.Center,
                                    fontSize = 11.sp,
                                    color = Color(0xFF64748B),
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                        
                        Spacer(Modifier.height(8.dp))

                        // Grid days
                        val chunkedDays = (1..daysInMonth).chunked(7)
                        chunkedDays.forEach { week ->
                            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                week.forEach { day ->
                                    val isSelected = day == selectedDay
                                    val hasLoanDue = loans.any { it.dueDay == day }
                                    val hasCardDue = cards.any { it.dueDate == day }
                                    
                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .aspectRatio(1f)
                                            .padding(4.dp)
                                            .background(
                                                color = if (isSelected) Color(0xFF2563EB) else Color.Transparent,
                                                shape = RoundedCornerShape(10.dp)
                                            )
                                            .clickable { selectedDay = day },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                            Text(
                                                text = day.toString(),
                                                color = if (isSelected) Color.White else Color(0xFF09090B),
                                                fontSize = 13.sp,
                                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                            )
                                            // Tiny dot indicator for due items
                                            if (hasLoanDue || hasCardDue) {
                                                Box(
                                                    modifier = Modifier
                                                        .size(4.dp)
                                                        .background(
                                                            color = if (isSelected) Color.White else Color(0xFFEF4444),
                                                            shape = RoundedCornerShape(2.dp)
                                                        )
                                                )
                                            }
                                        }
                                    }
                                }
                                // Fill remaining spaces if last week has less than 7 days
                                if (week.size < 7) {
                                    repeat(7 - week.size) {
                                        Spacer(modifier = Modifier.weight(1f))
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Dues list header
            item {
                Text(
                    "Dues for Day $selectedDay",
                    fontWeight = FontWeight.Black,
                    fontSize = 15.sp,
                    color = Color(0xFF09090B),
                    modifier = Modifier.padding(top = 8.dp)
                )
            }

            // Empty state for selected day
            if (loansDueOnSelected.isEmpty() && cardsDueOnSelected.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            "No payments scheduled for this date",
                            color = Color(0xFF64748B),
                            fontSize = 12.sp
                        )
                    }
                }
            }

            // Loan dues
            items(loansDueOnSelected) { loan ->
                CalendarDueCard(
                    title = loan.name,
                    subtitle = "Lender: ${loan.lender}",
                    amount = "₹${loan.emi.toLong()}",
                    type = "Loan EMI",
                    color = Color(0xFFF59E0B)
                )
            }

            // Card dues
            items(cardsDueOnSelected) { card ->
                CalendarDueCard(
                    title = card.cardName,
                    subtitle = "Bank: ${card.bank}",
                    amount = "₹${(card.currentUtilization * 0.02).toLong()}",
                    type = "Card Rotation Cost (2%)",
                    color = Color(0xFFEF4444)
                )
            }
        }
    }
}

@Composable
private fun CalendarDueCard(
    title: String,
    subtitle: String,
    amount: String,
    type: String,
    color: Color
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
        elevation = CardDefaults.cardElevation(1.dp)
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(4.dp)
                    .background(color, RoundedCornerShape(2.dp))
            )
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(title, fontWeight = FontWeight.Black, fontSize = 14.sp, color = Color(0xFF09090B))
                Text(subtitle, fontSize = 11.sp, color = Color(0xFF64748B))
                Spacer(Modifier.height(4.dp))
                Box(
                    modifier = Modifier
                        .background(color.copy(alpha = 0.1f), RoundedCornerShape(6.dp))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(type, color = color, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                }
            }
            Text(amount, fontWeight = FontWeight.Black, fontSize = 15.sp, color = Color(0xFF09090B))
        }
    }
}
