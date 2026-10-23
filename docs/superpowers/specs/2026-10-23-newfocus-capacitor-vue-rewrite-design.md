# NewFocus v3 — Capacitor + Vue 3 + Tailwind rewrite

**Date:** 2026-10-23
**Status:** Approved design
**Source app:** `/home/marcosmenegazzi/Develop/mob-newfocus/` (Cordova 11 + jQuery + Bootstrap 3 + Vue 2)

## 1. Goal

Rebuild the existing NewFocus Sistemas field-sales order app as a greenfield
app with a new stack and a totally new visual identity, while preserving every
existing feature and keeping the SOAP sync contract byte-compatible with the
existing `NewAgeWebServiceSetup` backend. Targets Android + iOS.

Non-goals (out of scope): migrating on-device data from the old Cordova app
(fresh install); changing the backend sync contract; REST replacement.

## 2. Stack

| Concern | Choice |
|---|---|
| Runtime | Capacitor 7 (Android + iOS) |
| UI | Vue 3 (Composition API) + Vite |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| State | Pinia |
| Routing | Vue Router |
| Local DB | `@capacitor-community/sqlite` (db `newfocus.db`) |
| SOAP sync | native `fetch` + `DOMParser` (no jQuery/axios) |
| Camera / Geo | `@capacitor/camera`, `@capacitor/geolocation` |
| File open | `@capacitor-community/file-opener` |
| PDF | jsPDF (preserved from current app) |
| Bundle id | `com.cordova.newfocus` |

## 3. Architecture

```
src/
  main.ts, App.vue
  router/index.ts
  services/soap.ts          # SOAP envelope + executarComando call
  services/api.ts           # timezone, CNPJ lookup (receitaws), file upload
  services/sync/*.ts        # one module per SOAP command
  db/connection.ts          # sqlite wrapper (native + web fallback)
  db/schema.ts              # 34 CREATE TABLE
  db/migrations.ts          # versioned ALTERs
  stores/auth.ts            # login state, usuario row
  stores/sync.ts            # sync progress/queue
  stores/catalog.ts         # produtos/clientes/titulos caches
  composables/useSwipe.ts   # edge-swipe gesture (left->right opens sidebar)
  components/               # AppShell, Sidebar, inputs, cards, modals
  views/                    # one route per screen
```

### Key decisions

- **SOAP client** is a single typed module: builds the `soapenv:Envelope`,
  POSTs to `https://{server}/NewAgeWebServiceSetup/EASWebService.asmx?op=executarComando`
  with `Content-Type: text/xml`, parses the `retorno` block with `DOMParser`.
- **DB access** goes through one wrapper so the web dev build can fall back to
  a web sqlite driver (for browser testing) and the native build uses the
  Capacitor sqlite plugin.
- **Sync** mirrors the current engine: pull (paged, `limit=300`) then push
  local pending records (`enviado != 'S'`), clearing local tables before each
  pull as the current app does.

## 4. Data model (33 tables, reproduced verbatim)

`usuario, agenda, carga, cidades, clifor, cobranca_cliente, cobrancas, comissao,
condicao, condicao_cliente, empresas, estados, estoque, fatores, financeiro,
grupos, histitens, historico_agenda, histvenda, mped, mvtpreco, numped,
operacao, parcelas, ped, produtos, regiao, sucata_cliente, tabela_cliente,
titulos, tpreco, vendedores, visitas`

Schema is copied from the current `index.html` `CREATE TABLE` statements and the
versioned `ALTER TABLE` migration chain (versions `191222` … `20260930`).

## 5. Sync contract (SOAP commands)

All via `executarComando` with `<tem:comando>P_xxxWEB:EXEC(...)</tem:comando>`,
`<tem:CostumerId>`, `<tem:strUsername>`, `<tem:strPassword>`.

| Command | Purpose |
|---|---|
| `P_LGWEB` | Login — returns seqpedido, estoque, bloqueia, dias, libera, sincprod, limcred, bloqemp, bloqcli, libmin, snos, altcli, obscli, finmob, result |
| `P_VDCWEB` | Validate sync / version gate |
| `P_PRODWEB` | Products (paged) |
| `P_EWEB` | Stock (estoque) |
| `P_CWEB` / `P_CLIWEB` | Clients (pull) / clients (push) |
| `P_PWEB` | Orders (push, XML body) |
| `P_OPWEB` | Operations |
| `P_RAGWEB` / `P_AGWEB` | Agenda |
| `P_CONDWEB` | Payment conditions |
| `P_GPWEB` / `P_MRCWEB` | Groups / metas |
| `P_COBWEB` | Collections (cobranças) |
| `P_TBWEB` / `P_TBPWEB` | Price tables |
| `P_CGWEB` | Carga |
| `P_HAGEWEB` | Agenda history |
| `P_EMPWEB` | Companies |
| `P_HISTWEB` | Sales history |
| `P_TWEB` / `P_TAWEB` | Titles (sync / open titles) |
| `P_VENDWEB` | Sellers |
| `P_GTWEB` | Warranties |
| `P_NFEWEB` / `P_BOLWEB` | Invoice / boleto |
| `P_IPWEB` | Print |

## 6. Feature inventory (screens)

1. Splash → login (server URL, id, licenciada, user, senha)
2. Home / dashboard
3. Sidebar navigation (edge-swipe left→right to open)
4. Consulta clientes · Cadastro cliente
5. Consulta produtos · Produto detail
6. Novo pedido (core order builder) · Consulta pedidos · Venda
7. Títulos (consulta + abertos)
8. Agenda · Diário de obra
9. Despesas · Metas
10. OS (ordem de serviço)
11. Histórico · Histórico de vendas
12. Configuração (server URL)
13. Sincronizar (full sync)

Preserved behaviors: offline-first local SQLite, camera product photos, GPS,
PDF printouts (jsPDF), CNPJ lookup, states/cities JSON for address fields.

## 7. Visual identity (new)

- **Palette:** deep navy shell `#0B1220`, electric cyan/blue accent, white
  cards, neutral grays for text. High contrast for outdoor field use.
- **Typography:** Inter.
- **Surfaces:** rounded cards, soft shadows, generous spacing, thumb-friendly
  bottom-touch targets.
- **Logo:** new geometric "focus" mark.
- **Layout:** light content on navy AppShell; dark top bar + light content on
  screens; sidebar slides over with scrim.

## 8. Phases

- **P0 Scaffold:** Capacitor + Vue + Vite + Tailwind + TS; platforms; icons/splash; status bar; signing config.
- **P1 Foundation:** schema + migrations, SOAP client, login (`P_LGWEB`), config screen, offline detection, AppShell + Sidebar + edge-swipe, visual identity tokens/components.
- **P2 Sync engine:** all SOAP commands (pull + push).
- **P3 Core sales flow:** home, clientes, produtos, novo pedido, pedidos, venda, títulos.
- **P4 Remaining screens:** agenda, despesas, metas, OS, diário, histórico, produto, printing.
- **P5 Polish & release:** gestures, camera/geo, print, Android + iOS release.

## 9. Verification

Live sync/login against the real dev server (`dev.voltplus.com.br`,
`id=voltplus_desenv`, `licenciada=3`, user `MARCOSME`) using the SOAP contract.
Credentials are used for testing only and never written to source or committed.

## 10. Risks

- **No JDK** on the dev box — web + iOS builds work now; Android APK build needs a JDK installed.
- SOAP/XML parsing must remain exact; regressions guarded by contract-level tests using recorded response fixtures.
