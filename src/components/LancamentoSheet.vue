<script setup lang="ts">
import { ref, watch } from 'vue'
import Sheet from './Sheet.vue'
import LoadingState from './LoadingState.vue'
import { getDetalhe, type HistoricoRow, type LancamentoDetalhe } from '../services/os'

const props = defineProps<{ item: HistoricoRow | null }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const detalhe = ref<LancamentoDetalhe | null>(null)
const erro = ref('')

watch(
  () => props.item,
  async (item) => {
    detalhe.value = null
    erro.value = ''
    if (!item) return
    try {
      const d = await getDetalhe(item.registro, item.tipo)
      if (props.item === item) detalhe.value = d
    } catch {
      if (props.item === item) erro.value = 'Não foi possível carregar o lançamento. Verifique a conexão e tente de novo.'
    }
  },
)
</script>

<template>
  <Sheet
    :open="!!item"
    :title="item ? `${item.tipo} nº ${item.codigo}` : ''"
    :subtitle="item ? `OS ${item.os}` : undefined"
    @close="emit('close')"
  >
    <p v-if="erro" class="rounded-xl bg-danger-100 text-danger-700 px-3.5 py-3 text-sm" role="alert">{{ erro }}</p>
    <LoadingState v-else-if="!detalhe" />
    <template v-else>
      <dl class="grid grid-cols-2 gap-3 text-sm">
        <div class="rounded-xl bg-ink-50 px-3.5 py-3">
          <dt class="meta text-xs">Data e hora</dt>
          <dd class="font-semibold tabular-nums">{{ detalhe.data }}{{ detalhe.hora ? `, ${detalhe.hora}` : '' }}</dd>
        </div>
        <div v-if="detalhe.tipo === 'Despesa'" class="rounded-xl bg-ink-50 px-3.5 py-3">
          <dt class="meta text-xs">Valor</dt>
          <!-- O servidor já envia o valor formatado (ex.: 1.800,00). -->
          <dd class="font-semibold tabular-nums">R$ {{ detalhe.valor }}</dd>
        </div>
      </dl>

      <template v-if="detalhe.funcionarios.length">
        <h3 class="section-title mt-5 mb-2">Funcionários</h3>
        <ul class="flex flex-wrap gap-2">
          <li v-for="f in detalhe.funcionarios" :key="f.codigo" class="h-8 px-3 inline-flex items-center rounded-full bg-ink-100 text-sm">{{ f.descricao }}</li>
        </ul>
      </template>

      <template v-if="detalhe.tipo === 'Diário' && detalhe.apontamentos.length">
        <h3 class="section-title mt-5 mb-2">Horários</h3>
        <ul class="divide-y divide-ink-100 border-y border-ink-100">
          <li v-for="(a, i) in detalhe.apontamentos" :key="i" class="py-2 tabular-nums">{{ a.data }}, {{ a.hora }}</li>
        </ul>
      </template>

      <template v-if="detalhe.obs">
        <h3 class="section-title mt-5 mb-1">Observação</h3>
        <p class="text-[15px] text-ink-700 whitespace-pre-wrap">{{ detalhe.obs }}</p>
      </template>
    </template>
  </Sheet>
</template>
