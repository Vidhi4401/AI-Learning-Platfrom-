const API    = "http://127.0.0.1:8000/api/v1";
const params = new URLSearchParams(window.location.search);
const quizId = params.get("id");
if (!quizId) window.location.href = "student-quizzes.html";

let questions  = [];
let quizInfo   = null;
let answers    = {};   // { question_id: "A"|"B"|"C"|"D" }
let curIndex   = 0;

document.addEventListener("DOMContentLoaded", loadQuiz);

/* =========================
   LOAD QUIZ + QUESTIONS
=========================*/
async function loadQuiz() {
  try {
    // Check if already attempted
    const attRes = await fetch(`${API}/student/quiz-attempts`, {
      headers: { Authorization: "Bearer " + token }
    });
    if (attRes.ok) {
      const attempts = await attRes.json();
      if (attempts.find(a => a.quiz_id == quizId)) {
        show("alreadyState");
        return;
      }
    }

    // Load quiz info (title)
    const qRes = await fetch(`${API}/quizzes/${quizId}`, {
      headers: { Authorization: "Bearer " + token }
    });
    if (!qRes.ok) throw new Error("quiz not found");
    const qData = await qRes.json();
    quizInfo = qData.quiz;

    // Load questions
    const qqRes = await fetch(`${API}/quizzes/${quizId}/questions`, {
      headers: { Authorization: "Bearer " + token }
    });
    if (!qqRes.ok) throw new Error("questions not found");
    questions = await qqRes.json();

    if (questions.length === 0) {
      document.getElementById("loadingState").innerHTML =
        `<p style="padding:60px;text-align:center;color:var(--muted);">No questions added for this quiz yet.</p>`;
      return;
    }

    // Set header
    document.getElementById("quizTitle").textContent = quizInfo?.title || "Quiz";
    document.getElementById("quizSub").textContent   = `${questions.length} Questions`;
    document.title = quizInfo?.title || "Quiz";

    show("quizScreen");
    buildDots();
    renderQ(0);

  } catch (err) {
    console.error("loadQuiz error:", err);
    document.getElementById("loadingState").innerHTML =
      `<p style="padding:60px;text-align:center;color:red;">Failed to load quiz. Please try again.</p>`;
  }
}

/* =========================
   RENDER QUESTION
=========================*/
function renderQ(index) {
  curIndex = index;
  const q  = questions[index];
  const n  = index + 1;
  const total = questions.length;

  document.getElementById("qLabel").textContent       = `Question ${n} of ${total}`;
  document.getElementById("qText").textContent        = q.question_text;
  document.getElementById("progressBadge").textContent = `Q ${n} / ${total}`;
  document.getElementById("topBarFill").style.width   = `${(n / total) * 100}%`;

  // Options
  const opts = [
    { key: "A", text: q.option_a },
    { key: "B", text: q.option_b },
    { key: "C", text: q.option_c },
    { key: "D", text: q.option_d }
  ];

  document.getElementById("qOptions").innerHTML = opts.map(o => `
    <div class="q-opt ${answers[q.id] === o.key ? "selected" : ""}"
         onclick="selectOpt(${q.id}, '${o.key}', this)">
      <div class="opt-letter">${o.key}</div>
      <div class="opt-text">${o.text || ""}</div>
    </div>
  `).join("");

  // Nav buttons
  document.getElementById("btnPrev").disabled = index === 0;
  const isLast = index === total - 1;
  document.getElementById("btnNext").textContent = isLast ? "Review ↓" : "Next →";

  // Show submit on last
  const sb = document.getElementById("submitBox");
  if (isLast) {
    sb.style.display = "block";
    updateSubmitMsg();
  } else {
    sb.style.display = "none";
  }

  updateDots();
}

/* =========================
   SELECT OPTION
=========================*/
function selectOpt(qId, key, el) {
  answers[qId] = key;

  // Update UI instantly
  document.querySelectorAll(".q-opt").forEach(o => {
    o.classList.remove("selected");
    o.querySelector(".opt-letter").style.cssText = "";
  });
  el.classList.add("selected");
  el.querySelector(".opt-letter").style.background = "var(--accent)";
  el.querySelector(".opt-letter").style.color      = "white";

  updateDots();
  updateSubmitMsg();
}

