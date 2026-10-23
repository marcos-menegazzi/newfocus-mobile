<script setup lang="ts">
import Toast from './components/Toast.vue'
import { useToast } from './composables/useToast'

const { items } = useToast()
</script>

<template>
  <router-view />
  <Toast :items="items" />
</template>
