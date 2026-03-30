const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user"));

if (!token || !user || user.role !== "admin") {
  window.location.href = "../auth.html";
}

const currentPage = window.location.pathname.split("/").pop();
const platformName = user.platform_name || "LearnHub";

// Intelligent URL Helper
function getFileUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `http://127.0.0.1:8000/${path}`;
}

const orgLogo = getFileUrl(user.org_logo);

function isActive(page) {
  return currentPage === page ? "active" : "";
}

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
    alert(msg); // Default implementation, can be overridden
  }
};

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
  </div>
`;

/* ===== NAVBAR ===== */
document.getElementById("navbar").innerHTML = `
  <div class="navbar-left">
    <button id="sidebarToggle" class="nav-toggle-btn" title="Toggle Sidebar">☰</button>
    <div style="position:relative;">
        <input class="search" type="text" id="globalSearchInput" placeholder="Search data…">
    </div>
  </div>

  <div class="navbar-right">
    <div class="profile" id="profileDropdownTrigger">
      <div class="profile-info">
        <div class="profile-name">${user.name || "Admin"}</div>
        <div class="profile-email">Administrator</div>
      </div>
      <div class="avatar">${user.name?.charAt(0).toUpperCase() || "A"}</div>
      
      <div class="profile-dropdown">
        <a href="settings.html"><span>⚙️</span> Settings</a>
        <button id="logoutBtn"><span>Logout</span></button>
      </div>
    </div>
  </div>
`;

/* ===== GLOBAL SEARCH LOGIC ===== */
document.getElementById("globalSearchInput").addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  
  // Find local search inputs (excluding the global one)
  const localSearch = document.getElementById("teacherSearch") || 
                      document.getElementById("searchInput") || 
                      document.getElementById("courseSearch");

  if (localSearch) {
    localSearch.value = e.target.value;
    // Dispatch input event to trigger local listeners
    localSearch.dispatchEvent(new Event('input'));
  }
  
  // Direct function calls as fallback
  if (typeof renderTeachers === "function") renderTeachers();
  if (typeof render === "function") render();
  if (typeof renderCourses === "function") renderCourses();
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
