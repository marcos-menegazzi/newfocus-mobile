<script setup lang="ts">
import { useRouter } from 'vue-router'
defineProps<{ title: string; back?: boolean }>()
const router = useRouter()
</script>

<template>
  <div class="flex items-center gap-3 mb-4">
    <button v-if="back !== false" class="p-2 -ml-2 rounded-lg text-ink-600 hover:bg-ink-200" aria-label="Voltar" @click="router.back()">
      <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
    </button>
    <h1 class="text-lg font-bold text-ink-900">{{ title }}</h1>
  </div>
</template>
