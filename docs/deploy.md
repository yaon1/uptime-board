# Деплой

## Docker Compose + Caddy (HTTPS автоматически)

См. [`examples/compose.caddy.yaml`](../examples/compose.caddy.yaml). Нужен только DNS-домен, указывающий на сервер.

## Резервные копии

Вся история — один файл SQLite в volume `/data`. Безопасная копия на ходу:

```bash
docker compose exec uptime node -e "new (require('node:sqlite').DatabaseSync)('/data/uptime.sqlite').exec(\"VACUUM INTO '/data/backup.sqlite'\")"
```

Конфигурацию мониторов удобно хранить в git: `GET /api/export` → `POST /api/import` на новом сервере.

## Мониторинг самого мониторинга

- `/metrics` подключите к Prometheus, а `uptime_monitor_up` — к Alertmanager как второй канал.
- Сам uptime-board не может сообщить о собственном падении. Пингуйте с его сервера внешний heartbeat-сервис (например, healthchecks.io) раз в минуту: если сервер ляжет, тревогу поднимет внешний сервис.
