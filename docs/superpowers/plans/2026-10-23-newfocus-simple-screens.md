# NewFocus v3 — Phase 3a: Simple screens (dashboard + list/detail)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Build the read-only/list/detail screens of the core sales flow as Vue routes, establishing the shared UI system (status chips, money/date formatting, PDF open, empty states) before the complex order builder (Phase 3b).

**Architecture:** Vue 3 SPA (hash router) + Pinia + Tailwind v4, on the existing foundation (SQLite `run`/`query`, SOAP `call`, `useAuthStore`, `AppShell`). Screens read from the synced SQLite tables and call a few feature SOAP commands (NF-e, boleto, extrato, garantias, títulos abertos, duplicata). All screens are wrapped in the existing `AppShell`.

**Tech Stack:** Vue 3 + TS + Tailwind + `@capacitor/filesystem` (PDF download) + `@capacitor-community/file-opener`.

**Spec:** `docs/superpowers/specs/2026-10-23-newfocus-capacitor-vue-rewrite-design.md`
**Legacy reference:** extracted from `www/index2.html`, `consulta_clientes.html`, `cadastro_cliente.html`, `consulta_produtos.html`, `consulta_pedidos.html`, `consulta_titulos.html`, `titulo.html`, `venda.html`.

## Global Constraints

- All screens use the existing `AppShell` (top bar + sidebar + edge-swipe). Screen-specific content lives in the white `<main>`.
- Currency: `formatReal(n)` → pt-BR "1.234,56" (no "R$" prefix, matching legacy). Date: `mudadata('YYYY-MM-DD')` → "DD/MM/YYYY".
- Order status colors (legacy): `A` Aberto (neutral), `F` Finalizado #58ACFA, `V` Aguardando Confirmação #EAB308 (yellow), `S` Sincronizado #22C55E (green), `Z` Faturado #0be1a4 (teal), `C` Cancelado #EF4444 (red). Render as a `StatusChip`.
- Route params replace legacy query strings: `/clientes/:idcliente` (edit), `/clientes/:idcliente/titulos`, `/titulos/:numero`, `/produtos/:codigo` (stub → Phase 4), `/pedidos/:numpedido` (Phase 3b), `/venda/:pedido`.
- PDF open: download to app data dir via `@capacitor/filesystem`, open via `@capacitor-community/file-opener`.
- PDF base URL: `https://{server}/{pasta}/{subdir}/{file}` where `pasta` = `voltdesenv` (dev id `voltplus_desenv`), `volth` (`voltplus_homologa`), else `id.toLowerCase()`.
- No jQuery/axios.

---

### Task 1: Shared utilities (format, last-sync, PDF)

**Files:**
- Create: `src/lib/format.ts`, `src/composables/useLastSync.ts`, `src/services/files.ts`
- Test: `src/lib/format.test.ts`

**Interfaces:**
- Produces:
  - `formatReal(n: number | string | null | undefined): string`
  - `mudadata(d: string): string`
  - `useLastSync()` → `{ lastSync: Ref<string> }` (formats `usuario.data_sinc + ' ' + hora_sinc`)
  - `openPdf(url: string): Promise<void>` (download + open)
  - `pasta(): string` (dev/homolog/prod folder from `usuario.id`)

- [ ] **Step 1: Write `src/lib/format.ts`**

```ts
export function formatReal(n: number | string | null | undefined): string {
  const v = typeof n === 'string' ? parseFloat(n) : n
  if (v == null || Number.isNaN(v)) return '0,00'
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
}

export function mudadata(d: string): string {
  if (!d || d.length < 10) return d ?? ''
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}
```

- [ ] **Step 2: Write the failing test `src/lib/format.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { formatReal, mudadata } from './format'

describe('formatReal', () => {
  it('formats pt-BR currency without R$', () => {
    expect(formatReal(1234.56)).toBe('1.234,56')
    expect(formatReal(0)).toBe('0,00')
    expect(formatReal(null)).toBe('0,00')
    expect(formatReal('99.9')).toBe('99,90')
  })
})

describe('mudadata', () => {
  it('converts YYYY-MM-DD to DD/MM/YYYY', () => {
    expect(mudadata('2026-10-23')).toBe('23/10/2026')
  })
})
```

