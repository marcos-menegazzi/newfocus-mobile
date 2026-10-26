import { describe, it, expect, vi, beforeEach } from 'vitest'

const runs: { sql: string; params: unknown[] }[] = []
let response = ''

vi.mock('../../db/connection', () => ({
  run: vi.fn(async (sql: string, params: unknown[] = []) => {
    runs.push({ sql, params })
    return { changes: 1 }
  }),
}))

vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({ usuario: { codlic: 3, usuario: 'MARCOS', versao: '1.0' } }),
}))

vi.mock('./context', () => ({
  call: vi.fn(async () => new DOMParser().parseFromString(response, 'text/xml')),
}))

import { finalizeSync } from './gate'

describe('finalizeSync', () => {
  beforeEach(() => {
    runs.length = 0
  })

  it('saves saldo flex and the local sync date/time', async () => {
    response = '<String><retorno><saldo>12.50</saldo></retorno></String>'
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 23, 8, 5, 9))
    await finalizeSync()
    vi.useRealTimers()
    expect(runs).toContainEqual({ sql: 'UPDATE usuario SET saldoflex = ?', params: ['12.50'] })
    expect(runs).toContainEqual({
      sql: 'UPDATE usuario SET data_sinc = ?, hora_sinc = ?',
      params: ['2026-10-23', '08:05:09'],
    })
  })

  it('records the sync and fails with a clear message when saldo is missing', async () => {
    response = '<String/>'
    await expect(finalizeSync()).rejects.toThrow('saldo flex')
    expect(runs.map((r) => r.sql)).toEqual(['UPDATE usuario SET data_sinc = ?, hora_sinc = ?'])
  })
})
