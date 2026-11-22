"""SQLite queue, atomic publication, and private exercise answers."""

import json
import sqlite3
import time
from collections.abc import Sequence
from contextlib import contextmanager
from pathlib import Path
from uuid import uuid4

from .library_episode import LibraryProblem
from .problems import choose_problem
from .schemas import ContinuationRequest, ErrorCode, JobProgress, JobRequest, JobStatus


class Store:
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        data_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = data_dir / "comics.sqlite3"
        self.images_dir = data_dir / "images"
        self.images_dir.mkdir(exist_ok=True)
        with self.connection() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.executescript("""
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    request TEXT NOT NULL,
                    problem TEXT NOT NULL,
                    status TEXT NOT NULL CHECK(status IN ('queued','running','ready','failed')),
                    comic_id TEXT,
                    error_code TEXT,
                    owner TEXT,
                    lease_expires REAL,
                    created_at REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS jobs_queue ON jobs(status, created_at);
                CREATE TABLE IF NOT EXISTS job_progress (
                    job_id TEXT PRIMARY KEY REFERENCES jobs(id),
                    stage TEXT NOT NULL CHECK(stage IN (
                        'queued', 'storyboard', 'drawing', 'preparing', 'ready'
                    )),
                    completed_panels INTEGER NOT NULL DEFAULT 0,
                    total_panels INTEGER
                );
                CREATE TABLE IF NOT EXISTS live_storyboards (
                    job_id TEXT PRIMARY KEY REFERENCES jobs(id),
                    comic_id TEXT NOT NULL UNIQUE,
                    storyboard TEXT NOT NULL,
                    resume_token TEXT
                );
                CREATE TABLE IF NOT EXISTS boss_rounds (
                    exercise_id TEXT PRIMARY KEY,
                    comic_id TEXT NOT NULL,
                    expected TEXT NOT NULL,
                    hints TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS comics (
                    id TEXT PRIMARY KEY,
                    payload TEXT NOT NULL,
                    exercise_id TEXT UNIQUE NOT NULL,
                    expected TEXT NOT NULL,
                    hints TEXT NOT NULL
                );
            """)
            # Added after the first release: the skill label for teacher analytics.
            for table in ("comics", "boss_rounds"):
                columns = {row["name"] for row in db.execute(f"PRAGMA table_info({table})")}
                if "skill" not in columns:
                    db.execute(f"ALTER TABLE {table} ADD COLUMN skill TEXT")

    @contextmanager
    def connection(self):
        db = sqlite3.connect(self.db_path, timeout=10)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def enqueue(self, request: JobRequest | ContinuationRequest) -> str:
        job_id = str(uuid4())
        problem = (
            LibraryProblem.choose()
            if isinstance(request, ContinuationRequest)
            else choose_problem(request)
        )
        with self.connection() as db:
            db.execute(
                "INSERT INTO jobs(id,request,problem,status,created_at) VALUES(?,?,?,'queued',?)",
                (job_id, request.model_dump_json(), json.dumps(problem.to_dict()), time.time()),
            )
            db.execute("INSERT INTO job_progress(job_id,stage) VALUES(?,'queued')", (job_id,))
        return job_id

    def job(self, job_id: str) -> JobStatus | None:
        with self.connection() as db:
            row = db.execute(
                "SELECT jobs.*,stage,completed_panels,total_panels,"
                "resume_token FROM jobs "
                "LEFT JOIN job_progress ON job_progress.job_id=jobs.id "
                "LEFT JOIN live_storyboards ON live_storyboards.job_id=jobs.id WHERE jobs.id=?",
                (job_id,),
            ).fetchone()
        if row is None:
            return None
        result = JobStatus(
            jobId=row["id"],
            status=row["status"],
            comicId=row["comic_id"],
            errorCode=row["error_code"],
        )
        if row["stage"] is not None:
            progress = JobProgress(stage=row["stage"])
            if row["total_panels"] is not None:
                progress.completedPanels = row["completed_panels"]
                progress.totalPanels = row["total_panels"]
            result.progress = progress
        if (
            row["status"] == "failed"
            and row["error_code"] == "image_generation_failed"
            and row["resume_token"]
            and row["completed_panels"] > 0
        ):
            result.resumeToken = row["resume_token"]
        return result

    def resume(self, job_id: str, token: str) -> bool:
        # A token identifies one failed attempt. A delayed duplicate cannot resume a later failure.
        with self.connection() as db:
            updated = db.execute(
                "UPDATE jobs SET status='queued',error_code=NULL,owner=NULL,lease_expires=NULL "
                "WHERE id=? AND status='failed' AND error_code='image_generation_failed' "
                "AND EXISTS (SELECT 1 FROM live_storyboards "
                "WHERE job_id=jobs.id AND resume_token=?) "
                "AND EXISTS (SELECT 1 FROM job_progress WHERE job_id=jobs.id "
                "AND stage='drawing' AND completed_panels>0)",
                (job_id, token),
            )
            if updated.rowcount == 1:
                return True
            pending = db.execute(
                "SELECT 1 FROM jobs JOIN live_storyboards ON job_id=jobs.id "
                "WHERE jobs.id=? AND resume_token=? AND status IN ('queued','running')",
                (job_id, token),
            ).fetchone()
            return pending is not None

    def claim(self, lease_seconds: float) -> dict | None:
        with self.connection() as db:
            # Serializes claimers, including workers in other processes.
            db.execute("BEGIN IMMEDIATE")
            db.execute(
                "UPDATE jobs SET status='failed',error_code='worker_interrupted',owner=NULL "
                "WHERE status='running' AND lease_expires < ?",
                (time.time(),),
            )
            row = db.execute(
                "SELECT jobs.*,live_storyboards.comic_id AS artwork_id,storyboard FROM jobs "
                "LEFT JOIN live_storyboards ON live_storyboards.job_id=jobs.id "
                "WHERE status='queued' ORDER BY created_at,id LIMIT 1"
            ).fetchone()
            if row is None:
                return None
            owner = str(uuid4())
            db.execute(
                "UPDATE jobs SET status='running',owner=?,lease_expires=? WHERE id=?",
                (owner, time.time() + lease_seconds, row["id"]),
            )
            if row["storyboard"] is None:
                db.execute(
                    "INSERT INTO job_progress(job_id,stage) VALUES(?,'storyboard') "
                    "ON CONFLICT(job_id) DO UPDATE SET stage='storyboard'",
                    (row["id"],),
                )
            return dict(row) | {"owner": owner}

    def begin_panels(
        self, claim: dict, total: int, *, live_storyboard: tuple[str, str] | None = None
    ):
        if total < 1:
            raise ValueError("A storyboard must contain at least one panel")
        with self.connection() as db:
            updated = db.execute(
                "UPDATE job_progress SET stage=?,total_panels=? "
                "WHERE job_id=? AND stage='storyboard' AND EXISTS ("
                "SELECT 1 FROM jobs WHERE id=job_progress.job_id "
                "AND status='running' AND owner=? AND lease_expires>=?)",
                (
                    "drawing" if live_storyboard is not None else "preparing",
                    total,
                    claim["id"],
                    claim["owner"],
                    time.time(),
                ),
            )
            if updated.rowcount != 1:
                raise RuntimeError("Worker no longer owns this storyboard")
            if live_storyboard is not None:
                db.execute(
                    "INSERT INTO live_storyboards(job_id,comic_id,storyboard) VALUES(?,?,?)",
                    (claim["id"], *live_storyboard),
                )

    def panel_saved(self, claim: dict, panel_id: int):
        # Validated panels are saved in order. Re-recording a panel is a no-op.
        with self.connection() as db:
            db.execute(
                "UPDATE job_progress SET completed_panels=? "
                "WHERE job_id=? AND stage='drawing' AND completed_panels=? AND total_panels>=? "
                "AND EXISTS (SELECT 1 FROM jobs WHERE id=job_progress.job_id "
                "AND status='running' AND owner=? AND lease_expires>=?)",
                (panel_id, claim["id"], panel_id - 1, panel_id, claim["owner"], time.time()),
            )

    def fail(self, claim: dict, code: ErrorCode):
        with self.connection() as db:
            updated = db.execute(
                "UPDATE jobs SET status='failed',error_code=?,owner=NULL,lease_expires=NULL "
                "WHERE id=? AND status='running' AND owner=?",
                (code, claim["id"], claim["owner"]),
            )
            if updated.rowcount == 1 and code == "image_generation_failed":
                db.execute(
                    "UPDATE live_storyboards SET resume_token=? WHERE job_id=?",
                    (claim["owner"], claim["id"]),
                )

    def publish(
        self,
        claim: dict,
        comic_id: str,
        payload: dict,
        exercise_id: str,
        expected: str,
        hints: dict,
        rounds: Sequence[tuple[str, str, dict]] = (),
        skill: str | None = None,
        round_skills: Sequence[str | None] = (),
    ):
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            updated = db.execute(
                "UPDATE jobs SET status='ready',comic_id=?,owner=NULL,lease_expires=NULL "
                "WHERE id=? AND status='running' AND owner=? AND lease_expires>=?",
                (comic_id, claim["id"], claim["owner"], time.time()),
            )
            if updated.rowcount != 1:
                raise RuntimeError("Worker no longer owns this job")
            db.execute(
                "INSERT INTO comics(id,payload,exercise_id,expected,hints,skill) "
                "VALUES(?,?,?,?,?,?)",
                (
                    comic_id,
                    json.dumps(payload, ensure_ascii=False),
                    exercise_id,
                    expected,
                    json.dumps(hints, ensure_ascii=False),
                    skill,
                ),
            )
            db.executemany(
                "INSERT INTO boss_rounds(exercise_id,comic_id,expected,hints,skill) "
                "VALUES(?,?,?,?,?)",
                [
                    (
                        round_id,
                        comic_id,
                        value,
                        json.dumps(round_hints, ensure_ascii=False),
                        round_skill,
                    )
                    for (round_id, value, round_hints), round_skill in zip(
                        rounds, list(round_skills) or [None] * len(rounds), strict=True
                    )
                ],
            )
            progress = db.execute(
                "UPDATE job_progress SET stage='ready',completed_panels=total_panels "
                "WHERE job_id=? AND (stage='preparing' OR "
                "(stage='drawing' AND completed_panels=total_panels))",
                (claim["id"],),
            )
            if progress.rowcount != 1:
                raise RuntimeError("Comic panels are incomplete")
            db.execute("DELETE FROM live_storyboards WHERE job_id=?", (claim["id"],))

    def comic(self, comic_id: str) -> dict | None:
        with self.connection() as db:
            row = db.execute("SELECT payload FROM comics WHERE id=?", (comic_id,)).fetchone()
        return json.loads(row["payload"]) if row else None

    def exercise(self, exercise_id: str) -> dict | None:
        with self.connection() as db:
            row = db.execute(
                "SELECT expected,hints,skill FROM comics WHERE exercise_id=? UNION ALL "
                "SELECT expected,hints,skill FROM boss_rounds WHERE exercise_id=?",
                (exercise_id, exercise_id),
            ).fetchone()
        if row is None:
            return None
        return {
            "expected": row["expected"],
            "hints": json.loads(row["hints"]),
            "skill": row["skill"],
        }

    def comic_exercises(self, comic_id: str) -> list[str]:
        """The comic's exercise followed by its boss rounds, in fight order."""
        with self.connection() as db:
            main = db.execute("SELECT exercise_id FROM comics WHERE id=?", (comic_id,)).fetchone()
            rounds = db.execute(
                "SELECT exercise_id FROM boss_rounds WHERE comic_id=? ORDER BY exercise_id",
                (comic_id,),
            ).fetchall()
        if main is None:
            return []
        return [main["exercise_id"], *(row["exercise_id"] for row in rounds)]
