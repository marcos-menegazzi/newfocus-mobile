# NewFocus v3 — Phase 4: Remaining screens + printing

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Build the remaining screens (agenda, despesas, metas, OS hub, diário de obra, histórico de vendas, produto detail) and thermal printing, completing the feature set.

**Architecture:** Local-SQL screens (histórico vendas, produto, agenda) read/write SQLite via `query`/`run`; SOAP screens (metas, despesas, diário, OS histórico) call `call()`. Printing ports `imprimir.js` to a typed jsPDF service. GPS via `@capacitor/geolocation`, camera via `@capacitor/camera`.

**Tech Stack:** Vue 3 + TS + Tailwind + Pinia + jsPDF + `@capacitor/camera` + `@capacitor/geolocation`.

**Spec:** `docs/superpowers/specs/2026-10-23-newfocus-capacitor-vue-rewrite-design.md`
**Legacy map:** extracted from `agenda.html`, `despesas.html`, `metas.html`, `os.html`, `diario.html`, `historico.html`, `historico_vendas.html`, `produto.html`, `js/imprimir.js`, `js/imprimirA4.js`.

## Global Constraints

- Reuse: `query`/`run`, `call`, `childText`/`rowChildren`, `formatReal`/`mudadata`, `openPdf`/`pdfUrl`/`pasta`, `ScreenHeader`/`EmptyState`/`StatusChip`, `useAuthStore`.
- GPS via `@capacitor/geolocation` `Geolocation.getCurrentPosition()`; camera via `@capacitor/camera` `Camera.getPhoto({ resultType: CameraResultType.Base64 })`.
- SOAP auth comes from `useAuthStore().usuario` (codlic/id/server/usuario/senha) — reuse `call(comando)` from `services/sync/context`.
- Image upload endpoint: `POST https://drive.voltplus.com.br/upload`, header `X-API-KEY: TkVXRk9DVVMgT1MgTU9CSUxFIDIwMjI=`, `multipart/form-data` fields `folderId`, `image`. (This is a REST call; use `CapacitorHttp`/`fetch`.)
- Out of scope (Phase 5 polish): shared toast/notify replacing `alert()`.

---

### Task 1: Histórico de Vendas (sales history list)

**Files:** Create `src/views/HistoricoVendasView.vue`; Modify `src/router/index.ts` (add `/historico-vendas`), `src/components/Sidebar.vue` (add item).

**SQL (verbatim):**
```sql
SELECT x.pedido, x.data, sum(x.quantidade) AS quantidade, sum(x.total) AS total, x.fantasia
FROM (
  SELECT h.pedido, h.lancto, h.data, i.quant AS quantidade, sum(i.vltotal) AS total, c.fantasia
  FROM histvenda h, clifor c, histitens i
  WHERE h.clifor = c.codigo AND h.lancto = i.lancto AND h.data >= ? AND h.data <= ?
  {AND h.pedido LIKE ? | AND c.fantasia LIKE ?}
  {AND i.faturamento = 'S'}
  GROUP BY h.pedido, i.produto, i.sequencia
) x
GROUP BY x.pedido ORDER BY x.pedido DESC
```
Filters: `campopesquisa` (h.pedido / c.fantasia), `datainicial`, `datafinal` (DD/MM/YYYY → YYYY-MM-DD), `checkboxfaturamento`. Footer totals row. Each row links to `/venda/:pedido?data=&cliente=&total=&fat=S|N`.

- [ ] Implement the view (filters + table + totals footer), add route + sidebar item, type-check, commit.

---

### Task 2: Produto detail (replace stub)

**Files:** Modify `src/views/ProdutoView.vue`.

**SQL:**
```sql
SELECT t.codigo, t.descricao, m.venda, m.minimo, m.maximo, p.link, p.observacao
FROM produtos p, tpreco t, mvtpreco m
WHERE p.codigo = m.produto AND m.tabela_codigo = t.codigo AND p.codigo = ?
```
```sql
SELECT * FROM fatores WHERE produto = ?
```
Render: `#descrprod` (codigo - descricao), product image (`p.link`), per price-table heading + table (Unidade, Valor Venda, Mínimo, Máximo — "Padrão" row = venda/min/max, then one row per fator multiplying venda/min/max), observation paragraph. Back via `ScreenHeader`.

- [ ] Implement, type-check, commit.

---

### Task 3: Agenda (visit scheduling + check-in + GPS)

**Files:** Create `src/views/AgendaView.vue`, `src/services/agenda.ts`; Modify router (add `/agenda`), sidebar.

**SQL (verbatim):**
- visitas: `SELECT v.clifor, v.data_agenda, v.data, v.atendido, v.codmotivo, v.motivo, v.hora, c.fantasia, c.endereco, v.idvisita AS idagenda, c.cidade FROM visitas v INNER JOIN clifor c ON v.clifor = c.codigo WHERE v.data_agenda BETWEEN ? AND ?` (+ ` AND v.clifor = ?`)
- agenda: `SELECT a.data_base, a.clifor, a.dia, a.hora, a.dias, c.fantasia, c.endereco, a.idagenda, c.cidade FROM agenda a, clifor c WHERE a.clifor = c.codigo GROUP BY a.clifor, a.data_base ORDER BY a.clifor` (+ client filter). Recurrence expansion: advance `data_base` by `dias` days, `dia` times.
- motivos: `SELECT * FROM historico_agenda WHERE inativo = 'N'`
- overdue check: `SELECT * FROM titulos WHERE clifor = ?`

