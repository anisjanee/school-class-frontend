/* Parent module: child tracking, schedule, homework and account linking. */
(function(){
  const TOKEN='school_journal_token', USER='school_journal_user';
  const token=()=>localStorage.getItem(TOKEN);
  const user=()=>{try{return JSON.parse(localStorage.getItem(USER)||'null')}catch{return null}};
  const esc2=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function api2(path,opt={}){const h={'Content-Type':'application/json'};if(token())h.Authorization='Bearer '+token();const r=await fetch((window.SCHOOL_API_URL||'http://127.0.0.1:8000')+path,{...opt,headers:h});let b={};try{b=await r.json()}catch{}if(!r.ok)throw new Error(b.detail||'Ошибка сервера');return b}
  let d=null, pv='home';
  const oldRender=window.render, oldGo=window.go, oldLogout=window.logout, oldUserModal=window.userModal;
  function isParent(){return user()?.role==='parent'}
  function parentNav(){return [['home','⌂','Главная'],['child','👨‍👩‍👧','Мой ребёнок'],['schedule','📅','Расписание'],['homework','✓','Домашние задания'],['messages','✉','Сообщения']];}
  async function loadParent(){d=await api2('/api/dashboard');return d}
  function parentPage(){
    const u=user();
    if(!d)return '<div class="parent-loading">Загрузка данных…</div>';
    const child=d.students?.[0];
    let body='';
    if(pv==='home') body=home(child);
    if(pv==='child') body=childPage(child);
    if(pv==='schedule') body=schedule(child);
    if(pv==='homework') body=homework(child);
    if(pv==='messages') body=messages();
    return `<div class="parent-shell"><aside><div class="parent-brand"><b>✦ School Journal</b><small>Родительский кабинет</small></div><nav>${parentNav().map(x=>`<button class="parent-nav ${pv===x[0]?'active':''}" data-pv="${x[0]}"><span>${x[1]}</span>${x[2]}</button>`).join('')}</nav><div class="parent-user"><b>${esc2(u?.name)}</b><small>Родитель</small><button id="parent-logout">Выйти</button></div></aside><main><header><div><small>Родительский кабинет</small><h1>${({home:'Главная',child:'Мой ребёнок',schedule:'Расписание',homework:'Домашние задания',messages:'Сообщения'})[pv]}</h1></div><button id="parent-refresh">↻ Обновить</button></header><section>${body}</section></main></div>`;
  }
  function home(s){
    if(!s)return `<div class="parent-empty-hero"><span>👨‍👩‍👧</span><div><small>РОДИТЕЛЬСКИЙ КАБИНЕТ</small><h2>Ребёнок ещё не привязан</h2><p>Попросите администратора открыть ваш аккаунт и выбрать ученика. После привязки здесь автоматически появятся расписание, домашние задания и учебный прогресс.</p></div></div>`;
    const g=d.grades||[],avg=g.length?(g.reduce((a,x)=>a+Number(x.value),0)/g.length).toFixed(1):'—';
    return `<div class="parent-hero2"><div><small>УЧЕБНЫЙ ПРОГРЕСС</small><h2>Здравствуйте! 👋</h2><p><strong>${esc2(s.name)}</strong></p><p>Вся важная информация о ребёнке собрана в одном месте.</p></div><button data-pv="child">Открыть профиль →</button></div><div class="parent-kpis"><div><strong>${avg}</strong><span>Средний балл</span></div><div><strong>${d.schedule?.length||0}</strong><span>Уроков</span></div><div><strong>${d.homework?.length||0}</strong><span>Домашних заданий</span></div><div><strong>${d.messages?.length||0}</strong><span>Сообщений</span></div></div><div class="parent-cols"><section><h2>Ближайшие уроки</h2>${(d.schedule||[]).slice(0,5).map(x=>`<div class="p-row"><span><b>${esc2(x.subject_name)}</b><small>${x.start_time}–${x.end_time}</small></span><strong>${esc2(x.room||'')}</strong></div>`).join('')||'<p class="muted">Расписание пока не заполнено.</p>'}</section><section><h2>Последние оценки</h2>${g.slice(0,5).map(x=>`<div class="p-row"><span>${esc2(x.subject_name)}</span><strong>${x.value}</strong></div>`).join('')||'<p class="muted">Оценок пока нет.</p>'}</section></div>`;
  }
  function childPage(s){
    if(!s)return home(s);
    const g=d.grades||[],avg=g.length?(g.reduce((a,x)=>a+Number(x.value),0)/g.length).toFixed(1):'—';
    return `<div class="child-profile"><div class="child-card"><div class="child-avatar">${esc2(s.name).slice(0,1).toUpperCase()}</div><div><small>РЕБЁНОК</small><h2>${esc2(s.name)}</h2><p>Учебный профиль</p></div></div><div class="parent-kpis"><div><strong>${avg}</strong><span>Средний балл</span></div><div><strong>${g.length}</strong><span>Оценок</span></div><div><strong>${d.homework?.length||0}</strong><span>Заданий</span></div><div><strong>${d.schedule?.length||0}</strong><span>Уроков</span></div></div><div class="parent-cols"><section><h2>Успеваемость</h2>${g.slice(0,12).map(x=>`<div class="p-row"><span><b>${esc2(x.subject_name)}</b><small>${esc2(x.comment||'')}</small></span><strong class="grade-pill">${x.value}</strong></div>`).join('')||'<p class="muted">Оценок пока нет.</p>'}</section><section><h2>Расписание</h2>${(d.schedule||[]).slice(0,12).map(x=>`<div class="p-row"><span><b>${esc2(x.subject_name)}</b><small>${x.start_time}–${x.end_time}</small></span><strong>${esc2(x.room||'')}</strong></div>`).join('')||'<p class="muted">Расписание пока не заполнено.</p>'}</section></div></div>`;
  }
  function schedule(){
    const days=['','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];const groups={};(d.schedule||[]).forEach(x=>(groups[x.day_of_week]??=[]).push(x));
    return `<div class="schedule-intro"><h2>Расписание ребёнка</h2><p>Уроки автоматически загружаются из школьного расписания.</p></div><div class="parent-week">${[1,2,3,4,5,6].map(i=>`<section><h3>${days[i]}</h3>${(groups[i]||[]).map(x=>`<article><time>${x.start_time}</time><div><b>${esc2(x.subject_name)}</b><small>${x.end_time}${x.room?' · каб. '+esc2(x.room):''}</small></div></article>`).join('')||'<p class="muted">Нет уроков</p>'}</section>`).join('')}</div>`;
  }
  function homework(){return `<div class="schedule-intro"><h2>Домашние задания</h2><p>Задания, которые относятся к учебной группе ребёнка.</p></div><div class="parent-homework">${(d.homework||[]).map(x=>`<article><div class="hw-icon">✓</div><div><b>${esc2(x.title)}</b><p>${esc2(x.description||'')}</p><small>${esc2(x.subject_name)} · срок ${esc2(x.due_date)}</small></div></article>`).join('')||'<div class="empty-box">Домашних заданий пока нет.</div>'}</div>`;}
  function messages(){return `<div class="schedule-intro"><h2>Сообщения</h2><p>Связь с учителями и администрацией.</p></div><div class="parent-messages">${(d.messages||[]).map(x=>`<article><b>${esc2(x.sender_name)}</b><small>${esc2(x.created_at||'')}</small><p>${esc2(x.text)}</p></article>`).join('')||'<div class="empty-box">Сообщений пока нет.</div>'}</div>`;}
  async function renderParent(){if(!isParent())return;try{await loadParent()}catch(e){document.getElementById('app').innerHTML='<div class="parent-error">Не удалось загрузить данные. Проверьте, что backend запущен.</div>';return}document.getElementById('app').innerHTML=parentPage();bindParent();}
  function bindParent(){document.querySelectorAll('[data-pv]').forEach(b=>b.onclick=()=>{pv=b.dataset.pv;renderParent()});document.getElementById('parent-refresh')?.addEventListener('click',renderParent);document.getElementById('parent-logout')?.addEventListener('click',()=>{oldLogout();pv='home'});}
  window.render=function(){oldRender();if(isParent())renderParent()};
  window.go=function(v){if(isParent()){pv=v==='grades'?'child':v;renderParent();return}oldGo(v)};
  window.sync=function(){if(isParent())return renderParent();return window.sync};

  /* Admin: when creating a parent, explicitly choose the child. */
  window.userModal=function(){
    oldUserModal();
    if(!document.getElementById('ur'))return;
    const role=document.getElementById('ur');
    const wrap=role.parentElement;
    const box=document.createElement('label');box.id='parent-child-box';box.style.display='none';box.innerHTML='<span>Ребёнок</span><select id="parent-child"><option value="">Выберите ученика</option></select>';
    wrap.after(box);
    const loadChildren=async()=>{try{const x=await api2('/api/dashboard');const s=x.all_students||[];document.getElementById('parent-child').innerHTML='<option value="">Выберите ученика</option>'+s.map(v=>`<option value="${v.id}">${esc2(v.name)}</option>`).join('')}catch{}};
    const toggle=()=>{box.style.display=role.value==='parent'?'block':'none';if(role.value==='parent')loadChildren()};
    role.addEventListener('change',toggle);toggle();
  };
  const oldCreate=window.createUser;
  window.createUser=async function(){
    const role=document.getElementById('ur')?.value;
    if(role!=='parent')return oldCreate();
    const student_id=document.getElementById('parent-child')?.value;
    if(!student_id)return window.notify?.('Выберите ребёнка для родителя',true);
    try{await api2('/api/users',{method:'POST',body:JSON.stringify({name:document.getElementById('un').value,email:document.getElementById('ue').value,password:document.getElementById('up').value,role:'parent',student_id,class_name:''})});window.closeModal();await window.sync();window.notify?.('Родитель создан и привязан к ребёнку')}catch(e){window.notify?.(e.message,true)}
  };

  const css=document.createElement('style');css.textContent=`.parent-shell{min-height:100vh;display:flex;background:#f5f7fb;color:#172033}.parent-shell aside{width:250px;background:#101827;color:#fff;padding:22px;display:flex;flex-direction:column}.parent-brand{font-size:18px;margin-bottom:30px}.parent-brand small,.parent-user small{display:block;color:#94a3b8;margin-top:5px}.parent-nav{width:100%;border:0;background:transparent;color:#cbd5e1;text-align:left;padding:13px;border-radius:12px;margin:3px 0;cursor:pointer;font-size:15px}.parent-nav span{display:inline-block;width:30px}.parent-nav.active,.parent-nav:hover{background:#3159e8;color:#fff}.parent-user{margin-top:auto;border-top:1px solid #334155;padding-top:18px}.parent-user button{margin-top:10px;border:0;background:#334155;color:#fff;border-radius:9px;padding:9px 13px;cursor:pointer}.parent-shell main{flex:1;min-width:0}.parent-shell header{height:82px;background:#fff;border-bottom:1px solid #e5e7eb;padding:18px 28px;display:flex;justify-content:space-between;align-items:center}.parent-shell header h1{margin:4px 0}.parent-shell header button{border:1px solid #dbe1ea;background:#fff;border-radius:10px;padding:10px 14px;cursor:pointer}.parent-shell main>section{padding:28px;max-width:1250px}.parent-hero2,.parent-empty-hero{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:32px;border-radius:25px;color:#fff;background:linear-gradient(135deg,#3159e8,#7849e8);box-shadow:0 18px 45px #4555b433}.parent-hero2 h2,.parent-empty-hero h2{font-size:30px;margin:8px 0}.parent-hero2 p,.parent-empty-hero p{color:#eef2ff}.parent-hero2 button{background:#fff;color:#2948bd;border:0;border-radius:12px;padding:13px 17px;font-weight:700;cursor:pointer}.parent-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:18px 0}.parent-kpis>div{background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:20px}.parent-kpis strong{display:block;font-size:28px}.parent-kpis span{display:block;color:#718096;font-size:12px;margin-top:5px}.parent-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}.parent-cols>section{background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:22px}.parent-cols h2{margin-top:0}.p-row{display:flex;justify-content:space-between;align-items:center;padding:13px 0;border-bottom:1px solid #eef2f7}.p-row:last-child{border-bottom:0}.p-row small{display:block;color:#718096;margin-top:4px}.grade-pill{min-width:34px;height:34px;border-radius:10px;background:#edf2ff;color:#3159d9;display:grid;place-items:center}.child-card{display:flex;align-items:center;gap:15px;background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:24px}.child-card h2{margin:5px 0}.child-avatar{width:58px;height:58px;border-radius:17px;background:#edf2ff;color:#3159d9;display:grid;place-items:center;font-weight:800;font-size:23px}.parent-week{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:18px}.parent-week>section{background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:18px}.parent-week h3{margin-top:0}.parent-week article{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #eef2f7}.parent-week article:last-child{border-bottom:0}.parent-week time{color:#3159d9;font-weight:800;min-width:48px}.parent-week small{display:block;color:#718096;margin-top:4px}.schedule-intro{margin-bottom:18px}.schedule-intro h2{margin-bottom:5px}.schedule-intro p,.muted{color:#718096}.parent-homework,.parent-messages{display:grid;gap:12px}.parent-homework article,.parent-messages article,.empty-box{background:#fff;border:1px solid #e5e7eb;border-radius:17px;padding:18px}.parent-homework article{display:flex;gap:15px}.hw-icon{width:40px;height:40px;border-radius:12px;background:#eaf8ef;color:#198754;display:grid;place-items:center;font-weight:800}.parent-messages small{display:block;color:#8a94a5;margin-top:4px}.parent-messages p{line-height:1.5}.parent-error{min-height:100vh;display:grid;place-items:center;font-size:18px;color:#b42318}.parent-loading{padding:50px;text-align:center}@media(max-width:900px){.parent-week,.parent-cols{grid-template-columns:1fr}.parent-kpis{grid-template-columns:1fr 1fr}}@media(max-width:760px){.parent-shell aside{width:72px;padding:12px}.parent-brand b,.parent-brand small,.parent-nav:not(.active),.parent-user b,.parent-user small{font-size:0}.parent-shell header,.parent-shell main>section{padding:16px}.parent-hero2,.parent-empty-hero{display:block}.parent-hero2 button{margin-top:15px}}`;
  document.head.appendChild(css);
  if(isParent())renderParent();
})();
