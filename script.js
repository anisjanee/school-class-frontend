// ==================== СОХТОРИ МАЪЛУМОТ ====================
let students = [];
let subjects = [];
let dates = [];
let grades = [];        // { studentId, subjectId, dateId, grade, comment }
let attendance = [];    // { studentId, dateId, present }
let timeSlots = [];
let timetable = {};

let currentQuarter = 'year';
let customDateRange = null;
let chartInstance = null;
let rankingChartInstance = null;
let rankingMode = 'subject';
let isDirty = false;

// Забони ҷорӣ
let currentLang = 'tg';

// UI prefs
const STORAGE_KEY = 'journal_v10';
const THEME_KEY = 'journal_theme_v1';

// Undo stack (last destructive action only)
let lastUndo = null; // { type, payload, expiresAt }
let lastActiveElementBeforeModal = null;

// Системаи баҳогузорӣ
const gradeSystem = {
    10: { percent: '91-100', level_tg: 'Дараҷаи аъло', level_ru: 'Отлично', desc_tg: 'Аъло', desc_ru: 'Отлично' },
    9: { percent: '81-90', level_tg: 'Дараҷаи хуб', level_ru: 'Хорошо', desc_tg: 'Олӣ', desc_ru: 'Превосходно' },
    8: { percent: '71-80', level_tg: 'Дараҷаи миёна', level_ru: 'Средний', desc_tg: 'Хубтар', desc_ru: 'Лучше' },
    7: { percent: '61-70', level_tg: 'Дараҷаи миёна', level_ru: 'Средний', desc_tg: 'Хуб', desc_ru: 'Хорошо' },
    6: { percent: '51-60', level_tg: 'Дараҷаи паст', level_ru: 'Низкий', desc_tg: 'Қаноатбахш', desc_ru: 'Удовлетворительно' },
    5: { percent: '41-50', level_tg: '', level_ru: '', desc_tg: 'Кофӣ', desc_ru: 'Достаточно' },
    4: { percent: '31-40', level_tg: '', level_ru: '', desc_tg: 'Кам', desc_ru: 'Мало' },
    3: { percent: '21-30', level_tg: 'Дараҷаи паст', level_ru: 'Низкий', desc_tg: 'Нокофия', desc_ru: 'Неудовлетворительно' },
    2: { percent: '11-20', level_tg: '', level_ru: '', desc_tg: 'Паст', desc_ru: 'Низкий' },
    1: { percent: '1-10', level_tg: '', level_ru: '', desc_tg: 'Пасттарин', desc_ru: 'Очень низкий' }
};

// Тарҷумаҳо (полные версии)
const translations = {
    tg: {
        mainTitle: 'Журнали соли хониш 2025-2026',
        mainSubtitle: 'сентябр 2025 – май 2026',
        subtitleText: '⚡ Рӯзҳои душанбе–шанбе, баҳо 1–10, график, филтр, экспорт',
        studentsTitle: '🧑‍🎓 Хонандагон',
        addStudentBtn: '➕ Илова',
        deleteStudentBtn: '🗑 Тоза',
        studentNamePlaceholderTg: 'Номи пурра (тоҷикӣ)',
        studentNamePlaceholderRu: 'Полное имя (русский)',
        selectStudent: '— интихоб —',
        subjectsTitle: '📚 Фанҳо',
        addSubjectBtn: '➕ Иловаи фан',
        subjectNamePlaceholderTg: 'Номи фан (тоҷикӣ)',
        subjectNamePlaceholderRu: 'Название предмета (русский)',
        timetableTitle: '⏰ Ҷадвали дарсӣ (душанбе–шанбе)',
        timetableDesc: 'Барои ҳар вақт фанеро интихоб кунед.',
        addTimeBtn: '➕ Иловаи вақт',
        timetableEmpty: 'Вақтҳо илова нашудаанд. Лутфан вақт илова кунед.',
        tabQ1: 'Чоряки 1',
        tabQ2: 'Чоряки 2',
        tabQ3: 'Чоряки 3',
        tabQ4: 'Чоряки 4',
        tabYear: 'Сол',
        filterDateBtn: 'Филтр',
        filterSubjectLabel: 'Фан:',
        filterViewLabel: 'Намуд:',
        allOption: 'Ҳама',
        categoryOptions: {
            weak: 'Заиф (1–3)',
            medium: 'Миёна (4–6)',
            good: 'Хуб (7–8)',
            excellent: 'Аъло (9–10)',
            none: 'бе баҳо'
        },
        viewOptions: ['Баҳо', 'Ҳузур'],
        chartTitle: '📈 Графики пешрафт ва тақсимоти баҳо',
        selectChartStudent: '— хонанда —',
        statClassAvg: '🏫 Миёнаи синф',
        statAttendance: '📊 Фоизи ҳузур',
        statStudents: '👥 Хонандагон',
        statDays: '📆 Рӯзҳо',
        saveBtn: '💾 Захира ба хотира',
        loadBtn: '📂 Бор кардан',
        autosaved: 'Автосохранено в',
        pdfBtn: '🖨 Чоп / PDF',
        printModeBtn: '📄 Танзимоти чоп',
        noSubject: 'Фан интихоб кунед',
        noDays: 'Барои ин давра рӯз нест',
        noDaysForSubject: 'Барои ин фан рӯзҳои дарс муайян нашудаанд',
        noStudents: 'Хонанда мувофиқ нест',
        tableHeaderStudent: 'Хонанда / Сана',
        finalGrade: 'Баҳои ниҳоӣ',
        confirmDeleteSubject: 'Фан ва ҳама баҳоҳои марбут нест мешавад. Идома?',
        confirmDeleteStudent: 'Хонанда ва ҳама маълумоти марбут нест мешавад. Идома?',
        enterName: 'Номро ба ҳар ду забон ворид кунед',
        enterSubject: 'Номи фанро ба ҳар ду забон ворид кунед',
        enterTime: 'Вақтро пурра ворид кунед',
        noData: 'Маълумот нест',
        loadSuccess: 'Бор кардан шуд',
        saveSuccess: 'Захира шуд',
        weekdays: ['якшанбе', 'душанбе', 'сешанбе', 'чоршанбе', 'панҷшанбе', 'ҷумъа', 'шанбе'],
        weekdaysShort: ['якш', 'душ', 'сеш', 'чор', 'пан', 'ҷум', 'шан'],
        langIndicator: 'tg',
        months: ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'],
        studentSearchLabel: '🔍 Ҷустуҷӯ:',
        studentSearchPlaceholder: 'Номи хонанда',
        reportBtn: '📄 Ҳисобот',
        closeBtn: 'Пӯшидан',
        reportModalTitle: '📋 Ҳисоботи хонанда',
        reportLabelSubject: 'Фан:',
        reportLabelPeriod: 'Давра:',
        reportLabelPeriodDays: 'рӯзи дарсӣ',
        reportLabelAvg: 'Миёнаи баҳо:',
        reportLabelAttendance: 'Ҳузур:',
        reportLabelOf: 'аз',
        reportLabelGrades: 'Баҳоҳо:',
        reportLabelNoGrades: 'Баҳо вуҷуд надорад.',
        rankingTitle: '🏆 Рейтинги хонандагон',
        rankingAllBtn: '🌐 Умумӣ',
        exportBtn: '📤 Экспорти JSON',
        importBtn: '📥 Воридоти JSON',
        calendarTitle: '📅 Тақвим',
        calendarLegendLesson: 'Дарс',
        calendarLegendHoliday: 'Таътил',
        calendarLegendNoLesson: 'Дарс нест',
        compareTitle: '📊 Муқоисаи хонандагон',
        compareStudent1: 'Хонандаи 1',
        compareStudent2: 'Хонандаи 2',
        compareSelectPrompt: '— интихоб —',
        compareNoData: 'Ду хонандаро интихоб кунед',
        navStudents: '🧑‍🎓 Хонандагон',
        navSubjects: '📚 Фанҳо',
        navTimetable: '⏰ Ҷадвал',
        navGrades: '📝 Баҳо',
        navChart: '📈 График',
        navRanking: '🏆 Рейтинг',
        navCalendar: '📅 Тақвим',
        navCompare: '📊 Муқоиса',
        navSetup: '⚙️ Танзимот',
        navAnalytics: '📊 Таҳлил'
    },
    ru: {
        mainTitle: 'Журнал учебного года 2025-2026',
        mainSubtitle: 'сентябрь 2025 – май 2026',
        subtitleText: '⚡ Пн–Сб, оценки 1–10, график, фильтры, экспорт',
        studentsTitle: '🧑‍🎓 Ученики',
        addStudentBtn: '➕ Добавить',
        deleteStudentBtn: '🗑 Удалить',
        studentNamePlaceholderTg: 'Номи пурра (тоҷикӣ)',
        studentNamePlaceholderRu: 'Полное имя (русский)',
        selectStudent: '— выберите —',
        subjectsTitle: '📚 Предметы',
        addSubjectBtn: '➕ Добавить предмет',
        subjectNamePlaceholderTg: 'Номи фан (тоҷикӣ)',
        subjectNamePlaceholderRu: 'Название предмета (русский)',
        timetableTitle: '⏰ Расписание (Пн–Сб)',
        timetableDesc: 'Выберите предмет для каждого времени.',
        addTimeBtn: '➕ Добавить время',
        timetableEmpty: 'Время не добавлено. Пожалуйста, добавьте время.',
        tabQ1: 'Четверть 1',
        tabQ2: 'Четверть 2',
        tabQ3: 'Четверть 3',
        tabQ4: 'Четверть 4',
        tabYear: 'Год',
        filterDateBtn: 'Фильтр',
        filterSubjectLabel: 'Предмет:',
        filterViewLabel: 'Вид:',
        allOption: 'Все',
        categoryOptions: {
            weak: 'Слабый (1–3)',
            medium: 'Средний (4–6)',
            good: 'Хороший (7–8)',
            excellent: 'Отличный (9–10)',
            none: 'без оценок'
        },
        viewOptions: ['Оценки', 'Посещаемость'],
        chartTitle: '📈 График успеваемости и распределение оценок',
        selectChartStudent: '— ученик —',
        statClassAvg: '🏫 Средний балл',
        statAttendance: '📊 Посещаемость %',
        statStudents: '👥 Ученики',
        statDays: '📆 Дни',
        saveBtn: '💾 Сохранить',
        loadBtn: '📂 Загрузить',
        autosaved: 'Автосохранено в',
        pdfBtn: '🖨 Печать / PDF',
        printModeBtn: '📄 Настройки печати',
        noSubject: 'Выберите предмет',
        noDays: 'Нет дней за этот период',
        noDaysForSubject: 'Для этого предмета нет уроков по расписанию',
        noStudents: 'Нет подходящих учеников',
        tableHeaderStudent: 'Ученик / Дата',
        finalGrade: 'Итоговая оценка',
        confirmDeleteSubject: 'Предмет и все связанные оценки будут удалены. Продолжить?',
        confirmDeleteStudent: 'Ученик и все связанные данные будут удалены. Продолжить?',
        enterName: 'Введите имя на обоих языках',
        enterSubject: 'Введите название предмета на обоих языках',
        enterTime: 'Введите время',
        noData: 'Нет данных',
        loadSuccess: 'Загружено',
        saveSuccess: 'Сохранено',
        weekdays: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
        weekdaysShort: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'],
        langIndicator: 'ru',
        months: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
        studentSearchLabel: '🔍 Поиск:',
        studentSearchPlaceholder: 'Имя ученика',
        reportBtn: '📄 Отчёт',
        closeBtn: 'Закрыть',
        reportModalTitle: '📋 Отчёт ученика',
        reportLabelSubject: 'Предмет:',
        reportLabelPeriod: 'Период:',
        reportLabelPeriodDays: 'учебных дней',
        reportLabelAvg: 'Средний балл:',
        reportLabelAttendance: 'Посещаемость:',
        reportLabelOf: 'из',
        reportLabelGrades: 'Оценки:',
        reportLabelNoGrades: 'Оценок нет.',
        rankingTitle: '🏆 Рейтинг учеников',
        rankingAllBtn: '🌐 Общий',
        exportBtn: '📤 Экспорт JSON',
        importBtn: '📥 Импорт JSON',
        calendarTitle: '📅 Календарь',
        calendarLegendLesson: 'Учебный день',
        calendarLegendHoliday: 'Праздник',
        calendarLegendNoLesson: 'Нет урока',
        compareTitle: '📊 Сравнение учеников',
        compareStudent1: 'Ученик 1',
        compareStudent2: 'Ученик 2',
        compareSelectPrompt: '— выберите —',
        compareNoData: 'Выберите двух учеников',
        navStudents: '🧑‍🎓 Ученики',
        navSubjects: '📚 Предметы',
        navTimetable: '⏰ Расписание',
        navGrades: '📝 Оценки',
        navChart: '📈 График',
        navRanking: '🏆 Рейтинг',
        navCalendar: '📅 Календарь',
        navCompare: '📊 Сравнение',
        navSetup: '⚙️ Настройки',
        navAnalytics: '📊 Аналитика'
    }
};

