import { call } from './sync/context'
import { childText, rowChildren } from './sync/helpers'

export interface Opt {
  codigo: string
  descricao: string
}

export interface HistoricoRow {
  os: string
  codigo: string
  tipo: string
  funcionario: string
  data: string
  valor: string
  registro: string
}

export interface Apontamento {
  data: string
  hora: string
}

export interface LancamentoDetalhe {
  codigo: string
  tipo: string
  os: string
  data: string
  hora: string
  valor: string
  obs: string
  funcionarios: Opt[]
  apontamentos: Apontamento[]
}

export interface Resultado {
  ok: boolean
  msg: string
}

const UPLOAD_URL = 'https://drive.voltplus.com.br/upload'
const API_KEY = 'TkVXRk9DVVMgT1MgTU9CSUxFIDIwMjI='

function parseOpts(doc: Document): Opt[] {
  return rowChildren(doc, 'retorno').map((el) => ({
    codigo: childText(el, 'codigo'),
    descricao: childText(el, 'descricao'),
  }))
}

export async function listarOs(): Promise<Opt[]> {
  return parseOpts(await call('P_OSWEB013:EXEC(1)'))
}

export async function listarContas(): Promise<Opt[]> {
  return parseOpts(await call('P_OSWEB013:EXEC(2)'))
}

export async function listarFuncionarios(os: string): Promise<Opt[]> {
  return parseOpts(await call(`P_OSWEB016:EXEC(${os})`))
}

export async function getFolderId(): Promise<string> {
  const doc = await call('P_OSWEB017:EXEC()')
  const retorno = doc.getElementsByTagName('retorno')[0]
  if (!retorno) return ''
  if (childText(retorno, 'status') !== 'Ok') return ''
  return childText(retorno, 'folder')
}

function b64ToBlob(b64: string): Blob {
  const base64 = b64.replace(/^data:image\/[a-z]+;base64,/, '')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: 'image/jpg' })
}

export async function uploadImage(base64: string): Promise<string> {
  const folderId = await getFolderId()
  if (!folderId) throw new Error('Não informado ID Pasta Drive.')
  const formData = new FormData()
  formData.append('folderId', folderId)
  formData.append('image', b64ToBlob(base64), 'image.jpg')
  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: { 'X-API-KEY': API_KEY },
    body: formData,
  })
  if (!res.ok) throw new Error(`Upload HTTP ${res.status}`)
  return (await res.text()).trim()
}

export function buildDespesaXml(input: {
  os: string
  conta: string
  data: string
  valor: number
  obs: string
  funcionarios: string[]
  image: string
}): string {
  const f = input.funcionarios.map((c) => `[funcionario]${c}[/funcionario]`).join('')
  return (
    '[lancamentos]' +
    `[os]${input.os}[/os]` +
    `[ctf]${input.conta}[/ctf]` +
    `[data]${input.data}[/data]` +
    `[valor]${input.valor}[/valor]` +
    `[obs]${input.obs}[/obs]` +
    `[funcionarios]${f}[/funcionarios]` +
    `[image]${input.image}[/image]` +
    '[latitude]0[/latitude][longitude]0[/longitude]' +
    '[/lancamentos]'
  )
}

export function buildDiarioXml(input: {
  os: string
  obs: string
  funcionarios: string[]
  apontamentos: Apontamento[]
  fotos: string[]
}): string {
  const f = input.funcionarios.map((c) => `[funcionario]${c}[/funcionario]`).join('')
  const a = input.apontamentos
    .map((x) => `[apontamento][data]${x.data}[/data][hora]${x.hora}[/hora][/apontamento]`)
    .join('')
  const ft = input.fotos.map((x) => `[foto]${x}[/foto]`).join('')
  return (
    '[lancamentos]' +
    `[os]${input.os}[/os]` +
    `[obs]${input.obs}[/obs]` +
    `[funcionarios]${f}[/funcionarios]` +
    `[apontamentos]${a}[/apontamentos]` +
    `[fotos]${ft}[/fotos]` +
    '[latitude]0[/latitude][longitude]0[/longitude]' +
    '[/lancamentos]'
  )
}

function parseResponse(doc: Document): Resultado {
  const retorno = doc.getElementsByTagName('retorno')[0]
  if (!retorno) return { ok: false, msg: 'Não foi possível ler o retorno' }
  const ok = childText(retorno, 'status') === 'Ok'
  return { ok, msg: ok ? 'Lançamento efetuado com sucesso' : childText(retorno, 'msg') }
}

export async function lancarDespesa(input: {
  os: string
  conta: string
  data: string
  valor: number
  obs: string
  funcionarios: string[]
  image: string
}): Promise<Resultado> {
  return parseResponse(await call(`P_OSWEB005:EXEC("${buildDespesaXml(input)}")`))
}

export async function lancarDiario(input: {
  os: string
  obs: string
  funcionarios: string[]
  apontamentos: Apontamento[]
  fotos: string[]
}): Promise<Resultado> {
  return parseResponse(await call(`P_OSWEB008:EXEC("${buildDiarioXml(input)}")`))
}

export async function listarHistorico(): Promise<HistoricoRow[]> {
  const doc = await call('P_OSWEB004:EXEC()')
  return rowChildren(doc, 'retorno').map((el) => ({
    os: childText(el, 'os'),
    codigo: childText(el, 'codigo'),
    tipo: childText(el, 'tipo'),
    funcionario: childText(el, 'funcionario'),
    data: childText(el, 'data'),
    valor: childText(el, 'valor'),
    registro: childText(el, 'registro'),
  }))
}

const EMPTY_DETALHE: LancamentoDetalhe = {
  codigo: '',
  tipo: '',
  os: '',
  data: '',
  hora: '',
  valor: '',
  obs: '',
  funcionarios: [],
  apontamentos: [],
}

export async function getDetalhe(reg: string, tipo: string): Promise<LancamentoDetalhe> {
  const doc = await call(`P_OSWEB019:EXEC(${reg}, "${tipo}")`)
  const retorno = doc.getElementsByTagName('retorno')[0]
  const row = retorno?.children[0]
  if (!row) return EMPTY_DETALHE
  return {
    codigo: childText(row, 'codigo'),
    tipo: childText(row, 'tipo'),
    os: childText(row, 'os'),
    data: childText(row, 'data'),
    hora: childText(row, 'hora'),
    valor: childText(row, 'valor'),
    obs: childText(row, 'obs'),
    funcionarios: rowChildren(doc, 'funcionarios').map((el) => ({
      codigo: childText(el, 'codigo'),
      descricao: childText(el, 'descricao'),
    })),
    apontamentos: rowChildren(doc, 'apontamentos').map((el) => ({
      data: childText(el, 'data'),
      hora: childText(el, 'hora'),
    })),
  }
}
