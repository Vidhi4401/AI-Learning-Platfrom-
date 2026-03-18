let currentChatMode = 'AI';
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chatbot-messages');
const chatWindow = document.getElementById('chatbot-window');
const chatBadge = document.getElementById('chat-badge');

// Local cache for AI session
let aiMessages = [{ sender: 'ai', text: `Hi ${user.name}! How can I help you today?` }];
let facultyMessages = []; 

function toggleChat() {
    chatWindow.classList.toggle('hidden');
    if (!chatWindow.classList.contains('hidden')) {
        markAsRead();
        if (currentChatMode === 'FACULTY') {
            loadFacultyHistory();
        } else {
            renderChat('AI');
        }
    }
}

function setChatMode(mode) {
    if (currentChatMode === mode) return;
    currentChatMode = mode;
    
    document.getElementById('mode-ai').classList.toggle('active', mode === 'AI');
    document.getElementById('mode-faculty').classList.toggle('active', mode === 'FACULTY');
    
    // Show/Hide teacher selector
    const teacherSelectContainer = document.getElementById('teacher-select-container');
    if (mode === 'FACULTY') {
        loadTeachersForSelection();
        if (teacherSelectContainer) teacherSelectContainer.style.display = 'block';
    } else {
        if (teacherSelectContainer) teacherSelectContainer.style.display = 'none';
    }

    chatInput.placeholder = mode === 'AI' ? "Ask AI for instant help..." : "Ask Faculty (may take time)...";
    
    if (mode === 'AI') {
        renderChat('AI');
    } else {
        loadFacultyHistory();
    }
}

async function loadTeachersForSelection() {
    const select = document.getElementById('chat-teacher-select');
    if (!select || select.options.length > 1) return;

    try {
        const res = await fetch(`http://127.0.0.1:8000/api/v1/chat/teachers`, {
            headers: { Authorization: "Bearer " + localStorage.getItem("token") }
        });
        const teachers = await res.json();
        
        select.innerHTML = '<option value="">— Select Teacher —</option>';
        teachers.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            select.appendChild(opt);
        });
    } catch (err) {}
}

function renderChat(mode) {
    chatMessages.innerHTML = '';
    const messages = mode === 'AI' ? aiMessages : facultyMessages;
    
    if (mode === 'FACULTY' && messages.length === 0) {
        chatMessages.innerHTML = `<div class="message ai">No faculty chat history yet. Select a teacher and ask a doubt!</div>`;
        return;
    }

    messages.forEach(msg => {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${msg.sender}`;
        msgDiv.textContent = msg.text;
        chatMessages.appendChild(msgDiv);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    let selectedFacultyId = null;
    if (currentChatMode === 'FACULTY') {
        const select = document.getElementById('chat-teacher-select');
        selectedFacultyId = select.value;
        if (!selectedFacultyId) {
            alert("Please select a teacher first!");
            return;
        }
    }

    // Try to get course context from URL
    const urlParams = new URLSearchParams(window.location.search);
    const contextCourseId = urlParams.get('id') || urlParams.get('course');

    // Add to UI state
    if (currentChatMode === 'AI') {
        aiMessages.push({ sender: 'student', text: text });
        renderChat('AI');
    } else {
        appendMessage('student', text);
    }
    
    chatInput.value = '';

    const token = localStorage.getItem('token');

    try {
        if (currentChatMode === 'AI') {
            const response = await fetch(`http://127.0.0.1:8000/api/v1/chat/ai-ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: text, mode: 'AI' })
            });
            const data = await response.json();
            aiMessages.push({ sender: 'ai', text: data.response });
            renderChat('AI');
        } else {
            await fetch(`http://127.0.0.1:8000/api/v1/chat/ask?student_id=${user.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    query: text,
                    mode: 'FACULTY',
                    topic_id: null,
                    course_id: contextCourseId ? parseInt(contextCourseId) : null,
                    faculty_id: parseInt(selectedFacultyId)
                })
            });
            loadFacultyHistory();
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

async function loadFacultyHistory() {
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/v1/chat/history?student_id=${user.id}`);
        const history = await response.json();
        
        facultyMessages = [];
        history.filter(h => h.mode === 'FACULTY').forEach(chat => {
            facultyMessages.push({ sender: 'student', text: chat.query });
            if (chat.response) {
                facultyMessages.push({ sender: 'faculty', text: chat.response });
            }
        });
        
        if (currentChatMode === 'FACULTY') {
            renderChat('FACULTY');
        }
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
    } catch (err) {}
}

async function markAsRead() {
    try {
        await fetch(`http://127.0.0.1:8000/api/v1/chat/mark-read?user_id=${user.id}&role=student`, { method: 'POST' });
        chatBadge.style.display = 'none';
    } catch (err) {}
}

setInterval(checkNotifications, 30000);
checkNotifications();