/* =========================
   NAVIGATION
=========================*/
function nextQ() {
  if (curIndex < questions.length - 1) renderQ(curIndex + 1);
}
function prevQ() {
  if (curIndex > 0) renderQ(curIndex - 1);
}

/* =========================
   DOTS
=========================*/
function buildDots() {
  document.getElementById("dotRow").innerHTML = questions.map((_, i) => `
    <div class="q-dot" id="dot-${i}" onclick="renderQ(${i})" title="Q${i+1}"></div>
  `).join("");
}

function updateDots() {
  questions.forEach((q, i) => {
    const d = document.getElementById(`dot-${i}`);
    if (!d) return;
    d.className = "q-dot";
    if (answers[q.id])  d.classList.add("answered");
    if (i === curIndex) d.classList.add("current");
  });
}

/* =========================
   SUBMIT MSG
=========================*/
function updateSubmitMsg() {
  const answered   = Object.keys(answers).length;
  const total      = questions.length;
  const unanswered = total - answered;
  const el         = document.getElementById("submitMsg");
  if (!el) return;

  if (unanswered > 0) {
    el.innerHTML = `Answered <strong>${answered}</strong> of <strong>${total}</strong> questions.
      <br><span style="color:#d97706;font-size:13px;">⚠ ${unanswered} unanswered — they will be marked wrong.</span>`;
  } else {
    el.innerHTML = `All <strong>${total}</strong> questions answered. Ready to submit!`;
  }
}

/* =========================
   SUBMIT QUIZ
=========================*/
async function submitQuiz() {
  const btn     = document.getElementById("btnSubmit");
  btn.disabled  = true;
  btn.textContent = "Submitting…";

  const payload = questions.map(q => ({
    question_id:     q.id,
    selected_option: answers[q.id] || null
  }));

  try {
    const res = await fetch(`${API}/student/quizzes/${quizId}/attempt`, {
      method:  "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type":  "application/json"
      },
      body: JSON.stringify({ answers: payload })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Submit failed");
    }

    const result = await res.json();
    showResult(result);

  } catch (err) {
    console.error("Submit error:", err);
    btn.disabled    = false;
    btn.textContent = "Submit Quiz";
    alert(err.message || "Submission failed. Please try again.");
  }
}

/* =========================
   SHOW RESULT
=========================*/
function showResult(r) {
  show("resultScreen");

  const score   = r.score            ?? 0;
  const total   = r.total_questions  ?? questions.length;
  const correct = r.correct_answers  ?? 0;
  const wrong   = r.wrong_answers    ?? 0;
  const skipped = r.skipped          ?? 0;
  const pct     = r.percentage       ?? Math.round((score / total) * 100);

  let emoji = "📚", heading = "Keep Practicing!";
  if      (pct >= 80) { emoji = "🏆"; heading = "Excellent Work!"; }
  else if (pct >= 60) { emoji = "👍"; heading = "Good Job!"; }

  document.getElementById("resultEmoji").textContent   = emoji;
  document.getElementById("resultHeading").textContent = heading;
  document.getElementById("resultBig").textContent     = `${score}/${total}`;
  document.getElementById("resultPctEl").textContent   = `${Math.round(pct)}%`;
  document.getElementById("resultRow").innerHTML = `
    <div>
      <div class="r-stat-val" style="color:#16a34a;">${correct}</div>
      <div class="r-stat-label">Correct</div>
    </div>
    <div>
      <div class="r-stat-val" style="color:#ef4444;">${wrong}</div>
      <div class="r-stat-label">Wrong</div>
    </div>
    <div>
      <div class="r-stat-val" style="color:#9ca3af;">${skipped}</div>
      <div class="r-stat-label">Skipped</div>
    </div>
  `;
}

/* =========================
   HELPERS
=========================*/
function show(id) {
  ["loadingState","alreadyState","quizScreen","resultScreen"].forEach(s => {
    document.getElementById(s).style.display = s === id ? "block" : "none";
  });
}