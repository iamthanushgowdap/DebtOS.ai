package com.example.debtosmobile

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.example.debtosmobile.data.DataRepository
import com.example.debtosmobile.theme.DebtOSMobileTheme
import com.example.debtosmobile.worker.DueReminderWorker

class MainActivity : ComponentActivity() {

    private lateinit var repo: DataRepository

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { /* permissions granted/denied — handled gracefully inside screens */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        repo = DataRepository(applicationContext)

        // Request runtime permissions
        val perms = mutableListOf(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        permissionLauncher.launch(perms.toTypedArray())

        // Schedule daily due reminders if user is logged in
        if (repo.isLoggedIn()) {
            DueReminderWorker.schedule(applicationContext)
        }

        enableEdgeToEdge()
        setContent {
            DebtOSMobileTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    MainNavigation(repo = repo)
                }
            }
        }
    }
}
