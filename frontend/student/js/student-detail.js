const API = "http://127.0.0.1:8000/api/v1";
const params = new URLSearchParams(window.location.search);
const studentId = params.get("id");

let allCourses     = [];
let allAttempts    = [];
let allSubmissions = [];
let allVideoProg   = [];
let courseChart    = null;
let skillChart     = null;

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
        // 1. Basic Info & Enrollments
        const enrollRes = await fetch(`${API}/admin/students/${studentId}/enrollments`, {
            headers: { Authorization: "Bearer " + token }
        });
        const enrollments = await enrollRes.json();

        // 2. Full Course Details
        allCourses = (await Promise.all(
            enrollments.map(e => 
                fetch(`${API}/admin/courses`, { headers: { Authorization: "Bearer " + token } }) // Simple fetch all then find
                .then(r => r.json())
                .then(list => list.find(c => c.id === e.course_id))
                // We need topics too, so let's fetch topic list for each
                .then(async course => {
                    const topicsRes = await fetch(`${API}/teacher/courses/${course.id}/topics`, { headers: { Authorization: "Bearer " + token } });
                    course.topics = await topicsRes.json();
                    return course;
                })
            )
        )).filter(Boolean);

        // 3. Raw Data
        const attRes = await fetch(`${API}/admin/students/${studentId}/quiz-attempts`, {
            headers: { Authorization: "Bearer " + token }
        });
        allAttempts = await attRes.json();

        const subRes = await fetch(`${API}/admin/students/${studentId}/assignment-submissions`, {
            headers: { Authorization: "Bearer " + token }
        });
        allSubmissions = await subRes.json();

        const vpRes = await fetch(`${API}/admin/students/${studentId}/video-progress`, {
            headers: { Authorization: "Bearer " + token }
        });
        allVideoProg = await vpRes.json();

        // 4. Populate Filter
        const sel = document.getElementById("courseFilter");
        allCourses.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id; opt.textContent = c.title;
            sel.appendChild(opt);
        });

        renderAll("all");
        loadCertificates();
        loadStudentDetail();

    } catch (err) { console.error(err); }
}

async function loadStudentDetail() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API}/admin/students/${studentId}/detail`, {
            headers: { Authorization: "Bearer " + token }
        });
        if (!res.ok) return;
        const d = await res.json();

        document.getElementById("studentNameHeader").textContent = `${d.name}'s Performance`;

        const riskEl = document.getElementById("statRisk");
        riskEl.textContent = d.dropout_risk || "—";
        riskEl.className = `stat-value risk-text-${(d.dropout_risk || "low").toLowerCase()}`;

        document.getElementById("aiLearnerLevel").textContent = d.learner_level || "—";
        document.getElementById("statOverall").textContent = Math.round(d.avg_quiz_score || 0) + "%";
    } catch(e) { console.error("Detail load failed", e); }
}

function applyFilter() {
    renderAll(document.getElementById("courseFilter").value);
}

function renderAll(courseFilter) {
    const courses = courseFilter === "all" ? allCourses : allCourses.filter(c => String(c.id) === String(courseFilter));
    
    // Filter attempts/subs/progs based on course scope
    // For simplicity, we match by title in attempts/subs as the admin API returns it
    const attempts = courseFilter === "all" ? allAttempts : allAttempts.filter(a => String(a.course_id) === String(courseFilter));
    const submissions = courseFilter === "all" ? allSubmissions : allSubmissions.filter(s => String(s.course_id) === String(courseFilter));
    
    // Stats calculation mirroring student portal
    const quizAvg = avg(attempts.map(a => a.percentage || 0));
    const assignAvg = avg(submissions.map(s => (s.obtained_marks / (s.total_marks || 10)) * 100));
    
    // Video calc
    const videoIds = new Set(courses.flatMap(c => c.topics?.flatMap(t => [1,2,3]) || [])); // Placeholder logic for now
    const videoCompPct = 0; // Simplified for admin view

    const overallPct = avg([quizAvg, assignAvg].filter(x => x > 0)) || 0;

    document.getElementById("statOverall").textContent = Math.round(overallPct) + "%";
    document.getElementById("statQuiz").textContent = Math.round(quizAvg) + "%";
    
    // Fetch Risk from detail API (we should update the data load to include this)
    const risk = "Low"; // Placeholder until we re-run prediction or fetch from DB
    const riskEl = document.getElementById("statRisk");
    riskEl.textContent = risk;
    riskEl.className = `stat-value risk-text-${risk.toLowerCase()}`;

    let level = "Weak";
    if (overallPct >= 70) level = "Strong";
    else if (overallPct >= 40) level = "Average";
    document.getElementById("aiLearnerLevel").textContent = level;

    renderCharts(courses, attempts, submissions);
    renderInsights(quizAvg, assignAvg);
}

