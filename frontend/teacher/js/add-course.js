const API = "http://127.0.0.1:8000/api/v1";

/* =========================
   INIT
=========================*/
document.addEventListener("DOMContentLoaded", () => {
  loadCourses();
  setupStepper();
  setupPdfUpload();
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
      const contentEl = document.getElementById("step-" + step.dataset.step);
      if (contentEl) contentEl.classList.add("active");
    });
  });
}

/* =========================
   LOAD COURSES
=========================*/
async function loadCourses() {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API}/teacher/courses`, {
      headers: { Authorization: "Bearer " + token }
    });

    const courses = await res.json();

    const selects = [
      "pdfCourseSelect",
      "videoCourseSelect",
      "assignmentCourseSelect",
      "quizCourseSelect",
      "questionCourseSelect",
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

    // Handle direct step landing from URL
    const params = new URLSearchParams(window.location.search);
    const step = params.get("step");
    const courseId = params.get("course");

    if (step) {
      const stepEl = document.querySelector(`[data-step="${step}"]`);
      if (stepEl) stepEl.click();
    }
    if (courseId) {
      selects.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
          select.value = courseId;
          // Trigger onchange manually
          if (id === "videoCourseSelect") loadTopicsForVideo();
          if (id === "assignmentCourseSelect") loadTopicsForAssignment();
          if (id === "quizCourseSelect") loadTopicsForQuiz();
          if (id === "questionCourseSelect") loadTopicsForQuestion();
          if (id === "reviewCourseSelect") loadFullCoursePreview();
        }
      });
    }
  } catch (err) {
    console.error("Load courses failed", err);
  }
}

/* =========================
   CREATE COURSE
=========================*/
async function createCourse() {
  const token = localStorage.getItem("token");

  const title = document.getElementById("courseTitle").value.trim();
  const desc = document.getElementById("courseDesc").value.trim();
  const difficulty = document.getElementById("difficulty");
  const thumbnail = document.getElementById("thumbnail");
  
  if (!title || !desc) {
    showToast("Please fill in course title and description", "error");
    return;
  }

  const formData = new FormData();
  formData.append("title", title);
  formData.append("description", desc);
  formData.append("difficulty", difficulty.value);
  formData.append("status", true);

  if (thumbnail.files.length > 0)
    formData.append("logo", thumbnail.files[0]);

  try {
    const res = await fetch(`${API}/teacher/courses`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: formData
    });

    if (res.ok) {
      const data = await res.json();
      showToast("Course created!");
      await loadCourses();
      
      const courseId = data.course_id;
      document.getElementById("pdfCourseSelect").value = courseId;
      
      // Move to Step 2
      document.querySelector('[data-step="2"]').click();
    } else {
      const err = await res.json();
      showToast(err.detail || "Failed to create course", "error");
    }
  } catch (err) {
    showToast("Server error", "error");
  }
}

/* =========================
   PDF GENERATION (STEP 2)
=========================*/
let generatedData = null;

function setupPdfUpload() {
  const fileInput = document.getElementById('coursePdf');
  if (!fileInput) return;
  
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      document.getElementById('pdfPlaceholder').style.display = 'none';
      document.getElementById('pdfSelected').style.display = 'block';
      document.getElementById('pdfFileName').textContent = `📄 ${file.name}`;
    }
  });
}

async function generateFromPdf() {
  const token = localStorage.getItem("token");
  const courseId = document.getElementById("pdfCourseSelect").value;
  const pdfFile = document.getElementById("coursePdf").files[0];

  if (!courseId) return showToast("Please select a course", "error");
  if (!pdfFile) return showToast("Please upload a PDF", "error");

  const formData = new FormData();
  formData.append("course_id", courseId);
  formData.append("file", pdfFile);

  // UI state
  document.getElementById("pdfUploadSection").style.display = "none";
  document.getElementById("processingStatus").style.display = "block";

  try {
    const res = await fetch(`${API}/teacher/courses/${courseId}/process-pdf-preview`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: formData
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "PDF processing failed");
    }

    generatedData = await res.json();
    renderPdfPreview(generatedData);
  } catch (err) {
    showToast(err.message, "error");
    resetPdfStep();
  }
}

function renderPdfPreview(data) {
  document.getElementById("processingStatus").style.display = "none";
  document.getElementById("pdfPreviewArea").style.display = "block";
  
  const list = document.getElementById("generatedContentList");
  list.innerHTML = "";

  data.topics.forEach((t, i) => {
    const card = document.createElement("div");
    card.className = "preview-topic-card";
    card.innerHTML = `
      <div class="preview-topic-header">
        <strong>Topic ${i+1}:</strong> ${t.topic_name}
      </div>
      <div class="preview-topic-content">
        <div class="preview-item"><span>📝</span> 1 Assignment Generated</div>
        <div class="preview-item"><span>🧠</span> 1 Quiz (${t.quiz.questions.length} questions) Generated</div>
      </div>
    `;
    list.appendChild(card);
  });
}

async function saveGeneratedContent() {
  if (!generatedData) return;
  const token = localStorage.getItem("token");
  const courseId = document.getElementById("pdfCourseSelect").value;
  const btn = document.getElementById("btnSavePdf");
  
  btn.disabled = true;
  btn.textContent = "Saving...";

  try {
    const res = await fetch(`${API}/teacher/courses/${courseId}/save-pdf-content`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: "Bearer " + token 
      },
      body: JSON.stringify(generatedData)
    });

    if (res.ok) {
      showToast("All content saved successfully!");
      // Move to Step 3
      setTimeout(() => {
        document.querySelector('[data-step="3"]').click();
        loadTopicsForVideo();
      }, 1000);
    } else {
      showToast("Failed to save content", "error");
    }
  } catch (err) {
    showToast("Server error", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "💾 Save All to Course";
  }
}

function resetPdfStep() {
  document.getElementById("pdfUploadSection").style.display = "block";
  document.getElementById("processingStatus").style.display = "none";
  document.getElementById("pdfPreviewArea").style.display = "none";
  document.getElementById("pdfPlaceholder").style.display = "block";
  document.getElementById("pdfSelected").style.display = "none";
  document.getElementById("coursePdf").value = "";
  generatedData = null;
}

/* =========================
   TOPIC METHOD TOGGLE
=========================*/
function toggleTopicInput(method) {
  document.getElementById('aiTopicFields').style.display = method === 'ai' ? 'block' : 'none';
  document.getElementById('manualTopicFields').style.display = method === 'manual' ? 'block' : 'none';
  document.getElementById('pdfPreviewArea').style.display = 'none';
  document.getElementById('processingStatus').style.display = 'none';
  
  if (method === 'manual') {
    loadTopicsForManual();
  }
}

/* =========================
   MANUAL TOPIC ADDITION
=========================*/
let manualTopics = [];

async function addManualTopic() {
  const token = localStorage.getItem("token");
  const courseId = document.getElementById("pdfCourseSelect").value;
  const title = document.getElementById("manualTopicTitle").value.trim();
  const description = document.getElementById("manualTopicDesc").value.trim();

  if (!courseId) return showToast("Please select a course", "error");
  if (!title) return showToast("Please enter a topic title", "error");

  const btn = document.getElementById("btnAddManualTopic");
  btn.disabled = true;
  btn.textContent = "Adding...";

  try {
    const res = await fetch(`${API}/teacher/courses/${courseId}/topics`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: "Bearer " + token 
      },
      body: JSON.stringify({
        title: title
      })
    });

    if (!res.ok) throw new Error("Failed to add topic");

    const data = await res.json();
    manualTopics.push({ id: data.topic_id, title: title, description: description });
    
    // Clear form
    document.getElementById("manualTopicTitle").value = "";
    document.getElementById("manualTopicDesc").value = "";
    
    // Update list
    renderManualTopicsList();
    
    showToast("Topic added successfully!");
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "+ Add Topic";
  }
}

function renderManualTopicsList() {
  const container = document.getElementById("manualTopicsList");
  
  if (manualTopics.length === 0) {
    container.className = "empty-list";
    container.textContent = "No topics added yet";
    return;
  }

  container.className = "";
  container.innerHTML = manualTopics.map(topic => `
    <div class="item-card">
      <div class="item-header">
        <strong>${topic.title}</strong>
        <button class="btn-danger btn-small" onclick="removeManualTopic(${topic.id})">×</button>
      </div>
      ${topic.description ? `<div class="item-desc">${topic.description}</div>` : ''}
    </div>
  `).join("");
}

async function removeManualTopic(topicId) {
  const token = localStorage.getItem("token");
  
  // Check if this topic exists in the database (has been saved)
  const existingTopic = manualTopics.find(t => t.id === topicId);
  if (!existingTopic) return;
  
  openConfirm("Remove this topic?", async () => {
    try {
      const res = await fetch(`${API}/teacher/topics/${topicId}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token }
      });
      
      if (res.ok) {
        manualTopics = manualTopics.filter(t => t.id !== topicId);
        renderManualTopicsList();
        showToast("Topic removed");
      } else {
        showToast("Failed to remove topic", "error");
      }
    } catch (err) {
      showToast("Error removing topic", "error");
    }
  });
}

