<script setup lang="ts">
import Icon from './Icon.vue'

// Erro logo abaixo do campo; `id` liga ao campo por aria-describedby.
defineProps<{ id?: string; msg?: string | null }>()
</script>

<template>
  <p v-if="msg" :id="id" class="field-error">
    <Icon name="alert" :size="16" class="mt-0.5" />
    <span>{{ msg }}</span>
  </p>
</template>
