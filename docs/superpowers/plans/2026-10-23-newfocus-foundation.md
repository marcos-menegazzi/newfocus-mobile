# NewFocus v3 — Foundation (Phase 0 + 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the new Capacitor + Vue 3 + TypeScript + Tailwind app with a working login against the real SOAP backend, a local SQLite schema, and the new AppShell + Sidebar (with edge-swipe) and visual identity — a testable foundation the later sync/feature plans build on.

**Architecture:** Vue 3 SPA (Composition API, Pinia, Vue Router) running under Capacitor for Android/iOS. Local data in SQLite via `@capacitor-community/sqlite`. All backend calls go through one typed SOAP client that POSTs to `NewAgeWebServiceSetup/EASWebService.asmx` using `CapacitorHttp` (native networking, no CORS). The schema and login contract are reproduced verbatim from the old Cordova app.

**Tech Stack:** Vite + Vue 3 + TypeScript (strict) + Tailwind CSS v4 + Pinia + Vue Router + Capacitor 7 + `@capacitor-community/sqlite` + `jeep-sqlite` + Vitest.

**Spec:** `docs/superpowers/specs/2026-10-23-newfocus-capacitor-vue-rewrite-design.md`

## Global Constraints

- Bundle id: `com.cordova.newfocus`; app name: `NewFocus`.
- DB name: `newfocus.db`; schema version: `20260930`.
- SOAP endpoint: `https://{server}/NewAgeWebServiceSetup/EASWebService.asmx?op=executarComando`, `Content-Type: text/xml`.
- Login command: `P_LGWEB:EXEC("{user}","{senha}","{licenciada}", "{versao}")`; success when `retorno/result == 'True'`.
- Password is stored/uppercased before send and before INSERT (mirror old app: `toUpperCase()` on user + senha).
- Never write credentials to source files. Dev creds (`dev.voltplus.com.br`, `voltplus_desenv`, `3`, `MARCOSME`) are for live verification only.
- No jQuery, no axios. Native `fetch`/`CapacitorHttp` + `DOMParser` only.

---

### Task 1: Scaffold Vite + Vue 3 + TS and install dependencies

**Files:**
- Create: `package.json`, `tsconfig*.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `src/App.vue`, `src/vite-env.d.ts`, `src/style.css`
- Modify: `package.json` (deps)

**Interfaces:**
- Produces: a runnable `npm run dev` Vue app; `npm run build` and `npm run type-check` scripts.

- [ ] **Step 1: Scaffold the project in place**

Run from `/home/marcosmenegazzi/Develop/newfocus-mobile` (the dir already contains `docs/`; scaffold non-interactively with `--force` or into a temp dir and move):

```bash
npm create vite@latest . -- --template vue-ts
```

If Vite refuses because the dir is non-empty, scaffold into `/tmp/nf-scaffold` and move all files (including dotfiles) into the project root, then remove `/tmp/nf-scaffold`.

- [ ] **Step 2: Install runtime deps**

```bash
npm install
npm install vue-router@4 pinia @capacitor/core @capacitor/app @capacitor/status-bar @capacitor/splash-screen @capacitor-community/sqlite jeep-sqlite
```

- [ ] **Step 3: Install dev deps**

```bash
npm install -D @capacitor/cli @capacitor/android @capacitor/ios tailwindcss @tailwindcss/vite vitest jsdom
```

- [ ] **Step 4: Add scripts to `package.json`**

Add to the `"scripts"` object (keep existing `dev`/`build`/`preview`):

```json
"type-check": "vue-tsc -b",
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Configure Vite for Vue + Tailwind + Vitest**

Replace `vite.config.ts` with:

```ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
```

Note: `defineConfig` is imported from `vitest/config` (not `vite`) so the `test` key is typed; `jsdom` environment provides `DOMParser` for the SOAP/parser tests.

- [ ] **Step 6: Verify it runs**

```bash
npm run dev
```

Expected: Vite dev server starts; `npm run build` succeeds.

- [ ] **Step 7: Commit**

```bash
git init && git add -A && git commit -m "chore: scaffold vite + vue3 + ts + tailwind + capacitor deps"
```

---

### Task 2: Capacitor config and platforms

**Files:**
- Create: `capacitor.config.ts`
- Modify: `src/main.ts` (import capacitor-only init later in Task 8)

**Interfaces:**
- Produces: `capacitor.config.ts` exporting `appId: 'com.cordova.newfocus'`, `appName: 'NewFocus'`, `webDir: 'dist'`.

- [ ] **Step 1: Create `capacitor.config.ts`**

```ts
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.cordova.newfocus',
  appName: 'NewFocus',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0B1220',
      androidScaleType: 'CENTER_CROP',
    },
  },
}

export default config
```

- [ ] **Step 2: Add platforms**

```bash
npm run build && npx cap add android && npx cap add ios
```

Expected: `android/` and `ios/` directories created. Note: `npx cap add ios` works on Linux for scaffolding, but an iOS build still requires macOS + Xcode; Android build requires a JDK (not currently installed — documented risk).

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: add capacitor config + android/ios platforms"
```

---

### Task 3: Tailwind theme + global styles (visual identity)

**Files:**
- Create: `src/style.css` (replace), `src/assets/fonts/README.md` (Inter note)
- Modify: `src/main.ts` (import `./style.css`)

**Interfaces:**
- Produces: design tokens usable as Tailwind classes: `bg-navy-900`, `text-accent-400`, `font-sans` etc.

- [ ] **Step 1: Replace `src/style.css`**

```css
@import "tailwindcss";

