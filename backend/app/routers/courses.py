import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Answer, Course, Question, User
from ..quiz_format import parse_questions
from ..schemas import NotesOut, QuestionOut, UploadIn

router = APIRouter(tags=["courses"])


def _get_course(db: Session, user: User, name: str, archived=None):
    stmt = select(Course).where(Course.user_id == user.id, Course.name == name)
    if archived is not None:
        stmt = stmt.where(Course.is_archived == archived)
    return db.scalar(stmt)


def _names(db: Session, user: User, archived: bool):
    rows = db.scalars(
        select(Course.name).where(Course.user_id == user.id, Course.is_archived == archived)
    ).all()
    return sorted(rows)


@router.get("/courses")
def list_courses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _names(db, user, False)


@router.get("/archive")
def list_archive(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _names(db, user, True)


@router.post("/courses")
def upload(
    body: UploadIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    base = re.split(r"[\\/]", body.filename)[-1]
    if not re.search(r"\.(txt|md)$", base, re.IGNORECASE):
        raise HTTPException(status_code=400, detail="only .txt and .md files are allowed")
    name = re.sub(r"\.(txt|md)$", "", base, flags=re.IGNORECASE)
    is_md = bool(re.search(r"\.md$", base, re.IGNORECASE))

    course = _get_course(db, user, name)
    if course is None:
        course = Course(user_id=user.id, name=name, is_archived=False)
        db.add(course)
        db.flush()

    if is_md:
        course.notes = body.content or ""
    else:
        course.questions.clear()
        db.flush()
        for q in parse_questions(body.content or ""):
            opts = q.get("options") or [None, None, None, None]
            course.questions.append(
                Question(
                    section=q["section"],
                    question_number=q["question_number"],
                    qtype=q["qtype"],
                    question=q["question"],
                    option1=opts[0],
                    option2=opts[1],
                    option3=opts[2],
                    option4=opts[3],
                    correct_option=q.get("correct_option"),
                    answer=q.get("answer"),
                )
            )
    course.is_archived = False
    db.commit()
    return {"saved": base}


@router.get("/courses/{name}/questions", response_model=list[QuestionOut])
def get_questions(name: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = _get_course(db, user, name)
    if course is None:
        return []
    out = []
    for q in course.questions:
        item = {
            "section": q.section,
            "questionNumber": str(q.question_number),
            "question": q.question,
            "type": q.qtype,
        }
        if q.qtype == "qa":
            item["answer"] = q.answer
        else:
            item["options"] = [q.option1, q.option2, q.option3, q.option4]
            item["correctOption"] = q.correct_option
        out.append(item)
    return out


@router.get("/courses/{name}/notes", response_model=NotesOut)
def get_notes(name: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = _get_course(db, user, name)
    content = course.notes if course and course.notes else ""
    return NotesOut(exists=bool(content), content=content or "")


@router.post("/archive/{name}")
def archive(name: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = _get_course(db, user, name, archived=False)
    if course:
        db.query(Answer).filter(Answer.course_id == course.id).delete()
        course.is_archived = True
        db.commit()
    return {"archived": name, "archive": _names(db, user, True)}


@router.post("/archive/{name}/revive")
def revive(name: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = _get_course(db, user, name, archived=True)
    if course:
        course.is_archived = False
        db.commit()
    return {"revived": name, "archive": _names(db, user, True)}


@router.delete("/archive/{name}")
def purge(name: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = _get_course(db, user, name, archived=True)
    if course:
        db.query(Answer).filter(Answer.course_id == course.id).delete()
        db.delete(course)
        db.commit()
    return {"purged": name, "archive": _names(db, user, True)}
