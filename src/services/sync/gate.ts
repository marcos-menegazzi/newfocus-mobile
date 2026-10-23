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
  const doc = await call(`P_FLXWEB01:EXEC(${u.codlic},"${u.usuario}")`)
  const saldo = childText(doc.getElementsByTagName('retorno')[0], 'saldo')
  await run('UPDATE usuario SET saldoflex = ?', [saldo])
  const now = new Date()
  await run('UPDATE usuario SET data_sinc = ?, hora_sinc = ?', [
    now.toISOString().slice(0, 10), now.toISOString().slice(11, 19),
  ])
}
