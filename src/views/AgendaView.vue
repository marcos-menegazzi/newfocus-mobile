<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import LoadingState from '../components/LoadingState.vue'
import FilterButton from '../components/FilterButton.vue'
import FilterChips, { type Chip } from '../components/FilterChips.vue'
import Icon from '../components/Icon.vue'
import SelectField from '../components/SelectField.vue'
import PeriodField from '../components/PeriodField.vue'
import SearchField from '../components/SearchField.vue'
import Segmented from '../components/Segmented.vue'
import Sheet from '../components/Sheet.vue'
import { query } from '../db/connection'
import { mudadata } from '../lib/format'
import { formatPeriodo, hojeISO, primeiroDiaMesISO } from '../lib/periodo'
import {
  checkIn,
  listarAgenda,
  listarMotivos,
  listarVisitas,
  novaRecorrencia,
  novaVisita,
  temTitulos,
  type AgendaItem,
  type Motivo,
} from '../services/agenda'
import { useToast } from '../composables/useToast'
import { useFilters } from '../composables/useFilters'

interface ClienteRow {
  codigo: number
  fantasia: string
}

const DEFAULTS = { dtInicial: primeiroDiaMesISO(), dtFinal: hojeISO(), clifor: null as number | null, clienteNome: '' }
const { filtros, draft, show: showFiltros, abrir: abrirFiltros, aplicar: aplicarFiltros, limpar: limparFiltros } =
  useFilters(DEFAULTS, () => buscar())

const lista = ref<AgendaItem[]>([])
const loading = ref(false)
const searched = ref(false)
const motivos = ref<Motivo[]>([])
const { notify } = useToast()

const chips = computed<Chip[]>(() => {
  const c: Chip[] = [{ key: 'periodo', label: formatPeriodo(filtros.dtInicial, filtros.dtFinal), removable: false }]
  if (filtros.clifor) c.push({ key: 'cliente', label: filtros.clienteNome })
  return c
})
const activeCount = computed(() =>
  (filtros.clifor ? 1 : 0) + (filtros.dtInicial !== DEFAULTS.dtInicial || filtros.dtFinal !== DEFAULTS.dtFinal ? 1 : 0),
)

function removerFiltro(key: string) {
  if (key === 'cliente') {
    filtros.clifor = null
    filtros.clienteNome = ''
    buscar()
  }
}

onMounted(async () => {
  motivos.value = await listarMotivos()
  await buscar()
})

async function buscar() {
  loading.value = true
  try {
    const v = await listarVisitas(filtros.dtInicial, filtros.dtFinal, filtros.clifor ?? undefined)
    const a = await listarAgenda(filtros.clifor ?? undefined)
    lista.value = [...v, ...a].sort(
      (x, y) => x.data_agenda.localeCompare(y.data_agenda) || (x.hora || '').localeCompare(y.hora || ''),
    )
    searched.value = true
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Erro ao carregar', 'error')
  } finally {
    loading.value = false
  }
}

const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' })

function dayLabel(iso: string): string {
  if (iso === hojeISO()) return 'Hoje'
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const w = weekday.format(new Date(y, m - 1, d))
  return `${w.charAt(0).toUpperCase()}${w.slice(1)}, ${mudadata(iso)}`
}

const grupos = computed(() => {
  const out: { data: string; itens: { item: AgendaItem; i: number }[] }[] = []
  lista.value.forEach((item, i) => {
    const key = item.data_agenda.slice(0, 10)
    const last = out[out.length - 1]
    if (last && last.data === key) last.itens.push({ item, i })
    else out.push({ data: key, itens: [{ item, i }] })
  })
  return out
})

function statusLabel(item: AgendaItem): string {
  if (item.origem === 'agenda') return 'Agendado'
  return item.atendido === 'S' ? 'Visitado' : 'Não visitado'
}

function statusCls(item: AgendaItem): string {
  if (item.origem === 'agenda') return 'bg-info-100 text-info-800'
  return item.atendido === 'S' ? 'bg-success-50 text-success-800' : 'bg-ink-100 text-ink-700'
}

