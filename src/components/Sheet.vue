<script lang="ts">
// Shared across instances so stacked sheets keep the body locked until the last one closes.
let openCount = 0
</script>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import Icon from './Icon.vue'

const props = withDefaults(
  defineProps<{ open: boolean; title: string; subtitle?: string; size?: 'auto' | 'tall' }>(),
  { size: 'auto' },
)
const emit = defineEmits<{ (e: 'close'): void }>()

const titleId = useId()
const panel = ref<HTMLElement | null>(null)
let lastFocus: Element | null = null

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

function lock(on: boolean) {
  openCount = on ? openCount + 1 : Math.max(0, openCount - 1)
  document.body.style.overflow = openCount > 0 ? 'hidden' : ''
}

watch(
  () => props.open,
  async (v) => {
    if (v) {
      lastFocus = document.activeElement
      window.addEventListener('keydown', onKey)
      lock(true)
      await nextTick()
      panel.value?.focus()
    } else {
      window.removeEventListener('keydown', onKey)
      lock(false)
      if (lastFocus instanceof HTMLElement) lastFocus.focus()
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  if (props.open) lock(false)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="sheet-root fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div class="sheet-backdrop absolute inset-0 bg-ink-900/45" @click="emit('close')" />
        <div
          ref="panel"
          class="sheet-panel relative w-full sm:max-w-lg bg-surface rounded-t-3xl sm:rounded-3xl shadow-sheet flex flex-col outline-none"
          :class="size === 'tall' ? 'h-[92vh] sm:h-[80vh]' : 'max-h-[92vh] sm:max-h-[85vh]'"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
        >
          <div class="flex justify-center pt-2.5 sm:hidden" aria-hidden="true">
            <span class="h-1 w-10 rounded-full bg-ink-200" />
          </div>
          <div class="flex items-start gap-3 px-5 pt-3 pb-3">
            <div class="min-w-0 flex-1">
              <h2 :id="titleId" class="text-lg font-semibold leading-snug">{{ title }}</h2>
              <p v-if="subtitle" class="meta mt-0.5 truncate">{{ subtitle }}</p>
            </div>
            <button class="icon-btn -mr-2 -mt-1" aria-label="Fechar" @click="emit('close')">
              <Icon name="x" :size="22" />
            </button>
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
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.22s ease;
}
.sheet-enter-active .sheet-panel,
.sheet-leave-active .sheet-panel {
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
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
