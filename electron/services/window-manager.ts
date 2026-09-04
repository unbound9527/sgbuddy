import koffi from 'koffi'

export interface GameWindow {
  handle: string
  title: string
  pid: number
  processName: string
  visible: boolean   // 是否可见（Ctrl+Q 隐藏到托盘则为 false）
}

export interface WinPreset {
  title: string
  slot: number   // 1-5
}

let cachedWindows: GameWindow[] = []

// ── Win32 API via koffi ──

const user32 = koffi.load('user32.dll')
const kernel32 = koffi.load('kernel32.dll')
const psapi = koffi.load('psapi.dll')

// 回调类型
const EnumWindowsCB = koffi.proto('bool EnumWindowsCB(int64 hwnd, int64 lparam)')

// user32
const EnumWindows = user32.func('bool EnumWindows(EnumWindowsCB *cb, int64 lparam)')
const IsWindowVisible = user32.func('bool IsWindowVisible(int64 hwnd)')
const GetWindowTextW = user32.func('int GetWindowTextW(int64 hwnd, char16 *buf, int maxCount)')
const GetWindowThreadProcessId = user32.func('uint32 GetWindowThreadProcessId(int64 hwnd, uint32 *outPid)')
const ShowWindowAsync = user32.func('bool ShowWindowAsync(int64 hwnd, int nCmdShow)')
const SetForegroundWindow = user32.func('bool SetForegroundWindow(int64 hwnd)')
const BringWindowToTop = user32.func('bool BringWindowToTop(int64 hwnd)')
const SwitchToThisWindow = user32.func('void SwitchToThisWindow(int64 hwnd, bool fAltTab)')
const GetWindowLongPtrW = user32.func('int64 GetWindowLongPtrW(int64 hwnd, int nIndex)')

const GWL_STYLE = -16
const WS_VISIBLE = 0x10000000

// kernel32
const OpenProcess = kernel32.func('int64 OpenProcess(uint32 access, bool inherit, uint32 pid)')
const CloseHandle = kernel32.func('bool CloseHandle(int64 h)')

// psapi — 用 GetProcessImageFileNameW（只需 PROCESS_QUERY_LIMITED_INFORMATION，无需 VM_READ）
const GetProcessImageFileNameW = psapi.func('uint32 GetProcessImageFileNameW(int64 hProc, char16 *buf, uint32 sz)')

const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
const SW_SHOW = 5   // 激活并显示窗口（处理 Ctrl+Q 隐藏到托盘的情况）

// ── 进程名缓存 ──
const pidNameCache = new Map<number, string>()
function getProcessName(pid: number): string {
  if (pidNameCache.has(pid)) return pidNameCache.get(pid)!
  try {
    const h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
    if (h === 0n || h === -1n) return ''
    try {
      const buf = new Uint16Array(260)
      const len = GetProcessImageFileNameW(h, buf, 260)
      if (len > 0) {
        // 返回 \Device\HarddiskVolume3\path\name.exe → 提取文件名
        const full = String.fromCharCode(...buf.slice(0, len))
        const name = full.split('\\').pop() || full
        pidNameCache.set(pid, name)
        return name
      }
      return ''
    } finally {
      CloseHandle(h)
    }
  } catch {
    return ''
  }
}

// ── 窗口枚举 ──

export function getCachedWindows(): GameWindow[] { return cachedWindows }

// slot → title 映射（applyPresetOrder 时更新）
let slotToTitle = new Map<number, string>()

/** 更新 slot→title 映射（供 Ctrl+1~5 快捷键使用），不改变窗口列表顺序 */
export function applyPresetOrder(presets: WinPreset[]): void {
  slotToTitle.clear()
  for (const p of presets) {
    if (p.slot < 1 || p.slot > 5) continue
    slotToTitle.set(p.slot, p.title)
  }
}

/** 按预设 slot 激活窗口（Ctrl+1~5 专用） */
export function switchBySlot(slot: number): number {
  const title = slotToTitle.get(slot)
  if (title) {
    const idx = cachedWindows.findIndex(w => w.title === title)
    if (idx >= 0) {
      console.log(`[switchBySlot] slot=${slot} preset=true title="${cachedWindows[idx].title}" pid=${cachedWindows[idx].pid}`)
      activateHandle(cachedWindows[idx].handle)
      return idx
    }
    // 预设窗口不在列表中（进程已退出），返回 -1 不做任何操作
    console.log(`[switchBySlot] slot=${slot} preset=true title="${title}" NOT_FOUND`)
    return -1
  }
  // 无预设时按索引激活（slot 1-10 映射到索引 0-9）
  const idx = slot - 1
  if (idx >= 0 && idx < cachedWindows.length) {
    console.log(`[switchBySlot] slot=${slot} preset=false index=${idx} title="${cachedWindows[idx].title}" pid=${cachedWindows[idx].pid} total=${cachedWindows.length}`)
    activateHandle(cachedWindows[idx].handle)
    return idx
  }
  console.log(`[switchBySlot] slot=${slot} NO_MATCH index=${idx} total=${cachedWindows.length}`)
  return -1
}

