import { expect, it, vi } from 'vitest'
import { useOcupado } from './useOcupado'

it('ignora novos toques até a ação terminar, mesmo com erro', async () => {
  const { ocupado, executar } = useOcupado()
  let falhar!: (e: Error) => void
  const acao = vi.fn(() => new Promise<void>((_, reject) => { falhar = reject }))
  const primeira = executar('nfe-1', acao)
  await executar('nfe-1', acao)
  await executar('boleto-1', acao)
  expect(acao).toHaveBeenCalledOnce()
  expect(ocupado.value).toBe('nfe-1')

  falhar(new Error('rede'))
  await expect(primeira).rejects.toThrow('rede')
  expect(ocupado.value).toBeNull()
})
