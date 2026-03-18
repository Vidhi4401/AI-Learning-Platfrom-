const API = "http://127.0.0.1:8000/api/v1";

document.addEventListener("DOMContentLoaded", () => {
    loadEligible();
    loadIssued();
});

async function loadEligible() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API}/admin/certificates/eligible`, {
            headers: { Authorization: "Bearer " + token }
        });
        const data = await res.json();
        const body = document.getElementById("eligibleTableBody");
        body.innerHTML = data.map(s => `
            <tr>
                <td style="font-weight:600;">${s.student_name}</td>
                <td>${s.course_title}</td>
                <td><span style="color:#16a34a; font-weight:700;">${s.avg_score}%</span></td>
                <td>
                    <button class="btn btn-primary" style="padding:6px 14px; font-size:12px;" onclick="issueCertificate(${s.student_id}, ${s.course_id}, '${s.student_name}')">Issue Cert</button>
                </td>
            </tr>
        `).join("") || '<tr><td colspan="4" style="text-align:center; padding:2rem;">No students currently eligible.</td></tr>';
    } catch (err) {}
}

async function loadIssued() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API}/admin/certificates/issued`, {
            headers: { Authorization: "Bearer " + token }
        });
        const data = await res.json();
        const body = document.getElementById("issuedTableBody");
        body.innerHTML = data.map(c => `
            <tr>
                <td style="font-weight:600;">${c.student_name}</td>
                <td style="font-size:13px;">${c.course_title}</td>
                <td><span class="badge ${c.is_valid ? 'badge-active' : 'badge-inactive'}">${c.is_valid ? 'Valid' : 'Revoked'}</span></td>
                <td>
                    ${c.is_valid ? `<button class="btn btn-danger" style="padding:6px 14px; font-size:12px;" onclick="revokeCertificate(${c.id})">Revoke</button>` : '—'}
                </td>
            </tr>
        `).join("") || '<tr><td colspan="4" style="text-align:center; padding:2rem;">No certificates issued yet.</td></tr>';
    } catch (err) {}
}

async function issueCertificate(studentId, courseId, name) {
    if (!confirm(`Issue completion certificate to ${name}?`)) return;

    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("student_id", studentId);
    formData.append("course_id", courseId);

    const res = await fetch(`${API}/admin/certificates`, {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        body: formData
    });

    if (res.ok) {
        alert("Certificate issued successfully!");
        loadEligible();
        loadIssued();
    }
}

async function revokeCertificate(certId) {
    if (!confirm("Are you sure you want to revoke this certificate? The student will no longer be able to verify it.")) return;

    const token = localStorage.getItem("token");
    const res = await fetch(`${API}/admin/certificates/${certId}/revoke`, {
        method: "PUT",
        headers: { Authorization: "Bearer " + token }
    });

    if (res.ok) {
        loadIssued();
    }
}
