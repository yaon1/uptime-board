<script setup lang="ts">
defineProps<{ incidents: { monitor: string; start: number; end: number | null; durationMs: number; detail: string | null }[] }>()

const duration = (ms: number) => {
  const min = Math.max(1, Math.round(ms / 60_000))
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`
}
const when = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
</script>

<template>
  <section class="incidents">
    <h2>Past incidents</h2>
    <p v-if="!incidents.length" class="none">No incidents in the last 30 days.</p>
    <ol v-else>
      <li v-for="i in incidents" :key="`${i.monitor}-${i.start}`">
        <strong>{{ i.monitor }}</strong>
        <span :class="{ ongoing: i.end === null }">{{ i.end === null ? 'ongoing' : 'resolved' }}</span>
        <div class="meta">
          {{ when(i.start) }} · {{ duration(i.durationMs) }}<template v-if="i.detail"> · {{ i.detail }}</template>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.incidents {
  margin-top: 32px;
}
h2 {
  font-size: 18px;
}
ol {
  list-style: none;
  padding: 0;
  margin: 0;
}
li {
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}
li span {
  margin-left: 8px;
  font-size: 12px;
  color: var(--up);
}
li span.ongoing {
  color: var(--down);
}
.meta,
.none {
  color: var(--muted);
  font-size: 13px;
}
</style>
