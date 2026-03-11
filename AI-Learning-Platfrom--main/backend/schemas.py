from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class RegisterSchema(BaseModel):
    name: str
    email: str
    password: str
    organization_id: int

class LoginSchema(BaseModel):
    email: str
    password: str

class ForgotPasswordSchema(BaseModel):
    email: str

class ResetPasswordSchema(BaseModel):
    token: str
    new_password: str

class CourseCreate(BaseModel):
    title: str
    description: str
    difficulty: Optional[str] = None
    status: Optional[bool] = True

class CourseUpdate(BaseModel):
    title: str
    description: str
    difficulty: Optional[str]
    status: Optional[bool]

class TopicCreate(BaseModel):
    title: str


class TopicUpdate(BaseModel):
    title: str

class VideoCreate(BaseModel):
    video_url: str
    duration: int


class VideoUpdate(BaseModel):
    video_url: str
    duration: int


class AssignmentCreate(BaseModel):
    title: str
    description: str
    total_marks: int
    model_answer: Optional[str]


class AssignmentUpdate(BaseModel):
    title: str
    description: str
    total_marks: int
    model_answer: Optional[str]


class QuizCreate(BaseModel):
    title: str


class QuizUpdate(BaseModel):
    title: str

class QuizQuestionCreate(BaseModel):
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str


class QuizQuestionUpdate(BaseModel):
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str

# ── New Chat & Doubt Schemas ──
class ChatDoubtCreate(BaseModel):
    query: str
    topic_id: Optional[int] = None
    mode: str # "AI" or "FACULTY"

class ChatDoubtResponse(BaseModel):
    id: int
    query: str
    response: Optional[str] = None
    mode: str
    is_read_by_student: bool
    created_at: datetime

    class Config:
        from_attributes = True

class UnreadCountResponse(BaseModel):
    count: int

class FacultyReplySchema(BaseModel):
    doubt_id: int
    response: str
    faculty_id: int
