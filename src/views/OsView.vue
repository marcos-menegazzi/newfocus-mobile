<script setup lang="ts">
import { useRouter } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import ScreenHeader from '../components/ScreenHeader.vue'

const router = useRouter()

const cards = [
  {
    name: 'os-despesas',
    title: 'Lançamento de Despesas',
    desc: 'Registrar despesas da OS',
    icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 5.2A1 1 0 005.7 20h10.6a1 1 0 00.9-1.8L15 13M17 19h2M10 19h4',
  },
  {
    name: 'os-diario',
    title: 'Diário de Obra',
    desc: 'Apontamentos de data/hora',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    name: 'os-historico',
    title: 'Histórico',
    desc: '10 últimos lançamentos',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  },
]
</script>

<template>
  <AppShell>
    <div class="p-6">
      <ScreenHeader title="Ordem de Serviço" :back="false" />

      <div class="grid grid-cols-1 gap-4">
        <button
          v-for="c in cards"
          :key="c.name"
          class="bg-white rounded-card shadow-card p-5 text-left flex items-center gap-4"
          @click="router.push({ name: c.name })"
        >
          <div class="h-12 w-12 rounded-xl bg-accent-500/10 text-accent-600 flex items-center justify-center shrink-0">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" :d="c.icon" />
            </svg>
          </div>
          <div>
            <p class="font-semibold text-ink-900">{{ c.title }}</p>
            <p class="text-sm text-ink-600">{{ c.desc }}</p>
          </div>
        </button>
      </div>
    </div>
  </AppShell>
</template>
