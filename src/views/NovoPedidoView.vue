<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import ScreenHeader from '../components/ScreenHeader.vue'
import StatusChip from '../components/StatusChip.vue'
import { query } from '../db/connection'
import { formatReal } from '../lib/format'
import { getfator, isCondAvista } from '../services/pedido/calc'
import { calcPreco } from '../services/pedido/preco'
import { listarItens, incluirItem, gravarItem, excluirItem } from '../services/pedido/itens'
import { aplicarDesconto, aplicarAcrescimo } from '../services/pedido/desconto'
import { incluirParcela, excluirParcela, listarParcelas, validarFinanceiro } from '../services/pedido/financeiro'
import { finalizar } from '../services/pedido/finalizar'
import { imprimirPedido } from '../services/pedido/imprimir'
import { termo, saldoSucata, saldosFinanceiro, type SaldoSucata, type SaldoFinanceiro } from '../services/pedido/termo'
import { emitirNfe, emitirBoleto } from '../services/sync/fiscal'
import { pushClientes } from '../services/sync/clientes'
import { pushPedidos } from '../services/sync/pedidos'
import { useAuthStore } from '../stores/auth'
import { usePedidoStore } from '../stores/pedido'
import { useToast } from '../composables/useToast'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const store = usePedidoStore()
const { notify } = useToast()

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
const cobrancas = ref<any[]>([])

const itens = ref<any[]>([])
const total = ref(0)
const quantidade = ref(0)
const flexPedido = ref(0)
const saldoFlex = computed(() => Number(auth.usuario?.saldoflex ?? 0))

const NFE: string = 'N'

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

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

const isEdit = computed(() => !!store.cabecalho.numpedido)

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function refreshItens() {
  const n = store.cabecalho.numpedido
  if (!n) {
    itens.value = []
    total.value = 0
    quantidade.value = 0
    flexPedido.value = 0
    return
  }
  const r = await listarItens(n)
  itens.value = r.rows
  total.value = r.total
  flexPedido.value = r.flex
  quantidade.value = r.rows.reduce((acc, x) => acc + Number(x.qtd || 0), 0)
}

