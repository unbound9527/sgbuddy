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
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-label">{{ item.label }}</span>
        </router-link>
      </nav>

      <SidebarCalculator />

      <div class="sidebar-launch">
        <button class="launch-btn" @click="launchGame" title="启动QQ三国">
          <span>🎮</span>
          <span>启动QQ三国</span>
        </button>
        <div class="launch-hint" v-if="launchHint">{{ launchHint }}</div>
        <button
          class="launch-manual-btn"
          @click="selectGamePath"
          :disabled="gameLauncher.detecting"
        >📁 手动选择路径</button>
      </div>

      <!-- OCR 引擎安装提示 -->
      <div class="ocr-engine-hint" v-if="!ocrEngineInstalled && !ocrEngineGiteeConfigured">
        <span class="ocr-engine-hint-text">⚠️ 高精度 OCR 引擎未安装，且下载源未配置</span>
      </div>
      <div class="ocr-engine-hint" v-else-if="!ocrEngineInstalled && ocrEngineState === 'downloading'">
        <span class="ocr-engine-hint-text">⏳ 正在下载 OCR 引擎 {{ Math.round(ocrEngineProgress * 100) }}%</span>
        <button class="ocr-engine-hint-btn" @click="showOcrEngineModal = true">查看详情</button>
      </div>
      <div class="ocr-engine-hint" v-else-if="!ocrEngineInstalled && ocrEngineState === 'extracting'">
        <span class="ocr-engine-hint-text">⏳ 正在解压 OCR 引擎…（约 1 分钟）</span>
        <button class="ocr-engine-hint-btn" @click="showOcrEngineModal = true">查看详情</button>
      </div>
      <div class="ocr-engine-hint ocr-engine-hint--error" v-else-if="!ocrEngineInstalled && ocrEngineState === 'error'">
        <span class="ocr-engine-hint-text">❌ OCR 引擎下载失败，点击重试</span>
        <button class="ocr-engine-hint-btn" @click="showOcrEngineModal = true">重试</button>
      </div>
      <div class="ocr-engine-hint" v-else-if="!ocrEngineInstalled">
        <span class="ocr-engine-hint-text">⚠️ 高精度 OCR 引擎未安装，识别精度受限（下载约 55MB，一次安装永久使用）</span>
        <button class="ocr-engine-hint-btn" @click="showOcrEngineModal = true">下载引擎</button>
      </div>

      <!-- 当前区服 -->
      <div class="sidebar-section">
        <div class="section-header">
          <span class="section-label">当前区服</span>
          <a class="section-link" href="https://sg.qq.com/cp/a20220302hfcx/index.html" target="_blank" title="合服查询">🔗</a>
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
            <button class="icon-btn-sm" @click="showRateModal = true" title="查看币价波动">📈</button>
            <button class="icon-btn-sm" @click="onRefreshRates" :disabled="scraping" title="刷新币价">
              {{ scraping ? '⏳' : '🔄' }}
            </button>
            <a class="icon-btn-sm" :href="taobaoSearchUrl" target="_blank" title="淘宝查价">🔍</a>
          </div>
        </div>
        <div class="rate-display">
          <span class="rate-value">{{ appStore.currencyRate ? appStore.currencyRate.toFixed(2) : '--' }}</span>
          <span class="rate-unit">元/亿</span>
        </div>
        <div class="rate-updated">{{ appStore.currencyRateUpdatedAt || '未获取' }}</div>
      </div>

      <div class="sidebar-footer">
        <button class="theme-toggle" @click="themeStore.toggle()" :title="themeLabel">
          <span class="theme-icon">{{ themeStore.theme === 'dark' ? '☀' : '🌙' }}</span>
          <span class="theme-label">{{ themeLabel }}</span>
        </button>
        <div class="footer-row">
          <span class="status-dot"></span>
          <span class="status-text">本地数据库</span>
          <span class="footer-version">v{{ appVersion }}</span>
          <button class="icon-btn-sm about-btn" @click="showAboutModal = true" title="关于 SG Buddy">ⓘ</button>
          <button
            class="icon-btn-sm update-check-btn"
            @click="checkForUpdates(true)"
            :title="updateState === 'checking' ? '正在检查更新…' : '检查更新'"
          >
            {{ updateState === 'checking' ? '⏳' : '🔄' }}
            <span v-if="updateDot" class="update-dot"></span>
          </button>
        </div>
      </div>
    </aside>

    <main class="main-content">
      <router-view v-slot="{ Component }">
        <keep-alive>
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </main>

    <!-- 币价波动弹窗（复用 PriceTracker 视图） -->
    <div class="rate-modal-overlay" v-if="showRateModal" @click.self="showRateModal = false">
      <div class="rate-modal-panel">
        <button class="rate-modal-close" @click="showRateModal = false" title="关闭">✕</button>
        <PriceTracker />
      </div>
    </div>

    <!-- 更新弹窗 -->
    <div class="rate-modal-overlay" v-if="showUpdateModal" @click.self="closeUpdateModal">
      <div class="rate-modal-panel update-panel">
        <button class="rate-modal-close" @click="closeUpdateModal" title="关闭">✕</button>
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

    <!-- OCR 引擎下载弹窗 -->
    <div class="rate-modal-overlay" v-if="showOcrEngineModal" @click.self="showOcrEngineModal = false">
      <div class="rate-modal-panel update-panel">
        <button class="rate-modal-close" @click="showOcrEngineModal = false" title="关闭">✕</button>
        <h3 class="update-title">下载高精度 OCR 引擎</h3>
        <div class="update-current">
          装备截图高精度识别（PaddleOCR-json）。从 Gitee 自动下载约 55MB 分卷并解压安装，一次安装永久使用，后续无需再下载。
        </div>

        <template v-if="ocrEngineState === 'downloading'">
          <div class="update-progress">
            <div class="update-progress-bar" :style="{ width: Math.round(ocrEngineProgress * 100) + '%' }"></div>
            <span class="update-progress-text">{{ Math.round(ocrEngineProgress * 100) }}%</span>
          </div>
          <div class="ocr-dl-meta">
            <span>已下载 {{ formatBytes(ocrEngineReceived) }} / {{ formatBytes(ocrEngineTotal) }}</span>
            <span v-if="ocrEngineSpeed > 0">速度 {{ formatBytes(ocrEngineSpeed) }}/s</span>
          </div>
        </template>

        <div class="ocr-extracting" v-else-if="ocrEngineState === 'extracting'">
          <span class="ocr-extracting-icon">⏳</span>
          <span>下载完成，正在解压引擎…（约 240MB，可能需要 1 分钟，请耐心等待，不要关闭应用）</span>
        </div>

        <div class="ocr-done" v-else-if="ocrEngineState === 'done'">
          ✅ 引擎安装完成，识别已升级为高精度
        </div>

        <template v-else-if="ocrEngineState === 'error'">
          <div class="update-error">下载失败：{{ ocrEngineError }}</div>
          <div class="update-actions">
            <button class="launch-btn update-primary" @click="downloadOcrEngine">重试</button>
            <button class="launch-manual-btn update-secondary" @click="showOcrEngineModal = false">关闭</button>
          </div>
        </template>

        <div class="update-actions" v-if="ocrEngineState === 'idle'">
          <button class="launch-btn update-primary" @click="downloadOcrEngine">开始下载</button>
          <button class="launch-manual-btn update-secondary" @click="showOcrEngineModal = false">取消</button>
        </div>
      </div>
    </div>

    <!-- 关于弹窗 -->
    <div class="rate-modal-overlay" v-if="showAboutModal" @click.self="showAboutModal = false">
      <div class="rate-modal-panel update-panel about-panel">
        <button class="rate-modal-close" @click="showAboutModal = false" title="关闭">✕</button>
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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useThemeStore, useAppStore, useGameLauncher } from '@/stores'
import SidebarCalculator from '@/components/SidebarCalculator.vue'
import PriceTracker from '@/views/PriceTracker.vue'
import appIcon from '@/assets/app-icon.png'

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

