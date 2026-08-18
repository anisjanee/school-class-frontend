from datetime import datetime, timezone, timedelta
from pathlib import Path
import hashlib
import secrets
import sqlite3

from fastapi import Depends, FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "school.db"

app = FastAPI(title="School Journal Pro API", version="2.0.0")
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


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, digest_hex = stored.split("$", 1)
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), 120_000)
        return secrets.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def add_column_if_missing(conn, table, column, definition):
    columns = {r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


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
            student_id TEXT,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS students (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            class_name TEXT NOT NULL DEFAULT '10-А',
            phone TEXT DEFAULT '',
            created_at TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS subjects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            teacher_id TEXT,
            created_at TEXT NOT NULL DEFAULT ''
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
        CREATE TABLE IF NOT EXISTS schedule (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 1 AND 7),
            lesson_number INTEGER NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            subject_id TEXT NOT NULL,
            class_name TEXT NOT NULL,
            room TEXT DEFAULT '',
            teacher_id TEXT,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS homework (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject_id TEXT NOT NULL,
            class_name TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            due_date TEXT NOT NULL,
            teacher_id TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id TEXT NOT NULL,
            receiver_id TEXT NOT NULL,
            text TEXT NOT NULL,
            read_at TEXT,
            created_at TEXT NOT NULL
        );
        """
    )
    add_column_if_missing(conn, "users", "active", "INTEGER NOT NULL DEFAULT 1")
    add_column_if_missing(conn, "users", "created_at", "TEXT NOT NULL DEFAULT ''")
    add_column_if_missing(conn, "students", "phone", "TEXT DEFAULT ''")
    add_column_if_missing(conn, "students", "created_at", "TEXT NOT NULL DEFAULT ''")
    add_column_if_missing(conn, "subjects", "teacher_id", "TEXT")
    add_column_if_missing(conn, "subjects", "created_at", "TEXT NOT NULL DEFAULT ''")
    conn.execute("UPDATE users SET created_at=? WHERE created_at=''", (now_iso(),))
    conn.execute("UPDATE students SET created_at=? WHERE created_at=''", (now_iso(),))
    conn.execute("UPDATE subjects SET created_at=? WHERE created_at=''", (now_iso(),))

    if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
        sid = "s1"
        conn.execute("INSERT INTO students(id,name,class_name,phone,created_at) VALUES(?,?,?,?,?)", (sid, "Ученик Demo", "10-А", "", now_iso()))
        conn.execute("INSERT INTO subjects(id,name,teacher_id,created_at) VALUES(?,?,?,?)", ("math", "Математика", "t1", now_iso()))
        conn.execute("INSERT INTO subjects(id,name,teacher_id,created_at) VALUES(?,?,?,?)", ("eng", "Английский", "t1", now_iso()))
        conn.execute("INSERT INTO users(id,role,name,email,password_hash,student_id,active,created_at) VALUES(?,?,?,?,?,?,?,?)", ("t1", "teacher", "Учитель Demo", "teacher@demo.local", hash_password("1234"), None, 1, now_iso()))
        conn.execute("INSERT INTO users(id,role,name,email,password_hash,student_id,active,created_at) VALUES(?,?,?,?,?,?,?,?)", ("s1", "student", "Ученик Demo", "student@demo.local", hash_password("1234"), "s1", 1, now_iso()))
        conn.execute("INSERT INTO users(id,role,name,email,password_hash,student_id,active,created_at) VALUES(?,?,?,?,?,?,?,?)", ("p1", "parent", "Родитель Demo", "parent@demo.local", hash_password("1234"), "s1", 1, now_iso()))
        now = now_iso()
        conn.execute("INSERT INTO grades(student_id,subject_id,value,comment,created_at) VALUES (?,?,?,?,?)", ("s1", "math", 9, "", now))
        conn.execute("INSERT INTO grades(student_id,subject_id,value,comment,created_at) VALUES (?,?,?,?,?)", ("s1", "eng", 8, "", now))
    else:
        teacher = conn.execute("SELECT id FROM users WHERE role='teacher' ORDER BY created_at LIMIT 1").fetchone()
        if teacher:
            conn.execute("UPDATE subjects SET teacher_id=? WHERE teacher_id IS NULL", (teacher[0],))
    conn.commit()
    conn.close()


init_db()


class LoginIn(BaseModel):
    email: str
    password: str


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str
    password: str = Field(min_length=4, max_length=100)
    role: str
    class_name: str = "10-А"


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    email: str | None = None
    role: str | None = None
    password: str | None = Field(default=None, min_length=4, max_length=100)
    active: bool | None = None
    student_id: str | None = None


class StudentIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    class_name: str = "10-А"
    phone: str = ""


class SubjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    teacher_id: str | None = None


class GradeIn(BaseModel):
    student_id: str
    subject_id: str
    value: int = Field(ge=1, le=10)
    comment: str = ""


class NoticeIn(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class ScheduleIn(BaseModel):
    day_of_week: int = Field(ge=1, le=7)
    lesson_number: int = Field(ge=1, le=12)
    start_time: str
    end_time: str
    subject_id: str
    class_name: str
    room: str = ""
    teacher_id: str | None = None


class HomeworkIn(BaseModel):
    subject_id: str
    class_name: str
    title: str = Field(min_length=1, max_length=120)
    description: str = ""
    due_date: str


class MessageIn(BaseModel):
    receiver_id: str
    text: str = Field(min_length=1, max_length=2000)


def public_user(row):
    return {"id": row["id"], "role": row["role"], "name": row["name"], "email": row["email"], "student_id": row["student_id"], "active": bool(row["active"]), "created_at": row["created_at"]}


def current_user(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Требуется авторизация")
    token = authorization[7:].strip()
    conn = db()
    row = conn.execute("SELECT u.*, s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?", (token,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(401, "Сессия недействительна")
    if not row["active"]:
        raise HTTPException(403, "Аккаунт отключён администратором")
    try:
        if datetime.fromisoformat(row["expires_at"]) < datetime.now(timezone.utc):
            raise HTTPException(401, "Сессия истекла")
    except ValueError:
        pass
    return dict(row)


def require_teacher(user=Depends(current_user)):
    if user["role"] != "teacher":
        raise HTTPException(403, "Доступ только для учителя")
    return user


def require_staff(user=Depends(current_user)):
    if user["role"] != "teacher":
        raise HTTPException(403, "Недостаточно прав")
    return user


def scoped_student_ids(user):
    if user["role"] == "teacher":
        return None
    return [user["student_id"]] if user.get("student_id") else []


@app.get("/")
def root():
    return {"name": "School Journal Pro API", "status": "ok", "version": "2.0.0", "docs": "/docs"}


@app.get("/api/health")
def health():
    return {"status": "ok", "database": DB_PATH.name}


@app.post("/api/auth/register")
def register(payload: RegisterIn):
    role = payload.role.strip().lower()
    if role not in {"student", "parent"}:
        raise HTTPException(400, "Самостоятельная регистрация доступна только ученику или родителю")
    email = payload.email.strip().lower()
    conn = db()
    if conn.execute("SELECT 1 FROM users WHERE lower(email)=?", (email,)).fetchone():
        conn.close(); raise HTTPException(409, "Пользователь с таким email уже существует")
    user_id = "u_" + secrets.token_hex(6)
    student_id = None
    if role == "student":
        student_id = "s_" + secrets.token_hex(6)
        conn.execute("INSERT INTO students(id,name,class_name,phone,created_at) VALUES(?,?,?,?,?)", (student_id, payload.name.strip(), payload.class_name.strip() or "10-А", "", now_iso()))
    conn.execute("INSERT INTO users(id,role,name,email,password_hash,student_id,active,created_at) VALUES(?,?,?,?,?,?,?,?)", (user_id, role, payload.name.strip(), email, hash_password(payload.password), student_id, 1, now_iso()))
    conn.commit()
    row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    conn.close()
    return {"user": public_user(row), "message": "Регистрация выполнена"}


@app.post("/api/auth/login")
def login(payload: LoginIn):
    conn = db()
    user = conn.execute("SELECT * FROM users WHERE lower(email)=lower(?)", (payload.email.strip(),)).fetchone()
    if not user or not verify_password(payload.password, user["password_hash"]):
        conn.close(); raise HTTPException(401, "Неверный email или пароль")
    if not user["active"]:
        conn.close(); raise HTTPException(403, "Аккаунт отключён")
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=24)
    conn.execute("INSERT INTO sessions VALUES (?, ?, ?)", (token, user["id"], expires.isoformat()))
    conn.commit(); conn.close()
    return {"token": token, "user": public_user(user), "expires_at": expires.isoformat()}


@app.post("/api/auth/logout")
def logout(authorization: str | None = Header(default=None)):
    if authorization and authorization.startswith("Bearer "):
        conn = db(); conn.execute("DELETE FROM sessions WHERE token=?", (authorization[7:].strip(),)); conn.commit(); conn.close()
    return {"ok": True}


@app.get("/api/me")
def me(user=Depends(current_user)):
    return public_user(user)


@app.get("/api/dashboard")
def dashboard(user=Depends(current_user)):
    conn = db()
    students = [dict(x) for x in conn.execute("SELECT id,name,class_name,phone,created_at FROM students ORDER BY name").fetchall()]
    subjects = [dict(x) for x in conn.execute("SELECT id,name,teacher_id,created_at FROM subjects ORDER BY name").fetchall()]
    users = [public_user(x) for x in conn.execute("SELECT * FROM users ORDER BY name").fetchall()] if user["role"] == "teacher" else []
    if user["role"] == "teacher":
        grades = [dict(x) for x in conn.execute("SELECT g.id,g.student_id,g.subject_id,g.value,g.comment,g.created_at,s.name student_name,sub.name subject_name FROM grades g JOIN students s ON s.id=g.student_id JOIN subjects sub ON sub.id=g.subject_id ORDER BY g.id DESC").fetchall()]
        visible_students = students
    else:
        sid = user["student_id"]
        grades = [dict(x) for x in conn.execute("SELECT g.id,g.student_id,g.subject_id,g.value,g.comment,g.created_at,s.name student_name,sub.name subject_name FROM grades g JOIN students s ON s.id=g.student_id JOIN subjects sub ON sub.id=g.subject_id WHERE g.student_id=? ORDER BY g.id DESC", (sid,)).fetchall()] if sid else []
        visible_students = [s for s in students if s["id"] == sid] if sid else []
    schedule = [dict(x) for x in conn.execute("SELECT sc.*,sub.name subject_name, u.name teacher_name FROM schedule sc JOIN subjects sub ON sub.id=sc.subject_id LEFT JOIN users u ON u.id=sc.teacher_id ORDER BY sc.day_of_week,sc.lesson_number").fetchall()]
    if user["role"] != "teacher":
        class_names = {s["class_name"] for s in visible_students}
        schedule = [x for x in schedule if x["class_name"] in class_names]
    homework = [dict(x) for x in conn.execute("SELECT h.*,sub.name subject_name,u.name teacher_name FROM homework h JOIN subjects sub ON sub.id=h.subject_id LEFT JOIN users u ON u.id=h.teacher_id ORDER BY h.due_date DESC,h.id DESC").fetchall()]
    if user["role"] != "teacher":
        class_names = {s["class_name"] for s in visible_students}
        homework = [x for x in homework if x["class_name"] in class_names]
    messages = [dict(x) for x in conn.execute("SELECT m.*,su.name sender_name,ru.name receiver_name FROM messages m JOIN users su ON su.id=m.sender_id JOIN users ru ON ru.id=m.receiver_id WHERE m.sender_id=? OR m.receiver_id=? ORDER BY m.id DESC LIMIT 100", (user["id"], user["id"])).fetchall()]
    notifications = [dict(x) for x in conn.execute("SELECT id,text,created_at FROM notifications ORDER BY id DESC LIMIT 50").fetchall()]
    conn.close()
    return {"user": public_user(user), "students": visible_students, "all_students": students if user["role"] == "teacher" else [], "subjects": subjects, "grades": grades, "users": users, "schedule": schedule, "homework": homework, "messages": messages, "notifications": notifications}


@app.get("/api/users")
def list_users(user=Depends(require_staff)):
    conn = db(); rows = [public_user(x) for x in conn.execute("SELECT * FROM users ORDER BY role,name").fetchall()]; conn.close(); return rows


@app.post("/api/users")
def create_user(payload: RegisterIn, user=Depends(require_staff)):
    role = payload.role.strip().lower()
    if role not in {"teacher", "student", "parent"}: raise HTTPException(400, "Недопустимая роль")
    email = payload.email.strip().lower(); conn = db()
    if conn.execute("SELECT 1 FROM users WHERE lower(email)=?", (email,)).fetchone(): conn.close(); raise HTTPException(409, "Email уже используется")
    uid = "u_" + secrets.token_hex(6); sid = None
    if role == "student":
        sid = "s_" + secrets.token_hex(6)
        conn.execute("INSERT INTO students(id,name,class_name,phone,created_at) VALUES(?,?,?,?,?)", (sid,payload.name.strip(),payload.class_name.strip() or "10-А","",now_iso()))
    conn.execute("INSERT INTO users VALUES(?,?,?,?,?,?,?,?)", (uid,role,payload.name.strip(),email,hash_password(payload.password),sid,1,now_iso()))
    conn.commit(); row = conn.execute("SELECT * FROM users WHERE id=?",(uid,)).fetchone(); conn.close(); return public_user(row)


@app.patch("/api/users/{user_id}")
def update_user(user_id: str, payload: UserUpdate, user=Depends(require_staff)):
    conn = db(); target = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    if not target: conn.close(); raise HTTPException(404,"Пользователь не найден")
    role = payload.role or target["role"]
    if role not in {"teacher","student","parent"}: conn.close(); raise HTTPException(400,"Недопустимая роль")
    fields=[]; values=[]
    for key, value in (("name",payload.name),("email",payload.email),("role",payload.role),("active",None if payload.active is None else int(payload.active)),("student_id",payload.student_id)):
        if value is not None:
            fields.append(f"{key}=?"); values.append(value.strip().lower() if key=="email" else value)
    if payload.password:
        fields.append("password_hash=?"); values.append(hash_password(payload.password))
    if payload.role == "student" and not target["student_id"]:
        sid="s_"+secrets.token_hex(6); conn.execute("INSERT INTO students(id,name,class_name,phone,created_at) VALUES(?,?,?,?,?)",(sid,payload.name or target["name"],"10-А","",now_iso())); fields.append("student_id=?"); values.append(sid)
    if fields:
        values.append(user_id); conn.execute(f"UPDATE users SET {','.join(fields)} WHERE id=?",values)
    conn.commit(); row=conn.execute("SELECT * FROM users WHERE id=?",(user_id,)).fetchone(); conn.close(); return public_user(row)


@app.delete("/api/users/{user_id}")
def delete_user(user_id: str, user=Depends(require_staff)):
    if user_id == user["id"]: raise HTTPException(400,"Нельзя удалить собственный аккаунт")
    conn=db(); cur=conn.execute("DELETE FROM users WHERE id=?",(user_id,)); conn.commit(); conn.close()
    if cur.rowcount==0: raise HTTPException(404,"Пользователь не найден")
    return {"ok":True}


@app.post("/api/students")
def create_student(payload: StudentIn, user=Depends(require_teacher)):
    sid="s_"+secrets.token_hex(6); conn=db(); conn.execute("INSERT INTO students VALUES(?,?,?,?,?)",(sid,payload.name.strip(),payload.class_name.strip() or "10-А",payload.phone.strip(),now_iso())); conn.commit(); conn.close(); return {"id":sid,"name":payload.name.strip(),"class_name":payload.class_name.strip() or "10-А","phone":payload.phone.strip()}


@app.patch("/api/students/{student_id}")
def update_student(student_id: str, payload: StudentIn, user=Depends(require_teacher)):
    conn=db(); cur=conn.execute("UPDATE students SET name=?,class_name=?,phone=? WHERE id=?",(payload.name.strip(),payload.class_name.strip() or "10-А",payload.phone.strip(),student_id)); conn.commit(); conn.close()
    if cur.rowcount==0: raise HTTPException(404,"Ученик не найден")
    return {"ok":True}


@app.delete("/api/students/{student_id}")
def delete_student(student_id: str, user=Depends(require_teacher)):
    conn=db(); cur=conn.execute("DELETE FROM students WHERE id=?",(student_id,)); conn.commit(); conn.close()
    if cur.rowcount==0: raise HTTPException(404,"Ученик не найден")
    return {"ok":True}


@app.post("/api/subjects")
def create_subject(payload: SubjectIn, user=Depends(require_teacher)):
    sid="sub_"+secrets.token_hex(6); teacher_id=payload.teacher_id or user["id"]; conn=db(); conn.execute("INSERT INTO subjects VALUES(?,?,?,?)",(sid,payload.name.strip(),teacher_id,now_iso())); conn.commit(); conn.close(); return {"id":sid,"name":payload.name.strip(),"teacher_id":teacher_id}


@app.delete("/api/subjects/{subject_id}")
def delete_subject(subject_id: str, user=Depends(require_teacher)):
    conn=db(); cur=conn.execute("DELETE FROM subjects WHERE id=?",(subject_id,)); conn.commit(); conn.close()
    if cur.rowcount==0: raise HTTPException(404,"Предмет не найден")
    return {"ok":True}


@app.post("/api/grades")
def create_grade(payload: GradeIn, user=Depends(require_teacher)):
    conn=db()
    if not conn.execute("SELECT 1 FROM students WHERE id=?",(payload.student_id,)).fetchone(): conn.close(); raise HTTPException(404,"Ученик не найден")
    if not conn.execute("SELECT 1 FROM subjects WHERE id=?",(payload.subject_id,)).fetchone(): conn.close(); raise HTTPException(404,"Предмет не найден")
    created=now_iso(); cur=conn.execute("INSERT INTO grades(student_id,subject_id,value,comment,created_at) VALUES(?,?,?,?,?)",(payload.student_id,payload.subject_id,payload.value,payload.comment,created)); conn.commit(); gid=cur.lastrowid; conn.close(); return {"id":gid,"created_at":created}


@app.delete("/api/grades/{grade_id}")
def delete_grade(grade_id:int,user=Depends(require_teacher)):
    conn=db(); cur=conn.execute("DELETE FROM grades WHERE id=?",(grade_id,)); conn.commit(); conn.close()
    if cur.rowcount==0: raise HTTPException(404,"Оценка не найдена")
    return {"ok":True}


@app.post("/api/notifications")
def create_notification(payload: NoticeIn,user=Depends(require_teacher)):
    conn=db(); created=now_iso(); cur=conn.execute("INSERT INTO notifications(text,created_at,author_id) VALUES(?,?,?)",(payload.text.strip(),created,user["id"])); conn.commit(); nid=cur.lastrowid; conn.close(); return {"id":nid,"text":payload.text.strip()}


@app.post("/api/schedule")
def create_schedule(payload: ScheduleIn,user=Depends(require_teacher)):
    conn=db(); sid=conn.execute("SELECT 1 FROM subjects WHERE id=?",(payload.subject_id,)).fetchone()
    if not sid: conn.close(); raise HTTPException(404,"Предмет не найден")
    cur=conn.execute("INSERT INTO schedule(day_of_week,lesson_number,start_time,end_time,subject_id,class_name,room,teacher_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)",(payload.day_of_week,payload.lesson_number,payload.start_time,payload.end_time,payload.subject_id,payload.class_name.strip(),payload.room.strip(),payload.teacher_id or user["id"],now_iso())); conn.commit(); rid=cur.lastrowid; conn.close(); return {"id":rid}


@app.delete("/api/schedule/{schedule_id}")
def delete_schedule(schedule_id:int,user=Depends(require_teacher)):
    conn=db(); cur=conn.execute("DELETE FROM schedule WHERE id=?",(schedule_id,)); conn.commit(); conn.close()
    if cur.rowcount==0: raise HTTPException(404,"Урок не найден")
    return {"ok":True}


@app.post("/api/homework")
def create_homework(payload: HomeworkIn,user=Depends(require_teacher)):
    conn=db();
    if not conn.execute("SELECT 1 FROM subjects WHERE id=?",(payload.subject_id,)).fetchone(): conn.close(); raise HTTPException(404,"Предмет не найден")
    cur=conn.execute("INSERT INTO homework(subject_id,class_name,title,description,due_date,teacher_id,created_at) VALUES(?,?,?,?,?,?,?)",(payload.subject_id,payload.class_name.strip(),payload.title.strip(),payload.description.strip(),payload.due_date,user["id"],now_iso())); conn.commit(); hid=cur.lastrowid; conn.close(); return {"id":hid}


@app.delete("/api/homework/{homework_id}")
def delete_homework(homework_id:int,user=Depends(require_teacher)):
    conn=db(); cur=conn.execute("DELETE FROM homework WHERE id=?",(homework_id,)); conn.commit(); conn.close()
    if cur.rowcount==0: raise HTTPException(404,"Домашнее задание не найдено")
    return {"ok":True}


@app.post("/api/messages")
def send_message(payload: MessageIn,user=Depends(current_user)):
    conn=db(); receiver=conn.execute("SELECT id,active FROM users WHERE id=?",(payload.receiver_id,)).fetchone()
    if not receiver: conn.close(); raise HTTPException(404,"Получатель не найден")
    if not receiver["active"]: conn.close(); raise HTTPException(400,"Получатель отключён")
    created=now_iso(); cur=conn.execute("INSERT INTO messages(sender_id,receiver_id,text,created_at) VALUES(?,?,?,?)",(user["id"],payload.receiver_id,payload.text.strip(),created)); conn.commit(); mid=cur.lastrowid; conn.close(); return {"id":mid,"created_at":created}


@app.post("/api/messages/{message_id}/read")
def read_message(message_id:int,user=Depends(current_user)):
    conn=db(); cur=conn.execute("UPDATE messages SET read_at=? WHERE id=? AND receiver_id=?",(now_iso(),message_id,user["id"])); conn.commit(); conn.close()
    if cur.rowcount==0: raise HTTPException(404,"Сообщение не найдено")
    return {"ok":True}


@app.post("/api/sync")
def sync(user=Depends(current_user)):
    return {"ok":True,"message":"Данные синхронизированы","server_time":now_iso()}
