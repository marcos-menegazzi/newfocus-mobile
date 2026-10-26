<script setup lang="ts">
import Icon from './Icon.vue'

export interface Chip { key: string; label: string; removable?: boolean }

defineProps<{ items: Chip[] }>()
const emit = defineEmits<{ (e: 'remove', key: string): void; (e: 'open'): void }>()
</script>

<template>
  <div v-if="items.length" class="flex gap-2 overflow-x-auto -mx-4 px-4 pb-0.5 [scrollbar-width:none]">
    <span
      v-for="c in items"
      :key="c.key"
      class="inline-flex items-center shrink-0 h-8 rounded-full bg-brand-50 border border-brand-100 text-brand-800 text-[13px] font-medium"
    >
      <button type="button" class="pl-3 h-full" :class="c.removable === false ? 'pr-3' : 'pr-1'" @click="emit('open')">{{ c.label }}</button>
      <button
        v-if="c.removable !== false"
        type="button"
        class="h-full pl-1 pr-2.5 text-brand-700"
        :aria-label="`Remover filtro ${c.label}`"
        @click="emit('remove', c.key)"
      >
        <Icon name="x" :size="15" :stroke="2.2" />
      </button>
    </span>
  </div>
</template>