// Праздники
const TAJIK_HOLIDAYS = [
    '2025-01-01', '2025-03-08', '2025-03-21', '2025-03-22', '2025-03-23', '2025-03-24',
    '2025-03-30', '2025-03-31', '2025-05-09', '2025-06-06', '2025-06-27', '2025-09-09', '2025-11-06',
    '2026-01-01', '2026-01-02', '2026-03-08', '2026-03-21', '2026-03-22', '2026-03-23', '2026-03-24',
    '2026-03-30', '2026-03-31', '2026-05-09', '2026-06-06', '2026-06-27', '2026-09-09', '2026-11-06'
];

function isHoliday(dateStr) { return TAJIK_HOLIDAYS.includes(dateStr); }

// Функция для получения дня недели по UTC (для Таджикистана UTC+5, день тот же)
function getUTCDayOfWeek(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m-1, d)).getUTCDay(); // 0 = вс, 1 = пн, ..., 6 = сб
}

function generateId() { return Date.now() + '-' + Math.random().toString(36).substr(2, 9); }

// ==================== TOAST ====================
function showToast(message, type = 'info', opts = {}) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const text = document.createElement('div');
    text.className = 'toast-text';
    text.textContent = message;
    toast.appendChild(text);

    if (opts && opts.actionLabel && typeof opts.onAction === 'function') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'toast-action';
        btn.textContent = opts.actionLabel;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            try { opts.onAction(); } finally { toast.remove(); }
        });
        toast.appendChild(btn);
    }
    container.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 350); }, 2800);
}

// ==================== DEBOUNCE ====================
function debounce(fn, wait = 250) {
    let t = null;
    return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

window.renderGradeTableDebounced = debounce(() => renderGradeTable(), 180);

// ==================== НЕСОХРАНЁННЫЕ ИЗМЕНЕНИЯ ====================
function markDirty() {
    if (isDirty) return;
    isDirty = true;
    const label = translations[currentLang].saveBtn || '💾 Захира ба хотира';
    ['saveBtn','saveBtnCal','saveBtnGrades','saveBtnAnalytics'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.setAttribute('data-orig', btn.innerText);
        btn.innerText = '💾 Захира*';
        btn.style.boxShadow = '0 0 0 3px rgba(239,159,39,0.55)';
        btn.style.borderColor = '#EF9F27';
    });
}

function markClean() {
    isDirty = false;
    ['saveBtn','saveBtnCal','saveBtnGrades','saveBtnAnalytics'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const orig = btn.getAttribute('data-orig');
        if (orig) btn.innerText = orig;
        btn.style.boxShadow = '';
        btn.style.borderColor = '';
    });
}

window.onbeforeunload = function (e) {
    if (isDirty) { e.preventDefault(); e.returnValue = ''; }
};

// ==================== РОУТЕР ====================
const PAGES = ['setup', 'grades', 'analytics', 'calendar'];

window.goPage = function (pageId) {
    if (!PAGES.includes(pageId)) pageId = 'setup';

    // Скрываем все страницы
    PAGES.forEach(p => {
        const el = document.getElementById('page-' + p);
        if (el) el.classList.remove('page-active');
    });

    // Показываем нужную
    const target = document.getElementById('page-' + pageId);
    if (target) {
        target.classList.add('page-active');
        // Анимация входа
        target.style.animation = 'none';
        target.offsetHeight; // reflow
        target.style.animation = '';
    }

    // Подсвечиваем активную ссылку
    document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
    const activeNav = document.getElementById('nav' + pageId.charAt(0).toUpperCase() + pageId.slice(1));
    if (activeNav) activeNav.classList.add('active');

    // Обновляем hash и скроллим наверх
    history.pushState(null, '', '#' + pageId);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Перерисовываем графики на нужной странице
    if (pageId === 'grades') { updateChart(); }
    if (pageId === 'analytics') { updateRankingChart(); renderCompareChart(); }
    if (pageId === 'calendar') { renderCalendar(); }
};

