from datetime import datetime, timezone
from pathlib import Path
import hashlib
import secrets
import sqlite3

from fastapi import Depends, FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "school.db"

app = FastAPI(title="School Journal Pro API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, digest_hex = stored.split("$", 1)
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), 120_000)
        return secrets.compare_digest(digest.hex(), digest_hex)
    except ValueError:
        return False


def init_db():
    conn = db()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            role TEXT NOT NULL CHECK(role IN ('teacher','student','parent')),
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            student_id TEXT
        );
        CREATE TABLE IF NOT EXISTS students (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            class_name TEXT NOT NULL DEFAULT '10-А'
        );
        CREATE TABLE IF NOT EXISTS subjects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS grades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL,
            subject_id TEXT NOT NULL,
            value INTEGER NOT NULL CHECK(value BETWEEN 1 AND 10),
            comment TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
            FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            created_at TEXT NOT NULL,
            author_id TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            expires_at TEXT NOT NULL
        );
        """
    )
    if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
        conn.execute("INSERT INTO students VALUES (?, ?, ?)", ("s1", "Ученик Demo", "10-А"))
        conn.execute("INSERT INTO subjects VALUES (?, ?)", ("math", "Математика"))
        conn.execute("INSERT INTO subjects VALUES (?, ?)", ("eng", "Английский"))
        conn.execute("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)", ("t1", "teacher", "Учитель Demo", "teacher@demo.local", hash_password("1234"), None))
        conn.execute("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)", ("s1", "student", "Ученик Demo", "student@demo.local", hash_password("1234"), "s1"))
        conn.execute("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)", ("p1", "parent", "Родитель Demo", "parent@demo.local", hash_password("1234"), "s1"))
        now = datetime.now(timezone.utc).isoformat()
        conn.execute("INSERT INTO grades(student_id, subject_id, value, comment, created_at) VALUES (?, ?, ?, ?, ?)", ("s1", "math", 9, "", now))
        conn.execute("INSERT INTO grades(student_id, subject_id, value, comment, created_at) VALUES (?, ?, ?, ?, ?)", ("s1", "eng", 8, "", now))
    conn.commit()
    conn.close()


init_db()


class LoginIn(BaseModel):
    email: str
    password: str


class StudentIn(BaseModel):
    name: str = Field(min_length=1)
    class_name: str = "10-А"


class SubjectIn(BaseModel):
    name: str = Field(min_length=1)


class GradeIn(BaseModel):
    student_id: str
    subject_id: str
    value: int = Field(ge=1, le=10)
    comment: str = ""


class NoticeIn(BaseModel):
    text: str = Field(min_length=1)


def current_user(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Требуется авторизация")
    token = authorization[7:].strip()
    conn = db()
    row = conn.execute(
        "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?",
        (token,),
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(401, "Сессия недействительна")
    return dict(row)


def require_teacher(user=Depends(current_user)):
    if user["role"] != "teacher":
        raise HTTPException(403, "Доступ только для учителя")
    return user


@app.get("/")
def root():
    return {"name": "School Journal Pro API", "status": "ok", "docs": "/docs"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/auth/login")
def login(payload: LoginIn):
    conn = db()
    user = conn.execute("SELECT * FROM users WHERE lower(email)=lower(?)", (payload.email.strip(),)).fetchone()
    if not user or not verify_password(payload.password, user["password_hash"]):
        conn.close()
        raise HTTPException(401, "Неверный email или пароль")
    token = secrets.token_urlsafe(32)
    conn.execute("INSERT INTO sessions VALUES (?, ?, ?)", (token, user["id"], datetime.now(timezone.utc).isoformat()))
    conn.commit()
    conn.close()
    return {"token": token, "user": {"id": user["id"], "role": user["role"], "name": user["name"], "email": user["email"], "student_id": user["student_id"]}}


@app.post("/api/auth/logout")
def logout(authorization: str | None = Header(default=None)):
    if authorization and authorization.startswith("Bearer "):
        conn = db()
        conn.execute("DELETE FROM sessions WHERE token=?", (authorization[7:].strip(),))
        conn.commit()
        conn.close()
    return {"ok": True}


@app.get("/api/me")
def me(user=Depends(current_user)):
    return {"id": user["id"], "role": user["role"], "name": user["name"], "email": user["email"], "student_id": user["student_id"]}


@app.get("/api/dashboard")
def dashboard(user=Depends(current_user)):
    conn = db()
    students = [dict(x) for x in conn.execute("SELECT id,name,class_name FROM students ORDER BY name").fetchall()]
    subjects = [dict(x) for x in conn.execute("SELECT id,name FROM subjects ORDER BY name").fetchall()]
    if user["role"] == "teacher":
        grades = [dict(x) for x in conn.execute("SELECT id,student_id,subject_id,value,comment,created_at FROM grades ORDER BY id DESC").fetchall()]
    else:
        sid = user["student_id"] or user["id"]
        grades = [dict(x) for x in conn.execute("SELECT id,student_id,subject_id,value,comment,created_at FROM grades WHERE student_id=? ORDER BY id DESC", (sid,)).fetchall()]
        students = [s for s in students if s["id"] == sid]
    notifications = [dict(x) for x in conn.execute("SELECT id,text,created_at FROM notifications ORDER BY id DESC LIMIT 50").fetchall()]
    conn.close()
    return {"user": {"id": user["id"], "role": user["role"], "name": user["name"], "email": user["email"], "student_id": user["student_id"]}, "students": students, "subjects": subjects, "grades": grades, "notifications": notifications}


@app.post("/api/students")
def create_student(payload: StudentIn, user=Depends(require_teacher)):
    sid = "s_" + secrets.token_hex(6)
    conn = db()
    conn.execute("INSERT INTO students(id,name,class_name) VALUES(?,?,?)", (sid, payload.name.strip(), payload.class_name.strip() or "10-А"))
    conn.commit(); conn.close()
    return {"id": sid, "name": payload.name.strip(), "class_name": payload.class_name.strip() or "10-А"}


@app.delete("/api/students/{student_id}")
def delete_student(student_id: str, user=Depends(require_teacher)):
    conn = db(); cur = conn.execute("DELETE FROM students WHERE id=?", (student_id,)); conn.commit(); conn.close()
    if cur.rowcount == 0: raise HTTPException(404, "Ученик не найден")
    return {"ok": True}


@app.post("/api/subjects")
def create_subject(payload: SubjectIn, user=Depends(require_teacher)):
    sid = "sub_" + secrets.token_hex(6)
    conn = db(); conn.execute("INSERT INTO subjects(id,name) VALUES(?,?)", (sid, payload.name.strip())); conn.commit(); conn.close()
    return {"id": sid, "name": payload.name.strip()}


@app.delete("/api/subjects/{subject_id}")
def delete_subject(subject_id: str, user=Depends(require_teacher)):
    conn = db(); cur = conn.execute("DELETE FROM subjects WHERE id=?", (subject_id,)); conn.commit(); conn.close()
    if cur.rowcount == 0: raise HTTPException(404, "Предмет не найден")
    return {"ok": True}


@app.post("/api/grades")
def create_grade(payload: GradeIn, user=Depends(require_teacher)):
    conn = db()
    if not conn.execute("SELECT 1 FROM students WHERE id=?", (payload.student_id,)).fetchone():
        conn.close(); raise HTTPException(404, "Ученик не найден")
    if not conn.execute("SELECT 1 FROM subjects WHERE id=?", (payload.subject_id,)).fetchone():
        conn.close(); raise HTTPException(404, "Предмет не найден")
    now = datetime.now(timezone.utc).isoformat()
    cur = conn.execute("INSERT INTO grades(student_id,subject_id,value,comment,created_at) VALUES(?,?,?,?,?)", (payload.student_id,payload.subject_id,payload.value,payload.comment,now))
    conn.commit(); gid = cur.lastrowid; conn.close()
    return {"id": gid, "student_id": payload.student_id, "subject_id": payload.subject_id, "value": payload.value, "comment": payload.comment, "created_at": now}


@app.delete("/api/grades/{grade_id}")
def delete_grade(grade_id: int, user=Depends(require_teacher)):
    conn = db(); cur = conn.execute("DELETE FROM grades WHERE id=?", (grade_id,)); conn.commit(); conn.close()
    if cur.rowcount == 0: raise HTTPException(404, "Оценка не найдена")
    return {"ok": True}


@app.post("/api/notifications")
def create_notification(payload: NoticeIn, user=Depends(require_teacher)):
    now = datetime.now(timezone.utc).isoformat()
    conn = db(); cur = conn.execute("INSERT INTO notifications(text,created_at,author_id) VALUES(?,?,?)", (payload.text.strip(), now, user["id"])); conn.commit(); nid = cur.lastrowid; conn.close()
    return {"id": nid, "text": payload.text.strip(), "created_at": now}


@app.post("/api/sync")
def sync(user=Depends(current_user)):
    return {"ok": True, "message": "Данные синхронизированы с SQLite", "server_time": datetime.now(timezone.utc).isoformat()}
