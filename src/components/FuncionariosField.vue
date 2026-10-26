<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from './Icon.vue'
import SelectField from './SelectField.vue'
import type { Opt } from '../services/os'

const props = defineProps<{ disponiveis: Opt[]; selecionados: Opt[]; disabled?: boolean }>()
const emit = defineEmits<{ (e: 'add', f: Opt): void; (e: 'add-all'): void; (e: 'remove', f: Opt): void }>()

// Escolher na lista já adiciona; o campo volta vazio para a próxima escolha.
const escolha = ref('')
const options = computed(() => props.disponiveis.map((f) => ({ value: f.codigo, label: f.descricao })))
const placeholder = computed(() =>
  props.disabled ? 'Escolha a OS' : props.disponiveis.length ? 'Adicionar' : 'Todos adicionados',
)

function adicionar(codigo: string) {
  const f = props.disponiveis.find((x) => x.codigo === codigo)
  escolha.value = ''
  if (f) emit('add', f)
}
</script>

<template>
  <div>
    <div class="flex items-baseline justify-between mb-1.5">
      <span class="label mb-0">Funcionários envolvidos</span>
      <span v-if="selecionados.length" class="meta tabular-nums">{{ selecionados.length }}</span>
    </div>
    <div class="flex gap-2">
      <SelectField
        v-model="escolha"
        class="flex-1 min-w-0"
        :options="options"
        title="Adicionar funcionário"
        :placeholder="placeholder"
        :disabled="disabled || !disponiveis.length"
        aria-label="Adicionar funcionário"
        @change="adicionar"
      />
      <button type="button" class="btn btn-tonal" :disabled="disabled || !disponiveis.length" @click="emit('add-all')">Todos</button>
    </div>
    <ul v-if="selecionados.length" class="flex flex-wrap gap-2 mt-3">
      <li
        v-for="f in selecionados"
        :key="f.codigo"
        class="inline-flex items-center h-9 rounded-full bg-ink-100 text-sm font-medium pl-3"
      >
        {{ f.descricao }}
        <button type="button" class="h-full pl-1.5 pr-2.5 text-ink-500" :aria-label="`Remover ${f.descricao}`" @click="emit('remove', f)">
          <Icon name="x" :size="16" />
        </button>
      </li>
    </ul>
  </div>
</template>
