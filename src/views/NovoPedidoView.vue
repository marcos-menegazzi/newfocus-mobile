<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import Icon from '../components/Icon.vue'
import SelectField from '../components/SelectField.vue'
import SearchField from '../components/SearchField.vue'
import Segmented from '../components/Segmented.vue'
import Sheet from '../components/Sheet.vue'
import StatusChip from '../components/StatusChip.vue'
import MoneyInput from '../components/MoneyInput.vue'
import { query, run, saveWebDb } from '../db/connection'
import { formatNumero, formatReal, mudadata, textoObservacao } from '../lib/format'
import { getfator, isCondAvista, round } from '../services/pedido/calc'
import { calcPreco } from '../services/pedido/preco'
import { listarItens, incluirItem, gravarItem, excluirItem, historicoProduto, type HistoricoProduto, type ItemGravado } from '../services/pedido/itens'
import { aplicarDesconto, aplicarAcrescimo } from '../services/pedido/desconto'
import { incluirParcela, excluirParcela, listarParcelas, validarFinanceiro } from '../services/pedido/financeiro'
import { finalizar } from '../services/pedido/finalizar'
import { imprimirPedido } from '../services/pedido/imprimir'
import {
  creditoDisponivel, escolherCliente, msgVencidos, opcoesDoCliente, situacaoTitulos, sucataEmAberto,
  tituloVencido, ultrapassaCredito, type OpcoesCliente,
} from '../services/pedido/cliente'
import { exigirProdutosSincronizados } from '../services/pedido/pedido'
import { buscarProdutosPedido } from '../services/produtos'
import { imprimirErp, termo, saldoSucata, saldosFinanceiro, type SaldoSucata, type SaldoFinanceiro } from '../services/pedido/termo'
import {
  danfeEmitida, motivoBoleto, motivoCancelar, motivoDuplicar, motivoFinalizar,
  motivoImprimir, motivoNfePedido, motivoReabrir, motivoReenviar, motivoTransformar, type PedidoSituacao,
} from '../services/pedido/acoes'
import { abrirDanfe, emitirNfe, emitirBoleto } from '../services/sync/fiscal'
import { exigirServidorLivre } from '../services/sync/gate'
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
const { confirmar, avisar } = useConfirm()

const STEPS = [
  { label: 'Cliente', next: 'Continuar para produtos' },
  { label: 'Produtos', next: 'Continuar para pagamento' },
  { label: 'Pagamento', next: 'Revisar pedido' },
  { label: 'Revisão', next: '' },
]
const step = ref(0)
let mudandoEtapa = false
const prodView = ref<'buscar' | 'pedido'>('buscar')
const showAcoes = ref(false)
const STATUS_LABEL: Record<string, string> = {
  A: 'aberto', F: 'finalizado', V: 'aguardando confirmação', S: 'sincronizado', Z: 'faturado', C: 'cancelado',
}

const empresas = ref<any[]>([])
const vendedores = ref<any[]>([])
const condicoes = ref<any[]>([])
const tabelas = ref<any[]>([])
const grupos = ref<any[]>([])
const cargas = ref<any[]>([])
const comissoes = ref<any[]>([])
const operacoes = ref<any[]>([])

const itens = ref<any[]>([])
const total = ref(0)
const quantidade = ref(0)
const flexPedido = ref(0)
const pesoPedido = ref(0)
const saldoFlex = computed(() => Number(auth.usuario?.saldoflex ?? 0))

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
const credito = computed(() => creditoDisponivel(cliente))

// O que o cliente escolhido pode usar (sem cliente, tudo).
const opcoes = ref<OpcoesCliente>({ condicoes: [], cobrancas: [], tabelas: [] })
const tituloAtrasado = ref<{ vencimento: string } | null>(null)

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
// Com itens no pedido, trocar empresa, cliente ou condição mudaria o que já foi vendido.
const travado = computed(() => !aberto.value || itens.value.length > 0)
// Consumidor (CPF): nome e documento podem ser informados no pedido.
const consumidor = computed(() => String(cliente.cnpj ?? '').replace(/\D/g, '').length === 11)

const finObrigatorio = computed(() => auth.usuario?.finped === 'S')
const headerOk = computed(() => validarCabecalho() === null)
// Sem parcelas o financeiro só é cobrado de quem tem finped; com alguma, a soma precisa bater com o total.
const exigeDistribuir = computed(() => finObrigatorio.value || parcelas.value.length > 0)
const pagamentoOk = computed(() => Math.abs(remaining.value) <= 0.005)
const faltaLabel = computed(() => (remaining.value < 0 ? 'Parcelas excedem o total em' : 'Falta distribuir'))

const nome = (list: any[], key: string, val: unknown, field: string) =>
  list.find((x) => String(x[key]) === String(val))?.[field] ?? ''
const empresaNome = computed(() => nome(empresas.value, 'empresa', store.cabecalho.empresa, 'fantasia'))
const vendedorNome = computed(() => nome(vendedores.value, 'codigo', store.cabecalho.vendedor, 'nome'))
const condicaoNome = computed(() => nome(condicoes.value, 'codigo', store.cabecalho.condpag, 'descr'))
const tabelaNome = computed(() => nome(tabelas.value, 'codigo', store.cabecalho.tabela, 'descricao'))
const comissaoNome = computed(() => nome(comissoes.value, 'codigo', store.cabecalho.comissao, 'descricao'))
const tipoLabel = computed(() => ({ S: 'Saída', E: 'Entrada', O: 'Orçamento' } as Record<string, string>)[store.cabecalho.tipo] ?? '')
const razaoRevisao = computed(() => cliente.razao || store.cabecalho.cliente_nome)
const clienteRevisao = computed(() => cliente.fantasia || razaoRevisao.value || 'Cliente não informado')
const condicoesRevisao = computed(() => {
  const cab = store.cabecalho
  return [
    { label: 'Condição de pagamento', valor: condicaoNome.value || cab.condpag },
    { label: 'Tabela de preço', valor: tabelaNome.value || cab.tabela },
    { label: 'Empresa', valor: empresaNome.value || cab.empresa },
    { label: 'Operação', valor: cab.operacao },
    { label: 'Tipo de pedido', valor: tipoLabel.value },
    { label: 'Data do pedido', valor: cab.data && mudadata(cab.data) },
    { label: 'Carga', valor: cab.carga && (cargaLabel.value === 'Selecionar carga' ? cab.carga : cargaLabel.value) },
    { label: 'Vendedor', valor: vendedorNome.value || cab.vendedor },
    { label: 'Comissão', valor: comissaoNome.value || cab.comissao },
  ]
})

