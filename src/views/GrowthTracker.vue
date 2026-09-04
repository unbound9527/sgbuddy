<template>
  <div class="page">
    <div class="page-head">
      <h2><AppIcon icon="gamepad" :size="18" /> 窗口管理</h2>
      <p>Ctrl+1~5 切换 · 全局生效</p>
    </div>

    <!-- 未解锁：密码输入界面 -->
    <div class="card lock-card" v-if="locked">
      <div class="lock-icon"><AppIcon icon="lock" :size="48" /></div>
      <h3 class="lock-title">窗口管理已锁定</h3>
      <p class="lock-desc">请输入密码解锁此功能</p>
      <form class="lock-form" @submit.prevent="doUnlock">
        <input
          class="lock-input"
          type="password"
          v-model="pwdInput"
          placeholder="输入密码"
          autofocus
        />
        <button class="btn btn-primary lock-btn" type="submit" :disabled="pwdChecking || !pwdInput">
          {{ pwdChecking ? '验证中…' : '解锁' }}
        </button>
      </form>
      <p class="lock-error" v-if="pwdError">{{ pwdError }}</p>
    </div>

    <!-- 已解锁：正常界面 -->
    <div class="card" v-else>
      <!-- 启动栏 -->
      <div class="launch-bar">
        <div class="launch-info">
          <span class="launch-icon"><AppIcon icon="gamepad" :size="22" /></span>
          <div class="launch-text">
            <span class="launch-label">QQ三国</span>
            <span class="launch-path" v-if="launcher.gamePath">{{ launcher.gamePath }}</span>
            <span class="launch-path dim" v-else>请选择游戏路径</span>
          </div>
        </div>
        <div class="launch-actions">
          <button class="btn btn-ghost" @click="selectPath" :disabled="launcher.detecting"><AppIcon icon="folder" :size="12" /></button>
          <button class="btn btn-ghost" @click="refresh" :disabled="refreshing" title="手动刷新窗口列表"><AppIcon icon="rotate" :size="12" /></button>
          <button class="btn btn-primary" @click="launchGame" :disabled="launcher.detecting || !launcher.gamePath">
            <AppIcon v-if="launcher.detecting" icon="loader" :size="12" class="icon-spin" />
            <template v-else><AppIcon icon="rocket" :size="12" /> 启动</template>
          </button>
        </div>
      </div>

      <!-- 窗口列表 -->
      <div class="win-list">
        <div v-if="windows.length === 0" class="empty">
          <span class="empty-icon"><AppIcon icon="app-window" :size="36" /></span>
          <span>未检测到窗口{{ refreshing ? '...' : '' }}</span>
        </div>
        <div
          v-for="(w, idx) in windows"
          :key="w.handle"
          class="win-row"
          :class="{ active: activeIdx === idx }"
          @click="onClick(idx)"
        >
          <div class="win-num" :class="{ on: activeIdx === idx }">{{ idx + 1 }}</div>
          <div class="win-info">
            <div class="win-title">{{ w.title }}</div>
            <div class="win-meta">PID {{ w.pid }} · {{ w.processName }}</div>
          </div>
          <select
            class="win-slot"
            :value="getSlot(w)"
            title="绑定到 Ctrl+1~5 全局快捷键"
            @change="assignSlot(w, Number(($event.target as HTMLSelectElement).value))"
            @click.stop
          >
            <option v-for="s in 5" :key="s" :value="s">Ctrl+{{ s }}</option>
            <option :value="0">—</option>
          </select>
        </div>
      </div>

      <!-- 定时关机 -->
      <div class="shutdown-bar" :class="{ 'sd-bar--active': sdActive }">
        <div class="shutdown-info">
          <span class="shutdown-icon"><AppIcon icon="timer" :size="18" /></span>
          <span class="shutdown-label">定时关机</span>
          <span class="shutdown-status" v-if="sdActive">
            <AppIcon icon="loader" :size="11" class="icon-spin" /> {{ sdRemaining }}
          </span>
          <span class="shutdown-status sd-done" v-if="sdDone">已发出关机信号</span>
        </div>
        <div class="shutdown-actions">
          <template v-if="!sdActive && !sdDone">
            <select v-model="sdHours" class="sd-select" @change="sdError = ''">
              <option v-for="h in sdOptions" :key="h" :value="h">{{ h }}小时</option>
            </select>
            <button class="btn btn-shutdown" @click="setShutdown" :disabled="sdLoading">
              <AppIcon v-if="sdLoading" icon="loader" :size="12" class="icon-spin" />
              <template v-else><AppIcon icon="timer" :size="12" /> 开始</template>
            </button>
          </template>
          <template v-else-if="sdActive">
            <span class="sd-target">关机时间 {{ sdTargetStr }}</span>
            <button class="btn btn-cancel-sd" @click="cancelShutdown" :disabled="sdLoading">
              <AppIcon icon="x" :size="12" /> 取消关机
            </button>
          </template>
          <template v-else-if="sdDone">
            <span class="sd-done-text">关机中…</span>
          </template>
        </div>
      </div>

      <!-- 启动/关机/刷新错误 -->
      <div class="launch-err" v-if="launcher.error || sdError || refreshError">{{ launcher.error || sdError || refreshError }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, onActivated } from 'vue'