window.navTo = window.goPage; // обратная совместимость

// ==================== СКРЫТИЕ НАВИГАЦИИ ПРИ СКРОЛЛЕ ====================
(function () {
    let lastY = 0;
    let ticking = false;
    window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
            const currentY = window.scrollY;
            const nav = document.getElementById('siteNav');
            if (nav) {
                if (currentY > lastY && currentY > 80) {
                    nav.classList.add('nav-hidden');
                } else {
                    nav.classList.remove('nav-hidden');
                }
            }
            lastY = currentY;
            ticking = false;
        });
    });
})();

// ==================== АВТОСОХРАНЕНИЕ ====================
setInterval(function () {
    if (!isDirty) return;
    const data = { students, subjects, dates, grades, attendance, timeSlots, timetable };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    markClean();
    const now = new Date();
    const time = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const labelText = (translations[currentLang].autosaved || 'Автосохранено в') + ' ' + time;
    ['autosaveLabel','autosaveLabelGrades','autosaveLabelAnalytics'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = labelText;
        el.style.opacity = '1';
        setTimeout(() => { el.style.opacity = '0'; }, 4000);
    });
}, 60000);

function sortStudents() {
    students.sort((a, b) => {
        const nameA = a.name[currentLang] || a.name.tg || '';
        const nameB = b.name[currentLang] || b.name.tg || '';
        return nameA.localeCompare(nameB, currentLang);
    });
}

