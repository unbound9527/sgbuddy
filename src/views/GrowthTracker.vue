<template>
  <div class="page">
    <div class="page-head">
      <h2>🎮 窗口管理</h2>
      <p>Ctrl+1~5 切换 · 全局生效</p>
    </div>

    <!-- 未解锁：密码输入界面 -->
    <div class="card lock-card" v-if="locked">
      <div class="lock-icon">🔒</div>
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
          <span class="launch-icon">🎮</span>
          <div class="launch-text">
            <span class="launch-label">QQ三国</span>
            <span class="launch-path" v-if="launcher.gamePath">{{ launcher.gamePath }}</span>
            <span class="launch-path dim" v-else>请选择游戏路径</span>
          </div>
        </div>
        <div class="launch-actions">
          <button class="btn btn-ghost" @click="selectPath" :disabled="launcher.detecting">📁</button>
          <button class="btn btn-ghost" @click="refresh" :disabled="refreshing" title="手动刷新窗口列表">🔄</button>
          <button class="btn btn-primary" @click="launchGame" :disabled="launcher.detecting || !launcher.gamePath">
            {{ launcher.detecting ? '⏳' : '🚀 启动' }}
          </button>
        </div>
      </div>

      <!-- 窗口列表 -->
      <div class="win-list">
        <div v-if="windows.length === 0" class="empty">
          <span class="empty-icon">🪟</span>
          <span>未检测到窗口{{ refreshing ? '...' : '' }}</span>
        </div>
        <div
          v-for="(w, idx) in windows"
          :key="w.handle"
          class="win-row"
          :class="{ active: activeIdx === idx }"
          @click="onClick(idx)"
        >
          <select
            class="win-slot"
            :value="getSlot(w)"
            @change="assignSlot(w, Number(($event.target as HTMLSelectElement).value))"
            @click.stop
          >
            <option v-for="s in 5" :key="s" :value="s">{{ s }}</option>
            <option :value="0">—</option>
          </select>
          <div class="win-info">
            <div class="win-title">{{ w.title }}</div>
            <div class="win-meta">PID {{ w.pid }} · {{ w.processName }}</div>
          </div>
          <span class="win-key">{{ idx < 5 ? 'Ctrl+' + (idx + 1) : '' }}</span>
        </div>
      </div>

      <!-- 定时关机 -->
      <div class="shutdown-bar" :class="{ 'sd-bar--active': sdActive }">
        <div class="shutdown-info">
          <span class="shutdown-icon">⏻</span>
          <span class="shutdown-label">定时关机</span>
          <span class="shutdown-status" v-if="sdActive">
            ⏳ {{ sdRemaining }}
          </span>
          <span class="shutdown-status sd-done" v-if="sdDone">已发出关机信号</span>
        </div>
        <div class="shutdown-actions">
          <template v-if="!sdActive && !sdDone">
            <select v-model="sdHours" class="sd-select" @change="sdError = ''">
              <option v-for="h in sdOptions" :key="h" :value="h">{{ h }}小时</option>
            </select>
            <button class="btn btn-shutdown" @click="setShutdown" :disabled="sdLoading">
              {{ sdLoading ? '⏳' : '⏻ 开始' }}
            </button>
          </template>
          <template v-else-if="sdActive">
            <span class="sd-target">关机时间 {{ sdTargetStr }}</span>
            <button class="btn btn-cancel-sd" @click="cancelShutdown" :disabled="sdLoading">
              ✕ 取消关机
            </button>
          </template>
          <template v-else-if="sdDone">
            <span class="sd-done-text">关机中…</span>
          </template>
        </div>
      </div>

      <!-- 启动/关机错误 -->
      <div class="launch-err" v-if="launcher.error || sdError">{{ launcher.error || sdError }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, onActivated } from 'vue'
import { useGameLauncher, useAppStore } from '@/stores'

const launcher = useGameLauncher()
const appStore = useAppStore()

