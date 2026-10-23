<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const auth = useAuthStore()
const router = useRouter()

const items = [
  { name: 'home', label: 'Início', icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
  { name: 'config', label: 'Configuração', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z' },
]

async function go(name: string) {
  emit('close')
  await router.push({ name })
}

async function logout() {
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="sidebar" :class="{ open }">
    <div class="safe-top px-5 pt-6 pb-4 border-b border-navy-700">
      <div class="flex items-center gap-3">
        <div class="h-10 w-10 rounded-xl bg-accent-500 flex items-center justify-center text-navy-950 font-extrabold">N</div>
        <div>
          <p class="text-white font-semibold">NewFocus</p>
          <p class="text-ink-400 text-xs">{{ auth.usuario?.usuario }}</p>
        </div>
      </div>
    </div>

    <nav class="px-3 py-4 space-y-1">
      <button
        v-for="item in items"
        :key="item.name"
        class="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left text-ink-200 hover:bg-navy-700"
        @click="go(item.name)"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" :d="item.icon" />
        </svg>
        {{ item.label }}
      </button>
    </nav>

    <div class="mt-auto px-3 pb-6 safe-bottom">
      <button class="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left text-red-400 hover:bg-navy-700" @click="logout">
        <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Sair
      </button>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  width: 280px;
  max-width: 82vw;
  background: var(--color-navy-900);
  display: flex;
  flex-direction: column;
  transform: translateX(-100%);
  transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
  z-index: 40;
}
.sidebar.open { transform: translateX(0); }
</style>
