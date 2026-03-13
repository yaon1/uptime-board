<script setup lang="ts">
const emit = defineEmits<{ created: [monitor: never] }>()
const { api } = useAdmin()
const form = reactive({ group_name: '', name: '', type: 'http', target: '', interval_s: 60, expect_keyword: '', alert_after: 1 })
const error = ref('')
const pingUrl = ref('')

async function submit() {
  error.value = ''
  pingUrl.value = ''
  try {
    const created = await api<{ pingUrl?: string }>('/api/monitors', {
      method: 'POST',
      body: { ...form, target: form.type === 'heartbeat' ? undefined : form.target, expect_keyword: form.expect_keyword || undefined },
    })
    if (created.pingUrl) pingUrl.value = created.pingUrl
    emit('created', created as never)
    Object.assign(form, { name: '', target: '', expect_keyword: '' })
  } catch (e) {
    error.value = (e as { statusMessage?: string; data?: { statusMessage?: string } }).data?.statusMessage ?? 'Could not create monitor'
  }
}
</script>

<template>
  <form class="monitor-form" @submit.prevent="submit">
    <label>Name <input v-model="form.name" required maxlength="100" /></label>
    <label>Group <input v-model="form.group_name" placeholder="optional" maxlength="50" /></label>
    <label
      >Type
      <select v-model="form.type">
        <option value="http">HTTP</option>
        <option value="tcp">TCP</option>
        <option value="heartbeat">Heartbeat</option>
        <option value="dns">DNS</option>
      </select>
    </label>
    <label v-if="form.type !== 'heartbeat'"
      >Target
      <input
        v-model="form.target"
        :placeholder="{ http: 'https://example.com', tcp: 'db.internal:5432', dns: 'example.com=93.184.215.14' }[form.type]"
        required
    /></label>
    <label>Every, s <input v-model.number="form.interval_s" type="number" min="30" /></label>
    <label v-if="form.type === 'http'">Must contain <input v-model="form.expect_keyword" placeholder="optional" /></label>
    <label>Alert after <input v-model.number="form.alert_after" type="number" min="1" max="10" /></label>
    <button>Add monitor</button>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="pingUrl" class="ping">
      Ping URL: <code>{{ pingUrl }}</code>
    </p>
  </form>
</template>

<style scoped>
.monitor-form {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: end;
  margin-top: 16px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card);
}
label {
  display: grid;
  gap: 4px;
  font-size: 13px;
  color: var(--muted);
}
input,
select,
button {
  font: inherit;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
}
input[type='number'] {
  width: 90px;
}
button {
  cursor: pointer;
  background: var(--up);
  color: #fff;
  border-color: var(--up);
}
.error {
  color: var(--down);
  width: 100%;
  margin: 0;
}
.ping {
  width: 100%;
  margin: 0;
}
</style>
