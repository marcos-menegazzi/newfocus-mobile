<script setup lang="ts">
import Icon from './Icon.vue'
import type { HistoricoRow } from '../services/os'

defineProps<{ item: HistoricoRow }>()
defineEmits<{ (e: 'open'): void }>()
</script>

<template>
  <button class="list-row flex items-center gap-3" @click="$emit('open')">
    <span
      class="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
      :class="item.tipo === 'Despesa' ? 'bg-sun-100 text-sun-800' : 'bg-brand-50 text-brand-700'"
    >
      <Icon :name="item.tipo === 'Despesa' ? 'receipt' : 'clock'" />
    </span>
    <span class="min-w-0 flex-1">
      <span class="block text-[15px] font-medium">{{ item.tipo }} na OS {{ item.os }}</span>
      <span class="meta block truncate tabular-nums">{{ item.data }}{{ item.funcionario ? `, ${item.funcionario}` : '' }}</span>
    </span>
    <!-- O servidor já envia o valor formatado (ex.: 1.800,00). -->
    <span v-if="item.tipo === 'Despesa'" class="text-[15px] font-semibold tabular-nums whitespace-nowrap">R$ {{ item.valor }}</span>
    <Icon name="chevron-right" class="text-ink-400" />
  </button>
</template>
