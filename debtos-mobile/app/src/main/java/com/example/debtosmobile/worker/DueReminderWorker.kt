package com.example.debtosmobile.worker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.*
import com.example.debtosmobile.data.DataRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Calendar
import java.util.concurrent.TimeUnit

class DueReminderWorker(
    private val ctx: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(ctx, workerParams) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val repo = DataRepository(ctx)
            if (!repo.isLoggedIn()) return@withContext Result.success()

            val today = Calendar.getInstance().get(Calendar.DAY_OF_MONTH)
            val soon = today + 2

            val loans = repo.fetchAndCacheLoans()
            val cards = repo.fetchAndCacheCards()

            val dueLoanNames = loans.filter { it.dueDay in today..soon }
                .map { "${it.name} EMI ₹${it.emi.toLong()}" }

            val dueCardNames = cards.filter { it.dueDate in today..soon }
                .map { "${it.cardName} min due ₹${it.minimumDue.toLong()}" }

            val allDues = dueLoanNames + dueCardNames
            if (allDues.isNotEmpty()) {
                sendNotification(allDues)
            }

            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    private fun sendNotification(dues: List<String>) {
        val manager = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "debtos_reminders"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId, "DebtOS Reminders",
                NotificationManager.IMPORTANCE_HIGH
            ).apply { description = "Upcoming EMI and credit card due reminders" }
            manager.createNotificationChannel(channel)
        }

        val body = dues.joinToString("\n")
        val notification = NotificationCompat.Builder(ctx, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("💳 DebtOS — Upcoming Dues")
            .setContentText(if (dues.size == 1) body else "${dues.size} dues coming up soon")
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()

        manager.notify(1001, notification)
    }

    companion object {
        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<DueReminderWorker>(1, TimeUnit.DAYS)
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "due_reminder",
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }
    }
}
