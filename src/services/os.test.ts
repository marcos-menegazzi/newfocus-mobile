import { describe, it, expect } from 'vitest'
import { buildDespesaXml, buildDiarioXml } from './os'

describe('buildDespesaXml', () => {
  it('mounts the lancamentos XML', () => {
    const xml = buildDespesaXml({
      os: '10',
      conta: '5',
      data: '2026-10-23',
      valor: 123.45,
      obs: 'nota',
      funcionarios: ['1', '2'],
      image: 'img.jpg',
    })
    expect(xml).toBe(
      '[lancamentos][os]10[/os][ctf]5[/ctf][data]2026-10-23[/data][valor]123.45[/valor][obs]nota[/obs]' +
        '[funcionarios][funcionario]1[/funcionario][funcionario]2[/funcionario][/funcionarios]' +
        '[image]img.jpg[/image][latitude]0[/latitude][longitude]0[/longitude][/lancamentos]',
    )
  })
})

describe('buildDiarioXml', () => {
  it('mounts apontamentos and fotos', () => {
    const xml = buildDiarioXml({
      os: '7',
      obs: 'dia 1',
      funcionarios: ['3'],
      apontamentos: [{ data: '2026-10-23', hora: '08:00' }],
      fotos: ['a', 'b'],
    })
    expect(xml).toBe(
      '[lancamentos][os]7[/os][obs]dia 1[/obs]' +
        '[funcionarios][funcionario]3[/funcionario][/funcionarios]' +
        '[apontamentos][apontamento][data]2026-10-23[/data][hora]08:00[/hora][/apontamento][/apontamentos]' +
        '[fotos][foto]a[/foto][foto]b[/foto][/fotos][latitude]0[/latitude][longitude]0[/longitude][/lancamentos]',
    )
  })
})
