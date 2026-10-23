import { CapacitorHttp } from '@capacitor/core'

export const WS_PATH = '/NewAgeWebServiceSetup/EASWebService.asmx?op=executarComando'

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
    `<tem:comando>${comando}</tem:comando>` +
    `<tem:CostumerId>${costumerId}</tem:CostumerId>` +
    `<tem:strUsername>${username}</tem:strUsername>` +
    `<tem:strPassword>${password}</tem:strPassword>` +
    `</tem:executarComando>` +
    `</soapenv:Body>` +
    `</soapenv:Envelope>`
}

export async function soapCommand(opts: SoapCommandOptions): Promise<Document> {
  const url = `https://${opts.server}${WS_PATH}`
  const data = buildEnvelope(opts.comando, opts.costumerId, opts.username, opts.password)

  const res = await CapacitorHttp.post({
    url,
    headers: { 'Content-Type': 'text/xml' },
    data,
    connectTimeout: 15000,
    readTimeout: 0,
  })

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`SOAP HTTP ${res.status}`)
  }

  return new DOMParser().parseFromString(res.data as string, 'text/xml')
}

export function text(doc: Document, tag: string): string {
  const node = doc.getElementsByTagName(tag)[0]
  if (!node || !node.childNodes[0]) return ''
  return node.childNodes[0].nodeValue ?? ''
}
