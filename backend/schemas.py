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