async function buscarClientes() {
  let sql = 'SELECT * FROM clifor cf WHERE inativo <> \'S\''
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

function validarCabecalho(): string | null {
  const c = store.cabecalho
  if (!c.data) return 'Informe a Data do Pedido.'
  if (!c.empresa) return 'Selecione uma Empresa.'
  if (!c.clifor) return 'Selecione um Cliente.'
  if (!c.operacao) return 'Selecione uma Operação.'
  if (!c.condpag) return 'Selecione uma Condição de Pagamento.'
  if (!c.tabela) return 'Selecione uma Tabela de Preço.'
  if (!c.carga) return 'Selecione uma Carga.'
  if (!c.comissao) return 'Selecione uma Tabela de Comissão.'
  return null
}

async function ensureNumpedido(): Promise<string | null> {
  if (store.cabecalho.numpedido) return store.cabecalho.numpedido
  const err = validarCabecalho()
  if (err) {
    notify(err)
    return null
  }
  await store.salvar()
  return store.cabecalho.numpedido
}

async function persistTotal() {
  if (store.cabecalho.numpedido && store.pedstatus === 'A') {
    await store.salvar()
  }
}

function assertAberto(): boolean {
  if (store.pedstatus !== 'A') {
    notify('Desconto e Acréscimo só podem ser aplicados em pedido Aberto.')
    return false
  }
  return true
}

// --- Incluir (produtos) ---
const PROD_FIELDS: Record<string, string> = {
  descred: 'descred',
  descricao: 'descricao',
  codigo: 'codigo',
}
const prodCampo = ref('descricao')
const prodBusca = ref('')
const produtos = ref<any[]>([])
const prodSearched = ref(false)
const prodPage = ref(0)
const PROD_LIMIT = 30

async function buscarProdutos(reset = true) {
  if (!store.cabecalho.tabela) {
    notify('Selecione uma Tabela de Preço.')
    return
  }
  if (reset) {
    prodPage.value = 0
    produtos.value = []
  }
  const field = PROD_FIELDS[prodCampo.value]
  let sql = `SELECT x.*, m.venda, m.maximo, m.minimo, t.codigo AS tabela
    FROM (SELECT p.*, e.estoque, p.${field} AS descvis
          FROM produtos p LEFT JOIN estoque e ON p.codigo = e.codigo AND e.empresa = ? AND e.local = ?) x,
         tpreco t, mvtpreco m
    WHERE t.codigo = m.tabela_codigo AND m.produto = x.codigo AND m.tabela_codigo = ?`
  const params: unknown[] = [
    store.cabecalho.empresa ?? '',
    store.cabecalho.local ?? '',
    store.cabecalho.tabela,
  ]
  const term = prodBusca.value.trim()
  if (term) {
    sql += ` AND x.${field} LIKE ?`
    params.push(`%${term}%`)
  }
  sql += ' ORDER BY descvis LIMIT ? OFFSET ?'
  params.push(PROD_LIMIT, prodPage.value * PROD_LIMIT)
  const rows = await query<any>(sql, params)
  rows.forEach((r) => {
    r.qtd = 1
    r.unidade = ''
  })
  produtos.value = reset ? rows : produtos.value.concat(rows)
  prodSearched.value = true
}

async function maisProdutos() {
  prodPage.value += 1
  await buscarProdutos(false)
}

async function quickAdd(p: any) {
  const n = await ensureNumpedido()
  if (!n) return
  try {
    await incluirItem({
      numpedido: n,
      codproduto: p.codigo,
      quantidade: Number(p.qtd) || 0,
      venda: Number(p.venda) || 0,
      maximo: Number(p.maximo) || 0,
      minimo: Number(p.minimo) || 0,
      descinc: 0,
      desconto: 0,
      descper: 'N',
      operacao: store.cabecalho.operacao,
      condicao: store.cabecalho.condpag,
      comissao: store.cabecalho.comissao,
      tabela: p.tabela,
      unidade: p.unidade ?? '',
      fatores: store.fatores,
      tabelas: store.tabelas,
      estoque: Number(p.estoque) || 0,
      cEstoque: store.cabecalho.estoque,
      libmin: auth.usuario?.libmin === 'S',
    })
    await refreshItens()
    await persistTotal()
  } catch (e) {
    notify(msg(e), 'error')
  }
}

// --- Product modal ---
const modal = reactive({
  open: false,
  codproduto: '',
  descricao: '',
  venda: 0,
  maximo: 0,
  minimo: 0,
  tabela: 0,
  estoque: 0,
  quantidade: 1,
  unidade: '',
  descinc: 0,
  desconto: 0,
  descper: 'N',
})

const modalFator = computed(() => getfator(store.fatores, modal.codproduto, modal.unidade))
const modalPreview = computed(() =>
  calcPreco({
    venda: modal.venda,
    maximo: modal.maximo,
    minimo: modal.minimo,
    descinc: modal.descinc,
    quantidade: Number(modal.quantidade) || 0,
    fator: modalFator.value,
    desconto: modal.desconto,
    descper: modal.descper as 'S' | 'N',
    tabela: modal.tabela,
    tabelas: store.tabelas,
  }),
)

function abrirModalProduto(p: any) {
  modal.codproduto = p.codigo
  modal.descricao = p.descvis || p.descricao
  modal.venda = Number(p.venda) || 0
  modal.maximo = Number(p.maximo) || 0
  modal.minimo = Number(p.minimo) || 0
  modal.tabela = Number(p.tabela) || 0
  modal.estoque = Number(p.estoque) || 0
  modal.quantidade = 1
  modal.unidade = ''
  modal.descinc = 0
  modal.desconto = 0
  modal.descper = 'N'
  modal.open = true
}

async function abrirModalItem(row: any) {
  const preco = store.mvtpreco.find(
    (m) => String(m.produto) === String(row.codproduto) && String(m.tabela_codigo) === String(row.tabela),
  )
  modal.codproduto = row.codproduto
  modal.descricao = row.descricao
  modal.venda = Number(preco?.venda) || 0
  modal.maximo = Number(preco?.maximo) || 0
  modal.minimo = Number(preco?.minimo) || 0
  modal.tabela = Number(row.tabela) || 0
  modal.quantidade = Number(row.qtd) || 1
  modal.unidade = row.unidade ?? ''
  modal.descinc = Number(row.descinc) || 0
  modal.desconto = Number(row.descto) || 0
  modal.descper = row.descper ?? 'N'
  modal.estoque = 0
  if (store.cabecalho.estoque === 'S') {
    const est = await query<any>(
      'SELECT estoque FROM estoque WHERE codigo=? AND empresa=? AND local=?',
      [row.codproduto, store.cabecalho.empresa, store.cabecalho.local],
    )
    modal.estoque = Number(est[0]?.estoque) || 0
  }
  modal.open = true
}

async function gravarModal() {
  const n = await ensureNumpedido()
  if (!n) return
  try {
    await gravarItem({
      numpedido: n,
      codproduto: modal.codproduto,
      quantidade: Number(modal.quantidade) || 0,
      venda: modal.venda,
      maximo: modal.maximo,
      minimo: modal.minimo,
      descinc: Number(modal.descinc) || 0,
      desconto: Number(modal.desconto) || 0,
      descper: modal.descper,
      operacao: store.cabecalho.operacao,
      condicao: store.cabecalho.condpag,
      comissao: store.cabecalho.comissao,
      tabela: modal.tabela,
      unidade: modal.unidade,
      fatores: store.fatores,
      tabelas: store.tabelas,
      estoque: modal.estoque,
      cEstoque: store.cabecalho.estoque,
      libmin: auth.usuario?.libmin === 'S',
    })
    modal.open = false
    await refreshItens()
    await persistTotal()
  } catch (e) {
    notify(msg(e), 'error')
  }
}

// --- Itens ---
function descontoLabel(row: any): string {
  const d = Number(row.descto || 0)
  if (d === 0) return '—'
  return row.descper === 'S' ? `${d}%` : formatReal(d)
}

async function removerItem(row: any) {
  if (!confirm('Excluir este item?')) return
  await excluirItem(store.cabecalho.numpedido, row.codproduto, row.tabela)
  await refreshItens()
  await persistTotal()
}

// --- Desconto ---
const descontoModo = ref<'percent' | 'reais'>('percent')
const descontoValor = ref<number | null>(null)

async function aplicarDescontoPedido() {
  if (!assertAberto()) return
  const n = await ensureNumpedido()
  if (!n) return
  try {
    await aplicarDesconto(n, {
      aplicar: true,
      valor: Number(descontoValor.value) || 0,
      porItem: descontoModo.value === 'reais',
    })
    await refreshItens()
    await persistTotal()
  } catch (e) {
    notify(msg(e), 'error')
  }
}

async function removerDesconto() {
  if (!assertAberto()) return
  const n = store.cabecalho.numpedido
  if (!n) return
  try {
    await aplicarDesconto(n, { aplicar: false, valor: 0, porItem: false })
    await refreshItens()
    await persistTotal()
  } catch (e) {
    notify(msg(e), 'error')
  }
}

// --- Financeiro ---
const fin = reactive({ cobranca: '', condicao: '', valor: '', autorizacao: '' })
const parcelas = ref<any[]>([])
const remaining = ref(0)

async function refreshParcelas() {
  const n = store.cabecalho.numpedido
  if (!n) {
    parcelas.value = []
    remaining.value = 0
    return
  }
  const r = await listarParcelas(n)
  parcelas.value = r.rows
  remaining.value = r.remaining
}

async function gravarParcela() {
  const n = await ensureNumpedido()
  if (!n) return
  try {
    await incluirParcela(n, fin.cobranca, fin.condicao, Number(fin.valor) || 0, fin.autorizacao, total.value)
    fin.valor = ''
    fin.autorizacao = ''
    await refreshParcelas()
  } catch (e) {
    notify(msg(e), 'error')
  }
}

async function removerParcela(id: number) {
  await excluirParcela(id)
  await refreshParcelas()
}

// --- Negociação ---
const acrescimo = reactive({ vlquilo: '', vlunidade: '' })
const snquilo = ref(false)
const snunidade = ref(false)

function preloadNegociacao() {
  const c = store.cabecalho
  acrescimo.vlquilo = c.valor_quilo ?? ''
  acrescimo.vlunidade = c.valor_unidade ?? ''
  snquilo.value = c.snquilo === 'S'
  snunidade.value = c.snunidade === 'S'
}

async function aplicarAcrescimoPedido() {
  if (!assertAberto()) return
  const n = await ensureNumpedido()
  if (!n) return
  try {
    await aplicarAcrescimo(n, {
      aplicar: true,
      vlquilo: Number(acrescimo.vlquilo) || 0,
      vlunidade: Number(acrescimo.vlunidade) || 0,
      snquilo: snquilo.value ? 'S' : 'N',
      snunidade: snunidade.value ? 'S' : 'N',
    })
    await refreshItens()
    await persistTotal()
  } catch (e) {
    notify(msg(e), 'error')
  }
}

async function removerAcrescimo() {
  if (!assertAberto()) return
  const n = store.cabecalho.numpedido
  if (!n) return
  try {
    await aplicarAcrescimo(n, { aplicar: false, vlquilo: 0, vlunidade: 0, snquilo: 'N', snunidade: 'N' })
    await refreshItens()
    await persistTotal()
  } catch (e) {
    notify(msg(e), 'error')
  }
}

// --- Footer actions ---
async function cancelarPedido() {
  if (!store.cabecalho.numpedido) {
    notify('Salve o pedido antes de cancelar.')
    return
  }
  try {
    await store.cancelar()
    notify('Pedido cancelado.')
  } catch (e) {
    notify(msg(e), 'error')
  }
}

async function imprimir() {
  const n = store.cabecalho.numpedido
  if (!n) {
    notify('Salve o pedido antes de imprimir.')
    return
  }
  try {
    await imprimirPedido(n)
  } catch (e) {
    notify(msg(e), 'error')
  }
}

async function finalizarPedido() {
  try {
    const n = await ensureNumpedido()
    if (!n) return
    if (store.pedstatus !== 'A') {
      notify('Pedido não está aberto.')
      return
    }

    const mped = await query<any>('SELECT idpedido FROM mped WHERE numpedido = ?', [n])
    if (mped.length === 0) {
      notify('Pedido sem Itens, Impossível Finalizar.')
      return
    }

    const u = auth.usuario
    if (
      u?.limcred === 'S' &&
      store.cabecalho.tipo !== 'E' &&
      Number(cliente.limcred) > 0 &&
      !(u.libera === 'S' && isCondAvista(condicoes.value, store.cabecalho.condpag))
    ) {
      if (Number(cliente.credito) - total.value < 0) {
        notify('Pedido Ultrapassa o Limite de Crédito Disponível')
        return
      }
    }

    const cli = store.cabecalho.clifor
    const [condCliente, cobCliente] = await Promise.all([
      query<{ condicao: string | number }>('SELECT condicao FROM condicao_cliente WHERE cliente = ?', [cli]),
      query<{ cobranca: string }>('SELECT cobranca FROM cobranca_cliente WHERE cliente = ?', [cli]),
    ])
    const finResult = await validarFinanceiro(
      n,
      total.value,
      u?.finped === 'S',
      condCliente.map((r) => r.condicao),
      cobCliente.map((r) => r.cobranca),
    )
    if (!finResult.ok) {
      notify(String(finResult.msg))
      return
    }

    await store.salvar()
    await finalizar(n, {
      cEstoque: store.cabecalho.estoque,
      empresa: store.cabecalho.empresa,
      local: store.cabecalho.local,
      nfe: NFE,
    })
    store.pedstatus = 'F'
    store.cabecalho.status = 'F'
    if (NFE === 'S') {
      await pushClientes()
      await pushPedidos()
    }
    await refreshItens()
    notify('Pedido Finalizado.')
  } catch (e) {
    notify(msg(e), 'error')
  }
}

async function nfe() {
  if (!store.cabecalho.numpedido) {
    notify('Salve o pedido antes de emitir a NF-e.')
    return
  }
  try {
    await store.salvar()
    await emitirNfe(store.cabecalho.numpedido, store.cabecalho.lancto ?? 0)
  } catch (e) {
    notify(msg(e), 'error')
  }
}

async function boleto() {
  try {
    await emitirBoleto(store.cabecalho.lancto ?? 0)
  } catch (e) {
    notify(msg(e), 'error')
  }
}

// --- Termo / saldos ---
const showSucata = ref(false)
const sucataRows = ref<SaldoSucata[]>([])
const showSaldos = ref(false)
const saldosRows = ref<SaldoFinanceiro[]>([])

async function gerarTermo() {
  const lancto = store.cabecalho.lancto
  if (!lancto) {
    notify('Pedido sem lançamento')
    return
  }
  try {
    await termo(lancto)
  } catch (e) {
    notify(msg(e), 'error')
  }
}

async function abrirSucata() {
  const cli = store.cabecalho.clifor
  const codlic = auth.usuario?.codlic
  if (!cli || !codlic) {
    notify('Selecione um Cliente.')
    return
  }
  showSucata.value = true
  sucataRows.value = []
  try {
    sucataRows.value = await saldoSucata(codlic, cli)
  } catch (e) {
    notify(msg(e), 'error')
  }
}

async function abrirSaldos() {
  const cli = store.cabecalho.clifor
  if (!cli) {
    notify('Selecione um Cliente.')
    return
  }
  showSaldos.value = true
  saldosRows.value = []
  try {
    saldosRows.value = await saldosFinanceiro(cli)
  } catch (e) {
    notify(msg(e), 'error')
  }
}

async function reabrir() {
  try {
    await store.reabrir()
    notify('Pedido reaberto.')
  } catch (e) {
    notify(msg(e), 'error')
  }
}

async function transformar() {
  try {
    await store.transformarOrcamento()
    notify('Orçamento transformado em pedido.')
  } catch (e) {
    notify(msg(e), 'error')
  }
}

async function duplicar() {
  try {
    await store.duplicar()
    router.push(`/pedidos/${store.cabecalho.numpedido}`)
  } catch (e) {
    notify(msg(e), 'error')
  }
}

onMounted(async () => {
  ;[empresas.value, vendedores.value, condicoes.value, tabelas.value, cargas.value, comissoes.value, cobrancas.value] =
    await Promise.all([
      query<any>('SELECT * FROM empresas'),
      query<any>('SELECT * FROM vendedores'),
      query<any>("SELECT * FROM condicao WHERE inativo = 'N'"),
      query<any>("SELECT * FROM tpreco WHERE usa_cliente = 'N'"),
      query<any>("SELECT * FROM carga WHERE inativo = 'N'"),
      query<any>('SELECT * FROM comissao'),
      query<any>('SELECT * FROM cobrancas'),
    ])

  await store.carregarPrecos()

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
  preloadNegociacao()
  await refreshItens()
  await refreshParcelas()
})
</script>

<template>
  <AppShell>
    <div class="p-6 pb-0">
      <ScreenHeader title="Novo Pedido" />

      <section class="bg-white rounded-card shadow-card p-4 mb-4 grid grid-cols-2 gap-3">
        <div class="flex items-center justify-between gap-2">
          <div>
            <p class="text-ink-400 text-xs">Nº Pedido</p>
            <p class="text-ink-900 font-bold">{{ store.cabecalho.numpedido || 'Novo' }}</p>
          </div>
          <StatusChip v-if="store.cabecalho.numpedido" :status="store.pedstatus" />
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
            <div class="grid grid-cols-2 gap-2">
              <button type="button" class="rounded-xl bg-navy-800 text-white text-xs font-semibold py-2" @click="abrirSucata">Visualizar Sucata</button>
              <button type="button" class="rounded-xl bg-navy-800 text-white text-xs font-semibold py-2" @click="abrirSaldos">Saldos Cliente</button>
            </div>
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

      <div v-else-if="tab === 'incluir'" class="space-y-4">
        <section class="bg-white rounded-card shadow-card p-5">
          <h2 class="text-sm font-bold text-ink-900 mb-3">Incluir Produto</h2>
          <div class="flex gap-2 mb-3">
            <select v-model="prodCampo" class="input w-32 shrink-0">
              <option value="descricao">Descrição</option>
              <option value="descred">Desc. Reduzida</option>
              <option value="codigo">Código</option>
            </select>
            <input
              v-model="prodBusca"
              class="input flex-1"
              type="text"
              placeholder="Buscar produto..."
              @keyup.enter="buscarProdutos()"
            />
            <button class="btn-primary shrink-0 px-4" @click="buscarProdutos()">Buscar</button>
          </div>

          <EmptyState v-if="prodSearched && produtos.length === 0" label="Nenhum produto encontrado" />
          <div v-else class="grid grid-cols-1 gap-3">
            <div v-for="p in produtos" :key="p.codigo" class="rounded-xl border border-ink-200 p-4">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-ink-900 truncate">{{ p.descvis }}</p>
                  <p class="text-xs text-ink-400">Cód. {{ p.codigo }} · Estoque {{ p.estoque ?? 0 }}</p>
                  <p class="text-xs font-semibold text-accent-600">{{ formatReal(p.venda) }}</p>
                </div>
                <button class="p-1 text-ink-400 shrink-0" aria-label="Editar" @click="abrirModalProduto(p)">
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path stroke-linecap="round" stroke-linejoin="round" d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
              </div>
              <div class="flex items-center gap-2 mt-3">
                <input v-model="p.qtd" type="number" min="0" class="input w-20" placeholder="Qtd" />
                <input v-model="p.unidade" type="text" class="input w-20" placeholder="Un." />
                <button class="btn-primary flex-1 text-sm" @click="quickAdd(p)">Adicionar</button>
              </div>
            </div>
          </div>
          <button
            v-if="produtos.length >= PROD_LIMIT"
            class="w-full mt-3 py-2 text-sm font-semibold text-accent-600"
            @click="maisProdutos"
          >Mais resultados</button>
        </section>
      </div>

      <div v-else-if="tab === 'itens'" class="space-y-4">
        <section class="bg-white rounded-card shadow-card p-5">
          <h2 class="text-sm font-bold text-ink-900 mb-3">Itens</h2>
          <EmptyState v-if="itens.length === 0" label="Nenhum item no pedido" />
          <div v-else class="overflow-x-auto -mx-5">
            <table class="w-full text-sm min-w-[480px]">
              <thead>
                <tr class="text-left text-xs text-ink-400">
                  <th class="py-2 px-4 font-medium">Produto</th>
                  <th class="py-2 px-2 font-medium">Qtd</th>
                  <th class="py-2 px-2 font-medium">Vl. Unit</th>
                  <th class="py-2 px-2 font-medium">Desc.</th>
                  <th class="py-2 px-2 font-medium">Total</th>
                  <th class="py-2 px-2 font-medium"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-ink-200">
                <tr v-for="i in itens" :key="i.idpedido">
                  <td class="py-2 px-4">
                    <p class="font-medium text-ink-900 truncate">{{ i.descricao }}</p>
                    <p class="text-xs text-ink-400">{{ i.codproduto }}</p>
                  </td>
                  <td class="py-2 px-2 text-ink-600">{{ i.qtd }}</td>
                  <td class="py-2 px-2 text-ink-600">{{ formatReal(i.vlunit) }}</td>
                  <td class="py-2 px-2 text-ink-600">{{ descontoLabel(i) }}</td>
                  <td class="py-2 px-2 font-semibold text-ink-900">{{ formatReal(i.vltotal) }}</td>
                  <td class="py-2 px-2 whitespace-nowrap">
                    <button class="p-1 text-ink-400" aria-label="Editar" @click="abrirModalItem(i)">
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path stroke-linecap="round" stroke-linejoin="round" d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="p-1 text-ink-400" aria-label="Excluir" @click="removerItem(i)">
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div v-else-if="tab === 'desconto'" class="space-y-4">
        <section class="bg-white rounded-card shadow-card p-5">
          <h2 class="text-sm font-bold text-ink-900 mb-3">Desconto</h2>
          <div class="grid grid-cols-1 gap-3">
            <div class="flex gap-2">
              <button
                class="flex-1 rounded-xl py-2 text-sm font-semibold"
                :class="descontoModo === 'percent' ? 'bg-accent-500 text-navy-950' : 'bg-navy-800 text-ink-200'"
                @click="descontoModo = 'percent'"
              >%</button>
              <button
                class="flex-1 rounded-xl py-2 text-sm font-semibold"
                :class="descontoModo === 'reais' ? 'bg-accent-500 text-navy-950' : 'bg-navy-800 text-ink-200'"
                @click="descontoModo = 'reais'"
              >R$ (por item)</button>
            </div>
            <label class="block">
              <span class="text-ink-600 text-xs font-medium">Valor do desconto</span>
              <input v-model.number="descontoValor" type="number" min="0" class="input" placeholder="0,00" />
            </label>
            <div class="grid grid-cols-2 gap-3">
              <button class="btn-primary text-sm" @click="aplicarDescontoPedido">Aplicar</button>
              <button class="rounded-xl bg-navy-800 text-white font-semibold py-3 px-4 text-sm" @click="removerDesconto">Remover</button>
            </div>
          </div>
        </section>
      </div>

      <div v-else-if="tab === 'financeiro'" class="space-y-4">
        <section class="bg-white rounded-card shadow-card p-5">
          <h2 class="text-sm font-bold text-ink-900 mb-3">Financeiro</h2>
          <div class="grid grid-cols-1 gap-3">
            <label class="block">
              <span class="text-ink-600 text-xs font-medium">Cobrança</span>
              <select v-model="fin.cobranca" class="input">
                <option value="" disabled>Selecione a Cobrança</option>
                <option v-for="c in cobrancas" :key="c.codigo" :value="c.codigo">{{ c.descr }}</option>
              </select>
            </label>
            <label class="block">
              <span class="text-ink-600 text-xs font-medium">Condição</span>
              <select v-model="fin.condicao" class="input">
                <option value="" disabled>Selecione a Condição</option>
                <option v-for="c in condicoes" :key="c.codigo" :value="c.codigo">{{ c.descr }}</option>
              </select>
            </label>
            <div class="grid grid-cols-2 gap-3">
              <label class="block">
                <span class="text-ink-600 text-xs font-medium">Valor</span>
                <input v-model="fin.valor" type="number" min="0" step="0.01" class="input" placeholder="0,00" />
              </label>
              <label class="block">
                <span class="text-ink-600 text-xs font-medium">Autorização</span>
                <input v-model="fin.autorizacao" type="text" class="input" />
              </label>
            </div>
            <button class="btn-primary text-sm" @click="gravarParcela">Gravar</button>
          </div>

          <p class="mt-4 text-sm font-semibold text-ink-900">
            Restante: {{ formatReal(remaining) }}
          </p>

          <EmptyState v-if="parcelas.length === 0" label="Nenhuma parcela" />
          <ul v-else class="mt-3 divide-y divide-ink-200">
            <li v-for="pa in parcelas" :key="pa.idfinanceiro" class="py-3 flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-medium text-ink-900">{{ pa.cobdesc || pa.cobranca }} · {{ pa.condesc || pa.condicao }}</p>
                <p class="text-xs text-ink-400">{{ pa.autorizacao || '—' }}</p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="text-sm font-semibold text-ink-900">{{ formatReal(pa.valor) }}</span>
                <button class="p-1 text-ink-400" aria-label="Excluir" @click="removerParcela(pa.idfinanceiro)">
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                </button>
              </div>
            </li>
          </ul>
        </section>
      </div>

      <div v-else-if="tab === 'negociacao'" class="space-y-4">
        <section class="bg-white rounded-card shadow-card p-5">
          <h2 class="text-sm font-bold text-ink-900 mb-3">Negociação</h2>
          <div class="grid grid-cols-1 gap-3">
            <label class="block">
              <span class="text-ink-600 text-xs font-medium">Frete</span>
              <input v-model="store.cabecalho.valor_frete" type="number" min="0" step="0.01" class="input" placeholder="0,00" />
            </label>
            <label class="block">
              <span class="text-ink-600 text-xs font-medium">Retsuc</span>
              <input v-model="store.cabecalho.retsuc" type="number" min="0" step="0.01" class="input" placeholder="0,00" />
            </label>

            <div class="flex items-center justify-between gap-3">
              <span class="text-sm font-medium text-ink-900">Acréscimo por quilo</span>
              <input v-model="snquilo" type="checkbox" class="h-5 w-5" />
            </div>
            <label class="block" :class="{ 'opacity-50': !snquilo }">
              <span class="text-ink-600 text-xs font-medium">Valor por quilo</span>
              <input v-model="acrescimo.vlquilo" type="number" min="0" step="0.01" class="input" placeholder="0,00" />
            </label>

            <div class="flex items-center justify-between gap-3">
              <span class="text-sm font-medium text-ink-900">Acréscimo por unidade</span>
              <input v-model="snunidade" type="checkbox" class="h-5 w-5" />
            </div>
            <label class="block" :class="{ 'opacity-50': !snunidade }">
              <span class="text-ink-600 text-xs font-medium">Valor por unidade</span>
              <input v-model="acrescimo.vlunidade" type="number" min="0" step="0.01" class="input" placeholder="0,00" />
            </label>

            <div class="grid grid-cols-2 gap-3">
              <button class="btn-primary text-sm" @click="aplicarAcrescimoPedido">Aplicar</button>
              <button class="rounded-xl bg-navy-800 text-white font-semibold py-3 px-4 text-sm" @click="removerAcrescimo">Remover</button>
            </div>

            <div class="flex items-center justify-between gap-3 pt-1">
              <span class="text-sm font-medium text-ink-900">Resolvido</span>
              <input
                type="checkbox"
                class="h-5 w-5"
                :checked="store.cabecalho.resolvido === 'S'"
                @change="store.cabecalho.resolvido = ($event.target as HTMLInputElement).checked ? 'S' : 'N'"
              />
            </div>
          </div>
        </section>
      </div>
    </div>

    <div class="sticky bottom-0 z-10 mt-4 bg-white border-t border-ink-200 px-6 py-4 safe-bottom">
      <div class="grid grid-cols-4 gap-2">
        <button class="rounded-xl bg-navy-800 text-white font-semibold py-3 px-2 text-sm" @click="cancelarPedido">Cancelar</button>
        <button class="rounded-xl bg-navy-800 text-white font-semibold py-3 px-2 text-sm" @click="imprimir">Imprimir</button>
        <button class="btn-primary text-sm" @click="finalizarPedido">Finalizar</button>
        <button class="rounded-xl bg-navy-800 text-white font-semibold py-3 px-2 text-sm" @click="nfe">NF-e</button>
      </div>
      <div class="grid grid-cols-4 gap-2 mt-2">
        <button class="rounded-xl bg-navy-800 text-white font-semibold py-3 px-2 text-sm" @click="gerarTermo">Termo</button>
        <button class="rounded-xl bg-navy-800 text-white font-semibold py-3 px-2 text-sm" @click="boleto">Boleto</button>
        <button
          v-if="store.pedstatus === 'F'"
          class="rounded-xl bg-navy-800 text-white font-semibold py-3 px-2 text-sm"
          @click="reabrir"
        >Reabrir</button>
        <button
          v-if="store.cabecalho.tipo === 'O'"
          class="rounded-xl bg-navy-800 text-white font-semibold py-3 px-2 text-sm"
          @click="transformar"
        >Transf. Pedido</button>
        <button
          v-if="isEdit"
          class="rounded-xl bg-navy-800 text-white font-semibold py-3 px-2 text-sm"
          @click="duplicar"
        >Duplicar</button>
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

    <div
      v-if="modal.open"
      class="fixed inset-0 z-40 flex items-end justify-center bg-black/50"
      @click.self="modal.open = false"
    >
      <div class="w-full max-h-[90vh] overflow-auto rounded-t-2xl bg-white p-5">
        <h2 class="text-lg font-bold text-ink-900 mb-1">Produto</h2>
        <p class="text-xs text-ink-400 mb-3">{{ modal.codproduto }} · {{ modal.descricao }}</p>

        <div class="grid grid-cols-1 gap-3">
          <label class="block">
            <span class="text-ink-600 text-xs font-medium">Quantidade</span>
            <input v-model.number="modal.quantidade" type="number" min="0" class="input" />
          </label>
          <label class="block">
            <span class="text-ink-600 text-xs font-medium">Unidade</span>
            <input v-model="modal.unidade" type="text" class="input" placeholder="vazio = sem conversão" />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <span class="text-ink-600 text-xs font-medium">Desc. Incluso (%)</span>
              <input v-model.number="modal.descinc" type="number" min="0" class="input" />
            </label>
            <label class="block">
              <span class="text-ink-600 text-xs font-medium">Fator</span>
              <input :value="modalFator" type="text" class="input" disabled />
            </label>
          </div>
          <div class="flex gap-2">
            <button
              class="flex-1 rounded-xl py-2 text-sm font-semibold"
              :class="modal.descper === 'N' ? 'bg-accent-500 text-navy-950' : 'bg-navy-800 text-ink-200'"
              @click="modal.descper = 'N'"
            >Desconto R$</button>
            <button
              class="flex-1 rounded-xl py-2 text-sm font-semibold"
              :class="modal.descper === 'S' ? 'bg-accent-500 text-navy-950' : 'bg-navy-800 text-ink-200'"
              @click="modal.descper = 'S'"
            >Desconto %</button>
          </div>
          <label class="block">
            <span class="text-ink-600 text-xs font-medium">Desconto</span>
            <input v-model.number="modal.desconto" type="number" min="0" class="input" />
          </label>

          <div class="rounded-xl bg-navy-800 p-4 grid grid-cols-2 gap-3 text-xs">
            <div><span class="text-ink-400">Vl. Base:</span> <span class="text-white font-semibold">{{ formatReal(modalPreview.vlunbase) }}</span></div>
            <div><span class="text-ink-400">Vl. Unitário:</span> <span class="text-white font-semibold">{{ formatReal(modalPreview.vlunit) }}</span></div>
            <div class="col-span-2"><span class="text-ink-400">Total:</span> <span class="text-white font-semibold">{{ formatReal(modal.quantidade > 0 ? modalPreview.total : 0) }}</span></div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <button class="btn-primary text-sm" @click="gravarModal">Gravar</button>
            <button class="rounded-xl bg-navy-800 text-white font-semibold py-3 px-4 text-sm" @click="modal.open = false">Fechar</button>
          </div>
        </div>
      </div>
    </div>
    <div
      v-if="showSucata"
      class="fixed inset-0 z-40 flex items-end justify-center bg-black/50"
      @click.self="showSucata = false"
    >
      <div class="w-full max-h-[90vh] overflow-auto rounded-t-2xl bg-white p-5">
        <h2 class="text-lg font-bold text-ink-900 mb-3">Saldo Sucata</h2>
        <EmptyState v-if="sucataRows.length === 0" label="Nenhum saldo de sucata" />
        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="text-ink-400 text-xs uppercase">
              <tr>
                <th class="py-2 pr-3">Referência</th>
                <th class="py-2 pr-3 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-ink-200">
              <tr v-for="(r, i) in sucataRows" :key="i">
                <td class="py-2 pr-3">{{ r.referencia }}</td>
                <td class="py-2 pr-3 text-right">{{ formatReal(r.saldo) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <button class="w-full mt-4 py-2 text-sm font-semibold text-ink-600" @click="showSucata = false">Fechar</button>
      </div>
    </div>

    <div
      v-if="showSaldos"
      class="fixed inset-0 z-40 flex items-end justify-center bg-black/50"
      @click.self="showSaldos = false"
    >
      <div class="w-full max-h-[90vh] overflow-auto rounded-t-2xl bg-white p-5">
        <h2 class="text-lg font-bold text-ink-900 mb-3">Saldos do Cliente</h2>
        <EmptyState v-if="saldosRows.length === 0" label="Nenhum saldo" />
        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="text-ink-400 text-xs uppercase">
              <tr>
                <th class="py-2 pr-3">Conta</th>
                <th class="py-2 pr-3 text-right">Quantidade</th>
                <th class="py-2 pr-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-ink-200">
              <tr v-for="(r, i) in saldosRows" :key="i">
                <td class="py-2 pr-3">{{ r.conta }}</td>
                <td class="py-2 pr-3 text-right">{{ r.quan }}</td>
                <td class="py-2 pr-3 text-right">{{ formatReal(r.total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <button class="w-full mt-4 py-2 text-sm font-semibold text-ink-600" @click="showSaldos = false">Fechar</button>
      </div>
    </div>
  </AppShell>
</template>
