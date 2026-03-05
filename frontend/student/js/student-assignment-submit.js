const API    = "http://127.0.0.1:8000/api/v1";
const params = new URLSearchParams(window.location.search);
const assignId = params.get("id");
if (!assignId) window.location.href = "student-assignments.html";

let assignData = null;

document.addEventListener("DOMContentLoaded", loadAssignment);

/* =========================
   LOAD ASSIGNMENT DETAIL
=========================*/
async function loadAssignment() {
  try {
    // Check submissions — block only if 2 attempts used
    const subRes = await fetch(`${API}/student/assignment-submissions`, {
      headers: { Authorization: "Bearer " + token }
    });
    if (subRes.ok) {
      const subs = await subRes.json();
      const existing = subs.find(s => s.assignment_id == assignId);
      if (existing && !existing.can_resubmit) {
        show("alreadyState"); return;
      }
      if (existing) {
        // Has 1 attempt — show attempt badge
        window._attemptCount = existing.attempt_count || 1;
      }
    }

    // Load assignment detail
    const res = await fetch(`${API}/student/assignments/${assignId}`, {
      headers: { Authorization: "Bearer " + token }
    });
    if (!res.ok) throw new Error("Assignment not found");
    assignData = await res.json();

    renderHeader(assignData);
    show("submitScreen");

    // Character counter
    document.getElementById("answerBox").addEventListener("input", function() {
      document.getElementById("charCount").textContent =
        `${this.value.length} characters`;
    });

  } catch (err) {
    console.error("loadAssignment error:", err);
    document.getElementById("loadingState").innerHTML =
      `<p style="text-align:center;padding:60px;color:red;">Failed to load assignment.</p>`;
  }
}

/* =========================
   RENDER HEADER
=========================*/
function renderHeader(data) {
  document.title = data.title;
  document.getElementById("heroCourse").textContent  = data.course_title || "Course";
  document.getElementById("assignTitle").textContent = data.title;
  document.getElementById("assignTopic").textContent = `Topic: ${data.topic_title || "—"}`;
  document.getElementById("heroMarks").innerHTML =
    `${data.total_marks}<span>Total Marks</span>`;

  // Show attempt badge
  const attempts = window._attemptCount || 0;
  const attemptsLeft = 2 - attempts;
  const badge = document.createElement("div");
  badge.style.cssText = "margin-top:12px;font-size:13px;color:var(--muted);";
  badge.innerHTML = attempts > 0
    ? `<span style="background:#fef9c3;color:#854d0e;padding:4px 12px;border-radius:20px;font-weight:600;font-size:12px;">
        Attempt ${attempts}/2 used &nbsp;·&nbsp; ${attemptsLeft} remaining
       </span>`
    : `<span style="background:#dcfce7;color:#166534;padding:4px 12px;border-radius:20px;font-weight:600;font-size:12px;">
        2 attempts allowed
       </span>`;
  document.querySelector(".assign-hero").appendChild(badge);

  if (data.description) {
    document.getElementById("descPanel").style.display = "block";
    document.getElementById("assignDesc").textContent  = data.description;
  }
}

/* =========================
   SUBMIT ASSIGNMENT
=========================*/
async function submitAssignment() {
  const answer = document.getElementById("answerBox").value.trim();
  if (!answer) {
    alert("Please write your answer before submitting.");
    return;
  }

  const btn    = document.getElementById("btnSubmit");
  btn.disabled = true;
  btn.textContent = "⏳ Grading…";

  // Show grading overlay
  showGradingOverlay(true);

  try {
    const res = await fetch(`${API}/student/assignments/${assignId}/submit`, {
      method:  "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type":  "application/json"
      },
      body: JSON.stringify({ student_answer: answer })
    });

    showGradingOverlay(false);

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Submission failed");
    }

    const result = await res.json();
    showResult(result);

  } catch (err) {
    showGradingOverlay(false);
    console.error("Submit error:", err);
    btn.disabled    = false;
    btn.textContent = "🚀 Submit & Grade";
    alert(err.message || "Submission failed. Please try again.");
  }
}

/* =========================
   SHOW RESULT
=========================*/
function showResult(r) {
  show("resultScreen");

  const obtained = r.obtained_marks ?? 0;
  const total    = r.total_marks    ?? assignData?.total_marks ?? 10;
  const pct      = Math.round((obtained / total) * 100);
  const feedback = r.feedback || "No feedback provided.";

  // Emoji + heading
  let emoji = "📚", heading = "Keep Practicing!";
  if      (pct >= 80) { emoji = "🏆"; heading = "Excellent Work!"; }
  else if (pct >= 60) { emoji = "👍"; heading = "Good Job!"; }
  else if (pct >= 40) { emoji = "📖"; heading = "Needs Improvement"; }

  document.getElementById("resultEmoji").textContent   = emoji;
  document.getElementById("resultHeading").textContent = heading;
  document.getElementById("resultScore").textContent   = obtained;
  document.getElementById("resultTotal").textContent   = `/ ${total}`;
  document.getElementById("resultPct").textContent     = `${pct}%`;
  document.getElementById("feedbackText").textContent  = feedback;

  // Score bar color
  const barColor = pct >= 70 ? "#16a34a" : pct >= 50 ? "#d97706" : "#ef4444";
  const bar      = document.getElementById("resultBar");
  bar.style.background = barColor;
  // Animate width after brief delay
  setTimeout(() => { bar.style.width = pct + "%"; }, 100);

  // Result pct color
  document.getElementById("resultPct").style.color = barColor;
}

/* =========================
   GRADING OVERLAY
=========================*/
function showGradingOverlay(show) {
  let overlay = document.getElementById("gradingOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id        = "gradingOverlay";
    overlay.className = "grading-overlay";
    overlay.innerHTML = `
      <div class="grading-box">
        <div class="spinner"></div>
        <h3>Grading your answer…</h3>
        <p>AI is reviewing your submission</p>
      </div>`;
    document.body.appendChild(overlay);
  }
  overlay.classList.toggle("show", show);
}

/* =========================
   HELPER
=========================*/
function show(id) {
  ["loadingState","alreadyState","submitScreen","resultScreen"].forEach(s => {
    document.getElementById(s).style.display = s === id ? "block" : "none";
  });
}