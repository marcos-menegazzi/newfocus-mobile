import { defineStore } from 'pinia'
import { soapCommand, text } from '../services/soap'
import { run, query } from '../db/connection'
import { SCHEMA_VERSION } from '../db/schema'
import type { LoginInput, LoginResult, Usuario } from '../types'

export function parseLogin(doc: Document): LoginResult | null {
  if (text(doc, 'result') !== 'True') return null
  const num = parseFloat(text(doc, 'seqpedido'))
  return {
    estoque: text(doc, 'estoque'),
    bloqueia: text(doc, 'bloqueia'),
    dias: text(doc, 'dias'),
    libera: text(doc, 'libera'),
    sincprod: text(doc, 'sincprod'),
    limcred: text(doc, 'limcred'),
    bloqemp: text(doc, 'bloqemp'),
    bloqcli: text(doc, 'bloqcli'),
    libmin: text(doc, 'libmin'),
    snos: text(doc, 'snos'),
    altcli: text(doc, 'altcli'),
    obscli: text(doc, 'obscli'),
    finped: text(doc, 'finmob'),
    sequencia: Number.isFinite(num) ? num : 0,
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    usuario: null as Usuario | null,
    loggedIn: false,
  }),
  actions: {
    async login(input: LoginInput): Promise<void> {
      const comando = `P_LGWEB:EXEC("${input.usuario}","${input.senha}","${input.licenciada}", "${SCHEMA_VERSION}")`
      const doc = await soapCommand({
        server: input.server,
        comando,
        costumerId: input.id,
        username: input.usuario.toUpperCase(),
        password: input.senha.toUpperCase(),
      })

      const r = parseLogin(doc)
      if (!r) throw new Error('usuário ou senha inválidos')

      const usuario: Usuario = {
        codlic: parseFloat(input.licenciada),
        usuario: input.usuario.toUpperCase(),
        senha: input.senha.toUpperCase(),
        estoque: r.estoque,
        server: input.server.trim().toLowerCase(),
        id: input.id.trim().toLowerCase(),
        versao: SCHEMA_VERSION,
        bloqueia: r.bloqueia,
        dias: parseFloat(r.dias),
        libera: r.libera,
        sincprod: r.sincprod,
        limcred: r.limcred,
        bloqemp: r.bloqemp,
        bloqcli: r.bloqcli,
        libmin: r.libmin,
        snos: r.snos,
        altcli: r.altcli,
        obscli: r.obscli,
        finped: r.finped,
      }

      await run(
        `INSERT INTO usuario(codlic, usuario, senha, estoque, server, id, versao, bloqueia, dias, libera, sincprod, prodsinc, limcred, bloqemp, bloqcli, libmin, snos, altcli, obscli, finped)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          usuario.codlic, usuario.usuario, usuario.senha, usuario.estoque, usuario.server,
          usuario.id, usuario.versao, usuario.bloqueia, usuario.dias, usuario.libera,
          usuario.sincprod, 'S', usuario.limcred, usuario.bloqemp, usuario.bloqcli,
          usuario.libmin, usuario.snos, usuario.altcli, usuario.obscli, usuario.finped,
        ],
      )

      if (r.sequencia >= 1) {
        await run('INSERT INTO numped(numped) VALUES (?)', [r.sequencia])
      }

      this.usuario = usuario
      this.loggedIn = true
    },

    async loadSession(): Promise<boolean> {
      const rows = await query<Usuario>('SELECT * FROM usuario')
      if (rows.length < 1) return false
      this.usuario = rows[0]
      this.loggedIn = true
      return true
    },

    async logout(): Promise<void> {
      await run('DELETE FROM usuario')
      this.usuario = null
      this.loggedIn = false
    },
  },
})
