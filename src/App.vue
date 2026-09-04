<template>
  <div id="app-container">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <img :src="appIcon" class="brand-icon" alt="SG Buddy" draggable="false" />
        <div class="brand-text">
          <span class="brand-name">SG Buddy</span>
          <span class="brand-desc">QQ三国助手</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section-label">功能</div>
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          active-class="nav-item--active"
        >
          <span class="nav-icon" :style="{ '--tint': item.tint }"><AppIcon :icon="item.icon" :size="14" /></span>
          <span class="nav-label">{{ item.label }}</span>
        </router-link>
      </nav>

      <SidebarCalculator />

      <div class="sidebar-launch">
        <button class="launch-btn" @click="launchGame" title="启动QQ三国">
          <AppIcon icon="gamepad" :size="14" />
          <span>启动QQ三国</span>
        </button>
        <div class="launch-hint" v-if="launchHint">{{ launchHint }}</div>
        <button
          class="launch-manual-btn"
          @click="selectGamePath"
          :disabled="gameLauncher.detecting"
        ><AppIcon icon="folder" :size="12" /> 手动选择路径</button>
      </div>

      <!-- 当前区服 -->
      <div class="sidebar-section">
        <div class="section-header">
          <span class="section-label">当前区服</span>
          <a class="section-link" href="https://sg.qq.com/cp/a20220302hfcx/index.html" target="_blank" title="合服查询"><AppIcon icon="external-link" :size="12" /></a>
        </div>
        <select class="server-select" :value="appStore.currentServerId" @change="onServerChange">
          <option :value="null" disabled>选择区服</option>
          <option v-for="s in appStore.servers" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </div>

      <!-- 币价比例 -->
      <div class="sidebar-section">
        <div class="section-header">
          <span class="section-label">币价比例</span>
          <div class="section-actions">
            <button class="icon-btn-sm" @click="showRateModal = true" title="查看币价波动"><AppIcon icon="trending-up" :size="13" /></button>
            <button class="icon-btn-sm" @click="onRefreshRates" :disabled="scraping" title="刷新币价">
              <AppIcon icon="loader" v-if="scraping" :size="13" class="icon-spin" />
              <AppIcon icon="refresh" v-else :size="13" />
            </button>
            <a class="icon-btn-sm" :href="taobaoSearchUrl" target="_blank" title="淘宝查价"><AppIcon icon="search" :size="13" /></a>
          </div>
        </div>
        <div class="rate-display">
          <template v-if="appStore.currencyRate">
            <span class="rate-value">{{ appStore.currencyRate.toFixed(2) }}</span>
            <span class="rate-unit">元/亿</span>
          </template>
          <span v-else class="rate-value rate-value--missing">未获取到</span>
        </div>
        <div class="rate-updated" v-if="appStore.currencyRate">{{ appStore.currencyRateUpdatedAt }}</div>
        <div class="rate-updated" v-else>尚未抓取到该大区币价，点上方刷新按钮重试</div>
        <div v-if="appStore.taobaoNeedLogin" class="rate-login-hint">
          <span>淘宝打码了币价（未登录）</span>
          <button class="rate-login-btn" @click="onTaobaoLogin">登录淘宝</button>
        </div>
      </div>

      <div class="sidebar-footer">
        <button class="theme-toggle" @click="themeStore.toggle()" :title="themeLabel">
          <span class="theme-icon"><AppIcon :icon="themeStore.theme === 'dark' ? 'sun' : 'moon'" :size="13" /></span>
          <span class="theme-label">{{ themeLabel }}</span>
        </button>
        <div class="footer-row">
          <span class="status-dot"></span>
          <span class="status-text">本地数据库</span>
          <span class="footer-version">v{{ appVersion }}</span>
          <button class="icon-btn-sm about-btn" @click="showAboutModal = true" title="关于 SG Buddy"><AppIcon icon="info" :size="13" /></button>
          <button
            class="icon-btn-sm update-check-btn"
            @click="checkForUpdates(true)"
            :title="updateState === 'checking' ? '正在检查更新…' : '检查更新'"
          >
            <AppIcon icon="loader" v-if="updateState === 'checking'" :size="13" class="icon-spin" />
            <AppIcon icon="refresh" v-else :size="13" />
            <span v-if="updateDot" class="update-dot"></span>
          </button>
        </div>
      </div>
    </aside>

    <main class="main-content">
      <ScamTicker />
      <router-view v-slot="{ Component }">
        <keep-alive>
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </main>

    <!-- 币价波动弹窗（复用 PriceTracker 视图） -->
    <div class="rate-modal-overlay" v-if="showRateModal" @click.self="showRateModal = false">
      <div class="rate-modal-panel">
        <button class="rate-modal-close" @click="showRateModal = false" title="关闭"><AppIcon icon="x" :size="13" /></button>
        <PriceTracker />
      </div>
    </div>

    <!-- 更新弹窗 -->
    <div class="rate-modal-overlay" v-if="showUpdateModal" @click.self="closeUpdateModal">
      <div class="rate-modal-panel update-panel">
        <button class="rate-modal-close" @click="closeUpdateModal" title="关闭"><AppIcon icon="x" :size="13" /></button>
        <template v-if="updateInfo?.hasUpdate">
          <h3 class="update-title">发现新版本 v{{ updateInfo.version }}</h3>
          <div class="update-current">当前版本 v{{ appVersion }}</div>
          <div class="update-notes">{{ updateInfo.notes || '暂无更新说明' }}</div>
          <div v-if="updateState === 'downloading'" class="update-progress">
            <div class="update-progress-bar" :style="{ width: updateProgressPct + '%' }"></div>
            <span class="update-progress-text">{{ updateProgressPct }}%</span>
          </div>
          <div v-if="updateError" class="update-error">{{ updateError }}</div>
          <div class="update-actions">
            <button
              v-if="updateState === 'idle' || updateState === 'error'"
              class="launch-btn update-primary"
              @click="downloadAndInstall"
            >立即更新</button>
            <button v-else-if="updateState === 'ready'" class="launch-btn update-primary" @click="installNow">安装并重启</button>
            <button v-else class="launch-btn update-primary" disabled>
              {{ updateState === 'installing' ? '正在安装…' : '下载中…' }}
            </button>
            <button class="launch-manual-btn update-secondary" @click="closeUpdateModal">稍后再说</button>
          </div>
        </template>
        <template v-else>
          <h3 class="update-title">{{ updateError ? '检查更新失败' : '已是最新版本' }}</h3>
          <div v-if="updateError" class="update-error">{{ updateError }}</div>
          <div v-else class="update-current">当前版本 v{{ appVersion }} 已是最新版本。</div>
          <div class="update-actions">
            <button class="launch-manual-btn update-secondary" @click="closeUpdateModal">关闭</button>
          </div>
        </template>
      </div>
    </div>

    <!-- 关于弹窗 -->
    <div class="rate-modal-overlay" v-if="showAboutModal" @click.self="showAboutModal = false">
      <div class="rate-modal-panel update-panel about-panel">
        <button class="rate-modal-close" @click="showAboutModal = false" title="关闭"><AppIcon icon="x" :size="13" /></button>
        <div class="about-brand">
          <img :src="appIcon" class="about-logo" alt="SG Buddy" draggable="false" />
          <div class="about-brand-text">
            <h3 class="update-title">SG Buddy — QQ三国助手</h3>
            <div class="about-version">版本 v{{ appVersion }}</div>
          </div>
        </div>
        <div class="about-desc">
          配号、养成、倒卖一体化的 QQ三国 桌面工具。数据全部保存在本地，开源免费，无任何付费功能。
        </div>
        <div class="about-kv">
          <div class="about-row"><span class="about-label">作者</span><span>QQ三国烟尘</span></div>
          <div class="about-row" v-if="projectLinks.github">
            <span class="about-label">GitHub</span>
            <a class="about-link" href="#" @click.prevent="openExternal(projectLinks.github)">{{ projectLinks.github }}</a>
          </div>
          <div class="about-row" v-if="projectLinks.gitee">
            <span class="about-label">Gitee</span>
            <a class="about-link" href="#" @click.prevent="openExternal(projectLinks.gitee)">{{ projectLinks.gitee }}</a>
          </div>
          <div class="about-row"><span class="about-label">许可</span><span>MIT + 附加条款</span></div>
        </div>
        <div class="about-license">
          MIT 协议开源，可自由修改、分发（须保留版权声明）。附加条款：禁止将本软件或其修改版本用于游戏外挂、自动脚本、作弊程序及违法牟利。
        </div>
        <div class="about-disclaimer">
          本软件仅供学习交流，请遵守游戏官方规则；因使用本软件产生的任何后果由使用者自行承担。
        </div>
        <div class="update-actions">
          <button class="launch-manual-btn update-secondary" @click="showAboutModal = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 全局二次确认弹窗（appConfirm） -->
    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeStore, useAppStore, useGameLauncher } from '@/stores'
