"""In-memory data store. POC only — data lives in the process and is lost on
restart. Each Vercel instance has its own copy, so registered accounts are local
to the instance that created them; the seeded default account exists everywhere."""
from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from typing import Dict, List, Optional

PROVIDERS = {"gemini", "anthropic", "openai"}


def normalize_provider(provider: Optional[str]) -> str:
    return provider if provider in PROVIDERS else "gemini"


@dataclass
class Question:
    section: str
    question_number: str          # kept as string to match the API contract
    qtype: str                    # "mcq" | "qa"
    question: str
    options: Optional[List[str]] = None   # 4 entries for mcq
    correct_option: Optional[int] = None
    answer: Optional[str] = None


@dataclass
class Answer:
    question_number: str
    candidate_answer: str
    marks: int = 0


@dataclass
class Course:
    name: str
    notes: str = ""
    archived: bool = False
    questions: List[Question] = field(default_factory=list)
    answers: Dict[str, Answer] = field(default_factory=dict)   # keyed by question_number


@dataclass
class User:
    id: str
    email: str
    password_hash: str
    provider: str = "gemini"
    api_key: Optional[str] = None
    courses: Dict[str, Course] = field(default_factory=dict)   # keyed by course name


class Store:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._by_id: Dict[str, User] = {}
        self._by_email: Dict[str, User] = {}

    def get_by_email(self, email: str) -> Optional[User]:
        with self._lock:
            return self._by_email.get(email)

    def get_by_id(self, user_id: Optional[str]) -> Optional[User]:
        if not user_id:
            return None
        with self._lock:
            return self._by_id.get(user_id)

    def exists_email(self, email: str) -> bool:
        with self._lock:
            return email in self._by_email

    def create_user(self, email: str, password_hash: str, provider: str,
                    api_key: Optional[str]) -> User:
        with self._lock:
            user = User(
                id=str(uuid.uuid4()),
                email=email,
                password_hash=password_hash,
                provider=normalize_provider(provider),
                api_key=api_key or None,
            )
            self._by_id[user.id] = user
            self._by_email[user.email] = user
            return user


store = Store()
