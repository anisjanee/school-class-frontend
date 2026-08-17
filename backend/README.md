# School Journal Pro Backend

## Запуск локально

Требуется Node.js 20+.

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

Linux/macOS вместо `copy`:

```bash
cp .env.example .env
```

API запускается на `http://localhost:3000`.

## Demo

- teacher@demo.local / 1234
- student@demo.local / 1234
- parent@demo.local / 1234

## Что реализовано

- JWT-аутентификация и роли teacher/student/parent
- bcrypt-хеширование паролей
- SQLite + WAL
- оценки и аналитика
- PDF-отчёты
- push subscriptions через Web Push
- AI endpoint через OpenAI-compatible Chat Completions API
- CORS
- проверка прав доступа
- health check

## Подключение frontend к API

Открой `portal.html`, а в DevTools выполни:

```js
localStorage.setItem('journal_api','http://localhost:3000')
location.reload()
```

Для production обязательно задай собственный `JWT_SECRET`, AI credentials и VAPID keys. Не помещай секреты в frontend или GitHub.
