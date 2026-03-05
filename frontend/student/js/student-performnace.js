const API = "http://127.0.0.1:8000/api/v1";

// All raw data
let allCourses     = [];   // full course detail objects
let allAttempts    = [];   // quiz attempts
let allSubmissions = [];   // assignment submissions
let allVideoProg   = [];   // video progress records
let courseChart    = null;
let skillChart     = null;
let videoDonut     = null;
let assignDonut    = null;
let quizDonut      = null;

document.addEventListener("DOMContentLoaded", loadAll);

/* ============================================================
   LOAD ALL DATA
============================================================*/
async function loadAll() {
  try {
    // 1. Enrollments
    const enrRes = await fetch(`${API}/student/enrollments`, {
      headers: { Authorization: "Bearer " + token }
    });
    const enrollments = enrRes.ok ? await enrRes.json() : [];

    // 2. Course details
    allCourses = (await Promise.all(
      enrollments.map(e =>
        fetch(`${API}/student/courses/${e.course_id}/detail`, {
          headers: { Authorization: "Bearer " + token }
        }).then(r => r.ok ? r.json() : null)
      )
    )).filter(Boolean);

    // 3. Quiz attempts
    const attRes = await fetch(`${API}/student/quiz-attempts`, {
      headers: { Authorization: "Bearer " + token }
    });
    allAttempts = attRes.ok ? await attRes.json() : [];

    // 4. Assignment submissions
    const subRes = await fetch(`${API}/student/assignment-submissions`, {
      headers: { Authorization: "Bearer " + token }
    });
    allSubmissions = subRes.ok ? await subRes.json() : [];

    // 5. Video progress (all topics)
    const vpRes = await fetch(`${API}/student/video-progress-all`, {
      headers: { Authorization: "Bearer " + token }
    });
    allVideoProg = vpRes.ok ? await vpRes.json() : [];

    // 5. Populate course filter
    const sel = document.getElementById("courseFilter");
    allCourses.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id; opt.textContent = c.title;
      sel.appendChild(opt);
    });

    // 6. Render everything
    renderAll("all");

  } catch (err) {
    console.error("loadAll error:", err);
  }
}

/* ============================================================
   FILTER
============================================================*/
function applyFilter() {
  renderAll(document.getElementById("courseFilter").value);
}

/* ============================================================
   RENDER ALL
============================================================*/
function renderAll(courseFilter) {
  // Filter courses
  const courses = courseFilter === "all"
    ? allCourses
    : allCourses.filter(c => String(c.id) === String(courseFilter));

  // Collect all quiz IDs + assignment IDs in scope
  const quizIds   = new Set();
  const assignIds = new Set();
  const videoIds  = new Set();

  courses.forEach(c => {
    c.topics?.forEach(t => {
      t.quizzes?.forEach(q     => quizIds.add(q.id));
      t.assignments?.forEach(a => assignIds.add(a.id));
      t.videos?.forEach(v      => videoIds.add(v.id));
    });
  });

  // Filter attempts + submissions
  const attempts     = allAttempts.filter(a    => quizIds.has(a.quiz_id));
  const submissions  = allSubmissions.filter(s => assignIds.has(s.assignment_id));

  // Compute stats
  const quizAvg   = avg(attempts.map(a => a.percentage || 0));
  const assignAvg = avg(submissions.map(s => {
    const a = allCourses.flatMap(c => c.topics || [])
      .flatMap(t => t.assignments || [])
      .find(x => x.id === s.assignment_id);
    return a ? ((s.obtained_marks || 0) / (a.total_marks || 1)) * 100 : 0;
  }));

  const totalVideos    = videoIds.size;
  const completedVids  = 0; // video progress — use percentage ≥80 when loaded
  const videoCompPct   = totalVideos > 0 ? Math.round((completedVids / totalVideos) * 100) : 0;

  const overallPct = avg([quizAvg, assignAvg, videoCompPct].filter(x => x > 0)) || 0;

  // ── Stat Cards ──
  document.getElementById("statOverall").textContent    = fmt(overallPct);
  document.getElementById("statCompletion").textContent = fmt(videoCompPct);
  document.getElementById("statQuiz").textContent       = fmt(quizAvg);
  document.getElementById("statAssign").textContent     = fmt(assignAvg);

  // ── Charts ──
  renderCourseChart(courses, attempts, submissions);
  renderSkillChart(courses, attempts, submissions);

  // ── Engagement ──
  renderEngagement(courses, attempts, submissions, videoIds);

  // ── Insights ──
  renderInsights(quizAvg, assignAvg, videoCompPct, attempts, submissions, courses);
}

