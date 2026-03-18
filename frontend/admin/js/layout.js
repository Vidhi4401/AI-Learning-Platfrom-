const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user"));

if (!token || !user || user.role !== "admin") {
  window.location.href = "../auth.html";
}

const currentPage = window.location.pathname.split("/").pop();
const platformName = user.platform_name || "LearnHub";
const orgLogo = user.org_logo ? `http://127.0.0.1:8000/${user.org_logo}` : null;

function isActive(page) {
  return currentPage === page ? "active" : "";
}

/* ===== SIDEBAR ===== */
document.getElementById("sidebar").innerHTML = `
  <div class="sidebar-brand">
    <div class="sidebar-brand-icon">
      ${orgLogo 
        ? `<img src="${orgLogo}" style="width:100%;height:100%;object-fit:cover;border-radius:7px;" onerror="this.parentElement.textContent='🏢'">` 
        : "🏢"}
    </div>
    <div class="sidebar-brand-text">
      <h2>${platformName}</h2>
      <p>Admin Portal</p>
    </div>
  </div>

  <div class="sidebar-nav">
    <a href="dashboard.html" class="${isActive("dashboard.html")}">
      <span class="nav-icon">🏠</span>
      <span>Dashboard</span>
    </a>
    <a href="teachers.html" class="${isActive("teachers.html") || isActive("teacher-detail.html")}">
      <span class="nav-icon">👨‍🏫</span>
      <span>Teachers</span>
    </a>
    <a href="courses.html" class="${isActive("courses.html")}">
      <span class="nav-icon">📚</span>
      <span>Courses</span>
    </a>
    <a href="students.html" class="${isActive("students.html") || isActive("student-detail.html")}">
      <span class="nav-icon">👨‍🎓</span>
      <span>Students</span>
    </a>
    <a href="analytics.html" class="${isActive("analytics.html")}">
      <span class="nav-icon">📊</span>
      <span>Analytics</span>
    </a>
    <a href="certificates.html" class="${isActive("certificates.html")}">
      <span class="nav-icon">🏆</span>
      <span>Certificates</span>
    </a>
    <a href="settings.html" class="${isActive("settings.html")}">
      <span class="nav-icon">⚙️</span>
      <span>Settings</span>
    </a>
  </div>

  <div class="sidebar-footer">
    <button id="logoutBtn">
      <span>Logout</span>
    </button>
  </div>
`;

/* ===== NAVBAR ===== */
document.getElementById("navbar").innerHTML = `
  <div class="navbar-left">
    <input class="search" type="text" placeholder="Search data…">
  </div>

  <div class="navbar-right">
    <div class="profile">
      <div class="profile-info">
        <div class="profile-name">${user.name || "Admin"}</div>
        <div class="profile-email">Administrator</div>
      </div>
      <div class="avatar">${user.name?.charAt(0).toUpperCase() || "A"}</div>
    </div>
  </div>
`;

/* ===== LOGOUT ===== */
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "../auth.html";
});
