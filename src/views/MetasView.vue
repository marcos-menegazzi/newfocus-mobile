<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import ScreenHeader from '../components/ScreenHeader.vue'
import { formatReal } from '../lib/format'
import { call } from '../services/sync/context'
import { childText, rowChildren } from '../services/sync/helpers'
import { text } from '../services/soap'
import { useAuthStore } from '../stores/auth'

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

const dtInicial = ref(primeiroDiaMes())
const dtFinal = ref(hoje())
const grupo = ref('')
const marca = ref('')
const faturamento = ref('S')

const grupos = ref<Opt[]>([])
const marcas = ref<Opt[]>([])

const tipo = ref('')
const rows = ref<MetaRow[]>([])
const loading = ref(false)
const searched = ref(false)

function dd(n: number): string {
  return String(n).padStart(2, '0')
}

function hoje(): string {
  const d = new Date()
  return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`
}

function primeiroDiaMes(): string {
  const d = new Date()
  return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-01`
}

function toBr(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function labelHeader(t: string): string {
  switch (t) {
    case 'grupo': return 'Grupo'
    case 'marca': return 'Marca'
    case 'produto': return 'Produto'
    case 'grupo_marca': return 'Grupo/Marca'
    default: return 'Vendedor'
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

async function loadSelects() {
  const u = auth.usuario
  if (!u) return
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
}

async function buscar() {
  const u = auth.usuario
  if (!u) return
  loading.value = true
  const doc = await call(
    `P_RMTWEB01:EXEC(${u.codlic}, '${toBr(dtInicial.value)}', '${toBr(dtFinal.value)}', '${grupo.value}', '${marca.value}', '${faturamento.value}')`,
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
  loading.value = false
}

onMounted(async () => {
  await loadSelects()
  await buscar()
})
</script>

<template>
  <AppShell>
    <div class="p-6">
      <ScreenHeader title="Metas (Objetivo)" :back="false" />

      <div class="flex flex-wrap gap-2 mb-4">
        <input v-model="dtInicial" type="date" class="input w-36 shrink-0" />
        <input v-model="dtFinal" type="date" class="input w-36 shrink-0" />
        <select v-model="grupo" class="input w-40 shrink-0">
          <option value="">Todos os grupos</option>
          <option v-for="g in grupos" :key="g.codigo" :value="g.codigo">{{ g.descricao }}</option>
        </select>
        <select v-model="marca" class="input w-40 shrink-0">
          <option value="">Todas as marcas</option>
          <option v-for="m in marcas" :key="m.codigo" :value="m.codigo">{{ m.descricao }}</option>
        </select>
        <select v-model="faturamento" class="input w-24 shrink-0" title="Faturamento">
          <option value="S">S</option>
          <option value="N">N</option>
        </select>
        <button class="btn-primary shrink-0 px-6" :disabled="loading" @click="buscar">Consultar</button>
      </div>

      <div v-if="loading" class="py-12 flex items-center justify-center gap-2 text-ink-400 text-sm">
        <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Carregando...
      </div>

      <EmptyState v-else-if="searched && rows.length === 0" label="Nenhuma meta encontrada" />
      <div v-else-if="searched" class="overflow-x-auto bg-white rounded-card shadow-card">
        <table class="w-full text-left text-sm">
          <thead class="text-ink-400 text-xs uppercase">
            <tr>
              <th class="py-2 px-3">{{ labelHeader(tipo) }}</th>
              <th class="py-2 px-3 text-right">Quantidade</th>
              <th class="py-2 px-3 text-right">Valor Total</th>
              <th class="py-2 px-3 text-right">Objetivo</th>
              <th class="py-2 px-3 text-right">% Alcançado</th>
              <th class="py-2 px-3 text-right">Quant. Faltante</th>
              <th class="py-2 px-3 text-right">% Faltante</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-ink-200">
            <tr v-for="(r, i) in rows" :key="i">
              <td class="py-2 px-3 font-medium">{{ r.label }}</td>
              <td class="py-2 px-3 text-right">{{ r.quantidade }}</td>
              <td class="py-2 px-3 text-right">{{ formatReal(r.total) }}</td>
              <td class="py-2 px-3 text-right">{{ formatReal(r.meta) }}</td>
              <td class="py-2 px-3 text-right">{{ r.percmeta }}%</td>
              <td class="py-2 px-3 text-right">{{ r.falta }}</td>
              <td class="py-2 px-3 text-right">{{ r.percfalta }}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </AppShell>
</template>
