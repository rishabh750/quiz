from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from security import current_user
from store import Answer, Course, User, store

router = APIRouter(prefix="/api")


class AnswerIn(BaseModel):
    questionNumber: Any
    candidateAnswer: Any
    marks: Optional[int] = 0


class ResetIn(BaseModel):
    questionNumbers: Optional[List[Any]] = None


def _course(user: User, name: str) -> Course:
    course = user.courses.get(name)
    if course is None:
        raise HTTPException(status_code=404, detail="course not found")
    return course


def _serialize(course: Course) -> List[dict]:
    rows = sorted(course.answers.values(), key=lambda a: int(a.question_number))
    return [{"questionNumber": a.question_number,
             "candidateAnswer": a.candidate_answer, "marks": a.marks} for a in rows]


@router.get("/answers/{name}")
def get_answers(name: str, user: User = Depends(current_user)):
    return _serialize(_course(user, name))


@router.post("/answers/{name}")
def save_answer(name: str, body: AnswerIn, user: User = Depends(current_user)):
    course = _course(user, name)
    qnum = str(int(str(body.questionNumber).strip()))
    course.answers[qnum] = Answer(
        question_number=qnum,
        candidate_answer=str(body.candidateAnswer),
        marks=body.marks or 0,
    )
    store.save(user)
    return _serialize(course)


@router.delete("/answers/{name}")
def reset_answers(name: str, user: User = Depends(current_user),
                  body: Optional[ResetIn] = None):
    course = _course(user, name)
    if body and body.questionNumbers:
        drop = {str(int(str(n).strip())) for n in body.questionNumbers}
        for qnum in drop:
            course.answers.pop(qnum, None)
    else:
        course.answers.clear()
    store.save(user)
    return _serialize(course)
