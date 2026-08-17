const API_BASE = window.SCHOOL_API_URL || 'http://127.0.0.1:8000';
const TOKEN_KEY = 'school_journal_api_token';
let session = JSON.parse(localStorage.getItem('school_journal_session') || 'null');
let db = { students: [], subjects: [], grades: [], notifications: [] };

const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const toast = m => { const x = document.querySelector('#toast'); if (!x) return; x.textContent = m; x.classList.add('show'); setTimeout(() => x.classList.remove('show'), 1800); };
const token = () => localStorage.getItem(TOKEN_KEY);

async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token()) headers.Authorization = `Bearer ${token()}`;
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
    return data;
}

function avg(id) {
    const a = db.grades.filter(g => g.student_id === id);
    return a.length ? (a.reduce((s, g) => s + Number(g.value), 0) / a.length).toFixed(2) : '0.00';
}

function studentForUser(u) {
    const id = u.role === 'student' ? u.id : u.student_id;
    return db.students.find(s => s.id === id) || db.students[0];
}

function ai(s) {
    if (!s) return 'Нет данных.';
    const grades = db.grades.filter(x => x.student_id === s.id);
    const low = grades.filter(x => Number(x.value) <= 5).length;
    const a = avg(s.id);
    return `Средний балл: ${a}. ${low ? `Низких оценок: ${low}. Рекомендуется повторить соответствующие темы.` : 'Успеваемость стабильная. Можно повышать сложность заданий.'}`;
}

async function loadDashboard() {
    const data = await api('/api/dashboard');
    session = data.user;
    db = { students: data.students || [], subjects: data.subjects || [], grades: data.grades || [], notifications: data.notifications || [] };
    localStorage.setItem('school_journal_session', JSON.stringify(session));
}

async function login() {
    const e = document.querySelector('#email').value.trim();
    const p = document.querySelector('#password').value;
    if (!e || !p) return toast('Введите email и пароль');
    try {
        const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: e, password: p }) });
        localStorage.setItem(TOKEN_KEY, data.token);
        await loadDashboard();
        render();
    } catch (err) { toast(err.message); }
}

async function logout() {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch (_) {}
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('school_journal_session');
    session = null;
    db = { students: [], subjects: [], grades: [], notifications: [] };
    render();
}

function report(s) {
    if (!s) return '<div class="card"><p>Нет данных ученика.</p></div>';
    return `<div class="card"><h2>📄 Отчёт: ${esc(s.name)}</h2><p>Средний балл: <b>${avg(s.id)}</b></p><p>Оценок: <b>${db.grades.filter(g => g.student_id === s.id).length}</b></p><button onclick="window.print()">Печать / PDF</button></div>`;
}

