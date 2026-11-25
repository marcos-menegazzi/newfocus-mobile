<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import LoadingState from '../components/LoadingState.vue'
import FilterButton from '../components/FilterButton.vue'
import FilterChips, { type Chip } from '../components/FilterChips.vue'
import Icon from '../components/Icon.vue'
import PositivadoChip from '../components/PositivadoChip.vue'
import SelectField from '../components/SelectField.vue'
import SearchField from '../components/SearchField.vue'
import Segmented from '../components/Segmented.vue'
import Sheet from '../components/Sheet.vue'
import { query } from '../db/connection'
import { formatNumero } from '../lib/format'
import { periodoMes } from '../lib/periodo'
import { buscarProdutos, type ProdutoRow } from '../services/produtos'
import { useAuthStore } from '../stores/auth'
import { useToast } from '../composables/useToast'
import { useFilters } from '../composables/useFilters'

const COL_OPTIONS = [
  { value: 'descred', label: 'Descrição reduzida' },
  { value: 'descricao', label: 'Descrição' },
  { value: 'codigo', label: 'Código' },
]

const POSITIVADO_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'positivados', label: 'Positivados' },
  { value: 'nao', label: 'Não positivados' },
]

const LIMITS = [10, 20, 30, 40, 50, 100]

interface EmpresaRow {
  empresa: number
  fantasia: string
}

const auth = useAuthStore()
const { notify } = useToast()

const DEFAULTS = { col: 'descred', positivado: 'todos', empresa: '', limit: 10 }
const { filtros, draft, show: showFiltros, abrir: abrirFiltros, aplicar: aplicarFiltros, limpar: limparFiltros, remover: removerFiltro } =
  useFilters(DEFAULTS, () => resetAndBuscar())

const search = ref('')
const page = ref(0)

const empresas = ref<EmpresaRow[]>([])
const produtos = ref<ProdutoRow[]>([])
const loading = ref(false)
const searched = ref(false)

const colLabel = (v: string) => COL_OPTIONS.find((o) => o.value === v)?.label ?? v
const placeholder = computed(() => `Buscar por ${colLabel(filtros.col).toLowerCase()}`)

const chips = computed<Chip[]>(() => {
  const c: Chip[] = []
  if (filtros.col !== DEFAULTS.col) c.push({ key: 'col', label: `Em: ${colLabel(filtros.col)}` })
  if (filtros.positivado !== DEFAULTS.positivado) {
    c.push({ key: 'positivado', label: POSITIVADO_OPTIONS.find((o) => o.value === filtros.positivado)!.label })
  }
  if (filtros.empresa) {
    const e = empresas.value.find((x) => String(x.empresa) === filtros.empresa)
    c.push({ key: 'empresa', label: e?.fantasia ?? `Empresa ${filtros.empresa}` })
  }
  if (filtros.limit !== DEFAULTS.limit) c.push({ key: 'limit', label: `${filtros.limit} por página` })
  return c
})

async function buscar() {
  loading.value = true
  try {
    produtos.value = await buscarProdutos({
      col: filtros.col,
      termo: search.value,
      positivado: filtros.positivado,
      empresa: filtros.empresa,
      soComEstoque: auth.usuario?.estoque === 'S',
      periodo: periodoMes(),
      limit: filtros.limit,
      offset: page.value * filtros.limit,
    })
    searched.value = true
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Erro ao carregar', 'error')
  } finally {
    loading.value = false
  }
}

async function loadEmpresas() {
  empresas.value = await query<EmpresaRow>('SELECT * FROM empresas')
}

function resetAndBuscar() {
  page.value = 0
  buscar()
}

function prev() {
  if (page.value === 0) return
  page.value--
  buscar()
}

function next() {
  page.value++
  buscar()
}

onMounted(() => {
  loadEmpresas()
  buscar()
})
</script>

<template>
  <AppShell title="Produtos">
    <template #actions>
      <FilterButton :count="chips.length" class="mr-1" @click="abrirFiltros" />
    </template>

    <div class="page">
      <div class="space-y-3">
        <SearchField v-model="search" :placeholder="placeholder" @submit="resetAndBuscar" />
        <FilterChips :items="chips" @remove="removerFiltro" @open="abrirFiltros" />
      </div>

      <LoadingState v-if="loading && !searched" />
      <div v-else-if="searched && produtos.length === 0" class="panel">
        <EmptyState icon="package" label="Nenhum produto encontrado" hint="Tente outro termo ou ajuste os filtros." />
      </div>
      <ul v-else class="list" :class="{ 'opacity-60': loading }">
        <li v-for="p in produtos" :key="p.codigo">
          <RouterLink :to="{ name: 'produto', params: { codigo: p.codigo } }" class="list-row flex items-center gap-3">
            <div class="min-w-0 flex-1">
              <p class="text-[15px] font-medium leading-snug line-clamp-2">{{ p.descvis }}</p>
              <p class="meta mt-1 tabular-nums">
                Cód. {{ p.codigo }}
                <span class="mx-1.5 text-ink-200" aria-hidden="true">|</span>
                <span v-if="!p.estoque" class="font-medium text-danger-700">Sem estoque</span>
                <span v-else :class="{ 'font-medium text-danger-700': p.estoque < 0 }">Estoque {{ formatNumero(p.estoque) }}</span>
              </p>
            </div>
            <div class="flex flex-col items-end gap-1.5 shrink-0">
              <p class="text-right tabular-nums">
                <span class="block text-[11px] text-ink-500">Comprado</span>
                <span class="figure text-[18px]">{{ formatNumero(p.comprado) }}</span>
              </p>
              <PositivadoChip :positivado="p.positivado > 0" />
            </div>
            <Icon name="chevron-right" class="text-ink-400" />
          </RouterLink>
        </li>
      </ul>

      <nav v-if="searched && (page > 0 || produtos.length >= filtros.limit)" class="flex items-center justify-between gap-3" aria-label="Paginação">
        <button class="btn btn-secondary btn-sm" :disabled="loading || page === 0" @click="prev">
          <Icon name="back" :size="16" /> Anterior
        </button>
        <span class="meta tabular-nums">Página {{ page + 1 }}</span>
        <button class="btn btn-secondary btn-sm" :disabled="loading || produtos.length < filtros.limit" @click="next">
          Próxima <Icon name="chevron-right" :size="16" />
        </button>
      </nav>
    </div>

    <Sheet :open="showFiltros" title="Filtrar produtos" @close="showFiltros = false">
      <div class="space-y-5">
        <label class="block">
          <span class="label">Buscar em</span>
          <SelectField v-model="draft.col" :options="COL_OPTIONS" title="Buscar em" />
        </label>
        <div>
          <span class="label">Positivação no mês</span>
          <Segmented v-model="draft.positivado" :options="POSITIVADO_OPTIONS" label="Positivação no mês" />
        </div>
        <label class="block">
          <span class="label">Empresa</span>
          <SelectField v-model="draft.empresa" :options="[{ value: '', label: 'Todas as empresas' }, ...empresas.map((e) => ({ value: String(e.empresa), label: e.fantasia }))]" title="Selecionar empresa" />
        </label>
        <label class="block">
          <span class="label">Itens por página</span>
          <SelectField v-model="draft.limit" :options="LIMITS.map((l) => ({ value: l, label: String(l) }))" title="Itens por página" />
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
