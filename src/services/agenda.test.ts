import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirBanco, inserir, query } from '../test/sqlite'

const gps = vi.hoisted(() => ({ getCurrentPosition: vi.fn() }))
vi.mock('@capacitor/geolocation', () => ({ Geolocation: gps }))
vi.mock('../db/connection', () => import('../test/sqlite'))

import { avisosCliente, checkIn, expandRecorrencia, incluirVisita, listarCompromissos, situacaoVisita } from './agenda'

beforeEach(async () => {
  await abrirBanco()
  gps.getCurrentPosition.mockReset().mockResolvedValue({ coords: { latitude: -27, longitude: -51 } })
  await inserir('clifor', { codigo: 1, fantasia: 'Cliente', endereco: 'Rua', cidade: 'Joaçaba', obs: '' })
})
afterEach(() => vi.useRealTimers())

describe('expandRecorrencia', () => {
  it('repete a cada N dias até o fim do período', () => {
    expect(expandRecorrencia('2026-06-02', 7, '2026-11-20', '2026-12-05')).toEqual(['2026-11-24', '2026-12-01'])
  })
  it('sem repetição gera uma única visita', () => {
    expect(expandRecorrencia('2026-11-27', 0, '2026-11-01', '2026-11-30')).toEqual(['2026-11-27'])
  })
  it('fora do período não gera nada', () => {
    expect(expandRecorrencia('2026-11-27', 0, '2026-12-01', '2026-12-31')).toEqual([])
    expect(expandRecorrencia('2027-01-01', 7, '2026-12-01', '2026-12-31')).toEqual([])
    expect(expandRecorrencia('', 7, '2026-12-01', '2026-12-31')).toEqual([])
  })
})

describe('listarCompromissos', () => {
  it('a visita registrada substitui o agendamento do mesmo dia', async () => {
    await inserir('agenda', { clifor: 1, data_base: '2026-11-25', dia: '4', hora: '09:00', dias: 7, snvis: 'S' })
    await inserir('visitas', { clifor: 1, data: '2026-11-26', data_agenda: '2026-11-25', hora: '09:00', atendido: 'S' })
    const r = await listarCompromissos('2026-11-25', '2026-12-02')
    expect(r.map((x) => [x.data_agenda, x.origem])).toEqual([['2026-11-25', 'visita'], ['2026-12-02', 'agenda']])
  })
})

describe('situacaoVisita', () => {
  it('visita ainda sem atendimento continua agendada', () => {
    expect(situacaoVisita({ atendido: '' })).toBe('agendada')
    expect(situacaoVisita({ atendido: null })).toBe('agendada')
    expect(situacaoVisita({ atendido: 'S' })).toBe('visitada')
    expect(situacaoVisita({ atendido: 'N' })).toBe('nao-visitada')
  })
})

describe('checkIn', () => {
  const alvo = { clifor: 1, data_agenda: '2026-11-25', hora: '09:00' }
  const atendimento = { atendido: 'S', codmotivo: '01', motivo: 'ok' }

  it('exige o motivo', async () => {
    await expect(checkIn(alvo, { ...atendimento, codmotivo: '' })).rejects.toThrow('Informe o Motivo')
  })
  it('sem GPS registra com 0,0', async () => {
    gps.getCurrentPosition.mockRejectedValue(new Error('sem gps'))
    await checkIn(alvo, atendimento)
    expect(await query('SELECT latitude, longitude, sincronizada FROM visitas')).toEqual([{ latitude: 0, longitude: 0, sincronizada: 'N' }])
  })
  it('usa a data local, mesmo à noite', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 25, 23, 30))
    await checkIn(alvo, atendimento)
    expect(await query('SELECT data FROM visitas')).toEqual([{ data: '2026-11-25' }])
  })
  it('registrar de novo atualiza em vez de duplicar', async () => {
    await checkIn(alvo, atendimento)
    await checkIn(alvo, { ...atendimento, atendido: 'N' })
    expect(await query('SELECT atendido FROM visitas')).toEqual([{ atendido: 'N' }])
  })
})

describe('incluirVisita', () => {
  it('exige cliente, data e hora', async () => {
    await expect(incluirVisita({ clifor: 0, data: '2026-11-25', hora: '09:00', dias: 0 })).rejects.toThrow('Informe Cliente/Data/Hora')
    await expect(incluirVisita({ clifor: 1, data: '2026-11-25', hora: '', dias: 0 })).rejects.toThrow('Informe Cliente/Data/Hora')
  })
  it('grava a visita e a agenda com o dia da semana (domingo = 1)', async () => {
    await incluirVisita({ clifor: 1, data: '2026-11-25', hora: '09:00', dias: 7 })
    expect(await query('SELECT clifor, data_agenda, hora, atendido FROM visitas')).toEqual([
      { clifor: 1, data_agenda: '2026-11-25', hora: '09:00', atendido: null },
    ])
    expect(await query('SELECT clifor, data_base, dia, dias, snvis FROM agenda')).toEqual([
      { clifor: 1, data_base: '2026-11-25', dia: '4', dias: 7, snvis: 'N' },
    ])
  })
  it('não duplica visita na mesma data', async () => {
    await incluirVisita({ clifor: 1, data: '2026-11-25', hora: '09:00', dias: 0 })
    await expect(incluirVisita({ clifor: 1, data: '2026-11-25', hora: '10:00', dias: 0 })).rejects.toThrow('Já existe visita')
    expect(await query('SELECT * FROM agenda')).toHaveLength(1)
  })
})

describe('avisosCliente', () => {
  it('traz títulos e observação', async () => {
    expect(await avisosCliente(1)).toEqual([])
    await inserir('titulos', { clifor: 1, numero: '1', valor: 10, vencimento: '2026-01-01' })
    await query("UPDATE clifor SET obs = 'Entregar cedo'")
    expect(await avisosCliente(1)).toEqual(['Cliente possui títulos em aberto.', 'Entregar cedo'])
  })
})
