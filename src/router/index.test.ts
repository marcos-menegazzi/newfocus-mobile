import { describe, it, expect, vi, beforeEach } from 'vitest'

const auth = { loggedIn: true, isOs: false, homeRoute: 'home', loadSession: vi.fn(async () => true) }

vi.mock('../stores/auth', () => ({ useAuthStore: () => auth }))

import router from './index'

function as(os: boolean) {
  auth.isOs = os
  auth.homeRoute = os ? 'os' : 'home'
}

describe('router guard', () => {
  beforeEach(async () => {
    as(false)
    await router.push('/config')
  })

  it('sends an OS user away from sales screens to the OS overview', async () => {
    as(true)
    await router.push({ name: 'pedidos' })
    expect(router.currentRoute.value.name).toBe('os')
  })

  it('keeps sales users out of the OS screens', async () => {
    await router.push({ name: 'os-diario' })
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('lets both reach their own screens and the settings', async () => {
    as(true)
    await router.push({ name: 'os-diario' })
    expect(router.currentRoute.value.name).toBe('os-diario')
    await router.push({ name: 'config' })
    expect(router.currentRoute.value.name).toBe('config')
  })

  it('sends a logged-in user from login to their own home', async () => {
    as(true)
    await router.push({ name: 'login' })
    expect(router.currentRoute.value.name).toBe('os')
  })
})
