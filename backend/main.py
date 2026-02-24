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
from sqlalchemy import Float
from fastapi.staticfiles import StaticFiles
from fastapi import UploadFile, File, Form
import shutil
import os
from pydantic import BaseModel
app = FastAPI()
Base.metadata.create_all(bind=engine)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

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

@app.get("/api/v1/organizations")
def get_orgs(db: Session = Depends(get_db)):
    return db.query(models.Organization).all()


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

@app.get("/api/v1/admin/dashboard")
def admin_dashboard(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):

    total_courses = db.query(models.User).filter(
        models.User.role == "course"
    ).count()
    total_students = db.query(models.User).filter(models.User.role == "student").count()


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
        "total_courses": total_courses,
        "total_assignments": total_assignments,
        "total_quizzes": total_quizzes,
        "avg_video_completion": round(avg_video_completion, 2),
        "avg_quiz_score": round(avg_quiz_score, 2)
    }


@app.get("/api/v1/admin/courses/{course_id}/topics")
def get_topics_by_course(
    course_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    return db.query(models.Topic).filter(
        models.Topic.course_id == course_id
    ).all()
@app.post("/api/v1/admin/topics/{topic_id}/quizzes")
def create_quiz(
    topic_id: int,
    data: schemas.QuizCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    quiz = models.Quiz(
        topic_id=topic_id,
        title=data.title
    )

    db.add(quiz)
    db.commit()
    db.refresh(quiz)

    return {"quiz_id": quiz.id}

# =========================
# COURSE CRUD
# =========================

from fastapi import UploadFile, File, Form

@app.post("/api/v1/admin/courses")
def create_course(
    title: str = Form(...),
    description: str = Form(...),
    difficulty: str = Form(...),
    status: bool = Form(...),
    logo: UploadFile = File(None),
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):

    file_path = None

    if logo:
        os.makedirs("uploads", exist_ok=True)
        file_path = f"uploads/{logo.filename}"

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(logo.file, buffer)
 # 🔴 CHECK DUPLICATE COURSE
    existing = db.query(models.Course).filter(
        models.Course.title == title,
        models.Course.organization_id == admin.organization_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Course already exists")

    course = models.Course(
        title=title,
        description=description,
        difficulty=difficulty,
        status=status,
        logo=file_path,
        organization_id=admin.organization_id,
        created_by=admin.id
    )

    db.add(course)
    db.commit()
    db.refresh(course)

    return {"course_id": course.id}

@app.get("/api/v1/admin/courses")
def get_courses(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    return db.query(models.Course).filter(
        models.Course.organization_id == admin.organization_id
    ).all()


@app.get("/api/v1/admin/courses/{course_id}")
def get_single_course(course_id: int, db: Session = Depends(get_db)):
    return db.query(models.Course).filter(
        models.Course.id == course_id
    ).first()


@app.put("/api/v1/admin/courses/{course_id}")
def update_course(
    course_id: int,
    data: schemas.CourseUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    course = db.query(models.Course).filter(
        models.Course.id == course_id
    ).first()

    course.title = data.title
    course.description = data.description
    course.difficulty = data.difficulty
    course.status = data.status

    db.commit()
    return {"message": "Course updated"}


@app.delete("/api/v1/admin/courses/{course_id}")
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    course = db.query(models.Course).filter(
        models.Course.id == course_id
    ).first()

    db.delete(course)
    db.commit()
    return {"message": "Course deleted"}


# =========================
# TOPIC CRUD
# =========================

@app.post("/api/v1/admin/courses/{course_id}/topics")
def create_topic(
    course_id: int,
    data: schemas.TopicCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    topic = models.Topic(
        title=data.title,
        course_id=course_id
    )
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return {"topic_id": topic.id}


@app.get("/api/v1/admin/topics/{topic_id}")
def get_topic(topic_id: int, db: Session = Depends(get_db)):
    return db.query(models.Topic).filter(
        models.Topic.id == topic_id
    ).first()


@app.put("/api/v1/admin/topics/{topic_id}")
def update_topic(
    topic_id: int,
    data: schemas.TopicUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    topic = db.query(models.Topic).filter(
        models.Topic.id == topic_id
    ).first()

    topic.title = data.title
    db.commit()
    return {"message": "Topic updated"}


@app.delete("/api/v1/admin/topics/{topic_id}")
def delete_topic(
    topic_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    topic = db.query(models.Topic).filter(
        models.Topic.id == topic_id
    ).first()

    db.delete(topic)
    db.commit()
    return {"message": "Topic deleted"}

# =========================
# VIDEO CRUD
# =========================

@app.post("/api/v1/admin/topics/{topic_id}/videos")
def create_video(
    topic_id: int,
    data: schemas.VideoCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    video = models.Video(
        topic_id=topic_id,
        video_url=data.video_url,
        duration=data.duration
    )
    db.add(video)
    db.commit()
    db.refresh(video)
    return {"video_id": video.id}


@app.get("/api/v1/topics/{topic_id}/videos")
def get_videos(topic_id: int, db: Session = Depends(get_db)):
    return db.query(models.Video).filter(
        models.Video.topic_id == topic_id
    ).all()


@app.put("/api/v1/admin/videos/{video_id}")
def update_video(
    video_id: int,
    data: schemas.VideoUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    video = db.query(models.Video).filter(
        models.Video.id == video_id
    ).first()

    video.video_url = data.video_url
    video.duration = data.duration
    db.commit()
    return {"message": "Video updated"}


@app.delete("/api/v1/admin/videos/{video_id}")
def delete_video(
    video_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    video = db.query(models.Video).filter(
        models.Video.id == video_id
    ).first()

    db.delete(video)
    db.commit()
    return {"message": "Video deleted"}

# =========================
# ASSIGNMENT CRUD
# =========================

@app.post("/api/v1/admin/topics/{topic_id}/assignments")
def create_assignment(
    topic_id: int,
    data: schemas.AssignmentCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    assignment = models.Assignment(
        topic_id=topic_id,
        title=data.title,
        description=data.description,
        total_marks=data.total_marks,
        model_answer=data.model_answer
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return {"assignment_id": assignment.id}

@app.get("/api/v1/admin/topics/{topic_id}/assignments")
def admin_get_assignments(
    topic_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):

    return db.query(models.Assignment).filter(
        models.Assignment.topic_id == topic_id
    ).all()

@app.put("/api/v1/admin/assignments/{assignment_id}")
def update_assignment(
    assignment_id: int,
    data: schemas.AssignmentUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    assignment = db.query(models.Assignment).filter(
        models.Assignment.id == assignment_id
    ).first()

    assignment.title = data.title
    assignment.description = data.description
    assignment.total_marks = data.total_marks
    assignment.model_answer = data.model_answer

    db.commit()
    return {"message": "Assignment updated"}


@app.delete("/api/v1/admin/assignments/{assignment_id}")
def delete_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    assignment = db.query(models.Assignment).filter(
        models.Assignment.id == assignment_id
    ).first()

    db.delete(assignment)
    db.commit()
    return {"message": "Assignment deleted"}

@app.get("/api/v1/topics/{topic_id}/quizzes")
def get_quizzes(topic_id: int, db: Session = Depends(get_db)):

    quizzes = db.query(models.Quiz).filter(
        models.Quiz.topic_id == topic_id
    ).all()

    return quizzes

@app.get("/api/v1/quizzes/{quiz_id}")
def get_quiz(quiz_id: int, db: Session = Depends(get_db)):

    quiz = db.query(models.Quiz).filter(
        models.Quiz.id == quiz_id
    ).first()

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    questions = db.query(models.QuizQuestion).filter(
        models.QuizQuestion.quiz_id == quiz_id
    ).all()

    return {
        "quiz": quiz,
        "questions": questions
    }

@app.put("/api/v1/admin/quizzes/{quiz_id}")
def update_quiz(
    quiz_id: int,
    data: schemas.QuizUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):

    quiz = db.query(models.Quiz).filter(
        models.Quiz.id == quiz_id
    ).first()

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    quiz.title = data.title

    db.commit()

    return {"message": "Quiz updated"}

@app.delete("/api/v1/admin/quizzes/{quiz_id}")
def delete_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):

    quiz = db.query(models.Quiz).filter(
        models.Quiz.id == quiz_id
    ).first()

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Delete questions first
    db.query(models.QuizQuestion).filter(
        models.QuizQuestion.quiz_id == quiz_id
    ).delete()

    db.delete(quiz)
    db.commit()

    return {"message": "Quiz deleted"}

@app.post("/api/v1/admin/quizzes/{quiz_id}/questions")
def add_question(
    quiz_id: int,
    data: schemas.QuizQuestionCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):

    question = models.QuizQuestion(
        quiz_id=quiz_id,
        question_text=data.question_text,
        option_a=data.option_a,
        option_b=data.option_b,
        option_c=data.option_c,
        option_d=data.option_d,
        correct_option=data.correct_option.upper()
    )

    db.add(question)
    db.commit()
    db.refresh(question)

    return {"question_id": question.id}

@app.get("/api/v1/quizzes/{quiz_id}/questions")
def get_questions(quiz_id: int, db: Session = Depends(get_db)):

    questions = db.query(models.QuizQuestion).filter(
        models.QuizQuestion.quiz_id == quiz_id
    ).all()

    return questions

@app.put("/api/v1/admin/questions/{question_id}")
def update_question(
    question_id: int,
    data: schemas.QuizQuestionUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):

    question = db.query(models.QuizQuestion).filter(
        models.QuizQuestion.id == question_id
    ).first()

    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    question.question_text = data.question_text
    question.option_a = data.option_a
    question.option_b = data.option_b
    question.option_c = data.option_c
    question.option_d = data.option_d
    question.correct_option = data.correct_option.upper()

    db.commit()

    return {"message": "Question updated"}

@app.delete("/api/v1/admin/questions/{question_id}")
def delete_question(
    question_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):

    question = db.query(models.QuizQuestion).filter(
        models.QuizQuestion.id == question_id
    ).first()

    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    db.delete(question)
    db.commit()

    return {"message": "Question deleted"}

@app.get("/api/v1/admin/courses/{course_id}/stats")
def get_course_stats(
    course_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):

    course = db.query(models.Course).filter(
        models.Course.id == course_id,
        models.Course.organization_id == admin.organization_id
    ).first()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Total Topics
    total_topics = db.query(models.Topic).filter(
        models.Topic.course_id == course_id
    ).count()

    topic_ids = db.query(models.Topic.id).filter(
        models.Topic.course_id == course_id
    ).subquery()

    # Total Quizzes
    total_quizzes = db.query(models.Quiz).filter(
        models.Quiz.topic_id.in_(topic_ids)
    ).count()

    # Total Assignments
    total_assignments = db.query(models.Assignment).filter(
        models.Assignment.topic_id.in_(topic_ids)
    ).count()

    # Total Enrolled Students
    enrolled_students = db.query(models.Enrollment).filter(
        models.Enrollment.course_id == course_id
    ).count()

    # ✅ Only count issued certificates
    certificates_issued = db.query(models.Certificate).filter(
        models.Certificate.course_id == course_id,
        models.Certificate.issued == True
    ).count()

    return {
        "enrolled_students": enrolled_students,
        "total_topics": total_topics,
        "total_quizzes": total_quizzes,
        "total_assignments": total_assignments,
        "certificates_issued": certificates_issued
    }