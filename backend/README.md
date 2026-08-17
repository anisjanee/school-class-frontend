# School Journal Pro Backend

Локальный backend для `portal.html`.

## 1. Установка

Нужен Python 3.10+.

```bash
cd backend
python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
pip install -r requirements.txt
```

## 2. Запуск

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

API будет доступен на `http://127.0.0.1:8000`.
Документация: `http://127.0.0.1:8000/docs`.

## 3. Frontend

Открой проект через VS Code Live Server или другой локальный HTTP-сервер и открой `portal.html`.

По умолчанию frontend использует:

```text
http://127.0.0.1:8000
```

Если backend запущен на другом адресе, перед `portal.js` можно задать:

```html
<script>window.SCHOOL_API_URL = 'http://127.0.0.1:8000';</script>
<script type="module" src="portal.js"></script>
```

## Demo-аккаунты

- Учитель: `teacher@demo.local` / `1234`
- Ученик: `student@demo.local` / `1234`
- Родитель: `parent@demo.local` / `1234`

## Что хранится на backend

- пользователи и роли;
- ученики;
- предметы;
- оценки 1–10;
- комментарии к оценкам;
- уведомления;
- серверные сессии;
- SQLite-база `school.db`.

Frontend больше не хранит авторизацию и данные кабинета в качестве основной базы: запросы идут через REST API.
