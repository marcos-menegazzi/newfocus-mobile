<script setup lang="ts">
import { computed } from 'vue'
import { formatReal, realDeDigitos } from '../lib/format'

// Digita-se como numa maquininha: cada dígito entra pela direita nos centavos.
const model = defineModel<number | null>({ default: null })

const texto = computed(() => (model.value ? `R$ ${formatReal(model.value)}` : ''))

function cursorNoFim(el: HTMLInputElement) {
  const fim = el.value.length
  el.setSelectionRange(fim, fim)
}

// Ao entrar, o valor fica selecionado: o que se digita substitui o anterior.
// Um novo toque leva o cursor ao fim, para continuar ou apagar.
let entrando = false

function onInput(e: Event) {
  entrando = false
  const el = e.target as HTMLInputElement
  model.value = realDeDigitos(el.value)
  // Reaplica a máscara mesmo quando o número não mudou (ex.: apagou o "R$").
  el.value = texto.value
  cursorNoFim(el)
}

function onFocus(e: Event) {
  entrando = true
  const el = e.target as HTMLInputElement
  requestAnimationFrame(() => entrando && el.select())
}

function onClick(e: Event) {
  const el = e.target as HTMLInputElement
  // O primeiro toque solta o dedo depois do foco e desfaz a seleção.
  if (entrando) el.select()
  else cursorNoFim(el)
  entrando = false
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
    @click="onClick"
  />
</template>
