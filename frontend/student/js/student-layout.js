var token = localStorage.getItem("token");
var user  = JSON.parse(localStorage.getItem("user"));

if (!token || !user) {
  window.location.href = "../auth.html";
}

const currentPage  = window.location.pathname.split("/").pop();
const platformName = user.platform_name || "LearnHub";
const orgLogo      = user.org_logo
  ? `http://127.0.0.1:8000/${user.org_logo}`
  : null;

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
      <p>Student</p>
    </div>
  </div>

  <div class="sidebar-nav">
      <a href="student-courses.html" class="${isActive("student-courses.html")}">
      
      <span>courses</span>
    </a>
     <a href="student-assignments.html" class="${isActive("student-assignment.html")}">
      
      <span>Assignment</span>
    </a>
    <a href="student-quizzes.html" class="${isActive("student-quiz.html")}">
      
      <span>Quiz</span>
    </a>
     <a href="student-performnace.html" class="${isActive("student-performnace.html")}">
      
      <span>performance</span>
    </a>
     


   

    <a href="student-settings.html" class="${isActive("student-profile.html")}">
      
      <span>Profile</span>
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

/* ===== LOGOUT ===== */
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "../auth.html";
});