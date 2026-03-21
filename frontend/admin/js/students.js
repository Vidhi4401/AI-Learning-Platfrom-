const API = "http://127.0.0.1:8000/api/v1";
let allStudents = [];

document.addEventListener("DOMContentLoaded", () => {
    loadAllStudents();
    loadCourseFilter();
    
    document.getElementById("studentSearch").addEventListener("input", renderStudents);
    document.getElementById("courseFilter").addEventListener("change", renderStudents);
    document.getElementById("levelFilter").addEventListener("change", renderStudents);
    document.getElementById("riskFilter").addEventListener("change", renderStudents);
});

async function loadAllStudents() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API}/admin/students`, {
            headers: { Authorization: "Bearer " + token }
        });
        allStudents = await res.json();
        renderStudents();
    } catch (err) {
        console.error("Students load failed", err);
    }
}

async function loadCourseFilter() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API}/admin/courses`, {
            headers: { Authorization: "Bearer " + token }
        });
        const courses = await res.json();
        const select = document.getElementById("courseFilter");
        courses.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.title; 
            opt.textContent = c.title;
            select.appendChild(opt);
        });
    } catch (err) {}
}

function renderStudents() {
    const searchTerm = document.getElementById("studentSearch").value.toLowerCase();
    const courseFilt = document.getElementById("courseFilter").value;
    const levelFilt  = document.getElementById("levelFilter").value;
    const riskFilt   = document.getElementById("riskFilter").value;
    const body       = document.getElementById("studentsTableBody");

    const filtered = allStudents.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm) || s.email.toLowerCase().includes(searchTerm);
        const matchesCourse = courseFilt === "all" || s.main_course === courseFilt;
        const matchesLevel  = levelFilt === "all" || s.learner_level === levelFilt;
        const matchesRisk   = riskFilt === "all" || s.dropout_risk === riskFilt;
        return matchesSearch && matchesCourse && matchesLevel && matchesRisk;
    });

    body.innerHTML = filtered.map(s => `
        <tr>
            <td>
                <div style="display:flex; align-items:center; gap:12px;">
                    <div class="avatar" style="width:34px; height:34px; font-size:12px; background:#f3f4f6; color:#374151; border-radius:10px;">${s.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <div style="font-weight:600; color:var(--ink);">${s.name}</div>
                        <div style="font-size:12px; color:var(--muted);">${s.email}</div>
                    </div>
                </div>
            </td>
            <td style="font-size:13px; font-weight:500;">${s.main_course}</td>
            <td><span style="font-weight:700; color:${s.overall_score >= 70 ? '#16a34a' : '#d97706'}">${s.overall_score}%</span></td>
            <td><span class="badge badge-${s.learner_level.toLowerCase()}">${s.learner_level}</span></td>
            <td><span class="risk-badge risk-${s.dropout_risk.toLowerCase()}">${s.dropout_risk} Risk</span></td>
            <td>
                <button class="btn btn-ghost" onclick="location.href='student-detail.html?id=${s.id}'" title="View Global Performance">👁</button>
            </td>
        </tr>
    `).join("") || '<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--muted);">No students matching criteria.</td></tr>';
}

function exportToExcel() {
    window.open(`${API}/admin/students/export`, '_blank');
}