const windows = ref<GameWindow[]>([])
const activeIdx = ref(-1)
const refreshing = ref(false)
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
      // 解锁后立即加载窗口数据
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
  try {
    windows.value = await api().listGameWindows()
    await loadPresets()
  } catch {}
  finally { refreshing.value = false }
}

function onClick(idx: number) {
  if (idx < 0 || idx >= windows.value.length) return
  activeIdx.value = idx
  api().activateGameWindow(windows.value[idx].handle, idx)
}

async function launchGame() {
  await launcher.launch(async () => {
    // 启动后轮询检测窗口（每 1.5s 检测一次，最多 10 次 ≈ 15s）
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1500))
      await refresh()
      if (windows.value.length > 0) break
    }
  })
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

onMounted(() => {
  launcher.init()
  checkShutdownStatus()
  unsub = api().onSwitched((payload: { idx: number; count: number }) => {
    activeIdx.value = payload.idx
  })
})

// keep-alive 激活时静默增量刷新窗口列表
onActivated(async () => {
  await checkAuth()
  if (!locked.value) refresh()
})

onUnmounted(() => {
  if (unsub) unsub()
  if (sdInterval) clearInterval(sdInterval)
})
</script>

<style scoped>
.page { height: 100%; display: flex; flex-direction: column; }
.page-head { margin-bottom: 18px; }
.page-head h2 { font-size: 24px; font-weight: 650; letter-spacing: -0.02em; }
.page-head p { color: var(--color-text-secondary); font-size: 13px; margin-top: 3px; }

.card { flex: 1; background: var(--color-surface-1); border: 0.5px solid var(--color-border-light); border-radius: var(--radius-md); padding: 16px 18px; display: flex; flex-direction: column; }

/* 启动栏 */
.launch-bar {
  display: flex; align-items: center; gap: 14px;
  padding: 10px 14px; margin-bottom: 14px;
  background: var(--color-surface-2); border-radius: var(--radius-sm);
  flex-shrink: 0;
}
.launch-info { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
.launch-icon { font-size: 22px; }
.launch-text { min-width: 0; display: flex; flex-direction: column; }
.launch-label { font-size: 13px; font-weight: 600; }
.launch-path { font-size: 11px; color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.launch-path.dim { color: var(--color-text-tertiary); }
.launch-actions { display: flex; gap: 6px; flex-shrink: 0; }
.launch-err { font-size: 11px; color: var(--color-danger); margin-top: 6px; flex-shrink: 0; }

/* 窗口列表 */
.win-list { flex: 1; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; min-height: 0; }
.empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: var(--color-text-tertiary); font-size: 13px; }
.empty-icon { font-size: 36px; }

.win-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; border-radius: var(--radius-sm);
  cursor: pointer; transition: background 0.1s;
}
.win-row:hover { background: var(--color-surface-2); }
.win-row.active { background: var(--color-accent-bg); }
.win-slot {
  width: 36px; height: 24px; padding: 0 2px;
  font-size: 11px; font-weight: 600; font-family: inherit;
  text-align: center;
  border: 0.5px solid var(--color-border); border-radius: 4px;
  background: var(--color-surface-3); color: var(--color-text-tertiary);
  cursor: pointer; flex-shrink: 0;
  appearance: none; -webkit-appearance: none;
}
.win-slot:hover { border-color: var(--color-accent); }
.win-slot:focus { outline: none; border-color: var(--color-accent); color: var(--color-text); }