export function refreshWindows(): GameWindow[] {
  const result: GameWindow[] = []
  const seenHandles = new Set<string>()

  try {
    EnumWindows((hwnd: bigint, _lparam: bigint) => {
      const titleBuf = new Uint16Array(256)
      const titleLen = GetWindowTextW(hwnd, titleBuf, 256)
      if (titleLen === 0) return true
      const title = String.fromCharCode(...titleBuf.slice(0, titleLen))
      if (!title) return true

      if (!/QQ三国|QQ三國/.test(title)) return true
      if (/SG Buddy|配号助手/.test(title)) return true

      const hk = hwnd.toString()
      if (seenHandles.has(hk)) return true
      seenHandles.add(hk)

      const pidBuf = new Uint32Array(1)
      GetWindowThreadProcessId(hwnd, pidBuf)
      const pid = pidBuf[0]
      if (pid === 0) return true

      const pn = getProcessName(pid)
      if (pn !== 'QQSG.exe' && pn !== 'liveupdate.exe') return true

      // 跳过隐藏窗口（Ctrl+Q 隐藏到托盘的窗口）
      const isVisible = (Number(GetWindowLongPtrW(hwnd, GWL_STYLE)) & WS_VISIBLE) !== 0
      if (!isVisible) return true

      result.push({
        handle: hk,
        title,
        pid,
        processName: pn.replace('.exe', ''),
        visible: true,
      })
      return true
    }, 0n)
  } catch (e: any) {
    console.error('[窗口检测] EnumWindows 失败:', e?.message || e)
  }

  // 严格按照 PID 升序排列
  result.sort((a, b) => a.pid - b.pid)

  cachedWindows = result
  return cachedWindows
}

// ── 窗口切换（直接 Win32 调用，sub-ms） ──

function activateHandle(handle: string): void {
  const hwnd = BigInt(handle)
  ShowWindowAsync(hwnd, SW_SHOW)        // 显示窗口（处理 Ctrl+Q 隐藏到托盘的情况）
  SetForegroundWindow(hwnd)             // 设为前台窗口
  BringWindowToTop(hwnd)                // 提到 Z 序顶端
  SwitchToThisWindow(hwnd, true)        // 兜底：绕过前台限制强制切换
}

/** 刷新并返回缓存 */
export function refreshAndGet(): GameWindow[] {
  refreshWindows()
  return cachedWindows
}

// ── 常驻监视器：主进程每秒枚举一次，列表变化时回调 ──
// EnumWindows + 标题过滤开销极低（<1ms），固定 1s 间隔即可准实时感知窗口开/关/托盘隐藏。
// 相比渲染进程轮询：不受页面 keep-alive、窗口最小化、Chromium 定时器节流影响。

let watcherTimer: ReturnType<typeof setInterval> | null = null

function isSameList(a: GameWindow[], b: GameWindow[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].handle !== b[i].handle || a[i].pid !== b[i].pid || a[i].title !== b[i].title) return false
  }
  return true
}

/** 启动窗口监视，列表变化时触发 onChange（先触发一次初始同步） */
export function startWindowWatcher(onChange: (list: GameWindow[]) => void): void {
  stopWindowWatcher()
  let prev = refreshWindows()
  onChange(prev)
  watcherTimer = setInterval(() => {
    try {
      const next = refreshWindows()
      if (!isSameList(prev, next)) {
        prev = next
        onChange(next)
      }
    } catch (e: any) {
      console.error('[窗口监视] 刷新失败:', e?.message || e)
    }
  }, 1000)
}

export function stopWindowWatcher(): void {
  if (watcherTimer) { clearInterval(watcherTimer); watcherTimer = null }
}

// ── IPC API ──

export async function listGameWindows(): Promise<GameWindow[]> { return refreshWindows() }

export async function activateWindow(handle: string): Promise<boolean> {
  try { activateHandle(handle); return true } catch { return false }
}
