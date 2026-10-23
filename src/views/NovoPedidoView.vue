<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import ScreenHeader from '../components/ScreenHeader.vue'
import { query } from '../db/connection'
import { formatReal } from '../lib/format'
import { listarItens } from '../services/pedido/itens'
import { useAuthStore } from '../stores/auth'
import { usePedidoStore } from '../stores/pedido'

const route = useRoute()
const auth = useAuthStore()
const store = usePedidoStore()

const TABS = [
  { key: 'pedido', label: 'Pedido' },
  { key: 'incluir', label: 'Incluir' },
  { key: 'itens', label: 'Itens' },
  { key: 'desconto', label: 'Desconto' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'negociacao', label: 'Negociação' },
]
const tab = ref('pedido')

const empresas = ref<any[]>([])
const vendedores = ref<any[]>([])
const condicoes = ref<any[]>([])
const tabelas = ref<any[]>([])
const cargas = ref<any[]>([])
const comissoes = ref<any[]>([])
const operacoes = ref<any[]>([])

const total = ref(0)
const quantidade = ref(0)
const flexPedido = ref(0)
const saldoFlex = computed(() => Number(auth.usuario?.saldoflex ?? 0))

const cliente = reactive({
  id: 0,
  codigo: 0,
  fantasia: '',
  razao: '',
  cnpj: '',
  limcred: 0,
  credito: 0,
  saldo: 0,
})

const CLIENT_FIELDS: Record<string, string> = {
  fantasia: 'cf.fantasia',
  razao: 'cf.razao',
  codigo: 'cf.codigo',
  cnpj: 'cf.cnpj',
  cidade: 'cf.cidade',
  estado: 'cf.estado',
}
const clienteCampo = ref('fantasia')
const clienteBusca = ref('')
const clientes = ref<any[]>([])

const showCliente = ref(false)
const showOperacao = ref(false)
const showCarga = ref(false)

const cargaLabel = computed(() => {
  const c = cargas.value.find((x) => String(x.codigo) === String(store.cabecalho.carga))
  return c ? c.descricao : (store.cabecalho.cargadesc || 'Selecionar Carga')
})
const operacaoLabel = computed(() => store.cabecalho.operacao || 'Selecionar Operação')

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

async function refreshItens() {
  const n = store.cabecalho.numpedido
  if (!n) {
    total.value = 0
    quantidade.value = 0
    flexPedido.value = 0
    return
  }
  const r = await listarItens(n)
  total.value = r.total
  flexPedido.value = r.flex
  quantidade.value = r.rows.reduce((acc, x) => acc + Number(x.qtd || 0), 0)
}

async function buscarClientes() {
  let sql = 'SELECT *, 0 AS utilizado FROM clifor cf WHERE inativo <> \'S\''
  const params: unknown[] = []
  const term = clienteBusca.value.trim()
  if (term) {
    sql += ` AND ${CLIENT_FIELDS[clienteCampo.value]} LIKE ?`
    params.push(`%${term}%`)
  }
  sql += ' ORDER BY cf.fantasia'
  clientes.value = await query<any>(sql, params)
}

async function abrirCliente() {
  clienteBusca.value = ''
  showCliente.value = true
  await buscarClientes()
}

function aplicarCliente(row: any) {
  cliente.id = row.clifor
  cliente.codigo = row.codigo
  cliente.fantasia = row.fantasia
  cliente.razao = row.razao
  cliente.cnpj = row.cnpj
  cliente.limcred = row.limcred
  cliente.credito = row.credito
  cliente.saldo = row.saldo
  store.cabecalho.clifor = row.codigo
  store.cabecalho.cliente_nome = row.razao
  store.cabecalho.cliente_cpf = row.cnpj
  showCliente.value = false
}

async function carregarCliente() {
  const c = store.cabecalho.clifor
  if (!c) return
  const rows = await query<any>('SELECT * FROM clifor WHERE codigo = ?', [c])
  if (rows[0]) aplicarCliente(rows[0])
}

async function abrirOperacao() {
  const emp = store.cabecalho.empresa
  operacoes.value = []
  showOperacao.value = true
  if (!emp) return
  let sql = 'SELECT * FROM operacao WHERE empresa = ?'
  const params: unknown[] = [emp]
  const c = store.cabecalho.clifor
  if (c) {
    const cc = await query<{ cobranca: string }>(
      'SELECT cobranca FROM cobranca_cliente WHERE cliente = ?',
      [c],
    )
    if (cc.length > 0) {
      sql += ` AND cobranca IN (${cc.map(() => '?').join(',')})`
      params.push(...cc.map((x) => x.cobranca))
    }
  }
  operacoes.value = await query<any>(sql, params)
}

