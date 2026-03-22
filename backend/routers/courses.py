from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from database import SessionLocal
import models, schemas, shutil, os, io, json, PyPDF2
from dependencies import get_current_teacher
from groq import Groq
from config import GROQ_API_KEY

router = APIRouter(prefix="/api/v1/teacher", tags=["Teacher Courses"])

client = Groq(api_key=GROQ_API_KEY.strip() if GROQ_API_KEY else "")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/courses/{course_id}/process-pdf")
async def process_course_pdf(
    course_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    teacher: models.User = Depends(get_current_teacher)
):
    # 1. Verify course exists and belongs to organization
    course = db.query(models.Course).filter(
        models.Course.id == course_id,
        models.Course.organization_id == teacher.organization_id
    ).first()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # 2. Extract text from PDF
    try:
        content = await file.read()
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
        extracted_text = ""
        for page in pdf_reader.pages:
            text = page.extract_text()
            if text:
                extracted_text += text + "\n"

        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF. It might be scanned or empty.")

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF error: {str(e)}")

    # 3. Use AI to structure the content
    prompt = f"""
    You are an expert curriculum designer. Analyze the provided text and extract a structured course curriculum.
    The text is from a course document. Extract multiple topics.

    For EACH topic identified:
    1. Provide a 'topic_name'.
    2. Create ONE 'assignment' with a 'title' and 'description' (assignment should be a practical task based on the topic).
    3. Create ONE 'quiz' with a 'title' and all 'questions from pdf'.
    4. Each 'question' must have: 'text', 'a', 'b', 'c', 'd', and the 'correct_answer' (must be one of "A", "B", "C", or "D").

    Text to analyze (truncated):
    {extracted_text[:12000]}

    Return ONLY a valid JSON object with a "topics" key.
    Example Format:
    {{
      "topics": [
        {{
          "topic_name": "Introduction",
          "assignment": {{ "title": "...", "description": "..." }},
          "quiz": {{
            "title": "...",
            "questions": [
              {{ "text": "...", "a": "...", "b": "...", "c": "...", "d": "...", "correct_answer": "A" }}
            ]
          }}
        }}
      ]
    }}
    """

    try:
        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
            response_format={"type": "json_object"}
        )
        data = json.loads(chat_completion.choices[0].message.content)
        topics_data = data.get("topics", [])
    except Exception as e:
        print(f"[AI Error] {str(e)}")
        raise HTTPException(status_code=500, detail="AI generation failed. Please try a different PDF.")

    # 4. Populate Database
    new_topics_count = 0
    try:
        # Get current topic count for ordering
        current_topics = db.query(models.Topic).filter(models.Topic.course_id == course_id).count()

        for idx, t_data in enumerate(topics_data):
            # A. Create Topic
            topic = models.Topic(
                title=t_data["topic_name"],
                course_id=course_id,
                order_number=current_topics + idx + 1
            )
            db.add(topic)
            db.flush() # Get topic.id

            # B. Create Assignment
            a_data = t_data.get("assignment")
            if a_data:
                assignment = models.Assignment(
                    topic_id=topic.id,
                    title=a_data["title"],
                    description=a_data["description"],
                    total_marks=10
                )
                db.add(assignment)

            # C. Create Quiz
            q_data = t_data.get("quiz")
            if q_data:
                quiz = models.Quiz(
                    topic_id=topic.id,
                    title=q_data["title"]
                )
                db.add(quiz)
                db.flush() # Get quiz.id

                # D. Create Quiz Questions
                for qst in q_data.get("questions", []):
                    question = models.QuizQuestion(
                        quiz_id=quiz.id,
                        question_text=qst["text"],
                        option_a=qst["a"],
                        option_b=qst["b"],
                        option_c=qst["c"],
                        option_d=qst["d"],
                        correct_option=qst["correct_answer"]
                    )
                    db.add(question)

            new_topics_count += 1

        db.commit()
        return {"message": f"Successfully generated {new_topics_count} topics with quizzes and assignments."}

    except Exception as e:
        db.rollback()
        print(f"[DB Error] {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to save generated content to database.")


from cloudinary_utils import upload_to_cloudinary

