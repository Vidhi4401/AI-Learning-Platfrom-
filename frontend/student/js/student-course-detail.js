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
   HELPERS
=========================*/
function getFileUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `http://127.0.0.1:8000/${path}`;
}

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
    const t = document.getElementById("heroTitle");
    if (t) t.textContent = "Failed to load course.";
  }
}

/* =========================
   HERO
   FIX: was using .hero-content which doesn't exist — use .hero-info
=========================*/
function renderHero(data) {
  document.title = data.title;

  const badges = document.getElementById("heroBadges");
  if (badges) {
    badges.innerHTML = `
      <span class="hero-badge enrolled">✓ Enrolled</span>
      <span class="hero-badge difficulty">${data.difficulty || "General"}</span>
    `;
  }

  const heroTitle = document.getElementById("heroTitle");
  const heroDesc  = document.getElementById("heroDesc");
  if (heroTitle) heroTitle.textContent = data.title;
  if (heroDesc)  heroDesc.textContent  = data.description || "";

  // Logo
  if (data.logo) {
    const img = document.getElementById("heroImg");
    if (img) {
      img.src           = getFileUrl(data.logo);
      img.style.display = "block";
      img.onerror       = () => { img.style.display = "none"; };
    }
  }

  // Certificate button — appended to .hero-info (correct class in HTML)
  const heroInfo = document.querySelector(".hero-info");
  if (heroInfo) {
    const certContainer = document.createElement("div");
    certContainer.style.marginTop = "20px";

    if (data.cert_issued) {
      certContainer.innerHTML = `
        <button class="btn-enroll enrolled"
          style="background:#16a34a;cursor:pointer;"
          onclick="window.location.href='student-courses.html'">
          🏆 Certificate Issued
        </button>`;
    } else if (data.cert_status === "pending") {
      certContainer.innerHTML = `
        <p style="color:#eab308;font-weight:600;font-size:14px;">
          ⏳ Certificate request pending — Admin will verify and issue it.
        </p>`;
    } else {
      certContainer.innerHTML = `
        <button class="btn-enroll not-enrolled" onclick="claimCertificate()">
          🎓 Claim Certificate
        </button>`;
    }

    heroInfo.appendChild(certContainer);
  }
}

async function claimCertificate() {
  if (!confirm("Request certificate for this course?")) return;
  try {
    const res = await fetch(`${API}/student/courses/${courseId}/request-certificate`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token }
    });
    const d = await res.json();
    if (res.ok) {
      alert(d.message);
      location.reload();
    } else {
      alert(d.detail || "Complete all videos first.");
    }
  } catch (err) {
    alert("Server error. Please try again.");
  }
}

/* =========================
   STATS
=========================*/
function renderStats(data) {
  const topics      = data.topics || [];
  const totalVideos = topics.reduce((s, t) => s + (t.videos?.length     || 0), 0);
  const totalQuiz   = topics.reduce((s, t) => s + (t.quizzes?.length    || 0), 0);
  const totalAssign = topics.reduce((s, t) => s + (t.assignments?.length || 0), 0);

  const safe = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  safe("statTopics",      topics.length);
  safe("statVideos",      totalVideos);
  safe("statQuizzes",     totalQuiz);
  safe("statAssignments", totalAssign);

  // Load materials count asynchronously
  loadMaterialsCount();
}

