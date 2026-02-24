from pydantic import BaseModel

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

from pydantic import BaseModel
from typing import Optional


# =========================
# COURSE
# =========================

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


# =========================
# TOPIC
# =========================

class TopicCreate(BaseModel):
    title: str


class TopicUpdate(BaseModel):
    title: str


# =========================
# VIDEO
# =========================

class VideoCreate(BaseModel):
    video_url: str
    duration: int


class VideoUpdate(BaseModel):
    video_url: str
    duration: int


# =========================
# ASSIGNMENT
# =========================

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


from pydantic import BaseModel
from typing import Optional


# =========================
# QUIZ
# =========================

class QuizCreate(BaseModel):
    title: str


class QuizUpdate(BaseModel):
    title: str


# =========================
# QUIZ QUESTION
# =========================

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