<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{ value: number; max: number; tone?: 'light' | 'dark'; label: string }>(),
  { tone: 'light' },
)

const pct = computed(() => (props.max > 0 ? Math.min(100, Math.max(0, (props.value / props.max) * 100)) : 0))
</script>

<template>
  <div
    class="h-2 w-full rounded-full overflow-hidden"
    :class="tone === 'dark' ? 'bg-white/20' : 'bg-brand-200'"
    role="meter"
    :aria-label="label"
    :aria-valuenow="value"
    aria-valuemin="0"
    :aria-valuemax="max"
  >
    <div
      class="h-full w-full rounded-full transition-transform duration-500 ease-enter"
      :class="tone === 'dark' ? 'bg-accent-500' : 'bg-brand-600'"
      :style="{ transform: `translateX(${pct - 100}%)` }"
    />
  </div>
</template>
