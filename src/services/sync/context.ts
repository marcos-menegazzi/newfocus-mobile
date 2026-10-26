import { useAuthStore } from '../../stores/auth'
import { soapCommand, SoapHttpError } from '../soap'

// O servidor devolve HTTP 500 com frequência durante a sincronização; a mesma
// requisição costuma passar se repetida alguns segundos depois.
const RETRY_DELAY_MS = 3000
const MAX_RETRIES = 3

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function call(comando: string): Promise<Document> {
  const u = useAuthStore().usuario
  if (!u) throw new Error('sem usuário logado')
  const opts = {
    server: u.server,
    costumerId: u.id,
    username: u.usuario,
    password: u.senha,
    comando,
  }
  for (let tentativa = 0; ; tentativa++) {
    try {
      return await soapCommand(opts)
    } catch (e) {
      if (!(e instanceof SoapHttpError) || e.status !== 500 || tentativa >= MAX_RETRIES) throw e
      await wait(RETRY_DELAY_MS)
    }
  }
}
