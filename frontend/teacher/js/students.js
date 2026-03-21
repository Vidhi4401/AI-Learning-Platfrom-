const API = "http://127.0.0.1:8000/api/v1";
let allStudents = [];

document.addEventListener("DOMContentLoaded", () => {
    loadStudents();
    
    document.getElementById("studentSearch").addEventListener("input", renderStudents);
    document.getElementById("levelFilter").addEventListener("change", renderStudents);
    document.getElementById("riskFilter").addEventListener("change", renderStudents);
});

async function loadStudents() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API}/teacher/students`, {
            headers: { Authorization: "Bearer " + token }
        });
        allStudents = await res.json();
        renderStudents();
    } catch (err) {
        console.error("Failed to load students", err);
    }
}

function renderStudents() {
    const searchTerm = document.getElementById("studentSearch").value.toLowerCase();
    const lvlFilt    = document.getElementById("levelFilter").value;
    const riskFilt   = document.getElementById("riskFilter").value;
    const body       = document.getElementById("studentsTableBody");

    const filtered = allStudents.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm) || s.email.toLowerCase().includes(searchTerm);
        const matchesLvl    = lvlFilt === "all" || s.learner_level === lvlFilt;
        const matchesRisk   = riskFilt === "all" || s.dropout_risk === riskFilt;
        return matchesSearch && matchesLvl && matchesRisk;
    });

    body.innerHTML = filtered.map(s => `
        <tr>
            <td>
                <div style="display:flex; align-items:center; gap:12px;">
                    <div class="s-avatar">${s.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <div style="font-weight:600; color:var(--ink);">${s.name}</div>
                        <div style="font-size:12px; color:var(--muted);">${s.email}</div>
                    </div>
                </div>
            </td>
            <td style="font-weight:500;">${s.course_count} Courses</td>
            <td><span style="font-weight:700; color:${s.overall_score >= 70 ? '#16a34a' : '#d97706'}">${s.overall_score}%</span></td>
            <td><span class="badge badge-${s.learner_level.toLowerCase()}">${s.learner_level}</span></td>
            <td><span class="risk-badge risk-${s.dropout_risk.toLowerCase()}">${s.dropout_risk} Risk</span></td>
            <td>
                <button class="btn btn-ghost" onclick="location.href='student-detail.html?id=${s.id}'" title="View Detailed Analytics">👁</button>
            </td>
        </tr>
    `).join("") || '<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--muted);">No students matching your filters.</td></tr>';
}

function exportToExcel() {
    const token = localStorage.getItem("token");
    window.location.href = `${API}/teacher/students/export?token=${token}`; 
    // Note: If using Bearer in URL is not allowed, we'd use a form submit or a blob fetch.
    // For simplicity, let's assume the endpoint can accept token as query if needed, 
    // or just trigger the standard export endpoint.
    window.open(`${API}/teacher/students/export`, '_blank');
}
