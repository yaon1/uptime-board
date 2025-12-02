<script setup lang="ts">
type Monitor = { id: number; name: string; type: string; target: string; interval_s: number; paused: number; alert_after: number }

useHead({ title: 'Admin', meta: [{ name: 'robots', content: 'noindex' }] })
const { token, setToken, api } = useAdmin()
const monitors = ref<Monitor[]>([])
const error = ref('')
const draftToken = ref('')

async function load() {
  error.value = ''
  try {
    monitors.value = await api<Monitor[]>('/api/monitors')
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode
    error.value = status === 401 ? 'Wrong token' : status === 503 ? 'Admin API is disabled: set NUXT_ADMIN_TOKEN' : 'Request failed'
    if (status === 401) setToken('')
  }
}

async function togglePause(m: Monitor) {
  const updated = await api<Monitor>(`/api/monitors/${m.id}`, { method: 'PATCH', body: { paused: !m.paused } })
  Object.assign(m, updated)
}

async function remove(m: Monitor) {
  if (!confirm(`Delete “${m.name}” and its history?`)) return
  await api(`/api/monitors/${m.id}`, { method: 'DELETE' })
  monitors.value = monitors.value.filter((x) => x.id !== m.id)
}

onMounted(() => token.value && load())
</script>

<template>
  <main class="admin">
    <header>
      <h1>Monitors</h1>
      <NuxtLink to="/">Status page</NuxtLink>
      <button v-if="token" class="link" @click="setToken('')">Sign out</button>
    </header>

    <form v-if="!token" class="login" @submit.prevent="setToken(draftToken), load()">
      <label>Admin token <input v-model="draftToken" type="password" autocomplete="current-password" required /></label>
      <button>Sign in</button>
    </form>

    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <template v-if="token && !error">
      <MonitorForm @created="(m: Monitor) => monitors.push(m)" />
      <table v-if="monitors.length">
        <thead><tr><th>Name</th><th>Type</th><th>Target</th><th>Every</th><th /></tr></thead>
        <tbody>
          <tr v-for="m in monitors" :key="m.id" :class="{ paused: m.paused }">
            <td>{{ m.name }}</td>
            <td>{{ m.type }}</td>
            <td class="target">{{ m.type === 'heartbeat' ? '/api/ping/…' : m.target }}</td>
            <td>{{ m.interval_s }} s</td>
            <td class="actions">
              <button @click="togglePause(m)">{{ m.paused ? 'Resume' : 'Pause' }}</button>
              <button class="danger" @click="remove(m)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else>No monitors yet.</p>
    </template>
  </main>
</template>

<style scoped>
.admin { max-width: 900px; margin: 0 auto; padding: 32px 16px; }
header { display: flex; align-items: baseline; gap: 16px; }
header h1 { margin-right: auto; }
.login { display: flex; gap: 8px; align-items: end; }
input, button { font: inherit; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--card); color: var(--text); }
button { cursor: pointer; }
.link { border: 0; background: none; color: var(--muted); text-decoration: underline; }
.danger { color: var(--down); }
.error { color: var(--down); }
table { width: 100%; border-collapse: collapse; margin-top: 24px; }
th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--border); }
.target { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); }
.actions { display: flex; gap: 6px; justify-content: flex-end; }
tr.paused td:not(.actions) { opacity: 0.5; }
@media (max-width: 640px) { .target, th:nth-child(3) { display: none; } }
</style>
