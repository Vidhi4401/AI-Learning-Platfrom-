var token = localStorage.getItem("token");
var user  = JSON.parse(localStorage.getItem("user"));

if (!token || !user || user.role !== "superadmin") {
  window.location.href = "../auth.html";
}

const currentPage = window.location.pathname.split("/").pop();

function isActive(page) {
  return currentPage === page ? "active" : "";
}

/* ===== SIDEBAR ===== */
document.getElementById("sidebar").innerHTML = `
  <div class="sidebar-brand">
    <div class="sidebar-brand-text">
      <h2>LearnHub</h2>
      <p>Super Admin Portal</p>
    </div>
  </div>

  <div class="sidebar-nav">
    <a href="super-dashboard.html" class="${isActive("super-dashboard.html")}">
      <span>Dashboard</span>
    </a>
    <a href="super-orgs.html" class="${isActive("super-orgs.html")}">
      <span>Organizations</span>
    </a>
    <a href="super-admins.html" class="${isActive("super-admins.html")}">
      <span>Manage Admins</span>
    </a>
    <a href="messages.html" class="${isActive("messages.html")}" id="messagesSidebarBtn">
      <span>Messages</span>
      <span id="messagesNotifDot" style="display:none; margin-left:6px; vertical-align:middle; width:10px; height:10px; background:#dc2626; border-radius:50%; display:inline-block;"></span>
    </a>
  </div>
`;

/* ===== NAVBAR ===== */
document.getElementById("navbar").innerHTML = `
  <div class="navbar-left">
    <button id="sidebarToggle" class="nav-toggle-btn">☰</button>
    <h1 class="navbar-page-title">Global Management</h1>
  </div>

  <div class="navbar-right">
    <div class="profile" id="profileDropdownTrigger">
      <div class="profile-info">
        <div class="profile-name">${user.name}</div>
        <div class="profile-email">Super Admin</div>
      </div>
      <div class="avatar">${user.name.charAt(0)}</div>
      
      <div class="profile-dropdown">
        <button id="logoutBtn">Logout</button>
      </div>
    </div>
  </div>
`;

/* ===== SIDEBAR TOGGLE ===== */
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

/* ===== LOGOUT ===== */
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "../auth.html";
});

/* ===== CHECK FOR NEW MESSAGES ===== */
async function checkNewMessages() {
  try {
    const res = await fetch("http://127.0.0.1:8000/api/v1/superadmin/contact-requests?unread=1", {
      headers: { Authorization: "Bearer " + token }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        document.getElementById("messagesNotifDot").style.display = "inline-block";
      } else {
        document.getElementById("messagesNotifDot").style.display = "none";
      }
    }
  } catch (e) {
    document.getElementById("messagesNotifDot").style.display = "none";
  }
}
checkNewMessages();
setInterval(checkNewMessages, 30000); // Poll every 30 seconds
