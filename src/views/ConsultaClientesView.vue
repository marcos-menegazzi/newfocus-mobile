<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import ScreenHeader from '../components/ScreenHeader.vue'
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

const BASE = `SELECT c.*, (SELECT COUNT(*) FROM HISTVENDA H INNER JOIN HISTITENS I ON H.LANCTO = I.LANCTO WHERE H.DATA BETWEEN ? AND ? AND I.FATURAMENTO = 'S' AND H.CLIFOR = c.CODIGO) AS positivado FROM clifor c`

interface ClienteRow {
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

const col = ref('fantasia')
const positivado = ref('todos')
const search = ref('')
const clientes = ref<ClienteRow[]>([])
const loading = ref(false)
const searched = ref(false)

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
      sql += ` WHERE ${COLUMNS[col.value]} LIKE ?`
      params.push(`%${term}%`)
    }
    if (positivado.value === 'positivados') {
      sql = `SELECT * FROM (${sql}) q WHERE q.positivado > 0`
    } else if (positivado.value === 'nao') {
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
  const doc = await call(`P_EXTWEB:EXEC("${c.codigo}","${u.codlic}")`)
  if (text(doc, 'status') !== 'Ok') {
    notify('Não foi possível gerar o extrato.', 'error')
    return
  }
  const arquivo = text(doc, 'arquivo')
  await openPdf(pdfUrl(`relatorio/li${u.codlic}/${arquivo}`))
}

const garantias = ref(false)
const gClient = ref<ClienteRow | null>(null)
const g = reactive({ dtInicial: '', dtFinal: '', disposicao: '', resolvido: '' })
const gRows = ref<GarantiaRow[]>([])

function abrirGarantias(c: ClienteRow) {
  gClient.value = c
  Object.assign(g, { dtInicial: '', dtFinal: '', disposicao: '', resolvido: '' })
  gRows.value = []
  garantias.value = true
}

async function buscarGarantias() {
  if (!gClient.value) return
  const c = gClient.value
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
}
</script>

<template>
  <AppShell>
    <div class="p-6">
      <div class="flex items-center justify-between gap-3">
        <ScreenHeader title="Clientes" :back="false" />
        <RouterLink
          :to="{ name: 'cliente-novo' }"
          class="rounded-xl bg-accent-500 text-navy-950 font-semibold px-3 py-1.5 text-sm"
        >Novo Cliente</RouterLink>
      </div>

      <div class="grid grid-cols-2 gap-3 mb-3">
        <select v-model="col" class="input">
          <option value="fantasia">Fantasia</option>
          <option value="razao">Razão</option>
          <option value="codigo">Código</option>
          <option value="cnpj">CNPJ</option>
          <option value="cidade">Cidade</option>
          <option value="estado">Estado</option>
        </select>
        <select v-model="positivado" class="input">
          <option value="todos">Todos</option>
          <option value="positivados">Positivados</option>
          <option value="nao">Não positivados</option>
        </select>
      </div>
      <div class="flex gap-2 mb-4">
        <input
          v-model="search"
          class="input flex-1"
          type="text"
          placeholder="Buscar..."
          @keyup.enter="buscar"
        />
        <button class="btn-primary shrink-0 px-6" :disabled="loading" @click="buscar">Buscar</button>
      </div>

      <EmptyState v-if="searched && clientes.length === 0" label="Nenhum cliente encontrado" />
      <ul v-else class="divide-y divide-ink-200 bg-white rounded-card shadow-card overflow-hidden">
        <li v-for="c in clientes" :key="c.codigo" class="px-4 py-3">
          <div class="flex items-start justify-between gap-3">
            <RouterLink :to="`/clientes/${c.codigo}`" class="min-w-0">
              <p class="text-sm font-medium text-ink-900 truncate">{{ c.fantasia }}</p>
              <p class="text-xs text-ink-400 truncate">{{ c.tel1 }}</p>
              <p class="text-xs text-ink-400 truncate">{{ c.cidade }} / {{ c.estado }}</p>
            </RouterLink>
            <span
              class="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
              :class="c.positivado > 0 ? 'bg-[#22C55E] text-white' : 'bg-ink-200 text-ink-600'"
            >{{ c.positivado > 0 ? 'Positivado' : 'Não' }}</span>
          </div>
          <div class="flex gap-2 mt-2">
            <RouterLink :to="`/titulos/${c.codigo}`" class="text-xs font-semibold text-accent-600">Títulos</RouterLink>
            <button class="text-xs font-semibold text-accent-600" @click="extrato(c)">Extrato</button>
            <button class="text-xs font-semibold text-accent-600" @click="abrirGarantias(c)">Garantias</button>
          </div>
        </li>
      </ul>
    </div>

    <div
      v-if="garantias"
      class="fixed inset-0 z-40 flex items-end justify-center bg-black/50"
      @click.self="garantias = false"
    >
      <div class="w-full max-h-[90vh] overflow-auto rounded-t-2xl bg-white p-5">
        <h2 class="text-lg font-bold text-ink-900 mb-3">Garantias — {{ gClient?.fantasia }}</h2>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <label class="block">
            <span class="text-ink-600 text-xs font-medium">Data inicial</span>
            <input v-model="g.dtInicial" type="date" class="input" />
          </label>
          <label class="block">
            <span class="text-ink-600 text-xs font-medium">Data final</span>
            <input v-model="g.dtFinal" type="date" class="input" />
          </label>
          <label class="block">
            <span class="text-ink-600 text-xs font-medium">Disposição</span>
            <input v-model="g.disposicao" type="text" class="input" />
          </label>
          <label class="block">
            <span class="text-ink-600 text-xs font-medium">Resolvido</span>
            <input v-model="g.resolvido" type="text" class="input" />
          </label>
        </div>
        <button class="btn-primary w-full mb-4" @click="buscarGarantias">Buscar</button>

        <EmptyState v-if="gRows.length === 0" label="Nenhuma garantia" />
        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="text-ink-400 text-xs uppercase">
              <tr>
                <th class="py-2 pr-3">Código</th>
                <th class="py-2 pr-3">Produto</th>
                <th class="py-2 pr-3">Nota</th>
                <th class="py-2 pr-3">Disposição</th>
                <th class="py-2 pr-3">Def. entrada</th>
                <th class="py-2 pr-3">Def. saída</th>
                <th class="py-2">Obs</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-ink-200">
              <tr v-for="(r, i) in gRows" :key="i" class="align-top">
                <td class="py-2 pr-3">{{ r.codigo }}</td>
                <td class="py-2 pr-3">{{ r.produto }}</td>
                <td class="py-2 pr-3">{{ r.nota }}</td>
                <td class="py-2 pr-3">{{ r.disposicao }}</td>
                <td class="py-2 pr-3">{{ r.defeito_in }}</td>
                <td class="py-2 pr-3">{{ r.defeito_ex }}</td>
                <td class="py-2">{{ r.obs }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <button class="w-full mt-4 py-2 text-sm font-semibold text-ink-600" @click="garantias = false">Fechar</button>
      </div>
    </div>
  </AppShell>
</template>
