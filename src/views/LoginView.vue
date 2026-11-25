<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../components/Icon.vue'
import Logo from '../components/Logo.vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const error = ref('')
const loading = ref(false)
const showSenha = ref(false)

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
    await router.push({ name: auth.homeRoute })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Falha no login'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-dvh bg-cream flex flex-col">
    <div class="sticky top-0 z-10 shrink-0 bg-brand-600 safe-top" aria-hidden="true" />
    <div class="pt-8 px-6 pb-5 flex flex-col items-center text-center">
      <Logo variant="full" :height="128" />
      <p class="mt-4 text-ink-500 text-[15px]">Pedidos, clientes e metas no seu bolso.</p>
    </div>

    <form class="flex-1 w-full max-w-md mx-auto px-6 pt-2 safe-bottom [--pad-bottom:2rem] space-y-6" @submit.prevent="submit">
      <fieldset class="space-y-4">
        <legend class="section-title mb-3">Conexão com a empresa</legend>
        <label class="block">
          <span class="label">Servidor</span>
          <input v-model="form.server" type="text" inputmode="url" autocapitalize="off" autocorrect="off" placeholder="ex.: dev.voltplus.com.br" class="input" required />
        </label>
        <div class="grid grid-cols-[1fr_7rem] gap-3">
          <label class="block">
            <span class="label">ID do cliente</span>
            <input v-model="form.id" type="text" autocapitalize="off" autocorrect="off" placeholder="ex.: voltplus_desenv" class="input" required />
          </label>
          <label class="block">
            <span class="label">Licenciada</span>
            <input v-model="form.licenciada" type="text" inputmode="numeric" placeholder="3" class="input" required />
          </label>
        </div>
      </fieldset>

      <fieldset class="space-y-4">
        <legend class="section-title mb-3">Seu acesso</legend>
        <label class="block">
          <span class="label">Usuário</span>
          <input v-model="form.usuario" type="text" autocapitalize="characters" autocomplete="username" class="input" required />
        </label>
        <label class="block">
          <span class="label">Senha</span>
          <span class="relative block">
            <input v-model="form.senha" :type="showSenha ? 'text' : 'password'" autocomplete="current-password" class="input pr-12" required />
            <button
              type="button"
              class="icon-btn absolute right-0.5 top-1/2 -translate-y-1/2 text-ink-500"
              :aria-label="showSenha ? 'Ocultar senha' : 'Mostrar senha'"
              @click="showSenha = !showSenha"
            >
              <Icon :name="showSenha ? 'eye-off' : 'eye'" />
            </button>
          </span>
        </label>
      </fieldset>

      <p v-if="error" class="alert alert-danger" role="alert">
        <Icon name="alert" class="mt-px" />
        <span>Não foi possível entrar: {{ error.replace(/[.\s]+$/, '') }}. Confira os dados e tente de novo.</span>
      </p>

      <button type="submit" :disabled="loading" :aria-busy="loading" class="btn btn-primary w-full">
        {{ loading ? 'Entrando…' : 'Entrar' }}
      </button>

      <p class="flex flex-wrap items-center justify-center gap-x-1.5 text-sm text-ink-500">
        Esqueceu a senha?
        <a class="link inline-flex min-h-11 items-center" href="http://www.newfocus.com.br/index.php/fale-conosco-049-3521-3880" target="_blank" rel="noopener">Fale conosco</a>
      </p>
    </form>
  </div>
</template>
