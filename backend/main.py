from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import engine, Base
import models
import os

# ── Import all routers ──
from routers import auth, organization, dashboard, courses, topics, videos, assignments, quizzes, profile, student, chatbot, admin_router, materials, meetings

app = FastAPI()

# ── CORS — must be before everything else ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,   # must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Create upload folders ──
os.makedirs("uploads", exist_ok=True)

# ── Create DB tables ──
Base.metadata.create_all(bind=engine)

# ── Serve uploaded files ──
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ── Register all routers ──
app.include_router(auth.router)
app.include_router(organization.router)
app.include_router(dashboard.router)
app.include_router(courses.router)
app.include_router(topics.router)
app.include_router(videos.router)
app.include_router(assignments.router)
app.include_router(quizzes.router)
app.include_router(profile.router)
app.include_router(student.router)
app.include_router(chatbot.router)
app.include_router(admin_router.router)
app.include_router(materials.router)
app.include_router(meetings.router)