import json
import os
import requests as http_requests
from collections import defaultdict
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from database import SessionLocal
import models
from dependencies import get_current_user

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


# ────────────────────────────────────────────
#  LOAD .env — walks up from routers/ to find it
# ────────────────────────────────────────────
def _load_env():
    current = os.path.abspath(os.path.dirname(__file__))
    for _ in range(4):
        env_path = os.path.join(current, ".env")
        if os.path.exists(env_path):
            load_dotenv(dotenv_path=env_path)
            print(f"[student.py] .env loaded from: {env_path}")
            return
        current = os.path.dirname(current)
    print("[student.py] WARNING: .env not found — tried 4 parent folders")

_load_env()

# .env is in backend/ — parent folder of routers/
_ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
print(f"[student.py] .env path: {_ENV_PATH}")
print(f"[student.py] .env exists: {os.path.exists(_ENV_PATH)}")
load_dotenv(dotenv_path=_ENV_PATH, override=True)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL   = "llama-3.3-70b-versatile"

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
    courses = db.query(models.Course).filter(
        models.Course.organization_id == current_user.organization_id,
        models.Course.status == True
    ).all()
    return [{"id":c.id,"title":c.title,"description":c.description,
             "difficulty":c.difficulty,"logo":c.logo,"status":c.status} for c in courses]


@router.get("/enrollments")
def get_enrollments(
    current_user: models.User = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    enrollments = db.query(models.Enrollment).filter(
        models.Enrollment.student_id == current_user.id
    ).all()
    return [{"id":e.id,"course_id":e.course_id,"completed":False} for e in enrollments]


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
    return {"message":"Enrolled successfully","enrollment_id":e.id}


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

    total_topics = db.query(models.Topic).filter(models.Topic.course_id==course_id).count()
    topic_ids    = db.query(models.Topic.id).filter(models.Topic.course_id==course_id).subquery()
    total_quizzes     = db.query(models.Quiz).filter(models.Quiz.topic_id.in_(topic_ids)).count()
    total_assignments = db.query(models.Assignment).filter(models.Assignment.topic_id.in_(topic_ids)).count()

    return {"total_topics":total_topics,"total_quizzes":total_quizzes,"total_assignments":total_assignments}


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
        models.Enrollment.student_id==current_user.id,
        models.Enrollment.course_id==course_id
    ).first() is not None

    topics = db.query(models.Topic).filter(
        models.Topic.course_id==course_id
    ).order_by(models.Topic.order_number).all()

    topics_data = []
    for t in topics:
        videos      = db.query(models.Video).filter(models.Video.topic_id==t.id).all()
        quizzes     = db.query(models.Quiz).filter(models.Quiz.topic_id==t.id).all()
        assignments = db.query(models.Assignment).filter(models.Assignment.topic_id==t.id).all()
        topics_data.append({
            "id":t.id,"title":t.title,"order_number":t.order_number,
            "videos":     [{"id":v.id,"video_url":v.video_url,"duration":v.duration} for v in videos],
            "quizzes":    [{"id":q.id,"title":q.title} for q in quizzes],
            "assignments":[{"id":a.id,"title":a.title,"total_marks":a.total_marks} for a in assignments]
        })

    return {"id":course.id,"title":course.title,"description":course.description,
            "difficulty":course.difficulty,"logo":course.logo,
            "is_enrolled":is_enrolled,"topics":topics_data}


# ────────────────────────────────────────────
#  VIDEO PROGRESS
# ────────────────────────────────────────────

