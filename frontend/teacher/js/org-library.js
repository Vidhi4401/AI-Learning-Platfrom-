const API = "http://127.0.0.1:8000/api/v1";

document.addEventListener("DOMContentLoaded", () => {
    loadOrgLibrary();
});

async function loadOrgLibrary() {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user"));
    const grid = document.getElementById("libraryGrid");

    try {
        const res = await fetch(`${API}/teacher/courses/organization`, {
            headers: { Authorization: "Bearer " + token }
        });
        const courses = await res.json();

        grid.innerHTML = courses.map(c => {
            const isOwner = c.created_by === user.id;
            return `
                <div class="course-card">
                    <div class="course-img">
                        ${c.logo ? `<img src="${getFileUrl(c.logo)}" alt="${c.title}">` : '<div style="height:100%; display:flex; align-items:center; justify-content:center; color:#9ca3af;">No Thumbnail</div>'}
                    </div>
                    <div class="course-content">
                        <h3 class="course-title">${c.title}</h3>
                        <p class="course-author">👨‍🏫 Teacher: ${c.teacher_name || 'Unassigned'}</p>
                        ${isOwner ? '<span class="badge-assigned">Your Course</span>' : ''}
                    </div>
                    <div style="padding: 16px 20px; border-top: 1px solid var(--border);">
                        ${isOwner 
                            ? `<button class="btn btn-primary" onclick="location.href='course-detail.html?id=${c.id}'" style="width:100%;">Manage Content</button>`
                            : `<button class="btn btn-ghost" disabled style="width:100%; cursor:not-allowed;">Read Only View</button>`
                        }
                    </div>
                </div>
            `;
        }).join("") || '<div style="text-align:center; padding:5rem; color:var(--muted);">No courses found in organization.</div>';

    } catch (err) {
        console.error("Library load failed", err);
    }
}
