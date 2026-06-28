package com.example.debtosmobile

import androidx.compose.runtime.Composable
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.ui.NavDisplay
import com.example.debtosmobile.data.DataRepository
import com.example.debtosmobile.ui.login.LoginScreen
import com.example.debtosmobile.ui.main.MainScreen

@Composable
fun MainNavigation(repo: DataRepository) {
    val startDest = if (repo.isLoggedIn()) Main else Login
    val backStack = rememberNavBackStack(startDest)

    NavDisplay(
        backStack = backStack,
        onBack = { backStack.removeLastOrNull() },
        entryProvider = entryProvider {
            entry<Login> {
                LoginScreen(
                    repo = repo,
                    onLoginSuccess = {
                        backStack.removeLastOrNull()
                        backStack.add(Main)
                    }
                )
            }
            entry<Main> {
                MainScreen(
                    repo = repo,
                    onLogout = {
                        repo.clearSession()
                        backStack.removeLastOrNull()
                        backStack.add(Login)
                    }
                )
            }
        }
    )
}
