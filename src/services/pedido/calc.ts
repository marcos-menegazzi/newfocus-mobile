export function round(value: number, exp?: number): number {
  if (exp === undefined || +exp === 0) return Math.round(value)
  value = +value; exp = +exp
  if (Number.isNaN(value) || !(Number.isInteger(exp))) return NaN
  const [m, e] = String(value).split('e')
  const scaled = Math.round(Number(`${m}e${e ? Number(e) + exp : exp}`))
  const [m2, e2] = String(scaled).split('e')
  return Number(`${m2}e${e2 ? Number(e2) - exp : -exp}`)
}

export function retNumber(texto: string): number {
  const valor = texto.replace('.', '')
  return parseFloat(valor.replace(',', '.')) || 0
}

export function pad(num: number, size: number): string {
  const s = '000000000' + num
  return s.slice(-size)
}

export function gerarIdUnico(): string {
  let id = ''
  for (let i = 0; i < 5; i++) id += Math.random().toString(36).substr(2, 9)
  return id
}

export function getfator(fatores: [string, string, number][], codigo: string, unidade: string): number {
  if (unidade === '') return 1
  const found = fatores.find((f) => f[0] === codigo && f[1] === unidade)
  return found ? found[2] : 1
}

export function isCondAvista(condicoes: { codigo: number; avista: string }[], codigo: string | number): boolean {
  const c = condicoes.find((x) => String(x.codigo) === String(codigo))
  return c ? c.avista === 'S' : false
}
