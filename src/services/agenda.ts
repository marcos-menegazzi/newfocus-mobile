import { Geolocation } from '@capacitor/geolocation'
import { query, run } from '../db/connection'

export interface Motivo {
  codigo: string
  descricao: string
}

export interface AgendaItem {
  idagenda: number | null
  clifor: number
  data_agenda: string
  data: string | null
  hora: string
  atendido: string
  codmotivo: string
  motivo: string
  fantasia: string
  endereco: string
  cidade: string
  origem: 'visita' | 'agenda'
}

function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function expandRecorrencia(
  dataBase: string,
  dia: number | string,
  dias: number | string,
): string[] {
  const n = parseInt(String(dia), 10) || 0
  const step = parseInt(String(dias), 10) || 0
  if (!dataBase || n <= 0) return []
  const start = new Date(`${dataBase.slice(0, 10)}T00:00:00`)
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i * step)
    out.push(toIso(d))
  }
  return out
}

export async function listarMotivos(): Promise<Motivo[]> {
  return query<Motivo>("SELECT * FROM historico_agenda WHERE inativo = 'N' ORDER BY descricao")
}

const VISITAS_SQL = `SELECT v.clifor, v.data_agenda, v.data, v.atendido, v.codmotivo, v.motivo, v.hora, c.fantasia, c.endereco, v.idvisita AS idagenda, c.cidade FROM visitas v INNER JOIN clifor c ON v.clifor = c.codigo WHERE v.data_agenda BETWEEN ? AND ?`

export async function listarVisitas(
  dtInicial: string,
  dtFinal: string,
  clifor?: number,
): Promise<AgendaItem[]> {
  let sql = VISITAS_SQL
  const params: unknown[] = [dtInicial, dtFinal]
  if (clifor) {
    sql += ' AND v.clifor = ?'
    params.push(clifor)
  }
  sql += ' ORDER BY v.data_agenda, v.hora'
  const rows = await query<any>(sql, params)
  return rows.map((r) => ({
    idagenda: r.idagenda,
    clifor: r.clifor,
    data_agenda: r.data_agenda,
    data: r.data,
    hora: r.hora,
    atendido: r.atendido,
    codmotivo: r.codmotivo,
    motivo: r.motivo,
    fantasia: r.fantasia,
    endereco: r.endereco,
    cidade: r.cidade,
    origem: 'visita',
  }))
}

const AGENDA_SQL = `SELECT a.data_base, a.clifor, a.dia, a.hora, a.dias, c.fantasia, c.endereco, a.idagenda, c.cidade FROM agenda a, clifor c WHERE a.clifor = c.codigo`

export async function listarAgenda(clifor?: number): Promise<AgendaItem[]> {
  let sql = AGENDA_SQL
  const params: unknown[] = []
  if (clifor) {
    sql += ' AND a.clifor = ?'
    params.push(clifor)
  }
  sql += ' GROUP BY a.clifor, a.data_base ORDER BY a.clifor'
  const rows = await query<any>(sql, params)
  const out: AgendaItem[] = []
  for (const r of rows) {
    for (const data of expandRecorrencia(r.data_base, r.dia, r.dias)) {
      out.push({
        idagenda: r.idagenda,
        clifor: r.clifor,
        data_agenda: data,
        data: null,
        hora: r.hora,
        atendido: '',
        codmotivo: '',
        motivo: '',
        fantasia: r.fantasia,
        endereco: r.endereco,
        cidade: r.cidade,
        origem: 'agenda',
      })
    }
  }
  return out
}

export async function temTitulos(clifor: number): Promise<boolean> {
  const rows = await query('SELECT * FROM titulos WHERE clifor = ?', [clifor])
  return rows.length > 0
}

async function posicao(): Promise<{ latitude: number; longitude: number }> {
  let pos
  try {
    pos = await Geolocation.getCurrentPosition()
  } catch {
    throw new Error('Não foi possível obter a localização. Verifique se o GPS está ligado e se o app tem permissão de localização.')
  }
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
}

export interface CheckInInput {
  atendido: string
  codmotivo: string
  motivo: string
}

export async function checkIn(item: AgendaItem, input: CheckInInput): Promise<void> {
  const { latitude, longitude } = await posicao()
  const hoje = new Date().toISOString().slice(0, 10)
  if (item.origem === 'visita') {
    await run(
      "UPDATE visitas SET atendido=?, motivo=?, codmotivo=?, latitude=?, longitude=?, data=?, sincronizada='N' WHERE clifor=? AND data_agenda=?",
      [input.atendido, input.motivo, input.codmotivo, latitude, longitude, hoje, item.clifor, item.data_agenda],
    )
  } else {
    await run(
      "INSERT INTO visitas (clifor, data, atendido, hora, motivo, data_agenda, codmotivo, latitude, longitude, sincronizada) VALUES (?,?,?,?,?,?,?,?,?,'N')",
      [item.clifor, hoje, input.atendido, item.hora, input.motivo, item.data_agenda, input.codmotivo, latitude, longitude],
    )
  }
}

export async function novaVisita(
  clifor: number,
  data: string,
  hora: string,
  dataAgenda: string,
): Promise<void> {
  const { latitude, longitude } = await posicao()
  await run(
    'INSERT INTO visitas (clifor, data, hora, data_agenda, latitude, longitude) VALUES (?,?,?,?,?,?)',
    [clifor, data, hora, dataAgenda, latitude, longitude],
  )
}

export async function novaRecorrencia(
  clifor: number,
  dataBase: string,
  dia: number,
  hora: string,
  dias: number,
): Promise<void> {
  await run("INSERT INTO agenda(clifor, data_base, dia, hora, dias, snvis) VALUES (?,?,?,?,?,'N')", [
    clifor, dataBase, String(dia), hora, dias,
  ])
}
