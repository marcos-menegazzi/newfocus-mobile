<script setup lang="ts">
import Icon from './Icon.vue'

type ToastType = 'info' | 'success' | 'error'
interface ToastItem { id: number; msg: string; type: ToastType }

defineProps<{ items: ToastItem[] }>()
defineEmits<{ (e: 'close', id: number): void }>()

const ICON: Record<ToastType, { name: string; cls: string }> = {
  info: { name: 'info', cls: 'text-cream-dim' },
  success: { name: 'check-circle', cls: 'text-success-300' },
  error: { name: 'alert', cls: 'text-danger-300' },
}
</script>

<template>
  <div class="fixed top-0 left-0 right-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none safe-top [--pad-top:4rem]" aria-live="polite">
    <TransitionGroup name="toast">
      <div
        v-for="t in items"
        :key="t.id"
        class="pointer-events-auto w-full max-w-sm flex items-start gap-3 bg-ink-900 text-white rounded-2xl pl-4 pr-1.5 py-1.5 shadow-pop text-[15px] leading-snug on-navy"
        :role="t.type === 'error' ? 'alert' : undefined"
      >
        <Icon :name="ICON[t.type].name" :class="ICON[t.type].cls" class="mt-3" />
        <span class="min-w-0 flex-1 py-3">{{ t.msg }}</span>
        <button type="button" class="icon-btn text-cream-dim active:bg-brand-500" aria-label="Fechar aviso" @click="$emit('close', t.id)">
          <Icon name="x" :size="18" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active, .toast-move { transition: opacity 0.2s ease, transform 0.24s var(--ease-enter); }
.toast-leave-active { transition: opacity 0.14s ease, transform 0.14s var(--ease-exit); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
