const API = "http://127.0.0.1:8000/api/v1";
const params = new URLSearchParams(window.location.search);
const teacherId = params.get("id");

document.addEventListener("DOMContentLoaded", () => {
    if (!teacherId) {
        window.location.href = "teachers.html";
        return;
    }
    loadTeacherDetail();
});

async function loadTeacherDetail() {
    const token = localStorage.getItem("token");
    const container = document.getElementById("teacherDetailContent");

    try {
        const res = await fetch(`${API}/admin/teachers/${teacherId}/detail`, {
            headers: { Authorization: "Bearer " + token }
        });
        const data = await res.json();

        if (!res.ok) throw new Error("Load failed");

        const initials = data.profile.name.charAt(0).toUpperCase();
        
        container.innerHTML = `
            <div class="profile-card">
                <div class="profile-left">
                    <div class="p-avatar" style="width:80px; height:80px; font-size:32px;">${initials}</div>
                    <div>
                        <h2 class="p-name">${data.profile.name}</h2>
                        <p class="p-meta">✉ ${data.profile.email}</p>
                        <p class="p-meta">📅 Joined: ${new Date(data.profile.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                <span class="badge ${data.profile.is_active ? 'badge-active' : 'badge-inactive'}" style="font-size:14px; padding:8px 16px;">
                    ${data.profile.is_active ? 'Active Account' : 'Inactive Account'}
                </span>
            </div>

            <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom:32px;">
                <div class="stat-card">
                    <div class="stat-label">Courses Created</div>
                    <div class="stat-value">${data.stats.course_count}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Total Students</div>
                    <div class="stat-value">${data.stats.student_count}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Avg Student Score</div>
                    <div class="stat-value">${data.stats.avg_score}%</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Doubts Answered</div>
                    <div class="stat-value">${data.stats.doubts_answered}</div>
                </div>
            </div>

            <div class="table-card">
                <div style="padding:20px 24px; border-bottom:1px solid var(--border);">
                    <h3 class="panel-title" style="margin:0;">Course Catalog</h3>
                </div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Course Title</th>
                            <th>Enrolled</th>
                            <th>Avg Score</th>
                            <th>Status</th>
                            <th>Created On</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.courses.map(c => `
                            <tr>
                                <td style="font-weight:600;">${c.title}</td>
                                <td>${c.enrolled}</td>
                                <td><span style="font-weight:700; color:${c.avg_score >= 70 ? '#16a34a' : '#d97706'}">${c.avg_score}%</span></td>
                                <td><span class="badge ${c.status ? 'badge-active' : 'badge-inactive'}">${c.status ? 'Published' : 'Draft'}</span></td>
                                <td>${new Date(c.created_at).toLocaleDateString()}</td>
                            </tr>
                        `).join("") || '<tr><td colspan="5" style="text-align:center; padding:2rem;">No courses created by this teacher.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;

    } catch (err) {
        container.innerHTML = `<div style="text-align:center; padding:5rem; color:#ef4444;">Failed to load teacher data. Error: ${err.message}</div>`;
    }
}
