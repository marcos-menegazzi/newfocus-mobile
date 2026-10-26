<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from './Icon.vue'
import Logo from './Logo.vue'
import { useAuthStore } from '../stores/auth'
import { useLastSync } from '../composables/useLastSync'
import { useConfirm } from '../composables/useConfirm'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { lastSync } = useLastSync()
const { confirmar } = useConfirm()

interface Item { name: string; label: string; icon: string; match?: string[] }

type Group = { label: string; items: Item[] }

const vendas: Group[] = [
  {
    label: 'Vendas',
    items: [
      { name: 'home', label: 'Início', icon: 'home' },
      { name: 'pedido-novo', label: 'Novo pedido', icon: 'cart' },
      { name: 'pedidos', label: 'Pedidos', icon: 'orders', match: ['pedido-edit'] },
      { name: 'clientes', label: 'Clientes', icon: 'users', match: ['cliente-novo', 'cliente-edit', 'titulos', 'titulo'] },
      { name: 'produtos', label: 'Produtos', icon: 'package', match: ['produto'] },
      { name: 'historico-vendas', label: 'Histórico de vendas', icon: 'chart', match: ['venda'] },
      { name: 'metas', label: 'Metas', icon: 'target' },
    ],
  },
  {
    label: 'Campo',
    items: [{ name: 'agenda', label: 'Agenda de visitas', icon: 'calendar' }],
  },
  {
    label: 'Sistema',
    items: [
      { name: 'sync', label: 'Sincronizar', icon: 'sync' },
      { name: 'config', label: 'Configuração', icon: 'settings' },
    ],
  },
]

const ordemServico: Group[] = [
  {
    label: 'Ordem de serviço',
    items: [
      { name: 'os', label: 'Visão geral', icon: 'home' },
      { name: 'os-despesas', label: 'Despesas', icon: 'receipt' },
      { name: 'os-diario', label: 'Diário de obra', icon: 'clock' },
      { name: 'os-historico', label: 'Histórico', icon: 'orders' },
    ],
  },
  {
    label: 'Sistema',
    items: [{ name: 'config', label: 'Configuração', icon: 'settings' }],
  },
]

const groups = computed(() => (auth.isOs ? ordemServico : vendas))

const current = computed(() => String(route.name ?? ''))

function isActive(item: Item): boolean {
  return current.value === item.name || !!item.match?.includes(current.value)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  (v) => {
    if (v) window.addEventListener('keydown', onKey)
    else window.removeEventListener('keydown', onKey)
  },
)

async function go(name: string) {
  emit('close')
  if (current.value !== name) await router.push({ name })
}

async function logout() {
  emit('close')
  const ok = await confirmar({
    title: 'Sair da conta?',
    message: 'Para entrar de novo, você vai precisar do servidor, do usuário e da senha.',
    confirmLabel: 'Sair',
    danger: true,
  })
  if (!ok) return
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <Transition name="fade">
    <div v-if="open" class="fixed inset-0 z-30 bg-ink-900/40" @click="emit('close')" />
  </Transition>

  <aside class="sidebar" :class="{ open }" :aria-hidden="!open" aria-label="Menu principal">
    <div class="safe-top [--pad-top:1.5rem] px-5 pb-4 border-b border-ink-100">
      <div class="flex items-center gap-3">
        <Logo :height="44" />
        <div class="min-w-0">
          <p class="font-semibold leading-tight">NewFocus</p>
          <p class="text-ink-500 text-[13px] truncate">{{ auth.usuario?.usuario }}</p>
        </div>
      </div>
      <p v-if="!auth.isOs" class="mt-3 flex items-center gap-1.5 text-xs text-ink-500">
        <Icon name="sync" :size="14" />
        Sincronizado em {{ lastSync }}
      </p>
    </div>

    <nav class="flex-1 overflow-y-auto px-3 py-3">
      <div v-for="g in groups" :key="g.label" class="mb-3">
        <p class="px-3 pt-2 pb-1 text-xs font-medium text-ink-400">{{ g.label }}</p>
        <button
          v-for="item in g.items"
          :key="item.name"
          class="w-full flex items-center gap-3 rounded-xl px-3 h-11 text-left text-[15px] transition-colors"
          :class="isActive(item) ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-ink-700 active:bg-ink-100'"
          :aria-current="isActive(item) ? 'page' : undefined"
          :tabindex="open ? 0 : -1"
          @click="go(item.name)"
        >
          <Icon :name="item.icon" />
          {{ item.label }}
        </button>
      </div>
    </nav>

    <div class="px-3 pt-2 border-t border-ink-100 safe-bottom [--pad-bottom:1rem]">
      <button
        class="w-full flex items-center gap-3 rounded-xl px-3 h-11 text-left text-[15px] text-danger-700 active:bg-danger-100"
        :tabindex="open ? 0 : -1"
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
  inset: 0 auto 0 0;
  width: 296px;
  max-width: 84vw;
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  transform: translateX(-100%);
  visibility: hidden;
  transition: transform 0.26s cubic-bezier(0.22, 1, 0.36, 1), visibility 0s linear 0.26s;
  z-index: 40;
}
.sidebar.open {
  transform: translateX(0);
  visibility: visible;
  transition: transform 0.26s cubic-bezier(0.22, 1, 0.36, 1), visibility 0s;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
