<script setup lang="ts">
const props = defineProps<{ monitorId: number }>()
const { data } = await useFetch(() => `/api/monitors/${props.monitorId}/latency`, { default: () => [], server: false })

const width = 160
const height = 28
const path = computed(() => {
  const points = data.value
  if (points.length < 2) return ''
  const max = Math.max(...points.map((p) => p.avgMs), 1)
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${((i / (points.length - 1)) * width).toFixed(1)},${(height - (p.avgMs / max) * (height - 2) - 1).toFixed(1)}`)
    .join(' ')
})
const last = computed(() => data.value.at(-1))
</script>

<template>
  <span v-if="path" class="spark" :title="last ? `last hour: avg ${last.avgMs} ms, p95 ${last.p95Ms} ms` : ''">
    <svg :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" role="img" aria-label="Response time, last 24 hours">
      <path :d="path" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
    </svg>
  </span>
</template>

<style scoped>
.spark { color: var(--muted); display: inline-flex; }
</style>
