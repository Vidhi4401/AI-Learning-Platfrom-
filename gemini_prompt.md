# Complete Admin & Teacher Portal — Gemini CLI Generation Prompt

## PROJECT OVERVIEW

You are building two portals for an AI Learning Platform:
1. **Teacher Portal** — faculty manages their own courses and students
2. **Admin Portal** — one admin per org controls teachers, branding, certificates, platform settings

---

## ABSOLUTE CONSTRAINTS — NEVER CHANGE THESE

- Student portal (`student/` folder) is **complete and untouched**
- Database tables are **fixed** — no new tables, no schema changes
- PDF extraction, chatbot/doubts, video upload features **remain exactly as built**
- Backend base URL: `http://127.0.0.1:8000/api/v1`
- Auth system unchanged — same JWT login at `auth.html`

---

## DATABASE TABLES (reference only)

```
users                  — id, name, email, password_hash, role('admin'|'teacher'|'student'), organization_id, created_at
organizations          — id, name, platform_name, logo, status
courses                — id, title, description, difficulty, logo, status, organization_id, teacher_id
topics                 — id, title, course_id, order_number
videos                 — id, topic_id, video_url, duration
video_progress         — id, student_id, video_id, watch_time, watch_percentage, skip_count, playback_speed
quizzes                — id, title, topic_id
quiz_questions         — id, quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option
quiz_attempts          — id, student_id, quiz_id, score, attempted_at
assignments            — id, title, description, total_marks, model_answer, topic_id
assignment_submissions — id, student_id, assignment_id, obtained_marks, feedback, submitted_at
enrollments            — id, student_id, course_id
student_performance    — id, student_id, avg_quiz_score, avg_assignment_score, completion_rate,
                         weak_topic_count, strong_topic_count, learner_level, last_updated
certificates           — id, student_id, course_id, issued_by, issued_at, is_valid
chat_messages          — id, student_id, faculty_id, query, response, mode('AI'|'FACULTY'), created_at
```

---

## ROLE RIGHTS — THIS IS THE MOST IMPORTANT SECTION

### 🔴 ADMIN EXCLUSIVE RIGHTS (teacher cannot do these)
```
1. Set platform name & logo           ← MOST IMPORTANT — only admin controls branding
2. Set organization name
3. Invite / create teacher accounts
4. Deactivate / activate teacher accounts
5. Reset teacher passwords
6. Delete any teacher account
7. View all teachers and their performance
8. Issue certificates to students
9. Revoke certificates
10. Delete ANY course (from any teacher)
11. Toggle published/draft on any course
12. View platform-wide analytics (all teachers combined)
13. View all students across all teachers
```

### 🔵 TEACHER EXCLUSIVE RIGHTS (admin cannot do these)
```
1. Create new courses
2. Edit their own course content (title, description, thumbnail)
3. Delete their own courses
4. Upload PDF → AI auto-extract topics, quizzes, assignments
5. Add videos to topics (YouTube URL or file upload with duration)
6. Delete videos
7. Add/edit/delete topics manually
8. Reply to student doubts
9. View only their own students (enrolled in their courses)
10. View their own course analytics
```

### 🟡 SHARED RIGHTS (both can do)
```
1. View student performance details (quiz scores, assignment scores, video progress)
2. View course content and structure
3. Update own profile (name, email, password)
```

### ❌ TEACHER CANNOT DO
```
- Change platform name or logo (read only — displays in sidebar but cannot edit)
- Change organization name
- See other teachers' data
- Create teacher accounts
- Issue or revoke certificates
- Access admin analytics
```

### ❌ ADMIN CANNOT DO
```
- Create courses (teachers do this)
- Upload PDFs or videos
- Reply to student doubts
- Add topics/quizzes/assignments
```

---

## EXISTING TEACHER PORTAL (already built — preserve everything)

### Current File Structure:
```
teacher/
  dashboard.html        css/dashboard.css        js/dashboard.js
  courses.html          css/courses.css          js/courses.js
  add-course.html       css/add-course.css       js/add-course.js
  course-detail.html    css/course-detail.css    js/course-detail.js
  students.html         css/students.css         js/students.js
  student-detail.html                            js/student-detail.js
  analytics.html        css/analytics.css        js/analytics.js
  doubts.html                                    js/doubts.js
  settings.html         css/settings.css         js/settings.js
  css/main.css
  js/layout.js
```

### Teacher API Endpoints (working — keep exactly):
```
GET    /teacher/dashboard
GET    /teacher/courses
POST   /teacher/courses                    multipart: title, description, difficulty, status, logo
GET    /teacher/courses/{id}
PUT    /teacher/courses/{id}
DELETE /teacher/courses/{id}
GET    /teacher/courses/{id}/topics
POST   /teacher/courses/{id}/topics
GET    /teacher/courses/{id}/stats
POST   /teacher/courses/{id}/process-pdf   ← AI extracts topics+quizzes+assignments from PDF using Groq
GET    /teacher/courses/{id}/detail
PUT    /teacher/topics/{id}
DELETE /teacher/topics/{id}
GET    /teacher/topics/{id}/assignments
POST   /teacher/topics/{id}/videos         multipart: video_url OR video_file, duration
DELETE /teacher/videos/{id}
GET    /teacher/get-video-duration?url=    ← fetches real YouTube duration
GET    /teacher/students                   ← ONLY students in this teacher's courses
GET    /teacher/students/{id}/detail
GET    /teacher/students/{id}/quiz-attempts
GET    /teacher/students/{id}/assignment-submissions
GET    /teacher/students/{id}/video-progress
GET    /teacher/analytics
GET    /teacher/organization               ← READ ONLY for teacher (get platform name/logo to display)
GET    /teacher/profile
PUT    /teacher/profile                    ← name, email, password only — NO branding changes
```

### Teacher Settings Page — UPDATED RIGHTS:
Teacher settings page has **two sections only**:
1. **My Profile** — name, email, change password → `PUT /teacher/profile`
2. **Platform Info** (read-only display) — shows platform name and logo as set by admin, with text "Contact your admin to change platform branding" — NO edit fields for name or logo

### Teacher Sidebar (js/layout.js):
```
Dashboard | Courses | Add Course | Students | Doubts (unread badge) | Settings
```
- Shows "Faculty Portal" subtitle
- Role check: `user.role !== 'teacher'` → redirect to `../auth.html`
- Polls `/chat/unread-count?user_id={id}&role=faculty` every 30s for doubt notification badge
- Platform name and logo loaded from `user.platform_name` and `user.org_logo` (set by localStorage on login)

---

## TEACHER FEATURES TO KEEP EXACTLY AS BUILT

