(() => {
  // Внутренне проект работает только с одним классом.
  // Название класса никогда не показывается пользователю.
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
      for (const key of ['students', 'all_students', 'schedule', 'homework']) {
        if (Array.isArray(payload[key])) payload[key] = payload[key].filter(sameClass);
      }
      if (Array.isArray(payload.subjects)) payload.subjects = payload.subjects.filter(s => !s.class_name || sameClass(s));
      return new Response(JSON.stringify(payload), { status: response.status, statusText: response.statusText, headers: response.headers });
    } catch (_) {
      return response;
    }
  };

  // Убираем название внутреннего класса из динамически созданного интерфейса.
  function hideInternalClassLabel() {
    document.querySelectorAll('input[id="uc"], input[id="sc"], input[id="hc"]').forEach(el => {
      el.value = '';
      el.placeholder = 'Класс';
      el.readOnly = true;
      el.setAttribute('aria-label', 'Класс');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideInternalClassLabel, { once: true });
  } else {
    hideInternalClassLabel();
  }

  window.applySchoolClassUI = hideInternalClassLabel;
})();