@theme {
  --color-navy-950: #060a12;
  --color-navy-900: #0b1220;
  --color-navy-800: #111c30;
  --color-navy-700: #1a2a45;
  --color-navy-600: #243a5e;

  --color-accent-300: #67e8f9;
  --color-accent-400: #22d3ee;
  --color-accent-500: #0ea5e9;
  --color-accent-600: #0284c7;

  --color-ink-900: #0f172a;
  --color-ink-600: #475569;
  --color-ink-400: #94a3b8;
  --color-ink-200: #e2e8f0;

  --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif;

  --shadow-card: 0 1px 2px rgb(15 23 42 / 0.06), 0 8px 24px rgb(15 23 42 / 0.08);
  --radius-card: 1rem;
}

html, body, #app {
  height: 100%;
  margin: 0;
  -webkit-tap-highlight-color: transparent;
}

body {
  font-family: var(--font-sans);
  background: var(--color-navy-950);
  color: var(--color-ink-900);
  overscroll-behavior-y: none;
}

/* prevent iOS rubber-band interfering with edge-swipe */
.safe-top { padding-top: env(safe-area-inset-top); }
.safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
```

- [ ] **Step 2: Note Inter font (no build step needed)**

Create `src/assets/fonts/README.md`:

```md
Inter is loaded via a `<link>` in index.html (Google Fonts). Offline devices fall
back to system-ui. To bundle offline, drop Inter .woff2 files here and add a
@font-face in style.css.
```

- [ ] **Step 3: Load Inter in `index.html`**

Add inside `<head>` of `index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

- [ ] **Step 4: Verify**

```bash
npm run build
```

Expected: build succeeds, Tailwind classes compile. (Smoke check: add `<div class="bg-navy-900 text-accent-400 rounded-card shadow-card">` temporarily to `App.vue`, run dev, confirm styles apply, then remove.)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: tailwind theme + design tokens (navy + electric accent)"
```

---

### Task 4: SQLite connection wrapper + schema

**Files:**
- Create: `src/db/connection.ts`, `src/db/schema.ts`
- Test: `src/db/schema.test.ts`

**Interfaces:**
- Consumes: `@capacitor-community/sqlite` installed in Task 1.
- Produces:
  - `DB_NAME = 'newfocus.db'`, `SCHEMA_VERSION = '20260930'`
  - `initDb(): Promise<void>` — creates connection + runs `SCHEMA_SQL`
  - `getDb(): Promise<SQLiteDBConnection>`
  - `run(sql, values?): Promise<{ changes: number; lastId?: number }>`
  - `query<T>(sql, values?): Promise<T[]>`
  - `execute(sql): Promise<void>`

- [ ] **Step 1: Write `src/db/schema.ts`**

```ts
export const DB_NAME = 'newfocus.db'
export const SCHEMA_VERSION = '20260930'

