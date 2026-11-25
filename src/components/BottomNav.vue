<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import Icon from './Icon.vue'
import { abas } from '../lib/navegacao'
import { useAuthStore } from '../stores/auth'

defineProps<{ menuAberto: boolean }>()
defineEmits<{ (e: 'menu'): void }>()

const auth = useAuthStore()
const route = useRoute()

const itens = computed(() => abas(auth.isOs))
const atual = computed(() => String(route.name ?? ''))
const noMenu = computed(() => !itens.value.some((i) => i.name === atual.value))
// Do início se empilha; entre as outras abas se troca: voltar sempre leva ao início.
const trocar = computed(() => atual.value !== auth.homeRoute)

// Tocar na aba em que já se está volta ao topo.
function aoTopo(name: string) {
  if (name !== atual.value) return
  const suave = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: suave ? 'smooth' : 'auto' })
}
</script>

<template>
  <nav class="bg-surface border-t border-ink-200 safe-bottom" aria-label="Principal">
    <ul class="mx-auto flex max-w-2xl px-1">
      <li v-for="i in itens" :key="i.name" class="min-w-0 flex-1">
        <RouterLink
          :to="{ name: i.name }"
          :replace="trocar"
          class="tab"
          :data-ativo="atual === i.name ? '' : undefined"
          @click="aoTopo(i.name)"
        >
          <span class="pilula"><Icon :name="i.icon" :size="22" /></span>
          <span class="max-w-full truncate">{{ i.label }}</span>
        </RouterLink>
      </li>
      <li class="min-w-0 flex-1">
        <button
          type="button"
          class="tab"
          :data-ativo="noMenu ? '' : undefined"
          aria-haspopup="dialog"
          :aria-expanded="menuAberto"
          @click="$emit('menu')"
        >
          <span class="pilula"><Icon name="menu" :size="22" /></span>
          <span class="max-w-full truncate">Menu</span>
        </button>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 100%;
  min-height: 3.75rem;
  padding: 0.375rem 0;
  border-radius: 0.75rem;
  font-size: 12px;
  line-height: 1.25;
  font-weight: 500;
  color: var(--color-ink-500);
}
.tab:focus-visible { outline-offset: -2px; }

.pilula {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  max-width: 100%;
  height: 1.875rem;
  border-radius: 9999px;
  transition: background-color 0.15s ease-out;
}
.tab:active .pilula { background: var(--color-ink-100); }

/* Posição atual: pílula, ícone em vermelho e rótulo mais forte (não só a cor). */
.tab[data-ativo] {
  color: var(--color-brand-600);
  font-weight: 600;
}
.tab[data-ativo] .pilula {
  background: var(--color-brand-50);
  color: var(--color-accent-600);
}

/* Celular deitado: ícone ao lado do rótulo, barra mais baixa. */
@media (max-height: 480px) {
  .tab {
    flex-direction: row;
    gap: 0.25rem;
    min-height: 3rem;
    padding-block: 0;
  }
  .pilula { width: 2.5rem; }
}
</style>
