package com.example.debtosmobile.ui.main

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Home
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.debtosmobile.data.DataRepository

private enum class Tab(val label: String, val icon: ImageVector) {
    Dashboard("Dashboard", Icons.Default.Home),
    Chat("AI Advisor", Icons.AutoMirrored.Filled.Chat)
}

@Composable
fun MainScreen(repo: DataRepository, onLogout: () -> Unit) {
    var activeTab by remember { mutableStateOf(Tab.Dashboard) }

    Scaffold(
        containerColor = Color(0xFF0F172A),
        topBar = {
            // Minimal top bar with logout
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    "DebtOS",
                    color = Color(0xFFF8FAFC),
                    fontWeight = FontWeight.Black,
                    fontSize = 18.sp
                )
                IconButton(onClick = onLogout) {
                    Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = "Logout", tint = Color(0xFF94A3B8))
                }
            }
        },
        bottomBar = {
            NavigationBar(containerColor = Color(0xFF1E293B)) {
                Tab.values().forEach { tab ->
                    NavigationBarItem(
                        selected = activeTab == tab,
                        onClick = { activeTab = tab },
                        icon = {
                            Icon(
                                tab.icon,
                                contentDescription = tab.label,
                                tint = if (activeTab == tab) Color(0xFF8B5CF6) else Color(0xFF64748B)
                            )
                        },
                        label = {
                            Text(
                                tab.label,
                                fontSize = 10.sp,
                                color = if (activeTab == tab) Color(0xFF8B5CF6) else Color(0xFF64748B),
                                fontWeight = if (activeTab == tab) FontWeight.Bold else FontWeight.Normal
                            )
                        },
                        colors = NavigationBarItemDefaults.colors(
                            indicatorColor = Color(0xFF8B5CF6).copy(alpha = 0.15f)
                        )
                    )
                }
            }
        }
    ) { paddingValues ->
        Box(modifier = Modifier.padding(paddingValues)) {
            when (activeTab) {
                Tab.Dashboard -> DashboardScreen(repo = repo)
                Tab.Chat -> ChatScreen(repo = repo)
            }
        }
    }
}
