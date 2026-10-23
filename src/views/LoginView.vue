<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const error = ref('')
const loading = ref(false)

const form = reactive({
  server: '',
  id: '',
  licenciada: '',
  usuario: '',
  senha: '',
})

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(form)
    await router.push({ name: auth.usuario?.snos === 'S' ? 'home' : 'home' })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Falha no login'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-navy-950 flex flex-col justify-center px-6 safe-top safe-bottom">
    <div class="mb-10 text-center">
      <div class="mx-auto h-14 w-14 rounded-2xl bg-accent-500 flex items-center justify-center text-navy-950 font-extrabold text-2xl">N</div>
      <h1 class="mt-4 text-2xl font-bold text-white">NewFocus</h1>
      <p class="text-ink-400 text-sm">Sistemas de Pedidos</p>
    </div>

    <form class="space-y-4" @submit.prevent="submit">
      <label class="block">
        <span class="text-ink-400 text-xs font-medium">Servidor</span>
        <input v-model="form.server" type="text" placeholder="dev.voltplus.com.br" class="input" required />
      </label>
      <label class="block">
        <span class="text-ink-400 text-xs font-medium">ID (CostumerId)</span>
        <input v-model="form.id" type="text" placeholder="voltplus_desenv" class="input" required />
      </label>
      <label class="block">
        <span class="text-ink-400 text-xs font-medium">Licenciada</span>
        <input v-model="form.licenciada" type="text" inputmode="numeric" placeholder="3" class="input" required />
      </label>
      <label class="block">
        <span class="text-ink-400 text-xs font-medium">Usuário</span>
        <input v-model="form.usuario" type="text" autocomplete="username" class="input" required />
      </label>
      <label class="block">
        <span class="text-ink-400 text-xs font-medium">Senha</span>
        <input v-model="form.senha" type="password" autocomplete="current-password" class="input" required />
      </label>

      <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>

      <button type="submit" :disabled="loading" class="btn-primary w-full">
        {{ loading ? 'Entrando…' : 'Entrar' }}
      </button>
    </form>
  </div>
</template>
