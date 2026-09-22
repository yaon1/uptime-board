# Как внести вклад

```bash
npm i
NUXT_ADMIN_TOKEN=dev npm run dev
npm test && npm run lint && npm run typecheck
npm run build && npm run smoke
```

- Логика живёт в `server/utils` и тестируется без Nuxt на SQLite в памяти; маршруты в `server/api` — тонкие обёртки.
- Схема меняется только новой миграцией в конце списка в `server/utils/db.ts`, никогда правкой старой. Пересоздание таблицы — с выключенными внешними ключами (уже сделано в раннере).
- Новый канал уведомлений — функция `(event: AlertEvent) => Promise<void>` в `notify.ts` и тест с локальным HTTP-сервером.
- Коммиты в формате [Conventional Commits](https://www.conventionalcommits.org/ru/).
