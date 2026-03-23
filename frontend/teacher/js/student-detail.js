const API = "http://127.0.0.1:8000/api/v1";
const params = new URLSearchParams(window.location.search);
const studentId = params.get("id");

// All raw data
let allCourses     = [];
let allAttempts    = [];
let allSubmissions = [];
let allVideoProg   = [];
let studentRisk    = "Low"; 
let courseChart    = null;
let skillChart     = null;
let videoDonut     = null;
let assignDonut    = null;
let quizDonut      = null;

document.addEventListener("DOMContentLoaded", () => {
    if (!studentId) {
        window.location.href = "students.html";
        return;
    }
    loadAllData();
});

async function loadAllData() {
    const token = localStorage.getItem("token");
    try {
        // 1. Get Student Basic Info
        const infoRes = await fetch(`${API}/teacher/students/${studentId}/detail`, {
            headers: { Authorization: "Bearer " + token }
        });
        const info = await infoRes.json();
        document.getElementById("studentNameHeader").textContent = `${info.name}'s Performance`;
        studentRisk = info.dropout_risk || "Low"; 

        // 2. Course details (Teacher view already handles org-level access)
        const coursesRes = await fetch(`${API}/teacher/courses`, {
            headers: { Authorization: "Bearer " + token }
        });
        const coursesList = await coursesRes.json();
        
        // Fetch full detail for each course to get topics (mirrors student portal)
        allCourses = (await Promise.all(
            coursesList.map(c => 
                fetch(`${API}/teacher/courses/${c.id}`, { headers: { Authorization: "Bearer " + token } })
                .then(r => r.ok ? r.json() : null)
            )
        )).filter(Boolean);

        // 3. Raw behavior data for this specific student
        const attRes = await fetch(`${API}/teacher/students/${studentId}/quiz-attempts`, {
            headers: { Authorization: "Bearer " + token }
        });
        allAttempts = await attRes.json();

        const subRes = await fetch(`${API}/teacher/students/${studentId}/assignment-submissions`, {
            headers: { Authorization: "Bearer " + token }
        });
        allSubmissions = await subRes.json();

        const vpRes = await fetch(`${API}/teacher/students/${studentId}/video-progress`, {
            headers: { Authorization: "Bearer " + token }
        });
        allVideoProg = await vpRes.json();

        // 4. Populate course filter
        const sel = document.getElementById("courseFilter");
        allCourses.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id; opt.textContent = c.title;
            sel.appendChild(opt);
        });

        renderAll("all");
        loadCertificates();

    } catch (err) {
        console.error("Data load failed", err);
    }
}

function applyFilter() {
    renderAll(document.getElementById("courseFilter").value);
}

function renderAll(courseFilter) {
    const courses = courseFilter === "all"
        ? allCourses
        : allCourses.filter(c => String(c.id) === String(courseFilter));

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

    const attempts     = allAttempts.filter(a    => quizIds.has(a.quiz_id));
    const submissions  = allSubmissions.filter(s => assignIds.has(s.assignment_id));

    // Stats
    const quizAvg   = avg(attempts.map(a => a.percentage || 0));
    const assignAvg = avg(submissions.map(s => {
        const a = allCourses.flatMap(c => c.topics || []).flatMap(t => t.assignments || []).find(x => x.id === s.assignment_id);
        return a ? ((s.obtained_marks || 0) / (a.total_marks || 1)) * 100 : 0;
    }));

    const totalVids = videoIds.size;
    const scopedVP = allVideoProg.filter(p => videoIds.has(p.video_id));
    const completedVids = scopedVP.filter(p => (p.watch_percentage || 0) >= 80).length;
    const videoCompPct = totalVids > 0 ? Math.round((completedVids / totalVids) * 100) : 0;

    const overallPct = avg([quizAvg, assignAvg, videoCompPct].filter(x => x > 0)) || 0;

    document.getElementById("statOverall").textContent = fmt(overallPct);
    document.getElementById("statQuiz").textContent = fmt(quizAvg);
    document.getElementById("statAssign").textContent = fmt(assignAvg);

    // Display Risk
    const riskEl = document.getElementById("statRisk");
    if (riskEl) {
        riskEl.textContent = studentRisk;
        riskEl.className = `stat-value risk-text-${studentRisk.toLowerCase()}`;
    }

    // AI Level Prediction (Pure Logic based on what we calculated)
    let predictedLevel = "Weak";
    if (overallPct >= 70) predictedLevel = "Strong";
    else if (overallPct >= 40) predictedLevel = "Average";
    
    const levelEl = document.getElementById("aiLearnerLevel");
    levelEl.textContent = predictedLevel;
    levelEl.style.color = predictedLevel === "Strong" ? "#16a34a" : (predictedLevel === "Average" ? "#d97706" : "#dc2626");

    // Charts
    renderCourseChart(courses, attempts, submissions);
    renderSkillChart(courses, attempts, submissions);
    renderEngagement(courses, attempts, submissions, videoIds);
    renderInsights(quizAvg, assignAvg, videoCompPct, attempts, submissions, courses);
}

