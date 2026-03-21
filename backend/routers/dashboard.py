from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
import models
from dependencies import get_current_teacher
from typing import Optional

router = APIRouter(prefix="/api/v1/teacher", tags=["Dashboard"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/dashboard")
def get_dashboard(
    current_user: models.User = Depends(get_current_teacher),
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

    # ── Real Engagement Metrics ──
    # 1. Video Completion Rate
    total_videos = db.query(models.Video).join(models.Topic).filter(models.Topic.course_id.in_(course_ids)).count() if course_ids else 0
    total_enrolled = db.query(models.Enrollment).filter(models.Enrollment.course_id.in_(course_ids)).count() if course_ids else 0
    potential_views = total_videos * total_enrolled
    
    actual_completions = db.query(models.VideoProgress).join(models.Video).join(models.Topic).filter(
        models.Topic.course_id.in_(course_ids),
        models.VideoProgress.watch_percentage >= 80
    ).count() if course_ids else 0
    
    video_rate = round((actual_completions / potential_views * 100), 1) if potential_views > 0 else 0

    # 2. Quiz Attempt Rate
    total_quizzes = db.query(models.Quiz).join(models.Topic).filter(models.Topic.course_id.in_(course_ids)).count() if course_ids else 0
    potential_quizzes = total_quizzes * total_enrolled
    actual_attempts = db.query(models.QuizAttempt).join(models.Quiz).join(models.Topic).filter(models.Topic.course_id.in_(course_ids)).count() if course_ids else 0
    quiz_rate = round((actual_attempts / potential_quizzes * 100), 1) if potential_quizzes > 0 else 0

    # 3. Assignment Submission Rate
    total_assigns = db.query(models.Assignment).join(models.Topic).filter(models.Topic.course_id.in_(course_ids)).count() if course_ids else 0
    potential_assigns = total_assigns * total_enrolled
    actual_subs = db.query(models.AssignmentSubmission).join(models.Assignment).join(models.Topic).filter(models.Topic.course_id.in_(course_ids)).count() if course_ids else 0
    assign_rate = round((actual_subs / potential_assigns * 100), 1) if potential_assigns > 0 else 0

    return {
        "total_students":  total_students,
        "students_label":  students_label,
        "total_courses":   len(course_ids),
        "total_quizzes":   total_quizzes,
        "total_assignments":   total_assigns,
        "certificates_issued": certificates_issued,
        "engagement": {
            "video_rate": video_rate,
            "quiz_rate": quiz_rate,
            "assign_rate": assign_rate
        }
    }

from sqlalchemy import func
from routers.student import predict_learner_level

import pickle
import pandas as pd

# Load ML artifacts once (Paths relative to backend folder)
try:
    with open("ml/final_risk_model.pkl", "rb") as f:
        risk_model = pickle.load(f)
    with open("ml/final_scaler.pkl", "rb") as f:
        risk_scaler = pickle.load(f)
    with open("ml/model_features.pkl", "rb") as f:
        model_feature_names = pickle.load(f)
except Exception as e:
    print(f"[ML Load Error] {e}. Trying absolute path...")
    try:
        # Fallback for different CWDs
        with open("backend/ml/final_risk_model.pkl", "rb") as f:
            risk_model = pickle.load(f)
        with open("backend/ml/final_scaler.pkl", "rb") as f:
            risk_scaler = pickle.load(f)
        with open("backend/ml/model_features.pkl", "rb") as f:
            model_feature_names = pickle.load(f)
    except:
        print("[ML Load Error] All paths failed. Risk model disabled.")
        risk_model = None

def get_student_metrics(db: Session, student_id: int, course_id: int = None):
    """
    Calculates all 11 ML features from raw DB tables and predicts Level & Risk.
    """
    # 1. Filter Topics
    if course_id:
        topic_ids = [t.id for t in db.query(models.Topic.id).filter(models.Topic.course_id == course_id).all()]
    else:
        # Get ALL courses this specific student is enrolled in
        enrolled_course_ids = [e.course_id for e in db.query(models.Enrollment.course_id).filter(models.Enrollment.student_id == student_id).all()]
        topic_ids = [t.id for t in db.query(models.Topic.id).filter(models.Topic.course_id.in_(enrolled_course_ids)).all()] if enrolled_course_ids else []
    
    if not topic_ids:
        return {k: 0.0 for k in ["overall_score", "quiz_average", "assignment_average", "completion_rate", "avg_watch_time", "quiz_attempt_rate", "assignment_submission_rate", "videos_completed", "quizzes_attempted", "assignments_submitted", "total_course_items"]}, "Weak", "High"

    # 2. Denominators
    total_vids = db.query(models.Video).filter(models.Video.topic_id.in_(topic_ids)).count()
    total_quizzes = db.query(models.Quiz).filter(models.Quiz.topic_id.in_(topic_ids)).count()
    total_assigns = db.query(models.Assignment).filter(models.Assignment.topic_id.in_(topic_ids)).count()
    
    # 3. Student Activity
    attempts = db.query(models.QuizAttempt).join(models.Quiz).filter(
        models.QuizAttempt.student_id == student_id, models.Quiz.topic_id.in_(topic_ids)
    ).all()
    
    subs = db.query(models.AssignmentSubmission).join(models.Assignment).filter(
        models.AssignmentSubmission.student_id == student_id, models.Assignment.topic_id.in_(topic_ids)
    ).all()
    
    v_progs = db.query(models.VideoProgress).join(models.Video).filter(
        models.VideoProgress.student_id == student_id, models.Video.topic_id.in_(topic_ids)
    ).all()

    # 4. Feature Calculations
    q_avg = 0
    if attempts:
        q_scores = []
        for a in attempts:
            q_count = db.query(models.QuizQuestion).filter(models.QuizQuestion.quiz_id == a.quiz_id).count()
            if q_count > 0: q_scores.append((a.score / q_count) * 100)
        q_avg = min(100, sum(q_scores) / len(q_scores)) if q_scores else 0
    
    a_avg = 0
    if subs:
        a_scores = []
        for s in subs:
            total_m = db.query(models.Assignment.total_marks).filter(models.Assignment.id == s.assignment_id).scalar()
            if total_m and total_m > 0: a_scores.append((s.obtained_marks / total_m) * 100)
        a_avg = min(100, sum(a_scores) / len(a_scores)) if a_scores else 0
    
    distinct_attempts = len(set([a.quiz_id for a in attempts]))
    distinct_subs = len(set([s.assignment_id for s in subs]))
    comp_vids = len([p for p in v_progs if p.watch_percentage >= 80])
    
    v_comp_rate = min(100, (comp_vids / total_vids * 100)) if total_vids > 0 else 0
    avg_w_time = sum([p.watch_time for p in v_progs]) / len(v_progs) if v_progs else 0
    q_att_rate = min(100, (distinct_attempts / total_quizzes * 100)) if total_quizzes > 0 else 0
    a_sub_rate = min(100, (distinct_subs / total_assigns * 100)) if total_assigns > 0 else 0
    
    metrics_list = [m for m in [q_avg, a_avg, v_comp_rate] if m > 0]
    overall = sum(metrics_list) / len(metrics_list) if metrics_list else 0

    features = {
        "overall_score": float(overall),
        "quiz_average": float(q_avg),
        "assignment_average": float(a_avg),
        "completion_rate": float(v_comp_rate),
        "avg_watch_time": float(avg_w_time),
        "quiz_attempt_rate": float(q_att_rate),
        "assignment_submission_rate": float(a_sub_rate),
        "videos_completed": int(comp_vids),
        "quizzes_attempted": int(distinct_attempts),
        "assignments_submitted": int(distinct_subs),
        "total_course_items": int(total_vids + total_quizzes + total_assigns)
    }
    
    level = predict_learner_level(features)
    
    # 5. Predict Risk
    risk = "Low"
    if risk_model:
        try:
            feat_df = pd.DataFrame([features])[model_feature_names]
            scaled = risk_scaler.transform(feat_df)
            risk_pred = risk_model.predict(scaled)[0]
            risk = risk_pred # Assumes model returns 'Low', 'Medium', 'High'
        except: risk = "Medium" if overall < 50 else "Low"

    return features, level, risk

from fastapi.responses import StreamingResponse
import io

@router.get("/students")
def get_all_students(
    db: Session = Depends(get_db),
    teacher: models.User = Depends(get_current_teacher)
):
    # 1. Get IDs of courses owned/assigned to this teacher
    managed_course_ids = [c.id for c in db.query(models.Course.id).filter(
        models.Course.organization_id == teacher.organization_id,
        models.Course.created_by == teacher.id
    ).all()]
    
    if not managed_course_ids:
        return []

    # 2. Find students enrolled in those courses
    student_ids = [e.student_id for e in db.query(models.Enrollment.student_id).filter(
        models.Enrollment.course_id.in_(managed_course_ids)
    ).distinct().all()]
    
    if not student_ids:
        return []

    # 3. Fetch user details for those students
    students = db.query(models.User).filter(
        models.User.id.in_(student_ids)
    ).all()
    
    results = []
    for s in students:
        course_count = db.query(models.Enrollment).filter(models.Enrollment.student_id == s.id).count()
        # Direct calculation for teacher list
        features, level, risk = get_student_metrics(db, s.id)
        
        results.append({
            "id": s.id,
            "name": s.name,
            "email": s.email,
            "course_count": course_count,
            "overall_score": round(features["overall_score"], 1),
            "learner_level": level,
            "dropout_risk": risk
        })
    return results

@router.get("/students/export")
def export_students_excel(
    token: str = None, # Allow query token for browser downloads
    db: Session = Depends(get_db),
    teacher: models.User = Depends(get_current_teacher)
):
    """Generates Excel report for teacher's students."""
    students_data = get_all_students(db, teacher)
    if not students_data:
        raise HTTPException(status_code=400, detail="No student data to export")
        
    df = pd.DataFrame(students_data)
    # Reorder and rename columns for readability
    df_report = df[["name", "email", "course_count", "overall_score", "learner_level", "dropout_risk"]]
    df_report.columns = ["Student Name", "Email", "Enrolled Courses", "Overall Score %", "Learner Level", "Dropout Risk"]
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df_report.to_excel(writer, index=False, sheet_name='Students Performance')
    
    output.seek(0)
    
    headers = {
        'Content-Disposition': f'attachment; filename="students_report_{datetime.now().strftime("%Y%m%d")}.xlsx"'
    }
    return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

@router.get("/students/{student_id}/detail")
def get_student_detail(
    student_id: int,
    db: Session = Depends(get_db),
    teacher: models.User = Depends(get_current_teacher)
):
    student = db.query(models.User).filter(
        models.User.id == student_id,
        models.User.organization_id == teacher.organization_id
    ).first()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    # 1. Global Metrics
    global_features, global_level, global_risk = get_student_metrics(db, student_id)

    # 2. Enrolled Courses with Course-Specific AI Levels
    enrollments = db.query(models.Enrollment).filter(models.Enrollment.student_id == student_id).all()
    courses_data = []
    for enr in enrollments:
        course = db.query(models.Course).filter(models.Course.id == enr.course_id).first()
        if not course: continue
        
        c_features, c_level, c_risk = get_student_metrics(db, student_id, course.id)
        
        # Format video string for UI (watched/total)
        topic_ids = [t.id for t in db.query(models.Topic.id).filter(models.Topic.course_id == course.id).all()]
        v_count = db.query(models.Video).filter(models.Video.topic_id.in_(topic_ids)).count() if topic_ids else 0

        courses_data.append({
            "title": course.title,
            "quiz_avg": f"{round(c_features['quiz_average'])}%",
            "assign_avg": f"{round(c_features['assignment_average'])}%",
            "videos": f"{c_features['videos_completed']}/{v_count}",
            "progress": f"{round(c_features['overall_score'])}%",
            "level": c_level,
            "risk": c_risk
        })

    # 3. Recent Quiz Attempts
    attempts = db.query(models.QuizAttempt, models.Quiz.title, models.Course.title.label("course_title"))\
        .join(models.Quiz, models.QuizAttempt.quiz_id == models.Quiz.id)\
        .join(models.Topic, models.Quiz.topic_id == models.Topic.id)\
        .join(models.Course, models.Topic.course_id == models.Course.id)\
        .filter(models.QuizAttempt.student_id == student_id)\
        .order_by(models.QuizAttempt.attempted_at.desc()).limit(5).all()
    
    quiz_history = []
    for att, q_title, c_title in attempts:
        q_count = db.query(models.QuizQuestion).filter(models.QuizQuestion.quiz_id == att.quiz_id).count()
        quiz_history.append({
            "quiz": q_title, "course": c_title, "score": f"{att.score} / {q_count}",
            "pct": f"{round((att.score/q_count)*100) if q_count>0 else 0}%",
            "date": att.attempted_at.strftime("%b %d, %Y")
        })

    # 4. Recent Assignment Submissions
    subs = db.query(models.AssignmentSubmission, models.Assignment.title, models.Assignment.total_marks, models.Course.title.label("course_title"))\
        .join(models.Assignment, models.AssignmentSubmission.assignment_id == models.Assignment.id)\
        .join(models.Topic, models.Assignment.topic_id == models.Topic.id)\
        .join(models.Course, models.Topic.course_id == models.Course.id)\
        .filter(models.AssignmentSubmission.student_id == student_id)\
        .order_by(models.AssignmentSubmission.submitted_at.desc()).limit(5).all()
    
    assign_history = []
    for sub, a_title, t_marks, c_title in subs:
        assign_history.append({
            "title": a_title, "course": c_title, "score": f"{sub.obtained_marks} / {t_marks}",
            "pct": f"{round((sub.obtained_marks/t_marks)*100) if t_marks>0 else 0}%",
            "date": sub.submitted_at.strftime("%b %d, %Y")
        })

    return {
        "name": student.name,
        "email": student.email,
        "enrolled_count": len(enrollments),
        "overall_quiz": f"{round(global_features['quiz_average'])}%",
        "overall_assign": f"{round(global_features['assignment_average'])}%",
        "level": global_level,
        "dropout_risk": global_risk,
        "enrolled_courses": courses_data,
        "quiz_history": quiz_history,
        "assign_history": assign_history
    }

@router.get("/students/{student_id}/quiz-attempts")
def get_student_quiz_attempts(
    student_id: int,
    db: Session = Depends(get_db),
    teacher: models.User = Depends(get_current_teacher)
):
    attempts = db.query(models.QuizAttempt).filter(models.QuizAttempt.student_id == student_id).all()
    result = []
    for a in attempts:
        q_count = db.query(models.QuizQuestion).filter(models.QuizQuestion.quiz_id == a.quiz_id).count()
        result.append({
            "quiz_id": a.quiz_id,
            "score": a.score,
            "percentage": round((a.score / q_count) * 100, 2) if q_count > 0 else 0
        })
    return result

@router.get("/students/{student_id}/assignment-submissions")
def get_student_submissions(
    student_id: int,
    db: Session = Depends(get_db),
    teacher: models.User = Depends(get_current_teacher)
):
    subs = db.query(models.AssignmentSubmission).filter(models.AssignmentSubmission.student_id == student_id).all()
    # We need to include total_marks for the teacher's UI to calculate percentages correctly
    result = []
    for s in subs:
        total_m = db.query(models.Assignment.total_marks).filter(models.Assignment.id == s.assignment_id).scalar() or 10
        result.append({
            "assignment_id": s.assignment_id,
            "obtained_marks": s.obtained_marks,
            "total_marks": total_m
        })
    return result

@router.get("/students/{student_id}/video-progress")
def get_student_video_progress(
    student_id: int,
    db: Session = Depends(get_db),
    teacher: models.User = Depends(get_current_teacher)
):
    records = db.query(models.VideoProgress).filter(models.VideoProgress.student_id == student_id).all()
    return [{
        "video_id": r.video_id,
        "watch_time": r.watch_time,
        "watch_percentage": r.watch_percentage
    } for r in records]

@router.get("/analytics")
def get_analytics(
    course_id: Optional[int] = None,
    db: Session = Depends(get_db),
    teacher: models.User = Depends(get_current_teacher)
):
    org_id = teacher.organization_id
    
    # 1. Course Enrollment Distribution
    if course_id:
        topics = db.query(models.Topic).filter(models.Topic.course_id == course_id).all()
        course_stats = []
        for t in topics:
            q_ids = [q.id for q in db.query(models.Quiz.id).filter(models.Quiz.topic_id == t.id).all()]
            avg_q = db.query(func.avg(models.QuizAttempt.score)).filter(models.QuizAttempt.quiz_id.in_(q_ids)).scalar() or 0 if q_ids else 0
            course_stats.append({"title": t.title, "students": round(avg_q, 1)})
    else:
        courses = db.query(models.Course).filter(models.Course.organization_id == org_id).all()
        course_stats = []
        for c in courses:
            count = db.query(models.Enrollment).filter(models.Enrollment.course_id == c.id).count()
            course_stats.append({"title": c.title, "students": count})
    
    # 2. Learner Level Distribution (using actual stored levels)
    student_query = db.query(models.StudentPerformanceSummary.learner_level).join(
        models.User, models.StudentPerformanceSummary.student_id == models.User.id
    ).filter(models.User.organization_id == org_id)
    
    if course_id:
        student_query = student_query.join(models.Enrollment, models.User.id == models.Enrollment.student_id).filter(models.Enrollment.course_id == course_id)
    
    results = student_query.all()
    levels = {"Strong": 0, "Average": 0, "Weak": 0}
    for r in results:
        lvl = r[0]
        if lvl in levels:
            levels[lvl] += 1
        else:
            levels["Average"] += 1

    return {
        "course_distribution": course_stats,
        "level_distribution": levels,
        "total_courses": 1 if course_id else len(db.query(models.Course).filter(models.Course.organization_id == org_id).all()),
        "total_students": len(results)
    }