// Motivo que impede abrir a etapa i (null = pode abrir).
function bloqueio(i: number): string | null {
  if (i >= 1 && !headerOk.value) return validarCabecalho()
  if (i >= 2 && itens.value.length === 0) return 'Adicione ao menos um produto ao pedido.'
  return null
}

async function goTo(i: number) {
  if (mudandoEtapa || i === step.value || i < 0 || i >= STEPS.length) return
  const err = i > step.value ? bloqueio(i) : null
  if (err) {
    notify(err)
    return
  }
  mudandoEtapa = true
  try {
    // Ao sair do cabeçalho o pedido já é gravado (rascunho, sem itens): se o app
    // fechar, o vendedor retoma pela lista de pedidos em vez de recomeçar.
    if (i >= 1 && !store.cabecalho.numpedido) await criarPedido()
    else await persistTotal()
    await salvarEtapa(i)
    step.value = i
    window.scrollTo({ top: 0 })
  } catch (e) {
    notify(msg(e), 'error')
  } finally {
    mudandoEtapa = false
  }
}

async function salvarEtapa(etapa: number) {
  const pedido = store.cabecalho
  if (!pedido.numpedido) return
  await run('UPDATE ped SET etapa = ? WHERE numpedido = ?', [etapa, pedido.numpedido])
  await saveWebDb()
  pedido.etapa = etapa
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
    pesoPedido.value = 0
    return
  }
  const r = await listarItens(n)
  itens.value = r.rows
  total.value = r.total
  flexPedido.value = r.flex
  pesoPedido.value = r.pesopedido
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

function mostrarCliente(row: any) {
  cliente.id = row.clifor
  cliente.codigo = row.codigo
  cliente.fantasia = row.fantasia
  cliente.razao = row.razao
  cliente.cnpj = row.cnpj
  cliente.limcred = row.limcred
  cliente.credito = row.credito
  cliente.saldo = row.saldo
}

function limparCliente() {
  Object.assign(cliente, { id: 0, codigo: 0, fantasia: '', razao: '', cnpj: '', limcred: 0, credito: 0, saldo: 0 })
  Object.assign(store.cabecalho, { clifor: '', cliente_nome: '', cliente_cpf: '' })
  tituloAtrasado.value = null
}

async function aplicarCliente(row: any) {
  const c = store.cabecalho
  showCliente.value = false
  const e = await escolherCliente(row, {
    empresa: c.empresa, tipo: c.tipo, condpag: c.condpag, tabela: c.tabela, usuario: auth.usuario ?? {},
  })
  if (e.bloqueio) {
    await avisar({ title: 'Cliente bloqueado', message: e.bloqueio })
    return
  }
  mostrarCliente(row)
  opcoes.value = e.opcoes
  tituloAtrasado.value = e.titulo
  Object.assign(c, e.cabecalho)
  if (e.avisos.length) await avisar({ title: row.fantasia || row.razao, message: e.avisos.join('\n\n') })
}

// Pedido já gravado: só exibe, sem reaplicar as regras sobre o que foi salvo.
async function carregarCliente() {
  const c = store.cabecalho
  opcoes.value = await opcoesDoCliente(c.clifor)
  if (!c.clifor) return
  const rows = await query<any>('SELECT * FROM clifor WHERE codigo = ?', [c.clifor])
  if (!rows[0]) return
  mostrarCliente(rows[0])
  tituloAtrasado.value = await tituloVencido(c.clifor, c.empresa, auth.usuario ?? {})
}

async function trocarEmpresa() {
  const c = store.cabecalho
  Object.assign(c, { operacao: '', cobranca: '', local: '' })
  limparProdutos()
  if (!c.clifor) return
  if (auth.usuario?.bloqemp === 'S') return limparCliente()
  if (await sucataEmAberto(c.clifor, c.empresa)) {
    limparCliente()
    await avisar({ title: 'Cliente bloqueado', message: 'Cliente com retorno de sucata em aberto, pedido bloqueado.' })
  }
}

const situacaoDoCliente = (tipo: string) => situacaoTitulos(tituloAtrasado.value, auth.usuario ?? {}, tipo)

const avisoAvista = () => avisar({
  title: 'Condição não permitida',
  message: `${msgVencidos(auth.usuario?.dias)} Só é permitida condição à vista.`,
})

async function trocarCondicao() {
  const c = store.cabecalho
  if (situacaoDoCliente(c.tipo) !== 'somente-avista' || isCondAvista(condicoes.value, c.condpag)) return
  c.condpag = ''
  await avisoAvista()
}

// Entrada ignora títulos vencidos; ao sair dela a regra volta a valer.
async function trocarTipo(tipo: string) {
  const c = store.cabecalho
  const anterior = c.tipo
  c.tipo = tipo
  if (!aberto.value) return
  const s = situacaoDoCliente(tipo)
  if (s === 'bloqueado') {
    if (travado.value) c.tipo = anterior
    else limparCliente()
    await avisar({ title: 'Cliente bloqueado', message: msgVencidos(auth.usuario?.dias) })
  } else if (s === 'somente-avista' && c.condpag && !isCondAvista(condicoes.value, c.condpag)) {
    if (travado.value) c.tipo = anterior
    else c.condpag = ''
    await avisoAvista()
  }
}

function semCredito(): boolean {
  const u = auth.usuario
  const c = store.cabecalho
  const excede = ultrapassaCredito(cliente, total.value, {
    limcred: u?.limcred, libera: u?.libera, tipo: c.tipo, avista: isCondAvista(condicoes.value, c.condpag),
  })
  if (excede) notify('Pedido Ultrapassa o Limite de Crédito Disponível', 'error')
  return excede
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
  await criarPedido()
  return store.cabecalho.numpedido
}

async function criarOuAvisar(): Promise<string | null> {
  try {
    return await ensureNumpedido()
  } catch (e) {
    notify(msg(e), 'error')
    return null
  }
}

async function criarPedido() {
  await exigirProdutosSincronizados()
  await store.salvar()
}

async function persistTotal() {
  if (store.cabecalho.numpedido && store.pedstatus === 'A') {
    await store.salvar()
  }
}

async function atualizarPedido() {
  await refreshItens()
  await persistTotal()
  await refreshParcelas()
}

function assertAberto(): boolean {
  if (store.pedstatus !== 'A') {
    notify('Desconto e Acréscimo só podem ser aplicados em pedido Aberto.')
    return false
  }
  return true
}

