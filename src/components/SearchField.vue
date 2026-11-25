<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import Icon from './Icon.vue'

const ESPERA = 350

const model = defineModel<string>({ required: true })
const props = withDefaults(
  defineProps<{
    placeholder?: string
    label?: string
    /** Busca sozinho quando a digitação para (além do botão do teclado). */
    auto?: boolean
  }>(),
  { auto: true },
)
const emit = defineEmits<{ (e: 'submit'): void }>()

const campo = ref<HTMLInputElement | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined

function buscar() {
  clearTimeout(timer)
  emit('submit')
}

function onInput() {
  clearTimeout(timer)
  if (props.auto) timer = setTimeout(buscar, ESPERA)
}

function enviar() {
  buscar()
  // Recolhe o teclado para os resultados aparecerem.
  campo.value?.blur()
}

function clear() {
  model.value = ''
  buscar()
  campo.value?.focus()
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <form class="relative flex-1 min-w-0" role="search" @submit.prevent="enviar">
    <span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">
      <Icon name="search" :size="20" />
    </span>
    <input
      ref="campo"
      v-model="model"
      type="search"
      enterkeyhint="search"
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
      class="input pl-11 pr-12 [&::-webkit-search-cancel-button]:hidden"
      :placeholder="placeholder ?? 'Buscar'"
      :aria-label="label ?? placeholder ?? 'Buscar'"
      @input="onInput"
    />
    <button
      v-if="model"
      type="button"
      class="absolute right-0.5 top-1/2 -translate-y-1/2 icon-btn text-ink-400"
      aria-label="Limpar busca"
      @click="clear"
    >
      <Icon name="x" :size="18" />
    </button>
  </form>
</template>
