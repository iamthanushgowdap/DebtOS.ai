package com.example.debtosmobile.ui.main

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.debtosmobile.R
import com.example.debtosmobile.data.DataRepository
import kotlinx.coroutines.launch

private enum class NavigationScreen(val label: String, val icon: ImageVector) {
    Dashboard("Dashboard", Icons.Default.Home),
    Chat("AI Advisor", Icons.AutoMirrored.Filled.Chat),
    Loans("Loans Command", Icons.Default.AccountBalanceWallet),
    Cards("Cards Command", Icons.Default.CreditCard),
    Calendar("Upcoming Calendar", Icons.Default.CalendarMonth),
    Ledger("Income & Expenses", Icons.Default.ReceiptLong)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(repo: DataRepository, onLogout: () -> Unit) {
    var activeScreen by remember { mutableStateOf(NavigationScreen.Dashboard) }
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    
    var showLogoutConfirm by remember { mutableStateOf(false) }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                drawerContainerColor = Color(0xFF0F172A), // Dark slate premium sidebar
                modifier = Modifier.width(300.dp)
            ) {
                Spacer(Modifier.height(16.dp))
                // Sidebar Header
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .background(Color.White, shape = RoundedCornerShape(12.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.logo),
                            contentDescription = "DebtOS Logo",
                            modifier = Modifier.size(32.dp)
                        )
                    }
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(
                            "DebtOS AI",
                            color = Color.White,
                            fontWeight = FontWeight.Black,
                            fontSize = 18.sp
                        )
                        Text(
                            "Command Center v1.0",
                            color = Color(0xFFF59E0B),
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp
                        )
                    }
                }

                HorizontalDivider(color = Color.White.copy(alpha = 0.08f), modifier = Modifier.padding(vertical = 8.dp))

                // Navigation Items
                Column(
                    modifier = Modifier
                        .fillMaxHeight()
                        .padding(horizontal = 12.dp),
                    verticalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        NavigationScreen.values().forEach { screen ->
                            val isSelected = activeScreen == screen
                            NavigationDrawerItem(
                                label = { Text(screen.label, fontWeight = FontWeight.Bold, fontSize = 14.sp) },
                                selected = isSelected,
                                onClick = {
                                    activeScreen = screen
                                    scope.launch { drawerState.close() }
                                },
                                icon = { Icon(screen.icon, contentDescription = screen.label) },
                                colors = NavigationDrawerItemDefaults.colors(
                                    selectedContainerColor = Color(0xFF2563EB),
                                    unselectedContainerColor = Color.Transparent,
                                    selectedIconColor = Color.White,
                                    unselectedIconColor = Color(0xFF94A3B8),
                                    selectedTextColor = Color.White,
                                    unselectedTextColor = Color(0xFF94A3B8)
                                ),
                                shape = RoundedCornerShape(12.dp)
                            )
                        }
                    }

                    // Logout Button in Drawer Footer
                    Column(modifier = Modifier.padding(bottom = 24.dp)) {
                        NavigationDrawerItem(
                            label = { Text("Exit Console", fontWeight = FontWeight.Bold, fontSize = 14.sp) },
                            selected = false,
                            onClick = {
                                scope.launch { drawerState.close() }
                                showLogoutConfirm = true
                            },
                            icon = { Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = "Logout") },
                            colors = NavigationDrawerItemDefaults.colors(
                                unselectedContainerColor = Color.Transparent,
                                unselectedIconColor = Color(0xFFEF4444),
                                unselectedTextColor = Color(0xFFEF4444)
                            ),
                            shape = RoundedCornerShape(12.dp)
                        )
                    }
                }
            }
        }
    ) {
        Scaffold(
            containerColor = Color(0xFFF8FAFC),
            topBar = {
                Surface(
                    color = Color.White,
                    tonalElevation = 2.dp,
                    shadowElevation = 1.dp
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .statusBarsPadding()
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconButton(
                                onClick = { scope.launch { drawerState.open() } }
                            ) {
                                Icon(Icons.Default.Menu, contentDescription = "Open Drawer", tint = Color(0xFF1E293B))
                            }
                            Spacer(Modifier.width(8.dp))
                            Text(
                                when (activeScreen) {
                                    NavigationScreen.Dashboard -> "Dashboard"
                                    NavigationScreen.Chat -> "AI Advisor"
                                    NavigationScreen.Loans -> "Loans Command"
                                    NavigationScreen.Cards -> "Cards Command"
                                    NavigationScreen.Calendar -> "Upcoming Calendar"
                                    NavigationScreen.Ledger -> "Income & Expenses"
                                },
                                color = Color(0xFF09090B),
                                fontWeight = FontWeight.Black,
                                fontSize = 18.sp
                            )
                        }

                        IconButton(
                            onClick = { showLogoutConfirm = true },
                            colors = IconButtonDefaults.iconButtonColors(containerColor = Color(0xFFFEF2F2))
                        ) {
                            Icon(
                                Icons.AutoMirrored.Filled.Logout, 
                                contentDescription = "Logout", 
                                tint = Color(0xFFEF4444),
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                }
            },
            bottomBar = {
                // Bottom Bar shows quick access for top 3 tabs
                NavigationBar(containerColor = Color.White, tonalElevation = 8.dp) {
                    val bottomTabs = listOf(NavigationScreen.Dashboard, NavigationScreen.Chat, NavigationScreen.Calendar)
                    bottomTabs.forEach { screen ->
                        val isSelected = activeScreen == screen
                        NavigationBarItem(
                            selected = isSelected,
                            onClick = { activeScreen = screen },
                            icon = {
                                Icon(
                                    screen.icon,
                                    contentDescription = screen.label,
                                    tint = if (isSelected) Color(0xFF2563EB) else Color(0xFF64748B)
                                )
                            },
                            label = {
                                Text(
                                    screen.label.replace("Upcoming ", ""),
                                    fontSize = 10.sp,
                                    color = if (isSelected) Color(0xFF2563EB) else Color(0xFF64748B),
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                )
                            },
                            colors = NavigationBarItemDefaults.colors(
                                indicatorColor = Color(0xFF2563EB).copy(alpha = 0.1f)
                            )
                        )
                    }
                }
            }
        ) { paddingValues ->
            Box(modifier = Modifier.padding(paddingValues)) {
                when (activeScreen) {
                    NavigationScreen.Dashboard -> DashboardScreen(repo = repo)
                    NavigationScreen.Chat -> ChatScreen(repo = repo)
                    NavigationScreen.Loans -> LoansScreen(repo = repo)
                    NavigationScreen.Cards -> CardsScreen(repo = repo)
                    NavigationScreen.Calendar -> CalendarScreen(repo = repo)
                    NavigationScreen.Ledger -> LedgerScreen(repo = repo)
                }
            }
        }
    }

    // Logout Confirmation Dialog
    if (showLogoutConfirm) {
        AlertDialog(
            onDismissRequest = { showLogoutConfirm = false },
            title = { Text("Exit Command Center?", fontWeight = FontWeight.Bold) },
            text = { Text("Are you sure you want to log out of your session on DebtOS AI?") },
            confirmButton = {
                Button(
                    onClick = {
                        showLogoutConfirm = false
                        onLogout()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                ) { Text("Log Out", color = Color.White) }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutConfirm = false }) {
                    Text("Cancel", color = Color(0xFF64748B))
                }
            },
            containerColor = Color.White,
            shape = RoundedCornerShape(16.dp)
        )
    }
}
