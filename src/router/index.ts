import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
  { path: '/config', name: 'config', component: () => import('../views/ConfigView.vue') },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.loggedIn) {
    const ok = await auth.loadSession()
    if (!ok && to.name !== 'login') return { name: 'login' }
  }
  if (to.name === 'login' && auth.loggedIn) return { name: 'home' }
  return true
})

export default router