// ==================== ЗАБОН ====================
window.setLanguage = function (lang) {
    if (lang !== 'tg' && lang !== 'ru') return;
    currentLang = lang;
    document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.lang-btn').forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${lang}'`)) {
            btn.classList.add('active');
        }
    });
    document.getElementById('studentNameTg').placeholder = translations[currentLang].studentNamePlaceholderTg;
    document.getElementById('studentNameRu').placeholder = translations[currentLang].studentNamePlaceholderRu;
    document.getElementById('subjectNameTg').placeholder = translations[currentLang].subjectNamePlaceholderTg;
    document.getElementById('subjectNameRu').placeholder = translations[currentLang].subjectNamePlaceholderRu;
    applyTranslation();
    renderAllAfterChange();
    renderTimetable();
    sortStudents();
};

function applyTranslation() {
    const t = translations[currentLang];

    // Вспомогательная функция — безопасное обновление
    function tx(id, prop, val) {
        const el = document.getElementById(id);
        if (!el) return;
        if (prop === 'text') el.innerText = val;
        else if (prop === 'placeholder') el.placeholder = val;
    }

    // Шапка
    tx('mainTitle', 'text', t.mainTitle);
    tx('mainSubtitle', 'text', t.mainSubtitle);

    // Страница 1: Настройки
    tx('studentsTitle',    'text', t.studentsTitle);
    tx('addStudentBtn',    'text', t.addStudentBtn);
    tx('deleteStudentBtn', 'text', t.deleteStudentBtn);
    tx('studentNameTg',    'placeholder', t.studentNamePlaceholderTg);
    tx('studentNameRu',    'placeholder', t.studentNamePlaceholderRu);
    tx('subjectsTitle',    'text', t.subjectsTitle);
    tx('addSubjectBtn',    'text', t.addSubjectBtn);
    tx('subjectNameTg',    'placeholder', t.subjectNamePlaceholderTg);
    tx('subjectNameRu',    'placeholder', t.subjectNamePlaceholderRu);
    tx('timetableTitle',   'text', t.timetableTitle);
    tx('timetableDesc',    'text', t.timetableDesc);
    tx('addTimeBtn',       'text', t.addTimeBtn);
    tx('saveBtn',          'text', t.saveBtn);
    tx('saveBtnCal',       'text', t.saveBtn);
    tx('saveBtnGrades',    'text', t.saveBtn);
    tx('saveBtnAnalytics', 'text', t.saveBtn);

    // Страница 2: Оценки
    tx('tabQ1',             'text', t.tabQ1);
    tx('tabQ2',             'text', t.tabQ2);
    tx('tabQ3',             'text', t.tabQ3);
    tx('tabQ4',             'text', t.tabQ4);
    tx('tabYear',           'text', t.tabYear);
    tx('filterDateBtn',     'text', t.filterDateBtn);
    tx('filterSubjectLabel','text', t.filterSubjectLabel);
    tx('filterViewLabel',   'text', t.filterViewLabel);
    tx('studentSearchLabel','text', t.studentSearchLabel);
    tx('studentSearch',     'placeholder', t.studentSearchPlaceholder);
    tx('chartTitle',        'text', t.chartTitle);
    tx('reportBtn',         'text', t.reportBtn);

    const viewType = document.getElementById('viewType');
    if (viewType && viewType.options.length >= 2) {
        viewType.options[0].text = t.viewOptions[0];
        viewType.options[1].text = t.viewOptions[1];
    }

    // Страница 3: Аналитика
    tx('rankingTitle',   'text', t.rankingTitle);
    tx('rankingAllBtn',  'text', t.rankingAllBtn);
    tx('compareTitle',   'text', t.compareTitle);
    // compareNoData — обновляем всегда (не зависит от наличия текста)
    const noData = document.getElementById('compareNoData');
    if (noData) noData.textContent = t.compareNoData;

    // Статистика — переводим лейблы напрямую, числа обновит updateReports
    const avg = document.getElementById('classAverage');
    const att = document.getElementById('attendancePercentage');
    const stu = document.getElementById('totalStudents');
    const day = document.getElementById('totalDays');
    const statAvgEl  = document.getElementById('statClassAvg');
    const statAttEl  = document.getElementById('statAttendance');
    const statStuEl  = document.getElementById('statStudents');
    const statDayEl  = document.getElementById('statDays');
    if (statAvgEl && avg)  statAvgEl.innerHTML  = `${t.statClassAvg}  <span id="classAverage">${avg.innerText}</span>`;
    if (statAttEl && att)  statAttEl.innerHTML  = `${t.statAttendance} <span id="attendancePercentage">${att.innerText}</span>`;
    if (statStuEl && stu)  statStuEl.innerHTML  = `${t.statStudents}   <span id="totalStudents">${stu.innerText}</span>`;
    if (statDayEl && day)  statDayEl.innerHTML  = `${t.statDays}       <span id="totalDays">${day.innerText}</span>`;

    // Календарь
    tx('calendarTitle',  'text', t.calendarTitle);

    // Модальное окно — заголовок и кнопка закрытия
    tx('modalTitle',     'text', t.reportModalTitle);
    tx('modalCloseBtn',  'text', t.closeBtn);

    // Навигация
    ['Setup','Grades','Analytics','Calendar'].forEach(k => {
        const el = document.getElementById('nav' + k);
        if (el) el.textContent = t['nav' + k] || el.textContent;
    });

    updateRankingSubjectSelect();
    renderCalendar();
    renderCompareChart();
}

// ==================== ТЕМА ====================
window.toggleTheme = function () {
    document.body.classList.toggle('dark-mode');
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.innerHTML = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
    localStorage.setItem(THEME_KEY, document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    updateChart();
    updateRankingChart();
    renderCompareChart();
};

function applySavedTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldDark = saved ? (saved === 'dark') : prefersDark;
    document.body.classList.toggle('dark-mode', !!shouldDark);
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) themeToggle.innerHTML = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
}

function markInvalidInputs(inputs) {
    inputs.forEach(el => {
        if (!el) return;
        el.classList.add('input-invalid');
        const onInput = () => el.classList.remove('input-invalid');
        el.addEventListener('input', onInput, { once: true });
    });
}

// ==================== УЧЕНИКИ ====================
window.addStudent = function () {
    const elTg = document.getElementById('studentNameTg');
    const elRu = document.getElementById('studentNameRu');
    const nameTg = elTg.value.trim();
    const nameRu = elRu.value.trim();
    if (!nameTg || !nameRu) {
        markInvalidInputs([!nameTg ? elTg : null, !nameRu ? elRu : null]);
        showToast(translations[currentLang].enterName, 'warning');
        return;
    }
    const newStudent = { id: generateId(), name: { tg: nameTg, ru: nameRu } };
    students.push(newStudent);
    sortStudents();
    elTg.value = '';
    elRu.value = '';
    markDirty();
    updateStudentSelect();
    renderAllAfterChange();
};

window.deleteStudent = function () {
    const id = document.getElementById('studentSelect').value;
    if (!id) {
        showToast(translations[currentLang].selectStudent, 'warning');
        return;
    }
    if (!confirm(translations[currentLang].confirmDeleteStudent)) return;
    const deletedStudent = students.find(s => s.id === id) || null;
    const deletedGrades = grades.filter(g => g.studentId === id);
    const deletedAttendance = attendance.filter(a => a.studentId === id);

    students = students.filter(s => s.id !== id);
    grades = grades.filter(g => g.studentId !== id);
    attendance = attendance.filter(a => a.studentId !== id);
    sortStudents();
    markDirty();
    updateStudentSelect();
    renderAllAfterChange();

    lastUndo = {
        type: 'deleteStudent',
        expiresAt: Date.now() + 12000,
        payload: { student: deletedStudent, grades: deletedGrades, attendance: deletedAttendance }
    };
    showToast(currentLang === 'ru' ? 'Ученик удалён' : 'Хонанда ҳазф шуд', 'info', {
        actionLabel: 'Undo',
        onAction: () => undoLastAction()
    });
};

function updateStudentSelect() {
    const t = translations[currentLang];
    const sel = document.getElementById('studentSelect');
    sel.innerHTML = `<option value="">${t.selectStudent}</option>`;
    students.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name[currentLang] || s.name.tg || '';
        sel.appendChild(opt);
    });
    const chartSel = document.getElementById('chartStudentSelect');
    chartSel.innerHTML = `<option value="">${t.selectChartStudent}</option>`;
    students.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name[currentLang] || s.name.tg || '';
        chartSel.appendChild(opt);
    });
}

// --- Категория ученика ---
function getStudentCategory(studentId, subjectId) {
    const filteredDates = getFilteredDates(subjectId);
    const studentGrades = filteredDates
        .map(d => getGradeData(studentId, subjectId, d.id))
        .filter(g => g && g.grade);
    if (studentGrades.length === 0) return 'none';
    const sum = studentGrades.reduce((acc, g) => acc + g.grade, 0);
    const avg = sum / studentGrades.length;
    if (avg <= 3) return 'weak';
    if (avg <= 6) return 'medium';
    if (avg <= 8) return 'good';
    return 'excellent';
}

// --- Получить средний балл ученика по предмету ---
function getStudentAvg(studentId, subjectId) {
    const filteredDates = getFilteredDates(subjectId);
    let sum = 0, count = 0;
    filteredDates.forEach(d => {
        const gd = getGradeData(studentId, subjectId, d.id);
        if (gd && gd.grade) {
            sum += gd.grade;
            count++;
        }
    });
    return count ? sum / count : null;
}

// ==================== ПРЕДМЕТЫ ====================
window.addSubject = function () {
    const elTg = document.getElementById('subjectNameTg');
    const elRu = document.getElementById('subjectNameRu');
    const nameTg = elTg.value.trim();
    const nameRu = elRu.value.trim();
    if (!nameTg || !nameRu) {
        markInvalidInputs([!nameTg ? elTg : null, !nameRu ? elRu : null]);
        showToast(translations[currentLang].enterSubject, 'warning');
        return;
    }
    const newSubject = { id: generateId(), name: { tg: nameTg, ru: nameRu } };
    subjects.push(newSubject);
    elTg.value = '';
    elRu.value = '';
    markDirty();
    renderSubjectTags();
    updateSubjectFilter();
    renderAllAfterChange();
    renderTimetable();
};

window.deleteSubject = function (subjectId) {
    if (!confirm(translations[currentLang].confirmDeleteSubject)) return;
    const deletedSubject = subjects.find(s => s.id === subjectId) || null;
    const deletedGrades = grades.filter(g => g.subjectId === subjectId);
    const deletedTimetableEntries = Object.entries(timetable).filter(([, subId]) => subId === subjectId);
    subjects = subjects.filter(s => s.id !== subjectId);
    grades = grades.filter(g => g.subjectId !== subjectId);
    Object.keys(timetable).forEach(key => {
        if (timetable[key] === subjectId) delete timetable[key];
    });
    markDirty();
    renderSubjectTags();
    updateSubjectFilter();
    renderAllAfterChange();
    renderTimetable();

    lastUndo = {
        type: 'deleteSubject',
        expiresAt: Date.now() + 12000,
        payload: { subject: deletedSubject, grades: deletedGrades, timetableEntries: deletedTimetableEntries }
    };
    showToast(currentLang === 'ru' ? 'Предмет удалён' : 'Фан ҳазф шуд', 'info', {
        actionLabel: 'Undo',
        onAction: () => undoLastAction()
    });
};

function undoLastAction() {
    if (!lastUndo) return;
    if (Date.now() > lastUndo.expiresAt) { lastUndo = null; return; }

    if (lastUndo.type === 'deleteStudent') {
        const { student, grades: g, attendance: a } = lastUndo.payload || {};
        if (student && !students.some(s => s.id === student.id)) students.push(student);
        if (Array.isArray(g)) grades.push(...g);
        if (Array.isArray(a)) attendance.push(...a);
        sortStudents();
        markDirty();
        renderAllAfterChange();
        showToast('↩️ Undo', 'success');
        lastUndo = null;
        return;
    }

    if (lastUndo.type === 'deleteSubject') {
        const { subject, grades: g, timetableEntries } = lastUndo.payload || {};
        if (subject && !subjects.some(s => s.id === subject.id)) subjects.push(subject);
        if (Array.isArray(g)) grades.push(...g);
        if (Array.isArray(timetableEntries)) {
            timetableEntries.forEach(([k, v]) => { timetable[k] = v; });
        }
        markDirty();
        renderAllAfterChange();
        renderTimetable();
        showToast('↩️ Undo', 'success');
        lastUndo = null;
        return;
    }
}

function renderSubjectTags() {
    const container = document.getElementById('subjectTags');
    container.innerHTML = '';
    subjects.forEach(sub => {
        const tag = document.createElement('span');
        tag.className = 'tag';
        const displayName = sub.name[currentLang] || sub.name.tg || '';
        tag.innerHTML = `${displayName} <button onclick="deleteSubject('${sub.id}')">✖</button>`;
        container.appendChild(tag);
    });
}

function updateSubjectFilter() {
    const filter = document.getElementById('subjectFilter');
    filter.innerHTML = '';
    subjects.forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub.id;
        opt.textContent = sub.name[currentLang] || sub.name.tg || '';
        filter.appendChild(opt);
    });
    if (subjects.length > 0) filter.selectedIndex = 0;
}

// ==================== РАСПИСАНИЕ ====================
window.addTimeSlot = function () {
    const start = document.getElementById('newTimeStart').value;
    const end = document.getElementById('newTimeEnd').value;
    if (!start || !end) {
        showToast(translations[currentLang].enterTime, 'warning');
        return;
    }
    timeSlots.push({ id: generateId(), start, end });
    markDirty();
    renderTimetable();
    renderGradeTable();
};

window.removeTimeSlot = function (slotId) {
    timeSlots = timeSlots.filter(s => s.id !== slotId);
    Object.keys(timetable).forEach(key => {
        if (key.endsWith('_' + slotId)) delete timetable[key];
    });
    renderTimetable();
    renderGradeTable();
};

window.updateTimetable = function (dayIdx, slotId, select) {
    const key = `${dayIdx}_${slotId}`;
    if (select.value) timetable[key] = select.value;
    else delete timetable[key];
    markDirty();
    renderGradeTable();
};

function renderTimetable() {
    const container = document.getElementById('timetableContainer');
    const t = translations[currentLang];
    if (timeSlots.length === 0) {
        container.innerHTML = `<p style="grid-column:1/-1; text-align:center;">${t.timetableEmpty}</p>`;
        return;
    }
    const days = t.weekdays.slice(1, 7); // пн-сб
    let html = '<div class="timetable-header"></div>';
    days.forEach(day => html += `<div class="timetable-header">${day}</div>`);
    timeSlots.forEach(slot => {
        html += `<div class="timetable-time">${slot.start}–${slot.end} <button onclick="removeTimeSlot('${slot.id}')" style="padding:2px 8px;">✖</button></div>`;
        for (let dayIdx = 0; dayIdx < 6; dayIdx++) {
            const key = `${dayIdx}_${slot.id}`;
            const selectedSubjectId = timetable[key] || '';
            html += `<div class="timetable-cell"><select onchange="updateTimetable('${dayIdx}', '${slot.id}', this)">`;
            html += '<option value="">—</option>';
            subjects.forEach(sub => {
                const selected = sub.id === selectedSubjectId ? 'selected' : '';
                const displayName = sub.name[currentLang] || sub.name.tg || '';
                html += `<option value="${sub.id}" ${selected}>${displayName}</option>`;
            });
            html += '</select></div>';
        }
    });
    container.innerHTML = html;
}

// ==================== САНАҲО ====================
function generateDatesForFullYear() {
    const start = new Date(2025, 8, 1);
    const end = new Date(2026, 4, 31);
    let newDates = [];
    let current = new Date(start);
    while (current <= end) {
        const day = current.getDay();
        if (day >= 1 && day <= 6) { // пн-сб
            const year = current.getFullYear();
            const month = String(current.getMonth() + 1).padStart(2, '0');
            const date = String(current.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${date}`;
            if (!isHoliday(dateStr)) {
                newDates.push({ id: generateId(), dateStr });
            }
        }
        current.setDate(current.getDate() + 1);
    }
    dates = newDates;
}

