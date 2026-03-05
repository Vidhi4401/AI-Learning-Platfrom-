from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from database import SessionLocal
import models, shutil, os
from dependencies import get_current_user

router = APIRouter(prefix="/api/v1", tags=["Organization"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/organizations")
def get_orgs(db: Session = Depends(get_db)):
    return db.query(models.Organization).all()


@router.get("/admin/organization")
def get_organization(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = db.query(models.Organization).filter(
        models.Organization.id == current_user.organization_id
    ).first()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    return {
        "id":            org.id,
        "org_name":      org.name,
        "platform_name": org.platform_name or org.name,
        "logo":          f"http://127.0.0.1:8000/{org.logo}" if org.logo else None,
        "email":         org.email,
        "status":        org.status
    }


@router.put("/admin/organization")
def update_organization(
    platform_name: str = Form(None),
    logo: UploadFile = File(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = db.query(models.Organization).filter(
        models.Organization.id == current_user.organization_id
    ).first()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if platform_name:
        org.platform_name = platform_name

    if logo:
        os.makedirs("uploads", exist_ok=True)
        file_path = f"uploads/{logo.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(logo.file, buffer)
        org.logo = file_path

    db.commit()
    db.refresh(org)

    return {
        "id":            org.id,
        "org_name":      org.name,
        "platform_name": org.platform_name,
        "logo":          org.logo
    }