import SidebarCalculator from '@/components/SidebarCalculator.vue'
import PriceTracker from '@/views/PriceTracker.vue'
import ScamTicker from '@/components/blacklist/ScamTicker.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { GUIDE_OPEN_EVENT, setPendingGuideCat } from '@/utils/trayNav'
import appIcon from '@/assets/app-icon.png'

const router = useRouter()

const themeStore = useThemeStore()
const appStore = useAppStore()
const gameLauncher = useGameLauncher()
const scraping = ref(false)
const launchHint = ref('')
const showRateModal = ref(false)
const showAboutModal = ref(false)

// 应用版本 / 更新
const appVersion = ref('')
const updateInfo = ref<UpdateInfo | null>(null)
const updateState = ref<'idle' | 'checking' | 'downloading' | 'ready' | 'installing' | 'error'>('idle')
const updateProgress = ref(0)
const updateError = ref('')
const showUpdateModal = ref(false)
const updateDot = ref(false)
const installPath = ref('')

const updateProgressPct = computed(() => Math.round(updateProgress.value * 100))

async function checkForUpdates(manual = false) {
  updateState.value = 'checking'
  updateError.value = ''
  const info = await window.electronAPI.checkForUpdates()
  updateState.value = 'idle'
  if (info.hasUpdate) {
    updateInfo.value = info
    updateDot.value = false
    showUpdateModal.value = true
  } else if (manual) {
    updateInfo.value = null
    updateError.value = info.error || ''
    showUpdateModal.value = true
  }
}