/* =========================
   TOPICS TAB — accordion
=========================*/
function renderTopicsTab(topics) {
  const panel = document.getElementById("topicsPanel");
  if (!panel) return;

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

    const videoCount  = topic.videos?.length     || 0;
    const quizCount   = topic.quizzes?.length    || 0;
    const assignCount = topic.assignments?.length || 0;

    // Videos HTML
    let videosHtml = "";
    if (videoCount > 0) {
      videosHtml = `
        <div class="topic-section-label">🎬 Videos</div>
        <div class="video-list">
          ${topic.videos.map((v, vi) => `
            <div class="video-item" id="vid-${v.id}"
              onclick="playVideo('${v.video_url}', 'Video ${vi + 1}', ${v.id}, ${topic.id})">
              <div class="video-play-btn">▶</div>
              <div class="video-info">
                <div class="video-title">Video ${vi + 1}</div>
                <div class="video-duration">${v.duration ? v.duration + " min" : "Watch now"}</div>
              </div>
              <div class="video-progress-bar-wrap">
                <div class="video-progress-bar" id="vpbar-${v.id}" style="width:0%"></div>
              </div>
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
        <div class="topic-section-label">📄 Assignments</div>
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
          <span>📹 ${videoCount}</span>
          <span>🧠 ${quizCount}</span>
          <span>📄 ${assignCount}</span>
        </div>
        <span class="topic-chevron"></span>
      </div>
      <div class="topic-body">${bodyContent}</div>
    `;

    panel.appendChild(item);
  });

  // Load video progress bars after render
  loadAllVideoProgress();
}

/* =========================
   QUIZZES TAB
=========================*/
function renderQuizzesTab(topics) {
  const panel   = document.getElementById("quizzesPanel");
  if (!panel) return;
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
          <th>#</th><th>Quiz Title</th><th>Topic</th><th></th>
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
   ASSIGNMENTS TAB
=========================*/
function renderAssignmentsTab(topics) {
  const panel       = document.getElementById("assignmentsPanel");
  if (!panel) return;
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
          <th>#</th><th>Assignment</th><th>Topic</th><th>Marks</th><th></th>
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
   VIDEO PROGRESS BARS
=========================*/
async function loadAllVideoProgress() {
  try {
    const res = await fetch(`${API}/student/video-progress-all`, {
      headers: { Authorization: "Bearer " + token }
    });
    if (!res.ok) return;
    const records = await res.json();
    records.forEach(r => {
      const bar = document.getElementById(`vpbar-${r.video_id}`);
      if (bar) bar.style.width = `${r.watch_percentage || 0}%`;
    });
  } catch (_) {}
}

function updateProgressBar(videoId, pct) {
  const bar = document.getElementById(`vpbar-${videoId}`);
  if (bar) bar.style.width = `${pct}%`;
}

/* =========================
   VIDEO PLAYER
   FIX: use wrapper div innerHTML instead of outerHTML
        so videoFrame element always exists for closeVideoModal
=========================*/
function getYoutubeEmbed(url) {
  if (!url) return "";
  const match = url.match(/(?:v=|youtu\.be\/|shorts\/)([^&\s/?]+)/);
  return match
    ? `https://www.youtube-nocookie.com/embed/${match[1]}?autoplay=1&rel=0&modestbranding=1`
    : url;
}

let _currentVideoId   = null;
let _currentTopicId   = null;
let _progressInterval = null;
let _watchSeconds     = 0;

async function playVideo(rawUrl, title, videoId, topicId) {
  _currentVideoId = videoId;
  _currentTopicId = topicId;
  _watchSeconds   = 0;
  clearInterval(_progressInterval);

  document.getElementById("modalTitle").textContent = title;

  const isLocal    = rawUrl.startsWith("uploads/");
  const isYoutube  = rawUrl.includes("youtube.com") || rawUrl.includes("youtu.be");
  const isUploaded = isLocal || (!isYoutube && rawUrl.startsWith("http"));

  let finalUrl = isLocal ? `http://127.0.0.1:8000/${rawUrl}` : rawUrl;

  // FIX: use wrapper innerHTML — never touch outerHTML
  const wrap = document.getElementById("videoWrap");

  if (isUploaded) {
    wrap.innerHTML = `
      <video id="videoFrame" controls
        style="width:100%;height:450px;border-radius:8px;background:#000;">
        <source src="${finalUrl}" type="video/mp4">
        Your browser does not support the video tag.
      </video>`;

    const vid = document.getElementById("videoFrame");
    let skipCount = 0;
    vid.addEventListener("seeking",    () => skipCount++);
    vid.addEventListener("ratechange", () => {});

    _progressInterval = setInterval(() => {
      if (!vid.duration) return;
      const pct = Math.floor((vid.currentTime / vid.duration) * 100);
      saveVideoProgress(videoId, topicId, pct, vid.currentTime, skipCount, vid.playbackRate);
      updateProgressBar(videoId, pct);
    }, 10000);

  } else {
    // YouTube
    if (finalUrl.includes("youtube.com/watch?v=")) {
      finalUrl = finalUrl.replace("watch?v=", "embed/");
    } else if (finalUrl.includes("youtu.be/")) {
      finalUrl = finalUrl.replace("youtu.be/", "youtube.com/embed/");
    }
    const sep = finalUrl.includes("?") ? "&" : "?";
    finalUrl += `${sep}autoplay=1&enablejsapi=1`;

    wrap.innerHTML = `
      <iframe id="videoFrame" src="${finalUrl}" frameborder="0"
        allow="autoplay; encrypted-media" allowfullscreen
        style="width:100%;height:450px;border-radius:8px;"></iframe>`;

    _progressInterval = setInterval(() => {
      _watchSeconds += 10;
      const pct = Math.min(99, Math.floor((_watchSeconds / 600) * 100));
      saveVideoProgress(videoId, topicId, pct, _watchSeconds, 0, 1.0);
      updateProgressBar(videoId, pct);
    }, 10000);
  }

  document.getElementById("videoModal").classList.add("open");
}

async function saveVideoProgress(videoId, topicId, pct, watchTime, skips, speed) {
  try {
    await fetch(`${API}/student/videos/${videoId}/progress`, {
      method:  "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({
        watch_time:       Math.floor(watchTime || 0),
        watch_percentage: pct || 0,
        skip_count:       skips || 0,
        playback_speed:   speed || 1.0
      })
    });
  } catch (_) {}
}

