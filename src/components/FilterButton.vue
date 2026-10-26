<script setup lang="ts">
import Icon from './Icon.vue'

defineProps<{ count?: number }>()
</script>

<template>
  <button
    type="button"
    class="relative btn btn-secondary btn-sm min-h-10 shrink-0"
    :class="count ? 'border-brand-600 text-brand-700' : ''"
    :aria-label="count ? `Filtros, ${count} ativo${count > 1 ? 's' : ''}` : 'Filtros'"
  >
    <Icon name="filter" :size="18" />
    <span class="hidden min-[380px]:inline">Filtros</span>
    <span
      v-if="count"
      class="min-w-5 h-5 px-1.5 rounded-full bg-brand-600 text-white text-xs font-semibold inline-flex items-center justify-center tabular-nums"
    >{{ count }}</span>
  </button>
</template>
