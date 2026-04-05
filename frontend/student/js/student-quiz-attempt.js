const API    = "http://127.0.0.1:8000/api/v1";
const params = new URLSearchParams(window.location.search);
const quizId = params.get("id");
if (!quizId) window.location.href = "student-quizzes.html";

let questions  = [];
let quizInfo   = null;
let answers    = {};   // { question_id: "A"|"B"|"C"|"D" }
let curIndex   = 0;
let timeLeft   = 0;
let timerInterval = null;
let isReviewMode = false;
let reviewData = null;

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
    startTimer();

  } catch (err) {
    console.error("loadQuiz error:", err);
    document.getElementById("loadingState").innerHTML =
      `<p style="padding:60px;text-align:center;color:red;">Failed to load quiz. Please try again.</p>`;
  }
}

/* =========================
   QUIZ TIMER LOGIC
=========================*/
function startTimer(minutesPerQuestion = 1) {
  const totalQuestions = questions.length;
  timeLeft = totalQuestions * minutesPerQuestion * 60; // total seconds

  updateTimerDisplay();

  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timeLeft = 0;
      updateTimerDisplay();
      autoSubmitQuiz();
    } else {
      updateTimerDisplay();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  const timerDisplayEl = document.getElementById("timerDisplay");
  const timerContainer = document.getElementById("quizTimer");
  
  if (timerDisplayEl) {
    timerDisplayEl.textContent = display;
    
    // Visual warning when time is low
    if (timeLeft < 60) {
      if (timerContainer) {
        timerContainer.style.borderColor = "#ef4444";
        timerContainer.style.color = "#ef4444";
        timerContainer.style.background = "#fee2e2";
      }
      timerDisplayEl.style.animation = "pulse 1s infinite";
    }
  }
}

async function autoSubmitQuiz() {
  const sb = document.getElementById("submitBox");
  if (sb) {
    sb.style.display = "block";
    const msg = document.getElementById("submitMsg");
    if (msg) msg.innerHTML = "<b style='color:#ef4444;'>Time is up! Submitting your answers...</b>";
  }
  await submitQuiz(true);
}

/* =========================
   RENDER QUESTION
=========================*/
function renderQ(index) {
  if (isReviewMode) {
    renderReviewQ(index);
    return;
  }

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
    if (timeLeft > 0) sb.style.display = "none";
  }

  updateDots();
}

/* =========================
   SELECT OPTION
=========================*/
function selectOpt(qId, key, el) {
  if (timeLeft <= 0 || isReviewMode) return; 

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
  const qList = isReviewMode ? reviewData.questions : questions;
  if (curIndex < qList.length - 1) renderQ(curIndex + 1);
}
function prevQ() {
  if (curIndex > 0) renderQ(curIndex - 1);
}

/* =========================
   DOTS
=========================*/
function buildDots() {
  const qList = isReviewMode ? reviewData.questions : questions;
  document.getElementById("dotRow").innerHTML = qList.map((_, i) => `
    <div class="q-dot" id="dot-${i}" onclick="renderQ(${i})" title="Q${i+1}"></div>
  `).join("");
}

function updateDots() {
  const qList = isReviewMode ? reviewData.questions : questions;
  qList.forEach((q, i) => {
    const d = document.getElementById(`dot-${i}`);
    if (!d) return;
    d.className = "q-dot";
    
    if (isReviewMode) {
        if (q.selected_option === q.correct_option) d.style.background = "#16a34a";
        else if (q.selected_option) d.style.background = "#ef4444";
        else d.style.background = "#9ca3af";
    } else {
        if (answers[q.id])  d.classList.add("answered");
    }
    
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
async function submitQuiz(isAuto = false) {
  if (timerInterval) clearInterval(timerInterval);
  
  const btn     = document.getElementById("btnSubmit");
  if (btn) {
    btn.disabled  = true;
    btn.textContent = "Submitting…";
  }

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
    if (btn) {
      btn.disabled    = false;
      btn.textContent = "Submit Quiz";
    }
    if (!isAuto) alert(err.message || "Submission failed. Please try again.");
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

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl("resultEmoji",   emoji);
  setEl("resultHeading", heading);
  setEl("resultBig",     `${score}/${total}`);
  setEl("resultPctEl",   `${Math.round(pct)}%`);

  const rowEl = document.getElementById("resultRow");
  if (rowEl) {
    rowEl.innerHTML = `
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
}

/* =========================
   REVIEW QUIZ
=========================*/
async function reviewQuiz() {
    try {
        const res = await fetch(`${API}/student/quizzes/${quizId}/review`, {
            headers: { Authorization: "Bearer " + token }
        });
        if (!res.ok) throw new Error("Could not load review data");
        
        reviewData = await res.json();
        isReviewMode = true;
        curIndex = 0;
        
        // Setup UI for review
        show("quizScreen");
        document.getElementById("quizTimer").style.display = "none";
        document.getElementById("submitBox").style.display = "none";
        document.getElementById("quizSub").textContent = "Review Mode - Showing Correct Answers";
        
        buildDots();
        renderReviewQ(0);
        
    } catch (err) {
        console.error("Review error:", err);
        alert("Failed to load review. Please try again.");
    }
}

function renderReviewQ(index) {
    curIndex = index;
    const q = reviewData.questions[index];
    const n = index + 1;
    const total = reviewData.questions.length;

    document.getElementById("qLabel").textContent = `Review Question ${n} of ${total}`;
    document.getElementById("qText").textContent = q.question_text;
    document.getElementById("progressBadge").textContent = `Reviewing ${n}/${total}`;
    document.getElementById("topBarFill").style.width = `${(n / total) * 100}%`;

    const opts = [
        { key: "A", text: q.option_a },
        { key: "B", text: q.option_b },
        { key: "C", text: q.option_c },
        { key: "D", text: q.option_d }
    ];

    document.getElementById("qOptions").innerHTML = opts.map(o => {
        let cls = "";
        if (o.key === q.correct_option) cls = "correct-opt";
        else if (o.key === q.selected_option && o.key !== q.correct_option) cls = "wrong-opt";
        
        const isUserSelected = o.key === q.selected_option;
        
        return `
            <div class="q-opt ${cls}">
                <div class="opt-letter">${o.key}</div>
                <div class="opt-text">
                    ${o.text || ""}
                    ${o.key === q.correct_option ? ' <b style="color:#16a34a; margin-left:8px;">(Correct Answer)</b>' : ''}
                    ${isUserSelected && o.key !== q.correct_option ? ' <b style="color:#ef4444; margin-left:8px;">(Your Answer)</b>' : ''}
                    ${isUserSelected && o.key === q.correct_option ? ' <b style="color:#16a34a; margin-left:8px;">(Your Answer - Correct)</b>' : ''}
                </div>
            </div>
        `;
    }).join("");

    document.getElementById("btnPrev").disabled = index === 0;
    const isLast = index === total - 1;
    document.getElementById("btnNext").textContent = isLast ? "Finish Review" : "Next →";
    document.getElementById("btnNext").onclick = isLast ? () => window.location.href='student-quizzes.html' : nextQ;

    updateDots();
}

/* =========================
   HELPERS
=========================*/
function show(id) {
  ["loadingState","alreadyState","quizScreen","resultScreen"].forEach(s => {
    const el = document.getElementById(s);
    if (el) el.style.display = s === id ? "block" : "none";
  });
}
