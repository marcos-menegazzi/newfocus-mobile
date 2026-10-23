import { describe, it, expect } from 'vitest'
import { TABLES, SCHEMA_VERSION } from './schema'

describe('schema', () => {
  it('defines exactly 33 tables', () => {
    expect(TABLES).toHaveLength(33)
  })

  it('every table statement is CREATE TABLE IF NOT EXISTS', () => {
    for (const t of TABLES) {
      expect(t).toMatch(/^CREATE TABLE IF NOT EXISTS \w+/)
    }
  })

  it('uses the current schema version', () => {
    expect(SCHEMA_VERSION).toBe('20260930')
  })
})
