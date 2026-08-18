from datetime import datetime, timezone, timedelta
from pathlib import Path
import hashlib
import secrets
import sqlite3

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "school.db"

app = FastAPI(title="School Journal Pro API", version="3.0.1")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])
ROLES = {"admin", "teacher", "student", "parent"}


def db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


def now_iso(): return datetime.now(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, digest_hex = stored.split("$", 1)
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), 120_000)
        return secrets.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError): return False


def public_user(row):
    return {"id":row["id"],"role":row["role"],"name":row["name"],"email":row["email"],"student_id":row["student_id"],"active":bool(row["active"]),"created_at":row["created_at"]}


def contact_user(row):
    return {"id":row["id"],"role":row["role"],"name":row["name"],"student_id":row["student_id"],"active":bool(row["active"])}


def migrate_users_table(conn):
    table = conn.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").fetchone()
    if not table: return
    sql = (table[0] or "").lower()
    if "'admin'" in sql or '"admin"' in sql: return
    conn.execute("PRAGMA foreign_keys=OFF")
    conn.execute("ALTER TABLE users RENAME TO users_legacy")
    conn.execute("""CREATE TABLE users(
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL CHECK(role IN ('admin','teacher','student','parent')),
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        student_id TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT ''
    )""")
    conn.execute("INSERT INTO users(id,role,name,email,password_hash,student_id,active,created_at) SELECT id,role,name,email,password_hash,student_id,active,created_at FROM users_legacy")
    conn.execute("DROP TABLE users_legacy")
    conn.execute("PRAGMA foreign_keys=ON")


