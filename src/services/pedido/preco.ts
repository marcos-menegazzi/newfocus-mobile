import { round } from './calc'

export interface TabelaFlex { codigo: number; flex: number }

export function retvalflex(
  tabelas: TabelaFlex[], tabela: string | number, quant: number,
  valortab: number, valorvend: number, fator: number, desconto: number, descper: string,
): number {
  const t = tabelas.find((e) => String(e.codigo) === String(tabela))
  if (!t) return 0
  const percflex = t.flex
  let vv = valorvend
  const d = Number(desconto) || 0
  if (d > 0) {
    if (descper === 'N') vv -= d
    else vv -= round(vv * (d / 100), 2)
  }
  if (vv < round(valortab, 2)) return 0
  if (vv === round(valortab, 2)) return round((round(valortab, 2) * (quant * fator)) * (percflex / 100), 2)
  return round(vv * (quant * fator), 2) - round(round(valortab, 2) * (quant * fator), 2)
}

export interface PrecoInput {
  venda: number; maximo: number; minimo: number
  descinc: number; quantidade: number; fator: number
  desconto: number; descper: 'S' | 'N'
  tabela: string | number
  tabelas: TabelaFlex[]
}

export interface PrecoResult {
  vlunbase: number; vlunit: number; total: number; flex: number
  abaixoMinimo: boolean; acimaMaximo: boolean
}

export function calcPreco(i: PrecoInput): PrecoResult {
  const maximo = round(i.maximo * i.fator, 2)
  const minimo = round(i.minimo * i.fator, 2)
  const venda = round(i.venda * i.fator, 2)
  const vlunbase = venda
  let unitario = venda - round(venda * (i.descinc / 100), 2)
  let total = round(i.quantidade * i.fator * unitario, 2)
  const desc = i.descper === 'N' ? i.desconto : round((total * i.desconto) / 100, 2)
  total = round(total - desc, 2)
  const flex = retvalflex(i.tabelas, i.tabela, i.quantidade, vlunbase, unitario, i.fator, i.desconto, i.descper)
  return {
    vlunbase, vlunit: round(unitario, 2), total,
    flex, abaixoMinimo: round(total / i.quantidade, 2) < minimo,
    acimaMaximo: round(total / i.quantidade, 2) > maximo,
  }
}