function getSubjectDays(subjectId) {
    const daysSet = new Set();
    Object.entries(timetable).forEach(([key, subId]) => {
        if (subId === subjectId) {
            const dayIdx = parseInt(key.split('_')[0]);
            daysSet.add(dayIdx);
        }
    });
    return Array.from(daysSet);
}

function getFilteredDates(subjectId) {
    let baseDates = dates;
    if (customDateRange && customDateRange.from && customDateRange.to) {
        baseDates = baseDates.filter(d => d.dateStr >= customDateRange.from && d.dateStr <= customDateRange.to);
    } else {
        if (currentQuarter === 'q1') {
            baseDates = baseDates.filter(d => d.dateStr.startsWith('2025') && (d.dateStr.includes('-09-') || d.dateStr.includes('-10-')));
        } else if (currentQuarter === 'q2') {
            baseDates = baseDates.filter(d => d.dateStr.startsWith('2025') && (d.dateStr.includes('-11-') || d.dateStr.includes('-12-')));
        } else if (currentQuarter === 'q3') {
            baseDates = baseDates.filter(d => d.dateStr.startsWith('2026') && (d.dateStr.includes('-01-') || d.dateStr.includes('-02-')));
        } else if (currentQuarter === 'q4') {
            baseDates = baseDates.filter(d => d.dateStr.startsWith('2026') && (d.dateStr.includes('-03-') || d.dateStr.includes('-04-') || d.dateStr.includes('-05-')));
        }
    }
    if (!subjectId) return baseDates;
    const subjectDays = getSubjectDays(subjectId);
    if (subjectDays.length === 0) return [];
    return baseDates.filter(d => {
        const dayOfWeek = getUTCDayOfWeek(d.dateStr);
        const targetDayIdx = dayOfWeek - 1; // 0 = пн, 1 = вт, ..., 5 = сб
        return subjectDays.includes(targetDayIdx);
    });
}

// ==================== БАҲО ====================
function getGradeData(studentId, subjectId, dateId) {
    return grades.find(g => g.studentId === studentId && g.subjectId === subjectId && g.dateId === dateId) || null;
}

function setGrade(studentId, subjectId, dateId, grade, comment = '') {
    let found = grades.find(g => g.studentId === studentId && g.subjectId === subjectId && g.dateId === dateId);
    if (found) {
        found.grade = grade;
        found.comment = comment;
    } else {
        grades.push({ studentId, subjectId, dateId, grade, comment });
    }
}

// ==================== ОБРАБОТЧИКИ ====================
window.updateGradeHandler = function (studentId, subjectId, dateId, input) {
    let val = input.value.trim();
    if (val === '') {
        grades = grades.filter(g => !(g.studentId === studentId && g.subjectId === subjectId && g.dateId === dateId));
    } else {
        val = Math.min(10, Math.max(1, parseFloat(val) || 1));
        input.value = val;
        setGrade(studentId, subjectId, dateId, val, '');
    }
    markDirty();
    renderGradeTable();
    updateRankingChart();
};

window.updateAttendanceHandler = function (studentId, dateId, checkbox) {
    let found = attendance.find(a => a.studentId === studentId && a.dateId === dateId);
    if (found) found.present = checkbox.checked;
    else attendance.push({ studentId, dateId, present: checkbox.checked });
    markDirty();
    updateReports();
};

window.handleGradeKeyDown = function (event, studentId, subjectId, dateId) {
    const key = event.key;
    if (key >= '1' && key <= '9') {
        event.target.value = key;
        event.target.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (key === '0') {
        event.target.value = '10';
        event.target.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (key === 'Enter') {
        event.target.blur();
    }
};

// ==================== ФИЛЬТРЫ (только поиск по имени) ====================
function filterStudents(studentsList, subjectId) {
    const studentSearchEl = document.getElementById('studentSearch');
    const searchTerm = studentSearchEl ? studentSearchEl.value.toLowerCase() : '';

    return studentsList.filter(s => {
        const name = (s.name[currentLang] || s.name.tg || '').toLowerCase();
        if (searchTerm && !name.includes(searchTerm)) return false;
        return true;
    });
}

// ==================== ТАБЛИЦА ====================
function renderGradeTable() {
    const subjectId = document.getElementById('subjectFilter').value;
    const viewType = document.getElementById('viewType').value;
    const t = translations[currentLang];

    if (!subjectId || subjects.length === 0) {
        document.getElementById('tableHeader').innerHTML = `<tr><th>${t.noSubject}</th></tr>`;
        document.getElementById('tableBody').innerHTML = '';
        return;
    }

    const filteredDates = getFilteredDates(subjectId);
    // Сортировка дат по возрастанию
    filteredDates.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

    if (filteredDates.length === 0) {
        document.getElementById('tableHeader').innerHTML = `<tr><th>${t.noDaysForSubject}</th></tr>`;
        document.getElementById('tableBody').innerHTML = '';
        return;
    }

    let filteredStudents = filterStudents([...students], subjectId);

    // Сортировка по имени
    filteredStudents.sort((a, b) => {
        const nameA = a.name[currentLang] || a.name.tg || '';
        const nameB = b.name[currentLang] || b.name.tg || '';
        return nameA.localeCompare(nameB, currentLang);
    });

    // Формируем заголовок с датами и днями недели (используем UTC)
    let headerHtml = `<tr><th style="min-width:180px;">${t.tableHeaderStudent}</th>`;
    filteredDates.forEach(d => {
        const [year, month, day] = d.dateStr.split('-');
        const weekdayIndex = getUTCDayOfWeek(d.dateStr);
        const weekdayShort = t.weekdaysShort[weekdayIndex];
        headerHtml += `<th>${day}.${month}.${year}<br><small>${weekdayShort}</small></th>`;
    });
    headerHtml += `<th>${t.finalGrade}</th></tr>`;
    document.getElementById('tableHeader').innerHTML = headerHtml;

    let bodyHtml = '';
    filteredStudents.forEach(stud => {
        const studentName = stud.name[currentLang] || stud.name.tg || '';
        const categoryKey = getStudentCategory(stud.id, subjectId);
        const categoryText = t.categoryOptions[categoryKey] || '';
        let row = `<tr><td style="text-align:left; font-weight:500;">${studentName} <span class="student-category-tag category-${categoryKey}">${categoryText}</span></td>`;

        let gradesList = [];
        filteredDates.forEach(d => {
            const gd = getGradeData(stud.id, subjectId, d.id);
            const grade = gd ? gd.grade : '';
            if (viewType === 'table') {
                let gradeInfoHtml = '';
                let titleAttr = '';
                if (grade && gradeSystem[grade]) {
                    const info = gradeSystem[grade];
                    const desc = currentLang === 'tg' ? info.desc_tg : info.desc_ru;
                    gradeInfoHtml = `<div class="grade-info">${desc}</div>`;
                    titleAttr = ` title="${info.percent}% - ${currentLang === 'tg' ? info.level_tg : info.level_ru}"`;
                }
                row += `<td><div class="grade-container">`;
                row += `<input type="number" min="1" max="10" step="1" class="grade-input grade-${grade}" value="${grade}" placeholder="—" data-grade="${stud.id}_${subjectId}_${d.id}" onchange="updateGradeHandler('${stud.id}','${subjectId}','${d.id}', this)" onkeydown="handleGradeKeyDown(event, '${stud.id}','${subjectId}','${d.id}')"${titleAttr}>`;
                row += gradeInfoHtml;
                row += `</div></td>`;
                if (grade) gradesList.push(grade);
            } else {
                const attRecord = attendance.find(a => a.studentId === stud.id && a.dateId === d.id);
                const present = (attRecord && attRecord.present) || false;
                row += `<td><input type="checkbox" class="attendance-checkbox" ${present ? 'checked' : ''} onchange="updateAttendanceHandler('${stud.id}','${d.id}', this)"></td>`;
            }
        });

        const finalGrade = gradesList.length ? (gradesList.reduce((a, b) => a + b, 0) / gradesList.length).toFixed(2) : '0.00';
        row += `<td><span class="average">${finalGrade}</span></td>`;
        row += '</tr>';
        bodyHtml += row;
    });

    if (filteredStudents.length === 0) {
        bodyHtml = `<tr><td colspan="${filteredDates.length + 2}">${t.noStudents}</td></tr>`;
    }
    document.getElementById('tableBody').innerHTML = bodyHtml;

    updateReports(filteredDates, filteredStudents, subjectId);
    updateChart();
}

// ==================== ГРАФИКИ ====================
window.updateChart = function () {
    const studentId = document.getElementById('chartStudentSelect').value;
    const subjectId = document.getElementById('subjectFilter').value;
    if (!studentId || !subjectId) return;
    const filteredDates = getFilteredDates(subjectId).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    const gradesData = filteredDates.map(d => {
        const gd = getGradeData(studentId, subjectId, d.id);
        return (gd && gd.grade) || null;
    });
    const labels = filteredDates.map(d => d.dateStr.slice(5));
    const textColor = document.body.classList.contains('dark-mode') ? '#ffffff' : '#0a2a44';

    if (chartInstance) chartInstance.destroy();
    const ctx = document.getElementById('gradeChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: translations[currentLang].chartTitle.replace('📈 ', ''),
                data: gradesData,
                borderColor: '#1a4b72',
                backgroundColor: 'rgba(26,75,114,0.1)',
                tension: 0.2,
                spanGaps: true
            }]
        },
        options: {
            scales: {
                y: { min: 0, max: 10, ticks: { color: textColor } },
                x: { ticks: { color: textColor } }
            },
            plugins: {
                legend: { labels: { color: textColor } }
            }
        }
    });
};

