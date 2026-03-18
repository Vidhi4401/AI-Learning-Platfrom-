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
        metrics, level = get_student_metrics(db, sid)
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
    
    # Active this week (any video progress)
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
        t_enrollments_count = db.query(models.Enrollment).filter(
            models.Enrollment.course_id.in_(t_course_ids)
        ).count() if t_course_ids else 0
        
        # Simple avg for teacher impact
        t_total_score = 0
        t_student_count = 0
        t_enrollments = db.query(models.Enrollment.student_id).filter(models.Enrollment.course_id.in_(t_course_ids)).distinct().all() if t_course_ids else []
        for (sid,) in t_enrollments:
            m, _ = get_student_metrics(db, sid, None) # global student score
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
    
    # Engagement
    # Reuse global rates logic if possible or recalculate simply
    # For speed, let's do a simple count
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
            m, _ = get_student_metrics(db, sid)
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

@router.post("/teachers/invite")
def invite_teacher(
    name: str = Form(...), email: str = Form(...), password: str = Form(...),
    admin=Depends(get_current_admin), db: Session = Depends(get_db)
):
    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    teacher = models.User(
        name=name, email=email,
        password_hash=hash_password(password),
        role="teacher",
        organization_id=admin.organization_id,
        status=True
    )
    db.add(teacher)
    db.commit()
    return {"message": f"Teacher account created for {name}"}

@router.put("/teachers/{teacher_id}/status")
def update_teacher_status(
    teacher_id: int, is_active: bool = Form(...),
    admin=Depends(get_current_admin), db: Session = Depends(get_db)
):
    teacher = db.query(models.User).filter(
        models.User.id == teacher_id,
        models.User.organization_id == admin.organization_id,
        models.User.role == "teacher"
    ).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    teacher.status = is_active
    db.commit()
    return {"message": "Status updated"}

@router.put("/teachers/{teacher_id}/reset-password")
def reset_teacher_password(
    teacher_id: int, new_password: str = Form(...),
    admin=Depends(get_current_admin), db: Session = Depends(get_db)
):
    teacher = db.query(models.User).filter(
        models.User.id == teacher_id,
        models.User.organization_id == admin.organization_id,
        models.User.role == "teacher"
    ).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    teacher.password_hash = hash_password(new_password)
    db.commit()
    return {"message": "Password reset successfully"}

@router.delete("/teachers/{teacher_id}")
def delete_teacher(
    teacher_id: int, admin=Depends(get_current_admin), db: Session = Depends(get_db)
):
    teacher = db.query(models.User).filter(
        models.User.id == teacher_id,
        models.User.organization_id == admin.organization_id,
        models.User.role == "teacher"
    ).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    
    # Check for active enrollments in their courses
    courses = db.query(models.Course).filter(models.Course.created_by == teacher_id).all()
    c_ids = [c.id for c in courses]
    enr_count = db.query(models.Enrollment).filter(models.Enrollment.course_id.in_(c_ids)).count() if c_ids else 0
    
    if enr_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete teacher with active students")
        
    db.delete(teacher)
    db.commit()
    return {"message": "Teacher deleted"}

@router.get("/teachers/{teacher_id}/detail")
def get_teacher_detail(
    teacher_id: int, admin=Depends(get_current_admin), db: Session = Depends(get_db)
):
    teacher = db.query(models.User).filter(
        models.User.id == teacher_id,
        models.User.organization_id == admin.organization_id
    ).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    
    courses = db.query(models.Course).filter(models.Course.created_by == teacher_id).all()
    course_ids = [c.id for c in courses]
    
    t_total_score = 0
    t_student_count = 0
    t_enrollments_distinct = db.query(models.Enrollment.student_id).filter(models.Enrollment.course_id.in_(course_ids)).distinct().all() if course_ids else []
    for (sid,) in t_enrollments_distinct:
        m, _ = get_student_metrics(db, sid)
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
        # Course-specific avg score
        c_score_sum = 0
        c_students = db.query(models.Enrollment.student_id).filter(models.Enrollment.course_id == c.id).all()
        for (sid,) in c_students:
            cm, _ = get_student_metrics(db, sid, c.id)
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
    courses = db.query(models.Course).filter(
        models.Course.organization_id == admin.organization_id
    ).all()
    result = []
    for c in courses:
        teacher = db.query(models.User).filter(models.User.id == c.created_by).first()
        enrolled = db.query(models.Enrollment).filter(
            models.Enrollment.course_id == c.id
        ).count()
        result.append({
            "id": c.id, "title": c.title, "description": c.description,
            "difficulty": c.difficulty, "logo": c.logo, "status": c.status,
            "teacher_name": teacher.name if teacher else "Unassigned",
            "teacher_id": c.created_by, "enrolled_students": enrolled
        })
    return result

