export function removechar(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/<+/g, '')
    .replace(/>+/g, '')
    .replace(/&+/g, '')
    .replace(/\[.*?\]/g, '')
}

export function trocachar(s: string): string {
  return (s ?? '').replace(/_1e/g, '&').replace(/sem_dados/g, '').replace(/'+/g, '')
}

/**
 * Campo no formato de colchetes que o servidor espera dentro do EXEC
 * (`[nome]valor[/nome]`). O valor é concatenado como no app legado, então
 * `null` vira o texto "null".
 */
export function tag(name: string, value: unknown): string {
  return `[${name}]${value}[/${name}]`
}

export function rowChildren(doc: Document, rootTag: string): Element[] {
  const root = doc.getElementsByTagName(rootTag)[0]
  if (!root) return []
  return Array.from(root.children)
}

export function childText(el: Element | undefined, tag: string): string {
  const n = el?.getElementsByTagName(tag)[0]
  if (!n || !n.childNodes[0]) return ''
  return n.childNodes[0].nodeValue ?? ''
}

/**
 * Linhas de uma lista do servidor que têm o campo `chave`. Sem registros, o servidor
 * devolve `<retorno><result>false</result></retorno>` em vez de uma lista vazia.
 */
export function linhas(doc: Document, rootTag: string, chave: string): Element[] {
  return rowChildren(doc, rootTag).filter((el) => el.getElementsByTagName(chave).length > 0)
}

/** Nome do arquivo em `<retorno><status/><arquivo/></retorno>`; falha se o servidor não o localizou. */
export function arquivoRetorno(doc: Document, naoLocalizado: string): string {
  const [status, arquivo] = rowChildren(doc, 'retorno')
  const nome = arquivo?.textContent?.trim() ?? ''
  if (!nome || status.textContent?.trim().toLowerCase() === 'false') throw new Error(naoLocalizado)
  return nome
}
