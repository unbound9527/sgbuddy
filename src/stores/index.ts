import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type Theme = 'dark' | 'light'

// (DEFAULT_SYSTEM_PROMPT & useSettingsStore removed — AI/API settings no longer needed)

// 主题状态
export const useThemeStore = defineStore('theme', () => {
  const saved = localStorage.getItem('sgbuddy-theme') as Theme | null
  const theme = ref<Theme>(saved === 'light' ? 'light' : 'dark')

  function toggle() {
    // 切换瞬间挂上 theme-switching：整页一次性重绘，不做全量颜色过渡动画（否则明显卡顿）
    const root = document.documentElement
    root.classList.add('theme-switching')
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    requestAnimationFrame(() => {
      requestAnimationFrame(() => root.classList.remove('theme-switching'))
    })
  }

  function set(t: Theme) {
    theme.value = t
  }

  // 同步到 DOM 和 localStorage
  watch(theme, (t) => {
    document.documentElement.setAttribute('data-theme', t)
    localStorage.setItem('sgbuddy-theme', t)
  }, { immediate: true })

  return { theme, toggle, set }
})

// 全局应用状态
export const useAppStore = defineStore('app', () => {
  const currentServerId = ref<number | null>(null)
  const currentServerName = ref('')
  const servers = ref<Array<{ id: number; name: string }>>([])
  const currencyRate = ref(0)
  const currencyRateUpdatedAt = ref('')
  // 淘宝对未登录会话打码币价：置位后侧栏显示「登录淘宝」引导（启动/切区/手动刷新任一路径触发）
  const taobaoNeedLogin = ref(false)
  // 物价数据版本号：录入/修改/删除价格后递增，供其他页面（配号中心等）实时刷新参考数据
  const priceDataVersion = ref(0)
  function bumpPriceDataVersion() {
    priceDataVersion.value++
  }

  // 配装方案数据版本号：配号中心增删改方案后递增，供养成宝典等页面实时刷新方案列表
  const schemeDataVersion = ref(0)
  function bumpSchemeDataVersion() {
    schemeDataVersion.value++
  }

  function setCurrentServer(id: number, name: string) {
    currentServerId.value = id
    currentServerName.value = name
    localStorage.setItem('sgbuddy-server', JSON.stringify({ id, name }))
    loadCurrencyRateForServer(id, name)
    // 通知主进程切换线索抓取目标大区
    window.electronAPI?.setClueServer?.(name)
    // 切换大区时自动同步抓取当前大区币价
    window.electronAPI?.scrapeOne?.(name).then(async (result) => {
      taobaoNeedLogin.value = !!result?.needLogin
      if (result?.price && currentServerId.value === id) {
        await reloadCurrencyRate(id, name)
      }
    }).catch(() => {})
  }

  async function reloadCurrencyRate(id: number, name: string) {
    await loadCurrencyRateForServer(id, name)
  }

  async function loadCurrencyRateForServer(id: number, name: string) {
    try {
      const rows = await window.electronAPI.dbQuery(
        'SELECT currency_rate FROM servers WHERE id=?', [id]
      ) as Array<{ currency_rate: number }>
      if (rows.length > 0 && rows[0].currency_rate > 0) {
        currencyRate.value = rows[0].currency_rate
        const hist = await window.electronAPI.dbQuery(
          'SELECT recorded_at FROM currency_rate_history WHERE server_id=? ORDER BY recorded_at DESC LIMIT 1', [id]
        ) as Array<{ recorded_at: string }>
        currencyRateUpdatedAt.value = hist[0]?.recorded_at ?? ''
        return
      }
    } catch { /* fallthrough：DB 异常时也按「未获取」处理 */ }

    // DB 无真实价：不填任何默认值（避免把估算价当真实市场价误导），一律显示「未获取」，等抓取落地后由下方轮询刷新为真实价
    currencyRate.value = 0
    currencyRateUpdatedAt.value = '未获取'

    // 延迟重新查询（等抓取器完成后刷新为真实入库价）
    const DELAYS = [3000, 10000, 30000, 60000, 120000]
    for (const ms of DELAYS) {
      await new Promise(r => setTimeout(r, ms))
      try {
        const rows = await window.electronAPI.dbQuery(
          'SELECT currency_rate FROM servers WHERE id=? AND currency_rate > 0', [id]
        ) as Array<{ currency_rate: number }>
        if (rows.length > 0) {
          currencyRate.value = rows[0].currency_rate
          const hist = await window.electronAPI.dbQuery(
            'SELECT recorded_at FROM currency_rate_history WHERE server_id=? ORDER BY recorded_at DESC LIMIT 1', [id]
          ) as Array<{ recorded_at: string }>
          currencyRateUpdatedAt.value = hist[0]?.recorded_at ?? ''
          return
        }
      } catch { /* keep waiting */ }
    }
    // 轮询结束仍无真实价 → 维持「未获取」
    currencyRate.value = 0
    currencyRateUpdatedAt.value = '未获取'
  }

  function setCurrencyRate(rate: number) {
    const rounded = Math.round(rate * 100) / 100
    currencyRate.value = rounded
    if (!currentServerId.value || rounded <= 0) return
    // 仅用于 UI 展示的"更新时间"文案；不参与写库（写库时间统一交给 DB 的 datetime('now','localtime')，避免混入歧义格式导致缓存判断与走势排序错乱）
    currencyRateUpdatedAt.value = new Date().toLocaleString('zh-CN', { hour12: false })
    // 更新数据库
    window.electronAPI.dbQuery(
      'UPDATE servers SET currency_rate=? WHERE id=?', [rounded, currentServerId.value]
    ).catch(() => {})
    // 记录历史：不传 recorded_at，走表默认 datetime('now','localtime')，保证与抓取侧格式一致(YYYY-MM-DD HH:MM:SS)
    window.electronAPI.dbQuery(
      'INSERT INTO currency_rate_history (server_id, rate) VALUES (?,?)',
      [currentServerId.value, rounded]
    ).catch(() => {})
  }

  async function loadServers() {
    try {
      const result = await window.electronAPI.dbQuery(
        'SELECT id, name FROM servers ORDER BY id'
      ) as Array<{ id: number; name: string }>
      servers.value = result
      if (result.length > 0 && !currentServerId.value) {
        const saved = localStorage.getItem('sgbuddy-server')
        if (saved) {
          try {
            const parsed = JSON.parse(saved) as { id: number; name: string }
            const exists = result.find(s => s.id === parsed.id)
            if (exists) setCurrentServer(exists.id, exists.name)
          } catch { /* ignore */ }
        }
        if (!currentServerName.value) {
          // 无记忆时取第一个区服，不再写死特定大区名称
          const def = result[0]
          setCurrentServer(def.id, def.name)
        }
        // 首次加载后触发币价抓取（仅一次）
        if (currentServerName.value) {
          await window.electronAPI?.setClueServer?.(currentServerName.value)
          window.electronAPI?.scrapeRates?.().then((r) => {
            if (r?.needLogin) taobaoNeedLogin.value = true
          }).catch(() => {})
        }
      }
    } catch (e) {
      console.error('加载区服失败:', e)
    }
  }

  return {
    currentServerId,
    currentServerName,
    servers,
    currencyRate,
    currencyRateUpdatedAt,
    taobaoNeedLogin,
    priceDataVersion,
    bumpPriceDataVersion,
    schemeDataVersion,
    bumpSchemeDataVersion,
    setCurrentServer,
    setCurrencyRate,
    reloadCurrencyRate,
    loadServers,
  }
})

