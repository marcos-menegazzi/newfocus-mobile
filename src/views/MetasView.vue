<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppShell from '../components/AppShell.vue'
import BulletBar from '../components/BulletBar.vue'
import EmptyState from '../components/EmptyState.vue'
import LoadingState from '../components/LoadingState.vue'
import FilterButton from '../components/FilterButton.vue'
import FilterChips, { type Chip } from '../components/FilterChips.vue'
import Icon from '../components/Icon.vue'
import SelectField from '../components/SelectField.vue'
import PeriodField from '../components/PeriodField.vue'
import Segmented from '../components/Segmented.vue'
import Sheet from '../components/Sheet.vue'
import { formatReal } from '../lib/format'
import { formatPeriodo, hojeISO, primeiroDiaMesISO } from '../lib/periodo'
import { call } from '../services/sync/context'
import { childText, rowChildren } from '../services/sync/helpers'
import { text } from '../services/soap'
import { useAuthStore } from '../stores/auth'
import { useToast } from '../composables/useToast'
import { useFilters } from '../composables/useFilters'

interface Opt {
  codigo: string
  descricao: string
}

interface MetaRow {
  label: string
  quantidade: string
  total: string
  meta: string
  falta: string
  percmeta: string
  percfalta: string
}

const auth = useAuthStore()
const { notify } = useToast()

const DEFAULTS = { dtInicial: primeiroDiaMesISO(), dtFinal: hojeISO(), grupo: '', marca: '', faturamento: 'S' }
const { filtros, draft, show: showFiltros, abrir: abrirFiltros, aplicar: aplicarFiltros, limpar: limparFiltros, remover: removerFiltro } =
  useFilters(DEFAULTS, () => buscar())

const grupos = ref<Opt[]>([])
const marcas = ref<Opt[]>([])

const tipo = ref('')
const rows = ref<MetaRow[]>([])
const loading = ref(false)
const searched = ref(false)
const failed = ref(false)
const view = ref<'grafico' | 'tabela'>('grafico')
const expanded = ref<number | null>(null)

const chips = computed<Chip[]>(() => {
  const c: Chip[] = [{ key: 'periodo', label: formatPeriodo(filtros.dtInicial, filtros.dtFinal), removable: false }]
  if (filtros.grupo) c.push({ key: 'grupo', label: grupos.value.find((g) => g.codigo === filtros.grupo)?.descricao ?? `Grupo ${filtros.grupo}` })
  if (filtros.marca) c.push({ key: 'marca', label: marcas.value.find((m) => m.codigo === filtros.marca)?.descricao ?? `Marca ${filtros.marca}` })
  if (filtros.faturamento !== DEFAULTS.faturamento) c.push({ key: 'faturamento', label: 'Faturamento: não' })
  return c
})
const activeCount = computed(() =>
  chips.value.length - 1 + (filtros.dtInicial !== DEFAULTS.dtInicial || filtros.dtFinal !== DEFAULTS.dtFinal ? 1 : 0),
)