// --- Incluir (produtos) ---
const prodCampo = ref('descricao')
const prodBusca = ref('')
const prodGrupo = ref('')
const produtos = ref<any[]>([])
const prodSearched = ref(false)
const prodPage = ref(0)
const PROD_LIMIT = 30
let prodRequest = 0

function unidadesProduto(codigo: unknown): string[] {
  return [...new Set(
    store.fatores
      .filter((f) => String(f[0]) === String(codigo))
      .map((f) => f[1])
      .filter(Boolean),
  )]
}

function unidadeOptions(codigo: unknown) {
  return [
    { value: '', label: 'Padrão' },
    ...unidadesProduto(codigo).map((unidade) => ({ value: unidade, label: unidade })),
  ]
}

function limparProdutos() {
  // Invalida também uma consulta que ainda esteja em andamento.
  prodRequest += 1
  produtos.value = []
  prodSearched.value = false
  prodPage.value = 0
}

function itemDoProduto(p: any) {
  return itens.value.find((i) => String(i.codproduto) === String(p.codigo) && String(i.tabela) === String(p.tabela))
}

function verObservacao(p: any) {
  return avisar({ title: p.descvis || p.descricao, message: textoObservacao(p.observacao) })
}

async function avisarMinimo(r: ItemGravado) {
  if (r.abaixoMinimo) await avisar({ title: 'Atenção', message: 'Produto está sendo vendido abaixo do Valor Mínimo.' })
}

async function buscarProdutos(reset = true) {
  if (!store.cabecalho.tabela) {
    limparProdutos()
    notify('Selecione uma Tabela de Preço.')
    return
  }
  const request = ++prodRequest
  const tabela = store.cabecalho.tabela
  if (reset) {
    prodPage.value = 0
    produtos.value = []
  }
  const rows = await buscarProdutosPedido({
    col: prodCampo.value,
    termo: prodBusca.value,
    grupo: prodGrupo.value,
    empresa: store.cabecalho.empresa,
    local: store.cabecalho.local,
    tabela,
    limit: PROD_LIMIT,
    offset: prodPage.value * PROD_LIMIT,
  })
  // Uma troca de tabela pode acontecer antes de a consulta anterior terminar.
  if (request !== prodRequest || String(tabela) !== String(store.cabecalho.tabela)) return
  rows.forEach((r) => {
    const item = itemDoProduto(r)
    r.qtd = item?.qtd ?? 1
    r.unidade = item?.unidade ?? ''
  })
  produtos.value = reset ? rows : produtos.value.concat(rows)
  prodSearched.value = true
}

async function maisProdutos() {
  prodPage.value += 1
  await buscarProdutos(false)
}

watch(
  () => store.cabecalho.tabela,
  (tabela, anterior) => {
    if (String(tabela ?? '') === String(anterior ?? '')) return
    limparProdutos()
  },
)

watch(step, (atual, anterior) => {
  if (atual >= 2) void refreshParcelas()
  if (atual === 1 && anterior !== 1 && store.cabecalho.tabela) void buscarProdutos()
})

