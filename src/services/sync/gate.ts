import { CapacitorHttp } from '@capacitor/core'
import { call } from './context'
import { childText } from './helpers'
import { run } from '../../db/connection'
import { useAuthStore } from '../../stores/auth'

const TZ_TOKEN = 'cedb6b810af327287a13d4e78404b24ed7c0848e5f45abec1d8a33d8b3625caf'

export async function validaSync(): Promise<void> {
  const u = useAuthStore().usuario!
  const tz = await CapacitorHttp.get({
    url: 'https://pix.voltplus.com.br/api/timezone',
    headers: { Authorization: `Bearer ${TZ_TOKEN}` },
  })
  const time = (tz.data as any)?.time ?? ''
  const minute = time.substring(3, 5)
  if (minute === '59' || minute === '00') {
    throw new Error('Servidor Ocupado, aguarde 1 minuto e tente novamente.')
  }

  const doc = await call(`P_VDCWEB:EXEC("${u.versao}", ${u.codlic})`)
  const status = childText(doc.getElementsByTagName('retorno')[0], 'status')
  if (status !== 'ok') {
    throw new Error(childText(doc.getElementsByTagName('retorno')[0], 'msg') || 'Não foi possível sincronizar')
  }
}

export async function finalizeSync(): Promise<void> {
  const u = useAuthStore().usuario!
  // Como no app legado, a data da sincronização é gravada antes do saldo:
  // todas as etapas anteriores já foram concluídas.
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  await run('UPDATE usuario SET data_sinc = ?, hora_sinc = ?', [
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
  ])

  const doc = await call(`P_FLXWEB01:EXEC(${u.codlic},"${u.usuario}")`)
  const retorno = doc.getElementsByTagName('retorno')[0]
  if (!retorno?.getElementsByTagName('saldo')[0]) {
    throw new Error('Não foi possível obter o saldo flex. Aguarde um minuto e tente novamente.')
  }
  await run('UPDATE usuario SET saldoflex = ?', [childText(retorno, 'saldo')])
}
