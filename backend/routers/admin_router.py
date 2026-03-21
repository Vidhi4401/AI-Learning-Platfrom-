from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
import models, os, shutil, json
from dependencies import get_db, get_current_admin
from routers.student import predict_learner_level
from routers.dashboard import get_student_metrics
from auth import hash_password
from typing import List, Optional

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])

# ── DASHBOARD ────────────────────────────────────────────────────────────────
@router.get("/dashboard")
def admin_dashboard(admin=Depends(get_current_admin), db: Session = Depends(get_db)):
    org_id = admin.organization_id
    
    # All teachers in org
    teachers = db.query(models.User).filter(
        models.User.organization_id == org_id,
        models.User.role == "teacher"
    ).all()
    
    # All courses in org
    courses = db.query(models.Course).filter(
        models.Course.organization_id == org_id
    ).all()
    course_ids = [c.id for c in courses]
    
    # All students in org
    students = db.query(models.User).filter(
        models.User.organization_id == org_id,
        models.User.role == "student"
    ).all()
    student_ids = [s.id for s in students]
    
    # Platform avg score from raw calculation
    total_score = 0
    student_count_with_perf = 0
    levels = {"Strong": 0, "Average": 0, "Weak": 0}
    
    for sid in student_ids:
        # FIXED UNPACKING (3 values)
        metrics, level, risk = get_student_metrics(db, sid)
        if metrics["overall_score"] > 0:
            total_score += metrics["overall_score"]
            student_count_with_perf += 1
        if level in levels:
            levels[level] += 1
            
    avg_score = round(total_score / student_count_with_perf, 1) if student_count_with_perf > 0 else 0
    
    # Certificates issued
    certs = db.query(models.Certificate).filter(
        models.Certificate.course_id.in_(course_ids),
        models.Certificate.issued == True
    ).count() if course_ids else 0
    
    # Active this week
    week_ago = datetime.utcnow() - timedelta(days=7)
    active_week = db.query(models.VideoProgress).filter(
        models.VideoProgress.student_id.in_(student_ids)
    ).distinct(models.VideoProgress.student_id).count() if student_ids else 0
    
    # Course distribution
    course_dist = []
    for c in courses[:8]:
        enrolled = db.query(models.Enrollment).filter(
            models.Enrollment.course_id == c.id
        ).count()
        course_dist.append({"title": c.title[:20], "students": enrolled})
    
    # Teacher performance
    teacher_perf = []
    for t in teachers:
        t_courses = [c for c in courses if c.created_by == t.id]
        t_course_ids = [c.id for c in t_courses]
        
        t_total_score = 0
        t_student_count = 0
        t_enrollments = db.query(models.Enrollment.student_id).filter(models.Enrollment.course_id.in_(t_course_ids)).distinct().all() if t_course_ids else []
        for (sid,) in t_enrollments:
            # FIXED UNPACKING (3 values)
            m, l, r = get_student_metrics(db, sid, None) 
            t_total_score += m["overall_score"]
            t_student_count += 1
            
        t_avg = round(t_total_score / t_student_count, 1) if t_student_count > 0 else 0
        
        teacher_perf.append({
            "id": t.id, "name": t.name,
            "course_count": len(t_courses),
            "student_count": t_student_count,
            "avg_score": t_avg,
            "is_active": t.status
        })
    
    return {
        "total_teachers": len(teachers),
        "total_students": len(students),
        "total_courses": len(courses),
        "platform_avg_score": avg_score,
        "certificates_issued": certs,
        "active_this_week": active_week,
        "course_distribution": sorted(course_dist, key=lambda x: -x["students"]),
        "level_distribution": levels,
        "teacher_performance": teacher_perf
    }

