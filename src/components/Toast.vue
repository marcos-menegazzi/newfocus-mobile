<script setup lang="ts">
import Icon from './Icon.vue'

type ToastType = 'info' | 'success' | 'error'
interface ToastItem { id: number; msg: string; type: ToastType }

defineProps<{ items: ToastItem[] }>()

const ICON: Record<ToastType, { name: string; cls: string }> = {
  info: { name: 'info', cls: 'text-white/80' },
  success: { name: 'check-circle', cls: 'text-success-300' },
  error: { name: 'alert', cls: 'text-[#ff8f8f]' },
}
</script>

<template>
  <div class="fixed top-0 left-0 right-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none safe-top [--pad-top:4rem]" aria-live="polite">
    <TransitionGroup name="toast">
      <div
        v-for="t in items"
        :key="t.id"
        class="w-full max-w-sm flex items-start gap-3 bg-ink-900 text-white rounded-2xl px-4 py-3 shadow-pop text-[15px] leading-snug"
        :role="t.type === 'error' ? 'alert' : 'status'"
      >
        <Icon :name="ICON[t.type].name" :class="ICON[t.type].cls" class="mt-px" />
        <span class="min-w-0">{{ t.msg }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s ease, transform 0.24s cubic-bezier(0.22, 1, 0.36, 1); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
