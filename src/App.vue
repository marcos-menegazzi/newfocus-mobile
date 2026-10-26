<script setup lang="ts">
import ConfirmDialog from './components/ConfirmDialog.vue'
import Toast from './components/Toast.vue'
import { useToast } from './composables/useToast'

const { items } = useToast()
</script>

<template>
  <router-view />
  <Toast :items="items" />
  <ConfirmDialog />
</template>
