package com.example.debtosmobile.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ─── Auth ────────────────────────────────────────────────────────────────────

@Serializable
data class LoginRequest(val email: String, val password: String)

@Serializable
data class LoginResponse(
    @SerialName("access_token") val accessToken: String = "",
    @SerialName("refresh_token") val refreshToken: String = "",
    val user: AuthUser? = null,
    val error: String? = null,
    @SerialName("error_description") val errorDescription: String? = null
)

@Serializable
data class AuthUser(
    val id: String = "",
    val email: String = ""
)

// ─── Profile ─────────────────────────────────────────────────────────────────

@Serializable
data class Profile(
    val id: String = "",
    val email: String = "",
    val name: String? = null
)

// ─── Loans ───────────────────────────────────────────────────────────────────

@Serializable
data class Loan(
    val id: String = "",
    @SerialName("user_id") val userId: String = "",
    val name: String = "",
    val lender: String = "",
    @SerialName("loan_type") val loanType: String = "",
    val principal: Double = 0.0,
    @SerialName("current_balance") val currentBalance: Double = 0.0,
    @SerialName("interest_rate") val interestRate: Double = 0.0,
    val emi: Double = 0.0,
    @SerialName("due_day") val dueDay: Int = 1,
    val status: String = "active",
    val priority: String = "medium",
    @SerialName("start_date") val startDate: String = "",
    @SerialName("end_date") val endDate: String = "",
    val notes: String? = null
)

// ─── Credit Cards ─────────────────────────────────────────────────────────────

@Serializable
data class CreditCard(
    val id: String = "",
    @SerialName("user_id") val userId: String = "",
    @SerialName("card_name") val cardName: String = "",
    val bank: String = "",
    @SerialName("credit_limit") val creditLimit: Double = 0.0,
    @SerialName("current_utilization") val currentUtilization: Double = 0.0,
    @SerialName("minimum_due") val minimumDue: Double = 0.0,
    @SerialName("statement_date") val statementDate: Int = 1,
    @SerialName("due_date") val dueDate: Int = 1,
    @SerialName("annual_fee") val annualFee: Double = 0.0,
    val status: String = "active"
)

// ─── Payments ─────────────────────────────────────────────────────────────────

@Serializable
data class LoanPaymentInsert(
    @SerialName("loan_id") val loanId: String,
    @SerialName("user_id") val userId: String,
    val amount: Double,
    @SerialName("payment_date") val paymentDate: String,
    val status: String = "paid"
)

@Serializable
data class CreditCardPaymentInsert(
    @SerialName("credit_card_id") val creditCardId: String,
    @SerialName("user_id") val userId: String,
    val amount: Double,
    @SerialName("payment_date") val paymentDate: String
)

// ─── Income ───────────────────────────────────────────────────────────────────

@Serializable
data class IncomeEntry(
    val id: String = "",
    @SerialName("user_id") val userId: String = "",
    val source: String = "",
    @SerialName("expected_amount") val expectedAmount: Double = 0.0,
    @SerialName("received_amount") val receivedAmount: Double = 0.0,
    val status: String = "pending",
    @SerialName("entry_date") val entryDate: String = ""
)

@Serializable
data class IncomeInsert(
    @SerialName("user_id") val userId: String,
    val source: String,
    @SerialName("expected_amount") val expectedAmount: Double,
    @SerialName("received_amount") val receivedAmount: Double,
    val status: String,
    @SerialName("entry_date") val entryDate: String
)

// ─── Expenses ─────────────────────────────────────────────────────────────────

@Serializable
data class ExpenseEntry(
    val id: String = "",
    @SerialName("user_id") val userId: String = "",
    val category: String = "",
    val amount: Double = 0.0,
    @SerialName("entry_date") val entryDate: String = "",
    val description: String? = null,
    @SerialName("credit_card_id") val creditCardId: String? = null
)

@Serializable
data class ExpenseInsert(
    @SerialName("user_id") val userId: String,
    val category: String,
    val amount: Double,
    @SerialName("entry_date") val entryDate: String,
    val description: String? = null,
    @SerialName("credit_card_id") val creditCardId: String? = null
)

// ─── AI Advisor ───────────────────────────────────────────────────────────────

@Serializable
data class AdvisorRequest(val query: String)

@Serializable
data class AdvisorResponse(
    val answer: String = "",
    val error: String? = null
)

// ─── Dashboard Summary ────────────────────────────────────────────────────────

data class DashboardSummary(
    val profileName: String,
    val cashBalance: Double,
    val totalCreditLimit: Double,
    val totalUtilization: Double,
    val upcomingLoans: List<Loan>,
    val upcomingCards: List<CreditCard>
)