def add_column_if_missing(conn, table, column, definition):
    cols={r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in cols: conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def init_db():
    conn=db()
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS students(id TEXT PRIMARY KEY,name TEXT NOT NULL,class_name TEXT NOT NULL DEFAULT '10-А',phone TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS subjects(id TEXT PRIMARY KEY,name TEXT NOT NULL,teacher_id TEXT,created_at TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS grades(id INTEGER PRIMARY KEY AUTOINCREMENT,student_id TEXT NOT NULL,subject_id TEXT NOT NULL,value INTEGER NOT NULL CHECK(value BETWEEN 1 AND 10),comment TEXT DEFAULT '',created_at TEXT NOT NULL,FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY AUTOINCREMENT,text TEXT NOT NULL,created_at TEXT NOT NULL,author_id TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS schedule(id INTEGER PRIMARY KEY AUTOINCREMENT,day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 1 AND 6),lesson_number INTEGER NOT NULL,start_time TEXT NOT NULL,end_time TEXT NOT NULL,subject_id TEXT NOT NULL,class_name TEXT NOT NULL,room TEXT DEFAULT '',teacher_id TEXT,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS homework(id INTEGER PRIMARY KEY AUTOINCREMENT,subject_id TEXT NOT NULL,class_name TEXT NOT NULL,title TEXT NOT NULL,description TEXT DEFAULT '',due_date TEXT NOT NULL,teacher_id TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT,sender_id TEXT NOT NULL,receiver_id TEXT NOT NULL,text TEXT NOT NULL,read_at TEXT,created_at TEXT NOT NULL);
    """)
    migrate_users_table(conn)
    conn.execute("""CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,role TEXT NOT NULL CHECK(role IN ('admin','teacher','student','parent')),name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,student_id TEXT,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT '')""")
    for t,c,d in [("users","active","INTEGER NOT NULL DEFAULT 1"),("users","created_at","TEXT NOT NULL DEFAULT ''"),("students","phone","TEXT DEFAULT ''"),("students","created_at","TEXT NOT NULL DEFAULT ''"),("subjects","teacher_id","TEXT"),("subjects","created_at","TEXT NOT NULL DEFAULT ''")]: add_column_if_missing(conn,t,c,d)
    stamp=now_iso();conn.execute("UPDATE users SET created_at=? WHERE created_at=''",(stamp,));conn.execute("UPDATE students SET created_at=? WHERE created_at=''",(stamp,));conn.execute("UPDATE subjects SET created_at=? WHERE created_at=''",(stamp,))
    if not conn.execute("SELECT 1 FROM users WHERE lower(email)=?",("admin@school.local",)).fetchone(): conn.execute("INSERT INTO users VALUES(?,?,?,?,?,?,?,?)",("admin","admin","Администратор","admin@school.local",hash_password("Admin123!"),None,1,stamp))
    if not conn.execute("SELECT 1 FROM users WHERE email=?",("teacher@demo.local",)).fetchone(): conn.execute("INSERT INTO users VALUES(?,?,?,?,?,?,?,?)",("t1","teacher","Учитель Demo","teacher@demo.local",hash_password("1234"),None,1,stamp))
    if not conn.execute("SELECT 1 FROM students WHERE id='s1'").fetchone(): conn.execute("INSERT INTO students VALUES(?,?,?,?,?)",("s1","Ученик Demo","10-А","",stamp))
    if not conn.execute("SELECT 1 FROM users WHERE email=?",("student@demo.local",)).fetchone(): conn.execute("INSERT INTO users VALUES(?,?,?,?,?,?,?,?)",("s1","student","Ученик Demo","student@demo.local",hash_password("1234"),"s1",1,stamp))
    if not conn.execute("SELECT 1 FROM users WHERE email=?",("parent@demo.local",)).fetchone(): conn.execute("INSERT INTO users VALUES(?,?,?,?,?,?,?,?)",("p1","parent","Родитель Demo","parent@demo.local",hash_password("1234"),"s1",1,stamp))
    teacher=conn.execute("SELECT id FROM users WHERE role='teacher' ORDER BY created_at LIMIT 1").fetchone();tid=teacher[0] if teacher else None
    if not conn.execute("SELECT 1 FROM subjects WHERE id='math'").fetchone(): conn.execute("INSERT INTO subjects VALUES(?,?,?,?)",("math","Математика",tid,stamp))
    if not conn.execute("SELECT 1 FROM subjects WHERE id='eng'").fetchone(): conn.execute("INSERT INTO subjects VALUES(?,?,?,?)",("eng","Английский",tid,stamp))
    if conn.execute("SELECT COUNT(*) FROM grades").fetchone()[0]==0: conn.execute("INSERT INTO grades(student_id,subject_id,value,comment,created_at) VALUES(?,?,?,?,?)",("s1","math",9,"",stamp));conn.execute("INSERT INTO grades(student_id,subject_id,value,comment,created_at) VALUES(?,?,?,?,?)",("s1","eng",8,"",stamp))
    conn.commit();conn.close()

init_db()

class LoginIn(BaseModel): email:str; password:str
class RegisterIn(BaseModel): name:str=Field(min_length=2,max_length=100); email:str; password:str=Field(min_length=4,max_length=100); role:str; class_name:str='10-А'; student_id:str|None=None
class UserUpdate(BaseModel): name:str|None=Field(default=None,min_length=2,max_length=100); email:str|None=None; role:str|None=None; password:str|None=Field(default=None,min_length=4,max_length=100); active:bool|None=None; student_id:str|None=None
class StudentIn(BaseModel): name:str=Field(min_length=2,max_length=100); class_name:str=Field(default='10-А',min_length=1,max_length=30); phone:str=Field(default='',max_length=30)
class SubjectIn(BaseModel): name:str=Field(min_length=1,max_length=80); teacher_id:str|None=None
class GradeIn(BaseModel): student_id:str; subject_id:str; value:int=Field(ge=1,le=10); comment:str=Field(default='',max_length=500)
class ScheduleIn(BaseModel): day_of_week:int=Field(ge=1,le=6); lesson_number:int=Field(ge=1,le=12); start_time:str; end_time:str; subject_id:str; class_name:str=Field(min_length=1,max_length=30); room:str=Field(default='',max_length=30); teacher_id:str|None=None
class HomeworkIn(BaseModel): subject_id:str; class_name:str; title:str=Field(min_length=1,max_length=120); description:str=Field(default='',max_length=2000); due_date:str
class MessageIn(BaseModel): receiver_id:str; text:str=Field(min_length=1,max_length=2000)
class NoticeIn(BaseModel): text:str=Field(min_length=1,max_length=500)


def current_user(authorization:str|None=Header(default=None)):
    if not authorization or not authorization.startswith('Bearer '): raise HTTPException(401,'Требуется авторизация')
    token=authorization[7:].strip();conn=db();row=conn.execute('SELECT u.*,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?',(token,)).fetchone()
    if not row: conn.close();raise HTTPException(401,'Сессия недействительна')
    if not row['active']: conn.close();raise HTTPException(403,'Аккаунт отключён администратором')
    try: expired=datetime.fromisoformat(row['expires_at'])<datetime.now(timezone.utc)
    except ValueError: expired=True
    if expired: conn.execute('DELETE FROM sessions WHERE token=?',(token,));conn.commit();conn.close();raise HTTPException(401,'Сессия истекла')
    result=dict(row);conn.close();return result

def require_admin(user=Depends(current_user)):
    if user['role']!='admin': raise HTTPException(403,'Требуются права администратора')
    return user

def require_staff(user=Depends(current_user)):
    if user['role'] not in {'admin','teacher'}: raise HTTPException(403,'Недостаточно прав')
    return user

def get_students_for_user(conn,user):
    if user['role'] in {'admin','teacher'}: return [dict(r) for r in conn.execute('SELECT * FROM students ORDER BY class_name,name').fetchall()]
    sid=user.get('student_id');return [dict(r) for r in conn.execute('SELECT * FROM students WHERE id=?',(sid,)).fetchall()] if sid else []

@app.get('/')
def root(): return {'name':'School Journal Pro API','status':'ok','version':'3.0.1','docs':'/docs'}
@app.get('/api/health')
def health():
    conn=db();n=conn.execute('SELECT COUNT(*) FROM users').fetchone()[0];conn.close();return {'status':'ok','database':DB_PATH.name,'users':n,'version':'3.0.1'}

@app.post('/api/auth/login')
def login(payload:LoginIn):
    conn=db();user=conn.execute('SELECT * FROM users WHERE lower(email)=lower(?)',(payload.email.strip(),)).fetchone()
    if not user or not verify_password(payload.password,user['password_hash']): conn.close();raise HTTPException(401,'Неверный email или пароль')
    if not user['active']: conn.close();raise HTTPException(403,'Аккаунт отключён')
    token=secrets.token_urlsafe(40);expires=datetime.now(timezone.utc)+timedelta(hours=24);conn.execute('INSERT INTO sessions VALUES(?,?,?)',(token,user['id'],expires.isoformat()));conn.commit();conn.close();return {'token':token,'user':public_user(user),'expires_at':expires.isoformat()}

@app.post('/api/auth/register')
def register(payload:RegisterIn):
    role=payload.role.strip().lower()
    if role not in {'student','parent'}: raise HTTPException(400,'Самостоятельная регистрация доступна только ученику или родителю')
    email=payload.email.strip().lower();conn=db()
    if conn.execute('SELECT 1 FROM users WHERE lower(email)=?',(email,)).fetchone(): conn.close();raise HTTPException(409,'Email уже используется')
    uid='u_'+secrets.token_hex(7);sid=payload.student_id
    if role=='student': sid='s_'+secrets.token_hex(7);conn.execute('INSERT INTO students VALUES(?,?,?,?,?)',(sid,payload.name.strip(),payload.class_name.strip() or '10-А','',now_iso()))
    elif sid and not conn.execute('SELECT 1 FROM students WHERE id=?',(sid,)).fetchone(): conn.close();raise HTTPException(404,'Ученик для привязки не найден')
    conn.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)',(uid,role,payload.name.strip(),email,hash_password(payload.password),sid,1,now_iso()));conn.commit();row=conn.execute('SELECT * FROM users WHERE id=?',(uid,)).fetchone();conn.close();return {'user':public_user(row),'message':'Регистрация выполнена'}

@app.post('/api/auth/logout')
def logout(authorization:str|None=Header(default=None)):
    if authorization and authorization.startswith('Bearer '): conn=db();conn.execute('DELETE FROM sessions WHERE token=?',(authorization[7:].strip(),));conn.commit();conn.close()
    return {'ok':True}
@app.get('/api/me')
def me(user=Depends(current_user)): return public_user(user)

@app.get('/api/dashboard')
def dashboard(user=Depends(current_user)):
    conn=db();students=get_students_for_user(conn,user);subjects=[dict(r) for r in conn.execute('SELECT * FROM subjects ORDER BY name').fetchall()]
    users=[public_user(r) for r in conn.execute('SELECT * FROM users ORDER BY role,name').fetchall()] if user['role']=='admin' else []
    contacts=[contact_user(r) for r in conn.execute("SELECT id,role,name,student_id,active FROM users WHERE active=1 AND id<>? ORDER BY name",(user['id'],)).fetchall()]
    if user['role'] in {'admin','teacher'}: grades=[dict(r) for r in conn.execute('SELECT g.*,s.name student_name,sub.name subject_name FROM grades g JOIN students s ON s.id=g.student_id JOIN subjects sub ON sub.id=g.subject_id ORDER BY g.created_at DESC,g.id DESC LIMIT 300').fetchall()]
    else: grades=[dict(r) for r in conn.execute('SELECT g.*,s.name student_name,sub.name subject_name FROM grades g JOIN students s ON s.id=g.student_id JOIN subjects sub ON sub.id=g.subject_id WHERE g.student_id=? ORDER BY g.created_at DESC,g.id DESC LIMIT 300',(user.get('student_id'),)).fetchall()] if user.get('student_id') else []
    schedule=[dict(r) for r in conn.execute('SELECT sc.*,sub.name subject_name,u.name teacher_name FROM schedule sc JOIN subjects sub ON sub.id=sc.subject_id LEFT JOIN users u ON u.id=sc.teacher_id ORDER BY sc.day_of_week,sc.lesson_number').fetchall()]
    homework=[dict(r) for r in conn.execute('SELECT h.*,sub.name subject_name,u.name teacher_name FROM homework h JOIN subjects sub ON sub.id=h.subject_id LEFT JOIN users u ON u.id=h.teacher_id ORDER BY h.due_date ASC,h.id DESC').fetchall()]
    if user['role'] not in {'admin','teacher'}:
        classes={s['class_name'] for s in students};schedule=[x for x in schedule if x['class_name'] in classes];homework=[x for x in homework if x['class_name'] in classes]
    messages=[dict(r) for r in conn.execute('SELECT m.*,su.name sender_name,ru.name receiver_name FROM messages m JOIN users su ON su.id=m.sender_id JOIN users ru ON ru.id=m.receiver_id WHERE m.sender_id=? OR m.receiver_id=? ORDER BY m.created_at DESC,m.id DESC LIMIT 200',(user['id'],user['id'])).fetchall()]
    notifications=[dict(r) for r in conn.execute('SELECT id,text,created_at,author_id FROM notifications ORDER BY id DESC LIMIT 50').fetchall()];conn.close()
    return {'user':public_user(user),'students':students,'all_students':students if user['role'] in {'admin','teacher'} else [],'subjects':subjects,'grades':grades,'users':users,'contacts':contacts,'schedule':schedule,'homework':homework,'messages':messages,'notifications':notifications}

@app.get('/api/users')
def list_users(user=Depends(require_admin)):
    conn=db();rows=[public_user(r) for r in conn.execute('SELECT * FROM users ORDER BY role,name').fetchall()];conn.close();return rows
@app.post('/api/users')
def create_user(payload:RegisterIn,user=Depends(require_admin)):
    role=payload.role.strip().lower()
    if role not in {'teacher','student','parent'}: raise HTTPException(400,'Администратор может создать учителя, ученика или родителя')
    email=payload.email.strip().lower();conn=db()
    if conn.execute('SELECT 1 FROM users WHERE lower(email)=?',(email,)).fetchone(): conn.close();raise HTTPException(409,'Email уже используется')
    uid='u_'+secrets.token_hex(7);sid=payload.student_id
    if role=='student': sid='s_'+secrets.token_hex(7);conn.execute('INSERT INTO students VALUES(?,?,?,?,?)',(sid,payload.name.strip(),payload.class_name.strip() or '10-А','',now_iso()))
    elif role=='parent' and sid and not conn.execute('SELECT 1 FROM students WHERE id=?',(sid,)).fetchone(): conn.close();raise HTTPException(404,'Ученик для привязки не найден')
    conn.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)',(uid,role,payload.name.strip(),email,hash_password(payload.password),sid,1,now_iso()));conn.commit();row=conn.execute('SELECT * FROM users WHERE id=?',(uid,)).fetchone();conn.close();return public_user(row)
@app.patch('/api/users/{user_id}')
def update_user(user_id:str,payload:UserUpdate,user=Depends(require_admin)):
    conn=db();target=conn.execute('SELECT * FROM users WHERE id=?',(user_id,)).fetchone()
    if not target: conn.close();raise HTTPException(404,'Пользователь не найден')
    if user_id==user['id'] and payload.active is False: conn.close();raise HTTPException(400,'Нельзя отключить собственный аккаунт')
    role=payload.role or target['role']
    if role not in ROLES: conn.close();raise HTTPException(400,'Недопустимая роль')
    if payload.student_id and not conn.execute('SELECT 1 FROM students WHERE id=?',(payload.student_id,)).fetchone(): conn.close();raise HTTPException(404,'Ученик для привязки не найден')
    fields=[];values=[]
    for k,v in [('name',payload.name),('email',payload.email),('role',payload.role),('active',None if payload.active is None else int(payload.active)),('student_id',payload.student_id)]:
        if v is not None: fields.append(f'{k}=?');values.append(v.strip().lower() if k=='email' else v)
    if payload.password: fields.append('password_hash=?');values.append(hash_password(payload.password))
    if role=='student' and not target['student_id']:
        sid='s_'+secrets.token_hex(7);conn.execute('INSERT INTO students VALUES(?,?,?,?,?)',(sid,payload.name or target['name'],'10-А','',now_iso()));fields.append('student_id=?');values.append(sid)
    if fields: values.append(user_id);conn.execute(f"UPDATE users SET {','.join(fields)} WHERE id=?",values)
    conn.commit();row=conn.execute('SELECT * FROM users WHERE id=?',(user_id,)).fetchone();conn.close();return public_user(row)
@app.delete('/api/users/{user_id}')
def delete_user(user_id:str,user=Depends(require_admin)):
    if user_id==user['id']: raise HTTPException(400,'Нельзя удалить собственный аккаунт')
    conn=db();cur=conn.execute('DELETE FROM users WHERE id=?',(user_id,));conn.execute('DELETE FROM sessions WHERE user_id=?',(user_id,));conn.commit();conn.close()
    if cur.rowcount==0: raise HTTPException(404,'Пользователь не найден')
    return {'ok':True}

@app.get('/api/students')
def list_students(user=Depends(current_user)):
    conn=db();rows=get_students_for_user(conn,user);conn.close();return rows
@app.post('/api/students')
def create_student(payload:StudentIn,user=Depends(require_admin)):
    sid='s_'+secrets.token_hex(7);conn=db();conn.execute('INSERT INTO students VALUES(?,?,?,?,?)',(sid,payload.name.strip(),payload.class_name.strip(),payload.phone.strip(),now_iso()));conn.commit();conn.close();return {'id':sid,'name':payload.name.strip(),'class_name':payload.class_name.strip(),'phone':payload.phone.strip()}
@app.patch('/api/students/{student_id}')
def update_student(student_id:str,payload:StudentIn,user=Depends(require_admin)):
    conn=db();cur=conn.execute('UPDATE students SET name=?,class_name=?,phone=? WHERE id=?',(payload.name.strip(),payload.class_name.strip(),payload.phone.strip(),student_id));conn.commit();conn.close()
    if cur.rowcount==0: raise HTTPException(404,'Ученик не найден')
    return {'ok':True}
@app.delete('/api/students/{student_id}')
def delete_student(student_id:str,user=Depends(require_admin)):
    conn=db();cur=conn.execute('DELETE FROM students WHERE id=?',(student_id,));conn.commit();conn.close()
    if cur.rowcount==0: raise HTTPException(404,'Ученик не найден')
    return {'ok':True}

@app.get('/api/subjects')
def list_subjects(user=Depends(current_user)):
    conn=db();rows=[dict(r) for r in conn.execute('SELECT s.*,u.name teacher_name FROM subjects s LEFT JOIN users u ON u.id=s.teacher_id ORDER BY s.name').fetchall()];conn.close();return rows
@app.post('/api/subjects')
def create_subject(payload:SubjectIn,user=Depends(require_admin)):
    conn=db()
    if payload.teacher_id and not conn.execute("SELECT 1 FROM users WHERE id=? AND role='teacher'",(payload.teacher_id,)).fetchone(): conn.close();raise HTTPException(404,'Учитель не найден')
    sid='sub_'+secrets.token_hex(7);conn.execute('INSERT INTO subjects VALUES(?,?,?,?)',(sid,payload.name.strip(),payload.teacher_id,now_iso()));conn.commit();conn.close();return {'id':sid,'name':payload.name.strip(),'teacher_id':payload.teacher_id}
@app.patch('/api/subjects/{subject_id}')
def update_subject(subject_id:str,payload:SubjectIn,user=Depends(require_admin)):
    conn=db();cur=conn.execute('UPDATE subjects SET name=?,teacher_id=? WHERE id=?',(payload.name.strip(),payload.teacher_id,subject_id));conn.commit();conn.close()
    if cur.rowcount==0: raise HTTPException(404,'Предмет не найден')
    return {'ok':True}
@app.delete('/api/subjects/{subject_id}')
def delete_subject(subject_id:str,user=Depends(require_admin)):
    conn=db();cur=conn.execute('DELETE FROM subjects WHERE id=?',(subject_id,));conn.commit();conn.close()
    if cur.rowcount==0: raise HTTPException(404,'Предмет не найден')
    return {'ok':True}

@app.post('/api/grades')
def create_grade(payload:GradeIn,user=Depends(require_staff)):
    conn=db()
    if not conn.execute('SELECT 1 FROM students WHERE id=?',(payload.student_id,)).fetchone(): conn.close();raise HTTPException(404,'Ученик не найден')
    if not conn.execute('SELECT 1 FROM subjects WHERE id=?',(payload.subject_id,)).fetchone(): conn.close();raise HTTPException(404,'Предмет не найден')
    cur=conn.execute('INSERT INTO grades(student_id,subject_id,value,comment,created_at) VALUES(?,?,?,?,?)',(payload.student_id,payload.subject_id,payload.value,payload.comment.strip(),now_iso()));conn.commit();gid=cur.lastrowid;conn.close();return {'id':gid,'ok':True}
@app.patch('/api/grades/{grade_id}')
def update_grade(grade_id:int,payload:GradeIn,user=Depends(require_staff)):
    conn=db();cur=conn.execute('UPDATE grades SET student_id=?,subject_id=?,value=?,comment=? WHERE id=?',(payload.student_id,payload.subject_id,payload.value,payload.comment.strip(),grade_id));conn.commit();conn.close()
    if cur.rowcount==0: raise HTTPException(404,'Оценка не найдена')
    return {'ok':True}
@app.delete('/api/grades/{grade_id}')
def delete_grade(grade_id:int,user=Depends(require_staff)):
    conn=db();cur=conn.execute('DELETE FROM grades WHERE id=?',(grade_id,));conn.commit();conn.close()
    if cur.rowcount==0: raise HTTPException(404,'Оценка не найдена')
    return {'ok':True}

@app.get('/api/schedule')
def list_schedule(user=Depends(current_user)):
    conn=db();rows=[dict(r) for r in conn.execute('SELECT sc.*,sub.name subject_name,u.name teacher_name FROM schedule sc JOIN subjects sub ON sub.id=sc.subject_id LEFT JOIN users u ON u.id=sc.teacher_id ORDER BY sc.day_of_week,sc.lesson_number').fetchall()]
    if user['role'] not in {'admin','teacher'}: classes={s['class_name'] for s in get_students_for_user(conn,user)};rows=[r for r in rows if r['class_name'] in classes]
    conn.close();return rows
@app.post('/api/schedule')
def create_schedule(payload:ScheduleIn,user=Depends(require_admin)):
    conn=db()
    if not conn.execute('SELECT 1 FROM subjects WHERE id=?',(payload.subject_id,)).fetchone(): conn.close();raise HTTPException(404,'Предмет не найден')
    if payload.teacher_id and not conn.execute("SELECT 1 FROM users WHERE id=? AND role='teacher'",(payload.teacher_id,)).fetchone(): conn.close();raise HTTPException(404,'Учитель не найден')
    cur=conn.execute('INSERT INTO schedule(day_of_week,lesson_number,start_time,end_time,subject_id,class_name,room,teacher_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)',(payload.day_of_week,payload.lesson_number,payload.start_time,payload.end_time,payload.subject_id,payload.class_name.strip(),payload.room.strip(),payload.teacher_id,now_iso()));conn.commit();rid=cur.lastrowid;conn.close();return {'id':rid,'ok':True}
@app.patch('/api/schedule/{schedule_id}')
def update_schedule(schedule_id:int,payload:ScheduleIn,user=Depends(require_admin)):
    conn=db();cur=conn.execute('UPDATE schedule SET day_of_week=?,lesson_number=?,start_time=?,end_time=?,subject_id=?,class_name=?,room=?,teacher_id=? WHERE id=?',(payload.day_of_week,payload.lesson_number,payload.start_time,payload.end_time,payload.subject_id,payload.class_name.strip(),payload.room.strip(),payload.teacher_id,schedule_id));conn.commit();conn.close()
    if cur.rowcount==0: raise HTTPException(404,'Урок не найден')
    return {'ok':True}
@app.delete('/api/schedule/{schedule_id}')
def delete_schedule(schedule_id:int,user=Depends(require_admin)):
    conn=db();cur=conn.execute('DELETE FROM schedule WHERE id=?',(schedule_id,));conn.commit();conn.close()
    if cur.rowcount==0: raise HTTPException(404,'Урок не найден')
    return {'ok':True}

@app.post('/api/homework')
def create_homework(payload:HomeworkIn,user=Depends(require_staff)):
    conn=db()
    if not conn.execute('SELECT 1 FROM subjects WHERE id=?',(payload.subject_id,)).fetchone(): conn.close();raise HTTPException(404,'Предмет не найден')
    cur=conn.execute('INSERT INTO homework(subject_id,class_name,title,description,due_date,teacher_id,created_at) VALUES(?,?,?,?,?,?,?)',(payload.subject_id,payload.class_name.strip(),payload.title.strip(),payload.description.strip(),payload.due_date,user['id'],now_iso()));conn.commit();hid=cur.lastrowid;conn.close();return {'id':hid,'ok':True}
@app.patch('/api/homework/{homework_id}')
def update_homework(homework_id:int,payload:HomeworkIn,user=Depends(require_staff)):
    conn=db()
    if user['role']=='teacher' and not conn.execute('SELECT 1 FROM homework WHERE id=? AND teacher_id=?',(homework_id,user['id'])).fetchone(): conn.close();raise HTTPException(403,'Можно изменять только свои задания')
    cur=conn.execute('UPDATE homework SET subject_id=?,class_name=?,title=?,description=?,due_date=? WHERE id=?',(payload.subject_id,payload.class_name.strip(),payload.title.strip(),payload.description.strip(),payload.due_date,homework_id));conn.commit();conn.close()
    if cur.rowcount==0: raise HTTPException(404,'Домашнее задание не найдено')
    return {'ok':True}
@app.delete('/api/homework/{homework_id}')
def delete_homework(homework_id:int,user=Depends(require_staff)):
    conn=db()
    if user['role']=='teacher' and not conn.execute('SELECT 1 FROM homework WHERE id=? AND teacher_id=?',(homework_id,user['id'])).fetchone(): conn.close();raise HTTPException(403,'Можно удалить только свои задания')
    cur=conn.execute('DELETE FROM homework WHERE id=?',(homework_id,));conn.commit();conn.close()
    if cur.rowcount==0: raise HTTPException(404,'Домашнее задание не найдено')
    return {'ok':True}

@app.post('/api/messages')
def send_message(payload:MessageIn,user=Depends(current_user)):
    if payload.receiver_id==user['id']: raise HTTPException(400,'Нельзя отправить сообщение самому себе')
    conn=db();receiver=conn.execute('SELECT id,active FROM users WHERE id=?',(payload.receiver_id,)).fetchone()
    if not receiver: conn.close();raise HTTPException(404,'Получатель не найден')
    if not receiver['active']: conn.close();raise HTTPException(400,'Получатель отключён')
    cur=conn.execute('INSERT INTO messages(sender_id,receiver_id,text,created_at) VALUES(?,?,?,?)',(user['id'],payload.receiver_id,payload.text.strip(),now_iso()));conn.commit();mid=cur.lastrowid;conn.close();return {'id':mid,'ok':True}
@app.post('/api/messages/{message_id}/read')
def read_message(message_id:int,user=Depends(current_user)):
    conn=db();cur=conn.execute('UPDATE messages SET read_at=? WHERE id=? AND receiver_id=?',(now_iso(),message_id,user['id']));conn.commit();conn.close()
    if cur.rowcount==0: raise HTTPException(404,'Сообщение не найдено')
    return {'ok':True}
@app.post('/api/notifications')
def create_notification(payload:NoticeIn,user=Depends(require_admin)):
    conn=db();cur=conn.execute('INSERT INTO notifications(text,created_at,author_id) VALUES(?,?,?)',(payload.text.strip(),now_iso(),user['id']));conn.commit();nid=cur.lastrowid;conn.close();return {'id':nid,'ok':True}
@app.post('/api/sync')
def sync(user=Depends(current_user)): return {'ok':True,'server_time':now_iso(),'user':public_user(user)}
