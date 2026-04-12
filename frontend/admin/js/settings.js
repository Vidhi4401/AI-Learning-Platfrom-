const API = "http://127.0.0.1:8000/api/v1";

document.addEventListener("DOMContentLoaded", () => {
    loadBranding();
    loadProfile();
    
    // Logo Preview Logic
    document.getElementById('logoFile').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById('logoPreview').innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
            }
            reader.readAsDataURL(file);
        }
    });

    // Signature Preview Logic
    document.getElementById('sigFile').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById('sigPreview').innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:contain;">`;
            }
            reader.readAsDataURL(file);
        }
    });
});

/* ── Eye toggle ── */
function togglePwd(btn) {
  const input = btn.closest('.pwd-wrap').querySelector('input');
  const show  = input.type === 'password';
  input.type  = show ? 'text' : 'password';
  btn.innerHTML = show
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
}

async function loadBranding() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API}/admin/organization`, {
            headers: { Authorization: "Bearer " + token }
        });
        const data = await res.json();
        
        document.getElementById("orgName").value = data.org_name;
        
        if (data.logo) {
            document.getElementById("logoPreview").innerHTML = `<img src="${data.logo}" style="width:100%;height:100%;object-fit:cover;">`;
        }
        if (data.signature) {
            document.getElementById("sigPreview").innerHTML = `<img src="${data.signature}" style="width:100%;height:100%;object-fit:contain;">`;
        }
    } catch (err) {}
}

async function saveBranding() {
    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("org_name", document.getElementById("orgName").value);
    
    const logoFile = document.getElementById("logoFile").files[0];
    if (logoFile) formData.append("logo", logoFile);

    const sigFile = document.getElementById("sigFile").files[0];
    if (sigFile) formData.append("signature", sigFile);

    try {
        const res = await fetch(`${API}/admin/organization`, {
            method: "PUT",
            headers: { Authorization: "Bearer " + token },
            body: formData
        });

        if (res.ok) {
            const data = await res.json();
            alert("Platform settings updated!");
            
            // Sync with storage
            const user = JSON.parse(localStorage.getItem("user"));
            user.platform_name = data.org_name;
            if (data.logo) user.org_logo = data.logo;
            localStorage.setItem("user", JSON.stringify(user));
            
            location.reload(); 
        }
    } catch (err) { alert("Failed to save branding"); }
}

async function loadProfile() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API}/admin/profile`, {
            headers: { Authorization: "Bearer " + token }
        });
        const data = await res.json();
        document.getElementById("adminName").value = data.name;
        document.getElementById("adminEmail").value = data.email;
    } catch (err) {}
}

async function saveProfile() {
    const name = document.getElementById("adminName").value.trim();
    const email = document.getElementById("adminEmail").value.trim();
    
    // Validation
    if (!window.utils.validateName(name)) {
        alert("Please enter a valid name (at least 2 characters, alphabets only).");
        return;
    }
    if (!window.utils.validateEmail(email)) {
        alert("Please enter a valid email address.");
        return;
    }

    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);
    
    const curr = document.getElementById("currPass").value;
    const next = document.getElementById("newPass").value;
    
    if (curr && next) {
        if (!window.utils.validatePassword(next)) {
            alert("New password must be at least 8 characters long.");
            return;
        }
        formData.append("current_password", curr);
        formData.append("new_password", next);
    }

    const res = await fetch(`${API}/admin/profile`, {
        method: "PUT",
        headers: { Authorization: "Bearer " + token },
        body: formData
    });

    if (res.ok) {
        alert("Profile updated successfully");
        location.reload();
    } else {
        const err = await res.json();
        alert(err.detail || "Update failed");
    }
}

/* ═══════════════════════════════════════
   USER MANAGEMENT
═══════════════════════════════════════ */
const API_AUTH = "http://127.0.0.1:8000/api/v1/auth";
const API_ADMIN = "http://127.0.0.1:8000/api/v1/admin";

