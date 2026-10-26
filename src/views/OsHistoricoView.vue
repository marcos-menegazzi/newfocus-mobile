<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import LancamentoRow from '../components/LancamentoRow.vue'
import LancamentoSheet from '../components/LancamentoSheet.vue'
import LoadingState from '../components/LoadingState.vue'
import { listarHistorico, type HistoricoRow } from '../services/os'

const historico = ref<HistoricoRow[]>([])
const aberto = ref<HistoricoRow | null>(null)
const loading = ref(true)
const erro = ref(false)

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
  <AppShell title="Histórico" subtitle="10 últimos lançamentos">
    <div class="page">
      <LoadingState v-if="loading" />
      <div v-else-if="erro" class="panel">
        <EmptyState icon="alert" label="Sem conexão com o servidor" hint="O histórico de OS é consultado online. Verifique a internet e tente de novo.">
          <button class="btn btn-secondary" @click="carregar">Tentar de novo</button>
        </EmptyState>
      </div>
      <div v-else-if="historico.length === 0" class="panel">
        <EmptyState icon="orders" label="Nenhum lançamento ainda" hint="Despesas e diários lançados aparecem aqui." />
      </div>
      <ul v-else class="list">
        <li v-for="item in historico" :key="item.registro">
          <LancamentoRow :item="item" @open="aberto = item" />
        </li>
      </ul>
    </div>

    <LancamentoSheet :item="aberto" @close="aberto = null" />
  </AppShell>
</template>
