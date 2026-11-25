import { describe, it, expect } from 'vitest'
import { mensagemLogin, parseLogin } from './auth'

describe('parseLogin', () => {
  it('returns null when result is not True', () => {
    const doc = new DOMParser().parseFromString(
      '<retorno><result>False</result><msg>bloqueado</msg></retorno>',
      'text/xml',
    )
    expect(parseLogin(doc)).toBeNull()
  })

  it('maps all fields and parses sequencia', () => {
    const doc = new DOMParser().parseFromString(
      `<retorno>
        <seqpedido>1042</seqpedido><estoque>S</estoque><bloqueia>N</bloqueia>
        <dias>30</dias><libera>S</libera><sincprod>S</sincprod><limcred>S</limcred>
        <bloqemp>N</bloqemp><bloqcli>N</bloqcli><libmin>S</libmin><snos>N</snos>
        <altcli>S</altcli><obscli>S</obscli><finmob>S</finmob><result>True</result>
      </retorno>`,
      'text/xml',
    )
    const r = parseLogin(doc)
    expect(r).not.toBeNull()
    expect(r?.sequencia).toBe(1042)
    expect(r?.estoque).toBe('S')
    expect(r?.snos).toBe('N')
    expect(r?.finped).toBe('S')
    expect(r?.bloqueia).toBe('N')
    expect(r?.dias).toBe('30')
    expect(r?.libera).toBe('S')
    expect(r?.sincprod).toBe('S')
    expect(r?.limcred).toBe('S')
    expect(r?.bloqemp).toBe('N')
    expect(r?.bloqcli).toBe('N')
    expect(r?.libmin).toBe('S')
    expect(r?.altcli).toBe('S')
    expect(r?.obscli).toBe('S')
  })
})

describe('mensagemLogin', () => {
  const msg = (xml: string) => mensagemLogin(new DOMParser().parseFromString(xml, 'text/xml'))
  it('mostra o motivo devolvido pelo servidor', () => {
    expect(msg('<retorno><result>Versão desatualizada</result></retorno>')).toBe('Versão desatualizada')
    expect(msg('<retorno><result>False</result><msg>bloqueado</msg></retorno>')).toBe('bloqueado')
  })
  it('sem motivo, assume usuário ou senha', () => {
    expect(msg('<retorno><result>False</result></retorno>')).toBe('usuário ou senha inválidos')
    expect(msg('<String/>')).toBe('usuário ou senha inválidos')
  })
})
