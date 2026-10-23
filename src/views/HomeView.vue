<script setup lang="ts">
import { useAuthStore } from '../stores/auth'
import AppShell from '../components/AppShell.vue'
const auth = useAuthStore()
</script>

<template>
  <AppShell>
    <div class="p-6">
      <h1 class="text-xl font-bold">Bem-vindo, {{ auth.usuario?.usuario }}</h1>
      <p class="text-ink-600 text-sm mt-1">Fundação carregada com sucesso.</p>
    </div>
  </AppShell>
</template>
