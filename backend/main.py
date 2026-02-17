from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware

from database import engine, SessionLocal, Base
import models, schemas
from auth import hash_password, verify_password, create_access_token ,create_reset_token ,verify_reset_token
from sqlalchemy import func
from datetime import datetime
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from auth import decode_access_token

app = FastAPI()
Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(models.User).filter(
        models.User.id == payload.get("user_id")
    ).first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


def get_current_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# ---------------- ORGANIZATIONS ----------------

@app.get("/api/v1/organizations")
def get_orgs(db: Session = Depends(get_db)):
    return db.query(models.Organization).all()

# ---------------- REGISTER (STUDENT ONLY) ----------------

@app.post("/api/v1/auth/register")
def register(data: schemas.RegisterSchema, db: Session = Depends(get_db)):

    existing = db.query(models.User).filter(models.User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = models.User(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        role="student",  # FORCE ROLE
        organization_id=data.organization_id,
        status=True
    )

    db.add(new_user)
    db.commit()

    return {"message": "Registration successful"}

# ---------------- LOGIN ----------------

@app.post("/api/v1/auth/login")
def login(data: schemas.LoginSchema, db: Session = Depends(get_db)):

    user = db.query(models.User).filter(models.User.email == data.email).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({
        "user_id": user.id,
        "role": user.role,
        "organization_id": user.organization_id
    })

    return {
        "success": True,
        "name": user.name,
        "role": user.role,
        "access_token": token
    }


# ---------------- ADMIN DASHBOARD ----------------

@app.get("/api/v1/admin/dashboard")
def admin_dashboard(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):

    total_students = db.query(models.User).filter(
        models.User.role == "student"
    ).count()

    total_courses = db.query(models.Course).count()
    total_assignments = db.query(models.Assignment).count()
    total_quizzes = db.query(models.Quiz).count()

    avg_video_completion = db.query(
        func.coalesce(func.avg(models.VideoProgress.watch_percentage), 0)
    ).scalar()

    avg_quiz_score = db.query(
        func.coalesce(func.avg(models.QuizAttempt.score), 0)
    ).scalar()

    return {
        "total_students": total_students,
        "total_courses": total_courses,
        "total_assignments": total_assignments,
        "total_quizzes": total_quizzes,
        "avg_video_completion": round(avg_video_completion, 2),
        "avg_quiz_score": round(avg_quiz_score, 2)
    }

# ---------------- ADMIN STUDENTS LIST ----------------

@app.get("/api/v1/admin/students")
def get_students(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):

    students = db.query(models.User).filter(
        models.User.role == "student"
    ).all()

    result = []

    for student in students:

        enrolled_courses = db.query(models.Enrollment).filter(
            models.Enrollment.student_id == student.id
        ).count()

        avg_quiz_score = db.query(
            func.coalesce(func.avg(models.QuizAttempt.score), 0)
        ).filter(
            models.QuizAttempt.student_id == student.id
        ).scalar()

        result.append({
            "id": student.id,
            "name": student.name,
            "email": student.email,
            "enrolled_courses": enrolled_courses,
            "avg_quiz_score": round(avg_quiz_score, 2)
        })

    return result

# ---------------- ENROLL COURSE ----------------

@app.post("/api/v1/courses/{course_id}/enroll")
def enroll_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):

    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can enroll")

    existing = db.query(models.Enrollment).filter(
        models.Enrollment.student_id == current_user.id,
        models.Enrollment.course_id == course_id
    ).first()

    if existing:
        return {"message": "Already enrolled"}

    enrollment = models.Enrollment(
        student_id=current_user.id,
        course_id=course_id,
        enrolled_at=datetime.utcnow()
    )

    db.add(enrollment)
    db.commit()

    return {"message": "Enrolled successfully"}

# ---------------- QUIZ SUBMIT ----------------

@app.post("/api/v1/quiz/{quiz_id}/submit")
def submit_quiz(
    quiz_id: int,
    answers: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):

    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students allowed")

    questions = db.query(models.QuizQuestion).filter(
        models.QuizQuestion.quiz_id == quiz_id
    ).all()

    score = 0

    for question in questions:
        if str(question.id) in answers:
            if answers[str(question.id)] == question.correct_option:
                score += 1

    quiz_attempt = models.QuizAttempt(
        quiz_id=quiz_id,
        student_id=current_user.id,
        score=score,
        attempted_at=datetime.utcnow()
    )

    db.add(quiz_attempt)
    db.commit()

    return {"score": score}

# ---------------- TOPIC-WISE PERFORMANCE ----------------

