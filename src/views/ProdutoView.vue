<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import LoadingState from '../components/LoadingState.vue'
import { query } from '../db/connection'
import { formatNumero, formatReal } from '../lib/format'
import { pasta } from '../services/files'
import { useAuthStore } from '../stores/auth'
import { useToast } from '../composables/useToast'

interface ProdutoRow {
  codigo: string
  descricao: string
  descred: string | null
  grupo: string | null
  peso: number | null
  barras: string | null
  link: string | null
  observacao: string | null
}

interface PrecoRow {
  codigo: number | string
  descricao: string
  venda: number | string
  minimo: number | string
  maximo: number | string
}

interface FatorRow {
  unidade: string
  fator: number | string
}

interface EstoqueRow {
  empresa: number
  fantasia: string | null
  estoque: number
}

const route = useRoute()
const auth = useAuthStore()
const { notify } = useToast()

const codigo = computed(() => {
  const p = route.params.codigo
  return Array.isArray(p) ? p[0] : p
})

const produto = ref<ProdutoRow | null>(null)
const precos = ref<PrecoRow[]>([])
const fatores = ref<FatorRow[]>([])
const estoques = ref<EstoqueRow[]>([])
const loading = ref(true)
const imagemFalhou = ref(false)

const num = (n: number | string | null | undefined) => Number(n ?? 0)

const link = computed(() => (imagemFalhou.value ? '' : produto.value?.link?.trim() ?? ''))

function imageUrl(link: string): string {
  if (/^https?:\/\//i.test(link)) return link
  const server = (auth.usuario?.server ?? '').replace(/^https?:\/\//i, '')
  // O servidor envia o link com barra inicial (o legado concatenava pasta + link).
  return `https://${server}/${pasta()}/${link.replace(/^\/+/, '')}`
}

onMounted(async () => {
  try {
    const [p, t, f, e] = await Promise.all([
      query<ProdutoRow>(
        'SELECT p.codigo, p.descricao, p.descred, COALESCE(g.descricao, p.grupo) AS grupo, p.peso, p.barras, p.link, p.observacao FROM produtos p LEFT JOIN grupos g ON g.codigo = p.grupo WHERE p.codigo = ? LIMIT 1',
        [codigo.value],
      ),
      query<PrecoRow>(
        'SELECT t.codigo, t.descricao, m.venda, m.minimo, m.maximo FROM tpreco t, mvtpreco m WHERE m.tabela_codigo = t.codigo AND m.produto = ?',
        [codigo.value],
      ),
      query<FatorRow>('SELECT * FROM fatores WHERE produto = ?', [codigo.value]),
      query<EstoqueRow>(
        'SELECT e.empresa, x.fantasia, SUM(e.estoque) AS estoque FROM estoque e LEFT JOIN empresas x ON x.empresa = e.empresa WHERE e.codigo = ? GROUP BY e.empresa ORDER BY e.empresa',
        [codigo.value],
      ),
    ])
    produto.value = p[0] ?? null
    precos.value = t
    fatores.value = f
    estoques.value = e
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Erro ao carregar', 'error')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <AppShell :title="produto?.descred || produto?.descricao || 'Produto'" back>
    <div class="page">
      <LoadingState v-if="loading" />
      <div v-else-if="!produto" class="panel">
        <EmptyState icon="package" label="Produto não encontrado" hint="Sincronize para atualizar o catálogo." />
      </div>

      <template v-else>
        <section class="panel overflow-hidden">
          <div v-if="link" class="bg-white border-b border-ink-100 p-4">
            <img
              :src="imageUrl(link)"
              :alt="produto.descricao"
              class="mx-auto aspect-square w-full max-w-64 object-contain"
              @error="imagemFalhou = true"
            />
          </div>
          <div class="px-4 py-4">
            <h2 class="text-[19px] font-semibold leading-snug text-balance">{{ produto.descricao }}</h2>
            <p class="meta mt-1.5 tabular-nums">
              Cód. {{ produto.codigo }}
              <template v-if="produto.grupo">
                <span class="mx-1.5 text-ink-200" aria-hidden="true">|</span>{{ produto.grupo }}
              </template>
            </p>
          </div>
          <dl v-if="produto.barras || num(produto.peso) > 0" class="border-t border-ink-100 divide-y divide-ink-100">
            <div v-if="produto.barras" class="flex justify-between gap-4 px-4 py-3">
              <dt class="text-ink-500">Código de barras</dt>
              <dd class="font-medium tabular-nums">{{ produto.barras }}</dd>
            </div>
            <div v-if="num(produto.peso) > 0" class="flex justify-between gap-4 px-4 py-3">
              <dt class="text-ink-500">Peso</dt>
              <dd class="font-medium tabular-nums">{{ formatNumero(produto.peso) }} kg</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="estoque-title">
          <h2 id="estoque-title" class="section-title px-1 mb-2">Estoque</h2>
          <dl class="list">
            <div v-for="e in estoques" :key="e.empresa" class="flex justify-between gap-4 px-4 py-3">
              <dt class="text-ink-700 min-w-0 truncate">{{ e.fantasia || `Empresa ${e.empresa}` }}</dt>
              <dd class="font-semibold tabular-nums" :class="{ 'text-danger-700': num(e.estoque) <= 0 }">
                {{ formatNumero(e.estoque) }}
              </dd>
            </div>
            <div v-if="estoques.length === 0" class="px-4 py-3 text-danger-700 font-medium">Sem estoque</div>
          </dl>
        </section>

        <section aria-labelledby="precos-title" class="space-y-3">
          <h2 id="precos-title" class="section-title px-1 -mb-1">Preços</h2>
          <div v-if="precos.length === 0" class="panel">
            <EmptyState icon="receipt" label="Sem preço cadastrado" hint="Este produto não está em nenhuma tabela de preço." />
          </div>
          <div v-for="t in precos" :key="String(t.codigo)" class="panel overflow-hidden">
            <h3 class="px-4 pt-3.5 pb-1 text-sm font-semibold text-ink-700">{{ t.descricao }}</h3>
            <div class="overflow-x-auto">
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="pl-4">Unidade</th>
                    <th class="num text-ink-900!">Venda</th>
                    <th class="num">Mínimo</th>
                    <th class="num pr-4">Máximo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="pl-4 font-medium">Padrão</td>
                    <td class="num font-semibold">{{ formatReal(num(t.venda)) }}</td>
                    <td class="num text-ink-700!">{{ formatReal(num(t.minimo)) }}</td>
                    <td class="num pr-4 text-ink-700!">{{ formatReal(num(t.maximo)) }}</td>
                  </tr>
                  <tr v-for="f in fatores" :key="f.unidade">
                    <td class="pl-4 whitespace-nowrap">
                      <span class="font-medium">{{ f.unidade }}</span>
                      <span class="ml-1 text-xs text-ink-500 tabular-nums">×{{ formatNumero(f.fator) }}</span>
                    </td>
                    <td class="num font-semibold">{{ formatReal(num(t.venda) * num(f.fator)) }}</td>
                    <td class="num text-ink-700!">{{ formatReal(num(t.minimo) * num(f.fator)) }}</td>
                    <td class="num pr-4 text-ink-700!">{{ formatReal(num(t.maximo) * num(f.fator)) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section v-if="produto.observacao" class="panel p-4">
          <h2 class="section-title mb-2">Observação</h2>
          <p class="text-[15px] text-ink-700 whitespace-pre-wrap">{{ produto.observacao }}</p>
        </section>
      </template>
    </div>
  </AppShell>
</template>
