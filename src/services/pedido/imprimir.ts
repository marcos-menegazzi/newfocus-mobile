import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { FileOpener } from '@capacitor-community/file-opener'
import { jsPDF } from 'jspdf'
import { query } from '../../db/connection'
import { formatReal, mudadata } from '../../lib/format'

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export async function imprimirPedido(numpedido: string | number): Promise<void> {
  const [cab] = await query<any>(
    `SELECT e.fantasia, p.data, c.fantasia AS cliente, d.descr AS condicao, p.total, c.cidade, c.estado, p.obsped, p.operacao, p.tabela, p.retsuc, c.endereco, c.bairro, c.numero, c.codigo AS codcliente
     FROM empresas e, clifor c, condicao d, ped p
     WHERE e.empresa = p.empresa AND p.clifor = c.codigo AND p.condpag = d.codigo AND p.numpedido = ?
     ORDER BY p.numpedido`,
    [numpedido],
  )
  if (!cab) throw new Error('Pedido não encontrado')

  const itens = await query<any>(
    `SELECT p.codigo, p.descricao AS produto, m.qtd, m.vlunit, m.descto, m.vltotal, p.peso
     FROM produtos p, mped m
     WHERE p.codigo = m.codproduto AND m.numpedido = ?
     GROUP BY m.idpedido ORDER BY m.idpedido`,
    [numpedido],
  )

  const obs = String(cab.obsped ?? '')
  const obsLength = (obs.length / 55) * 7.6
  const pagina = 350 + itens.length * 15 + obsLength + 40

  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: [57, pagina] })
  doc.setFont('times', 'normal')
  doc.setFontSize(10)

  doc.text(String(cab.fantasia ?? ''), 0, 5)
  doc.text(`PEDIDO: ${numpedido} ${mudadata(cab.data)}`, 0, 10)
  doc.text(`${cab.codcliente} - ${cab.cliente}`, 0, 15)
  doc.text(`${cab.endereco}, ${cab.numero}, ${cab.bairro}`, 0, 20)
  doc.text(`${cab.cidade} ${cab.estado}`, 0, 25)
  doc.text(`Tab. Preco: ${cab.tabela}`, 0, 30)
  doc.text(`Cond. Pgto: ${cab.condicao}`, 0, 35)
  doc.text(`Operacao: ${cab.operacao}`, 0, 40)

  doc.text('===================================', 0, 45)

  let y = 50
  for (const i of itens) {
    doc.text(`${i.codigo} - ${i.produto}`, 0, y)
    doc.text(formatReal(i.vlunit), 5, y + 5)
    doc.text(String(i.qtd), 25, y + 5)
    doc.text(formatReal(i.vltotal), 40, y + 5)
    y += 15
  }

  doc.text('===================================', 0, y)
  y += 5

  const totbruto = itens.reduce((acc, i) => acc + Number(i.vlunit || 0) * Number(i.qtd || 0), 0)
  const total = Number(cab.total || 0)
  const peso = itens.reduce((acc, i) => acc + Number(i.qtd || 0) * Number(i.peso || 0), 0)

  doc.text(`T.BRUTO: ${formatReal(totbruto)}`, 0, y)
  y += 5
  doc.text(`DESC: ${formatReal(totbruto - total)}`, 0, y)
  y += 5
  doc.text(`TL: ${formatReal(total)}`, 0, y)
  y += 5
  doc.text(`PESO: ${formatReal(peso)} KG(s)`, 0, y)
  y += 5
  if (cab.retsuc) {
    doc.text(`Ret. Sucata: ${formatReal(cab.retsuc)} KG(s)`, 0, y)
    y += 5
  }

  y += 5
  const obsLines = doc.splitTextToSize(`Obs.: ${obs}`, 55)
  doc.text(obsLines, 0, y)
  y += obsLines.length * 5
  doc.text('__________________________', 0, y)
  y += 10
  doc.text('Assinatura', 0, y)

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