// OCR 引擎
const ocrEngineInstalled = ref(true)
const ocrEngineGiteeConfigured = ref(true)
const showOcrEngineModal = ref(false)
const ocrEngineState = ref<'idle' | 'downloading' | 'extracting' | 'done' | 'error'>('idle')
const ocrEngineProgress = ref(0)
const ocrEngineReceived = ref(0)
const ocrEngineTotal = ref(0)
const ocrEngineSpeed = ref(0)
const ocrEngineError = ref('')
// 速度计算用：上一次进度回调的时间戳与已下载字节数（EMA 平滑）
let speedSample = { t: 0, bytes: 0 }

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

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

async function downloadOcrEngine() {
  if (ocrEngineState.value === 'downloading' || ocrEngineState.value === 'extracting') return
  ocrEngineState.value = 'downloading'
  ocrEngineError.value = ''
  ocrEngineProgress.value = 0
  ocrEngineReceived.value = 0
  ocrEngineSpeed.value = 0
  speedSample = { t: 0, bytes: 0 }
  const res = await window.electronAPI.downloadOcrEngine()
  if (res.ok) {
    ocrEngineState.value = 'done'
    ocrEngineInstalled.value = true
    // 展示完成状态后自动关闭
    setTimeout(() => { showOcrEngineModal.value = false }, 1500)
  } else {
    ocrEngineState.value = 'error'
    ocrEngineError.value = res.error || '未知错误，请稍后重试'
  }
}

