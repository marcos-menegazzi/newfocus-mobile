import { ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useConfirm } from './useConfirm'

/** Pergunta antes de sair de um formulário com dados que ainda não foram gravados. */
export function useSairSemSalvar(conteudo: () => unknown) {
  const { confirmar } = useConfirm()
  const foto = () => JSON.stringify(conteudo())
  const salvo = ref(foto())

  onBeforeRouteLeave(async (to) => {
    // Saindo da conta, a confirmação já foi feita no menu.
    if (to.name === 'login' || foto() === salvo.value) return true
    return confirmar({
      title: 'Sair sem salvar?',
      message: 'O que você preencheu nesta tela será perdido.',
      confirmLabel: 'Sair',
      cancelLabel: 'Continuar',
      danger: true,
    })
  })

  /** Marca o estado atual como gravado. */
  return { marcarSalvo: () => { salvo.value = foto() } }
}
