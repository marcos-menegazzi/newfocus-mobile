<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import Icon from '../components/Icon.vue'
import SelectField from '../components/SelectField.vue'
import SearchField from '../components/SearchField.vue'
import Segmented from '../components/Segmented.vue'
import Sheet from '../components/Sheet.vue'
import StatusChip from '../components/StatusChip.vue'
import { query } from '../db/connection'
import { formatReal, mudadata } from '../lib/format'
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
import { useConfirm } from '../composables/useConfirm'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const store = usePedidoStore()
const { notify } = useToast()
const { confirmar } = useConfirm()

const STEPS = [
  { label: 'Cliente', next: 'Continuar para produtos' },
  { label: 'Produtos', next: 'Continuar para pagamento' },
  { label: 'Pagamento', next: 'Revisar pedido' },
  { label: 'Revisão', next: '' },
]
const step = ref(0)
const prodView = ref<'buscar' | 'pedido'>('buscar')
const showAcoes = ref(false)
const STATUS_LABEL: Record<string, string> = {
  A: 'aberto', F: 'finalizado', V: 'aguardando confirmação', S: 'sincronizado', Z: 'faturado', C: 'cancelado',
}

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
  return c ? c.descricao : (store.cabecalho.cargadesc || 'Selecionar carga')
})
const operacaoLabel = computed(() => store.cabecalho.operacao || 'Selecionar operação')

const isEdit = computed(() => !!store.cabecalho.numpedido)
const titulo = computed(() => (store.cabecalho.numpedido ? `Pedido ${store.cabecalho.numpedido}` : 'Novo pedido'))
const aberto = computed(() => !store.cabecalho.numpedido || store.pedstatus === 'A')

const finObrigatorio = computed(() => auth.usuario?.finped === 'S')
const headerOk = computed(() => validarCabecalho() === null)
const pagamentoOk = computed(() => remaining.value <= 0.005)

const nome = (list: any[], key: string, val: unknown, field: string) =>
  list.find((x) => String(x[key]) === String(val))?.[field] ?? ''
const empresaNome = computed(() => nome(empresas.value, 'empresa', store.cabecalho.empresa, 'fantasia'))
const vendedorNome = computed(() => nome(vendedores.value, 'codigo', store.cabecalho.vendedor, 'nome'))
const condicaoNome = computed(() => nome(condicoes.value, 'codigo', store.cabecalho.condpag, 'descr'))
const tabelaNome = computed(() => nome(tabelas.value, 'codigo', store.cabecalho.tabela, 'descricao'))
const comissaoNome = computed(() => nome(comissoes.value, 'codigo', store.cabecalho.comissao, 'descricao'))
const tipoLabel = computed(() => ({ S: 'Saída', E: 'Entrada', O: 'Orçamento' } as Record<string, string>)[store.cabecalho.tipo] ?? '')
const condicoesResumo = computed(() =>
  [empresaNome.value, store.cabecalho.operacao, condicaoNome.value, tabelaNome.value && `tabela ${tabelaNome.value}`, cargaLabel.value !== 'Selecionar carga' && `carga ${cargaLabel.value}`]
    .filter(Boolean)
    .join(', '),
)

// Motivo que impede abrir a etapa i (null = pode abrir).
function bloqueio(i: number): string | null {
  if (i >= 1 && !headerOk.value) return validarCabecalho()
  if (i >= 2 && itens.value.length === 0) return 'Adicione ao menos um produto ao pedido.'
  return null
}

async function goTo(i: number) {
  if (i === step.value || i < 0 || i >= STEPS.length) return
  const err = i > step.value ? bloqueio(i) : null
  if (err) {
    notify(err)
    return
  }
  try {
    // Ao sair do cabeçalho o pedido já é gravado (rascunho, sem itens): se o app
    // fechar, o vendedor retoma pela lista de pedidos em vez de recomeçar.
    if (i >= 1 && !store.cabecalho.numpedido) await store.salvar()
    else await persistTotal()
  } catch (e) {
    notify(msg(e), 'error')
    return
  }
  step.value = i
  window.scrollTo({ top: 0 })
}

// Assim que o pedido novo ganha número, a URL passa a apontar para ele
// (recarregar ou voltar não inicia outro pedido).
watch(
  () => store.cabecalho.numpedido,
  (n) => {
    if (n && route.name === 'pedido-novo') router.replace({ name: 'pedido-edit', params: { numpedido: n } })
  },
)

async function salvarCampo() {
  try {
    await persistTotal()
  } catch (e) {
    notify(msg(e), 'error')
  }
}

