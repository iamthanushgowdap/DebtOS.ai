package com.example.debtosmobile.data.api

import com.example.debtosmobile.data.model.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

private const val SUPABASE_URL = "https://vmgfolcjthkxnisvadzu.supabase.co"
private const val SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtZ2ZvbGNqdGhreG5pc3ZhZHp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MDM1MjYsImV4cCI6MjA5NjA3OTUyNn0.hCDmE9rTvcEw2l54cIzNa-pivcD9Qp-ISUEtc7o0Tc4"

private var resolvedBaseUrl = "https://debt-os-ai.vercel.app"

class SupabaseClient {
    private val http = OkHttpClient()
    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }
    private val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()

    // ─── Auth ─────────────────────────────────────────────────────────────────

    fun login(email: String, password: String): LoginResponse {
        val body = json.encodeToString(LoginRequest(email, password))
            .toRequestBody(JSON_MEDIA)
        val req = Request.Builder()
            .url("$SUPABASE_URL/auth/v1/token?grant_type=password")
            .addHeader("apikey", SUPABASE_ANON_KEY)
            .addHeader("Content-Type", "application/json")
            .post(body)
            .build()
        val resp = http.newCall(req).execute()
        val raw = resp.body?.string() ?: return LoginResponse(error = "No response")
        return try { json.decodeFromString<LoginResponse>(raw) }
        catch (e: Exception) { LoginResponse(error = e.message) }
    }

    // ─── Profile ──────────────────────────────────────────────────────────────

    fun getProfile(token: String, userId: String): Profile? {
        val req = supabaseGet(token, "/rest/v1/profiles?id=eq.$userId&select=*")
        val list = execList<Profile>(req) ?: return null
        return list.firstOrNull()
    }

    // ─── Loans ────────────────────────────────────────────────────────────────

    fun getLoans(token: String, userId: String): List<Loan> {
        val req = supabaseGet(token, "/rest/v1/loans?user_id=eq.$userId&status=eq.active&select=*")
        return execList(req) ?: emptyList()
    }

    // ─── Credit Cards ─────────────────────────────────────────────────────────

    fun getCreditCards(token: String, userId: String): List<CreditCard> {
        val req = supabaseGet(token, "/rest/v1/credit_cards?user_id=eq.$userId&select=*")
        return execList(req) ?: emptyList()
    }

    fun patchCardUtilization(token: String, cardId: String, newUtilization: Double) {
        val body = """{"current_utilization":$newUtilization}"""
            .toRequestBody(JSON_MEDIA)
        val req = Request.Builder()
            .url("$SUPABASE_URL/rest/v1/credit_cards?id=eq.$cardId")
            .addHeader("apikey", SUPABASE_ANON_KEY)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .addHeader("Prefer", "return=minimal")
            .patch(body)
            .build()
        http.newCall(req).execute().close()
    }

    // ─── Income ───────────────────────────────────────────────────────────────

    fun getIncome(token: String, userId: String): List<IncomeEntry> {
        val req = supabaseGet(token, "/rest/v1/income_entries?user_id=eq.$userId&select=*")
        return execList(req) ?: emptyList()
    }

    fun insertIncome(token: String, income: IncomeInsert): Boolean {
        val body = json.encodeToString(income).toRequestBody(JSON_MEDIA)
        return supabasePost(token, "/rest/v1/income_entries", body)
    }

    // ─── Expenses ─────────────────────────────────────────────────────────────

    fun getExpenses(token: String, userId: String): List<ExpenseEntry> {
        val req = supabaseGet(token, "/rest/v1/expense_entries?user_id=eq.$userId&select=*")
        return execList(req) ?: emptyList()
    }

    fun insertExpense(token: String, expense: ExpenseInsert): Boolean {
        val body = json.encodeToString(expense).toRequestBody(JSON_MEDIA)
        return supabasePost(token, "/rest/v1/expense_entries", body)
    }

    // ─── Loan Payments ────────────────────────────────────────────────────────

    fun insertLoanPayment(token: String, payment: LoanPaymentInsert): Boolean {
        val body = json.encodeToString(payment).toRequestBody(JSON_MEDIA)
        return supabasePost(token, "/rest/v1/loan_payments", body)
    }

    fun getLoanPaymentsForMonth(token: String, userId: String, yearMonth: String): List<JsonObject> {
        // yearMonth like "2026-06"
        val req = supabaseGet(token, "/rest/v1/loan_payments?user_id=eq.$userId&payment_date=gte.${yearMonth}-01&select=loan_id,payment_date")
        val resp = http.newCall(req).execute()
        val raw = resp.body?.string() ?: return emptyList()
        return try { json.decodeFromString<List<JsonObject>>(raw) } catch (e: Exception) { emptyList() }
    }

    // ─── Credit Card Payments ─────────────────────────────────────────────────

    fun insertCardPayment(token: String, payment: CreditCardPaymentInsert): Boolean {
        val body = json.encodeToString(payment).toRequestBody(JSON_MEDIA)
        return supabasePost(token, "/rest/v1/credit_card_payments", body)
    }

    fun getLoanPayments(token: String, userId: String): List<JsonObject> {
        val req = supabaseGet(token, "/rest/v1/loan_payments?user_id=eq.$userId&select=amount")
        return execList(req) ?: emptyList()
    }

    fun getCardPayments(token: String, userId: String): List<JsonObject> {
        val req = supabaseGet(token, "/rest/v1/credit_card_payments?user_id=eq.$userId&select=amount")
        return execList(req) ?: emptyList()
    }

    // ─── AI Advisor via Next.js ───────────────────────────────────────────────

    fun askAdvisor(token: String, query: String): AdvisorResponse {
        val body = json.encodeToString(AdvisorRequest(query)).toRequestBody(JSON_MEDIA)
        val currentBase = resolvedBaseUrl
        val req = Request.Builder()
            .url("$currentBase/api/ai/advisor")
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .post(body)
            .build()
        return try {
            val resp = http.newCall(req).execute()
            val raw = resp.body?.string() ?: return AdvisorResponse(error = "No response")
            json.decodeFromString<AdvisorResponse>(raw)
        } catch (e: Exception) {
            // Try fallback URLs (Vercel -> Emulator Localhost -> Native Localhost)
            val fallbacks = listOf("https://debt-os-ai.vercel.app", "http://10.0.2.2:8000", "http://localhost:8000")
            for (fallbackBase in fallbacks) {
                if (fallbackBase == currentBase) continue
                val fallbackReq = Request.Builder()
                    .url("$fallbackBase/api/ai/advisor")
                    .addHeader("Authorization", "Bearer $token")
                    .addHeader("Content-Type", "application/json")
                    .post(body)
                    .build()
                try {
                    val resp = http.newCall(fallbackReq).execute()
                    val raw = resp.body?.string() ?: continue
                    resolvedBaseUrl = fallbackBase // Save the successful url
                    return json.decodeFromString<AdvisorResponse>(raw)
                } catch (ignored: Exception) {}
            }
            AdvisorResponse(error = "Connection failed. Please check your internet connection or ensure your backend server is running.")
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private fun supabaseGet(token: String, path: String): Request =
        Request.Builder()
            .url("$SUPABASE_URL$path")
            .addHeader("apikey", SUPABASE_ANON_KEY)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Accept", "application/json")
            .get()
            .build()

    private fun supabasePost(token: String, path: String, body: RequestBody): Boolean {
        val req = Request.Builder()
            .url("$SUPABASE_URL$path")
            .addHeader("apikey", SUPABASE_ANON_KEY)
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .addHeader("Prefer", "return=minimal")
            .post(body)
            .build()
        return try {
            val resp = http.newCall(req).execute()
            resp.isSuccessful.also { resp.close() }
        } catch (e: IOException) { false }
    }

    private inline fun <reified T> execList(req: Request): List<T>? {
        return try {
            val resp = http.newCall(req).execute()
            val raw = resp.body?.string() ?: return null
            json.decodeFromString<List<T>>(raw)
        } catch (e: Exception) { null }
    }
}
