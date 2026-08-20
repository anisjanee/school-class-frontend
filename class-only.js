(() => {
  // Внутренне проект работает только с одним классом.
  // Название класса не показывается пользователю в интерфейсе.
  const CLASS_NAME = '10-А';
  window.SCHOOL_CLASS = CLASS_NAME;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    let body = init.body;
    if (typeof body === 'string') {
      try {
        const data = JSON.parse(body);
        const url = typeof input === 'string' ? input : input.url;
        if (/\/api\/(users|students|schedule|homework)(\/|$)/.test(url) && data && typeof data === 'object') {
          data.class_name = CLASS_NAME;
          init = { ...init, body: JSON.stringify(data) };
        }
      } catch (_) {}
    }

    const response = await originalFetch(input, init);
    const url = typeof input === 'string' ? input : input.url;
    if (!url.includes('/api/dashboard')) return response;

    try {
      const payload = await response.clone().json();
      const sameClass = item => !item || !item.class_name || item.class_name === CLASS_NAME;
      if (Array.isArray(payload.students)) payload.students = payload.students.filter(sameClass);
      if (Array.isArray(payload.all_students)) payload.all_students = payload.all_students.filter(sameClass);
      if (Array.isArray(payload.schedule)) payload.schedule = payload.schedule.filter(sameClass);
      if (Array.isArray(payload.homework)) payload.homework = payload.homework.filter(sameClass);
      if (Array.isArray(payload.subjects)) payload.subjects = payload.subjects.filter(s => !s.class_name || sameClass(s));
      return new Response(JSON.stringify(payload), { status: response.status, statusText: response.statusText, headers: response.headers });
    } catch (_) {
      return response;
    }
  };

  // Пользовательский интерфейс намеренно не показывает название класса.
  // Ограничение класса остаётся внутренним правилом backend/frontend.
  function hideInternalClassLabel() {
    if (document.title.includes(CLASS_NAME)) document.title = 'Электронный дневник';

    document.querySelectorAll('input[id="uc"], input[id="sc"], input[id="hc"]').forEach(el => {
      el.value = '';
      el.placeholder = 'Класс';
      el.readOnly = true;
      el.setAttribute('aria-label', 'Класс');
    });

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && node.nodeValue.includes(CLASS_NAME)) nodes.push(node);
    }
    nodes.forEach(textNode => {
      textNode.nodeValue = textNode.nodeValue.split(CLASS_NAME).join('');
    });
  }

  let scheduled = false;
  let observer;
  function scheduleHide() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      observer?.disconnect();
      hideInternalClassLabel();
      observer?.observe(document.body, { childList: true, subtree: true });
    });
  }

  function start() {
    hideInternalClassLabel();
    observer = new MutationObserver(scheduleHide);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.applySchoolClassUI = hideInternalClassLabel;
})();
