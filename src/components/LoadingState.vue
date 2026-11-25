<script setup lang="ts">
// `rows`: esqueleto de lista (reserva o espaço); sem ele, o giro com texto.
// Os dois só aparecem depois de um instante, para não piscar em consultas rápidas.
defineProps<{ label?: string; rows?: number }>()
</script>

<template>
  <div v-if="rows" class="list loading" role="status">
    <span class="sr-only">{{ label ?? 'Carregando…' }}</span>
    <div v-for="i in rows" :key="i" class="flex items-center justify-between gap-6 px-4 py-4" aria-hidden="true">
      <div class="flex-1 space-y-2.5">
        <div class="skeleton h-4" :style="{ width: `${78 - (i % 3) * 14}%` }" />
        <div class="skeleton h-3 w-2/5" />
      </div>
      <div class="skeleton h-5 w-20" />
    </div>
  </div>
  <div v-else class="loading py-12 flex items-center justify-center gap-2.5 text-ink-500 text-sm" role="status">
    <svg class="animate-spin h-5 w-5 text-brand-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.2" stroke-width="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
    </svg>
    {{ label ?? 'Carregando…' }}
  </div>
</template>

<style scoped>
.loading { animation: surgir 0.2s ease-out 0.15s backwards; }
</style>
