<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import Icon from './Icon.vue'
import { useOverlay } from '../composables/useOverlay'

const props = withDefaults(
  defineProps<{ open: boolean; title: string; subtitle?: string; size?: 'auto' | 'tall' }>(),
  { size: 'auto' },
)
const emit = defineEmits<{ (e: 'close'): void }>()

const titleId = useId()
const panel = ref<HTMLElement | null>(null)

useOverlay(() => props.open, { painel: panel, fechar: () => emit('close') })

// Arrastar o topo da folha para baixo fecha; o botão X e o toque fora fazem o mesmo.
const FECHA_EM = 96
const arrasto = ref(0)
let inicioY: number | null = null

const estiloArrasto = computed(() =>
  arrasto.value > 0 ? { transform: `translateY(${arrasto.value}px)`, transition: 'none' } : undefined,
)

function iniciarArrasto(e: PointerEvent) {
  if ((e.target as HTMLElement).closest('button')) return
  inicioY = e.clientY
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
}

function arrastar(e: PointerEvent) {
  if (inicioY !== null) arrasto.value = Math.max(0, e.clientY - inicioY)
}

function soltar() {
  const fechar = arrasto.value > FECHA_EM
  inicioY = null
  arrasto.value = 0
  if (fechar) emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="sheet-root fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div class="sheet-backdrop absolute inset-0 bg-ink-900/55" @click="emit('close')" />
        <div
          ref="panel"
          class="sheet-panel relative w-full sm:max-w-lg bg-surface rounded-t-3xl sm:rounded-3xl shadow-sheet flex flex-col outline-none"
          :class="size === 'tall' ? 'h-[92dvh] sm:h-[80dvh]' : 'max-h-[92dvh] sm:max-h-[85dvh]'"
          :style="estiloArrasto"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
        >
          <div
            class="touch-none select-none"
            @pointerdown="iniciarArrasto"
            @pointermove="arrastar"
            @pointerup="soltar"
            @pointercancel="soltar"
          >
          <div class="flex justify-center pt-2.5 sm:hidden" aria-hidden="true">
            <span class="h-1 w-10 rounded-full bg-field" />
          </div>
          <div class="flex items-start gap-3 px-5 pt-3 pb-3">
            <div class="min-w-0 flex-1">
              <h2 :id="titleId" class="text-lg font-semibold leading-snug">{{ title }}</h2>
              <p v-if="subtitle" class="meta mt-0.5 truncate">{{ subtitle }}</p>
            </div>
            <button type="button" class="icon-btn -mr-2 -mt-1.5" aria-label="Fechar" @click="emit('close')">
              <Icon name="x" :size="22" />
            </button>
          </div>
          </div>
          <div class="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
            <slot />
          </div>
          <div v-if="$slots.footer" class="border-t border-ink-100 px-5 pt-3 safe-bottom [--pad-bottom:0.75rem]">
            <slot name="footer" />
          </div>
          <div v-else class="safe-bottom" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-panel {
  transition: transform 0.2s var(--ease-enter);
}
.sheet-enter-active {
  transition: opacity 0.22s ease;
}
.sheet-leave-active {
  transition: opacity 0.15s ease;
}
.sheet-enter-active .sheet-panel {
  transition: transform 0.28s var(--ease-enter);
}
.sheet-leave-active .sheet-panel {
  transition: transform 0.18s var(--ease-exit);
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from .sheet-panel,
.sheet-leave-to .sheet-panel {
  transform: translateY(40px);
}
</style>
