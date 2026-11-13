<script setup lang="ts">
import { computed } from 'vue'
import { formatReal, realDeDigitos } from '../lib/format'

// Digita-se como numa maquininha: cada dígito entra pela direita nos centavos.
const model = defineModel<number | null>({ required: true })

const texto = computed(() => (model.value ? `R$ ${formatReal(model.value)}` : ''))

function cursorNoFim(el: HTMLInputElement) {
  const fim = el.value.length
  el.setSelectionRange(fim, fim)
}

function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  model.value = realDeDigitos(el.value)
  // Reaplica a máscara mesmo quando o número não mudou (ex.: apagou o "R$").
  el.value = texto.value
  cursorNoFim(el)
}

function onFocus(e: Event) {
  const el = e.target as HTMLInputElement
  requestAnimationFrame(() => cursorNoFim(el))
}
</script>

<template>
  <input
    :value="texto"
    type="text"
    inputmode="numeric"
    autocomplete="off"
    class="input tabular-nums"
    placeholder="R$ 0,00"
    @input="onInput"
    @focus="onFocus"
    @click="onFocus"
  />
</template>
