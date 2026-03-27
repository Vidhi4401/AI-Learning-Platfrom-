import json
import os
import requests as http_requests
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from database import SessionLocal
import models, schemas, joblib, pandas as pd
from dependencies import get_current_user
from config import GROQ_API_KEY
from passlib.context import CryptContext

# =========================
# ML MODEL LOADING (load once at startup)
# =========================
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

LEVEL_MODEL_PATH = os.path.join(base_dir, "ml", "final_level_model.pkl")
RISK_MODEL_PATH  = os.path.join(base_dir, "ml", "final_risk_model.pkl")
SCALER_PATH      = os.path.join(base_dir, "ml", "final_scaler.pkl")

try:
    level_model = joblib.load(LEVEL_MODEL_PATH)
    risk_model  = joblib.load(RISK_MODEL_PATH)
    scaler      = joblib.load(SCALER_PATH)
    print("[ML] Models loaded successfully")
except Exception as e:
    print(f"[ML] Model load error (using fallback): {e}")
    level_model = risk_model = scaler = None


# =========================
# ML PREDICTION HELPER
# =========================
def predict_learner_level(features: dict) -> str:
    try:
        if level_model is None or scaler is None:
            return "Average"

        recognized = [
            "overall_score", "quiz_average", "assignment_average",
            "completion_rate", "avg_watch_time", "quiz_attempt_rate",
            "assignment_submission_rate", "videos_completed",
            "quizzes_attempted", "assignments_submitted", "total_course_items"
        ]
        clean = {f: features.get(f, 0) for f in recognized}
        df     = pd.DataFrame([clean])
        scaled = scaler.transform(df)
        return level_model.predict(scaled)[0]
    except Exception as e:
        print(f"[ML Prediction Error] {e}")
        return "Average"


