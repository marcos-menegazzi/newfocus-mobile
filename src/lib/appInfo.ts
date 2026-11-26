/** Versão do app (package.json), ex.: "3.0.0". */
export const APP_VERSION = __APP_VERSION__

/**
 * Versão informada ao servidor (login e validação da sincronização) e gravada em
 * `usuario.versao`: a data da compilação, AAAAMMDD, ex.: "20261126".
 */
export const VERSAO_COMPILACAO = __BUILD_VERSION__

/** Data/hora em que esta versão foi compilada, ex.: "12/11/2026 17:20". */
export function buildDateLabel(iso: string = __BUILD_DATE__): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