function closeVideoModal() {
  clearInterval(_progressInterval);
  _progressInterval = null;

  // If YouTube and watched ≥ 8 min → mark as complete
  if (_currentVideoId && _watchSeconds >= 480) {
    saveVideoProgress(_currentVideoId, _currentTopicId, 100, _watchSeconds, 0, 1.0);
    updateProgressBar(_currentVideoId, 100);
  }

  // FIX: clear wrapper content — no direct frame.src manipulation
  const wrap = document.getElementById("videoWrap");
  if (wrap) wrap.innerHTML = "";

  document.getElementById("videoModal").classList.remove("open");
  _currentVideoId = null;
  _currentTopicId = null;
  _watchSeconds   = 0;
}

/* =========================
   NAVIGATION
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
      if (btn.dataset.tab === "materials") loadMaterialsTab();
    });
  });
}

/* =========================
   MATERIALS
=========================*/
async function loadMaterialsCount() {
  try {
    const res  = await fetch(`${API}/materials/course/${courseId}`,
                             { headers: { Authorization: "Bearer " + token } });
    if (!res.ok) return;
    const mats = await res.json();
    const el   = document.getElementById("statMaterials");
    if (el) el.textContent = mats.length;
  } catch(e) { /* silent */ }
}

async function loadMaterialsTab() {
  const panel = document.getElementById("materialsPanel");
  if (!panel) return;
  panel.innerHTML = `<div class="loading-row">Loading materials…</div>`;
  try {
    const res  = await fetch(`${API}/materials/course/${courseId}`,
                             { headers: { Authorization: "Bearer " + token } });
    if (!res.ok) throw new Error();
    const mats = await res.json();

    if (!mats.length) {
      panel.innerHTML = `<div class="empty-row">No materials uploaded yet for this course.</div>`;
      return;
    }

    function fileIcon(url) {
      const l = (url || "").toLowerCase();
      if (l.includes(".pdf"))  return "📕";
      if (l.includes(".doc"))  return "📝";
      if (l.includes(".ppt"))  return "📊";
      if (l.includes(".xls"))  return "📈";
      return "📄";
    }

    panel.innerHTML = mats.map(m => `
      <div style="display:flex; align-items:center; justify-content:space-between;
                  padding:14px 18px; border:1px solid var(--border);
                  border-radius:10px; margin-bottom:10px; background:#fafafa;">
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:26px;">${fileIcon(m.file_url)}</span>
          <span style="font-weight:600; color:var(--ink); font-size:14px;">${m.title}</span>
        </div>
        <a href="${m.file_url}" target="_blank"
           style="background:var(--accent);color:#fff;padding:8px 18px;border-radius:8px;
                  font-size:13px;font-weight:600;text-decoration:none;">
          ⬇ Open
        </a>
      </div>
    `).join("");
  } catch(e) {
    panel.innerHTML = `<div class="empty-row">Failed to load materials.</div>`;
  }
}