// ── 游戏启动器（共享逻辑：侧边栏 + 养成追踪） ──

const SETTING_KEY = 'qqsg-path'

export const useGameLauncher = defineStore('gameLauncher', () => {
  const gamePath = ref('')
  const detecting = ref(false)
  const error = ref('')

  // 加载已保存的路径
  async function init() {
    detecting.value = true
    error.value = ''
    try {
      const saved = await window.electronAPI.getSetting(SETTING_KEY)
      if (saved) {
        // 验证已保存路径是否仍有效
        const valid = await window.electronAPI.detectGamePath(saved)
        if (valid) {
          gamePath.value = valid
        }
      }
    } catch { /* ignore */ }
    finally { detecting.value = false }
  }

  // 手动选择游戏路径
  async function selectManually() {
    detecting.value = true
    error.value = ''
    try {
      const selected = await window.electronAPI.selectGamePath()
      if (selected) {
        gamePath.value = selected
        await window.electronAPI.setSetting(SETTING_KEY, selected)
      }
    } catch (e) {
      error.value = '选择路径失败'
    } finally {
      detecting.value = false
    }
  }

  // 启动游戏
  async function launch(onLaunched?: () => void) {
    if (!gamePath.value || detecting.value) return
    error.value = ''
    // 启动前先验证路径，无效则提示用户手动选择
    const valid = await window.electronAPI.detectGamePath(gamePath.value)
    if (!valid) {
      gamePath.value = ''
      error.value = '游戏路径已失效，请手动重新选择'
      await window.electronAPI.setSetting(SETTING_KEY, '')
      return
    }
    const result = await window.electronAPI.launchApp(gamePath.value)
    if (result.ok) {
      onLaunched?.()
    } else {
      error.value = '启动失败: ' + (result.error || '未知错误')
    }
  }

  return { gamePath, detecting, error, init, launch, selectManually }
})
