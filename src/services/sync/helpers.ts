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

export function rowChildren(doc: Document, rootTag: string): Element[] {
  const root = doc.getElementsByTagName(rootTag)[0]
  if (!root) return []
  return Array.from(root.children)
}

export function childText(el: Element, tag: string): string {
  const n = el.getElementsByTagName(tag)[0]
  if (!n || !n.childNodes[0]) return ''
  return n.childNodes[0].nodeValue ?? ''
}
