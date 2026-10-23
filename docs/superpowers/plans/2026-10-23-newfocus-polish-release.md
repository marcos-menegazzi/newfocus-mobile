# NewFocus v3 — Phase 5: Polish + release config

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Make the app native-safe (replace `alert()` with a toast), harden loading/error states, and configure Android/iOS release signing + assets.

**Architecture:** A `useToast` composable + a `Toast` component mounted in `App.vue`; views call `notify(msg, type)`. Signing keys copied from the legacy repo; `capacitor.config.ts`/Android gradle wired for release.

**Spec:** `docs/superpowers/specs/2026-10-23-newfocus-capacitor-vue-rewrite-design.md`

## Global Constraints

- `alert()` is a no-op on iOS WebView and unreliable on Android — replace with a toast.
- Reuse the navy/accent identity (toast = dark surface, white text, accent for success/error).
- Signing keys from the legacy repo: `newfocus-pedidos.jks`, `newfocus-pedidos.keystore`, `newfocus.keystore`, `private_key.pepk`, `release-signing.properties` (in `/home/marcosmenegazzi/Develop/mob-newfocus/`). Icons in `res/android/*.png`, `res/ios/*.png`, `res/logo.png`.

---

### Task 1: Toast/notify composable + component + replace `alert()`

**Files:**
- Create: `src/composables/useToast.ts`, `src/components/Toast.vue`
- Modify: `src/App.vue` (mount `<Toast/>`), and replace `alert(...)` → `notify(...)` in the 6 view files.

- [ ] **Step 1: Write `useToast.ts`**

```ts
import { reactive } from 'vue'

type ToastType = 'info' | 'success' | 'error'
interface ToastItem { id: number; msg: string; type: ToastType }

const state = reactive<{ items: ToastItem[] }>({ items: [] })
let seq = 0

export function useToast() {
  function notify(msg: string, type: ToastType = 'info') {
    const id = ++seq
    state.items.push({ id, msg, type })
    setTimeout(() => {
      const i = state.items.findIndex((t) => t.id === id)
      if (i >= 0) state.items.splice(i, 1)
    }, 3500)
  }
  return { items: state.items, notify }
}
```

- [ ] **Step 2: Write `Toast.vue`** — fixed bottom-center stack; each toast: `bg-navy-900 text-white rounded-xl px-4 py-3 shadow-card` with a colored left border (`info` accent, `success` #22C55E, `error` #EF4444).

- [ ] **Step 3: Mount in `App.vue`** — `<script setup>` imports `useToast` + `Toast`; template renders `<router-view/>` + `<Toast :items="items"/>`.

- [ ] **Step 4: Replace `alert(` with `notify(`** in these files (import `useToast` and call `const { notify } = useToast()` at the top of each `<script setup>`): `NovoPedidoView.vue` (35), `CadastroClienteView.vue` (14), `AgendaView.vue` (6), `ConsultaPedidosView.vue` (3), `ConsultaTitulosView.vue` (2), `ConsultaClientesView.vue` (1). Map `alert(msg)` → `notify(String(msg))`. Keep the message text.

- [ ] **Step 5: Type-check + commit**

```bash
npm run type-check
git add -A && git commit -m "feat(ui): toast/notify replacing alert()"
```

---

### Task 2: Loading/error guards (try/finally) in flagged views

**Files:** Modify the flagged load functions.

Add `try/catch/finally` (set a `carregando`/`loading` flag false in `finally`, and `notify(err.message, 'error')` in `catch`) to the load/search functions previously flagged for stuck-spinner risk: `ConsultaProdutosView.vue`, `ConsultaClientesView.vue`, `ConsultaPedidosView.vue`, `MetasView.vue`, `HistoricoVendasView.vue`, `ProdutoView.vue`, `HomeView.vue`, `AgendaView.vue`, `ConsultaTitulosView.vue`, `TituloView.vue`, `VendaView.vue`. Keep the changes minimal (just wrap the existing async body).

- [ ] Implement + type-check + commit: `fix(ui): loading/error guards in list/detail views`

---

### Task 3: Release signing + assets

**Files:** Copy keystores/keys into `android/` (or a `keystores/` dir), add `release-signing.properties`, copy icon/splash PNGs into the Capacitor `resources/` (or `res/`), and document the signing config.

- [ ] **Step 1: Copy signing keys** from `/home/marcosmenegazzi/Develop/mob-newfocus/` → `/home/marcosmenegazzi/Develop/newfocus-mobile/keystores/`: `newfocus-pedidos.jks`, `newfocus-pedidos.keystore`, `newfocus.keystore`, `private_key.pepk`, `release-signing.properties`. Do NOT commit these (add `keystores/` to `.gitignore`) — they are secrets.

- [ ] **Step 2: Configure Android release signing** — add the signing config to `android/app/build.gradle` (or `capacitor.config.ts` doesn't handle it; Android signing is via `android/app/build.gradle` `signingConfigs` + `release` buildType, reading `KEYSTORE_PATH`/`KEYSTORE_PASSWORD`/`KEY_ALIAS`/`KEY_PASSWORD` from `keystores/release-signing.properties`). If the legacy `release-signing.properties` already has the right keys, wire `build.gradle` to read it.

- [ ] **Step 3: Copy icons/splash** — copy `res/android/*.png` and `res/ios/*.png` and `res/logo.png` from the legacy repo into `resources/` (Capacitor's icon/splash convention), or note them as placeholders if the exact Capacitor resource naming differs.

- [ ] **Step 4: Commit (keystores excluded) + document** — commit the gradle + resource changes and a `README` note; confirm `keystores/` is gitignored.

---

## Self-review notes

- **Spec coverage:** Phase 5 = toast (native-safe feedback), loading/error hardening, and release signing + assets. Device smoke-test items (Drive CORS, unverified SOAP shapes) remain as a manual release checklist, not code tasks.
- **Type consistency:** `useToast()` returns `{ items, notify }`; `Toast.vue` accepts `items`.
