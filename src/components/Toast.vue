<script setup lang="ts">
type ToastType = 'info' | 'success' | 'error'
interface ToastItem { id: number; msg: string; type: ToastType }

defineProps<{ items: ToastItem[] }>()

const BORDER: Record<ToastType, string> = {
  info: 'border-accent-400',
  success: 'border-[#22C55E]',
  error: 'border-[#EF4444]',
}
</script>

<template>
  <div class="fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center gap-2 p-4 pointer-events-none safe-bottom">
    <div
      v-for="t in items"
      :key="t.id"
      class="w-full max-w-sm bg-navy-900 text-white rounded-xl px-4 py-3 shadow-card border-l-4"
      :class="BORDER[t.type]"
    >{{ t.msg }}</div>
  </div>
</template>
