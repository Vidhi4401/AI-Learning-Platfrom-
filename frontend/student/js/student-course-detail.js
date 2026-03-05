const API = "http://127.0.0.1:8000/api/v1";

const params   = new URLSearchParams(window.location.search);
const courseId = params.get("id");

if (!courseId) window.location.href = "student-courses.html";

let courseData = null;

document.addEventListener("DOMContentLoaded", async () => {
  await loadCourseDetail();
  setupTabs();
});

/* =========================
   LOAD COURSE DETAIL
=========================*/
async function loadCourseDetail() {
  try {
    const res = await fetch(`${API}/student/courses/${courseId}/detail`, {
      headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) throw new Error(res.status);
    courseData = await res.json();

    renderHero(courseData);
    renderStats(courseData);
    renderTopicsTab(courseData.topics);
    renderQuizzesTab(courseData.topics);
    renderAssignmentsTab(courseData.topics);

  } catch (err) {
    console.error("Course detail error:", err);
    document.getElementById("heroTitle").textContent = "Failed to load course.";
  }
}

/* =========================
   HERO
=========================*/
function renderHero(data) {
  document.title = data.title;

  // Badges
  const badges = document.getElementById("heroBadges");
  badges.innerHTML = `
    <span class="hero-badge enrolled">✓ Enrolled</span>
    <span class="hero-badge difficulty">${data.difficulty || "General"}</span>
  `;

  document.getElementById("heroTitle").textContent = data.title;
  document.getElementById("heroDesc").textContent  = data.description || "";

  // Logo
  if (data.logo) {
    const img = document.getElementById("heroImg");
    img.src          = `http://127.0.0.1:8000/${data.logo}`;
    img.style.display = "block";
    img.onerror       = () => { img.style.display = "none"; };
  }
}

/* =========================
   STATS
=========================*/
function renderStats(data) {
  const topics      = data.topics || [];
  const totalVideos = topics.reduce((s, t) => s + (t.videos?.length || 0), 0);
  const totalQuiz   = topics.reduce((s, t) => s + (t.quizzes?.length || 0), 0);
  const totalAssign = topics.reduce((s, t) => s + (t.assignments?.length || 0), 0);

  document.getElementById("statTopics").textContent      = topics.length;
  document.getElementById("statVideos").textContent      = totalVideos;
  document.getElementById("statQuizzes").textContent     = totalQuiz;
  document.getElementById("statAssignments").textContent = totalAssign;
}

/* =========================
   TOPICS TAB — accordion
=========================*/
function renderTopicsTab(topics) {
  const panel = document.getElementById("topicsPanel");

  if (!topics || topics.length === 0) {
    panel.innerHTML = `<div class="empty-row">No topics added yet.</div>`;
    return;
  }

  panel.innerHTML = `
    <div class="panel-top">
      <h3>Course Topics</h3>
      <span style="font-size:13px;color:var(--muted);">${topics.length} topics</span>
    </div>
  `;

  topics.forEach((topic, i) => {
    const item = document.createElement("div");
    item.className = "topic-item";
    item.id        = `topic-item-${topic.id}`;

    const videoCount  = topic.videos?.length || 0;
    const quizCount   = topic.quizzes?.length || 0;
    const assignCount = topic.assignments?.length || 0;

    // Videos HTML
    let videosHtml = "";
    if (videoCount > 0) {
      videosHtml = `
        <div class="topic-section-label">🎬 Videos</div>
        <div class="video-list">
          ${topic.videos.map((v, vi) => `
            <div class="video-item" onclick="playVideo('${getYoutubeEmbed(v.video_url)}', 'Video ${vi + 1}')">
              <div class="video-play-btn">▶</div>
              <div class="video-info">
                <div class="video-title">Video ${vi + 1}</div>
                <div class="video-duration">${v.duration ? v.duration + " min" : "Watch now"}</div>
              </div>
              <span style="font-size:12px;color:var(--muted);">▶ Play</span>
            </div>
          `).join("")}
        </div>`;
    }

    // Quizzes HTML
    let quizzesHtml = "";
    if (quizCount > 0) {
      quizzesHtml = `
        <div class="topic-section-label">🧠 Quizzes</div>
        <div class="resource-list">
          ${topic.quizzes.map(q => `
            <div class="resource-item">
              <div class="resource-title">${q.title}</div>
              <button class="btn-start" onclick="startQuiz(${q.id})">Start Quiz</button>
            </div>
          `).join("")}
        </div>`;
    }

    // Assignments HTML
    let assignsHtml = "";
    if (assignCount > 0) {
      assignsHtml = `
        <div class="topic-section-label">📝 Assignments</div>
        <div class="resource-list">
          ${topic.assignments.map(a => `
            <div class="resource-item">
              <div>
                <div class="resource-title">${a.title}</div>
                <div class="resource-meta">Total marks: ${a.total_marks}</div>
              </div>
              <button class="btn-start" onclick="startAssignment(${a.id})">Submit</button>
            </div>
          `).join("")}
        </div>`;
    }

    const bodyContent = (videosHtml || quizzesHtml || assignsHtml)
      ? videosHtml + quizzesHtml + assignsHtml
      : `<div style="padding:16px 0;font-size:13.5px;color:var(--muted);">No content added yet.</div>`;

    item.innerHTML = `
      <div class="topic-header" onclick="toggleTopic(${topic.id})">
        <div class="topic-order">${topic.order_number || i + 1}</div>
        <div class="topic-title">${topic.title}</div>
        <div class="topic-meta">
          <span>🎬 ${videoCount}</span>
          <span>🧠 ${quizCount}</span>
          <span>📝 ${assignCount}</span>
        </div>
        <span class="topic-chevron">›</span>
      </div>
      <div class="topic-body">${bodyContent}</div>
    `;

    panel.appendChild(item);
  });
}

/* =========================
   QUIZZES TAB — flat table
=========================*/
function renderQuizzesTab(topics) {
  const panel  = document.getElementById("quizzesPanel");
  const quizzes = [];

  topics?.forEach(t => {
    t.quizzes?.forEach(q => quizzes.push({ ...q, topicTitle: t.title }));
  });

  if (quizzes.length === 0) {
    panel.innerHTML = `<div class="empty-row">No quizzes available.</div>`;
    return;
  }

  panel.innerHTML = `
    <div class="panel-top">
      <h3>All Quizzes</h3>
      <span style="font-size:13px;color:var(--muted);">${quizzes.length} quizzes</span>
    </div>
    <table class="detail-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Quiz Title</th>
          <th>Topic</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${quizzes.map((q, i) => `
          <tr>
            <td class="num-cell">${i + 1}</td>
            <td class="name-cell">${q.title}</td>
            <td class="topic-cell">${q.topicTitle}</td>
            <td class="action-cell">
              <button class="btn-attempt" onclick="startQuiz(${q.id})">Start Quiz</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

/* =========================
   ASSIGNMENTS TAB — flat table
=========================*/
function renderAssignmentsTab(topics) {
  const panel       = document.getElementById("assignmentsPanel");
  const assignments = [];

  topics?.forEach(t => {
    t.assignments?.forEach(a => assignments.push({ ...a, topicTitle: t.title }));
  });

  if (assignments.length === 0) {
    panel.innerHTML = `<div class="empty-row">No assignments available.</div>`;
    return;
  }

  panel.innerHTML = `
    <div class="panel-top">
      <h3>All Assignments</h3>
      <span style="font-size:13px;color:var(--muted);">${assignments.length} assignments</span>
    </div>
    <table class="detail-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Assignment</th>
          <th>Topic</th>
          <th>Marks</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${assignments.map((a, i) => `
          <tr>
            <td class="num-cell">${i + 1}</td>
            <td class="name-cell">${a.title}</td>
            <td class="topic-cell">${a.topicTitle}</td>
            <td class="marks-cell">${a.total_marks}</td>
            <td class="action-cell">
              <button class="btn-attempt" onclick="startAssignment(${a.id})">Submit</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

/* =========================
   TOPIC ACCORDION TOGGLE
=========================*/
function toggleTopic(topicId) {
  const item = document.getElementById(`topic-item-${topicId}`);
  if (item) item.classList.toggle("open");
}

/* =========================
   VIDEO PLAYER
=========================*/
function getYoutubeEmbed(url) {
  if (!url) return "";
  // Handle youtube.com/watch?v=ID
  // Handle youtu.be/ID
  // Handle youtube.com/shorts/ID
  const match = url.match(/(?:v=|youtu\.be\/|shorts\/)([^&\s/?]+)/);
  return match
    ? `https://www.youtube-nocookie.com/embed/${match[1]}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3`
    : url;
}

function playVideo(embedUrl, title) {
  const modal = document.getElementById("videoModal");
  const frame = document.getElementById("videoFrame");
  const mTitle = document.getElementById("modalTitle");
  mTitle.textContent = title;
  frame.src = embedUrl;
  modal.classList.add("open");
}

function closeVideoModal() {
  const modal = document.getElementById("videoModal");
  const frame = document.getElementById("videoFrame");
  frame.src = "";
  modal.classList.remove("open");
}

/* =========================
   QUIZ / ASSIGNMENT NAVIGATION
=========================*/
function startQuiz(quizId) {
  window.location.href = `student-quiz-attempt.html?id=${quizId}&course=${courseId}`;
}

function startAssignment(assignmentId) {
  window.location.href = `student-assignment-submit.html?id=${assignmentId}&course=${courseId}`;
}

/* =========================
   TABS
=========================*/
function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
  });
}