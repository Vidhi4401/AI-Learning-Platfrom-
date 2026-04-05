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
    
    // Move to Step 2
    setTimeout(() => {
      document.querySelector('[data-step="2"]').click();
      // Pre-select the course in next step
      document.getElementById("videoCourseSelect").value = data.course_id;
      loadTopicsForVideo();
    }, 1000);
  } else {
    showToast("Failed to create course", "error");
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
  }, (a) => {
    viewAssignment(a);
  });
}

function viewAssignment(a) {
    let html = "";
    if (a.file_url) {
        // Show PDF directly in iframe
        html = `
            <div style="margin-bottom: 15px;">
                <p><strong>Assignment View:</strong></p>
                <iframe src="${a.file_url}" style="width:100%; height:500px; border: 1px solid #e2e8f0; border-radius: 8px;" frameborder="0"></iframe>
            </div>
            <p><small>If PDF doesn't load, <a href="${a.file_url}" target="_blank" style="color: #1e40af; text-decoration: underline;">click here to open in new tab</a></small></p>
        `;
    } else {
        // Fallback for older assignments without PDF
        html = `
            <p><strong>Description:</strong><br>${a.description || "No description"}</p>
            <p><strong>Total Marks:</strong> ${a.total_marks}</p>
            <p><strong>Model Answer:</strong><br>${a.model_answer || "No model answer"}</p>
        `;
    }
    openView(a.title, html);
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
  }, (q) => {
    viewQuiz(q);
  });
}

async function viewQuiz(q) {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API}/quizzes/${q.id}/questions`, {
      headers: { Authorization: "Bearer " + token }
    });
    const questions = await res.json();
    
    let html = `<p><strong>Limit:</strong> ${q.num_questions || "No limit"}</p>`;
    if (questions.length === 0) {
        html += "<p>No questions added yet.</p>";
    } else {
        html += `<div style="margin-top: 15px;">`;
        questions.forEach((question, i) => {
            html += `
                <div style="margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
                    <p><strong>Q${i+1}:</strong> ${question.question_text}</p>
                    <ul style="list-style: none; padding-left: 10px; font-size: 13px;">
                        <li>A: ${question.option_a}</li>
                        <li>B: ${question.option_b}</li>
                        <li>C: ${question.option_c}</li>
                        <li>D: ${question.option_d}</li>
                    </ul>
                    <p style="color: #059669; font-weight: 600; font-size: 13px;">Correct: ${question.correct_option}</p>
                </div>
            `;
        });
        html += `</div>`;
    }
    openView(q.title, html);
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
function toggleAssignmentInput(method) {
  document.getElementById('manualAssignmentFields').style.display = method === 'manual' ? 'block' : 'none';
  document.getElementById('aiAssignmentFields').style.display = method === 'ai' ? 'block' : 'none';
  document.getElementById('btnAddAssignment').textContent = method === 'manual' ? 'Save Assignment' : '✨ Generate Assignment';
}

async function addAssignment() {
  const token = localStorage.getItem("token");
  const topicId = document.getElementById("assignmentTopicSelect").value;
  const method = document.querySelector('input[name="assignmentMethod"]:checked').value;

  if (!topicId) { showToast("Please select a topic", "error"); return; }

  if (method === 'manual') {
    const formData = new FormData();
    formData.append("topic_id", topicId);
    formData.append("title", document.getElementById("assignmentTitle").value);
    formData.append("description", document.getElementById("assignmentDesc").value);
    formData.append("total_marks", document.getElementById("assignmentMarks").value);
    formData.append("model_answer", document.getElementById("assignmentAnswer").value);
    
    const fileInput = document.getElementById("assignmentFile");
    if (fileInput.files.length > 0) {
      formData.append("file", fileInput.files[0]);
    }

    const res = await fetch(`${API}/teacher/assignments/manual`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: formData
    });

    if (!res.ok) {
      const error = await res.json();
      showToast(error.detail || "Failed to add assignment", "error");
      return;
    }
    showToast("Assignment added successfully!");
  } else {
    // AI Generate
    const data = {
      title: document.getElementById("aiAssignmentTitle").value,
      description: document.getElementById("aiAssignmentContext").value,
      topic_id: parseInt(topicId),
      difficulty: document.getElementById("aiAssignmentDiff").value,
      num_questions: parseInt(document.getElementById("aiAssignmentNum").value)
    };

    if (!data.title) { showToast("Please enter a title for the AI to follow", "error"); return; }

    document.getElementById("assignmentStatus").style.display = "block";
    document.getElementById("btnAddAssignment").disabled = true;

    try {
      const res = await fetch(`${API}/teacher/assignments/generate-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        showToast("AI Assignment generated!");
      } else {
        const err = await res.json();
        showToast(err.detail || "AI generation failed", "error");
      }
    } catch (e) {
      showToast("Network error", "error");
    } finally {
      document.getElementById("assignmentStatus").style.display = "none";
      document.getElementById("btnAddAssignment").disabled = false;
    }
  }

  loadAssignmentsList();
}

