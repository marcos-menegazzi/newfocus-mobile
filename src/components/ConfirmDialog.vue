<script setup lang="ts">
import { nextTick, ref, useId, watch } from 'vue'
import { useConfirm } from '../composables/useConfirm'

const { state, responder } = useConfirm()

const titleId = useId()
const messageId = useId()
const cancelBtn = ref<HTMLButtonElement | null>(null)
let lastFocus: Element | null = null

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') responder(false)
}

watch(
  () => state.open,
  async (v) => {
    if (v) {
      lastFocus = document.activeElement
      window.addEventListener('keydown', onKey)
      document.body.style.overflow = 'hidden'
      await nextTick()
      // Foco em "Cancelar": confirmar uma ação exige um toque deliberado.
      cancelBtn.value?.focus()
    } else {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      if (lastFocus instanceof HTMLElement) lastFocus.focus()
    }
  },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div v-if="state.open" class="fixed inset-0 z-[70] flex items-center justify-center px-6">
        <div class="confirm-backdrop absolute inset-0 bg-ink-900/45" @click="responder(false)" />
        <div
          class="confirm-panel relative w-full max-w-sm bg-surface rounded-3xl shadow-sheet px-5 pt-5 pb-4"
          role="alertdialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="state.message ? messageId : undefined"
        >
          <h2 :id="titleId" class="text-lg font-semibold leading-snug">{{ state.title }}</h2>
          <p v-if="state.message" :id="messageId" class="mt-1.5 text-[15px] text-ink-500 leading-relaxed">{{ state.message }}</p>
          <div class="mt-5 grid grid-cols-2 gap-2">
            <button ref="cancelBtn" type="button" class="btn btn-secondary" @click="responder(false)">
              {{ state.cancelLabel ?? 'Cancelar' }}
            </button>
            <button
              type="button"
              class="btn"
              :class="state.danger ? 'bg-danger-600 text-white active:bg-danger-700' : 'btn-primary'"
              @click="responder(true)"
            >
              {{ state.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-enter-active,
.confirm-leave-active {
  transition: opacity 0.18s ease;
}
.confirm-enter-active .confirm-panel,
.confirm-leave-active .confirm-panel {
  transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}
.confirm-enter-from,
.confirm-leave-to {
  opacity: 0;
}
.confirm-enter-from .confirm-panel,
.confirm-leave-to .confirm-panel {
  transform: scale(0.96);
}
</style>