### 1. Dashboard
- 5 stat cards: Total Students, Total Courses, Total Quizzes, Total Assignments, Certificates Issued
- Course filter dropdown (filter stats by course)
- Bar chart: students per course (Chart.js)
- Doughnut chart: learner levels Strong/Average/Weak
- Engagement bars: Video Completion %, Quiz Attempt %, Assignment Submit %
- API: `GET /teacher/dashboard`

### 2. Courses Page
- Grid of course cards with thumbnail, difficulty pill, published/draft badge
- View, Edit, Delete buttons per card
- "Add New Course" button → add-course.html

### 3. Add Course (4-step wizard) — KEEP EXACTLY
- **Step 1**: Create course (title, description, difficulty, thumbnail upload)
- **Step 2**: Upload PDF → `POST /teacher/courses/{id}/process-pdf`
  - Uses Groq API (llama-3.3-70b-versatile) to extract topics, quiz questions, assignments
  - Shows processing spinner during AI extraction
  - Groq prompt extracts: topics array, each with quiz (4-5 questions, 4 options, correct_option) and assignment (title, description, total_marks=10)
- **Step 3**: Add videos per topic
  - Radio toggle: YouTube URL vs Upload File
  - YouTube URL → on blur calls `GET /teacher/get-video-duration?url=` → auto-fills duration
  - File upload → HTML5 video element reads metadata → auto-fills duration in minutes
  - `POST /teacher/topics/{id}/videos` with FormData
- **Step 4**: Preview full course structure

### 4. Course Detail
- Tabs: Topics, Quizzes, Assignments
- Topics tab: list with add/delete, each shows video count
- Quizzes tab: grouped by topic, shows questions
- Assignments tab: grouped by topic, shows description

### 5. Students & Student Detail
- Students: table with avatar, name, email, enrolled courses, score, learner level badge, View button
- Student Detail: profile card, 4 stat cards, course performance chart, weak topics, enrolled courses table, quiz attempts table, assignment submissions table

### 6. Analytics
- Total students, total courses stats
- Bar chart: students enrolled per course
- Doughnut: learner level distribution

### 7. Doubts — KEEP EXACTLY
- List of student questions with faculty/AI source badge, answered/pending status
- Reply textarea for pending doubts
- `GET /chat/faculty/doubts?faculty_id={id}&filter=pending|answered`
- `POST /chat/faculty/reply` body: {doubt_id, response}

---

## ADMIN PORTAL — BUILD COMPLETE

**Folder**: `admin/`
**Accent color**: `#7c3aed` (purple) — differentiates visually from teacher (blue `#2563eb`)

### Admin File Structure:
```
admin/
  dashboard.html
  teachers.html
  teacher-detail.html
  courses.html
  students.html
  student-detail.html
  analytics.html
  certificates.html
  settings.html
  css/
    main.css            ← same structure as teacher main.css but --accent: #7c3aed
    dashboard.css
    teachers.css
    courses.css
    students.css
    analytics.css
    certificates.css
    settings.css
  js/
    layout.js
    dashboard.js
    teachers.js
    teacher-detail.js
    courses.js
    students.js
    student-detail.js
    analytics.js
    certificates.js
    settings.js
```