# ── TEACHERS ─────────────────────────────────────────────────────────────────
@router.get("/teachers")
def get_teachers(admin=Depends(get_current_admin), db: Session = Depends(get_db)):
    teachers = db.query(models.User).filter(
        models.User.organization_id == admin.organization_id,
        models.User.role == "teacher"
    ).all()
    result = []
    for t in teachers:
        courses = db.query(models.Course).filter(models.Course.created_by == t.id).all()
        course_ids = [c.id for c in courses]
        
        t_total_score = 0
        t_student_count = 0
        t_enrollments = db.query(models.Enrollment.student_id).filter(models.Enrollment.course_id.in_(course_ids)).distinct().all() if course_ids else []
        for (sid,) in t_enrollments:
            # FIXED UNPACKING (3 values)
            m, l, r = get_student_metrics(db, sid)
            t_total_score += m["overall_score"]
            t_student_count += 1
            
        avg = round(t_total_score / t_student_count, 1) if t_student_count > 0 else 0
        
        result.append({
            "id": t.id, "name": t.name, "email": t.email,
            "is_active": t.status,
            "course_count": len(courses),
            "student_count": t_student_count,
            "avg_score": avg,
            "created_at": t.created_at.isoformat() if t.created_at else None
        })
    return result

@router.get("/teachers/{teacher_id}/detail")
def get_teacher_detail(
    teacher_id: int, admin=Depends(get_current_admin), db: Session = Depends(get_db)
):
    teacher = db.query(models.User).filter(
        models.User.id == teacher_id,
        models.User.organization_id == admin.organization_id
    ).first()
    if not teacher: raise HTTPException(status_code=404, detail="Teacher not found")
    
    courses = db.query(models.Course).filter(models.Course.created_by == teacher_id).all()
    course_ids = [c.id for c in courses]
    
    t_total_score = 0
    t_student_count = 0
    t_enrollments_distinct = db.query(models.Enrollment.student_id).filter(models.Enrollment.course_id.in_(course_ids)).distinct().all() if course_ids else []
    for (sid,) in t_enrollments_distinct:
        # FIXED UNPACKING (3 values)
        m, l, r = get_student_metrics(db, sid)
        t_total_score += m["overall_score"]
        t_student_count += 1
            
    avg = round(t_total_score / t_student_count, 1) if t_student_count > 0 else 0
    
    doubts_answered = db.query(models.ChatDoubt).filter(
        models.ChatDoubt.faculty_id == teacher_id,
        models.ChatDoubt.response != None
    ).count()
    
    courses_data = []
    for c in courses:
        enrolled = db.query(models.Enrollment).filter(models.Enrollment.course_id == c.id).count()
        c_score_sum = 0
        c_students = db.query(models.Enrollment.student_id).filter(models.Enrollment.course_id == c.id).all()
        for (sid,) in c_students:
            # FIXED UNPACKING (3 values)
            cm, cl, cr = get_student_metrics(db, sid, c.id)
            c_score_sum += cm["overall_score"]
        c_avg = round(c_score_sum / enrolled, 1) if enrolled > 0 else 0
        
        courses_data.append({
            "id": c.id, "title": c.title, "enrolled": enrolled,
            "avg_score": c_avg, "status": c.status,
            "created_at": c.created_at.isoformat() if c.created_at else None
        })
        
    return {
        "profile": {
            "id": teacher.id, "name": teacher.name, "email": teacher.email,
            "is_active": teacher.status,
            "created_at": teacher.created_at.isoformat() if teacher.created_at else None
        },
        "stats": {
            "course_count": len(courses), "student_count": t_student_count,
            "avg_score": avg, "doubts_answered": doubts_answered
        },
        "courses": courses_data
    }

# ── ADMIN COURSES ─────────────────────────────────────────────────────────────
@router.get("/courses")
def get_all_courses(admin=Depends(get_current_admin), db: Session = Depends(get_db)):
    courses = db.query(models.Course).filter(models.Course.organization_id == admin.organization_id).all()
    result = []
    for c in courses:
        teacher = db.query(models.User).filter(models.User.id == c.created_by).first()
        enrolled = db.query(models.Enrollment).filter(models.Enrollment.course_id == c.id).count()
        result.append({
            "id": c.id, "title": c.title, "description": c.description,
            "difficulty": c.difficulty, "logo": c.logo, "status": c.status,
            "teacher_name": teacher.name if teacher else "Unassigned",
            "teacher_id": c.created_by, "enrolled_students": enrolled
        })
    return result

