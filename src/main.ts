import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { defineCustomElements as jeepSqlite } from 'jeep-sqlite/loader'
import App from './App.vue'
import router from './router'
import './style.css'

jeepSqlite(window)

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

if (Capacitor.isNativePlatform()) {
  // A barra de status acompanha o topo da tela: creme no login, azul-marinho no resto.
  router.afterEach((to) => {
    const login = to.name === 'login'
    StatusBar.setStyle({ style: login ? Style.Light : Style.Dark })
    StatusBar.setBackgroundColor({ color: login ? '#f0e8d8' : '#1b3350' })
  })
  SplashScreen.hide()
}
