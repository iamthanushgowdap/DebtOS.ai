package com.example.debtosmobile.ui.main

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.ui.graphics.Brush
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
            .background(Color(0xFF0F172A))
    ) {
        // Chat header
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(Brush.horizontalGradient(listOf(Color(0xFF1E293B), Color(0xFF0F172A))))
                .padding(16.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.SmartToy,
                    contentDescription = null,
                    tint = Color(0xFFF59E0B),
                    modifier = Modifier.size(28.dp)
                )
                Spacer(Modifier.width(8.dp))
                Column {
                    Text("DebtOS Advisor", color = Color(0xFFF8FAFC), fontWeight = FontWeight.Black, fontSize = 18.sp)
                    Text("Powered by Gemini AI", color = Color(0xFF94A3B8), fontSize = 11.sp)
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
                                    .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 18.dp, bottomEnd = 18.dp, bottomStart = 18.dp))
                                    .background(Color(0xFF1E293B).copy(alpha = 0.6f))
                                    .padding(14.dp)
                            ) {
                                CircularProgressIndicator(color = Color(0xFF8B5CF6), modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                            }
                        }
                    }
                }
            }
        }

        // Input bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF1E293B))
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                modifier = Modifier.weight(1f),
                placeholder = { Text("Ask your advisor…", color = Color(0xFF64748B), fontSize = 13.sp) },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Color(0xFFF59E0B),
                    unfocusedBorderColor = Color.White.copy(0.1f),
                    focusedTextColor = Color(0xFFF8FAFC),
                    unfocusedTextColor = Color(0xFFF8FAFC),
                    focusedContainerColor = Color(0xFF0F172A).copy(0.5f),
                    unfocusedContainerColor = Color(0xFF0F172A).copy(0.5f)
                ),
                shape = RoundedCornerShape(20.dp),
                maxLines = 3
            )
            IconButton(
                onClick = { sendMessage() },
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color(0xFF8B5CF6))
            ) {
                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send", tint = Color.White)
            }
        }
    }
}

@Composable
private fun ChatBubble(msg: ChatMessage) {
    val arrangement = if (msg.isUser) Arrangement.End else Arrangement.Start
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = arrangement) {
        val bubbleColor = if (msg.isUser) Color(0xFF8B5CF6) else Color(0xFF1E293B).copy(alpha = 0.5f)
        val border = if (msg.isUser) null else BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))

        Surface(
            shape = RoundedCornerShape(
                topStart = if (msg.isUser) 18.dp else 4.dp,
                topEnd = if (msg.isUser) 4.dp else 18.dp,
                bottomEnd = 18.dp, bottomStart = 18.dp
            ),
            color = bubbleColor,
            border = border,
            modifier = Modifier.widthIn(max = 280.dp)
        ) {
            Box(Modifier.padding(12.dp)) {
                Text(msg.text, color = Color(0xFFF8FAFC), fontSize = 13.sp, lineHeight = 19.sp)
            }
        }
    }
}