function onOcrEngineProgress(p: { stage: 'downloading' | 'extracting'; received: number; total: number }) {
  if (p.stage === 'downloading') {
    ocrEngineState.value = 'downloading'
    ocrEngineReceived.value = p.received
    ocrEngineTotal.value = p.total
    ocrEngineProgress.value = p.total > 0 ? p.received / p.total : 0
    // 瞬时速度（EMA 平滑），约 55MB 下载用于提示网速
    const now = Date.now()
    if (speedSample.t > 0 && now > speedSample.t) {
      const v = (p.received - speedSample.bytes) / ((now - speedSample.t) / 1000)
      ocrEngineSpeed.value = ocrEngineSpeed.value === 0 ? v : ocrEngineSpeed.value * 0.7 + v * 0.3
    }
    speedSample = { t: now, bytes: p.received }
  } else if (p.stage === 'extracting') {
    ocrEngineState.value = 'extracting'
  }
}

async function checkOcrEngine() {
  const st = await window.electronAPI.ocrEngineStatus()
  ocrEngineInstalled.value = st.installed
  ocrEngineGiteeConfigured.value = st.giteeConfigured
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
    const { price } = await window.electronAPI.scrapeOne(appStore.currentServerName, true)
    if (price && appStore.currentServerId) {
      await appStore.reloadCurrencyRate(appStore.currentServerId, appStore.currentServerName)
    }
  } catch (e) {
    console.error('刷新当前币价失败:', e)
  } finally {
    scraping.value = false
  }

  // 2) 后台异步抓取其余大区
  window.electronAPI.scrapeRates(true).then(r => {
    console.log(`后台全服刷新: ${r.updated} 成功, ${r.failed} 失败`)
    if (appStore.currentServerId) {
      appStore.reloadCurrencyRate(appStore.currentServerId, appStore.currentServerName)
    }
  }).catch(e => console.error('后台全服刷新失败:', e))
}

onMounted(() => {
  appStore.loadServers()
  gameLauncher.init()
  // 版本号 / 更新 / OCR 引擎状态
  window.electronAPI.getAppVersion().then(v => { appVersion.value = v })
  checkOcrEngine()
  window.electronAPI.onUpdateAvailable((info) => {
    updateInfo.value = info
    updateDot.value = true
  })
  window.electronAPI.onUpdateProgress((p) => {
    if (p.total > 0) updateProgress.value = p.received / p.total
  })
  window.electronAPI.onOcrEngineProgress(onOcrEngineProgress)
})

const navItems = [
  { path: '/data', label: '物价图鉴', icon: '💰' },
  { path: '/gear', label: '配号中心', icon: '⚙' },
  { path: '/growth', label: '窗口管理', icon: '🪟' },
  { path: '/shop', label: '商行管理', icon: '🏪' },
  { path: '/trade-leads', label: '交易线索', icon: '💡' },
  { path: '/guides', label: '游戏攻略', icon: '📖' },
]
</script>