/* =========================
   ADD QUIZ
=========================*/
function toggleQuizInput(method) {
  document.getElementById('manualQuizFields').style.display = method === 'manual' ? 'block' : 'none';
  document.getElementById('aiQuizFields').style.display = method === 'ai' ? 'block' : 'none';
  document.getElementById('btnCreateQuiz').textContent = method === 'manual' ? 'Create Quiz' : '✨ Generate Quiz';
}

async function handleQuizCreation() {
  const method = document.querySelector('input[name="quizMethod"]:checked').value;
  if (method === 'manual') {
    addQuiz();
  } else {
    generateAIQuizFromStep();
  }
}

async function addQuiz() {
  const token = localStorage.getItem("token");
  const topicId = document.getElementById("quizTopicSelect").value;
  const quizTitle = document.getElementById("quizTitle").value;
  const numQuestions = document.getElementById("quizNumQuestions").value;

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
    body: JSON.stringify({ 
      title: quizTitle,
      num_questions: parseInt(numQuestions)
    })
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
    const step6 = document.querySelector('[data-step="6"]');
    if (step6) step6.click();
    // Pre-select the quiz in step 6? 
    // We'll need to reload quizzes for questions
    loadTopicsForQuestion();
  }, 800);
}

async function generateAIQuizFromStep() {
  const token = localStorage.getItem("token");
  const topicId = document.getElementById("quizTopicSelect").value;
  const data = {
    title: document.getElementById("aiManualQuizTitle").value,
    description: document.getElementById("aiManualQuizDesc").value,
    num_questions: parseInt(document.getElementById("aiManualQuizNum").value),
    difficulty: document.getElementById("aiManualQuizDiff").value,
    topic_id: parseInt(topicId)
  };

  if (!topicId || !data.title) {
    showToast("Please select a topic and enter a title", "error");
    return;
  }

  document.getElementById("quizStatus").style.display = "block";
  document.getElementById("btnCreateQuiz").disabled = true;

  try {
    const res = await fetch(`${API}/teacher/quizzes/generate-ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      showToast("AI Quiz generated successfully!");
      loadQuizzesList();
    } else {
      const err = await res.json();
      showToast(err.detail || "AI generation failed", "error");
    }
  } catch (e) {
    showToast("Network error", "error");
  } finally {
    document.getElementById("quizStatus").style.display = "none";
    document.getElementById("btnCreateQuiz").disabled = false;
  }
}

/* =========================
   QUIZ QUESTIONS STEP (Step 6)
=========================*/
let currentEditingQuestionId = null;

async function loadQuizzesForQuestion() {
  const token = localStorage.getItem("token");
  const topicId = questionTopicSelect.value;
  if (!topicId) return;

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
  
  // Clear questions list if no quiz selected
  document.getElementById("questionsList").innerHTML = `<div class="empty-list">Select a quiz to view questions</div>`;
}

// Add event listener to reload questions when quiz changes
document.getElementById("questionQuizSelect").addEventListener("change", loadQuestionsList);

async function loadQuestionsList() {
  const token = localStorage.getItem("token");
  const quizId = document.getElementById("questionQuizSelect").value;
  if (!quizId) return;

  const listEl = document.getElementById("questionsList");
  listEl.innerHTML = `<div class="loading-items">Loading questions…</div>`;

  const res = await fetch(`${API}/quizzes/${quizId}/questions`, {
    headers: { Authorization: "Bearer " + token }
  });
  const questions = await res.json();

  if (questions.length === 0) {
    listEl.innerHTML = `<div class="empty-list">No questions added yet.</div>`;
    return;
  }

  listEl.innerHTML = "";
  questions.forEach((q, i) => {
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <div class="item-row-info">
        <div class="item-row-title">${i + 1}. ${q.question_text}</div>
        <div class="item-row-meta">Correct: ${q.correct_option} | A: ${q.option_a}, B: ${q.option_b}...</div>
      </div>
      <div class="item-row-btns">
        <button class="item-edit-btn" onclick="editQuestion(${JSON.stringify(q).replace(/"/g, '&quot;')})">✏️</button>
        <button class="item-delete-btn" onclick="deleteQuestion(${q.id})">🗑</button>
      </div>
    `;
    listEl.appendChild(row);
  });
}

