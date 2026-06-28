package com.example.debtosmobile.ui.main

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.debtosmobile.data.DataRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class ChatMessage(val text: String, val isUser: Boolean)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(repo: DataRepository) {
    val scope = rememberCoroutineScope()
    var messages by remember { mutableStateOf(listOf(
        ChatMessage("Hi! I'm your DebtOS financial advisor powered by Gemini. Ask me anything about your finances, debts, or repayment strategy!", isUser = false)
    )) }
    var input by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var isRefreshing by remember { mutableStateOf(false) }
    val listState = rememberLazyListState()
    val pullState = rememberPullToRefreshState()

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.lastIndex)
    }

    fun sendMessage() {
        val query = input.trim()
        if (query.isBlank() || isLoading) return
        input = ""
        messages = messages + ChatMessage(query, isUser = true)
        isLoading = true
        scope.launch {
            val response = withContext(Dispatchers.IO) { repo.api.askAdvisor(repo.token, query) }
            messages = messages + ChatMessage(
                response.error?.let { "Error: $it" } ?: response.answer.ifBlank { "No response" },
                isUser = false
            )
            isLoading = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF8FAFC))
    ) {
        // Chat header
        Surface(
            color = Color.White,
            tonalElevation = 2.dp,
            shadowElevation = 1.dp
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .background(Color(0xFFEFF6FF), shape = RoundedCornerShape(20.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Default.SmartToy,
                        contentDescription = null,
                        tint = Color(0xFF2563EB),
                        modifier = Modifier.size(22.dp)
                    )
                }
                Spacer(Modifier.width(12.dp))
                Column {
                    Text("DebtOS Advisor", color = Color(0xFF09090B), fontWeight = FontWeight.Black, fontSize = 16.sp)
                    Text("Powered by Gemini AI", color = Color(0xFF475569), fontSize = 11.sp, fontWeight = FontWeight.Medium)
                }
            }
        }

        // Messages list with pull-to-refresh to clear history
        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = {
                isRefreshing = true
                messages = listOf(ChatMessage("Chat history cleared. How can I help?", isUser = false))
                isRefreshing = false
            },
            state = pullState,
            modifier = Modifier.weight(1f)
        ) {
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(messages) { msg ->
                    ChatBubble(msg)
                }
                if (isLoading) {
                    item {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Start) {
                            Box(
                                Modifier
                                    .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 16.dp, bottomEnd = 16.dp, bottomStart = 16.dp))
                                    .background(Color.White)
                                    .border(BorderStroke(1.dp, Color(0xFFE2E8F0)), RoundedCornerShape(topStart = 4.dp, topEnd = 16.dp, bottomEnd = 16.dp, bottomStart = 16.dp))
                                    .padding(14.dp)
                            ) {
                                CircularProgressIndicator(color = Color(0xFF2563EB), modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                            }
                        }
                    }
                }
            }
        }

        // Input bar
        Surface(
            color = Color.White,
            tonalElevation = 8.dp,
            border = BorderStroke(1.dp, Color(0xFFE2E8F0))
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(
                    value = input,
                    onValueChange = { input = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Ask your advisor…", color = Color(0xFF475569), fontSize = 13.sp) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color(0xFF2563EB),
                        unfocusedBorderColor = Color(0xFFE2E8F0),
                        focusedTextColor = Color(0xFF09090B),
                        unfocusedTextColor = Color(0xFF09090B),
                        focusedContainerColor = Color(0xFFF8FAFC),
                        unfocusedContainerColor = Color(0xFFF8FAFC)
                    ),
                    shape = RoundedCornerShape(20.dp),
                    maxLines = 3
                )
                IconButton(
                    onClick = { sendMessage() },
                    modifier = Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0xFF2563EB))
                ) {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send", tint = Color.White)
                }
            }
        }
    }
}

@Composable
private fun ChatBubble(msg: ChatMessage) {
    val arrangement = if (msg.isUser) Arrangement.End else Arrangement.Start
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = arrangement) {
        val bubbleColor = if (msg.isUser) Color(0xFF2563EB) else Color.White
        val border = if (msg.isUser) null else BorderStroke(1.dp, Color(0xFFE2E8F0))
        val textColor = if (msg.isUser) Color.White else Color(0xFF09090B)

        Surface(
            shape = RoundedCornerShape(
                topStart = if (msg.isUser) 16.dp else 4.dp,
                topEnd = if (msg.isUser) 4.dp else 16.dp,
                bottomEnd = 16.dp, bottomStart = 16.dp
            ),
            color = bubbleColor,
            border = border,
            shadowElevation = 1.dp,
            modifier = Modifier.widthIn(max = 280.dp)
        ) {
            Box(Modifier.padding(12.dp)) {
                Text(msg.text, color = textColor, fontSize = 13.sp, lineHeight = 19.sp)
            }
        }
    }
}
