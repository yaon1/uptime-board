<script setup lang="ts">


const { title } = useRuntimeConfig().public
const { data, refresh } = await useFetch('/api/status')
const { data: history, refresh: refreshHistory } = await useFetch('/api/incidents', { default: () => [] })
const { data: maintenance } = await useFetch('/api/maintenance', { default: () => [] })
const range = (m: { starts_at: number; ends_at: number }) =>
  `${new Date(m.starts_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} – ${new Date(m.ends_at).toLocaleTimeString(undefined, { timeStyle: 'short' })}`

useHead({ title, link: [{ rel: 'alternate', type: 'application/rss+xml', title: 'Incidents', href: '/feed.xml' }] })
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => (timer = setInterval(() => (refresh(), refreshHistory()), 30_000)))
onBeforeUnmount(() => clearInterval(timer))

const banner = computed(() => {
  switch (data.value?.overall) {
    case 'outage':
      return { text: 'Major outage', cls: 'down' }
    case 'degraded':
      return { text: 'Some systems are down', cls: 'partial' }
    default:
      return { text: 'All systems operational', cls: 'up' }
  }
})

const fmt = (u: number | null) => (u === null ? '—' : `${u.toFixed(2)}%`)
</script>

<template>
  <main>
    <h1>{{ title }}</h1>

    <div class="banner" :class="banner.cls" role="status">{{ banner.text }}</div>

    <aside v-for="m in maintenance" :key="m.id" class="maintenance">
      🛠 Planned maintenance {{ range(m) }}<template v-if="m.note">: {{ m.note }}</template>
    </aside>

    <p v-if="!data?.monitors.length" class="empty">No monitors yet. Add one through the admin API.</p>

    <ul class="monitors">
      <li v-for="m in data?.monitors" :key="m.id" class="monitor">
        <div class="row">
          <span class="dot" :class="m.status" :aria-label="m.status" />
          <strong class="name">{{ m.name }}</strong>
          <span class="meta">
            <template v-if="m.latencyMs !== null">{{ m.latencyMs }} ms · </template>
            24h {{ fmt(m.uptime24h) }} · 30d {{ fmt(m.uptime30d) }}
            <template v-if="m.certDaysLeft !== null && m.certDaysLeft <= 30"> · <span class="cert">TLS: {{ m.certDaysLeft }} d</span></template>
          </span>
        </div>
        <UptimeBars :days="m.days" />
        <LatencySparkline v-if="m.type !== 'heartbeat'" :monitor-id="m.id" />
        <p v-if="m.status === 'down'" class="detail">{{ m.detail }}</p>
      </li>
    </ul>

    <IncidentList :incidents="history" />

    <footer v-if="data">Updated {{ new Date(data.generatedAt).toLocaleTimeString() }} · 90 days · <a href="/feed.xml">RSS</a></footer>
  </main>
</template>

<style scoped>
main { max-width: 760px; margin: 0 auto; padding: 32px 16px; }
h1 { font-size: 28px; margin: 0 0 20px; }
.banner { padding: 14px 18px; border-radius: 10px; color: #fff; font-weight: 600; margin-bottom: 24px; }
.banner.up { background: var(--up); }
.banner.partial { background: var(--partial); }
.banner.down { background: var(--down); }
.maintenance { margin: -12px 0 24px; padding: 10px 14px; border-radius: 10px; border: 1px dashed var(--partial); color: var(--text); font-size: 14px; }
.monitors { list-style: none; padding: 0; margin: 0; background: var(--card); border: 1px solid var(--border); border-radius: 10px; }
.monitor { padding: 16px 18px; border-bottom: 1px solid var(--border); }
.monitor:last-child { border-bottom: 0; }
.row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.name { flex: 1; min-width: 0; }
.meta { color: var(--muted); font-size: 13px; font-variant-numeric: tabular-nums; }
.dot { width: 10px; height: 10px; border-radius: 50%; background: var(--empty); }
.dot.up { background: var(--up); }
.dot.down { background: var(--down); }
.dot.paused { background: var(--muted); }
.detail { margin: 8px 0 0; color: var(--down); font-size: 13px; }
.empty { color: var(--muted); }
.cert { color: var(--partial); font-weight: 600; }
footer { margin-top: 16px; color: var(--muted); font-size: 13px; text-align: center; }
</style>
