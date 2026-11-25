import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { periodoMes, presetFor, presetRange, PRESETS_AGENDA, restoDaSemana } from './periodo'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 25, 23, 0)) // quarta-feira
})
afterEach(() => vi.useRealTimers())

it('resto da semana vai de hoje até sábado', () => {
  expect(restoDaSemana()).toEqual(['2026-11-25', '2026-11-28'])
})
it('próxima semana vai de domingo a sábado', () => {
  expect(presetRange('prox-semana')).toEqual(['2026-11-29', '2026-12-05'])
})
it('o mês inclui os dias futuros', () => {
  expect(periodoMes()).toEqual(['2026-11-01', '2026-11-30'])
})
it('reconhece o período da agenda', () => {
  expect(presetFor('2026-11-25', '2026-11-28', PRESETS_AGENDA)).toBe('semana')
})
