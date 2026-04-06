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
        renderDoubtChart(data.doubt_stats);
        renderRiskChart(data.risk_distribution);

        // 4. Content Drop-offs
        renderDropoffs(data.top_dropoffs);

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

function renderDoubtChart(stats) {
    const ctx = document.getElementById("doubtChart").getContext("2d");
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['AI Resolved', 'Faculty Resolved'],
            datasets: [{
                data: [stats.ai_count, stats.faculty_count],
                backgroundColor: ['#8b5cf6', '#3b82f6'],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

function renderRiskChart(dist) {
    const ctx = document.getElementById("riskChart").getContext("2d");
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Low Risk', 'Medium Risk', 'High Risk'],
            datasets: [{
                data: [dist.Low, dist.Medium, dist.High],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

function renderDropoffs(topics) {
    const body = document.getElementById("dropoffBody");
    if (!topics || topics.length === 0) {
        body.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:3rem;">No significant drop-offs detected.</td></tr>';
        return;
    }

    body.innerHTML = topics.map(t => `
        <tr>
            <td style="font-weight:600;">${t.topic}</td>
            <td>${t.course}</td>
            <td>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="flex:1; height:6px; background:#f1f5f9; border-radius:3px; overflow:hidden;">
                        <div style="width:${t.completion}%; height:100%; background:${t.completion < 40 ? '#ef4444' : '#f59e0b'};"></div>
                    </div>
                    <span style="font-size:12px; font-weight:700;">${t.completion}%</span>
                </div>
            </td>
            <td><span style="background:${t.completion < 40 ? '#fee2e2' : '#fef3c7'}; color:${t.completion < 40 ? '#ef4444' : '#d97706'}; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:700;">${t.completion < 40 ? 'CRITICAL' : 'WARNING'}</span></td>
        </tr>
    `).join("");
}
