import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './assets/main.css'

if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual'
}

// 刷新时忽略 hash，避免自动滚到页面中段
if (window.location.hash) {
  history.replaceState(null, '', window.location.pathname + window.location.search)
}
window.scrollTo(0, 0)

const app = createApp(App)

app.use(router)
app.mount('#app')