/* ============================================================
   COURSE COMPARISON CHART
============================================================*/
function renderCourseChart(courses, attempts, submissions) {
  const labels     = [];
  const assignData = [];
  const quizData   = [];

  courses.forEach(c => {
    const qIds = new Set(c.topics?.flatMap(t => t.quizzes?.map(q => q.id) || []) || []);
    const aIds = new Set(c.topics?.flatMap(t => t.assignments?.map(a => a.id) || []) || []);

    const courseAttempts   = attempts.filter(a    => qIds.has(a.quiz_id));
    const courseSubmissions= submissions.filter(s => aIds.has(s.assignment_id));

    const qAvg = avg(courseAttempts.map(a => a.percentage || 0));
    const aAvg = avg(courseSubmissions.map(s => {
      const a = c.topics?.flatMap(t => t.assignments || []).find(x => x.id === s.assignment_id);
      return a ? ((s.obtained_marks || 0) / (a.total_marks || 1)) * 100 : 0;
    }));

    if (qAvg > 0 || aAvg > 0) {
      labels.push(c.title.length > 18 ? c.title.substring(0, 16) + "…" : c.title);
      assignData.push(Math.round(aAvg));
      quizData.push(Math.round(qAvg));
    }
  });

  const isEmpty = labels.length === 0;
  document.getElementById("courseEmpty").style.display = isEmpty ? "block" : "none";
  document.querySelector("#courseChart").style.display = isEmpty ? "none"  : "block";
  if (isEmpty) return;

  if (courseChart) courseChart.destroy();
  courseChart = new Chart(document.getElementById("courseChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Assignment Score", data: assignData, backgroundColor: "#3b82f6", borderRadius: 6 },
        { label: "Quiz Score",       data: quizData,   backgroundColor: "#8b5cf6", borderRadius: 6 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { font: { size: 12 } } } },
      scales: {
        y: { min: 0, max: 100, ticks: { callback: v => v + "%" }, grid: { color: "#f3f4f6" } },
        x: { grid: { display: false } }
      }
    }
  });
}

/* ============================================================
   SKILL MASTERY CHART (per topic)
============================================================*/
function renderSkillChart(courses, attempts, submissions) {
  const topicScores = [];

  courses.forEach(c => {
    c.topics?.forEach(t => {
      const qIds = new Set(t.quizzes?.map(q => q.id) || []);
      const aIds = new Set(t.assignments?.map(a => a.id) || []);

      const tAttempts    = attempts.filter(a    => qIds.has(a.quiz_id));
      const tSubmissions = submissions.filter(s => aIds.has(s.assignment_id));

      const scores = [
        ...tAttempts.map(a => a.percentage || 0),
        ...tSubmissions.map(s => {
          const a = t.assignments?.find(x => x.id === s.assignment_id);
          return a ? ((s.obtained_marks || 0) / (a.total_marks || 1)) * 100 : 0;
        })
      ];

      if (scores.length > 0) {
        topicScores.push({ label: t.title, score: Math.round(avg(scores)) });
      }
    });
  });

  // Sort descending
  topicScores.sort((a, b) => b.score - a.score);
  const top = topicScores.slice(0, 10);

  const isEmpty = top.length === 0;
  document.getElementById("skillEmpty").style.display = isEmpty ? "block" : "none";
  document.querySelector("#skillChart").style.display = isEmpty ? "none"  : "block";
  if (isEmpty) return;

  const colors = top.map(t =>
    t.score >= 80 ? "#10b981" : t.score >= 60 ? "#f59e0b" : "#ef4444"
  );

  if (skillChart) skillChart.destroy();
  skillChart = new Chart(document.getElementById("skillChart"), {
    type: "bar",
    data: {
      labels: top.map(t => t.label.length > 14 ? t.label.substring(0,12)+"…" : t.label),
      datasets: [{
        label: "Accuracy (%)",
        data:  top.map(t => t.score),
        backgroundColor: colors,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 0, max: 100, ticks: { callback: v => v + "%" }, grid: { color: "#f3f4f6" } },
        x: { grid: { display: false }, ticks: { font: { size: 11 } } }
      }
    }
  });
}

