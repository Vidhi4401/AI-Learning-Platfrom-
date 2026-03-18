const API = "http://127.0.0.1:8000/api/v1";

document.addEventListener("DOMContentLoaded", () => {
    loadStudents();
});

async function loadStudents() {
    const token = localStorage.getItem("token");
    const tbody = document.querySelector(".students-table tbody");
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:3rem;">Loading students...</td></tr>';

    try {
        const res = await fetch(`${API}/teacher/students`, {
            headers: { Authorization: "Bearer " + token }
        });
        const students = await res.json();

        if (students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:3rem;">No students found.</td></tr>';
            return;
        }

        tbody.innerHTML = "";
        students.forEach((s, i) => {
            const tr = document.createElement("tr");
            tr.style.animationDelay = `${i * 0.05}s`;

            // Color for score
            let scoreClass = "score-o";
            if (s.overall_score >= 80) scoreClass = "score-g";
            else if (s.overall_score < 50) scoreClass = "score-r";

            // Level class
            let lvlClass = "lvl-average";
            if (s.learner_level === "Strong") lvlClass = "lvl-strong";
            else if (s.learner_level === "Weak") lvlClass = "lvl-weak";

            const initials = s.name.split(" ").map(n => n[0]).join("").toUpperCase();
            const colors = ["#6366f1", "#0891b2", "#059669", "#7c3aed", "#d97706", "#be185d"];
            const bg = colors[s.id % colors.length];

            tr.innerHTML = `
                <td>
                    <div class="name-cell">
                        <div class="s-avatar" style="background:${bg}">${initials}</div>
                        <span class="s-name">${s.name}</span>
                    </div>
                </td>
                <td class="s-email">${s.email}</td>
                <td style="font-weight:600;color:#374151;">${s.course_count}</td>
                <td><span class="${scoreClass}">${s.overall_score}%</span></td>
                <td><span class="lvl ${lvlClass}">${s.learner_level}</span></td>
                <td><span class="cert cert-ip">Checking...</span></td>
                <td>
                    <button class="btn-view" onclick="viewStudent(${s.id})">👁 View</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:3rem; color:red;">Error loading students.</td></tr>';
    }
}

function viewStudent(id) {
    window.location.href = `../student/student-performnace.html?student_id=${id}`;
}
