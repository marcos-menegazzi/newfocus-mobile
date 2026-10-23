<script setup lang="ts">
import { useAuthStore } from '../stores/auth'
const auth = useAuthStore()
</script>

<template>
  <div class="p-6">
    <h1 class="text-xl font-bold">Bem-vindo, {{ auth.usuario?.usuario }}</h1>
    <p class="text-ink-600 text-sm mt-1">Fundação carregada com sucesso.</p>
  </div>
</template>