- [ ] **Step 3: Run test (RED then GREEN)**

```bash
npm test -- src/lib/format.test.ts
```

- [ ] **Step 4: Write `src/composables/useLastSync.ts`**

```ts
import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'

export function useLastSync() {
  const auth = useAuthStore()
  const lastSync = computed(() => {
    const u = auth.usuario
    if (!u || !u.data_sinc) return 'Nunca sincronizado'
    return `${u.data_sinc} ${u.hora_sinc ?? ''}`.trim()
  })
  return { lastSync }
}
```

Note: `Usuario.data_sinc`/`hora_sinc` are not in the foundation `Usuario` type — add them as `data_sinc?: string`, `hora_sinc?: string` to `src/types.ts` `Usuario`.

- [ ] **Step 5: Write `src/services/files.ts`**

```ts
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { FileOpener } from '@capacitor-community/file-opener'
import { useAuthStore } from '../stores/auth'

export function pasta(): string {
  const id = useAuthStore().usuario?.id?.toLowerCase() ?? ''
  if (id === 'voltplus_homologa') return 'volth'
  if (id === 'voltplus_desenv') return 'voltdesenv'
  return id
}

export async function openPdf(url: string): Promise<void> {
  const name = url.split('/').pop() ?? 'doc.pdf'
  if (Capacitor.isNativePlatform()) {
    const res = await Capacitor.getPlatform() === 'web'
      ? null
      : await fetch(url).then((r) => r.blob())
    if (res) {
      const base64 = await blobToBase64(res)
      const written = await Filesystem.writeFile({ path: name, data: base64, directory: Directory.Data })
      await FileOpener.open({ filePath: written.uri, contentType: 'application/pdf' })
      return
    }
  }
  window.open(url, '_blank')
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve((r.result as string).split(',')[1])
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}
```

- [ ] **Step 6: Run type-check + commit**

```bash
npm run type-check
git add src/lib/format.ts src/lib/format.test.ts src/composables/useLastSync.ts src/services/files.ts src/types.ts
git commit -m "feat(ui): format + last-sync + pdf utilities"
```

---

### Task 2: Shared components + routes + sidebar menu

**Files:**
- Create: `src/components/StatusChip.vue`, `src/components/ScreenHeader.vue`, `src/components/EmptyState.vue`
- Modify: `src/router/index.ts`, `src/components/Sidebar.vue`

**Interfaces:**
- Produces: `<StatusChip :status="'S'" />`, `<ScreenHeader title="..." back />`, `<EmptyState label="..." />`; routes `/`, `/clientes`, `/clientes/:idcliente`, `/produtos`, `/pedidos`, `/titulos/:idcliente`, `/titulo/:numero`, `/venda/:pedido`; sidebar items.

- [ ] **Step 1: Write `StatusChip.vue`**

```vue
<script setup lang="ts">
const props = defineProps<{ status: string }>()
const MAP: Record<string, { label: string; cls: string }> = {
  A: { label: 'Aberto', cls: 'bg-ink-200 text-ink-600' },
  F: { label: 'Finalizado', cls: 'bg-blue-100 text-blue-700' },
  V: { label: 'Aguardando', cls: 'bg-yellow-100 text-yellow-700' },
  S: { label: 'Sincronizado', cls: 'bg-green-100 text-green-700' },
  Z: { label: 'Faturado', cls: 'bg-teal-100 text-teal-700' },
  C: { label: 'Cancelado', cls: 'bg-red-100 text-red-700' },
}
const chip = MAP[props.status] ?? { label: props.status, cls: 'bg-ink-200 text-ink-600' }
</script>

<template>
  <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="chip.cls">{{ chip.label }}</span>
</template>
```

- [ ] **Step 2: Write `ScreenHeader.vue`**

```vue
<script setup lang="ts">
import { useRouter } from 'vue-router'
defineProps<{ title: string }>()
const router = useRouter()
</script>

<template>
  <div class="flex items-center gap-3 mb-4">
    <button class="p-2 -ml-2 rounded-lg text-ink-600 hover:bg-ink-200" aria-label="Voltar" @click="router.back()">
      <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
    </button>
    <h1 class="text-lg font-bold text-ink-900">{{ title }}</h1>
  </div>
</template>
```

