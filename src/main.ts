import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Capacitor, SystemBars, SystemBarsStyle, SystemBarType } from '@capacitor/core'
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
  // Todas as telas têm topo azul-marinho (ícones claros) e base creme (ícones escuros).
  // O SystemBars reaplica o próprio estilo quando a tela gira, por isso recebe os dois também.
  StatusBar.setStyle({ style: Style.Dark })
  StatusBar.setBackgroundColor({ color: '#1b3350' })
  SystemBars.setStyle({ style: SystemBarsStyle.Dark, bar: SystemBarType.StatusBar })
  SystemBars.setStyle({ style: SystemBarsStyle.Light, bar: SystemBarType.NavigationBar })
  SplashScreen.hide()
}
