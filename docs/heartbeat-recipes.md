# Рецепты для heartbeat

`PING` — URL, который вернул API при создании монитора (`/api/ping/<token>`).

**cron**

```cron
0 3 * * * /opt/backup.sh && curl -fsS -m 10 --retry 3 "$PING" >/dev/null || curl -fsS "$PING/fail?msg=backup+exit+$?"
```

**systemd timer** (`OnSuccess=`/`OnFailure=` в unit-файле):

```ini
[Unit]
OnSuccess=ping-ok@backup.service
OnFailure=ping-fail@backup.service
```

**Laravel scheduler**

```php
$schedule->command('reports:send')->daily()
    ->pingOnSuccess(env('PING_REPORTS'))
    ->pingOnFailure(env('PING_REPORTS').'/fail');
```

**Kubernetes CronJob** — добавьте `&& wget -qO- "$PING"` в команду контейнера.

**Очередь/воркер** — пингуйте из обработчика раз в N сообщений и выставьте `interval_s` чуть больше ожидаемого промежутка: если воркер встал, придёт алерт.

Лимит — 6 пингов в минуту на монитор; чаще пинговать нет смысла.