function renderCharts(courses, attempts, submissions) {
    const ctx1 = document.getElementById("courseChart");
    if (courseChart) courseChart.destroy();
    courseChart = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: courses.map(c => c.title.substring(0,15)),
            datasets: [
                { label: 'Quiz %', data: courses.map(c => avg(attempts.filter(a => a.course_id === c.id).map(x=>x.percentage))), backgroundColor: '#7c3aed' },
                { label: 'Assign %', data: courses.map(c => avg(submissions.filter(s => s.course_id === c.id).map(x=>(x.obtained_marks/x.total_marks)*100))), backgroundColor: '#c7d2fe' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderInsights(q, a) {
    document.getElementById("strengthsList").innerHTML = q >= 70 ? "<li>Excellent quiz scores</li>" : "<li>Steady participation</li>";
    document.getElementById("improveList").innerHTML = a < 60 ? "<li>Low assignment marks</li>" : "<li>Engagement is optimal</li>";
    document.getElementById("actionsList").innerHTML = "<li>Review student submissions</li>";
}

function avg(arr) { return arr.length === 0 ? 0 : arr.reduce((a,b)=>a+b,0)/arr.length; }

// ── CERTIFICATES ──────────────────────────────────────────────────────────────
async function loadCertificates() {
    const token = localStorage.getItem("token");
    const body  = document.getElementById("certTableBody");
    if (!body) return;

    try {
        const res = await fetch(`${API}/admin/students/${studentId}/certificates`, {
            headers: { Authorization: "Bearer " + token }
        });
        if (!res.ok) {
            body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--muted);">Could not load certificates.</td></tr>';
            return;
        }
        const certs = await res.json();

        if (!certs.length) {
            body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--muted);">No certificate requests found for this student.</td></tr>';
            return;
        }

        const statusBadge = (status, issued) => {
            if (issued)               return `<span class="badge badge-active">✅ Issued</span>`;
            if (status === "rejected") return `<span class="badge badge-inactive">✕ Rejected</span>`;
            return `<span class="badge badge-pending">⏳ Pending</span>`;
        };

        const fmtDate = iso => iso ? new Date(iso).toLocaleDateString("en-GB", {day:"numeric",month:"short",year:"numeric"}) : "—";

        body.innerHTML = certs.map(c => `
            <tr style="border-bottom:1px solid var(--border);">
                <td style="padding:14px 16px; font-weight:600; color:var(--ink);">${c.course_title}</td>
                <td style="padding:14px 16px; font-weight:700; color:${c.score >= 70 ? '#16a34a' : '#d97706'};">${c.score}%</td>
                <td style="padding:14px 16px;">${statusBadge(c.status, c.issued)}</td>
                <td style="padding:14px 16px; font-size:13px; color:var(--muted);">${fmtDate(c.request_date)}</td>
                <td style="padding:14px 16px; font-size:13px; color:var(--muted);">${fmtDate(c.issued_at)}</td>
                <td style="padding:14px 16px;">
                    ${!c.issued && c.status !== 'rejected'
                        ? `<div style="display:flex;gap:8px;">
                            <button class="btn btn-primary" style="padding:5px 12px;font-size:12px;" onclick="adminIssueCert(${c.id})">✅ Issue</button>
                            <button class="btn btn-ghost" style="padding:5px 12px;font-size:12px;color:#ef4444;" onclick="adminRejectCert(${c.id})">✕ Reject</button>
                           </div>`
                        : c.issued
                        ? `<button class="btn btn-ghost" style="padding:5px 12px;font-size:12px;" onclick="downloadCert(${c.id})">👁 View</button>`
                        : '<span style="font-size:12px;color:#9ca3af;">No action</span>'
                    }
                </td>
            </tr>
        `).join("");

    } catch (err) {
        console.error("Certs load failed", err);
        body.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--muted);">Error loading certificates.</td></tr>';
    }
}

async function adminIssueCert(certId) {
    if (!confirm("Issue this certificate?")) return;
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API}/admin/certificates/${certId}/issue`, {
            method: "POST",
            headers: { Authorization: "Bearer " + token }
        });
        if (res.ok) { alert("Certificate issued successfully!"); loadCertificates(); }
        else        { alert("Failed to issue certificate."); }
    } catch(e) { alert("Error issuing certificate."); }
}

async function adminRejectCert(certId) {
    if (!confirm("Reject this certificate request?")) return;
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API}/admin/certificates/${certId}/reject`, {
            method: "POST",
            headers: { Authorization: "Bearer " + token }
        });
        if (res.ok) { alert("Certificate request rejected."); loadCertificates(); }
        else        { alert("Failed to reject certificate."); }
    } catch(e) { alert("Error rejecting certificate."); }
}

function downloadCert(certId) {
    const token = localStorage.getItem("token");
    window.open(`${API}/admin/certificates/${certId}/download?token=${token}`, "_blank");
}
