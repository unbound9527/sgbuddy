import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/global.css'
// MiSans 字体（免费商用），分片 woff2 按需加载；字重声明 330/380/450/520/630
import 'misans/lib/Normal/MiSans-Regular.min.css'
import 'misans/lib/Normal/MiSans-Medium.min.css'
import 'misans/lib/Normal/MiSans-Demibold.min.css'
import 'misans/lib/Normal/MiSans-Semibold.min.css'
import 'misans/lib/Normal/MiSans-Bold.min.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
