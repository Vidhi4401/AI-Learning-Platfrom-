const API = "http://127.0.0.1:8000/api/v1";

document.addEventListener("DOMContentLoaded", () => {
    loadAnalytics();
});

async function loadAnalytics() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API}/admin/analytics`, {
            headers: { Authorization: "Bearer " + token }
        });
        const data = await res.json();

        // 1. Top Stats
        document.getElementById("statStudents").textContent = data.total_students;
        document.getElementById("statCourses").textContent  = data.total_courses;
        document.getElementById("statAvgScore").textContent = data.platform_avg_score + "%";
        document.getElementById("statCompletion").textContent = data.completion_rate + "%";

        // 2. Engagement
        document.getElementById("vBar").style.width = data.engagement.video_rate + "%";
        document.getElementById("vTxt").textContent = data.engagement.video_rate + "%";
        document.getElementById("qBar").style.width = data.engagement.quiz_rate + "%";
        document.getElementById("qTxt").textContent = data.engagement.quiz_rate + "%";
        document.getElementById("aBar").style.width = data.engagement.assign_rate + "%";
        document.getElementById("aTxt").textContent = data.engagement.assign_rate + "%";

        // 3. Charts
        renderGrowthChart(data.monthly_growth);
        renderPerfChart(data.course_performance);

        // 4. Weak Topics
        renderWeakTopics(data.weak_topics);

    } catch (err) { console.error(err); }
}

function renderGrowthChart(growthData) {
    const ctx = document.getElementById("growthChart").getContext("2d");
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: growthData.map(d => d.month),
            datasets: [{
                label: 'New Registrations',
                data: growthData.map(d => d.count),
                borderColor: '#7c3aed',
                backgroundColor: 'rgba(124, 58, 237, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

function renderPerfChart(perfData) {
    const ctx = document.getElementById("perfChart").getContext("2d");
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: perfData.map(d => d.title),
            datasets: [{
                label: 'Avg Score %',
                data: perfData.map(d => d.avg_score),
                backgroundColor: perfData.map(d => d.avg_score >= 70 ? '#10b981' : (d.avg_score >= 50 ? '#f59e0b' : '#ef4444'))
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

function renderWeakTopics(topics) {
    const body = document.getElementById("weakTopicsBody");
    body.innerHTML = topics.map(t => `
        <tr>
            <td style="font-weight:600;">${t.topic_name}</td>
            <td>${t.course_title}</td>
            <td>${t.teacher_name}</td>
            <td><span style="color:#ef4444; font-weight:700;">${t.avg_score}%</span></td>
            <td>${t.affected_students} Students</td>
        </tr>
    `).join("") || '<tr><td colspan="5" style="text-align:center; padding:3rem;">No weak areas identified currently.</td></tr>';
}
