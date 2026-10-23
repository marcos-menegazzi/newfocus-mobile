<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <div class="py-12 text-center">
    <p class="text-ink-400 text-sm">{{ label }}</p>
  </div>
</template>
