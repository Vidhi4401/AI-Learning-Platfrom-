const API = "http://127.0.0.1:8000/api/v1/teacher";
let currentTab = 'pending';

document.addEventListener("DOMContentLoaded", () => {
    loadRequests();
});

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    loadRequests();
}

async function loadRequests() {
    const container = document.getElementById("requestsContainer");
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--muted);">Loading...</div>';

    const endpoint = currentTab === 'pending' ? '/certificates/requests' : '/certificates/issued';
    
    try {
        const res = await fetch(`${API}${endpoint}`, {
            headers: { Authorization: "Bearer " + token }
        });
        const data = await res.json();

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:60px; background:white; border-radius:12px; border:1px dashed var(--border);">
                    <div style="font-size:40px; margin-bottom:16px;">📄</div>
                    <p style="color:var(--muted); font-weight:500;">No ${currentTab} certificates found.</p>
                </div>`;
            return;
        }

        renderList(data, container);
    } catch (err) {
        container.innerHTML = '<p style="color:red; text-align:center;">Failed to load data.</p>';
    }
}

function renderList(data, container) {
    container.innerHTML = "";
    data.forEach(item => {
        const card = document.createElement("div");
        card.className = "cert-card fade-up";

        if (currentTab === 'pending') {
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <h3 style="font-size:18px; color:var(--ink); margin-bottom:4px;">${item.student_name}</h3>
                        <p style="font-size:13px; color:var(--muted);">${item.student_email}</p>
                        <div style="margin-top:12px; font-weight:600; color:var(--accent);">Course: ${item.course_title}</div>
                    </div>
                    <span class="status-badge status-pending">Pending Approval</span>
                </div>

                <div class="metrics-grid">
                    <div class="metric-item">
                        <div class="metric-value">${item.score}%</div>
                        <div class="metric-label">Overall Score</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${item.completion}%</div>
                        <div class="metric-label">Completion</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${new Date(item.request_date).toLocaleDateString()}</div>
                        <div class="metric-label">Requested On</div>
                    </div>
                </div>

                <div style="display:flex; gap:12px; margin-top:20px;">
                    <button class="btn btn-primary" onclick="actionCert(${item.id}, 'issue')">✅ Issue Certificate</button>
                    <button class="btn btn-ghost" style="color:#ef4444;" onclick="actionCert(${item.id}, 'reject')">❌ Reject</button>
                </div>
            `;
        } else {
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <h3 style="font-size:17px; color:var(--ink); margin-bottom:4px;">${item.student_name}</h3>
                        <p style="font-size:13px; color:var(--accent); font-weight:600;">${item.course_title}</p>
                    </div>
                    <div style="text-align:right;">
                        <span class="status-badge status-verified">Issued</span>
                        <p style="font-size:11px; color:var(--muted); margin-top:8px;">Date: ${new Date(item.issued_at).toLocaleDateString()}</p>
                    </div>
                </div>
            `;
        }
        container.appendChild(card);
    });
}

async function actionCert(id, action) {
    if (!confirm(`Are you sure you want to ${action} this certificate?`)) return;

    try {
        const res = await fetch(`${API}/certificates/${id}/${action}`, {
            method: "POST",
            headers: { Authorization: "Bearer " + token }
        });

        if (res.ok) {
            alert(`Certificate ${action === 'issue' ? 'issued' : 'rejected'} successfully!`);
            loadRequests();
        } else {
            const err = await res.json();
            alert(err.detail || "Operation failed");
        }
    } catch (err) {
        alert("Server error");
    }
}
