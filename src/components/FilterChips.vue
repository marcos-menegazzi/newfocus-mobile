<script setup lang="ts">
import Icon from './Icon.vue'

export interface Chip { key: string; label: string; removable?: boolean }

defineProps<{ items: Chip[] }>()
const emit = defineEmits<{ (e: 'remove', key: string): void; (e: 'open'): void }>()
</script>

<template>
  <div v-if="items.length" class="flex flex-wrap gap-2">
    <span
      v-for="c in items"
      :key="c.key"
      class="inline-flex items-center max-w-full min-h-10 rounded-full bg-brand-50 border border-brand-100 text-brand-600 text-[13px] font-medium"
    >
      <button
        type="button"
        class="self-stretch min-h-10 min-w-0 truncate pl-3.5 rounded-l-full active:bg-brand-100"
        :class="c.removable === false ? 'pr-3.5 rounded-r-full' : 'pr-1'"
        :aria-label="`Filtro ${c.label}: alterar`"
        @click="emit('open')"
      >{{ c.label }}</button>
      <button
        v-if="c.removable !== false"
        type="button"
        class="self-stretch min-w-10 inline-flex items-center justify-center rounded-r-full text-brand-600 active:bg-brand-100"
        :aria-label="`Remover filtro ${c.label}`"
        @click="emit('remove', c.key)"
      >
        <Icon name="x" :size="15" :stroke="2.2" />
      </button>
    </span>
  </div>
</template>