function onCourseChange() {
  const method = document.querySelector('input[name="topicMethod"]:checked').value;
  if (method === 'manual') {
    loadTopicsForManual();
  }
}

/* =========================
   LOAD TOPICS FOR MANUAL
=========================*/
async function loadTopicsForManual() {
  const token = localStorage.getItem("token");
  const courseId = document.getElementById("pdfCourseSelect").value;
  
  if (!courseId) {
    manualTopics = [];
    renderManualTopicsList();
    return;
  }

  try {
    const res = await fetch(`${API}/teacher/courses/${courseId}/topics`, {
      headers: { Authorization: "Bearer " + token }
    });

    if (res.ok) {
      const topics = await res.json();
      manualTopics = topics.map(t => ({ id: t.id, title: t.title, description: '' })); // No description in API
      renderManualTopicsList();
    }
  } catch (err) {
    console.error("Failed to load topics:", err);
  }
}

/* =========================
   VIEW MODAL LOGIC
=========================*/
function openView(title, html) {
    document.getElementById("viewTitle").textContent = title;
    document.getElementById("viewContent").innerHTML = html;
    document.getElementById("viewOverlay").classList.add("show");
}

function closeView() {
    document.getElementById("viewOverlay").classList.remove("show");
}

/* =========================
   COURSE PREVIEW (Step 7)
=========================*/
async function loadFullCoursePreview() {
  const token = localStorage.getItem("token");
  const courseId = document.getElementById("reviewCourseSelect").value;
  if (!courseId) return;

  const previewEl = document.getElementById("coursePreview");
  previewEl.innerHTML = '<div class="spinner" style="margin: 20px auto;"></div>';

  try {
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
            <div class="preview-item"><span>📝</span> Assignment & Quiz available</div>
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
   ADD VIDEO
=========================*/
function toggleVideoInput(source) {
  document.getElementById('videoUrlContainer').style.display = source === 'url' ? 'block' : 'none';
  document.getElementById('videoFileContainer').style.display = source === 'file' ? 'block' : 'none';
}

// Auto-detect duration when file is chosen
const videoFileInput = document.getElementById('videoFile');
if (videoFileInput) {
  videoFileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = function() {
        window.URL.revokeObjectURL(video.src);
        const mins = Math.ceil(video.duration / 60);
        document.getElementById('videoDuration').value = mins || 1;
      }
      video.src = URL.createObjectURL(file);
    }
  });
}

