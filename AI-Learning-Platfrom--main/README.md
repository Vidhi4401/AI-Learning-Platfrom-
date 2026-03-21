# AI-Learning-Platfrom-
download zip file and extract in folder 

# create .env file inside backend folder 
DATABASE_URL = "postgresql://postgres:PWD@localhost:5432/DBNAME" # change your posgresql pwd and database name

SECRET_KEY = "supersecretkey" 

ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = 180

GROQ_API_KEY = Your groq api   # create groq api and paste here



  # Install all libaries 
  pip install fastapi uvicorn sqlalchemy psycopg2-binary python-jose passlib[bcrypt] pydantic python-multipart python-    dotenv
  
# To run backend follow This 

cd backend

python -m uvicorn main:app --reload

open http://127.0.0.1:8000/docs you will see apis 

now open index.html and signup 
 cd frontend
 python -m http.server 5500

 #for running chatbot at ai mode need to run this command
 pip install groq