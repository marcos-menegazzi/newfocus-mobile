import { defineStore } from 'pinia'
import { query } from '../db/connection'
import {
  salvarCabecalho,
  carregarPedido,
  novopedidoPrefill,
  duplicarPedido,
  cancelarPedido,
  reabrirPedido,
  orcamentoToPedido,
  reenviarPedido,
} from '../services/pedido/pedido'

export const usePedidoStore = defineStore('pedido', {
  state: () => ({
    cabecalho: {} as Record<string, any>,
    itens: [] as any[],
    parcelas: [] as any[],
    fatores: [] as [string, string, number][],
    tabelas: [] as { codigo: number; flex: number }[],
    mvtpreco: [] as any[],
    pedstatus: '',
    carregando: false,
  }),
  actions: {
    async carregarPrecos() {
      const [fatores, tabelas, mvtpreco] = await Promise.all([
        query<any>('SELECT produto, unidade, fator FROM fatores'),
        query<any>('SELECT codigo, flex FROM tpreco'),
        query<any>('SELECT tabela_codigo, produto, venda, maximo, minimo FROM mvtpreco'),
      ])
      this.fatores = fatores.map(
        (f: any) => [String(f.produto), String(f.unidade), Number(f.fator)] as [string, string, number],
      )
      this.tabelas = tabelas.map((t: any) => ({ codigo: Number(t.codigo), flex: Number(t.flex) }))
      this.mvtpreco = mvtpreco
    },
    async novo() {
      const pre = await novopedidoPrefill()
      this.cabecalho = { ...pre, numpedido: '', status: 'A' }
      this.itens = []
      this.parcelas = []
      this.pedstatus = 'A'
    },
    async carregar(numpedido: string) {
      this.carregando = true
      try {
        const ped = await carregarPedido(numpedido)
        this.cabecalho = ped ?? {}
        if (ped?.operacao) {
          const rows = await query<any>(
            'SELECT estoque, local, cobranca FROM operacao WHERE operacao = ?',
            [ped.operacao],
          )
          const op = rows[0]
          if (op) {
            if (op.estoque != null) this.cabecalho.estoque = op.estoque
            if (op.local != null) this.cabecalho.local = op.local
            if (op.cobranca != null) this.cabecalho.cobranca = op.cobranca
          }
        }
        this.pedstatus = ped?.status ?? ''
      } finally {
        this.carregando = false
      }
    },
    async salvar() {
      const numpedido = await salvarCabecalho(this.cabecalho as any)
      this.cabecalho.numpedido = numpedido
      return numpedido
    },
    async cancelar() {
      await cancelarPedido(this.cabecalho.numpedido, {
        cEstoque: this.cabecalho.estoque,
        empresa: this.cabecalho.empresa,
        local: this.cabecalho.local,
      })
      this.pedstatus = 'C'
    },
    async reabrir() {
      await reabrirPedido(this.cabecalho.numpedido)
      this.pedstatus = 'A'
    },
    async transformarOrcamento() {
      await orcamentoToPedido(this.cabecalho.numpedido)
      this.pedstatus = 'A'
    },
    async reenviar() {
      await reenviarPedido(this.cabecalho.numpedido)
      this.pedstatus = 'F'
    },
    async duplicar() {
      this.cabecalho.numpedido = await duplicarPedido(this.cabecalho.numpedido)
      this.pedstatus = 'A'
    },
  },
})
