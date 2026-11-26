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
import { periodoMes } from '../lib/periodo'
import { indicadores } from '../services/indicadores'
import { useAoVoltar } from '../composables/useAoVoltar'
import { useLastSync } from '../composables/useLastSync'
import { useAuthStore } from '../stores/auth'
import { APP_VERSION, VERSAO_COMPILACAO } from '../lib/appInfo'
import { useToast } from '../composables/useToast'

interface CountRow { total: number }
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
const auth = useAuthStore()
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

const nomeMes = () => new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date())
const mes = ref(nomeMes())

function pct(a: number, b: number): string {
  return b > 0 ? `${Math.round((a / b) * 100)}%` : '0%'
}

const vendasLabel = computed(() => `${vendasQtd.value} ${vendasQtd.value === 1 ? 'pedido faturado' : 'pedidos faturados'}`)

async function carregar() {
  mes.value = nomeMes()
  try {
    const [ind, [pend]] = await Promise.all([
      indicadores(periodoMes()),
      query<CountRow>(`SELECT COUNT(*) AS total FROM ped WHERE status = 'F'`),
    ])
    ultimosPedidos.value = await query<PedidoRow>(`SELECT p.*, c.fantasia, (SELECT COUNT(*) FROM mped m WHERE m.numpedido = p.numpedido) AS itens FROM ped p, clifor c WHERE c.codigo = p.clifor ORDER BY p.idpedido DESC LIMIT 10`)

    totalClientes.value = ind.totalClientes
    clientesPositivados.value = ind.clientesPositivados
    vendasTotal.value = ind.vendasTotal
    vendasQtd.value = ind.vendasQtd
    totalProdutos.value = ind.totalProdutos
    produtosPositivados.value = ind.produtosPositivados
    pendencia.value = pend?.total ?? 0
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Erro ao carregar', 'error')
  } finally {
    loading.value = false
  }
}

onMounted(carregar)
useAoVoltar(carregar)
</script>

<template>
  <AppShell title="Início">
    <div class="page">
      <!-- Muitos vendedores recebem o aparelho já logado: usuário e versão ficam à vista. -->
      <dl class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-1 text-[13px] text-ink-500">
        <div class="flex gap-1">
          <dt>Usuário</dt>
          <dd class="font-semibold text-ink-700">{{ auth.usuario?.usuario }}</dd>
        </div>
        <div class="flex gap-1">
          <dt>Versão</dt>
          <dd class="font-semibold text-ink-700 tabular-nums">{{ APP_VERSION }} ({{ VERSAO_COMPILACAO }})</dd>
        </div>
        <div class="flex gap-1 basis-full">
          <dt>Última sincronização:</dt>
          <dd class="font-semibold text-ink-700 tabular-nums">{{ lastSync }}</dd>
        </div>
      </dl>

      <section class="rounded-3xl on-navy bg-brand-600 text-cream px-5 pt-5 pb-6" aria-labelledby="hero-title" :aria-busy="loading">
        <p id="hero-title" class="text-cream-dim text-[15px]">Vendas faturadas em {{ mes }}</p>
        <p class="mt-2 flex items-baseline gap-1.5">
          <span class="text-cream-dim text-xl font-medium">R$</span>
          <span v-if="loading" class="skeleton h-11 w-44" aria-hidden="true" />
          <span v-else class="figure text-[44px] sm:text-[52px] break-all">{{ formatReal(vendasTotal) }}</span>
        </p>
        <p class="mt-1.5 text-cream-dim text-sm min-h-5">{{ loading ? 'Calculando…' : vendasLabel }}</p>

        <div class="mt-6 grid grid-cols-1 min-[420px]:grid-cols-2 gap-x-6 gap-y-5">
          <div>
            <div class="flex items-baseline justify-between gap-2 mb-2">
              <span class="text-sm">Clientes positivados</span>
              <span class="text-sm font-semibold tabular-nums">{{ loading ? '' : pct(clientesPositivados, totalClientes) }}</span>
            </div>
            <Meter tone="dark" :value="clientesPositivados" :max="totalClientes" label="Clientes positivados no mês" />
            <p class="mt-1.5 text-xs text-cream-dim tabular-nums min-h-4"><template v-if="!loading">{{ clientesPositivados }} de {{ totalClientes }}</template></p>
          </div>
          <div>
            <div class="flex items-baseline justify-between gap-2 mb-2">
              <span class="text-sm">Produtos positivados</span>
              <span class="text-sm font-semibold tabular-nums">{{ loading ? '' : pct(produtosPositivados, totalProdutos) }}</span>
            </div>
            <Meter tone="dark" :value="produtosPositivados" :max="totalProdutos" label="Produtos positivados no mês" />
            <p class="mt-1.5 text-xs text-cream-dim tabular-nums min-h-4"><template v-if="!loading">{{ produtosPositivados }} de {{ totalProdutos }}</template></p>
          </div>
        </div>
      </section>

      <RouterLink
        v-if="pendencia > 0"
        :to="{ name: 'sync' }"
        class="flex items-center gap-3 rounded-2xl bg-sun-100 text-sun-800 px-4 py-3.5 transition active:scale-[0.99]"
      >
        <Icon name="send" />
        <span class="flex-1 text-[15px]">
          <strong class="font-semibold">{{ pendencia }} {{ pendencia === 1 ? 'pedido aguardando' : 'pedidos aguardando' }} envio.</strong>
          Sincronize para enviar.
        </span>
        <Icon name="chevron-right" />
      </RouterLink>

      <div class="grid grid-cols-3 gap-2">
        <RouterLink :to="{ name: 'pedido-novo' }" class="btn btn-primary flex-col gap-1 min-h-18 px-2 py-2 text-sm leading-tight text-center whitespace-normal">
          <Icon name="cart" :size="22" />
          Novo pedido
        </RouterLink>
        <RouterLink :to="{ name: 'cliente-novo' }" class="btn btn-secondary flex-col gap-1 min-h-18 px-2 py-2 text-sm leading-tight text-center whitespace-normal">
          <Icon name="user-plus" :size="22" />
          Novo cliente
        </RouterLink>
        <RouterLink :to="{ name: 'agenda' }" class="btn btn-secondary flex-col gap-1 min-h-18 px-2 py-2 text-sm leading-tight text-center whitespace-normal">
          <Icon name="calendar" :size="22" />
          Agenda
        </RouterLink>
      </div>

      <section>
        <div class="flex items-center justify-between mb-1 px-1">
          <h2 class="section-title">Últimos pedidos</h2>
          <RouterLink :to="{ name: 'pedidos' }" class="link inline-flex min-h-11 items-center">Ver todos</RouterLink>
        </div>
        <LoadingState v-if="loading" :rows="4" label="Carregando pedidos…" />
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
                <p class="text-[15px] font-medium leading-snug line-clamp-2">{{ pedido.fantasia }}</p>
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

    </div>
  </AppShell>
</template>
