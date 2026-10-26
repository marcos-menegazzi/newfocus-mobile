<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import LoadingState from '../components/LoadingState.vue'
import FilterButton from '../components/FilterButton.vue'
import FilterChips, { type Chip } from '../components/FilterChips.vue'
import Icon from '../components/Icon.vue'
import SearchField from '../components/SearchField.vue'
import Segmented from '../components/Segmented.vue'
import Sheet from '../components/Sheet.vue'
import StatusChip from '../components/StatusChip.vue'
import { query } from '../db/connection'
import { formatReal, mudadata } from '../lib/format'
import { emitirNfe, emitirBoleto, reenviarPedido } from '../services/sync/fiscal'
import { openPdf, pasta } from '../services/files'
import { useAuthStore } from '../stores/auth'
import { useToast } from '../composables/useToast'
import { useFilters } from '../composables/useFilters'

const COLUMNS: Record<string, string> = {
  numpedido: 'p.numpedido',
  fantasia: 'c.fantasia',
}

const COL_OPTIONS = [
  { value: 'numpedido', label: 'Nº do pedido' },
  { value: 'data', label: 'Data' },
  { value: 'fantasia', label: 'Cliente' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'R', label: 'Rascunho' },
  { value: 'A', label: 'Aberto' },
  { value: 'F', label: 'Finalizado' },
  { value: 'V', label: 'Aguardando' },
  { value: 'S', label: 'Sincronizado' },
  { value: 'Z', label: 'Faturado' },
  { value: 'C', label: 'Cancelado' },
]

const BASE = 'SELECT p.*, c.fantasia, (SELECT COUNT(*) FROM mped m WHERE m.numpedido = p.numpedido) AS itens FROM ped p LEFT JOIN clifor c ON c.codigo = p.clifor'

interface PedidoRow {
  numpedido: string
  data: string
  total: number
  fantasia: string
  status: string
  sefaz: string
  file: string
  lancto: number
  itens: number
}

const auth = useAuthStore()
const router = useRouter()
const { notify } = useToast()

const DEFAULTS = { col: 'numpedido', status: '' }
const { filtros, draft, show: showFiltros, abrir: abrirFiltros, aplicar: aplicarFiltros, limpar: limparFiltros, remover: removerFiltro } =
  useFilters(DEFAULTS, () => buscar())

const search = ref('')
const pedidos = ref<PedidoRow[]>([])
const loading = ref(false)
const searched = ref(false)

const colLabel = (v: string) => COL_OPTIONS.find((o) => o.value === v)?.label ?? v
const placeholder = computed(() => (filtros.col === 'data' ? 'Data (DD/MM/AAAA)' : `Buscar por ${colLabel(filtros.col).toLowerCase()}`))

const chips = computed<Chip[]>(() => {
  const c: Chip[] = []
  if (filtros.col !== DEFAULTS.col) c.push({ key: 'col', label: `Em: ${colLabel(filtros.col)}` })
  if (filtros.status) c.push({ key: 'status', label: STATUS_OPTIONS.find((o) => o.value === filtros.status)!.label })
  return c
})

function dataFilter(term: string): string {
  const m = term.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : term
}

async function buscar() {
  loading.value = true
  try {
    let sql = BASE
    const where: string[] = []
    const params: unknown[] = []
    const term = search.value.trim()
    if (term) {
      if (filtros.col === 'data') {
        where.push('p.data LIKE ?')
        params.push(`%${dataFilter(term)}%`)
      } else {
        where.push(`${COLUMNS[filtros.col]} LIKE ?`)
        params.push(`%${term}%`)
      }
    }
    if (filtros.status === 'R') {
      where.push("p.status = 'A' AND NOT EXISTS (SELECT 1 FROM mped m WHERE m.numpedido = p.numpedido)")
    } else if (filtros.status) {
      where.push('p.status = ?')
      params.push(filtros.status)
    }
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`
    sql += ' ORDER BY p.numpedido DESC'
    pedidos.value = await query<PedidoRow>(sql, params)
    searched.value = true
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Erro ao carregar', 'error')
  } finally {
    loading.value = false
  }
}

onMounted(buscar)

function abrirPedido(p: PedidoRow) {
  router.push(`/pedidos/${p.numpedido}`)
}

async function nfe(p: PedidoRow) {
  try {
    if (p.sefaz === '100' && (p.status === 'S' || p.status === 'Z')) {
      const u = auth.usuario
      if (!u || !p.file) return
      await openPdf(`https://${u.server}/${pasta()}/danfe/li${u.codlic}/${p.file}`)
      return
    }
    await emitirNfe(p.numpedido, p.lancto)
    buscar()
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Não foi possível gerar a NF-e', 'error')
  }
}

