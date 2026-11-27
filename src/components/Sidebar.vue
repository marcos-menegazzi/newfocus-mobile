<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from './Icon.vue'
import Logo from './Logo.vue'
import { menu } from '../lib/navegacao'
import { useAuthStore } from '../stores/auth'
import { useLastSync } from '../composables/useLastSync'
import { useConfirm } from '../composables/useConfirm'
import { useOverlay } from '../composables/useOverlay'
import { pendenciasRestauracao } from '../services/restaurar'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { lastSync } = useLastSync()
const { confirmar } = useConfirm()

const groups = computed(() => menu(auth.isOs))

const current = computed(() => String(route.name ?? ''))

const panel = ref<HTMLElement | null>(null)
useOverlay(() => props.open, { painel: panel, fechar: () => emit('close') })

async function go(name: string) {
  emit('close')
  if (current.value !== name) await router.push({ name })
}

async function logout() {
  emit('close')
  // Usuário de OS não guarda nada no aparelho.
  const pendente = auth.isOs ? null : await pendenciasRestauracao().catch(() => null)
  const ok = await confirmar({
    title: 'Sair da conta?',
    message: pendente
      ? 'Há clientes, pedidos ou visitas que ainda não foram enviados. Ao sair, todos os dados do aparelho são apagados, inclusive eles, e não dá para recuperar.'
      : 'Todos os dados do aparelho serão apagados. Para entrar de novo, você vai precisar do servidor, do usuário e da senha.',
    confirmLabel: pendente ? 'Apagar e sair' : 'Sair',
    danger: true,
  })
  if (!ok) return
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <Transition name="fade">
    <div v-if="open" class="fixed inset-0 z-30 bg-ink-900/55" @click="emit('close')" />
  </Transition>

  <aside ref="panel" class="sidebar on-navy outline-none" :class="{ open }" :inert="!open" role="dialog" aria-modal="true" aria-label="Menu" tabindex="-1">
    <div class="safe-top [--pad-top:1.5rem] px-5 pb-4 border-b border-brand-500">
      <div class="flex items-center gap-3">
        <span class="rounded-xl bg-surface p-2"><Logo :height="40" /></span>
        <div class="min-w-0 flex-1">
          <p class="font-semibold leading-tight">NewFocus</p>
          <p class="text-cream-dim text-[13px] truncate">{{ auth.usuario?.usuario }}</p>
        </div>
        <button type="button" class="icon-btn -mr-2 self-start text-cream active:bg-brand-500" aria-label="Fechar menu" @click="emit('close')">
          <Icon name="x" :size="22" />
        </button>
      </div>
      <p v-if="!auth.isOs" class="mt-3 flex items-center gap-1.5 text-xs text-cream-dim">
        <Icon name="sync" :size="14" />
        Sincronizado em {{ lastSync }}
      </p>
    </div>

    <nav class="flex-1 overflow-y-auto overscroll-contain px-3 py-3" aria-label="Telas">
      <div v-for="g in groups" :key="g.label" class="mb-3">
        <p class="px-3 pt-2 pb-1 text-xs font-medium text-cream-dim">{{ g.label }}</p>
        <button
          v-for="item in g.items"
          :key="item.name"
          class="w-full flex items-center gap-3 rounded-xl px-3 min-h-12 py-2 text-left text-[15px] transition-colors"
          :class="current === item.name ? 'bg-cream text-brand-600 font-semibold [&>svg]:text-accent-600' : 'text-cream active:bg-brand-500'"
          :aria-current="current === item.name ? 'page' : undefined"
          @click="go(item.name)"
        >
          <Icon :name="item.icon" />
          {{ item.label }}
        </button>
      </div>
    </nav>

    <div class="px-3 pt-2 border-t border-brand-500 safe-bottom [--pad-bottom:1rem]">
      <button
        class="w-full flex items-center gap-3 rounded-xl px-3 min-h-12 py-2 text-left text-[15px] text-danger-300 active:bg-brand-500"
        @click="logout"
      >
        <Icon name="logout" />
        Sair
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  position: fixed;
  inset: 0 0 0 auto;
  width: 296px;
  max-width: 84vw;
  background: var(--color-brand-600);
  color: var(--color-cream);
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  visibility: hidden;
  transition: transform 0.18s var(--ease-exit), visibility 0s linear 0.18s;
  z-index: 40;
}
.sidebar.open {
  transform: translateX(0);
  visibility: visible;
  transition: transform 0.26s var(--ease-enter), visibility 0s;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
