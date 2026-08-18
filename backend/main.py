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
app = FastAPI(title="School Journal Pro API", version="4.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])


def db():
    c=sqlite3.connect(DB_PATH,timeout=10); c.row_factory=sqlite3.Row; c.execute("PRAGMA foreign_keys=ON"); c.execute("PRAGMA busy_timeout=5000"); return c

def now(): return datetime.now(timezone.utc).isoformat()
def hp(password):
    salt=secrets.token_bytes(16); digest=hashlib.pbkdf2_hmac("sha256",password.encode(),salt,120000); return f"{salt.hex()}${digest.hex()}"
def vp(password,stored):
    try:
        salt,digest=stored.split("$",1); got=hashlib.pbkdf2_hmac("sha256",password.encode(),bytes.fromhex(salt),120000); return secrets.compare_digest(got.hex(),digest)
    except Exception: return False

def pub_user(r): return {"id":r["id"],"role":r["role"],"name":r["name"],"email":r["email"],"student_id":r["student_id"],"active":bool(r["active"]),"created_at":r["created_at"]}

def migrate_users(c):
    row=c.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").fetchone()
    if not row or "'admin'" in (row[0] or "").lower(): return
    c.execute("PRAGMA foreign_keys=OFF"); c.execute("ALTER TABLE users RENAME TO users_old")
    c.execute("""CREATE TABLE users(id TEXT PRIMARY KEY,role TEXT NOT NULL CHECK(role IN ('admin','teacher','student','parent')),name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,student_id TEXT,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT '')""")
    c.execute("INSERT INTO users SELECT id,role,name,email,password_hash,student_id,active,created_at FROM users_old"); c.execute("DROP TABLE users_old"); c.execute("PRAGMA foreign_keys=ON")

def init_db():
    c=db(); c.executescript("""
    CREATE TABLE IF NOT EXISTS students(id TEXT PRIMARY KEY,name TEXT NOT NULL,class_name TEXT NOT NULL DEFAULT '10-А',phone TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS subjects(id TEXT PRIMARY KEY,name TEXT NOT NULL,teacher_id TEXT,created_at TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS grades(id INTEGER PRIMARY KEY AUTOINCREMENT,student_id TEXT NOT NULL,subject_id TEXT NOT NULL,value INTEGER NOT NULL CHECK(value BETWEEN 1 AND 10),comment TEXT DEFAULT '',created_at TEXT NOT NULL,FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS schedule(id INTEGER PRIMARY KEY AUTOINCREMENT,day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 1 AND 6),lesson_number INTEGER NOT NULL,start_time TEXT NOT NULL,end_time TEXT NOT NULL,subject_id TEXT NOT NULL,class_name TEXT NOT NULL,room TEXT DEFAULT '',teacher_id TEXT,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS homework(id INTEGER PRIMARY KEY AUTOINCREMENT,subject_id TEXT NOT NULL,class_name TEXT NOT NULL,title TEXT NOT NULL,description TEXT DEFAULT '',due_date TEXT NOT NULL,teacher_id TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT,sender_id TEXT NOT NULL,receiver_id TEXT NOT NULL,text TEXT NOT NULL,read_at TEXT,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY AUTOINCREMENT,text TEXT NOT NULL,created_at TEXT NOT NULL,author_id TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,role TEXT NOT NULL CHECK(role IN ('admin','teacher','student','parent')),name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,student_id TEXT,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT '');
    """)
    migrate_users(c)
    # Remove the old demo accounts. Only the administrator is seeded.
    c.execute("DELETE FROM users WHERE lower(email) IN ('teacher@demo.local','student@demo.local','parent@demo.local')")
    c.execute("DELETE FROM students WHERE id='s1'")
    if not c.execute("SELECT 1 FROM users WHERE lower(email)='admin@school.local'").fetchone():
        c.execute("INSERT INTO users VALUES(?,?,?,?,?,?,?,?)",("admin","admin","Администратор","admin@school.local",hp("Admin123!"),None,1,now()))
    else: c.execute("UPDATE users SET role='admin',active=1 WHERE lower(email)='admin@school.local'")
    c.commit(); c.close()
init_db()

class LoginIn(BaseModel): email:str; password:str
class UserIn(BaseModel): name:str=Field(min_length=2,max_length=100); email:str; password:str=Field(min_length=4,max_length=100); role:str; student_id:str|None=None; class_name:str='10-А'
class UserUpdate(BaseModel): name:str|None=Field(default=None,min_length=2,max_length=100); email:str|None=None; password:str|None=Field(default=None,min_length=4,max_length=100); active:bool|None=None; student_id:str|None=None
class StudentIn(BaseModel): name:str=Field(min_length=2,max_length=100); class_name:str=Field(default='10-А',min_length=1,max_length=30); phone:str=Field(default='',max_length=30)
class SubjectIn(BaseModel): name:str=Field(min_length=1,max_length=80); teacher_id:str|None=None
class GradeIn(BaseModel): student_id:str; subject_id:str; value:int=Field(ge=1,le=10); comment:str=Field(default='',max_length=500)
class ScheduleIn(BaseModel): day_of_week:int=Field(ge=1,le=6); lesson_number:int=Field(ge=1,le=12); start_time:str; end_time:str; subject_id:str; class_name:str=Field(min_length=1,max_length=30); room:str=Field(default='',max_length=30); teacher_id:str|None=None
class HomeworkIn(BaseModel): subject_id:str; class_name:str; title:str=Field(min_length=1,max_length=120); description:str=Field(default='',max_length=2000); due_date:str
class MessageIn(BaseModel): receiver_id:str; text:str=Field(min_length=1,max_length=2000)
class NoticeIn(BaseModel): text:str=Field(min_length=1,max_length=500)

def current_user(authorization:str|None=Header(default=None)):
    if not authorization or not authorization.startswith('Bearer '): raise HTTPException(401,'Сначала войдите в систему')
    token=authorization[7:].strip(); c=db(); r=c.execute('SELECT u.*,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?',(token,)).fetchone()
    if not r: c.close(); raise HTTPException(401,'Сессия недействительна')
    if not r['active']: c.close(); raise HTTPException(403,'Аккаунт отключён')
    if datetime.fromisoformat(r['expires_at'])<datetime.now(timezone.utc): c.execute('DELETE FROM sessions WHERE token=?',(token,)); c.commit(); c.close(); raise HTTPException(401,'Сессия истекла')
    result=dict(r); c.close(); return result

def require_admin(user=Depends(current_user)):
    if user['role']!='admin': raise HTTPException(403,'Это действие доступно только администратору')
    return user

def require_teacher(user=Depends(current_user)):
    if user['role']!='teacher': raise HTTPException(403,'Только учитель может выставлять оценки')
    return user

def require_staff(user=Depends(current_user)):
    if user['role'] not in {'admin','teacher'}: raise HTTPException(403,'Недостаточно прав')
    return user

def students_for(c,user):
    rows=[dict(x) for x in c.execute('SELECT * FROM students ORDER BY class_name,name').fetchall()]
    return rows if user['role'] in {'admin','teacher'} else [x for x in rows if x['id']==user.get('student_id')]

@app.get('/')
def root(): return {'name':'School Journal Pro API','status':'ok','version':'4.0.0'}
@app.get('/api/health')
def health(): c=db(); n=c.execute('SELECT COUNT(*) FROM users').fetchone()[0]; c.close(); return {'status':'ok','users':n,'version':'4.0.0'}

@app.post('/api/auth/login')
def login(p:LoginIn):
    c=db(); r=c.execute('SELECT * FROM users WHERE lower(email)=lower(?)',(p.email.strip(),)).fetchone()
    if not r or not vp(p.password,r['password_hash']): c.close(); raise HTTPException(401,'Неверный email или пароль')
    if not r['active']: c.close(); raise HTTPException(403,'Аккаунт отключён')
    token=secrets.token_urlsafe(40); exp=datetime.now(timezone.utc)+timedelta(hours=24); c.execute('INSERT INTO sessions VALUES(?,?,?)',(token,r['id'],exp.isoformat())); c.commit(); c.close(); return {'token':token,'user':pub_user(r),'expires_at':exp.isoformat()}
@app.post('/api/auth/logout')
def logout(authorization:str|None=Header(default=None)):
    if authorization and authorization.startswith('Bearer '): c=db(); c.execute('DELETE FROM sessions WHERE token=?',(authorization[7:].strip(),)); c.commit(); c.close()
    return {'ok':True}
@app.post('/api/auth/register')
def register_disabled(): raise HTTPException(403,'Регистрацию выполняет администратор')
@app.get('/api/me')
def me(user=Depends(current_user)): return pub_user(user)

@app.get('/api/dashboard')
def dashboard(user=Depends(current_user)):
    c=db(); students=students_for(c,user)
    subjects=[dict(r) for r in c.execute('SELECT s.*,u.name teacher_name FROM subjects s LEFT JOIN users u ON u.id=s.teacher_id ORDER BY s.name').fetchall()]
    users=[pub_user(r) for r in c.execute("SELECT * FROM users ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'teacher' THEN 1 WHEN 'student' THEN 2 ELSE 3 END,name").fetchall()] if user['role']=='admin' else []
    contacts=[dict(r) for r in c.execute('SELECT id,role,name,student_id FROM users WHERE active=1 AND id<>? ORDER BY name',(user['id'],)).fetchall()]
    if user['role'] in {'admin','teacher'}: grades=[dict(r) for r in c.execute('SELECT g.*,s.name student_name,sub.name subject_name,sub.teacher_id FROM grades g JOIN students s ON s.id=g.student_id JOIN subjects sub ON sub.id=g.subject_id ORDER BY g.created_at DESC,g.id DESC LIMIT 500').fetchall()]
    else: grades=[dict(r) for r in c.execute('SELECT g.*,s.name student_name,sub.name subject_name,sub.teacher_id FROM grades g JOIN students s ON s.id=g.student_id JOIN subjects sub ON sub.id=g.subject_id WHERE g.student_id=? ORDER BY g.created_at DESC,g.id DESC LIMIT 500',(user.get('student_id'),)).fetchall()] if user.get('student_id') else []
    schedule=[dict(r) for r in c.execute('SELECT sc.*,sub.name subject_name,u.name teacher_name FROM schedule sc JOIN subjects sub ON sub.id=sc.subject_id LEFT JOIN users u ON u.id=sc.teacher_id ORDER BY sc.day_of_week,sc.lesson_number').fetchall()]
    homework=[dict(r) for r in c.execute('SELECT h.*,sub.name subject_name,u.name teacher_name FROM homework h JOIN subjects sub ON sub.id=h.subject_id LEFT JOIN users u ON u.id=h.teacher_id ORDER BY h.due_date,h.id').fetchall()]
    if user['role'] not in {'admin','teacher'}:
        classes={s['class_name'] for s in students}; schedule=[x for x in schedule if x['class_name'] in classes]; homework=[x for x in homework if x['class_name'] in classes]
    messages=[dict(r) for r in c.execute('SELECT m.*,su.name sender_name,ru.name receiver_name FROM messages m JOIN users su ON su.id=m.sender_id JOIN users ru ON ru.id=m.receiver_id WHERE m.sender_id=? OR m.receiver_id=? ORDER BY m.created_at DESC,m.id DESC LIMIT 200',(user['id'],user['id'])).fetchall()]
    notifications=[dict(r) for r in c.execute('SELECT * FROM notifications ORDER BY id DESC LIMIT 50').fetchall()]; c.close()
    return {'user':pub_user(user),'students':students,'all_students':students if user['role'] in {'admin','teacher'} else [],'subjects':subjects,'grades':grades,'users':users,'contacts':contacts,'schedule':schedule,'homework':homework,'messages':messages,'notifications':notifications}

@app.get('/api/users')
def list_users(user=Depends(require_admin)):
    c=db(); rows=[pub_user(r) for r in c.execute('SELECT * FROM users ORDER BY role,name').fetchall()]; c.close(); return rows
@app.post('/api/users')
def create_user(p:UserIn,user=Depends(require_admin)):
    role=p.role.strip().lower()
    if role not in {'teacher','student','parent'}: raise HTTPException(400,'Можно создать только учителя, ученика или родителя')
    email=p.email.strip().lower(); c=db()
    if c.execute('SELECT 1 FROM users WHERE lower(email)=?',(email,)).fetchone(): c.close(); raise HTTPException(409,'Email уже используется')
    sid=p.student_id
    if role=='student': sid='s_'+secrets.token_hex(7); c.execute('INSERT INTO students VALUES(?,?,?,?,?)',(sid,p.name.strip(),p.class_name.strip() or '10-А','',now()))
    elif role=='parent' and sid and not c.execute('SELECT 1 FROM students WHERE id=?',(sid,)).fetchone(): c.close(); raise HTTPException(404,'Ученик для привязки не найден')
    uid='u_'+secrets.token_hex(7); c.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?,?)',(uid,role,p.name.strip(),email,hp(p.password),sid,1,now())); c.commit(); r=c.execute('SELECT * FROM users WHERE id=?',(uid,)).fetchone(); c.close(); return pub_user(r)