async function downloadAndInstall() {
  if (!updateInfo.value?.asset) return
  updateState.value = 'downloading'
  updateError.value = ''
  updateProgress.value = 0
  const res = await window.electronAPI.downloadUpdate(updateInfo.value.asset)
  if (res.ok && res.path) {
    installPath.value = res.path
    updateState.value = 'ready'
  } else {
    updateError.value = res.error || '下载失败，请稍后重试'
    updateState.value = 'error'
  }
}

function installNow() {
  if (!installPath.value) return
  updateState.value = 'installing'
  window.electronAPI.installUpdate(installPath.value)
}

function closeUpdateModal() {
  if (updateState.value === 'installing') return
  showUpdateModal.value = false
}

// ESC 依次关闭最上层弹窗
function onGlobalKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (showRateModal.value) showRateModal.value = false
  else if (showUpdateModal.value) closeUpdateModal()
  else if (showAboutModal.value) showAboutModal.value = false
}

const themeLabel = computed(() =>
  themeStore.theme === 'dark' ? '浅色模式' : '深色模式'
)

const TAOBAO_BASE = 'https://uland.taobao.com/sem/tbsearch?bc_fl_src=tbsite_NOX36458&bd_vid=5173466194438421211&channelSrp=baiduSomama&clk1=d2811325e6aa361664c1b36ed00800d7&commend=all&ie=utf8&initiative_id=tbindexz_20170306&localImgKey=&page=1&preLoadOrigin=https%3A%2F%2Fwww.taobao.com&refpid=mm_26632258_3504122_32538762&search_type=item&sourceId=tb.index&spm=tbpc.pc_sem_alimama%2Fa.search_manual.0&ssid=s5-e&tab=all'

// 项目开源地址（推送 GitHub/Gitee 后填写，留空时关于弹窗不显示对应链接）
const projectLinks: { github: string; gitee: string } = {
  github: '',
  gitee: '',
}

function openExternal(url: string) {
  window.electronAPI.openExternal(url)
}

const taobaoSearchUrl = computed(() => {
  const kw = encodeURIComponent(`qq三国${appStore.currentServerName}游戏币`)
  return `${TAOBAO_BASE}&keyword=${kw}&q=${kw}`
})

async function launchGame() {
  launchHint.value = ''
  if (!gameLauncher.gamePath) {
    launchHint.value = '请先手动选择游戏路径'
    return
  }
  await gameLauncher.launch()
  if (gameLauncher.error) {
    launchHint.value = gameLauncher.error
  }
}

