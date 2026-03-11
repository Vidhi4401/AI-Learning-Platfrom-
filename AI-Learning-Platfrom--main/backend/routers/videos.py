from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import SessionLocal
import models, schemas
from dependencies import get_current_admin

router = APIRouter(tags=["Videos"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/api/v1/admin/topics/{topic_id}/videos")
def create_video(
    topic_id: int,
    data: schemas.VideoCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    video = models.Video(
        topic_id=topic_id,
        video_url=data.video_url,
        duration=data.duration
    )
    db.add(video)
    db.commit()
    db.refresh(video)
    return {"video_id": video.id}


@router.get("/api/v1/topics/{topic_id}/videos")
def get_videos(topic_id: int, db: Session = Depends(get_db)):
    return db.query(models.Video).filter(
        models.Video.topic_id == topic_id
    ).all()


@router.put("/api/v1/admin/videos/{video_id}")
def update_video(
    video_id: int,
    data: schemas.VideoUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    video = db.query(models.Video).filter(models.Video.id == video_id).first()
    video.video_url = data.video_url
    video.duration  = data.duration
    db.commit()
    return {"message": "Video updated"}


@router.delete("/api/v1/admin/videos/{video_id}")
def delete_video(
    video_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):
    video = db.query(models.Video).filter(models.Video.id == video_id).first()
    db.delete(video)
    db.commit()
    return {"message": "Video deleted"}