function aplicarOperacao(row: any) {
  store.cabecalho.operacao = row.operacao
  store.cabecalho.cobranca = row.cobranca
  store.cabecalho.estoque = row.estoque
  store.cabecalho.local = row.local
  showOperacao.value = false
}

function abrirCarga() {
  showCarga.value = true
}

function aplicarCarga(row: any) {
  store.cabecalho.carga = row.codigo
  store.cabecalho.cargadesc = row.descricao
  showCarga.value = false
}

onMounted(async () => {
  ;[empresas.value, vendedores.value, condicoes.value, tabelas.value, cargas.value, comissoes.value] =
    await Promise.all([
      query<any>('SELECT * FROM empresas'),
      query<any>('SELECT * FROM vendedores'),
      query<any>("SELECT * FROM condicao WHERE inativo = 'N'"),
      query<any>("SELECT * FROM tpreco WHERE usa_cliente = 'N'"),
      query<any>("SELECT * FROM carga WHERE inativo = 'N'"),
      query<any>('SELECT * FROM comissao'),
    ])

  const p = route.params.numpedido
  const n = Array.isArray(p) ? p[0] : p
  if (n) {
    await store.carregar(String(n))
    await carregarCliente()
  } else {
    await store.novo()
  }
  if (!store.cabecalho.data) store.cabecalho.data = today()
  if (!store.cabecalho.tipo) store.cabecalho.tipo = 'S'
  await refreshItens()
})
</script>

