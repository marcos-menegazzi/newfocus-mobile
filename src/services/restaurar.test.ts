import { beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirBanco, inserir, query } from '../test/sqlite'

vi.mock('../db/connection', async () => {
  const s = await import('../test/sqlite')
  return { ...s, resetDb: s.abrirBanco }
})

import { pendenciasRestauracao, restaurar } from './restaurar'

beforeEach(async () => {
  await abrirBanco()
  await inserir('usuario', { usuario: 'M', senha: 'SEGREDO' })
})

it('exige a senha do usuário, sem diferenciar maiúsculas', async () => {
  await expect(restaurar('outra')).rejects.toThrow('Senha incorreta')
  expect(await query('SELECT * FROM usuario')).toHaveLength(1)
  await restaurar('segredo')
  expect(await query('SELECT * FROM usuario')).toEqual([])
})

describe('pendências impedem a restauração', () => {
  it.each([
    ['pedido aberto', 'ped', { numpedido: '1', status: 'A' }, 'Pedidos abertos'],
    ['pedido finalizado', 'ped', { numpedido: '1', status: 'F' }, 'Pedidos abertos'],
    ['cliente não enviado', 'clifor', { codigo: 0, enviado: 'N' }, 'Clientes pendentes'],
    ['visita não enviada', 'visitas', { clifor: 1, sincronizada: 'N' }, 'Visitas pendentes'],
  ])('%s', async (_, tabela, linha, mensagem) => {
    await inserir(tabela, linha)
    expect(await pendenciasRestauracao()).toContain(mensagem)
    await expect(restaurar('SEGREDO')).rejects.toThrow(mensagem)
    expect(await query('SELECT * FROM usuario')).toHaveLength(1)
  })
  it('pedido já sincronizado não impede', async () => {
    await inserir('ped', { numpedido: '1', status: 'S' })
    expect(await pendenciasRestauracao()).toBeNull()
  })
})
