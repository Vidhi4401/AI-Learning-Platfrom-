async function loadDoubts(filter = 'pending') {
    const doubtsList = document.getElementById('doubts-list');
    doubtsList.innerHTML = '<div style="text-align:center; padding:3rem; color:#64748b;">Loading doubts...</div>';

    const user = JSON.parse(localStorage.getItem("user"));

    try {
        // Fetch doubts from backend filtered by this teacher
        const response = await fetch(`http://127.0.0.1:8000/api/v1/chat/faculty/doubts?faculty_id=${user.id}&filter=${filter}`);
        const doubts = await response.json();

        if (doubts.length === 0) {
            doubtsList.innerHTML = '<div style="text-align:center; padding:3rem; color:#64748b;">No student doubts found.</div>';
            return;
        }

        doubtsList.innerHTML = '';
        doubts.forEach(doubt => {
            const card = document.createElement('div');
            card.className = 'doubt-card';
            
            const isAnswered = !!doubt.response;
            const statusLabel = isAnswered ? 'Answered' : 'Pending Reply';
            const statusClass = isAnswered ? 'status-answered' : 'status-pending';
            
            // Source indicator
            const sourceLabel = doubt.mode === 'AI' ? 'AI Query' : 'Faculty Query';
            const sourceColor = doubt.mode === 'AI' ? '#8b5cf6' : '#3b82f6';

            card.innerHTML = `
                <div class="doubt-header">
                    <div>
                        <span class="student-name">${doubt.student_name || `Student #${doubt.student_id}`}</span>
                        <span class="status-badge" style="background:${sourceColor}15; color:${sourceColor}; margin-left:10px; border:1px solid ${sourceColor}30;">${sourceLabel}</span>
                        <span class="status-badge ${statusClass}" style="margin-left:10px;">${statusLabel}</span>
                    </div>
                    <span class="doubt-date">${new Date(doubt.created_at).toLocaleString()}</span>
                </div>
                <div class="doubt-query">Q: ${doubt.query}</div>
                ${isAnswered ? `
                    <div style="background:#f8fafc; padding:1rem; border-radius:8px; border-left:3px solid #10b981;">
                        <div style="font-weight:bold; font-size:0.9rem; margin-bottom:5px;">
                            ${doubt.mode === 'AI' ? 'AI Assistant Answer:' : 'Faculty Answer:'}
                        </div>
                        ${doubt.response}
                    </div>
                ` : `
                    <textarea id="reply-${doubt.id}" class="reply-box" placeholder="Write your answer here..." rows="3"></textarea>
                    <button class="btn-reply" onclick="submitReply(${doubt.id})">Send Reply</button>
                `}
            `;
            doubtsList.appendChild(card);
        });

    } catch (err) {
        doubtsList.innerHTML = '<div style="text-align:center; padding:3rem; color:#ef4444;">Error loading doubts from server.</div>';
    }
}

async function submitReply(doubtId) {
    const replyText = document.getElementById(`reply-${doubtId}`).value.trim();
    if (!replyText) {
        alert("Please enter a reply");
        return;
    }

    try {
        const response = await fetch(`http://127.0.0.1:8000/api/v1/chat/faculty/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                doubt_id: doubtId,
                response: replyText,
                faculty_id: user.id
            })
        });

        if (response.ok) {
            alert("Reply sent successfully!");
            loadDoubts(); // Refresh list
            checkFacultyNotifications(); // Refresh layout badge
        } else {
            alert("Failed to send reply");
        }
    } catch (err) {
        alert("Server error connecting to backend");
    }
}

// Initial load
window.onload = () => loadDoubts();
