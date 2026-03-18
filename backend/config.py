import os
from dotenv import load_dotenv

# Force reload from .env file to ensure new keys are picked up
load_dotenv(override=True)

DATABASE_URL = os.getenv("DATABASE_URL")
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()

print(f"[Config] GROQ_API_KEY loaded, starts with: {GROQ_API_KEY[:8]}...")