@router.put("/courses/{course_id}/status")
def toggle_course_status(
    course_id: int, status: bool = Form(...),
    admin=Depends(get_current_admin), db: Session = Depends(get_db)
):
    course = db.query(models.Course).filter(
        models.Course.id == course_id,
        models.Course.organization_id == admin.organization_id
    ).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    course.status = status
    db.commit()
    return {"message": "Course status updated"}

@router.delete("/courses/{course_id}")
def delete_course(
    course_id: int, admin=Depends(get_current_admin), db: Session = Depends(get_db)
):
    course = db.query(models.Course).filter(
        models.Course.id == course_id,
        models.Course.organization_id == admin.organization_id
    ).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    db.delete(course)
    db.commit()
    return {"message": "Course deleted"}

@router.put("/courses/{course_id}/assign")
def assign_course_to_teacher(
    course_id: int, teacher_id: int = Form(...),
    admin=Depends(get_current_admin), db: Session = Depends(get_db)
):
    course = db.query(models.Course).filter(
        models.Course.id == course_id,
        models.Course.organization_id == admin.organization_id
    ).first()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    # Verify teacher belongs to same org
    teacher = db.query(models.User).filter(
        models.User.id == teacher_id,
        models.User.organization_id == admin.organization_id,
        models.User.role == "teacher"
    ).first()
    
    if not teacher:
        raise HTTPException(status_code=400, detail="Invalid teacher selected")
        
    course.created_by = teacher_id
    db.commit()
    return {"message": f"Course assigned to {teacher.name}"}

# ── ADMIN STUDENTS ────────────────────────────────────────────────────────────
@router.get("/students")
def get_all_students(admin=Depends(get_current_admin), db: Session = Depends(get_db)):
    # All students in organization
    students = db.query(models.User).filter(
        models.User.organization_id == admin.organization_id,
        models.User.role == "student"
    ).all()
    
    result = []
    for s in students:
        metrics, level = get_student_metrics(db, s.id)
        enrollments = db.query(models.Enrollment, models.Course.title)\
            .join(models.Course, models.Enrollment.course_id == models.Course.id)\
            .filter(models.Enrollment.student_id == s.id)\
            .order_by(models.Enrollment.enrolled_at.desc()).all()
            
        result.append({
            "id": s.id, "name": s.name, "email": s.email,
            "overall_score": metrics["overall_score"],
            "learner_level": level,
            "course_count": len(enrollments),
            "main_course": enrollments[0][1] if enrollments else "—",
            "created_at": s.created_at.isoformat() if s.created_at else None
        })
    return result

# Reuse detail endpoints but under admin prefix
@router.get("/students/{student_id}/detail")
def get_admin_student_detail(student_id: int, admin=Depends(get_current_admin), db: Session = Depends(get_db)):
    student = db.query(models.User).filter(
        models.User.id == student_id,
        models.User.organization_id == admin.organization_id
    ).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    metrics, level = get_student_metrics(db, student_id)
    return {
        "id": student.id, "name": student.name, "email": student.email,
        "created_at": student.created_at.isoformat() if student.created_at else None,
        "learner_level": level,
        "avg_quiz_score": metrics["quiz_average"],
        "avg_assignment_score": metrics["assignment_average"],
        "completion_rate": metrics["completion_rate"]
    }

