<script setup lang="ts">
defineProps<{ label?: string }>()
</script>

<template>
  <div class="py-12 flex items-center justify-center gap-2.5 text-ink-500 text-sm" role="status">
    <svg class="animate-spin h-5 w-5 text-brand-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.2" stroke-width="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
    </svg>
    {{ label ?? 'Carregando…' }}
  </div>
</template>