function toBr(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function num(v: string): number {
  const s = String(v ?? '').trim()
  const n = parseFloat(s.includes(',') && !s.includes('.') ? s.replace(',', '.') : s)
  return Number.isFinite(n) ? n : 0
}

function pctLabel(n: number): string {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: n < 10 ? 1 : 0 }).format(n)}%`
}

function labelHeader(t: string): string {
  switch (t) {
    case 'grupo': return 'Grupo'
    case 'marca': return 'Marca'
    case 'produto': return 'Produto'
    case 'grupo_marca': return 'Grupo e marca'
    default: return 'Vendedor'
  }
}

function labelPlural(t: string): string {
  switch (t) {
    case 'grupo': return 'grupos'
    case 'marca': return 'marcas'
    case 'produto': return 'produtos'
    case 'grupo_marca': return 'combinações de grupo e marca'
    default: return 'vendedores'
  }
}

function labelFor(t: string, el: Element): string {
  switch (t) {
    case 'grupo': return childText(el, 'grupo')
    case 'marca': return childText(el, 'marca')
    case 'produto': return childText(el, 'produto')
    case 'grupo_marca': return `${childText(el, 'grupo')} ${childText(el, 'marca')}`.trim()
    default: return childText(el, 'vendedor')
  }
}

const parsed = computed(() =>
  rows.value
    .map((r, i) => {
      const total = num(r.total)
      const meta = num(r.meta)
      return { ...r, i, totalN: total, metaN: meta, pct: meta > 0 ? (total / meta) * 100 : 0 }
    })
    .sort((a, b) => b.pct - a.pct || b.totalN - a.totalN),
)

const resumo = computed(() => {
  const realizado = parsed.value.reduce((s, r) => s + r.totalN, 0)
  const objetivo = parsed.value.reduce((s, r) => s + r.metaN, 0)
  const pct = objetivo > 0 ? (realizado / objetivo) * 100 : 0
  return {
    realizado,
    objetivo,
    falta: Math.max(0, objetivo - realizado),
    pct,
    atingidas: parsed.value.filter((r) => r.metaN > 0 && r.pct >= 100).length,
  }
})

const scale = computed(() => Math.max(1, ...parsed.value.map((r) => Math.max(r.totalN, r.metaN))))
const heroScale = computed(() => Math.max(resumo.value.realizado, resumo.value.objetivo, 1))

async function loadSelects() {
  const u = auth.usuario
  if (!u) return
  try {
    const [g, m] = await Promise.all([
      call(`P_GPWEB:EXEC(${u.codlic})`),
      call(`P_MRCWEB:EXEC(${u.codlic})`),
    ])
    grupos.value = rowChildren(g, 'grupos').map((el) => ({
      codigo: childText(el, 'codigo'),
      descricao: childText(el, 'descricao'),
    }))
    marcas.value = rowChildren(m, 'marcas').map((el) => ({
      codigo: childText(el, 'codigo'),
      descricao: childText(el, 'descricao'),
    }))
  } catch {
    // filtros de grupo/marca ficam vazios; a consulta principal mostra o erro
  }
}

async function buscar() {
  const u = auth.usuario
  if (!u) return
  loading.value = true
  failed.value = false
  expanded.value = null
  try {
    const doc = await call(
      `P_RMTWEB01:EXEC(${u.codlic}, '${toBr(filtros.dtInicial)}', '${toBr(filtros.dtFinal)}', '${filtros.grupo}', '${filtros.marca}', '${filtros.faturamento}')`,
    )
    tipo.value = text(doc, 'tipo')
    rows.value = rowChildren(doc, 'retorno')
      .filter((el) => el.getElementsByTagName('quantidade').length > 0)
      .map((el) => ({
        label: labelFor(tipo.value, el),
        quantidade: childText(el, 'quantidade'),
        total: childText(el, 'total'),
        meta: childText(el, 'meta'),
        falta: childText(el, 'falta'),
        percmeta: childText(el, 'percmeta'),
        percfalta: childText(el, 'percfalta'),
      }))
    searched.value = true
  } catch (e) {
    failed.value = true
    notify(e instanceof Error ? e.message : 'Erro ao carregar', 'error')
  } finally {
    loading.value = false
  }
}

function toggle(i: number) {
  expanded.value = expanded.value === i ? null : i
}

onMounted(async () => {
  await Promise.all([loadSelects(), buscar()])
})
</script>

<template>
  <AppShell title="Metas">
    <template #actions>
      <FilterButton :count="activeCount" class="mr-1" @click="abrirFiltros" />
    </template>

    <div class="page">
      <FilterChips :items="chips" @remove="removerFiltro" @open="abrirFiltros" />

      <LoadingState v-if="loading && !searched" label="Consultando metas no servidor…" />

      <div v-else-if="failed && !searched" class="panel">
        <EmptyState icon="alert" label="Não foi possível carregar as metas" hint="As metas são consultadas no servidor. Verifique a conexão com a internet.">
          <button class="btn btn-tonal btn-sm" @click="buscar">Tentar de novo</button>
        </EmptyState>
      </div>

      <div v-else-if="searched && rows.length === 0" class="panel">
        <EmptyState icon="target" label="Nenhuma meta no período" hint="Escolha outro período ou remova os filtros de grupo e marca." />
      </div>

      <template v-else-if="searched">
        <div class="space-y-4 transition-opacity" :class="{ 'opacity-55': loading }">
          <section class="panel p-5" aria-labelledby="resumo-title">
            <h2 id="resumo-title" class="meta">Objetivo alcançado no período</h2>
            <div class="mt-2 flex items-end justify-between gap-4">
              <p class="figure text-[56px] text-ink-900">{{ resumo.objetivo > 0 ? pctLabel(resumo.pct) : '—' }}</p>
              <p
                v-if="resumo.objetivo > 0"
                class="mb-1.5 inline-flex items-center gap-1.5 text-sm font-semibold"
                :class="resumo.pct >= 100 ? 'text-success-600' : 'text-ink-700'"
              >
                <Icon :name="resumo.pct >= 100 ? 'check-circle' : 'target'" :size="18" />
                {{ resumo.pct >= 100 ? 'Meta batida' : `Faltam R$ ${formatReal(resumo.falta)}` }}
              </p>
            </div>
            <div class="mt-4">
              <BulletBar size="lg" :value="resumo.realizado" :target="resumo.objetivo" :scale="heroScale" />
            </div>
            <dl class="mt-4 grid grid-cols-2 gap-3">
              <div class="rounded-xl bg-ink-50 px-3.5 py-3">
                <dt class="meta flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-brand-600" aria-hidden="true" /> Realizado</dt>
                <dd class="mt-1 text-[17px] font-semibold tabular-nums">R$ {{ formatReal(resumo.realizado) }}</dd>
              </div>
              <div class="rounded-xl bg-ink-50 px-3.5 py-3">
                <dt class="meta flex items-center gap-1.5"><span class="h-3 w-0.5 rounded-full bg-ink-900" aria-hidden="true" /> Objetivo</dt>
                <dd class="mt-1 text-[17px] font-semibold tabular-nums">R$ {{ formatReal(resumo.objetivo) }}</dd>
              </div>
            </dl>
            <p v-if="parsed.length > 1" class="meta mt-3">
              {{ resumo.atingidas }} de {{ parsed.length }} {{ labelPlural(tipo) }} já bateram a meta.
            </p>
          </section>

          <section class="panel" aria-labelledby="detalhe-title">
            <div class="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
              <h2 id="detalhe-title" class="section-title">Por {{ labelHeader(tipo).toLowerCase() }}</h2>
              <Segmented
                v-model="view"
                class="w-44"
                :options="[{ value: 'grafico', label: 'Gráfico' }, { value: 'tabela', label: 'Tabela' }]"
                label="Modo de exibição"
              />
            </div>

            <template v-if="view === 'grafico'">
              <div class="flex flex-wrap gap-x-4 gap-y-1 px-5 pb-2 text-xs text-ink-500">
                <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-3 rounded-sm bg-brand-600" aria-hidden="true" /> Realizado</span>
                <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-3 rounded-sm bg-brand-200/70" aria-hidden="true" /> Até o objetivo</span>
                <span class="inline-flex items-center gap-1.5"><span class="h-3 w-0.5 rounded-full bg-ink-900" aria-hidden="true" /> Objetivo</span>
              </div>
              <ul class="divide-y divide-ink-100">
                <li v-for="r in parsed" :key="r.i">
                  <button
                    class="w-full text-left px-5 py-3.5 transition-colors"
                    :class="expanded === r.i ? 'bg-ink-50' : 'active:bg-ink-50'"
                    :aria-expanded="expanded === r.i"
                    @click="toggle(r.i)"
                  >
                    <span class="flex items-baseline justify-between gap-3">
                      <span class="text-[15px] font-medium truncate">{{ r.label || '—' }}</span>
                      <span class="shrink-0 inline-flex items-center gap-1 text-[15px] font-semibold tabular-nums">
                        <Icon v-if="r.metaN > 0 && r.pct >= 100" name="check" :size="16" :stroke="2.4" class="text-success-600" />
                        {{ r.metaN > 0 ? pctLabel(r.pct) : 'Sem objetivo' }}
                      </span>
                    </span>
                    <span class="block mt-2">
                      <BulletBar :value="r.totalN" :target="r.metaN" :scale="scale" />
                    </span>
                    <span class="mt-1.5 flex justify-between gap-3 meta tabular-nums">
                      <span>R$ {{ formatReal(r.totalN) }}</span>
                      <span>de R$ {{ formatReal(r.metaN) }}</span>
                    </span>
                    <span v-if="expanded === r.i" class="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <span class="rounded-lg bg-surface border border-ink-100 px-2.5 py-2">
                        <span class="block meta text-xs">Quantidade</span>
                        <span class="font-semibold tabular-nums">{{ r.quantidade }}</span>
                      </span>
                      <span class="rounded-lg bg-surface border border-ink-100 px-2.5 py-2">
                        <span class="block meta text-xs">Faltante</span>
                        <span class="font-semibold tabular-nums">{{ r.falta }}</span>
                      </span>
                      <span class="rounded-lg bg-surface border border-ink-100 px-2.5 py-2">
                        <span class="block meta text-xs">% faltante</span>
                        <span class="font-semibold tabular-nums">{{ r.percfalta }}%</span>
                      </span>
                    </span>
                  </button>
                </li>
              </ul>
            </template>

            <div v-else class="overflow-x-auto">
              <table class="data-table min-w-[640px]">
                <thead>
                  <tr>
                    <th class="pl-5">{{ labelHeader(tipo) }}</th>
                    <th class="num">Quantidade</th>
                    <th class="num">Valor total</th>
                    <th class="num">Objetivo</th>
                    <th class="num">% alcançado</th>
                    <th class="num">Faltante</th>
                    <th class="num pr-5">% faltante</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in parsed" :key="r.i">
                    <td class="pl-5 font-medium">{{ r.label }}</td>
                    <td class="num">{{ r.quantidade }}</td>
                    <td class="num">{{ formatReal(r.total) }}</td>
                    <td class="num">{{ formatReal(r.meta) }}</td>
                    <td class="num">{{ r.percmeta }}%</td>
                    <td class="num">{{ r.falta }}</td>
                    <td class="num pr-5">{{ r.percfalta }}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </template>
    </div>

    <Sheet :open="showFiltros" title="Filtrar metas" @close="showFiltros = false">
      <div class="space-y-5">
        <PeriodField v-model:ini="draft.dtInicial" v-model:fim="draft.dtFinal" />
        <label class="block">
          <span class="label">Grupo</span>
          <SelectField v-model="draft.grupo" :options="[{ value: '', label: 'Todos os grupos' }, ...grupos.map((g) => ({ value: g.codigo, label: g.descricao }))]" title="Selecionar grupo" />
        </label>
        <label class="block">
          <span class="label">Marca</span>
          <SelectField v-model="draft.marca" :options="[{ value: '', label: 'Todas as marcas' }, ...marcas.map((m) => ({ value: m.codigo, label: m.descricao }))]" title="Selecionar marca" />
        </label>
        <div>
          <span class="label">Faturamento</span>
          <Segmented
            v-model="draft.faturamento"
            :options="[{ value: 'S', label: 'Sim' }, { value: 'N', label: 'Não' }]"
            label="Faturamento"
          />
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
