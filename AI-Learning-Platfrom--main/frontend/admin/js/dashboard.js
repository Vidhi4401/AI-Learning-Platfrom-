const API_BASE = "http://127.0.0.1:8000/api/v1";

async function fetchDashboardData() {
  try {
    const token = localStorage.getItem("token");

    const response = await fetch(`${API_BASE}/admin/dashboard`, {
      headers: {
        "Authorization": "Bearer " + token
      }
    });

    if (!response.ok) throw new Error("Failed to fetch dashboard");

    return await response.json();

  } catch (error) {
    console.error("Dashboard error:", error);
    return null;
  }
}
function updateDashboardUI(data) {
  if (!data) return;

  // ── Use label from backend ──
  const studentsLabel = document.getElementById("label-students");
  if (studentsLabel && data.students_label) {
    studentsLabel.textContent = data.students_label;
  }

  document.getElementById("studentsCount").textContent     = data.total_students     ?? 0;
  document.getElementById("coursesCount").textContent      = data.total_courses      ?? 0;
  document.getElementById("quizzesCount").textContent      = data.total_quizzes      ?? 0;
  document.getElementById("assignmentsCount").textContent  = data.total_assignments  ?? 0;
  document.getElementById("certificatesCount").textContent = data.certificates_issued ?? 0;
}
document.addEventListener("DOMContentLoaded", async () => {
  const data = await fetchDashboardData();
  updateDashboardUI(data);
});

const API_BASE_FILTER = "http://127.0.0.1:8000/api/v1";


async function loadCourseFilter() {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API_BASE_FILTER}/admin/courses`, {
      headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) return;

    const courses = await res.json();
    const select = document.getElementById("courseFilterSelect");

    courses.forEach(course => {
      const option = document.createElement("option");
      option.value = course.id;
      option.textContent = course.title;
      select.appendChild(option);
    });

  } catch (err) {
    console.error("Filter load error:", err);
  }
}

async function onCourseFilterChange() {
  const select = document.getElementById("courseFilterSelect");
  const courseId = select.value;
  const badge = document.getElementById("filterBadge");

  if (courseId === "all") {
    /* Reset to global stats */
    badge.style.display = "none";
    resetStatLabels();
    const data = await fetchDashboardData();
    updateDashboardUI(data);
    return;
  }

  badge.style.display = "flex";
  badge.textContent = "Loading…";
  setStatCounts("--", "--", "--", "--", "--");

  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API_BASE_FILTER}/admin/courses/${courseId}/stats`, {
      headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) throw new Error("Course stats not available");

    const data = await res.json();

    document.getElementById("label-students").textContent    = "Enrolled Students";
    document.getElementById("label-courses").textContent     = "Total Topics";
    document.getElementById("label-quizzes").textContent     = "Total Quizzes";
    document.getElementById("label-assignments").textContent = "Total Assignments";
    document.getElementById("label-certificates").textContent= "Certificates Issued";

    setStatCounts(
      data.enrolled_students   ?? 0,
      data.total_topics        ?? 0,
      data.total_quizzes       ?? 0,
      data.total_assignments   ?? 0,
      data.certificates_issued ?? 0
    );

    const courseName = select.options[select.selectedIndex].textContent;
    badge.textContent = `📘 ${courseName}`;

  } catch (err) {
    console.error("Course stats error:", err);
    badge.textContent = "⚠ Stats unavailable";
    setStatCounts("--", "--", "--", "--", "--");
  }
}

function setStatCounts(students, courses, quizzes, assignments, certs) {
  document.getElementById("studentsCount").textContent     = students;
  document.getElementById("coursesCount").textContent      = courses;
  document.getElementById("quizzesCount").textContent      = quizzes;
  document.getElementById("assignmentsCount").textContent  = assignments;
  document.getElementById("certificatesCount").textContent = certs;
}

function resetStatLabels() {
  document.getElementById("label-students").textContent    = "Total Students";
  document.getElementById("label-courses").textContent     = "Total Courses";
  document.getElementById("label-quizzes").textContent     = "Total Quizzes";
  document.getElementById("label-assignments").textContent = "Total Assignments";
  document.getElementById("label-certificates").textContent= "Certificates Issued";
}

document.addEventListener("DOMContentLoaded", () => {
  loadCourseFilter();
});