import { useGameLauncher, useAppStore } from '@/stores'
import AppIcon from '@/components/ui/AppIcon.vue'

const launcher = useGameLauncher()
const appStore = useAppStore()

const windows = ref<GameWindow[]>([])
const activeIdx = ref(-1)
const refreshing = ref(false)
const refreshError = ref('')
const presetMap = ref<Record<string, number>>({})   // title → slot

const locked = ref(true)
const pwdInput = ref('')
const pwdError = ref('')
const pwdChecking = ref(false)

async function checkAuth() {
  try {
    const status = await api().authStatus()
    locked.value = status.locked
  } catch {
    locked.value = true
  }
}

async function doUnlock() {
  if (pwdChecking.value || !pwdInput.value) return
  pwdChecking.value = true
  pwdError.value = ''
  try {
    const res = await api().authUnlock(pwdInput.value)
    if (res.ok) {
      locked.value = false
      pwdInput.value = ''
      // 解锁后立即加载窗口数据（后续更新由主进程推送）
      await refresh()
    } else {
      pwdError.value = '密码错误'
    }
  } catch {
    pwdError.value = '验证失败，请重试'
  } finally {
    pwdChecking.value = false
  }
}

function getSlot(w: GameWindow): number {
  return presetMap.value[w.title] || 0
}

async function assignSlot(w: GameWindow, slot: number) {
  const updated = await window.electronAPI.winPresetSet(w.title, slot)
  // 更新本地 preset 缓存
  await loadPresets()
  // 主进程已返回重排后的列表
  if (updated) windows.value = updated
}

async function loadPresets() {
  try {
    const presets = await api().winPresetList()
    if (!presets) return
    const map: Record<string, number> = {}
    for (const p of presets) {
      if (p.slot >= 1 && p.slot <= 10) map[p.title] = p.slot
    }
    presetMap.value = map
  } catch {}
}

const api = () => window.electronAPI

async function refresh() {
  if (refreshing.value || !api()) return
  refreshing.value = true
  refreshError.value = ''
  try {
    // 竞态超时：主进程一旦挂起，刷新按钮不能被 refreshing 永久禁用
    const list = await Promise.race([
      api().listGameWindows(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('刷新超时')), 8000)),
    ])
    // 锁定等场景主进程可能返回非数组，直接赋值会污染列表
    if (!Array.isArray(list)) throw new Error('返回数据异常，请解锁后重试')
    windows.value = list
    await loadPresets()
  } catch (e: any) {
    console.warn('[窗口管理] 刷新失败:', e?.message || e)
    refreshError.value = '刷新失败：' + (e?.message || '未知错误')
  } finally {
    refreshing.value = false
  }
}

