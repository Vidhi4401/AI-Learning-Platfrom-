const API = "http://127.0.0.1:8000/api/v1";
let allStudents = [];

document.addEventListener("DOMContentLoaded", () => {
    loadAllStudents();
    loadCourseFilter();
    
    document.getElementById("studentSearch").addEventListener("input", renderStudents);
    document.getElementById("courseFilter").addEventListener("change", renderStudents);
    document.getElementById("levelFilter").addEventListener("change", renderStudents);
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
            opt.value = c.title; // Using title for simple string matching in this overview
            opt.textContent = c.title;
            select.appendChild(opt);
        });
    } catch (err) {}
}

function renderStudents() {
    const searchTerm = document.getElementById("studentSearch").value.toLowerCase();
    const courseFilt = document.getElementById("courseFilter").value;
    const levelFilt  = document.getElementById("levelFilter").value;
    const body = document.getElementById("studentsTableBody");

    const filtered = allStudents.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm) || s.email.toLowerCase().includes(searchTerm);
        const matchesCourse = courseFilt === "all" || s.main_course === courseFilt;
        const matchesLevel  = levelFilt === "all" || s.learner_level === levelFilt;
        return matchesSearch && matchesCourse && matchesLevel;
    });

    body.innerHTML = filtered.map(s => `
        <tr>
            <td>
                <div style="display:flex; align-items:center; gap:12px;">
                    <div class="avatar" style="width:32px; height:32px; font-size:12px; background:#f3f4f6; color:#374151;">${s.name.charAt(0).toUpperCase()}</div>
                    <span style="font-weight:600;">${s.name}</span>
                </div>
            </td>
            <td style="font-size:13px; color:var(--muted);">${s.email}</td>
            <td style="font-size:13px; font-weight:500;">${s.main_course}</td>
            <td>${s.course_count}</td>
            <td><span style="font-weight:700; color:${s.overall_score >= 70 ? '#16a34a' : '#d97706'}">${s.overall_score}%</span></td>
            <td><span class="badge badge-${s.learner_level.toLowerCase()}">${s.learner_level}</span></td>
            <td>
                <button class="btn btn-ghost" onclick="location.href='student-detail.html?id=${s.id}'" title="View Detail">👁</button>
            </td>
        </tr>
    `).join("") || '<tr><td colspan="7" style="text-align:center; padding:3rem;">No students found.</td></tr>';
}
