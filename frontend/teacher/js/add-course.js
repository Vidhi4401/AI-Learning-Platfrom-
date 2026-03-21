const API = "http://127.0.0.1:8000/api/v1";

/* =========================
   INIT
=========================*/
document.addEventListener("DOMContentLoaded", () => {
  loadCourses();
  setupStepper();
});

/* =========================
   TOAST
=========================*/
function showToast(msg, type = "success") {
  const toast = document.getElementById("toast");
  const icon = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ";
  toast.textContent = `${icon}  ${msg}`;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove("show"), 3200);
}

/* =========================
   CONFIRM DIALOG
=========================*/
let _confirmCallback = null;

function openConfirm(msg, callback) {
  document.getElementById("confirmMsg").textContent = msg;
  _confirmCallback = callback;
  document.getElementById("confirmOverlay").classList.add("show");
}

function closeConfirm() {
  document.getElementById("confirmOverlay").classList.remove("show");
  _confirmCallback = null;
}

document.getElementById("confirmBtn").addEventListener("click", () => {
  if (_confirmCallback) _confirmCallback();
  closeConfirm();
});

document.getElementById("confirmOverlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeConfirm();
});

/* =========================
   STEP NAVIGATION
=========================*/
function setupStepper() {
  document.querySelectorAll(".step").forEach(step => {
    step.addEventListener("click", () => {
      document.querySelectorAll(".step").forEach(s => s.classList.remove("active"));
      document.querySelectorAll(".step-content").forEach(c => c.classList.remove("active"));
      step.classList.add("active");
      document.getElementById("step-" + step.dataset.step).classList.add("active");
    });
  });
}

