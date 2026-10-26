<script setup lang="ts" generic="T extends string | number">
const model = defineModel<T>({ required: true })
defineProps<{ options: { value: T; label: string }[]; label?: string }>()
</script>

<template>
  <div class="flex p-1 gap-1 rounded-xl bg-ink-100" role="radiogroup" :aria-label="label">
    <button
      v-for="o in options"
      :key="String(o.value)"
      type="button"
      role="radio"
      :aria-checked="model === o.value"
      class="flex-1 min-h-10 px-2 rounded-lg text-sm font-semibold transition-colors"
      :class="model === o.value ? 'bg-surface text-ink-900 shadow-[0_1px_2px_rgb(15_23_42/0.12)]' : 'text-ink-500'"
      @click="model = o.value"
    >{{ o.label }}</button>
  </div>
</template>