function teacher() {
    const rows = db.students.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(s.class_name)}</td><td>${avg(s.id)}</td></tr>`).join('');
    const notices = db.notifications.map(n => `<li>${esc(n.text)}</li>`).join('') || '<li>Нет уведомлений</li>';
    return `<div class="grid">
        <div class="stat">Ученики<strong>${db.students.length}</strong></div>
        <div class="stat">Предметы<strong>${db.subjects.length}</strong></div>
        <div class="stat">Оценки<strong>${db.grades.length}</strong></div>
        <div class="stat">Уведомления<strong>${db.notifications.length}</strong></div>
    </div>
    <div class="card"><h2>👨‍🎓 Ученики</h2><table class="table"><tr><th>Имя</th><th>Класс</th><th>Средний</th></tr>${rows}</table></div>
    <div class="card"><h2>➕ Добавить ученика</h2><div class="row"><input id="newStudent" placeholder="Имя"><input id="newClass" placeholder="Класс" value="10-А"><button onclick="addStudent()">Добавить</button></div></div>
    <div class="card"><h2>📚 Добавить предмет</h2><div class="row"><input id="newSubject" placeholder="Название предмета"><button onclick="addSubject()">Добавить</button></div></div>
    <div class="card"><h2>📝 Добавить оценку</h2><div class="row"><select id="gradeStudent">${db.students.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select><select id="gradeSubject">${db.subjects.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select><input id="gradeValue" type="number" min="1" max="10" value="10"><button onclick="addGrade()">Сохранить</button></div></div>
    <div class="card"><h2>🔔 Уведомления</h2><div class="row"><input id="notice" placeholder="Текст"><button onclick="addNotice()">Отправить</button></div><ul>${notices}</ul></div>`;
}

function family(u) {
    const s = studentForUser(u);
    if (!s) return '<div class="card"><h2>Нет привязанного ученика</h2></div>';
    const grades = db.grades.filter(g => g.student_id === s.id).map(g => {
        const subject = db.subjects.find(x => x.id === g.subject_id);
        return `<tr><td>${esc(subject?.name || g.subject_id)}</td><td>${esc(g.value)}</td><td>${esc(g.comment)}</td></tr>`;
    }).join('');
    return `<div class="grid"><div class="stat">Средний балл<strong>${avg(s.id)}</strong></div><div class="stat">Оценок<strong>${db.grades.filter(g => g.student_id === s.id).length}</strong></div></div>
        ${report(s)}<div class="card"><h2>📝 Оценки</h2><table class="table"><tr><th>Предмет</th><th>Оценка</th><th>Комментарий</th></tr>${grades || '<tr><td colspan="3">Нет оценок</td></tr>'}</table></div>
        <div class="card"><h2>🤖 AI-анализ</h2><p>${esc(ai(s))}</p></div>`;
}

async function addStudent() {
    const name = document.querySelector('#newStudent').value.trim();
    const className = document.querySelector('#newClass').value.trim() || '10-А';
    if (!name) return toast('Введите имя');
    try { await api('/api/students', { method: 'POST', body: JSON.stringify({ name, class_name: className }) }); await loadDashboard(); render(); toast('Ученик добавлен'); } catch (e) { toast(e.message); }
}

async function addSubject() {
    const name = document.querySelector('#newSubject').value.trim();
    if (!name) return toast('Введите название предмета');
    try { await api('/api/subjects', { method: 'POST', body: JSON.stringify({ name }) }); await loadDashboard(); render(); toast('Предмет добавлен'); } catch (e) { toast(e.message); }
}

async function addGrade() {
    const student_id = document.querySelector('#gradeStudent').value;
    const subject_id = document.querySelector('#gradeSubject').value;
    const value = Number(document.querySelector('#gradeValue').value);
    if (!student_id || !subject_id || value < 1 || value > 10) return toast('Проверьте оценку');
    try { await api('/api/grades', { method: 'POST', body: JSON.stringify({ student_id, subject_id, value }) }); await loadDashboard(); render(); toast('Оценка сохранена'); } catch (e) { toast(e.message); }
}

async function addNotice() {
    const el = document.querySelector('#notice');
    const text = el.value.trim();
    if (!text) return toast('Введите текст');
    try { await api('/api/notifications', { method: 'POST', body: JSON.stringify({ text }) }); await loadDashboard(); render(); toast('Уведомление отправлено'); } catch (e) { toast(e.message); }
}

async function sync() {
    try { await api('/api/sync', { method: 'POST' }); await loadDashboard(); render(); toast('☁️ Синхронизация завершена'); }
    catch (e) { toast(`Ошибка синхронизации: ${e.message}`); }
}

function render() {
    if (!session) {
        app.innerHTML = `<div class="shell"><div class="login card"><h1>📘 School Journal Pro</h1><p>🔐 Авторизация через backend</p><div class="form"><input id="email" placeholder="Email"><input id="password" type="password" placeholder="Пароль"><button onclick="login()">Войти</button></div><div class="notice">Demo: teacher@demo.local / 1234<br>student@demo.local / 1234<br>parent@demo.local / 1234</div><p style="font-size:12px;opacity:.7">API: ${esc(API_BASE)}</p></div></div>`;
        return;
    }
    const body = session.role === 'teacher' ? teacher() : family(session);
    app.innerHTML = `<div class="shell"><div class="top"><div class="brand">📘 School Journal Pro</div><div class="row"><span class="pill">${esc(session.role)}</span><button class="secondary" onclick="sync()">☁️ Синхронизация</button><button class="danger" onclick="logout()">Выйти</button></div></div><div id="content">${body}</div></div>`;
}

(async function boot() {
    if (token()) {
        try { await loadDashboard(); } catch (_) { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem('school_journal_session'); session = null; }
    }
    render();
})();