/* =========================
   LOAD COURSES
=========================*/
async function loadCourses() {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API}/teacher/courses`, {
    headers: { Authorization: "Bearer " + token }
  });

  const courses = await res.json();

  const selects = [
    "pdfCourseSelect",
    "videoCourseSelect",
    "reviewCourseSelect"
  ];

  selects.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = "<option value=''>— Select a course —</option>";
    courses.forEach(course => {
      const option = document.createElement("option");
      option.value = course.id;
      option.textContent = course.title;
      select.appendChild(option);
    });
  });
}

/* =========================
   CREATE COURSE
=========================*/
async function createCourse() {
  const token = localStorage.getItem("token");

  const formData = new FormData();
  formData.append("title", courseTitle.value);
  formData.append("description", courseDesc.value);
  formData.append("difficulty", difficulty.value);
  formData.append("status", true);

  if (thumbnail.files.length > 0)
    formData.append("logo", thumbnail.files[0]);

  const res = await fetch(`${API}/teacher/courses`, {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: formData
  });

  if (res.ok) {
    const data = await res.json();
    showToast("Course created! Move to next step to add content.");
    await loadCourses();
    
    // Auto select the new course in Step 2
    document.getElementById("pdfCourseSelect").value = data.course_id;
    
    // Move to Step 2
    setTimeout(() => {
      document.querySelector('[data-step="2"]').click();
    }, 1000);
  } else {
    showToast("Failed to create course", "error");
  }
}

/* =========================
   PDF GENERATION
=========================*/
// Handle file selection UI
document.getElementById('coursePdf').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    document.getElementById('pdfPlaceholder').style.display = 'none';
    document.getElementById('pdfSelected').style.display = 'block';
    document.getElementById('pdfFileName').textContent = file.name;
  }
});

async function generateFromPdf() {
  const token = localStorage.getItem("token");
  const courseId = document.getElementById("pdfCourseSelect").value;
  const pdfFile = document.getElementById("coursePdf").files[0];

  if (!courseId || !pdfFile) {
    showToast("Please select a course and upload a PDF", "error");
    return;
  }

  // UI state: processing
  document.getElementById("processBtnRow").style.display = 'none';
  document.getElementById("processingStatus").style.display = 'block';

  const formData = new FormData();
  formData.append("file", pdfFile);

  try {
    const res = await fetch(`${API}/teacher/courses/${courseId}/process-pdf`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: formData
    });

    const result = await res.json();

    if (res.ok) {
      showToast(result.message);
      // Move to Step 3
      setTimeout(() => {
        document.querySelector('[data-step="3"]').click();
        // Pre-select course in next steps
        document.getElementById("videoCourseSelect").value = courseId;
        loadTopicsForVideo();
      }, 1500);
    } else {
      showToast(result.detail || "PDF processing failed", "error");
    }
  } catch (err) {
    console.error(err);
    showToast("Server error during PDF processing", "error");
  } finally {
    document.getElementById("processBtnRow").style.display = 'flex';
    document.getElementById("processingStatus").style.display = 'none';
  }
}

/* =========================
   COURSE PREVIEW (Step 4)
=========================*/
async function loadFullCoursePreview() {
  const token = localStorage.getItem("token");
  const courseId = document.getElementById("reviewCourseSelect").value;
  if (!courseId) return;

  const previewEl = document.getElementById("coursePreview");
  previewEl.innerHTML = '<div class="spinner" style="margin: 20px auto;"></div>';

  try {
    // We use the course detail endpoint (might need to check if it's available for teacher)
    // For now, let's just fetch topics and their associations
    const res = await fetch(`${API}/teacher/courses/${courseId}/topics`, {
      headers: { Authorization: "Bearer " + token }
    });
    const topics = await res.json();

    if (topics.length === 0) {
      previewEl.innerHTML = '<div class="empty-list">No content generated yet.</div>';
      return;
    }

    let html = "";
    for (const t of topics) {
      html += `
        <div class="preview-topic-card">
          <div class="preview-topic-header">
            <strong>Topic:</strong> ${t.title}
          </div>
          <div class="preview-topic-content">
            <div class="preview-item"><span>📝</span> Assignment & Quiz generated</div>
          </div>
        </div>
      `;
    }
    previewEl.innerHTML = html;
  } catch (err) {
    previewEl.innerHTML = '<div class="empty-list" style="color:red;">Error loading preview</div>';
  }
}

/* =========================
   ADD TOPIC
=========================*/
async function addTopic() {
  const token = localStorage.getItem("token");
  const courseId = topicCourseSelect.value;

  if (!courseId) { showToast("Please select a course", "error"); return; }

  // ── Get existing topics count to calculate next order number ──
  const existingRes = await fetch(`${API}/teacher/courses/${courseId}/topics`, {
    headers: { Authorization: "Bearer " + token }
  });
  const existingTopics = await existingRes.json();
  const nextOrder = Array.isArray(existingTopics) ? existingTopics.length + 1 : 1;

  await fetch(`${API}/teacher/courses/${courseId}/topics`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({
      title: topicTitle.value,
      order_number: nextOrder   // ← auto calculated
    })
  });

  showToast("Topic added!");
  topicTitle.value = "";
  loadTopicsList();
}
/* =========================
   LOAD TOPICS LIST (with delete)
=========================*/
async function loadTopicsList() {
  const token = localStorage.getItem("token");
  const courseId = document.getElementById("topicCourseSelect").value;
  if (!courseId) return;

  const listEl = document.getElementById("topicsList");
  listEl.innerHTML = `<div class="loading-items">Loading topics…</div>`;

  const res = await fetch(`${API}/teacher/courses/${courseId}/topics`, {
    headers: { Authorization: "Bearer " + token }
  });
  const topics = await res.json();

  renderItemsList(listEl, topics, (topic) => ({
    title: topic.title,
    meta: `Topic ID: ${topic.id}`
  }), (topic) => {
    openConfirm(`Delete topic "${topic.title}"? This will also remove associated content.`, async () => {
      const token = localStorage.getItem("token");
      await fetch(`${API}/teacher/topics/${topic.id}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token }
      });
      showToast("Topic deleted");
      loadTopicsList();
    });
  });
}