@router.post("/courses")
def create_course(
    title: str = Form(...),
    description: str = Form(...),
    difficulty: str = Form(...),
    status: bool = Form(...),
    logo: UploadFile = File(None),
    db: Session = Depends(get_db),
    teacher: models.User = Depends(get_current_teacher)
):
    cloud_url = None
    if logo and logo.filename:
        cloud_url = upload_to_cloudinary(logo, folder="learnhub/courses")

    existing = db.query(models.Course).filter(
        models.Course.title == title,
        models.Course.organization_id == teacher.organization_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Course already exists")

    course = models.Course(
        title=title,
        description=description,
        difficulty=difficulty,
        status=status,
        logo=cloud_url,
        organization_id=teacher.organization_id,
        created_by=teacher.id
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return {"course_id": course.id}


@router.get("/courses")
def get_courses(
    db: Session = Depends(get_db),
    teacher: models.User = Depends(get_current_teacher)
):
    # Only show courses created by or assigned to this teacher
    return db.query(models.Course).filter(
        models.Course.organization_id == teacher.organization_id,
        models.Course.created_by == teacher.id
    ).all()

@router.get("/courses/organization")
def get_org_courses(
    db: Session = Depends(get_db),
    teacher: models.User = Depends(get_current_teacher)
):
    # View-only: all courses in the organization
    courses = db.query(models.Course).filter(
        models.Course.organization_id == teacher.organization_id
    ).all()
    
    result = []
    for c in courses:
        creator = db.query(models.User).filter(models.User.id == c.created_by).first()
        result.append({
            "id": c.id, "title": c.title, "logo": c.logo, 
            "teacher_name": creator.name if creator else "Admin",
            "created_by": c.created_by
        })
    return result


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
    teacher: models.User = Depends(get_current_teacher)
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
    teacher: models.User = Depends(get_current_teacher)
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
    teacher: models.User = Depends(get_current_teacher)
):
    return db.query(models.Topic).filter(
        models.Topic.course_id == course_id
    ).all()


@router.get("/courses/{course_id}/stats")
def get_course_stats(
    course_id: int,
    db: Session = Depends(get_db),
    teacher: models.User = Depends(get_current_teacher)
):
    course = db.query(models.Course).filter(
        models.Course.id == course_id,
        models.Course.organization_id == teacher.organization_id
    ).first()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    total_topics = db.query(models.Topic).filter(
        models.Topic.course_id == course_id
    ).count()

    # Get actual list of topic IDs to avoid Subquery boolean errors
    topic_id_list = [t.id for t in db.query(models.Topic.id).filter(models.Topic.course_id == course_id).all()]

    total_quizzes = db.query(models.Quiz).filter(
        models.Quiz.topic_id.in_(topic_id_list)
    ).count() if topic_id_list else 0

    total_assignments = db.query(models.Assignment).filter(
        models.Assignment.topic_id.in_(topic_id_list)
    ).count() if topic_id_list else 0

    enrolled_students = db.query(models.Enrollment).filter(
        models.Enrollment.course_id == course_id
    ).count()

    certificates_issued = db.query(models.Certificate).filter(
        models.Certificate.course_id == course_id,
        models.Certificate.issued == True
    ).count()

    total_materials = db.query(models.Material).filter(
        models.Material.course_id == course_id
    ).count()

    # ── Engagement for this course ──
    total_enrolled = enrolled_students
    
    # 1. Video Rate
    video_ids = [v.id for v in db.query(models.Video.id).filter(models.Video.topic_id.in_(topic_id_list)).all()] if topic_id_list else []
    potential_views = len(video_ids) * total_enrolled
    actual_completions = db.query(models.VideoProgress).filter(
        models.VideoProgress.video_id.in_(video_ids),
        models.VideoProgress.watch_percentage >= 80
    ).count() if video_ids else 0
    video_rate = round((actual_completions / potential_views * 100), 1) if potential_views > 0 else 0

    # 2. Quiz Rate
    quiz_ids = [q.id for q in db.query(models.Quiz.id).filter(models.Quiz.topic_id.in_(topic_id_list)).all()] if topic_id_list else []
    potential_quizzes = len(quiz_ids) * total_enrolled
    actual_attempts = db.query(models.QuizAttempt).filter(models.QuizAttempt.quiz_id.in_(quiz_ids)).count() if quiz_ids else 0
    quiz_rate = round((actual_attempts / potential_quizzes * 100), 1) if potential_quizzes > 0 else 0

    # 3. Assignment Rate
    assign_ids = [a.id for a in db.query(models.Assignment.id).filter(models.Assignment.topic_id.in_(topic_id_list)).all()] if topic_id_list else []
    potential_assigns = len(assign_ids) * total_enrolled
    actual_subs = db.query(models.AssignmentSubmission).filter(models.AssignmentSubmission.assignment_id.in_(assign_ids)).count() if assign_ids else 0
    assign_rate = round((actual_subs / potential_assigns * 100), 1) if potential_assigns > 0 else 0

    return {
        "enrolled_students":   enrolled_students,
        "total_topics":        total_topics,
        "total_quizzes":       total_quizzes,
        "total_assignments":   total_assignments,
        "total_materials":     total_materials,
        "certificates_issued": certificates_issued,
        "engagement": {
            "video_rate": video_rate,
            "quiz_rate": quiz_rate,
            "assign_rate": assign_rate
        }
    }