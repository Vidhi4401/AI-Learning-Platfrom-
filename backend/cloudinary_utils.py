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
        # Read file content into memory
        file_content = file.file.read()
        
        # Upload to Cloudinary
        result = cloudinary.uploader.upload(
            file_content,
            folder=folder,
            resource_type=resource_type
        )
        
        return result.get("secure_url")
    except Exception as e:
        print(f"[Cloudinary Error] {e}")
        return None