- [ ] **Step 3: Write `EmptyState.vue`**

```vue
<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <div class="py-12 text-center">
    <p class="text-ink-400 text-sm">{{ label }}</p>
  </div>
</template>
```

- [ ] **Step 4: Update `src/router/index.ts`**

Add routes (keep existing `login`/`home`/`config`):

```ts
{ path: '/clientes', name: 'clientes', component: () => import('../views/ConsultaClientesView.vue') },
{ path: '/clientes/:idcliente', name: 'cliente-edit', component: () => import('../views/CadastroClienteView.vue') },
{ path: '/produtos', name: 'produtos', component: () => import('../views/ConsultaProdutosView.vue') },
{ path: '/pedidos', name: 'pedidos', component: () => import('../views/ConsultaPedidosView.vue') },
{ path: '/titulos/:idcliente', name: 'titulos', component: () => import('../views/ConsultaTitulosView.vue') },
{ path: '/titulo/:numero', name: 'titulo', component: () => import('../views/TituloView.vue') },
{ path: '/venda/:pedido', name: 'venda', component: () => import('../views/VendaView.vue') },
```

- [ ] **Step 5: Update `Sidebar.vue` `items` array** (add these labels/names before Configuração; use simple home/shopping-cart icons already in the file):

```ts
{ name: 'clientes', label: 'Clientes', icon: 'M17 20h5v-2a4 4 0 00-5-4H7a4 4 0 00-4 4v2M9 12a4 4 0 100-8 4 4 0 000 8zM23 12a4 4 0 100-8 4 4 0 000 8z' },
{ name: 'produtos', label: 'Produtos', icon: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05' },
{ name: 'pedidos', label: 'Pedidos', icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11' },
```