<style>
/* ═══════════════════════════════════════
   Global Theme Variables
   ═══════════════════════════════════════ */

/* ── Dark (default) ── */
:root,
[data-theme="dark"] {
  --color-bg:            #0D0E10;
  --color-sidebar:       #080A0A;
  --color-surface-1:     #141516;
  --color-surface-2:     #18191A;
  --color-surface-3:     #1C1D1F;
  --color-border:        #23252A;
  --color-border-light:  #1E2022;
  --color-text:          #F7F8F8;
  --color-text-secondary:#A0A5AD;
  --color-text-tertiary: #80858D;
  --color-accent:        #5E6AD2;
  --color-accent-hover:  #828FFF;
  --color-accent-bg:     rgba(94, 106, 210, 0.12);
  --color-accent-ring:   rgba(94, 106, 210, 0.25);
  --color-success:       #34C759;
  --color-warning:       #FF9F0A;
  --color-danger:        #FF453A;
  --color-toggle-bg:     var(--color-surface-1);
  --color-toggle-hover:  var(--color-surface-2);
  --color-kv-bg:         var(--color-surface-2);
  --color-slot-bg:       var(--color-surface-2);
  --color-slot-empty:    rgba(255, 159, 10, 0.06);
  --color-slot-empty-border: rgba(255, 159, 10, 0.15);
  --color-chip-bg:       var(--color-surface-2);
  --color-hover:         var(--color-surface-3);
  --color-backup-border: var(--color-border);
}

/* ── Light ── */
[data-theme="light"] {
  --color-bg:            #F8F8FA;
  --color-sidebar:       #F0F0F3;
  --color-surface-1:     #FFFFFF;
  --color-surface-2:     #F5F5F8;
  --color-surface-3:     #ECECF0;
  --color-border:        rgba(0, 0, 0, 0.08);
  --color-border-light:  rgba(0, 0, 0, 0.05);
  --color-text:          #1A1A1D;
  --color-text-secondary:#5A5A62;
  --color-text-tertiary: #8A8A92;
  --color-accent:        #5E6AD2;
  --color-accent-hover:  #4F5CC7;
  --color-accent-bg:     rgba(94, 106, 210, 0.08);
  --color-accent-ring:   rgba(94, 106, 210, 0.18);
  --color-success:       #2E9E4B;
  --color-warning:       #E58A00;
  --color-danger:        #E0443E;
  --color-toggle-bg:     var(--color-surface-2);
  --color-toggle-hover:  var(--color-surface-3);
  --color-kv-bg:         var(--color-surface-2);
  --color-slot-bg:       var(--color-surface-2);
  --color-slot-empty:    rgba(255, 159, 10, 0.06);
  --color-slot-empty-border: rgba(255, 159, 10, 0.2);
  --color-chip-bg:       var(--color-surface-2);
  --color-hover:         var(--color-surface-3);
  --color-backup-border: rgba(0, 0, 0, 0.1);
}

/* ═══ Shared ═══ */
:root {
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 10px;
  --sidebar-width: 220px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display',
    'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 13px;
  color: var(--color-text);
  background: var(--color-bg);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app-container {
  display: flex;
  height: 100%;
}

/* ═══ 侧边栏 ═══ */
.sidebar {
  width: var(--sidebar-width);
  background: var(--color-sidebar);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
  border-right: 0.5px solid var(--color-border);
  user-select: none;
  -webkit-app-region: drag;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 0.5px solid var(--color-border);
  -webkit-app-region: no-drag;
}

.brand-icon {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  object-fit: cover;
  display: block;
  flex-shrink: 0;
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.brand-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: -0.01em;
}

.brand-desc {
  font-size: 10.5px;
  color: var(--color-text-tertiary);
  white-space: nowrap;
}

/* 导航 */
.sidebar-nav {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  -webkit-app-region: no-drag;
}

.nav-section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 8px 8px 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 8px;
  border-radius: 5px;
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: 13px;
  font-weight: 450;
  transition: all 0.12s ease;
  position: relative;
}

