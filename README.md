# uptime-board

**Self-hosted мониторинг доступности со страницей статуса.** Один контейнер, без внешней БД: следит за сайтами, портами, DNS и cron-задачами, присылает уведомления в Telegram, Slack или на вебхук и показывает публичную страницу статуса с историей, инцидентами и плановыми работами.

Зачем, если есть UptimeRobot и Uptime Kuma:

- **Heartbeat для cron, бэкапов и очередей.** Проверяет не только доступность извне, но и то, что задача действительно отработала: она сама «пингует» URL, а если пинга нет, приходит алерт.
- **Минимум зависимостей.** SQLite встроена в Node 22, никаких Redis, Postgres и внешних сервисов, данные лежат в одном файле.
- **Без ложных тревог.** Алерт приходит только после N неудач подряд (`alert_after`), во время плановых работ молчит, а при восстановлении показывает длительность простоя.
- **Проверка по смыслу, а не только по коду 200.** Можно требовать конкретные статусы и слово на странице; срок TLS-сертификатов отслеживается заранее.
- **Встраивается в ваш стек:** метрики Prometheus, SVG-бейджи для README, RSS инцидентов, экспорт и импорт конфигурации.

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

| Тип | `target` | Успех |
|---|---|---|
| `http` | URL | Код из `expect_status` (по умолчанию < 400) и, если задано, `expect_keyword` в теле |
| `tcp` | `host:port` | TCP-соединение установлено |
| `dns` | `host` или `host=1.2.3.4` | Имя резолвится (в ожидаемый адрес) |
| `heartbeat` | генерируется | Пинг пришёл не позже `interval_s` + `timeout_ms`; задача может сама сообщить о сбое через `/fail` |

Для `https`-мониторов раз в сутки проверяется срок сертификата; за 14 дней (`NUXT_CERT_WARN_DAYS`) приходит предупреждение.

```bash
# Слово «Оформить заказ» должно быть на странице, иначе это сбой, даже при 200
curl -X POST localhost:3000/api/monitors -H "Authorization: Bearer $NUXT_ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Магазин","group_name":"Сайты","type":"http","target":"https://shop.example","expect_keyword":"Оформить заказ","alert_after":2}'

# В скрипте бэкапа: успех или явный сбой
/opt/backup.sh && curl -fsS "$PING_URL" || curl -fsS "$PING_URL/fail?msg=backup+failed"
```

## Настройка

| Переменная | |
|---|---|
| `NUXT_ADMIN_TOKEN` | Токен для admin API и страницы `/admin` (обязательно) |
| `NUXT_TELEGRAM_BOT_TOKEN`, `NUXT_TELEGRAM_CHAT_ID` | Алерты в Telegram |
| `NUXT_SLACK_WEBHOOK_URL` | Алерты в Slack (подходит и для Mattermost, Rocket.Chat) |
| `NUXT_WEBHOOK_URL`, `NUXT_WEBHOOK_SECRET` | JSON-вебхук; с секретом тело подписывается в `X-Uptime-Signature: sha256=…` |
| `NUXT_PUBLIC_TITLE`, `NUXT_PUBLIC_DESCRIPTION` | Заголовок и описание страницы статуса |
| `NUXT_CERT_WARN_DAYS` | За сколько дней предупреждать об истечении сертификата (14) |
| `NUXT_RETENTION_DAYS` | Сколько дней хранить историю проверок (90) |
| `NUXT_DATABASE_PATH` | Путь к SQLite (в Docker: `/data/uptime.sqlite`) |

## API

| Метод | Путь | Доступ |
|---|---|---|
| `GET` | `/api/status`, `/api/incidents`, `/api/maintenance` | публичный |
| `GET` | `/api/monitors/:id/incidents`, `/api/monitors/:id/latency?hours=24` | публичный |
| `GET` / `POST` | `/api/ping/:token`, `/api/ping/:token/fail?msg=…` | по токену heartbeat, не чаще 6 раз в минуту |
| `GET` / `POST` | `/api/monitors` | admin |
| `PATCH` / `DELETE` | `/api/monitors/:id` (в т.ч. `{"paused": true}`) | admin |
| `GET` | `/api/monitors/:id/checks.csv?days=30` | admin |
| `POST` / `DELETE` | `/api/maintenance`, `/api/maintenance/:id` | admin |
| `GET` / `POST` | `/api/export`, `/api/import` | admin |

## Интеграции

| | |
|---|---|
| `/metrics` | Prometheus: `uptime_monitor_up`, `_latency_seconds`, `_uptime_ratio`, `_cert_expiry_timestamp_seconds` |
| `/badge/:id.svg` | Бейдж статуса; `?metric=uptime` — аптайм за 30 дней |
| `/feed.xml` | RSS инцидентов |
| `/admin` | Веб-админка: добавление, пауза, удаление, CSV, экспорт и импорт |

```markdown
![API](https://status.example.com/badge/1.svg?metric=uptime)
```

## Плановые работы

```bash
curl -X POST localhost:3000/api/maintenance -H "Authorization: Bearer $NUXT_ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"starts_at":"2026-11-01T02:00:00Z","ends_at":"2026-11-01T03:00:00Z","note":"Обновление базы"}'
```

Окно без `monitor_id` действует на все мониторы. На странице статуса появляется объявление; проверки идут и попадают в историю, но алерты не отправляются.

## Ещё

- [Деплой, бэкапы, HTTPS](docs/deploy.md)
- [Heartbeat для cron, systemd, Laravel, Kubernetes](docs/heartbeat-recipes.md)

## Разработка

```bash
npm i
NUXT_ADMIN_TOKEN=dev npm run dev
npm test
```

Стек: Nuxt 4, Nitro scheduled tasks, `node:sqlite`, Vitest. Проверки: `npm run lint`, `npm run typecheck`, `npm test`.

## Лицензия

MIT
