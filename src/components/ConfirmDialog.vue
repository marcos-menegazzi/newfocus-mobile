<script setup lang="ts">
import { ref, useId } from 'vue'
import { useConfirm } from '../composables/useConfirm'
import { useOverlay } from '../composables/useOverlay'

const { state, responder } = useConfirm()

const titleId = useId()
const messageId = useId()
const panel = ref<HTMLElement | null>(null)
const cancelBtn = ref<HTMLButtonElement | null>(null)
const okBtn = ref<HTMLButtonElement | null>(null)

useOverlay(() => state.open, {
  painel: panel,
  fechar: () => responder(false),
  // Foco em "Cancelar": confirmar uma ação exige um toque deliberado.
  foco: () => cancelBtn.value ?? okBtn.value,
})
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div v-if="state.open" class="fixed inset-0 z-[70] flex items-center justify-center px-6">
        <div class="confirm-backdrop absolute inset-0 bg-ink-900/55" @click="responder(false)" />
        <div
          ref="panel"
          class="confirm-panel relative w-full max-w-sm bg-surface rounded-3xl shadow-sheet px-5 pt-5 pb-4"
          role="alertdialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="state.message ? messageId : undefined"
        >
          <h2 :id="titleId" class="text-lg font-semibold leading-snug">{{ state.title }}</h2>
          <p v-if="state.message" :id="messageId" class="mt-1.5 text-[15px] text-ink-500 leading-relaxed whitespace-pre-line max-h-[50dvh] overflow-y-auto">{{ state.message }}</p>
          <div class="mt-5 grid gap-2" :class="state.aviso ? '' : 'grid-cols-2'">
            <button v-if="!state.aviso" ref="cancelBtn" type="button" class="btn btn-secondary whitespace-normal leading-tight" @click="responder(false)">
              {{ state.cancelLabel ?? 'Cancelar' }}
            </button>
            <button
              ref="okBtn"
              type="button"
              class="btn whitespace-normal leading-tight"
              :class="state.danger ? 'btn-danger-solid' : 'btn-primary'"
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
.confirm-enter-active {
  transition: opacity 0.18s ease;
}
.confirm-leave-active {
  transition: opacity 0.12s ease;
}
.confirm-enter-active .confirm-panel {
  transition: transform 0.22s var(--ease-enter);
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
