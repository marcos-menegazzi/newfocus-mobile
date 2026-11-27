import { expect, it } from 'vitest'
import { dataHoraLocal, tempoDesde } from './tempo'

it('lê a data e a hora gravadas pela sincronização', () => {
  expect(dataHoraLocal('2026-11-26', '16:57:20')).toEqual(new Date(2026, 10, 26, 16, 57, 20))
  expect(dataHoraLocal('2026-11-26')).toEqual(new Date(2026, 10, 26))
  expect(dataHoraLocal('')).toBeNull()
  expect(dataHoraLocal(undefined, '10:00:00')).toBeNull()
})

it('diz quanto tempo passou em português curto', () => {
  const agora = new Date(2026, 10, 26, 18, 0, 0)
  const antes = (ms: number) => new Date(agora.getTime() - ms)
  expect(tempoDesde(antes(20_000), agora)).toBe('agora mesmo')
  expect(tempoDesde(antes(5 * 60_000), agora)).toBe('há 5 min')
  expect(tempoDesde(antes(3 * 3_600_000), agora)).toBe('há 3 h')
  expect(tempoDesde(antes(25 * 3_600_000), agora)).toBe('há 1 dia')
  expect(tempoDesde(antes(3 * 86_400_000), agora)).toBe('há 3 dias')
})
