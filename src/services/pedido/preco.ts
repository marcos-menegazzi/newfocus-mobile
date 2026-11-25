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
  vv = round(vv, 6)
  if (vv < round(valortab, 2)) return 0
  if (vv === round(valortab, 2)) return round((round(valortab, 2) * (quant * fator)) * (percflex / 100), 2)
  return round(vv * (quant * fator), 2) - round(round(valortab, 2) * (quant * fator), 2)
}

export interface PrecoInput {
  /** Preços da tabela, por unidade padrão (sem o fator). */
  venda: number; maximo: number; minimo: number
  /** Valor unitário digitado, por unidade padrão. Ignorado quando há desconto incluso. */
  unitario?: number
  descinc: number; quantidade: number; fator: number
  desconto: number; descper: 'S' | 'N'
  tabela: string | number
  tabelas: TabelaFlex[]
}

export interface PrecoResult {
  /** Valores já na unidade do item (com o fator). */
  vlunbase: number; vlunit: number; total: number; flex: number
  abaixoMinimo: boolean; acimaMaximo: boolean
}

export function calcPreco(i: PrecoInput): PrecoResult {
  const base = i.descinc > 0
    ? round(i.venda - round(i.venda * (i.descinc / 100), 2), 2)
    : i.unitario ?? i.venda
  // Sem arredondar para centavos: o fator pode ser fracionário.
  const vlunit = round(base * i.fator, 6)
  const maximo = round(i.maximo * i.fator, 2)
  const minimo = round(i.minimo * i.fator, 2)
  const bruto = round(i.quantidade * vlunit, 2)
  const desc = i.descper === 'N' ? i.desconto : round((bruto * i.desconto) / 100, 2)
  const total = round(bruto - desc, 2)
  return {
    vlunbase: round(i.venda * i.fator, 6),
    vlunit,
    total,
    flex: retvalflex(i.tabelas, i.tabela, i.quantidade, i.venda, base, i.fator, i.desconto, i.descper),
    abaixoMinimo: round(vlunit, 2) < minimo || round(total / i.quantidade, 2) < minimo,
    acimaMaximo: round(vlunit, 2) > maximo,
  }
}
