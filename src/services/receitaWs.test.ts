import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { afterEach, expect, it, vi } from 'vitest'
import { consultarCnpj } from './receitaWs'

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => true) },
  CapacitorHttp: { get: vi.fn() },
}))

const cnpj = '11378117000120'
const url = `https://receitaws.com.br/v1/cnpj/${cnpj}`
const get = vi.mocked(CapacitorHttp.get)

afterEach(() => {
  get.mockReset()
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true)
})

it('consulta pelo HTTP nativo e preenche o cadastro com a resposta da ReceitaWS', async () => {
  get.mockResolvedValue({
    url, status: 200, headers: {},
    data: {
      status: 'OK', nome: 'Empresa Exemplo', fantasia: '', municipio: 'São Paulo', uf: 'SP',
      telefone: '(11) 3456-7890 / (11) 99876-5432', simples: { optante: true },
    },
  })

  await expect(consultarCnpj(cnpj)).resolves.toMatchObject({
    razao: 'Empresa Exemplo', fantasia: 'Empresa Exemplo',
    cidade: 'SAO PAULO', estado: 'SP', ddd: '11', tel1: '34567890', simples: 'S',
  })
  expect(get).toHaveBeenCalledWith(expect.objectContaining({ url, responseType: 'json' }))
})

it('distingue limite de consultas de CNPJ indisponível na base', async () => {
  get.mockResolvedValueOnce({ url, status: 429, headers: {}, data: '' })
  await expect(consultarCnpj(cnpj)).rejects.toThrow('Limite de consultas')

  get.mockResolvedValueOnce({
    url, status: 200, headers: {}, data: { status: 'ERROR', message: 'CNPJ não disponível no cache.' },
  })
  await expect(consultarCnpj(cnpj)).rejects.toThrow('CNPJ não disponível no cache.')
})

it('recebe o JSONP somente do iframe isolado e remove o iframe após a resposta', async () => {
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false)
  const consulta = consultarCnpj(cnpj)
  const frame = document.querySelector('iframe')!
  expect(frame.getAttribute('sandbox')).toBe('allow-scripts')
  expect(frame.srcdoc).toContain(`${url}?callback=receberCnpj`)
  const data = { tipo: 'receitaws', dados: { nome: 'Empresa Exemplo' } }
  window.dispatchEvent(new MessageEvent('message', { source: window, origin: 'null', data }))
  expect(frame.isConnected).toBe(true)
  window.dispatchEvent(new MessageEvent('message', { source: frame.contentWindow, origin: 'null', data }))
  await expect(consulta).resolves.toMatchObject({ razao: 'Empresa Exemplo' })
  expect(frame.isConnected).toBe(false)
})
