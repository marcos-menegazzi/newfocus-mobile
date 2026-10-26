import { describe, it, expect, vi, beforeEach } from 'vitest'

const post = vi.fn()
vi.mock('@capacitor/core', () => ({ CapacitorHttp: { post: (o: unknown) => post(o) } }))

import { buildEnvelope, soapCommand, text, WS_PATH } from './soap'

const opts = { server: 'dev.example.com', comando: 'X', costumerId: 'i', username: 'U', password: 'P' }

describe('buildEnvelope', () => {
  it('contains comando, CostumerId, strUsername, strPassword', () => {
    const e = buildEnvelope('P_LGWEB:EXEC("A","B","3","20260930")', 'voltplus_desenv', 'MARCOSME', 'SECRET')
    expect(e).toContain('<tem:comando>P_LGWEB:EXEC(&quot;A&quot;,&quot;B&quot;,&quot;3&quot;,&quot;20260930&quot;)</tem:comando>')
    expect(e).toContain('<tem:CostumerId>voltplus_desenv</tem:CostumerId>')
    expect(e).toContain('<tem:strUsername>MARCOSME</tem:strUsername>')
    expect(e).toContain('<tem:strPassword>SECRET</tem:strPassword>')
    expect(e).toContain('http://tempuri.org/')
  })

  it('escapes XML metacharacters in values', () => {
    const e = buildEnvelope('P_LGWEB:EXEC("a&b","x<y")', 'id&x', 'u>v', 'p"q')
    expect(e).toContain('<tem:comando>P_LGWEB:EXEC(&quot;a&amp;b&quot;,&quot;x&lt;y&quot;)</tem:comando>')
    expect(e).toContain('<tem:CostumerId>id&amp;x</tem:CostumerId>')
    expect(e).toContain('<tem:strUsername>u&gt;v</tem:strUsername>')
    expect(e).toContain('<tem:strPassword>p&quot;q</tem:strPassword>')
  })
})

describe('text', () => {
  it('reads first retorno child text', () => {
    const doc = new DOMParser().parseFromString(
      '<retorno><result>True</result><estoque>S</estoque></retorno>',
      'text/xml',
    )
    expect(text(doc, 'result')).toBe('True')
    expect(text(doc, 'estoque')).toBe('S')
    expect(text(doc, 'missing')).toBe('')
  })

  it('scopes text lookup to the retorno element', () => {
    const doc = new DOMParser().parseFromString(
      '<root><result>outside</result><retorno><result>inside</result></retorno></root>',
      'text/xml',
    )
    expect(text(doc, 'result')).toBe('inside')
  })
})

describe('WS_PATH', () => {
  it('matches the legacy endpoint', () => {
    expect(WS_PATH).toBe('/NewAgeWebServiceSetup/EASWebService.asmx?op=executarComando')
  })
})

describe('soapCommand', () => {
  beforeEach(() => {
    post.mockReset()
  })

  it('limita a espera por resposta em vez de aguardar para sempre', async () => {
    post.mockResolvedValue({ status: 200, data: '<retorno/>' })
    await soapCommand(opts)
    expect(post.mock.calls[0][0].readTimeout).toBeGreaterThan(0)
  })

  it('troca o erro de timeout por uma mensagem para o usuário', async () => {
    post.mockRejectedValue(new Error('Read timed out'))
    await expect(soapCommand(opts)).rejects.toThrow('O servidor demorou demais para responder')
  })

  it('repassa outros erros de rede sem alterar', async () => {
    post.mockRejectedValue(new Error('Unable to resolve host'))
    await expect(soapCommand(opts)).rejects.toThrow('Unable to resolve host')
  })
})