class VideoProgressIn(BaseModel):
    watch_time:       int            # seconds watched
    watch_percentage: int            # 0-100
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
        # Only update if progress increased
        if data.watch_percentage > (existing.watch_percentage or 0):
            existing.watch_percentage = data.watch_percentage
        if data.watch_time > (existing.watch_time or 0):
            existing.watch_time = data.watch_time
        existing.skip_count     = data.skip_count
        existing.playback_speed = data.playback_speed
    else:
        db.add(models.VideoProgress(
            student_id=       current_user.id,
            video_id=         video_id,
            watch_time=       data.watch_time,
            watch_percentage= data.watch_percentage,
            skip_count=       data.skip_count,
            playback_speed=   data.playback_speed
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
        return {"watch_time": 0, "watch_percentage": 0, "skip_count": 0, "playback_speed": 1.0}
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
        "video_id":        r.video_id,
        "watch_time":      r.watch_time,
        "watch_percentage":r.watch_percentage
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
        models.QuizAttempt.student_id==current_user.id
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
        models.QuizAttempt.student_id==current_user.id,
        models.QuizAttempt.quiz_id==quiz_id
    ).first():
        raise HTTPException(status_code=400, detail="Quiz already attempted")

    questions = db.query(models.QuizQuestion).filter(
        models.QuizQuestion.quiz_id==quiz_id
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

    score = correct_count
    attempt = models.QuizAttempt(
        student_id=current_user.id, quiz_id=quiz_id, score=score
    )
    db.add(attempt); db.commit(); db.refresh(attempt)

    return {
        "attempt_id":      attempt.id,
        "score":           score,
        "total_questions": total,
        "correct_answers": correct_count,
        "wrong_answers":   wrong_count,
        "skipped":         skipped_count,
        "percentage":      round((score / total) * 100, 2) if total > 0 else 0
    }


# ────────────────────────────────────────────
#  AI GRADING FUNCTION
# ────────────────────────────────────────────

class AssignmentSubmitIn(BaseModel):
    student_answer: str


def grade_with_ai(question: str, model_answer: str,
                  student_answer: str, total_marks: int) -> dict:
    """Grade student answer using Groq API via plain requests (no SDK)."""

    if not GROQ_API_KEY:
        return {"obtained_marks": 0,
                "feedback": "Grading unavailable — GROQ_API_KEY not configured."}

    if model_answer and model_answer.strip():
        grading_instruction = (
            f"Grade strictly based on these model answer keywords: {model_answer}\n"
            f"Check if the student's answer covers these concepts."
        )
    else:
        grading_instruction = (
            "Grade based on your own knowledge of the subject.\n"
            "Evaluate correctness, completeness, and code quality."
        )

    prompt = (
        f"You are an expert programming and computer science assignment grader.\n\n"
        f"Question: {question}\n"
        f"{grading_instruction}\n\n"
        f"Student Answer:\n{student_answer}\n\n"
        f"Total Marks: {total_marks}\n\n"
        f"Return ONLY valid JSON, no markdown, no extra text:\n"
        f'[["obtained_marks": <integer 0-{total_marks}>, "feedback": "<one clear sentence>"]]'
    )

    # Use double braces properly
    json_format = '{"obtained_marks": <integer 0-' + str(total_marks) + '>, "feedback": "<one clear sentence>"}'
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
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type":  "application/json"
            },
            json={
                "model":       GROQ_MODEL,
                "messages":    [{"role": "user", "content": prompt}],
                "temperature": 0.1
            },
            timeout=30
        )

        print(f"[Groq] status={res.status_code}")

        if res.status_code != 200:
            print(f"[Groq] error body: {res.text}")
            return {"obtained_marks": 0, "feedback": f"Grading API error ({res.status_code})."}

        raw     = res.json()["choices"][0]["message"]["content"].strip()
        print(f"[Groq] raw response: {raw}")

        cleaned = raw.replace("```json", "").replace("```", "").strip()
        result  = json.loads(cleaned)

        obtained = max(0, min(int(result.get("obtained_marks", 0)), total_marks))
        feedback = str(result.get("feedback", ""))
        return {"obtained_marks": obtained, "feedback": feedback}

    except Exception as e:
        print(f"[Groq] Exception: {e}")
        return {"obtained_marks": 0, "feedback": "Grading failed. Please contact your instructor."}


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

    topic  = db.query(models.Topic).filter(models.Topic.id == assignment.topic_id).first()
    course = db.query(models.Course).filter(models.Course.id == topic.course_id).first() if topic else None

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
        question=       assignment.title,
        model_answer=   assignment.model_answer or "",
        student_answer= payload.student_answer,
        total_marks=    assignment.total_marks or 10
    )

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
#  STUDENT PROFILE + ACCOUNT
# ────────────────────────────────────────────

from fastapi import Form
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


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
    password:         str = Form(None),   # new password
    current_password: str = Form(None),   # required only when changing password
    current_user: models.User = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()

    if name:  user.name  = name
    if email: user.email = email

    if password:
        # Verify current password first
        if not current_password:
            raise HTTPException(status_code=400, detail="Current password required")
        if not pwd_context.verify(current_password, user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        user.password_hash = pwd_context.hash(password)

    db.commit()
    db.refresh(user)
    return {"id": user.id, "name": user.name, "email": user.email}


@router.delete("/account")
def delete_student_account(
    current_user: models.User = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    student_id = current_user.id

    # Delete all related data
    db.query(models.QuizAttempt).filter(
        models.QuizAttempt.student_id == student_id).delete()
    db.query(models.AssignmentSubmission).filter(
        models.AssignmentSubmission.student_id == student_id).delete()
    db.query(models.Enrollment).filter(
        models.Enrollment.student_id == student_id).delete()

    # Delete video progress if model exists
    try:
        db.query(models.VideoProgress).filter(
            models.VideoProgress.student_id == student_id).delete()
    except Exception:
        pass

    db.query(models.User).filter(models.User.id == student_id).delete()
    db.commit()
    return {"message": "Account deleted successfully"}