from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
import models, schemas
from auth import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/register")
def register(data: schemas.RegisterSchema, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = models.User(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        role="student",
        organization_id=data.organization_id,
        status=True
    )
    db.add(new_user)
    db.commit()
    return {"message": "Registration successful"}


@router.post("/login")
def login(data: schemas.LoginSchema, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.email).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    org = db.query(models.Organization).filter(
        models.Organization.id == user.organization_id
    ).first()

    token = create_access_token({
        "user_id": user.id,
        "role": user.role,
        "organization_id": user.organization_id
    })

    return {
        "success":       True,
        "id":            user.id,
        "name":          user.name,
        "email":         user.email,
        "role":          user.role,
        "access_token":  token,
        "platform_name": org.platform_name or org.name if org else "LearnHub",
        "org_logo":      org.logo if org else None
    }