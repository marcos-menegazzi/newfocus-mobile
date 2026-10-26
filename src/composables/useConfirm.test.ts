import { describe, it, expect } from 'vitest'
import { useConfirm } from './useConfirm'

describe('useConfirm', () => {
  it('resolves with the answer and closes the dialog', async () => {
    const { state, confirmar, responder } = useConfirm()
    const p = confirmar({ title: 'Sair da conta?', confirmLabel: 'Sair', danger: true })
    expect(state.open).toBe(true)
    expect(state.title).toBe('Sair da conta?')
    responder(true)
    await expect(p).resolves.toBe(true)
    expect(state.open).toBe(false)
  })

  it('answers no to a pending question when a new one opens', async () => {
    const { confirmar, responder } = useConfirm()
    const first = confirmar({ title: 'A', confirmLabel: 'Ok' })
    const second = confirmar({ title: 'B', confirmLabel: 'Ok' })
    await expect(first).resolves.toBe(false)
    responder(true)
    await expect(second).resolves.toBe(true)
  })
})
