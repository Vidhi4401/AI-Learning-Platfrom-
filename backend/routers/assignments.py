from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import SessionLocal
import models, schemas
from dependencies import get_current_teacher

router = APIRouter(tags=["Assignments"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/api/v1/teacher/topics/{topic_id}/assignments")
def create_assignment(
    topic_id: int,
    data: schemas.AssignmentCreate,
    db: Session = Depends(get_db),
    teacher: models.User = Depends(get_current_teacher)
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


@router.get("/api/v1/teacher/topics/{topic_id}/assignments")
def teacher_get_assignments(
    topic_id: int,
    db: Session = Depends(get_db),
    teacher: models.User = Depends(get_current_teacher)
):
    return db.query(models.Assignment).filter(
        models.Assignment.topic_id == topic_id
    ).all()


@router.put("/api/v1/teacher/assignments/{assignment_id}")
def update_assignment(
    assignment_id: int,
    data: schemas.AssignmentUpdate,
    db: Session = Depends(get_db),
    teacher: models.User = Depends(get_current_teacher)
):
    assignment = db.query(models.Assignment).filter(
        models.Assignment.id == assignment_id
    ).first()
    assignment.title       = data.title
    assignment.description = data.description
    assignment.total_marks = data.total_marks
    assignment.model_answer= data.model_answer
    db.commit()
    return {"message": "Assignment updated"}


@router.delete("/api/v1/teacher/assignments/{assignment_id}")
def delete_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    teacher: models.User = Depends(get_current_teacher)
):
    assignment = db.query(models.Assignment).filter(
        models.Assignment.id == assignment_id
    ).first()
    db.delete(assignment)
    db.commit()
    return {"message": "Assignment deleted"}