@router.put("/courses/{course_id}/status")
def toggle_course_status(course_id: int, status: bool = Form(...), admin=Depends(get_current_admin), db: Session = Depends(get_db)):
    course = db.query(models.Course).filter(models.Course.id == course_id, models.Course.organization_id == admin.organization_id).first()
    if not course: raise HTTPException(status_code=404, detail="Course not found")
    course.status = status
    db.commit()
    return {"message": "Course status updated"}

@router.delete("/courses/{course_id}")
def delete_course(course_id: int, admin=Depends(get_current_admin), db: Session = Depends(get_db)):
    course = db.query(models.Course).filter(models.Course.id == course_id, models.Course.organization_id == admin.organization_id).first()
    if not course: raise HTTPException(status_code=404, detail="Course not found")
    db.delete(course)
    db.commit()
    return {"message": "Course deleted"}

@router.put("/courses/{course_id}/assign")
def assign_course_to_teacher(course_id: int, teacher_id: int = Form(...), admin=Depends(get_current_admin), db: Session = Depends(get_db)):
    course = db.query(models.Course).filter(models.Course.id == course_id, models.Course.organization_id == admin.organization_id).first()
    if not course: raise HTTPException(status_code=404, detail="Course not found")
    teacher = db.query(models.User).filter(models.User.id == teacher_id, models.User.organization_id == admin.organization_id, models.User.role == "teacher").first()
    if not teacher: raise HTTPException(status_code=400, detail="Invalid teacher")
    course.created_by = teacher_id
    db.commit()
    return {"message": f"Course assigned to {teacher.name}"}

@router.get("/courses/{course_id}")
def get_admin_course_detail(course_id: int, admin=Depends(get_current_admin), db: Session = Depends(get_db)):
    course = db.query(models.Course).filter(models.Course.id == course_id, models.Course.organization_id == admin.organization_id).first()
    if not course: raise HTTPException(status_code=404, detail="Course not found")
    
    # Mirroring the structure expected by the detail frontend
    topics = db.query(models.Topic).filter(models.Topic.course_id == course_id).order_by(models.Topic.order_number).all()
    topics_data = []
    for t in topics:
        topics_data.append({
            "id": t.id, "title": t.title,
            "videos": db.query(models.Video).filter(models.Video.topic_id == t.id).all(),
            "quizzes": db.query(models.Quiz).filter(models.Quiz.topic_id == t.id).all(),
            "assignments": db.query(models.Assignment).filter(models.Assignment.topic_id == t.id).all()
        })
    
    return {
        "id": course.id, "title": course.title, "description": course.description,
        "difficulty": course.difficulty, "logo": course.logo, "status": course.status,
        "topics": topics_data
    }

@router.get("/courses/{course_id}/topics")
def get_admin_course_topics(course_id: int, admin=Depends(get_current_admin), db: Session = Depends(get_db)):
    return db.query(models.Topic).filter(models.Topic.course_id == course_id).all()

# ── ADMIN STUDENTS ────────────────────────────────────────────────────────────
from fastapi.responses import StreamingResponse
import io, pandas as pd

@router.get("/students")
def get_all_students(admin=Depends(get_current_admin), db: Session = Depends(get_db)):
    students = db.query(models.User).filter(models.User.organization_id == admin.organization_id, models.User.role == "student").all()
    result = []
    for s in students:
        # FIXED UNPACKING (3 values)
        metrics, level, risk = get_student_metrics(db, s.id)
        enrollments = db.query(models.Enrollment, models.Course.title).join(models.Course).filter(models.Enrollment.student_id == s.id).order_by(models.Enrollment.enrolled_at.desc()).all()
        result.append({
            "id": s.id, "name": s.name, "email": s.email,
            "overall_score": round(metrics["overall_score"], 1),
            "learner_level": level, "dropout_risk": risk,
            "course_count": len(enrollments), "main_course": enrollments[0][1] if enrollments else "—"
        })
    return result

@router.get("/students/{student_id}/quiz-attempts")
def get_admin_student_quiz_attempts(student_id: int, admin=Depends(get_current_admin), db: Session = Depends(get_db)):
    attempts = db.query(models.QuizAttempt).filter(models.QuizAttempt.student_id == student_id).all()
    result = []
    for a in attempts:
        q_count = db.query(models.QuizQuestion).filter(models.QuizQuestion.quiz_id == a.quiz_id).count()
        result.append({
            "quiz_id": a.quiz_id, "score": a.score,
            "percentage": round((a.score / q_count) * 100, 2) if q_count > 0 else 0
        })
    return result

