/** Abre o seletor nativo de data/hora ao tocar em qualquer ponto do campo. */
export function abrirSeletor(e: Event) {
  const el = e.currentTarget as HTMLInputElement
  try {
    el.showPicker?.()
  } catch {
    // Navegador sem suporte ou seletor já aberto: o toque nativo resolve.
  }
}
