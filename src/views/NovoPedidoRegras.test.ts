import { createPinia, setActivePinia } from 'pinia'
import { createApp, nextTick, type App } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { abrirBanco, inserir, query } from '../test/sqlite'
import { useConfirm } from '../composables/useConfirm'
import { useAuthStore } from '../stores/auth'
import { usePedidoStore } from '../stores/pedido'
import NovoPedidoView from './NovoPedidoView.vue'

const rota = vi.hoisted(() => ({ name: 'pedido-novo', params: {} as Record<string, string> }))
const router = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: () => rota, useRouter: () => router }))
vi.mock('../components/Sidebar.vue', () => ({ default: { render: () => null } }))
vi.mock('../db/connection', () => import('../test/sqlite'))
const servidor = vi.hoisted(() => ({
  emitirNfe: vi.fn(), pushClientes: vi.fn(), pushPedidos: vi.fn(), exigirServidorLivre: vi.fn(),
}))
vi.mock('../services/sync/fiscal', () => ({ emitirNfe: servidor.emitirNfe, emitirBoleto: vi.fn(), abrirDanfe: vi.fn() }))
vi.mock('../services/sync/clientes', () => ({ pushClientes: servidor.pushClientes }))
vi.mock('../services/sync/pedidos', () => ({ pushPedidos: servidor.pushPedidos }))
vi.mock('../services/sync/gate', () => ({ exigirServidorLivre: servidor.exigirServidorLivre }))
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn() } }))

const { state: dialogo, responder } = useConfirm()
let app: App
let host: HTMLElement

async function montar(usuario: Record<string, unknown> = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().usuario = { codlic: 3, usuario: 'M', dias: 5, bloqueia: 'S', libera: 'N', bloqemp: 'N', obscli: 'N', limcred: 'N', ...usuario } as any
  host = document.createElement('div')
  document.body.append(host)
  app = createApp(NovoPedidoView).use(pinia)
  app.mount(host)
  await vi.waitFor(() => expect(host.textContent).toContain('Para quem é o pedido?'))
  await vi.waitFor(() => expect(usePedidoStore().cabecalho.data).toBeTruthy())
}

const botao = (texto: string, raiz: ParentNode = document.body) =>
  [...raiz.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(texto))!

async function escolher(nome: string) {
  botao('Selecionar cliente', host).click()
  await vi.waitFor(() => expect(botao(nome)).toBeTruthy())
  botao(nome).click()
}

beforeEach(async () => {
  Object.values(servidor).forEach((f) => f.mockReset())
  rota.name = 'pedido-novo'
  rota.params = {}
  router.replace.mockReset()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  await abrirBanco()
  await inserir('usuario', { usuario: 'M', sincprod: 'N' })
  await inserir('empresas', { empresa: 1, fantasia: 'Matriz' })
  await inserir('condicao', { codigo: 1, descr: 'À vista', avista: 'S', inativo: 'N' })
  await inserir('tpreco', { codigo: 1, descricao: 'Varejo', usa_cliente: 'N' })
  await inserir('tpreco', { codigo: 9, descricao: 'Exclusiva', usa_cliente: 'S' })
  await inserir('comissao', { codigo: 4, descricao: 'Padrão' })
  await inserir('clifor', { codigo: 1, fantasia: 'Alfa', razao: 'Alfa Ltda', cnpj: '12345678901', inativo: 'N', obs: 'Entregar cedo', tabela: 9, comissao: 4, limcred: 1000, credito: 300, saldo: 0 })
  await inserir('tabela_cliente', { cliente: 1, tabela: 9 })
})
afterEach(() => {
  responder(false)
  app?.unmount()
  host?.remove()
  vi.restoreAllMocks()
})

it('escolher o cliente aplica as condições dele e mostra a observação', async () => {
  await montar()
  await escolher('Alfa')
  await vi.waitFor(() => expect(dialogo).toMatchObject({ open: true, aviso: true, message: 'Entregar cedo' }))
  expect(usePedidoStore().cabecalho).toMatchObject({ clifor: 1, tabela: 9, comissao: 4, cliente_nome: 'Alfa' })
  expect(host.textContent).toContain('Crédito disponível R$ 700,00')
  expect(host.textContent).toContain('Exclusiva')
})