@router.get("/students/{student_id}/assignment-submissions")
def get_admin_student_submissions(student_id: int, admin=Depends(get_current_admin), db: Session = Depends(get_db)):
    subs = db.query(models.AssignmentSubmission).filter(models.AssignmentSubmission.student_id == student_id).all()
    result = []
    for s in subs:
        total_m = db.query(models.Assignment.total_marks).filter(models.Assignment.id == s.assignment_id).scalar() or 10
        result.append({
            "assignment_id": s.assignment_id, "obtained_marks": s.obtained_marks, "total_marks": total_m
        })
    return result

@router.get("/students/{student_id}/video-progress")
def get_admin_student_video_progress(student_id: int, admin=Depends(get_current_admin), db: Session = Depends(get_db)):
    records = db.query(models.VideoProgress).filter(models.VideoProgress.student_id == student_id).all()
    return [{"video_id": r.video_id, "watch_time": r.watch_time, "watch_percentage": r.watch_percentage} for r in records]

@router.get("/students/{student_id}/enrollments")
def get_admin_student_enrollments(student_id: int, admin=Depends(get_current_admin), db: Session = Depends(get_db)):
    enrollments = db.query(models.Enrollment).filter(models.Enrollment.student_id == student_id).all()
    return [{"course_id": e.course_id, "enrolled_at": e.enrolled_at} for e in enrollments]

@router.get("/students/export")
def export_all_students_excel(
    token: str = None, # Allow query token for browser downloads
    admin=Depends(get_current_admin), db: Session = Depends(get_db)
):
    """Generates platform-wide Excel report."""
    data = get_all_students(admin, db)
    if not data: raise HTTPException(status_code=400, detail="No data")
    df = pd.DataFrame(data)
    df_report = df[["name", "email", "main_course", "course_count", "overall_score", "learner_level", "dropout_risk"]]
    df_report.columns = ["Student Name", "Email", "Main Course", "Courses Enrolled", "Platform Score %", "AI Level", "Dropout Risk"]
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df_report.to_excel(writer, index=False, sheet_name='Platform Performance')
    output.seek(0)
    headers = {'Content-Disposition': f'attachment; filename="platform_students_{datetime.now().strftime("%Y%m%d")}.xlsx"'}
    return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

@router.get("/students/{student_id}/detail")
def get_admin_student_detail(student_id: int, admin=Depends(get_current_admin), db: Session = Depends(get_db)):
    student = db.query(models.User).filter(models.User.id == student_id, models.User.organization_id == admin.organization_id).first()
    if not student: raise HTTPException(status_code=404, detail="Student not found")
    # FIXED UNPACKING (3 values)
    metrics, level, risk = get_student_metrics(db, student_id)
    return {
        "id": student.id, "name": student.name, "email": student.email,
        "learner_level": level, "dropout_risk": risk,
        "avg_quiz_score": metrics["quiz_average"],
        "avg_assignment_score": metrics["assignment_average"],
        "completion_rate": metrics["completion_rate"]
    }

