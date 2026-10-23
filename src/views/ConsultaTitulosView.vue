<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import ScreenHeader from '../components/ScreenHeader.vue'
import { query } from '../db/connection'
import { formatReal, mudadata } from '../lib/format'
import { titulosAbertos, duplicata, type TituloAberto } from '../services/sync/titulos_abertos'
import { useToast } from '../composables/useToast'

interface TituloRow {
  numero: string
  empresa: number
  cobranca: string
  vencimento: string
  valor: number
}

const route = useRoute()
const { notify } = useToast()

const idcliente = computed(() => {
  const p = route.params.idcliente
  return Array.isArray(p) ? p[0] : p
})
const fantasia = computed(() => {
  const q = route.query.fantasia
  return typeof q === 'string' ? q : ''
})

const titulos = ref<TituloRow[]>([])
const loading = ref(false)

const total = computed(() => titulos.value.reduce((s, t) => s + (Number(t.valor) || 0), 0))

onMounted(async () => {
  loading.value = true
  try {
    titulos.value = await query<TituloRow>('SELECT * FROM titulos WHERE clifor = ?', [idcliente.value])
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Erro ao carregar', 'error')
  } finally {
    loading.value = false
  }
})

const abertos = ref(false)
const abertosRows = ref<TituloAberto[]>([])
const abertosLoading = ref(false)

async function abrirAbertos() {
  abertos.value = true
  abertosLoading.value = true
  abertosRows.value = []
  try {
    abertosRows.value = await titulosAbertos(idcliente.value ?? '')
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Não foi possível carregar os títulos abertos', 'error')
  } finally {
    abertosLoading.value = false
  }
}

async function verDuplicata(r: TituloAberto) {
  try {
    await duplicata(r.lancto)
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Não foi possível gerar a duplicata', 'error')
  }
}
</script>

<template>
  <AppShell>
    <div class="p-6">
      <ScreenHeader :title="fantasia || 'Títulos'" />

      <div class="flex justify-end mb-4">
        <button class="btn-primary px-4" @click="abrirAbertos">Títulos Abertos</button>
      </div>

      <EmptyState v-if="!loading && titulos.length === 0" label="Nenhum título" />
      <div v-else class="overflow-x-auto bg-white rounded-card shadow-card">
        <table class="w-full text-left text-sm">
          <thead class="text-ink-400 text-xs uppercase">
            <tr>
              <th class="py-2 px-3">Nº Título</th>
              <th class="py-2 px-3">Empresa</th>
              <th class="py-2 px-3">Cobrança</th>
              <th class="py-2 px-3">Vencimento</th>
              <th class="py-2 px-3 text-right">Valor</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-ink-200">
            <tr v-for="t in titulos" :key="t.numero">
              <td class="py-2 px-3">
                <RouterLink
                  :to="{ path: `/titulo/${t.numero}`, query: { idcliente, fantasia } }"
                  class="font-semibold text-accent-600"
                >{{ t.numero }}</RouterLink>
              </td>
              <td class="py-2 px-3">{{ t.empresa }}</td>
              <td class="py-2 px-3">{{ t.cobranca }}</td>
              <td class="py-2 px-3">{{ mudadata(t.vencimento) }}</td>
              <td class="py-2 px-3 text-right">{{ formatReal(t.valor) }}</td>
            </tr>
            <tr class="bg-ink-100 font-semibold">
              <td class="py-2 px-3" colspan="4">Total</td>
              <td class="py-2 px-3 text-right">{{ formatReal(total) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div
      v-if="abertos"
      class="fixed inset-0 z-40 flex items-end justify-center bg-black/50"
      @click.self="abertos = false"
    >
      <div class="w-full max-h-[90vh] overflow-auto rounded-t-2xl bg-white p-5">
        <h2 class="text-lg font-bold text-ink-900 mb-3">Títulos Abertos</h2>

        <EmptyState v-if="!abertosLoading && abertosRows.length === 0" label="Nenhum título aberto" />
        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="text-ink-400 text-xs uppercase">
              <tr>
                <th class="py-2 pr-3">Nº</th>
                <th class="py-2 pr-3">Cobrança</th>
                <th class="py-2 pr-3">Vencimento</th>
                <th class="py-2 pr-3 text-right">Valor</th>
                <th class="py-2"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-ink-200">
              <tr v-for="(r, i) in abertosRows" :key="i">
                <td class="py-2 pr-3">{{ r.numero }}</td>
                <td class="py-2 pr-3">{{ r.cobranca }}</td>
                <td class="py-2 pr-3">{{ mudadata(r.dtvenc) }}</td>
                <td class="py-2 pr-3 text-right">{{ formatReal(r.valor) }}</td>
                <td class="py-2">
                  <button class="text-xs font-semibold text-accent-600" @click="verDuplicata(r)">Duplicata</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <button class="w-full mt-4 py-2 text-sm font-semibold text-ink-600" @click="abertos = false">Fechar</button>
      </div>
    </div>
  </AppShell>
</template>
