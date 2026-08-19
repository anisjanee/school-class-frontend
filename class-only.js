(() => {
  const CLASS_NAME = '10-А';
  window.SCHOOL_CLASS = CLASS_NAME;

  // Ограничиваем все записи frontend одним классом.
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

      return new Response(JSON.stringify(payload), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } catch (_) {
      return response;
    }
  };

  // ВАЖНО: здесь больше нет MutationObserver.
  // Старый observer бесконечно менял document.title, сам себя запускал снова
  // и из-за этого браузер зависал на странице portal.html.
  function applyClassUI() {
    if (document.title !== '10-А · Электронный дневник') {
      document.title = '10-А · Электронный дневник';
    }

    document.querySelectorAll('input[id="uc"], input[id="sc"], input[id="hc"]').forEach(el => {
      el.value = CLASS_NAME;
      el.readOnly = true;
      el.placeholder = CLASS_NAME;
      el.setAttribute('aria-label', 'Класс: 10-А');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyClassUI, { once: true });
  } else {
    applyClassUI();
  }

  window.applySchoolClassUI = applyClassUI;
})();
