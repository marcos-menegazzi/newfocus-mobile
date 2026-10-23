<script setup lang="ts">
import AppShell from '../components/AppShell.vue'
import EmptyState from '../components/EmptyState.vue'
import ScreenHeader from '../components/ScreenHeader.vue'
</script>
<template>
  <AppShell>
    <div class="p-6">
      <ScreenHeader title="Produto" />
      <EmptyState label="Detalhes do produto em breve" />
    </div>
  </AppShell>
</template>
