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
- Создайте heartbeat-монитор и пингуйте его извне (например, cron на другом сервере): если сервер с uptime-board ляжет, вы узнаете об этом по отсутствию алертов… поэтому лучше пинговать внешний сервис вроде healthchecks.io с самого сервера.
