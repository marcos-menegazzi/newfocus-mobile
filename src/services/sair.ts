import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { resetDb } from '../db/connection'

/**
 * PDFs de pedidos e documentos baixados ficam na raiz da pasta de dados. Só eles saem:
 * no iOS essa pasta também guarda o banco SQLite.
 */
async function apagarPdfs(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const { files } = await Filesystem.readdir({ path: '', directory: Directory.Data })
  for (const f of files) {
    if (f.type === 'file' && f.name.toLowerCase().endsWith('.pdf')) {
      await Filesystem.deleteFile({ path: f.name, directory: Directory.Data }).catch(() => {})
    }
  }
}

/** Sair da conta: o próximo login começa com o aparelho sem nenhum dado. */
export async function limparAparelho(): Promise<void> {
  await resetDb()
  await apagarPdfs().catch(() => {})
}