@app.patch('/api/users/{uid}')
def update_user(uid:str,p:UserUpdate,user=Depends(require_admin)):
    c=db(); r=c.execute('SELECT * FROM users WHERE id=?',(uid,)).fetchone()
    if not r: c.close(); raise HTTPException(404,'Пользователь не найден')
    fields=[]; vals=[]
    if p.name is not None: fields.append('name=?'); vals.append(p.name.strip())
    if p.email is not None: fields.append('email=?'); vals.append(p.email.strip().lower())
    if p.password is not None: fields.append('password_hash=?'); vals.append(hp(p.password))
    if p.active is not None and uid!='admin': fields.append('active=?'); vals.append(int(p.active))
    if p.student_id is not None: fields.append('student_id=?'); vals.append(p.student_id or None)
    if fields: vals.append(uid); c.execute('UPDATE users SET '+','.join(fields)+' WHERE id=?',vals); c.commit()
    r=c.execute('SELECT * FROM users WHERE id=?',(uid,)).fetchone(); c.close(); return pub_user(r)
@app.delete('/api/users/{uid}')
def delete_user(uid:str,user=Depends(require_admin)):
    if uid=='admin': raise HTTPException(400,'Главного администратора удалить нельзя')
    c=db(); r=c.execute('SELECT id FROM users WHERE id=?',(uid,)).fetchone()
    if not r: c.close(); raise HTTPException(404,'Пользователь не найден')
    c.execute('DELETE FROM sessions WHERE user_id=?',(uid,)); c.execute('DELETE FROM users WHERE id=?',(uid,)); c.commit(); c.close(); return {'ok':True}