async function addQuizQuestion() {
  const token = localStorage.getItem("token");
  const quizId = questionQuizSelect.value;

  if (!quizId) { showToast("Please select a quiz", "error"); return; }

  // 1. Check question limit
  const quizRes = await fetch(`${API}/quizzes/${quizId}`, {
      headers: { Authorization: "Bearer " + token }
  });
  const quizData = await quizRes.json();
  const maxQ = quizData.quiz.num_questions;
  const currentQ = quizData.questions.length;

  if (!currentEditingQuestionId && maxQ && currentQ >= maxQ) {
      showToast(`Limit reached! This quiz allows only ${maxQ} questions.`, "error");
      return;
  }

  const payload = {
    question_text: questionText.value,
    option_a: optionA.value,
    option_b: optionB.value,
    option_c: optionC.value,
    option_d: optionD.value,
    correct_option: correctOption.value
  };

  let res;
  if (currentEditingQuestionId) {
      // UPDATE
      res = await fetch(`${API}/teacher/questions/${currentEditingQuestionId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(payload)
      });
  } else {
      // CREATE
      res = await fetch(`${API}/teacher/quizzes/${quizId}/questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(payload)
      });
  }

  if (res.ok) {
      showToast(currentEditingQuestionId ? "Question updated!" : "Question added!");
      resetQuestionForm();
      loadQuestionsList();
  } else {
      showToast("Operation failed", "error");
  }
}

function editQuestion(q) {
    currentEditingQuestionId = q.id;
    questionText.value = q.question_text;
    optionA.value = q.option_a;
    optionB.value = q.option_b;
    optionC.value = q.option_c;
    optionD.value = q.option_d;
    correctOption.value = q.correct_option;
    
    document.getElementById("btnAddQuestion").textContent = "Update Question";
    window.scrollTo({ top: document.querySelector('.panel').offsetTop - 100, behavior: 'smooth' });
}

function resetQuestionForm() {
    currentEditingQuestionId = null;
    [questionText, optionA, optionB, optionC, optionD, correctOption].forEach(el => el.value = "");
    document.getElementById("btnAddQuestion").textContent = "+ Add Question to Quiz";
}

async function deleteQuestion(id) {
    if (!confirm("Delete this question?")) return;
    const token = localStorage.getItem("token");
    const res = await fetch(`${API}/teacher/questions/${id}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token }
    });
    if (res.ok) {
        showToast("Question removed");
        loadQuestionsList();
    }
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
    if (viewFn) {
        buttonsHtml += `<button class="item-view-btn" title="View">👁️</button>`;
    }
    buttonsHtml += `<button class="item-delete-btn" title="Delete">🗑</button></div>`;

    row.innerHTML = `
      <div class="item-row-info">
        <div class="item-row-title">${info.title}</div>
        ${info.meta ? `<div class="item-row-meta">${info.meta}</div>` : ""}
      </div>
      ${buttonsHtml}
    `;

    if (viewFn) {
        row.querySelector(".item-view-btn").addEventListener("click", () => viewFn(item));
    }
    row.querySelector(".item-delete-btn").addEventListener("click", () => deleteFn(item));
    containerEl.appendChild(row);
  });
}
