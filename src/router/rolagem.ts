import type { RouteLocationNormalized } from 'vue-router'
import { ehAba } from '../lib/navegacao'

type Rota = Pick<RouteLocationNormalized, 'name'>
interface Posicao { left?: number; top: number }

// Cada aba lembra onde parou, como nos apps nativos.
const posicoes = new Map<unknown, number>()

export function guardarRolagem(de: Rota, y: number) {
  if (ehAba(de.name)) posicoes.set(de.name, y)
}

export function esquecerRolagem() {
  posicoes.clear()
}

/** Voltar retoma a rolagem; trocar de aba retoma a da aba; tela nova começa do topo. */
export function rolagem(para: Rota, de: Rota, salvo: Posicao | null): Posicao | false {
  if (salvo) return salvo
  // O router também passa por aqui ao tocar na aba em que já se está.
  if (ehAba(para.name) && para.name === de.name) return false
  if (ehAba(para.name) && ehAba(de.name)) return { top: posicoes.get(para.name) ?? 0 }
  return { top: 0 }
}
