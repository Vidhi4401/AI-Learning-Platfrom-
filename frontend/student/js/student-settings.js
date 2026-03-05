const API = "http://127.0.0.1:8000/api/v1";

document.addEventListener("DOMContentLoaded", init);

/* =========================
   INIT
=========================*/
async function init() {
  loadNotifPrefs();
  loadThemePref();
  await loadProfile();

  // Close modals on overlay click
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", e => {
      if (e.target === overlay) overlay.classList.remove("open");
    });
  });
}

/* =========================
   LOAD PROFILE — real API
=========================*/
async function loadProfile() {
  try {
    const res = await fetch(`${API}/student/profile`, {
      headers: { Authorization: "Bearer " + token }
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    renderProfile(data);
  } catch {
    // fallback to localStorage user
    renderProfile(user);
  }
}

function renderProfile(data) {
  const name  = data.name  || "Student";
  const email = data.email || "—";
  const init  = name.charAt(0).toUpperCase();

  document.getElementById("profileAvatar").textContent = init;
  document.getElementById("profileName").textContent   = name;
  document.getElementById("profileEmail").textContent  = email;

  // Pre-fill edit form
  document.getElementById("editName").value  = name;
  document.getElementById("editEmail").value = email;
}

/* =========================
   EDIT PROFILE
=========================*/
document.getElementById("editProfileBtn").addEventListener("click", () => {
  openModal("editModal");
});

async function saveProfile() {
  const name  = document.getElementById("editName").value.trim();
  const email = document.getElementById("editEmail").value.trim();
  const msg   = document.getElementById("editMsg");

  if (!name || !email) {
    showMsg(msg, "error", "Name and email are required.");
    return;
  }

  const btn = document.querySelector("#editModal .btn-primary");
  btn.disabled    = true;
  btn.textContent = "Saving…";

  try {
    const formData = new FormData();
    formData.append("name",  name);
    formData.append("email", email);

    const res = await fetch(`${API}/student/profile`, {
      method:  "PUT",
      headers: { Authorization: "Bearer " + token },
      body:    formData
    });

    if (!res.ok) throw new Error((await res.json()).detail || "Failed");

    // Update UI + localStorage
    document.getElementById("profileName").textContent  = name;
    document.getElementById("profileEmail").textContent = email;
    document.getElementById("profileAvatar").textContent = name.charAt(0).toUpperCase();
    document.getElementById("navProfileName").textContent = name;

    // Update stored user
    const stored = JSON.parse(localStorage.getItem("user") || "{}");
    stored.name  = name;
    stored.email = email;
    localStorage.setItem("user", JSON.stringify(stored));

    showMsg(msg, "success", "Profile updated successfully!");
    setTimeout(() => closeModal("editModal"), 1200);

  } catch (err) {
    showMsg(msg, "error", err.message || "Update failed.");
  } finally {
    btn.disabled    = false;
    btn.textContent = "Save Changes";
  }
}

/* =========================
   CHANGE PASSWORD
=========================*/
async function changePassword() {
  const current  = document.getElementById("currentPwd").value.trim();
  const newPwd   = document.getElementById("newPwd").value.trim();
  const confirm  = document.getElementById("confirmPwd").value.trim();
  const msg      = document.getElementById("pwdMsg");

  if (!current || !newPwd || !confirm) {
    showMsg(msg, "error", "All fields are required."); return;
  }
  if (newPwd !== confirm) {
    showMsg(msg, "error", "New passwords do not match."); return;
  }
  if (newPwd.length < 6) {
    showMsg(msg, "error", "Password must be at least 6 characters."); return;
  }

  const btn = document.querySelector("#passwordForm .btn-primary");
  btn.disabled    = true;
  btn.textContent = "Updating…";

  try {
    const formData = new FormData();
    formData.append("current_password", current);
    formData.append("password",         newPwd);

    const res = await fetch(`${API}/student/profile`, {
      method:  "PUT",
      headers: { Authorization: "Bearer " + token },
      body:    formData
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Update failed");
    }

    showMsg(msg, "success", "Password changed successfully!");
    document.getElementById("currentPwd").value = "";
    document.getElementById("newPwd").value      = "";
    document.getElementById("confirmPwd").value  = "";

  } catch (err) {
    showMsg(msg, "error", err.message || "Failed to change password.");
  } finally {
    btn.disabled    = false;
    btn.textContent = "Update Password";
  }
}

/* =========================
   THEME
=========================*/
function setTheme(theme) {
  document.getElementById("themeLight").classList.toggle("active", theme === "light");
  document.getElementById("themeDark").classList.toggle("active",  theme === "dark");
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}

function loadThemePref() {
  const saved = localStorage.getItem("theme") || "light";
  setTheme(saved);
}

/* =========================
   NOTIFICATIONS — localStorage only
=========================*/
function saveNotifPref() {
  const prefs = {
    email:  document.getElementById("notifEmail").checked,
    assign: document.getElementById("notifAssign").checked,
    quiz:   document.getElementById("notifQuiz").checked
  };
  localStorage.setItem("notifPrefs", JSON.stringify(prefs));
}

function loadNotifPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem("notifPrefs") || "{}");
    if (saved.email  !== undefined) document.getElementById("notifEmail").checked  = saved.email;
    if (saved.assign !== undefined) document.getElementById("notifAssign").checked = saved.assign;
    if (saved.quiz   !== undefined) document.getElementById("notifQuiz").checked   = saved.quiz;
  } catch (_) {}
}

/* =========================
   DOWNLOAD DATA
=========================*/
async function downloadMyData() {
  const btn = document.querySelector(".account-btns .btn-outline");
  btn.disabled    = true;
  btn.textContent = "⏳ Preparing…";

  try {
    // Fetch all student data
    const [profile, enrollments, attempts, submissions] = await Promise.all([
      fetch(`${API}/student/profile`,                { headers: { Authorization: "Bearer " + token } }).then(r => r.ok ? r.json() : {}),
      fetch(`${API}/student/enrollments`,            { headers: { Authorization: "Bearer " + token } }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/student/quiz-attempts`,          { headers: { Authorization: "Bearer " + token } }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/student/assignment-submissions`, { headers: { Authorization: "Bearer " + token } }).then(r => r.ok ? r.json() : [])
    ]);

    const exportData = {
      exported_at:  new Date().toISOString(),
      profile,
      enrollments,
      quiz_attempts:          attempts,
      assignment_submissions: submissions
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `my-data-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (err) {
    alert("Failed to download data. Try again.");
  } finally {
    btn.disabled    = false;
    btn.textContent = "⬇️ Download My Data";
  }
}

/* =========================
   DELETE ACCOUNT
=========================*/
function openDeleteModal() { openModal("deleteModal"); }

async function confirmDelete() {
  const btn = document.querySelector("#deleteModal .btn-danger");
  btn.disabled    = true;
  btn.textContent = "Deleting…";

  try {
    const res = await fetch(`${API}/student/account`, {
      method:  "DELETE",
      headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) throw new Error((await res.json()).detail || "Delete failed");

    localStorage.clear();
    alert("Account deleted. Redirecting to login…");
    window.location.href = "../auth.html";

  } catch (err) {
    btn.disabled    = false;
    btn.textContent = "Yes, Delete";
    alert(err.message || "Failed to delete account.");
  }
}

/* =========================
   HELPERS
=========================*/
function openModal(id)  { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }

function showMsg(el, type, text) {
  el.className   = `pwd-msg ${type}`;
  el.textContent = text;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 4000);
}