function onClick(idx: number) {
  if (idx < 0 || idx >= windows.value.length) return
  activeIdx.value = idx
  api().activateGameWindow(windows.value[idx].handle, idx)
}

async function launchGame() {
  // 启动器、游戏窗口出现时机不定（可能数十秒），不做定时轮询：
  // 主进程监视器检测到 QQSG 窗口出现/消失会自动推送更新本列表
  await launcher.launch()
}
async function selectPath() { await launcher.selectManually() }

// ── 定时关机 ──

const sdOptions = Array.from({ length: 24 }, (_, i) => i + 1)
const sdHours = ref(3)
const sdActive = ref(false)
const sdDone = ref(false)
const sdTargetTime = ref(0)
const sdTargetStr = ref('')
const sdRemaining = ref('')
const sdLoading = ref(false)
const sdError = ref('')
let sdInterval: ReturnType<typeof setInterval> | null = null

function formatRemaining(ms: number): string {
  if (ms <= 0) return '即将关机…'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  if (h > 0) return `${h}时${m}分${s}秒`
  if (m > 0) return `${m}分${s}秒`
  return `${s}秒`
}

async function setShutdown() {
  if (sdLoading.value) return
  sdLoading.value = true
  sdError.value = ''
  try {
    const res = await window.electronAPI.setShutdown(sdHours.value)
    if (res?.ok) {
      sdActive.value = true
      sdTargetTime.value = res.targetTime || 0
      sdTargetStr.value = new Date(sdTargetTime.value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      updateRemaining()
      sdInterval = setInterval(updateRemaining, 1000)
    } else {
      sdError.value = (res as any)?.error || '设置失败，请重试'
    }
  } catch (e: any) {
    sdError.value = e?.message || '系统命令执行失败'
  } finally {
    sdLoading.value = false
  }
}

function updateRemaining() {
  const remaining = sdTargetTime.value - Date.now()
  sdRemaining.value = formatRemaining(Math.max(0, remaining))
  if (remaining <= 0) {
    sdActive.value = false
    sdDone.value = true
    if (sdInterval) { clearInterval(sdInterval); sdInterval = null }
  }
}

async function cancelShutdown() {
  if (sdLoading.value) return
  sdLoading.value = true
  sdError.value = ''
  try {
    await window.electronAPI.cancelShutdown()
    sdActive.value = false
    sdRemaining.value = ''
    if (sdInterval) { clearInterval(sdInterval); sdInterval = null }
  } catch (e: any) {
    sdError.value = e?.message || '取消失败'
  } finally {
    sdLoading.value = false
  }
}

// 检查现有定时关机状态
async function checkShutdownStatus() {
  try {
    const status = await window.electronAPI.shutdownStatus()
    if (status?.active) {
      sdActive.value = true
      sdDone.value = false
      sdTargetTime.value = status.targetTime || 0
      sdHours.value = status.hours || 3
      sdTargetStr.value = new Date(sdTargetTime.value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      updateRemaining()
      sdInterval = setInterval(updateRemaining, 1000)
    }
  } catch { /* 忽略 */ }
}

// ── 生命周期 ──

let unsub: (() => void) | null = null
let unsubWinList: (() => void) | null = null

// 主窗口从托盘恢复 / 重新聚焦时立即刷新（该场景路由不变，不会触发 onActivated）
function onFocusOrVisible() {
  if (!locked.value) refresh()
}

onMounted(() => {
  launcher.init()
  checkShutdownStatus()
  unsub = api().onSwitched((payload: { idx: number; count: number }) => {
    activeIdx.value = payload.idx
  })
  // 主进程监视器推送：窗口开/关/托盘隐藏秒级同步到列表，无需手动刷新
  unsubWinList = api().onWindowsChanged((list: GameWindow[]) => {
    if (Array.isArray(list)) windows.value = list
  })
  window.addEventListener('focus', onFocusOrVisible)
  document.addEventListener('visibilitychange', onFocusOrVisible)
})

// keep-alive 激活时刷新一次兜底（日常更新由主进程推送完成）
onActivated(async () => {
  await checkAuth()
  if (!locked.value) {
    refresh()
  }
})

onUnmounted(() => {
  if (unsub) unsub()
  if (unsubWinList) unsubWinList()
  window.removeEventListener('focus', onFocusOrVisible)
  document.removeEventListener('visibilitychange', onFocusOrVisible)
  if (sdInterval) clearInterval(sdInterval)
})
</script>

<style scoped>
.page { height: 100%; display: flex; flex-direction: column; }
.page-head { margin-bottom: 18px; }
.page-head h2 { font-size: var(--text-lg); font-weight: 650; letter-spacing: -0.01em; display: flex; align-items: center; gap: 8px; }
.page-head p { color: var(--color-text-secondary); font-size: var(--text-sm); margin-top: 3px; }

.card { flex: 1; background: var(--color-surface-1); border: 1px solid var(--color-border-light); border-radius: var(--radius-md); box-shadow: var(--shadow-card); padding: 16px 18px; display: flex; flex-direction: column; }

/* 启动栏 */
.launch-bar {
  display: flex; align-items: center; gap: 14px;
  padding: 10px 14px; margin-bottom: 14px;
  background: var(--color-surface-2); border-radius: var(--radius-sm);
  flex-shrink: 0;
}
.launch-info { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
.launch-icon { font-size: var(--text-xl); }
.launch-text { min-width: 0; display: flex; flex-direction: column; }
.launch-label { font-size: var(--text-sm); font-weight: 600; }
.launch-path { font-size: var(--text-micro); color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.launch-path.dim { color: var(--color-text-tertiary); }
.launch-actions { display: flex; gap: 6px; flex-shrink: 0; }
.launch-err { font-size: var(--text-micro); color: var(--color-danger); margin-top: 6px; flex-shrink: 0; }

/* 窗口列表 */
.win-list { flex: 1; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; min-height: 0; }
.empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: var(--color-text-tertiary); font-size: var(--text-sm); }
.empty-icon { font-size: var(--text-xl); }

.win-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; border-radius: var(--radius-sm);
  cursor: pointer; transition: background 0.1s;
}
.win-row:hover { background: var(--color-surface-2); }
.win-row.active { background: var(--color-accent-bg); }

.win-num {
  width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: var(--text-micro); font-weight: 600;
  background: var(--color-surface-3); color: var(--color-text-tertiary);
  flex-shrink: 0;
}
.win-num.on { background: var(--color-accent); color: #fff; }

.win-info { flex: 1; min-width: 0; }
.win-title { font-size: var(--text-sm); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.win-meta { font-size: var(--text-micro); color: var(--color-text-tertiary); margin-top: 2px; }

.win-slot {
  min-width: 58px; height: 24px; padding: 0 4px;
  font-size: var(--text-micro); font-weight: 600; font-family: inherit;
  text-align: center;
  border: 1px solid var(--color-border); border-radius: 4px;
  background: var(--color-surface-3); color: var(--color-text-tertiary);
  cursor: pointer; flex-shrink: 0;
  appearance: none; -webkit-appearance: none;
  transition: border-color 0.12s;
}
.win-slot:hover { border-color: var(--color-accent); }
.win-slot:focus { outline: none; border-color: var(--color-accent); color: var(--color-text); }

/* 按钮 */
.btn {
  border: none; border-radius: 5px; cursor: pointer;
  font-size: var(--text-xs); font-weight: 500; padding: 6px 12px;
  transition: opacity 0.1s; font-family: inherit;
}
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-ghost { background: var(--color-surface-3); color: var(--color-text-secondary); }
.btn-ghost:hover { color: var(--color-text); }
.btn-primary { background: var(--color-accent); color: #fff; }
.btn-primary:hover { opacity: 0.85; }

/* ── 定时关机 ── */
.shutdown-bar {
  display: flex; align-items: center; gap: 14px;
  padding: 10px 14px; margin-top: 14px;
  background: var(--color-surface-2); border-radius: var(--radius-sm);
  flex-shrink: 0; transition: background 0.2s, border-color 0.2s;
  border: 1px solid transparent;
}
.sd-bar--active {
  background: #2d1f0a; border-color: #8b6914;
}
.shutdown-info { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; }
.shutdown-icon { font-size: var(--text-lg); }
.shutdown-label { font-size: var(--text-xs); font-weight: 600; white-space: nowrap; }
.shutdown-status { font-size: var(--text-micro); color: var(--color-warning); font-weight: 500; }
.shutdown-status.sd-done { color: var(--color-danger); }
.shutdown-actions { display: flex; gap: 6px; flex-shrink: 0; align-items: center; }

.sd-target { font-size: var(--text-micro); color: var(--color-text-tertiary); margin-right: 4px; }
.sd-done-text { font-size: var(--text-xs); color: var(--color-danger); font-weight: 500; }

.sd-select {
  padding: 4px 24px 4px 8px; font-size: var(--text-xs); font-weight: 500;
  border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  background-color: var(--color-surface-3); color: var(--color-text);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8F98' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  cursor: pointer; font-family: inherit; outline: none;
  transition: border-color 0.12s; min-width: 80px;
}
.sd-select:hover { border-color: var(--color-accent); }
.sd-select:focus { border-color: var(--color-accent-ring); }

.btn-shutdown {
  border: none; border-radius: 5px; cursor: pointer;
  font-size: var(--text-xs); font-weight: 550; padding: 5px 12px;
  background: var(--color-warning); color: #000;
  font-family: inherit; transition: opacity 0.1s;
}
.btn-shutdown:hover { opacity: 0.85; }
.btn-shutdown:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-sd-confirm {
  border: none; border-radius: 5px; cursor: pointer;
  font-size: var(--text-xs); font-weight: 600; padding: 5px 12px; white-space: nowrap;
  background: #c76e1a; color: #fff;
  font-family: inherit; transition: all 0.15s;
}
.btn-sd-confirm:hover { background: #e07b1f; }
.btn-sd-confirm:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-sd-back {
  border: 0.5px solid var(--color-border); border-radius: 5px; cursor: pointer;
  font-size: var(--text-micro); font-weight: 500; padding: 5px 10px;
  background: var(--color-surface-3); color: var(--color-text-secondary);
  font-family: inherit; transition: all 0.12s;
}
.btn-sd-back:hover { background: var(--color-surface-1); color: var(--color-text); }

.btn-cancel-sd {
  border: none; border-radius: 5px; cursor: pointer;
  font-size: var(--text-xs); font-weight: 550; padding: 5px 12px;
  background: var(--color-danger); color: #fff;
  font-family: inherit; transition: opacity 0.1s;
}
.btn-cancel-sd:hover { opacity: 0.85; }
.btn-cancel-sd:disabled { opacity: 0.4; cursor: not-allowed; }

.sd-err { font-size: var(--text-micro); color: var(--color-danger); margin-top: 6px; flex-shrink: 0; }

/* 密码解锁卡片 */
.lock-card {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px; padding: 48px 24px; text-align: center;
}
.lock-icon { font-size: var(--text-xl); }
.lock-title { font-size: var(--text-lg); font-weight: 650; color: var(--color-text); }
.lock-desc { font-size: var(--text-sm); color: var(--color-text-secondary); margin-top: -8px; }
.lock-form { display: flex; gap: 8px; margin-top: 4px; }
.lock-input {
  width: 200px; padding: 5px 10px;
  font-size: var(--text-xs); font-family: inherit;
  border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  background: var(--color-surface-2); color: var(--color-text);
  outline: none; transition: border-color 0.12s;
}
.lock-input:focus { border-color: var(--color-accent-ring); }
.lock-input::placeholder { color: var(--color-text-tertiary); }
.lock-btn { padding: 5px 16px; font-size: var(--text-xs); }
.lock-error { font-size: var(--text-xs); color: var(--color-danger); margin-top: -8px; }
</style>
