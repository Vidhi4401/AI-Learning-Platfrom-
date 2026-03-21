const API = "http://127.0.0.1:8000/api/v1";
let allTeachers = [];
let selectedTeacherId = null;

document.addEventListener("DOMContentLoaded", () => {
    loadTeachers();
    
    // Search & Filter listeners
    document.getElementById("teacherSearch").addEventListener("input", renderTeachers);
    document.getElementById("statusFilter").addEventListener("change", renderTeachers);
});

async function loadTeachers() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API}/admin/teachers`, {
            headers: { Authorization: "Bearer " + token }
        });
        allTeachers = await res.json();
        renderTeachers();
    } catch (err) {
        console.error("Failed to load teachers", err);
    }
}

function renderTeachers() {
    const searchTerm = document.getElementById("teacherSearch").value.toLowerCase();
    const statusFilter = document.getElementById("statusFilter").value;
    const body = document.getElementById("teachersTableBody");

    const filtered = allTeachers.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(searchTerm) || t.email.toLowerCase().includes(searchTerm);
        const matchesStatus = statusFilter === "all" || 
                             (statusFilter === "active" && t.is_active) || 
                             (statusFilter === "inactive" && !t.is_active);
        return matchesSearch && matchesStatus;
    });

    body.innerHTML = filtered.map(t => `
        <tr>
            <td>
                <div style="display:flex; align-items:center; gap:12px;">
                    <div class="avatar" style="width:32px; height:32px; font-size:12px;">${t.name.charAt(0).toUpperCase()}</div>
                    <span style="font-weight:600;">${t.name}</span>
                </div>
            </td>
            <td>${t.email}</td>
            <td>${t.course_count}</td>
            <td>${t.student_count}</td>
            <td><span style="font-weight:700; color:${t.avg_score >= 70 ? '#16a34a' : '#d97706'}">${t.avg_score}%</span></td>
            <td>
                <label class="switch">
                    <input type="checkbox" ${t.is_active ? 'checked' : ''} onchange="toggleStatus(${t.id}, this.checked)">
                    <span class="slider round"></span>
                </label>
            </td>
            <td>
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-ghost" onclick="location.href='teacher-detail.html?id=${t.id}'" title="View Detail">👁</button>
                    <button class="btn btn-ghost" onclick="openResetModal(${t.id}, '${t.name}')" title="Reset Password">🔑</button>
                    <button class="btn btn-ghost" style="color:#ef4444;" onclick="deleteTeacher(${t.id}, '${t.name}')" title="Delete">🗑</button>
                </div>
            </td>
        </tr>
    `).join("") || '<tr><td colspan="7" style="text-align:center; padding:2rem;">No teachers matching your criteria.</td></tr>';
}

/* Modal Helpers */
function openInviteModal() { document.getElementById("inviteModal").classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }

async function submitInvite() {
    const name = document.getElementById("inviteName").value;
    const email = document.getElementById("inviteEmail").value;
    const password = document.getElementById("invitePass").value;

    if (!name || !email || !password) {
        alert("Please fill all fields");
        return;
    }

    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);
    formData.append("password", password);

    try {
        const res = await fetch(`${API}/admin/teachers/invite`, {
            method: "POST",
            headers: { Authorization: "Bearer " + token },
            body: formData
        });

        if (res.ok) {
            alert("Teacher invited successfully!");
            closeModal('inviteModal');
            loadTeachers();
        } else {
            const err = await res.json();
            alert(err.detail || "Failed to invite teacher");
        }
    } catch (err) { alert("Server error"); }
}

async function toggleStatus(id, isActive) {
    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("is_active", isActive);

    await fetch(`${API}/admin/teachers/${id}/status`, {
        method: "PUT",
        headers: { Authorization: "Bearer " + token },
        body: formData
    });
}

function openResetModal(id, name) {
    selectedTeacherId = id;
    document.getElementById("resetTeacherName").textContent = `For: ${name}`;
    document.getElementById("resetModal").classList.add("open");
}

async function submitReset() {
    const p1 = document.getElementById("newPass").value;
    const p2 = document.getElementById("confirmPass").value;

    if (p1 !== p2) { alert("Passwords do not match"); return; }

    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("new_password", p1);

    const res = await fetch(`${API}/admin/teachers/${selectedTeacherId}/reset-password`, {
        method: "PUT",
        headers: { Authorization: "Bearer " + token },
        body: formData
    });

    if (res.ok) {
        alert("Password updated successfully");
        closeModal("resetModal");
    }
}

async function deleteTeacher(id, name) {
    if (!confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) return;

    const token = localStorage.getItem("token");
    const res = await fetch(`${API}/admin/teachers/${id}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token }
    });

    if (res.ok) {
        loadTeachers();
    } else {
        const err = await res.json();
        alert(err.detail || "Cannot delete teacher");
    }
}
