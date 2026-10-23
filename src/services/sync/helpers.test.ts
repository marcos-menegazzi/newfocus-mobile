import { describe, it, expect } from 'vitest'
import { removechar, trocachar, rowChildren, childText } from './helpers'

describe('removechar', () => {
  it('strips diacritics, angle brackets, ampersand, and [..] tokens', () => {
    expect(removechar('São<Paulo>&co[xx]')).toBe('SaoPauloco')
  })
})

describe('trocachar', () => {
  it('decodes _1e and sem_dados sentinels and strips quotes', () => {
    expect(trocachar('a_1eb sem_dados\'c\'')).toBe('a&b c')
  })
})

describe('rowChildren / childText', () => {
  const doc = new DOMParser().parseFromString(
    '<retorno><row><codigo>1</codigo><nome>João</nome></row><row><codigo>2</codigo></row></retorno>',
    'text/xml',
  )
  it('returns the children of the root tag', () => {
    expect(rowChildren(doc, 'retorno')).toHaveLength(2)
  })
  it('reads child text and returns empty for missing', () => {
    const rows = rowChildren(doc, 'retorno')
    expect(childText(rows[0], 'codigo')).toBe('1')
    expect(childText(rows[0], 'nome')).toBe('João')
    expect(childText(rows[1], 'nome')).toBe('')
  })
})
