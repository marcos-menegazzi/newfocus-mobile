<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import Sidebar from './Sidebar.vue'
import Icon from './Icon.vue'
import { useSwipe } from '../composables/useSwipe'
import { useAuthStore } from '../stores/auth'

const props = defineProps<{ title?: string; subtitle?: string; back?: boolean }>()

const router = useRouter()
const auth = useAuthStore()
const open = ref(false)
const root = ref<HTMLElement | null>(null)

useSwipe(root, () => {
  if (!props.back) open.value = true
})

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push({ name: auth.homeRoute })
}
</script>

<template>
  <div ref="root" class="min-h-screen bg-mist text-ink-900 flex flex-col">
    <Sidebar :open="open" @close="open = false" />

    <header class="sticky top-0 z-20 bg-mist/92 backdrop-blur-md border-b border-ink-200/70 safe-top">
      <div class="flex items-center gap-1 h-14 px-2 max-w-2xl mx-auto">
        <button v-if="back" class="icon-btn" aria-label="Voltar" @click="goBack">
          <Icon name="back" :size="22" />
        </button>
        <button v-else class="icon-btn" aria-label="Abrir menu" @click="open = true">
          <Icon name="menu" :size="22" />
        </button>
        <div class="min-w-0 flex-1 px-1">
          <h1 class="text-[17px] font-semibold leading-tight truncate">{{ title ?? 'NewFocus' }}</h1>
          <p v-if="subtitle" class="text-xs text-ink-500 truncate">{{ subtitle }}</p>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <slot name="actions" />
        </div>
      </div>
    </header>

    <main class="flex-1 w-full max-w-2xl mx-auto">
      <slot />
    </main>

    <div v-if="$slots.footer" class="sticky bottom-0 z-10 bg-surface/95 backdrop-blur-md border-t border-ink-200 safe-bottom">
      <div class="max-w-2xl mx-auto px-4 py-3">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>
