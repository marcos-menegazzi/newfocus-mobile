<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { run } from '../db/connection'
import AppShell from '../components/AppShell.vue'
import FieldError from '../components/FieldError.vue'
import { useToast } from '../composables/useToast'
import { APP_VERSION, buildDateLabel } from '../lib/appInfo'

const auth = useAuthStore()
const buildDate = buildDateLabel()
const { notify } = useToast()
const form = reactive({ server: auth.usuario?.server ?? '' })
const erro = ref('')
const alterado = computed(() => form.server.trim().toLowerCase() !== (auth.usuario?.server ?? ''))

async function save() {
  const server = form.server.trim().toLowerCase()
  if (!server) {
    erro.value = 'Informe o endereço do servidor.'
    return
  }
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
          <input v-model="form.server" type="text" inputmode="url" autocapitalize="off" autocorrect="off" class="input" :aria-invalid="!!erro" aria-describedby="erro-servidor" @input="erro = ''" />
          <FieldError id="erro-servidor" :msg="erro" />
        </label>
        <button type="button" class="btn btn-primary w-full" :disabled="!alterado" @click="save">Salvar servidor</button>
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
          <dt class="text-ink-500">Versão do app</dt>
          <dd class="text-right">
            <span class="font-medium tabular-nums">{{ APP_VERSION }}</span>
            <span class="meta block tabular-nums">compilada em {{ buildDate }}</span>
          </dd>
        </div>
        <div class="flex justify-between gap-4 px-4 py-3.5">
          <dt class="text-ink-500">Versão no servidor</dt>
          <dd class="font-medium tabular-nums">{{ auth.usuario?.versao }}</dd>
        </div>
      </dl>
    </div>
  </AppShell>
</template>
