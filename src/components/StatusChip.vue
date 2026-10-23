<script setup lang="ts">
const props = defineProps<{ status: string }>()
const MAP: Record<string, { label: string; cls: string }> = {
  A: { label: 'Aberto', cls: 'bg-ink-200 text-ink-600' },
  F: { label: 'Finalizado', cls: 'bg-[#58ACFA] text-white' },
  V: { label: 'Aguardando', cls: 'bg-[#EAB308] text-navy-950' },
  S: { label: 'Sincronizado', cls: 'bg-[#22C55E] text-white' },
  Z: { label: 'Faturado', cls: 'bg-[#0be1a4] text-navy-950' },
  C: { label: 'Cancelado', cls: 'bg-[#EF4444] text-white' },
}
const chip = MAP[props.status] ?? { label: props.status, cls: 'bg-ink-200 text-ink-600' }
</script>

<template>
  <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="chip.cls">{{ chip.label }}</span>
</template>
