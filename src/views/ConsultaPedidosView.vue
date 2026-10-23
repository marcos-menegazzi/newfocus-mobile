<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import ScreenHeader from '../components/ScreenHeader.vue'
import StatusChip from '../components/StatusChip.vue'
import { query } from '../db/connection'
import { formatReal, mudadata } from '../lib/format'
import { emitirNfe, emitirBoleto, reenviarPedido } from '../services/sync/fiscal'
import { openPdf, pasta } from '../services/files'
import { useAuthStore } from '../stores/auth'
import { useToast } from '../composables/useToast'

const COLUMNS: Record<string, string> = {
  numpedido: 'p.numpedido',
  fantasia: 'c.fantasia',
}

const BASE = 'SELECT p.*, c.fantasia FROM ped p LEFT JOIN clifor c ON c.codigo = p.clifor'

interface PedidoRow {
  numpedido: string
  data: string
  total: number
  fantasia: string
  status: string
  sefaz: string
  file: string
  lancto: number
}

const auth = useAuthStore()
const router = useRouter()
const { notify } = useToast()

const col = ref('numpedido')
const search = ref('')
const pedidos = ref<PedidoRow[]>([])
const loading = ref(false)
const searched = ref(false)

function dataFilter(term: string): string {
  const m = term.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : term
}

async function buscar() {
  loading.value = true
  try {
    let sql = BASE
    const params: unknown[] = []
    const term = search.value.trim()
    if (term) {
      if (col.value === 'data') {
        sql += ' WHERE p.data LIKE ?'
        params.push(`%${dataFilter(term)}%`)
      } else {
        sql += ` WHERE ${COLUMNS[col.value]} LIKE ?`
        params.push(`%${term}%`)
      }
    }
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

async function abrirPedido(p: PedidoRow) {
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
    buscar()
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Não foi possível reenviar o pedido', 'error')
  }
}
</script>

<template>
  <AppShell>
    <div class="p-6">
      <ScreenHeader title="Pedidos" :back="false" />

      <div class="flex gap-2 mb-4">
        <select v-model="col" class="input w-32 shrink-0">
          <option value="numpedido">Nº Pedido</option>
          <option value="data">Data</option>
          <option value="fantasia">Cliente</option>
        </select>
        <input
          v-model="search"
          class="input flex-1"
          type="text"
          :placeholder="col === 'data' ? 'DD/MM/AAAA' : 'Buscar...'"
          @keyup.enter="buscar"
        />
        <button class="btn-primary shrink-0 px-6" :disabled="loading" @click="buscar">Buscar</button>
      </div>

      <EmptyState v-if="searched && pedidos.length === 0" label="Nenhum pedido encontrado" />
      <ul v-else class="divide-y divide-ink-200 bg-white rounded-card shadow-card overflow-hidden">
        <li v-for="p in pedidos" :key="p.numpedido" class="px-4 py-3 cursor-pointer hover:bg-ink-200/50" @click="abrirPedido(p)">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-ink-900 truncate">Nº {{ p.numpedido }}</p>
              <p class="text-xs text-ink-400 truncate">{{ mudadata(p.data) }} · {{ p.fantasia }}</p>
              <p class="text-xs text-ink-400 truncate">{{ formatReal(p.total) }}</p>
            </div>
            <StatusChip :status="p.status" />
          </div>
          <div class="flex gap-2 mt-2">
            <button class="text-xs font-semibold text-accent-600" @click.stop="nfe(p)">NF-e</button>
            <button class="text-xs font-semibold text-accent-600" @click.stop="boleto(p)">Boleto</button>
            <button v-if="p.status === 'V'" class="text-xs font-semibold text-accent-600" @click.stop="reenviar(p)">Reenviar</button>
          </div>
        </li>
      </ul>
    </div>
  </AppShell>
</template>