# =========================
# ROUTER SETUP
# =========================
router = APIRouter(prefix="/api/v1/student", tags=["Student"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_student(current_user: models.User = Depends(get_current_user)):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Student access required")
    return current_user

GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

if not GROQ_API_KEY:
    print("[student.py] ERROR: GROQ_API_KEY empty — check backend/.env")
else:
    print(f"[student.py] GROQ key: {GROQ_API_KEY[:8]}...{GROQ_API_KEY[-4:]}")


# ────────────────────────────────────────────
#  COURSES
# ────────────────────────────────────────────

@router.get("/courses")
def get_student_courses(
    current_user: models.User = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    results = db.query(models.Course, models.User.name.label("teacher_name")).join(
        models.User, models.Course.created_by == models.User.id
    ).filter(
        models.Course.organization_id == current_user.organization_id,
        models.Course.status == True
    ).all()

    return [{
        "id": c.id, "title": c.title, "description": c.description,
        "difficulty": c.difficulty, "logo": c.logo, "status": c.status,
        "teacher_name": teacher_name
    } for c, teacher_name in results]


@router.get("/enrollments")
def get_enrollments(
    current_user: models.User = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    enrollments = db.query(models.Enrollment).filter(
        models.Enrollment.student_id == current_user.id
    ).all()

    # A course is "completed" when an issued certificate exists for it
    issued_course_ids = {
        c.course_id for c in db.query(models.Certificate).filter(
            models.Certificate.student_id == current_user.id,
            models.Certificate.issued     == True
        ).all()
    }

    return [
        {
            "id":        e.id,
            "course_id": e.course_id,
            "completed": e.course_id in issued_course_ids
        }
        for e in enrollments
    ]


@router.post("/courses/{course_id}/enroll")
def enroll_course(
    course_id: int,
    current_user: models.User = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    course = db.query(models.Course).filter(
        models.Course.id == course_id,
        models.Course.organization_id == current_user.organization_id
    ).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    existing = db.query(models.Enrollment).filter(
        models.Enrollment.student_id == current_user.id,
        models.Enrollment.course_id  == course_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already enrolled")

    e = models.Enrollment(student_id=current_user.id, course_id=course_id)
    db.add(e); db.commit(); db.refresh(e)
    return {"message": "Enrolled successfully", "enrollment_id": e.id}


@router.get("/courses/{course_id}/stats")
def get_course_stats(
    course_id: int,
    current_user: models.User = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    course = db.query(models.Course).filter(
        models.Course.id == course_id,
        models.Course.organization_id == current_user.organization_id
    ).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    topic_ids = [t.id for t in
                 db.query(models.Topic.id).filter(models.Topic.course_id == course_id).all()]

    total_quizzes     = db.query(models.Quiz).filter(
        models.Quiz.topic_id.in_(topic_ids)).count() if topic_ids else 0
    total_assignments = db.query(models.Assignment).filter(
        models.Assignment.topic_id.in_(topic_ids)).count() if topic_ids else 0

    return {
        "total_topics":      len(topic_ids),
        "total_quizzes":     total_quizzes,
        "total_assignments": total_assignments
    }


@router.get("/courses/{course_id}/detail")
def get_course_detail(
    course_id: int,
    current_user: models.User = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    course = db.query(models.Course).filter(
        models.Course.id == course_id,
        models.Course.organization_id == current_user.organization_id
    ).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    is_enrolled = db.query(models.Enrollment).filter(
        models.Enrollment.student_id == current_user.id,
        models.Enrollment.course_id  == course_id
    ).first() is not None

    # Certificate info
    cert = db.query(models.Certificate).filter(
        models.Certificate.student_id == current_user.id,
        models.Certificate.course_id  == course_id
    ).first()

    topics = db.query(models.Topic).filter(
        models.Topic.course_id == course_id
    ).order_by(models.Topic.order_number).all()

    topics_data = []
    for t in topics:
        videos      = db.query(models.Video).filter(models.Video.topic_id == t.id).all()
        quizzes     = db.query(models.Quiz).filter(models.Quiz.topic_id == t.id).all()
        assignments = db.query(models.Assignment).filter(
            models.Assignment.topic_id == t.id).all()

        topics_data.append({
            "id": t.id, "title": t.title, "order_number": t.order_number,
            "videos":      [{"id": v.id, "video_url": v.video_url,
                             "duration": v.duration} for v in videos],
            "quizzes":     [{"id": q.id, "title": q.title} for q in quizzes],
            "assignments": [{"id": a.id, "title": a.title,
                             "total_marks": a.total_marks} for a in assignments]
        })

    return {
        "id": course.id, "title": course.title,
        "description": course.description,
        "difficulty":  course.difficulty,
        "logo":        course.logo,
        "is_enrolled": is_enrolled,
        "cert_status": getattr(cert, "status", None),
        "cert_issued": getattr(cert, "issued", False),
        "topics":      topics_data
    }


@router.get("/my-courses")
def get_my_enrolled_courses(
    current_user: models.User = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    # Join Enrollments with Courses
    results = db.query(models.Course).join(
        models.Enrollment, models.Enrollment.course_id == models.Course.id
    ).filter(
        models.Enrollment.student_id == current_user.id
    ).all()

    return results

# ────────────────────────────────────────────
#  CERTIFICATES
# ────────────────────────────────────────────

@router.post("/courses/{course_id}/request-certificate")
def request_certificate(
    course_id: int,
    db: Session = Depends(get_db),
    student: models.User = Depends(get_current_student)
):
    existing = db.query(models.Certificate).filter(
        models.Certificate.student_id == student.id,
        models.Certificate.course_id  == course_id
    ).first()
    if existing:
        return {"message": "Request already exists", "status": existing.status}

    # Check all videos watched >= 90%
    topic_ids = [t.id for t in
                 db.query(models.Topic.id).filter(models.Topic.course_id == course_id).all()]
    video_ids = [v.id for v in
                 db.query(models.Video.id).filter(models.Video.topic_id.in_(topic_ids)).all()]

    if video_ids:
        watched_count = db.query(models.VideoProgress).filter(
            models.VideoProgress.student_id     == student.id,
            models.VideoProgress.video_id.in_(video_ids),
            models.VideoProgress.watch_percentage >= 90
        ).count()
        if watched_count < len(video_ids):
            raise HTTPException(
                status_code=400,
                detail=f"Complete all videos first ({watched_count}/{len(video_ids)})"
            )

    new_cert = models.Certificate(
        student_id=student.id, course_id=course_id,
        status="pending", eligible=True
    )
    db.add(new_cert); db.commit()
    return {"message": "Certificate request submitted.", "status": "pending"}


@router.get("/certificates")
def get_my_certificates(
    db: Session = Depends(get_db),
    student: models.User = Depends(get_current_student)
):
    certs = db.query(models.Certificate, models.Course.title)\
        .join(models.Course)\
        .filter(models.Certificate.student_id == student.id).all()

    return [{
        "id":           c.id,
        "course_title": title,
        "status":       c.status,
        "issued":       c.issued,
        "issued_at":    c.issued_at.isoformat() if c.issued_at else None
    } for c, title in certs]


@router.get("/certificates/{cert_id}/download")
def download_certificate(
    cert_id: int,
    db: Session = Depends(get_db),
    student: models.User = Depends(get_current_student)
):
    cert = db.query(models.Certificate).filter(
        models.Certificate.id         == cert_id,
        models.Certificate.student_id == student.id,
        models.Certificate.issued     == True
    ).first()
    if not cert:
        raise HTTPException(status_code=404,
                            detail="Certificate not found or not yet issued.")

    course = db.query(models.Course).filter(models.Course.id == cert.course_id).first()
    org    = db.query(models.Organization).filter(
        models.Organization.id == student.organization_id).first()

    try:
        from certificate_generator import generate_certificate_pdf
        pdf_buffer = generate_certificate_pdf(
            student_name=student.name,
            course_name=course.title,
            org_name=org.platform_name or org.name,
            issue_date=cert.issued_at.strftime("%B %d, %Y")
        )
        safe_course = "".join(
            ch for ch in course.title.replace(" ", "_")
            if ord(ch) < 128 and ch not in r'\\/:*?"<>|'
        ) or "Course"
        headers = {
            'Content-Disposition':
                f'attachment; filename="Certificate_{safe_course}.pdf"'
        }
        return StreamingResponse(pdf_buffer, headers=headers,
                                 media_type='application/pdf')
    except ImportError:
        raise HTTPException(status_code=500,
                            detail="Certificate generator not available.")


# ────────────────────────────────────────────
#  VIDEO PROGRESS
# ────────────────────────────────────────────

class VideoProgressIn(BaseModel):
    watch_time:       int
    watch_percentage: int
    skip_count:       Optional[int]   = 0
    playback_speed:   Optional[float] = 1.0


@router.post("/videos/{video_id}/progress")
def save_video_progress(
    video_id: int,
    data: VideoProgressIn,
    current_user: models.User = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    existing = db.query(models.VideoProgress).filter(
        models.VideoProgress.student_id == current_user.id,
        models.VideoProgress.video_id   == video_id
    ).first()

    if existing:
        if data.watch_percentage > (existing.watch_percentage or 0):
            existing.watch_percentage = data.watch_percentage
        if data.watch_time > (existing.watch_time or 0):
            existing.watch_time = data.watch_time
        existing.skip_count     = data.skip_count
        existing.playback_speed = data.playback_speed
    else:
        db.add(models.VideoProgress(
            student_id=current_user.id, video_id=video_id,
            watch_time=data.watch_time, watch_percentage=data.watch_percentage,
            skip_count=data.skip_count, playback_speed=data.playback_speed
        ))
    db.commit()
    return {"message": "Progress saved"}


@router.get("/videos/{video_id}/progress")
def get_video_progress(
    video_id: int,
    current_user: models.User = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    p = db.query(models.VideoProgress).filter(
        models.VideoProgress.student_id == current_user.id,
        models.VideoProgress.video_id   == video_id
    ).first()
    if not p:
        return {"watch_time": 0, "watch_percentage": 0,
                "skip_count": 0, "playback_speed": 1.0}
    return {
        "watch_time":       p.watch_time,
        "watch_percentage": p.watch_percentage,
        "skip_count":       p.skip_count,
        "playback_speed":   p.playback_speed
    }


@router.get("/video-progress-all")
def get_all_video_progress(
    current_user: models.User = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    records = db.query(models.VideoProgress).filter(
        models.VideoProgress.student_id == current_user.id
    ).all()
    return [{
        "video_id":         r.video_id,
        "watch_time":       r.watch_time,
        "watch_percentage": r.watch_percentage
    } for r in records]


# ────────────────────────────────────────────
#  QUIZ ATTEMPTS
# ────────────────────────────────────────────

class AnswerItem(BaseModel):
    question_id:     int
    selected_option: Optional[str] = None

class QuizAttemptIn(BaseModel):
    answers: List[AnswerItem]


@router.get("/quiz-attempts")
def get_all_attempts(
    current_user: models.User = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    attempts = db.query(models.QuizAttempt).filter(
        models.QuizAttempt.student_id == current_user.id
    ).all()
    result = []
    for a in attempts:
        q_count = db.query(models.QuizQuestion).filter(
            models.QuizQuestion.quiz_id == a.quiz_id
        ).count()
        pct = round((a.score / q_count) * 100, 2) if q_count > 0 else 0
        result.append({
            "id":           a.id,
            "quiz_id":      a.quiz_id,
            "score":        a.score,
            "total":        q_count,
            "percentage":   pct,
            "attempted_at": a.attempted_at
        })
    return result


@router.post("/quizzes/{quiz_id}/attempt")
def submit_quiz(
    quiz_id: int,
    payload: QuizAttemptIn,
    current_user: models.User = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    if db.query(models.QuizAttempt).filter(
        models.QuizAttempt.student_id == current_user.id,
        models.QuizAttempt.quiz_id    == quiz_id
    ).first():
        raise HTTPException(status_code=400, detail="Quiz already attempted")

    questions = db.query(models.QuizQuestion).filter(
        models.QuizQuestion.quiz_id == quiz_id
    ).all()
    if not questions:
        raise HTTPException(status_code=404, detail="No questions found")

    correct_map   = {q.id: q.correct_option.upper() for q in questions}
    total         = len(questions)
    correct_count = 0
    wrong_count   = 0
    skipped_count = 0

    for ans in payload.answers:
        sel = (ans.selected_option or "").strip().upper()
        if not sel:
            skipped_count += 1
        elif sel == correct_map.get(ans.question_id, ""):
            correct_count += 1
        else:
            wrong_count += 1

    attempt = models.QuizAttempt(
        student_id=current_user.id, quiz_id=quiz_id, score=correct_count
    )
    db.add(attempt); db.commit(); db.refresh(attempt)

    return {
        "attempt_id":      attempt.id,
        "score":           correct_count,
        "total_questions": total,
        "correct_answers": correct_count,
        "wrong_answers":   wrong_count,
        "skipped":         skipped_count,
        "percentage":      round((correct_count / total) * 100, 2) if total > 0 else 0
    }


# ────────────────────────────────────────────
#  AI GRADING
# ────────────────────────────────────────────

class AssignmentSubmitIn(BaseModel):
    student_answer: str


def grade_with_ai(question: str, model_answer: str,
                  student_answer: str, total_marks: int) -> dict:
    if not GROQ_API_KEY:
        return {"obtained_marks": 0,
                "feedback": "Grading unavailable — GROQ_API_KEY not configured."}

    if model_answer and model_answer.strip():
        grading_instruction = (
            f"Grade strictly based on these model answer keywords: {model_answer}\n"
            "Check if the student's answer covers these concepts."
        )
    else:
        grading_instruction = (
            "Grade based on your own knowledge of the subject.\n"
            "Evaluate correctness, completeness, and code quality."
        )

    json_format = ('{"obtained_marks": <integer 0-' + str(total_marks) +
                   '>, "feedback": "<one clear sentence>"}')
    prompt = (
        "You are an expert programming and computer science assignment grader.\n\n"
        f"Question: {question}\n"
        f"{grading_instruction}\n\n"
        f"Student Answer:\n{student_answer}\n\n"
        f"Total Marks: {total_marks}\n\n"
        f"Return ONLY valid JSON, no markdown, no extra text:\n"
        f"{json_format}"
    )

    try:
        res = http_requests.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {GROQ_API_KEY}",
                     "Content-Type": "application/json"},
            json={"model": GROQ_MODEL,
                  "messages": [{"role": "user", "content": prompt}],
                  "temperature": 0.1},
            timeout=30
        )
        print(f"[Groq] status={res.status_code}")
        if res.status_code != 200:
            print(f"[Groq] error: {res.text}")
            return {"obtained_marks": 0,
                    "feedback": f"Grading API error ({res.status_code})."}

        raw     = res.json()["choices"][0]["message"]["content"].strip()
        print(f"[Groq] raw: {raw}")
        cleaned = raw.replace("```json", "").replace("```", "").strip()
        result  = json.loads(cleaned)
        return {
            "obtained_marks": max(0, min(int(result.get("obtained_marks", 0)), total_marks)),
            "feedback":       str(result.get("feedback", ""))
        }
    except Exception as e:
        print(f"[Groq] Exception: {e}")
        return {"obtained_marks": 0,
                "feedback": "Grading failed. Please contact your instructor."}


# ────────────────────────────────────────────
#  ASSIGNMENT ENDPOINTS
# ────────────────────────────────────────────

@router.get("/assignment-submissions")
def get_submissions(
    current_user: models.User = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    subs = db.query(models.AssignmentSubmission).filter(
        models.AssignmentSubmission.student_id == current_user.id
    ).order_by(models.AssignmentSubmission.id.asc()).all()

    grouped = defaultdict(list)
    for s in subs:
        grouped[s.assignment_id].append(s)

    result = []
    for assignment_id, attempts in grouped.items():
        best = max(attempts, key=lambda x: x.obtained_marks or 0)
        result.append({
            "id":             best.id,
            "assignment_id":  assignment_id,
            "obtained_marks": best.obtained_marks,
            "feedback":       getattr(best, "feedback", None),
            "submitted_at":   best.submitted_at,
            "attempt_count":  len(attempts),
            "can_resubmit":   len(attempts) < 2
        })
    return result


@router.get("/assignments/{assignment_id}")
def get_assignment_detail(
    assignment_id: int,
    current_user:  models.User = Depends(get_current_student),
    db: Session    = Depends(get_db)
):
    assignment = db.query(models.Assignment).filter(
        models.Assignment.id == assignment_id
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    topic  = db.query(models.Topic).filter(
        models.Topic.id == assignment.topic_id).first()
    course = db.query(models.Course).filter(
        models.Course.id == topic.course_id).first() if topic else None

    return {
        "id":           assignment.id,
        "title":        assignment.title,
        "description":  assignment.description,
        "total_marks":  assignment.total_marks,
        "topic_title":  topic.title  if topic  else "",
        "course_title": course.title if course else ""
    }


@router.post("/assignments/{assignment_id}/submit")
def submit_assignment(
    assignment_id: int,
    payload:       AssignmentSubmitIn,
    current_user:  models.User = Depends(get_current_student),
    db: Session    = Depends(get_db)
):
    attempt_count = db.query(models.AssignmentSubmission).filter(
        models.AssignmentSubmission.student_id    == current_user.id,
        models.AssignmentSubmission.assignment_id == assignment_id
    ).count()
    if attempt_count >= 2:
        raise HTTPException(status_code=400, detail="Maximum 2 submissions reached")

    assignment = db.query(models.Assignment).filter(
        models.Assignment.id == assignment_id
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    grading = grade_with_ai(
        question=      assignment.title,
        model_answer=  assignment.model_answer or "",
        student_answer=payload.student_answer,
        total_marks=   assignment.total_marks or 10
    )

    # Build submission — only include feedback if column exists
    sub_data = {
        "student_id":     current_user.id,
        "assignment_id":  assignment_id,
        "obtained_marks": grading["obtained_marks"]
    }
    sub_cols = {c.key for c in models.AssignmentSubmission.__table__.columns}
    if "feedback" in sub_cols:
        sub_data["feedback"] = grading["feedback"]

    submission = models.AssignmentSubmission(**sub_data)
    db.add(submission); db.commit(); db.refresh(submission)

    return {
        "submission_id":  submission.id,
        "obtained_marks": grading["obtained_marks"],
        "total_marks":    assignment.total_marks,
        "feedback":       grading["feedback"]
    }


# ────────────────────────────────────────────
#  PERFORMANCE UPDATE (with ML prediction)
# ────────────────────────────────────────────

@router.post("/update-performance")
def update_student_performance(
    data: schemas.StudentPerformanceUpdate,
    current_user: models.User = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    perf = db.query(models.StudentPerformanceSummary).filter(
        models.StudentPerformanceSummary.student_id == current_user.id
    ).first()

    if not perf:
        perf = models.StudentPerformanceSummary(student_id=current_user.id)
        db.add(perf)

    # Update all fields
    fields = [
        "overall_score", "quiz_average", "assignment_average",
        "completion_rate", "avg_watch_time", "quiz_attempt_rate",
        "assignment_submission_rate", "videos_completed",
        "quizzes_attempted", "assignments_submitted", "total_course_items"
    ]
    for field in fields:
        val = getattr(data, field, None)
        if val is not None and hasattr(perf, field):
            setattr(perf, field, val)

    # ML prediction
    level = predict_learner_level(data.model_dump())
    perf.learner_level = level

    # global level if flagged
    if getattr(data, "is_global", False) and hasattr(perf, "global_learner_level"):
        perf.global_learner_level = level

    db.commit()
    return {"message": "Performance updated successfully", "level": level}


# ────────────────────────────────────────────
#  PROFILE & ACCOUNT
# ────────────────────────────────────────────

@router.get("/profile")
def get_student_profile(
    current_user: models.User = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    return {
        "id":    current_user.id,
        "name":  current_user.name,
        "email": current_user.email,
        "role":  current_user.role
    }


@router.put("/profile")
def update_student_profile(
    name:             str = Form(None),
    email:            str = Form(None),
    password:         str = Form(None),
    current_password: str = Form(None),
    current_user: models.User = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()

    if name:  user.name  = name
    if email: user.email = email

    if password:
        if not current_password:
            raise HTTPException(status_code=400, detail="Current password required")
        if not pwd_context.verify(current_password, user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        user.password_hash = pwd_context.hash(password)

    db.commit(); db.refresh(user)
    return {"id": user.id, "name": user.name, "email": user.email}


@router.delete("/account")
def delete_student_account(
    current_user: models.User = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    sid = current_user.id

    db.query(models.QuizAttempt).filter(
        models.QuizAttempt.student_id == sid).delete()
    db.query(models.AssignmentSubmission).filter(
        models.AssignmentSubmission.student_id == sid).delete()
    db.query(models.Enrollment).filter(
        models.Enrollment.student_id == sid).delete()

    try:
        db.query(models.VideoProgress).filter(
            models.VideoProgress.student_id == sid).delete()
    except Exception:
        pass

    try:
        db.query(models.StudentPerformanceSummary).filter(
            models.StudentPerformanceSummary.student_id == sid).delete()
    except Exception:
        pass

    db.query(models.User).filter(models.User.id == sid).delete()
    db.commit()
    return {"message": "Account deleted successfully"}