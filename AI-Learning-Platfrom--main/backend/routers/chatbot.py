from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
import models, schemas
from typing import List
from groq import Groq
import os
from config import GROQ_API_KEY

router = APIRouter(prefix="/api/v1/chat", tags=["Chatbot"])

client = Groq(api_key=GROQ_API_KEY)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/ask", response_model=schemas.ChatDoubtResponse)
def ask_question(data: schemas.ChatDoubtCreate, student_id: int, db: Session = Depends(get_db)):
    # 1. Create the doubt record
    new_doubt = models.ChatDoubt(
        student_id=student_id,
        query=data.query,
        topic_id=data.topic_id,
        mode=data.mode,
        is_read_by_faculty=(data.mode == "FACULTY"), 
        is_read_by_student=True 
    )
    
    # 2. If AI mode, generate real response from GROQ
    if data.mode == "AI":
        try:
            completion = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": "You are a helpful and concise AI Tutor for LearnHub. Answer the student's doubt about their studies clearly and encouragingly."},
                    {"role": "user", "content": data.query}
                ],
            )
            new_doubt.response = completion.choices[0].message.content
        except Exception as e:
            # Fallback if AI fails (e.g., rate limit)
            new_doubt.mode = "FACULTY"
            new_doubt.is_read_by_faculty = True
            new_doubt.response = "I'm having a little trouble connecting to my AI brain. I've sent your query to the faculty instead! They'll get back to you soon."
    
    db.add(new_doubt)
    db.commit()
    db.refresh(new_doubt)
    return new_doubt

@router.get("/history", response_model=List[schemas.ChatDoubtResponse])
def get_chat_history(student_id: int, db: Session = Depends(get_db)):
    return db.query(models.ChatDoubt).filter(
        models.ChatDoubt.student_id == student_id
    ).order_by(models.ChatDoubt.created_at.asc()).all()

@router.get("/unread-count", response_model=schemas.UnreadCountResponse)
def get_unread_count(user_id: int, role: str, db: Session = Depends(get_db)):
    if role == "student":
        count = db.query(models.ChatDoubt).filter(
            models.ChatDoubt.student_id == user_id,
            models.ChatDoubt.is_read_by_student == False,
            models.ChatDoubt.response != None
        ).count()
    else:
        count = db.query(models.ChatDoubt).filter(
            models.ChatDoubt.mode == "FACULTY",
            models.ChatDoubt.response == None
        ).count()
    return {"count": count}

@router.post("/mark-read")
def mark_as_read(user_id: int, role: str, db: Session = Depends(get_db)):
    if role == "student":
        db.query(models.ChatDoubt).filter(
            models.ChatDoubt.student_id == user_id,
            models.ChatDoubt.is_read_by_student == False
        ).update({"is_read_by_student": True})
    else:
        db.query(models.ChatDoubt).filter(
            models.ChatDoubt.is_read_by_faculty == False
        ).update({"is_read_by_faculty": True})
    db.commit()
    return {"message": "Success"}

# ── Faculty Portal Endpoints ──

@router.get("/faculty/doubts", response_model=List[schemas.ChatDoubtResponse])
def get_faculty_doubts(filter: str = "pending", db: Session = Depends(get_db)):
    query = db.query(models.ChatDoubt).filter(models.ChatDoubt.mode == "FACULTY")
    if filter == "pending":
        query = query.filter(models.ChatDoubt.response == None)
    return query.order_by(models.ChatDoubt.created_at.desc()).all()

@router.post("/faculty/reply")
def reply_to_doubt(data: schemas.FacultyReplySchema, db: Session = Depends(get_db)):
    doubt = db.query(models.ChatDoubt).filter(models.ChatDoubt.id == data.doubt_id).first()
    if not doubt:
        raise HTTPException(status_code=404, detail="Doubt not found")
    
    doubt.response = data.response
    doubt.faculty_id = data.faculty_id
    doubt.is_read_by_student = False 
    doubt.is_read_by_faculty = True 
    
    db.commit()
    return {"message": "Reply sent successfully"}