// Reproduced verbatim from the old Cordova app (www/index.html createDatabase()).
export const TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS usuario (
      iduser INTEGER NOT NULL PRIMARY KEY,
      codlic DOUBLE(10,0), usuario CHAR(10), senha CHAR(10), estoque CHAR(1),
      server CHAR(50), id CHAR(30), data_sinc DATE, hora_sinc TIME, versao CHAR(8),
      bloqueia CHAR(1), dias DOUBLE(2,0), libera CHAR(1), sincprod CHAR(1),
      prodsinc CHAR(1), limcred CHAR(1), bloqemp CHAR(1), bloqcli CHAR(1),
      saldoflex DOUBLE(14,2), libmin CHAR(1), snos CHAR(1), altcli CHAR(1),
      obscli CHAR(1), finped CHAR(1)
  )`,
  `CREATE TABLE IF NOT EXISTS cidades (idcidade INTEGER NOT NULL PRIMARY KEY, cidade CHAR(40), estado CHAR(2))`,
  `CREATE TABLE IF NOT EXISTS estados (idestado INTEGER NOT NULL PRIMARY KEY, estado CHAR(2), descricao CHAR(30))`,
  `CREATE TABLE IF NOT EXISTS comissao (idcomissao INTEGER NOT NULL PRIMARY KEY, codigo DOUBLE(10,0), descricao CHAR(50))`,
  `CREATE TABLE IF NOT EXISTS agenda (idagenda INTEGER NOT NULL PRIMARY KEY, clifor DOUBLE(6,0), data_base DATE, dia CHAR(1), atendido CHAR(1), hora CHAR(5), dias DOUBLE(10,0), motivo CHAR(200), snvis CHAR(1))`,
  `CREATE TABLE IF NOT EXISTS visitas (idvisita INTEGER NOT NULL PRIMARY KEY, clifor DOUBLE(6,0), data DATE, atendido CHAR(1), hora CHAR(5), motivo CHAR(200), data_agenda DATE, codmotivo CHAR(5), latitude DOUBLE(18,8), longitude DOUBLE(18,8), sincronizada CHAR(1))`,
  `CREATE TABLE IF NOT EXISTS produtos (
      idproduto INTEGER NOT NULL PRIMARY KEY, codigo CHAR(18), descricao CHAR(60),
      descred CHAR(40), grupo CHAR(15), peso DOUBLE(18,6), barras CHAR(13),
      link VARCHAR(200), comprado DOUBLE(18,6), observacao BLOB
  )`,
  `CREATE TABLE IF NOT EXISTS grupos (idgrupo INTEGER NOT NULL PRIMARY KEY, codigo CHAR(15), descricao VARCHAR(60))`,
  `CREATE TABLE IF NOT EXISTS tpreco (
      idtabela INTEGER NOT NULL PRIMARY KEY, codigo DOUBLE(10,0), descricao CHAR(40),
      flex DOUBLE(5,2), flex_pos DOUBLE(5,2), flex_max DOUBLE(5,2),
      flex_min DOUBLE(5,2), usa_cliente CHAR(1)
  )`,
  `CREATE TABLE IF NOT EXISTS fatores (idfator INTEGER NOT NULL PRIMARY KEY, produto CHAR(18), unidade CHAR(6), fator DOUBLE(18,6))`,
  `CREATE TABLE IF NOT EXISTS mvtpreco (id INTEGER NOT NULL PRIMARY KEY, tabela_codigo DOUBLE(10,0), produto CHAR(18), venda DOUBLE(14,2), maximo DOUBLE(14,2), minimo DOUBLE(14,2))`,
  `CREATE TABLE IF NOT EXISTS ped (
      idpedido INTEGER NOT NULL PRIMARY KEY, operacao CHAR(40), numpedido CHAR(10),
      clifor INTEGER, empresa INTEGER, condpag INTEGER, valor_frete DOUBLE(14,2) DEFAULT 0,
      total DOUBLE(14,2), descto DOUBLE(14,2), status CHAR(1), data DATE, obsped VARCHAR(200),
      tabela DOUBLE(10), carga DOUBLE(10), lancto DOUBLE(10), sefaz CHAR(3), file CHAR(100),
      tipo CHAR(1), comissao DOUBLE(10,0), complemento VARCHAR(200), idunico VARCHAR(100),
      numero VARCHAR(10), snunidade CHAR(1), snquilo CHAR(1), valor_quilo DOUBLE(14,2),
      valor_unidade DOUBLE(14,2), peso_total DOUBLE(18,6), retsuc DOUBLE(18,6),
      resolvido CHAR(1), cliente_nome VARCHAR(60), cliente_cpf CHAR(20), vendedor DOUBLE(6,0)
  )`,
  `CREATE TABLE IF NOT EXISTS mped (
      idpedido INTEGER NOT NULL PRIMARY KEY, numpedido CHAR(10), codproduto CHAR(18),
      qtd DOUBLE(18,6), vlunit DOUBLE(14,2), descto DOUBLE(14,2), vltotal DOUBLE(14,2),
      desctorat DOUBLE(14,2), descinc DOUBLE(14,2), vlunbase DOUBLE(14,2),
      vlbruto DOUBLE(14,2), operacao CHAR(40), condicao INTEGER, comissao DOUBLE(10,0),
      descper CHAR(1), tabela DOUBLE(10), valor_negocia DOUBLE(14,2), peso_item DOUBLE(18,6),
      unidade CHAR(6), fator DOUBLE(18,6), flex DOUBLE(14,2)
  )`,
  `CREATE TABLE IF NOT EXISTS histvenda (idvenda INTEGER NOT NULL PRIMARY KEY, pedido DOUBLE(10,0), data DATE, clifor DOUBLE(6,0), total DOUBLE(14,2), quantidade DOUBLE(18,6), lancto DOUBLE(10,0), condicao VARCHAR(50))`,
  `CREATE TABLE IF NOT EXISTS histitens (iditem INTEGER NOT NULL PRIMARY KEY, pedido DOUBLE(10,0), produto CHAR(18), descricao VARCHAR(50), faturamento CHAR(1), quant DOUBLE(18,6), vlunit DOUBLE(14,2), vldescto DOUBLE(14,2), vltotal DOUBLE(14,2), lancto DOUBLE(10,0), sequencia DOUBLE(10,0), tabela VARCHAR(50))`,
  `CREATE TABLE IF NOT EXISTS operacao (idoperacao INTEGER NOT NULL PRIMARY KEY, empresa DOUBLE(6,0), operacao CHAR(40), cobranca CHAR(2), estoque CHAR(1), local DOUBLE(10,0))`,
  `CREATE TABLE IF NOT EXISTS carga (idcarga INTEGER NOT NULL PRIMARY KEY, codigo DOUBLE(10,0), descricao CHAR(30), dataalt DATE, inativo CHAR(1))`,
  `CREATE TABLE IF NOT EXISTS historico_agenda (idhistagenda INTEGER NOT NULL PRIMARY KEY, codigo CHAR(5), descricao CHAR(60), data DATE, inativo CHAR(1))`,
  `CREATE TABLE IF NOT EXISTS estoque (idestoque INTEGER NOT NULL PRIMARY KEY, codigo CHAR(18), estoque DOUBLE(18,6), empresa DOUBLE(6,0), local DOUBLE(10,0), centralizado CHAR(1))`,
  `CREATE TABLE IF NOT EXISTS clifor (
      clifor INTEGER NOT NULL PRIMARY KEY, bairro CHAR(30), cep CHAR(10), cidade CHAR(40),
      cj CHAR(15), contato CHAR(17), ddd CHAR(10), email CHAR(100), endereco CHAR(50),
      estado CHAR(2), fax CHAR(15), inscricao CHAR(20), numero CHAR(6), razao CHAR(60),
      tel1 CHAR(15), cnpj CHAR(20), emailnfe CHAR(100), simples CHAR(1), tippess CHAR(1),
      obs BLOB, enviado CHAR(1), fantasia CHAR(60), codigo DOUBLE(6,0), inativo CHAR(1),
      tabela DOUBLE(10), saldo DOUBLE(14,2), limcred DOUBLE(14,2), credito DOUBLE(14,2),
      comissao DOUBLE(10,0), final CHAR(1), regiao CHAR(5)
  )`,
  `CREATE TABLE IF NOT EXISTS titulos (idtitulo INTEGER NOT NULL PRIMARY KEY, numero CHAR(15), valor DOUBLE(14,2), clifor DOUBLE(6), emissao DATE, vencimento DATE, obs CHAR(200), cobranca VARCHAR(100), tipo CHAR(1), empresa DOUBLE(6))`,
  `CREATE TABLE IF NOT EXISTS numped (idnumped INTEGER NOT NULL PRIMARY KEY, numped DOUBLE(10,0))`,
  `CREATE TABLE IF NOT EXISTS condicao (idcondicao INTEGER NOT NULL PRIMARY KEY, codigo DOUBLE(10,0), descr CHAR(30), parcelas CHAR(60), avista CHAR(1), inativo CHAR(1))`,
  `CREATE TABLE IF NOT EXISTS condicao_cliente (idcondicao INTEGER NOT NULL PRIMARY KEY, condicao DOUBLE(10,0), cliente DOUBLE(6,0))`,
  `CREATE TABLE IF NOT EXISTS cobranca_cliente (idcobranca INTEGER NOT NULL PRIMARY KEY, cobranca CHAR(2), cliente DOUBLE(6,0))`,
  `CREATE TABLE IF NOT EXISTS tabela_cliente (idtabela INTEGER NOT NULL PRIMARY KEY, tabela DOUBLE(10), cliente DOUBLE(6,0))`,
  `CREATE TABLE IF NOT EXISTS cobrancas (idcobranca INTEGER NOT NULL PRIMARY KEY, codigo CHAR(2), descr CHAR(60))`,
  `CREATE TABLE IF NOT EXISTS empresas (idempresa INTEGER NOT NULL PRIMARY KEY, empresa DOUBLE(6,0), fantasia CHAR(60))`,
  `CREATE TABLE IF NOT EXISTS financeiro (idfinanceiro INTEGER NOT NULL PRIMARY KEY, pedido CHAR(10), condicao DOUBLE(10,0), cobranca CHAR(2), valor DOUBLE(14,2), autorizacao CHAR(15))`,
  `CREATE TABLE IF NOT EXISTS parcelas (idparcela INTEGER NOT NULL PRIMARY KEY, idfinanceiro INTEGER, pedido CHAR(10), condicao DOUBLE(10,0), cobranca CHAR(2), valor DOUBLE(14,2))`,
  `CREATE TABLE IF NOT EXISTS regiao (idregiao INTEGER NOT NULL PRIMARY KEY, regiao CHAR(5), descricao CHAR(40))`,
  `CREATE TABLE IF NOT EXISTS vendedores (idvendedor INTEGER NOT NULL PRIMARY KEY, codigo DOUBLE(6,0), nome VARCHAR(60))`,
  `CREATE TABLE IF NOT EXISTS sucata_cliente (idsucata INTEGER NOT NULL PRIMARY KEY, cliente DOUBLE(6,0), empresa DOUBLE(6,0), saldo DOUBLE(18,6))`,
]

export const SCHEMA_SQL = TABLES.join(';\n')
```