async function quickAdd(p: any) {
  if (semCredito()) return
  const n = await criarOuAvisar()
  if (!n) return
  try {
    const gravado = await incluirItem({
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
    await atualizarPedido()
    notify(`${p.descvis || p.descricao} adicionado`, 'success')
    await avisarMinimo(gravado)
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
  desconto: null as number | null,
  descper: 'N',
  unitario: null as number | null,
})

const modalFator = computed(() => getfator(store.fatores, modal.codproduto, modal.unidade))
const modalUnidades = computed(() => unidadesProduto(modal.codproduto))
const modalPreview = computed(() =>
  calcPreco({
    venda: modal.venda,
    maximo: modal.maximo,
    minimo: modal.minimo,
    unitario: Number(modal.unitario) || 0,
    descinc: Number(modal.descinc) || 0,
    quantidade: Number(modal.quantidade) || 0,
    fator: modalFator.value,
    desconto: Number(modal.desconto) || 0,
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
  modal.quantidade = Number(p.qtd) || 1
  modal.unitario = modal.venda
  modal.unidade = p.unidade ?? ''
  modal.descinc = 0
  modal.desconto = null
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
  modal.unidade = unidadesProduto(row.codproduto).includes(row.unidade) ? row.unidade : ''
  modal.unitario = Number(row.vlunit) / (Number(row.fator) || 1)
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

// O desconto incluso define o unitário; sem ele, volta a valer o preço de tabela.
watch(
  () => Number(modal.descinc) || 0,
  (atual, anterior) => {
    if (!modal.open) return
    if (atual > 0) modal.unitario = round(modal.venda - round(modal.venda * (atual / 100), 2), 2)
    else if (anterior > 0) modal.unitario = modal.venda
  },
)

const historico = reactive({ open: false, doCliente: false, rows: [] as HistoricoProduto[] })

async function abrirHistorico(doCliente: boolean) {
  if (doCliente && !store.cabecalho.clifor) {
    notify('Selecione um Cliente.')
    return
  }
  try {
    historico.rows = await historicoProduto(modal.codproduto, doCliente ? store.cabecalho.clifor : undefined)
    historico.doCliente = doCliente
    historico.open = true
  } catch (e) {
    notify(msg(e), 'error')
  }
}

async function gravarModal() {
  if (semCredito()) return
  const n = await criarOuAvisar()
  if (!n) return
  try {
    const gravado = await gravarItem({
      numpedido: n,
      codproduto: modal.codproduto,
      quantidade: Number(modal.quantidade) || 0,
      venda: modal.venda,
      maximo: modal.maximo,
      minimo: modal.minimo,
      unitario: Number(modal.unitario) || 0,
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
    await atualizarPedido()
    notify('Item salvo', 'success')
    await avisarMinimo(gravado)
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
  await atualizarPedido()
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
    await atualizarPedido()
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
    await atualizarPedido()
  } catch (e) {
    notify(msg(e), 'error')
  }
}

// --- Financeiro ---
const fin = reactive({ cobranca: '', condicao: '' as string | number, valor: null as number | null, autorizacao: '' })
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
  fin.valor = r.remaining > 0 ? r.remaining : null
}

async function gravarParcela() {
  const n = await criarOuAvisar()
  if (!n) return
  if (situacaoDoCliente(store.cabecalho.tipo) === 'somente-avista' && fin.condicao && !isCondAvista(condicoes.value, fin.condicao)) {
    await avisoAvista()
    return
  }
  try {
    await incluirParcela(n, fin.cobranca, fin.condicao, Number(fin.valor) || 0, fin.autorizacao, total.value)
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
const acrescimo = reactive({ vlquilo: null as number | null, vlunidade: null as number | null })
const snquilo = ref(false)
const snunidade = ref(false)
// Um ou outro.
watch(snquilo, (v) => {
  if (v) {
    snunidade.value = false
    acrescimo.vlunidade = null
  } else acrescimo.vlquilo = null
})
watch(snunidade, (v) => {
  if (v) {
    snquilo.value = false
    acrescimo.vlquilo = null
  } else acrescimo.vlunidade = null
})

function preloadNegociacao() {
  const c = store.cabecalho
  acrescimo.vlquilo = c.valor_quilo ?? null
  acrescimo.vlunidade = c.valor_unidade ?? null
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
    await atualizarPedido()
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
    await atualizarPedido()
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

/** Devolve `true` se o pedido foi finalizado. */
async function finalizarPedido(): Promise<boolean> {
  try {
    const n = await ensureNumpedido()
    if (!n) return false
    if (store.pedstatus !== 'A') {
      notify('Pedido não está aberto.')
      return false
    }
    const cabecalhoInvalido = validarCabecalho()
    if (cabecalhoInvalido) {
      notify(cabecalhoInvalido)
      return false
    }

    const mped = await query<any>('SELECT idpedido FROM mped WHERE numpedido = ?', [n])
    if (mped.length === 0) {
      notify('Pedido sem Itens, Impossível Finalizar.')
      return false
    }
    // Pedido com condição inativa nunca seria enviado na sincronização.
    if (!condicoes.value.some((c) => String(c.codigo) === String(store.cabecalho.condpag))) {
      notify('Condição de Pagamento Inativa, escolha outra.')
      return false
    }
    if (semCredito()) return false

    const cli = store.cabecalho.clifor
    const [condCliente, cobCliente] = await Promise.all([
      query<{ condicao: string | number }>('SELECT condicao FROM condicao_cliente WHERE cliente = ?', [cli]),
      query<{ cobranca: string }>('SELECT cobranca FROM cobranca_cliente WHERE cliente = ?', [cli]),
    ])
    const finResult = await validarFinanceiro(
      n,
      total.value,
      auth.usuario?.finped === 'S',
      condCliente.map((r) => r.condicao),
      cobCliente.map((r) => r.cobranca),
    )
    if (!finResult.ok) {
      notify(String(finResult.msg))
      return false
    }

    await store.salvar()
    await finalizar(n, {
      cEstoque: store.cabecalho.estoque,
      empresa: store.cabecalho.empresa,
      local: store.cabecalho.local,
    })
    store.pedstatus = 'F'
    store.cabecalho.status = 'F'
    await refreshItens()
    notify('Pedido finalizado', 'success')
    return true
  } catch (e) {
    notify(msg(e), 'error')
    return false
  }
}

// A NF-e depende do pedido sincronizado: aberto ou finalizado, é finalizado e enviado
// antes. Depois recarrega para refletir sefaz/arquivo/status devolvidos.
async function nfe() {
  const n = store.cabecalho.numpedido
  try {
    if (danfeEmitida(situacao.value)) {
      if (!(await abrirDanfe(store.cabecalho.file))) notify('Pedido emitido com sucesso', 'success')
      return
    }
    await exigirServidorLivre()
    if (store.pedstatus === 'A' || store.pedstatus === 'F') {
      const ok = await confirmar({
        title: 'Emitir a NF-e agora?',
        message: `O pedido ${n} será ${store.pedstatus === 'A' ? 'finalizado, ' : ''}enviado ao servidor e a nota será emitida.`,
        confirmLabel: 'Emitir NF-e',
      })
      if (!ok) return
      if (store.pedstatus === 'A' && !(await finalizarPedido())) return
      await pushClientes()
      await pushPedidos(n)
      await recarregarSituacao(n)
      if (!enviado()) {
        notify('O servidor ainda não confirmou o pedido. Sincronize e tente de novo.', 'error')
        return
      }
    }
    const comDanfe = await emitirNfe(n, store.cabecalho.lancto ?? 0)
    await recarregarSituacao(n)
    if (!comDanfe) notify('Pedido emitido com sucesso', 'success')
  } catch (e) {
    notify(msg(e), 'error')
    if (n) await recarregarSituacao(n)
  }
}

const enviado = () => ['S', 'Z'].includes(store.pedstatus)

async function recarregarSituacao(n: string) {
  await store.carregar(n)
  await refreshItens()
}

async function boleto() {
  try {
    await emitirBoleto(store.cabecalho.lancto ?? 0)
  } catch (e) {
    notify(msg(e), 'error')
  }
}

async function imprimirPeloErp() {
  try {
    await imprimirErp(store.cabecalho.lancto ?? 0)
  } catch (e) {
    notify(msg(e), 'error')
  }
}

async function reenviar() {
  try {
    await store.reenviar()
    notify(`Pedido ${store.cabecalho.numpedido} pronto para ser reenviado.`, 'success')
  } catch (e) {
    notify(msg(e), 'error')
  }
}

function acao(fn: () => unknown) {
  showAcoes.value = false
  fn()
}

// Ações que não se aplicam à situação do pedido aparecem desabilitadas, com o motivo.
const situacao = computed<PedidoSituacao>(() => ({
  status: store.pedstatus,
  itens: itens.value.length,
  tipo: store.cabecalho.tipo,
  lancto: store.cabecalho.lancto,
  sefaz: store.cabecalho.sefaz,
  file: store.cabecalho.file,
}))
const motivoFinal = computed(() => motivoFinalizar(situacao.value))
const motivoImpressao = computed(() => motivoImprimir(situacao.value))
const acoes = computed(() => {
  const s = situacao.value
  return [
    { label: danfeEmitida(s) ? 'Ver DANFE' : 'Emitir NF-e', icon: 'file', fn: nfe, motivo: motivoNfePedido(s) },
    { label: 'Gerar boleto', icon: 'barcode', fn: boleto, motivo: motivoBoleto(s) },
    { label: 'Gerar termo', icon: 'receipt', fn: gerarTermo, motivo: motivoBoleto(s) },
    { label: 'Imprimir pelo ERP', icon: 'printer', fn: imprimirPeloErp, motivo: motivoBoleto(s) },
    ...(s.status === 'V' ? [{ label: 'Reenviar pedido', icon: 'send', fn: reenviar, motivo: motivoReenviar(s) }] : []),
    { label: 'Reabrir pedido', icon: 'undo', fn: reabrir, motivo: motivoReabrir(s) },
    ...(s.tipo === 'O' ? [{ label: 'Transformar orçamento em pedido', icon: 'orders', fn: transformar, motivo: motivoTransformar(s) }] : []),
    { label: 'Duplicar pedido', icon: 'copy', fn: duplicar, motivo: motivoDuplicar(s) },
    { label: 'Cancelar pedido', icon: 'ban', fn: cancelarPedido, motivo: motivoCancelar(s), danger: true },
  ]
})

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
    await salvarEtapa(3)
    await router.push(`/pedidos/${store.cabecalho.numpedido}`)
    await refreshItens()
    await refreshParcelas()
    step.value = 3
    notify(`Pedido duplicado como ${store.cabecalho.numpedido}`, 'success')
  } catch (e) {
    notify(msg(e), 'error')
  }
}

let listenerVoltarAndroid: ReturnType<typeof App.addListener> | undefined

onMounted(() => {
  if (Capacitor.getPlatform() !== 'android') return
  listenerVoltarAndroid = App.addListener('backButton', async ({ canGoBack }) => {
    if (mudandoEtapa) return
    if (step.value > 0) {
      const etapaAnterior = step.value - 1
      await goTo(etapaAnterior)
      if (step.value === etapaAnterior) {
        showAcoes.value = false
        modal.open = false
      }
      return
    }
    if (canGoBack) router.back()
    else await router.push({ name: auth.homeRoute })
  })
  void listenerVoltarAndroid.catch((e) => console.error('Falha ao ouvir o botão Voltar do Android', e))
})

onBeforeUnmount(() => {
  void listenerVoltarAndroid?.then(
    (listener) => listener.remove().catch((e) => console.error('Falha ao remover o listener do Android', e)),
    () => {},
  )
})

onMounted(async () => {
  ;[empresas.value, vendedores.value, condicoes.value, tabelas.value, cargas.value, comissoes.value, grupos.value] =
    await Promise.all([
      query<any>('SELECT * FROM empresas'),
      query<any>('SELECT * FROM vendedores'),
      query<any>("SELECT * FROM condicao WHERE inativo = 'N'"),
      query<any>('SELECT * FROM tpreco'),
      query<any>("SELECT * FROM carga WHERE inativo = 'N'"),
      query<any>('SELECT * FROM comissao'),
      query<any>('SELECT codigo, descricao FROM grupos ORDER BY descricao'),
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
  prodGrupo.value = ''
  Object.assign(cliente, { id: 0, codigo: 0, fantasia: '', razao: '', cnpj: '', limcred: 0, credito: 0, saldo: 0 })
  limparProdutos()
  prodView.value = 'buscar'
  tituloAtrasado.value = null
  if (n) await store.carregar(n)
  else await store.novo()
  // Novo só consome a liberação ao ser gravado; retomar um pedido aberto, já ao abrir.
  if (!n || store.pedstatus === 'A') {
    try {
      await exigirProdutosSincronizados({ consumir: !!n })
    } catch (e) {
      await router.replace({ name: 'sync' })
      await avisar({ title: 'Sincronize os produtos', message: msg(e) })
      return
    }
  }
  await carregarCliente()
  if (!store.cabecalho.data) store.cabecalho.data = today()
  if (!store.cabecalho.tipo) store.cabecalho.tipo = 'S'
  preloadNegociacao()
  await refreshItens()
  await refreshParcelas()
  const etapa = store.cabecalho.etapa
  if (!n) {
    step.value = 0
    return
  }
  const etapaSalva = typeof etapa === 'number' && Number.isInteger(etapa) && etapa >= 0 && etapa < STEPS.length
  const etapaInicial = etapaSalva ? etapa : store.pedstatus === 'A' && itens.value.length === 0 ? 1 : 3
  if (step.value === 1 && etapaInicial === 1 && store.cabecalho.tabela) void buscarProdutos()
  step.value = etapaInicial
  if (!etapaSalva) {
    try {
      await salvarEtapa(etapaInicial)
    } catch (e) {
      notify(msg(e), 'error')
    }
  }
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
      class="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 bg-cream/95 backdrop-blur-md border-b border-ink-200 px-4 pt-2 pb-3"
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
            <span class="block h-1 rounded-full" :class="i === step ? 'bg-accent-500' : i < step ? 'bg-brand-600' : 'bg-ink-200'" />
            <span
              class="mt-1.5 flex items-center gap-1 text-xs whitespace-nowrap"
              :class="step === i ? 'font-semibold text-brand-600' : i < step ? 'text-ink-700' : 'text-ink-500'"
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
          <p class="meta mt-1">{{ isEdit ? 'Confira os dados do pedido.' : 'As condições vêm do último pedido e se ajustam ao cliente escolhido. Confira antes de continuar.' }}</p>
        </div>

        <section class="panel p-4 space-y-4">
          <button type="button" class="input text-left flex items-center gap-3 py-3" data-campo="cliente" :disabled="travado" @click="abrirCliente">
            <span class="h-10 w-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <Icon name="users" />
            </span>
            <span class="min-w-0 flex-1">
              <span v-if="cliente.codigo" class="block font-semibold truncate">{{ cliente.fantasia || cliente.razao }}</span>
              <span v-else class="block text-ink-400">Selecionar cliente</span>
              <span v-if="cliente.codigo" class="block meta truncate">Crédito disponível R$ {{ formatReal(credito) }}</span>
            </span>
            <span class="link">{{ cliente.codigo ? 'Trocar' : 'Escolher' }}</span>
          </button>
          <template v-if="cliente.codigo">
            <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div><dt class="meta text-xs">Código</dt><dd class="font-medium tabular-nums">{{ cliente.codigo }}</dd></div>
              <div><dt class="meta text-xs">CNPJ/CPF</dt><dd class="font-medium tabular-nums">{{ cliente.cnpj || '—' }}</dd></div>
              <div><dt class="meta text-xs">Limite de crédito</dt><dd class="font-medium tabular-nums">R$ {{ formatReal(cliente.limcred) }}</dd></div>
              <div><dt class="meta text-xs">Saldo retorno sucata</dt><dd class="font-medium tabular-nums">{{ formatNumero(cliente.saldo) }}</dd></div>
            </dl>
            <div class="grid grid-cols-2 gap-2">
              <button type="button" class="btn btn-tonal btn-sm" @click="abrirSucata">Saldo de sucata</button>
              <button type="button" class="btn btn-tonal btn-sm" @click="abrirSaldos">Saldos do cliente</button>
            </div>
            <div v-if="consumidor" class="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
              <label class="block">
                <span class="label">Nome do consumidor</span>
                <input v-model="store.cabecalho.cliente_nome" type="text" maxlength="60" class="input" :disabled="travado" />
              </label>
              <label class="block">
                <span class="label">CPF</span>
                <input v-model="store.cabecalho.cliente_cpf" type="text" inputmode="numeric" maxlength="20" class="input" :disabled="travado" />
              </label>
            </div>
          </template>
        </section>

        <section class="panel p-4 space-y-4">
          <div>
            <span class="label">Tipo</span>
            <Segmented
              :model-value="store.cabecalho.tipo"
              @update:model-value="trocarTipo"
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
            <SelectField v-model="store.cabecalho.empresa" :options="empresas.map((e) => ({ value: e.empresa, label: e.fantasia }))" title="Selecionar empresa" placeholder="Selecione a empresa" data-campo="empresa" :disabled="travado" @change="trocarEmpresa" />
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
          <p v-if="travado && aberto" class="meta">Empresa, cliente e condição não mudam enquanto houver itens no pedido.</p>
          <label class="block">
            <span class="label">Condição de pagamento</span>
            <SelectField v-model="store.cabecalho.condpag" :options="opcoes.condicoes.map((c) => ({ value: c.codigo, label: c.descr }))" title="Selecionar condição de pagamento" placeholder="Selecione a condição" data-campo="condicao" :disabled="travado" @change="trocarCondicao" />
          </label>
          <label class="block">
            <span class="label">Tabela de preço</span>
            <SelectField v-model="store.cabecalho.tabela" :options="opcoes.tabelas.map((t) => ({ value: t.codigo, label: t.descricao }))" title="Selecionar tabela de preço" placeholder="Selecione a tabela" />
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
            <SelectField
              v-if="grupos.length"
              v-model="prodGrupo"
              :options="[{ value: '', label: 'Todos os grupos' }, ...grupos.map((g) => ({ value: String(g.codigo), label: g.descricao }))]"
              title="Selecionar grupo"
              prefix="Grupo:"
              size="sm"
              aria-label="Grupo"
              @change="buscarProdutos()"
            />
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
                  <p class="meta tabular-nums mt-0.5">Cód. {{ p.codigo }}, estoque {{ formatNumero(p.estoque) }}</p>
                  <p class="meta tabular-nums mt-0.5">Mínimo R$ {{ formatReal(p.minimo) }}, Comprado {{ formatNumero(p.comprado) }}</p>
                  <span v-if="itemDoProduto(p)" class="mt-1.5 inline-flex items-center gap-1 h-5 rounded-full bg-success-50 pl-1.5 pr-2 text-[11px] font-semibold text-success-800">
                    <Icon name="check" :size="12" :stroke="2.6" /> Já adicionado
                  </span>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <p class="text-[15px] font-semibold tabular-nums">R$ {{ formatReal(p.venda) }}</p>
                  <button v-if="p.observacao" type="button" class="icon-btn" :aria-label="`Ver observação de ${p.descvis}`" @click="verObservacao(p)">
                    <Icon name="info" :size="18" />
                  </button>
                </div>
              </div>
              <div class="flex items-center gap-2 mt-3">
                <label class="w-20">
                  <span class="sr-only">Quantidade</span>
                  <input v-model="p.qtd" type="number" inputmode="decimal" min="0" class="input min-h-10 py-1.5 text-center" placeholder="Qtd" />
                </label>
                <SelectField
                  v-if="unidadesProduto(p.codigo).length > 0"
                  v-model="p.unidade"
                  class="w-24 shrink-0"
                  size="sm"
                  :options="unidadeOptions(p.codigo)"
                  :title="`Selecionar unidade de ${p.descvis || p.descricao}`"
                  aria-label="Unidade"
                />
                <button class="btn btn-primary btn-sm min-h-10 flex-1" :disabled="!aberto" @click="quickAdd(p)">
                  <Icon :name="itemDoProduto(p) ? 'check' : 'plus'" :size="16" /> {{ itemDoProduto(p) ? 'Atualizar' : 'Adicionar' }}
                </button>
                <button class="icon-btn border border-ink-200" aria-label="Ajustar preço e desconto" :disabled="!aberto" @click="itemDoProduto(p) ? abrirModalItem(itemDoProduto(p)) : abrirModalProduto(p)">
                  <Icon name="edit" :size="18" />
                </button>
                <button
                  v-if="itemDoProduto(p)"
                  class="icon-btn border border-ink-200 text-danger-600"
                  :aria-label="`Excluir ${p.descvis} do pedido`"
                  :disabled="!aberto"
                  @click="removerItem(itemDoProduto(p))"
                >
                  <Icon name="trash" :size="18" />
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
                <p v-if="descontoLabel(i) !== '—'" class="text-xs text-brand-600 font-medium mt-0.5">Desconto {{ descontoLabel(i) }}</p>
              </div>
              <p class="text-[15px] font-semibold tabular-nums shrink-0 pt-px">R$ {{ formatReal(i.vltotal) }}</p>
              <div class="flex shrink-0 -mt-1">
                <button class="icon-btn" :aria-label="`Editar ${i.descricao}`" :disabled="!aberto" @click="abrirModalItem(i)">
                  <Icon name="edit" :size="18" />
                </button>
                <button class="icon-btn text-danger-600" :aria-label="`Excluir ${i.descricao}`" :disabled="!aberto" @click="removerItem(i)">
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
              <p class="meta mt-0.5">{{ finObrigatorio ? 'Distribua o total entre as cobranças.' : 'Opcional. Se informar, a soma deve ser igual ao total do pedido.' }}</p>
            </div>
            <p v-if="exigeDistribuir" class="text-right shrink-0">
              <span class="block meta text-xs">{{ faltaLabel }}</span>
              <span class="font-semibold tabular-nums" :class="pagamentoOk ? 'text-success-600' : 'text-sun-800'">R$ {{ formatReal(Math.abs(remaining)) }}</span>
            </p>
          </div>
          <ul v-if="parcelas.length" class="divide-y divide-ink-100 border-y border-ink-100 -mx-4">
            <li v-for="pa in parcelas" :key="pa.idfinanceiro" class="flex items-center gap-3 pl-4 pr-2 py-3">
              <div class="min-w-0 flex-1">
                <p class="text-[15px] font-medium truncate">{{ pa.cobdesc || pa.cobranca }}</p>
                <p class="meta truncate">{{ pa.condesc || pa.condicao }}{{ pa.autorizacao ? `, autorização ${pa.autorizacao}` : '' }}</p>
              </div>
              <span class="text-[15px] font-semibold tabular-nums">R$ {{ formatReal(pa.valor) }}</span>
              <button class="icon-btn text-danger-600" aria-label="Excluir parcela" :disabled="!aberto" @click="removerParcela(pa.idfinanceiro)">
                <Icon name="trash" :size="18" />
              </button>
            </li>
          </ul>
          <div class="grid grid-cols-2 gap-3">
            <label class="block col-span-2">
              <span class="label">Cobrança</span>
              <SelectField v-model="fin.cobranca" data-campo="cobranca-parcela" :options="opcoes.cobrancas.map((c) => ({ value: c.codigo, label: c.descr }))" title="Selecionar cobrança" placeholder="Selecione a cobrança" />
            </label>
            <label class="block col-span-2">
              <span class="label">Condição</span>
              <SelectField v-model="fin.condicao" data-campo="condicao-parcela" :options="opcoes.condicoes.map((c) => ({ value: c.codigo, label: c.descr }))" title="Selecionar condição" placeholder="Selecione a condição" />
            </label>
            <label class="block">
              <span class="label">Valor</span>
              <MoneyInput v-model="fin.valor" data-campo="parcela" :placeholder="`R$ ${formatReal(remaining)}`" />
            </label>
            <label class="block">
              <span class="label">Autorização</span>
              <input v-model="fin.autorizacao" type="text" class="input" />
            </label>
          </div>
          <button class="btn btn-tonal w-full" :disabled="!aberto" @click="gravarParcela">
            <Icon name="plus" :size="18" /> Adicionar parcela
          </button>
        </section>

        <section class="panel p-4 space-y-4">
          <div>
            <h2 class="section-title">Desconto no pedido</h2>
            <p class="meta mt-0.5">{{ descontoModo === 'percent' ? 'Aplicado a todos os itens.' : 'Valor total, dividido igualmente entre os itens.' }} Só vale para pedido aberto.</p>
          </div>
          <Segmented
            v-model="descontoModo"
            :options="[{ value: 'percent', label: 'Percentual (%)' }, { value: 'reais', label: 'Valor (R$)' }]"
            label="Tipo de desconto"
          />
          <label class="block">
            <span class="sr-only">{{ descontoModo === 'percent' ? 'Desconto em %' : 'Desconto total em R$' }}</span>
            <MoneyInput v-if="descontoModo === 'reais'" v-model="descontoValor" data-campo="desconto-pedido" />
            <input v-else v-model.number="descontoValor" data-campo="desconto-pedido" type="number" inputmode="decimal" min="0" class="input" placeholder="0,00" />
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
            <MoneyInput v-model="acrescimo.vlquilo" data-campo="vlquilo" />
          </label>
          <label class="flex items-center justify-between gap-3">
            <span class="text-[15px]">Por unidade</span>
            <input v-model="snunidade" type="checkbox" class="switch" />
          </label>
          <label v-if="snunidade" class="block">
            <span class="label">Valor por unidade (R$)</span>
            <MoneyInput v-model="acrescimo.vlunidade" data-campo="vlunidade" />
          </label>
          <div class="grid grid-cols-2 gap-2">
            <button class="btn btn-secondary" :disabled="!aberto" @click="removerAcrescimo">Remover</button>
            <button class="btn btn-primary" :disabled="!aberto" @click="aplicarAcrescimoPedido">Aplicar</button>
          </div>
        </section>

        <section class="panel p-4 space-y-4">
          <h2 class="section-title">Frete, peso e sucata</h2>
          <p class="flex items-baseline justify-between gap-3 text-[15px]">
            <span class="text-ink-500">Peso do pedido</span>
            <span class="font-semibold tabular-nums">{{ formatNumero(pesoPedido) }} kg</span>
          </p>
          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <span class="label">Frete embutido (R$)</span>
              <MoneyInput v-model="store.cabecalho.valor_frete" data-campo="frete" />
            </label>
            <label class="block">
              <span class="label">Retorno sucata (kg)</span>
              <input v-model="store.cabecalho.retsuc" type="number" inputmode="decimal" min="0" step="0.01" class="input" placeholder="0,00" />
            </label>
          </div>
          <label class="flex items-center justify-between gap-3">
            <span class="text-[15px] font-medium">Resolvido</span>
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
            {{ formatNumero(pesoPedido) }} kg, flex R$ {{ formatReal(flexPedido) }} (saldo R$ {{ formatReal(saldoFlex) }})
          </p>
        </div>

        <section class="panel overflow-hidden" aria-labelledby="revisao-cliente">
          <div class="p-4">
            <div class="flex items-baseline justify-between gap-3">
              <h2 id="revisao-cliente" class="section-title">Cliente</h2>
              <button type="button" class="link" aria-label="Editar cliente e condições" @click="goTo(0)">Editar</button>
            </div>
            <div class="mt-3 flex items-start gap-3">
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600" aria-hidden="true">
                <Icon name="users" />
              </span>
              <div class="min-w-0">
                <p class="break-words text-base font-semibold leading-snug">{{ clienteRevisao }}</p>
                <p v-if="razaoRevisao && razaoRevisao !== clienteRevisao" class="mt-0.5 break-words text-sm text-ink-700">{{ razaoRevisao }}</p>
              </div>
            </div>
            <dl v-if="cliente.codigo || store.cabecalho.clifor || cliente.cnpj || store.cabecalho.cliente_cpf" class="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div v-if="cliente.codigo || store.cabecalho.clifor">
                <dt class="meta">Código do cliente</dt>
                <dd class="font-medium tabular-nums">{{ cliente.codigo || store.cabecalho.clifor }}</dd>
              </div>
              <div v-if="cliente.cnpj || store.cabecalho.cliente_cpf" class="min-w-0">
                <dt class="meta">CNPJ/CPF</dt>
                <dd class="break-words font-medium tabular-nums">{{ cliente.cnpj || store.cabecalho.cliente_cpf }}</dd>
              </div>
            </dl>
          </div>
          <div class="border-t border-ink-100 p-4">
            <h3 class="section-title">Condições do pedido</h3>
            <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
              <div v-for="campo in condicoesRevisao" :key="campo.label" class="min-w-0">
                <dt class="meta">{{ campo.label }}</dt>
                <dd class="break-words font-medium">{{ campo.valor || '—' }}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section class="panel p-4">
          <div class="flex items-baseline justify-between gap-3 mb-1.5">
            <h2 class="text-[13px] font-medium text-ink-500">Produtos</h2>
            <button class="link" @click="goTo(1)">Editar</button>
          </div>
          <p v-if="itens.length === 0" class="text-sm text-ink-500">Nenhum item.</p>
          <div v-for="i in itens.slice(0, 6)" :key="i.idpedido" class="flex justify-between gap-3 py-1.5 text-sm">
            <span class="min-w-0 truncate">{{ i.qtd }} × {{ i.descricao }}</span>
            <span class="font-semibold tabular-nums shrink-0">R$ {{ formatReal(i.vltotal) }}</span>
          </div>
          <button v-if="itens.length > 6" class="mt-1 link" @click="goTo(1); prodView = 'pedido'">
            Ver mais {{ itens.length - 6 }} {{ itens.length - 6 === 1 ? 'item' : 'itens' }}
          </button>
        </section>

        <section class="panel p-4">
          <div class="flex items-baseline justify-between gap-3 mb-1.5">
            <h2 class="text-[13px] font-medium text-ink-500">Pagamento</h2>
            <button class="link" @click="goTo(2)">Editar</button>
          </div>
          <div v-for="pa in parcelas" :key="pa.idfinanceiro" class="flex justify-between gap-3 py-1.5 text-sm">
            <span class="min-w-0 truncate">{{ pa.cobdesc || pa.cobranca }}, {{ pa.condesc || pa.condicao }}</span>
            <span class="font-semibold tabular-nums shrink-0">R$ {{ formatReal(pa.valor) }}</span>
          </div>
          <p v-if="parcelas.length === 0" class="text-sm text-ink-500">Nenhuma parcela.</p>
          <p
            v-if="exigeDistribuir"
            class="mt-2 flex items-center gap-1.5 text-[13px] font-semibold"
            :class="pagamentoOk ? 'text-success-600' : 'text-sun-800'"
          >
            <Icon :name="pagamentoOk ? 'check' : 'alert'" :size="16" :stroke="2.2" />
            {{ pagamentoOk ? 'Total distribuído' : `${faltaLabel} R$ ${formatReal(Math.abs(remaining))}` }}
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
      <div v-else class="space-y-2.5">
        <p v-if="aberto && motivoFinal" class="meta text-center">{{ motivoFinal }}</p>
        <div class="flex gap-2">
          <button class="btn btn-secondary px-3.5" aria-label="Mais ações" @click="showAcoes = true">
            <Icon name="more" :size="22" />
          </button>
          <button class="btn btn-secondary" :disabled="!!motivoImpressao" @click="imprimir">
            <Icon name="printer" /> Imprimir
          </button>
          <button class="btn btn-primary flex-1" :disabled="!!motivoFinal" @click="finalizarPedido">
            <Icon name="check" /> Finalizar
          </button>
        </div>
      </div>
    </template>

    <Sheet :open="showAcoes" title="Ações do pedido" :subtitle="titulo" @close="showAcoes = false">
      <ul class="-mx-5 divide-y divide-ink-100">
        <li v-for="a in acoes" :key="a.label">
          <button
            class="list-row px-5 flex items-center gap-3"
            :class="a.motivo ? 'text-ink-400' : a.danger ? 'text-danger-700' : ''"
            :disabled="!!a.motivo"
            @click="acao(a.fn)"
          >
            <Icon :name="a.icon" :class="a.motivo ? 'text-ink-300' : a.danger ? '' : 'text-ink-500'" />
            <span class="min-w-0">
              <span class="block">{{ a.label }}</span>
              <span v-if="a.motivo" class="block text-[13px] text-ink-500">{{ a.motivo }}</span>
            </span>
          </button>
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
            <Icon v-if="store.cabecalho.operacao === o.operacao" name="check" class="text-brand-600" :stroke="2.4" />
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
            <Icon v-if="String(store.cabecalho.carga) === String(c.codigo)" name="check" class="text-brand-600" :stroke="2.4" />
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
          <label v-if="modalUnidades.length > 0" class="block">
            <span class="label">Unidade</span>
            <SelectField
              v-model="modal.unidade"
              :options="unidadeOptions(modal.codproduto)"
              title="Selecionar unidade"
            />
          </label>
          <label class="block">
            <span class="label">Valor unitário</span>
            <MoneyInput v-model="modal.unitario" data-campo="unitario" :disabled="!aberto || Number(modal.descinc) > 0" />
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
            <MoneyInput v-if="modal.descper !== 'S'" v-model="modal.desconto" data-campo="desconto-item" aria-label="Valor do desconto" />
            <input v-else v-model.number="modal.desconto" data-campo="desconto-item" type="number" inputmode="decimal" min="0" class="input" aria-label="Valor do desconto" />
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
        <p class="meta tabular-nums">Mínimo R$ {{ formatReal(modal.minimo * modalFator) }}, máximo R$ {{ formatReal(modal.maximo * modalFator) }}</p>

        <div>
          <span class="label">Histórico de venda</span>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" class="btn btn-tonal btn-sm" @click="abrirHistorico(false)">Do produto</button>
            <button type="button" class="btn btn-tonal btn-sm" @click="abrirHistorico(true)">Deste cliente</button>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-primary w-full" :disabled="!aberto" @click="gravarModal">Salvar item</button>
      </template>
    </Sheet>

    <Sheet
      :open="historico.open"
      title="Histórico de venda"
      :subtitle="historico.doCliente ? `${modal.descricao}, ${cliente.fantasia}` : modal.descricao"
      size="tall"
      @close="historico.open = false"
    >
      <EmptyState v-if="historico.rows.length === 0" icon="chart" label="Nenhuma venda encontrada" />
      <ul v-else class="divide-y divide-ink-100 -mx-5">
        <li v-for="(h, i) in historico.rows" :key="i" class="flex items-start justify-between gap-3 px-5 py-3">
          <div class="min-w-0">
            <p class="text-[15px] font-medium tabular-nums">Nº {{ h.pedido }}, {{ mudadata(h.data) }}</p>
            <p class="meta truncate">{{ [h.condicao, h.tabela && `Tabela ${h.tabela}`].filter(Boolean).join(', ') }}</p>
          </div>
          <p class="text-[15px] font-semibold tabular-nums shrink-0">{{ formatNumero(h.quant) }} × R$ {{ formatReal(h.vlunit) }}</p>
        </li>
      </ul>
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
