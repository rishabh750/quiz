from pydantic import BaseModel, EmailStr, Field

PROVIDERS = {"gemini", "anthropic", "openai"}


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    provider: str = "gemini"
    api_key: str | None = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MeOut(BaseModel):
    email: EmailStr
    provider: str
    has_api_key: bool


class AccountUpdateIn(BaseModel):
    provider: str | None = None
    api_key: str | None = None


class UploadIn(BaseModel):
    filename: str
    content: str


class QuestionOut(BaseModel):
    section: str
    questionNumber: str
    question: str
    type: str
    options: list[str] | None = None
    correctOption: int | None = None
    answer: str | None = None


class NotesOut(BaseModel):
    exists: bool
    content: str


class AnswerIn(BaseModel):
    questionNumber: str | int
    candidateAnswer: str | int
    marks: int = 0


class AnswerOut(BaseModel):
    questionNumber: str
    candidateAnswer: str
    marks: int


class ResetIn(BaseModel):
    questionNumbers: list[str] | None = None


class GenerateIn(BaseModel):
    prompt: str
    provider: str | None = None