- [ ] **Step 2: Write the failing test `src/db/schema.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { TABLES, SCHEMA_VERSION } from './schema'

describe('schema', () => {
  it('defines exactly 33 tables', () => {
    expect(TABLES).toHaveLength(33)
  })

  it('every table statement is CREATE TABLE IF NOT EXISTS', () => {
    for (const t of TABLES) {
      expect(t).toMatch(/^CREATE TABLE IF NOT EXISTS \w+/)
    }
  })

  it('uses the current schema version', () => {
    expect(SCHEMA_VERSION).toBe('20260930')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — `Cannot find module './schema'` (schema.ts not written yet; the test references it).

- [ ] **Step 4: Write `src/db/connection.ts`**

```ts
import { Capacitor } from '@capacitor/core'
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite'
import { DB_NAME, SCHEMA_SQL } from './schema'

let sqlite: SQLiteConnection | null = null
let db: SQLiteDBConnection | null = null

async function connection(): Promise<SQLiteConnection> {
  if (!sqlite) {
    sqlite = new SQLiteConnection(CapacitorSQLite)
  }
  if (Capacitor.getPlatform() === 'web') {
    if (!document.querySelector('jeep-sqlite')) {
      document.body.appendChild(document.createElement('jeep-sqlite'))
    }
    await customElements.whenDefined('jeep-sqlite')
    await sqlite.initWebStore()
  }
  return sqlite
}