# ── ADMIN ANALYTICS ───────────────────────────────────────────────────────────
@router.get("/analytics")
def get_admin_analytics(admin=Depends(get_current_admin), db: Session = Depends(get_db)):
    org_id = admin.organization_id
    courses = db.query(models.Course).filter(models.Course.organization_id == org_id).all()
    students = db.query(models.User).filter(models.User.organization_id == org_id, models.User.role == "student").all()
    student_ids = [s.id for s in students]
    
    total_score = 0
    total_comp_rate = 0
    levels = {"Strong": 0, "Average": 0, "Weak": 0}
    
    for sid in student_ids:
        # FIXED UNPACKING (3 values)
        metrics, level, risk = get_student_metrics(db, sid)
        total_score += metrics["overall_score"]
        total_comp_rate += metrics["completion_rate"]
        if level in levels: levels[level] += 1
            
    n = len(student_ids) or 1
    platform_avg = round(total_score / n, 1)
    completion_avg = round(total_comp_rate / n, 1)
    
    # Monthly growth
    monthly = []
    for i in range(5, -1, -1):
        month_start = (datetime.utcnow().replace(day=1) - timedelta(days=i*30))
        month_end   = month_start + timedelta(days=30)
        count = db.query(models.User).filter(models.User.organization_id == org_id, models.User.role == "student", models.User.created_at >= month_start, models.User.created_at < month_end).count()
        monthly.append({"month": month_start.strftime("%b %Y"), "count": count})
    
    # Course performance
    course_perf = []
    for c in courses:
        enrollments = db.query(models.Enrollment.student_id).filter(models.Enrollment.course_id == c.id).all()
        c_score_sum = 0
        for (sid,) in enrollments:
            # FIXED UNPACKING (3 values)
            m, l, r = get_student_metrics(db, sid, c.id)
            c_score_sum += m["overall_score"]
        c_avg = round(c_score_sum / len(enrollments), 1) if enrollments else 0
        teacher = db.query(models.User).filter(models.User.id == c.created_by).first()
        course_perf.append({"title": c.title, "avg_score": c_avg, "teacher_name": teacher.name if teacher else "—"})
    
    # Simple Engagement Rates
    v_comp_total = sum([get_student_metrics(db, sid)[0]["completion_rate"] for sid in student_ids]) if student_ids else 0
    q_att_total = sum([get_student_metrics(db, sid)[0]["quiz_attempt_rate"] for sid in student_ids]) if student_ids else 0
    a_sub_total = sum([get_student_metrics(db, sid)[0]["assignment_submission_rate"] for sid in student_ids]) if student_ids else 0
    
    return {
        "total_students": len(student_ids), "total_courses": len(courses),
        "platform_avg_score": platform_avg, "completion_rate": completion_avg,
        "monthly_growth": monthly, "course_performance": sorted(course_perf, key=lambda x: -x["avg_score"]),
        "level_distribution": levels,
        "engagement": {
            "video_rate": round(v_comp_total / n),
            "quiz_rate": round(q_att_total / n),
            "assign_rate": round(a_sub_total / n)
        },
        "weak_topics": [] # Optional
    }

# ── ADMIN ORGANIZATION & PROFILE (REMAINING) ──────────────────────────────────
@router.get("/organization")
def get_organization(admin=Depends(get_current_admin), db: Session = Depends(get_db)):
    org = db.query(models.Organization).filter(models.Organization.id == admin.organization_id).first()
    if not org: raise HTTPException(status_code=404, detail="Not found")
    return {"org_name": org.name, "platform_name": org.platform_name, "logo": f"http://127.0.0.1:8000/{org.logo}" if org.logo else None}

@router.put("/organization")
async def update_organization(org_name: str = Form(None), platform_name: str = Form(None), logo: UploadFile = File(None), admin=Depends(get_current_admin), db: Session = Depends(get_db)):
    org = db.query(models.Organization).filter(models.Organization.id == admin.organization_id).first()
    if org_name: org.name = org_name
    if platform_name: org.platform_name = platform_name
    if logo and logo.filename:
        upload_dir = "uploads/logos"
        os.makedirs(upload_dir, exist_ok=True)
        file_path = f"{upload_dir}/{admin.organization_id}_{logo.filename}"
        with open(file_path, "wb") as f: shutil.copyfileobj(logo.file, f)
        org.logo = file_path
    db.commit()
    return {"message": "Updated"}

@router.get("/profile")
def get_admin_profile(admin=Depends(get_current_admin), db: Session = Depends(get_db)):
    return {"id": admin.id, "name": admin.name, "email": admin.email}

@router.put("/profile")
def update_admin_profile(name: str = Form(None), email: str = Form(None), current_password: str = Form(None), new_password: str = Form(None), admin_user=Depends(get_current_admin), db: Session = Depends(get_db)):
    from auth import verify_password
    if name: admin_user.name = name
    if email: admin_user.email = email
    if current_password and new_password:
        if not verify_password(current_password, admin_user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        admin_user.password_hash = hash_password(new_password)
    db.commit()
    return {"message": "Profile updated"}
