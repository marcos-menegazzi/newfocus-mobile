import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SoapHttpError } from '../soap'

const soapCommand = vi.fn()

vi.mock('../soap', async (orig) => ({
  ...(await orig<typeof import('../soap')>()),
  soapCommand: (...args: unknown[]) => soapCommand(...args),
}))

vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({ usuario: { server: 's', id: 'i', usuario: 'U', senha: 'P' } }),
}))

import { call } from './context'

const doc = new DOMParser().parseFromString('<retorno><ok/></retorno>', 'text/xml')

describe('call', () => {
  beforeEach(() => {
    soapCommand.mockReset()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('waits 3 seconds and repeats the same request after an HTTP 500', async () => {
    soapCommand.mockRejectedValueOnce(new SoapHttpError(500)).mockResolvedValueOnce(doc)
    const p = call('P_PRODWEB:EXEC(1)')
    await vi.advanceTimersByTimeAsync(2999)
    expect(soapCommand).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await expect(p).resolves.toBe(doc)
    expect(soapCommand).toHaveBeenCalledTimes(2)
    expect(soapCommand.mock.calls[1]).toEqual(soapCommand.mock.calls[0])
  })

  it('gives up after 3 retries and reports the error', async () => {
    soapCommand.mockRejectedValue(new SoapHttpError(500))
    const p = call('P_PRODWEB:EXEC(1)')
    const result = expect(p).rejects.toThrow('SOAP HTTP 500')
    await vi.advanceTimersByTimeAsync(9000)
    await result
    expect(soapCommand).toHaveBeenCalledTimes(4)
  })

  it('does not retry other failures', async () => {
    soapCommand.mockRejectedValue(new SoapHttpError(404))
    await expect(call('X')).rejects.toThrow('SOAP HTTP 404')
    expect(soapCommand).toHaveBeenCalledTimes(1)
  })
})