const PROD_OPTIONS = [
  { value: 'descricao', label: 'Descrição' },
  { value: 'descred', label: 'Reduzida' },
  { value: 'codigo', label: 'Código' },
]
const CLIENT_OPTIONS = [
  { value: 'fantasia', label: 'Nome fantasia' },
  { value: 'razao', label: 'Razão social' },
  { value: 'codigo', label: 'Código' },
  { value: 'cnpj', label: 'CNPJ/CPF' },
  { value: 'cidade', label: 'Cidade' },
  { value: 'estado', label: 'Estado (UF)' },
]

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
    notify(`${p.descvis || p.descricao} adicionado`, 'success')
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
    notify('Item salvo', 'success')
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
  const ok = await confirmar({ title: 'Excluir este item?', message: `Produto ${row.codproduto} sai do pedido.`, confirmLabel: 'Excluir', danger: true })
  if (!ok) return
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
  const ok = await confirmar({
    title: `Cancelar o pedido ${store.cabecalho.numpedido}?`,
    message: 'Essa ação não pode ser desfeita.',
    confirmLabel: 'Cancelar pedido',
    cancelLabel: 'Voltar',
    danger: true,
  })
  if (!ok) return
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
    notify('Pedido finalizado', 'success')
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

function acao(fn: () => unknown) {
  showAcoes.value = false
  fn()
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
    await router.push(`/pedidos/${store.cabecalho.numpedido}`)
    await refreshItens()
    await refreshParcelas()
    step.value = 3
    notify(`Pedido duplicado como ${store.cabecalho.numpedido}`, 'success')
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
  await carregarRota()
})

function rotaNumpedido(): string {
  const p = route.params.numpedido
  return String((Array.isArray(p) ? p[0] : p) ?? '')
}

async function carregarRota() {
  const n = rotaNumpedido()
  Object.assign(cliente, { id: 0, codigo: 0, fantasia: '', razao: '', cnpj: '', limcred: 0, credito: 0, saldo: 0 })
  produtos.value = []
  prodSearched.value = false
  prodView.value = 'buscar'
  if (n) {
    await store.carregar(n)
    await carregarCliente()
  } else {
    await store.novo()
  }
  if (!store.cabecalho.data) store.cabecalho.data = today()
  if (!store.cabecalho.tipo) store.cabecalho.tipo = 'S'
  preloadNegociacao()
  await refreshItens()
  await refreshParcelas()
  // Pedido existente abre na revisão; dali cada etapa é editável.
  // Rascunho (aberto e sem itens) volta direto para a inclusão de produtos.
  if (!n) step.value = 0
  else step.value = store.pedstatus === 'A' && itens.value.length === 0 ? 1 : 3
}

// A mesma tela é reaproveitada entre pedidos: recarrega quando a rota aponta
// para outro pedido (não quando é o próprio pedido recém-criado ou duplicado).
watch(
  () => route.params.numpedido,
  () => {
    if (route.name !== 'pedido-edit' && route.name !== 'pedido-novo') return
    const n = rotaNumpedido()
    if (n !== String(store.cabecalho.numpedido ?? '')) carregarRota()
  },
)
</script>

