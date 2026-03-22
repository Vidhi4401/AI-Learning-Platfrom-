from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from database import SessionLocal
import models, shutil, os, uuid
from dependencies import get_current_teacher, get_current_user
from typing import List

router = APIRouter(prefix="/api/v1/materials", tags=["Materials"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# UPLOAD MATERIAL (Teacher only)
@router.post("/upload")
async def upload_material(
    title: str = Form(...),
    course_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    teacher: models.User = Depends(get_current_teacher)
):
    # Verify the teacher owns this course
    course = db.query(models.Course).filter(
        models.Course.id == course_id,
        models.Course.created_by == teacher.id
    ).first()

    if not course:
        raise HTTPException(status_code=403, detail="You can only upload materials for your own courses")

    # Save file
    upload_dir = "uploads/materials"
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)

    file_ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(upload_dir, filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    new_material = models.Material(
        title=title,
        file_url=file_path,
        course_id=course_id,
        teacher_id=teacher.id
    )
    db.add(new_material)
    db.commit()
    db.refresh(new_material)

    return {"message": "Material uploaded successfully", "id": new_material.id}

# GET MATERIALS FOR A COURSE (Student/Teacher)
@router.get("/course/{course_id}")
def get_course_materials(
    course_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    # If student, check enrollment
    if user.role == "student":
        enrolled = db.query(models.Enrollment).filter(
            models.Enrollment.course_id == course_id,
            models.Enrollment.student_id == user.id
        ).first()
        if not enrolled:
             raise HTTPException(status_code=403, detail="You must be enrolled in this course to view materials")

    materials = db.query(models.Material).filter(models.Material.course_id == course_id).all()
    return materials

# DELETE MATERIAL (Teacher only)
@router.delete("/{material_id}")
def delete_material(
    material_id: int,
    db: Session = Depends(get_db),
    teacher: models.User = Depends(get_current_teacher)
):
    material = db.query(models.Material).filter(
        models.Material.id == material_id,
        models.Material.teacher_id == teacher.id
    ).first()

    if not material:
        raise HTTPException(status_code=404, detail="Material not found or unauthorized")

    if os.path.exists(material.file_url):
        os.remove(material.file_url)

    db.delete(material)
    db.commit()
    return {"message": "Material deleted"}
