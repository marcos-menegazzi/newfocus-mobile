<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import ScreenHeader from '../components/ScreenHeader.vue'
import { query } from '../db/connection'
import { formatReal } from '../lib/format'
import { pasta } from '../services/files'
import { useAuthStore } from '../stores/auth'
import { useToast } from '../composables/useToast'

interface PrecoRow {
  codigo: number | string
  descricao: string
  proddesc: string
  venda: number | string
  minimo: number | string
  maximo: number | string
  link: string | null
  observacao: string | null
}

interface FatorRow {
  unidade: string
  fator: number | string
}

const route = useRoute()
const auth = useAuthStore()
const { notify } = useToast()

const codigo = computed(() => {
  const p = route.params.codigo
  return Array.isArray(p) ? p[0] : p
})

const precos = ref<PrecoRow[]>([])
const fatores = ref<FatorRow[]>([])

const num = (n: number | string | null | undefined) => Number(n ?? 0)

const titulo = computed(() => {
  const d = precos.value[0]?.proddesc ?? ''
  return d ? `${codigo.value} - ${d}` : codigo.value
})

const link = computed(() => precos.value[0]?.link ?? '')
const observacao = computed(() => precos.value[0]?.observacao ?? '')

function imageUrl(link: string): string {
  if (/^https?:\/\//i.test(link)) return link
  const server = (auth.usuario?.server ?? '').replace(/^https?:\/\//i, '')
  return `https://${server}/${pasta()}/${link}`
}

onMounted(async () => {
  try {
    const [p, f] = await Promise.all([
      query<PrecoRow>(
        'SELECT t.codigo, t.descricao, p.descricao AS proddesc, m.venda, m.minimo, m.maximo, p.link, p.observacao FROM produtos p, tpreco t, mvtpreco m WHERE p.codigo = m.produto AND m.tabela_codigo = t.codigo AND p.codigo = ?',
        [codigo.value],
      ),
      query<FatorRow>('SELECT * FROM fatores WHERE produto = ?', [codigo.value]),
    ])
    precos.value = p
    fatores.value = f
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Erro ao carregar', 'error')
  }
})
</script>

<template>
  <AppShell>
    <div class="p-6">
      <ScreenHeader :title="titulo" />

      <EmptyState v-if="precos.length === 0" label="Produto não encontrado" />

      <template v-else>
        <section v-if="link" class="bg-white rounded-card shadow-card p-5 mb-4">
          <img :src="imageUrl(link)" :alt="titulo" class="w-full max-h-64 object-contain" />
        </section>

        <section
          v-for="t in precos"
          :key="String(t.codigo)"
          class="bg-white rounded-card shadow-card p-5 mb-4"
        >
          <h2 class="text-sm font-bold text-ink-900 mb-3">{{ t.descricao }}</h2>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-ink-400 text-xs">
                  <th class="py-2 pr-3 font-medium">Unidade</th>
                  <th class="py-2 pr-3 font-medium text-right">Venda</th>
                  <th class="py-2 pr-3 font-medium text-right">Mínimo</th>
                  <th class="py-2 font-medium text-right">Máximo</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-ink-200">
                <tr>
                  <td class="py-2 pr-3 text-ink-900">Padrão</td>
                  <td class="py-2 pr-3 text-right text-ink-900">{{ formatReal(num(t.venda)) }}</td>
                  <td class="py-2 pr-3 text-right text-ink-900">{{ formatReal(num(t.minimo)) }}</td>
                  <td class="py-2 text-right text-ink-900">{{ formatReal(num(t.maximo)) }}</td>
                </tr>
                <tr v-for="f in fatores" :key="f.unidade">
                  <td class="py-2 pr-3 text-ink-900">{{ f.unidade }}</td>
                  <td class="py-2 pr-3 text-right text-ink-900">{{ formatReal(num(t.venda) * num(f.fator)) }}</td>
                  <td class="py-2 pr-3 text-right text-ink-900">{{ formatReal(num(t.minimo) * num(f.fator)) }}</td>
                  <td class="py-2 text-right text-ink-900">{{ formatReal(num(t.maximo) * num(f.fator)) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="observacao" class="bg-white rounded-card shadow-card p-5">
          <h2 class="text-sm font-bold text-ink-900 mb-2">Observação</h2>
          <p class="text-sm text-ink-600 whitespace-pre-wrap">{{ observacao }}</p>
        </section>
      </template>
    </div>
  </AppShell>
</template>
