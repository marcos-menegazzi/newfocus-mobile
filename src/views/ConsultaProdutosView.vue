<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import ScreenHeader from '../components/ScreenHeader.vue'
import { query } from '../db/connection'
import { formatReal } from '../lib/format'
import { useAuthStore } from '../stores/auth'
import { useToast } from '../composables/useToast'

const COLUMNS: Record<string, string> = {
  descred: 'descred',
  descricao: 'descricao',
  codigo: 'codigo',
}

const LIMITS = [10, 20, 30, 40, 50, 100]

interface ProdutoRow {
  codigo: string
  estoque: number | null
  descvis: string
  comprado: number
  positivado: number
}

interface EmpresaRow {
  empresa: number
  fantasia: string
}

const auth = useAuthStore()
const { notify } = useToast()

const col = ref('descred')
const positivado = ref('todos')
const empresa = ref('')
const search = ref('')
const limit = ref(10)
const page = ref(0)

const empresas = ref<EmpresaRow[]>([])
const produtos = ref<ProdutoRow[]>([])
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
    const params: unknown[] = [start, end]

    const estoque = auth.usuario?.estoque === 'S' ? ' AND e.estoque > 0' : ''
    const centralizado = empresa.value ? '' : " AND centralizado <> 'S'"

    let filterEmpresa = ''
    if (empresa.value) {
      filterEmpresa = ' AND e.empresa = ?'
      params.push(empresa.value)
    }

    let searchClause = ''
    const term = search.value.trim()
    if (term) {
      searchClause = ` AND p.${COLUMNS[col.value]} LIKE ?`
      params.push(`%${term}%`)
    }

    const select = `SELECT p.codigo, sum(e.estoque) AS estoque, p.${COLUMNS[col.value]} AS descvis, p.comprado, (SELECT COUNT(*) FROM HISTVENDA H INNER JOIN HISTITENS I ON H.LANCTO = I.LANCTO INNER JOIN PRODUTOS G ON G.CODIGO = I.PRODUTO WHERE H.DATA BETWEEN ? AND ? AND I.FATURAMENTO = 'S' AND I.PRODUTO = p.codigo) AS positivado FROM (SELECT * FROM produtos x GROUP BY x.codigo) p LEFT JOIN estoque e ON p.codigo = e.codigo${estoque}${centralizado} WHERE 1=1${filterEmpresa}${searchClause} GROUP BY p.codigo`

    let sql: string
    if (positivado.value === 'positivados') {
      sql = `SELECT * FROM (${select}) q WHERE q.positivado > 0 ORDER BY q.descvis LIMIT ? OFFSET ?`
    } else if (positivado.value === 'nao') {
      sql = `SELECT * FROM (${select}) q WHERE q.positivado = 0 ORDER BY q.descvis LIMIT ? OFFSET ?`
    } else {
      sql = `${select} ORDER BY descvis LIMIT ? OFFSET ?`
    }

    params.push(limit.value, page.value * limit.value)
    produtos.value = await query<ProdutoRow>(sql, params)
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

watch([col, positivado, empresa, limit], resetAndBuscar)

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
  <AppShell>
    <div class="p-6">
      <ScreenHeader title="Produtos" :back="false" />

      <div class="grid grid-cols-2 gap-3 mb-3">
        <select v-model="col" class="input">
          <option value="descred">Descr. Reduzida</option>
          <option value="descricao">Descrição</option>
          <option value="codigo">Código</option>
        </select>
        <select v-model="positivado" class="input">
          <option value="todos">Todos</option>
          <option value="positivados">Positivados</option>
          <option value="nao">Não positivados</option>
        </select>
      </div>

      <div class="grid grid-cols-2 gap-3 mb-3">
        <select v-model="empresa" class="input">
          <option value="">Todas empresas</option>
          <option v-for="e in empresas" :key="e.empresa" :value="String(e.empresa)">{{ e.fantasia }}</option>
        </select>
        <select v-model="limit" class="input">
          <option v-for="l in LIMITS" :key="l" :value="l">{{ l }} por página</option>
        </select>
      </div>

      <div class="flex gap-2 mb-4">
        <input
          v-model="search"
          class="input flex-1"
          type="text"
          placeholder="Buscar..."
          @keyup.enter="resetAndBuscar"
        />
        <button class="btn-primary shrink-0 px-6" :disabled="loading" @click="resetAndBuscar">Buscar</button>
      </div>

      <EmptyState v-if="searched && produtos.length === 0" label="Nenhum produto encontrado" />
      <ul v-else class="divide-y divide-ink-200 bg-white rounded-card shadow-card overflow-hidden">
        <li v-for="p in produtos" :key="p.codigo" class="px-4 py-3">
          <div class="flex items-start justify-between gap-3">
            <RouterLink :to="`/produtos/${p.codigo}`" class="min-w-0">
              <p class="text-sm font-medium text-ink-900 truncate">{{ p.descvis }}</p>
              <p class="text-xs text-ink-400 truncate">Cód. {{ p.codigo }}</p>
              <p class="text-xs text-ink-400 truncate">Estoque: {{ p.estoque ?? 0 }}</p>
              <p class="text-xs text-ink-400 truncate">{{ formatReal(p.comprado) }}</p>
            </RouterLink>
            <span
              class="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
              :class="p.positivado > 0 ? 'bg-[#22C55E] text-white' : 'bg-ink-200 text-ink-600'"
            >{{ p.positivado > 0 ? 'Positivado' : 'Não' }}</span>
          </div>
        </li>
      </ul>

      <div class="flex items-center justify-between gap-3 mt-4">
        <button class="btn-primary" :disabled="loading || page === 0" @click="prev">Anterior</button>
        <span class="text-sm text-ink-400">Página {{ page + 1 }}</span>
        <button class="btn-primary" :disabled="loading || produtos.length < limit" @click="next">Próxima</button>
      </div>
    </div>
  </AppShell>
</template>
