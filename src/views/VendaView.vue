<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import ScreenHeader from '../components/ScreenHeader.vue'
import { query } from '../db/connection'
import { formatReal, mudadata } from '../lib/format'

interface ItemRow {
  produto: string
  descricao: string
  quant: number
  vlunit: number
  vldescto: number
  vltotal: number
  condicao: string
  tabela: string
  sequencia: number
}

const route = useRoute()

const pedido = computed(() => {
  const p = route.params.pedido
  return Array.isArray(p) ? p[0] : p
})
const cliente = computed(() => {
  const q = route.query.cliente
  return typeof q === 'string' ? q : ''
})
const data = computed(() => {
  const q = route.query.data
  return typeof q === 'string' ? q : ''
})
const total = computed(() => {
  const q = route.query.total
  return typeof q === 'string' ? q : ''
})
const fat = computed(() => route.query.fat === 'S')

const itens = ref<ItemRow[]>([])

onMounted(async () => {
  const sql = `SELECT h.produto, h.descricao, h.quant, sum(h.vlunit) AS vlunit, sum(h.vldescto) AS vldescto, sum(h.vltotal) AS vltotal, v.condicao, h.tabela, h.sequencia AS sequencia
FROM histvenda v, histitens h
WHERE v.pedido = h.pedido AND v.lancto = h.lancto AND h.pedido = ?${fat.value ? " AND h.faturamento = 'S'" : ''}
GROUP BY h.produto, h.sequencia ORDER BY h.produto`
  itens.value = await query<ItemRow>(sql, [pedido.value])
})
</script>

<template>
  <AppShell>
    <div class="p-6">
      <ScreenHeader :title="`Pedido Nº ${pedido}`" />

      <section class="bg-white rounded-card shadow-card p-5 mb-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <span class="text-ink-600 text-xs font-medium">Cliente</span>
            <p class="text-sm text-ink-900">{{ cliente || '—' }}</p>
          </div>
          <div>
            <span class="text-ink-600 text-xs font-medium">Data</span>
            <p class="text-sm text-ink-900">{{ mudadata(data) }}</p>
          </div>
          <div class="col-span-2">
            <span class="text-ink-600 text-xs font-medium">Total</span>
            <p class="text-sm text-ink-900">{{ formatReal(total) }}</p>
          </div>
        </div>
      </section>

      <EmptyState v-if="itens.length === 0" label="Nenhum item" />
      <div v-else class="overflow-x-auto bg-white rounded-card shadow-card">
        <table class="w-full text-left text-sm">
          <thead class="text-ink-400 text-xs uppercase">
            <tr>
              <th class="py-2 px-3">Produto</th>
              <th class="py-2 px-3">Descrição</th>
              <th class="py-2 px-3 text-right">Qtd</th>
              <th class="py-2 px-3 text-right">Vl. Unit.</th>
              <th class="py-2 px-3 text-right">Desc.</th>
              <th class="py-2 px-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-ink-200">
            <tr v-for="i in itens" :key="i.sequencia">
              <td class="py-2 px-3">{{ i.produto }}</td>
              <td class="py-2 px-3">{{ i.descricao }}</td>
              <td class="py-2 px-3 text-right">{{ i.quant }}</td>
              <td class="py-2 px-3 text-right">{{ formatReal(i.vlunit) }}</td>
              <td class="py-2 px-3 text-right">{{ formatReal(i.vldescto) }}</td>
              <td class="py-2 px-3 text-right">{{ formatReal(i.vltotal) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </AppShell>
</template>