/* ============================================================
   ENGAGEMENT SECTION
============================================================*/
function renderEngagement(courses, attempts, submissions, videoIds) {
  // ── QUIZZES ──
  const totalQuizzes    = new Set(courses.flatMap(c => c.topics?.flatMap(t => t.quizzes?.map(q => q.id)||[])||[])).size;
  const attemptedQuizzes= attempts.length;
  const quizAttemptPct  = totalQuizzes > 0 ? Math.round((attemptedQuizzes / totalQuizzes) * 100) : 0;
  const quizScoreAvg    = Math.round(avg(attempts.map(a => a.percentage || 0)));

  setDonut("quizDonut",  attemptedQuizzes, totalQuizzes, "#14b8a6");
  document.getElementById("quizCenter").textContent    = `${attemptedQuizzes}/${totalQuizzes}`;
  document.getElementById("quizBar").style.width       = quizAttemptPct + "%";
  document.getElementById("quizPct").textContent       = quizAttemptPct + "%";
  document.getElementById("quizScoreBar").style.width  = quizScoreAvg + "%";
  document.getElementById("quizScorePct").textContent  = quizScoreAvg + "%";
  document.getElementById("quizAttempted").textContent = attemptedQuizzes;
  document.getElementById("quizTotal").textContent     = totalQuizzes;

  // ── ASSIGNMENTS ──
  const totalAssigns   = new Set(courses.flatMap(c => c.topics?.flatMap(t => t.assignments?.map(a=>a.id)||[])||[])).size;
  const submittedCount = submissions.length;
  const subPct         = totalAssigns > 0 ? Math.round((submittedCount / totalAssigns) * 100) : 0;
  const assignScoreAvg = Math.round(avg(submissions.map(s => {
    const a = courses.flatMap(c => c.topics||[]).flatMap(t => t.assignments||[]).find(x => x.id === s.assignment_id);
    return a ? ((s.obtained_marks||0) / (a.total_marks||1)) * 100 : 0;
  })));
  const pendingCount = totalAssigns - submittedCount;

  setDonut("assignDonut", submittedCount, totalAssigns, "#8b5cf6");
  document.getElementById("assignCenter").textContent      = `${submittedCount}/${totalAssigns}`;
  document.getElementById("assignBar").style.width         = subPct + "%";
  document.getElementById("assignPct").textContent         = subPct + "%";
  document.getElementById("assignScoreBar").style.width    = assignScoreAvg + "%";
  document.getElementById("assignScorePct").textContent    = assignScoreAvg + "%";
  document.getElementById("assignSubmitted").textContent   = submittedCount;
  document.getElementById("assignPending").textContent     = Math.max(0, pendingCount);

  // ── VIDEOS — use real progress (video_id based) ──
  // Collect all video_ids in scope from enrolled courses
  const allVideoIds = new Set(
    courses.flatMap(c => c.topics?.flatMap(t => t.videos?.map(v => v.id) || []) || [])
  );
  const totalVids = allVideoIds.size;

  // Filter progress records to only enrolled course videos
  const scopedProgress = allVideoProg.filter(p => allVideoIds.has(p.video_id));

  // A video is "completed" if watch_percentage >= 80
  const completedVids = scopedProgress.filter(p => (p.watch_percentage || 0) >= 80).length;
  const videoCompPct2 = totalVids > 0 ? Math.round((completedVids / totalVids) * 100) : 0;
  const avgWatch      = scopedProgress.length > 0
    ? Math.round(avg(scopedProgress.map(p => p.watch_percentage || 0)))
    : 0;

  setDonut("videoDonut", completedVids, totalVids, "#3b82f6");
  document.getElementById("videoCenter").textContent  = `${completedVids}/${totalVids}`;
  document.getElementById("videoBar").style.width     = videoCompPct2 + "%";
  document.getElementById("videoPct").textContent     = videoCompPct2 + "%";
  document.getElementById("watchBar").style.width     = avgWatch + "%";
  document.getElementById("watchPct").textContent     = avgWatch + "%";
  document.getElementById("videoWeek").textContent    = completedVids;
  document.getElementById("videoTotal").textContent   = totalVids;

  // Update stat card with real video completion
  document.getElementById("statCompletion").textContent = videoCompPct2 + "%";
}