@app.post('/api/students')
def create_student(p:StudentIn,user=Depends(require_admin)):
    sid='s_'+secrets.token_hex(7); c=db(); c.execute('INSERT INTO students VALUES(?,?,?,?,?)',(sid,p.name.strip(),p.class_name.strip(),p.phone.strip(),now())); c.commit(); r=dict(c.execute('SELECT * FROM students WHERE id=?',(sid,)).fetchone()); c.close(); return r
@app.patch('/api/students/{sid}')
def update_student(sid:str,p:StudentIn,user=Depends(require_admin)):
    c=db(); cur=c.execute('UPDATE students SET name=?,class_name=?,phone=? WHERE id=?',(p.name.strip(),p.class_name.strip(),p.phone.strip(),sid)); c.commit(); r=c.execute('SELECT * FROM students WHERE id=?',(sid,)).fetchone(); c.close()
    if cur.rowcount==0: raise HTTPException(404,'Ученик не найден')
    return dict(r)
@app.delete('/api/students/{sid}')
def delete_student(sid:str,user=Depends(require_admin)):
    c=db(); cur=c.execute('DELETE FROM students WHERE id=?',(sid,)); c.commit(); c.close();
    if cur.rowcount==0: raise HTTPException(404,'Ученик не найден')
    return {'ok':True}

