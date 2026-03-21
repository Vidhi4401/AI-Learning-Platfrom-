const API = "http://127.0.0.1:8000/api/v1";
const params = new URLSearchParams(window.location.search);
const courseId = params.get("id");

if (!courseId) window.location.href = "courses.html";

/* =========================
   INIT
=========================*/
document.addEventListener("DOMContentLoaded", () => {
  loadCourseDetail();
  setupTabs();
});

/* =========================
   TABS
=========================*/
function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");

      // Lazy load tab content
      if (btn.dataset.tab === "topics")      loadTopics();
      if (btn.dataset.tab === "quizzes")     loadAllQuizzes();
      if (btn.dataset.tab === "assignments") loadAllAssignments();
    });
  });
}

/* =========================
   LOAD COURSE DETAIL
=========================*/
async function loadCourseDetail() {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API}/teacher/courses/${courseId}`, {
      headers: { Authorization: "Bearer " + token }
    });

    const course = await res.json();

    // Hero
    document.getElementById("courseTitle").textContent = course.title || "Untitled";
    document.getElementById("courseDesc").textContent  = course.description || "";
    document.getElementById("overviewDesc").textContent       = course.description || "No description provided.";
    document.getElementById("overviewDifficulty").textContent = course.difficulty || "General";

    // Image
    const img = document.getElementById("courseImg");
    if (course.logo) {
      img.src = `http://127.0.0.1:8000/${course.logo}`;
      img.style.display = "block";
    } else {
      img.style.display = "none";
    }

    // Badges
    const isPublished = !!course.status;
    document.getElementById("heroBadges").innerHTML = `
      <span class="hero-badge ${isPublished ? "published" : "draft"}">${isPublished ? "Published" : "Draft"}</span>
      <span class="hero-badge difficulty">${course.difficulty || "General"}</span>
    `;

    // Status stat
    document.getElementById("statStatus").innerHTML =
      `<span class="${isPublished ? "status-active" : "status-draft"}">${isPublished ? "Active" : "Draft"}</span>`;

    // Load topics count for stats
    loadStatsCount();

  } catch (err) {
    console.error("Course load error:", err);
  }
}

/* =========================
   STATS COUNT
=========================*/
async function loadStatsCount() {
  const token = localStorage.getItem("token");

  try {
    const topicsRes = await fetch(`${API}/teacher/courses/${courseId}/topics`, {
      headers: { Authorization: "Bearer " + token }
    });
    const topics = await topicsRes.json();
    document.getElementById("statTopics").textContent = topics.length ?? 0;

    // Count quizzes and assignments across all topics
    let totalQuizzes = 0;
    let totalAssignments = 0;

    for (const topic of topics) {
      const [qRes, aRes] = await Promise.all([
        fetch(`${API}/topics/${topic.id}/quizzes`, { headers: { Authorization: "Bearer " + token } }),
        fetch(`${API}/teacher/topics/${topic.id}/assignments`, { headers: { Authorization: "Bearer " + token } })
      ]);
      const quizzes     = await qRes.json();
      const assignments = await aRes.json();
      totalQuizzes     += Array.isArray(quizzes)     ? quizzes.length     : 0;
      totalAssignments += Array.isArray(assignments) ? assignments.length : 0;
    }

    document.getElementById("statQuizzes").textContent     = totalQuizzes;
    document.getElementById("statAssignments").textContent = totalAssignments;

  } catch (err) {
    console.error("Stats error:", err);
  }
}

/* =========================
   TOPICS TAB
=========================*/
async function loadTopics() {
  const token = localStorage.getItem("token");
  const container = document.getElementById("topicsList");
  container.innerHTML = `<div class="loading-row">Loading topics…</div>`;

  try {
    const res = await fetch(`${API}/teacher/courses/${courseId}/topics`, {
      headers: { Authorization: "Bearer " + token }
    });
    const topics = await res.json();

    if (!topics || topics.length === 0) {
      container.innerHTML = `<div class="empty-row">No topics yet. Click <strong>Add Topic</strong> to get started.</div>`;
      return;
    }

    container.innerHTML = `
      <table class="detail-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Topic Name</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="topicsBody"></tbody>
      </table>`;

    const tbody = document.getElementById("topicsBody");

    topics.forEach((topic, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="order-cell">#${index + 1}</td>
        <td class="name-cell"><strong>${topic.title}</strong></td>
        <td class="actions-cell">
          <button class="tbl-btn delete" onclick="deleteTopic(${topic.id})">🗑</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    container.innerHTML = `<div class="empty-row">Failed to load topics.</div>`;
  }
}

async function deleteTopic(topicId) {
  if (!confirm("Delete this topic? This will remove all its videos, quizzes, and assignments.")) return;
  const token = localStorage.getItem("token");
  await fetch(`${API}/teacher/topics/${topicId}`, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + token }
  });
  loadTopics();
  loadStatsCount();
}

