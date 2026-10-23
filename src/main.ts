import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { defineCustomElements as jeepSqlite } from 'jeep-sqlite/loader'
import App from './App.vue'
import router from './router'
import './style.css'

jeepSqlite(window)

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