it('cliente com títulos vencidos não entra no pedido', async () => {
  await inserir('titulos', { clifor: 1, numero: '1', vencimento: '2020-01-01', empresa: 1, valor: 1 })
  await montar()
  await escolher('Alfa')
  await vi.waitFor(() => expect(dialogo.message).toContain('títulos vencidos'))
  expect(usePedidoStore().cabecalho.clifor).toBeFalsy()
})

it('exige sincronizar produtos antes de digitar', async () => {
  await query("UPDATE usuario SET sincprod = 'S', prodsinc = 'N'")
  const pinia = createPinia()
  setActivePinia(pinia)
  host = document.createElement('div')
  app = createApp(NovoPedidoView).use(pinia)
  app.mount(host)
  await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith({ name: 'sync' }))
})

it('com itens, empresa, cliente e condição ficam travados', async () => {
  await inserir('produtos', { codigo: 'A', descricao: 'Bateria', peso: 12.5, grupo: 'G' })
  await inserir('ped', { numpedido: '0000000001', status: 'A', clifor: 1, empresa: 1, condpag: 1, tabela: 9, data: '2026-11-25', tipo: 'S', etapa: 0, total: 10, cliente_nome: 'Nome digitado', cliente_cpf: '99999999999' })
  await inserir('mped', { numpedido: '0000000001', codproduto: 'A', qtd: 2, vlunit: 5, vltotal: 10, condicao: 1, tabela: 9 })
  rota.name = 'pedido-edit'
  rota.params = { numpedido: '0000000001' }
  await montar()
  await vi.waitFor(() => expect(host.querySelector('[data-campo="cliente"]')?.hasAttribute('disabled')).toBe(true))
  expect(host.querySelector('[data-campo="empresa"]')?.hasAttribute('disabled')).toBe(true)
  expect(host.querySelector('[data-campo="condicao"]')?.hasAttribute('disabled')).toBe(true)
  // Reabrir o pedido não sobrescreve o nome digitado do consumidor.
  expect(usePedidoStore().cabecalho.cliente_nome).toBe('Nome digitado')
})

async function pedidoNaEtapaProdutos() {
  await inserir('produtos', { codigo: 'A', descricao: 'Bateria', peso: 12.5, grupo: 'G', comprado: 7, observacao: 'linha 1;linha 2' })
  await inserir('mvtpreco', { tabela_codigo: 9, produto: 'A', venda: 10, maximo: 20, minimo: 8 })
  await inserir('ped', { numpedido: '0000000001', status: 'A', clifor: 1, empresa: 1, condpag: 1, tabela: 9, carga: 1, operacao: 'V', comissao: 4, data: '2026-11-25', tipo: 'S', etapa: 0, total: 0 })
  rota.name = 'pedido-edit'
  rota.params = { numpedido: '0000000001' }
  await montar()
  botao('Produtos', host).click()
  await vi.waitFor(() => expect(host.textContent).toContain('Bateria'))
}

it('o card do produto traz mínimo, comprado e observação, e marca o que já está no pedido', async () => {
  await pedidoNaEtapaProdutos()
  expect(host.textContent).toContain('Mínimo R$ 8,00')
  expect(host.textContent).toContain('Comprado 7')
  host.querySelector<HTMLButtonElement>('[aria-label="Ver observação de Bateria"]')!.click()
  await nextTick()
  expect(dialogo.message).toBe('linha 1\nlinha 2')
  responder(true)
  botao('Adicionar', host).click()
  await vi.waitFor(() => expect(host.textContent).toContain('Já adicionado'))
})

it('acima do crédito não inclui item', async () => {
  await query('UPDATE clifor SET credito = 1001')
  await pedidoNaEtapaProdutos()
  useAuthStore().usuario!.limcred = 'S'
  botao('Adicionar', host).click()
  await new Promise((r) => setTimeout(r, 30))
  expect(await query('SELECT * FROM mped')).toEqual([])
})

it('o valor unitário digitado vai para o item', async () => {
  await pedidoNaEtapaProdutos()
  host.querySelector<HTMLButtonElement>('[aria-label="Ajustar preço e desconto"]')!.click()
  const campo = await vi.waitFor(() => {
    const el = document.querySelector<HTMLInputElement>('[data-campo="unitario"]')
    expect(el).toBeTruthy()
    return el!
  })
  campo.value = 'R$ 15,00'
  campo.dispatchEvent(new Event('input'))
  await nextTick()
  botao('Salvar item').click()
  await vi.waitFor(async () => expect(await query('SELECT vlunit, vltotal FROM mped')).toEqual([{ vlunit: 15, vltotal: 15 }]))
})