// ==================== ОТЧЁТЫ ====================
function updateReports(filteredDates, filteredStudents, subjectId) {
    if (!filteredDates || !filteredStudents) {
        const fDates = getFilteredDates(subjectId);
        const fStudents = filterStudents([...students], subjectId);
        subjectId = subjectId || document.getElementById('subjectFilter').value;
        filteredDates = fDates;
        filteredStudents = fStudents;
    }
    document.getElementById('totalStudents').innerText = filteredStudents.length;
    document.getElementById('totalDays').innerText = filteredDates.length;

    const t = translations[currentLang];

    if (!subjectId || filteredStudents.length === 0 || filteredDates.length === 0) {
        document.getElementById('classAverage').innerText = '0.00';
        document.getElementById('attendancePercentage').innerText = '0%';
        document.getElementById('statClassAvg').innerHTML  = `${t.statClassAvg}  <span id="classAverage">0.00</span>`;
        document.getElementById('statAttendance').innerHTML = `${t.statAttendance} <span id="attendancePercentage">0%</span>`;
        document.getElementById('statStudents').innerHTML  = `${t.statStudents}   <span id="totalStudents">${filteredStudents.length}</span>`;
        document.getElementById('statDays').innerHTML      = `${t.statDays}       <span id="totalDays">${filteredDates.length}</span>`;
        return;
    }

    let totalSum = 0, totalCount = 0, totalPresent = 0, totalPossible = 0;
    filteredStudents.forEach(s => {
        filteredDates.forEach(d => {
            const g = getGradeData(s.id, subjectId, d.id);
            if (g && g.grade) {
                totalSum += g.grade;
                totalCount++;
            }
            const att = attendance.find(a => a.studentId === s.id && a.dateId === d.id);
            if (att && att.present) totalPresent++;
            totalPossible++;
        });
    });
    document.getElementById('classAverage').innerText = totalCount ? (totalSum / totalCount).toFixed(2) : '0.00';
    document.getElementById('attendancePercentage').innerText = totalPossible ? ((totalPresent / totalPossible) * 100).toFixed(1) + '%' : '0%';

    document.getElementById('statClassAvg').innerHTML  = `${t.statClassAvg}  <span id="classAverage">${document.getElementById('classAverage').innerText}</span>`;
    document.getElementById('statAttendance').innerHTML = `${t.statAttendance} <span id="attendancePercentage">${document.getElementById('attendancePercentage').innerText}</span>`;
    document.getElementById('statStudents').innerHTML  = `${t.statStudents}   <span id="totalStudents">${document.getElementById('totalStudents').innerText}</span>`;
    document.getElementById('statDays').innerHTML      = `${t.statDays}       <span id="totalDays">${document.getElementById('totalDays').innerText}</span>`;
}

// ==================== ОТЧЁТ ПО УЧЕНИКУ ====================
window.showStudentReport = function () {
    const studentId = document.getElementById('chartStudentSelect').value;
    if (!studentId) {
        showToast(translations[currentLang].selectStudent, 'warning');
        return;
    }
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const t = translations[currentLang];
    const subjectId = document.getElementById('subjectFilter').value;
    const filteredDates = getFilteredDates(subjectId);
    const subject = subjects.find(s => s.id === subjectId);
    const subjectName = subject ? (subject.name[currentLang] || subject.name.tg) : '';

    let gradesList = [];
    filteredDates.forEach(d => {
        const gd = getGradeData(studentId, subjectId, d.id);
        if (gd && gd.grade) gradesList.push({ date: d.dateStr, grade: gd.grade });
    });

    const avg = gradesList.length ? (gradesList.reduce((a, b) => a + b.grade, 0) / gradesList.length).toFixed(2) : '—';
    const attendanceCount = attendance.filter(a => a.studentId === studentId && a.present).length;
    const totalDays = filteredDates.length;
    const attendancePercent = totalDays ? ((attendanceCount / totalDays) * 100).toFixed(1) : '0';

    const studentNameSafe = student.name[currentLang] || student.name.tg;
    let html = `<h3>${studentNameSafe}</h3>`;
    html += `<p><strong>${t.reportLabelSubject}</strong> ${subjectName}</p>`;
    html += `<p><strong>${t.reportLabelPeriod}</strong> ${filteredDates.length} ${t.reportLabelPeriodDays}</p>`;
    html += `<p><strong>${t.reportLabelAvg}</strong> ${avg}</p>`;
    html += `<p><strong>${t.reportLabelAttendance}</strong> ${attendanceCount} ${t.reportLabelOf} ${totalDays} (${attendancePercent}%)</p>`;
    if (gradesList.length) {
        html += `<h4>${t.reportLabelGrades}</h4><ul>`;
        gradesList.forEach(g => {
            const [year, month, day] = g.date.split('-');
            html += `<li>${day}.${month}.${year}: ${g.grade}</li>`;
        });
        html += `</ul>`;
    } else {
        html += `<p>${t.reportLabelNoGrades}</p>`;
    }

    document.getElementById('modalTitle').innerText = t.reportModalTitle;
    document.getElementById('modalContent').innerHTML = html;
    openModal();
};

window.closeModal = function () {
    const modal = document.getElementById('reportModal');
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }
    if (lastActiveElementBeforeModal && typeof lastActiveElementBeforeModal.focus === 'function') {
        lastActiveElementBeforeModal.focus();
    }
};

function openModal() {
    const modal = document.getElementById('reportModal');
    if (!modal) return;
    lastActiveElementBeforeModal = document.activeElement;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    const closeBtn = document.getElementById('modalCloseBtn');
    if (closeBtn) closeBtn.focus();
}

// ==================== ДИАПАЗОН ДАТ ====================
window.applyCustomDateRange = function () {
    const from = document.getElementById('dateFrom').value;
    const to = document.getElementById('dateTo').value;
    if (from && to) {
        customDateRange = { from, to };
        document.querySelectorAll('.quarter-tab').forEach(t => t.classList.remove('active'));
    } else {
        customDateRange = null;
        switchQuarter(currentQuarter);
    }
    renderGradeTable();
};

// ==================== ПЕРЕКЛЮЧЕНИЕ ЧЕТВЕРТИ ====================
window.switchQuarter = function (q) {
    currentQuarter = q;
    customDateRange = null;
    document.querySelectorAll('.quarter-tab').forEach(t => t.classList.remove('active'));
    let activeId;
    if (q === 'q1') activeId = 'tabQ1';
    else if (q === 'q2') activeId = 'tabQ2';
    else if (q === 'q3') activeId = 'tabQ3';
    else if (q === 'q4') activeId = 'tabQ4';
    else if (q === 'year') activeId = 'tabYear';
    if (activeId) document.getElementById(activeId).classList.add('active');
    renderGradeTable();
    updateRankingChart();
};

