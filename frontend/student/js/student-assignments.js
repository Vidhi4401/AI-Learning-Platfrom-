const API = "http://127.0.0.1:8000/api/v1";

let allAssignments = []; // { assignment, topic_title, course_title, course_id, submission }

document.addEventListener("DOMContentLoaded", loadData);

async function loadData() {
  try {
    // 1. Get enrollments
    const enrRes = await fetch(`${API}/student/enrollments`, {
      headers: { Authorization: "Bearer " + token }
    });
    if (!enrRes.ok) throw new Error("enrollments failed");
    const enrollments = await enrRes.json();

    if (enrollments.length === 0) { showEmpty(); return; }

    // 2. Get course details for each enrollment
    const courses = (await Promise.all(
      enrollments.map(e =>
        fetch(`${API}/student/courses/${e.course_id}/detail`, {
          headers: { Authorization: "Bearer " + token }
        }).then(r => r.ok ? r.json() : null)
      )
    )).filter(Boolean);

    // 3. Populate course filter + build flat assignment list
    allAssignments = [];
    const sel = document.getElementById("courseFilter");

    courses.forEach(course => {
      if (![...sel.options].find(o => o.value == course.id)) {
        const opt = document.createElement("option");
        opt.value = course.id; opt.textContent = course.title;
        sel.appendChild(opt);
      }
      course.topics?.forEach(topic => {
        topic.assignments?.forEach(assign => {
          allAssignments.push({
            assignment:   assign,
            topic_title:  topic.title,
            course_title: course.title,
            course_id:    course.id,
            submission:   null
          });
        });
      });
    });

    // 4. Load submissions
    await loadSubmissions();

    // 5. Render
    renderAll("all");

  } catch (err) {
    console.error("loadData error:", err);
    document.getElementById("pendingList").innerHTML =
      `<div class="empty-state">⚠️ Failed to load assignments.</div>`;
    document.getElementById("completedList").innerHTML = "";
  }
}

async function loadSubmissions() {
  try {
    const res = await fetch(`${API}/student/assignment-submissions`, {
      headers: { Authorization: "Bearer " + token }
    });
    if (!res.ok) return;
    const subs = await res.json();
    const map  = {};
    subs.forEach(s => { map[s.assignment_id] = s; });
    allAssignments.forEach(item => {
      if (map[item.assignment.id]) item.submission = map[item.assignment.id];
    });
  } catch (_) {}
}

function renderAll(courseFilter) {
  let items = allAssignments;
  if (courseFilter !== "all") {
    items = allAssignments.filter(a => String(a.course_id) === String(courseFilter));
  }

  const pending   = items.filter(a => !a.submission);
  const completed = items.filter(a =>  a.submission);
  // submitted = has submission but no marks yet; graded = has obtained_marks
  const graded = completed;

  document.getElementById("pendingCount").textContent = pending.length;
  document.getElementById("gradedCount").textContent  = graded.length;

  renderPending(pending);
  renderCompleted(completed);
}

function renderPending(items) {
  const list = document.getElementById("pendingList");
  if (items.length === 0) {
    list.innerHTML = `<div class="empty-state">🎉 No pending assignments!</div>`;
    return;
  }
  list.innerHTML = "";
  items.forEach((item, i) => {
    const el = document.createElement("div");
    el.className = "assign-item";
    el.style.animationDelay = `${i * 0.06}s`;
    el.innerHTML = `
      <div class="assign-status-icon pending">⏳</div>
      <div class="assign-info">
        <div class="assign-course">${item.course_title}</div>
        <div class="assign-title">${item.assignment.title}</div>
        <div class="assign-topic">${item.topic_title}</div>
        <div class="assign-meta">
          <span>📝 Total Marks: ${item.assignment.total_marks}</span>
        </div>
      </div>
      <div class="assign-right">
        <button class="btn-submit-assign"
          onclick="window.location.href='student-assignment-submit.html?id=${item.assignment.id}'">
          Submit
        </button>
      </div>
    `;
    list.appendChild(el);
  });
}

function renderCompleted(items) {
  const list = document.getElementById("completedList");
  if (items.length === 0) {
    list.innerHTML = `<div class="empty-state">📝 No submitted assignments yet.</div>`;
    return;
  }
  list.innerHTML = "";
  items.forEach((item, i) => {
    const s        = item.submission;
    const obtained = s.obtained_marks;
    const total    = item.assignment.total_marks;
    const isGraded = obtained !== null && obtained !== undefined;
    const pct      = isGraded ? Math.round((obtained / total) * 100) : null;
    const pctClass = pct >= 70 ? "high" : pct >= 50 ? "medium" : "low";
    const date     = s.submitted_at
      ? new Date(s.submitted_at).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })
      : "--";

    const el = document.createElement("div");
    el.className = "assign-item";
    el.style.animationDelay = `${i * 0.06}s`;
    el.innerHTML = `
      <div class="assign-status-icon ${isGraded ? "graded" : "pending"}">
        ${isGraded ? "✓" : "↓"}
      </div>
      <div class="assign-info">
        <div class="assign-course">${item.course_title}</div>
        <div class="assign-title">${item.assignment.title}</div>
        <div class="assign-topic">${item.topic_title}</div>
        <div class="assign-meta">
          <span>📅 Submitted: ${date}</span>
          <span>📝 Total: ${total} marks</span>
        </div>
        ${isGraded ? `
          <div class="score-bar-wrap">
            <div class="score-bar ${pctClass}" style="width:${pct}%"></div>
          </div>
          ${s.feedback ? `<div class="assign-feedback">💬 ${s.feedback}</div>` : ""}
        ` : `<div style="margin-top:8px;font-size:12.5px;color:var(--muted);">⏳ Grading in progress…</div>`}
      </div>
      <div class="assign-right" style="display:flex;flex-direction:column;align-items:flex-end;gap:10px;">
        ${isGraded ? `
          <div class="assign-marks-big">${obtained}/${total}</div>
          <div class="assign-marks-label">Score</div>
          <div class="assign-pct ${pctClass}">${pct}%</div>
        ` : `<div style="font-size:13px;color:var(--muted);font-weight:600;">Pending</div>`}
        ${s.can_resubmit ? `
          <button class="btn-submit-assign" style="font-size:12px;padding:7px 14px;"
            onclick="window.location.href='student-assignment-submit.html?id=${item.assignment.id}'">
            🔄 Resubmit
          </button>
          <div style="font-size:11px;color:var(--muted);">Attempt ${s.attempt_count}/2</div>
        ` : `<div style="font-size:11px;color:#ef4444;font-weight:600;">Max attempts reached</div>`}
      </div>
    `;
    list.appendChild(el);
  });
}

function showEmpty() {
  document.getElementById("pendingCount").textContent = 0;
  document.getElementById("gradedCount").textContent  = 0;
  document.getElementById("pendingList").innerHTML      =
    `<div class="empty-state">📚 Enroll in courses to see assignments here.</div>`;
  document.getElementById("completedList").innerHTML    = "";
}

function filterByCourse() {
  renderAll(document.getElementById("courseFilter").value);
}