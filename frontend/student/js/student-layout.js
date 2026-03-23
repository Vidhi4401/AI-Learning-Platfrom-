var token = localStorage.getItem("token");
var user  = JSON.parse(localStorage.getItem("user"));

if (!token || !user) {
  window.location.href = "../auth.html";
}

const currentPage  = window.location.pathname.split("/").pop();
const platformName = user.platform_name || "LearnHub";

function getFileUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `http://127.0.0.1:8000/${path}`;
}

const orgLogo = getFileUrl(user.org_logo);

function isActive(page) {
  return currentPage === page ? "active" : "";
}

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
    <a href="student-courses.html" class="${isActive("student-courses.html")}">
      <span>Courses</span>
    </a>
    <a href="student-assignments.html" class="${isActive("student-assignments.html")}">
      <span>Assignments</span>
    </a>
    <a href="student-quizzes.html" class="${isActive("student-quizzes.html")}">
      <span>Quizzes</span>
    </a>
    <a href="student-materials.html" class="${isActive("student-materials.html")}">
      <span>Materials</span>
    </a>
    <a href="student-performnace.html" class="${isActive("student-performnace.html")}">
      <span>Performance</span>
    </a>
    <a href="student-settings.html" class="${isActive("student-settings.html")}">
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
    <input class="search" type="text" placeholder="Search courses…">
  </div>

  <div class="navbar-right">
    <div class="profile">
      <div class="profile-info">
        <div class="profile-name"  id="navProfileName">${user.name  || "Student"}</div>
        <div class="profile-email" id="navProfileEmail">${user.email || ""}</div>
      </div>
      <div class="avatar" id="navAvatar">${user.name?.charAt(0).toUpperCase() || "S"}</div>
    </div>
  </div>
`;

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

/* ===== LOGOUT ===== */
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "../auth.html";
});