// Populate the reset-password user dropdown on page load
async function loadUsersForReset() {
  const sel = document.getElementById("resetUserSelect");
  if (!sel) return;
  try {
    const token = localStorage.getItem("token");
    // Fetch students and teachers
    const [studRes, teachRes] = await Promise.all([
      fetch(`${API_ADMIN}/students`, { headers: { Authorization: "Bearer " + token } }),
      fetch(`${API_ADMIN}/teachers`, { headers: { Authorization: "Bearer " + token } })
    ]);
    const students = await studRes.json();
    const teachers = await teachRes.json();

    sel.innerHTML = '<option value="">— Select a user —</option>';
    if (students.length) {
      const grpS = document.createElement("optgroup");
      grpS.label = "Students";
      students.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.id;
        opt.textContent = `${u.name} (${u.email})`;
        grpS.appendChild(opt);
      });
      sel.appendChild(grpS);
    }
    if (teachers.length) {
      const grpT = document.createElement("optgroup");
      grpT.label = "Teachers";
      teachers.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.id;
        opt.textContent = `${u.name} (${u.email})`;
        grpT.appendChild(opt);
      });
      sel.appendChild(grpT);
    }
  } catch(e) { console.error("Load users error", e); }
}

async function addUser() {
  const name  = document.getElementById("newUserName").value.trim();
  const email = document.getElementById("newUserEmail").value.trim();
  const pwd   = document.getElementById("newUserPass").value;
  const role  = document.getElementById("newUserRole").value;
  const succ  = document.getElementById("addUserSuccess");
  const err   = document.getElementById("addUserError");
  succ.style.display = err.style.display = "none";

  if (!window.utils.validateName(name)) { err.textContent = "Please enter a valid name (at least 2 characters)."; err.style.display = "block"; return; }
  if (!window.utils.validateEmail(email)) { err.textContent = "Please enter a valid email address."; err.style.display = "block"; return; }
  if (!window.utils.validatePassword(pwd)) { err.textContent = "Password must be at least 4 characters long."; err.style.display = "block"; return; }

  const token    = localStorage.getItem("token");
  const endpoint = role === "teacher" ? "add-teacher" : "add-student";
  try {
    const res  = await fetch(`${API_AUTH}/admin/${endpoint}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body:    JSON.stringify({ name, email, password: pwd })
    });
    const data = await res.json();
    if (!res.ok) { err.textContent = data.detail || "Failed to create user."; err.style.display = "block"; return; }

    succ.textContent = `✅ ${role === "teacher" ? "Teacher" : "Student"} account created for ${name}.`;
    succ.style.display = "block";
    document.getElementById("newUserName").value  = "";
    document.getElementById("newUserEmail").value = "";
    document.getElementById("newUserPass").value  = "";
    loadUsersForReset(); // refresh dropdown
  } catch(e) {
    err.textContent = "Server error. Please try again.";
    err.style.display = "block";
  }
}

async function resetUserPassword() {
  const userId = document.getElementById("resetUserSelect").value;
  const newPwd = document.getElementById("resetNewPwd").value;
  const succ   = document.getElementById("resetPwdSuccess");
  const err    = document.getElementById("resetPwdError");
  succ.style.display = err.style.display = "none";

  if (!userId)         { err.textContent = "Please select a user."; err.style.display = "block"; return; }
  if (!newPwd)         { err.textContent = "Please enter a new password."; err.style.display = "block"; return; }
  if (!window.utils.validatePassword(newPwd)) { err.textContent = "Password must be at least 4 characters long."; err.style.display = "block"; return; }

  const token = localStorage.getItem("token");
  try {
    const res  = await fetch(`${API_AUTH}/admin/reset-user-password/${userId}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body:    JSON.stringify({ new_password: newPwd })
    });
    const data = await res.json();
    if (!res.ok) { err.textContent = data.detail || "Reset failed."; err.style.display = "block"; return; }

    succ.textContent = `✅ ${data.message}`;
    succ.style.display = "block";
    document.getElementById("resetNewPwd").value = "";
    document.getElementById("resetUserSelect").value = "";
  } catch(e) {
    err.textContent = "Server error. Please try again.";
    err.style.display = "block";
  }
}

// Load users when settings page opens
document.addEventListener("DOMContentLoaded", loadUsersForReset);