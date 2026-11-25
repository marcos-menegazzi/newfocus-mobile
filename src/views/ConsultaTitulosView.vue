<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import Icon from '../components/Icon.vue'
import LoadingState from '../components/LoadingState.vue'
import Sheet from '../components/Sheet.vue'
import { query } from '../db/connection'
import { formatReal, mudadata } from '../lib/format'
import { hojeISO } from '../lib/periodo'
import { titulosAbertos, duplicata, type TituloAberto } from '../services/sync/titulos_abertos'
import { useOcupado } from '../composables/useOcupado'
import { useToast } from '../composables/useToast'

interface TituloRow {
  idtitulo: number
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
const loading = ref(true)

const vencido = (data: string | null) => !!data && data.slice(0, 10) < hojeISO()
const vencidos = computed(() => titulos.value.filter((t) => vencido(t.vencimento)))
const { ocupado, executar } = useOcupado()

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
const abertosErro = ref('')

const abertosTotal = computed(() => abertosRows.value.reduce((s, t) => s + (Number(t.valor) || 0), 0))

async function abrirAbertos() {
  abertos.value = true
  abertosLoading.value = true
  abertosRows.value = []
  abertosErro.value = ''
  try {
    abertosRows.value = await titulosAbertos(idcliente.value ?? '')
  } catch (e) {
    abertosErro.value = e instanceof Error ? e.message : 'Verifique a conexão com a internet.'
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
  <AppShell title="Títulos" :subtitle="fantasia || undefined" back>
    <div class="page">
      <LoadingState v-if="loading" :rows="5" label="Carregando títulos…" />
      <div v-else-if="titulos.length === 0" class="panel">
        <EmptyState icon="receipt" label="Nenhum título deste cliente" hint="Consulte os títulos em aberto direto no servidor.">
          <button class="btn btn-tonal btn-sm" @click="abrirAbertos">Ver títulos em aberto</button>
        </EmptyState>
      </div>
      <template v-else>
        <section class="panel flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4">
          <div>
            <p class="meta">{{ titulos.length }} {{ titulos.length === 1 ? 'título' : 'títulos' }}</p>
            <p class="mt-1 flex items-baseline gap-1">
              <span class="text-sm text-ink-500">R$</span>
              <span class="figure text-[30px]">{{ formatReal(total) }}</span>
            </p>
            <p v-if="vencidos.length" class="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-danger-700">
              <Icon name="alert" :size="16" /> {{ vencidos.length }} {{ vencidos.length === 1 ? 'vencido' : 'vencidos' }}
            </p>
          </div>
          <button class="btn btn-tonal btn-sm" @click="abrirAbertos">Em aberto no servidor</button>
        </section>

        <ul class="list">
          <li v-for="t in titulos" :key="t.idtitulo">
            <RouterLink
              :to="{ name: 'titulo', params: { idtitulo: t.idtitulo } }"
              class="list-row flex items-center gap-3"
            >
              <div class="min-w-0 flex-1">
                <p class="text-[15px] font-medium tabular-nums">Nº {{ t.numero }}</p>
                <p class="meta truncate">{{ t.cobranca }}, empresa {{ t.empresa }}</p>
              </div>
              <div class="text-right shrink-0">
                <p class="text-[15px] font-semibold tabular-nums">R$ {{ formatReal(t.valor) }}</p>
                <p class="tabular-nums text-[13px]" :class="vencido(t.vencimento) ? 'font-semibold text-danger-700' : 'text-ink-500'">
                  {{ vencido(t.vencimento) ? 'Venceu' : 'Vence' }} {{ mudadata(t.vencimento) }}
                </p>
              </div>
              <Icon name="chevron-right" class="text-ink-400" />
            </RouterLink>
          </li>
        </ul>
      </template>
    </div>

    <Sheet :open="abertos" title="Títulos em aberto" :subtitle="fantasia || undefined" size="tall" @close="abertos = false">
      <LoadingState v-if="abertosLoading" label="Consultando o servidor…" />
      <EmptyState v-else-if="abertosErro" icon="alert" label="Não foi possível consultar o servidor" :hint="abertosErro">
        <button type="button" class="btn btn-tonal btn-sm" @click="abrirAbertos">Tentar de novo</button>
      </EmptyState>
      <EmptyState v-else-if="abertosRows.length === 0" icon="check-circle" label="Nenhum título em aberto" />
      <div v-else>
      <p class="flex items-baseline justify-between gap-3 pb-3 text-[15px]">
        <span class="text-ink-500">{{ abertosRows.length }} {{ abertosRows.length === 1 ? 'título' : 'títulos' }}</span>
        <strong class="font-semibold tabular-nums">Total R$ {{ formatReal(abertosTotal) }}</strong>
      </p>
      <ul class="divide-y divide-ink-100 -mx-5 border-t border-ink-100">
        <li v-for="(r, i) in abertosRows" :key="i" class="flex items-center gap-3 px-5 py-3">
          <div class="min-w-0 flex-1">
            <p class="text-[15px] font-medium tabular-nums">Nº {{ r.numero }}</p>
            <p class="meta">
              {{ r.cobranca }},
              <span :class="{ 'font-semibold text-danger-700': vencido(r.dtvenc) }">{{ vencido(r.dtvenc) ? 'venceu' : 'vence' }} {{ mudadata(r.dtvenc) }}</span>
            </p>
          </div>
          <p class="text-[15px] font-semibold tabular-nums shrink-0">R$ {{ formatReal(r.valor) }}</p>
          <button type="button" class="btn btn-tonal btn-sm shrink-0" :aria-busy="ocupado === `dup-${i}`" :disabled="!!ocupado && ocupado !== `dup-${i}`" :aria-label="`Duplicata do título ${r.numero}`" @click="executar(`dup-${i}`, () => verDuplicata(r))">Duplicata</button>
        </li>
      </ul>
      </div>
    </Sheet>
  </AppShell>
</template>