.nav-item:hover {
  color: var(--color-text);
  background: var(--color-surface-2);
}

.nav-item--active {
  color: var(--color-text);
  background: var(--color-surface-3);
}

.nav-item--active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 2.5px;
  border-radius: 0 3px 3px 0;
  background: var(--color-accent);
}

.nav-icon {
  font-size: 14px;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
  line-height: 1;
}

.nav-label {
  flex: 1;
  line-height: 1;
}

/* 启动按钮 */
.sidebar-launch {
  margin-top: auto;
  padding: 6px 10px;
  -webkit-app-region: no-drag;
}

.launch-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 7px;
  border: none;
  border-radius: 6px;
  background: var(--color-accent);
  color: #fff;
  font-size: 12.5px;
  font-weight: 550;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.12s ease;
}
.launch-btn:hover { background: var(--color-accent-hover); }

.launch-hint {
  font-size: 10.5px;
  color: var(--color-danger);
  text-align: center;
  margin-top: 6px;
  line-height: 1.3;
}

.launch-manual-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  margin-top: 4px;
  padding: 4px;
  border: 0.5px solid var(--color-border);
  border-radius: 5px;
  background: var(--color-toggle-bg);
  color: var(--color-text-secondary);
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.12s ease;
}
.launch-manual-btn:hover {
  background: var(--color-toggle-hover);
  color: var(--color-text);
}
.launch-manual-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 侧边栏分区 */
.sidebar-section {
  padding: 6px 10px;
  -webkit-app-region: no-drag;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-label {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.section-link {
  font-size: 12px;
  text-decoration: none;
  opacity: 0.6;
  transition: opacity 0.1s;
}
.section-link:hover { opacity: 1; }

.section-actions {
  display: flex;
  gap: 2px;
}

.icon-btn-sm {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: var(--color-toggle-bg);
  cursor: pointer;
  font-size: 12px;
  text-decoration: none;
  transition: background 0.1s;
  font-family: inherit;
  padding: 0;
}
.icon-btn-sm:hover { background: var(--color-toggle-hover); }
.icon-btn-sm:disabled { opacity: 0.4; cursor: not-allowed; }

.server-select {
  width: 100%;
  padding: 7px 8px;
  font-size: 12px;
  font-family: inherit;
  background: var(--color-toggle-bg);
  color: var(--color-text);
  border: 0.5px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.1s;
}
.server-select:focus {
  outline: none;
  border-color: var(--color-accent-ring);
}

/* 币价展示 */
.rate-display {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.rate-value {
  font-size: 20px;
  font-weight: 650;
  color: var(--color-text);
  letter-spacing: -0.02em;
}
.rate-unit {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.rate-updated {
  font-size: 10px;
  color: var(--color-text-tertiary);
}

/* 底部 & 主题切换 */
.sidebar-footer {
  padding: 6px 10px;
  border-top: 0.5px solid var(--color-border);
  -webkit-app-region: no-drag;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.theme-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 5px;
  background: var(--color-toggle-bg);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.12s ease;
}

.theme-toggle:hover {
  background: var(--color-toggle-hover);
  color: var(--color-text);
}

.theme-icon {
  font-size: 13px;
  line-height: 1;
}

.theme-label {
  font-weight: 450;
}

.footer-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 4px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-success);
  flex-shrink: 0;
}

.status-text {
  font-size: 11px;
  color: var(--color-text-tertiary);
  flex: 1;
}

.footer-version {
  font-size: 10.5px;
  color: var(--color-text-tertiary);
}

/* ═══ 币价波动弹窗 ═══ */
.rate-modal-overlay {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center; z-index: 200;
}
.rate-modal-panel {
  position: relative;
  width: min(880px, 92vw);
  height: min(680px, 88vh);
  background: var(--color-surface-1);
  border: 0.5px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3);
  padding: 24px 28px;
  overflow: hidden;
}
.rate-modal-panel > .page {
  height: 100%;
  display: flex; flex-direction: column;
  min-height: 0;
}
.rate-modal-close {
  position: absolute; top: 10px; right: 10px; z-index: 10;
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  border: none; border-radius: 50%;
  background: var(--color-surface-2);
  color: var(--color-text-secondary);
  font-size: 12px; cursor: pointer;
  transition: all 0.1s;
}
.rate-modal-close:hover {
  background: var(--color-accent-bg);
  color: var(--color-accent);
}

/* ═══ 内容区 ═══ */
.main-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 32px 36px;
  background: var(--color-bg);
  transition: background 0.15s ease;
}

