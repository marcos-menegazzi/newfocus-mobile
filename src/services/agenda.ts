import { Geolocation } from '@capacitor/geolocation'
import { query, run } from '../db/connection'
import { hojeISO, isoDate } from '../lib/periodo'

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
  atendido: string | null
  codmotivo: string | null
  motivo: string | null
  fantasia: string
  endereco: string
  cidade: string
  origem: 'visita' | 'agenda'
}

/** Datas da agenda dentro do período. `dias` é o intervalo de repetição; 0 = visita única. */
export function expandRecorrencia(dataBase: string, dias: number | string, ini: string, fim: string): string[] {
  const base = (dataBase ?? '').slice(0, 10)
  if (!base) return []
  const step = Math.trunc(Number(dias)) || 0
  if (step <= 0) return base >= ini && base <= fim ? [base] : []
  const out: string[] = []
  const d = new Date(`${base}T00:00:00`)
  for (let iso = base; iso <= fim; iso = isoDate(d)) {
    if (iso >= ini) out.push(iso)
    d.setDate(d.getDate() + step)
  }
  return out
}

export async function listarMotivos(): Promise<Motivo[]> {
  return query<Motivo>("SELECT * FROM historico_agenda WHERE inativo = 'N' ORDER BY descricao")
}

async function listarVisitas(ini: string, fim: string, clifor?: number): Promise<AgendaItem[]> {
  const rows = await query<Omit<AgendaItem, 'origem'>>(
    `SELECT v.clifor, v.data_agenda, v.data, v.atendido, v.codmotivo, v.motivo, v.hora, c.fantasia, c.endereco, v.idvisita AS idagenda, c.cidade
     FROM visitas v INNER JOIN clifor c ON v.clifor = c.codigo
     WHERE v.data_agenda BETWEEN ? AND ?${clifor ? ' AND v.clifor = ?' : ''}`,
    clifor ? [ini, fim, clifor] : [ini, fim],
  )
  return rows.map((r) => ({ ...r, origem: 'visita' }))
}

async function listarAgenda(ini: string, fim: string, clifor?: number): Promise<AgendaItem[]> {
  const rows = await query<any>(
    `SELECT a.data_base, a.clifor, a.hora, a.dias, c.fantasia, c.endereco, a.idagenda, c.cidade
     FROM agenda a, clifor c WHERE a.clifor = c.codigo${clifor ? ' AND a.clifor = ?' : ''}
     GROUP BY a.clifor, a.data_base ORDER BY a.clifor`,
    clifor ? [clifor] : [],
  )
  return rows.flatMap((r) =>
    expandRecorrencia(r.data_base, r.dias, ini, fim).map((data): AgendaItem => ({
      idagenda: r.idagenda, clifor: r.clifor, data_agenda: data, data: null, hora: r.hora,
      atendido: null, codmotivo: null, motivo: null,
      fantasia: r.fantasia, endereco: r.endereco, cidade: r.cidade, origem: 'agenda',
    })),
  )
}

/** Visitas e agendamentos do período; um por cliente e dia (a visita registrada prevalece). */
export async function listarCompromissos(ini: string, fim: string, clifor?: number): Promise<AgendaItem[]> {
  const vistos = new Set<string>()
  const todos = [...await listarVisitas(ini, fim, clifor), ...await listarAgenda(ini, fim, clifor)]
  return todos
    .filter((x) => {
      const chave = `${x.clifor}|${x.data_agenda}`
      return !vistos.has(chave) && !!vistos.add(chave)
    })
    .sort((x, y) => x.data_agenda.localeCompare(y.data_agenda) || (x.hora || '').localeCompare(y.hora || ''))
}

export function situacaoVisita(item: { atendido: string | null }): 'agendada' | 'visitada' | 'nao-visitada' {
  if (item.atendido === 'S') return 'visitada'
  return item.atendido === 'N' ? 'nao-visitada' : 'agendada'
}

/** O que o vendedor precisa saber ao escolher o cliente. */
export async function avisosCliente(clifor: number): Promise<string[]> {
  const avisos: string[] = []
  if (await temTitulos(clifor)) avisos.push('Cliente possui títulos em aberto.')
  const [c] = await query<{ obs: string | null }>('SELECT obs FROM clifor WHERE codigo = ?', [clifor])
  if (c?.obs?.trim()) avisos.push(c.obs.trim())
  return avisos
}

export async function temTitulos(clifor: number): Promise<boolean> {
  const rows = await query('SELECT 1 FROM titulos WHERE clifor = ? LIMIT 1', [clifor])
  return rows.length > 0
}

// Sem GPS ou sem permissão a visita é registrada mesmo assim, com 0,0.
async function posicao(): Promise<{ latitude: number; longitude: number }> {
  try {
    const { coords } = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 5000, maximumAge: 3000 })
    return { latitude: coords.latitude, longitude: coords.longitude }
  } catch {
    return { latitude: 0, longitude: 0 }
  }
}

async function visitaExiste(clifor: number, dataAgenda: string): Promise<boolean> {
  const rows = await query('SELECT 1 FROM visitas WHERE clifor = ? AND data_agenda = ? LIMIT 1', [clifor, dataAgenda])
  return rows.length > 0
}

export interface CheckInInput {
  atendido: string
  codmotivo: string
  motivo: string
}

export async function checkIn(
  item: Pick<AgendaItem, 'clifor' | 'data_agenda' | 'hora'>,
  input: CheckInInput,
): Promise<void> {
  if (!input.codmotivo) throw new Error('Informe o Motivo.')
  const { latitude, longitude } = await posicao()
  const hoje = hojeISO()
  if (await visitaExiste(item.clifor, item.data_agenda)) {
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

export interface NovaVisita {
  clifor: number
  data: string
  hora: string
  /** Intervalo de repetição em dias; 0 = não repetir. */
  dias: number
}

export async function incluirVisita({ clifor, data, hora, dias }: NovaVisita): Promise<void> {
  if (!clifor || !data || !hora) throw new Error('Informe Cliente/Data/Hora da Visita.')
  if (await visitaExiste(clifor, data)) throw new Error('Já existe visita deste cliente para a data informada.')
  const diaSemana = new Date(`${data}T00:00:00`).getDay() + 1
  await run(
    'INSERT INTO visitas (clifor, data, hora, data_agenda, latitude, longitude) VALUES (?,?,?,?,0,0)',
    [clifor, data, hora, data],
  )
  await run("INSERT INTO agenda(clifor, data_base, dia, hora, dias, snvis) VALUES (?,?,?,?,?,'N')", [
    clifor, data, String(diaSemana), hora, dias,
  ])
}
