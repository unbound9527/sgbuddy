import { ref } from 'vue'
import { defineStore } from 'pinia'

/** scammer_blacklist 表条目 */
export interface ScamEntry {
  id: number
  server_id: number
  role_name: string
  method: string
  description: string
  source: string
  created_at: string | null
  updated_at: string | null
}

/** 行骗手法分类（录入下拉与列表筛选共用） */
export const SCAM_METHODS = [
  '假冒官方/客服',
  '低价代充',
  '虚假交易/黑货',
  '盗号链接/木马',
  '代练/工作室卷款',
  '摆摊/帮派诈骗',
  '其他',
] as const

/** server_id = 0 表示全大区通用条目（如假冒客服等跨区骗术） */
export const SCAM_GLOBAL_SERVER_ID = 0

const TICKER_KEY = 'sgbuddy-scam-ticker'

/**
 * 防骗黑名单共享状态：滚动条（ScamTicker）与管理面板（BlacklistPanel）共用。
 * 数据本体在 scammer_blacklist 表，按 server_id 隔离（0 为通用）；
 * 面板增删改后调用 bumpDataVersion()，滚动条 watch 后重载。
 */
export const useBlacklistStore = defineStore('blacklist', () => {
  // 滚动提醒开关（localStorage 持久化，默认开启；老玩家可关闭且不再显示）
  const tickerEnabled = ref(localStorage.getItem(TICKER_KEY) !== 'off')

  function setTickerEnabled(on: boolean) {
    tickerEnabled.value = on
    localStorage.setItem(TICKER_KEY, on ? 'on' : 'off')
  }

  // 数据变更版本号
  const dataVersion = ref(0)
  function bumpDataVersion() {
    dataVersion.value++
  }

  // 滚动条条目：当前大区 + 通用，按录入时间倒序取最近 20 条
  const tickerItems = ref<ScamEntry[]>([])

  async function loadTickerItems(serverId: number | null) {
    if (!serverId) {
      tickerItems.value = []
      return
    }
    try {
      const rows = await window.electronAPI.dbQuery(
        `SELECT id, server_id, role_name, method, description, updated_at
           FROM scammer_blacklist
          WHERE server_id IN (?, ?)
          ORDER BY updated_at DESC, id DESC
          LIMIT 20`,
        [serverId, SCAM_GLOBAL_SERVER_ID],
      )
      tickerItems.value = rows as ScamEntry[]
    } catch (e) {
      console.error('加载防骗提醒失败:', e)
      tickerItems.value = []
    }
  }

  return { tickerEnabled, setTickerEnabled, dataVersion, bumpDataVersion, tickerItems, loadTickerItems }
})