/* ── 滚动条 ── */
::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-tertiary);
}

/* ═══ OCR 引擎提示 ═══ */
.ocr-engine-hint {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0 10px 6px;
  padding: 6px 8px;
  border: 0.5px solid var(--color-warning, #b58900);
  border-radius: 6px;
  background: var(--color-warning-bg, rgba(181, 137, 0, 0.12));
}
.ocr-engine-hint-text {
  font-size: 10.5px;
  line-height: 1.4;
  color: var(--color-text-secondary);
}
.ocr-engine-hint-btn {
  padding: 3px 8px;
  border: none;
  border-radius: 4px;
  background: var(--color-accent);
  color: #fff;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
}
.ocr-engine-hint-btn:hover { background: var(--color-accent-hover); }

/* ═══ 更新按钮 / 红点 ═══ */
.update-check-btn {
  position: relative;
  margin-left: 4px;
}
.update-dot {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-danger, #e5484d);
}

/* ═══ 更新弹窗 ═══ */
.update-panel {
  width: 420px;
  max-width: 90vw;
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.update-title {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  color: var(--color-text);
}
.update-current {
  font-size: 11.5px;
  color: var(--color-text-tertiary);
}
.update-notes {
  max-height: 200px;
  overflow-y: auto;
  padding: 8px 10px;
  border: 0.5px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}
.update-progress {
  position: relative;
  height: 22px;
  border-radius: 6px;
  background: var(--color-toggle-bg);
  overflow: hidden;
}
.update-progress-bar {
  height: 100%;
  background: var(--color-accent);
  transition: width 0.15s ease;
}
.update-progress-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--color-text);
}
.update-error {
  font-size: 11.5px;
  color: var(--color-danger);
  line-height: 1.5;
}
.update-actions {
  display: flex;
  gap: 8px;
  margin-top: 2px;
}
.update-primary {
  flex: 1;
}
.update-secondary {
  flex: 1;
  margin-top: 0;
}

/* ═══ OCR 引擎下载弹窗 ═══ */
.ocr-engine-hint--error {
  border-color: var(--color-danger, #e5484d);
  background: var(--color-danger-bg, rgba(229, 72, 77, 0.1));
}
.ocr-dl-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.ocr-extracting {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 0.5px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-secondary);
}
.ocr-extracting-icon {
  font-size: 14px;
}
.ocr-done {
  padding: 10px 12px;
  border: 0.5px solid var(--color-success, #2ea043);
  border-radius: 6px;
  background: var(--color-success-bg, rgba(46, 160, 67, 0.1));
  font-size: 12.5px;
  color: var(--color-success, #3fb950);
}

/* ═══ 关于弹窗 ═══ */
.about-panel {
  width: 460px;
}
.about-btn {
  margin-left: 4px;
}
.about-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.about-logo {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  display: block;
  border-radius: 10px;
  object-fit: cover;
}
.about-brand-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.about-version {
  font-size: 11.5px;
  color: var(--color-text-tertiary);
}
.about-desc {
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}
.about-kv {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border: 0.5px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  font-size: 12px;
}
.about-row {
  display: flex;
  gap: 8px;
  line-height: 1.5;
}
.about-label {
  flex-shrink: 0;
  width: 52px;
  color: var(--color-text-tertiary);
}
.about-link {
  color: var(--color-accent);
  text-decoration: none;
  word-break: break-all;
}
.about-link:hover {
  color: var(--color-accent-hover);
  text-decoration: underline;
}
.about-license {
  padding: 8px 10px;
  border: 0.5px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-accent-bg);
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}
.about-disclaimer {
  font-size: 11px;
  line-height: 1.5;
  color: var(--color-text-tertiary);
}
</style>
