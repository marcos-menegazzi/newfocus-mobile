import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { FileOpener } from '@capacitor-community/file-opener'
import { jsPDF } from 'jspdf'
import { query } from '../../db/connection'
import { formatNumero, formatReal, mudadata } from '../../lib/format'

interface CabecalhoImpressao {
  fantasia?: string
  data: string
  cliente?: string
  razao?: string
  documento?: string
  codcliente?: number
  endereco?: string
  numero?: string
  bairro?: string
  cidade?: string
  estado?: string
  tabela?: number
  tabela_nome?: string
  condicao?: string
  operacao?: string
  total: number
  retsuc?: number
  obsped?: string
}

interface ItemImpressao {
  codigo: string
  produto: string
  qtd: number
  unidade?: string
  vlunit: number
  vltotal: number
  peso?: number
}

interface BlocoImpresso {
  altura: number
  desenhar: (y: number) => void
}

export function gerarPdfPedido(numpedido: string | number, cab: CabecalhoImpressao, itens: ItemImpressao[]): jsPDF {
  const largura = 57
  const margem = 3.5
  const direita = largura - margem
  const area = direita - margem
  const alturaMaxima = 1000
  const doc = new jsPDF({ unit: 'mm', format: [largura, alturaMaxima] })
  doc.setProperties({ title: `Pedido ${numpedido}` })
  doc.setLineWidth(0.18)

  const blocos: BlocoImpresso[] = []
  const estilo = (tamanho: number, negrito = false, cinza = 0) => {
    doc.setFont('helvetica', negrito ? 'bold' : 'normal')
    doc.setFontSize(tamanho)
    doc.setTextColor(cinza)
  }

  function texto(valor: unknown, tamanho = 8, negrito = false, cinza = 0): BlocoImpresso[] {
    const conteudo = String(valor ?? '').trim()
    if (!conteudo) return []
    estilo(tamanho, negrito, cinza)
    const linhas: string[] = doc.splitTextToSize(conteudo, area)
    return linhas.map((linha) => ({
      altura: tamanho * 0.46,
      desenhar(y) {
        estilo(tamanho, negrito, cinza)
        doc.text(linha, margem, y, { baseline: 'top' })
      },
    }))
  }

  function linha(y: number, cinza = 170) {
    doc.setDrawColor(cinza)
    doc.line(margem, y, direita, y)
  }

  function secao(titulo: string): BlocoImpresso {
    return {
      altura: 7,
      desenhar(y) {
        linha(y + 1)
        estilo(7, true)
        doc.text(titulo, margem, y + 3, { baseline: 'top' })
      },
    }
  }

  function valorAlinhado(valor: string, x: number, y: number, espaco: number, tamanho: number, negrito = false) {
    estilo(tamanho, negrito)
    const medida = doc.getTextWidth(valor)
    if (medida > espaco) doc.setFontSize(tamanho * espaco / medida)
    doc.text(valor, x, y, { align: 'right', baseline: 'top' })
  }

  const colunas = [margem + 13, margem + 31, direita - 1.2]
  const espacos = [13, 16, 16]
  function numericos(valores: string[], y: number, titulo = false) {
    valores.forEach((valor, indice) => {
      valorAlinhado(valor, colunas[indice], y, espacos[indice], 7.5, titulo || indice === 2)
    })
  }

  function resumo(rotulo: string, valor: string, total = false): BlocoImpresso {
    return {
      altura: total ? 8 : 4,
      desenhar(y) {
        if (total) {
          doc.setFillColor(235, 235, 235)
          doc.rect(margem, y + 0.5, area, 7, 'F')
        }
        const topo = y + (total ? 2.4 : 0)
        estilo(total ? 9 : 8, total)
        doc.text(rotulo, margem + (total ? 1.5 : 0), topo, { baseline: 'top' })
        valorAlinhado(valor, direita - (total ? 1.5 : 0), topo, 28, total ? 9 : 8, total)
      },
    }
  }

  const identificacao = [
    ...texto(cab.fantasia, 10, true),
    ...texto(`Pedido ${numpedido}`, 12, true),
    ...texto(mudadata(cab.data), 8, false, 70),
  ]
  const cliente = cab.cliente?.trim() || cab.razao?.trim()
  const endereco = [cab.endereco, cab.numero, cab.bairro].filter(Boolean).join(', ')
  const cidade = [cab.cidade, cab.estado].filter(Boolean).join(' - ')
  const dadosCliente = [
    cab.codcliente && `Cód. ${cab.codcliente}`,
    cab.documento,
  ].filter(Boolean).join('  |  ')
  const tabela = cab.tabela_nome || cab.tabela
  const condicoes = [
    cab.condicao && `Pagamento: ${cab.condicao}`,
    tabela && `Tabela de preço: ${tabela}`,
    cab.operacao && `Operação: ${cab.operacao}`,
  ].filter(Boolean)

  blocos.push(
    secao('CLIENTE'),
    ...texto(cliente || 'Cliente não informado', 9, true),
    ...texto(cab.razao?.trim() !== cliente ? cab.razao : '', 8, false, 70),
    ...texto(dadosCliente, 7.5),
    ...texto(endereco),
    ...texto(cidade),
    secao('CONDIÇÕES'),
    ...condicoes.flatMap((condicao) => texto(condicao)),
  )
  if (!condicoes.length) blocos.push(...texto('Condições não informadas.'))

  const cabecalhoItens: BlocoImpresso = {
    altura: 12,
    desenhar(y) {
      secao('PRODUTOS').desenhar(y)
      doc.setFillColor(235, 235, 235)
      doc.rect(margem, y + 7, area, 4, 'F')
      numericos(['Qtd.', 'Unit. (R$)', 'Total (R$)'], y + 7.5, true)
    },
  }
  const produtos = itens.map((item): BlocoImpresso => {
    const descricao = texto([item.codigo, item.produto].filter(Boolean).join(' - '), 8, true)
    const unidade = texto(item.unidade?.trim() ? `Unidade: ${item.unidade.trim()}` : '', 7, false, 70)
    const detalhes = [...descricao, ...unidade]
    return {
      altura: detalhes.reduce((altura, bloco) => altura + bloco.altura, 6),
      desenhar(y) {
        for (const detalhe of detalhes) {
          detalhe.desenhar(y)
          y += detalhe.altura
        }
        numericos([formatNumero(item.qtd, 6), formatReal(item.vlunit), formatReal(item.vltotal)], y)
        linha(y + 4.4, 205)
      },
    }
  })
  if (!produtos.length) {
    blocos.push(secao('PRODUTOS'), ...texto('Nenhum produto no pedido.'))
  }

  const bruto = itens.reduce((soma, item) => soma + Number(item.vlunit || 0) * Number(item.qtd || 0), 0)
  const total = Number(cab.total || 0)
  const peso = itens.reduce((soma, item) => soma + Number(item.qtd || 0) * Number(item.peso || 0), 0)
  const totais = [
    secao('RESUMO'),
    resumo('Bruto', `R$ ${formatReal(bruto)}`),
    resumo('Desconto', `R$ ${formatReal(bruto - total)}`),
    resumo('Peso', `${formatNumero(peso)} kg`),
    ...(Number(cab.retsuc) ? [resumo('Ret. sucata', `${formatNumero(cab.retsuc)} kg`)] : []),
    resumo('Total', `R$ ${formatReal(total)}`, true),
  ]
  const observacoes = texto(cab.obsped)
  const assinatura: BlocoImpresso = {
    altura: 15,
    desenhar(y) {
      linha(y + 9, 90)
      estilo(8)
      doc.text('Assinatura', largura / 2, y + 11, { align: 'center', baseline: 'top' })
    },
  }

  const paginas: BlocoImpresso[][] = [[]]
  let altura = 0
  const somarAltura = (grupo: BlocoImpresso[]) => grupo.reduce((soma, bloco) => soma + bloco.altura, 0)
  function incluir(grupo: BlocoImpresso[], repetir?: BlocoImpresso) {
    const alturaGrupo = somarAltura(grupo)
    if (altura + alturaGrupo > alturaMaxima - 2 * margem - 6) {
      const continuacao = [...texto(`Pedido ${numpedido}`, 9, true), ...(repetir ? [repetir] : [])]
      paginas.push(continuacao)
      altura = somarAltura(continuacao)
    }
    paginas[paginas.length - 1].push(...grupo)
    altura += alturaGrupo
  }
  incluir([...identificacao, ...blocos])
  produtos.forEach((produto, i) => incluir(i === 0 ? [cabecalhoItens, produto] : [produto], i === 0 ? undefined : cabecalhoItens))
  incluir(totais)
  if (observacoes.length) {
    const tituloObs = secao('OBSERVAÇÕES')
    incluir([tituloObs, observacoes[0]])
    observacoes.slice(1).forEach((linhaObs) => incluir([linhaObs], tituloObs))
  }
  incluir([assinatura])

  paginas.forEach((pagina, indice) => {
    const rodape = paginas.length > 1 ? 6 : 0
    doc.addPage([largura, Math.max(largura, somarAltura(pagina) + 2 * margem + rodape)], 'portrait')
    let y = margem
    for (const bloco of pagina) {
      bloco.desenhar(y)
      y += bloco.altura
    }
    if (rodape) {
      estilo(7, false, 70)
      doc.text(`${indice + 1} / ${paginas.length}`, direita, y + 2, { align: 'right', baseline: 'top' })
    }
  })
  doc.deletePage(1)
  return doc
}

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export async function imprimirPedido(numpedido: string | number): Promise<void> {
  const [cab] = await query<CabecalhoImpressao>(
    `SELECT e.fantasia, p.data, c.fantasia AS cliente, c.razao, c.cnpj AS documento,
            d.descr AS condicao, p.total, c.cidade, c.estado, p.obsped, p.operacao,
            p.tabela, t.descricao AS tabela_nome, p.retsuc, c.endereco, c.bairro,
            c.numero, c.codigo AS codcliente
     FROM ped p
     JOIN empresas e ON e.empresa = p.empresa
     JOIN clifor c ON c.codigo = p.clifor
     JOIN condicao d ON d.codigo = p.condpag
     LEFT JOIN tpreco t ON t.codigo = p.tabela
     WHERE p.numpedido = ?`,
    [numpedido],
  )
  if (!cab) throw new Error('Pedido não encontrado')

  const itens = await query<ItemImpressao>(
    `SELECT p.codigo, p.descricao AS produto, m.qtd, m.unidade, m.vlunit, m.vltotal, p.peso
     FROM produtos p, mped m
     WHERE p.codigo = m.codproduto AND m.numpedido = ?
     GROUP BY m.idpedido ORDER BY m.idpedido`,
    [numpedido],
  )

  const doc = gerarPdfPedido(numpedido, cab, itens)

  if (Capacitor.isNativePlatform()) {
    const base64 = bufToBase64(doc.output('arraybuffer'))
    const written = await Filesystem.writeFile({
      path: `${numpedido}.pdf`,
      data: base64,
      directory: Directory.Data,
    })
    await FileOpener.open({ filePath: written.uri, contentType: 'application/pdf' })
  } else {
    window.open(URL.createObjectURL(doc.output('blob')), '_blank')
  }
}
