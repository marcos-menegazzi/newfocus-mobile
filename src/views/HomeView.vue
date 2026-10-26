<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import Icon from '../components/Icon.vue'
import Meter from '../components/Meter.vue'
import StatusChip from '../components/StatusChip.vue'
import EmptyState from '../components/EmptyState.vue'
import LoadingState from '../components/LoadingState.vue'
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
  itens: number
}

const { lastSync } = useLastSync()
const { notify } = useToast()

const loading = ref(true)
const totalClientes = ref(0)
const clientesPositivados = ref(0)
const vendasTotal = ref(0)
const vendasQtd = ref(0)
const totalProdutos = ref(0)
const produtosPositivados = ref(0)
const pendencia = ref(0)
const ultimosPedidos = ref<PedidoRow[]>([])

const mes = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date())

function pct(a: number, b: number): string {
  return b > 0 ? `${Math.round((a / b) * 100)}%` : '0%'
}

const vendasLabel = computed(() => `${vendasQtd.value} ${vendasQtd.value === 1 ? 'pedido faturado' : 'pedidos faturados'}`)

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
    ultimosPedidos.value = await query<PedidoRow>(`SELECT p.*, c.fantasia, (SELECT COUNT(*) FROM mped m WHERE m.numpedido = p.numpedido) AS itens FROM ped p, clifor c WHERE c.codigo = p.clifor ORDER BY p.idpedido DESC LIMIT 10`)

    totalClientes.value = c?.total ?? 0
    clientesPositivados.value = cp?.total ?? 0
    vendasTotal.value = v?.total ?? 0
    vendasQtd.value = v?.quantidade ?? 0
    totalProdutos.value = p?.total ?? 0
    produtosPositivados.value = pp?.total ?? 0
    pendencia.value = pend?.total ?? 0
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Erro ao carregar', 'error')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <AppShell title="Início">
    <div class="page">
      <section class="rounded-3xl bg-brand-800 text-white px-5 pt-5 pb-6" aria-labelledby="hero-title">
        <p id="hero-title" class="text-brand-200 text-[15px]">Vendas faturadas em {{ mes }}</p>
        <p class="mt-2 flex items-baseline gap-1.5">
          <span class="text-brand-200 text-xl font-medium">R$</span>
          <span class="figure text-[44px] sm:text-[52px] break-all">{{ formatReal(vendasTotal) }}</span>
        </p>
        <p class="mt-1.5 text-brand-200 text-sm">{{ vendasLabel }}</p>

        <div class="mt-6 grid grid-cols-1 min-[420px]:grid-cols-2 gap-x-6 gap-y-5">
          <div>
            <div class="flex items-baseline justify-between gap-2 mb-2">
              <span class="text-sm">Clientes positivados</span>
              <span class="text-sm font-semibold tabular-nums">{{ pct(clientesPositivados, totalClientes) }}</span>
            </div>
            <Meter tone="dark" :value="clientesPositivados" :max="totalClientes" label="Clientes positivados no mês" />
            <p class="mt-1.5 text-xs text-brand-200 tabular-nums">{{ clientesPositivados }} de {{ totalClientes }}</p>
          </div>
          <div>
            <div class="flex items-baseline justify-between gap-2 mb-2">
              <span class="text-sm">Produtos positivados</span>
              <span class="text-sm font-semibold tabular-nums">{{ pct(produtosPositivados, totalProdutos) }}</span>
            </div>
            <Meter tone="dark" :value="produtosPositivados" :max="totalProdutos" label="Produtos positivados no mês" />
            <p class="mt-1.5 text-xs text-brand-200 tabular-nums">{{ produtosPositivados }} de {{ totalProdutos }}</p>
          </div>
        </div>
      </section>

      <RouterLink
        v-if="pendencia > 0"
        :to="{ name: 'sync' }"
        class="flex items-center gap-3 rounded-2xl bg-sun-100 text-sun-800 px-4 py-3.5"
      >
        <Icon name="send" />
        <span class="flex-1 text-[15px]">
          <strong class="font-semibold">{{ pendencia }} {{ pendencia === 1 ? 'pedido aguardando' : 'pedidos aguardando' }} envio.</strong>
          Sincronize para enviar.
        </span>
        <Icon name="chevron-right" />
      </RouterLink>

      <div class="grid grid-cols-3 gap-2">
        <RouterLink :to="{ name: 'pedido-novo' }" class="btn btn-primary flex-col gap-1 min-h-18 text-sm">
          <Icon name="cart" :size="22" />
          Novo pedido
        </RouterLink>
        <RouterLink :to="{ name: 'cliente-novo' }" class="btn btn-secondary flex-col gap-1 min-h-18 text-sm">
          <Icon name="user-plus" :size="22" />
          Novo cliente
        </RouterLink>
        <RouterLink :to="{ name: 'agenda' }" class="btn btn-secondary flex-col gap-1 min-h-18 text-sm">
          <Icon name="calendar" :size="22" />
          Agenda
        </RouterLink>
      </div>

      <section>
        <div class="flex items-center justify-between mb-2 px-1">
          <h2 class="section-title">Últimos pedidos</h2>
          <RouterLink :to="{ name: 'pedidos' }" class="text-sm font-semibold text-brand-700 py-1">Ver todos</RouterLink>
        </div>
        <LoadingState v-if="loading" />
        <div v-else-if="ultimosPedidos.length === 0" class="panel">
          <EmptyState icon="orders" label="Nenhum pedido ainda" hint="Os pedidos que você criar aparecem aqui.">
            <RouterLink :to="{ name: 'pedido-novo' }" class="btn btn-tonal btn-sm">Criar pedido</RouterLink>
          </EmptyState>
        </div>
        <ul v-else class="list">
          <li v-for="pedido in ultimosPedidos" :key="pedido.idpedido">
            <RouterLink
              :to="{ name: 'pedido-edit', params: { numpedido: pedido.numpedido } }"
              class="list-row flex items-center justify-between gap-3"
            >
              <div class="min-w-0">
                <p class="text-[15px] font-medium truncate">{{ pedido.fantasia }}</p>
                <p class="meta tabular-nums">Nº {{ pedido.numpedido }}, {{ mudadata(pedido.data) }}</p>
              </div>
              <div class="flex flex-col items-end gap-1 shrink-0">
                <p class="text-[15px] font-semibold tabular-nums">R$ {{ formatReal(pedido.total) }}</p>
                <StatusChip :status="pedido.status" :itens="pedido.itens" />
              </div>
            </RouterLink>
          </li>
        </ul>
      </section>

      <p class="text-center text-xs text-ink-400">Última sincronização: {{ lastSync }}</p>
    </div>
  </AppShell>
</template>
