const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user"));

if (!token || !user) {
  window.location.href = "../auth.html";
}

const currentPage = window.location.pathname.split("/").pop();

function isActive(page) {
  return currentPage === page ? "active" : "";
}

/* ===== READ BRANDING FROM LOCALSTORAGE & BACKEND ===== */
let platformName = user.platform_name || "LearnHub";

function getFileUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `http://127.0.0.1:8000/${path}`;
}

let orgLogo = getFileUrl(user.org_logo);

async function fetchBranding() {
    try {
        const res = await fetch(`http://127.0.0.1:8000/api/v1/organization/branding`, {
            headers: { Authorization: "Bearer " + token }
        });
        const data = await res.json();
        if (res.ok) {
            // Update UI
            const nameEl = document.getElementById("sidebarPlatformName");
            const logoEl = document.querySelector(".sidebar-brand-icon");
            
            if (nameEl) nameEl.textContent = data.platform_name;
            if (logoEl && data.logo) {
                logoEl.innerHTML = `<img src="${data.logo}" alt="Logo" style="width:100%;height:100%;object-fit:cover;border-radius:7px;">`;
            }
            
            // Sync LocalStorage for next reload
            user.platform_name = data.platform_name;
            user.org_logo = data.logo;
            localStorage.setItem("user", JSON.stringify(user));
        }
    } catch (err) {}
}
fetchBranding();

/* ===== VALIDATION UTILITIES ===== */
window.utils = {
  validateEmail: (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },
  validateName: (name) => {
    return /[a-zA-Z]/.test(name) && name.trim().length >= 2;
  },
  validatePassword: (password) => {
    return password.length >= 8;
  },
  showError: (msg) => {
    alert(msg);
  }
};

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

    <a href="courses.html" class="${isActive("courses.html") || isActive("course-detail.html")}">
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

    <a href="certificates.html" class="${isActive("certificates.html")}">
      <span>Certificates</span>
    </a>
  </div>
`;

/* ===== NAVBAR ===== */
document.getElementById("navbar").innerHTML = `
  <div class="navbar-left">
    <button id="sidebarToggle" class="nav-toggle-btn" title="Toggle Sidebar">☰</button>
    <div style="position:relative;">
        <input class="search" type="text" id="globalSearchInput" placeholder="Search courses, students…">
    </div>
  </div>

  <div class="navbar-right">
    <div class="profile" id="profileDropdownTrigger">
      <div class="profile-info">
        <div class="profile-name"  id="navProfileName">${user.name  || "Faculty"}</div>
        <div class="profile-email" id="navProfileEmail">${user.email || ""}</div>
      </div>
      <div class="avatar" id="navAvatar">${user.name?.charAt(0).toUpperCase() || "F"}</div>

      <div class="profile-dropdown">
        <a href="settings.html"><span>⚙️</span> Settings</a>
        <button id="logoutBtn"><span>Logout</span></button>
      </div>
    </div>
  </div>
`;

/* ===== GLOBAL SEARCH LOGIC ===== */
document.getElementById("globalSearchInput").addEventListener("input", (e) => {
  const localSearch = document.getElementById("courseSearch") || 
                      document.getElementById("studentSearch") || 
                      document.getElementById("teacherSearch");

  if (localSearch) {
    localSearch.value = e.target.value;
    localSearch.dispatchEvent(new Event('input'));
  }
  
  // Direct function calls as fallback
  if (typeof renderCourses === "function") renderCourses();
  if (typeof renderStudents === "function") renderStudents();
  if (typeof renderTeachers === "function") renderTeachers();
  if (typeof filterStudents === "function") filterStudents();
});

/* ===== TOGGLE SIDEBAR ===== */
document.getElementById("sidebarToggle").addEventListener("click", () => {
  document.body.classList.toggle("sidebar-collapsed");
});

/* ===== PROFILE DROPDOWN ===== */
const profileTrigger = document.getElementById("profileDropdownTrigger");
profileTrigger.addEventListener("click", (e) => {
  e.stopPropagation();
  profileTrigger.classList.toggle("active");
});

document.addEventListener("click", () => {
  profileTrigger.classList.remove("active");
});

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

/* ===== NOTIFICATIONS LOGIC ===== */
function toggleNotif(e) {
    e.stopPropagation();
    document.getElementById("notifDropdown").classList.toggle("active");
    if (document.getElementById("notifDropdown").classList.contains("active")) {
        fetchNotifications();
    }
}

async function fetchNotifications() {
    try {
        const res = await fetch(`http://127.0.0.1:8000/api/v1/notifications/`, {
            headers: { Authorization: "Bearer " + token }
        });
        const notifications = await res.json();
        renderNotifications(notifications);
    } catch (err) {}
}

async function checkUnreadCount() {
    try {
        const res = await fetch(`http://127.0.0.1:8000/api/v1/notifications/unread-count`, {
            headers: { Authorization: "Bearer " + token }
        });
        const data = await res.json();
        const badge = document.getElementById("notifCount");
        if (data.count > 0) {
            badge.textContent = data.count;
            badge.style.display = "flex";
        } else {
            badge.style.display = "none";
        }
    } catch (err) {}
}

function renderNotifications(list) {
    const container = document.getElementById("notifList");
    if (!list || list.length === 0) {
        container.innerHTML = '<div class="notif-empty">No new notifications</div>';
        return;
    }

    container.innerHTML = list.map(n => `
        <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="markNotificationRead(${n.id}, '${n.link}')">
            <div class="notif-item-title">${n.title}</div>
            <div class="notif-item-msg">${n.message}</div>
            <div class="notif-item-time">${new Date(n.created_at).toLocaleString()}</div>
        </div>
    `).join("");
}

async function markNotificationRead(id, link) {
    try {
        await fetch(`http://127.0.0.1:8000/api/v1/notifications/${id}/read`, {
            method: "POST",
            headers: { Authorization: "Bearer " + token }
        });
        if (link && link !== 'null') window.location.href = link;
        else fetchNotifications();
        checkUnreadCount();
    } catch (err) {}
}

async function markAllNotificationsRead(e) {
    e.stopPropagation();
    try {
        await fetch(`http://127.0.0.1:8000/api/v1/notifications/read-all`, {
            method: "POST",
            headers: { Authorization: "Bearer " + token }
        });
        fetchNotifications();
        checkUnreadCount();
    } catch (err) {}
}

checkUnreadCount();
setInterval(checkUnreadCount, 30000);

document.addEventListener("click", () => {
    const drop = document.getElementById("notifDropdown");
    if(drop) drop.classList.remove("active");
});

/* ===== LOGOUT ===== */
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "../auth.html";
});