<template>
  <AppShell>
    <div class="p-6 pb-0">
      <ScreenHeader title="Novo Pedido" />

      <section class="bg-white rounded-card shadow-card p-4 mb-4 grid grid-cols-2 gap-3">
        <div>
          <p class="text-ink-400 text-xs">Nº Pedido</p>
          <p class="text-ink-900 font-bold">{{ store.cabecalho.numpedido || 'Novo' }}</p>
        </div>
        <div>
          <p class="text-ink-400 text-xs">Total</p>
          <p class="text-ink-900 font-bold">{{ formatReal(total) }}</p>
        </div>
        <div>
          <p class="text-ink-400 text-xs">Quantidade</p>
          <p class="text-ink-900 font-bold">{{ quantidade }}</p>
        </div>
        <div>
          <p class="text-ink-400 text-xs">Saldo Flex</p>
          <p class="text-ink-900 font-bold">{{ formatReal(saldoFlex) }}</p>
        </div>
        <div class="col-span-2">
          <p class="text-ink-400 text-xs">Flex do Pedido</p>
          <p class="text-ink-900 font-bold">{{ formatReal(flexPedido) }}</p>
        </div>
      </section>

      <div class="flex gap-2 mb-4 overflow-x-auto -mx-6 px-6">
        <button
          v-for="t in TABS"
          :key="t.key"
          class="shrink-0 rounded-full px-4 py-2 text-sm font-semibold"
          :class="tab === t.key ? 'bg-accent-500 text-navy-950' : 'bg-navy-800 text-ink-200'"
          @click="tab = t.key"
        >{{ t.label }}</button>
      </div>

      <div v-if="tab === 'pedido'" class="space-y-4">
        <section class="bg-white rounded-card shadow-card p-5">
          <h2 class="text-sm font-bold text-ink-900 mb-3">Pedido</h2>
          <div class="grid grid-cols-1 gap-3">
            <label class="block">
              <span class="text-ink-600 text-xs font-medium">Tipo</span>
              <select v-model="store.cabecalho.tipo" class="input">
                <option value="S">Saída</option>
                <option value="E">Entrada</option>
                <option value="O">Orçamento</option>
              </select>
            </label>
            <div class="grid grid-cols-2 gap-3">
              <label class="block">
                <span class="text-ink-600 text-xs font-medium">Nº Pedido</span>
                <input v-model="store.cabecalho.numpedido" type="text" class="input" disabled />
              </label>
              <label class="block">
                <span class="text-ink-600 text-xs font-medium">Nº Nota</span>
                <input v-model="store.cabecalho.numero" type="text" class="input" />
              </label>
            </div>
            <label class="block">
              <span class="text-ink-600 text-xs font-medium">Data</span>
              <input v-model="store.cabecalho.data" type="date" class="input" />
            </label>
            <label class="block">
              <span class="text-ink-600 text-xs font-medium">Empresa</span>
              <select v-model="store.cabecalho.empresa" class="input">
                <option value="" disabled>Selecione a Empresa</option>
                <option v-for="e in empresas" :key="e.empresa" :value="e.empresa">{{ e.fantasia }}</option>
              </select>
            </label>
            <label class="block">
              <span class="text-ink-600 text-xs font-medium">Vendedor</span>
              <select v-model="store.cabecalho.vendedor" class="input">
                <option value="" disabled>Selecione o Vendedor</option>
                <option v-for="v in vendedores" :key="v.codigo" :value="v.codigo">{{ v.nome }}</option>
              </select>
            </label>

            <label class="block">
              <span class="text-ink-600 text-xs font-medium">Cliente</span>
              <button type="button" class="input text-left" @click="abrirCliente">
                {{ cliente.fantasia || cliente.razao || 'Selecionar Cliente' }}
              </button>
            </label>
            <div class="grid grid-cols-2 gap-3 text-xs">
              <div><span class="text-ink-400">Código:</span> {{ cliente.codigo || '—' }}</div>
              <div><span class="text-ink-400">CNPJ/CPF:</span> {{ cliente.cnpj || '—' }}</div>
              <div><span class="text-ink-400">Limite:</span> {{ formatReal(cliente.limcred) }}</div>
              <div><span class="text-ink-400">Crédito:</span> {{ formatReal(cliente.credito) }}</div>
              <div><span class="text-ink-400">Saldo:</span> {{ formatReal(cliente.saldo) }}</div>
            </div>

            <label class="block">
              <span class="text-ink-600 text-xs font-medium">Operação</span>
              <button type="button" class="input text-left" @click="abrirOperacao">
                {{ operacaoLabel }}
              </button>
            </label>
            <div class="grid grid-cols-2 gap-3 text-xs">
              <div><span class="text-ink-400">Cobrança:</span> {{ store.cabecalho.cobranca || '—' }}</div>
              <div><span class="text-ink-400">Local:</span> {{ store.cabecalho.local ?? '—' }}</div>
            </div>

            <label class="block">
              <span class="text-ink-600 text-xs font-medium">Condição de Pagamento</span>
              <select v-model="store.cabecalho.condpag" class="input">
                <option value="" disabled>Selecione a Condição</option>
                <option v-for="c in condicoes" :key="c.codigo" :value="c.codigo">{{ c.descr }}</option>
              </select>
            </label>
            <label class="block">
              <span class="text-ink-600 text-xs font-medium">Tabela de Preço</span>
              <select v-model="store.cabecalho.tabela" class="input">
                <option value="" disabled>Selecione a Tabela</option>
                <option v-for="t in tabelas" :key="t.codigo" :value="t.codigo">{{ t.descricao }}</option>
              </select>
            </label>
            <label class="block">
              <span class="text-ink-600 text-xs font-medium">Carga</span>
              <button type="button" class="input text-left" @click="abrirCarga">
                {{ cargaLabel }}
              </button>
            </label>
            <label class="block">
              <span class="text-ink-600 text-xs font-medium">Comissão</span>
              <select v-model="store.cabecalho.comissao" class="input">
                <option value="" disabled>Selecione a Comissão</option>
                <option v-for="c in comissoes" :key="c.codigo" :value="c.codigo">{{ c.descricao }}</option>
              </select>
            </label>
            <label class="block">
              <span class="text-ink-600 text-xs font-medium">Observação</span>
              <textarea v-model="store.cabecalho.obsped" rows="3" class="input" />
            </label>
            <label class="block">
              <span class="text-ink-600 text-xs font-medium">Complemento</span>
              <textarea v-model="store.cabecalho.complemento" rows="3" class="input" />
            </label>
          </div>
        </section>
      </div>

      <EmptyState v-else :label="`${TABS.find((t) => t.key === tab)?.label ?? ''} — em breve`" />
    </div>

    <div class="sticky bottom-0 z-10 mt-4 bg-white border-t border-ink-200 px-6 py-4 safe-bottom">
      <div class="grid grid-cols-4 gap-2">
        <button class="rounded-xl bg-navy-800 text-white font-semibold py-3 px-2 text-sm">Cancelar</button>
        <button class="btn-primary text-sm">Finalizar</button>
        <button class="rounded-xl bg-navy-800 text-white font-semibold py-3 px-2 text-sm">NF-e</button>
        <button class="rounded-xl bg-navy-800 text-white font-semibold py-3 px-2 text-sm">Boleto</button>
      </div>
    </div>

    <div
      v-if="showCliente"
      class="fixed inset-0 z-40 flex items-end justify-center bg-black/50"
      @click.self="showCliente = false"
    >
      <div class="w-full max-h-[90vh] overflow-auto rounded-t-2xl bg-white p-5">
        <h2 class="text-lg font-bold text-ink-900 mb-3">Cliente</h2>
        <div class="flex gap-2 mb-3">
          <select v-model="clienteCampo" class="input w-28 shrink-0">
            <option value="fantasia">Fantasia</option>
            <option value="razao">Razão</option>
            <option value="codigo">Código</option>
            <option value="cnpj">CNPJ</option>
            <option value="cidade">Cidade</option>
            <option value="estado">Estado</option>
          </select>
          <input
            v-model="clienteBusca"
            class="input flex-1"
            type="text"
            placeholder="Buscar..."
            @keyup.enter="buscarClientes"
          />
          <button class="btn-primary shrink-0 px-4" @click="buscarClientes">Buscar</button>
        </div>

        <EmptyState v-if="clientes.length === 0" label="Nenhum cliente encontrado" />
        <ul v-else class="divide-y divide-ink-200">
          <li v-for="c in clientes" :key="c.clifor">
            <button class="w-full text-left px-4 py-3 hover:bg-ink-200" @click="aplicarCliente(c)">
              <p class="text-sm font-medium text-ink-900">{{ c.fantasia }}</p>
              <p class="text-xs text-ink-400">{{ c.cidade }} / {{ c.estado }} · {{ c.cnpj }}</p>
            </button>
          </li>
        </ul>
        <button class="w-full mt-3 py-2 text-sm font-semibold text-ink-600" @click="showCliente = false">Fechar</button>
      </div>
    </div>

    <div
      v-if="showOperacao"
      class="fixed inset-0 z-40 flex items-end justify-center bg-black/50"
      @click.self="showOperacao = false"
    >
      <div class="w-full max-h-[90vh] overflow-auto rounded-t-2xl bg-white p-5">
        <h2 class="text-lg font-bold text-ink-900 mb-3">Operação</h2>
        <EmptyState v-if="operacoes.length === 0" label="Nenhuma operação para a empresa selecionada" />
        <ul v-else class="divide-y divide-ink-200">
          <li v-for="o in operacoes" :key="o.operacao">
            <button class="w-full text-left px-4 py-3 hover:bg-ink-200" @click="aplicarOperacao(o)">
              <p class="text-sm font-medium text-ink-900">{{ o.operacao }}</p>
              <p class="text-xs text-ink-400">Cobrança {{ o.cobranca }} · Local {{ o.local }}</p>
            </button>
          </li>
        </ul>
        <button class="w-full mt-3 py-2 text-sm font-semibold text-ink-600" @click="showOperacao = false">Fechar</button>
      </div>
    </div>

    <div
      v-if="showCarga"
      class="fixed inset-0 z-40 flex items-end justify-center bg-black/50"
      @click.self="showCarga = false"
    >
      <div class="w-full max-h-[90vh] overflow-auto rounded-t-2xl bg-white p-5">
        <h2 class="text-lg font-bold text-ink-900 mb-3">Carga</h2>
        <EmptyState v-if="cargas.length === 0" label="Nenhuma carga disponível" />
        <ul v-else class="divide-y divide-ink-200">
          <li v-for="c in cargas" :key="c.codigo">
            <button class="w-full text-left px-4 py-3 hover:bg-ink-200" @click="aplicarCarga(c)">
              <p class="text-sm font-medium text-ink-900">{{ c.descricao }}</p>
            </button>
          </li>
        </ul>
        <button class="w-full mt-3 py-2 text-sm font-semibold text-ink-600" @click="showCarga = false">Fechar</button>
      </div>
    </div>
  </AppShell>
</template>
