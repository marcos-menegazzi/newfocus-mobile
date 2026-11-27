/** Data e hora gravadas pela sincronização ("AAAA-MM-DD" e "HH:MM:SS") como Date local. */
export function dataHoraLocal(data?: string, hora?: string): Date | null {
  const [y, m, d] = (data ?? '').slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  const [h = 0, min = 0, s = 0] = (hora ?? '').split(':').map((n) => Number(n) || 0)
  return new Date(y, m - 1, d, h, min, s)
}

/** Quanto tempo passou, em português curto: "agora mesmo", "há 5 min", "há 3 h", "há 2 dias". */
export function tempoDesde(quando: Date, agora: Date = new Date()): string {
  const min = Math.floor((agora.getTime() - quando.getTime()) / 60_000)
  if (min < 1) return 'agora mesmo'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const dias = Math.floor(h / 24)
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`
}

/** Sincronização com um dia ou mais: preços, clientes e títulos podem estar desatualizados. */
export const SINC_ATRASADA_MS = 24 * 60 * 60 * 1000