const atd = ref(false)
const atdItem = ref<AgendaItem | null>(null)
const atdForm = reactive({ atendido: 'S', codmotivo: '', motivo: '' })
const atdTitulos = ref(false)
const atdSaving = ref(false)

async function abrirAtendimento(item: AgendaItem) {
  atdItem.value = item
  atdForm.atendido = item.atendido === 'N' ? 'N' : 'S'
  atdForm.codmotivo = item.codmotivo || ''
  atdForm.motivo = item.motivo || ''
  atdTitulos.value = false
  atd.value = true
  atdTitulos.value = await temTitulos(item.clifor)
}

async function confirmarAtendimento() {
  if (!atdItem.value) return
  atdSaving.value = true
  try {
    await checkIn(atdItem.value, {
      atendido: atdForm.atendido,
      codmotivo: atdForm.codmotivo,
      motivo: atdForm.motivo,
    })
    atd.value = false
    notify('Atendimento registrado', 'success')
    await buscar()
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Erro ao salvar atendimento', 'error')
  } finally {
    atdSaving.value = false
  }
}

const agenda = ref(false)
const agendaForm = reactive({ clifor: 0, clienteNome: '', data: '', hora: '', dias: 7, dia: 1 })

function abrirAgenda() {
  agendaForm.clifor = 0
  agendaForm.clienteNome = ''
  agendaForm.data = hojeISO()
  agendaForm.hora = ''
  agendaForm.dias = 7
  agendaForm.dia = 1
  agenda.value = true
}

async function salvarAgenda() {
  if (!agendaForm.clifor) return notify('Selecione o cliente')
  try {
    await novaRecorrencia(agendaForm.clifor, agendaForm.data, agendaForm.dia, agendaForm.hora, agendaForm.dias)
    agenda.value = false
    notify('Agenda criada', 'success')
    await buscar()
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Erro ao salvar agenda', 'error')
  }
}

const visita = ref(false)
const nvForm = reactive({ clifor: 0, clienteNome: '', data: '', hora: '' })

function abrirVisita() {
  nvForm.clifor = 0
  nvForm.clienteNome = ''
  nvForm.data = hojeISO()
  nvForm.hora = ''
  visita.value = true
}

async function salvarVisita() {
  if (!nvForm.clifor) return notify('Selecione o cliente')
  try {
    await novaVisita(nvForm.clifor, nvForm.data, nvForm.hora, nvForm.data)
    visita.value = false
    notify('Visita criada', 'success')
    await buscar()
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Erro ao salvar visita', 'error')
  }
}

const picker = ref(false)
const pickerTarget = ref<'filtro' | 'agenda' | 'visita'>('filtro')
const pickerBusca = ref('')
const clientes = ref<ClienteRow[]>([])

async function abrirPicker(target: 'filtro' | 'agenda' | 'visita') {
  pickerTarget.value = target
  pickerBusca.value = ''
  picker.value = true
  await buscarClientes()
}

async function buscarClientes() {
  const term = pickerBusca.value.trim()
  const base = 'SELECT codigo, fantasia FROM clifor'
  if (term) {
    clientes.value = await query<ClienteRow>(
      `${base} WHERE fantasia LIKE ? OR codigo LIKE ? ORDER BY fantasia LIMIT 50`,
      [`%${term}%`, `%${term}%`],
    )
  } else {
    clientes.value = await query<ClienteRow>(`${base} ORDER BY fantasia LIMIT 50`)
  }
}

function escolherCliente(c: ClienteRow) {
  if (pickerTarget.value === 'filtro') {
    draft.clifor = c.codigo
    draft.clienteNome = c.fantasia
  } else if (pickerTarget.value === 'agenda') {
    agendaForm.clifor = c.codigo
    agendaForm.clienteNome = c.fantasia
  } else {
    nvForm.clifor = c.codigo
    nvForm.clienteNome = c.fantasia
  }
  picker.value = false
}

