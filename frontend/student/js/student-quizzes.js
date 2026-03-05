const API = "http://127.0.0.1:8000/api/v1";

let allQuizzes = [];   // { quiz, topic_title, course_title, course_id, attempted, attempt }

document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
});

/* =========================
   LOAD ALL DATA
=========================*/
async function loadData() {
  try {
    // 1. Get enrollments
    const enrRes = await fetch(`${API}/student/enrollments`, {
      headers: { Authorization: "Bearer " + token }
    });
    if (!enrRes.ok) throw new Error("enrollments failed");
    const enrollments = await enrRes.json();

    if (enrollments.length === 0) {
      showEmpty();
      return;
    }

    // 2. Get course details for each enrollment (contains topics + quizzes)
    const courseDetails = await Promise.all(
      enrollments.map(e =>
        fetch(`${API}/student/courses/${e.course_id}/detail`, {
          headers: { Authorization: "Bearer " + token }
        }).then(r => r.ok ? r.json() : null)
      )
    );

    // 3. Build flat quiz list
    allQuizzes = [];
    const courses = courseDetails.filter(Boolean);

    courses.forEach(course => {
      // Populate course filter dropdown
      const sel = document.getElementById("courseFilter");
      if (![...sel.options].find(o => o.value == course.id)) {
        const opt = document.createElement("option");
        opt.value = course.id;
        opt.textContent = course.title;
        sel.appendChild(opt);
      }

      course.topics?.forEach(topic => {
        topic.quizzes?.forEach(quiz => {
          allQuizzes.push({
            quiz,
            topic_title:  topic.title,
            course_title: course.title,
            course_id:    course.id,
            attempted:    false,
            attempt:      null
          });
        });
      });
    });

    // 4. Load attempts to mark which are done
    await loadAttempts();

    // 5. Render
    renderAll("all");

  } catch (err) {
    console.error("loadData error:", err);
    document.getElementById("pendingGrid").innerHTML  = `<div class="empty-state">⚠️ Failed to load quizzes. Check connection.</div>`;
    document.getElementById("completedList").innerHTML = "";
  }
}

/* =========================
   LOAD ATTEMPTS
=========================*/
async function loadAttempts() {
  try {
    const res = await fetch(`${API}/student/quiz-attempts`, {
      headers: { Authorization: "Bearer " + token }
    });
    if (!res.ok) return;
    const attempts = await res.json();

    // Map by quiz_id
    const map = {};
    attempts.forEach(a => { map[a.quiz_id] = a; });

    allQuizzes.forEach(item => {
      if (map[item.quiz.id]) {
        item.attempted = true;
        item.attempt   = map[item.quiz.id];
      }
    });
  } catch (_) {}
}

/* =========================
   RENDER ALL
=========================*/
function renderAll(courseFilter) {
  let items = allQuizzes;
  if (courseFilter !== "all") {
    items = allQuizzes.filter(q => String(q.course_id) === String(courseFilter));
  }

  const pending   = items.filter(q => !q.attempted);
  const completed = items.filter(q =>  q.attempted);

  document.getElementById("pendingCount").textContent   = pending.length;
  document.getElementById("completedCount").textContent = completed.length;

  renderPending(pending);
  renderCompleted(completed);
}

/* =========================
   RENDER PENDING
=========================*/
function renderPending(items) {
  const grid = document.getElementById("pendingGrid");

  if (items.length === 0) {
    grid.innerHTML = `<div class="empty-state">🎉 No pending quizzes! All caught up.</div>`;
    return;
  }

  grid.innerHTML = "";
  items.forEach((item, i) => {
    const card = document.createElement("div");
    card.className = "quiz-card";
    card.style.animationDelay = `${i * 0.06}s`;
    card.innerHTML = `
      <div class="quiz-card-course">${item.course_title}</div>
      <div class="quiz-card-title">${item.quiz.title}</div>
      <div class="quiz-card-topic">${item.topic_title}</div>
      <div class="quiz-card-meta">
        <span>❓ Questions</span>
      </div>
      <button class="btn-start-quiz" onclick="startQuiz(${item.quiz.id})">
        Start Quiz
      </button>
    `;
    grid.appendChild(card);
  });
}

/* =========================
   RENDER COMPLETED
=========================*/
function renderCompleted(items) {
  const list = document.getElementById("completedList");

  if (items.length === 0) {
    list.innerHTML = `<div class="empty-state">📝 No completed quizzes yet. Start one above!</div>`;
    return;
  }

  list.innerHTML = "";
  items.forEach((item, i) => {
    const a      = item.attempt;
    const score  = a?.score        ?? 0;
    const total  = a?.total        ?? 0;
    const pct    = a?.percentage   ?? 0;
    const date   = a?.attempted_at
      ? new Date(a.attempted_at).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })
      : "--";

    const el = document.createElement("div");
    el.className = "completed-item";
    el.style.animationDelay = `${i * 0.06}s`;
    el.innerHTML = `
      <div class="completed-check">✓</div>
      <div class="completed-info">
        <div class="completed-course">${item.course_title}</div>
        <div class="completed-title">${item.quiz.title}</div>
        <div class="completed-topic">${item.topic_title}</div>
        <div class="completed-meta">
          <span>📅 Completed: ${date}</span>
        </div>
        <div class="score-bar-wrap">
          <div class="score-bar" style="width:${pct}%"></div>
        </div>
        <a class="view-results-link" onclick="viewResults(${item.quiz.id}, ${a?.id})">View Results</a>
      </div>
      <div class="completed-score">
        <div class="score-fraction">${score}/${total}</div>
        <div class="score-label">Score</div>
        <div class="score-pct">${Math.round(pct)}%</div>
      </div>
    `;
    list.appendChild(el);
  });
}

function showEmpty() {
  document.getElementById("pendingCount").textContent   = 0;
  document.getElementById("completedCount").textContent = 0;
  document.getElementById("pendingGrid").innerHTML      = `<div class="empty-state">📚 Enroll in courses first to see quizzes here.</div>`;
  document.getElementById("completedList").innerHTML    = "";
}

/* ── FILTER ── */
function filterByCourse() {
  renderAll(document.getElementById("courseFilter").value);
}

/* ── NAV ── */
function startQuiz(quizId) {
  window.location.href = `student-quiz-attempt.html?id=${quizId}`;
}

function viewResults(quizId, attemptId) {
  window.location.href = `student-quiz-results.html?quiz=${quizId}&attempt=${attemptId}`;
}