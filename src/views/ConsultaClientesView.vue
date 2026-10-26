<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useFilters } from '../composables/useFilters'
import { RouterLink } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import LoadingState from '../components/LoadingState.vue'
import FilterButton from '../components/FilterButton.vue'
import FilterChips, { type Chip } from '../components/FilterChips.vue'
import Icon from '../components/Icon.vue'
import SelectField from '../components/SelectField.vue'
import SearchField from '../components/SearchField.vue'
import Segmented from '../components/Segmented.vue'
import Sheet from '../components/Sheet.vue'
import { query } from '../db/connection'
import { call } from '../services/sync/context'
import { childText, rowChildren } from '../services/sync/helpers'
import { text } from '../services/soap'
import { openPdf, pdfUrl } from '../services/files'
import { useAuthStore } from '../stores/auth'
import { useToast } from '../composables/useToast'

const COLUMNS: Record<string, string> = {
  fantasia: 'c.fantasia',
  razao: 'c.razao',
  codigo: 'c.codigo',
  cnpj: 'c.cnpj',
  cidade: 'c.cidade',
  estado: 'c.estado',
}

const COL_OPTIONS = [
  { value: 'fantasia', label: 'Nome fantasia' },
  { value: 'razao', label: 'Razão social' },
  { value: 'codigo', label: 'Código' },
  { value: 'cnpj', label: 'CNPJ/CPF' },
  { value: 'cidade', label: 'Cidade' },
  { value: 'estado', label: 'Estado (UF)' },
]

const POSITIVADO_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'positivados', label: 'Positivados' },
  { value: 'nao', label: 'Não positivados' },
]

const BASE = `SELECT c.*, (SELECT COUNT(*) FROM HISTVENDA H INNER JOIN HISTITENS I ON H.LANCTO = I.LANCTO WHERE H.DATA BETWEEN ? AND ? AND I.FATURAMENTO = 'S' AND H.CLIFOR = c.CODIGO) AS positivado FROM clifor c`

interface ClienteRow {
  clifor: number
  codigo: number
  fantasia: string
  tel1: string
  cidade: string
  estado: string
  positivado: number
}

interface GarantiaRow {
  codigo: string
  produto: string
  nota: string
  disposicao: string
  defeito_in: string
  defeito_ex: string
  obs: string
}

const auth = useAuthStore()
const { notify } = useToast()

const DEFAULTS = { col: 'fantasia', positivado: 'todos' }
const { filtros, draft, show: showFiltros, abrir: abrirFiltros, aplicar: aplicarFiltros, limpar: limparFiltros, remover: removerFiltro } =
  useFilters(DEFAULTS, () => buscar())

const search = ref('')
const clientes = ref<ClienteRow[]>([])
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
  return c
})

function monthBounds(): [string, string] {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return [`${now.getFullYear()}-${mm}-01`, `${now.getFullYear()}-${mm}-${dd}`]
}

async function buscar() {
  loading.value = true
  try {
    const [start, end] = monthBounds()
    let sql = BASE
    const params: unknown[] = [start, end]
    const term = search.value.trim()
    if (term) {
      sql += ` WHERE ${COLUMNS[filtros.col]} LIKE ?`
      params.push(`%${term}%`)
    }
    if (filtros.positivado === 'positivados') {
      sql = `SELECT * FROM (${sql}) q WHERE q.positivado > 0`
    } else if (filtros.positivado === 'nao') {
      sql = `SELECT * FROM (${sql}) q WHERE q.positivado = 0`
    }
    clientes.value = await query<ClienteRow>(sql, params)
    searched.value = true
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Erro ao carregar', 'error')
  } finally {
    loading.value = false
  }
}

onMounted(buscar)

async function extrato(c: ClienteRow) {
  const u = auth.usuario
  if (!u) return
  try {
    const doc = await call(`P_EXTWEB:EXEC("${c.codigo}","${u.codlic}")`)
    if (text(doc, 'status') !== 'Ok') {
      notify('Não foi possível gerar o extrato.', 'error')
      return
    }
    const arquivo = text(doc, 'arquivo')
    await openPdf(pdfUrl(`relatorio/li${u.codlic}/${arquivo}`))
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Não foi possível gerar o extrato.', 'error')
  }
}

const garantias = ref(false)
const gClient = ref<ClienteRow | null>(null)
const g = reactive({ dtInicial: '', dtFinal: '', disposicao: '', resolvido: '' })
const gRows = ref<GarantiaRow[]>([])
const gLoading = ref(false)
const gSearched = ref(false)

function abrirGarantias(c: ClienteRow) {
  gClient.value = c
  Object.assign(g, { dtInicial: '', dtFinal: '', disposicao: '', resolvido: '' })
  gRows.value = []
  gSearched.value = false
  garantias.value = true
}

async function buscarGarantias() {
  if (!gClient.value) return
  const c = gClient.value
  gLoading.value = true
  try {
    const doc = await call(
      `P_GTWEB:EXEC(${c.codigo}, '${g.dtInicial}', '${g.dtFinal}', '${g.disposicao}', '${g.resolvido}')`,
    )
    gRows.value = rowChildren(doc, 'retorno').map((el) => ({
      codigo: childText(el, 'codigo'),
      produto: childText(el, 'produto'),
      nota: childText(el, 'nota'),
      disposicao: childText(el, 'disposicao'),
      defeito_in: childText(el, 'defeito_in'),
      defeito_ex: childText(el, 'defeito_ex'),
      obs: childText(el, 'obs'),
    }))
    gSearched.value = true
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Não foi possível buscar as garantias', 'error')
  } finally {
    gLoading.value = false
  }
}
</script>

