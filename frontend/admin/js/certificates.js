const API = "http://127.0.0.1:8000/api/v1/admin";

document.addEventListener("DOMContentLoaded", () => {
    loadIssuedHistory();
});

async function loadIssuedHistory() {
    const body = document.getElementById("issuedTableBody");
    try {
        const res = await fetch(`${API}/certificates/issued`, {
            headers: { Authorization: "Bearer " + token }
        });
        const data = await res.json();

        body.innerHTML = data.map(c => `
            <tr>
                <td>
                    <div style="font-weight:600;">${c.student_name}</div>
                </td>
                <td>${c.course_title}</td>
                <td>
                    <span style="color:var(--accent); font-weight:500;">${c.teacher_name}</span>
                </td>
                <td>${new Date(c.issued_at).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-ghost" onclick="downloadCert(${c.id})" title="Download/View">📥 View</button>
                </td>
            </tr>
        `).join("") || '<tr><td colspan="5" style="text-align:center; padding:2rem;">No certificates issued yet.</td></tr>';
    } catch (err) {
        body.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Failed to load history.</td></tr>';
    }
}

function downloadCert(id) {
    const url = `${API}/certificates/${id}/download?token=${token}`;
    window.open(url, "_blank");
}