@app.get('/api/subjects')
def list_subjects(user=Depends(current_user)):
    c=db(); rows=[dict(r) for r in c.execute('SELECT s.*,u.name teacher_name FROM subjects s LEFT JOIN users u ON u.id=s.teacher_id ORDER BY s.name').fetchall()]; c.close(); return rows
@app.post('/api/subjects')
def create_subject(p:SubjectIn,user=Depends(require_admin)):
    c=db()
    if p.teacher_id and not c.execute("SELECT 1 FROM users WHERE id=? AND role='teacher'",(p.teacher_id,)).fetchone(): c.close(); raise HTTPException(404,'Учитель не найден')
    sid='sub_'+secrets.token_hex(7); c.execute('INSERT INTO subjects VALUES(?,?,?,?)',(sid,p.name.strip(),p.teacher_id,now())); c.commit(); c.close(); return {'id':sid,'name':p.name.strip(),'teacher_id':p.teacher_id}
@app.patch('/api/subjects/{sid}')
def update_subject(sid:str,p:SubjectIn,user=Depends(require_admin)):
    c=db(); cur=c.execute('UPDATE subjects SET name=?,teacher_id=? WHERE id=?',(p.name.strip(),p.teacher_id,sid)); c.commit(); c.close();
    if cur.rowcount==0: raise HTTPException(404,'Предмет не найден')
    return {'ok':True}
