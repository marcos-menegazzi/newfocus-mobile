<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import BottomNav from './BottomNav.vue'
import Sidebar from './Sidebar.vue'
import Icon from './Icon.vue'
import { useTeclado } from '../composables/useTeclado'
import { useAuthStore } from '../stores/auth'

const props = defineProps<{ title?: string; subtitle?: string; back?: boolean }>()

const router = useRouter()
const auth = useAuthStore()
const open = ref(false)

// Telas de primeiro nível têm a barra inferior; nas de detalhe vale a seta Voltar.
// Com o teclado aberto ela sai, para sobrar tela para o que se digita.
const { tecladoAberto } = useTeclado()
const comBarra = computed(() => !props.back && !tecladoAberto.value)

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push({ name: auth.homeRoute })
}
</script>

<template>
  <div class="min-h-dvh bg-cream text-ink-900 flex flex-col">
    <Sidebar v-if="!back" :open="open" @close="open = false" />

    <header class="sticky top-0 z-20 app-bar on-navy safe-top">
      <div class="flex items-center gap-1 h-14 px-2 max-w-2xl mx-auto">
        <button v-if="back" type="button" class="icon-btn" aria-label="Voltar" @click="goBack">
          <Icon name="back" :size="22" />
        </button>
        <div class="min-w-0 flex-1" :class="back ? 'px-1' : 'px-2'">
          <h1 class="text-[17px] font-semibold leading-tight truncate" :title="title">{{ title ?? 'NewFocus' }}</h1>
          <p v-if="subtitle" class="text-xs text-cream-dim truncate">{{ subtitle }}</p>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <slot name="actions" />
        </div>
      </div>
    </header>

    <main class="flex-1 w-full max-w-2xl mx-auto outline-none" tabindex="-1">
      <slot />
    </main>

    <div v-if="$slots.footer || comBarra" class="sticky bottom-0 z-10">
      <div v-if="$slots.footer" class="bg-surface border-t border-ink-200" :class="comBarra ? '' : 'safe-bottom'">
        <div class="max-w-2xl mx-auto px-4 py-3">
          <slot name="footer" />
        </div>
      </div>
      <BottomNav v-if="comBarra" :menu-aberto="open" @menu="open = true" />
    </div>
  </div>
</template>