# ── ADMIN ANALYTICS ───────────────────────────────────────────────────────────
@router.get("/analytics")
def get_admin_analytics(admin=Depends(get_current_admin), db: Session = Depends(get_db)):
    org_id = admin.organization_id
    courses = db.query(models.Course).filter(models.Course.organization_id == org_id).all()
    course_ids = [c.id for c in courses]
    
    students = db.query(models.User).filter(
        models.User.organization_id == org_id,
        models.User.role == "student"
    ).all()
    student_ids = [s.id for s in students]
    
    total_score = 0
    student_count_with_perf = 0
    levels = {"Strong": 0, "Average": 0, "Weak": 0}
    total_comp_rate = 0
    
    for sid in student_ids:
        metrics, level = get_student_metrics(db, sid)
        total_score += metrics["overall_score"]
        total_comp_rate += metrics["completion_rate"]
        student_count_with_perf += 1
        if level in levels:
            levels[level] += 1
            
    platform_avg = round(total_score / student_count_with_perf, 1) if student_count_with_perf > 0 else 0
    completion_avg = round(total_comp_rate / student_count_with_perf, 1) if student_count_with_perf > 0 else 0
    
    # Monthly growth (last 6 months)
    monthly = []
    for i in range(5, -1, -1):
        month_start = (datetime.utcnow().replace(day=1) - timedelta(days=i*30))
        month_end   = month_start + timedelta(days=30)
        count = db.query(models.User).filter(
            models.User.organization_id == org_id,
            models.User.role == "student",
            models.User.created_at >= month_start,
            models.User.created_at < month_end
        ).count()
        monthly.append({"month": month_start.strftime("%b %Y"), "count": count})
    
    # Course performance
    course_perf = []
    for c in courses:
        enrollments = db.query(models.Enrollment.student_id).filter(models.Enrollment.course_id == c.id).all()
        c_score_sum = 0
        for (sid,) in enrollments:
            m, _ = get_student_metrics(db, sid, c.id)
            c_score_sum += m["overall_score"]
        c_avg = round(c_score_sum / len(enrollments), 1) if enrollments else 0
        teacher = db.query(models.User).filter(models.User.id == c.created_by).first()
        course_perf.append({"title": c.title, "avg_score": c_avg,
                            "teacher_name": teacher.name if teacher else "—"})
    
    # Weak topics (avg score < 60)
    weak_topics = []
    for c in courses:
        teacher = db.query(models.User).filter(models.User.id == c.created_by).first()
        topics = db.query(models.Topic).filter(models.Topic.course_id == c.id).all()
        for t in topics:
            quizzes = db.query(models.Quiz).filter(models.Quiz.topic_id == t.id).all()
            q_ids = [q.id for q in quizzes]
            if not q_ids: continue
            
            avg_q_topic = db.query(func.avg(models.QuizAttempt.score)).filter(models.QuizAttempt.quiz_id.in_(q_ids)).scalar()
            if avg_q_topic is not None:
                q_count = db.query(models.QuizQuestion).filter(models.QuizQuestion.quiz_id.in_(q_ids)).count()
                pct = (avg_q_topic / q_count * 100) if q_count > 0 else 0
                if pct < 60:
                    affected = db.query(models.QuizAttempt.student_id).filter(models.QuizAttempt.quiz_id.in_(q_ids)).distinct().count()
                    weak_topics.append({
                        "topic_name": t.title, "course_title": c.title,
                        "teacher_name": teacher.name if teacher else "—",
                        "avg_score": round(pct, 1), "affected_students": affected
                    })
    
    # Simple Engagement (Video, Quiz, Assign)
    # We can reuse the teacher logic but platform-wide
    v_comp_total = sum([get_student_metrics(db, sid)[0]["completion_rate"] for sid in student_ids]) if student_ids else 0
    q_att_total = sum([get_student_metrics(db, sid)[0]["quiz_attempt_rate"] for sid in student_ids]) if student_ids else 0
    a_sub_total = sum([get_student_metrics(db, sid)[0]["assignment_submission_rate"] for sid in student_ids]) if student_ids else 0
    n = len(student_ids) or 1
    
    return {
        "total_students": len(student_ids),
        "total_courses": len(courses),
        "platform_avg_score": platform_avg,
        "completion_rate": completion_avg,
        "monthly_growth": monthly,
        "course_performance": sorted(course_perf, key=lambda x: -x["avg_score"]),
        "level_distribution": levels,
        "engagement": {
            "video_rate": round(v_comp_total / n),
            "quiz_rate": round(q_att_total / n),
            "assign_rate": round(a_sub_total / n)
        },
        "weak_topics": sorted(weak_topics, key=lambda x: x["avg_score"])
    }

# ── CERTIFICATES ──────────────────────────────────────────────────────────────
@router.get("/certificates/eligible")
def get_eligible_students(admin=Depends(get_current_admin), db: Session = Depends(get_db)):
    courses = db.query(models.Course).filter(
        models.Course.organization_id == admin.organization_id
    ).all()
    result = []
    for c in courses:
        enrollments = db.query(models.Enrollment).filter(
            models.Enrollment.course_id == c.id
        ).all()
        for e in enrollments:
            already_issued = db.query(models.Certificate).filter(
                models.Certificate.student_id == e.student_id,
                models.Certificate.course_id == c.id,
                models.Certificate.issued == True
            ).first()
            if already_issued: continue
            
            metrics, _ = get_student_metrics(db, e.student_id, c.id)
            if metrics["completion_rate"] >= 80 and metrics["quiz_average"] >= 70:
                student = db.query(models.User).filter(models.User.id == e.student_id).first()
                result.append({
                    "student_id": e.student_id,
                    "student_name": student.name if student else "—",
                    "course_id": c.id, "course_title": c.title,
                    "avg_score": round(metrics["quiz_average"], 1),
                    "completion_rate": round(metrics["completion_rate"], 1)
                })
    return result