<template>
  <AppShell title="Clientes" :subtitle="searched ? `${clientes.length} encontrados` : undefined">
    <template #actions>
      <FilterButton :count="chips.length" class="mr-1" @click="abrirFiltros" />
      <RouterLink :to="{ name: 'cliente-novo' }" class="icon-btn text-brand-700" aria-label="Novo cliente">
        <Icon name="user-plus" :size="22" />
      </RouterLink>
    </template>

    <div class="page">
      <div class="space-y-3">
        <SearchField v-model="search" :placeholder="placeholder" @submit="buscar" />
        <FilterChips :items="chips" @remove="removerFiltro" @open="abrirFiltros" />
      </div>

      <LoadingState v-if="loading && !searched" />
      <div v-else-if="searched && clientes.length === 0" class="panel">
        <EmptyState icon="users" label="Nenhum cliente encontrado" hint="Tente outro termo ou ajuste os filtros." />
      </div>
      <ul v-else class="list" :class="{ 'opacity-60': loading }">
        <li v-for="c in clientes" :key="c.codigo" class="px-4 pt-3.5 pb-3">
          <RouterLink :to="`/clientes/${c.clifor}`" class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-[15px] font-semibold truncate">{{ c.fantasia }}</p>
              <p class="meta truncate mt-0.5">{{ c.cidade }}{{ c.estado ? ` / ${c.estado}` : '' }}</p>
              <p v-if="c.tel1" class="meta truncate flex items-center gap-1.5 mt-0.5">
                <Icon name="phone" :size="14" /> {{ c.tel1 }}
              </p>
            </div>
            <span
              v-if="c.positivado > 0"
              class="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-50 text-success-800 pl-1.5 pr-2.5 h-6 text-xs font-semibold"
            >
              <Icon name="check" :size="14" :stroke="2.4" /> Positivado
            </span>
          </RouterLink>
          <div class="flex gap-2 mt-3">
            <RouterLink :to="{ path: `/titulos/${c.codigo}`, query: { fantasia: c.fantasia } }" class="btn btn-tonal btn-sm">
              <Icon name="receipt" :size="16" /> Títulos
            </RouterLink>
            <button class="btn btn-tonal btn-sm" @click="extrato(c)">
              <Icon name="file" :size="16" /> Extrato
            </button>
            <button class="btn btn-tonal btn-sm" @click="abrirGarantias(c)">
              <Icon name="shield" :size="16" /> Garantias
            </button>
          </div>
        </li>
      </ul>
    </div>

    <Sheet :open="showFiltros" title="Filtrar clientes" @close="showFiltros = false">
      <div class="space-y-5">
        <label class="block">
          <span class="label">Buscar em</span>
          <SelectField v-model="draft.col" :options="COL_OPTIONS" title="Buscar em" />
        </label>
        <div>
          <span class="label">Positivação no mês</span>
          <Segmented v-model="draft.positivado" :options="POSITIVADO_OPTIONS" label="Positivação no mês" />
        </div>
      </div>
      <template #footer>
        <div class="flex gap-2">
          <button class="btn btn-ghost" @click="limparFiltros">Limpar</button>
          <button class="btn btn-primary flex-1" @click="aplicarFiltros">Aplicar filtros</button>
        </div>
      </template>
    </Sheet>

    <Sheet :open="garantias" title="Garantias" :subtitle="gClient?.fantasia" size="tall" @close="garantias = false">
      <div class="grid grid-cols-2 gap-3">
        <label class="block">
          <span class="label">De</span>
          <input v-model="g.dtInicial" type="date" class="input" />
        </label>
        <label class="block">
          <span class="label">Até</span>
          <input v-model="g.dtFinal" type="date" class="input" />
        </label>
        <label class="block">
          <span class="label">Disposição</span>
          <input v-model="g.disposicao" type="text" class="input" />
        </label>
        <label class="block">
          <span class="label">Resolvido</span>
          <input v-model="g.resolvido" type="text" class="input" />
        </label>
      </div>
      <button class="btn btn-primary w-full mt-4" :disabled="gLoading" @click="buscarGarantias">
        {{ gLoading ? 'Buscando…' : 'Buscar garantias' }}
      </button>

      <LoadingState v-if="gLoading" />
      <EmptyState v-else-if="gSearched && gRows.length === 0" icon="shield" label="Nenhuma garantia no período" />
      <ul v-else-if="gRows.length" class="mt-5 space-y-3">
        <li v-for="(r, i) in gRows" :key="i" class="rounded-xl border border-ink-200 p-4">
          <div class="flex items-start justify-between gap-3">
            <p class="text-[15px] font-semibold">{{ r.produto }}</p>
            <span class="meta tabular-nums shrink-0">#{{ r.codigo }}</span>
          </div>
          <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <div><dt class="meta">Nota</dt><dd>{{ r.nota || '—' }}</dd></div>
            <div><dt class="meta">Disposição</dt><dd>{{ r.disposicao || '—' }}</dd></div>
            <div><dt class="meta">Defeito na entrada</dt><dd>{{ r.defeito_in || '—' }}</dd></div>
            <div><dt class="meta">Defeito na saída</dt><dd>{{ r.defeito_ex || '—' }}</dd></div>
            <div v-if="r.obs" class="col-span-2"><dt class="meta">Observação</dt><dd>{{ r.obs }}</dd></div>
          </dl>
        </li>
      </ul>
    </Sheet>
  </AppShell>
</template>
