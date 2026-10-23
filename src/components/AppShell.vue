<script setup lang="ts">
import { ref } from 'vue'
import Sidebar from './Sidebar.vue'
import { useSwipe } from '../composables/useSwipe'

const open = ref(false)
const root = ref<HTMLElement | null>(null)

useSwipe(root, () => { open.value = true })
</script>

<template>
  <div ref="root" class="min-h-screen bg-navy-950 text-ink-900">
    <Sidebar :open="open" @close="open = false" />

    <div
      v-if="open"
      class="fixed inset-0 bg-black/50 z-30"
      @click="open = false"
    />

    <header class="sticky top-0 z-20 bg-navy-900 text-white safe-top">
      <div class="flex items-center gap-3 px-4 py-3">
        <button class="p-2 -ml-2 rounded-lg hover:bg-navy-700" aria-label="Abrir menu" @click="open = true">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 class="text-lg font-bold">NewFocus</h1>
      </div>
    </header>

    <main class="bg-white min-h-[calc(100vh-56px)] rounded-t-2xl -mt-4 pt-4">
      <slot />
    </main>
  </div>
</template>
