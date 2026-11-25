import { onBeforeUnmount } from 'vue'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { fecharOverlay } from './useOverlay'

type Voltar = (canGoBack: boolean) => unknown

// Um único ouvinte nativo: primeiro fecha o que está aberto por cima da tela; se não
// houver nada, vale o tratamento da tela mais recente.
const pilha: Voltar[] = []
let ouvinte: ReturnType<typeof App.addListener> | undefined

function ouvir() {
  ouvinte = App.addListener('backButton', async ({ canGoBack }) => {
    if (fecharOverlay()) return
    await pilha[pilha.length - 1]?.(canGoBack)
  })
  ouvinte.catch((e) => console.error('Falha ao ouvir o botão Voltar do Android', e))
}

function parar() {
  ouvinte?.then(
    (l) => l.remove().catch((e) => console.error('Falha ao remover o listener do Android', e)),
    () => {},
  )
  ouvinte = undefined
}

export function useBackButton(voltar: Voltar) {
  if (Capacitor.getPlatform() !== 'android') return
  if (pilha.length === 0) ouvir()
  pilha.push(voltar)
  onBeforeUnmount(() => {
    pilha.splice(pilha.indexOf(voltar), 1)
    if (pilha.length === 0) parar()
  })
}
