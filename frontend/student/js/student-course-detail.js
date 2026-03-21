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
        <div class="topic-section-label">Videos</div>
        <div class="video-list">
          ${topic.videos.map((v, vi) => `
            <div class="video-item" id="vid-${v.id}" onclick="playVideo('${getYoutubeEmbed(v.video_url)}', 'Video ${vi + 1}', ${v.id}, ${topic.id})">
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
        <div class="topic-section-label"> Quizzes</div>
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
        <div class="topic-section-label"> Assignments</div>
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
          <span>video -> ${videoCount}</span>
          <span>Quiz -> ${quizCount}</span>
          <span>Assignment -> ${assignCount}</span>
        </div>
        <span class="topic-chevron"></span>
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

let _currentVideoId  = null;
let _currentTopicId  = null;
let _progressInterval= null;
let _watchSeconds    = 0;

async function playVideo(url, title, videoId, topicId) {
  _currentVideoId = videoId;
  _currentTopicId = topicId;

  const modal  = document.getElementById("videoModal");
  const frame  = document.getElementById("videoFrame");
  const mTitle = document.getElementById("modalTitle");
  mTitle.textContent = title;
  
  // ── Handling YouTube vs Local Files ──
  const isLocal = url.startsWith('uploads/');
  let finalUrl = isLocal ? `http://127.0.0.1:8000/${url}` : url;

  let videoElement = null;

  if (isLocal) {
    // Create a native video tag for local files
    frame.outerHTML = `<video id="videoFrame" controls style="width:100%; height:450px; border-radius:8px; background:black;">
                        <source src="${finalUrl}" type="video/mp4">
                        Your browser does not support the video tag.
                      </video>`;
    videoElement = document.getElementById("videoFrame");
  } else {
    // YouTube Transform: convert watch?v=... to embed/...
    if (finalUrl.includes('youtube.com/watch?v=')) {
        finalUrl = finalUrl.replace('watch?v=', 'embed/');
    } else if (finalUrl.includes('youtu.be/')) {
        finalUrl = finalUrl.replace('youtu.be/', 'youtube.com/embed/');
    }
    
    // Add autoplay and API parameters
    const separator = finalUrl.includes('?') ? '&' : '?';
    finalUrl += `${separator}autoplay=1&enablejsapi=1`;

    frame.outerHTML = `<iframe id="videoFrame" src="${finalUrl}" frameborder="0" 
                        allow="autoplay; encrypted-media" allowfullscreen 
                        style="width:100%; height:450px; border-radius:8px;"></iframe>`;
  }

  modal.classList.add("open");

  // ── Tracking Variables ──
  let skipCount = 0;
  let playbackSpeed = 1.0;
  let lastTime = 0;

  // If local video, we can track precisely
  if (videoElement) {
    videoElement.addEventListener('seeking', () => skipCount++);
    videoElement.addEventListener('ratechange', () => playbackSpeed = videoElement.playbackRate);
    
    // Auto-save progress every 10 seconds for local videos
    _progressInterval = setInterval(() => {
      const pct = Math.floor((videoElement.currentTime / videoElement.duration) * 100);
      saveVideoProgress(videoId, topicId, pct, videoElement.currentTime, skipCount, playbackSpeed);
      updateProgressBar(videoId, pct);
    }, 10000);
  } else {
    // For YouTube (limited tracking via basic timer)
    _watchSeconds = 0;
    clearInterval(_progressInterval);
    _progressInterval = setInterval(() => {
      _watchSeconds += 10;
      const pct = Math.min(99, Math.floor((_watchSeconds / 600) * 100)); // assumes 10min
      saveVideoProgress(videoId, topicId, pct, _watchSeconds, 0, 1.0);
      updateProgressBar(videoId, pct);
    }, 10000);
  }
}

async function saveVideoProgress(videoId, topicId, pct, watchTime, skips, speed) {
  try {
    await fetch(`${API}/student/videos/${videoId}/progress`, {
      method:  "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({
        watch_time:       Math.floor(watchTime),
        watch_percentage: pct,
        skip_count:       skips,
        playback_speed:   speed
      })
    });
  } catch (_) {}
}

function closeVideoModal() {
  clearInterval(_progressInterval);
  _progressInterval = null;

  // Mark as 100% if watched for > 80% of average duration
  if (_currentVideoId && _currentTopicId && _watchSeconds >= 480) {
    saveVideoProgress(_currentVideoId, _currentTopicId, 100);
    updateProgressBar(_currentVideoId, 100);
  }

  const modal = document.getElementById("videoModal");
  const frame = document.getElementById("videoFrame");
  frame.src = "";
  modal.classList.remove("open");
  _currentVideoId = null;
  _currentTopicId = null;
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