/* =========================
   LOAD TOPICS FOR VIDEO
=========================*/
async function loadTopicsForVideo() {
  const token = localStorage.getItem("token");
  const courseId = document.getElementById("videoCourseSelect").value;

  const res = await fetch(`${API}/teacher/courses/${courseId}/topics`, {
    headers: { Authorization: "Bearer " + token }
  });
  const topics = await res.json();

  const topicSelect = document.getElementById("videoTopicSelect");
  topicSelect.innerHTML = "<option value=''>— Select a topic —</option>";

  if (topics.length === 0) {
    topicSelect.innerHTML = "<option>No topics available</option>";
    return;
  }

  topics.forEach(topic => {
    const option = document.createElement("option");
    option.value = topic.id;
    option.textContent = topic.title;
    topicSelect.appendChild(option);
  });

  document.getElementById("videosList").innerHTML = `<div class="empty-list">Select a topic to view videos</div>`;
}

/* =========================
   LOAD VIDEOS LIST (with delete)
=========================*/
async function loadVideosList() {
  const token = localStorage.getItem("token");
  const topicId = document.getElementById("videoTopicSelect").value;
  if (!topicId) return;

  const listEl = document.getElementById("videosList");
  listEl.innerHTML = `<div class="loading-items">Loading videos…</div>`;

  const res = await fetch(`${API}/topics/${topicId}/videos`, {
    headers: { Authorization: "Bearer " + token }
  });
  const videos = await res.json();

  renderItemsList(listEl, videos, (v) => ({
    title: v.video_url || `Video #${v.id}`,
    meta: `Duration: ${v.duration || "—"} mins`
  }), (v) => {
    openConfirm(`Delete this video?`, async () => {
      const token = localStorage.getItem("token");
      await fetch(`${API}/teacher/videos/${v.id}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token }
      });
      showToast("Video deleted");
      loadVideosList();
    });
  });
}

/* =========================
   LOAD TOPICS FOR ASSIGNMENT
=========================*/
async function loadTopicsForAssignment() {
  const token = localStorage.getItem("token");
  const courseId = assignmentCourseSelect.value;

  const res = await fetch(`${API}/teacher/courses/${courseId}/topics`, {
    headers: { Authorization: "Bearer " + token }
  });
  const topics = await res.json();

  const select = document.getElementById("assignmentTopicSelect");
  select.innerHTML = "<option value=''>— Select a topic —</option>";
  topics.forEach(topic => {
    const option = document.createElement("option");
    option.value = topic.id;
    option.textContent = topic.title;
    select.appendChild(option);
  });

  document.getElementById("assignmentsList").innerHTML = `<div class="empty-list">Select a topic to view assignments</div>`;
}

/* =========================
   LOAD ASSIGNMENTS LIST (with delete)
=========================*/
async function loadAssignmentsList() {
  const token = localStorage.getItem("token");
  const topicId = document.getElementById("assignmentTopicSelect").value;
  if (!topicId) return;

  const listEl = document.getElementById("assignmentsList");
  listEl.innerHTML = `<div class="loading-items">Loading assignments…</div>`;

  const res = await fetch(`${API}/teacher/topics/${topicId}/assignments`, {
    headers: { Authorization: "Bearer " + token }
  });
  const assignments = await res.json();

  renderItemsList(listEl, assignments, (a) => ({
    title: a.title,
    meta: `Total Marks: ${a.total_marks || "—"}`
  }), (a) => {
    openConfirm(`Delete assignment "${a.title}"?`, async () => {
      const token = localStorage.getItem("token");
      await fetch(`${API}/teacher/assignments/${a.id}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token }
      });
      showToast("Assignment deleted");
      loadAssignmentsList();
    });
  });
}

/* =========================
   LOAD TOPICS FOR QUIZ
=========================*/
async function loadTopicsForQuiz() {
  const token = localStorage.getItem("token");
  const courseId = quizCourseSelect.value;

  const res = await fetch(`${API}/teacher/courses/${courseId}/topics`, {
    headers: { Authorization: "Bearer " + token }
  });
  const topics = await res.json();

  const select = document.getElementById("quizTopicSelect");
  select.innerHTML = "<option value=''>— Select a topic —</option>";
  topics.forEach(topic => {
    const option = document.createElement("option");
    option.value = topic.id;
    option.textContent = topic.title;
    select.appendChild(option);
  });

  document.getElementById("quizzesList").innerHTML = `<div class="empty-list">Select a topic to view quizzes</div>`;
}

