import { describe, it, expect } from 'vitest'
import { buildEnvelope, text, WS_PATH } from './soap'

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
})

describe('WS_PATH', () => {
  it('matches the legacy endpoint', () => {
    expect(WS_PATH).toBe('/NewAgeWebServiceSetup/EASWebService.asmx?op=executarComando')
  })
})