@app.delete('/api/subjects/{sid}')
def delete_subject(sid:str,user=Depends(require_admin)):
    c=db(); cur=c.execute('DELETE FROM subjects WHERE id=?',(sid,)); c.commit(); c.close();
    if cur.rowcount==0: raise HTTPException(404,'Предмет не найден')
    return {'ok':True}

# Оценки: администратор не может создавать/изменять/удалять их. Учитель может работать только со своими предметами.
def teacher_subject(c,user,subject_id):
    r=c.execute("SELECT * FROM subjects WHERE id=?",(subject_id,)).fetchone()
    if not r: raise HTTPException(404,'Предмет не найден')
    if r['teacher_id']!=user['id']: raise HTTPException(403,'Вы можете работать с оценками только своего предмета')
    return r
@app.post('/api/grades')
def create_grade(p:GradeIn,user=Depends(require_teacher)):
    c=db(); teacher_subject(c,user,p.subject_id)
    if not c.execute('SELECT 1 FROM students WHERE id=?',(p.student_id,)).fetchone(): c.close(); raise HTTPException(404,'Ученик не найден')
    cur=c.execute('INSERT INTO grades(student_id,subject_id,value,comment,created_at) VALUES(?,?,?,?,?)',(p.student_id,p.subject_id,p.value,p.comment.strip(),now())); c.commit(); gid=cur.lastrowid; c.close(); return {'id':gid,'ok':True}
@app.patch('/api/grades/{gid}')
def update_grade(gid:int,p:GradeIn,user=Depends(require_teacher)):
    c=db(); r=c.execute('SELECT subject_id FROM grades WHERE id=?',(gid,)).fetchone()
    if not r: c.close(); raise HTTPException(404,'Оценка не найдена')
    teacher_subject(c,user,p.subject_id)
    c.execute('UPDATE grades SET student_id=?,subject_id=?,value=?,comment=? WHERE id=?',(p.student_id,p.subject_id,p.value,p.comment.strip(),gid)); c.commit(); c.close(); return {'ok':True}
@app.delete('/api/grades/{gid}')
def delete_grade(gid:int,user=Depends(require_teacher)):
    c=db(); r=c.execute('SELECT subject_id FROM grades WHERE id=?',(gid,)).fetchone()
    if not r: c.close(); raise HTTPException(404,'Оценка не найдена')
    teacher_subject(c,user,r['subject_id']); c.execute('DELETE FROM grades WHERE id=?',(gid,)); c.commit(); c.close(); return {'ok':True}

@app.get('/api/schedule')
def list_schedule(user=Depends(current_user)):
    c=db(); rows=[dict(r) for r in c.execute('SELECT sc.*,sub.name subject_name,u.name teacher_name FROM schedule sc JOIN subjects sub ON sub.id=sc.subject_id LEFT JOIN users u ON u.id=sc.teacher_id ORDER BY sc.day_of_week,sc.lesson_number').fetchall()]
    if user['role'] not in {'admin','teacher'}: classes={s['class_name'] for s in students_for(c,user)}; rows=[r for r in rows if r['class_name'] in classes]
    c.close(); return rows
@app.post('/api/schedule')
def create_schedule(p:ScheduleIn,user=Depends(require_admin)):
    c=db(); cur=c.execute('INSERT INTO schedule(day_of_week,lesson_number,start_time,end_time,subject_id,class_name,room,teacher_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)',(p.day_of_week,p.lesson_number,p.start_time,p.end_time,p.subject_id,p.class_name,p.room,p.teacher_id,now())); c.commit(); rid=cur.lastrowid; c.close(); return {'id':rid,'ok':True}
