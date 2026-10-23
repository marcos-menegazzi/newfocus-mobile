<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import ScreenHeader from '../components/ScreenHeader.vue'
import { formatReal } from '../lib/format'
import { getDetalhe, listarHistorico, type HistoricoRow, type LancamentoDetalhe } from '../services/os'

const historico = ref<HistoricoRow[]>([])
const detalhe = ref<LancamentoDetalhe | null>(null)

onMounted(async () => {
  historico.value = await listarHistorico()
})

function valorCol(item: HistoricoRow): string {
  return item.tipo === 'Despesa' ? formatReal(item.valor) : '—'
}

async function abrirDetalhe(item: HistoricoRow) {
  detalhe.value = await getDetalhe(item.registro, item.tipo)
}
</script>

<template>
  <AppShell>
    <div class="p-6">
      <ScreenHeader title="Histórico (10 últimos lançamentos)" />

      <EmptyState v-if="historico.length === 0" label="Nenhum lançamento" />
      <div v-else class="overflow-x-auto bg-white rounded-card shadow-card">
        <table class="w-full text-left text-sm">
          <thead class="text-ink-400 text-xs uppercase">
            <tr>
              <th class="py-2 px-3">OS</th>
              <th class="py-2 px-3">Tipo</th>
              <th class="py-2 px-3">Data</th>
              <th class="py-2 px-3 text-right">Valor</th>
              <th class="py-2 px-3" />
            </tr>
          </thead>
          <tbody class="divide-y divide-ink-200">
            <tr v-for="item in historico" :key="item.registro">
              <td class="py-2 px-3 font-medium">{{ item.os }}</td>
              <td class="py-2 px-3">{{ item.tipo }}</td>
              <td class="py-2 px-3">{{ item.data }}</td>
              <td class="py-2 px-3 text-right">{{ valorCol(item) }}</td>
              <td class="py-2 px-3 text-right">
                <button class="text-accent-600 text-sm font-semibold" @click="abrirDetalhe(item)">Detalhes</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="detalhe" class="fixed inset-0 z-40 flex items-end justify-center bg-black/50" @click.self="detalhe = null">
      <div class="w-full max-h-[90vh] overflow-auto rounded-t-2xl bg-white p-5">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-bold text-ink-900">{{ detalhe.tipo }} Nº {{ detalhe.codigo }}</h2>
          <button class="text-ink-600 text-sm font-semibold" @click="detalhe = null">Fechar</button>
        </div>

        <p class="text-sm text-ink-600 mb-1">OS Nº: {{ detalhe.os }}</p>
        <p class="text-sm text-ink-600 mb-1">Data: {{ detalhe.data }} — Hora: {{ detalhe.hora }}</p>
        <p v-if="detalhe.tipo === 'Despesa'" class="text-sm text-ink-600 mb-1">Valor: {{ formatReal(detalhe.valor) }}</p>

        <h3 class="text-sm font-semibold text-ink-900 mt-4 mb-2">Funcionários</h3>
        <ul class="divide-y divide-ink-200 mb-4">
          <li v-for="f in detalhe.funcionarios" :key="f.codigo" class="py-2 text-sm text-ink-900">{{ f.descricao }}</li>
        </ul>

        <template v-if="detalhe.tipo === 'Diário' && detalhe.apontamentos.length">
          <h3 class="text-sm font-semibold text-ink-900 mb-2">Apontamentos</h3>
          <ul class="divide-y divide-ink-200 mb-4">
            <li v-for="(a, i) in detalhe.apontamentos" :key="i" class="py-2 text-sm text-ink-900">{{ a.data }} — {{ a.hora }}</li>
          </ul>
        </template>

        <p v-if="detalhe.obs" class="text-sm text-ink-600">Observação: {{ detalhe.obs }}</p>
      </div>
    </div>
  </AppShell>
</template>
