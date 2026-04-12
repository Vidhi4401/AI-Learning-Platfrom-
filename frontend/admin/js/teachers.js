const API = "http://127.0.0.1:8000/api/v1";
let allTeachers = [];
let selectedTeacherId = null;

/* ── Eye toggle ── */
function togglePwd(btn) {
  const input = btn.closest('.pwd-wrap').querySelector('input');
  const show  = input.type === 'password';
  input.type  = show ? 'text' : 'password';
  btn.innerHTML = show
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
}

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
    const name = document.getElementById("inviteName").value.trim();
    const email = document.getElementById("inviteEmail").value.trim();
    const password = document.getElementById("invitePass").value;

    if (!window.utils.validateName(name)) {
        alert("Please enter a valid name (at least 2 characters, alphabets only).");
        return;
    }
    if (!window.utils.validateEmail(email)) {
        alert("Please enter a valid email address.");
        return;
    }
    if (!window.utils.validatePassword(password)) {
        alert("Password must be at least 4 characters long.");
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

async function handleBulkImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("file", file);

    try {
        const res = await fetch(`${API}/admin/bulk-import`, {
            method: "POST",
            headers: { Authorization: "Bearer " + token },
            body: formData
        });

        if (res.ok) {
            const data = await res.json();
            let msg = `Bulk Import Complete!\n- Created: ${data.created}\n- Errors: ${data.errors.length}`;
            if (data.errors.length > 0) {
                msg += `\n\nFirst few errors:\n` + data.errors.slice(0, 3).map(e => `${e.email}: ${e.error}`).join('\n');
            }
            alert(msg);
            loadTeachers();
        } else {
            const err = await res.json();
            alert(err.detail || "Failed to import users");
        }
    } catch (err) { alert("Server error: " + err.message); }
    
    // Reset file input
    event.target.value = "";
}
