const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user"));

if (!token || !user) {
  window.location.href = "../auth.html";
}

const currentPage = window.location.pathname.split("/").pop();

function isActive(page) {
  return currentPage === page ? "active" : "";
}

/* ===== READ BRANDING FROM LOCALSTORAGE ===== */
const platformName = user.platform_name || "LearnHub";

function getFileUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `http://127.0.0.1:8000/${path}`;
}

const orgLogo = getFileUrl(user.org_logo);

/* ===== SIDEBAR ===== */
document.getElementById("sidebar").innerHTML = `
  <div class="sidebar-brand">
    <div class="sidebar-brand-icon">
      ${orgLogo
        ? `<img src="${orgLogo}" alt="${platformName}"
               style="width:100%;height:100%;object-fit:cover;border-radius:7px;"
               onerror="this.parentElement.textContent='🎓'">`
        : "🎓"}
    </div>
    <div class="sidebar-brand-text">
      <h2 id="sidebarPlatformName">${platformName}</h2>
      <p>Faculty Portal</p>
    </div>
  </div>

  <div class="sidebar-nav">
    <a href="dashboard.html" class="${isActive("dashboard.html")}">
      <span>Dashboard</span>
    </a>

    <a href="courses.html" class="${isActive("courses.html")}">
      <span>My Courses</span>
    </a>

    <a href="materials.html" class="${isActive("materials.html")}">
      <span>Course Materials</span>
    </a>

    <a href="organization-courses.html" class="${isActive("organization-courses.html")}">
      <span>Organization Library</span>
    </a>

    <a href="add-course.html" class="${isActive("add-course.html")}">
      <span>Add Course</span>
    </a>

    <a href="students.html" class="${isActive("students.html") || isActive("student-detail.html")}">
      <span>My Students</span>
    </a>

    <a href="meetings.html" class="${isActive("meetings.html")}">
      <span>Live Meetings</span>
    </a>

    <a href="doubts.html" class="${isActive("doubts.html")}" style="display:flex; justify-content:space-between; align-items:center;">
      <span>Doubts</span>
      <span id="faculty-doubt-badge" style="background:#ef4444; color:white; border-radius:10px; padding:2px 8px; font-size:12px; font-weight:bold; display:none;">0</span>
    </a>

    <a href="settings.html" class="${isActive("settings.html")}">
      <span>Settings</span>
    </a>
  </div>

  <div class="sidebar-footer">
    <button id="logoutBtn"><span>Logout</span></button>
  </div>
`;

/* ===== NAVBAR ===== */
document.getElementById("navbar").innerHTML = `
  <div class="navbar-left">
    <input class="search" type="text" placeholder="Search courses, students…">
  </div>

  <div class="navbar-right">
    <div class="profile">
      <div class="profile-info">
        <div class="profile-name"  id="navProfileName">${user.name  || "Faculty"}</div>
        <div class="profile-email" id="navProfileEmail">${user.email || ""}</div>
      </div>
      <div class="avatar" id="navAvatar">${user.name?.charAt(0).toUpperCase() || "F"}</div>
    </div>
  </div>
`;

/* ===== NOTIFICATION POLLING ===== */
async function checkFacultyNotifications() {
    try {
        const res = await fetch(`http://127.0.0.1:8000/api/v1/chat/unread-count?user_id=${user.id}&role=faculty`);
        const data = await res.json();
        const badge = document.getElementById('faculty-doubt-badge');
        if (badge && data.count > 0) {
            badge.textContent = data.count;
            badge.style.display = 'inline-block';
        } else if (badge) {
            badge.style.display = 'none';
        }
    } catch (err) {}
}

setInterval(checkFacultyNotifications, 30000);
checkFacultyNotifications();

/* ===== LOGOUT ===== */
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "../auth.html";
});