async function emitirPelaTela() {
  await pedidoNaEtapaProdutos()
  botao('Adicionar', host).click()
  await vi.waitFor(() => expect(host.textContent).toContain('Já adicionado'))
  host.querySelector<HTMLButtonElement>('[aria-label="Mais ações"]')!.click()
  await vi.waitFor(() => expect(botao('Emitir NF-e')).toBeTruthy())
  botao('Emitir NF-e').click()
  await vi.waitFor(() => expect(dialogo.title).toBe('Emitir a NF-e agora?'))
}

it('NF-e do pedido aberto finaliza, envia só ele e emite', async () => {
  servidor.emitirNfe.mockResolvedValue(true)
  servidor.pushPedidos.mockImplementation(async () => {
    expect(await query('SELECT status FROM ped')).toEqual([{ status: 'F' }])
    await query("UPDATE ped SET status = 'S', lancto = 55")
  })
  await emitirPelaTela()
  responder(true)
  await vi.waitFor(() => expect(servidor.emitirNfe).toHaveBeenCalledWith('0000000001', 55))
  expect(servidor.pushPedidos).toHaveBeenCalledWith('0000000001')
})

it('sem confirmação do vendedor nada é enviado', async () => {
  await emitirPelaTela()
  responder(false)
  await new Promise((r) => setTimeout(r, 30))
  expect(servidor.pushPedidos).not.toHaveBeenCalled()
  expect(await query('SELECT status FROM ped')).toEqual([{ status: 'A' }])
})

it('se o servidor não confirma o pedido, a nota não é emitida', async () => {
  servidor.pushPedidos.mockImplementation(async () => { await query("UPDATE ped SET status = 'V'") })
  await emitirPelaTela()
  responder(true)
  await vi.waitFor(() => expect(usePedidoStore().pedstatus).toBe('V'))
  expect(servidor.emitirNfe).not.toHaveBeenCalled()
})

async function revisarPedido() {
  await pedidoNaEtapaProdutos()
  botao('Adicionar', host).click()
  await vi.waitFor(() => expect(host.textContent).toContain('Já adicionado'))
  botao('Continuar para pagamento', host).click()
  await vi.waitFor(() => expect(botao('Revisar pedido', host)).toBeTruthy())
  botao('Revisar pedido', host).click()
  await vi.waitFor(() => expect(botao('Finalizar', host)).toBeTruthy())
  await new Promise((r) => setTimeout(r, 30))
}
const statusPed = () => query<{ status: string }>('SELECT status FROM ped').then((r) => r[0].status)

it('financeiro opcional: sem parcelas não cobra distribuição e finaliza', async () => {
  await revisarPedido()
  expect(host.textContent).toContain('Nenhuma parcela')
  expect(host.textContent).not.toContain('Falta distribuir')
  botao('Finalizar', host).click()
  await vi.waitFor(async () => expect(await statusPed()).toBe('F'))
})

it('financeiro opcional: com parcela preenchida, o total precisa bater', async () => {
  await inserir('financeiro', { pedido: '0000000001', cobranca: '01', condicao: 1, valor: 4 })
  await revisarPedido()
  expect(host.textContent).toContain('Falta distribuir R$ 6,00')
  botao('Finalizar', host).click()
  await new Promise((r) => setTimeout(r, 30))
  expect(await statusPed()).toBe('A')
})

it('parcelas acima do total não aparecem como distribuídas', async () => {
  await inserir('financeiro', { pedido: '0000000001', cobranca: '01', condicao: 1, valor: 14 })
  await revisarPedido()
  expect(host.textContent).not.toContain('Total distribuído')
  expect(host.textContent).toContain('Parcelas excedem o total em R$ 4,00')
})

it('financeiro obrigatório (finped): sem parcelas cobra distribuição e não finaliza', async () => {
  await revisarPedido()
  useAuthStore().usuario!.finped = 'S'
  await nextTick()
  expect(host.textContent).toContain('Falta distribuir R$ 10,00')
  botao('Finalizar', host).click()
  await new Promise((r) => setTimeout(r, 30))
  expect(await statusPed()).toBe('A')
})

async function campo(nome: string) {
  return vi.waitFor(() => {
    const el = document.querySelector<HTMLInputElement>(`[data-campo="${nome}"]`)
    expect(el).toBeTruthy()
    return el!
  })
}

async function digitar(nome: string, texto: string) {
  const el = await campo(nome)
  el.value = texto
  el.dispatchEvent(new Event('input'))
  await nextTick()
  return el.value
}

