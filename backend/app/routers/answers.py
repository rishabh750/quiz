from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Answer, Course, User
from ..schemas import AnswerIn, ResetIn

router = APIRouter(tags=["answers"])


def _course(db: Session, user: User, name: str) -> Course:
    course = db.scalar(select(Course).where(Course.user_id == user.id, Course.name == name))
    if course is None:
        raise HTTPException(status_code=404, detail="course not found")
    return course


def _serialize(rows):
    return [
        {
            "questionNumber": str(a.question_number),
            "candidateAnswer": a.candidate_answer,
            "marks": a.marks,
        }
        for a in rows
    ]


def _all(db: Session, course: Course):
    return db.scalars(
        select(Answer).where(Answer.course_id == course.id).order_by(Answer.question_number)
    ).all()


@router.get("/answers/{name}")
def get_answers(name: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = _course(db, user, name)
    return _serialize(_all(db, course))


@router.post("/answers/{name}")
def save_answer(
    name: str,
    body: AnswerIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    course = _course(db, user, name)
    qnum = int(str(body.questionNumber))
    row = db.scalar(
        select(Answer).where(Answer.course_id == course.id, Answer.question_number == qnum)
    )
    if row is None:
        row = Answer(course_id=course.id, question_number=qnum)
        db.add(row)
    row.candidate_answer = str(body.candidateAnswer)
    row.marks = int(body.marks) or 0
    db.commit()
    return _serialize(_all(db, course))


@router.delete("/answers/{name}")
def reset_answers(
    name: str,
    body: ResetIn | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    course = _course(db, user, name)
    q = db.query(Answer).filter(Answer.course_id == course.id)
    if body and body.questionNumbers:
        nums = [int(str(n)) for n in body.questionNumbers]
        q.filter(Answer.question_number.in_(nums)).delete(synchronize_session=False)
    else:
        q.delete(synchronize_session=False)
    db.commit()
    return _serialize(_all(db, course))
