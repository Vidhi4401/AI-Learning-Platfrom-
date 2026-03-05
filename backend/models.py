from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func
from database import Base
from sqlalchemy import Boolean
from sqlalchemy import Float

class Organization(Base):
    __tablename__ = "organizations"

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String, unique=True)              # real org name — never changes
    platform_name= Column(String, nullable=True)            # editable display name
    logo         = Column(String, nullable=True)            # uploaded logo path
    email        = Column(String, nullable=True)            # org contact email
    status       = Column(Boolean, default=True)            # active/inactive
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"))
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String)
    status = Column(String, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    description = Column(String)
    difficulty = Column(String(50))
    logo = Column(String) 
    status = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id"))
    organization_id = Column(Integer, ForeignKey("organizations.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Topic(Base):
    __tablename__ = "topics"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    course_id = Column(Integer, ForeignKey("courses.id"))
    order_number = Column(Integer, nullable=False, default=1)

class TopicProgress(Base):
    __tablename__ = "topic_progress"

    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id"))
    student_id = Column(Integer, ForeignKey("users.id"))
    completed = Column(Boolean, default=False)

class Enrollment(Base):
    __tablename__ = "enrollments"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"))
    course_id = Column(Integer, ForeignKey("courses.id"))
    enrolled_at = Column(DateTime(timezone=True), server_default=func.now())

class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id"))
    title = Column(String)
    description = Column(String)
    total_marks = Column(Integer)
    model_answer = Column(String)  

class AssignmentSubmission(Base):
    __tablename__ = "assignment_submissions"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"))
    student_id = Column(Integer, ForeignKey("users.id"))
    obtained_marks = Column(Integer)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())

class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id"))
    title = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"))
    question_text = Column(String)
    option_a = Column(String)
    option_b = Column(String)
    option_c = Column(String)
    option_d = Column(String)
    correct_option = Column(String)


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"))
    student_id = Column(Integer, ForeignKey("users.id"))
    score = Column(Integer)
    attempted_at = Column(DateTime(timezone=True), server_default=func.now())

class VideoProgress(Base):
    __tablename__ = "video_progress"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"))
    topic_id = Column(Integer, ForeignKey("topics.id"))
    watch_percentage = Column(Integer)

class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id"))
    video_url = Column(String)
    duration = Column(Integer)  # duration in seconds
    created_at = Column(DateTime, server_default=func.now())

class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"))
    course_id = Column(Integer, ForeignKey("courses.id"))
    eligible = Column(Boolean, default=False)
    issued = Column(Boolean, default=False)
    issued_at = Column(DateTime)


class StudentPerformanceSummary(Base):
    __tablename__ = "student_performance_summary"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), unique=True)
    avg_quiz_score = Column(Float)
    avg_assignment_score = Column(Float)
    completion_rate = Column(Float)
    weak_topic_count = Column(Integer)
    strong_topic_count = Column(Integer)
    learner_level = Column(String(20))
    last_updated = Column(DateTime, server_default=func.now())
