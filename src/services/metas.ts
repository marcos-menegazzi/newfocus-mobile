import { childText } from './sync/helpers'
import { text } from './soap'

export interface MetaRow {
  label: string
  quantidade: string
  total: string
  meta: string
  falta: string
  percmeta: string
  percfalta: string
}

export interface FiltroMetas {
  dtInicial: string
  dtFinal: string
  grupo: string
  marca: string
  faturamento: string
}

export function comandoMetas(codlic: number | string, f: FiltroMetas): string {
  return `P_RMTWEB01:EXEC(${codlic}, '${f.dtInicial}', '${f.dtFinal}', '${f.grupo}', '${f.marca}', '${f.faturamento}')`
}

function labelFor(tipo: string, el: Element): string {
  switch (tipo) {
    case 'grupo': return childText(el, 'grupo')
    case 'marca': return childText(el, 'marca')
    case 'produto': return childText(el, 'produto')
    case 'grupo_marca': return `${childText(el, 'grupo')} ${childText(el, 'marca')}`.trim()
    default: return childText(el, 'vendedor')
  }
}

/** Cada item é o elemento que contém `<quantidade>`, esteja em `<itens>` ou direto em `<retorno>`. */
export function linhasMetas(doc: Document): { tipo: string; rows: MetaRow[] } {
  const tipo = text(doc, 'tipo')
  const rows = Array.from(doc.getElementsByTagName('quantidade'), (q) => q.parentElement!).map((el) => ({
    label: labelFor(tipo, el),
    quantidade: childText(el, 'quantidade'),
    total: childText(el, 'total'),
    meta: childText(el, 'meta'),
    falta: childText(el, 'falta'),
    percmeta: childText(el, 'percmeta'),
    percfalta: childText(el, 'percfalta'),
  }))
  return { tipo, rows }
}