// ==================== PDF ====================
window.exportToPDF = function () {
    html2pdf().from(document.getElementById('printArea')).set({ margin: 0.5, filename: 'журнал.pdf' }).save();
};

window.togglePrintMode = function () {
    document.body.classList.toggle('print-mode');
};

// ==================== СОХРАНЕНИЕ И ЗАГРУЗКА ====================
window.saveAllData = function () {
    const data = { students, subjects, dates, grades, attendance, timeSlots, timetable };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    markClean();
    showToast(translations[currentLang].saveSuccess, 'success');
    const now = new Date();
    const time = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const labelText = (translations[currentLang].autosaved || 'Автосохранено в') + ' ' + time;
    ['autosaveLabel','autosaveLabelGrades','autosaveLabelAnalytics'].forEach(id => {
        const label = document.getElementById(id);
        if (!label) return;
        label.textContent = labelText;
        label.style.opacity = '1';
        setTimeout(() => { label.style.opacity = '0'; }, 4000);
    });
};

window.loadAllData = function () {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
        showToast(translations[currentLang].noData, 'warning');
        return;
    }
    try {
        const data = JSON.parse(saved);
        students   = data.students   || [];
        subjects   = data.subjects   || [];
        dates      = data.dates      || [];
        grades     = data.grades     || [];
        attendance = data.attendance || [];
        timeSlots  = data.timeSlots  || [];
        timetable  = data.timetable  || {};
        sortStudents();
        renderAllAfterChange();
        renderTimetable();
        markClean();
        showToast(translations[currentLang].loadSuccess, 'success');
    } catch (e) {
        showToast('Error', 'error');
    }
};

// ==================== РЕЙТИНГ УЧЕНИКОВ ====================
function updateRankingSubjectSelect() {
    const sel = document.getElementById('rankingSubjectSelect');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '';
    subjects.forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub.id;
        opt.textContent = sub.name[currentLang] || sub.name.tg || '';
        sel.appendChild(opt);
    });
    if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
}

function applyRankingModeUI() {
    const btn = document.getElementById('rankingAllBtn');
    const sel = document.getElementById('rankingSubjectSelect');
    if (!btn || !sel) return;
    if (rankingMode === 'all') {
        btn.classList.add('active');
        sel.style.opacity = '0.4';
        sel.style.pointerEvents = 'none';
    } else {
        btn.classList.remove('active');
        sel.style.opacity = '1';
        sel.style.pointerEvents = '';
    }
}

window.switchRankingMode = function (mode) {
    rankingMode = (rankingMode === mode) ? 'subject' : mode;
    applyRankingModeUI();
    updateRankingChart();
};

window.updateRankingChart = function () {
    const canvas = document.getElementById('rankingChart');
    if (!canvas) return;
    let data = students.map(stud => {
        let sum = 0, count = 0;
        if (rankingMode === 'all') {
            subjects.forEach(sub => {
                getFilteredDates(sub.id).forEach(d => {
                    const gd = getGradeData(stud.id, sub.id, d.id);
                    if (gd && gd.grade) { sum += gd.grade; count++; }
                });
            });
        } else {
            const sel = document.getElementById('rankingSubjectSelect');
            const subjectId = sel ? sel.value : '';
            if (subjectId) {
                getFilteredDates(subjectId).forEach(d => {
                    const gd = getGradeData(stud.id, subjectId, d.id);
                    if (gd && gd.grade) { sum += gd.grade; count++; }
                });
            }
        }
        return { name: stud.name[currentLang] || stud.name.tg || '', avg: count ? sum / count : null };
    });
    data = data.filter(d => d.avg !== null).sort((a, b) => b.avg - a.avg);
    if (rankingChartInstance) { rankingChartInstance.destroy(); rankingChartInstance = null; }
    if (data.length === 0) return;
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#f0f5fa' : '#0a2a44';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const colors = data.map((d, i) => i === 0 ? 'rgba(46,125,50,0.85)' : d.avg < 5 ? 'rgba(177,86,86,0.85)' : 'rgba(31,94,142,0.75)');
    const borders = data.map((d, i) => i === 0 ? '#1b5e20' : d.avg < 5 ? '#7f1010' : '#153e5c');
    canvas.style.height = Math.max(200, data.length * 44 + 60) + 'px';
    rankingChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: data.map(d => d.name),
            datasets: [{ data: data.map(d => parseFloat(d.avg.toFixed(2))), backgroundColor: colors, borderColor: borders, borderWidth: 1.5, borderRadius: 6, borderSkipped: false }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { min: 0, max: 10, ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor } },
                y: { ticks: { color: textColor, font: { size: 13, weight: '500' }, padding: 8 }, grid: { display: false } }
            },
            animation: { duration: 400 }
        }
    });
};

// ==================== ЭКСПОРТ / ИМПОРТ JSON ====================
window.exportJSON = function () {
    const data = { students, subjects, dates, grades, attendance, timeSlots, timetable };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'journal_backup.json'; a.click();
    URL.revokeObjectURL(url);
    showToast(translations[currentLang].saveSuccess, 'success');
};

window.importJSON = function (input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            students = data.students || [];
            subjects = data.subjects || [];
            dates = data.dates || [];
            grades = data.grades || [];
            attendance = data.attendance || [];
            timeSlots = data.timeSlots || [];
            timetable = data.timetable || {};
            sortStudents();
            renderAllAfterChange();
            renderTimetable();
            markClean();
            showToast(translations[currentLang].loadSuccess, 'success');
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
        input.value = '';
    };
    reader.readAsText(file);
};

// ==================== КАЛЕНДАРЬ ====================
// default values; will be set to current month on load
window.calendarYear = 2025;
window.calendarMonth = 8; // 0-based

function setCalendarToCurrentMonth() {
    const now = new Date();
    window.calendarYear = now.getFullYear();
    window.calendarMonth = now.getMonth();
}

window.prevMonth = function () {
    if (window.calendarMonth === 0) { window.calendarMonth = 11; window.calendarYear--; }
    else window.calendarMonth--;
    renderCalendar();
};

window.nextMonth = function () {
    if (window.calendarMonth === 11) { window.calendarMonth = 0; window.calendarYear++; }
    else window.calendarMonth++;
    renderCalendar();
};

function renderCalendar() {
    const container = document.getElementById('calendarGrid');
    const monthLabel = document.getElementById('calendarMonthLabel');
    if (!container || !monthLabel) return;

    const t = translations[currentLang];
    const y = window.calendarYear;
    const m = window.calendarMonth;

    monthLabel.textContent = `${t.months[m]} ${y}`;

    const lessonDays  = new Set(dates.map(d => d.dateStr));
    const holidayDays = new Set(TAJIK_HOLIDAYS);

    // Заголовки пн-вс
    const wdHeaders = t.weekdaysShort.slice(1).concat(t.weekdaysShort[0]);
    let html = wdHeaders.map(w => `<div class="cal-header">${w}</div>`).join('');

    const firstDay = new Date(Date.UTC(y, m, 1));
    const lastDay  = new Date(Date.UTC(y, m + 1, 0));
    const today    = new Date();

    // Смещение: пн=0
    let off = firstDay.getUTCDay();
    off = off === 0 ? 6 : off - 1;

    // Ячейки предыдущего месяца
    const prevLastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (let i = off - 1; i >= 0; i--) {
        html += `<div class="cal-day cal-empty" style="color:var(--text-3)">${prevLastDay - i}</div>`;
    }

    // Дни текущего месяца
    for (let d = 1; d <= lastDay.getUTCDate(); d++) {
        const ds  = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dow = new Date(Date.UTC(y, m, d)).getUTCDay();
        const isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;

        let cls = 'cal-day';
        if (holidayDays.has(ds))    cls += ' cal-holiday';
        else if (lessonDays.has(ds)) cls += ' cal-lesson';
        else if (dow === 0)          cls += ' cal-weekend';
        else                         cls += ' cal-nolesson';
        if (isToday)                 cls += ' cal-today';

        html += `<div class="${cls}">${d}</div>`;
    }

    // Ячейки следующего месяца
    const total = off + lastDay.getUTCDate();
    const rem = total % 7 === 0 ? 0 : 7 - (total % 7);
    for (let i = 1; i <= rem; i++) {
        html += `<div class="cal-day cal-empty" style="color:var(--text-3)">${i}</div>`;
    }

    container.innerHTML = html;

    // Легенда
    const legend = document.getElementById('calendarLegend');
    if (legend) {
        legend.innerHTML = `
            <span class="cal-legend-item"><span class="cal-legend-dot cal-lesson"></span>${t.calendarLegendLesson}</span>
            <span class="cal-legend-item"><span class="cal-legend-dot cal-holiday"></span>${t.calendarLegendHoliday}</span>
            <span class="cal-legend-item"><span class="cal-legend-dot cal-nolesson"></span>${t.calendarLegendNoLesson}</span>
        `;
    }
}

