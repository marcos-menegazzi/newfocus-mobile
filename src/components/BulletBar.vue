<script setup lang="ts">
import { computed } from 'vue'

// Barra "bullet": faixa clara até o objetivo, barra cheia com o realizado e um
// marcador vertical no objetivo. Todas as larguras usam a mesma escala (scale).
const props = withDefaults(
  defineProps<{ value: number; target: number; scale: number; size?: 'md' | 'lg' }>(),
  { size: 'md' },
)

function pct(n: number): number {
  return props.scale > 0 ? Math.min(100, Math.max(0, (n / props.scale) * 100)) : 0
}

const valueW = computed(() => pct(props.value))
const targetX = computed(() => pct(props.target))
</script>

<template>
  <div class="relative w-full" :class="size === 'lg' ? 'h-6' : 'h-4'" aria-hidden="true">
    <div
      v-if="target > 0"
      class="absolute left-0 top-1/2 -translate-y-1/2 rounded-r bg-brand-200/70"
      :class="size === 'lg' ? 'h-3.5' : 'h-2.5'"
      :style="{ width: `${targetX}%` }"
    />
    <div
      class="bar-fill absolute left-0 top-1/2 -translate-y-1/2 rounded-r bg-brand-600"
      :class="size === 'lg' ? 'h-3.5' : 'h-2.5'"
      :style="{ width: `${valueW}%` }"
    />
    <div
      v-if="target > 0"
      class="absolute top-0 bottom-0 w-0.5 -ml-px rounded-full bg-ink-900"
      :style="{ left: `${targetX}%` }"
    />
  </div>
</template>

<style scoped>
.bar-fill {
  transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
</style>
