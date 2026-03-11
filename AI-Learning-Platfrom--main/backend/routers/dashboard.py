from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import SessionLocal
import models
from dependencies import get_current_admin

router = APIRouter(prefix="/api/v1/admin", tags=["Dashboard"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/dashboard")
def get_dashboard(
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    org_id = current_user.organization_id

    courses = db.query(models.Course).filter(
        models.Course.organization_id == org_id
    ).all()
    course_ids = [c.id for c in courses]

    topic_ids = []
    if course_ids:
        topics = db.query(models.Topic).filter(
            models.Topic.course_id.in_(course_ids)
        ).all()
        topic_ids = [t.id for t in topics]

    total_quizzes = db.query(models.Quiz).filter(
        models.Quiz.topic_id.in_(topic_ids)
    ).count() if topic_ids else 0

    total_assignments = db.query(models.Assignment).filter(
        models.Assignment.topic_id.in_(topic_ids)
    ).count() if topic_ids else 0

    enrolled_count = db.query(models.Enrollment.student_id).filter(
     models.Enrollment.course_id.in_(course_ids)
    ).distinct().count() if course_ids else 0

    org_student_count = db.query(models.User).filter(
    models.User.organization_id == org_id,
    models.User.role == "student"
).count()

# ── Use enrolled if exists, else org total ──
    if enrolled_count > 0:
     total_students  = enrolled_count
     students_label  = "Enrolled Students"
    else:
      total_students  = org_student_count
      students_label  = "Total Students"

    total_students = enrolled_count if enrolled_count > 0 else org_student_count

    certificates_issued = db.query(models.Certificate).filter(
        models.Certificate.course_id.in_(course_ids),
        models.Certificate.issued == True
    ).count() if course_ids else 0

    return {
    "total_students":  total_students,
    "students_label":  students_label,   # ← add this
    "total_courses":   len(course_ids),
    "total_quizzes":   total_quizzes,
    "total_assignments":   total_assignments,
    "certificates_issued": certificates_issued
}
