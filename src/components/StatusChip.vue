<script setup lang="ts">
const props = defineProps<{ status: string }>()
const MAP: Record<string, { label: string; cls: string }> = {
  A: { label: 'Aberto', cls: 'bg-ink-200 text-ink-600' },
  F: { label: 'Finalizado', cls: 'bg-blue-100 text-blue-700' },
  V: { label: 'Aguardando', cls: 'bg-yellow-100 text-yellow-700' },
  S: { label: 'Sincronizado', cls: 'bg-green-100 text-green-700' },
  Z: { label: 'Faturado', cls: 'bg-teal-100 text-teal-700' },
  C: { label: 'Cancelado', cls: 'bg-red-100 text-red-700' },
}
const chip = MAP[props.status] ?? { label: props.status, cls: 'bg-ink-200 text-ink-600' }
</script>

<template>
  <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="chip.cls">{{ chip.label }}</span>
</template>
