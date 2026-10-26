<script lang="ts">
export interface SelectOption<V = string> {
  value: V
  label: string
  hint?: string
}

// Listas maiores que isso ganham busca no topo da folha.
const SEARCH_FROM = 8

function key(v: unknown): string {
  return v == null ? '' : String(v)
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
</script>

<script setup lang="ts" generic="V">
import { computed, ref } from 'vue'
import Icon from './Icon.vue'
import Sheet from './Sheet.vue'
import SearchField from './SearchField.vue'
import EmptyState from './EmptyState.vue'

// Dois nós raiz (campo + folha): classes e atributos vão para o campo.
defineOptions({ inheritAttrs: false })

const model = defineModel<V>({ required: true })
const props = defineProps<{
  options: SelectOption<V>[]
  /** Título da folha, ex.: "Selecionar empresa". */
  title: string
  placeholder?: string
  disabled?: boolean
  /** Texto antes do valor escolhido no campo, ex.: "Buscar em:". */
  prefix?: string
  empty?: string
  emptyHint?: string
  size?: 'md' | 'sm'
  ariaLabel?: string
}>()
const emit = defineEmits<{ (e: 'change', value: V): void }>()

const open = ref(false)
const busca = ref('')

const selected = computed(() => props.options.find((o) => key(o.value) === key(model.value)))
const searchable = computed(() => props.options.length > SEARCH_FROM)
const visiveis = computed(() => {
  const q = normalize(busca.value.trim())
  if (!q) return props.options
  return props.options.filter((o) => normalize(`${o.label} ${o.hint ?? ''}`).includes(q))
})

const isSel = (o: SelectOption<V>) => key(o.value) === key(model.value)

function abrir() {
  busca.value = ''
  open.value = true
}

function escolher(o: SelectOption<V>) {
  open.value = false
  if (isSel(o)) return
  model.value = o.value
  emit('change', o.value)
}
</script>

<template>
  <button
    v-bind="$attrs"
    type="button"
    class="input text-left flex items-center justify-between gap-2"
    :class="size === 'sm' ? 'min-h-10 py-1.5 text-sm' : ''"
    :disabled="disabled"
    :aria-label="ariaLabel"
    aria-haspopup="dialog"
    @click="abrir"
  >
    <span class="truncate" :class="selected ? '' : 'text-ink-400'">
      <template v-if="selected">{{ prefix ? `${prefix} ${selected.label}` : selected.label }}</template>
      <template v-else>{{ placeholder ?? 'Selecione' }}</template>
    </span>
    <Icon name="chevron-right" class="text-ink-400 shrink-0" />
  </button>

  <Sheet :open="open" :title="title" :size="searchable ? 'tall' : 'auto'" @close="open = false">
    <div v-if="searchable" class="sticky top-0 z-[1] bg-surface pb-3 -mx-5 px-5">
      <SearchField v-model="busca" placeholder="Buscar na lista" />
    </div>
    <EmptyState
      v-if="options.length === 0"
      icon="info"
      :label="empty ?? 'Nenhuma opção disponível'"
      :hint="emptyHint"
    />
    <EmptyState
      v-else-if="visiveis.length === 0"
      icon="search"
      label="Nada encontrado"
      :hint="`Nenhuma opção contém “${busca}”.`"
    />
    <ul v-else class="divide-y divide-ink-100 -mx-5">
      <li v-for="o in visiveis" :key="key(o.value)">
        <button
          type="button"
          class="list-row px-5 flex items-center justify-between gap-3"
          :aria-current="isSel(o) ? 'true' : undefined"
          @click="escolher(o)"
        >
          <span class="min-w-0">
            <span class="block text-[15px] font-medium">{{ o.label }}</span>
            <span v-if="o.hint" class="meta">{{ o.hint }}</span>
          </span>
          <Icon v-if="isSel(o)" name="check" class="text-brand-700" :stroke="2.4" />
        </button>
      </li>
    </ul>
  </Sheet>
</template>
