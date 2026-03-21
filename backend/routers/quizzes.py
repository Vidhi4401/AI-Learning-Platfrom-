from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
import models, schemas
from dependencies import get_current_teacher

router = APIRouter(tags=["Quizzes"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/api/v1/teacher/topics/{topic_id}/quizzes")
def create_quiz(
    topic_id: int,
    data: schemas.QuizCreate,
    db: Session = Depends(get_db),
    teacher: models.User = Depends(get_current_teacher)
):
    quiz = models.Quiz(topic_id=topic_id, title=data.title)
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return {"quiz_id": quiz.id}


@router.get("/api/v1/topics/{topic_id}/quizzes")
def get_quizzes(topic_id: int, db: Session = Depends(get_db)):
    return db.query(models.Quiz).filter(
        models.Quiz.topic_id == topic_id
    ).all()


@router.get("/api/v1/quizzes/{quiz_id}")
def get_quiz(quiz_id: int, db: Session = Depends(get_db)):
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    questions = db.query(models.QuizQuestion).filter(
        models.QuizQuestion.quiz_id == quiz_id
    ).all()
    return {"quiz": quiz, "questions": questions}


@router.put("/api/v1/teacher/quizzes/{quiz_id}")
def update_quiz(
    quiz_id: int,
    data: schemas.QuizUpdate,
    db: Session = Depends(get_db),
    teacher: models.User = Depends(get_current_teacher)
):
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    quiz.title = data.title
    db.commit()
    return {"message": "Quiz updated"}


@router.delete("/api/v1/teacher/quizzes/{quiz_id}")
def delete_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    teacher: models.User = Depends(get_current_teacher)
):
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    db.query(models.QuizQuestion).filter(
        models.QuizQuestion.quiz_id == quiz_id
    ).delete()
    db.delete(quiz)
    db.commit()
    return {"message": "Quiz deleted"}


@router.post("/api/v1/teacher/quizzes/{quiz_id}/questions")
def add_question(
    quiz_id: int,
    data: schemas.QuizQuestionCreate,
    db: Session = Depends(get_db),
    teacher: models.User = Depends(get_current_teacher)
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


@router.get("/api/v1/quizzes/{quiz_id}/questions")
def get_questions(quiz_id: int, db: Session = Depends(get_db)):
    return db.query(models.QuizQuestion).filter(
        models.QuizQuestion.quiz_id == quiz_id
    ).all()


@router.put("/api/v1/teacher/questions/{question_id}")
def update_question(
    question_id: int,
    data: schemas.QuizQuestionUpdate,
    db: Session = Depends(get_db),
    teacher: models.User = Depends(get_current_teacher)
):
    question = db.query(models.QuizQuestion).filter(
        models.QuizQuestion.id == question_id
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    question.question_text  = data.question_text
    question.option_a       = data.option_a
    question.option_b       = data.option_b
    question.option_c       = data.option_c
    question.option_d       = data.option_d
    question.correct_option = data.correct_option.upper()
    db.commit()
    return {"message": "Question updated"}


@router.delete("/api/v1/teacher/questions/{question_id}")
def delete_question(
    question_id: int,
    db: Session = Depends(get_db),
    teacher: models.User = Depends(get_current_teacher)
):
    question = db.query(models.QuizQuestion).filter(
        models.QuizQuestion.id == question_id
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    db.delete(question)
    db.commit()
    return {"message": "Question deleted"}
