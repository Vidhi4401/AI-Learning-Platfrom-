const API = "http://127.0.0.1:8000/api/v1";

document.addEventListener("DOMContentLoaded", () => {
    loadRequests();
    loadIssued();
});

async function loadRequests() {
    const token = localStorage.getItem("token");
    const body = document.getElementById("eligibleTableBody");
    
    try {
        const res = await fetch(`${API}/admin/certificates/requests`, {
            headers: { Authorization: "Bearer " + token }
        });
        const requests = await res.json();

        body.innerHTML = requests.map(r => `
            <tr>
                <td>
                    <div style="font-weight:600; color:var(--ink);">${r.student_name}</div>
                    <div style="font-size:12px; color:var(--muted);">${r.student_email}</div>
                </td>
                <td style="font-weight:500;">${r.course_title}</td>
                <td><span style="color:#16a34a; font-weight:700;">${r.score}%</span></td>
                <td><span class="badge badge-pending">Pending Verification</span></td>
                <td>
                    <div style="display:flex; gap:8px;">
                        <button class="btn btn-primary" style="padding:6px 12px; font-size:12px;" onclick="issueCert(${r.id})">✅ Issue</button>
                        <button class="btn btn-ghost" style="padding:6px 12px; font-size:12px; color:#ef4444;" onclick="rejectCert(${r.id})">✕ Reject</button>
                    </div>
                </td>
            </tr>
        `).join("") || '<tr><td colspan="5" style="text-align:center; padding:3rem; color:var(--muted);">No pending certificate requests.</td></tr>';

    } catch (err) {
        console.error("Load requests failed", err);
    }
}

async function loadIssued() {
    const token = localStorage.getItem("token");
    const body = document.getElementById("issuedTableBody");
    
    try {
        const res = await fetch(`${API}/admin/certificates/issued`, {
            headers: { Authorization: "Bearer " + token }
        });
        const issued = await res.json();

        body.innerHTML = issued.map(c => `
            <tr>
                <td>${c.student_name}</td>
                <td>${c.course_title}</td>
                <td>${new Date(c.issued_at).toLocaleDateString()}</td>
                <td><span class="badge badge-active">Issued</span></td>
                <td><button class="btn btn-ghost" onclick="window.open('http://127.0.0.1:8000/api/v1/admin/certificates/${c.id}/download?token=${token}', '_blank')">👁 View</button></td>
            </tr>
        `).join("") || '<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--muted);">No certificates issued yet.</td></tr>';
    } catch (err) {}
}

async function issueCert(certId) {
    if (!confirm("Confirm certificate issuance?")) return;
    const token = localStorage.getItem("token");
    
    try {
        const res = await fetch(`${API}/admin/certificates/${certId}/issue`, {
            method: "POST",
            headers: { Authorization: "Bearer " + token }
        });
        if (res.ok) {
            alert("Certificate issued successfully!");
            location.reload();
        }
    } catch (err) { alert("Action failed"); }
}

async function rejectCert(certId) {
    if (!confirm("Are you sure you want to reject this request?")) return;
    const token = localStorage.getItem("token");
    
    try {
        const res = await fetch(`${API}/admin/certificates/${certId}/reject`, {
            method: "POST",
            headers: { Authorization: "Bearer " + token }
        });
        if (res.ok) {
            alert("Request rejected.");
            location.reload();
        }
    } catch (err) { alert("Action failed"); }
}