async function selectGamePath() {
  launchHint.value = ''
  await gameLauncher.selectManually()
}

function onServerChange(e: Event) {
  const id = parseInt((e.target as HTMLSelectElement).value)
  const s = appStore.servers.find(x => x.id === id)
  if (s) appStore.setCurrentServer(s.id, s.name)
}

async function onRefreshRates() {
  if (scraping.value || !appStore.currentServerName) return
  scraping.value = true
  try {
    // 1) 同步抓取当前大区，立即更新
    const { price, needLogin } = await window.electronAPI.scrapeOne(appStore.currentServerName, true)
    appStore.taobaoNeedLogin = !!needLogin
    if (price && appStore.currentServerId) {
      await appStore.reloadCurrencyRate(appStore.currentServerId, appStore.currentServerName)
    }
  } catch (e) {
    console.error('刷新当前币价失败:', e)
  } finally {
    scraping.value = false
  }

  // 2) 淘宝价格被打码（未登录）：后台抓其余大区同样会被打码，直接跳过
  if (appStore.taobaoNeedLogin) return

  // 3) 后台异步抓取其余大区
  window.electronAPI.scrapeRates(true).then(r => {
    console.log(`后台全服刷新: ${r.updated} 成功, ${r.failed} 失败`)
    if (r.needLogin) appStore.taobaoNeedLogin = true
    if (appStore.currentServerId) {
      appStore.reloadCurrencyRate(appStore.currentServerId, appStore.currentServerName)
    }
  }).catch(e => console.error('后台全服刷新失败:', e))
}

// 打开淘宝登录窗口，登录完成后自动重抓当前大区
async function onTaobaoLogin() {
  await window.electronAPI.currencyLogin()
  // 等用户在登录窗口操作，轮询登录态（最多 3 分钟）
  for (let i = 0; i < 36; i++) {
    await new Promise(r => setTimeout(r, 5000))
    try {
      const { loggedIn } = await window.electronAPI.currencyLoginStatus()
      if (loggedIn) break
    } catch { /* 忽略单次查询失败 */ }
  }
  appStore.taobaoNeedLogin = false
  onRefreshRates()
}

// 托盘指令：路径跳转 / 打开攻略页指定分类 / 检查更新 / 关于弹窗
function onTrayCommand(cmd: { path?: string; cat?: string; action?: 'check-update' | 'about' }) {
  if (cmd.path) router.push(cmd.path)
  if (cmd.cat) {
    // GameGuide 懒加载可能晚于本事件：先暂存，组件挂载时消费；已挂载则走自定义事件即时打开
    setPendingGuideCat(cmd.cat)
    window.dispatchEvent(new CustomEvent(GUIDE_OPEN_EVENT, { detail: cmd.cat }))
  }
  if (cmd.action === 'check-update') checkForUpdates(true)
  else if (cmd.action === 'about') showAboutModal.value = true
}

onMounted(() => {
  appStore.loadServers()
  gameLauncher.init()
  // 版本号 / 更新
  window.electronAPI.getAppVersion().then(v => { appVersion.value = v })
  window.electronAPI.onUpdateAvailable((info) => {
    updateInfo.value = info
    updateDot.value = true
  })
  window.electronAPI.onUpdateProgress((p) => {
    if (p.total > 0) updateProgress.value = p.received / p.total
  })
  window.electronAPI.onTrayCommand(onTrayCommand)
  window.addEventListener('keydown', onGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
})

const navItems = [
  { path: '/data', label: '物价图鉴', icon: 'coins', tint: '#E2A83D' },
  { path: '/gear', label: '配号中心', icon: 'sliders', tint: '#98A2F5' },
  { path: '/growth-book', label: '养成宝典', icon: 'sparkles', tint: '#F0B95A' },
  { path: '/growth', label: '窗口管理', icon: 'app-window', tint: '#5FC3E8' },
  { path: '/shop', label: '商行管理', icon: 'store', tint: '#5BC48E' },
  { path: '/trade-leads', label: '交易线索', icon: 'lightbulb', tint: '#E88B5A' },
  { path: '/guides', label: '游戏攻略', icon: 'book', tint: '#C98BEB' },
]
</script>