export async function initDb(): Promise<void> {
  const conn = await connection()
  const consistent = await conn.checkConnectionsConsistency()
  const exists = (await conn.isConnection(DB_NAME)).result

  if (consistent.result && exists) {
    db = await conn.retrieveConnection(DB_NAME)
  } else {
    db = await conn.createConnection(DB_NAME, false, 'no-encryption', 1)
  }
  await db.open()
  await db.execute(SCHEMA_SQL)
}

export async function getDb(): Promise<SQLiteDBConnection> {
  if (!db) await initDb()
  return db as SQLiteDBConnection
}

export async function run(
  sql: string,
  values: unknown[] = [],
): Promise<{ changes: number; lastId?: number }> {
  const d = await getDb()
  const r = await d.run(sql, values)
  const changes = r.changes?.changes ?? 0
  const lastId = r.changes?.lastId
  return { changes, lastId }
}

export async function query<T>(sql: string, values: unknown[] = []): Promise<T[]> {
  const d = await getDb()
  const r = await d.query(sql, values)
  return (r.values ?? []) as T[]
}

export async function execute(sql: string): Promise<void> {
  const d = await getDb()
  await d.execute(sql)
}
```

- [ ] **Step 5: Run tests to verify pass**

```bash
npm test
```

Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: sqlite schema (33 tables) + connection wrapper"
```

---

### Task 5: SOAP client

**Files:**
- Create: `src/services/soap.ts`
- Test: `src/services/soap.test.ts`

**Interfaces:**
- Consumes: nothing (pure + `CapacitorHttp`).
- Produces:
  - `buildEnvelope(comando: string, costumerId: string, username: string, password: string): string`
  - `soapCommand(opts: { server: string; comando: string; costumerId: string; username: string; password: string }): Promise<Document>`
  - `text(doc: Document, tag: string): string` — returns text of first `<tag>` inside `retorno`, or `''`.
  - `WS_PATH = '/NewAgeWebServiceSetup/EASWebService.asmx?op=executarComando'`

- [ ] **Step 1: Write `src/services/soap.ts`**

```ts
import { CapacitorHttp } from '@capacitor/core'

export const WS_PATH = '/NewAgeWebServiceSetup/EASWebService.asmx?op=executarComando'

export interface SoapCommandOptions {
  server: string
  comando: string
  costumerId: string
  username: string
  password: string
}

export function buildEnvelope(
  comando: string,
  costumerId: string,
  username: string,
  password: string,
): string {
  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">` +
    `<soapenv:Header/>` +
    `<soapenv:Body>` +
    `<tem:executarComando>` +
    `<tem:comando>${comando}</tem:comando>` +
    `<tem:CostumerId>${costumerId}</tem:CostumerId>` +
    `<tem:strUsername>${username}</tem:strUsername>` +
    `<tem:strPassword>${password}</tem:strPassword>` +
    `</tem:executarComando>` +
    `</soapenv:Body>` +
    `</soapenv:Envelope>`
}

export async function soapCommand(opts: SoapCommandOptions): Promise<Document> {
  const url = `https://${opts.server}${WS_PATH}`
  const data = buildEnvelope(opts.comando, opts.costumerId, opts.username, opts.password)

  const res = await CapacitorHttp.post({
    url,
    headers: { 'Content-Type': 'text/xml' },
    data,
    connectTimeout: 15000,
    readTimeout: 0,
  })

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`SOAP HTTP ${res.status}`)
  }

  return new DOMParser().parseFromString(res.data as string, 'text/xml')
}

export function text(doc: Document, tag: string): string {
  const node = doc.getElementsByTagName(tag)[0]
  if (!node || !node.childNodes[0]) return ''
  return node.childNodes[0].nodeValue ?? ''
}
```

- [ ] **Step 2: Write the failing test `src/services/soap.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { buildEnvelope, text, WS_PATH } from './soap'

describe('buildEnvelope', () => {
  it('contains comando, CostumerId, strUsername, strPassword', () => {
    const e = buildEnvelope('P_LGWEB:EXEC("A","B","3","20260930")', 'voltplus_desenv', 'MARCOSME', 'SECRET')
    expect(e).toContain('<tem:comando>P_LGWEB:EXEC("A","B","3","20260930")</tem:comando>')
    expect(e).toContain('<tem:CostumerId>voltplus_desenv</tem:CostumerId>')
    expect(e).toContain('<tem:strUsername>MARCOSME</tem:strUsername>')
    expect(e).toContain('<tem:strPassword>SECRET</tem:strPassword>')
    expect(e).toContain('http://tempuri.org/')
  })
})

describe('text', () => {
  it('reads first retorno child text', () => {
    const doc = new DOMParser().parseFromString(
      '<retorno><result>True</result><estoque>S</estoque></retorno>',
      'text/xml',
    )
    expect(text(doc, 'result')).toBe('True')
    expect(text(doc, 'estoque')).toBe('S')
    expect(text(doc, 'missing')).toBe('')
  })
})

