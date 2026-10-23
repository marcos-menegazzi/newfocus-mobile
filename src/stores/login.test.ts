import { describe, it, expect } from 'vitest'
import { parseLogin } from './auth'

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
