"""The class summary for a week, a month or a quarter (teacher; printable for the head teacher).

Topics: checked answers in boss fights by topic. Lessons: first-try answers on the board by
chapter (the client groups them by course section). Students: answers and accuracy, solved
drills and daily tasks, chapters checked, days with activity, and whether the student lags
behind (accuracy under 60 % on at least five answers, or no activity in the period).
"""

from collections import Counter, defaultdict
from datetime import UTC, date, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import select

from .auth import Session, current_teacher
from .classroom import own_class
from .db import (
    AnalyticsLog,
    ClassLesson,
    LessonAnswer,
    PracticeTask,
    ProgressReward,
    Role,
    StudentProfile,
    User,
)
from .presence import short_name

router = APIRouter(prefix="/api")
Teacher = Annotated[User, Depends(current_teacher)]

ALMATY = timedelta(hours=5)
PERIODS = (7, 30, 90)  # a week, a month, a quarter
LAG_ACCURACY = 0.6
LAG_MIN_ANSWERS = 5


class TopicStat(BaseModel):
    topic: str
    answers: int
    correct: int


class LessonStat(BaseModel):
    comicId: str
    answered: int
    correct: int


class PupilStat(BaseModel):
    id: int
    name: str
    answers: int
    correct: int
    solved: int
    """Drill problems and daily tasks solved."""
    chapters: int
    """Chapters checked by the server (all time)."""
    activeDays: int
    lastActive: datetime | None = None
    lagging: bool


class ClassSummary(BaseModel):
    days: int
    since: datetime
    students: int
    topics: list[TopicStat]
    lessons: list[LessonStat]
    pupils: list[PupilStat]


def aware(moment: datetime) -> datetime:
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


def local_day(moment: datetime) -> date:
    return (aware(moment) + ALMATY).date()


@router.get("/teacher/classes/{class_id}/summary", response_model=ClassSummary)
async def class_summary(
    class_id: int,
    user: Teacher,
    session: Session,
    response: Response,
    days: Annotated[int, Query()] = 7,
):
    response.headers["Cache-Control"] = "no-store"
    if days not in PERIODS:
        raise HTTPException(422, "invalid_period")
    school_class = await own_class(session, user, class_id)
    since = datetime.now(UTC) - timedelta(days=days)
    students = (
        await session.scalars(
            select(User)
            .where(User.class_id == school_class.id, User.role == Role.student)
            .order_by(User.display_name)
        )
    ).all()
    ids = [s.id for s in students]
    answers: Counter[int] = Counter()
    correct: Counter[int] = Counter()
    solved: Counter[int] = Counter()
    active: defaultdict[int, set[date]] = defaultdict(set)
    last: dict[int, datetime] = {}
    topic_answers: Counter[str] = Counter()
    topic_correct: Counter[str] = Counter()

    def seen(student_id: int, moment: datetime) -> None:
        active[student_id].add(local_day(moment))
        if student_id not in last or aware(moment) > last[student_id]:
            last[student_id] = aware(moment)

    lesson_answered: Counter[str] = Counter()
    lesson_correct: Counter[str] = Counter()
    if ids:
        logs = await session.execute(
            select(
                AnalyticsLog.student_id,
                AnalyticsLog.topic,
                AnalyticsLog.status,
                AnalyticsLog.created_at,
            ).where(AnalyticsLog.student_id.in_(ids), AnalyticsLog.created_at >= since)
        )
        for student_id, topic, status, at in logs:
            if status == "invalid":
                continue
            answers[student_id] += 1
            correct[student_id] += status == "correct"
            topic_answers[topic] += 1
            topic_correct[topic] += status == "correct"
            seen(student_id, at)
        lesson_rows = await session.execute(
            select(LessonAnswer, ClassLesson)
            .join(ClassLesson, ClassLesson.id == LessonAnswer.lesson_id)
            .where(LessonAnswer.student_id.in_(ids), LessonAnswer.created_at >= since)
        )
        for answer, lesson in lesson_rows:
            seen(answer.student_id, answer.created_at)
            if answer.attempt != 1:
                continue
            answers[answer.student_id] += 1
            correct[answer.student_id] += answer.correct
            comic = lesson.comic_id
            if answer.step:
                comic = ((lesson.quiz or [{}])[answer.step - 1] or {}).get("comicId")
            if comic:
                lesson_answered[comic] += 1
                lesson_correct[comic] += answer.correct
        tasks = await session.execute(
            select(PracticeTask.student_id, PracticeTask.solved_at).where(
                PracticeTask.student_id.in_(ids),
                PracticeTask.solved_at.is_not(None),
                PracticeTask.solved_at >= since,
            )
        )
        for student_id, at in tasks:
            solved[student_id] += 1
            seen(student_id, at)
        rewards = await session.execute(
            select(ProgressReward.student_id, ProgressReward.created_at).where(
                ProgressReward.student_id.in_(ids), ProgressReward.created_at >= since
            )
        )
        for student_id, at in rewards:
            seen(student_id, at)
    profiles = (
        {
            p.user_id: p
            for p in (
                await session.scalars(select(StudentProfile).where(StudentProfile.user_id.in_(ids)))
            ).all()
        }
        if ids
        else {}
    )

    def lagging(student_id: int) -> bool:
        if not active[student_id]:
            return True
        total = answers[student_id]
        return total >= LAG_MIN_ANSWERS and correct[student_id] / total < LAG_ACCURACY

    return ClassSummary(
        days=days,
        since=since,
        students=len(students),
        topics=[
            TopicStat(topic=t, answers=n, correct=topic_correct[t])
            for t, n in topic_answers.most_common()
        ],
        lessons=[
            LessonStat(comicId=c, answered=n, correct=lesson_correct[c])
            for c, n in lesson_answered.most_common()
        ],
        pupils=[
            PupilStat(
                id=s.id,
                name=short_name(s.display_name),
                answers=answers[s.id],
                correct=correct[s.id],
                solved=solved[s.id],
                chapters=len(
                    ((profiles.get(s.id).season if profiles.get(s.id) else None) or {}).get(
                        "verifiedChapters", []
                    )
                ),
                activeDays=len(active[s.id]),
                lastActive=last.get(s.id),
                lagging=lagging(s.id),
            )
            for s in students
        ],
    )