const PERIODOS = [
  { value: 0, label: 'Sem repetição' },
  { value: 7, label: 'Semanal (7 dias)' },
  { value: 15, label: 'Quinzenal (15 dias)' },
  { value: 20, label: 'A cada 20 dias' },
  { value: 21, label: 'A cada 21 dias' },
  { value: 31, label: 'Mensal (31 dias)' },
]
</script>

<template>
  <AppShell title="Agenda de visitas">
    <template #actions>
      <FilterButton :count="activeCount" class="mr-1" @click="abrirFiltros" />
    </template>

    <div class="page">
      <div class="grid grid-cols-2 gap-2">
        <button class="btn btn-primary" @click="abrirVisita">
          <Icon name="plus" :size="18" /> Nova visita
        </button>
        <button class="btn btn-secondary" @click="abrirAgenda">
          <Icon name="calendar" :size="18" /> Nova agenda
        </button>
      </div>
      <FilterChips :items="chips" @remove="removerFiltro" @open="abrirFiltros" />

      <LoadingState v-if="loading && !searched" />
      <div v-else-if="searched && lista.length === 0" class="panel">
        <EmptyState icon="calendar" label="Nenhum compromisso no período" hint="Crie uma visita ou agenda recorrente." />
      </div>
      <div v-else class="space-y-4" :class="{ 'opacity-60': loading }">
        <section v-for="g in grupos" :key="g.data">
          <h2 class="text-sm font-semibold text-ink-700 px-1 mb-2">{{ dayLabel(g.data) }}</h2>
          <ul class="list">
            <li v-for="{ item, i } in g.itens" :key="`${item.origem}-${item.idagenda ?? item.clifor}-${item.data_agenda}-${i}`">
              <button class="list-row flex items-start gap-3" @click="abrirAtendimento(item)">
                <span class="w-12 shrink-0 pt-0.5 text-[15px] font-semibold tabular-nums" :class="item.hora ? 'text-ink-900' : 'text-ink-400'">
                  {{ item.hora || '--:--' }}
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block text-[15px] font-medium truncate">{{ item.fantasia }}</span>
                  <span v-if="item.endereco || item.cidade" class="meta flex items-start gap-1 mt-0.5">
                    <Icon name="pin" :size="14" class="mt-0.5" />
                    <span class="line-clamp-2">{{ [item.endereco, item.cidade].filter(Boolean).join(', ') }}</span>
                  </span>
                </span>
                <span class="inline-flex shrink-0 items-center rounded-full px-2.5 h-6 text-xs font-semibold" :class="statusCls(item)">
                  {{ statusLabel(item) }}
                </span>
              </button>
            </li>
          </ul>
        </section>
      </div>
    </div>

    <Sheet :open="showFiltros" title="Filtrar agenda" @close="showFiltros = false">
      <div class="space-y-5">
        <PeriodField v-model:ini="draft.dtInicial" v-model:fim="draft.dtFinal" />
        <div>
          <span class="label">Cliente</span>
          <div class="flex gap-2">
            <button type="button" class="input text-left flex items-center justify-between gap-2" @click="abrirPicker('filtro')">
              <span class="truncate" :class="draft.clienteNome ? '' : 'text-ink-400'">{{ draft.clienteNome || 'Todos os clientes' }}</span>
              <Icon name="chevron-right" class="text-ink-400" />
            </button>
            <button
              v-if="draft.clifor"
              type="button"
              class="icon-btn h-12 w-12 border border-ink-200 rounded-[10px]"
              aria-label="Remover cliente do filtro"
              @click="draft.clifor = null; draft.clienteNome = ''"
            >
              <Icon name="x" />
            </button>
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

    <Sheet :open="atd" title="Registrar atendimento" :subtitle="atdItem?.fantasia" @close="atd = false">
      <div class="space-y-4">
        <p v-if="atdTitulos" class="flex items-start gap-2 rounded-xl bg-sun-100 text-sun-800 px-3.5 py-3 text-sm">
          <Icon name="alert" class="mt-px" />
          Este cliente tem títulos em aberto.
        </p>
        <div>
          <span class="label">Resultado</span>
          <Segmented
            v-model="atdForm.atendido"
            :options="[{ value: 'S', label: 'Visitado' }, { value: 'N', label: 'Não visitado' }]"
            label="Resultado da visita"
          />
        </div>
        <label class="block">
          <span class="label">Motivo</span>
          <SelectField v-model="atdForm.codmotivo" :options="motivos.map((m) => ({ value: m.codigo, label: m.descricao }))" title="Selecionar motivo" placeholder="Selecione" empty="Nenhum motivo disponível" />
        </label>
        <label class="block">
          <span class="label">Complemento</span>
          <textarea v-model="atdForm.motivo" class="input" rows="3" placeholder="Opcional" />
        </label>
      </div>
      <template #footer>
        <button class="btn btn-primary w-full" :disabled="atdSaving" @click="confirmarAtendimento">
          {{ atdSaving ? 'Salvando…' : 'Registrar atendimento' }}
        </button>
      </template>
    </Sheet>

    <Sheet :open="agenda" title="Nova agenda" subtitle="Visitas recorrentes para um cliente" @close="agenda = false">
      <div class="space-y-4">
        <div>
          <span class="label">Cliente</span>
          <button type="button" class="input text-left flex items-center justify-between gap-2" @click="abrirPicker('agenda')">
            <span class="truncate" :class="agendaForm.clienteNome ? '' : 'text-ink-400'">{{ agendaForm.clienteNome || 'Selecionar cliente' }}</span>
            <Icon name="chevron-right" class="text-ink-400" />
          </button>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="label">Primeira visita</span>
            <input v-model="agendaForm.data" type="date" class="input" />
          </label>
          <label class="block">
            <span class="label">Hora</span>
            <input v-model="agendaForm.hora" type="time" class="input" />
          </label>
        </div>
        <div class="grid grid-cols-[1fr_7rem] gap-3">
          <label class="block">
            <span class="label">Repetir</span>
            <SelectField v-model="agendaForm.dias" :options="PERIODOS" title="Repetir visita" />
          </label>
          <label class="block">
            <span class="label">Nº de visitas</span>
            <input v-model.number="agendaForm.dia" type="number" inputmode="numeric" min="1" class="input" />
          </label>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-primary w-full" @click="salvarAgenda">Criar agenda</button>
      </template>
    </Sheet>

    <Sheet :open="visita" title="Nova visita" @close="visita = false">
      <div class="space-y-4">
        <div>
          <span class="label">Cliente</span>
          <button type="button" class="input text-left flex items-center justify-between gap-2" @click="abrirPicker('visita')">
            <span class="truncate" :class="nvForm.clienteNome ? '' : 'text-ink-400'">{{ nvForm.clienteNome || 'Selecionar cliente' }}</span>
            <Icon name="chevron-right" class="text-ink-400" />
          </button>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="label">Data</span>
            <input v-model="nvForm.data" type="date" class="input" />
          </label>
          <label class="block">
            <span class="label">Hora</span>
            <input v-model="nvForm.hora" type="time" class="input" />
          </label>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-primary w-full" @click="salvarVisita">Criar visita</button>
      </template>
    </Sheet>

    <Sheet :open="picker" title="Selecionar cliente" size="tall" @close="picker = false">
      <div class="sticky top-0 bg-surface pb-3 -mx-1 px-1 z-10">
        <SearchField v-model="pickerBusca" placeholder="Nome ou código" @submit="buscarClientes" />
      </div>
      <EmptyState v-if="clientes.length === 0" icon="users" label="Nenhum cliente encontrado" />
      <ul v-else class="divide-y divide-ink-100 -mx-5">
        <li v-for="c in clientes" :key="c.codigo">
          <button class="list-row px-5" @click="escolherCliente(c)">
            <span class="block text-[15px] font-medium">{{ c.fantasia }}</span>
            <span class="meta tabular-nums">Cód. {{ c.codigo }}</span>
          </button>
        </li>
      </ul>
    </Sheet>
  </AppShell>
</template>
