import re
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from quiz import parse_questions
from security import current_user
from store import Course, User

router = APIRouter(prefix="/api")

_EXT = re.compile(r"\.(txt|md)$", re.IGNORECASE)


class UploadIn(BaseModel):
    filename: str = ""
    content: str = ""


def _names(user: User, archived: bool) -> List[str]:
    return sorted(c.name for c in user.courses.values() if c.archived == archived)


@router.get("/courses")
def list_courses(user: User = Depends(current_user)):
    return _names(user, False)


@router.get("/archive")
def list_archive(user: User = Depends(current_user)):
    return _names(user, True)


@router.post("/courses")
def upload(body: UploadIn, user: User = Depends(current_user)):
    base = re.split(r"[\\/]", body.filename or "")[-1]
    if not _EXT.search(base):
        raise HTTPException(status_code=400, detail="only .txt and .md files are allowed")
    name = _EXT.sub("", base)
    is_md = base.lower().endswith(".md")

    course = user.courses.get(name)
    if course is None:
        course = Course(name=name)
        user.courses[name] = course

    if is_md:
        course.notes = body.content or ""
    else:
        course.questions = parse_questions(body.content or "")
    course.archived = False
    return {"saved": base}


@router.get("/courses/{name}/questions")
def questions(name: str, user: User = Depends(current_user)):
    course = user.courses.get(name)
    if course is None:
        return []
    out = []
    for q in course.questions:
        if q.qtype == "qa":
            out.append({"section": q.section, "questionNumber": q.question_number,
                        "question": q.question, "type": "qa", "answer": q.answer})
        else:
            out.append({"section": q.section, "questionNumber": q.question_number,
                        "question": q.question, "type": "mcq",
                        "options": q.options or [], "correctOption": q.correct_option})
    return out


@router.get("/courses/{name}/notes")
def notes(name: str, user: User = Depends(current_user)):
    course = user.courses.get(name)
    content = course.notes if course and course.notes else ""
    return {"exists": bool(content), "content": content}


@router.post("/archive/{name}")
def archive(name: str, user: User = Depends(current_user)):
    course = user.courses.get(name)
    if course is not None and not course.archived:
        course.answers.clear()
        course.archived = True
    return {"archived": name, "archive": _names(user, True)}


@router.post("/archive/{name}/revive")
def revive(name: str, user: User = Depends(current_user)):
    course = user.courses.get(name)
    if course is not None and course.archived:
        course.archived = False
    return {"revived": name, "archive": _names(user, True)}


@router.delete("/archive/{name}")
def purge(name: str, user: User = Depends(current_user)):
    course = user.courses.get(name)
    if course is not None and course.archived:
        user.courses.pop(name, None)
    return {"purged": name, "archive": _names(user, True)}