- [ ] **Step 6: Run type-check + commit** (note: the views referenced by the new routes don't exist yet — create minimal placeholder views so `vue-tsc` passes; each placeholder is `<template><AppShell><EmptyState label="em construção"/></AppShell></template>` importing AppShell + EmptyState, replaced in later tasks).

```bash
npm run type-check
git add -A && git commit -m "feat(ui): status chip, screen header, empty state, routes, sidebar items"
```

---

### Task 3: Home dashboard (KPIs + last orders)

**Files:**
- Modify: `src/views/HomeView.vue`

**Interfaces:**
- Consumes: `query`, `formatReal`, `mudadata`, `StatusChip`, `useAuthStore`.
- Produces: dashboard KPIs (clientes/pedidos/produtos count + positivados), last 10 orders table.

SQL (verbatim, month = current month bounds `start`/`end` as `YYYY-MM-DD`):
- total clientes: `SELECT COUNT(*) AS total FROM CLIFOR`
- clientes positivados: `SELECT COUNT(DISTINCT(H.CLIFOR)) AS total FROM HISTVENDA H INNER JOIN HISTITENS I ON H.LANCTO = I.LANCTO WHERE H.DATA BETWEEN ? AND ? AND I.FATURAMENTO = 'S'`
- vendas do mês: `SELECT SUM(X.TOTAL) AS total, COUNT(*) AS quantidade FROM (SELECT H.PEDIDO, SUM(I.VLTOTAL) AS TOTAL FROM HISTVENDA H INNER JOIN HISTITENS I ON H.LANCTO = I.LANCTO WHERE H.DATA BETWEEN ? AND ? AND I.FATURAMENTO = 'S' GROUP BY H.PEDIDO, H.TOTAL) X`
- total produtos: `SELECT COUNT(DISTINCT(CODIGO)) AS total FROM PRODUTOS`
- produtos positivados: `SELECT COUNT(DISTINCT(I.PRODUTO)) AS total FROM HISTVENDA H INNER JOIN HISTITENS I ON H.LANCTO = I.LANCTO INNER JOIN PRODUTOS P ON P.CODIGO = I.PRODUTO WHERE H.DATA BETWEEN ? AND ? AND I.FATURAMENTO = 'S'`
- pendência: `SELECT COUNT(*) AS total FROM ped WHERE status = 'F'`
- últimos 10: `SELECT p.*, c.fantasia FROM ped p, clifor c WHERE c.codigo = p.clifor ORDER BY p.idpedido DESC LIMIT 10`

- [ ] **Step 1: Implement `HomeView.vue`** — three KPI cards (Clientes, Pedidos [vendas do mês + quantidade], Produtos), a pendência count, and a "Últimos Pedidos" list (nº pedido + fantasia + total + StatusChip), each row linking to `/pedidos` (não editable here). Use `formatReal`, `mudadata`.

- [ ] **Step 2: Type-check + commit**

```bash
npm run type-check
git add src/views/HomeView.vue && git commit -m "feat(ui): home dashboard (KPIs + last orders)"
```

---

### Task 4: consulta_clientes (client list + search)

**Files:**
- Create: `src/views/ConsultaClientesView.vue`

**Interfaces:**
- Consumes: `query`, `StatusChip` (reuse for "positivado" as a yes/no), `ScreenHeader`, `EmptyState`, `formatReal`.
- Produces: searchable client list with filter (Fantasia/Razão/Código/CNPJ/Cidade/Estado) + Positivado filter (Todos/Positivados/Não). Rows link to `/clientes/:idcliente`, `/titulos/:idcliente`, and extrato (P_EXTWEB), garantias (P_GTWEB).

SQL (parameterized — do NOT interpolate the field; use a whitelist map field→column):
- base: `SELECT c.*, (SELECT COUNT(*) FROM HISTVENDA H INNER JOIN HISTITENS I ON H.LANCTO = I.LANCTO WHERE H.DATA BETWEEN ? AND ? AND I.FATURAMENTO = 'S' AND H.CLIFOR = c.CODIGO) AS positivado FROM clifor c`
- + ` WHERE {col} LIKE ?` when search, + ` AND positivado > 0`/`< 1` when Positivado/Não filter (via HAVING on a wrapped subquery if needed — simplest: wrap as `SELECT * FROM (...) q WHERE q.positivado > 0`).

SOAP:
- Extrato: `P_EXTWEB:EXEC("{cliente}","{licenca}")` → root `retorno`, `status` (must be `Ok`) + `arquivo`; open `https://{server}/{pasta}/relatorio/li{licenca}/{arquivo}`.
- Garantias: `P_GTWEB:EXEC({cliente}, '{dtInicial}', '{dtFinal}', '{disposicao}', '{resolvido}')` → root `retorno`, children `codigo,produto,nota,disposicao,defeito_in,defeito_ex,obs`.

- [ ] **Step 1: Implement the view** (search inputs + list + extrato/garantias modals).

- [ ] **Step 2: Type-check + commit**

```bash
npm run type-check && git add src/views/ConsultaClientesView.vue && git commit -m "feat(ui): consulta clientes (search + extrato + garantias)"
```

---

### Task 5: cadastro_cliente (client form + CNPJ)

**Files:**
- Create: `src/views/CadastroClienteView.vue`

**Interfaces:**
- Consumes: `query`, `run`, `ScreenHeader`, `useAuthStore`, `useRoute`.
- Produces: client form; new (INSERT) vs edit (UPDATE via `/clientes/:idcliente`); CNPJ lookup via `fetch('https://receitaws.com.br/v1/cnpj/{cnpj}')`; estados/cidades from bundled JSON.

SQL:
- regiões: `SELECT regiao, descricao FROM regiao`
- load: `SELECT * FROM clifor WHERE clifor = ?`
- INSERT: `INSERT INTO clifor (bairro, cep, cidade, cj, contato, ddd, email, endereco, estado, fax, inscricao, numero, razao, tel1, cnpj, emailnfe, simples, tippess, obs, fantasia, enviado, codigo, inativo, final, regiao) VALUES (...)` with `enviado='N', codigo=0, inativo='N'`
- UPDATE: `UPDATE clifor SET fantasia=?, bairro=?, cep=?, cidade=?, cj=?, contato=?, ddd=?, email=?, endereco=?, estado=?, fax=?, inscricao=?, numero=?, razao=?, tel1=?, emailnfe=?, simples=?, tippess=?, obs=?, enviado='N', cnpj=?, final=?, regiao=? WHERE clifor = ?`
- last id: `SELECT MAX(clifor) AS clifor FROM clifor`

- [ ] **Step 1: Copy `js/estados_cidades.json` into `src/assets/estados_cidades.json`** and import it (or fetch) for the estado/cidade selects.

- [ ] **Step 2: Implement the view** (form + save + CNPJ lookup). Hide/disable save when `usuario.bloqcli === 'S'` or (edit mode and `usuario.altcli === 'S'`) — matches legacy visibility.

- [ ] **Step 3: Type-check + commit**

```bash
npm run type-check && git add src/views/CadastroClienteView.vue src/assets/estados_cidades.json && git commit -m "feat(ui): cadastro cliente (form + CNPJ lookup)"
```

---

### Task 6: consulta_produtos (paginated product list)

**Files:**
- Create: `src/views/ConsultaProdutosView.vue`

**Interfaces:**
- Consumes: `query`, `ScreenHeader`, `EmptyState`, `formatReal`.
- Produces: paginated, searchable product list (filters: Descr.Reduzida/Descrição/Código, Positivado, Empresa, limit 10-100). Row links to `/produtos/:codigo` (stub).

SQL (parameterized; field via whitelist map):
- no-search variant: `SELECT p.codigo, sum(e.estoque) AS estoque, p.{descr} AS descvis, p.comprado, (SELECT COUNT(*) FROM HISTVENDA H INNER JOIN HISTITENS I ON H.LANCTO = I.LANCTO INNER JOIN PRODUTOS G ON G.CODIGO = I.PRODUTO WHERE H.DATA BETWEEN ? AND ? AND I.FATURAMENTO = 'S' AND I.PRODUTO = p.codigo) AS positivado FROM (SELECT * FROM produtos x GROUP BY x.codigo) p LEFT JOIN estoque e ON p.codigo = e.codigo {estoque} {centralizado} WHERE 1=1 {filterEmpresa} GROUP BY p.codigo ORDER BY descvis LIMIT ? OFFSET ?`
- `estoque` = ` AND e.estoque > 0` when `usuario.estoque === 'S'`; `centralizado` = ` AND centralizado <> 'S'` unless empresa filter; `filterEmpresa` = ` AND e.empresa = ?`.

- [ ] **Step 1: Implement the view** (filters + paginated list).

- [ ] **Step 2: Type-check + commit**

```bash
npm run type-check && git add src/views/ConsultaProdutosView.vue && git commit -m "feat(ui): consulta produtos (paginated search)"
```

---

### Task 7: consulta_pedidos (order list + NF-e/boleto)

**Files:**
- Create: `src/views/ConsultaPedidosView.vue`, `src/services/sync/fiscal.ts`

**Interfaces:**
- Consumes: `query`, `run`, `call`, `childText`, `rowChildren`, `ScreenHeader`, `StatusChip`, `EmptyState`, `formatReal`, `mudadata`, `openPdf`, `pasta`.
- Produces: order list (filters: Nº Pedido/Data/Cliente), StatusChip per row, NF-e and Boleto buttons, Reenviar (only `V` → `F`).

SQL:
- no filter: `SELECT p.*, c.fantasia FROM ped p LEFT JOIN clifor c ON c.codigo = p.clifor ORDER BY p.numpedido DESC`
- data filter (typed DD/MM/YYYY → `YYYY-MM-DD`): `... WHERE data LIKE ?` with `%YYYY-MM-DD%`
- other: `... WHERE {col} LIKE ?` (col whitelist: numpedido, fantasia)
- reenviar: `UPDATE ped SET status = 'F', lancto = 0, file = '', sefaz = '' WHERE numpedido = ?` (only when current status `V`)

SOAP (`fiscal.ts`):
- `emitirNfe(numpedido, lancto)`: `P_NFEWEB:EXEC("[pedidos][pedido][numpedido]{numpedido}[/numpedido][lancto]{lancto}[/lancto][/pedido][/pedidos]","{licenca}","{usuario}")` → root `retorno`; on success `UPDATE ped SET sefaz=?, file=?, status=? WHERE numpedido=?` and open DANFE `https://{server}/{pasta}/danfe/li{licenca}/{danfe}`.
- `emitirBoleto(lancto)`: `P_BOLWEB:EXEC("{licenca}","{lancto}")` → root `retorno`; `status` must be `OK`; open `https://{server}/{pasta}/boleto/{boleto}`.

- [ ] **Step 1: Implement `fiscal.ts`** (emitirNfe + emitirBoleto + reenviar helper).

- [ ] **Step 2: Implement `ConsultaPedidosView.vue`**.

- [ ] **Step 3: Type-check + commit**

```bash
npm run type-check && git add src/services/sync/fiscal.ts src/views/ConsultaPedidosView.vue && git commit -m "feat(ui): consulta pedidos (NF-e + boleto + reenviar)"
```

---

### Task 8: consulta_titulos + titulo detail

**Files:**
- Create: `src/views/ConsultaTitulosView.vue`, `src/views/TituloView.vue`, `src/services/sync/titulos_abertos.ts`

**Interfaces:**
- Consumes: `query`, `call`, `childText`, `rowChildren`, `formatReal`, `mudadata`, `ScreenHeader`, `openPdf`, `pasta`.
- Produces: client titles list (`/titulos/:idcliente`), title detail (`/titulo/:numero`), "Títulos Abertos" modal + Duplicata.

SQL:
- `SELECT * FROM titulos WHERE clifor = ?`
- `SELECT * FROM titulos WHERE clifor = ? AND numero = ?`

SOAP (`titulos_abertos.ts`):
- `titulosAbertos(usuario, cliente)`: `P_TAWEB:EXEC("{usuario}", {cliente})` → root `retorno`, children `numero,cobranca,dtvenc,valor,lancto`.
- `duplicata(lancto)`: `P_DUPWEB01:EXEC({lancto})` → root `retorno`; second child = filename; open `https://{server}/{pasta}/duplicata/{file}`.

- [ ] **Step 1: Implement `titulos_abertos.ts`**.

- [ ] **Step 2: Implement both views**.

- [ ] **Step 3: Type-check + commit**

```bash
npm run type-check && git add src/services/sync/titulos_abertos.ts src/views/ConsultaTitulosView.vue src/views/TituloView.vue && git commit -m "feat(ui): consulta titulos + titulo detail + titulos abertos"
```

---

### Task 9: venda detail (read-only)

**Files:**
- Create: `src/views/VendaView.vue`

**Interfaces:**
- Consumes: `query`, `formatReal`, `mudadata`, `ScreenHeader`, `useRoute`.
- Produces: read-only sale detail (`/venda/:pedido`), items table, header (nº, cliente, data, total).

SQL (params: pedido, and `faturamento` flag from query `?fat=S`):
- `SELECT h.produto, h.descricao, h.quant, sum(h.vlunit) AS vlunit, sum(h.vldescto) AS vldescto, sum(h.vltotal) AS vltotal, v.condicao, h.tabela FROM histvenda v, histitens h WHERE v.pedido = h.pedido AND v.lancto = h.lancto AND h.pedido = ? [AND h.faturamento = 'S'] GROUP BY h.produto, h.sequencia ORDER BY h.produto`

- [ ] **Step 1: Implement `VendaView.vue`**.

- [ ] **Step 2: Type-check + commit**

```bash
npm run type-check && git add src/views/VendaView.vue && git commit -m "feat(ui): venda detail"
```

---

## Self-review notes

- **Spec coverage:** Phase 3a covers index2 (dashboard), consulta_clientes, cadastro_cliente, consulta_produtos, consulta_pedidos, consulta_titulos, titulo, venda. `produto.html` detail and `novo_pedido` are Phase 3b/4. Feature SOAP commands (P_EXTWEB, P_GTWEB, P_NFEWEB, P_BOLWEB, P_TAWEB, P_DUPWEB01) folded into the tasks that use them.
- **Type consistency:** `call(comando)` (from `./context`), `childText`/`rowChildren` (from `./helpers`), `query`/`run` (from `db/connection`), `formatReal`/`mudadata` (from `lib/format`), `openPdf`/`pasta` (from `services/files`).
- **Design:** navy shell + white content cards, `StatusChip` for order states, tabular figures via `Intl.NumberFormat`, `ScreenHeader` back affordance, `EmptyState` for empty lists.