async function boleto(p: PedidoRow) {
  try {
    await emitirBoleto(p.lancto)
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Não foi possível gerar o boleto', 'error')
  }
}

async function reenviar(p: PedidoRow) {
  try {
    await reenviarPedido(p.numpedido)
    notify('Pedido reenviado', 'success')
    buscar()
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Não foi possível reenviar o pedido', 'error')
  }
}
</script>

<template>
  <AppShell title="Pedidos" :subtitle="searched ? `${pedidos.length} pedidos` : undefined">
    <template #actions>
      <FilterButton :count="chips.length" @click="abrirFiltros" />
      <RouterLink :to="{ name: 'pedido-novo' }" class="btn btn-primary btn-sm min-h-10 mr-1">
        <Icon name="plus" :size="18" /> Novo
      </RouterLink>
    </template>

    <div class="page">
      <div class="space-y-3">
        <SearchField
            v-model="search"
            :placeholder="placeholder"
            @submit="buscar"
          />
        <FilterChips :items="chips" @remove="removerFiltro" @open="abrirFiltros" />
      </div>

      <LoadingState v-if="loading && !searched" />
      <div v-else-if="searched && pedidos.length === 0" class="panel">
        <EmptyState icon="orders" label="Nenhum pedido encontrado" hint="Tente outro termo ou ajuste os filtros.">
          <RouterLink :to="{ name: 'pedido-novo' }" class="btn btn-tonal btn-sm">Criar pedido</RouterLink>
        </EmptyState>
      </div>
      <ul v-else class="list" :class="{ 'opacity-60': loading }">
        <li v-for="p in pedidos" :key="p.numpedido" class="px-4 py-3.5">
          <button class="w-full text-left flex items-start justify-between gap-3" @click="abrirPedido(p)">
            <div class="min-w-0">
              <p class="text-[15px] font-semibold truncate">{{ p.fantasia || 'Cliente não informado' }}</p>
              <p class="meta tabular-nums mt-0.5">Nº {{ p.numpedido }}, {{ mudadata(p.data) }}</p>
            </div>
            <div class="flex flex-col items-end gap-1 shrink-0">
              <p class="text-[15px] font-semibold tabular-nums">R$ {{ formatReal(p.total) }}</p>
              <StatusChip :status="p.status" :itens="p.itens" />
            </div>
          </button>
          <div v-if="p.status !== 'A' || p.itens > 0" class="flex gap-2 mt-3">
            <button class="btn btn-tonal btn-sm" @click="nfe(p)">
              <Icon name="file" :size="16" /> NF-e
            </button>
            <button class="btn btn-tonal btn-sm" @click="boleto(p)">
              <Icon name="barcode" :size="16" /> Boleto
            </button>
            <button v-if="p.status === 'V'" class="btn btn-tonal btn-sm" @click="reenviar(p)">
              <Icon name="send" :size="16" /> Reenviar
            </button>
          </div>
        </li>
      </ul>
    </div>

    <Sheet :open="showFiltros" title="Filtrar pedidos" @close="showFiltros = false">
      <div class="space-y-5">
        <div>
          <span class="label">Buscar em</span>
          <Segmented v-model="draft.col" :options="COL_OPTIONS" label="Buscar em" />
        </div>
        <div>
          <span class="label">Situação</span>
          <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Situação">
            <button
              v-for="o in STATUS_OPTIONS"
              :key="o.value"
              type="button"
              role="radio"
              :aria-checked="draft.status === o.value"
              class="h-10 px-4 rounded-full border text-sm font-medium transition-colors"
              :class="draft.status === o.value ? 'bg-brand-600 border-brand-600 text-white' : 'bg-surface border-ink-200 text-ink-700'"
              @click="draft.status = o.value"
            >{{ o.label }}</button>
          </div>
        </div>
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
