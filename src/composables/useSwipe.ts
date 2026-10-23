import { onBeforeUnmount, type Ref } from 'vue'

const EDGE = 28
const THRESHOLD = 60

export function useSwipe(
  el: Ref<HTMLElement | null>,
  onEdgeSwipe: () => void,
): void {
  let startX = 0
  let startY = 0
  let tracking = false

  function onStart(e: TouchEvent) {
    const t = e.touches[0]
    startX = t.clientX
    startY = t.clientY
    tracking = startX <= EDGE
  }

  function onMove(e: TouchEvent) {
    if (!tracking) return
    const t = e.touches[0]
    const dx = t.clientX - startX
    const dy = t.clientY - startY
    if (dx > THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      tracking = false
      onEdgeSwipe()
    }
  }

  function bind() {
    el.value?.addEventListener('touchstart', onStart, { passive: true })
    el.value?.addEventListener('touchmove', onMove, { passive: true })
  }

  function unbind() {
    el.value?.removeEventListener('touchstart', onStart)
    el.value?.removeEventListener('touchmove', onMove)
  }

  bind()

  onBeforeUnmount(unbind)
}
