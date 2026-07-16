import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .crypto import EncryptedText
from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False, default="gemini")
    api_key: Mapped[str | None] = mapped_column(EncryptedText, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    courses: Mapped[list["Course"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Course(Base):
    __tablename__ = "courses"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_course_user_name"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[str | None] = mapped_column(EncryptedText, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="courses")
    questions: Mapped[list["Question"]] = relationship(
        back_populates="course", cascade="all, delete-orphan", order_by="Question.question_number"
    )
    answers: Mapped[list["Answer"]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
    )


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = (
        UniqueConstraint("course_id", "question_number", name="uq_question_course_num"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), index=True, nullable=False
    )
    section: Mapped[str] = mapped_column(String(255), nullable=False, default="main")
    question_number: Mapped[int] = mapped_column(Integer, nullable=False)
    qtype: Mapped[str] = mapped_column(String(8), nullable=False, default="mcq")
    question: Mapped[str] = mapped_column(EncryptedText, nullable=False)
    option1: Mapped[str | None] = mapped_column(EncryptedText, nullable=True)
    option2: Mapped[str | None] = mapped_column(EncryptedText, nullable=True)
    option3: Mapped[str | None] = mapped_column(EncryptedText, nullable=True)
    option4: Mapped[str | None] = mapped_column(EncryptedText, nullable=True)
    correct_option: Mapped[int | None] = mapped_column(Integer, nullable=True)
    answer: Mapped[str | None] = mapped_column(EncryptedText, nullable=True)

    course: Mapped["Course"] = relationship(back_populates="questions")


class Answer(Base):
    __tablename__ = "answers"
    __table_args__ = (
        UniqueConstraint("course_id", "question_number", name="uq_answer_course_num"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), index=True, nullable=False
    )
    question_number: Mapped[int] = mapped_column(Integer, nullable=False)
    candidate_answer: Mapped[str] = mapped_column(String(64), nullable=False)
    marks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    course: Mapped["Course"] = relationship(back_populates="answers")
