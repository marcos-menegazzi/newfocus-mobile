import { defineStore } from 'pinia'
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
    pedstatus: '',
    carregando: false,
  }),
  actions: {
    async novo() {
      const pre = await novopedidoPrefill()
      this.cabecalho = { ...pre, numpedido: '' }
      this.itens = []
      this.parcelas = []
      this.pedstatus = 'A'
    },
    async carregar(numpedido: string) {
      this.carregando = true
      try {
        const ped = await carregarPedido(numpedido)
        this.cabecalho = ped ?? {}
        this.pedstatus = ped?.status ?? ''
      } finally {
        this.carregando = false
      }
    },
    async salvar() {
      await salvarCabecalho(this.cabecalho as any)
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