@router.get("/certificates/issued")
def get_issued_certificates(admin=Depends(get_current_admin), db: Session = Depends(get_db)):
    courses = db.query(models.Course).filter(
        models.Course.organization_id == admin.organization_id
    ).all()
    course_ids = [c.id for c in courses]
    certs = db.query(models.Certificate).filter(
        models.Certificate.course_id.in_(course_ids),
        models.Certificate.issued == True
    ).all()
    result = []
    for cert in certs:
        student = db.query(models.User).filter(models.User.id == cert.student_id).first()
        course  = db.query(models.Course).filter(models.Course.id == cert.course_id).first()
        result.append({
            "id": cert.id,
            "student_name": student.name if student else "—",
            "course_title": course.title if course else "—",
            "issued_at": cert.issued_at.isoformat() if cert.issued_at else None,
            "is_valid": cert.issued # mapping issued to is_valid
        })
    return result

@router.post("/certificates")
def issue_certificate(
    student_id: int = Form(...), course_id: int = Form(...),
    admin=Depends(get_current_admin), db: Session = Depends(get_db)
):
    cert = db.query(models.Certificate).filter(
        models.Certificate.student_id == student_id,
        models.Certificate.course_id == course_id
    ).first()
    
    if cert and cert.issued:
        raise HTTPException(status_code=400, detail="Certificate already issued")
    
    if not cert:
        cert = models.Certificate(student_id=student_id, course_id=course_id)
        db.add(cert)
        
    cert.issued = True
    cert.issued_at = datetime.utcnow()
    db.commit()
    return {"message": "Certificate issued", "id": cert.id}

@router.put("/certificates/{cert_id}/revoke")
def revoke_certificate(cert_id: int, admin=Depends(get_current_admin), db: Session = Depends(get_db)):
    cert = db.query(models.Certificate).filter(models.Certificate.id == cert_id).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    cert.issued = False
    db.commit()
    return {"message": "Certificate revoked"}

# ── ADMIN ORGANIZATION ────────────────────────────────────────────────────────
@router.get("/organization")
def get_organization(admin=Depends(get_current_admin), db: Session = Depends(get_db)):
    org = db.query(models.Organization).filter(
        models.Organization.id == admin.organization_id
    ).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return {
        "org_name": org.name,
        "platform_name": org.platform_name,
        "logo": f"http://127.0.0.1:8000/{org.logo}" if org.logo else None
    }

@router.put("/organization")
async def update_organization(
    org_name: str = Form(None),
    platform_name: str = Form(None),
    logo: UploadFile = File(None),
    admin=Depends(get_current_admin), db: Session = Depends(get_db)
):
    org = db.query(models.Organization).filter(
        models.Organization.id == admin.organization_id
    ).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if org_name:
        org.name = org_name
    if platform_name:
        org.platform_name = platform_name
    if logo and logo.filename:
        upload_dir = "uploads/logos"
        os.makedirs(upload_dir, exist_ok=True)
        file_path = f"{upload_dir}/{admin.organization_id}_{logo.filename}"
        with open(file_path, "wb") as f:
            shutil.copyfileobj(logo.file, f)
        org.logo = file_path
    db.commit()
    db.refresh(org)
    return {
        "org_name": org.name,
        "platform_name": org.platform_name,
        "logo": org.logo,
        "logo_url": f"http://127.0.0.1:8000/{org.logo}" if org.logo else None
    }

# ── ADMIN PROFILE ─────────────────────────────────────────────────────────────
@router.get("/profile")
def get_admin_profile(admin=Depends(get_current_admin), db: Session = Depends(get_db)):
    return {"id": admin.id, "name": admin.name, "email": admin.email}

@router.put("/profile")
def update_admin_profile(
    name: str = Form(None), email: str = Form(None),
    current_password: str = Form(None), new_password: str = Form(None),
    admin_user=Depends(get_current_admin), db: Session = Depends(get_db)
):
    from auth import verify_password
    if name: admin_user.name = name
    if email: admin_user.email = email
    if current_password and new_password:
        if not verify_password(current_password, admin_user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        admin_user.password_hash = hash_password(new_password)
    db.commit()
    return {"message": "Profile updated", "name": admin_user.name, "email": admin_user.email}
