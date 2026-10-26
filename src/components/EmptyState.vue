<script setup lang="ts">
import Icon from './Icon.vue'

defineProps<{ label: string; hint?: string; icon?: string }>()
</script>

<template>
  <div class="py-12 px-6 flex flex-col items-center text-center">
    <div class="h-12 w-12 rounded-2xl bg-ink-100 text-ink-400 flex items-center justify-center mb-3">
      <Icon :name="icon ?? 'search'" :size="22" />
    </div>
    <p class="text-[15px] font-semibold text-ink-900">{{ label }}</p>
    <p v-if="hint" class="meta mt-1 max-w-xs">{{ hint }}</p>
    <div v-if="$slots.default" class="mt-4"><slot /></div>
  </div>
</template>
