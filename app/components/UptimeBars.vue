<script setup lang="ts">
const props = defineProps<{ days: { day: string; uptime: number | null }[] }>()

function color(u: number | null): string {
  if (u === null) return 'var(--empty)'
  if (u >= 99.5) return 'var(--up)'
  if (u >= 95) return 'var(--partial)'
  return 'var(--down)'
}
</script>

<template>
  <div class="bars" role="img" :aria-label="`Uptime for the last ${props.days.length} days`">
    <span
      v-for="d in days"
      :key="d.day"
      class="bar"
      :style="{ background: color(d.uptime) }"
      :title="`${d.day}: ${d.uptime === null ? 'no data' : `${d.uptime}%`}`"
    />
  </div>
</template>

<style scoped>
.bars {
  display: flex;
  gap: 2px;
  height: 32px;
}
.bar {
  flex: 1;
  min-width: 2px;
  border-radius: 2px;
}
.bar:hover {
  opacity: 0.7;
}
@media (max-width: 600px) {
  .bar:nth-child(-n + 60) {
    display: none;
  }
}
</style>
