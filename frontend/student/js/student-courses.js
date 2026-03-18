const API = "http://127.0.0.1:8000/api/v1";

let allCourses    = [];
let enrolledIds   = new Set();
let completedIds  = new Set();
let currentFilter = "all";

document.addEventListener("DOMContentLoaded", async () => {
  await loadCourses();
  await loadEnrollments();
  renderCourses();
  setupTabs();
});

/* =========================
   1. LOAD ALL ORG COURSES
=========================*/
async function loadCourses() {
  try {
    const res = await fetch(`${API}/student/courses`, {
      headers: { Authorization: "Bearer " + token }
    });
    if (!res.ok) throw new Error(res.status);
    allCourses = await res.json();
  } catch (err) {
    console.error("loadCourses error:", err);
    allCourses = [];
    document.getElementById("coursesGrid").innerHTML = `
      <div class="empty-state">
        <span>⚠️</span>
        <p>Could not load courses. Check backend connection.</p>
      </div>`;
  }
}

/* =========================
   2. LOAD ENROLLMENTS
=========================*/
async function loadEnrollments() {
  try {
    const res = await fetch(`${API}/student/enrollments`, {
      headers: { Authorization: "Bearer " + token }
    });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    enrolledIds  = new Set(data.map(e => e.course_id));
    // Completed = enrolled courses where progress = 100 (future feature)
    // For now completedIds stays empty until you build progress tracking
    completedIds = new Set(data.filter(e => e.completed).map(e => e.course_id));
  } catch (err) {
    console.error("loadEnrollments error:", err);
    enrolledIds  = new Set();
    completedIds = new Set();
  }
}

/* =========================
   3. RENDER COURSES
=========================*/
function renderCourses() {
  const grid = document.getElementById("coursesGrid");

  // Update tab counts
  document.getElementById("count-all").textContent       = allCourses.length;
  document.getElementById("count-enrolled").textContent  = enrolledIds.size;
  document.getElementById("count-completed").textContent = completedIds.size;

  // Filter
  let filtered = allCourses;
  if (currentFilter === "enrolled")  filtered = allCourses.filter(c => enrolledIds.has(c.id));
  if (currentFilter === "completed") filtered = allCourses.filter(c => completedIds.has(c.id));

  // Empty states
  if (filtered.length === 0) {
    const msgs = {
      all:       { icon: "📚", text: "No courses available for your organization yet." },
      enrolled:  { icon: "📖", text: "You haven't enrolled in any courses yet. Go to All Courses to enroll." },
      completed: { icon: "🏆", text: "No completed courses yet. Keep learning!" }
    };
    const m = msgs[currentFilter];
    grid.innerHTML = `
      <div class="empty-state">
        <span>${m.icon}</span>
        <p>${m.text}</p>
      </div>`;
    return;
  }

  grid.innerHTML = "";

  filtered.forEach(course => {
    const isEnrolled  = enrolledIds.has(course.id);
    const isCompleted = completedIds.has(course.id);
    const imgUrl = course.logo
      ? `http://127.0.0.1:8000/${course.logo}`
      : null;

    const card = document.createElement("div");
    card.className = "course-card";

    card.innerHTML = `
      <div class="course-image">
        ${imgUrl
          ? `<img src="${imgUrl}" alt="${course.title}"
                  onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
             <div class="img-placeholder" style="display:none;">📚</div>`
          : `<div class="img-placeholder">📚</div>`}
        <span class="difficulty-pill">${course.difficulty || "General"}</span>
        ${isEnrolled ? `<span class="enrolled-img-badge">✓ Enrolled</span>` : ""}
      </div>

      <div class="course-content">
        <div class="course-title" title="${course.title}">${course.title}</div>
        <div class="course-description">${course.description || "No description available."}</div>
        <div class="course-faculty" style="font-size: 13px; color: #4b5563; font-weight: 500; margin-bottom: 12px;">
          👨‍🏫 Faculty: ${course.teacher_name || "Unknown"}
        </div>

        <div class="course-footer">
          <div style="font-size:12px;color:#9ca3af;font-family:'DM Sans',sans-serif;" id="meta-${course.id}">
            Loading…
          </div>
          ${isCompleted
            ? `<button class="btn-enroll enrolled" onclick="viewCourse(${course.id})">🏆 Completed</button>`
            : isEnrolled
              ? `<button class="btn-enroll enrolled" onclick="viewCourse(${course.id})">▶ Continue</button>`
              : `<button class="btn-enroll not-enrolled" id="btn-${course.id}" onclick="enrollCourse(${course.id})">Enroll Course</button>`
          }
        </div>
      </div>
    `;

    grid.appendChild(card);

    // Load topic/quiz/assignment counts
    loadCourseMeta(course.id);
  });
}

/* =========================
   4. LOAD COURSE META (counts)
=========================*/
async function loadCourseMeta(courseId) {
  try {
    const res = await fetch(`${API}/student/courses/${courseId}/stats`, {
      headers: { Authorization: "Bearer " + token }
    });
    if (!res.ok) return;
    const d = await res.json();
    const el = document.getElementById(`meta-${courseId}`);
    if (el) {
      el.innerHTML = `
         ${d.total_topics ?? 0} topics &nbsp;·&nbsp;
         ${d.total_quizzes ?? 0} quizzes &nbsp;·&nbsp;
         ${d.total_assignments ?? 0} tasks
      `;
    }
  } catch (_) {}
}

/* =========================
   5. ENROLL
=========================*/
async function enrollCourse(courseId) {
  const btn = document.getElementById(`btn-${courseId}`);
  if (!btn) return;

  btn.disabled    = true;
  btn.textContent = "Enrolling…";

  try {
    const res = await fetch(`${API}/student/courses/${courseId}/enroll`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed");
    }

    enrolledIds.add(courseId);

    // Update button
    btn.className   = "btn-enroll enrolled";
    btn.textContent = "▶ Continue";
    btn.disabled    = false;
    btn.setAttribute("onclick", `viewCourse(${courseId})`);

    // Add enrolled badge to image
    const card  = btn.closest(".course-card");
    const image = card.querySelector(".course-image");
    if (!image.querySelector(".enrolled-img-badge")) {
      const badge       = document.createElement("span");
      badge.className   = "enrolled-img-badge";
      badge.textContent = "✓ Enrolled";
      image.appendChild(badge);
    }

    // Update tab counts
    document.getElementById("count-enrolled").textContent = enrolledIds.size;

  } catch (err) {
    console.error("Enroll error:", err);
    btn.disabled    = false;
    btn.textContent = "Enroll Course";
    alert(err.message || "Enrollment failed. Try again.");
  }
}

/* =========================
   6. VIEW COURSE
=========================*/
function viewCourse(courseId) {
  window.location.href = `student-course-detail.html?id=${courseId}`;
}

/* =========================
   7. TABS
=========================*/
function setupTabs() {
  document.querySelectorAll(".ftab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".ftab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderCourses();
    });
  });
}