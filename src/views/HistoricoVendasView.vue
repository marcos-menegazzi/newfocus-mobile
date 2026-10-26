<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import LoadingState from '../components/LoadingState.vue'
import FilterButton from '../components/FilterButton.vue'
import FilterChips, { type Chip } from '../components/FilterChips.vue'
import Icon from '../components/Icon.vue'
import PeriodField from '../components/PeriodField.vue'
import SearchField from '../components/SearchField.vue'
import Segmented from '../components/Segmented.vue'
import Sheet from '../components/Sheet.vue'
import { query } from '../db/connection'
import { formatReal, mudadata } from '../lib/format'
import { formatPeriodo, hojeISO, primeiroDiaMesISO } from '../lib/periodo'
import { useToast } from '../composables/useToast'
import { useFilters } from '../composables/useFilters'

const COLUMNS: Record<string, string> = {
  pedido: 'h.pedido',
  fantasia: 'c.fantasia',
}

const COL_OPTIONS = [
  { value: 'pedido', label: 'Nº do pedido' },
  { value: 'fantasia', label: 'Cliente' },
]

interface VendaRow {
  pedido: number
  data: string
  quantidade: number
  total: number
  fantasia: string
}

const router = useRouter()
const { notify } = useToast()

const DEFAULTS = { col: 'pedido', datainicial: primeiroDiaMesISO(), datafinal: hojeISO(), faturamento: false }
const { filtros, draft, show: showFiltros, abrir: abrirFiltros, aplicar: aplicarFiltros, limpar: limparFiltros, remover: removerFiltro } =
  useFilters(DEFAULTS, () => buscar())

const search = ref('')
const vendas = ref<VendaRow[]>([])
const loading = ref(false)
const searched = ref(false)

const chips = computed<Chip[]>(() => {
  const c: Chip[] = [{ key: 'periodo', label: formatPeriodo(filtros.datainicial, filtros.datafinal), removable: false }]
  if (filtros.col !== DEFAULTS.col) c.push({ key: 'col', label: 'Em: Cliente' })
  if (filtros.faturamento) c.push({ key: 'faturamento', label: 'Só faturados' })
  return c
})
const activeCount = computed(() => chips.value.length - 1 + (filtros.datainicial !== DEFAULTS.datainicial || filtros.datafinal !== DEFAULTS.datafinal ? 1 : 0))

async function buscar() {
  loading.value = true
  try {
    const params: unknown[] = [filtros.datainicial, filtros.datafinal]
    let cond = ''
    const term = search.value.trim()
    if (term) {
      cond += ` AND ${COLUMNS[filtros.col]} LIKE ?`
      params.push(`%${term}%`)
    }
    if (filtros.faturamento) {
      cond += " AND i.faturamento = 'S'"
    }
    const sql = `SELECT x.pedido, x.data, sum(x.quantidade) AS quantidade, sum(x.total) AS total, x.fantasia
FROM (
  SELECT h.pedido, h.lancto, h.data, i.quant AS quantidade, sum(i.vltotal) AS total, c.fantasia
  FROM histvenda h, clifor c, histitens i
  WHERE h.clifor = c.codigo AND h.lancto = i.lancto AND h.data >= ? AND h.data <= ?${cond}
  GROUP BY h.pedido, i.produto, i.sequencia
) x
GROUP BY x.pedido ORDER BY x.pedido DESC`
    vendas.value = await query<VendaRow>(sql, params)
    searched.value = true
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Erro ao carregar', 'error')
  } finally {
    loading.value = false
  }
}

onMounted(buscar)

const totalQuantidade = computed(() => vendas.value.reduce((s, v) => s + Number(v.quantidade), 0))
const totalValor = computed(() => vendas.value.reduce((s, v) => s + Number(v.total), 0))

function abrirVenda(v: VendaRow) {
  router.push({
    name: 'venda',
    params: { pedido: String(v.pedido) },
    query: {
      data: v.data,
      cliente: v.fantasia,
      total: String(v.total),
      fat: filtros.faturamento ? 'S' : 'N',
    },
  })
}
</script>

<template>
  <AppShell title="Histórico de vendas">
    <template #actions>
      <FilterButton :count="activeCount" class="mr-1" @click="abrirFiltros" />
    </template>

    <div class="page">
      <div class="space-y-3">
        <SearchField
            v-model="search"
            :placeholder="filtros.col === 'pedido' ? 'Buscar por nº do pedido' : 'Buscar por cliente'"
            @submit="buscar"
          />
        <FilterChips :items="chips" @remove="removerFiltro" @open="abrirFiltros" />
      </div>

      <section v-if="searched && vendas.length" class="panel grid grid-cols-2 divide-x divide-ink-100">
        <div class="px-4 py-3.5">
          <p class="meta">Total vendido</p>
          <p class="mt-1 text-xl font-semibold tabular-nums">R$ {{ formatReal(totalValor) }}</p>
        </div>
        <div class="px-4 py-3.5">
          <p class="meta">{{ vendas.length }} {{ vendas.length === 1 ? 'pedido' : 'pedidos' }}</p>
          <p class="mt-1 text-xl font-semibold tabular-nums">{{ totalQuantidade }} <span class="text-sm font-normal text-ink-500">itens</span></p>
        </div>
      </section>

      <LoadingState v-if="loading && !searched" />
      <div v-else-if="searched && vendas.length === 0" class="panel">
        <EmptyState icon="chart" label="Nenhuma venda no período" hint="Escolha outro período nos filtros." />
      </div>
      <ul v-else class="list" :class="{ 'opacity-60': loading }">
        <li v-for="v in vendas" :key="v.pedido">
          <button class="list-row flex items-center gap-3" @click="abrirVenda(v)">
            <div class="min-w-0 flex-1">
              <p class="text-[15px] font-medium truncate">{{ v.fantasia }}</p>
              <p class="meta tabular-nums mt-0.5">Nº {{ v.pedido }}, {{ mudadata(v.data) }}</p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-[15px] font-semibold tabular-nums">R$ {{ formatReal(v.total) }}</p>
              <p class="meta tabular-nums">{{ v.quantidade }} itens</p>
            </div>
            <Icon name="chevron-right" class="text-ink-400" />
          </button>
        </li>
      </ul>
    </div>

    <Sheet :open="showFiltros" title="Filtrar vendas" @close="showFiltros = false">
      <div class="space-y-5">
        <PeriodField v-model:ini="draft.datainicial" v-model:fim="draft.datafinal" />
        <div>
          <span class="label">Buscar em</span>
          <Segmented v-model="draft.col" :options="COL_OPTIONS" label="Buscar em" />
        </div>
        <label class="flex items-center justify-between gap-4 rounded-xl border border-ink-200 px-4 py-3.5">
          <span>
            <span class="block text-[15px] font-medium">Somente itens faturados</span>
            <span class="meta">Ignora itens ainda não faturados.</span>
          </span>
          <input v-model="draft.faturamento" type="checkbox" class="h-5 w-5 accent-brand-600" />
        </label>
      </div>
      <template #footer>
        <div class="flex gap-2">
          <button class="btn btn-ghost" @click="limparFiltros">Limpar</button>
          <button class="btn btn-primary flex-1" @click="aplicarFiltros">Aplicar filtros</button>
        </div>
      </template>
    </Sheet>
  </AppShell>
</template>
