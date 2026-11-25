<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { App as Aparelho } from '@capacitor/app'
import ConfirmDialog from './components/ConfirmDialog.vue'
import Toast from './components/Toast.vue'
import { useBackButton } from './composables/useBackButton'
import { useToast } from './composables/useToast'
import { useAuthStore } from './stores/auth'

const { items, dispensar } = useToast()
const auth = useAuthStore()
const router = useRouter()

// Ao voltar de um detalhe ou trocar de aba, a tela continua como estava: busca, filtros,
// página e rolagem.
// Sair da conta descarta tudo.
const LISTAS = ['HomeView', 'ConsultaClientesView', 'ConsultaProdutosView', 'ConsultaPedidosView', 'HistoricoVendasView']
const emMemoria = computed(() => (auth.loggedIn ? LISTAS : []))

// No início (ou no login) o Voltar sai do app; em outra tela, volta ou cai no início.
useBackButton((canGoBack) => {
  const atual = router.currentRoute.value.name
  if (atual === auth.homeRoute || atual === 'login') Aparelho.minimizeApp()
  else if (canGoBack) router.back()
  else router.replace({ name: auth.homeRoute })
})
</script>

<template>
  <router-view v-slot="{ Component }">
    <KeepAlive :include="emMemoria">
      <component :is="Component" />
    </KeepAlive>
  </router-view>
  <Toast :items="items" @close="dispensar" />
  <ConfirmDialog />
</template>
