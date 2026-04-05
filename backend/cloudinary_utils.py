import cloudinary
import cloudinary.uploader
from config import CLOUDINARY_URL
from fastapi import UploadFile
import io

# Configure Cloudinary using the URL from .env
if CLOUDINARY_URL:
    cloudinary.config(cloudinary_url=CLOUDINARY_URL)

def upload_to_cloudinary(file: UploadFile, folder: str = "learnhub", resource_type: str = "auto"):
    """
    Uploads a file to Cloudinary and returns the secure URL.
    resource_type can be "image", "video", or "raw". "auto" detects automatically.
    """
    try:
        # Upload to Cloudinary using the file stream directly
        result = cloudinary.uploader.upload(
            file.file,
            folder=folder,
            resource_type=resource_type,
            use_filename=True,
            unique_filename=True
        )
        
        return result.get("secure_url")
    except Exception as e:
        print(f"[Cloudinary Error] {e}")
        return None

def upload_buffer_to_cloudinary(buffer: io.BytesIO, filename: str, folder: str = "learnhub", resource_type: str = "auto"):
    """
    Uploads a BytesIO buffer to Cloudinary and returns the secure URL.
    """
    try:
        buffer.seek(0)
        result = cloudinary.uploader.upload(
            buffer,
            folder=folder,
            resource_type=resource_type,
            public_id=filename,
            use_filename=True,
            unique_filename=True
        )
        return result.get("secure_url")
    except Exception as e:
        print(f"[Cloudinary Buffer Error] {e}")
        return None
