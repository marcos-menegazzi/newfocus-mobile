<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { run } from '../db/connection'
import AppShell from '../components/AppShell.vue'

const auth = useAuthStore()
const saved = ref('')
const form = reactive({ server: auth.usuario?.server ?? '' })

async function save() {
  if (!form.server) return
  await run('UPDATE usuario SET server = ?', [form.server.trim().toLowerCase()])
  if (auth.usuario) auth.usuario.server = form.server.trim().toLowerCase()
  saved.value = 'Configuração alterada com sucesso.'
}
</script>

<template>
  <AppShell>
    <div class="p-6">
      <h1 class="text-ink-900 text-xl font-bold mb-6">Configuração</h1>
      <label class="block mb-4">
        <span class="text-ink-600 text-xs font-medium">Servidor</span>
        <input v-model="form.server" type="text" class="input" />
      </label>
      <button class="btn-primary w-full" @click="save">Salvar</button>
      <p v-if="saved" class="text-accent-600 text-sm mt-3">{{ saved }}</p>
    </div>
  </AppShell>
</template>