<template>
  <AppShell :title="titulo" :subtitle="cliente.fantasia || cliente.razao || undefined" back>
    <template #actions>
      <StatusChip v-if="store.cabecalho.numpedido" :status="store.pedstatus" :itens="itens.length" />
      <button v-if="store.cabecalho.numpedido" class="icon-btn" aria-label="Mais ações" @click="showAcoes = true">
        <Icon name="more" :size="22" />
      </button>
    </template>

    <nav
      class="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 bg-mist/95 backdrop-blur-md border-b border-ink-200 px-4 pt-2 pb-3"
      aria-label="Etapas do pedido"
    >
      <ol class="grid grid-cols-4 gap-1.5">
        <li v-for="(s, i) in STEPS" :key="s.label">
          <button
            type="button"
            class="w-full text-left pt-1 pb-0.5 disabled:cursor-not-allowed"
            :aria-current="step === i ? 'step' : undefined"
            :disabled="i > step && !!bloqueio(i)"
            @click="goTo(i)"
          >
            <span class="block h-1 rounded-full" :class="i <= step ? 'bg-brand-600' : 'bg-ink-200'" />
            <span
              class="mt-1.5 flex items-center gap-1 text-xs whitespace-nowrap"
              :class="step === i ? 'font-semibold text-brand-700' : i < step ? 'text-ink-700' : 'text-ink-500'"
            >
              <Icon v-if="i < step" name="check" :size="13" :stroke="2.6" class="text-brand-600" />
              <template v-else>{{ i + 1 }}.</template>
              {{ s.label }}
            </span>
          </button>
        </li>
      </ol>
    </nav>

    <div class="page">
      <p
        v-if="store.cabecalho.numpedido && store.pedstatus !== 'A'"
        class="flex items-start gap-2 rounded-xl bg-info-100 text-info-800 px-3.5 py-3 text-sm"
      >
        <Icon name="info" class="mt-px" />
        <span>
          Este pedido está {{ STATUS_LABEL[store.pedstatus] ?? store.pedstatus }}.
          <template v-if="store.pedstatus === 'F'">Para alterar itens e valores, use Reabrir em Mais ações.</template>
        </span>
      </p>

      <!-- 1. Cliente e condições -->
      <template v-if="step === 0">
        <div>
          <h2 class="text-[22px] font-semibold tracking-tight">Para quem é o pedido?</h2>
          <p class="meta mt-1">{{ isEdit ? 'Confira os dados do pedido.' : 'As condições vêm preenchidas com as do último pedido. Confira antes de continuar.' }}</p>
        </div>

        <section class="panel p-4 space-y-4">
          <button type="button" class="input text-left flex items-center gap-3 py-3" @click="abrirCliente">
            <span class="h-10 w-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
              <Icon name="users" />
            </span>
            <span class="min-w-0 flex-1">
              <span v-if="cliente.codigo" class="block font-semibold truncate">{{ cliente.fantasia || cliente.razao }}</span>
              <span v-else class="block text-ink-400">Selecionar cliente</span>
              <span v-if="cliente.codigo" class="block meta truncate">Crédito disponível R$ {{ formatReal(cliente.credito) }}</span>
            </span>
            <span class="text-sm font-semibold text-brand-700">{{ cliente.codigo ? 'Trocar' : 'Escolher' }}</span>
          </button>
          <template v-if="cliente.codigo">
            <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div><dt class="meta text-xs">Código</dt><dd class="font-medium tabular-nums">{{ cliente.codigo }}</dd></div>
              <div><dt class="meta text-xs">CNPJ/CPF</dt><dd class="font-medium tabular-nums">{{ cliente.cnpj || '—' }}</dd></div>
              <div><dt class="meta text-xs">Limite de crédito</dt><dd class="font-medium tabular-nums">R$ {{ formatReal(cliente.limcred) }}</dd></div>
              <div><dt class="meta text-xs">Saldo</dt><dd class="font-medium tabular-nums">R$ {{ formatReal(cliente.saldo) }}</dd></div>
            </dl>
            <div class="grid grid-cols-2 gap-2">
              <button type="button" class="btn btn-tonal btn-sm" @click="abrirSucata">Saldo de sucata</button>
              <button type="button" class="btn btn-tonal btn-sm" @click="abrirSaldos">Saldos do cliente</button>
            </div>
          </template>
        </section>

        <section class="panel p-4 space-y-4">
          <div>
            <span class="label">Tipo</span>
            <Segmented
              v-model="store.cabecalho.tipo"
              :options="[{ value: 'S', label: 'Saída' }, { value: 'E', label: 'Entrada' }, { value: 'O', label: 'Orçamento' }]"
              label="Tipo do pedido"
            />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <span class="label">Data</span>
              <input v-model="store.cabecalho.data" type="date" class="input" />
            </label>
            <label class="block">
              <span class="label">Nº da nota</span>
              <input v-model="store.cabecalho.numero" type="text" inputmode="numeric" class="input" />
            </label>
          </div>
          <label class="block">
            <span class="label">Empresa</span>
            <SelectField v-model="store.cabecalho.empresa" :options="empresas.map((e) => ({ value: e.empresa, label: e.fantasia }))" title="Selecionar empresa" placeholder="Selecione a empresa" />
          </label>
          <label class="block">
            <span class="label">Vendedor</span>
            <SelectField v-model="store.cabecalho.vendedor" :options="vendedores.map((v) => ({ value: v.codigo, label: v.nome }))" title="Selecionar vendedor" placeholder="Selecione o vendedor" />
          </label>
        </section>

        <section class="panel p-4 space-y-4">
          <h3 class="section-title">Condições comerciais</h3>
          <div>
            <span class="label">Operação</span>
            <button type="button" class="input text-left flex items-center justify-between gap-2" @click="abrirOperacao">
              <span class="truncate" :class="store.cabecalho.operacao ? '' : 'text-ink-400'">{{ operacaoLabel }}</span>
              <Icon name="chevron-right" class="text-ink-400" />
            </button>
            <p v-if="store.cabecalho.operacao" class="meta mt-1.5">
              Cobrança {{ store.cabecalho.cobranca || '—' }}, local {{ store.cabecalho.local ?? '—' }}
            </p>
          </div>
          <label class="block">
            <span class="label">Condição de pagamento</span>
            <SelectField v-model="store.cabecalho.condpag" :options="condicoes.map((c) => ({ value: c.codigo, label: c.descr }))" title="Selecionar condição de pagamento" placeholder="Selecione a condição" />
          </label>
          <label class="block">
            <span class="label">Tabela de preço</span>
            <SelectField v-model="store.cabecalho.tabela" :options="tabelas.map((t) => ({ value: t.codigo, label: t.descricao }))" title="Selecionar tabela de preço" placeholder="Selecione a tabela" />
          </label>
          <div>
            <span class="label">Carga</span>
            <button type="button" class="input text-left flex items-center justify-between gap-2" @click="abrirCarga">
              <span class="truncate" :class="store.cabecalho.carga ? '' : 'text-ink-400'">{{ cargaLabel }}</span>
              <Icon name="chevron-right" class="text-ink-400 shrink-0" />
            </button>
          </div>
          <label class="block">
            <span class="label">Comissão</span>
            <SelectField v-model="store.cabecalho.comissao" :options="comissoes.map((c) => ({ value: c.codigo, label: c.descricao }))" title="Selecionar comissão" placeholder="Selecione a comissão" />
          </label>
        </section>
      </template>

      <!-- 2. Produtos -->
      <template v-else-if="step === 1">
        <Segmented
          v-model="prodView"
          :options="[{ value: 'buscar', label: 'Buscar produtos' }, { value: 'pedido', label: `No pedido (${itens.length})` }]"
          label="Produtos"
        />

        <template v-if="prodView === 'buscar'">
          <p v-if="!store.cabecalho.tabela" class="flex items-start gap-2 rounded-xl bg-sun-100 text-sun-800 px-3.5 py-3 text-sm">
            <Icon name="info" class="mt-px" />
            <span>Escolha a tabela de preço na <button class="font-semibold underline" @click="goTo(0)">etapa 1</button> para buscar produtos.</span>
          </p>
          <div class="space-y-3">
            <SearchField v-model="prodBusca" placeholder="Buscar produto" @submit="buscarProdutos()" />
            <Segmented v-model="prodCampo" :options="PROD_OPTIONS" label="Buscar produto por" />
          </div>

          <div v-if="prodSearched && produtos.length === 0" class="panel">
            <EmptyState icon="package" label="Nenhum produto encontrado" hint="Tente outro termo ou busque por código." />
          </div>
          <div v-else-if="!prodSearched" class="panel">
            <EmptyState icon="search" label="Busque um produto" hint="Digite parte da descrição ou o código e toque em buscar." />
          </div>
          <ul v-else class="list">
            <li v-for="p in produtos" :key="p.codigo" class="px-4 py-3.5">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-[15px] font-medium leading-snug line-clamp-2">{{ p.descvis }}</p>
                  <p class="meta tabular-nums mt-0.5">Cód. {{ p.codigo }}, estoque {{ p.estoque ?? 0 }}</p>
                </div>
                <p class="text-[15px] font-semibold tabular-nums shrink-0">R$ {{ formatReal(p.venda) }}</p>
              </div>
              <div class="flex items-center gap-2 mt-3">
                <label class="w-20">
                  <span class="sr-only">Quantidade</span>
                  <input v-model="p.qtd" type="number" inputmode="decimal" min="0" class="input min-h-10 py-1.5 text-center" placeholder="Qtd" />
                </label>
                <label class="w-20">
                  <span class="sr-only">Unidade</span>
                  <input v-model="p.unidade" type="text" class="input min-h-10 py-1.5 text-center" placeholder="Un." />
                </label>
                <button class="btn btn-primary btn-sm min-h-10 flex-1" @click="quickAdd(p)">
                  <Icon name="plus" :size="16" /> Adicionar
                </button>
                <button class="icon-btn border border-ink-200" aria-label="Ajustar preço e desconto" @click="abrirModalProduto(p)">
                  <Icon name="edit" :size="18" />
                </button>
              </div>
            </li>
          </ul>
          <button v-if="produtos.length >= PROD_LIMIT" class="btn btn-secondary w-full" @click="maisProdutos">Carregar mais produtos</button>
        </template>

        <template v-else>
          <div v-if="itens.length === 0" class="panel">
            <EmptyState icon="cart" label="Nenhum item no pedido" hint="Busque produtos e toque em Adicionar.">
              <button class="btn btn-tonal btn-sm" @click="prodView = 'buscar'">Buscar produtos</button>
            </EmptyState>
          </div>
          <ul v-else class="list">
            <li v-for="i in itens" :key="i.idpedido" class="flex items-start gap-2 pl-4 pr-2 py-3">
              <div class="min-w-0 flex-1">
                <p class="text-[15px] font-medium leading-snug line-clamp-2">{{ i.descricao }}</p>
                <p class="meta tabular-nums mt-0.5">{{ i.qtd }} × R$ {{ formatReal(i.vlunit) }}</p>
                <p v-if="descontoLabel(i) !== '—'" class="text-xs text-brand-700 font-medium mt-0.5">Desconto {{ descontoLabel(i) }}</p>
              </div>
              <p class="text-[15px] font-semibold tabular-nums shrink-0 pt-px">R$ {{ formatReal(i.vltotal) }}</p>
              <div class="flex shrink-0 -mt-1">
                <button class="icon-btn" :aria-label="`Editar ${i.descricao}`" @click="abrirModalItem(i)">
                  <Icon name="edit" :size="18" />
                </button>
                <button class="icon-btn text-danger-600" :aria-label="`Excluir ${i.descricao}`" @click="removerItem(i)">
                  <Icon name="trash" :size="18" />
                </button>
              </div>
            </li>
          </ul>
        </template>
      </template>

      <!-- 3. Pagamento -->
      <template v-else-if="step === 2">
        <section class="panel p-4 space-y-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="section-title">Parcelas</h2>
              <p class="meta mt-0.5">{{ finObrigatorio ? 'Distribua o total entre as cobranças.' : 'Opcional para este usuário.' }}</p>
            </div>
            <p class="text-right shrink-0">
              <span class="block meta text-xs">Falta distribuir</span>
              <span class="font-semibold tabular-nums" :class="pagamentoOk ? 'text-success-600' : 'text-sun-800'">R$ {{ formatReal(remaining) }}</span>
            </p>
          </div>
          <ul v-if="parcelas.length" class="divide-y divide-ink-100 border-y border-ink-100 -mx-4">
            <li v-for="pa in parcelas" :key="pa.idfinanceiro" class="flex items-center gap-3 pl-4 pr-2 py-3">
              <div class="min-w-0 flex-1">
                <p class="text-[15px] font-medium truncate">{{ pa.cobdesc || pa.cobranca }}</p>
                <p class="meta truncate">{{ pa.condesc || pa.condicao }}{{ pa.autorizacao ? `, autorização ${pa.autorizacao}` : '' }}</p>
              </div>
              <span class="text-[15px] font-semibold tabular-nums">R$ {{ formatReal(pa.valor) }}</span>
              <button class="icon-btn text-danger-600" aria-label="Excluir parcela" @click="removerParcela(pa.idfinanceiro)">
                <Icon name="trash" :size="18" />
              </button>
            </li>
          </ul>
          <div class="grid grid-cols-2 gap-3">
            <label class="block col-span-2">
              <span class="label">Cobrança</span>
              <SelectField v-model="fin.cobranca" :options="cobrancas.map((c) => ({ value: c.codigo, label: c.descr }))" title="Selecionar cobrança" placeholder="Selecione a cobrança" />
            </label>
            <label class="block col-span-2">
              <span class="label">Condição</span>
              <SelectField v-model="fin.condicao" :options="condicoes.map((c) => ({ value: c.codigo, label: c.descr }))" title="Selecionar condição" placeholder="Selecione a condição" />
            </label>
            <label class="block">
              <span class="label">Valor</span>
              <input v-model="fin.valor" type="number" inputmode="decimal" min="0" step="0.01" class="input" :placeholder="formatReal(remaining)" />
            </label>
            <label class="block">
              <span class="label">Autorização</span>
              <input v-model="fin.autorizacao" type="text" class="input" />
            </label>
          </div>
          <button class="btn btn-tonal w-full" @click="gravarParcela">
            <Icon name="plus" :size="18" /> Adicionar parcela
          </button>
        </section>

        <section class="panel p-4 space-y-4">
          <div>
            <h2 class="section-title">Desconto no pedido</h2>
            <p class="meta mt-0.5">Aplicado a todos os itens. Só vale para pedido aberto.</p>
          </div>
          <Segmented
            v-model="descontoModo"
            :options="[{ value: 'percent', label: 'Percentual (%)' }, { value: 'reais', label: 'R$ por item' }]"
            label="Tipo de desconto"
          />
          <label class="block">
            <span class="sr-only">{{ descontoModo === 'percent' ? 'Desconto em %' : 'Desconto em R$ por item' }}</span>
            <input v-model.number="descontoValor" type="number" inputmode="decimal" min="0" class="input" placeholder="0,00" />
          </label>
          <div class="grid grid-cols-2 gap-2">
            <button class="btn btn-secondary" :disabled="!aberto" @click="removerDesconto">Remover</button>
            <button class="btn btn-primary" :disabled="!aberto" @click="aplicarDescontoPedido">Aplicar</button>
          </div>
        </section>

        <section class="panel p-4 space-y-4">
          <h2 class="section-title">Acréscimo</h2>
          <label class="flex items-center justify-between gap-3">
            <span class="text-[15px]">Por quilo</span>
            <input v-model="snquilo" type="checkbox" class="switch" />
          </label>
          <label v-if="snquilo" class="block">
            <span class="label">Valor por quilo (R$)</span>
            <input v-model="acrescimo.vlquilo" type="number" inputmode="decimal" min="0" step="0.01" class="input" placeholder="0,00" />
          </label>
          <label class="flex items-center justify-between gap-3">
            <span class="text-[15px]">Por unidade</span>
            <input v-model="snunidade" type="checkbox" class="switch" />
          </label>
          <label v-if="snunidade" class="block">
            <span class="label">Valor por unidade (R$)</span>
            <input v-model="acrescimo.vlunidade" type="number" inputmode="decimal" min="0" step="0.01" class="input" placeholder="0,00" />
          </label>
          <div class="grid grid-cols-2 gap-2">
            <button class="btn btn-secondary" :disabled="!aberto" @click="removerAcrescimo">Remover</button>
            <button class="btn btn-primary" :disabled="!aberto" @click="aplicarAcrescimoPedido">Aplicar</button>
          </div>
        </section>

        <section class="panel p-4 space-y-4">
          <h2 class="section-title">Frete e negociação</h2>
          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <span class="label">Frete (R$)</span>
              <input v-model="store.cabecalho.valor_frete" type="number" inputmode="decimal" min="0" step="0.01" class="input" placeholder="0,00" />
            </label>
            <label class="block">
              <span class="label">Retsuc (R$)</span>
              <input v-model="store.cabecalho.retsuc" type="number" inputmode="decimal" min="0" step="0.01" class="input" placeholder="0,00" />
            </label>
          </div>
          <label class="flex items-center justify-between gap-3">
            <span>
              <span class="block text-[15px] font-medium">Negociação resolvida</span>
              <span class="meta">Marque quando as condições estiverem acertadas.</span>
            </span>
            <input
              type="checkbox"
              class="switch"
              :checked="store.cabecalho.resolvido === 'S'"
              @change="store.cabecalho.resolvido = ($event.target as HTMLInputElement).checked ? 'S' : 'N'"
            />
          </label>
        </section>
      </template>

      <!-- 4. Revisão -->
      <template v-else>
        <div class="pt-1 pb-2">
          <p class="meta text-sm">Total do pedido</p>
          <p class="mt-1 flex items-baseline gap-1.5">
            <span class="text-lg text-ink-500">R$</span>
            <span class="figure text-[44px]">{{ formatReal(total) }}</span>
          </p>
          <p class="meta mt-2 tabular-nums">
            {{ itens.length }} {{ itens.length === 1 ? 'item' : 'itens' }}, {{ quantidade }} {{ quantidade === 1 ? 'unidade' : 'unidades' }},
            flex R$ {{ formatReal(flexPedido) }} (saldo R$ {{ formatReal(saldoFlex) }})
          </p>
        </div>

        <section class="panel p-4">
          <div class="flex items-baseline justify-between gap-3">
            <h2 class="text-[13px] font-medium text-ink-500">Cliente e condições</h2>
            <button class="text-sm font-semibold text-brand-700" @click="goTo(0)">Editar</button>
          </div>
          <p class="mt-1.5 text-[15px] font-semibold">{{ cliente.fantasia || cliente.razao || 'Cliente não informado' }}</p>
          <p class="mt-0.5 text-sm text-ink-700">{{ condicoesResumo || 'Condições não informadas' }}</p>
          <p class="mt-0.5 meta">{{ [tipoLabel, mudadata(store.cabecalho.data), vendedorNome && `vendedor ${vendedorNome}`, comissaoNome && `comissão ${comissaoNome}`].filter(Boolean).join(', ') }}</p>
        </section>

        <section class="panel p-4">
          <div class="flex items-baseline justify-between gap-3 mb-1.5">
            <h2 class="text-[13px] font-medium text-ink-500">Produtos</h2>
            <button class="text-sm font-semibold text-brand-700" @click="goTo(1)">Editar</button>
          </div>
          <p v-if="itens.length === 0" class="text-sm text-ink-500">Nenhum item.</p>
          <div v-for="i in itens.slice(0, 6)" :key="i.idpedido" class="flex justify-between gap-3 py-1.5 text-sm">
            <span class="min-w-0 truncate">{{ i.qtd }} × {{ i.descricao }}</span>
            <span class="font-semibold tabular-nums shrink-0">R$ {{ formatReal(i.vltotal) }}</span>
          </div>
          <button v-if="itens.length > 6" class="mt-1 text-sm font-medium text-brand-700" @click="goTo(1); prodView = 'pedido'">
            Ver mais {{ itens.length - 6 }} {{ itens.length - 6 === 1 ? 'item' : 'itens' }}
          </button>
        </section>

        <section class="panel p-4">
          <div class="flex items-baseline justify-between gap-3 mb-1.5">
            <h2 class="text-[13px] font-medium text-ink-500">Pagamento</h2>
            <button class="text-sm font-semibold text-brand-700" @click="goTo(2)">Editar</button>
          </div>
          <div v-for="pa in parcelas" :key="pa.idfinanceiro" class="flex justify-between gap-3 py-1.5 text-sm">
            <span class="min-w-0 truncate">{{ pa.cobdesc || pa.cobranca }}, {{ pa.condesc || pa.condicao }}</span>
            <span class="font-semibold tabular-nums shrink-0">R$ {{ formatReal(pa.valor) }}</span>
          </div>
          <p v-if="parcelas.length === 0" class="text-sm text-ink-500">Nenhuma parcela.</p>
          <p
            class="mt-2 flex items-center gap-1.5 text-[13px] font-semibold"
            :class="pagamentoOk ? 'text-success-600' : finObrigatorio ? 'text-sun-800' : 'text-ink-500'"
          >
            <Icon :name="pagamentoOk ? 'check' : 'alert'" :size="16" :stroke="2.2" />
            {{ pagamentoOk ? 'Total distribuído' : `Falta distribuir R$ ${formatReal(remaining)}` }}
          </p>
          <p v-if="Number(store.cabecalho.valor_frete) > 0 || snquilo || snunidade" class="mt-1 meta">
            {{ [Number(store.cabecalho.valor_frete) > 0 && `frete R$ ${formatReal(store.cabecalho.valor_frete)}`, snquilo && `acréscimo R$ ${formatReal(acrescimo.vlquilo)}/kg`, snunidade && `acréscimo R$ ${formatReal(acrescimo.vlunidade)}/un`].filter(Boolean).join(', ') }}
          </p>
        </section>

        <section class="panel p-4 space-y-4">
          <h2 class="text-[13px] font-medium text-ink-500">Observações</h2>
          <label class="block">
            <span class="label">Observação</span>
            <textarea v-model="store.cabecalho.obsped" rows="2" class="input" @change="salvarCampo" />
          </label>
          <label class="block">
            <span class="label">Complemento</span>
            <textarea v-model="store.cabecalho.complemento" rows="2" class="input" @change="salvarCampo" />
          </label>
        </section>
      </template>
    </div>

    <template #footer>
      <div v-if="step < 3" class="space-y-2.5">
        <p v-if="itens.length" class="flex items-baseline justify-between text-sm">
          <span class="meta">{{ itens.length }} {{ itens.length === 1 ? 'item' : 'itens' }}</span>
          <span class="font-semibold tabular-nums">R$ {{ formatReal(total) }}</span>
        </p>
        <div class="flex gap-2">
          <button v-if="step > 0" class="btn btn-secondary" @click="goTo(step - 1)">Voltar</button>
          <button class="btn btn-primary flex-1" @click="goTo(step + 1)">{{ STEPS[step].next }}</button>
        </div>
      </div>
      <div v-else class="flex gap-2">
        <button class="btn btn-secondary px-3.5" aria-label="Mais ações" @click="showAcoes = true">
          <Icon name="more" :size="22" />
        </button>
        <button class="btn btn-secondary" @click="imprimir">
          <Icon name="printer" /> Imprimir
        </button>
        <button class="btn btn-primary flex-1" :disabled="!aberto" @click="finalizarPedido">
          <Icon name="check" /> Finalizar
        </button>
      </div>
    </template>

    <Sheet :open="showAcoes" title="Ações do pedido" :subtitle="titulo" @close="showAcoes = false">
      <ul class="-mx-5 divide-y divide-ink-100">
        <li>
          <button class="list-row px-5 flex items-center gap-3" @click="acao(nfe)"><Icon name="file" class="text-ink-500" /> Emitir NF-e</button>
        </li>
        <li>
          <button class="list-row px-5 flex items-center gap-3" @click="acao(boleto)"><Icon name="barcode" class="text-ink-500" /> Gerar boleto</button>
        </li>
        <li>
          <button class="list-row px-5 flex items-center gap-3" @click="acao(gerarTermo)"><Icon name="receipt" class="text-ink-500" /> Gerar termo</button>
        </li>
        <li v-if="store.pedstatus === 'F'">
          <button class="list-row px-5 flex items-center gap-3" @click="acao(reabrir)"><Icon name="undo" class="text-ink-500" /> Reabrir pedido</button>
        </li>
        <li v-if="store.cabecalho.tipo === 'O'">
          <button class="list-row px-5 flex items-center gap-3" @click="acao(transformar)"><Icon name="orders" class="text-ink-500" /> Transformar orçamento em pedido</button>
        </li>
        <li v-if="isEdit">
          <button class="list-row px-5 flex items-center gap-3" @click="acao(duplicar)"><Icon name="copy" class="text-ink-500" /> Duplicar pedido</button>
        </li>
        <li>
          <button class="list-row px-5 flex items-center gap-3 text-danger-700" @click="acao(cancelarPedido)"><Icon name="ban" /> Cancelar pedido</button>
        </li>
      </ul>
    </Sheet>

    <Sheet :open="showCliente" title="Selecionar cliente" size="tall" @close="showCliente = false">
      <div class="sticky top-0 z-10 bg-surface pb-3 space-y-2">
        <SearchField v-model="clienteBusca" :placeholder="`Buscar por ${CLIENT_OPTIONS.find((o) => o.value === clienteCampo)?.label.toLowerCase()}`" @submit="buscarClientes" />
        <SelectField v-model="clienteCampo" :options="CLIENT_OPTIONS" title="Buscar em" prefix="Buscar em:" size="sm" aria-label="Buscar em" />
      </div>
      <EmptyState v-if="clientes.length === 0" icon="users" label="Nenhum cliente encontrado" />
      <ul v-else class="divide-y divide-ink-100 -mx-5">
        <li v-for="c in clientes" :key="c.clifor">
          <button class="list-row px-5" @click="aplicarCliente(c)">
            <span class="block text-[15px] font-medium">{{ c.fantasia }}</span>
            <span class="meta block">{{ c.cidade }}{{ c.estado ? ` / ${c.estado}` : '' }}</span>
            <span v-if="c.cnpj" class="meta block tabular-nums">{{ c.cnpj }}</span>
          </button>
        </li>
      </ul>
    </Sheet>

    <Sheet :open="showOperacao" title="Selecionar operação" @close="showOperacao = false">
      <EmptyState
        v-if="operacoes.length === 0"
        icon="info"
        :label="store.cabecalho.empresa ? 'Nenhuma operação disponível' : 'Selecione a empresa primeiro'"
        :hint="store.cabecalho.empresa ? 'Não há operações para esta empresa e cliente.' : 'As operações dependem da empresa do pedido.'"
      />
      <ul v-else class="divide-y divide-ink-100 -mx-5">
        <li v-for="o in operacoes" :key="o.operacao">
          <button class="list-row px-5 flex items-center justify-between gap-3" @click="aplicarOperacao(o)">
            <span class="min-w-0">
              <span class="block text-[15px] font-medium">{{ o.operacao }}</span>
              <span class="meta">Cobrança {{ o.cobranca }}, local {{ o.local }}</span>
            </span>
            <Icon v-if="store.cabecalho.operacao === o.operacao" name="check" class="text-brand-700" :stroke="2.4" />
          </button>
        </li>
      </ul>
    </Sheet>

    <Sheet :open="showCarga" title="Selecionar carga" @close="showCarga = false">
      <EmptyState v-if="cargas.length === 0" icon="info" label="Nenhuma carga disponível" />
      <ul v-else class="divide-y divide-ink-100 -mx-5">
        <li v-for="c in cargas" :key="c.codigo">
          <button class="list-row px-5 flex items-center justify-between gap-3" @click="aplicarCarga(c)">
            <span class="text-[15px] font-medium">{{ c.descricao }}</span>
            <Icon v-if="String(store.cabecalho.carga) === String(c.codigo)" name="check" class="text-brand-700" :stroke="2.4" />
          </button>
        </li>
      </ul>
    </Sheet>

    <Sheet :open="modal.open" title="Ajustar item" :subtitle="`${modal.codproduto}, ${modal.descricao}`" @close="modal.open = false">
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="label">Quantidade</span>
            <input v-model.number="modal.quantidade" type="number" inputmode="decimal" min="0" class="input" />
          </label>
          <label class="block">
            <span class="label">Unidade</span>
            <input v-model="modal.unidade" type="text" class="input" placeholder="Padrão" />
          </label>
          <label class="block">
            <span class="label">Desc. incluso (%)</span>
            <input v-model.number="modal.descinc" type="number" inputmode="decimal" min="0" class="input" />
          </label>
          <label class="block">
            <span class="label">Fator</span>
            <input :value="modalFator" type="text" class="input" disabled />
          </label>
        </div>
        <div>
          <span class="label">Desconto</span>
          <div class="grid grid-cols-[1fr_9rem] gap-2">
            <input v-model.number="modal.desconto" type="number" inputmode="decimal" min="0" class="input" aria-label="Valor do desconto" />
            <Segmented
              v-model="modal.descper"
              :options="[{ value: 'N', label: 'R$' }, { value: 'S', label: '%' }]"
              label="Tipo de desconto"
            />
          </div>
        </div>

        <dl class="rounded-xl bg-ink-50 grid grid-cols-3 divide-x divide-ink-200 text-sm">
          <div class="px-3 py-3"><dt class="meta text-xs">Valor base</dt><dd class="font-semibold tabular-nums">{{ formatReal(modalPreview.vlunbase) }}</dd></div>
          <div class="px-3 py-3"><dt class="meta text-xs">Unitário</dt><dd class="font-semibold tabular-nums">{{ formatReal(modalPreview.vlunit) }}</dd></div>
          <div class="px-3 py-3"><dt class="meta text-xs">Total</dt><dd class="font-semibold tabular-nums">{{ formatReal(modal.quantidade > 0 ? modalPreview.total : 0) }}</dd></div>
        </dl>
      </div>
      <template #footer>
        <button class="btn btn-primary w-full" @click="gravarModal">Salvar item</button>
      </template>
    </Sheet>

    <Sheet :open="showSucata" title="Saldo de sucata" :subtitle="cliente.fantasia" @close="showSucata = false">
      <EmptyState v-if="sucataRows.length === 0" icon="info" label="Nenhum saldo de sucata" />
      <table v-else class="data-table">
        <thead>
          <tr>
            <th class="pl-0">Referência</th>
            <th class="num pr-0">Saldo</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in sucataRows" :key="i">
            <td class="pl-0">{{ r.referencia }}</td>
            <td class="num pr-0">{{ formatReal(r.saldo) }}</td>
          </tr>
        </tbody>
      </table>
    </Sheet>

    <Sheet :open="showSaldos" title="Saldos do cliente" :subtitle="cliente.fantasia" @close="showSaldos = false">
      <EmptyState v-if="saldosRows.length === 0" icon="info" label="Nenhum saldo" />
      <table v-else class="data-table">
        <thead>
          <tr>
            <th class="pl-0">Conta</th>
            <th class="num">Quantidade</th>
            <th class="num pr-0">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in saldosRows" :key="i">
            <td class="pl-0">{{ r.conta }}</td>
            <td class="num">{{ r.quan }}</td>
            <td class="num pr-0">{{ formatReal(r.total) }}</td>
          </tr>
        </tbody>
      </table>
    </Sheet>
  </AppShell>
</template>
