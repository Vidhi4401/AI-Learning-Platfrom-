const API = "http://127.0.0.1:8000/api/v1";
let allCourses = [];

document.addEventListener("DOMContentLoaded", () => {
    loadAllCourses();
    loadTeacherFilter();
    
    document.getElementById("courseSearch").addEventListener("input", renderCourses);
    document.getElementById("teacherFilter").addEventListener("change", renderCourses);
});

async function loadAllCourses() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API}/admin/courses`, {
            headers: { Authorization: "Bearer " + token }
        });
        allCourses = await res.json();
        renderCourses();
    } catch (err) {
        console.error("Courses load failed", err);
    }
}

async function loadTeacherFilter() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API}/admin/teachers`, {
            headers: { Authorization: "Bearer " + token }
        });
        const teachers = await res.json();
        const select = document.getElementById("teacherFilter");
        teachers.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.id;
            opt.textContent = t.name;
            select.appendChild(opt);
        });
    } catch (err) {}
}

function renderCourses() {
    const searchTerm = document.getElementById("courseSearch").value.toLowerCase();
    const teacherId = document.getElementById("teacherFilter").value;
    const grid = document.getElementById("coursesGrid");

    const filtered = allCourses.filter(c => {
        const matchesSearch = c.title.toLowerCase().includes(searchTerm) || c.teacher_name.toLowerCase().includes(searchTerm);
        const matchesTeacher = teacherId === "all" || String(c.teacher_id) === String(teacherId);
        return matchesSearch && matchesTeacher;
    });

    grid.innerHTML = filtered.map(c => `
        <div class="course-card">
            <div class="course-img">
                ${c.logo ? `<img src="${getFileUrl(c.logo)}" alt="${c.title}">` : '<div style="height:100%; display:flex; align-items:center; justify-content:center; color:#9ca3af;">No Thumbnail</div>'}
                <span class="course-status-badge ${c.status ? 'badge-active' : 'badge-inactive'}">${c.status ? 'Live' : 'Draft'}</span>
                <span class="course-teacher-badge">👨‍🏫 ${c.teacher_name}</span>
            </div>
            <div class="course-content">
                <p class="course-difficulty">${c.difficulty || 'General'}</p>
                <h3 class="course-title">${c.title}</h3>
                <p class="course-desc">${c.description || 'No description provided.'}</p>
                <div class="course-stats">
                    <span>👥 ${c.enrolled_students} Students</span>
                </div>
            </div>
            <div class="course-footer">
                <button class="btn btn-ghost" onclick="toggleStatus(${c.id}, ${c.status})" title="Toggle Visibility">
                    ${c.status ? '📁 Hide' : '🚀 Publish'}
                </button>
                <button class="btn btn-ghost" style="color:#ef4444;" onclick="deleteCourse(${c.id}, '${c.title}')" title="Delete Course">🗑</button>
            </div>
        </div>
    `).join("") || '<div style="grid-column: 1/-1; text-align:center; padding:5rem; color:var(--muted);">No courses found matching your filters.</div>';
}

async function toggleStatus(id, currentStatus) {
    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("status", !currentStatus);

    const res = await fetch(`${API}/admin/courses/${id}/status`, {
        method: "PUT",
        headers: { Authorization: "Bearer " + token },
        body: formData
    });

    if (res.ok) loadAllCourses();
}

async function deleteCourse(id, title) {
    if (!confirm(`Permanently delete "${title}"? All related topics, quizzes, and videos will be removed. This cannot be undone.`)) return;

    const token = localStorage.getItem("token");
    const res = await fetch(`${API}/admin/courses/${id}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token }
    });

    if (res.ok) loadAllCourses();
}
