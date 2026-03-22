const API_BASE = "http://127.0.0.1:8000/api/v1";
const API_BASE_FILTER = "http://127.0.0.1:8000/api/v1";

async function fetchDashboardData() {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE}/teacher/dashboard`, {
      headers: { "Authorization": "Bearer " + token }
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
  const studentsLabel = document.getElementById("label-students");
  if (studentsLabel && data.students_label) {
    studentsLabel.textContent = data.students_label;
  }
  document.getElementById("studentsCount").textContent     = data.total_students     ?? 0;
  document.getElementById("coursesCount").textContent      = data.total_courses      ?? 0;
  document.getElementById("quizzesCount").textContent      = data.total_quizzes      ?? 0;
  document.getElementById("assignmentsCount").textContent  = data.total_assignments  ?? 0;
  document.getElementById("materialsCount").textContent    = data.total_materials    ?? 0;
  document.getElementById("certificatesCount").textContent = data.certificates_issued ?? 0;

  // ── Engagement Overview ──
  if (data.engagement) {
    const vPct = data.engagement.video_rate + "%";
    const qPct = data.engagement.quiz_rate + "%";
    const aPct = data.engagement.assign_rate + "%";

    const vBar = document.querySelector(".engagement-bar.purple");
    const qBar = document.querySelector(".engagement-bar.blue");
    const aBar = document.querySelector(".engagement-bar.green");

    if (vBar) vBar.style.width = vPct;
    if (qBar) qBar.style.width = qPct;
    if (aBar) aBar.style.width = aPct;

    const vText = document.querySelectorAll(".engagement-pct")[0];
    const qText = document.querySelectorAll(".engagement-pct")[1];
    const aText = document.querySelectorAll(".engagement-pct")[2];

    if (vText) vText.textContent = vPct;
    if (qText) qText.textContent = qPct;
    if (aText) aText.textContent = aPct;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const data = await fetchDashboardData();
  updateDashboardUI(data);
  loadDashboardCharts(); // Initial load
  loadCourseFilter();
});

async function loadCourseFilter() {
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`${API_BASE_FILTER}/teacher/courses`, {
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
    badge.style.display = "none";
    resetStatLabels();
    const data = await fetchDashboardData();
    updateDashboardUI(data);
    loadDashboardCharts(); 
    return;
  }

  badge.style.display = "flex";
  badge.textContent = "Loading…";
  setStatCounts("--", "--", "--", "--", "--", "--");

  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`${API_BASE_FILTER}/teacher/courses/${courseId}/stats`, {
      headers: { Authorization: "Bearer " + token }
    });
    if (!res.ok) throw new Error("Course stats not available");
    const data = await res.json();

    // Map course-specific stats to dashboard UI
    const mappedData = {
        total_students: data.enrolled_students ?? 0,
        total_courses: data.total_topics ?? 0, // Using topics instead of courses count here
        total_quizzes: data.total_quizzes ?? 0,
        total_assignments: data.total_assignments ?? 0,
        total_materials: data.total_materials ?? 0,
        certificates_issued: data.certificates_issued ?? 0,
        students_label: "Enrolled Students",
        engagement: data.engagement
    };

    updateDashboardUI(mappedData);
    
    // Update labels manually for clarity in filtered view
    document.getElementById("label-courses").textContent = "Total Topics";

    const courseName = select.options[select.selectedIndex].textContent;
    badge.textContent = `📘 ${courseName}`;
    
    // Update charts for specific course
    loadDashboardCharts(courseId);

  } catch (err) {
    console.error("Course stats error:", err);
    badge.textContent = "⚠ Stats unavailable";
    setStatCounts("--", "--", "--", "--", "--", "--");
  }
}

async function loadDashboardCharts(courseId = null) {
    const token = localStorage.getItem("token");
    try {
        let url = `${API_BASE}/teacher/analytics`;
        if (courseId) url += `?course_id=${courseId}`;

        const res = await fetch(url, {
            headers: { Authorization: "Bearer " + token }
        });
        const data = await res.json();

        // 1. Course Distribution Bar Chart
        const ctx1 = document.getElementById('courseDistChart');
        if (ctx1) {
            const existing1 = Chart.getChart(ctx1);
            if (existing1) existing1.destroy();
            new Chart(ctx1, {
                type: 'bar',
                data: {
                    labels: data.course_distribution.map(c => c.title),
                    datasets: [{
                        label: courseId ? 'Topic Performance' : 'Students',
                        data: data.course_distribution.map(c => c.students),
                        backgroundColor: '#3b82f6',
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { display: false } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }

        // 2. Level Distribution Doughnut
        const ctx2 = document.getElementById('levelDistChart');
        if (ctx2) {
            const existing2 = Chart.getChart(ctx2);
            if (existing2) existing2.destroy();
            new Chart(ctx2, {
                type: 'doughnut',
                data: {
                    labels: ['Strong', 'Average', 'Weak'],
                    datasets: [{
                        data: [data.level_distribution.Strong, data.level_distribution.Average, data.level_distribution.Weak],
                        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }
    } catch (err) {
        console.error("Charts load error", err);
    }
}

function setStatCounts(students, courses, quizzes, assignments, materials, certs) {
  document.getElementById("studentsCount").textContent     = students;
  document.getElementById("coursesCount").textContent      = courses;
  document.getElementById("quizzesCount").textContent      = quizzes;
  document.getElementById("assignmentsCount").textContent  = assignments;
  document.getElementById("materialsCount").textContent    = materials;
  document.getElementById("certificatesCount").textContent = certs;
}

function resetStatLabels() {
  document.getElementById("label-students").textContent    = "Total Students";
  document.getElementById("label-courses").textContent     = "Total Courses";
  document.getElementById("label-quizzes").textContent     = "Total Quizzes";
  document.getElementById("label-assignments").textContent = "Total Assignments";
  document.getElementById("label-certificates").textContent= "Certificates Issued";
}
