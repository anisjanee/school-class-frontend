const API_BASE = window.SCHOOL_API_URL || 'http://127.0.0.1:8000';
const TOKEN_KEY = 'school_journal_api_token';
const SESSION_KEY = 'school_journal_session';
let session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
let db = { students: [], all_students: [], subjects: [], grades: [], users: [], schedule: [], homework: [], messages: [], notifications: [] };
let view = 'overview';

const app = document.querySelector('#app');
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const token = () => localStorage.getItem(TOKEN_KEY);
const roleName = r => ({teacher:'Учитель',student:'Ученик',parent:'Родитель'}[r] || r);
const days = ['','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];

function toast(message) {
  const el = document.querySelector('#toast'); if (!el) return;
  el.textContent = message; el.classList.add('show');
  clearTimeout(window.__toastTimer); window.__toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

async function api(path, options = {}) {
  const headers = {'Content-Type':'application/json', ...(options.headers || {})};
  if (token()) headers.Authorization = `Bearer ${token()}`;
  let res;
  try { res = await fetch(`${API_BASE}${path}`, {...options, headers}); }
  catch (_) { throw new Error('Backend недоступен. Проверьте порт 8000.'); }
  let data = {};
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
  return data;
}

async function loadDashboard() {
  const data = await api('/api/dashboard');
  session = data.user;
  db = {students:data.students||[], all_students:data.all_students||[], subjects:data.subjects||[], grades:data.grades||[], users:data.users||[], schedule:data.schedule||[], homework:data.homework||[], messages:data.messages||[], notifications:data.notifications||[]};
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

async function login() {
  const email = document.querySelector('#email')?.value.trim();
  const password = document.querySelector('#password')?.value || '';
  if (!email || !password) return toast('Введите email и пароль');
  try {
    const data = await api('/api/auth/login',{method:'POST',body:JSON.stringify({email,password})});
    localStorage.setItem(TOKEN_KEY,data.token); session=data.user; view='overview';
    await loadDashboard(); render(); toast(`Добро пожаловать, ${session.name}`);
  } catch (e) { toast(e.message); }
}

async function register() {
  const name=document.querySelector('#regName')?.value.trim();
  const email=document.querySelector('#regEmail')?.value.trim();
  const password=document.querySelector('#regPassword')?.value || '';
  const role=document.querySelector('#regRole')?.value;
  const className=document.querySelector('#regClass')?.value.trim() || '10-А';
  if (!name || !email || !password) return toast('Заполните обязательные поля');
  try {
    await api('/api/auth/register',{method:'POST',body:JSON.stringify({name,email,password,role,class_name:className})});
    toast('Регистрация успешна. Теперь войдите.');
    showLogin();
    document.querySelector('#email').value=email;
  } catch(e) { toast(e.message); }
}

function showLogin(){ window.authMode='login'; render(); }
function showRegister(){ window.authMode='register'; render(); }

async function logout(){
  try { await api('/api/auth/logout',{method:'POST'}); } catch (_) {}
  localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(SESSION_KEY); session=null;
  db={students:[],all_students:[],subjects:[],grades:[],users:[],schedule:[],homework:[],messages:[],notifications:[]};
  window.authMode='login'; render();
}

function avg(studentId){
  const a=db.grades.filter(g=>g.student_id===studentId);
  return a.length ? (a.reduce((s,g)=>s+Number(g.value),0)/a.length).toFixed(1) : '0.0';
}
function currentStudent(){
  const sid=session?.student_id;
  return db.students.find(s=>s.id===sid) || db.all_students.find(s=>s.id===sid) || db.students[0] || db.all_students[0];
}
function nav(items){
  return items.map(([id,icon,label])=>`<button class="nav-item ${view===id?'active':''}" onclick="setView('${id}')"><span>${icon}</span>${label}</button>`).join('');
}
function setView(v){ view=v; render(); }

function authScreen(){
  const registerMode=window.authMode==='register';
  if (!window.authMode) window.authMode='login';
  return `<div class="auth-page">
    <div class="auth-orb orb-a"></div><div class="auth-orb orb-b"></div>
    <div class="auth-wrap">
      <section class="auth-brand">
        <div class="brand-mark">S</div><div><strong>School Journal</strong><span>PRO • Digital School</span></div>
      </section>
      <div class="auth-card">
        <div class="auth-head"><span class="eyebrow">${registerMode?'Новый аккаунт':'Добро пожаловать'}</span><h1>${registerMode?'Создать аккаунт':'Войти в систему'}</h1><p>${registerMode?'Присоединитесь к школьной платформе.':'Управляйте учёбой, расписанием и общением в одном месте.'}</p></div>
        ${registerMode ? `<div class="form-grid">
          <label>Имя<input id="regName" placeholder="Ваше имя"></label>
          <label>Email<input id="regEmail" type="email" placeholder="name@example.com"></label>
          <label>Роль<select id="regRole"><option value="student">Ученик</option><option value="parent">Родитель</option></select></label>
          <label>Класс<input id="regClass" value="10-А" placeholder="10-А"></label>
          <label class="full">Пароль<input id="regPassword" type="password" placeholder="Минимум 4 символа"></label>
          <button class="primary full" onclick="register()">Создать аккаунт <span>→</span></button>
        </div>
        <p class="auth-switch">Уже есть аккаунт? <button onclick="showLogin()">Войти</button></p>` : `<div class="form-grid">
          <label class="full">Email<input id="email" type="email" placeholder="teacher@demo.local" autocomplete="username"></label>
          <label class="full">Пароль<input id="password" type="password" placeholder="Введите пароль" autocomplete="current-password" onkeydown="if(event.key==='Enter')login()"></label>
          <button class="primary full" onclick="login()">Войти <span>→</span></button>
        </div>
        <div class="demo-box"><strong>Демо-доступ</strong><span>teacher@demo.local / 1234</span><span>student@demo.local / 1234</span><span>parent@demo.local / 1234</span></div>
        <p class="auth-switch">Нет аккаунта? <button onclick="showRegister()">Зарегистрироваться</button></p>`}
        <div class="api-status"><i></i> API ${esc(API_BASE)}</div>
      </div>
      <small class="auth-foot">School Journal Pro · локальная версия</small>
    </div>
  </div>`;
}

function layout(){
  const teacher=session.role==='teacher';
  const navItems=teacher
    ? [['overview','⌂','Обзор'],['students','♙','Ученики'],['users','◉','Пользователи'],['grades','◆','Оценки'],['schedule','▦','Расписание'],['homework','✓','Домашние задания'],['messages','✉','Сообщения']]
    : [['overview','⌂','Обзор'],['schedule','▦','Расписание'],['homework','✓','Домашние задания'],['messages','✉','Сообщения']];
  return `<div class="app-shell">
    <aside class="sidebar" id="sidebar">
      <div class="side-brand"><div class="brand-mark">S</div><div><strong>School Journal</strong><small>PRO</small></div></div>
      <div class="side-label">РАЗДЕЛЫ</div><nav>${nav(navItems)}</nav>
      <div class="side-spacer"></div>
      <div class="side-user"><div class="avatar">${esc((session.name||'U').charAt(0).toUpperCase())}</div><div class="user-mini"><strong>${esc(session.name)}</strong><span>${roleName(session.role)}</span></div><button class="icon-btn" title="Выйти" onclick="logout()">↪</button></div>
    </aside>
    <main class="main-area">
      <header class="topbar"><button class="mobile-menu icon-btn" onclick="document.querySelector('#sidebar').classList.toggle('open')">☰</button><div><div class="breadcrumb">School Journal <span>/</span> ${esc(pageTitle())}</div><h1>${esc(pageTitle())}</h1></div><div class="top-actions"><span class="role-badge">${roleName(session.role)}</span><button class="sync-btn" onclick="sync()">↻ <span>Синхронизировать</span></button></div></header>
      <div class="page-content">${content()}</div>
    </main>
  </div>`;
}

function pageTitle(){return ({overview:'Обзор',students:'Ученики',users:'Пользователи',grades:'Оценки',schedule:'Расписание',homework:'Домашние задания',messages:'Сообщения'})[view]||'Обзор';}

function statCard(icon,label,value,sub,accent='blue'){return `<div class="stat-card ${accent}"><div class="stat-icon">${icon}</div><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`;}

function content(){
  if(view==='students') return studentsPage();
  if(view==='users') return usersPage();
  if(view==='grades') return gradesPage();
  if(view==='schedule') return schedulePage();
  if(view==='homework') return homeworkPage();
  if(view==='messages') return messagesPage();
  return overviewPage();
}

function overviewPage(){
  const s=currentStudent();
  if(session.role==='teacher'){
    const average=db.grades.length ? (db.grades.reduce((a,g)=>a+Number(g.value),0)/db.grades.length).toFixed(1) : '0.0';
    return `<div class="hero"><div><span class="eyebrow">Панель управления</span><h2>Добрый день, ${esc(session.name.split(' ')[0])} 👋</h2><p>Все ключевые данные школы собраны в одном месте.</p></div><div class="hero-mark">✦</div></div>
      <div class="stats-grid">${statCard('♙','Ученики',db.all_students.length,'в системе','blue')}${statCard('◉','Пользователи',db.users.length,'аккаунтов','violet')}${statCard('◆','Средняя оценка',average,'по журналу','green')}${statCard('✉','Сообщения',db.messages.filter(m=>m.receiver_id===session.id&&!m.read_at).length,'непрочитанных','orange')}</div>
      <div class="two-col"><section class="panel"><div class="panel-head"><div><span class="eyebrow">Последние записи</span><h3>Ученики</h3></div><button class="ghost" onclick="setView('students')">Все ученики →</button></div>${studentTable(db.all_students.slice(0,6))}</section><section class="panel"><div class="panel-head"><div><span class="eyebrow">Сегодня</span><h3>Быстрые действия</h3></div></div><div class="quick-grid"><button onclick="setView('grades')"><b>◆</b><span>Поставить оценку</span></button><button onclick="setView('schedule')"><b>▦</b><span>Добавить урок</span></button><button onclick="setView('homework')"><b>✓</b><span>Задать домашнее</span></button><button onclick="setView('users')"><b>◉</b><span>Создать аккаунт</span></button></div></section></div>
      <section class="panel"><div class="panel-head"><div><span class="eyebrow">Уведомления</span><h3>Последние события</h3></div></div>${notifications()}</section>`;
  }
  if(!s) return `<div class="empty-state large"><div>⌂</div><h2>Аккаунт создан</h2><p>Попросите учителя привязать ваш аккаунт к ученику. После этого здесь появятся оценки, расписание и домашние задания.</p><button class="primary" onclick="setView('messages')">Написать учителю</button></div>`;
  const grades=db.grades.filter(g=>g.student_id===s.id); const average=avg(s.id);
  return `<div class="hero family-hero"><div><span class="eyebrow">Личный кабинет</span><h2>${esc(s.name)}</h2><p>${esc(s.class_name)} · ${session.role==='parent'?'кабинет родителя':'кабинет ученика'}</p></div><div class="score-ring"><strong>${average}</strong><span>средний балл</span></div></div>
    <div class="stats-grid">${statCard('◆','Средний балл',average,'из 10','green')}${statCard('✓','Оценки',grades.length,'в журнале','blue')}${statCard('▦','Уроки',db.schedule.length,'в расписании','violet')}${statCard('✉','Сообщения',db.messages.filter(m=>m.receiver_id===session.id&&!m.read_at).length,'непрочитанных','orange')}</div>
    <div class="two-col"><section class="panel"><div class="panel-head"><div><span class="eyebrow">Успеваемость</span><h3>Последние оценки</h3></div><button class="ghost" onclick="setView('grades')">Открыть журнал →</button></div>${gradeTable(grades.slice(0,6))}</section><section class="panel"><div class="panel-head"><div><span class="eyebrow">Ближайшее</span><h3>Домашние задания</h3></div><button class="ghost" onclick="setView('homework')">Все задания →</button></div>${homeworkList(db.homework.slice(0,5))}</section></div>`;
}

function studentTable(rows){
  if(!rows.length) return '<div class="empty-state"><div>♙</div><p>Пока нет учеников.</p></div>';
  return `<div class="table-scroll"><table><thead><tr><th>Ученик</th><th>Класс</th><th>Средний</th><th></th></tr></thead><tbody>${rows.map(s=>`<tr><td><div class="person"><span class="avatar sm">${esc(s.name.charAt(0))}</span><span><b>${esc(s.name)}</b><small>${esc(s.phone||'Нет телефона')}</small></span></div></td><td><span class="tag">${esc(s.class_name)}</span></td><td><b class="score">${avg(s.id)}</b></td><td><button class="icon-btn" onclick="editStudent('${esc(s.id)}')">✎</button></td></tr>`).join('')}</tbody></table></div>`;
}

function studentsPage(){return `<div class="section-intro"><div><span class="eyebrow">Академический состав</span><h2>Ученики</h2><p>Профили, классы и контактные данные.</p></div><button class="primary" onclick="openStudentForm()">+ Добавить ученика</button></div><section class="panel form-panel" id="studentForm" hidden><div class="panel-head"><h3>Новый профиль ученика</h3></div><div class="inline-form"><input id="studentName" placeholder="Имя и фамилия"><input id="studentClass" value="10-А" placeholder="Класс"><input id="studentPhone" placeholder="Телефон"><button class="primary" onclick="addStudent()">Сохранить</button></div></section><section class="panel">${studentTable(db.all_students)}</section>`;}

function usersPage(){
  const students=db.all_students;
  const rows=db.users.map(u=>`<tr><td><div class="person"><span class="avatar sm">${esc(u.name.charAt(0))}</span><span><b>${esc(u.name)}</b><small>${esc(u.email)}</small></span></div></td><td><span class="role-tag ${u.role}">${roleName(u.role)}</span></td><td><select onchange="linkUser('${u.id}',this.value)"><option value="">${u.student_id?'Привязан':'Не привязан'}</option>${students.map(s=>`<option value="${s.id}" ${u.student_id===s.id?'selected':''}>${esc(s.name)} · ${esc(s.class_name)}</option>`).join('')}</select></td><td><span class="status ${u.active?'on':'off'}">${u.active?'Активен':'Отключён'}</span></td><td><div class="actions"><button class="icon-btn" onclick="toggleUser('${u.id}',${!u.active})">${u.active?'⏸':'▶'}</button><button class="icon-btn danger-icon" onclick="deleteUser('${u.id}')">⌫</button></div></td></tr>`).join('');
  return `<div class="section-intro"><div><span class="eyebrow">Контроль доступа</span><h2>Пользователи</h2><p>Учителя, ученики и родители. Учитель управляет ролями и доступом.</p></div></div><section class="panel form-panel"><div class="panel-head"><div><span class="eyebrow">Новый аккаунт</span><h3>Создать пользователя</h3></div></div><div class="inline-form four"><input id="userName" placeholder="Имя"><input id="userEmail" type="email" placeholder="Email"><input id="userPassword" type="password" placeholder="Пароль"><select id="userRole"><option value="student">Ученик</option><option value="parent">Родитель</option><option value="teacher">Учитель</option></select><button class="primary" onclick="createUser()">Создать</button></div></section><section class="panel"><div class="table-scroll"><table><thead><tr><th>Пользователь</th><th>Роль</th><th>Ученик</th><th>Статус</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="5">Нет пользователей</td></tr>'}</tbody></table></div></section>`;
}

function gradesPage(){
  const rows=db.grades.map(g=>`<tr><td><b>${esc(g.student_name)}</b></td><td>${esc(g.subject_name)}</td><td><span class="grade grade-${g.value>=8?'high':g.value>=6?'mid':'low'}">${g.value}</span></td><td>${esc(g.comment||'—')}</td><td><button class="icon-btn danger-icon" onclick="deleteGrade(${g.id})">⌫</button></td></tr>`).join('');
  return `<div class="section-intro"><div><span class="eyebrow">Электронный журнал</span><h2>Оценки</h2><p>Оценивание по шкале 1–10 и комментарии.</p></div></div><section class="panel form-panel"><div class="panel-head"><h3>Новая оценка</h3></div><div class="inline-form four"><select id="gradeStudent">${db.all_students.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select><select id="gradeSubject">${db.subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select><input id="gradeValue" type="number" min="1" max="10" value="10"><input id="gradeComment" placeholder="Комментарий"><button class="primary" onclick="addGrade()">Сохранить</button></div></section><section class="panel"><div class="table-scroll"><table><thead><tr><th>Ученик</th><th>Предмет</th><th>Оценка</th><th>Комментарий</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="5">Нет оценок</td></tr>'}</tbody></table></div></section>`;
}

function schedulePage(){
  const teacherOptions=db.users.filter(u=>u.role==='teacher').map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('');
  const grouped=days.slice(1).map((day,i)=>{const items=db.schedule.filter(x=>x.day_of_week===i+1);return `<div class="day-card"><div class="day-title"><span>${days[i+1]}</span><b>${items.length}</b></div>${items.length?items.map(x=>`<div class="lesson"><div class="lesson-num">${x.lesson_number}</div><div><b>${esc(x.subject_name)}</b><small>${esc(x.start_time)}–${esc(x.end_time)} · ${esc(x.room||'Кабинет не указан')}</small></div><span class="lesson-class">${esc(x.class_name)}</span><button class="icon-btn danger-icon" onclick="deleteSchedule(${x.id})">⌫</button></div>`).join(''):'<div class="muted-line">Нет уроков</div>'}</div>`;}).join('');
  return `<div class="section-intro"><div><span class="eyebrow">Организация учебного дня</span><h2>Расписание</h2><p>Уроки, кабинеты, классы и преподаватели.</p></div></div><section class="panel form-panel"><div class="panel-head"><h3>Добавить урок</h3></div><div class="inline-form six"><select id="schDay"><option value="1">Пн</option><option value="2">Вт</option><option value="3">Ср</option><option value="4">Чт</option><option value="5">Пт</option><option value="6">Сб</option></select><input id="schNum" type="number" min="1" max="12" value="1" placeholder="№"><input id="schStart" value="08:00"><input id="schEnd" value="08:45"><select id="schSubject">${db.subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select><input id="schClass" value="10-А" placeholder="Класс"><input id="schRoom" placeholder="Кабинет"><select id="schTeacher"><option value="">Текущий учитель</option>${teacherOptions}</select><button class="primary" onclick="addSchedule()">Добавить</button></div></section><div class="schedule-grid">${grouped}</div>`;
}

function homeworkPage(){
  const cards=db.homework.map(h=>`<article class="homework-card"><div class="hw-top"><span class="tag">${esc(h.subject_name)}</span><span class="due">до ${esc(h.due_date)}</span></div><h3>${esc(h.title)}</h3><p>${esc(h.description||'Описание не добавлено')}</p><div class="hw-bottom"><span>${esc(h.class_name)}</span><span>${esc(h.teacher_name||'Учитель')}</span><button class="icon-btn danger-icon" onclick="deleteHomework(${h.id})">⌫</button></div></article>`).join('');
  return `<div class="section-intro"><div><span class="eyebrow">Учебные задания</span><h2>Домашние задания</h2><p>Постановка и контроль сроков выполнения.</p></div></div>${session.role==='teacher'?`<section class="panel form-panel"><div class="panel-head"><h3>Новое задание</h3></div><div class="form-grid four"><label>Предмет<select id="hwSubject">${db.subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label><label>Класс<input id="hwClass" value="10-А"></label><label>Срок<input id="hwDue" type="date"></label><label>Название<input id="hwTitle" placeholder="Например: упражнения 1–5"></label><label class="full">Описание<textarea id="hwDesc" placeholder="Что нужно сделать?"></textarea></label><button class="primary full" onclick="addHomework()">Опубликовать задание</button></div></section>`:''}<div class="homework-grid">${cards||'<div class="empty-state large"><div>✓</div><h3>Заданий пока нет</h3><p>Новые задания появятся здесь.</p></div>'}</div>`;
}

function homeworkList(items){if(!items.length)return '<div class="empty-state"><div>✓</div><p>Нет ближайших заданий.</p></div>';return `<div class="mini-list">${items.map(h=>`<div class="mini-item"><span class="mini-icon">✓</span><div><b>${esc(h.title)}</b><small>${esc(h.subject_name)} · до ${esc(h.due_date)}</small></div></div>`).join('')}</div>`;}

function messagesPage(){
  const unread=db.messages.filter(m=>m.receiver_id===session.id&&!m.read_at).length;
  let recipients=[];
  if(session.role==='teacher') recipients=db.users.filter(u=>u.id!==session.id);
  else {
    const ids=[...new Set(db.subjects.map(s=>s.teacher_id).filter(Boolean))];
    recipients=ids.map(id=>({id,name:'Учитель',email:'',role:'teacher'}));
  }
  const rows=db.messages.map(m=>`<div class="message ${m.receiver_id===session.id?'incoming':'outgoing'}"><div class="message-avatar">${esc((m.sender_name||'?').charAt(0))}</div><div class="message-body"><div class="message-meta"><b>${esc(m.sender_id===session.id?'Вы':m.sender_name)}</b><span>${esc(new Date(m.created_at).toLocaleString('ru-RU'))}</span></div><p>${esc(m.text)}</p>${m.receiver_id===session.id&&!m.read_at?`<button class="read-link" onclick="readMessage(${m.id})">Отметить прочитанным</button>`:''}</div></div>`).join('');
  return `<div class="section-intro"><div><span class="eyebrow">Коммуникация</span><h2>Сообщения ${unread?`<span class="count-badge">${unread}</span>`:''}</h2><p>Прямая связь между участниками учебного процесса.</p></div></div><section class="message-compose panel"><div class="compose-icon">✉</div><div class="compose-form"><select id="messageReceiver">${recipients.map(r=>`<option value="${r.id}">${esc(r.name)} · ${roleName(r.role)}</option>`).join('')}</select><textarea id="messageText" placeholder="Напишите сообщение..."></textarea><button class="primary" onclick="sendMessage()">Отправить →</button></div></section><section class="panel"><div class="panel-head"><h3>Диалог</h3></div><div class="messages">${rows||'<div class="empty-state"><div>✉</div><p>Сообщений пока нет.</p></div>'}</div></section>`;
}

function gradeTable(items){return items.length?`<div class="table-scroll"><table><thead><tr><th>Предмет</th><th>Оценка</th><th>Комментарий</th></tr></thead><tbody>${items.map(g=>`<tr><td><b>${esc(g.subject_name)}</b></td><td><span class="grade grade-${g.value>=8?'high':g.value>=6?'mid':'low'}">${g.value}</span></td><td>${esc(g.comment||'—')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state"><div>◆</div><p>Оценок пока нет.</p></div>';}
function notifications(){return db.notifications.length?`<div class="activity-list">${db.notifications.slice(0,6).map(n=>`<div class="activity"><span class="activity-dot"></span><div><b>${esc(n.text)}</b><small>${esc(new Date(n.created_at).toLocaleString('ru-RU'))}</small></div></div>`).join('')}</div>`:'<div class="empty-state"><p>Нет новых событий.</p></div>';}

function openStudentForm(){const el=document.querySelector('#studentForm');if(el)el.hidden=false;document.querySelector('#studentName')?.focus();}
async function addStudent(){const name=document.querySelector('#studentName')?.value.trim(),class_name=document.querySelector('#studentClass')?.value.trim()||'10-А',phone=document.querySelector('#studentPhone')?.value.trim()||'';if(!name)return toast('Введите имя');try{await api('/api/students',{method:'POST',body:JSON.stringify({name,class_name,phone})});await loadDashboard();render();toast('Ученик добавлен')}catch(e){toast(e.message)}}
async function editStudent(id){const s=db.all_students.find(x=>x.id===id);if(!s)return;const name=prompt('Имя ученика',s.name);if(name===null)return;const cls=prompt('Класс',s.class_name);if(cls===null)return;try{await api(`/api/students/${id}`,{method:'PATCH',body:JSON.stringify({name,class_name:cls,phone:s.phone||''})});await loadDashboard();render();toast('Профиль обновлён')}catch(e){toast(e.message)}}
async function createUser(){const name=document.querySelector('#userName')?.value.trim(),email=document.querySelector('#userEmail')?.value.trim(),password=document.querySelector('#userPassword')?.value,role=document.querySelector('#userRole')?.value;if(!name||!email||!password)return toast('Заполните все поля');try{await api('/api/users',{method:'POST',body:JSON.stringify({name,email,password,role,class_name:'10-А'})});await loadDashboard();render();toast('Аккаунт создан')}catch(e){toast(e.message)}}
async function toggleUser(id,active){try{await api(`/api/users/${id}`,{method:'PATCH',body:JSON.stringify({active})});await loadDashboard();render();toast(active?'Доступ включён':'Доступ отключён')}catch(e){toast(e.message)}}
async function linkUser(id,student_id){if(!student_id)return;try{await api(`/api/users/${id}`,{method:'PATCH',body:JSON.stringify({student_id})});await loadDashboard();render();toast('Привязка обновлена')}catch(e){toast(e.message)}}
async function deleteUser(id){if(!confirm('Удалить пользователя?'))return;try{await api(`/api/users/${id}`,{method:'DELETE'});await loadDashboard();render();toast('Пользователь удалён')}catch(e){toast(e.message)}}
async function addGrade(){const student_id=document.querySelector('#gradeStudent')?.value,subject_id=document.querySelector('#gradeSubject')?.value,value=Number(document.querySelector('#gradeValue')?.value),comment=document.querySelector('#gradeComment')?.value||'';if(!student_id||!subject_id||value<1||value>10)return toast('Проверьте данные оценки');try{await api('/api/grades',{method:'POST',body:JSON.stringify({student_id,subject_id,value,comment})});await loadDashboard();render();toast('Оценка сохранена')}catch(e){toast(e.message)}}
async function deleteGrade(id){if(!confirm('Удалить оценку?'))return;try{await api(`/api/grades/${id}`,{method:'DELETE'});await loadDashboard();render();toast('Оценка удалена')}catch(e){toast(e.message)}}
async function addSchedule(){const payload={day_of_week:Number(document.querySelector('#schDay').value),lesson_number:Number(document.querySelector('#schNum').value),start_time:document.querySelector('#schStart').value,end_time:document.querySelector('#schEnd').value,subject_id:document.querySelector('#schSubject').value,class_name:document.querySelector('#schClass').value.trim(),room:document.querySelector('#schRoom').value.trim(),teacher_id:document.querySelector('#schTeacher').value||null};if(!payload.class_name)return toast('Укажите класс');try{await api('/api/schedule',{method:'POST',body:JSON.stringify(payload)});await loadDashboard();render();toast('Урок добавлен')}catch(e){toast(e.message)}}
async function deleteSchedule(id){if(!confirm('Удалить урок?'))return;try{await api(`/api/schedule/${id}`,{method:'DELETE'});await loadDashboard();render();toast('Урок удалён')}catch(e){toast(e.message)}}
async function addHomework(){const payload={subject_id:document.querySelector('#hwSubject').value,class_name:document.querySelector('#hwClass').value.trim(),due_date:document.querySelector('#hwDue').value,title:document.querySelector('#hwTitle').value.trim(),description:document.querySelector('#hwDesc').value.trim()};if(!payload.title||!payload.due_date||!payload.class_name)return toast('Заполните название, класс и срок');try{await api('/api/homework',{method:'POST',body:JSON.stringify(payload)});await loadDashboard();render();toast('Задание опубликовано')}catch(e){toast(e.message)}}
async function deleteHomework(id){if(!confirm('Удалить задание?'))return;try{await api(`/api/homework/${id}`,{method:'DELETE'});await loadDashboard();render();toast('Задание удалено')}catch(e){toast(e.message)}}
async function sendMessage(){const receiver_id=document.querySelector('#messageReceiver')?.value,text=document.querySelector('#messageText')?.value.trim();if(!receiver_id||!text)return toast('Выберите получателя и напишите сообщение');try{await api('/api/messages',{method:'POST',body:JSON.stringify({receiver_id,text})});await loadDashboard();render();toast('Сообщение отправлено')}catch(e){toast(e.message)}}
async function readMessage(id){try{await api(`/api/messages/${id}/read`,{method:'POST'});await loadDashboard();render()}catch(e){toast(e.message)}}
async function sync(){try{await api('/api/sync',{method:'POST'});await loadDashboard();render();toast('Синхронизация завершена')}catch(e){toast(e.message)}}

function render(){if(!session){app.innerHTML=authScreen();return}app.innerHTML=layout();}

(async function boot(){
  if(token()){
    try{await loadDashboard();}
    catch(_){localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(SESSION_KEY);session=null;}
  }
  render();
})();
