import { CapacitorHttp } from '@capacitor/core'

export const WS_PATH = '/NewAgeWebServiceSetup/EASWebService.asmx?op=executarComando'

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export class SoapHttpError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`SOAP HTTP ${status}`)
    this.name = 'SoapHttpError'
    this.status = status
  }
}

// Tempo máximo sem receber dados (no Android 0 é espera infinita). Fica acima
// do executionTimeout padrão do ASP.NET (110 s), que derruba a requisição antes.
const READ_TIMEOUT_MS = 120000

export interface SoapCommandOptions {
  server: string
  comando: string
  costumerId: string
  username: string
  password: string
}

export function buildEnvelope(
  comando: string,
  costumerId: string,
  username: string,
  password: string,
): string {
  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">` +
    `<soapenv:Header/>` +
    `<soapenv:Body>` +
    `<tem:executarComando>` +
    `<tem:comando>${escapeXml(comando)}</tem:comando>` +
    `<tem:CostumerId>${escapeXml(costumerId)}</tem:CostumerId>` +
    `<tem:strUsername>${escapeXml(username)}</tem:strUsername>` +
    `<tem:strPassword>${escapeXml(password)}</tem:strPassword>` +
    `</tem:executarComando>` +
    `</soapenv:Body>` +
    `</soapenv:Envelope>`
}

export async function soapCommand(opts: SoapCommandOptions): Promise<Document> {
  const server = opts.server.replace(/^https?:\/\//i, '')
  const url = `https://${server}${WS_PATH}`
  const data = buildEnvelope(opts.comando, opts.costumerId, opts.username, opts.password)

  let res
  try {
    res = await CapacitorHttp.post({
      url,
      headers: { 'Content-Type': 'text/xml' },
      data,
      connectTimeout: 15000,
      readTimeout: READ_TIMEOUT_MS,
    })
  } catch (e) {
    if (e instanceof Error && /timed? ?out/i.test(e.message)) {
      throw new Error('O servidor demorou demais para responder. Tente novamente.')
    }
    throw e
  }

  if (res.status < 200 || res.status >= 300) {
    throw new SoapHttpError(res.status)
  }

  return new DOMParser().parseFromString(res.data as string, 'text/xml')
}

export function text(doc: Document, tag: string): string {
  const retorno = doc.getElementsByTagName('retorno')[0]
  if (!retorno) return ''
  const node = retorno.getElementsByTagName(tag)[0]
  if (!node || !node.childNodes[0]) return ''
  return node.childNodes[0].nodeValue ?? ''
}
