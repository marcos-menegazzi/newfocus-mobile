import { useAuthStore } from '../../stores/auth'
import { soapCommand } from '../soap'

export async function call(comando: string): Promise<Document> {
  const u = useAuthStore().usuario
  if (!u) throw new Error('sem usuário logado')
  return soapCommand({
    server: u.server,
    costumerId: u.id,
    username: u.usuario,
    password: u.senha,
    comando,
  })
}
