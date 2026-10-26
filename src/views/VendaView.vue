<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import { query } from '../db/connection'
import { formatReal, mudadata } from '../lib/format'
import { useToast } from '../composables/useToast'

interface ItemRow {
  produto: string
  descricao: string
  quant: number
  vlunit: number
  vldescto: number
  vltotal: number
  condicao: string
  tabela: string
  sequencia: number
}

const route = useRoute()
const { notify } = useToast()

const pedido = computed(() => {
  const p = route.params.pedido
  return Array.isArray(p) ? p[0] : p
})
const cliente = computed(() => {
  const q = route.query.cliente
  return typeof q === 'string' ? q : ''
})
const data = computed(() => {
  const q = route.query.data
  return typeof q === 'string' ? q : ''
})
const total = computed(() => {
  const q = route.query.total
  return typeof q === 'string' ? q : ''
})
const fat = computed(() => route.query.fat === 'S')

const itens = ref<ItemRow[]>([])

onMounted(async () => {
  try {
    const sql = `SELECT h.produto, h.descricao, h.quant, sum(h.vlunit) AS vlunit, sum(h.vldescto) AS vldescto, sum(h.vltotal) AS vltotal, v.condicao, h.tabela, h.sequencia AS sequencia
FROM histvenda v, histitens h
WHERE v.pedido = h.pedido AND v.lancto = h.lancto AND h.pedido = ?${fat.value ? " AND h.faturamento = 'S'" : ''}
GROUP BY h.produto, h.sequencia ORDER BY h.produto`
    itens.value = await query<ItemRow>(sql, [pedido.value])
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Erro ao carregar', 'error')
  }
})
</script>

<template>
  <AppShell :title="`Venda ${pedido}`" :subtitle="cliente || undefined" back>
    <div class="page">
      <section class="panel grid grid-cols-2 divide-x divide-ink-100">
        <div class="px-4 py-3.5">
          <p class="meta">Total</p>
          <p class="mt-1 text-xl font-semibold tabular-nums">R$ {{ formatReal(total) }}</p>
        </div>
        <div class="px-4 py-3.5">
          <p class="meta">Data</p>
          <p class="mt-1 text-xl font-semibold tabular-nums">{{ mudadata(data) }}</p>
        </div>
      </section>

      <div v-if="itens.length === 0" class="panel">
        <EmptyState icon="package" label="Nenhum item nesta venda" />
      </div>
      <section v-else>
        <h2 class="section-title px-1 mb-2">{{ itens.length }} {{ itens.length === 1 ? 'item' : 'itens' }}</h2>
        <ul class="list">
          <li v-for="i in itens" :key="i.sequencia" class="flex items-start gap-3 px-4 py-3">
            <div class="min-w-0 flex-1">
              <p class="text-[15px] font-medium leading-snug line-clamp-2">{{ i.descricao }}</p>
              <p class="meta tabular-nums mt-0.5">Cód. {{ i.produto }}, {{ i.quant }} × R$ {{ formatReal(i.vlunit) }}</p>
              <p v-if="Number(i.vldescto) > 0" class="text-xs text-brand-700 font-medium mt-0.5 tabular-nums">Desconto R$ {{ formatReal(i.vldescto) }}</p>
            </div>
            <p class="text-[15px] font-semibold tabular-nums shrink-0">R$ {{ formatReal(i.vltotal) }}</p>
          </li>
        </ul>
      </section>
    </div>
  </AppShell>
</template>