/* =========================
   LOAD QUIZZES LIST (with delete)
=========================*/
async function loadQuizzesList() {
  const token = localStorage.getItem("token");
  const topicId = document.getElementById("quizTopicSelect").value;
  if (!topicId) return;

  const listEl = document.getElementById("quizzesList");
  listEl.innerHTML = `<div class="loading-items">Loading quizzes…</div>`;

  const res = await fetch(`${API}/topics/${topicId}/quizzes`, {
    headers: { Authorization: "Bearer " + token }
  });
  const quizzes = await res.json();

  renderItemsList(listEl, quizzes, (q) => ({
    title: q.title,
    meta: `Quiz ID: ${q.id}`
  }), (q) => {
    openConfirm(`Delete quiz "${q.title}"? All questions will be removed.`, async () => {
      const token = localStorage.getItem("token");
      await fetch(`${API}/teacher/quizzes/${q.id}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token }
      });
      showToast("Quiz deleted");
      loadQuizzesList();
    });
  });
}

/* =========================
   LOAD TOPICS FOR QUESTIONS
=========================*/
async function loadTopicsForQuestion() {
  const token = localStorage.getItem("token");
  const courseId = questionCourseSelect.value;

  if (!courseId) return;
  const res = await fetch(`${API}/teacher/courses/${courseId}/topics`, {
    headers: { Authorization: "Bearer " + token }
  });
  const topics = await res.json();

  const select = document.getElementById("questionTopicSelect");
  select.innerHTML = "<option value=''>— Select a topic —</option>";
  topics.forEach(topic => {
    const option = document.createElement("option");
    option.value = topic.id;
    option.textContent = topic.title;
    select.appendChild(option);
  });
}

/* =========================
   LOAD QUIZZES FOR QUESTIONS
=========================*/
async function loadQuizzesForQuestion() {
  const token = localStorage.getItem("token");
  const topicId = questionTopicSelect.value;
  const res = await fetch(`${API}/topics/${topicId}/quizzes`, {
    headers: { Authorization: "Bearer " + token }
  });
  const quizzes = await res.json();

  const select = document.getElementById("questionQuizSelect");
  select.innerHTML = "<option value=''>— Select a quiz —</option>";
  quizzes.forEach(quiz => {
    const option = document.createElement("option");
    option.value = quiz.id;
    option.textContent = quiz.title;
    select.appendChild(option);
  });
}

/* =========================
   ADD QUIZ QUESTION
=========================*/
async function addQuizQuestion() {
  const token = localStorage.getItem("token");
  const quizId = questionQuizSelect.value;

  if (!quizId) { showToast("Please select a quiz", "error"); return; }

  await fetch(`${API}/teacher/quizzes/${quizId}/questions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({
      question_text: questionText.value,
      option_a: optionA.value,
      option_b: optionB.value,
      option_c: optionC.value,
      option_d: optionD.value,
      correct_option: correctOption.value
    })
  });

  showToast("Question added successfully!");
  [questionText, optionA, optionB, optionC, optionD, correctOption].forEach(el => el.value = "");
}

/* =========================
   ADD VIDEO
=========================*/
function toggleVideoInput(source) {
  document.getElementById('videoUrlContainer').style.display = source === 'url' ? 'block' : 'none';
  document.getElementById('videoFileContainer').style.display = source === 'file' ? 'block' : 'none';
}

// Auto-detect duration when file is chosen
document.getElementById('videoFile').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = function() {
      window.URL.revokeObjectURL(video.src);
      // Convert seconds to minutes
      const mins = Math.ceil(video.duration / 60); // Use ceil to ensure at least 1 min
      document.getElementById('videoDuration').value = mins || 1;
    }
    video.src = URL.createObjectURL(file);
  }
});