function renderCourseChart(courses, attempts, submissions) {
    const labels = [];
    const assignData = [];
    const quizData = [];

    courses.forEach(c => {
        const qIds = new Set(c.topics?.flatMap(t => t.quizzes?.map(q => q.id) || []) || []);
        const aIds = new Set(c.topics?.flatMap(t => t.assignments?.map(a => a.id) || []) || []);
        const cAttempts = attempts.filter(a => qIds.has(a.quiz_id));
        const cSubmissions = submissions.filter(s => aIds.has(s.assignment_id));
        const qAvg = avg(cAttempts.map(a => a.percentage || 0));
        const aAvg = avg(cSubmissions.map(s => {
            const a = c.topics?.flatMap(t => t.assignments || []).find(x => x.id === s.assignment_id);
            return a ? ((s.obtained_marks || 0) / (a.total_marks || 1)) * 100 : 0;
        }));
        if (qAvg > 0 || aAvg > 0) {
            labels.push(c.title.length > 15 ? c.title.substring(0, 13) + "..." : c.title);
            assignData.push(Math.round(aAvg));
            quizData.push(Math.round(qAvg));
        }
    });

    const ctx = document.getElementById("courseChart");
    if (courseChart) courseChart.destroy();
    courseChart = new Chart(ctx, {
        type: "bar",
        data: { labels, datasets: [
            { label: "Assignments", data: assignData, backgroundColor: "#3b82f6", borderRadius: 4 },
            { label: "Quizzes", data: quizData, backgroundColor: "#8b5cf6", borderRadius: 4 }
        ]},
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderSkillChart(courses, attempts, submissions) {
    const topSkills = [];
    courses.forEach(c => {
        c.topics?.forEach(t => {
            const qIds = new Set(t.quizzes?.map(q => q.id) || []);
            const tAtts = attempts.filter(a => qIds.has(a.quiz_id));
            const score = avg(tAtts.map(a => a.percentage || 0));
            if (score > 0) topSkills.push({ label: t.title, score });
        });
    });
    topSkills.sort((a,b) => b.score - a.score);
    const slice = topSkills.slice(0, 8);

    const ctx = document.getElementById("skillChart");
    if (skillChart) skillChart.destroy();
    skillChart = new Chart(ctx, {
        type: "bar",
        data: { labels: slice.map(s => s.label), datasets: [{ label: "Topic Accuracy", data: slice.map(s=>s.score), backgroundColor: "#10b981", borderRadius: 4 }]},
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
    });
}

function renderEngagement(courses, attempts, submissions, videoIds) {
    const totalQuizzes = new Set(courses.flatMap(c => c.topics?.flatMap(t => t.quizzes?.map(q => q.id)||[])||[])).size;
    const qPct = totalQuizzes > 0 ? Math.round((attempts.length / totalQuizzes) * 100) : 0;
    setDonut("quizDonut", attempts.length, totalQuizzes, "#14b8a6");
    document.getElementById("quizCenter").textContent = `${attempts.length}/${totalQuizzes}`;
    document.getElementById("quizPct").textContent = qPct + "%";
    document.getElementById("quizBar").style.width = qPct + "%";

    const totalVids = videoIds.size;
    const scopedVP = allVideoProg.filter(p => videoIds.has(p.video_id));
    const completedVids = scopedVP.filter(p => (p.watch_percentage || 0) >= 80).length;
    const vPct = totalVids > 0 ? Math.round((completedVids / totalVids) * 100) : 0;
    setDonut("videoDonut", completedVids, totalVids, "#3b82f6");
    document.getElementById("videoCenter").textContent = `${completedVids}/${totalVids}`;
    document.getElementById("videoPct").textContent = vPct + "%";
    document.getElementById("videoBar").style.width = vPct + "%";

    const totalAssigns = new Set(courses.flatMap(c => c.topics?.flatMap(t => t.assignments?.map(a => a.id)||[])||[])).size;
    const aPct = totalAssigns > 0 ? Math.round((submissions.length / totalAssigns) * 100) : 0;
    setDonut("assignDonut", submissions.length, totalAssigns, "#8b5cf6");
    document.getElementById("assignCenter").textContent = `${submissions.length}/${totalAssigns}`;
    document.getElementById("assignPct").textContent = aPct + "%";
    document.getElementById("assignBar").style.width = aPct + "%";
}

function setDonut(id, done, total, color) {
    const ctx = document.getElementById(id);
    const existing = Chart.getChart(ctx);
    if (existing) existing.destroy();
    new Chart(ctx, {
        type: "doughnut",
        data: { datasets: [{ data: [done, Math.max(0, total - done) || 0.001], backgroundColor: [color, "#f3f4f6"], borderWidth: 0 }]},
        options: { cutout: "75%", responsive: true, maintainAspectRatio: false, plugins: { tooltip: { enabled: false } } }
    });
}

function renderInsights(qAvg, aAvg, vPct, attempts, submissions, courses) {
    const strengths = document.getElementById("strengthsList");
    const improve = document.getElementById("improveList");
    const actions = document.getElementById("actionsList");

    strengths.innerHTML = qAvg >= 70 ? "<li>High accuracy in conceptual quizzes</li>" : "<li>Maintaining steady attendance</li>";
    improve.innerHTML = vPct < 50 ? "<li>Low video engagement detected</li>" : "<li>Consistent learning pace</li>";
    actions.innerHTML = "<li>Encourage re-attempting weak quizzes</li><li>Suggested: One-on-one feedback session</li>";
}

function avg(arr) { return arr.length === 0 ? 0 : arr.reduce((a,b)=>a+b,0)/arr.length; }
function fmt(val) { return Math.round(val) + "%"; }

// ── CERTIFICATES ──────────────────────────────────────────────────────────────
async function loadCertificates() {
    const token = localStorage.getItem("token");
    const body  = document.getElementById("certTableBody");
    if (!body) return;

    try {
        const res = await fetch(`${API}/teacher/students/${studentId}/certificates`, {
            headers: { Authorization: "Bearer " + token }
        });
        if (!res.ok) { body.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#9ca3af;">Could not load certificates.</td></tr>'; return; }
        const certs = await res.json();

        if (!certs.length) {
            body.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#9ca3af;">No certificate requests found for this student.</td></tr>';
            return;
        }

        const statusBadge = (status, issued) => {
            if (issued)              return `<span style="background:#dcfce7;color:#16a34a;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:700;">✅ Issued</span>`;
            if (status === "rejected") return `<span style="background:#fee2e2;color:#dc2626;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:700;">✕ Rejected</span>`;
            return `<span style="background:#fef3c7;color:#d97706;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:700;">⏳ Pending</span>`;
        };

        body.innerHTML = certs.map(c => `
            <tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:14px 16px;font-weight:600;color:#111827;">${c.course_title}</td>
                <td style="padding:14px 16px;font-weight:700;color:${c.score >= 70 ? '#16a34a' : '#d97706'};">${c.score}%</td>
                <td style="padding:14px 16px;">${statusBadge(c.status, c.issued)}</td>
                <td style="padding:14px 16px;font-size:13px;color:#6b7280;">${c.request_date ? new Date(c.request_date).toLocaleDateString("en-GB", {day:"numeric",month:"short",year:"numeric"}) : "—"}</td>
                <td style="padding:14px 16px;font-size:13px;color:#6b7280;">${c.issued_at ? new Date(c.issued_at).toLocaleDateString("en-GB", {day:"numeric",month:"short",year:"numeric"}) : "—"}</td>
            </tr>
        `).join("");

    } catch (err) {
        console.error("Certs load failed", err);
        body.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#9ca3af;">Error loading certificates.</td></tr>';
    }
}