**Writes:**
- INSERT visitas `(clifor, data, atendido, hora, motivo, data_agenda, codmotivo, latitude, longitude, sincronizada)` VALUES `(?,?,?,?,?,?,?,?,?,?)` with `sincronizada='N'`; UPDATE `SET atendido=?, motivo=?, codmotivo=?, latitude=?, longitude=?, data=?, sincronizada='N' WHERE clifor=? AND data_agenda=?`.
- new visit: `INSERT INTO visitas (clifor, data, hora, data_agenda, latitude, longitude) VALUES (?,?,?,?,?,?)`.
- recurrence: `INSERT INTO agenda(clifor, data_base, dia, hora, dias, snvis) VALUES (?,?,?,?,?,?)` with `snvis='N'`.

**GPS:** on check-in, `Geolocation.getCurrentPosition()` → latitude/longitude.

- [ ] Implement `agenda.ts` + `AgendaView.vue` (date range + client picker + list + atendimento/agenda/client modals), type-check, commit.

---

### Task 4: Metas (Objetivo)

**Files:** Create `src/views/MetasView.vue`; Modify router/sidebar (add `/metas`).

**SOAP:**
- `P_GPWEB:EXEC(${codlic})` → root `grupos`, children `codigo`/`descricao` → grupo select.
- `P_MRCWEB:EXEC(${codlic})` → root `marcas`, children `codigo`/`descricao` → marca select.
- `P_RMTWEB01:EXEC(${codlic}, '{data_inicial}', '{data_final}', '{grupo}', '{marca}', '{faturamento}')` → root `<tipo>` (grupo/marca/grupo_marca/produto/else vendedor) + item tags `quantidade,total,meta,falta,percmeta,percfalta` (+ label tag). Render a table.

- [ ] Implement, type-check, commit.

---

### Task 5: OS module (os hub + despesas + diário + histórico)

**Files:** Create `src/views/OsView.vue`, `src/views/DespesasView.vue`, `src/views/DiarioView.vue`, `src/views/OsHistoricoView.vue`, `src/services/os.ts`; Modify router/sidebar (add `/os`, `/os/despesas`, `/os/diario`, `/os/historico`).

**SOAP (all via `call()`):**
- OS list: `P_OSWEB013:EXEC(1)` → `codigo`/`descricao`.
- Contas: `P_OSWEB013:EXEC(2)` → `codigo`/`descricao`.
- Funcionários: `P_OSWEB016:EXEC(${os})`.
- Drive folder: `P_OSWEB017:EXEC()`.
- Despesa: `P_OSWEB005:EXEC("${xml}")` with the `[lancamentos][os][ctf][data][valor][obs][funcionarios][image][latitude][longitude]` XML.
- Diário: `P_OSWEB008:EXEC("${xml}")` with `[lancamentos][os][obs][funcionarios][apontamentos][fotos][latitude][longitude]`.
- Histórico list: `P_OSWEB004:EXEC()` → `os,codigo,tipo,funcionario,data,valor,registro`.
- Histórico detail: `P_OSWEB019:EXEC(${reg}, "${tipo}")` → `codigo,tipo,os,data,hora,valor,obs,funcionarios,apontamentos`.

**Image upload:** `POST https://drive.voltplus.com.br/upload` with `X-API-KEY` header and `multipart/form-data` (`folderId`, `image` base64). Camera via `@capacitor/camera`.

- [ ] Implement `os.ts` + the 4 views (os.html is a 3-button hub), type-check, commit.

---

### Task 6: Thermal printing (jsPDF) + wire Imprimir

**Files:** Create `src/services/pedido/imprimir.ts`; Modify `src/views/NovoPedidoView.vue` (wire Imprimir button).

**Port `imprimir.js`:** `new jsPDF('p', 'mm', [57, pagina])`; compute `pagina` from item count + obs length; the two SQL reads (ped+empresas+clifor+condicao, produtos+mped); the layout (fantasia, PEDIDO header, cliente/endereco, tab. preço/cond./operação, separator, items, T.BRUTO/DESC/TL/PESO/Ret.Sucata, Obs., assinatura). Output: write `{numpedido}.pdf` to `Filesystem.Directory.Data` then `openPdf`/FileOpener.

- [ ] Implement `imprimir.ts`, wire the "Imprimir" button in `NovoPedidoView.vue`, type-check, commit.

---

### Task 7: Termo + saldo-sucata + saldos-financeiro modals (order extras)

**Files:** Create `src/services/pedido/termo.ts`; Modify `src/views/NovoPedidoView.vue`.

**SOAP:**
- Termo: `P_TRW001:EXEC(${lancto})` → filename → `openPdf(pdfUrl('termo/' + file))`.
- Saldo sucata: `P_SLDRSW:EXEC(${lic},${cliente})` → `referencia`/`saldo` rows.
- Saldos financeiro: `P_SLDWEB01:EXEC(${cliente})` → `status`/`msg`/`saldos` with `conta/quan/total`.

- [ ] Implement + wire the Termo de Responsabilidade footer button and the "Visualizar" (sucata) + "Saldos Cliente" actions, type-check, commit.

---

## Self-review notes

- **Spec coverage:** all Phase 4 screens (agenda, despesas, metas, os, diário, histórico vendas, produto) + printing + order extras (termo/saldos). Phase 5 = polish + release (not here).
- **Type consistency:** reuses `call`, `childText`, `rowChildren`, `query`, `run`, `formatReal`, `mudadata`, `pdfUrl`, `openPdf`, `useAuthStore`.
