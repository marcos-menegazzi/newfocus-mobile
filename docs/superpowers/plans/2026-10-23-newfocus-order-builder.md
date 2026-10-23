# NewFocus v3 — Phase 3b: Order builder (novo_pedido)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Reimplement the "Novo Pedido" order builder as a Vue route + Pinia store, faithfully porting the legacy pricing/discount/markup/finalize/stock/financeiro logic and the 6-tab UI.

**Architecture:** Business logic lives in typed, unit-testable `src/services/pedido/*.ts` modules (pure math + SQLite). A `usePedidoStore` (Pinia) holds the form/items/parcelas state. `src/views/NovoPedidoView.vue` renders the 6 tabs + modals + footer actions, calling the services.

**Tech Stack:** Vue 3 + TS + Tailwind + Pinia + `@capacitor-community/sqlite` (`query`/`run`) + SOAP `call`.

**Spec:** `docs/superpowers/specs/2026-10-23-newfocus-capacitor-vue-rewrite-design.md`
**Legacy logic source:** `www/js/pedido.js` + `www/novo_pedido.html` (full extraction in the controller's notes).

## Global Constraints

- Reuse: `query`/`run` (db/connection), `formatReal`/`mudadata` (lib/format), `call` (services/sync/context), `StatusChip`/`ScreenHeader`/`EmptyState`, `openPdf`/`pdfUrl` (services/files), `useAuthStore`.
- Route: `/pedidos/novo` (new) and `/pedidos/:numpedido` (edit). `consultation_pedidos`/dashboard "nº pedido" links should target `/pedidos/:numpedido`.
- Status transitions (exact): finalize `A→F`; cancel `(not S/Z/V)→C` (+restore stock if was `F`); reopen `F→A`; orçamento→pedido `status='A',tipo='S'`; reenviar `V→F`; duplicate → new ped `status='A'`.
- Money is stored as `DOUBLE`; `round(value, 2)` is the decimal-safe round (see Task 1). `retNumber` parses "1.234,56"→1234.56.
- `idunico` = 5× `Math.random().toString(36).substr(2,9)` concatenated (INSERT only).
- Order number: `SELECT * FROM numped`; `num = (row.numped ?? 0) + 1`; persist via INSERT (num==1) / UPDATE (else); display `pad(num, 10)`.
- Out of scope for THIS plan (Phase 4): thermal jsPDF receipt printing (`imprimir()`), termo de responsabilidade (`P_TRW001`), and the saldo-sucata/saldos-financeiro modals (`P_SLDRSW`/`P_SLDWEB01`). The footer buttons for these are rendered but disabled/stubbed.

---

### Task 1: Order-builder pure math helpers

**Files:**
- Create: `src/services/pedido/calc.ts`
- Test: `src/services/pedido/calc.test.ts`

**Interfaces:**
- Produces:
  - `round(value: number, exp?: number): number` (decimal-safe; `exp===0`/undefined → `Math.round`)
  - `retNumber(text: string): number` (strip first `.`, replace `,`→`.`, parseFloat||0)
  - `pad(num: number, size: number): string`
  - `gerarIdUnico(): string`
  - `getfator(fatores: [string,string,number][], codigo: string, unidade: string): number`
  - `isCondAvista(condicoes: {codigo:number; avista:string}[], codigo: string|number): boolean`

- [ ] **Step 1: Write `calc.ts`**

```ts
export function round(value: number, exp?: number): number {
  if (exp === undefined || +exp === 0) return Math.round(value)
  value = +value; exp = +exp
  if (Number.isNaN(value) || !(Number.isInteger(exp))) return NaN
  const [m, e] = String(value).split('e')
  const scaled = Math.round(Number(`${m}e${e ? Number(e) + exp : exp}`))
  const [m2, e2] = String(scaled).split('e')
  return Number(`${m2}e${e2 ? Number(e2) - exp : -exp}`)
}

export function retNumber(texto: string): number {
  const valor = texto.replace('.', '')
  return parseFloat(valor.replace(',', '.')) || 0
}

export function pad(num: number, size: number): string {
  const s = '000000000' + num
  return s.slice(-size)
}

export function gerarIdUnico(): string {
  let id = ''
  for (let i = 0; i < 5; i++) id += Math.random().toString(36).substr(2, 9)
  return id
}

export function getfator(fatores: [string, string, number][], codigo: string, unidade: string): number {
  if (unidade === '') return 1
  const found = fatores.find((f) => f[0] === codigo && f[1] === unidade)
  return found ? found[2] : 1
}

export function isCondAvista(condicoes: { codigo: number; avista: string }[], codigo: string | number): boolean {
  const c = condicoes.find((x) => String(x.codigo) === String(codigo))
  return c ? c.avista === 'S' : false
}
```

- [ ] **Step 2: Write failing test `calc.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { round, retNumber, pad, gerarIdUnico, getfator, isCondAvista } from './calc'

describe('round', () => {
  it('rounds to decimals correctly', () => {
    expect(round(1.005, 2)).toBe(1.01)
    expect(round(1234.5678, 2)).toBe(1234.57)
    expect(round(10)).toBe(10)
  })
})
describe('retNumber', () => {
  it('parses pt-BR numbers', () => {
    expect(retNumber('1.234,56')).toBe(1234.56)
    expect(retNumber('0,50')).toBe(0.5)
    expect(retNumber('')).toBe(0)
  })
})
describe('pad', () => {
  it('zero-pads to size', () => { expect(pad(42, 10)).toBe('0000000042') })
})
describe('gerarIdUnico', () => {
  it('returns a long non-empty string', () => { expect(gerarIdUnico().length).toBeGreaterThan(20) })
})
describe('getfator', () => {
  const f: [string, string, number][] = [['A', 'UN', 2], ['A', 'CX', 12]]
  it('returns fator or 1', () => {
    expect(getfator(f, 'A', 'CX')).toBe(12)
    expect(getfator(f, 'A', '')).toBe(1)
    expect(getfator(f, 'B', 'CX')).toBe(1)
  })
})
describe('isCondAvista', () => {
  const c = [{ codigo: 1, avista: 'S' }, { codigo: 2, avista: 'N' }]
  it('checks avista flag', () => {
    expect(isCondAvista(c, 1)).toBe(true)
    expect(isCondAvista(c, 2)).toBe(false)
    expect(isCondAvista(c, 9)).toBe(false)
  })
})
```

- [ ] **Step 3: Run RED then GREEN, type-check, commit**

```bash
npm test -- src/services/pedido/calc.test.ts && npm run type-check
git add src/services/pedido/calc.ts src/services/pedido/calc.test.ts
git commit -m "feat(pedido): math helpers (round/retNumber/pad/idunico/fator/avista)"
```

---

### Task 2: Pricing service (`preco.ts`)

**Files:**
- Create: `src/services/pedido/preco.ts`
- Test: `src/services/pedido/preco.test.ts`

**Interfaces:**
- Produces:
  - `retvalflex(tabelas: {codigo:number; flex:number}[], tabela, quant, valortab, valorvend, fator, desconto, descper): number`
  - `calcPreco(input): PrecoResult` — the full item pricing math.

- [ ] **Step 1: Write `preco.ts`**

```ts
import { round } from './calc'

export interface TabelaFlex { codigo: number; flex: number }

export function retvalflex(
  tabelas: TabelaFlex[], tabela: string | number, quant: number,
  valortab: number, valorvend: number, fator: number, desconto: number, descper: string,
): number {
  const t = tabelas.find((e) => String(e.codigo) === String(tabela))
  if (!t) return 0
  const percflex = t.flex
  let vv = valorvend
  const d = Number(desconto) || 0
  if (d > 0) {
    if (descper === 'N') vv -= d
    else vv -= round(vv * (d / 100), 2)
  }
  if (vv < round(valortab, 2)) return 0
  if (vv === round(valortab, 2)) return round((round(valortab, 2) * (quant * fator)) * (percflex / 100), 2)
  return round(vv * (quant * fator), 2) - round(round(valortab, 2) * (quant * fator), 2)
}

export interface PrecoInput {
  venda: number; maximo: number; minimo: number
  descinc: number; quantidade: number; fator: number
  desconto: number; descper: 'S' | 'N'
  tabela: string | number
  tabelas: TabelaFlex[]
}

export interface PrecoResult {
  vlunbase: number; vlunit: number; total: number; flex: number
  abaixoMinimo: boolean; acimaMaximo: boolean
}

export function calcPreco(i: PrecoInput): PrecoResult {
  const maximo = round(i.maximo * i.fator, 2)
  const minimo = round(i.minimo * i.fator, 2)
  const venda = round(i.venda * i.fator, 2)
  const vlunbase = venda
  let unitario = venda - round(venda * (i.descinc / 100), 2)
  let total = round(i.quantidade * i.fator * unitario, 2)
  const desc = i.descper === 'N' ? i.desconto : round((total * i.desconto) / 100, 2)
  total = round(total - desc, 2)
  const flex = retvalflex(i.tabelas, i.tabela, i.quantidade, vlunbase, unitario, i.fator, i.desconto, i.descper)
  return {
    vlunbase, vlunit: round(unitario, 2), total,
    flex, abaixoMinimo: round(total / i.quantidade, 2) < minimo,
    acimaMaximo: round(total / i.quantidade, 2) > maximo,
  }
}
```

- [ ] **Step 2: Write failing test `preco.test.ts`** (assert `calcPreco` on a known case: `venda=10, maximo=12, minimo=8, descinc=0, quantidade=2, fator=1, desconto=0, descper='N'` → `vlunbase=10, vlunit=10, total=20`; and a `retvalflex` case where `valorvend===valortab` returns the `percflex` % of `valortab*qtd*fator`).

- [ ] **Step 3: Run RED/GREEN, type-check, commit**

```bash
npm test -- src/services/pedido/preco.test.ts && npm run type-check
git add src/services/pedido/preco.ts src/services/pedido/preco.test.ts
git commit -m "feat(pedido): pricing service (retvalflex + calcPreco)"
```

---

### Task 3: Order store + header (number, load, save, transitions)

**Files:**
- Create: `src/stores/pedido.ts`, `src/services/pedido/pedido.ts`

**Interfaces:**
- Produces:
  - `novoNumeroPedido(): Promise<number>` (reads `numped`, +1, persists)
  - `salvarCabecalho(args): Promise<void>` (INSERT or UPDATE `ped`; computes total from `SUM(mped.vltotal)`, peso_total, idunico on INSERT, valor_frete validation)
  - `carregarPedido(numpedido): Promise<PedidoCabecalho | null>`
  - `novopedidoPrefill(): Promise<Partial<PedidoCabecalho>>` (copy-from-last)
  - `duplicarPedido(origem): Promise<string>` (new numpedido)
  - `cancelarPedido(numpedido, cEstoque, empresa, local): Promise<void>` (restore stock if status F, then `C`)
  - `reabrirPedido(numpedido)`, `orcamentoToPedido(numpedido)`, `reenviarPedido(numpedido)`

- [ ] **Step 1: Write `pedido.ts`** (the DB functions above, with the exact SQL from the legacy extraction — INSERT 23 cols, UPDATE 21 cols with `valor_frete CASE`, `SELECT COALESCE(SUM(vltotal),0) AS total FROM mped WHERE numpedido=?`, copy-from-last SELECT, cancel/reopen/orçamento/reenviar UPDATEs).

- [ ] **Step 2: Write `stores/pedido.ts`** — Pinia store: `state` = { cabecalho form fields, itens: [], parcelas: [], pedstatus, carregando }; `actions` = `novo()`, `carregar(numpedido)`, `salvar()`, `cancelar()`, `reabrir()`, `transformarOrcamento()`, `reenviar()`, `duplicar()`. The store calls the `pedido.ts` service functions.

- [ ] **Step 3: Type-check + commit**

```bash
npm run type-check
git add src/services/pedido/pedido.ts src/stores/pedido.ts
git commit -m "feat(pedido): order store + header save/load/transitions"
```

---

### Task 4: Item operations (add/update/remove)

**Files:**
- Create: `src/services/pedido/itens.ts`

**Interfaces:**
- Produces:
  - `incluirItem(args): Promise<void>` — quick-add (INSERT with `descto=0, descinc=0, descper='N'`, or UPDATE if the item+table exists)
  - `gravarItem(args): Promise<void>` — modal save (INSERT/UPDATE with desconto/descinc/descper)
  - `excluirItem(numpedido, codproduto, tabela): Promise<void>`
  - `listarItens(numpedido): Promise<ItemRow[]>` — `SELECT m.*, p.descricao, p.peso, c.descr AS dcond FROM mped m, produtos p, condicao c WHERE m.numpedido=? AND m.codproduto=p.codigo AND m.condicao=c.codigo GROUP BY m.idpedido`

- [ ] **Step 1: Write `itens.ts`** with the exact INSERT/UPDATE column lists and the min/max/estoque validation messages from the extraction (quantidade>0, unitario>0, >maximo, <minimo, total>0, estoque).

- [ ] **Step 2: Type-check + commit**

```bash
npm run type-check
git add src/services/pedido/itens.ts
git commit -m "feat(pedido): item operations (add/update/remove)"
```

---

### Task 5: Discount + markup services

**Files:**
- Create: `src/services/pedido/desconto.ts`

**Interfaces:**
- Produces:
  - `aplicarDesconto(numpedido, { aplicar: boolean, valor: number, porItem: boolean }): Promise<void>` (the two-pass validation + `UPDATE mped SET descto=?, vltotal=?, descper=? WHERE numpedido=? AND idpedido=?`)
  - `aplicarAcrescimo(numpedido, { aplicar, vlquilo, vlunidade, snquilo, snunidade }): Promise<void>` (header `UPDATE ped SET snunidade/snquilo/valor_quilo/valor_unidade` + per-item `UPDATE mped SET valor_negocia=?, vlunit=?, vltotal=?`)

- [ ] **Step 1: Write `desconto.ts`** with the exact arithmetic from the extraction (discount: `descinc>0 ? vlrunitario=vlbase : vlrunitario=vlbase`; `total=round(qtd*vlrunitario,2)`; R$ split equally vs %; min check; markup: `vlnegocia`, `vlrunitario = vlbase + (vlquilo*peso)` etc., max check).

- [ ] **Step 2: Type-check + commit**

```bash
npm run type-check
git add src/services/pedido/desconto.ts
git commit -m "feat(pedido): discount + markup services"
```

---

### Task 6: Financeiro + finalize + stock

**Files:**
- Create: `src/services/pedido/financeiro.ts`, `src/services/pedido/finalizar.ts`

**Interfaces:**
- Produces:
  - `incluirParcela(pedido, cobranca, condicao, valor, autorizacao, totalPedido): Promise<void>` (dup check + `round(valor+totalfin,2) > totalPedido` check + INSERT)
  - `excluirParcela(idfinanceiro)`, `listarParcelas(pedido)`
  - `validarFinanceiro(pedido, finped, condicliente, cobcliente): Promise<{ ok: boolean; msg?: string }>`
  - `finalizar(numpedido, cEstoque, ...): Promise<void>` (validations → testaestoque → gravaestoque → salvarCabecalho status F)
  - `testarEstoque` / `gravarEstoque` / `ajustarEstoque(produto, qtd, tipo)`

- [ ] **Step 1: Write `financeiro.ts` + `finalizar.ts`** with the exact SQL/validation from the extraction.

- [ ] **Step 2: Type-check + commit**

```bash
npm run type-check
git add src/services/pedido/financeiro.ts src/services/pedido/finalizar.ts
git commit -m "feat(pedido): financeiro + finalize + stock"
```

---

### Task 7: Order builder view — skeleton, header, pickers

**Files:**
- Create: `src/views/NovoPedidoView.vue`
- Modify: `src/router/index.ts` (add `/pedidos/novo` and `/pedidos/:numpedido` → NovoPedidoView)

**Interfaces:**
- Consumes: `usePedidoStore`, `useAuthStore`, `query`, the services, `ScreenHeader`, `StatusChip`, `formatReal`/`mudadata`.

- [ ] **Step 1: Add routes** (register `/pedidos/novo` before `/pedidos/:numpedido`).

- [ ] **Step 2: Implement the view skeleton** — header (total/quantidade/saldoflex/flexpedido), 6 tabs (Pedido / Incluir / Itens / Desconto / Financeiro / Negociação), footer buttons (Cancelar, Imprimir [stub], Finalizar, NF-e, Boleto, Reabrir, Transformar em pedido, Duplicar). The "Pedido" tab has the full header form (tipo, nº pedido [disabled], nº nota, data, empresa, vendedor, cliente picker, operação picker, condição, tabela, carga, comissão, obs, complemento). Client picker + operação + carga modals with search. The "Incluir" tab has the product search + card grid + product modal.

- [ ] **Step 3: Type-check + commit**

```bash
npm run type-check
git add src/views/NovoPedidoView.vue src/router/index.ts
git commit -m "feat(pedido): order builder view (header + pickers + tabs)"
```

---

### Task 8: Order builder view — items/discount/financeiro/negociação + footer actions

**Files:**
- Modify: `src/views/NovoPedidoView.vue`

- [ ] **Step 1: Implement the remaining tabs + actions** — Itens table (edit/delete), Desconto tab, Financeiro tab (parcelas), Negociação tab (acréscimo), and wire the footer buttons (Cancelar/Reabrir/Transformar/Duplicar/Finalizar) to the store actions; NF-e/Boleto reuse `fiscal.ts` from Phase 3a. Product modal edit (gravaitemped flow). Stock messages via the existing aviso pattern.

- [ ] **Step 2: Type-check + commit**

```bash
npm run type-check
git add src/views/NovoPedidoView.vue
git commit -m "feat(pedido): order builder items/discount/financeiro/negociacao + actions"
```

---

## Self-review notes

- **Spec coverage:** novo_pedido's pricing, discount, markup, finalize, stock, financeiro, header, order-number, idunico, duplicate/reopen/orçamento/reenviar are all covered by Tasks 1-6 (services) + 7-8 (UI). Printing/termo/saldo modals deferred to Phase 4 per scope note.
- **Type consistency:** `round`/`retNumber`/`pad`/`getfator`/`isCondAvista` (calc) used by preco/desconto/financeiro; `retvalflex`/`calcPreco` (preco) used by itens/desconto; store uses service functions; view uses store + `formatReal`/`mudadata`.
- **Known legacy quirks preserved (or intentionally fixed):** `incluirItem` passes desconto=0 (fixes the legacy undeclared-`desconto` bug); `duplica` does not copy `vendedor`/`valor_frete` (matches legacy); `idunico` not regenerated on UPDATE.
