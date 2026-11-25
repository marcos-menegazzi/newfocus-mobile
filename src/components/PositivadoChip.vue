<script setup lang="ts">
import Icon from './Icon.vue'

// Verde = teve venda faturada no mês; vermelho = ainda não.
defineProps<{ positivado: boolean }>()
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1 rounded-full pl-1.5 pr-2.5 h-6 text-xs font-semibold whitespace-nowrap"
    :class="positivado ? 'bg-success-50 text-success-800' : 'bg-danger-100 text-danger-700'"
    data-positivado
  >
    <Icon :name="positivado ? 'check' : 'x'" :size="14" :stroke="2.4" />
    {{ positivado ? 'Positivado' : 'Não positivado' }}
  </span>
</template>
