import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { removechar } from './sync/helpers'

interface RespostaReceitaWs {
  status?: string
  message?: string
  nome?: string
  razao_social?: string
  fantasia?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cep?: string
  uf?: string
  municipio?: string
  telefone?: string
  email?: string
  simples?: { optante?: boolean }
}

const TEMPO_LIMITE = 15000
const INDISPONIVEL = 'Não foi possível consultar a ReceitaWS. Tente novamente em instantes.'

function consultarNoNavegador(url: string): Promise<unknown> {
  // JSONP é suportado pela API pública. O script roda em um iframe de origem isolada.
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe')
    frame.hidden = true
    frame.setAttribute('sandbox', 'allow-scripts')
    frame.referrerPolicy = 'no-referrer'

    function limpar() {
      window.clearTimeout(timer)
      window.removeEventListener('message', receber)
      frame.remove()
    }

    function receber(event: MessageEvent) {
      if (event.source !== frame.contentWindow || event.origin !== 'null') return
      if (event.data?.tipo === 'receitaws') {
        limpar()
        resolve(event.data.dados)
      } else if (event.data?.tipo === 'receitaws-erro') {
        limpar()
        reject(new Error(INDISPONIVEL))
      }
    }

    const timer = window.setTimeout(() => {
      limpar()
      reject(new Error('A ReceitaWS demorou para responder. Tente novamente.'))
    }, TEMPO_LIMITE)
    window.addEventListener('message', receber)
    frame.srcdoc = `<!doctype html>
      <script>
        function receberCnpj(dados) {
          parent.postMessage({ tipo: 'receitaws', dados }, '*')
        }
      </script>
      <script src="${url}?callback=receberCnpj" referrerpolicy="no-referrer"
        onerror="parent.postMessage({ tipo: 'receitaws-erro' }, '*')"></script>`
    document.body.append(frame)
  })
}

export async function consultarCnpj(cnpj: string) {
  if (!/^\d{14}$/.test(cnpj)) throw new Error('CNPJ inválido.')
  const url = `https://receitaws.com.br/v1/cnpj/${cnpj}`
  let dados: unknown

  if (Capacitor.isNativePlatform()) {
    let resposta
    try {
      resposta = await CapacitorHttp.get({
        url,
        responseType: 'json',
        connectTimeout: TEMPO_LIMITE,
        readTimeout: TEMPO_LIMITE,
      })
    } catch {
      throw new Error(INDISPONIVEL)
    }
    if (resposta.status === 429) {
      throw new Error('Limite de consultas da ReceitaWS atingido. Aguarde um minuto e tente novamente.')
    }
    if (resposta.status === 404) throw new Error('CNPJ não localizado na ReceitaWS.')
    if (resposta.status < 200 || resposta.status >= 300) throw new Error(INDISPONIVEL)
    dados = resposta.data
  } else {
    dados = await consultarNoNavegador(url)
  }

  if (!dados || typeof dados !== 'object') throw new Error(INDISPONIVEL)
  const r = dados as RespostaReceitaWs
  if (r.status === 'ERROR') {
    throw new Error(typeof r.message === 'string' && r.message.trim() ? r.message : 'CNPJ não localizado na ReceitaWS.')
  }
  const razao = r.razao_social?.trim() || r.nome?.trim()
  if (!razao) throw new Error('A ReceitaWS retornou dados incompletos para este CNPJ.')
  const telefone = r.telefone?.split('/')[0]?.replace(/\D/g, '') ?? ''
  return {
    razao,
    fantasia: r.fantasia?.trim() || razao,
    endereco: r.logradouro || '',
    numero: r.numero || '',
    cj: r.complemento || '',
    bairro: r.bairro || '',
    cep: r.cep || '',
    estado: r.uf || '',
    cidade: removechar(r.municipio ?? '').toUpperCase(),
    ddd: telefone.slice(0, 2),
    tel1: telefone.slice(2),
    email: r.email || '',
    emailnfe: r.email || '',
    simples: r.simples?.optante ? 'S' : 'N',
    tippess: 'N',
  }
}
