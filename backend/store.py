"""Data store. Backed by MongoDB when MONGODB_URI is set (shared across all
serverless instances — the account and its courses live in the DB, not in process
memory), otherwise an in-memory store for local dev/tests.

A user is one document that embeds their courses/questions/answers, since all data
is user-scoped and small. Routers mutate the User object then call `store.save(user)`
to persist it."""
from __future__ import annotations

import threading
import uuid
from dataclasses import asdict, dataclass, field
from typing import Dict, List, Optional

from config import settings

PROVIDERS = {"gemini", "anthropic", "openai"}

# Derive user IDs deterministically from email so the same account maps to the same
# id everywhere (stable JWT subjects). With MongoDB the record is shared, so any
# instance resolves the id; with the in-memory fallback it is per process.
_USER_NAMESPACE = uuid.UUID("6a5f6c1e-2b3d-4e5f-8a9b-0c1d2e3f4a5b")


def user_id_for(email: str) -> str:
    return str(uuid.uuid5(_USER_NAMESPACE, email))


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


def _new_user(email: str, password_hash: str, provider: str, api_key: Optional[str]) -> User:
    return User(
        id=user_id_for(email),
        email=email,
        password_hash=password_hash,
        provider=normalize_provider(provider),
        api_key=api_key or None,
    )


# --- serialization (User <-> Mongo document) -------------------------------

def _user_to_doc(user: User) -> dict:
    doc = asdict(user)
    doc["_id"] = doc.pop("id")
    return doc


def _user_from_doc(doc: dict) -> User:
    courses: Dict[str, Course] = {}
    for name, c in (doc.get("courses") or {}).items():
        questions = [Question(**q) for q in (c.get("questions") or [])]
        answers = {k: Answer(**a) for k, a in (c.get("answers") or {}).items()}
        courses[name] = Course(
            name=c.get("name", name),
            notes=c.get("notes", ""),
            archived=c.get("archived", False),
            questions=questions,
            answers=answers,
        )
    return User(
        id=doc["_id"],
        email=doc["email"],
        password_hash=doc["password_hash"],
        provider=doc.get("provider", "gemini"),
        api_key=doc.get("api_key"),
        courses=courses,
    )


# --- stores ----------------------------------------------------------------

class InMemoryStore:
    """Local dev / tests. Not shared across processes (data lost on restart)."""

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
            user = _new_user(email, password_hash, provider, api_key)
            self._by_id[user.id] = user
            self._by_email[user.email] = user
            return user

    def save(self, user: User) -> None:
        with self._lock:  # object is stored by reference; keep indexes consistent
            self._by_id[user.id] = user
            self._by_email[user.email] = user


class MongoStore:
    """Shared store backed by MongoDB — one document per user (courses embedded)."""

    def __init__(self, uri: str) -> None:
        from pymongo import MongoClient  # lazy: only needed when a URI is configured

        self._client = MongoClient(uri, serverSelectionTimeoutMS=8000, tz_aware=False)
        self._users = self._client.get_database("interviewprep").get_collection("users")

    def get_by_email(self, email: str) -> Optional[User]:
        doc = self._users.find_one({"email": email})
        return _user_from_doc(doc) if doc else None

    def get_by_id(self, user_id: Optional[str]) -> Optional[User]:
        if not user_id:
            return None
        doc = self._users.find_one({"_id": user_id})
        return _user_from_doc(doc) if doc else None

    def exists_email(self, email: str) -> bool:
        return self._users.count_documents({"email": email}, limit=1) > 0

    def create_user(self, email: str, password_hash: str, provider: str,
                    api_key: Optional[str]) -> User:
        user = _new_user(email, password_hash, provider, api_key)
        self._users.insert_one(_user_to_doc(user))
        return user

    def save(self, user: User) -> None:
        self._users.replace_one({"_id": user.id}, _user_to_doc(user), upsert=True)


store = MongoStore(settings.mongodb_uri) if settings.mongodb_uri else InMemoryStore()