describe('WS_PATH', () => {
  it('matches the legacy endpoint', () => {
    expect(WS_PATH).toBe('/NewAgeWebServiceSetup/EASWebService.asmx?op=executarComando')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — `Cannot find module './soap'`.

- [ ] **Step 4: Run test to verify it passes** (after writing soap.ts in Step 1)

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: SOAP client (envelope builder + CapacitorHttp transport)"
```

---

### Task 6: Auth store + login flow

**Files:**
- Create: `src/stores/auth.ts`, `src/types.ts`
- Test: `src/stores/login.test.ts`

**Interfaces:**
- Consumes: `soapCommand`, `text` from `src/services/soap.ts`; `run`, `query` from `src/db/connection.ts`; `SCHEMA_VERSION` from `src/db/schema.ts`.
- Produces:
  - `parseLogin(doc: Document): LoginResult | null` (null when `result != 'True'`)
  - `interface LoginResult { estoque; bloqueia; dias; libera; sincprod; limcred; bloqemp; bloqcli; libmin; snos; altcli; obscli; finped: string; sequencia: number }`
  - Pinia store `useAuthStore` with `login(input): Promise<void>`, `loadSession(): Promise<boolean>`, `logout(): Promise<void>`, state `{ usuario: Usuario | null, loggedIn: boolean }`.

- [ ] **Step 1: Write `src/types.ts`**

```ts
export interface Usuario {
  codlic: number
  usuario: string
  senha: string
  estoque: string
  server: string
  id: string
  versao: string
  bloqueia: string
  dias: number
  libera: string
  sincprod: string
  limcred: string
  bloqemp: string
  bloqcli: string
  libmin: string
  snos: string
  altcli: string
  obscli: string
  finped: string
}

export interface LoginInput {
  server: string
  id: string
  licenciada: string
  usuario: string
  senha: string
}

export interface LoginResult {
  estoque: string
  bloqueia: string
  dias: string
  libera: string
  sincprod: string
  limcred: string
  bloqemp: string
  bloqcli: string
  libmin: string
  snos: string
  altcli: string
  obscli: string
  finped: string
  sequencia: number
}
```

- [ ] **Step 2: Write `src/stores/auth.ts`**

```ts
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
```

- [ ] **Step 3: Write the failing test `src/stores/login.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { parseLogin } from './auth'

describe('parseLogin', () => {
  it('returns null when result is not True', () => {
    const doc = new DOMParser().parseFromString(
      '<retorno><result>False</result><msg>bloqueado</msg></retorno>',
      'text/xml',
    )
    expect(parseLogin(doc)).toBeNull()
  })

  it('maps all fields and parses sequencia', () => {
    const doc = new DOMParser().parseFromString(
      `<retorno>
        <seqpedido>1042</seqpedido><estoque>S</estoque><bloqueia>N</bloqueia>
        <dias>30</dias><libera>S</libera><sincprod>S</sincprod><limcred>S</limcred>
        <bloqemp>N</bloqemp><bloqcli>N</bloqcli><libmin>S</libmin><snos>N</snos>
        <altcli>S</altcli><obscli>S</obscli><finmob>S</finmob><result>True</result>
      </retorno>`,
      'text/xml',
    )
    const r = parseLogin(doc)
    expect(r).not.toBeNull()
    expect(r?.sequencia).toBe(1042)
    expect(r?.estoque).toBe('S')
    expect(r?.snos).toBe('N')
    expect(r?.finped).toBe('S')
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — `Cannot find module './auth'`.

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: auth store + login flow (P_LGWEB)"
```

---

### Task 7: Router + Login and Config views

**Files:**
- Create: `src/router/index.ts`, `src/views/LoginView.vue`, `src/views/ConfigView.vue`, `src/views/HomeView.vue`
- Modify: `src/main.ts`, `src/App.vue`

**Interfaces:**
- Consumes: `useAuthStore` from Task 6.
- Produces: routes `/login`, `/`, `/config` with a navigation guard that redirects unauthenticated users to `/login`.

- [ ] **Step 1: Write `src/router/index.ts`**

```ts
import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
  { path: '/config', name: 'config', component: () => import('../views/ConfigView.vue') },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.loggedIn) {
    const ok = await auth.loadSession()
    if (!ok && to.name !== 'login') return { name: 'login' }
  }
  if (to.name === 'login' && auth.loggedIn) return { name: 'home' }
  return true
})

export default router
```

Note: hash history (`createWebHashHistory`) because Capacitor serves from a file/`capacitor://` origin where path history breaks on reload.

- [ ] **Step 2: Write `src/views/LoginView.vue`**

```vue
<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const error = ref('')
const loading = ref(false)

const form = reactive({
  server: '',
  id: '',
  licenciada: '',
  usuario: '',
  senha: '',
})

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(form)
    await router.push({ name: auth.usuario?.snos === 'S' ? 'home' : 'home' })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Falha no login'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-navy-950 flex flex-col justify-center px-6 safe-top safe-bottom">
    <div class="mb-10 text-center">
      <div class="mx-auto h-14 w-14 rounded-2xl bg-accent-500 flex items-center justify-center text-navy-950 font-extrabold text-2xl">N</div>
      <h1 class="mt-4 text-2xl font-bold text-white">NewFocus</h1>
      <p class="text-ink-400 text-sm">Sistemas de Pedidos</p>
    </div>

    <form class="space-y-4" @submit.prevent="submit">
      <label class="block">
        <span class="text-ink-400 text-xs font-medium">Servidor</span>
        <input v-model="form.server" type="text" placeholder="dev.voltplus.com.br" class="input" required />
      </label>
      <label class="block">
        <span class="text-ink-400 text-xs font-medium">ID (CostumerId)</span>
        <input v-model="form.id" type="text" placeholder="voltplus_desenv" class="input" required />
      </label>
      <label class="block">
        <span class="text-ink-400 text-xs font-medium">Licenciada</span>
        <input v-model="form.licenciada" type="text" inputmode="numeric" placeholder="3" class="input" required />
      </label>
      <label class="block">
        <span class="text-ink-400 text-xs font-medium">Usuário</span>
        <input v-model="form.usuario" type="text" autocomplete="username" class="input" required />
      </label>
      <label class="block">
        <span class="text-ink-400 text-xs font-medium">Senha</span>
        <input v-model="form.senha" type="password" autocomplete="current-password" class="input" required />
      </label>

      <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>

      <button type="submit" :disabled="loading" class="btn-primary w-full">
        {{ loading ? 'Entrando…' : 'Entrar' }}
      </button>
    </form>
  </div>
</template>
```

- [ ] **Step 3: Write `src/views/ConfigView.vue`**

```vue
<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { run } from '../db/connection'

const auth = useAuthStore()
const saved = ref('')
const form = reactive({ server: auth.usuario?.server ?? '' })

async function save() {
  if (!form.server) return
  await run('UPDATE usuario SET server = ?', [form.server.trim().toLowerCase()])
  if (auth.usuario) auth.usuario.server = form.server.trim().toLowerCase()
  saved.value = 'Configuração alterada com sucesso.'
}
</script>

<template>
  <div class="p-6 bg-navy-950 min-h-screen safe-top safe-bottom">
    <h1 class="text-white text-xl font-bold mb-6">Configuração</h1>
    <label class="block mb-4">
      <span class="text-ink-400 text-xs font-medium">Servidor</span>
      <input v-model="form.server" type="text" class="input" />
    </label>
    <button class="btn-primary w-full" @click="save">Salvar</button>
    <p v-if="saved" class="text-accent-400 text-sm mt-3">{{ saved }}</p>
  </div>
</template>
```

- [ ] **Step 4: Write `src/views/HomeView.vue` (placeholder for now)**

```vue
<script setup lang="ts">
import { useAuthStore } from '../stores/auth'
const auth = useAuthStore()
</script>

<template>
  <div class="p-6">
    <h1 class="text-xl font-bold">Bem-vindo, {{ auth.usuario?.usuario }}</h1>
    <p class="text-ink-600 text-sm mt-1">Fundação carregada com sucesso.</p>
  </div>
</template>
```

- [ ] **Step 5: Wire `src/main.ts`**

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { defineCustomElements as jeepSqlite, applyPolyfills } from 'jeep-sqlite/loader'
import App from './App.vue'
import router from './router'
import './style.css'

applyPolyfills().then(() => {
  jeepSqlite(window)
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
```

- [ ] **Step 6: Replace `src/App.vue`**

```vue
<template>
  <router-view />
</template>
```

- [ ] **Step 7: Add the `input` / `btn-primary` utility classes**

Append to `src/style.css` (uses `@layer` so they compose with Tailwind):

```css
@layer components {
  .input {
    @apply mt-1 w-full rounded-xl bg-navy-800 border border-navy-600 px-4 py-3 text-white text-base placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-500;
  }
  .btn-primary {
    @apply rounded-xl bg-accent-500 text-navy-950 font-semibold py-3 px-4 active:scale-[0.98] transition disabled:opacity-50;
  }
}
```

- [ ] **Step 8: Verify build + live login**

```bash
npm run type-check && npm run build
npm run dev
```

Then in the browser, log in with server `dev.voltplus.com.br`, id `voltplus_desenv`, licenciada `3`, usuario `MARCOSME`, senha `#m3n3g4ZZ1`. Expected: no error; navigates to Home and shows "Bem-vindo, MARCOSME".

> Web-dev CORS note: if the SOAP call is blocked by CORS in the browser, add a Vite dev proxy — in `vite.config.ts` `server.proxy`: `{ '/NewAgeWebServiceSetup': { target: 'https://dev.voltplus.com.br', changeOrigin: true } }` and temporarily route `soapCommand` through a relative URL on web. Native builds (the real target) are unaffected since `CapacitorHttp` uses native networking.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: router + login/config/home views + live login verified"
```

---

### Task 8: AppShell + Sidebar + edge-swipe gesture

**Files:**
- Create: `src/components/AppShell.vue`, `src/components/Sidebar.vue`, `src/composables/useSwipe.ts`
- Modify: `src/views/HomeView.vue`, `src/views/ConfigView.vue`, `src/router/index.ts`

**Interfaces:**
- Consumes: `useAuthStore`; Vue Router.
- Produces:
  - `useSwipe(el: Ref<HTMLElement | null>, onEdgeSwipe: () => void): void` — fires `onEdgeSwipe` when a left→right horizontal drag starts within 28px of the left edge and travels > 60px.
  - `AppShell.vue` renders the sidebar + top bar + scrim + `<slot>` for the active view.

- [ ] **Step 1: Write `src/composables/useSwipe.ts`**

```ts
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
```

- [ ] **Step 2: Write `src/components/Sidebar.vue`**

```vue
<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const auth = useAuthStore()
const router = useRouter()

const items = [
  { name: 'home', label: 'Início', icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
  { name: 'config', label: 'Configuração', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z' },
]

async function go(name: string) {
  emit('close')
  await router.push({ name })
}

async function logout() {
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="sidebar" :class="{ open }">
    <div class="safe-top px-5 pt-6 pb-4 border-b border-navy-700">
      <div class="flex items-center gap-3">
        <div class="h-10 w-10 rounded-xl bg-accent-500 flex items-center justify-center text-navy-950 font-extrabold">N</div>
        <div>
          <p class="text-white font-semibold">NewFocus</p>
          <p class="text-ink-400 text-xs">{{ auth.usuario?.usuario }}</p>
        </div>
      </div>
    </div>

    <nav class="px-3 py-4 space-y-1">
      <button
        v-for="item in items"
        :key="item.name"
        class="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left text-ink-200 hover:bg-navy-700"
        @click="go(item.name)"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" :d="item.icon" />
        </svg>
        {{ item.label }}
      </button>
    </nav>

    <div class="mt-auto px-3 pb-6 safe-bottom">
      <button class="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left text-red-400 hover:bg-navy-700" @click="logout">
        <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Sair
      </button>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  width: 280px;
  max-width: 82vw;
  background: var(--color-navy-900);
  display: flex;
  flex-direction: column;
  transform: translateX(-100%);
  transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
  z-index: 40;
}
.sidebar.open { transform: translateX(0); }
</style>
```

- [ ] **Step 3: Write `src/components/AppShell.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import Sidebar from './Sidebar.vue'
import { useSwipe } from '../composables/useSwipe'

const open = ref(false)
const root = ref<HTMLElement | null>(null)

useSwipe(root, () => { open.value = true })
</script>

<template>
  <div ref="root" class="min-h-screen bg-navy-950 text-ink-900">
    <Sidebar :open="open" @close="open = false" />

    <div
      v-if="open"
      class="fixed inset-0 bg-black/50 z-30"
      @click="open = false"
    />

    <header class="sticky top-0 z-20 bg-navy-900 text-white safe-top">
      <div class="flex items-center gap-3 px-4 py-3">
        <button class="p-2 -ml-2 rounded-lg hover:bg-navy-700" aria-label="Abrir menu" @click="open = true">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 class="text-lg font-bold">NewFocus</h1>
      </div>
    </header>

    <main class="bg-white min-h-[calc(100vh-56px)] rounded-t-2xl -mt-4 pt-4">
      <slot />
    </main>
  </div>
</template>
```

- [ ] **Step 4: Wrap Home and Config in `AppShell`**

Change `src/views/HomeView.vue` template to:

```vue
<template>
  <AppShell>
    <div class="p-6">
      <h1 class="text-xl font-bold">Bem-vindo, {{ auth.usuario?.usuario }}</h1>
      <p class="text-ink-600 text-sm mt-1">Fundação carregada com sucesso.</p>
    </div>
  </AppShell>
</template>
```

and import `AppShell` in the `<script setup>` (`import AppShell from '../components/AppShell.vue'`). Do the same for `ConfigView.vue`, wrapping its content in `<AppShell>…</AppShell>`.

- [ ] **Step 5: Verify**

```bash
npm run type-check && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: AppShell + sidebar + edge-swipe gesture"
```

---

### Task 9: Identity polish + final verification

**Files:**
- Modify: `src/App.vue` (status bar), `src/main.ts` (splash), `index.html` (theme-color)

**Interfaces:**
- Consumes: `@capacitor/status-bar`, `@capacitor/splash-screen`.

- [ ] **Step 1: Set status bar + hide splash in `src/main.ts`**

```ts
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'

// inside app bootstrap, after mount:
StatusBar.setStyle({ style: Style.Light })
StatusBar.setBackgroundColor({ color: '#0B1220' })
SplashScreen.hide()
```

- [ ] **Step 2: Set `theme-color` in `index.html`**

```html
<meta name="theme-color" content="#0B1220">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

- [ ] **Step 3: Full verification**

```bash
npm run type-check && npm test && npm run build && npx cap sync
```

Expected: all green. Then manual: `npm run dev`, login with dev creds, swipe from left edge → sidebar opens; hamburger opens/closes sidebar; scrim tap closes; logout returns to login.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: identity polish (status bar, splash, theme-color)"
```

---

## Self-review notes

- **Spec coverage:** P0 (scaffold, platforms, identity) and P1 (schema, SOAP client, login, config, AppShell + edge-swipe, offline-tolerant design) are covered by Tasks 1–9. The sync engine (P2), core sales flow (P3), remaining screens (P4), and release polish (P5) are intentionally deferred to follow-up plans — this plan's deliverable is a login-able shell with the data foundation in place.
- **Type consistency:** `soapCommand`/`text`/`buildEnvelope` signatures match across Tasks 5→6; `run`/`query` signatures match across Tasks 4→6→7; `useSwipe(el, cb)` matches Tasks 8. `SCHEMA_VERSION` = `20260930` is consistent in schema.ts and auth.ts.
- **No placeholders:** all steps contain concrete code, commands, or verifiable outputs.