async function addVideo() {
  const token = localStorage.getItem("token");
  const topicId = document.getElementById("videoTopicSelect").value;
  const source = document.querySelector('input[name="videoSource"]:checked').value;
  const duration = document.getElementById("videoDuration").value || 10;

  if (!topicId) return showToast("Please select a topic", "error");

  const formData = new FormData();
  formData.append("duration", duration);

  if (source === 'url') {
    const videoUrlValue = document.getElementById("videoUrl").value;
    if (!videoUrlValue) return showToast("Please enter a video URL", "error");
    formData.append("video_url", videoUrlValue);
  } else {
    const videoFile = document.getElementById("videoFile").files[0];
    if (!videoFile) return showToast("Please select a video file", "error");
    formData.append("video_file", videoFile);
  }

  const res = await fetch(`${API}/teacher/topics/${topicId}/videos`, {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: formData
  });

  if (!res.ok) {
    const error = await res.json();
    showToast(error.detail || "Upload failed", "error");
    return;
  }

  showToast("Video added successfully!");
  document.getElementById("videoUrl").value = "";
  document.getElementById("videoFile").value = "";
  loadVideosList();
}

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
   ADD ASSIGNMENT
=========================*/
function toggleAssignmentInput(method) {
  document.getElementById('manualAssignmentFields').style.display = method === 'manual' ? 'block' : 'none';
  document.getElementById('aiAssignmentFields').style.display = method === 'ai' ? 'block' : 'none';
  document.getElementById('btnAddAssignment').textContent = method === 'manual' ? 'Save Assignment' : '✨ Generate Assignment';
}