/* =========================
   QUIZZES TAB
=========================*/
async function loadAllQuizzes() {
  const token = localStorage.getItem("token");
  const container = document.getElementById("quizzesList");
  container.innerHTML = `<div class="loading-row">Loading quizzes…</div>`;

  try {
    const topicsRes = await fetch(`${API}/teacher/courses/${courseId}/topics`, {
      headers: { Authorization: "Bearer " + token }
    });
    const topics = await topicsRes.json();

    let allQuizzes = [];
    for (const topic of topics) {
      const qRes = await fetch(`${API}/topics/${topic.id}/quizzes`, {
        headers: { Authorization: "Bearer " + token }
      });
      const quizzes = await qRes.json();
      if (Array.isArray(quizzes)) {
        quizzes.forEach(q => allQuizzes.push({ ...q, topicTitle: topic.title }));
      }
    }

    if (allQuizzes.length === 0) {
      container.innerHTML = `<div class="empty-row">No quizzes yet.</div>`;
      return;
    }

    container.innerHTML = `
      <table class="detail-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Quiz Title</th>
            <th>Topic</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="quizzesBody"></tbody>
      </table>`;

    const tbody = document.getElementById("quizzesBody");
    allQuizzes.forEach((quiz, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="order-cell">#${i + 1}</td>
        <td class="name-cell"><strong>${quiz.title}</strong></td>
        <td class="meta-cell">${quiz.topicTitle}</td>
        <td class="actions-cell">
          <button class="tbl-btn delete" onclick="deleteQuiz(${quiz.id})">🗑</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    container.innerHTML = `<div class="empty-row">Failed to load quizzes.</div>`;
  }
}

async function deleteQuiz(quizId) {
  if (!confirm("Delete this quiz and all its questions?")) return;
  const token = localStorage.getItem("token");
  await fetch(`${API}/teacher/quizzes/${quizId}`, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + token }
  });
  loadAllQuizzes();
  loadStatsCount();
}

/* =========================
   ASSIGNMENTS TAB
=========================*/
async function loadAllAssignments() {
  const token = localStorage.getItem("token");
  const container = document.getElementById("assignmentsList");
  container.innerHTML = `<div class="loading-row">Loading assignments…</div>`;

  try {
    const topicsRes = await fetch(`${API}/teacher/courses/${courseId}/topics`, {
      headers: { Authorization: "Bearer " + token }
    });
    const topics = await topicsRes.json();

    let allAssignments = [];
    for (const topic of topics) {
      const aRes = await fetch(`${API}/teacher/topics/${topic.id}/assignments`, {
        headers: { Authorization: "Bearer " + token }
      });
      const assignments = await aRes.json();
      if (Array.isArray(assignments)) {
        assignments.forEach(a => allAssignments.push({ ...a, topicTitle: topic.title }));
      }
    }

    if (allAssignments.length === 0) {
      container.innerHTML = `<div class="empty-row">No assignments yet.</div>`;
      return;
    }

    container.innerHTML = `
      <table class="detail-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Assignment Title</th>
            <th>Topic</th>
            <th>Marks</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="assignmentsBody"></tbody>
      </table>`;

    const tbody = document.getElementById("assignmentsBody");
    allAssignments.forEach((a, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="order-cell">#${i + 1}</td>
        <td class="name-cell"><strong>${a.title}</strong></td>
        <td class="meta-cell">${a.topicTitle}</td>
        <td class="meta-cell">${a.total_marks ?? "--"}</td>
        <td class="actions-cell">
          <button class="tbl-btn delete" onclick="deleteAssignment(${a.id})">🗑</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    container.innerHTML = `<div class="empty-row">Failed to load assignments.</div>`;
  }
}

async function deleteAssignment(assignmentId) {
  if (!confirm("Delete this assignment?")) return;
  const token = localStorage.getItem("token");
  await fetch(`${API}/teacher/assignments/${assignmentId}`, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + token }
  });
  loadAllAssignments();
  loadStatsCount();
}

/* =========================
   REDIRECT HELPERS
=========================*/
function goToAddTopic() {
  window.location.href = `add-course.html?step=2&course=${courseId}`;
}

function goToAddQuiz() {
  window.location.href = `add-course.html?step=5&course=${courseId}`;
}

function goToAddAssignment() {
  window.location.href = `add-course.html?step=4&course=${courseId}`;
}
