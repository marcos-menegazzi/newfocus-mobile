import { beforeEach, describe, expect, it, vi } from 'vitest'

let resposta = ''
const comandos: string[] = []
const abertos: string[] = []
vi.mock('../../stores/auth', () => ({ useAuthStore: () => ({ usuario: { codlic: 3, usuario: 'M' } }) }))
vi.mock('../sync/context', () => ({
  call: vi.fn(async (c: string) => {
    comandos.push(c)
    return new DOMParser().parseFromString(resposta, 'text/xml')
  }),
}))
vi.mock('../files', () => ({ pdfUrl: (p: string) => p, openPdf: vi.fn(async (u: string) => { abertos.push(u) }) }))

import { imprimirErp, termo } from './termo'
import { duplicata } from '../sync/titulos_abertos'

beforeEach(() => {
  comandos.length = 0
  abertos.length = 0
})

describe('termo e duplicata', () => {
  it('abre o arquivo devolvido', async () => {
    resposta = '<String><retorno><status>true</status><arquivo>a.pdf</arquivo></retorno></String>'
    await termo(1)
    await duplicata(1)
    expect(abertos).toEqual(['termo/a.pdf', 'duplicata/a.pdf'])
  })
  it('avisa quando o servidor não localiza', async () => {
    resposta = '<String><retorno><status>false</status><arquivo>x</arquivo></retorno></String>'
    await expect(termo(1)).rejects.toThrow('Não localizado termo')
    await expect(duplicata(1)).rejects.toThrow('Não localizada duplicata')
    resposta = '<String><retorno/></String>'
    await expect(duplicata(1)).rejects.toThrow('Não localizada duplicata')
    expect(abertos).toEqual([])
  })
})

describe('imprimirErp', () => {
  it('abre a impressão do servidor', async () => {
    resposta = '<String><retorno><status>Ok</status><arquivo>p.pdf</arquivo></retorno></String>'
    await imprimirErp(77)
    expect(comandos).toEqual(['P_IPWEB:EXEC("77", "3")'])
    expect(abertos).toEqual(['pedido/Licenciada3/p.pdf'])
  })
  it('falha com status diferente de Ok', async () => {
    resposta = '<String><retorno><status>Erro</status></retorno></String>'
    await expect(imprimirErp(77)).rejects.toThrow('Erro durante a emissão do relatório')
  })
})
