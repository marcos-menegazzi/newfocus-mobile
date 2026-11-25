import { afterEach, expect, it } from 'vitest'
import { esquecerRolagem, guardarRolagem, rolagem } from './rolagem'

afterEach(esquecerRolagem)

it('cada aba retoma a própria rolagem', () => {
  guardarRolagem({ name: 'clientes' }, 900)
  expect(rolagem({ name: 'pedidos' }, { name: 'clientes' }, null)).toEqual({ top: 0 })
  expect(rolagem({ name: 'clientes' }, { name: 'pedidos' }, null)).toEqual({ top: 900 })
})

it('tela nova começa do topo e voltar usa a posição do histórico', () => {
  guardarRolagem({ name: 'clientes' }, 900)
  guardarRolagem({ name: 'produto' }, 300)
  expect(rolagem({ name: 'produto' }, { name: 'clientes' }, null)).toEqual({ top: 0 })
  expect(rolagem({ name: 'clientes' }, { name: 'cliente-edit' }, null)).toEqual({ top: 0 })
  expect(rolagem({ name: 'clientes' }, { name: 'cliente-edit' }, { left: 0, top: 120 })).toEqual({ left: 0, top: 120 })
})

it('não interfere ao tocar na aba atual: a barra leva ao topo', () => {
  guardarRolagem({ name: 'clientes' }, 900)
  expect(rolagem({ name: 'clientes' }, { name: 'clientes' }, null)).toBe(false)
})

it('sair da conta esquece as posições', () => {
  guardarRolagem({ name: 'clientes' }, 900)
  esquecerRolagem()
  expect(rolagem({ name: 'clientes' }, { name: 'home' }, null)).toEqual({ top: 0 })
})
