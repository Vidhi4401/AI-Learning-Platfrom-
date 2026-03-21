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
    const token = localStorage.getItem("token");
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
  const scopedVideoProg = allVideoProg.filter(p => videoIds.has(p.video_id));
  const completedVids  = scopedVideoProg.filter(p => (p.watch_percentage || 0) >= 80).length;
  const videoCompPct   = totalVideos > 0 ? Math.round((completedVids / totalVideos) * 100) : 0;

  // Additional rates for ML sync
  const totalQuizzes    = quizIds.size;
  const quizAttemptPct  = totalQuizzes > 0 ? Math.round((attempts.length / totalQuizzes) * 100) : 0;
  const totalAssigns    = assignIds.size;
  const subPct          = totalAssigns > 0 ? Math.round((submissions.length / totalAssigns) * 100) : 0;
  
  const overallPct = avg([quizAvg, assignAvg, videoCompPct].filter(x => x > 0)) || 0;

  // ── LOCAL AI LEVEL CALCULATION (Dynamic for UI) ──
  let displayLevel = "Weak";
  if (overallPct >= 70) displayLevel = "Strong";
  else if (overallPct >= 40) displayLevel = "Average";

  const levelEl = document.getElementById("aiLearnerLevel");
  const descEl  = document.getElementById("levelDesc");
  if (levelEl) {
      levelEl.textContent = displayLevel;
      // Styling
      levelEl.style.background = displayLevel === "Strong" ? "#dcfce7" : (displayLevel === "Average" ? "#fef3c7" : "#fee2e2");
      levelEl.style.color = displayLevel === "Strong" ? "#166534" : (displayLevel === "Average" ? "#92400e" : "#991b1b");
      
      if (descEl) {
          if (displayLevel === "Strong") descEl.textContent = "Outstanding work! High engagement.";
          else if (displayLevel === "Average") descEl.textContent = "Good progress. On the right track.";
          else descEl.textContent = "Foundational review recommended.";
      }
  }

  // ── Stat Cards ──
  document.getElementById("statOverall").textContent    = fmt(overallPct);
  document.getElementById("statCompletion").textContent = fmt(videoCompPct);
  document.getElementById("statQuiz").textContent       = fmt(quizAvg);
  document.getElementById("statAssign").textContent     = fmt(assignAvg);

  // ── ML Feature Sync ──
  if (courseFilter === "all") {
    const avgWatchTime = scopedVideoProg.length > 0 
        ? avg(scopedVideoProg.map(p => p.watch_time || 0)) 
        : 0;

    const totalVids = videoIds.size;
    syncPerformanceToDB({
        overall_score: parseFloat(overallPct.toFixed(1)),
        quiz_average: parseFloat(quizAvg.toFixed(1)),
        assignment_average: parseFloat(assignAvg.toFixed(1)),
        completion_rate: parseFloat(videoCompPct.toFixed(1)),
        avg_watch_time: parseFloat(avgWatchTime.toFixed(1)),
        quiz_attempt_rate: parseFloat(quizAttemptPct.toFixed(1)),
        assignment_submission_rate: parseFloat(subPct.toFixed(1)),
        // Raw Counts
        videos_completed: parseInt(completedVids),
        quizzes_attempted: parseInt(attempts.length),
        assignments_submitted: parseInt(submissions.length),
        total_course_items: parseInt(totalVids + totalQuizzes + totalAssigns),
        is_global: (courseFilter === "all")
    });
  }

  // ── Charts ──
  try {
    renderCourseChart(courses, attempts, submissions);
    renderSkillChart(courses, attempts, submissions);
    renderEngagement(courses, attempts, submissions, videoIds);
    renderInsights(quizAvg, assignAvg, videoCompPct, attempts, submissions, courses);
  } catch (err) {
    console.error("Chart rendering error:", err);
  }
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
  const emptyEl = document.getElementById("courseEmpty");
  const chartEl = document.getElementById("courseChart");
  if (emptyEl) emptyEl.style.display = isEmpty ? "block" : "none";
  if (chartEl) chartEl.style.display = isEmpty ? "none"  : "block";
  if (isEmpty || !chartEl) return;

  if (courseChart) courseChart.destroy();
  courseChart = new Chart(chartEl, {
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

  topicScores.sort((a, b) => b.score - a.score);
  const top = topicScores.slice(0, 10);

  const isEmpty = top.length === 0;
  const emptyEl = document.getElementById("skillEmpty");
  const chartEl = document.getElementById("skillChart");
  if (emptyEl) emptyEl.style.display = isEmpty ? "block" : "none";
  if (chartEl) chartEl.style.display = isEmpty ? "none"  : "block";
  if (isEmpty || !chartEl) return;

  const colors = top.map(t => t.score >= 80 ? "#10b981" : t.score >= 60 ? "#f59e0b" : "#ef4444");

  if (skillChart) skillChart.destroy();
  skillChart = new Chart(chartEl, {
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
  const totalQuizzes    = new Set(courses.flatMap(c => c.topics?.flatMap(t => t.quizzes?.map(q => q.id)||[])||[])).size;
  const attemptedQuizzes= attempts.length;
  const quizAttemptPct  = totalQuizzes > 0 ? Math.round((attemptedQuizzes / totalQuizzes) * 100) : 0;
  const quizScoreAvg    = Math.round(avg(attempts.map(a => a.percentage || 0)));

  setDonut("quizDonut",  attemptedQuizzes, totalQuizzes, "#14b8a6");
  document.getElementById("quizCenter").textContent    = `${attemptedQuizzes}/${totalQuizzes}`;
  document.getElementById("quizPct").textContent       = quizAttemptPct + "%";
  document.getElementById("quizBar").style.width       = quizAttemptPct + "%";
  document.getElementById("quizScoreBar").style.width  = quizScoreAvg + "%";
  document.getElementById("quizScorePct").textContent  = quizScoreAvg + "%";
  document.getElementById("quizAttempted").textContent = attemptedQuizzes;
  document.getElementById("quizTotal").textContent     = totalQuizzes;

  const totalAssigns   = new Set(courses.flatMap(c => c.topics?.flatMap(t => t.assignments?.map(a=>a.id)||[])||[])).size;
  const submittedCount = submissions.length;
  const subPct         = totalAssigns > 0 ? Math.round((submittedCount / totalAssigns) * 100) : 0;
  const assignScoreAvg = Math.round(avg(submissions.map(s => {
    const a = courses.flatMap(c => c.topics||[]).flatMap(t => t.assignments||[]).find(x => x.id === s.assignment_id);
    return a ? ((s.obtained_marks||0) / (a.total_marks||1)) * 100 : 0;
  })));

  setDonut("assignDonut", submittedCount, totalAssigns, "#8b5cf6");
  document.getElementById("assignCenter").textContent      = `${submittedCount}/${totalAssigns}`;
  document.getElementById("assignBar").style.width         = subPct + "%";
  document.getElementById("assignPct").textContent         = subPct + "%";
  document.getElementById("assignScoreBar").style.width    = assignScoreAvg + "%";
  document.getElementById("assignScorePct").textContent    = assignScoreAvg + "%";
  document.getElementById("assignSubmitted").textContent   = submittedCount;
  document.getElementById("assignPending").textContent     = Math.max(0, totalAssigns - submittedCount);

  const totalVids = videoIds.size;
  const scopedProgress = allVideoProg.filter(p => videoIds.has(p.video_id));
  const completedVids = scopedProgress.filter(p => (p.watch_percentage || 0) >= 80).length;
  const videoCompPct = totalVids > 0 ? Math.round((completedVids / totalVids) * 100) : 0;
  const avgWatch      = scopedProgress.length > 0 ? Math.round(avg(scopedProgress.map(p => p.watch_percentage || 0))) : 0;

  setDonut("videoDonut", completedVids, totalVids, "#3b82f6");
  document.getElementById("videoCenter").textContent  = `${completedVids}/${totalVids}`;
  document.getElementById("videoBar").style.width     = videoCompPct + "%";
  document.getElementById("videoPct").textContent     = videoCompPct + "%";
  document.getElementById("watchBar").style.width     = avgWatch + "%";
  document.getElementById("watchPct").textContent     = avgWatch + "%";
  document.getElementById("videoWeek").textContent    = completedVids;
  document.getElementById("videoTotal").textContent   = totalVids;
}

/* ============================================================
   DONUT CHART HELPER
============================================================*/
function setDonut(canvasId, done, total, color) {
  const remaining = Math.max(0, total - done);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  
  try {
    const existing = Chart.getChart(ctx);
    if (existing) existing.destroy();
    
    new Chart(ctx, {
      type: "doughnut",
      data: {
        datasets: [{
          data:            [done, remaining || 0.0001], 
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
  } catch (err) {
    console.error(`[Donut] Error rendering ${canvasId}:`, err);
  }
}

/* ============================================================
   INSIGHTS
============================================================*/
function renderInsights(quizAvg, assignAvg, videoCompPct, attempts, submissions, courses) {
  const strengths = [];
  const improvements = [];
  const actions = [];

  if (quizAvg >= 75)   strengths.push("Strong quiz performance with consistent scores");
  if (assignAvg >= 75) strengths.push("Excellent assignment scores");
  if (videoCompPct >= 70) strengths.push("Good video engagement and completion rate");

  const weakTopics = [];
  courses.forEach(c => {
    c.topics?.forEach(t => {
      const qIds = new Set(t.quizzes?.map(q => q.id)||[]);
      const topicAttempts = attempts.filter(a => qIds.has(a.quiz_id));
      if (topicAttempts.length > 0 && avg(topicAttempts.map(a => a.percentage||0)) < 60) weakTopics.push(t.title);
    });
  });

  const pendingAssigns = courses.flatMap(c => c.topics||[]).flatMap(t => t.assignments||[])
    .filter(a => !submissions.find(s => s.assignment_id === a.id)).length;

  if (quizAvg > 0 && quizAvg < 60)  improvements.push(`Quiz average is below 60% — needs improvement`);
  if (pendingAssigns > 0) improvements.push(`${pendingAssigns} assignment(s) still pending`);
  if (weakTopics.length > 0) improvements.push(`Weak performance in: ${weakTopics.slice(0,3).join(", ")}`);

  if (pendingAssigns > 0) actions.push("Complete pending assignments.");
  if (weakTopics.length > 0) actions.push(`Review materials for: ${weakTopics[0]}.`);
  if (actions.length === 0) actions.push("Keep up the excellent work! Stay consistent.");

  const sList = document.getElementById("strengthsList");
  const iList = document.getElementById("improveList");
  const aList = document.getElementById("actionsList");

  if (sList) sList.innerHTML = strengths.map(s => `<li>${s}</li>`).join("") || "<li>Continue learning!</li>";
  if (iList) iList.innerHTML = improvements.map(s => `<li>${s}</li>`).join("") || "<li>Doing great!</li>";
  if (aList) aList.innerHTML = actions.map(a => `<li>${a}</li>`).join("");

  const overall = avg([quizAvg, assignAvg].filter(x => x > 0));
  const banner = document.getElementById("motivateBanner");
  if (banner) {
    if (overall >= 80) banner.innerHTML = "<strong>🏆 Outstanding Performance!</strong><span>Keep it up!</span>";
    else banner.innerHTML = "<strong> Keep working hard!</strong><span>Making progress.</span>";
  }
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

async function syncPerformanceToDB(metrics) {
    const token = localStorage.getItem("token");
    const user  = JSON.parse(localStorage.getItem("user"));
    if (!token || !user) return;
    
    try {
        const res = await fetch(`${API}/student/update-performance`, {
            method: "POST",
            headers: { 
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(metrics)
        });
        
        if (res.ok) {
            const data = await res.json();
            const levelEl = document.getElementById("aiLearnerLevel");
            const descEl  = document.getElementById("levelDesc");
            
            if (levelEl && data.level) {
                levelEl.textContent = data.level;
                // Styling
                levelEl.style.background = data.level === "Strong" ? "#dcfce7" : (data.level === "Average" ? "#fef3c7" : "#fee2e2");
                levelEl.style.color = data.level === "Strong" ? "#166534" : (data.level === "Average" ? "#92400e" : "#991b1b");
                
                if (descEl) {
                    if (data.level === "Strong") descEl.textContent = "Outstanding work! High engagement.";
                    else if (data.level === "Average") descEl.textContent = "Good progress. On the right track.";
                    else descEl.textContent = "Foundational review recommended.";
                }
            }
        }
    } catch (err) {
        console.error("Sync error", err);
    }
}
