<script setup lang="ts">
import { reactive } from 'vue'
import { useAuthStore } from '../stores/auth'
import { run } from '../db/connection'
import AppShell from '../components/AppShell.vue'
import { useToast } from '../composables/useToast'

const auth = useAuthStore()
const { notify } = useToast()
const form = reactive({ server: auth.usuario?.server ?? '' })

async function save() {
  const server = form.server.trim().toLowerCase()
  if (!server) return notify('Informe o servidor')
  try {
    await run('UPDATE usuario SET server = ?', [server])
    if (auth.usuario) auth.usuario.server = server
    notify('Servidor atualizado', 'success')
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Não foi possível salvar', 'error')
  }
}
</script>

<template>
  <AppShell title="Configuração">
    <div class="page">
      <section class="panel p-4 space-y-4">
        <div>
          <h2 class="section-title">Servidor</h2>
          <p class="meta mt-0.5">Endereço usado para sincronizar e consultar o sistema.</p>
        </div>
        <label class="block">
          <span class="label">Endereço do servidor</span>
          <input v-model="form.server" type="text" inputmode="url" autocapitalize="off" autocorrect="off" class="input" />
        </label>
        <button class="btn btn-primary w-full" @click="save">Salvar servidor</button>
      </section>

      <dl class="list">
        <div class="flex justify-between gap-4 px-4 py-3.5">
          <dt class="text-ink-500">Usuário</dt>
          <dd class="font-medium">{{ auth.usuario?.usuario }}</dd>
        </div>
        <div class="flex justify-between gap-4 px-4 py-3.5">
          <dt class="text-ink-500">Licenciada</dt>
          <dd class="font-medium tabular-nums">{{ auth.usuario?.codlic }}</dd>
        </div>
        <div class="flex justify-between gap-4 px-4 py-3.5">
          <dt class="text-ink-500">ID do cliente</dt>
          <dd class="font-medium">{{ auth.usuario?.id }}</dd>
        </div>
        <div class="flex justify-between gap-4 px-4 py-3.5">
          <dt class="text-ink-500">Versão do banco</dt>
          <dd class="font-medium tabular-nums">{{ auth.usuario?.versao }}</dd>
        </div>
      </dl>
    </div>
  </AppShell>
</template>
