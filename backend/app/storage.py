"""SQLite queue, atomic publication, and private exercise answers."""

import json
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from uuid import uuid4

from .library_episode import LibraryProblem
from .problems import choose_problem
from .schemas import ContinuationRequest, ErrorCode, JobRequest, JobStatus


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
                CREATE TABLE IF NOT EXISTS comics (
                    id TEXT PRIMARY KEY,
                    payload TEXT NOT NULL,
                    exercise_id TEXT UNIQUE NOT NULL,
                    expected TEXT NOT NULL,
                    hints TEXT NOT NULL
                );
            """)

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
        return job_id

    def job(self, job_id: str) -> JobStatus | None:
        with self.connection() as db:
            row = db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
        if row is None:
            return None
        return JobStatus(
            jobId=row["id"],
            status=row["status"],
            comicId=row["comic_id"],
            errorCode=row["error_code"],
        )

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
                "SELECT * FROM jobs WHERE status='queued' ORDER BY created_at,id LIMIT 1"
            ).fetchone()
            if row is None:
                return None
            owner = str(uuid4())
            db.execute(
                "UPDATE jobs SET status='running',owner=?,lease_expires=? WHERE id=?",
                (owner, time.time() + lease_seconds, row["id"]),
            )
            return dict(row) | {"owner": owner}

    def fail(self, claim: dict, code: ErrorCode):
        with self.connection() as db:
            db.execute(
                "UPDATE jobs SET status='failed',error_code=?,owner=NULL,lease_expires=NULL "
                "WHERE id=? AND status='running' AND owner=?",
                (code, claim["id"], claim["owner"]),
            )

    def publish(
        self,
        claim: dict,
        comic_id: str,
        payload: dict,
        exercise_id: str,
        expected: str,
        hints: dict,
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
                "INSERT INTO comics(id,payload,exercise_id,expected,hints) VALUES(?,?,?,?,?)",
                (
                    comic_id,
                    json.dumps(payload, ensure_ascii=False),
                    exercise_id,
                    expected,
                    json.dumps(hints, ensure_ascii=False),
                ),
            )

    def comic(self, comic_id: str) -> dict | None:
        with self.connection() as db:
            row = db.execute("SELECT payload FROM comics WHERE id=?", (comic_id,)).fetchone()
        return json.loads(row["payload"]) if row else None

    def exercise(self, exercise_id: str) -> dict | None:
        with self.connection() as db:
            row = db.execute(
                "SELECT expected,hints FROM comics WHERE exercise_id=?", (exercise_id,)
            ).fetchone()
        return {"expected": row["expected"], "hints": json.loads(row["hints"])} if row else None
