<script setup lang="ts">
import Icon from './Icon.vue'

const model = defineModel<string>({ required: true })
defineProps<{ placeholder?: string; label?: string }>()
const emit = defineEmits<{ (e: 'submit'): void }>()

function clear() {
  model.value = ''
  emit('submit')
}
</script>

<template>
  <form class="relative flex-1 min-w-0" role="search" @submit.prevent="emit('submit')">
    <span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">
      <Icon name="search" :size="19" />
    </span>
    <input
      v-model="model"
      type="search"
      enterkeyhint="search"
      class="input pl-11 pr-11 [&::-webkit-search-cancel-button]:hidden"
      :placeholder="placeholder ?? 'Buscar'"
      :aria-label="label ?? placeholder ?? 'Buscar'"
    />
    <button
      v-if="model"
      type="button"
      class="absolute right-1.5 top-1/2 -translate-y-1/2 icon-btn h-9 w-9 text-ink-400"
      aria-label="Limpar busca"
      @click="clear"
    >
      <Icon name="x" :size="18" />
    </button>
  </form>
</template>