// ==================== СРАВНЕНИЕ УЧЕНИКОВ ====================
let compareChartInstance = null;

function updateCompareSelects() {
    const t = translations[currentLang];
    ['compareStudent1Select', 'compareStudent2Select'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const prev = sel.value;
        sel.innerHTML = `<option value="">${t.compareSelectPrompt}</option>`;
        students.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name[currentLang] || s.name.tg || '';
            sel.appendChild(opt);
        });
        if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
    });
}

function renderCompareChart() {
    const canvas = document.getElementById('compareChart');
    if (!canvas) return;

    const s1id = document.getElementById('compareStudent1Select') ? document.getElementById('compareStudent1Select').value : '';
    const s2id = document.getElementById('compareStudent2Select') ? document.getElementById('compareStudent2Select').value : '';

    if (compareChartInstance) { compareChartInstance.destroy(); compareChartInstance = null; }

    const t = translations[currentLang];
    const noDataEl = document.getElementById('compareNoData');

    if (!s1id || !s2id || s1id === s2id) {
        if (noDataEl) noDataEl.style.display = '';
        return;
    }
    if (noDataEl) noDataEl.style.display = 'none';

    const s1 = students.find(s => s.id === s1id);
    const s2 = students.find(s => s.id === s2id);
    if (!s1 || !s2) return;

    // Считаем средний балл по каждому предмету для каждого ученика
    const labels = [];
    const data1 = [];
    const data2 = [];

    subjects.forEach(sub => {
        const avg1 = getStudentAvg(s1id, sub.id);
        const avg2 = getStudentAvg(s2id, sub.id);
        if (avg1 !== null || avg2 !== null) {
            labels.push(sub.name[currentLang] || sub.name.tg || '');
            data1.push(avg1 !== null ? parseFloat(avg1.toFixed(2)) : 0);
            data2.push(avg2 !== null ? parseFloat(avg2.toFixed(2)) : 0);
        }
    });

    if (labels.length === 0) return;

    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#e5eff8' : '#0d1f2d';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

    canvas.style.height = Math.max(220, labels.length * 52 + 60) + 'px';

    compareChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: s1.name[currentLang] || s1.name.tg,
                    data: data1,
                    backgroundColor: 'rgba(26,95,180,0.78)',
                    borderColor: '#1a5fb4',
                    borderWidth: 1.5,
                    borderRadius: 5,
                    borderSkipped: false,
                },
                {
                    label: s2.name[currentLang] || s2.name.tg,
                    data: data2,
                    backgroundColor: 'rgba(35,122,68,0.78)',
                    borderColor: '#237a44',
                    borderWidth: 1.5,
                    borderRadius: 5,
                    borderSkipped: false,
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: textColor, font: { size: 13 }, padding: 16 }
                }
            },
            scales: {
                x: {
                    min: 0, max: 10,
                    ticks: { color: textColor, stepSize: 1 },
                    grid: { color: gridColor }
                },
                y: {
                    ticks: { color: textColor, font: { size: 13, weight: '500' }, padding: 8 },
                    grid: { display: false }
                }
            },
            animation: { duration: 400 }
        }
    });
}

window.onCompareChange = function () { renderCompareChart(); };

function renderAllAfterChange() {
    updateStudentSelect();
    renderSubjectTags();
    updateSubjectFilter();
    updateRankingSubjectSelect();
    updateCompareSelects();
    renderGradeTable();
    renderTimetable();
    updateRankingChart();
    renderCalendar();
    renderCompareChart();
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
function initDemoData() {
    students = [
        { id: generateId(), name: { tg: 'Алиев Аҳмад', ru: 'Алиев Ахмад' } },
        { id: generateId(), name: { tg: 'Каримова Зебо', ru: 'Каримова Зебо' } },
        { id: generateId(), name: { tg: 'Раҷабов Сомон', ru: 'Раджабов Сомон' } }
    ];
    sortStudents();
    subjects = [
        { id: generateId(), name: { tg: 'Математика', ru: 'Математика' } },
        { id: generateId(), name: { tg: 'Физика', ru: 'Физика' } }
    ];
    timeSlots = [
        { id: generateId(), start: '08:00', end: '08:45' },
        { id: generateId(), start: '08:50', end: '09:35' }
    ];
    timetable = {
        ['0_' + timeSlots[0].id]: subjects[0].id,
        ['1_' + timeSlots[0].id]: subjects[1].id,
        ['2_' + timeSlots[0].id]: subjects[0].id,
        ['3_' + timeSlots[0].id]: subjects[1].id,
        ['4_' + timeSlots[0].id]: subjects[0].id,
        ['5_' + timeSlots[0].id]: subjects[1].id,
        ['0_' + timeSlots[1].id]: subjects[1].id,
        ['2_' + timeSlots[1].id]: subjects[1].id,
        ['4_' + timeSlots[1].id]: subjects[0].id,
        ['5_' + timeSlots[1].id]: subjects[0].id,
    };
    generateDatesForFullYear();
    if (students.length && subjects.length && dates.length) {
        setGrade(students[0].id, subjects[0].id, dates[0].id, 8);
        setGrade(students[1].id, subjects[0].id, dates[0].id, 6);
    }
}

window.onload = function () {
    applySavedTheme();
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const data = JSON.parse(saved);
            students   = data.students   || [];
            subjects   = data.subjects   || [];
            dates      = data.dates      || [];
            grades     = data.grades     || [];
            attendance = data.attendance || [];
            timeSlots  = data.timeSlots  || [];
            timetable  = data.timetable  || {};
            sortStudents();
        } catch (e) {
            console.warn('Ошибка загрузки данных, используются демо-данные', e);
            initDemoData();
        }
    } else {
        initDemoData();
    }

    const has2026 = dates.some(d => d.dateStr.startsWith('2026'));
    const hasSaturday = dates.some(d => getUTCDayOfWeek(d.dateStr) === 6);
    if (!has2026 || !hasSaturday) generateDatesForFullYear();

    // Calendar: open on current month
    setCalendarToCurrentMonth();

    renderAllAfterChange();
    renderTimetable();
    applyTranslation();

    document.getElementById('studentNameTg').placeholder = translations[currentLang].studentNamePlaceholderTg;
    document.getElementById('studentNameRu').placeholder = translations[currentLang].studentNamePlaceholderRu;
    document.getElementById('subjectNameTg').placeholder = translations[currentLang].subjectNamePlaceholderTg;
    document.getElementById('subjectNameRu').placeholder = translations[currentLang].subjectNamePlaceholderRu;

    document.querySelectorAll('.quarter-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tabYear').classList.add('active');

    // Инициализация роутера
    const hash = window.location.hash.replace('#', '') || 'setup';
    goPage(PAGES.includes(hash) ? hash : 'setup');

    // Навигация кнопкой «Назад»
    window.addEventListener('popstate', () => {
        const h = window.location.hash.replace('#', '') || 'setup';
        goPage(PAGES.includes(h) ? h : 'setup');
    });

    // Hotkeys + modal UX
    document.addEventListener('keydown', (e) => {
        const isMac = navigator.platform.toLowerCase().includes('mac');
        const mod = isMac ? e.metaKey : e.ctrlKey;

        if (mod && e.key.toLowerCase() === 's') {
            e.preventDefault();
            saveAllData();
            return;
        }
        if (mod && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            const search = document.getElementById('studentSearch');
            if (search) { goPage('grades'); search.focus(); }
            return;
        }
        if (e.key === 'Escape') {
            const modal = document.getElementById('reportModal');
            if (modal && modal.style.display !== 'none') closeModal();
        }
    });

    const modal = document.getElementById('reportModal');
    if (modal) {
        modal.addEventListener('mousedown', (e) => {
            if (e.target === modal) closeModal();
        });
        modal.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;
            const focusables = modal.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
            const list = Array.from(focusables).filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
            if (list.length === 0) return;
            const first = list[0];
            const last = list[list.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault(); last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault(); first.focus();
            }
        });
    }
};