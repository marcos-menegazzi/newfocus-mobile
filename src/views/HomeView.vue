<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import StatusChip from '../components/StatusChip.vue'
import EmptyState from '../components/EmptyState.vue'
import { query } from '../db/connection'
import { formatReal, mudadata } from '../lib/format'
import { useLastSync } from '../composables/useLastSync'
import { useToast } from '../composables/useToast'

interface CountRow { total: number }
interface VendasRow { total: number; quantidade: number }
interface PedidoRow {
  idpedido: number
  numpedido: string
  fantasia: string
  total: number
  data: string
  status: string
}

const { lastSync } = useLastSync()
const { notify } = useToast()

const totalClientes = ref(0)
const clientesPositivados = ref(0)
const vendasTotal = ref(0)
const vendasQtd = ref(0)
const totalProdutos = ref(0)
const produtosPositivados = ref(0)
const pendencia = ref(0)
const ultimosPedidos = ref<PedidoRow[]>([])

function monthBounds(): [string, string] {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return [`${now.getFullYear()}-${mm}-01`, `${now.getFullYear()}-${mm}-${dd}`]
}

onMounted(async () => {
  try {
    const [start, end] = monthBounds()

    const [[c], [cp], [v], [p], [pp], [pend]] = await Promise.all([
      query<CountRow>('SELECT COUNT(*) AS total FROM CLIFOR'),
      query<CountRow>(`SELECT COUNT(DISTINCT(H.CLIFOR)) AS total FROM HISTVENDA H INNER JOIN HISTITENS I ON H.LANCTO = I.LANCTO WHERE H.DATA BETWEEN ? AND ? AND I.FATURAMENTO = 'S'`, [start, end]),
      query<VendasRow>(`SELECT SUM(X.TOTAL) AS total, COUNT(*) AS quantidade FROM (SELECT H.PEDIDO, SUM(I.VLTOTAL) AS TOTAL FROM HISTVENDA H INNER JOIN HISTITENS I ON H.LANCTO = I.LANCTO WHERE H.DATA BETWEEN ? AND ? AND I.FATURAMENTO = 'S' GROUP BY H.PEDIDO, H.TOTAL) X`, [start, end]),
      query<CountRow>('SELECT COUNT(DISTINCT(CODIGO)) AS total FROM PRODUTOS'),
      query<CountRow>(`SELECT COUNT(DISTINCT(I.PRODUTO)) AS total FROM HISTVENDA H INNER JOIN HISTITENS I ON H.LANCTO = I.LANCTO INNER JOIN PRODUTOS P ON P.CODIGO = I.PRODUTO WHERE H.DATA BETWEEN ? AND ? AND I.FATURAMENTO = 'S'`, [start, end]),
      query<CountRow>(`SELECT COUNT(*) AS total FROM ped WHERE status = 'F'`),
    ])
    ultimosPedidos.value = await query<PedidoRow>(`SELECT p.*, c.fantasia FROM ped p, clifor c WHERE c.codigo = p.clifor ORDER BY p.idpedido DESC LIMIT 10`)

    totalClientes.value = c?.total ?? 0
    clientesPositivados.value = cp?.total ?? 0
    vendasTotal.value = v?.total ?? 0
    vendasQtd.value = v?.quantidade ?? 0
    totalProdutos.value = p?.total ?? 0
    produtosPositivados.value = pp?.total ?? 0
    pendencia.value = pend?.total ?? 0
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Erro ao carregar', 'error')
  }
})
</script>

<template>
  <AppShell>
    <div class="p-6">
      <div class="flex items-center justify-between mb-5">
        <h1 class="text-lg font-bold text-ink-900">Visão Geral</h1>
        <span class="text-xs text-ink-400">{{ lastSync }}</span>
      </div>

      <div class="rounded-card shadow-card bg-navy-900 text-white p-4 mb-4 flex items-center justify-between">
        <p class="text-sm text-white/70">Pedidos aguardando envio</p>
        <p class="text-2xl font-semibold tabular-nums">{{ pendencia }}</p>
      </div>

      <div class="grid grid-cols-3 gap-3 mb-6">
        <div class="rounded-card shadow-card bg-white p-4">
          <p class="text-xs text-ink-400 uppercase tracking-wide">Clientes</p>
          <p class="text-2xl font-semibold tabular-nums text-ink-900 mt-1">{{ totalClientes }}</p>
          <p class="text-xs text-ink-600 mt-1">{{ clientesPositivados }} positivados no mês</p>
        </div>
        <div class="rounded-card shadow-card bg-white p-4">
          <p class="text-xs text-ink-400 uppercase tracking-wide">Pedidos</p>
          <p class="text-2xl font-semibold tabular-nums text-ink-900 mt-1">{{ formatReal(vendasTotal) }}</p>
          <p class="text-xs text-ink-600 mt-1">{{ vendasQtd }} vendidos no mês</p>
        </div>
        <div class="rounded-card shadow-card bg-white p-4">
          <p class="text-xs text-ink-400 uppercase tracking-wide">Produtos</p>
          <p class="text-2xl font-semibold tabular-nums text-ink-900 mt-1">{{ totalProdutos }}</p>
          <p class="text-xs text-ink-600 mt-1">{{ produtosPositivados }} positivados no mês</p>
        </div>
      </div>

      <h2 class="text-sm font-semibold text-ink-900 mb-2">Últimos Pedidos</h2>
      <EmptyState v-if="ultimosPedidos.length === 0" label="Nenhum pedido" />
      <ul v-else class="divide-y divide-ink-200 bg-white rounded-card shadow-card overflow-hidden">
        <li v-for="pedido in ultimosPedidos" :key="pedido.idpedido" class="hover:bg-ink-200/50">
          <RouterLink
            :to="{ name: 'pedido-edit', params: { numpedido: pedido.numpedido } }"
            class="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div class="min-w-0">
              <p class="text-sm font-medium text-ink-900 truncate">{{ pedido.numpedido }}</p>
              <p class="text-xs text-ink-400 truncate">{{ pedido.fantasia }}</p>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <div class="text-right">
                <p class="text-sm font-semibold tabular-nums text-ink-900">{{ formatReal(pedido.total) }}</p>
                <p class="text-xs text-ink-400">{{ mudadata(pedido.data) }}</p>
              </div>
              <StatusChip :status="pedido.status" />
            </div>
          </RouterLink>
        </li>
      </ul>
    </div>
  </AppShell>
</template>
