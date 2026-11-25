import { query, resetDb } from '../db/connection'

async function existe(sql: string): Promise<boolean> {
  return (await query(`${sql} LIMIT 1`)).length > 0
}

/** Motivo que impede apagar os dados do aparelho, ou null. */
export async function pendenciasRestauracao(): Promise<string | null> {
  if (await existe("SELECT 1 FROM clifor WHERE enviado IS NULL OR enviado <> 'S'")) {
    return 'Clientes pendentes de sincronização, impossível restaurar.'
  }
  if (await existe("SELECT 1 FROM ped WHERE status IN ('F', 'A')")) {
    return 'Pedidos abertos ou pendentes de sincronização, impossível restaurar.'
  }
  if (await existe("SELECT 1 FROM visitas WHERE sincronizada IS NULL OR sincronizada <> 'S'")) {
    return 'Visitas pendentes de sincronização, impossível restaurar.'
  }
  return null
}

/** Apaga todos os dados do aparelho e recria o banco vazio. O usuário precisa entrar de novo. */
export async function restaurar(senha: string): Promise<void> {
  const [u] = await query<{ senha: string }>('SELECT senha FROM usuario')
  if (!u || String(u.senha).toUpperCase() !== senha.trim().toUpperCase()) throw new Error('Senha incorreta.')
  const pendencia = await pendenciasRestauracao()
  if (pendencia) throw new Error(pendencia)
  await resetDb()
}
