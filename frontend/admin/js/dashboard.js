const API = "http://127.0.0.1:8000/api/v1";

document.addEventListener("DOMContentLoaded", () => {
    loadDashboardData();
});

async function loadDashboardData() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API}/admin/dashboard`, {
            headers: { Authorization: "Bearer " + token }
        });
        const data = await res.json();

        // 1. Stat Cards
        document.getElementById("totalTeachers").textContent = data.total_teachers;
        document.getElementById("totalStudents").textContent = data.total_students;
        document.getElementById("totalCourses").textContent  = data.total_courses;
        document.getElementById("avgScore").textContent      = data.platform_avg_score + "%";
        document.getElementById("totalCerts").textContent    = data.certificates_issued;
        document.getElementById("activeWeek").textContent     = data.active_this_week;

        // 2. Charts
        renderCharts(data.course_distribution, data.level_distribution);

        // 3. Teacher Table
        renderTeacherTable(data.teacher_performance);

    } catch (err) {
        console.error("Dashboard data load failed", err);
    }
}

function renderCharts(courseData, levelData) {
    // Course Distribution
    const ctx1 = document.getElementById('courseDistChart').getContext('2d');
    new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: courseData.map(c => c.title),
            datasets: [{
                label: 'Students',
                data: courseData.map(c => c.students),
                backgroundColor: '#7c3aed',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#f3f4f6' } },
                x: { grid: { display: false } }
            }
        }
    });

    // Level Distribution
    const ctx2 = document.getElementById('levelDistChart').getContext('2d');
    new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: ['Strong', 'Average', 'Weak'],
            datasets: [{
                data: [levelData.Strong, levelData.Average, levelData.Weak],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            cutout: '70%'
        }
    });
}

function renderTeacherTable(teachers) {
    const body = document.getElementById("teacherPerfBody");
    body.innerHTML = teachers.map(t => `
        <tr>
            <td style="font-weight:600;">${t.name}</td>
            <td>${t.course_count}</td>
            <td>${t.student_count}</td>
            <td><span style="font-weight:700; color:${t.avg_score >= 70 ? '#16a34a' : '#d97706'}">${t.avg_score}%</span></td>
            <td><span class="badge ${t.is_active ? 'badge-active' : 'badge-inactive'}">${t.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>
                <button class="btn btn-ghost" onclick="location.href='teacher-detail.html?id=${t.id}'" title="View Detail">👁</button>
            </td>
        </tr>
    `).join("") || '<tr><td colspan="6" style="text-align:center;">No teachers found.</td></tr>';
}