async function addAssignment() {
  const token = localStorage.getItem("token");
  const topicId = document.getElementById("assignmentTopicSelect").value;
  const method = document.querySelector('input[name="assignmentMethod"]:checked').value;

  if (!topicId) return showToast("Please select a topic", "error");

  if (method === 'manual') {
    const formData = new FormData();
    formData.append("topic_id", topicId);
    formData.append("title", document.getElementById("assignmentTitle").value);
    formData.append("description", document.getElementById("assignmentDesc").value);
    formData.append("total_marks", document.getElementById("assignmentMarks").value);
    formData.append("model_answer", document.getElementById("assignmentAnswer").value);
    
    const fileInput = document.getElementById("assignmentFile");
    if (fileInput.files.length > 0) formData.append("file", fileInput.files[0]);

    const res = await fetch(`${API}/teacher/assignments/manual`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: formData
    });

    if (res.ok) showToast("Assignment added!");
    else {
      const err = await res.json();
      showToast(err.detail || "Failed", "error");
    }
  } else {
    // AI Generate...
  }
  loadAssignmentsList();
}

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
      await fetch(`${API}/teacher/assignments/${a.id}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token }
      });
      showToast("Assignment deleted");
      loadAssignmentsList();
    });
  }, (a) => {
    openView(a.title, `<p>${a.description}</p>`);
  });
}

/* =========================
   GENERIC LIST RENDERER
=========================*/
function renderItemsList(containerEl, items, infoFn, deleteFn, viewFn = null) {
  if (!items || items.length === 0) {
    containerEl.innerHTML = `<div class="empty-list">No items found.</div>`;
    return;
  }

  containerEl.innerHTML = "";

  items.forEach(item => {
    const info = infoFn(item);
    const row = document.createElement("div");
    row.className = "item-row";
    
    let buttonsHtml = `<div class="item-row-btns">`;
    if (viewFn) buttonsHtml += `<button class="item-view-btn" title="View">👁️</button>`;
    buttonsHtml += `<button class="item-delete-btn" title="Delete">🗑</button></div>`;

    row.innerHTML = `
      <div class="item-row-info">
        <div class="item-row-title">${info.title}</div>
        ${info.meta ? `<div class="item-row-meta">${info.meta}</div>` : ""}
      </div>
      ${buttonsHtml}
    `;

    if (viewFn) row.querySelector(".item-view-btn").addEventListener("click", () => viewFn(item));
    row.querySelector(".item-delete-btn").addEventListener("click", () => deleteFn(item));
    containerEl.appendChild(row);
  });
}

// Placeholder for missing functions that might be called
async function loadTopicsForVideo() {
  const token = localStorage.getItem("token");
  const courseId = document.getElementById("videoCourseSelect").value;
  if (!courseId) return;

  const select = document.getElementById("videoTopicSelect");
  select.innerHTML = "<option value=''>— Loading topics —</option>";

  try {
    const res = await fetch(`${API}/teacher/courses/${courseId}/topics`, {
      headers: { Authorization: "Bearer " + token }
    });
    const topics = await res.json();
    select.innerHTML = "<option value=''>— Select a topic —</option>";
    topics.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.title;
      select.appendChild(opt);
    });
  } catch (err) {
    select.innerHTML = "<option value=''>Failed to load</option>";
  }
}

async function loadTopicsForAssignment() {
  const token = localStorage.getItem("token");
  const courseId = document.getElementById("assignmentCourseSelect").value;
  if (!courseId) return;

  const select = document.getElementById("assignmentTopicSelect");
  select.innerHTML = "<option value=''>— Loading topics —</option>";

  try {
    const res = await fetch(`${API}/teacher/courses/${courseId}/topics`, {
      headers: { Authorization: "Bearer " + token }
    });
    const topics = await res.json();
    select.innerHTML = "<option value=''>— Select a topic —</option>";
    topics.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.title;
      select.appendChild(opt);
    });
  } catch (err) {
    select.innerHTML = "<option value=''>Failed to load</option>";
  }
}

async function loadTopicsForQuiz() {
  const token = localStorage.getItem("token");
  const courseId = document.getElementById("quizCourseSelect").value;
  if (!courseId) return;

  const select = document.getElementById("quizTopicSelect");
  select.innerHTML = "<option value=''>— Loading topics —</option>";

  try {
    const res = await fetch(`${API}/teacher/courses/${courseId}/topics`, {
      headers: { Authorization: "Bearer " + token }
    });
    const topics = await res.json();
    select.innerHTML = "<option value=''>— Select a topic —</option>";
    topics.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.title;
      select.appendChild(opt);
    });
  } catch (err) {
    select.innerHTML = "<option value=''>Failed to load</option>";
  }
}

async function loadTopicsForQuestion() {
  const token = localStorage.getItem("token");
  const courseId = document.getElementById("questionCourseSelect").value;
  if (!courseId) return;

  const select = document.getElementById("questionTopicSelect");
  select.innerHTML = "<option value=''>— Loading topics —</option>";

  try {
    const res = await fetch(`${API}/teacher/courses/${courseId}/topics`, {
      headers: { Authorization: "Bearer " + token }
    });
    const topics = await res.json();
    select.innerHTML = "<option value=''>— Select a topic —</option>";
    topics.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.title;
      select.appendChild(opt);
    });
  } catch (err) {
    select.innerHTML = "<option value=''>Failed to load</option>";
  }
}
async function loadQuizzesList() {
  const token = localStorage.getItem("token");
  const topicId = document.getElementById("quizTopicSelect").value;
  if (!topicId) return;

  const listEl = document.getElementById("quizzesList");
  listEl.innerHTML = `<div class="loading-items">Loading quizzes…</div>`;

  try {
    const res = await fetch(`${API}/topics/${topicId}/quizzes`, {
      headers: { Authorization: "Bearer " + token }
    });
    const quizzes = await res.json();

    renderItemsList(listEl, quizzes, (q) => ({
      title: q.title,
      meta: `Questions: ${q.num_questions || "—"}`
    }), (q) => {
      openConfirm(`Delete quiz "${q.title}"?`, async () => {
        await fetch(`${API}/teacher/quizzes/${q.id}`, {
          method: "DELETE",
          headers: { Authorization: "Bearer " + token }
        });
        showToast("Quiz deleted");
        loadQuizzesList();
      });
    }, (q) => {
        // Option to view quiz details if needed
    });
  } catch (err) {
    listEl.innerHTML = `<div class="empty-list">Failed to load quizzes</div>`;
  }
}

async function loadQuizzesForQuestion() {
  const token = localStorage.getItem("token");
  const topicId = document.getElementById("questionTopicSelect").value;
  if (!topicId) return;

  const select = document.getElementById("questionQuizSelect");
  select.innerHTML = "<option value=''>— Loading quizzes —</option>";

  try {
    const res = await fetch(`${API}/topics/${topicId}/quizzes`, {
      headers: { Authorization: "Bearer " + token }
    });
    const quizzes = await res.json();
    select.innerHTML = "<option value=''>— Select a quiz —</option>";
    quizzes.forEach(q => {
      const opt = document.createElement("option");
      opt.value = q.id;
      opt.textContent = q.title;
      select.appendChild(opt);
    });
    // Add event listener to load questions when quiz is selected
    select.onchange = loadQuestionsList;
  } catch (err) {
    select.innerHTML = "<option value=''>Failed to load</option>";
  }
}

async function addQuizQuestion() {
  const token = localStorage.getItem("token");
  const quizId = document.getElementById("questionQuizSelect").value;
  
  const question = document.getElementById("questionText").value;
  const a = document.getElementById("optionA").value;
  const b = document.getElementById("optionB").value;
  const c = document.getElementById("optionC").value;
  const d = document.getElementById("optionD").value;
  const correct = document.getElementById("correctOption").value;

  if (!quizId || !question || !a || !b) {
    return showToast("Please fill in quiz, question, and at least two options", "error");
  }

  const data = {
    quiz_id: parseInt(quizId),
    question_text: question,
    option_a: a,
    option_b: b,
    option_c: c,
    option_d: d,
    correct_option: correct
  };

  try {
    const res = await fetch(`${API}/teacher/quizzes/${quizId}/questions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      showToast("Question added!");
      // Clear inputs
      document.getElementById("questionText").value = "";
      document.getElementById("optionA").value = "";
      document.getElementById("optionB").value = "";
      document.getElementById("optionC").value = "";
      document.getElementById("optionD").value = "";
      loadQuestionsList();
    } else {
      const err = await res.json();
      showToast(err.detail || "Failed to add question", "error");
    }
  } catch (err) {
    showToast("Network error", "error");
  }
}

async function loadQuestionsList() {
    const token = localStorage.getItem("token");
    const quizId = document.getElementById("questionQuizSelect").value;
    if (!quizId) return;

    const listEl = document.getElementById("questionsList");
    listEl.innerHTML = `<div class="loading-items">Loading questions…</div>`;

    try {
        const res = await fetch(`${API}/quizzes/${quizId}/questions`, {
            headers: { Authorization: "Bearer " + token }
        });
        const questions = await res.json();

        renderItemsList(listEl, questions, (q) => ({
            title: q.question_text,
            meta: `Correct: ${q.correct_option}`
        }), (q) => {
            openConfirm(`Delete this question?`, async () => {
                await fetch(`${API}/teacher/questions/${q.id}`, {
                    method: "DELETE",
                    headers: { Authorization: "Bearer " + token }
                });
                showToast("Question deleted");
                loadQuestionsList();
            });
        });
    } catch (err) {
        listEl.innerHTML = `<div class="empty-list">Failed to load questions</div>`;
    }
}
