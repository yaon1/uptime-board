# uptime-board

**Self-hosted мониторинг доступности со страницей статуса.** Один контейнер, без внешней БД: следит за сайтами, портами и cron-задачами, при падении и восстановлении присылает уведомление в Telegram и показывает публичную страницу статуса с историей за 90 дней.

Зачем, если есть UptimeRobot и Uptime Kuma:

- **Heartbeat для cron, бэкапов и очередей.** Проверяет не только доступность извне, но и то, что задача действительно отработала: она сама «пингует» URL, а если пинга нет, приходит алерт.
- **Минимум зависимостей.** SQLite встроена в Node 22, никаких Redis, Postgres и внешних сервисов, данные лежат в одном файле.
- **Уведомление только при смене статуса.** При восстановлении сообщение показывает, сколько длился простой.

## Пример использования

```bash
NUXT_ADMIN_TOKEN=$(openssl rand -hex 16) docker compose up -d
```

Добавить проверку сайта и порта:

```bash
curl -X POST localhost:3000/api/monitors -H "Authorization: Bearer $NUXT_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"Сайт","type":"http","target":"https://example.com"}'

curl -X POST localhost:3000/api/monitors -H "Authorization: Bearer $NUXT_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"Postgres","type":"tcp","target":"db.internal:5432"}'
```

Следить за ночным бэкапом (тревога, если он не отработал за сутки плюс 10 минут):

```bash
curl -X POST localhost:3000/api/monitors -H "Authorization: Bearer $NUXT_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ночной бэкап","type":"heartbeat","interval_s":86400,"timeout_ms":600000}'
# → { ..., "pingUrl": "http://localhost:3000/api/ping/3f9a…" }

# в crontab:
0 3 * * * /opt/backup.sh && curl -fsS http://status.example.com/api/ping/3f9a…
```

Страница статуса: http://localhost:3000

## Типы проверок

| Тип         | `target`     | Успех                                                          |
| ----------- | ------------ | -------------------------------------------------------------- |
| `http`      | URL          | Ответ с кодом < 400 за `timeout_ms`                            |
| `tcp`       | `host:port`  | TCP-соединение установлено                                     |
| `heartbeat` | генерируется | Пинг пришёл не позже `interval_s` + `timeout_ms` с предыдущего |

Проверки запускаются каждую минуту, каждый монитор опрашивается с интервалом `interval_s` (от 30 с). История хранится 90 дней.

## Настройка

| Переменная                                         |                                                 |
| -------------------------------------------------- | ----------------------------------------------- |
| `NUXT_ADMIN_TOKEN`                                 | Токен для admin API (обязательно)               |
| `NUXT_TELEGRAM_BOT_TOKEN`, `NUXT_TELEGRAM_CHAT_ID` | Куда слать алерты                               |
| `NUXT_PUBLIC_TITLE`                                | Заголовок страницы статуса                      |
| `NUXT_DATABASE_PATH`                               | Путь к SQLite (в Docker: `/data/uptime.sqlite`) |

## API

| Метод          | Путь                | Доступ              |
| -------------- | ------------------- | ------------------- |
| `GET`          | `/api/status`       | публичный           |
| `GET` / `POST` | `/api/ping/:token`  | по токену heartbeat |
| `GET` / `POST` | `/api/monitors`     | admin               |
| `DELETE`       | `/api/monitors/:id` | admin               |

## Разработка

```bash
npm i
NUXT_ADMIN_TOKEN=dev npm run dev
npm test
```

Стек: Nuxt 4, Nitro scheduled tasks, `node:sqlite`, Vitest.

## Лицензия

MIT
