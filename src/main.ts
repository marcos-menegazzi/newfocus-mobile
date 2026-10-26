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
  StatusBar.setStyle({ style: Style.Light })
  StatusBar.setBackgroundColor({ color: '#f5f7fa' })
  SplashScreen.hide()
}