// Auto-detect duration when YouTube URL is pasted
document.getElementById('videoUrl').addEventListener('blur', async function() {
  const url = this.value.trim();
  if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) return;

  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`${API}/teacher/get-video-duration?url=${encodeURIComponent(url)}`, {
      headers: { Authorization: "Bearer " + token }
    });
    if (res.ok) {
      const data = await res.json();
      document.getElementById('videoDuration').value = data.duration;
      showToast(`Detected duration: ${data.duration} mins`);
    }
  } catch (err) {
    console.error("Duration fetch failed", err);
  }
});

async function addVideo() {
  const token = localStorage.getItem("token");
  const topicId = document.getElementById("videoTopicSelect").value;
  const source = document.querySelector('input[name="videoSource"]:checked').value;
  const duration = document.getElementById("videoDuration").value || 10;

  if (!topicId) {
    showToast("Please select a topic", "error");
    return;
  }

  const formData = new FormData();
  formData.append("duration", duration);

  if (source === 'url') {
    const videoUrlValue = document.getElementById("videoUrl").value;
    if (!videoUrlValue) {
      showToast("Please enter a video URL", "error");
      return;
    }
    formData.append("video_url", videoUrlValue);
  } else {
    const videoFile = document.getElementById("videoFile").files[0];
    if (!videoFile) {
      showToast("Please select a video file", "error");
      return;
    }
    formData.append("video_file", videoFile);
  }

  const res = await fetch(`${API}/teacher/topics/${topicId}/videos`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token
    },
    body: formData
  });

  if (!res.ok) {
    const error = await res.json();
    showToast(error.detail || "Upload failed", "error");
    return;
  }

  showToast("Video added successfully!");
  // Reset inputs
  document.getElementById("videoUrl").value = "";
  document.getElementById("videoFile").value = "";
  loadVideosList();
}

/* =========================
   ADD ASSIGNMENT
=========================*/
async function addAssignment() {
  const token = localStorage.getItem("token");
  const topicId = document.getElementById("assignmentTopicSelect").value;

  if (!topicId) { showToast("Please select a topic", "error"); return; }

  const res = await fetch(`${API}/teacher/topics/${topicId}/assignments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({
      title: document.getElementById("assignmentTitle").value,
      description: document.getElementById("assignmentDesc").value,
      total_marks: document.getElementById("assignmentMarks").value,
      model_answer: document.getElementById("assignmentAnswer").value
    })
  });

  if (!res.ok) {
    const error = await res.json();
    showToast(error.detail, "error");
    return;
  }

  showToast("Assignment added successfully!");
  loadAssignmentsList();
}

/* =========================
   ADD QUIZ
=========================*/
async function addQuiz() {
  const token = localStorage.getItem("token");
  const topicId = document.getElementById("quizTopicSelect").value;
  const quizTitle = document.getElementById("quizTitle").value;

  if (!topicId || !quizTitle) {
    showToast("Please select topic and enter quiz title", "error");
    return;
  }

  const res = await fetch(`${API}/teacher/topics/${topicId}/quizzes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ title: quizTitle })
  });

  if (!res.ok) {
    const error = await res.json();
    showToast(error.detail, "error");
    return;
  }

  showToast("Quiz created! Redirecting to Questions step…");
  loadQuizzesList();

  // Move to Step 6
  setTimeout(() => {
    document.querySelectorAll(".step").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".step-content").forEach(c => c.classList.remove("active"));
    document.querySelector('[data-step="6"]').classList.add("active");
    document.getElementById("step-6").classList.add("active");
  }, 800);
}

/* =========================
   GENERIC LIST RENDERER
=========================*/
function renderItemsList(containerEl, items, infoFn, deleteFn) {
  if (!items || items.length === 0) {
    containerEl.innerHTML = `<div class="empty-list">No items found.</div>`;
    return;
  }

  containerEl.innerHTML = "";

  items.forEach(item => {
    const info = infoFn(item);
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <div class="item-row-info">
        <div class="item-row-title">${info.title}</div>
        ${info.meta ? `<div class="item-row-meta">${info.meta}</div>` : ""}
      </div>
      <button class="item-delete-btn" title="Delete">🗑</button>
    `;
    row.querySelector(".item-delete-btn").addEventListener("click", () => deleteFn(item));
    containerEl.appendChild(row);
  });
}
