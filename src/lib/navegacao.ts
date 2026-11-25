// Onde cada destino mora. Barra inferior: os de uso constante. Menu: o resto, sem repetir.
export interface Destino { name: string; label: string; icon: string }
export interface GrupoMenu { label: string; items: Destino[] }

const ABAS_VENDAS: Destino[] = [
  { name: 'home', label: 'Início', icon: 'home' },
  { name: 'pedidos', label: 'Pedidos', icon: 'orders' },
  { name: 'clientes', label: 'Clientes', icon: 'users' },
  { name: 'produtos', label: 'Produtos', icon: 'package' },
]

const ABAS_OS: Destino[] = [
  { name: 'os', label: 'Início', icon: 'home' },
  { name: 'os-despesas', label: 'Despesas', icon: 'receipt' },
  { name: 'os-diario', label: 'Diário', icon: 'clock' },
  { name: 'os-historico', label: 'Histórico', icon: 'orders' },
]

const CONFIG: Destino = { name: 'config', label: 'Configuração', icon: 'settings' }

const MENU_VENDAS: GrupoMenu[] = [
  {
    label: 'Vendas',
    items: [
      { name: 'pedido-novo', label: 'Novo pedido', icon: 'cart' },
      { name: 'historico-vendas', label: 'Histórico de vendas', icon: 'chart' },
      { name: 'metas', label: 'Metas', icon: 'target' },
    ],
  },
  { label: 'Campo', items: [{ name: 'agenda', label: 'Agenda de visitas', icon: 'calendar' }] },
  { label: 'Sistema', items: [{ name: 'sync', label: 'Sincronizar', icon: 'sync' }, CONFIG] },
]

const MENU_OS: GrupoMenu[] = [{ label: 'Sistema', items: [CONFIG] }]

export const abas = (isOs: boolean): Destino[] => (isOs ? ABAS_OS : ABAS_VENDAS)
export const menu = (isOs: boolean): GrupoMenu[] => (isOs ? MENU_OS : MENU_VENDAS)

const NOMES_ABAS = new Set([...ABAS_VENDAS, ...ABAS_OS].map((a) => a.name))
export const ehAba = (name: unknown): boolean => NOMES_ABAS.has(String(name ?? ''))
