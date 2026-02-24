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

  const res = await fetch(`${API}/admin/courses`, {
    headers: { Authorization: "Bearer " + token }
  });

  const courses = await res.json();

  const selects = [
    "topicCourseSelect",
    "videoCourseSelect",
    "assignmentCourseSelect",
    "quizCourseSelect",
    "questionCourseSelect"
  ];

  selects.forEach(id => {
    const select = document.getElementById(id);
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

  await fetch(`${API}/admin/courses`, {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: formData
  });

  showToast("Course created successfully!");
  loadCourses();
}

/* =========================
   ADD TOPIC
=========================*/
async function addTopic() {
  const token = localStorage.getItem("token");
  const courseId = topicCourseSelect.value;

  if (!courseId) { showToast("Please select a course", "error"); return; }

  await fetch(`${API}/admin/courses/${courseId}/topics`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ title: topicTitle.value })
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

  const res = await fetch(`${API}/admin/courses/${courseId}/topics`, {
    headers: { Authorization: "Bearer " + token }
  });
  const topics = await res.json();

  renderItemsList(listEl, topics, (topic) => ({
    title: topic.title,
    meta: `Topic ID: ${topic.id}`
  }), (topic) => {
    openConfirm(`Delete topic "${topic.title}"? This will also remove associated content.`, async () => {
      const token = localStorage.getItem("token");
      await fetch(`${API}/admin/topics/${topic.id}`, {
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

  const res = await fetch(`${API}/admin/courses/${courseId}/topics`, {
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
      await fetch(`${API}/admin/videos/${v.id}`, {
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

  const res = await fetch(`${API}/admin/courses/${courseId}/topics`, {
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

  const res = await fetch(`${API}/admin/topics/${topicId}/assignments`, {
    headers: { Authorization: "Bearer " + token }
  });
  const assignments = await res.json();

  renderItemsList(listEl, assignments, (a) => ({
    title: a.title,
    meta: `Total Marks: ${a.total_marks || "—"}`
  }), (a) => {
    openConfirm(`Delete assignment "${a.title}"?`, async () => {
      const token = localStorage.getItem("token");
      await fetch(`${API}/admin/assignments/${a.id}`, {
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

  const res = await fetch(`${API}/admin/courses/${courseId}/topics`, {
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
      await fetch(`${API}/admin/quizzes/${q.id}`, {
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
  const res = await fetch(`${API}/admin/courses/${courseId}/topics`, {
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

  await fetch(`${API}/admin/quizzes/${quizId}/questions`, {
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
async function addVideo() {
  const token = localStorage.getItem("token");
  const topicId = document.getElementById("videoTopicSelect").value;
  const videoUrl = document.getElementById("videoUrl").value;

  if (!topicId || !videoUrl) {
    showToast("Please select topic and enter video URL", "error");
    return;
  }

  const res = await fetch(`${API}/admin/topics/${topicId}/videos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ video_url: videoUrl, duration: 10 })
  });

  if (!res.ok) {
    const error = await res.json();
    showToast(error.detail, "error");
    return;
  }

  showToast("Video added successfully!");
  document.getElementById("videoUrl").value = "";
  loadVideosList();
}

/* =========================
   ADD ASSIGNMENT
=========================*/
async function addAssignment() {
  const token = localStorage.getItem("token");
  const topicId = document.getElementById("assignmentTopicSelect").value;

  if (!topicId) { showToast("Please select a topic", "error"); return; }

  const res = await fetch(`${API}/admin/topics/${topicId}/assignments`, {
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

  const res = await fetch(`${API}/admin/topics/${topicId}/quizzes`, {
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