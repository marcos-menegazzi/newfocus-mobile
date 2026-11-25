<script setup lang="ts" generic="T extends string | number">
const model = defineModel<T>({ required: true })
const props = defineProps<{ options: { value: T; label: string }[]; label?: string }>()

// Só a opção marcada entra na ordem do Tab; as setas trocam de opção (padrão de radiogroup).
function tabIndex(i: number): number {
  const marcada = props.options.findIndex((o) => o.value === model.value)
  return i === Math.max(0, marcada) ? 0 : -1
}

function onKey(e: KeyboardEvent, i: number) {
  const passo = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
  if (!passo) return
  e.preventDefault()
  const n = props.options.length
  const alvo = (i + passo + n) % n
  model.value = props.options[alvo].value
  const grupo = (e.currentTarget as HTMLElement).parentElement
  ;(grupo?.children[alvo] as HTMLElement | undefined)?.focus()
}
</script>

<template>
  <div class="flex p-1 gap-1 rounded-xl bg-ink-100" role="radiogroup" :aria-label="label">
    <button
      v-for="(o, i) in options"
      :key="String(o.value)"
      type="button"
      role="radio"
      :aria-checked="model === o.value"
      :tabindex="tabIndex(i)"
      class="flex-1 min-h-11 px-2 py-1 rounded-lg text-sm leading-tight font-semibold transition-colors disabled:text-ink-400 disabled:cursor-not-allowed"
      :class="model === o.value ? 'bg-surface text-ink-900 shadow-[0_1px_2px_rgb(27_51_80/0.12)] ring-1 ring-field/50' : 'text-ink-500 active:bg-ink-200/60'"
      @click="model = o.value"
      @keydown="onKey($event, i)"
    >{{ o.label }}</button>
  </div>
</template>
