function dd(n: number): string {
  return String(n).padStart(2, '0')
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`
}

export function hojeISO(): string {
  return isoDate(new Date())
}

export function primeiroDiaMesISO(): string {
  const d = new Date()
  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1))
}

/** Do primeiro ao último dia do mês atual. */
export function periodoMes(): [string, string] {
  const d = new Date()
  return [primeiroDiaMesISO(), isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0))]
}

/** De hoje até o sábado desta semana. */
export function restoDaSemana(): [string, string] {
  const d = new Date()
  return [isoDate(d), isoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + (6 - d.getDay())))]
}

export type PresetKey = 'mes' | 'mes-anterior' | '30d' | 'semana' | 'prox-semana' | 'mes-todo' | 'custom'

export const PRESETS: { value: PresetKey; label: string }[] = [
  { value: 'mes', label: 'Este mês' },
  { value: 'mes-anterior', label: 'Mês passado' },
  { value: '30d', label: '30 dias' },
  { value: 'custom', label: 'Outro' },
]

/** Períodos da agenda: olham para frente. */
export const PRESETS_AGENDA: { value: PresetKey; label: string }[] = [
  { value: 'semana', label: 'Semana' },
  { value: 'prox-semana', label: 'Próxima' },
  { value: 'mes-todo', label: 'Mês' },
  { value: 'custom', label: 'Outro' },
]

export function presetRange(key: PresetKey): [string, string] | null {
  const now = new Date()
  switch (key) {
    case 'mes':
      return [primeiroDiaMesISO(), hojeISO()]
    case 'mes-anterior':
      return [
        isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        isoDate(new Date(now.getFullYear(), now.getMonth(), 0)),
      ]
    case '30d':
      return [isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)), hojeISO()]
    case 'semana':
      return restoDaSemana()
    case 'prox-semana': {
      const domingo = now.getDate() + 7 - now.getDay()
      return [
        isoDate(new Date(now.getFullYear(), now.getMonth(), domingo)),
        isoDate(new Date(now.getFullYear(), now.getMonth(), domingo + 6)),
      ]
    }
    case 'mes-todo':
      return periodoMes()
    default:
      return null
  }
}

export function presetFor(ini: string, fim: string, presets = PRESETS): PresetKey {
  for (const p of presets) {
    const r = presetRange(p.value)
    if (r && r[0] === ini && r[1] === fim) return p.value
  }
  return 'custom'
}

/** "01/10 a 23/10/2026" (omite o ano inicial quando igual ao final). */
export function formatPeriodo(ini: string, fim: string): string {
  if (!ini && !fim) return 'Todo o período'
  const [yi, mi, di] = ini.split('-')
  const [yf, mf, df] = fim.split('-')
  if (!fim) return `A partir de ${di}/${mi}/${yi}`
  if (!ini) return `Até ${df}/${mf}/${yf}`
  const start = yi === yf ? `${di}/${mi}` : `${di}/${mi}/${yi}`
  return `${start} a ${df}/${mf}/${yf}`
}
