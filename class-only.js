(() => {
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
          if ('class_name' in data || /\/api\/(users|students|schedule|homework)$/.test(url)) data.class_name = CLASS_NAME;
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

      return new Response(JSON.stringify(payload), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } catch (_) {
      return response;
    }
  };

  const applyClassUI = () => {
    document.title = '10-А · Электронный дневник';
    document.querySelectorAll('input[id="uc"], input[id="sc"], input[id="hc"]').forEach(el => {
      el.value = CLASS_NAME;
      el.readOnly = true;
      el.placeholder = CLASS_NAME;
      el.setAttribute('aria-label', 'Класс: 10-А');
    });
    document.querySelectorAll('input, select').forEach(el => {
      if (el.value === '10-А') el.value = CLASS_NAME;
    });
    document.querySelectorAll('body *').forEach(el => {
      if (el.children.length === 0 && el.textContent.trim() === 'Школьный журнал') {
        el.textContent = '10-А · Электронный дневник';
      }
    });
  };

  new MutationObserver(applyClassUI).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', applyClassUI);
})();
