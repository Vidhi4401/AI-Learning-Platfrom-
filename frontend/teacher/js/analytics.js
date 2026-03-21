const API = "http://127.0.0.1:8000/api/v1";

document.addEventListener("DOMContentLoaded", () => {
    loadAnalytics();
});

async function loadAnalytics() {
    const token = localStorage.getItem("token");

    try {
        const res = await fetch(`${API}/teacher/analytics`, {
            headers: { Authorization: "Bearer " + token }
        });
        const data = await res.json();

        // Update Top Stats
        document.getElementById("totalStudentsValue").textContent = data.total_students;
        document.getElementById("totalCoursesValue").textContent = data.total_courses;
        
        renderCourseChart(data.course_distribution);
        renderLevelChart(data.level_distribution);

    } catch (err) {
        console.error("Analytics load error", err);
    }
}

function renderCourseChart(courseData) {
    const ctx = document.createElement('canvas');
    document.getElementById('mostPopularChart').innerHTML = '';
    document.getElementById('mostPopularChart').appendChild(ctx);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: courseData.map(c => c.title),
            datasets: [{
                label: 'Enrolled Students',
                data: courseData.map(c => c.students),
                backgroundColor: '#3b82f6',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderLevelChart(levelData) {
    const ctx = document.createElement('canvas');
    document.getElementById('completionRateChart').innerHTML = '';
    document.getElementById('completionRateChart').appendChild(ctx);

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Strong', 'Average', 'Weak'],
            datasets: [{
                data: [levelData.Strong, levelData.Average, levelData.Weak],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}
