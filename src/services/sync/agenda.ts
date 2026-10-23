import { call } from './context'
import { childText, rowChildren, removechar } from './helpers'
import { clearTables } from './pull'
import { run, query } from '../../db/connection'
import { useAuthStore } from '../../stores/auth'

export async function pullAgenda(): Promise<void> {
  const u = useAuthStore().usuario!
  const pend = await query<any>("SELECT * FROM agenda WHERE snvis = 'N'")
  const xmlAgenda = pend.length === 0 ? '' :
    '<agendas>' + pend.map((a) =>
      '<agenda><cliente>' + a.clifor + '</cliente><data_base>' + a.data_base + '</data_base>' +
      '<hora>' + a.hora + '</hora><periodo>' + a.dias + '</periodo><data_inc>' + a.dia + '</data_inc></agenda>'
    ).join('') + '</agendas>'

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
    const xml = '<agendas>' + rows.map((v) =>
      '<agenda><cliente>' + v.clifor + '</cliente><dtvisita>' + v.data + '</dtvisita>' +
      '<dtagenda>' + v.data_agenda + '</dtagenda><hora>' + v.hora + '</hora>' +
      '<codmotivo>' + v.codmotivo + '</codmotivo><motivo>' + removechar(v.motivo) + '</motivo>' +
      '<atendido>' + v.atendido + '</atendido><latitude>' + v.latitude + '</latitude>' +
      '<longitude>' + v.longitude + '</longitude></agenda>'
    ).join('') + '</agendas>'

    await call(`P_RAGWEB:EXEC("${xml}","${u.codlic}","${u.usuario}")`)
    for (const v of rows) {
      await run("UPDATE visitas SET sincronizada = 'S' WHERE idvisita = ?", [v.idvisita])
    }
  }
}
