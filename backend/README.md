# School Journal Pro Backend v3

Локальный FastAPI + SQLite backend для `portal.html`.

## Запуск

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Windows PowerShell:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

API: `http://127.0.0.1:8000`

Swagger: `http://127.0.0.1:8000/docs`

## Frontend

В корне проекта:

```bash
python3 -m http.server 5500
```

Открой `http://127.0.0.1:5500/portal.html`.

`portal.html` подключает `portal.js` обычным script, поэтому inline-кнопки авторизации работают корректно.

## Администратор

При первом запуске backend автоматически создаётся:

```text
Email: admin@school.local
Пароль: Admin123!
```

Администратор может:

- создавать и удалять учителей, учеников и родителей;
- включать/отключать аккаунты;
- менять пароли;
- привязывать родителя к ученику;
- добавлять и изменять учеников;
- создавать предметы и назначать учителей;
- полностью изменять расписание;
- управлять оценками;
- управлять домашними заданиями;
- отправлять сообщения;
- создавать уведомления.

## Демо-аккаунты

```text
Учитель:  teacher@demo.local / 1234
Ученик:   student@demo.local / 1234
Родитель: parent@demo.local / 1234
```

## База данных

Используется SQLite: `backend/school.db`.

При обновлении со старой версии таблица пользователей автоматически мигрируется на новую схему с ролью `admin`. Существующие пользователи и данные сохраняются.

## Роли

- `admin` — полный контроль системы;
- `teacher` — оценки, домашние задания, просмотр учеников и расписания;
- `student` — свои оценки, расписание, домашние задания и сообщения;
- `parent` — данные привязанного ребёнка, расписание, домашние задания и сообщения.
