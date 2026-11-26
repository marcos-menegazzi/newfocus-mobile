import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { DB_NAME } from './schema'

/**
 * Importação do banco do app Cordova antigo (mesmo bundle id `com.cordova.newfocus`).
 *
 * O app antigo usava cordova-sqlite-ext com `{ name: 'newfocus.db', location: 'default' }`:
 *   - Android: <dados do app>/databases/newfocus.db
 *   - iOS:     Library/LocalDatabase/newfocus.db
 * O @capacitor-community/sqlite procura `<nome>SQLite.db`:
 *   - Android: <dados do app>/databases/newfocusSQLite.db
 *   - iOS:     Documents/newfocusSQLite.db
 *
 * Quando o app novo é instalado por cima do antigo, o arquivo antigo é copiado para o
 * local/nome esperado antes da primeira conexão. As colunas que faltarem são
 * acrescentadas depois por `upgradeSchema`.
 */
export const LEGACY_DB_NAME = 'newfocus.db'
const NEW_DB_FILE = `${DB_NAME.replace(/\.db$/, '')}SQLite.db`

/** Sufixo dado aos arquivos antigos após a importação: mantém um backup e impede reimportar. */
export const BACKUP_SUFFIX = '.importado'

// -wal: o Android pode abrir o banco em WAL; transações ainda não consolidadas ficam nele.
// -journal: rollback journal "quente" de uma transação interrompida.
// -shm não é copiado: é só um índice do WAL, recriado ao abrir.
const SIDECARS = ['-wal', '-journal']

export interface LegacyFs {
  exists(path: string): Promise<boolean>
  copy(from: string, to: string): Promise<void>
  rename(from: string, to: string): Promise<void>
  remove(path: string): Promise<void>
}

export interface LegacyPaths {
  oldDb: string
  newDb: string
}

export interface CopyOptions {
  /**
   * Substitui um banco novo que já exista. Só para o banco vazio criado depois de uma
   * importação que falhou (ver `legacyPendente`).
   */
  substituir?: boolean
}

/**
 * Copia o banco antigo para o caminho do novo. Retorna `true` se importou.
 * Só age quando o antigo existe e o banco novo ainda não existe (ou `substituir`).
 */
export async function copyLegacyDatabase(
  fs: LegacyFs,
  paths: LegacyPaths,
  { substituir = false }: CopyOptions = {},
): Promise<boolean> {
  const { oldDb, newDb } = paths
  if (!(await fs.exists(oldDb))) return false

  const tmp = `${newDb}.tmp`
  const removeIfExists = async (p: string) => {
    if (await fs.exists(p)) await fs.remove(p)
  }

  if (await fs.exists(newDb)) {
    if (!substituir) return false
    for (const s of ['', '-shm']) await removeIfExists(newDb + s)
  }

  // Restos de uma tentativa interrompida.
  await removeIfExists(tmp)
  for (const s of SIDECARS) await removeIfExists(newDb + s)

  try {
    for (const s of SIDECARS) {
      if (await fs.exists(oldDb + s)) await fs.copy(oldDb + s, newDb + s)
    }
    // Copia para um temporário e renomeia: o banco novo só "existe" quando a cópia está completa.
    await fs.copy(oldDb, tmp)
    await fs.rename(tmp, newDb)
  } catch (e) {
    await removeIfExists(tmp).catch(() => {})
    for (const s of SIDECARS) await removeIfExists(newDb + s).catch(() => {})
    throw e
  }

  // Backup do original. Falha aqui não invalida a importação (o banco novo já existe).
  for (const s of ['', ...SIDECARS, '-shm']) {
    try {
      if (await fs.exists(oldDb + s)) await fs.rename(oldDb + s, oldDb + s + BACKUP_SUFFIX)
    } catch {
      /* ignora */
    }
  }
  return true
}

/**
 * O banco antigo ainda está no lugar original: nunca foi importado com sucesso
 * (depois de importado ele é renomeado para `.importado`).
 */
export async function legacyPendente(fs: LegacyFs, paths: LegacyPaths): Promise<boolean> {
  return fs.exists(paths.oldDb)
}

const capacitorFs: LegacyFs = {
  async exists(path) {
    try {
      await Filesystem.stat({ path })
      return true
    } catch {
      return false
    }
  },
  async copy(from, to) {
    await Filesystem.copy({ from, to })
  },
  async rename(from, to) {
    await Filesystem.rename({ from, to })
  },
  async remove(path) {
    await Filesystem.deleteFile({ path })
  },
}

async function nativePaths(): Promise<LegacyPaths | null> {
  const platform = Capacitor.getPlatform()
  if (platform === 'android') {
    // Directory.Data = <dados do app>/files; os bancos ficam em <dados do app>/databases.
    const { uri } = await Filesystem.getUri({ directory: Directory.Data, path: '' })
    const dbDir = uri.replace(/\/+$/, '').replace(/\/files$/, '/databases')
    return { oldDb: `${dbDir}/${LEGACY_DB_NAME}`, newDb: `${dbDir}/${NEW_DB_FILE}` }
  }
  if (platform === 'ios') {
    const old = await Filesystem.getUri({ directory: Directory.Library, path: `LocalDatabase/${LEGACY_DB_NAME}` })
    const neu = await Filesystem.getUri({ directory: Directory.Documents, path: NEW_DB_FILE })
    return { oldDb: old.uri, newDb: neu.uri }
  }
  return null
}

/**
 * Importa o banco do app antigo, se houver. Nunca lança: em caso de erro o app segue com
 * um banco novo vazio (o usuário faz login e sincroniza), e o arquivo antigo fica intacto.
 */
export async function importLegacyDatabase(options: CopyOptions = {}): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const paths = await nativePaths()
    if (!paths) return false
    return await copyLegacyDatabase(capacitorFs, paths, options)
  } catch (e) {
    console.error('Falha ao importar banco do app antigo', e)
    return false
  }
}

/** Há banco do app antigo que ainda não foi importado. Nunca lança. */
export async function legacyDatabasePendente(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const paths = await nativePaths()
    return !!paths && (await legacyPendente(capacitorFs, paths))
  } catch {
    return false
  }
}
