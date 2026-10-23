<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import ScreenHeader from '../components/ScreenHeader.vue'
import { query } from '../db/connection'
import { formatReal, mudadata } from '../lib/format'
import { useToast } from '../composables/useToast'

const COLUMNS: Record<string, string> = {
  pedido: 'h.pedido',
  fantasia: 'c.fantasia',
}

interface VendaRow {
  pedido: number
  data: string
  quantidade: number
  total: number
  fantasia: string
}

const router = useRouter()
const { notify } = useToast()

const col = ref('pedido')
const search = ref('')
const datainicial = ref(primeiroDiaMes())
const datafinal = ref(hoje())
const faturamento = ref(false)

const vendas = ref<VendaRow[]>([])
const loading = ref(false)
const searched = ref(false)

function dd(d: number): string {
  return String(d).padStart(2, '0')
}

function hoje(): string {
  const d = new Date()
  return `${dd(d.getDate())}/${dd(d.getMonth() + 1)}/${d.getFullYear()}`
}

function primeiroDiaMes(): string {
  const d = new Date()
  return `01/${dd(d.getMonth() + 1)}/${d.getFullYear()}`
}

function toSqlDate(term: string): string {
  const m = term.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : term
}

async function buscar() {
  loading.value = true
  try {
    const params: unknown[] = [toSqlDate(datainicial.value), toSqlDate(datafinal.value)]
    let cond = ''
    const term = search.value.trim()
    if (term) {
      cond += ` AND ${COLUMNS[col.value]} LIKE ?`
      params.push(`%${term}%`)
    }
    if (faturamento.value) {
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
      fat: faturamento.value ? 'S' : 'N',
    },
  })
}
</script>

<template>
  <AppShell>
    <div class="p-6">
      <ScreenHeader title="Histórico de Vendas" :back="false" />

      <div class="flex flex-wrap gap-2 mb-4">
        <select v-model="col" class="input w-32 shrink-0">
          <option value="pedido">Nº Pedido</option>
          <option value="fantasia">Cliente</option>
        </select>
        <input
          v-model="search"
          class="input flex-1 min-w-40"
          type="text"
          :placeholder="col === 'pedido' ? 'Nº pedido...' : 'Cliente...'"
          @keyup.enter="buscar"
        />
        <input v-model="datainicial" class="input w-28" type="text" placeholder="DD/MM/AAAA" @keyup.enter="buscar" />
        <input v-model="datafinal" class="input w-28" type="text" placeholder="DD/MM/AAAA" @keyup.enter="buscar" />
        <label class="flex items-center gap-2 text-sm text-ink-600 shrink-0">
          <input v-model="faturamento" type="checkbox" class="accent-accent-500" />
          Faturamento
        </label>
        <button class="btn-primary shrink-0 px-6" :disabled="loading" @click="buscar">Buscar</button>
      </div>

      <EmptyState v-if="searched && vendas.length === 0" label="Nenhuma venda encontrada" />
      <div v-else class="overflow-x-auto bg-white rounded-card shadow-card">
        <table class="w-full text-left text-sm">
          <thead class="text-ink-400 text-xs uppercase">
            <tr>
              <th class="py-2 px-3">Nº Pedido</th>
              <th class="py-2 px-3">Cliente</th>
              <th class="py-2 px-3">Data</th>
              <th class="py-2 px-3 text-right">Quantidade</th>
              <th class="py-2 px-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-ink-200">
            <tr v-for="v in vendas" :key="v.pedido" class="cursor-pointer hover:bg-ink-200/50" @click="abrirVenda(v)">
              <td class="py-2 px-3 font-medium">{{ v.pedido }}</td>
              <td class="py-2 px-3">{{ v.fantasia }}</td>
              <td class="py-2 px-3">{{ mudadata(v.data) }}</td>
              <td class="py-2 px-3 text-right">{{ v.quantidade }}</td>
              <td class="py-2 px-3 text-right">{{ formatReal(v.total) }}</td>
            </tr>
          </tbody>
          <tfoot class="border-t border-ink-200 font-semibold">
            <tr>
              <td class="py-2 px-3" colspan="3">Total</td>
              <td class="py-2 px-3 text-right">{{ totalQuantidade }}</td>
              <td class="py-2 px-3 text-right">{{ formatReal(totalValor) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </AppShell>
</template>
