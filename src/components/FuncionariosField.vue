<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from './Icon.vue'
import Sheet from './Sheet.vue'
import SearchField from './SearchField.vue'
import EmptyState from './EmptyState.vue'
import type { Opt } from '../services/os'

// Listas maiores que isso ganham busca no topo da folha.
const SEARCH_FROM = 8

const model = defineModel<Opt[]>({ required: true })
const props = defineProps<{
  /** Todos os funcionários da OS escolhida. */
  funcionarios: Opt[]
  /** Sem OS escolhida ainda. */
  disabled?: boolean
  loading?: boolean
}>()

const open = ref(false)
const busca = ref('')

const marcados = computed(() => new Set(model.value.map((f) => f.codigo)))
const total = computed(() => props.funcionarios.length)
const qtd = computed(() => model.value.length)
const todos = computed(() => total.value > 0 && qtd.value === total.value)
const bloqueado = computed(() => props.disabled || props.loading || total.value === 0)

const resumo = computed(() => {
  if (props.disabled) return 'Escolha a OS primeiro'
  if (props.loading) return 'Carregando funcionários…'
  if (!total.value) return 'Nenhum funcionário nesta OS'
  if (!qtd.value) return 'Escolher funcionários'
  if (todos.value) return total.value === 1 ? '1 selecionado' : `Todos os ${total.value} selecionados`
  return `${qtd.value} de ${total.value} selecionados`
})

const visiveis = computed(() => {
  const q = normalize(busca.value.trim())
  if (!q) return props.funcionarios
  return props.funcionarios.filter((f) => normalize(f.descricao).includes(q))
})

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  const primeira = partes[0]?.[0] ?? ''
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (primeira + ultima).toUpperCase()
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Mantém a ordem da lista da OS, não a ordem dos toques.
function definir(codigos: Set<string>) {
  model.value = props.funcionarios.filter((f) => codigos.has(f.codigo))
}

function alternar(f: Opt) {
  const s = new Set(marcados.value)
  if (s.has(f.codigo)) s.delete(f.codigo)
  else s.add(f.codigo)
  definir(s)
}

function alternarTodos() {
  definir(todos.value ? new Set() : new Set(props.funcionarios.map((f) => f.codigo)))
}

