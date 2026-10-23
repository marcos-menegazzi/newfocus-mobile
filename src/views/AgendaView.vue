<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import ScreenHeader from '../components/ScreenHeader.vue'
import { query } from '../db/connection'
import { mudadata } from '../lib/format'
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

interface ClienteRow {
  codigo: number
  fantasia: string
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10)
}
function primeiroDiaMes(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const dtInicial = ref(primeiroDiaMes())
const dtFinal = ref(hoje())
const clifor = ref<number | null>(null)
const clienteNome = ref('')

const lista = ref<AgendaItem[]>([])
const loading = ref(false)
const searched = ref(false)
const motivos = ref<Motivo[]>([])
const { notify } = useToast()

onMounted(async () => {
  motivos.value = await listarMotivos()
  await buscar()
})

async function buscar() {
  loading.value = true
  const v = await listarVisitas(dtInicial.value, dtFinal.value, clifor.value ?? undefined)
  const a = await listarAgenda(clifor.value ?? undefined)
  lista.value = [...v, ...a].sort(
    (x, y) => x.data_agenda.localeCompare(y.data_agenda) || (x.hora || '').localeCompare(y.hora || ''),
  )
  searched.value = true
  loading.value = false
}

function limparFiltro() {
  clifor.value = null
  clienteNome.value = ''
}

function statusLabel(item: AgendaItem): string {
  if (item.origem === 'agenda') return 'Agendado'
  return item.atendido === 'S' ? 'Visitado' : 'Não visitado'
}

function statusCls(item: AgendaItem): string {
  if (item.origem === 'agenda') return 'bg-[#58ACFA] text-white'
  return item.atendido === 'S' ? 'bg-[#22C55E] text-white' : 'bg-ink-200 text-ink-600'
}

const atd = ref(false)
const atdItem = ref<AgendaItem | null>(null)
const atdForm = reactive({ atendido: 'S', codmotivo: '', motivo: '' })

async function abrirAtendimento(item: AgendaItem) {
  atdItem.value = item
  atdForm.atendido = item.atendido === 'N' ? 'N' : 'S'
  atdForm.codmotivo = item.codmotivo || ''
  atdForm.motivo = item.motivo || ''
  atd.value = true
  if (await temTitulos(item.clifor)) {
    notify('Cliente possui títulos em aberto.')
  }
}

async function confirmarAtendimento() {
  if (!atdItem.value) return
  try {
    await checkIn(atdItem.value, {
      atendido: atdForm.atendido,
      codmotivo: atdForm.codmotivo,
      motivo: atdForm.motivo,
    })
    atd.value = false
    await buscar()
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Erro ao salvar atendimento', 'error')
  }
}

const agenda = ref(false)
const agendaForm = reactive({ clifor: 0, clienteNome: '', data: '', hora: '', dias: 7, dia: 1 })

function abrirAgenda() {
  agendaForm.clifor = 0
  agendaForm.clienteNome = ''
  agendaForm.data = hoje()
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
  nvForm.data = hoje()
  nvForm.hora = ''
  visita.value = true
}

async function salvarVisita() {
  if (!nvForm.clifor) return notify('Selecione o cliente')
  try {
    await novaVisita(nvForm.clifor, nvForm.data, nvForm.hora, nvForm.data)
    visita.value = false
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
    clifor.value = c.codigo
    clienteNome.value = c.fantasia
  } else if (pickerTarget.value === 'agenda') {
    agendaForm.clifor = c.codigo
    agendaForm.clienteNome = c.fantasia
  } else {
    nvForm.clifor = c.codigo
    nvForm.clienteNome = c.fantasia
  }
  picker.value = false
}
</script>

<template>
  <AppShell>
    <div class="p-6">
      <ScreenHeader title="Agenda" :back="false" />

      <div class="flex flex-wrap gap-2 mb-4">
        <input v-model="dtInicial" type="date" class="input w-36 shrink-0" @keyup.enter="buscar" />
        <input v-model="dtFinal" type="date" class="input w-36 shrink-0" @keyup.enter="buscar" />
        <button class="input text-left w-40 shrink-0" @click="abrirPicker('filtro')">
          {{ clienteNome || 'Todos os clientes' }}
        </button>
        <button v-if="clifor" class="text-sm font-semibold text-ink-600 self-center" @click="limparFiltro">Limpar</button>
        <button class="btn-primary shrink-0 px-6" :disabled="loading" @click="buscar">Pesquisar</button>
      </div>

      <div class="flex gap-2 mb-4">
        <button class="btn-primary flex-1" @click="abrirVisita">Nova Visita</button>
        <button class="btn-primary flex-1" @click="abrirAgenda">Nova Agenda</button>
      </div>

      <EmptyState v-if="searched && lista.length === 0" label="Nenhum compromisso na agenda" />
      <div v-else class="overflow-x-auto bg-white rounded-card shadow-card">
        <table class="w-full text-left text-sm">
          <thead class="text-ink-400 text-xs uppercase">
            <tr>
              <th class="py-2 px-3">Cliente</th>
              <th class="py-2 px-3">Data</th>
              <th class="py-2 px-3">Hora</th>
              <th class="py-2 px-3">Cidade</th>
              <th class="py-2 px-3">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-ink-200">
            <tr v-for="(item, i) in lista" :key="`${item.origem}-${item.idagenda ?? item.clifor}-${item.data_agenda}-${i}`" class="cursor-pointer hover:bg-ink-200/50" @click="abrirAtendimento(item)">
              <td class="py-2 px-3">
                <p class="font-medium">{{ item.fantasia }}</p>
                <p class="text-xs text-ink-400">{{ item.endereco }}</p>
              </td>
              <td class="py-2 px-3">{{ mudadata(item.data_agenda) }}</td>
              <td class="py-2 px-3">{{ item.hora }}</td>
              <td class="py-2 px-3">{{ item.cidade }}</td>
              <td class="py-2 px-3">
                <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="statusCls(item)">{{ statusLabel(item) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="atd" class="fixed inset-0 z-40 flex items-end justify-center bg-black/50" @click.self="atd = false">
      <div class="w-full max-h-[90vh] overflow-auto rounded-t-2xl bg-white p-5">
        <h2 class="text-lg font-bold text-ink-900 mb-1">Atendimento</h2>
        <p class="text-sm text-ink-600 mb-3">{{ atdItem?.fantasia }}</p>

        <div class="flex gap-3 mb-4">
          <label class="flex items-center gap-2 text-sm font-medium">
            <input v-model="atdForm.atendido" type="radio" value="S" class="accent-accent-500" /> Visitado
          </label>
          <label class="flex items-center gap-2 text-sm font-medium">
            <input v-model="atdForm.atendido" type="radio" value="N" class="accent-accent-500" /> Não visitado
          </label>
        </div>

        <label class="block mb-3">
          <span class="text-ink-600 text-xs font-medium">Motivo</span>
          <select v-model="atdForm.codmotivo" class="input">
            <option value="">Selecione...</option>
            <option v-for="m in motivos" :key="m.codigo" :value="m.codigo">{{ m.descricao }}</option>
          </select>
        </label>

        <label class="block mb-4">
          <span class="text-ink-600 text-xs font-medium">Complemento</span>
          <textarea v-model="atdForm.motivo" class="input" rows="2" />
        </label>

        <button class="btn-primary w-full mb-2" @click="confirmarAtendimento">Confirmar</button>
        <button class="w-full py-2 text-sm font-semibold text-ink-600" @click="atd = false">Cancelar</button>
      </div>
    </div>

    <div v-if="agenda" class="fixed inset-0 z-40 flex items-end justify-center bg-black/50" @click.self="agenda = false">
      <div class="w-full max-h-[90vh] overflow-auto rounded-t-2xl bg-white p-5">
        <h2 class="text-lg font-bold text-ink-900 mb-3">Nova Agenda</h2>

        <button class="input text-left mb-3" @click="abrirPicker('agenda')">
          {{ agendaForm.clienteNome || 'Selecionar cliente' }}
        </button>

        <label class="block mb-3">
          <span class="text-ink-600 text-xs font-medium">Data</span>
          <input v-model="agendaForm.data" type="date" class="input" />
        </label>
        <label class="block mb-3">
          <span class="text-ink-600 text-xs font-medium">Hora</span>
          <input v-model="agendaForm.hora" type="time" class="input" />
        </label>
        <div class="grid grid-cols-2 gap-3 mb-4">
          <label class="block">
            <span class="text-ink-600 text-xs font-medium">Período (dias)</span>
            <select v-model.number="agendaForm.dias" class="input">
              <option :value="0">0 — sem período</option>
              <option :value="7">7 — semanal</option>
              <option :value="15">15 — quinzenal</option>
              <option :value="20">20 dias</option>
              <option :value="21">21 dias</option>
              <option :value="31">31 — mensal</option>
            </select>
          </label>
          <label class="block">
            <span class="text-ink-600 text-xs font-medium">Nº de visitas</span>
            <input v-model.number="agendaForm.dia" type="number" min="1" class="input" />
          </label>
        </div>

        <button class="btn-primary w-full mb-2" @click="salvarAgenda">Salvar</button>
        <button class="w-full py-2 text-sm font-semibold text-ink-600" @click="agenda = false">Cancelar</button>
      </div>
    </div>

    <div v-if="visita" class="fixed inset-0 z-40 flex items-end justify-center bg-black/50" @click.self="visita = false">
      <div class="w-full max-h-[90vh] overflow-auto rounded-t-2xl bg-white p-5">
        <h2 class="text-lg font-bold text-ink-900 mb-3">Nova Visita</h2>

        <button class="input text-left mb-3" @click="abrirPicker('visita')">
          {{ nvForm.clienteNome || 'Selecionar cliente' }}
        </button>

        <label class="block mb-3">
          <span class="text-ink-600 text-xs font-medium">Data</span>
          <input v-model="nvForm.data" type="date" class="input" />
        </label>
        <label class="block mb-4">
          <span class="text-ink-600 text-xs font-medium">Hora</span>
          <input v-model="nvForm.hora" type="time" class="input" />
        </label>

        <button class="btn-primary w-full mb-2" @click="salvarVisita">Salvar</button>
        <button class="w-full py-2 text-sm font-semibold text-ink-600" @click="visita = false">Cancelar</button>
      </div>
    </div>

    <div v-if="picker" class="fixed inset-0 z-40 flex items-end justify-center bg-black/50" @click.self="picker = false">
      <div class="w-full max-h-[90vh] overflow-auto rounded-t-2xl bg-white p-5">
        <h2 class="text-lg font-bold text-ink-900 mb-3">Clientes</h2>
        <div class="flex gap-2 mb-4">
          <input
            v-model="pickerBusca"
            class="input flex-1"
            type="text"
            placeholder="Buscar cliente..."
            @keyup.enter="buscarClientes"
          />
          <button class="btn-primary shrink-0 px-4" @click="buscarClientes">Buscar</button>
        </div>

        <EmptyState v-if="clientes.length === 0" label="Nenhum cliente encontrado" />
        <ul v-else class="divide-y divide-ink-200">
          <li v-for="c in clientes" :key="c.codigo" class="px-2 py-3 cursor-pointer hover:bg-ink-200/50" @click="escolherCliente(c)">
            <p class="text-sm font-medium text-ink-900">{{ c.fantasia }}</p>
            <p class="text-xs text-ink-400">{{ c.codigo }}</p>
          </li>
        </ul>

        <button class="w-full mt-3 py-2 text-sm font-semibold text-ink-600" @click="picker = false">Fechar</button>
      </div>
    </div>
  </AppShell>
</template>