### Admin Sidebar (js/layout.js):
```
🏠 Dashboard
👨‍🏫 Teachers          ← manage teacher accounts
📚 Courses            ← view all courses, manage status
👨‍🎓 Students          ← all students platform-wide
📊 Analytics          ← platform-wide deep analytics
🏆 Certificates       ← issue and revoke
⚙️  Settings          ← platform branding + admin profile
```
- Shows "Admin Portal" subtitle
- Role check: `user.role !== 'admin'` → redirect to `../auth.html`
- NO doubts section (admin doesn't handle doubts)

---

### ADMIN PAGE 1: Dashboard (dashboard.html + dashboard.css + dashboard.js)

**6 Stat Cards Row**:
- Total Teachers
- Total Students
- Total Courses
- Platform Avg Score (avg overall_score across all students)
- Certificates Issued
- Active This Week (students with any activity in last 7 days)

**Charts Row** (2 side by side):
- Bar chart: enrolled students per course (top 8)
- Doughnut: learner level distribution across ALL students

**Teacher Performance Table** (below charts):
| Teacher Name | Courses | Students | Avg Score | Status |
- Quick view of each teacher's impact
- Clicking a row → teacher-detail.html?id={id}

**API**: `GET /admin/dashboard`
```json
{
  "total_teachers": 5,
  "total_students": 120,
  "total_courses": 18,
  "platform_avg_score": 74.2,
  "certificates_issued": 34,
  "active_this_week": 45,
  "course_distribution": [{"title": "Python", "students": 30}],
  "level_distribution": {"Strong": 40, "Average": 60, "Weak": 20},
  "teacher_performance": [
    {"id": 1, "name": "John", "course_count": 4, "student_count": 35, "avg_score": 78.5, "is_active": true}
  ],
  "engagement": {"video_rate": 72, "quiz_rate": 65, "assign_rate": 58}
}
```

---

### ADMIN PAGE 2: Teachers (teachers.html + teacher-detail.html)

**teachers.html**:
- Header: "Teachers" + purple "Invite Teacher" button
- Search input + Active/Inactive filter
- Table:
  | Avatar+Name | Email | Courses | Students | Avg Score | Status Toggle | Actions |
  - Status toggle: green switch = active, gray = inactive
  - Actions: View button, Reset Password button (opens modal), Delete button
- Empty state if no teachers yet

**Invite Teacher Modal** (appears on button click):
```
Fields: Full Name, Email, Temporary Password
Submit → POST /admin/teachers/invite
Success: show toast "Teacher account created. Share credentials with them."
```

**Reset Password Modal**:
```
Shows teacher name
New Password input + Confirm Password input
Submit → PUT /admin/teachers/{id}/reset-password
Success toast: "Password reset successfully"
```

**Status Toggle**:
```
Click toggle → PUT /admin/teachers/{id}/status  body: {is_active: bool}
Active = teacher can login normally
Inactive = teacher gets 403 on login ("Account deactivated, contact admin")
```

**Delete Teacher**:
```
Confirmation: "Delete {name}? Their courses will remain but be unassigned."
DELETE /admin/teachers/{id}
Only if teacher has no active students (check enrollment count)
```

**teacher-detail.html**:
- Back to Teachers link
- Profile card: avatar initials, name, email, joined date, Active/Inactive badge
- 4 stat cards: Courses Created, Total Students, Avg Student Score, Doubts Answered
- Courses Table: | Course Title | Enrolled | Avg Score | Status | Created |
- Recent Students table (students enrolled in this teacher's courses)

**API Endpoints**:
```
GET  /admin/teachers
     → [{id, name, email, is_active, course_count, student_count, avg_score, created_at}]

POST /admin/teachers/invite
     body: {name, email, password}
     → creates user role='teacher' same organization_id as admin

PUT  /admin/teachers/{id}/status
     body: {is_active: bool}

PUT  /admin/teachers/{id}/reset-password
     body: {new_password: str}

DELETE /admin/teachers/{id}

GET  /admin/teachers/{id}/detail
     → {profile, stats: {course_count, student_count, avg_score, doubts_answered},
        courses: [{id, title, enrolled, avg_score, status, created_at}]}
```

---

### ADMIN PAGE 3: Courses (courses.html)

**Difference from teacher courses**:
- Shows ALL courses from ALL teachers in the org
- Extra "Teacher" badge on each card showing who created it
- Filter by teacher dropdown at top + search
- Admin CANNOT edit course content
- Admin CAN: toggle published/draft status, delete course, view detail (read-only)
- View button → opens course-detail read-only view (no add/edit buttons shown)

**Course Card layout** (same visual as teacher card but):
- Teacher name shown as small badge on card
- Actions: View, Toggle Status, Delete (no Edit button)

**API Endpoints**:
```
GET /admin/courses
    → [{id, title, description, difficulty, logo, status, teacher_name, teacher_id, enrolled_students}]

PUT /admin/courses/{id}/status
    body: {status: bool}

DELETE /admin/courses/{id}
```

---

### ADMIN PAGE 4: Students (students.html + student-detail.html)

**students.html**: Same design as teacher students page but:
- Fetches ALL students in org across all teachers
- Extra column: "Main Course" (most recently enrolled course)
- Filter: All Courses dropdown + Learner Level dropdown + Search
- Same table: Avatar, Name, Email, Enrolled Courses, Score, Learner Level, Certificate Status, View

**student-detail.html**: Identical layout to teacher's version but uses admin API endpoints:

**API Endpoints**:
```
GET /admin/students
    → [{id, name, email, overall_score, learner_level, course_count, main_course, created_at}]

GET /admin/students/{id}/detail
GET /admin/students/{id}/quiz-attempts     → with topic_name, course_title
GET /admin/students/{id}/assignment-submissions → with course_title, total_marks
GET /admin/students/{id}/video-progress
GET /admin/students/{id}/enrollments       → with course_title, quiz_count, video_count, video_ids
```

---

### ADMIN PAGE 5: Analytics (analytics.html)

**More comprehensive than teacher analytics**:

**Top 4 Stats**: Total Students, Total Courses, Platform Avg Score, Overall Completion Rate

**Chart 1 — Monthly Student Growth** (line chart):
- X-axis: last 6 months (Jan, Feb, Mar...)
- Y-axis: new student registrations per month
- `data.monthly_growth: [{month: "Jan 2026", count: 12}, ...]`

**Chart 2 — Course Performance** (horizontal bar chart):
- Each bar = one course, length = avg student score
- Colored green >=70, orange 50-69, red <50

**Chart 3 — Learner Level Distribution** (doughnut):
- Strong / Average / Weak across all students

**Engagement Section** (3 progress bars):
- Video Completion Rate, Quiz Attempt Rate, Assignment Submission Rate

**Weak Topics Table**:
- Topics where avg student score < 60%
- Columns: Topic Name, Course, Teacher, Avg Score (red), Students Affected
- Sorted by avg_score ascending

**API**:
```
GET /admin/analytics
→ {
    total_students, total_courses, platform_avg_score, completion_rate,
    monthly_growth: [{month, count}],
    course_performance: [{title, avg_score, teacher_name}],
    level_distribution: {Strong, Average, Weak},
    engagement: {video_rate, quiz_rate, assign_rate},
    weak_topics: [{topic_name, course_title, teacher_name, avg_score, affected_students}]
  }
```

---

### ADMIN PAGE 6: Certificates (certificates.html)

**Two panels side by side**:

**Left Panel — Eligible for Certificate**:
- Criteria: completion_rate >= 80% AND avg_score >= 70% for a specific course
- Table: Student Name, Course, Score, Completion %, Issue Certificate button (green)
- Course filter dropdown at top

**Right Panel — Issued Certificates**:
- Table: Student, Course, Issue Date, Issued By, Valid/Revoked badge, Revoke button
- Revoked shows red badge, valid shows green badge

**Issue Certificate Flow**:
```
Click "Issue Certificate"
→ Confirm modal: "Issue certificate to {student} for {course}?"
→ POST /admin/certificates  body: {student_id, course_id}
→ Row disappears from left panel, appears in right panel
→ Toast: "Certificate issued successfully"
```

**Revoke Flow**:
```
Click "Revoke"
→ Confirm modal: "Revoke this certificate? Student will lose access."
→ PUT /admin/certificates/{id}/revoke
→ Badge changes to red "Revoked"
```

**API Endpoints**:
```
GET  /admin/certificates/eligible
     → [{student_id, student_name, course_id, course_title, avg_score, completion_rate}]

GET  /admin/certificates/issued
     → [{id, student_name, course_title, issued_at, issued_by_name, is_valid}]

POST /admin/certificates
     body: {student_id, course_id}

PUT  /admin/certificates/{id}/revoke
```

---

### ADMIN PAGE 7: Settings (settings.html) — MOST IMPORTANT PAGE

**This is the ONLY place platform branding can be changed**

**Section 1 — Platform Branding** (admin exclusive):
```
Platform Name input (displayed in all portals' sidebars)
Organization Name input
Logo Upload (drag & drop or click, preview shown instantly)
  → shows current logo or placeholder if none
  → clicking logo area opens file picker
  → preview updates immediately on file select
Save Platform Settings button
→ PUT /admin/organization  multipart: {org_name, platform_name, logo file}
→ On success: update localStorage user.platform_name and user.org_logo
→ Update sidebar brand name and logo immediately without page reload
→ Toast: "Platform settings saved"
```

**Section 2 — Admin Profile**:
```
Full Name input
Email input
Change Password: Current Password + New Password + Confirm Password
Save Profile button
→ PUT /admin/profile  body: {name, email, current_password?, new_password?}
→ Toast: "Profile updated"
```

**API Endpoints**:
```
GET /admin/organization
    → {org_name, platform_name, logo}

PUT /admin/organization    (multipart/form-data)
    fields: org_name, platform_name
    file: logo (optional)
    → updates organizations table
    → returns updated {org_name, platform_name, logo_url}

GET /admin/profile
    → {id, name, email}

PUT /admin/profile
    body: {name, email, current_password?, new_password?}
```

---

## DESIGN SYSTEM

### Fonts & Colors:
```css
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');

/* Teacher portal */
--accent: #2563eb;        /* blue */
--accent-hover: #1d4ed8;
--accent-light: #eff6ff;

/* Admin portal */
--accent: #7c3aed;        /* purple */
--accent-hover: #6d28d9;
--accent-light: #f5f3ff;

/* Shared */
--sidebar-w: 255px;
--navbar-h: 66px;
--sb-bg: #ffffff;
--page-bg: #f5f4f0;
--white: #ffffff;
--ink: #111827;
--muted: #6b7280;
--border: #e5e7eb;
--radius: 14px;
--shadow: 0 2px 10px rgba(0,0,0,0.05);
```

### Component Patterns:
```css
/* Cards */
background: #fff; border-radius: 16px;
border: 1px solid #e8e6e0;
box-shadow: 0 2px 10px rgba(0,0,0,0.05);

/* Table */
thead: background #fafaf8
th: font-size 11.5px, color #6b7280, uppercase, letter-spacing 0.5px
td: border-bottom 1px solid #f5f4f0, padding 14px 18px

/* Score colors */
>= 80%: color #16a34a (green)
>= 60%: color #d97706 (orange)
<  60%: color #dc2626 (red)

/* Learner level badges */
Strong:   background #16a34a, color white, border-radius 20px
Average:  background #f59e0b, color white
Weak:     background #ef4444, color white

/* Status badges */
Active:   background #dcfce7, color #166534, border 1px solid #86efac
Inactive: background #fee2e2, color #991b1b, border 1px solid #fca5a5

/* Animations */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

## BACKEND — FastAPI Routers

### dependencies.py:
```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
import models
from database import SessionLocal
from auth_utils import decode_access_token  # your existing JWT decode function

security = HTTPBearer()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(credentials=Depends(security), db=Depends(get_db)):
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(401, "Invalid token")
    user = db.query(models.User).filter(models.User.id == payload["user_id"]).first()
    if not user:
        raise HTTPException(401, "User not found")
    return user

def get_current_teacher(user=Depends(get_current_user)):
    if user.role != "teacher":
        raise HTTPException(403, "Teacher access required")
    return user

def get_current_admin(user=Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(403, "Admin access required")
    return user
```

### routers/teacher.py — Keep all existing endpoints PLUS ensure:
```python
# Teacher CANNOT update org branding — GET only
@router.get("/api/v1/teacher/organization")
def get_org_info(admin=Depends(get_current_teacher), db=Depends(get_db)):
    org = db.query(models.Organization).filter(
        models.Organization.id == admin.organization_id
    ).first()
    return {"platform_name": org.platform_name, "logo": org.logo}
    # NO PUT endpoint for teacher organization

# Teacher profile — name/email/password only
@router.get("/api/v1/teacher/profile")
@router.put("/api/v1/teacher/profile")
# PUT accepts: name, email, current_password, new_password
# Does NOT accept: platform_name, logo
```

### routers/admin_router.py — New file with all admin endpoints:

```python
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
import models, os, shutil
from dependencies import get_db, get_current_admin

router = APIRouter(tags=["Admin"])

# ── DASHBOARD ────────────────────────────────────────────────────────────────
@router.get("/api/v1/admin/dashboard")
def admin_dashboard(admin=Depends(get_current_admin), db=Depends(get_db)):
    org_id = admin.organization_id
    
    # All teachers in org
    teachers = db.query(models.User).filter(
        models.User.organization_id == org_id,
        models.User.role == "teacher"
    ).all()
    teacher_ids = [t.id for t in teachers]
    
    # All courses in org
    courses = db.query(models.Course).filter(
        models.Course.organization_id == org_id
    ).all()
    course_ids = [c.id for c in courses]
    
    # All students enrolled in org courses
    enrollments = db.query(models.Enrollment).filter(
        models.Enrollment.course_id.in_(course_ids)
    ).all()
    student_ids = list(set([e.student_id for e in enrollments]))
    
    # Platform avg score from student_performance
    perf_records = db.query(models.StudentPerformance).filter(
        models.StudentPerformance.student_id.in_(student_ids)
    ).all()
    avg_score = round(
        sum(p.avg_quiz_score or 0 for p in perf_records) / len(perf_records), 1
    ) if perf_records else 0
    
    # Certificates issued
    certs = db.query(models.Certificate).filter(
        models.Certificate.course_id.in_(course_ids)
    ).count()
    
    # Active this week
    week_ago = datetime.utcnow() - timedelta(days=7)
    active_week = db.query(models.VideoProgress).filter(
        models.VideoProgress.student_id.in_(student_ids)
    ).distinct(models.VideoProgress.student_id).count()
    
    # Course distribution
    course_dist = []
    for c in courses[:8]:
        enrolled = db.query(models.Enrollment).filter(
            models.Enrollment.course_id == c.id
        ).count()
        course_dist.append({"title": c.title[:20], "students": enrolled})
    
    # Level distribution
    levels = {"Strong": 0, "Average": 0, "Weak": 0}
    for p in perf_records:
        lv = p.learner_level or "Average"
        if lv in levels:
            levels[lv] += 1
    
    # Teacher performance
    teacher_perf = []
    for t in teachers:
        t_courses = [c for c in courses if c.teacher_id == t.id]
        t_course_ids = [c.id for c in t_courses]
        t_enrollments = db.query(models.Enrollment).filter(
            models.Enrollment.course_id.in_(t_course_ids)
        ).all()
        t_student_ids = list(set([e.student_id for e in t_enrollments]))
        t_perfs = db.query(models.StudentPerformance).filter(
            models.StudentPerformance.student_id.in_(t_student_ids)
        ).all()
        t_avg = round(
            sum(p.avg_quiz_score or 0 for p in t_perfs) / len(t_perfs), 1
        ) if t_perfs else 0
        teacher_perf.append({
            "id": t.id, "name": t.name,
            "course_count": len(t_courses),
            "student_count": len(t_student_ids),
            "avg_score": t_avg,
            "is_active": getattr(t, "is_active", True)
        })
    
    # Engagement
    total_videos = db.query(models.Video).join(models.Topic).filter(
        models.Topic.course_id.in_(course_ids)
    ).count()
    completed_videos = db.query(models.VideoProgress).filter(
        models.VideoProgress.student_id.in_(student_ids),
        models.VideoProgress.watch_percentage >= 80
    ).count()
    
    total_quizzes = db.query(models.Quiz).join(models.Topic).filter(
        models.Topic.course_id.in_(course_ids)
    ).count()
    attempted_quizzes = db.query(models.QuizAttempt).filter(
        models.QuizAttempt.student_id.in_(student_ids)
    ).count()
    
    total_assignments = db.query(models.Assignment).join(models.Topic).filter(
        models.Topic.course_id.in_(course_ids)
    ).count()
    submitted = db.query(models.AssignmentSubmission).filter(
        models.AssignmentSubmission.student_id.in_(student_ids)
    ).count()
    
    possible_videos = total_videos * len(student_ids) if student_ids else 1
    possible_quizzes = total_quizzes * len(student_ids) if student_ids else 1
    possible_assignments = total_assignments * len(student_ids) if student_ids else 1
    
    return {
        "total_teachers": len(teachers),
        "total_students": len(student_ids),
        "total_courses": len(courses),
        "platform_avg_score": avg_score,
        "certificates_issued": certs,
        "active_this_week": active_week,
        "course_distribution": sorted(course_dist, key=lambda x: -x["students"]),
        "level_distribution": levels,
        "teacher_performance": teacher_perf,
        "engagement": {
            "video_rate": round(completed_videos/possible_videos*100) if possible_videos else 0,
            "quiz_rate": round(attempted_quizzes/possible_quizzes*100) if possible_quizzes else 0,
            "assign_rate": round(submitted/possible_assignments*100) if possible_assignments else 0
        }
    }

# ── TEACHERS ─────────────────────────────────────────────────────────────────
@router.get("/api/v1/admin/teachers")
def get_teachers(admin=Depends(get_current_admin), db=Depends(get_db)):
    teachers = db.query(models.User).filter(
        models.User.organization_id == admin.organization_id,
        models.User.role == "teacher"
    ).all()
    result = []
    for t in teachers:
        courses = db.query(models.Course).filter(models.Course.teacher_id == t.id).all()
        course_ids = [c.id for c in courses]
        enrollments = db.query(models.Enrollment).filter(
            models.Enrollment.course_id.in_(course_ids)
        ).all()
        student_ids = list(set([e.student_id for e in enrollments]))
        perfs = db.query(models.StudentPerformance).filter(
            models.StudentPerformance.student_id.in_(student_ids)
        ).all()
        avg = round(sum(p.avg_quiz_score or 0 for p in perfs)/len(perfs),1) if perfs else 0
        result.append({
            "id": t.id, "name": t.name, "email": t.email,
            "is_active": getattr(t, "is_active", True),
            "course_count": len(courses),
            "student_count": len(student_ids),
            "avg_score": avg,
            "created_at": t.created_at.isoformat() if t.created_at else None
        })
    return result

@router.post("/api/v1/admin/teachers/invite")
def invite_teacher(
    name: str = Form(...), email: str = Form(...), password: str = Form(...),
    admin=Depends(get_current_admin), db=Depends(get_db)
):
    from auth_utils import hash_password  # your existing hash function
    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        raise HTTPException(400, "Email already registered")
    teacher = models.User(
        name=name, email=email,
        password_hash=hash_password(password),
        role="teacher",
        organization_id=admin.organization_id
    )
    db.add(teacher)
    db.commit()
    return {"message": f"Teacher account created for {name}"}

@router.put("/api/v1/admin/teachers/{teacher_id}/status")
def update_teacher_status(
    teacher_id: int, is_active: bool = Form(...),
    admin=Depends(get_current_admin), db=Depends(get_db)
):
    teacher = db.query(models.User).filter(
        models.User.id == teacher_id,
        models.User.organization_id == admin.organization_id,
        models.User.role == "teacher"
    ).first()
    if not teacher:
        raise HTTPException(404, "Teacher not found")
    teacher.is_active = is_active
    db.commit()
    return {"message": "Status updated"}

@router.put("/api/v1/admin/teachers/{teacher_id}/reset-password")
def reset_teacher_password(
    teacher_id: int, new_password: str = Form(...),
    admin=Depends(get_current_admin), db=Depends(get_db)
):
    from auth_utils import hash_password
    teacher = db.query(models.User).filter(
        models.User.id == teacher_id,
        models.User.organization_id == admin.organization_id,
        models.User.role == "teacher"
    ).first()
    if not teacher:
        raise HTTPException(404, "Teacher not found")
    teacher.password_hash = hash_password(new_password)
    db.commit()
    return {"message": "Password reset successfully"}

@router.delete("/api/v1/admin/teachers/{teacher_id}")
def delete_teacher(
    teacher_id: int, admin=Depends(get_current_admin), db=Depends(get_db)
):
    teacher = db.query(models.User).filter(
        models.User.id == teacher_id,
        models.User.organization_id == admin.organization_id,
        models.User.role == "teacher"
    ).first()
    if not teacher:
        raise HTTPException(404, "Teacher not found")
    db.delete(teacher)
    db.commit()
    return {"message": "Teacher deleted"}

@router.get("/api/v1/admin/teachers/{teacher_id}/detail")
def get_teacher_detail(
    teacher_id: int, admin=Depends(get_current_admin), db=Depends(get_db)
):
    teacher = db.query(models.User).filter(
        models.User.id == teacher_id,
        models.User.organization_id == admin.organization_id
    ).first()
    if not teacher:
        raise HTTPException(404, "Teacher not found")
    courses = db.query(models.Course).filter(models.Course.teacher_id == teacher_id).all()
    course_ids = [c.id for c in courses]
    enrollments = db.query(models.Enrollment).filter(
        models.Enrollment.course_id.in_(course_ids)
    ).all()
    student_ids = list(set([e.student_id for e in enrollments]))
    perfs = db.query(models.StudentPerformance).filter(
        models.StudentPerformance.student_id.in_(student_ids)
    ).all()
    avg = round(sum(p.avg_quiz_score or 0 for p in perfs)/len(perfs),1) if perfs else 0
    doubts_answered = db.query(models.ChatMessage).filter(
        models.ChatMessage.faculty_id == teacher_id,
        models.ChatMessage.response != None
    ).count()
    courses_data = []
    for c in courses:
        enrolled = db.query(models.Enrollment).filter(
            models.Enrollment.course_id == c.id
        ).count()
        c_student_ids = [e.student_id for e in db.query(models.Enrollment).filter(
            models.Enrollment.course_id == c.id
        ).all()]
        c_perfs = db.query(models.StudentPerformance).filter(
            models.StudentPerformance.student_id.in_(c_student_ids)
        ).all()
        c_avg = round(sum(p.avg_quiz_score or 0 for p in c_perfs)/len(c_perfs),1) if c_perfs else 0
        courses_data.append({
            "id": c.id, "title": c.title, "enrolled": enrolled,
            "avg_score": c_avg, "status": c.status,
            "created_at": c.created_at.isoformat() if hasattr(c,"created_at") and c.created_at else None
        })
    return {
        "profile": {
            "id": teacher.id, "name": teacher.name, "email": teacher.email,
            "is_active": getattr(teacher, "is_active", True),
            "created_at": teacher.created_at.isoformat() if teacher.created_at else None
        },
        "stats": {
            "course_count": len(courses), "student_count": len(student_ids),
            "avg_score": avg, "doubts_answered": doubts_answered
        },
        "courses": courses_data
    }

# ── ADMIN COURSES ─────────────────────────────────────────────────────────────
@router.get("/api/v1/admin/courses")
def get_all_courses(admin=Depends(get_current_admin), db=Depends(get_db)):
    courses = db.query(models.Course).filter(
        models.Course.organization_id == admin.organization_id
    ).all()
    result = []
    for c in courses:
        teacher = db.query(models.User).filter(models.User.id == c.teacher_id).first()
        enrolled = db.query(models.Enrollment).filter(
            models.Enrollment.course_id == c.id
        ).count()
        result.append({
            "id": c.id, "title": c.title, "description": c.description,
            "difficulty": c.difficulty, "logo": c.logo, "status": c.status,
            "teacher_name": teacher.name if teacher else "Unassigned",
            "teacher_id": c.teacher_id, "enrolled_students": enrolled
        })
    return result

@router.put("/api/v1/admin/courses/{course_id}/status")
def toggle_course_status(
    course_id: int, status: bool = Form(...),
    admin=Depends(get_current_admin), db=Depends(get_db)
):
    course = db.query(models.Course).filter(
        models.Course.id == course_id,
        models.Course.organization_id == admin.organization_id
    ).first()
    if not course:
        raise HTTPException(404, "Course not found")
    course.status = status
    db.commit()
    return {"message": "Course status updated"}

@router.delete("/api/v1/admin/courses/{course_id}")
def delete_course(
    course_id: int, admin=Depends(get_current_admin), db=Depends(get_db)
):
    course = db.query(models.Course).filter(
        models.Course.id == course_id,
        models.Course.organization_id == admin.organization_id
    ).first()
    if not course:
        raise HTTPException(404, "Course not found")
    db.delete(course)
    db.commit()
    return {"message": "Course deleted"}

# ── ADMIN STUDENTS ────────────────────────────────────────────────────────────
@router.get("/api/v1/admin/students")
def get_all_students(admin=Depends(get_current_admin), db=Depends(get_db)):
    courses = db.query(models.Course).filter(
        models.Course.organization_id == admin.organization_id
    ).all()
    course_ids = [c.id for c in courses]
    enrollments = db.query(models.Enrollment).filter(
        models.Enrollment.course_id.in_(course_ids)
    ).all()
    student_ids = list(set([e.student_id for e in enrollments]))
    result = []
    for sid in student_ids:
        student = db.query(models.User).filter(models.User.id == sid).first()
        if not student:
            continue
        perf = db.query(models.StudentPerformance).filter(
            models.StudentPerformance.student_id == sid
        ).first()
        s_enrollments = [e for e in enrollments if e.student_id == sid]
        latest_course_id = s_enrollments[-1].course_id if s_enrollments else None
        latest_course = next((c for c in courses if c.id == latest_course_id), None)
        result.append({
            "id": student.id, "name": student.name, "email": student.email,
            "overall_score": round((perf.avg_quiz_score or 0 + perf.avg_assignment_score or 0)/2, 1) if perf else 0,
            "learner_level": perf.learner_level if perf else "Average",
            "course_count": len(s_enrollments),
            "main_course": latest_course.title if latest_course else "—",
            "created_at": student.created_at.isoformat() if student.created_at else None
        })
    return result

# Student detail endpoints — same as teacher but for admin scope
@router.get("/api/v1/admin/students/{student_id}/detail")
def get_student_detail(student_id: int, admin=Depends(get_current_admin), db=Depends(get_db)):
    student = db.query(models.User).filter(models.User.id == student_id).first()
    if not student:
        raise HTTPException(404, "Student not found")
    perf = db.query(models.StudentPerformance).filter(
        models.StudentPerformance.student_id == student_id
    ).first()
    return {
        "id": student.id, "name": student.name, "email": student.email,
        "created_at": student.created_at.isoformat() if student.created_at else None,
        "learner_level": perf.learner_level if perf else "Average",
        "avg_quiz_score": perf.avg_quiz_score if perf else 0,
        "avg_assignment_score": perf.avg_assignment_score if perf else 0,
        "completion_rate": perf.completion_rate if perf else 0
    }

@router.get("/api/v1/admin/students/{student_id}/quiz-attempts")
def get_student_quiz_attempts(student_id: int, admin=Depends(get_current_admin), db=Depends(get_db)):
    attempts = db.query(models.QuizAttempt).filter(
        models.QuizAttempt.student_id == student_id
    ).all()
    result = []
    for a in attempts:
        quiz = db.query(models.Quiz).filter(models.Quiz.id == a.quiz_id).first()
        topic = db.query(models.Topic).filter(models.Topic.id == quiz.topic_id).first() if quiz else None
        course = db.query(models.Course).filter(models.Course.id == topic.course_id).first() if topic else None
        total_q = db.query(models.QuizQuestion).filter(models.QuizQuestion.quiz_id == a.quiz_id).count()
        pct = round((a.score/total_q)*100,1) if total_q else 0
        result.append({
            "quiz_title": quiz.title if quiz else "—",
            "topic_name": topic.title if topic else "—",
            "course_title": course.title if course else "—",
            "course_id": course.id if course else None,
            "score": a.score, "total_questions": total_q,
            "percentage": pct,
            "attempted_at": a.attempted_at.isoformat() if a.attempted_at else None
        })
    return result

@router.get("/api/v1/admin/students/{student_id}/assignment-submissions")
def get_student_submissions(student_id: int, admin=Depends(get_current_admin), db=Depends(get_db)):
    subs = db.query(models.AssignmentSubmission).filter(
        models.AssignmentSubmission.student_id == student_id
    ).all()
    result = []
    for s in subs:
        assign = db.query(models.Assignment).filter(models.Assignment.id == s.assignment_id).first()
        topic = db.query(models.Topic).filter(models.Topic.id == assign.topic_id).first() if assign else None
        course = db.query(models.Course).filter(models.Course.id == topic.course_id).first() if topic else None
        result.append({
            "assignment_title": assign.title if assign else "—",
            "course_title": course.title if course else "—",
            "course_id": course.id if course else None,
            "obtained_marks": s.obtained_marks,
            "total_marks": assign.total_marks if assign else 10,
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None
        })
    return result

@router.get("/api/v1/admin/students/{student_id}/video-progress")
def get_student_video_progress(student_id: int, admin=Depends(get_current_admin), db=Depends(get_db)):
    vp = db.query(models.VideoProgress).filter(models.VideoProgress.student_id == student_id).all()
    return [{"video_id": v.video_id, "watch_time": v.watch_time,
             "watch_percentage": v.watch_percentage} for v in vp]

@router.get("/api/v1/admin/students/{student_id}/enrollments")
def get_student_enrollments(student_id: int, admin=Depends(get_current_admin), db=Depends(get_db)):
    enrollments = db.query(models.Enrollment).filter(
        models.Enrollment.student_id == student_id
    ).all()
    result = []
    for e in enrollments:
        course = db.query(models.Course).filter(models.Course.id == e.course_id).first()
        if not course or course.organization_id != admin.organization_id:
            continue
        topics = db.query(models.Topic).filter(models.Topic.course_id == course.id).all()
        topic_ids = [t.id for t in topics]
        quiz_count = db.query(models.Quiz).filter(models.Quiz.topic_id.in_(topic_ids)).count()
        videos = db.query(models.Video).filter(models.Video.topic_id.in_(topic_ids)).all()
        result.append({
            "course_id": course.id, "course_title": course.title,
            "quiz_count": quiz_count, "video_count": len(videos),
            "video_ids": [v.id for v in videos]
        })
    return result

# ── ADMIN ANALYTICS ───────────────────────────────────────────────────────────
@router.get("/api/v1/admin/analytics")
def get_admin_analytics(admin=Depends(get_current_admin), db=Depends(get_db)):
    org_id = admin.organization_id
    courses = db.query(models.Course).filter(models.Course.organization_id == org_id).all()
    course_ids = [c.id for c in courses]
    enrollments = db.query(models.Enrollment).filter(
        models.Enrollment.course_id.in_(course_ids)
    ).all()
    student_ids = list(set([e.student_id for e in enrollments]))
    perfs = db.query(models.StudentPerformance).filter(
        models.StudentPerformance.student_id.in_(student_ids)
    ).all()
    
    platform_avg = round(sum(p.avg_quiz_score or 0 for p in perfs)/len(perfs),1) if perfs else 0
    completion_avg = round(sum(p.completion_rate or 0 for p in perfs)/len(perfs),1) if perfs else 0
    
    # Level distribution
    levels = {"Strong": 0, "Average": 0, "Weak": 0}
    for p in perfs:
        lv = p.learner_level or "Average"
        if lv in levels: levels[lv] += 1
    
    # Monthly growth (last 6 months)
    from datetime import datetime, timedelta
    monthly = []
    for i in range(5, -1, -1):
        month_start = (datetime.utcnow().replace(day=1) - timedelta(days=i*30))
        month_end   = month_start + timedelta(days=30)
        count = db.query(models.User).filter(
            models.User.organization_id == org_id,
            models.User.role == "student",
            models.User.created_at >= month_start,
            models.User.created_at < month_end
        ).count()
        monthly.append({"month": month_start.strftime("%b %Y"), "count": count})
    
    # Course performance
    course_perf = []
    for c in courses:
        c_enrollments = [e for e in enrollments if e.course_id == c.id]
        c_student_ids = [e.student_id for e in c_enrollments]
        c_perfs = [p for p in perfs if p.student_id in c_student_ids]
        c_avg = round(sum(p.avg_quiz_score or 0 for p in c_perfs)/len(c_perfs),1) if c_perfs else 0
        teacher = db.query(models.User).filter(models.User.id == c.teacher_id).first()
        course_perf.append({"title": c.title, "avg_score": c_avg,
                            "teacher_name": teacher.name if teacher else "—"})
    
    # Weak topics (avg score < 60)
    weak_topics = []
    for c in courses:
        teacher = db.query(models.User).filter(models.User.id == c.teacher_id).first()
        topics = db.query(models.Topic).filter(models.Topic.course_id == c.id).all()
        for t in topics:
            quizzes = db.query(models.Quiz).filter(models.Quiz.topic_id == t.id).all()
            quiz_ids = [q.id for q in quizzes]
            if not quiz_ids:
                continue
            attempts = db.query(models.QuizAttempt).filter(
                models.QuizAttempt.quiz_id.in_(quiz_ids),
                models.QuizAttempt.student_id.in_(student_ids)
            ).all()
            if not attempts:
                continue
            total_qs = {q.id: db.query(models.QuizQuestion).filter(
                models.QuizQuestion.quiz_id == q.id).count() for q in quizzes}
            scores = [round((a.score/total_qs.get(a.quiz_id,1))*100) for a in attempts]
            avg_score = round(sum(scores)/len(scores),1)
            if avg_score < 60:
                weak_topics.append({
                    "topic_name": t.title, "course_title": c.title,
                    "teacher_name": teacher.name if teacher else "—",
                    "avg_score": avg_score, "affected_students": len(set(a.student_id for a in attempts))
                })
    
    # Engagement
    total_videos = db.query(models.Video).join(models.Topic).filter(
        models.Topic.course_id.in_(course_ids)).count()
    completed_v = db.query(models.VideoProgress).filter(
        models.VideoProgress.student_id.in_(student_ids),
        models.VideoProgress.watch_percentage >= 80).count()
    total_q = db.query(models.Quiz).join(models.Topic).filter(
        models.Topic.course_id.in_(course_ids)).count()
    attempted_q = db.query(models.QuizAttempt).filter(
        models.QuizAttempt.student_id.in_(student_ids)).count()
    total_a = db.query(models.Assignment).join(models.Topic).filter(
        models.Topic.course_id.in_(course_ids)).count()
    submitted_a = db.query(models.AssignmentSubmission).filter(
        models.AssignmentSubmission.student_id.in_(student_ids)).count()
    
    n = len(student_ids) or 1
    return {
        "total_students": len(student_ids),
        "total_courses": len(courses),
        "platform_avg_score": platform_avg,
        "completion_rate": completion_avg,
        "monthly_growth": monthly,
        "course_performance": sorted(course_perf, key=lambda x: -x["avg_score"]),
        "level_distribution": levels,
        "engagement": {
            "video_rate": round(completed_v/(total_videos*n)*100) if total_videos*n else 0,
            "quiz_rate": round(attempted_q/(total_q*n)*100) if total_q*n else 0,
            "assign_rate": round(submitted_a/(total_a*n)*100) if total_a*n else 0
        },
        "weak_topics": sorted(weak_topics, key=lambda x: x["avg_score"])
    }

# ── CERTIFICATES ──────────────────────────────────────────────────────────────
@router.get("/api/v1/admin/certificates/eligible")
def get_eligible_students(admin=Depends(get_current_admin), db=Depends(get_db)):
    courses = db.query(models.Course).filter(
        models.Course.organization_id == admin.organization_id
    ).all()
    result = []
    for c in courses:
        enrollments = db.query(models.Enrollment).filter(
            models.Enrollment.course_id == c.id
        ).all()
        for e in enrollments:
            already_issued = db.query(models.Certificate).filter(
                models.Certificate.student_id == e.student_id,
                models.Certificate.course_id == c.id
            ).first()
            if already_issued:
                continue
            perf = db.query(models.StudentPerformance).filter(
                models.StudentPerformance.student_id == e.student_id
            ).first()
            if perf and (perf.completion_rate or 0) >= 80 and (perf.avg_quiz_score or 0) >= 70:
                student = db.query(models.User).filter(models.User.id == e.student_id).first()
                result.append({
                    "student_id": e.student_id,
                    "student_name": student.name if student else "—",
                    "course_id": c.id, "course_title": c.title,
                    "avg_score": round(perf.avg_quiz_score, 1),
                    "completion_rate": round(perf.completion_rate, 1)
                })
    return result

@router.get("/api/v1/admin/certificates/issued")
def get_issued_certificates(admin=Depends(get_current_admin), db=Depends(get_db)):
    courses = db.query(models.Course).filter(
        models.Course.organization_id == admin.organization_id
    ).all()
    course_ids = [c.id for c in courses]
    certs = db.query(models.Certificate).filter(
        models.Certificate.course_id.in_(course_ids)
    ).all()
    result = []
    for cert in certs:
        student = db.query(models.User).filter(models.User.id == cert.student_id).first()
        course  = db.query(models.Course).filter(models.Course.id == cert.course_id).first()
        issuer  = db.query(models.User).filter(models.User.id == cert.issued_by).first()
        result.append({
            "id": cert.id,
            "student_name": student.name if student else "—",
            "course_title": course.title if course else "—",
            "issued_at": cert.issued_at.isoformat() if cert.issued_at else None,
            "issued_by_name": issuer.name if issuer else "Admin",
            "is_valid": cert.is_valid
        })
    return result

@router.post("/api/v1/admin/certificates")
def issue_certificate(
    student_id: int = Form(...), course_id: int = Form(...),
    admin=Depends(get_current_admin), db=Depends(get_db)
):
    existing = db.query(models.Certificate).filter(
        models.Certificate.student_id == student_id,
        models.Certificate.course_id == course_id
    ).first()
    if existing:
        raise HTTPException(400, "Certificate already issued")
    cert = models.Certificate(
        student_id=student_id, course_id=course_id,
        issued_by=admin.id, issued_at=datetime.utcnow(), is_valid=True
    )
    db.add(cert)
    db.commit()
    return {"message": "Certificate issued", "id": cert.id}

@router.put("/api/v1/admin/certificates/{cert_id}/revoke")
def revoke_certificate(cert_id: int, admin=Depends(get_current_admin), db=Depends(get_db)):
    cert = db.query(models.Certificate).filter(models.Certificate.id == cert_id).first()
    if not cert:
        raise HTTPException(404, "Certificate not found")
    cert.is_valid = False
    db.commit()
    return {"message": "Certificate revoked"}

# ── ADMIN ORGANIZATION (branding — ADMIN EXCLUSIVE) ──────────────────────────
@router.get("/api/v1/admin/organization")
def get_organization(admin=Depends(get_current_admin), db=Depends(get_db)):
    org = db.query(models.Organization).filter(
        models.Organization.id == admin.organization_id
    ).first()
    if not org:
        raise HTTPException(404, "Organization not found")
    return {
        "org_name": org.name,
        "platform_name": org.platform_name,
        "logo": f"http://127.0.0.1:8000/{org.logo}" if org.logo else None
    }

@router.put("/api/v1/admin/organization")
async def update_organization(
    org_name: str = Form(None),
    platform_name: str = Form(None),
    logo: UploadFile = File(None),
    admin=Depends(get_current_admin), db=Depends(get_db)
):
    org = db.query(models.Organization).filter(
        models.Organization.id == admin.organization_id
    ).first()
    if not org:
        raise HTTPException(404, "Organization not found")
    if org_name:
        org.name = org_name
    if platform_name:
        org.platform_name = platform_name
    if logo and logo.filename:
        upload_dir = "static/logos"
        os.makedirs(upload_dir, exist_ok=True)
        file_path = f"{upload_dir}/{admin.organization_id}_{logo.filename}"
        with open(file_path, "wb") as f:
            shutil.copyfileobj(logo.file, f)
        org.logo = file_path
    db.commit()
    db.refresh(org)
    return {
        "org_name": org.name,
        "platform_name": org.platform_name,
        "logo": org.logo,
        "logo_url": f"http://127.0.0.1:8000/{org.logo}" if org.logo else None
    }

# ── ADMIN PROFILE ─────────────────────────────────────────────────────────────
@router.get("/api/v1/admin/profile")
def get_admin_profile(admin=Depends(get_current_admin), db=Depends(get_db)):
    return {"id": admin.id, "name": admin.name, "email": admin.email}

@router.put("/api/v1/admin/profile")
def update_admin_profile(
    name: str = Form(None), email: str = Form(None),
    current_password: str = Form(None), new_password: str = Form(None),
    admin_user=Depends(get_current_admin), db=Depends(get_db)
):
    from auth_utils import hash_password, verify_password
    if name: admin_user.name = name
    if email: admin_user.email = email
    if current_password and new_password:
        if not verify_password(current_password, admin_user.password_hash):
            raise HTTPException(400, "Current password is incorrect")
        admin_user.password_hash = hash_password(new_password)
    db.commit()
    return {"message": "Profile updated", "name": admin_user.name, "email": admin_user.email}
```

---

## AUTH.HTML — Role-Based Redirect After Login

After successful login, check role and redirect:
```javascript
const data = await res.json();
localStorage.setItem("token", data.access_token);
localStorage.setItem("user", JSON.stringify(data.user));

// Role-based redirect
if (data.user.role === "admin")   window.location.href = "admin/dashboard.html";
if (data.user.role === "teacher") window.location.href = "teacher/dashboard.html";
if (data.user.role === "student") window.location.href = "student/student-courses.html";
```

Login response must include:
```json
{
  "access_token": "...",
  "user": {
    "id": 1, "name": "John", "email": "j@j.com",
    "role": "admin|teacher|student",
    "platform_name": "LearnHub",
    "org_logo": "static/logos/1_logo.png"
  }
}
```

---

## MAIN.PY ROUTER REGISTRATION

```python
from routers import teacher, admin_router, student, chat  # keep chat router as-is

app.include_router(teacher.router)
app.include_router(admin_router.router)
app.include_router(student.router)
app.include_router(chat.router)   # doubts/chatbot — unchanged
```

---

## SUMMARY OF WHAT TO GENERATE

1. **`admin/` folder** — all 9 HTML files + 9 CSS files + 9 JS files
2. **`routers/admin_router.py`** — complete (provided above, use as-is)
3. **`teacher/js/settings.js`** — update settings page: remove org branding edit, add read-only display with "Contact admin to change branding" note
4. **`teacher/js/layout.js`** — unchanged (already correct)
5. **`auth.html`** — add role-based redirect only
6. **`dependencies.py`** — add get_current_admin function

Do NOT change:
- Any student portal files
- teacher/js/add-course.js (PDF extraction, video upload)
- teacher/js/doubts.js (chatbot/doubts system)
- Any existing database models
- Any existing student API endpoints