function abrir() {
  busca.value = ''
  open.value = true
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-3 mb-1.5 min-h-5">
      <span class="label mb-0">Funcionários envolvidos</span>
      <button
        v-if="!bloqueado"
        type="button"
        class="-my-2 -mr-2 px-2 h-9 rounded-lg text-[13px] font-semibold text-brand-700 active:bg-brand-50 transition-colors"
        @click="alternarTodos"
      >
        {{ todos ? 'Limpar' : 'Adicionar todos' }}
      </button>
    </div>

    <!-- Com gente escolhida, o campo vira a própria lista: uma linha por pessoa e,
         no fim, a linha para adicionar mais. -->
    <div v-if="qtd && !bloqueado" class="rounded-[10px] border border-ink-200 bg-surface overflow-hidden">
      <ul class="divide-y divide-ink-100" aria-label="Funcionários selecionados">
        <li v-for="f in model" :key="f.codigo" class="flex items-center gap-3 min-h-12 pl-3 pr-1">
          <span class="avatar" aria-hidden="true">{{ iniciais(f.descricao) }}</span>
          <span class="flex-1 min-w-0 truncate text-[15px] font-medium">{{ f.descricao }}</span>
          <button
            type="button"
            class="icon-btn text-ink-400 active:text-danger-600"
            :aria-label="`Remover ${f.descricao}`"
            @click="alternar(f)"
          >
            <Icon name="x" :size="18" />
          </button>
        </li>
      </ul>
      <button
        type="button"
        class="flex w-full items-center gap-3 min-h-12 pl-3 pr-3 border-t border-ink-200 bg-ink-50 text-left active:bg-ink-100 transition-colors"
        aria-haspopup="dialog"
        @click="abrir"
      >
        <span class="avatar avatar-add" aria-hidden="true"><Icon :name="todos ? 'edit' : 'plus'" :size="16" :stroke="2.2" /></span>
        <span class="flex-1 text-[15px] font-semibold text-brand-700">{{ todos ? 'Alterar seleção' : 'Adicionar funcionário' }}</span>
        <span class="meta tabular-nums">{{ qtd }} de {{ total }}</span>
      </button>
    </div>

    <button
      v-else
      type="button"
      class="input text-left flex items-center justify-between gap-2"
      :disabled="bloqueado"
      aria-haspopup="dialog"
      aria-label="Escolher funcionários envolvidos"
      @click="abrir"
    >
      <span class="truncate text-ink-400">{{ resumo }}</span>
      <Icon v-if="!bloqueado" name="chevron-right" class="text-ink-400 shrink-0" />
    </button>

    <Sheet
      :open="open"
      title="Funcionários envolvidos"
      :subtitle="qtd ? `${qtd} de ${total} selecionados` : 'Toque para marcar quem participou'"
      :size="total > SEARCH_FROM ? 'tall' : 'auto'"
      @close="open = false"
    >
      <div v-if="total > SEARCH_FROM" class="sticky top-0 z-[1] bg-surface pb-3 -mx-5 px-5">
        <SearchField v-model="busca" placeholder="Buscar funcionário" />
      </div>

      <EmptyState
        v-if="!visiveis.length"
        icon="search"
        label="Nada encontrado"
        :hint="`Nenhum funcionário contém “${busca}”.`"
      />
      <ul v-else class="-mx-5 divide-y divide-ink-100">
        <li v-if="!busca">
          <button type="button" class="check-row font-semibold" role="checkbox" :aria-checked="todos" @click="alternarTodos">
            <span class="box" :class="{ on: todos, partial: qtd && !todos }" aria-hidden="true">
              <Icon v-if="todos" name="check" :size="16" :stroke="2.6" />
              <span v-else-if="qtd" class="h-0.5 w-2.5 rounded-full bg-current" />
            </span>
            Selecionar todos
          </button>
        </li>
        <li v-for="f in visiveis" :key="f.codigo">
          <button
            type="button"
            class="check-row font-medium"
            role="checkbox"
            :aria-checked="marcados.has(f.codigo)"
            @click="alternar(f)"
          >
            <span class="box" :class="{ on: marcados.has(f.codigo) }" aria-hidden="true">
              <Icon v-if="marcados.has(f.codigo)" name="check" :size="16" :stroke="2.6" />
            </span>
            <span class="min-w-0 truncate">{{ f.descricao }}</span>
          </button>
        </li>
      </ul>

      <template #footer>
        <button type="button" class="btn btn-primary w-full" @click="open = false">Pronto</button>
      </template>
    </Sheet>
  </div>
</template>

<style scoped>
.check-row {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  width: 100%;
  min-height: 3.25rem;
  padding: 0.625rem 1.25rem;
  text-align: left;
  font-size: 15px;
  transition: background-color 0.15s;
}
.check-row:active {
  background: var(--color-ink-50);
}

.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border-radius: 9999px;
  background: var(--color-brand-50);
  color: var(--color-brand-800);
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.02em;
}
.avatar-add {
  background: var(--color-surface);
  border: 1.5px dashed var(--color-brand-300);
  color: var(--color-brand-700);
}

.box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 1.375rem;
  height: 1.375rem;
  border-radius: 0.375rem;
  border: 1.5px solid var(--color-ink-200);
  background: var(--color-surface);
  color: var(--color-brand-700);
  transition:
    background-color 0.15s,
    border-color 0.15s;
}
.box.on {
  border-color: var(--color-brand-600);
  background: var(--color-brand-600);
  color: #fff;
}
.box.partial {
  border-color: var(--color-brand-600);
}
</style>
