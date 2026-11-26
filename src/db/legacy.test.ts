import { describe, it, expect } from 'vitest'
import { copyLegacyDatabase, legacyPendente, type LegacyFs } from './legacy'

function memFs(initial: Record<string, string>): LegacyFs & { files: Record<string, string> } {
  const files = { ...initial }
  return {
    files,
    async exists(p) {
      return p in files
    },
    async copy(from, to) {
      if (!(from in files)) throw new Error(`missing ${from}`)
      files[to] = files[from]
    },
    async rename(from, to) {
      if (!(from in files)) throw new Error(`missing ${from}`)
      files[to] = files[from]
      delete files[from]
    },
    async remove(p) {
      delete files[p]
    },
  }
}

const paths = { oldDb: '/old/newfocus.db', newDb: '/new/newfocusSQLite.db' }

describe('copyLegacyDatabase', () => {
  it('copies the legacy database with its WAL to the new location and keeps a backup', async () => {
    const fs = memFs({
      '/old/newfocus.db': 'DB',
      '/old/newfocus.db-wal': 'WAL',
      '/old/newfocus.db-shm': 'SHM',
    })

    expect(await copyLegacyDatabase(fs, paths)).toBe(true)

    expect(fs.files['/new/newfocusSQLite.db']).toBe('DB')
    expect(fs.files['/new/newfocusSQLite.db-wal']).toBe('WAL')
    expect(fs.files['/new/newfocusSQLite.db-shm']).toBeUndefined()
    expect(fs.files['/new/newfocusSQLite.db.tmp']).toBeUndefined()
    // Old files renamed so the import never runs twice.
    expect(fs.files['/old/newfocus.db']).toBeUndefined()
    expect(fs.files['/old/newfocus.db.importado']).toBe('DB')
    expect(fs.files['/old/newfocus.db-wal.importado']).toBe('WAL')
  })

  it('copies a hot rollback journal too', async () => {
    const fs = memFs({ '/old/newfocus.db': 'DB', '/old/newfocus.db-journal': 'J' })
    expect(await copyLegacyDatabase(fs, paths)).toBe(true)
    expect(fs.files['/new/newfocusSQLite.db-journal']).toBe('J')
  })

  it('does nothing when the new database already exists', async () => {
    const fs = memFs({ '/old/newfocus.db': 'OLD', '/new/newfocusSQLite.db': 'NEW' })
    expect(await copyLegacyDatabase(fs, paths)).toBe(false)
    expect(fs.files['/new/newfocusSQLite.db']).toBe('NEW')
    expect(fs.files['/old/newfocus.db']).toBe('OLD')
  })

  it('does nothing when there is no legacy database', async () => {
    const fs = memFs({})
    expect(await copyLegacyDatabase(fs, paths)).toBe(false)
    expect(fs.files).toEqual({})
  })

  it('discards leftovers from an interrupted previous attempt', async () => {
    const fs = memFs({
      '/old/newfocus.db': 'DB',
      '/new/newfocusSQLite.db.tmp': 'PARTIAL',
      '/new/newfocusSQLite.db-wal': 'STALE',
    })
    expect(await copyLegacyDatabase(fs, paths)).toBe(true)
    expect(fs.files['/new/newfocusSQLite.db']).toBe('DB')
    expect(fs.files['/new/newfocusSQLite.db-wal']).toBeUndefined()
  })

  it('leaves no new database behind when the copy fails', async () => {
    const fs = memFs({ '/old/newfocus.db': 'DB' })
    fs.copy = async () => {
      throw new Error('disk full')
    }
    await expect(copyLegacyDatabase(fs, paths)).rejects.toThrow('disk full')
    expect(fs.files['/new/newfocusSQLite.db']).toBeUndefined()
    expect(fs.files['/old/newfocus.db']).toBe('DB')
  })

  it('replaces an existing (empty) new database when asked to', async () => {
    const fs = memFs({
      '/old/newfocus.db': 'OLD',
      '/new/newfocusSQLite.db': 'EMPTY',
      '/new/newfocusSQLite.db-wal': 'EMPTY-WAL',
      '/new/newfocusSQLite.db-shm': 'EMPTY-SHM',
    })
    expect(await copyLegacyDatabase(fs, paths, { substituir: true })).toBe(true)
    expect(fs.files['/new/newfocusSQLite.db']).toBe('OLD')
    expect(fs.files['/new/newfocusSQLite.db-wal']).toBeUndefined()
    expect(fs.files['/new/newfocusSQLite.db-shm']).toBeUndefined()
    expect(fs.files['/old/newfocus.db.importado']).toBe('OLD')
  })

  it('keeps the new database when there is nothing to replace it with', async () => {
    const fs = memFs({ '/new/newfocusSQLite.db': 'NEW' })
    expect(await copyLegacyDatabase(fs, paths, { substituir: true })).toBe(false)
    expect(fs.files['/new/newfocusSQLite.db']).toBe('NEW')
  })
})

describe('legacyPendente', () => {
  it('is true while the legacy database was never imported (not renamed to backup)', async () => {
    expect(await legacyPendente(memFs({ '/old/newfocus.db': 'DB' }), paths)).toBe(true)
  })

  it('is false after a successful import or without a legacy app', async () => {
    expect(await legacyPendente(memFs({ '/old/newfocus.db.importado': 'DB' }), paths)).toBe(false)
    expect(await legacyPendente(memFs({}), paths)).toBe(false)
  })
})
