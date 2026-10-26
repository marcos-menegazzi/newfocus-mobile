<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import Icon from '../components/Icon.vue'
import LancamentoRow from '../components/LancamentoRow.vue'
import LancamentoSheet from '../components/LancamentoSheet.vue'
import LoadingState from '../components/LoadingState.vue'
import { listarHistorico, type HistoricoRow } from '../services/os'

const agora = new Date()
const dia = agora.getDate()
const mes = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(agora)
const semana = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(agora)
// O histórico vem com datas em dd/mm/aaaa.
const hojeBr = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(agora)

const historico = ref<HistoricoRow[]>([])
const aberto = ref<HistoricoRow | null>(null)
const loading = ref(true)
const erro = ref(false)

const recentes = computed(() => historico.value.slice(0, 5))
const deHoje = computed(() => historico.value.filter((h) => h.data === hojeBr).length)
const resumoHoje = computed(() => {
  if (erro.value || loading.value) return ''
  if (deHoje.value === 0) return 'Nenhum lançamento hoje'
  return deHoje.value === 1 ? '1 lançamento hoje' : `${deHoje.value} lançamentos hoje`
})

async function carregar() {
  loading.value = true
  erro.value = false
  try {
    historico.value = await listarHistorico()
  } catch {
    erro.value = true
  } finally {
    loading.value = false
  }
}

onMounted(carregar)
</script>

<template>
  <AppShell title="Visão geral">
    <div class="page">
      <section class="rounded-3xl bg-brand-800 text-white px-5 pt-4 pb-5" aria-label="Hoje">
        <div class="flex items-end gap-3.5">
          <span class="figure text-[76px] leading-none tabular-nums">{{ dia }}</span>
          <div class="pb-1.5 min-w-0">
            <p class="text-[17px] font-semibold leading-tight">{{ mes }}</p>
            <p class="text-brand-200 text-sm">{{ semana }}</p>
          </div>
        </div>
        <p class="mt-3 text-sm text-brand-200 min-h-5" aria-live="polite">{{ resumoHoje }}</p>

        <div class="mt-4 grid grid-cols-2 gap-2">
          <RouterLink :to="{ name: 'os-diario' }" class="btn flex-col gap-1 min-h-20 bg-white text-brand-800 active:bg-brand-50">
            <Icon name="clock" :size="22" />
            Diário de obra
          </RouterLink>
          <RouterLink :to="{ name: 'os-despesas' }" class="btn flex-col gap-1 min-h-20 bg-brand-700 text-white active:bg-brand-900">
            <Icon name="receipt" :size="22" />
            Lançar despesa
          </RouterLink>
        </div>
      </section>

      <section aria-labelledby="recentes-title">
        <div class="flex items-center justify-between mb-2 px-1">
          <h2 id="recentes-title" class="section-title">Últimos lançamentos</h2>
          <RouterLink v-if="historico.length" :to="{ name: 'os-historico' }" class="text-sm font-semibold text-brand-700 py-1">Ver histórico</RouterLink>
        </div>

        <div v-if="loading" class="panel"><LoadingState /></div>
        <div v-else-if="erro" class="panel">
          <EmptyState icon="alert" label="Sem conexão com o servidor" hint="Ordens de serviço funcionam online. Verifique a internet e tente de novo.">
            <button class="btn btn-secondary" @click="carregar">Tentar de novo</button>
          </EmptyState>
        </div>
        <div v-else-if="recentes.length === 0" class="panel">
          <EmptyState icon="orders" label="Nenhum lançamento ainda" hint="Despesas e diários que você lançar aparecem aqui." />
        </div>
        <ul v-else class="list">
          <li v-for="item in recentes" :key="item.registro">
            <LancamentoRow :item="item" @open="aberto = item" />
          </li>
        </ul>
      </section>
    </div>

    <LancamentoSheet :item="aberto" @close="aberto = null" />
  </AppShell>
</template>
