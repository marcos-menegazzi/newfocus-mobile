import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { FileOpener } from '@capacitor-community/file-opener'
import { useAuthStore } from '../stores/auth'

export function pasta(): string {
  const id = useAuthStore().usuario?.id?.toLowerCase() ?? ''
  if (id === 'voltplus_homologa') return 'volth'
  if (id === 'voltplus_desenv') return 'voltdesenv'
  return id
}

export function pdfUrl(rel: string): string {
  const u = useAuthStore().usuario
  const server = (u?.server ?? '').replace(/^https?:\/\//i, '')
  return `https://${server}/${pasta()}/${rel}`
}

export async function openPdf(url: string): Promise<void> {
  const name = url.split('/').pop() ?? 'doc.pdf'
  if (Capacitor.isNativePlatform()) {
    const res = await Capacitor.getPlatform() === 'web'
      ? null
      : await fetch(url).then((r) => r.blob())
    if (res) {
      const base64 = await blobToBase64(res)
      const written = await Filesystem.writeFile({ path: name, data: base64, directory: Directory.Data })
      await FileOpener.open({ filePath: written.uri, contentType: 'application/pdf' })
      return
    }
  }
  window.open(url, '_blank')
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve((r.result as string).split(',')[1])
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}
