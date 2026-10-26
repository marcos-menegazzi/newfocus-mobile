import { call } from './context'
import { childText, rowChildren, tag } from './helpers'
import { clearTables } from './pull'
import { run, query } from '../../db/connection'
import { useAuthStore } from '../../stores/auth'

export async function pullAgenda(): Promise<void> {
  const u = useAuthStore().usuario!
  const pend = await query<any>("SELECT * FROM agenda WHERE snvis = 'N'")
  const xmlAgenda = pend.length === 0 ? '' :
    '[agendas]' + pend.map((a) =>
      '[agenda]' + tag('cliente', a.clifor) + tag('data_base', a.data_base) + tag('hora', a.hora) +
      tag('periodo', a.dias) + tag('data_inc', a.dia) + '[/agenda]'
    ).join('') + '[/agendas]'

  await clearTables(['agenda'])
  const doc = await call(`P_AGWEB:EXEC("${u.codlic}","${u.usuario}", "${xmlAgenda}")`)
  for (const r of rowChildren(doc, 'retorno')) {
    await run("INSERT INTO agenda(clifor, data_base, dia, hora, dias, snvis) VALUES (?,?,?,?,?,'S')", [
      childText(r, 'cliente'), childText(r, 'dtuvisita'), childText(r, 'diavisita'),
      childText(r, 'hrvisita'), childText(r, 'dias'),
    ])
  }
}

export async function pushVisitas(): Promise<void> {
  const u = useAuthStore().usuario!
  while (true) {
    const rows = await query<any>(
      "SELECT idvisita, clifor, data, data_agenda, hora, motivo, atendido, codmotivo, latitude, longitude FROM visitas WHERE sincronizada = 'N' OR sincronizada IS NULL ORDER BY clifor LIMIT 10",
    )
    if (rows.length === 0) break
    const xml = '[agendas]' + rows.map((v) =>
      '[agenda]' + tag('cliente', v.clifor) + tag('dtvisita', v.data) + tag('dtagenda', v.data_agenda) +
      tag('hora', v.hora) + tag('codmotivo', v.codmotivo) + tag('motivo', v.motivo) +
      tag('atendido', v.atendido) + tag('latitude', v.latitude) + tag('longitude', v.longitude) +
      '[/agenda]'
    ).join('') + '[/agendas]'

    await call(`P_RAGWEB:EXEC("${xml}","${u.codlic}","${u.usuario}")`)
    for (const v of rows) {
      await run("UPDATE visitas SET sincronizada = 'S' WHERE idvisita = ?", [v.idvisita])
    }
  }
}
