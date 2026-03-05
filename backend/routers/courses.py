from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from database import SessionLocal
import models, schemas, shutil, os
from dependencies import get_current_admin

router = APIRouter(prefix="/api/v1/admin", tags=["Courses"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/courses")
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


@router.get("/courses")
def get_courses(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    return db.query(models.Course).filter(
        models.Course.organization_id == admin.organization_id
    ).all()


@router.get("/courses/{course_id}")
def get_single_course(course_id: int, db: Session = Depends(get_db)):
    return db.query(models.Course).filter(
        models.Course.id == course_id
    ).first()


@router.put("/courses/{course_id}")
def update_course(
    course_id: int,
    data: schemas.CourseUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    course = db.query(models.Course).filter(
        models.Course.id == course_id
    ).first()
    course.title       = data.title
    course.description = data.description
    course.difficulty  = data.difficulty
    course.status      = data.status
    db.commit()
    return {"message": "Course updated"}


@router.delete("/courses/{course_id}")
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


@router.get("/courses/{course_id}/topics")
def get_topics_by_course(
    course_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    return db.query(models.Topic).filter(
        models.Topic.course_id == course_id
    ).all()


@router.get("/courses/{course_id}/stats")
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

    total_topics = db.query(models.Topic).filter(
        models.Topic.course_id == course_id
    ).count()

    topic_ids = db.query(models.Topic.id).filter(
        models.Topic.course_id == course_id
    ).subquery()

    total_quizzes = db.query(models.Quiz).filter(
        models.Quiz.topic_id.in_(topic_ids)
    ).count()

    total_assignments = db.query(models.Assignment).filter(
        models.Assignment.topic_id.in_(topic_ids)
    ).count()

    enrolled_students = db.query(models.Enrollment).filter(
        models.Enrollment.course_id == course_id
    ).count()

    certificates_issued = db.query(models.Certificate).filter(
        models.Certificate.course_id == course_id,
        models.Certificate.issued == True
    ).count()

    return {
        "enrolled_students":   enrolled_students,
        "total_topics":        total_topics,
        "total_quizzes":       total_quizzes,
        "total_assignments":   total_assignments,
        "certificates_issued": certificates_issued
    }