@app.patch('/api/schedule/{sid}')
def update_schedule(sid:int,p:ScheduleIn,user=Depends(require_admin)):
    c=db(); cur=c.execute('UPDATE schedule SET day_of_week=?,lesson_number=?,start_time=?,end_time=?,subject_id=?,class_name=?,room=?,teacher_id=? WHERE id=?',(p.day_of_week,p.lesson_number,p.start_time,p.end_time,p.subject_id,p.class_name,p.room,p.teacher_id,sid)); c.commit(); c.close();
    if cur.rowcount==0: raise HTTPException(404,'Урок не найден')
    return {'ok':True}
@app.delete('/api/schedule/{sid}')
def delete_schedule(sid:int,user=Depends(require_admin)):
    c=db(); cur=c.execute('DELETE FROM schedule WHERE id=?',(sid,)); c.commit(); c.close();
    if cur.rowcount==0: raise HTTPException(404,'Урок не найден')
    return {'ok':True}

@app.post('/api/homework')
def create_homework(p:HomeworkIn,user=Depends(require_teacher)):
    c=db(); teacher_subject(c,user,p.subject_id); cur=c.execute('INSERT INTO homework(subject_id,class_name,title,description,due_date,teacher_id,created_at) VALUES(?,?,?,?,?,?,?)',(p.subject_id,p.class_name,p.title,p.description,p.due_date,user['id'],now())); c.commit(); hid=cur.lastrowid; c.close(); return {'id':hid,'ok':True}
@app.patch('/api/homework/{hid}')
def update_homework(hid:int,p:HomeworkIn,user=Depends(require_teacher)):
    c=db(); r=c.execute('SELECT teacher_id FROM homework WHERE id=?',(hid,)).fetchone()
    if not r: c.close(); raise HTTPException(404,'Домашнее задание не найдено')
    if r['teacher_id']!=user['id']: c.close(); raise HTTPException(403,'Можно изменять только свои задания')
    teacher_subject(c,user,p.subject_id); c.execute('UPDATE homework SET subject_id=?,class_name=?,title=?,description=?,due_date=? WHERE id=?',(p.subject_id,p.class_name,p.title,p.description,p.due_date,hid)); c.commit(); c.close(); return {'ok':True}
@app.delete('/api/homework/{hid}')
def delete_homework(hid:int,user=Depends(require_teacher)):
    c=db(); r=c.execute('SELECT teacher_id FROM homework WHERE id=?',(hid,)).fetchone()
    if not r: c.close(); raise HTTPException(404,'Домашнее задание не найдено')
    if r['teacher_id']!=user['id']: c.close(); raise HTTPException(403,'Можно удалить только свои задания')
    c.execute('DELETE FROM homework WHERE id=?',(hid,)); c.commit(); c.close(); return {'ok':True}

@app.post('/api/messages')
def send_message(p:MessageIn,user=Depends(current_user)):
    if p.receiver_id==user['id']: raise HTTPException(400,'Нельзя написать самому себе')
    c=db(); r=c.execute('SELECT active FROM users WHERE id=?',(p.receiver_id,)).fetchone()
    if not r: c.close(); raise HTTPException(404,'Получатель не найден')
    if not r['active']: c.close(); raise HTTPException(400,'Получатель отключён')
    c.execute('INSERT INTO messages(sender_id,receiver_id,text,created_at) VALUES(?,?,?,?)',(user['id'],p.receiver_id,p.text.strip(),now())); c.commit(); c.close(); return {'ok':True}
@app.post('/api/messages/{mid}/read')
def read_message(mid:int,user=Depends(current_user)):
    c=db(); c.execute('UPDATE messages SET read_at=? WHERE id=? AND receiver_id=?',(now(),mid,user['id'])); c.commit(); c.close(); return {'ok':True}
@app.post('/api/notifications')
def notification(p:NoticeIn,user=Depends(require_admin)):
    c=db(); c.execute('INSERT INTO notifications(text,created_at,author_id) VALUES(?,?,?)',(p.text.strip(),now(),user['id'])); c.commit(); c.close(); return {'ok':True}
@app.post('/api/sync')
def sync(user=Depends(current_user)): return {'ok':True,'server_time':now(),'user':pub_user(user)}
