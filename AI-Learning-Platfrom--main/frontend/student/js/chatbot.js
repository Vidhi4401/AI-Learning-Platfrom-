let currentChatMode = 'AI';
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chatbot-messages');
const chatWindow = document.getElementById('chatbot-window');
const chatBadge = document.getElementById('chat-badge');

function toggleChat() {
    chatWindow.classList.toggle('hidden');
    if (!chatWindow.classList.contains('hidden')) {
        markAsRead();
        loadChatHistory();
    }
}

function setChatMode(mode) {
    currentChatMode = mode;
    document.getElementById('mode-ai').classList.toggle('active', mode === 'AI');
    document.getElementById('mode-faculty').classList.toggle('active', mode === 'FACULTY');
    
    // Clear input or show specialized greeting if needed
    chatInput.placeholder = mode === 'AI' ? "Ask AI for instant help..." : "Ask Faculty (may take time)...";
}

async function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    // Add student message to UI immediately
    appendMessage('student', text);
    chatInput.value = '';

    const userData = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`http://127.0.0.1:8000/api/v1/chat/ask?student_id=${user.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                query: text,
                mode: currentChatMode,
                topic_id: null // Can be extended to pass current topic
            })
        });

        const data = await response.json();
        
        if (data.response) {
            appendMessage(data.mode.toLowerCase(), data.response);
        } else if (data.mode === 'FACULTY') {
            appendMessage('faculty', "Your question has been sent to the faculty. You will be notified when they reply.");
        }

    } catch (error) {
        console.error("Chat error:", error);
        appendMessage('ai', "Sorry, I'm having trouble connecting right now.");
    }
}

function appendMessage(sender, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;
    msgDiv.textContent = text;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function loadChatHistory() {
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/v1/chat/history?student_id=${user.id}`);
        const history = await response.json();
        
        chatMessages.innerHTML = `<div class="message ai">Hi ${user.name}! How can I help you today?</div>`;
        
        history.forEach(chat => {
            appendMessage('student', chat.query);
            if (chat.response) {
                appendMessage(chat.mode.toLowerCase(), chat.response);
            }
        });
    } catch (err) {
        console.error("History load error");
    }
}

async function checkNotifications() {
    try {
        const res = await fetch(`http://127.0.0.1:8000/api/v1/chat/unread-count?user_id=${user.id}&role=student`);
        const data = await res.json();
        
        if (data.count > 0) {
            chatBadge.textContent = data.count;
            chatBadge.style.display = 'block';
        } else {
            chatBadge.style.display = 'none';
        }
    } catch (err) {
        // Silently fail polling
    }
}

async function markAsRead() {
    try {
        await fetch(`http://127.0.0.1:8000/api/v1/chat/mark-read?user_id=${user.id}&role=student`, { method: 'POST' });
        chatBadge.style.display = 'none';
    } catch (err) {}
}

// Check for new messages every 30 seconds
setInterval(checkNotifications, 30000);
checkNotifications();