.win-num {
  width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600;
  background: var(--color-surface-3); color: var(--color-text-tertiary);
  flex-shrink: 0;
}
.win-num.on { background: var(--color-accent); color: #fff; }

.win-info { flex: 1; min-width: 0; }
.win-title { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.win-meta { font-size: 10.5px; color: var(--color-text-tertiary); margin-top: 2px; }

.win-key { font-size: 10px; color: var(--color-text-tertiary); flex-shrink: 0; width: 42px; text-align: right; }

/* 按钮 */
.btn {
  border: none; border-radius: 5px; cursor: pointer;
  font-size: 12px; font-weight: 500; padding: 6px 12px;
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
.shutdown-icon { font-size: 18px; }
.shutdown-label { font-size: 12.5px; font-weight: 600; white-space: nowrap; }
.shutdown-status { font-size: 11px; color: var(--color-warning); font-weight: 500; }
.shutdown-status.sd-done { color: var(--color-danger); }
.shutdown-actions { display: flex; gap: 6px; flex-shrink: 0; align-items: center; }

.sd-target { font-size: 11px; color: var(--color-text-tertiary); margin-right: 4px; }
.sd-done-text { font-size: 12px; color: var(--color-danger); font-weight: 500; }

.sd-select {
  padding: 4px 8px; font-size: 12px; font-weight: 500;
  border: 0.5px solid var(--color-border); border-radius: 4px;
  background: var(--color-surface-3); color: var(--color-text);
  cursor: pointer; font-family: inherit; outline: none;
  transition: border-color 0.12s; min-width: 80px;
}
.sd-select:hover, .sd-select:focus { border-color: var(--color-accent); }

.btn-shutdown {
  border: none; border-radius: 5px; cursor: pointer;
  font-size: 12px; font-weight: 550; padding: 5px 12px;
  background: var(--color-warning); color: #000;
  font-family: inherit; transition: opacity 0.1s;
}
.btn-shutdown:hover { opacity: 0.85; }
.btn-shutdown:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-sd-confirm {
  border: none; border-radius: 5px; cursor: pointer;
  font-size: 12px; font-weight: 600; padding: 5px 12px; white-space: nowrap;
  background: #c76e1a; color: #fff;
  font-family: inherit; transition: all 0.15s;
}
.btn-sd-confirm:hover { background: #e07b1f; }
.btn-sd-confirm:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-sd-back {
  border: 0.5px solid var(--color-border); border-radius: 5px; cursor: pointer;
  font-size: 11px; font-weight: 500; padding: 5px 10px;
  background: var(--color-surface-3); color: var(--color-text-secondary);
  font-family: inherit; transition: all 0.12s;
}
.btn-sd-back:hover { background: var(--color-surface-1); color: var(--color-text); }

.btn-cancel-sd {
  border: none; border-radius: 5px; cursor: pointer;
  font-size: 12px; font-weight: 550; padding: 5px 12px;
  background: var(--color-danger); color: #fff;
  font-family: inherit; transition: opacity 0.1s;
}
.btn-cancel-sd:hover { opacity: 0.85; }
.btn-cancel-sd:disabled { opacity: 0.4; cursor: not-allowed; }

.sd-err { font-size: 11px; color: var(--color-danger); margin-top: 6px; flex-shrink: 0; }

/* 密码解锁卡片 */
.lock-card {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px; padding: 48px 24px; text-align: center;
}
.lock-icon { font-size: 48px; }
.lock-title { font-size: 18px; font-weight: 650; color: var(--color-text); }
.lock-desc { font-size: 13px; color: var(--color-text-secondary); margin-top: -8px; }
.lock-form { display: flex; gap: 8px; margin-top: 4px; }
.lock-input {
  width: 200px; padding: 8px 12px;
  font-size: 14px; font-family: inherit;
  border: 0.5px solid var(--color-border); border-radius: var(--radius-sm);
  background: var(--color-surface-2); color: var(--color-text);
  outline: none; transition: border-color 0.12s;
}
.lock-input:focus { border-color: var(--color-accent); }
.lock-input::placeholder { color: var(--color-text-tertiary); }
.lock-btn { padding: 8px 20px; font-size: 13px; }
.lock-error { font-size: 12px; color: var(--color-danger); margin-top: -8px; }
</style>