@app.get("/api/v1/admin/topic-performance")
def topic_performance(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):

    topics = db.query(models.Topic).all()

    result = []

    for topic in topics:

        # Average quiz score per topic
        avg_quiz = db.query(
            func.coalesce(func.avg(models.QuizAttempt.score), 0)
        ).join(
            models.Quiz, models.QuizAttempt.quiz_id == models.Quiz.id
        ).filter(
            models.Quiz.topic_id == topic.id
        ).scalar()

        # Average assignment marks per topic
        avg_assignment = db.query(
            func.coalesce(func.avg(models.AssignmentSubmission.obtained_marks), 0)
        ).join(
            models.Assignment,
            models.AssignmentSubmission.assignment_id == models.Assignment.id
        ).filter(
            models.Assignment.topic_id == topic.id
        ).scalar()

        result.append({
            "topic_id": topic.id,
            "topic_name": topic.title,
            "avg_quiz_score": round(avg_quiz, 2),
            "avg_assignment_score": round(avg_assignment, 2)
        })

    return result

# ---------------- COURSE-WISE PERFORMANCE ----------------

@app.get("/api/v1/admin/course-performance")
def course_performance(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):

    courses = db.query(models.Course).all()

    result = []

    for course in courses:

        avg_quiz = db.query(
            func.coalesce(func.avg(models.QuizAttempt.score), 0)
        ).join(
            models.Quiz, models.QuizAttempt.quiz_id == models.Quiz.id
        ).join(
            models.Topic, models.Quiz.topic_id == models.Topic.id
        ).filter(
            models.Topic.course_id == course.id
        ).scalar()

        avg_assignment = db.query(
            func.coalesce(func.avg(models.AssignmentSubmission.obtained_marks), 0)
        ).join(
            models.Assignment,
            models.AssignmentSubmission.assignment_id == models.Assignment.id
        ).join(
            models.Topic, models.Assignment.topic_id == models.Topic.id
        ).filter(
            models.Topic.course_id == course.id
        ).scalar()

        result.append({
            "course_id": course.id,
            "course_name": course.title,
            "avg_quiz_score": round(avg_quiz, 2),
            "avg_assignment_score": round(avg_assignment, 2)
        })

    return result

# ---------------- ALL COURSES OVERALL PERFORMANCE ----------------

@app.get("/api/v1/admin/all-courses-summary")
def all_courses_summary(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):

    data = db.query(
        models.Course.title,
        func.coalesce(func.avg(models.QuizAttempt.score), 0)
    ).join(
        models.Topic, models.Topic.course_id == models.Course.id
    ).join(
        models.Quiz, models.Quiz.topic_id == models.Topic.id
    ).join(
        models.QuizAttempt,
        models.QuizAttempt.quiz_id == models.Quiz.id
    ).group_by(models.Course.title).all()

    return [
        {
            "course": row[0],
            "avg_quiz_score": round(row[1], 2)
        }
        for row in data
    ]

# ---------------- COURSE FULL PERFORMANCE SUMMARY ----------------

@app.get("/api/v1/admin/course-full-performance")
def course_full_performance(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):

    courses = db.query(models.Course).all()

    results = []

    for course in courses:

        # Avg Quiz Score (per course)
        avg_quiz = db.query(
            func.coalesce(func.avg(models.QuizAttempt.score), 0)
        ).join(
            models.Quiz, models.QuizAttempt.quiz_id == models.Quiz.id
        ).join(
            models.Topic, models.Quiz.topic_id == models.Topic.id
        ).filter(
            models.Topic.course_id == course.id
        ).scalar()

        # Avg Assignment Score (per course)
        avg_assignment = db.query(
            func.coalesce(func.avg(models.AssignmentSubmission.obtained_marks), 0)
        ).join(
            models.Assignment,
            models.AssignmentSubmission.assignment_id == models.Assignment.id
        ).join(
            models.Topic, models.Assignment.topic_id == models.Topic.id
        ).filter(
            models.Topic.course_id == course.id
        ).scalar()

        # Overall performance = average of both
        overall = (avg_quiz + avg_assignment) / 2

        results.append({
            "course_id": course.id,
            "course_name": course.title,
            "avg_quiz_score": round(avg_quiz, 2),
            "avg_assignment_score": round(avg_assignment, 2),
            "overall_performance": round(overall, 2)
        })

    return results
# ---------------- FORGOT PASSWORD ----------------

@app.post("/api/v1/auth/forgot-password")
def forgot_password(data: schemas.ForgotPasswordSchema, db: Session = Depends(get_db)):

    user = db.query(models.User).filter(models.User.email == data.email).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    reset_token = create_reset_token(user.email)

    # In real system → send email
    # For now → return token directly
    return {
        "message": "Reset token generated",
        "reset_token": reset_token
    }
# ---------------- RESET PASSWORD ----------------

@app.post("/api/v1/auth/reset-password")
def reset_password(data: schemas.ResetPasswordSchema, db: Session = Depends(get_db)):

    email = verify_reset_token(data.token)

    if not email:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    user = db.query(models.User).filter(models.User.email == email).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(data.new_password)

    db.commit()

    return {"message": "Password updated successfully"}