/* ============================================================
   DONUT CHART HELPER
============================================================*/
function setDonut(canvasId, done, total, color) {
  const remaining = Math.max(0, total - done);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  // Destroy existing
  const existing = Chart.getChart(ctx);
  if (existing) existing.destroy();

  new Chart(ctx, {
    type: "doughnut",
    data: {
      datasets: [{
        data:            [done, remaining || 1],
        backgroundColor: [color, "#e5e7eb"],
        borderWidth:     0,
        hoverOffset:     4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      cutout: "72%",
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }
  });
}

/* ============================================================
   INSIGHTS
============================================================*/
function renderInsights(quizAvg, assignAvg, videoCompPct, attempts, submissions, courses) {
  const strengths = [];
  const improvements = [];
  const actions = [];

  // Strengths
  if (quizAvg >= 75)   strengths.push("Strong quiz performance with consistent scores");
  if (assignAvg >= 75) strengths.push("Excellent assignment scores");
  if (videoCompPct >= 70) strengths.push("Good video engagement and completion rate");
  if (attempts.length > 0 && attempts.every(a => (a.percentage||0) >= 60))
    strengths.push("Passing all attempted quizzes");

  // Find weak topics
  const weakTopics = [];
  courses.forEach(c => {
    c.topics?.forEach(t => {
      const qIds = new Set(t.quizzes?.map(q => q.id)||[]);
      const topicAttempts = attempts.filter(a => qIds.has(a.quiz_id));
      if (topicAttempts.length > 0) {
        const topicAvg = avg(topicAttempts.map(a => a.percentage||0));
        if (topicAvg < 60) weakTopics.push(t.title);
      }
    });
  });

  const pendingAssigns = courses.flatMap(c => c.topics||[])
    .flatMap(t => t.assignments||[])
    .filter(a => !submissions.find(s => s.assignment_id === a.id)).length;

  // Improvements
  if (quizAvg > 0 && quizAvg < 60)  improvements.push(`Quiz average is below 60% — needs improvement`);
  if (assignAvg > 0 && assignAvg < 60) improvements.push(`Assignment average is below 60%`);
  if (pendingAssigns > 0)            improvements.push(`${pendingAssigns} assignment(s) still pending`);
  if (weakTopics.length > 0)         improvements.push(`Weak performance in: ${weakTopics.slice(0,3).join(", ")}`);
  if (videoCompPct < 50 && videoCompPct >= 0) improvements.push("Video completion rate can be improved");

  // Actions
  if (pendingAssigns > 0) actions.push("Complete pending assignments to maintain good academic standing.");
  if (weakTopics.length > 0) actions.push(`Review topic materials for: ${weakTopics[0]}.`);
  if (quizAvg < 70 && quizAvg > 0)  actions.push("Re-attempt weak quizzes to reinforce understanding.");
  if (videoCompPct < 80)  actions.push("Watch remaining videos to improve completion rate.");
  if (actions.length === 0) actions.push("Keep up the excellent work! Stay consistent.");

  // Render
  const sl = document.getElementById("strengthsList");
  const il = document.getElementById("improveList");
  const al = document.getElementById("actionsList");

  sl.innerHTML = strengths.length
    ? strengths.map(s => `<li>${s}</li>`).join("")
    : "<li>Complete more quizzes and assignments to see your strengths.</li>";

  il.innerHTML = improvements.length
    ? improvements.map(s => `<li>${s}</li>`).join("")
    : "<li>No major areas of concern — keep going!</li>";

  al.innerHTML = actions.map((a, i) => `<li>${a}</li>`).join("");

  // Motivational banner
  const banner = document.getElementById("motivateBanner");
  let msg = "", sub = "";
  const overall = avg([quizAvg, assignAvg].filter(x => x > 0));
  if (overall >= 80) {
    msg = "🏆 Outstanding Performance!";
    sub = "You're in the top tier. Keep pushing your limits and inspiring others.";
  } else if (overall >= 60) {
    msg = "👍 Keep Up the Good Work!";
    sub = "You're making great progress. Continue engaging with course materials to reach excellence.";
  } else if (overall > 0) {
    msg = "📚 Every Expert Was Once a Beginner";
    sub = "Focus on the weak areas and you'll see improvement very soon. You can do this!";
  } else {
    msg = "🚀 Start Your Learning Journey!";
    sub = "Attempt some quizzes and submit assignments to track your performance here.";
  }
  banner.innerHTML = `<strong>${msg}</strong><span>${sub}</span>`;
}

/* ============================================================
   HELPERS
============================================================*/
function avg(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function fmt(val) {
  return val > 0 ? Math.round(val) + "%" : "N/A";
}