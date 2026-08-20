/* Functional UX layer: analytics, search and quick actions */
(function(){
  const originalRender=window.render;
  function avg(list){if(!list.length)return 0;return (list.reduce((a,g)=>a+Number(g.value||0),0)/list.length).toFixed(1)}
  function analytics(){
    if(!window.me||!window.data)return '';
    const grades=window.data.grades||[];
    if(!grades.length)return '<div class="fx-insight"><b>📊 Аналитика</b><span>Пока недостаточно оценок для статистики.</span></div>';
    const a=avg(grades),best=Math.max(...grades.map(g=>Number(g.value||0))),good=grades.filter(g=>Number(g.value)>=7).length;
    return `<div class="fx-insight"><div><b>📊 Быстрая аналитика</b><span>Средний балл <strong>${a}</strong></span></div><div><b>${best}/10</b><span>лучшая оценка</span></div><div><b>${good}</b><span>оценок 7+</span></div></div>`;
  }
  function quick(){
    if(!window.me)return '';
    const actions=[];
    if(me.role==='admin')actions.push(['users','＋ Пользователь']);
    if(me.role==='teacher')actions.push(['grades','⭐ Поставить оценку'],['homework','＋ Домашнее задание']);
    actions.push(['schedule','📅 Расписание'],['messages','✉ Сообщения']);
    return `<div class="fx-quick"><b>Быстрые действия</b><div>${actions.map(a=>`<button onclick="go('${a[0]}')">${a[1]}</button>`).join('')}</div></div>`;
  }
  function search(){
    if(!window.me||!['users','students','subjects','grades','homework','messages'].includes(window.view))return '';
    return '<div class="fx-search"><span>⌕</span><input id="fxSearch" placeholder="Поиск по разделу…" oninput="window.__fxFilter(this.value)"></div>';
  }
  window.__fxFilter=function(q){q=q.trim().toLowerCase();document.querySelectorAll('table tbody tr,.cards>div,.message').forEach(el=>{el.style.display=!q||el.textContent.toLowerCase().includes(q)?'':'none'})};
  window.render=function(){originalRender();setTimeout(function(){
    if(!window.me)return;const section=document.querySelector('main section');if(!section)return;
    if(window.view==='home')section.insertAdjacentHTML('beforeend',quick()+analytics());
    else if(['users','students','subjects','grades','homework','messages'].includes(window.view)){const first=section.firstElementChild;if(first)first.insertAdjacentHTML('afterbegin',search())}
  },0)};
  window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&window.me){e.preventDefault();const i=document.getElementById('fxSearch');if(i){i.focus();i.select()}}});
})();
