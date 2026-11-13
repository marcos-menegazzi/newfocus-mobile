export function formatReal(n: number | string | null | undefined): string {
  const v = typeof n === 'string' ? parseFloat(n) : n
  if (v == null || Number.isNaN(v)) return '0,00'
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
}

/** Quantidades (estoque, peso): sem casas fixas, até `max` decimais. */
export function formatNumero(n: number | string | null | undefined, max = 3): string {
  const v = typeof n === 'string' ? parseFloat(n) : n
  if (v == null || Number.isNaN(v)) return '0'
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: max }).format(v)
}

export function mudadata(d: string): string {
  if (!d || d.length < 10) return d ?? ''
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}

/** Máscara de moeda: os dígitos digitados são centavos ("333" → 3,33). Vazio ou zero → null. */
export function realDeDigitos(texto: string, maxDigitos = 11): number | null {
  const digitos = texto.replace(/\D/g, '').replace(/^0+/, '').slice(0, maxDigitos)
  return digitos ? Number(digitos) / 100 : null
}