async function etapaPagamento() {
  await pedidoNaEtapaProdutos()
  botao('Adicionar', host).click()
  await vi.waitFor(() => expect(host.textContent).toContain('Já adicionado'))
  botao('Continuar para pagamento', host).click()
  await vi.waitFor(() => expect(botao('Revisar pedido', host)).toBeTruthy())
}

const interruptor = (texto: string) =>
  [...host.querySelectorAll('label')].find((l) => l.textContent?.includes(texto))!.querySelector<HTMLInputElement>('input')!

it('a parcela vem com o que falta já em R$ e grava o valor digitado', async () => {
  await inserir('cobrancas', { codigo: '01', descr: 'Boleto' })
  await etapaPagamento()
  await vi.waitFor(async () => expect((await campo('parcela')).value).toBe('R$ 10,00'))
  expect(await digitar('parcela', '730')).toBe('R$ 7,30')
  host.querySelector<HTMLButtonElement>('[data-campo="cobranca-parcela"]')!.click()
  await vi.waitFor(() => expect(botao('Boleto')).toBeTruthy())
  botao('Boleto').click()
  host.querySelector<HTMLButtonElement>('[data-campo="condicao-parcela"]')!.click()
  await vi.waitFor(() => expect(botao('À vista')).toBeTruthy())
  botao('À vista').click()
  await nextTick()
  botao('Adicionar parcela', host).click()
  await vi.waitFor(async () => expect(await query('SELECT valor FROM financeiro')).toEqual([{ valor: 7.3 }]))
  await vi.waitFor(async () => expect((await campo('parcela')).value).toBe('R$ 2,70'))
})

it('desconto do pedido em R$ usa a máscara', async () => {
  await etapaPagamento()
  botao('Valor (R$)', host).click()
  await nextTick()
  expect(await digitar('desconto-pedido', '150')).toBe('R$ 1,50')
  botao('Aplicar', host).click()
  await vi.waitFor(async () => expect(await query('SELECT descto, descper, vltotal FROM mped')).toEqual([{ descto: 1.5, descper: 'N', vltotal: 8.5 }]))
})

it('desconto do pedido em percentual continua sem máscara', async () => {
  await etapaPagamento()
  expect(await digitar('desconto-pedido', '15')).toBe('15')
  botao('Aplicar', host).click()
  await vi.waitFor(async () => expect(await query('SELECT descto, descper, vltotal FROM mped')).toEqual([{ descto: 15, descper: 'S', vltotal: 8.5 }]))
})

it.each([
  ['Por quilo', 'vlquilo', 'valor_quilo'],
  ['Por unidade', 'vlunidade', 'valor_unidade'],
])('acréscimo "%s" usa a máscara', async (rotulo, nome, coluna) => {
  await etapaPagamento()
  interruptor(rotulo).click()
  await nextTick()
  expect(await digitar(nome, '20')).toBe('R$ 0,20')
  ;[...host.querySelectorAll('button')].filter((b) => b.textContent?.trim() === 'Aplicar')[1].click()
  await vi.waitFor(async () => expect(await query(`SELECT ${coluna} AS valor FROM ped`)).toEqual([{ valor: 0.2 }]))
})

it('frete embutido usa a máscara', async () => {
  await etapaPagamento()
  expect(await digitar('frete', '250')).toBe('R$ 2,50')
  botao('Revisar pedido', host).click()
  await vi.waitFor(() => expect(host.textContent).toContain('frete R$ 2,50'))
  await vi.waitFor(async () => expect(await query('SELECT valor_frete FROM ped')).toEqual([{ valor_frete: 2.5 }]))
})

it('desconto do item em R$ usa a máscara; em % não', async () => {
  await pedidoNaEtapaProdutos()
  host.querySelector<HTMLButtonElement>('[aria-label="Ajustar preço e desconto"]')!.click()
  expect(await digitar('desconto-item', '150')).toBe('R$ 1,50')
  const tipo = [...document.querySelectorAll('[role="radio"]')].find((b) => b.textContent === '%') as HTMLButtonElement
  tipo.click()
  await nextTick()
  expect(await digitar('desconto-item', '15')).toBe('15')
  botao('Salvar item').click()
  await vi.waitFor(async () => expect(await query('SELECT descto, descper, vltotal FROM mped')).toEqual([{ descto: 15, descper: 'S', vltotal: 8.5 }]))
})
