var token = localStorage.getItem("token");
var user  = JSON.parse(localStorage.getItem("user"));

if (!token || !user) {
  window.location.href = "../auth.html";
}

const currentPage  = window.location.pathname.split("/").pop();
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
            const nameEl = document.getElementById("sidebarPlatformName");
            const logoEl = document.querySelector(".sidebar-brand-icon");
            
            if (nameEl) nameEl.textContent = data.platform_name;
            if (logoEl && data.logo) {
                logoEl.innerHTML = `<img src="${data.logo}" alt="Logo" style="width:100%;height:100%;object-fit:cover;border-radius:7px;">`;
            }
            
            user.platform_name = data.platform_name;
            user.org_logo = data.logo;
            localStorage.setItem("user", JSON.stringify(user));
        }
    } catch (err) {}
}
fetchBranding();

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
    return password.length >= 4;
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
      <p>Student Portal</p>
    </div>
  </div>

  <div class="sidebar-nav">
    <a href="student-courses.html" class="${isActive("student-courses.html") || isActive("student-course-detail.html")}">
      <span>Courses</span>
    </a>
    <a href="student-assignments.html" class="${isActive("student-assignments.html") || isActive("student-assignment-submit.html")}">
      <span>Assignments</span>
    </a>
    <a href="student-quizzes.html" class="${isActive("student-quizzes.html") || isActive("student-quiz-attempt.html")}">
      <span>Quizzes</span>
    </a>
    <a href="student-materials.html" class="${isActive("student-materials.html")}">
      <span>Materials</span>
    </a>
    <a href="student-meetings.html" class="${isActive("student-meetings.html")}">
      <span>Meetings</span>
    </a>
    <a href="student-performnace.html" class="${isActive("student-performnace.html")}">
      <span>Performance</span>
    </a>
    <a href="student-certificates.html" class="${isActive("student-certificates.html")}">
      <span>Certificates</span>
    </a>
  </div>
`;

/* ===== NAVBAR ===== */
document.getElementById("navbar").innerHTML = `
  <div class="navbar-left">
    <button id="sidebarToggle" class="nav-toggle-btn" title="Toggle Sidebar">☰</button>
  </div>

  <div class="navbar-right">
    <!-- Notifications -->
    <div class="notif-wrapper" id="notifWrapper">
        <button class="notif-btn" id="notifBtn" onclick="toggleNotif(event)">
            <span class="icon">🔔</span>
            <span class="notif-badge" id="notifCount" style="display:none;">0</span>
        </button>
        <div class="notif-dropdown" id="notifDropdown">
            <div class="notif-header">
                <span>Notifications</span>
                <button onclick="markAllNotificationsRead(event)" style="font-size:11px; background:none; border:none; color:var(--primary); cursor:pointer;">Mark all read</button>
            </div>
            <div class="notif-list" id="notifList">
                <div class="notif-empty">No new notifications</div>
            </div>
        </div>
    </div>

    <div class="profile" id="profileDropdownTrigger">
      <div class="profile-info">
        <div class="profile-name"  id="navProfileName">${user.name  || "Student"}</div>
        <div class="profile-email" id="navProfileEmail">${user.email || ""}</div>
      </div>
      <div class="avatar" id="navAvatar">${user.name?.charAt(0).toUpperCase() || "S"}</div>

      <div class="profile-dropdown">
        <a href="student-settings.html"><span>⚙️</span> Settings</a>
        <button id="logoutBtn"><span>Logout</span></button>
      </div>
    </div>
  </div>
`;

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

/* ===== CHATBOT INJECTION ===== */
const chatbotStyles = document.createElement('link');
chatbotStyles.rel = 'stylesheet';
chatbotStyles.href = 'css/chatbot.css';
document.head.appendChild(chatbotStyles);

const chatbotHTML = `
  <div id="chatbot-launcher" onclick="toggleChat()">
    <span style="font-size:30px;">💬</span>
    <span id="chat-badge" class="badge">0</span>
  </div>

  <div id="chatbot-window" class="hidden">
    <div class="chatbot-header">
      <div style="font-weight:bold;">LearnHub Assistant</div>
      <div class="mode-toggle">
        <div id="mode-ai" class="mode-btn active" onclick="setChatMode('AI')">AI</div>
        <div id="mode-faculty" class="mode-btn" onclick="setChatMode('FACULTY')">Faculty</div>
      </div>
    </div>
    <div id="chatbot-messages" class="chatbot-messages">
      <div class="message ai">Hi ${user.name}! How can I help you today?</div>
    </div>
    
    <!-- Teacher Selector (Hidden by default, shown in Faculty mode) -->
    <div id="teacher-select-container" style="display:none; padding:8px 12px; background:#f8fafc; border-top:1px solid #e2e8f0;">
      <select id="chat-teacher-select" style="width:100%; padding:6px; border-radius:6px; border:1px solid #cbd5e1; font-size:12px;">
        <option value="">— Select Teacher —</option>
      </select>
    </div>

    <div class="chatbot-footer">
      <input type="text" id="chat-input" placeholder="Type your doubt..." onkeypress="if(event.key==='Enter') sendChatMessage()">
      <button onclick="sendChatMessage()">Send</button>
    </div>
  </div>
`;
document.body.insertAdjacentHTML('beforeend', chatbotHTML);

const chatbotScript = document.createElement('script');
chatbotScript.src = 'js/chatbot.js';
document.body.appendChild(chatbotScript);

/* ===== NOTIFICATIONS LOGIC ===== */
window.toggleNotif = function(e) {
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

window.markNotificationRead = async function(id, link) {
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

window.markAllNotificationsRead = async function(e) {
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

// Initial check and interval
checkUnreadCount();
setInterval(checkUnreadCount, 30000);

document.addEventListener("click", () => {
    document.getElementById("notifDropdown").classList.remove("active");
});

/* ===== LOGOUT ===== */
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "../auth.html";
});