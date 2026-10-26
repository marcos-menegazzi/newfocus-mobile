<script setup lang="ts">
import { computed } from 'vue'

// `itens`: quantidade de itens do pedido; aberto sem itens é exibido como rascunho.
const props = defineProps<{ status: string; itens?: number }>()

const MAP: Record<string, { label: string; cls: string; dot: string }> = {
  A: { label: 'Aberto', cls: 'bg-ink-100 text-ink-700', dot: 'bg-ink-400' },
  F: { label: 'Finalizado', cls: 'bg-info-100 text-info-800', dot: 'bg-info-600' },
  V: { label: 'Aguardando', cls: 'bg-sun-100 text-sun-800', dot: 'bg-sun-400' },
  S: { label: 'Sincronizado', cls: 'bg-success-50 text-success-800', dot: 'bg-success-600' },
  Z: { label: 'Faturado', cls: 'bg-success-800 text-white', dot: 'bg-success-300' },
  C: { label: 'Cancelado', cls: 'bg-danger-100 text-danger-700', dot: 'bg-danger-600' },
}

const RASCUNHO = { label: 'Rascunho', cls: 'bg-surface text-ink-500 border border-dashed border-ink-400', dot: 'bg-ink-400' }

const chip = computed(() => (props.status === 'A' && props.itens === 0 ? RASCUNHO : null) ?? MAP[props.status] ?? { label: props.status, cls: 'bg-ink-100 text-ink-700', dot: 'bg-ink-400' })
</script>

<template>
  <span class="inline-flex items-center gap-1.5 rounded-full pl-2 pr-2.5 h-6 text-xs font-semibold whitespace-nowrap" :class="chip.cls">
    <span class="h-1.5 w-1.5 rounded-full" :class="chip.dot" aria-hidden="true" />
    {{ chip.label }}
  </span>
</template>
