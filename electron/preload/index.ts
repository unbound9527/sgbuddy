import { contextBridge, ipcRenderer } from 'electron'

// 暴露给渲染进程的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 数据库查询
  dbQuery: (sql: string, params?: unknown[]) =>
    ipcRenderer.invoke('db:query', sql, params),

  // 数据库事务
  dbTransaction: (statements: { sql: string; params?: unknown[] }[]) =>
    ipcRenderer.invoke('db:transaction', statements),

  // 启动外部程序
  launchApp: (exePath: string) =>
    ipcRenderer.invoke('app:launch', exePath),

  // 自动检测游戏路径（可传入已有路径验证，不传则扫描常见位置）
  detectGamePath: (existingPath?: string) =>
    ipcRenderer.invoke('app:detect-game-path', existingPath),

  // 手动选择游戏路径（打开系统文件对话框）
  selectGamePath: () =>
    ipcRenderer.invoke('app:select-game-path'),

  // 应用版本号
  getAppVersion: () => ipcRenderer.invoke('app:version') as Promise<string>,

  // 用系统默认浏览器打开外部链接
  openExternal: (url: string) =>
    ipcRenderer.invoke('shell:open-external', url) as Promise<{ ok: boolean; error?: string }>,

  // 手动触发币价抓取（force 为 true 时忽略 3h 缓存）
  scrapeOne: (serverName: string, force?: boolean) =>
    ipcRenderer.invoke('app:scrape-one', serverName, force) as Promise<{ price: number | null; needLogin?: boolean; error?: string }>,
  scrapeRates: (force?: boolean) =>
    ipcRenderer.invoke('app:scrape-rates', force),
  // 淘宝价格打码时手动登录（Cookie 持久化，登录一次即可）
  currencyLogin: () =>
    ipcRenderer.invoke('currency:login') as Promise<{ ok: boolean }>,
  currencyLoginStatus: () =>
    ipcRenderer.invoke('currency:login-status') as Promise<{ loggedIn: boolean; error?: string }>,

  // 交易线索
  scrapeClues: (serverName: string) =>
    ipcRenderer.invoke('clue:scrape', serverName),
  loadClues: (params: { serverName: string; source?: string; keyword?: string; limit?: number }) =>
    ipcRenderer.invoke('clue:load', params),
  updateClueStatus: (id: number, status: string) =>
    ipcRenderer.invoke('clue:update-status', id, status),
  deleteClue: (id: number) =>
    ipcRenderer.invoke('clue:delete', id) as Promise<{ ok: boolean; deleted: number }>,
  // 区服-贴吧映射单一数据源（含无贴吧区服=null）
  getTiebaMap: () => ipcRenderer.invoke('clue:tieba-map') as Promise<Record<string, string | null>>,
  // 被反爬拦截时弹窗手动过验证（传 serverName 或贴吧名）
  openWallVerify: (serverOrTiebaName: string) =>
    ipcRenderer.invoke('clue:open-wall', serverOrTiebaName) as Promise<{ ok: boolean }>,
  setClueServer: (name: string) =>
    ipcRenderer.invoke('clue:set-server', name),
  clearClues: (serverName: string) =>
    ipcRenderer.invoke('clue:clear', serverName) as Promise<{ ok: boolean; deleted: number }>,
  onClueProgress: (cb: (data: { source: string; done: number; total: number }) => void) => {
    const handler = (_event: any, data: any) => cb(data)
    ipcRenderer.on('clue:progress', handler)
    return () => { ipcRenderer.removeListener('clue:progress', handler) }
  },
  // 手动刷新时逐条收到新增线索（流式上屏）
  onClueNew: (cb: (row: ClueRecord) => void) => {
    const handler = (_event: any, row: any) => cb(row)
    ipcRenderer.on('clue:new', handler)
    return () => { ipcRenderer.removeListener('clue:new', handler) }
  },
  // 装备图片
  selectImage: () => ipcRenderer.invoke('image:select') as Promise<string | null>,
  saveImage: (itemName: string, sourcePath: string, priceId?: number) => ipcRenderer.invoke('image:save', itemName, sourcePath, priceId) as Promise<{ ok: boolean; id?: number; path?: string; error?: string }>,
  listImages: (itemName: string, priceId?: number) => ipcRenderer.invoke('image:list', itemName, priceId) as Promise<Array<{ id: number; image_path: string; sort_order: number }>>,
  getImagePath: (relativePath: string) => ipcRenderer.invoke('image:get-path', relativePath) as Promise<string>,
  deleteImage: (id: number) => ipcRenderer.invoke('image:delete', id) as Promise<{ ok: boolean; error?: string }>,
  readImage: (relativePath: string) => ipcRenderer.invoke('image:read', relativePath) as Promise<string | null>,
  saveImageBuffer: (itemName: string, png: Uint8Array, priceId?: number) => ipcRenderer.invoke('image:save-buffer', itemName, png, priceId) as Promise<{ ok: boolean; id?: number; path?: string; error?: string }>,

  // OCR 图片识别
  ocrRecognize: (input: { kind: 'buffer'; data: Uint8Array } | { kind: 'path'; path: string }) =>
    ipcRenderer.invoke('ocr:recognize', input) as Promise<{ text: string; qualityColor?: string; error?: string }>,
  onOcrProgress: (cb: (p: { stage: 'startup' | 'download' | 'recognize'; percent: number }) => void) => {
    const h = (_e: any, p: { stage: 'startup' | 'download' | 'recognize'; percent: number }) => cb(p)
    ipcRenderer.on('ocr:progress', h)
    return () => { ipcRenderer.removeListener('ocr:progress', h) }
  },
  readClipboardImage: () => ipcRenderer.invoke('clipboard:read-image') as Promise<{ dataUrl: string; png: Uint8Array } | null>,
  readClipboardText: () => ipcRenderer.invoke('clipboard:read-text') as Promise<string | null>,

  // 方案导出
  exportScheme: (data: any) => ipcRenderer.invoke('export:scheme', data) as Promise<{ ok: boolean; path?: string; error?: string }>,
  // 经验表导出（A/B/C 三表一个 Excel 文件）
  exportExp: (data: any) => ipcRenderer.invoke('export:exp', data) as Promise<{ ok: boolean; path?: string; error?: string }>,
  // 物价导出 / 导入（同表头 Excel）
  exportPrices: (rows: any[]) => ipcRenderer.invoke('prices:export', rows) as Promise<{ ok: boolean; path?: string; error?: string }>,
  importPrices: () => ipcRenderer.invoke('prices:import') as Promise<{ ok: boolean; rows?: any[]; error?: string }>,

  // 应用设置
  getSetting: (key: string) => ipcRenderer.invoke('setting:get', key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('setting:set', key, value),

  // 窗口管理密码保护
  authStatus: () => ipcRenderer.invoke('auth:status') as Promise<{ locked: boolean }>,
  authUnlock: (password: string) => ipcRenderer.invoke('auth:unlock', password) as Promise<{ ok: boolean }>,

  // 窗口管理（QQ三国）
  listGameWindows: () => ipcRenderer.invoke('window:list'),
  activateGameWindow: (handle: string, idx?: number) => ipcRenderer.invoke('window:activate', handle, idx),
  // 窗口预设
  winPresetList: () => ipcRenderer.invoke('win-preset:list') as Promise<WinPreset[]>,
  winPresetSet: (title: string, slot: number) =>
    ipcRenderer.invoke('win-preset:set', title, slot) as Promise<GameWindow[]>,
  winPresetDelete: (title: string) => ipcRenderer.invoke('win-preset:delete', title) as Promise<GameWindow[]>,

  // 每日活动链接
  listDailyLinks: () =>
    ipcRenderer.invoke('daily-link:list') as Promise<DailyLink[]>,
  addDailyLink: (params: { group_name: string; icon: string; name: string; desc: string; url: string }) =>
    ipcRenderer.invoke('daily-link:add', params) as Promise<{ ok: boolean; id: number }>,
  deleteDailyLink: (id: number) =>
    ipcRenderer.invoke('daily-link:delete', id) as Promise<{ ok: boolean; deleted: number }>,

  // 定时关机
  setShutdown: (hours: number) => ipcRenderer.invoke('shutdown:set', hours) as Promise<ShutdownResult>,
  cancelShutdown: () => ipcRenderer.invoke('shutdown:cancel') as Promise<{ ok: boolean }>,
  shutdownStatus: () => ipcRenderer.invoke('shutdown:status') as Promise<ShutdownStatus>,

  // 等级经验表
  getAllExp: () => ipcRenderer.invoke('exp-table:getAll') as Promise<ExpRow[]>,
  updateExp: (params: { level: number; field: string; value: string | number }) =>
    ipcRenderer.invoke('exp-table:update', params) as Promise<ExpRow>,
  addExpRow: () => ipcRenderer.invoke('exp-table:add') as Promise<ExpRow>,
  deleteExpRow: (level: number) => ipcRenderer.invoke('exp-table:delete', level) as Promise<{ ok: boolean }>,
  resetExp: () => ipcRenderer.invoke('exp-table:reset') as Promise<{ ok: boolean }>,

  // 怪物基础经验表
  getAllMonsterExp: () => ipcRenderer.invoke('monster-exp:getAll') as Promise<MonsterExpRow[]>,
  updateMonsterExp: (params: { id: number; field: string; value: string | number }) =>
    ipcRenderer.invoke('monster-exp:update', params) as Promise<MonsterExpRow>,
  addMonsterExpRow: (area?: string) => ipcRenderer.invoke('monster-exp:add', area) as Promise<MonsterExpRow>,
  duplicateMonsterExpRow: (id: number) => ipcRenderer.invoke('monster-exp:duplicate', id) as Promise<MonsterExpRow>,
  deleteMonsterExpRow: (id: number) => ipcRenderer.invoke('monster-exp:delete', id) as Promise<{ ok: boolean }>,
  resetMonsterExp: () => ipcRenderer.invoke('monster-exp:reset') as Promise<{ ok: boolean }>,

  // 答题题库
  getAllQuizQuestions: () => ipcRenderer.invoke('quiz:getAll') as Promise<QuizRow[]>,
  deleteQuizQuestion: (id: number) => ipcRenderer.invoke('quiz:delete', id) as Promise<{ ok: boolean }>,

  // OCR 引擎安装状态 / 下载
  ocrEngineStatus: () => ipcRenderer.invoke('ocr:engine-status') as Promise<{ installed: boolean; dir: string; giteeConfigured: boolean }>,
  downloadOcrEngine: () => ipcRenderer.invoke('ocr:engine-download') as Promise<{ ok: boolean; error?: string }>,
  onOcrEngineProgress: (cb: (p: { stage: 'downloading' | 'extracting'; received: number; total: number }) => void) => {
    const h = (_e: any, p: { stage: 'downloading' | 'extracting'; received: number; total: number }) => cb(p)
    ipcRenderer.on('ocr:engine-progress', h)
    return () => { ipcRenderer.removeListener('ocr:engine-progress', h) }
  },

  // 应用更新（Gitee Release）
  checkForUpdates: () => ipcRenderer.invoke('update:check') as Promise<UpdateInfo>,
  downloadUpdate: (asset: ReleaseAsset) =>
    ipcRenderer.invoke('update:download', asset) as Promise<{ ok: boolean; path?: string; error?: string }>,
  installUpdate: (installerPath: string) => ipcRenderer.invoke('update:install', installerPath) as Promise<{ ok: boolean }>,
  onUpdateProgress: (cb: (p: { received: number; total: number }) => void) => {
    const h = (_e: any, p: { received: number; total: number }) => cb(p)
    ipcRenderer.on('update:progress', h)
    return () => { ipcRenderer.removeListener('update:progress', h) }
  },
  onUpdateAvailable: (cb: (info: UpdateInfo) => void) => {
    const h = (_e: any, info: UpdateInfo) => cb(info)
    ipcRenderer.on('update:available', h)
    return () => { ipcRenderer.removeListener('update:available', h) }
  },

  // 快捷键切换通知（主进程已完成切换，仅通知UI更新）
  onSwitched: (cb: (payload: { idx: number; count: number }) => void) => {
    const h = (_e: any, payload: { idx: number; count: number }) => cb(payload)
    ipcRenderer.on('shortcut:switched', h)
    return () => { ipcRenderer.removeListener('shortcut:switched', h) }
  },

  // 窗口列表变化推送（主进程监视器检测到窗口开/关/隐藏时发送）
  onWindowsChanged: (cb: (list: GameWindow[]) => void) => {
    const h = (_e: any, list: GameWindow[]) => cb(list)
    ipcRenderer.on('windows:changed', h)
    return () => { ipcRenderer.removeListener('windows:changed', h) }
  },

  // 托盘指令（path → 路由跳转；cat → 攻略页分类；action → check-update/about）
  onTrayCommand: (cb: (cmd: TrayCommand) => void) => {
    const h = (_e: any, cmd: TrayCommand) => cb(cmd)
    ipcRenderer.on('tray:command', h)
    return () => { ipcRenderer.removeListener('tray:command', h) }
  },
})

export interface TrayCommand {
  path?: string
  cat?: string
  action?: 'check-update' | 'about'
}

// 类型声明
export interface ElectronAPI {
  authStatus: () => Promise<{ locked: boolean }>
  authUnlock: (password: string) => Promise<{ ok: boolean }>
  dbQuery: (sql: string, params?: unknown[]) => Promise<unknown>
  dbTransaction: (statements: { sql: string; params?: unknown[] }[]) => Promise<unknown[]>
  launchApp: (exePath: string) => Promise<{ ok: boolean; error?: string }>
  detectGamePath: (existingPath?: string) => Promise<string | null>
  selectGamePath: () => Promise<string | null>
  getAppVersion: () => Promise<string>
  openExternal: (url: string) => Promise<{ ok: boolean; error?: string }>
  scrapeOne: (serverName: string, force?: boolean) => Promise<{ price: number | null; needLogin?: boolean; error?: string }>
  scrapeRates: (force?: boolean) => Promise<{ updated: number; failed: number; currentPrice: number | null; needLogin?: boolean; ok?: boolean; error?: string }>
  currencyLogin: () => Promise<{ ok: boolean }>
  currencyLoginStatus: () => Promise<{ loggedIn: boolean; error?: string }>
  selectImage: () => Promise<string | null>
  saveImage: (itemName: string, sourcePath: string, priceId?: number) => Promise<{ ok: boolean; id?: number; path?: string; error?: string }>
  listImages: (itemName: string, priceId?: number) => Promise<Array<{ id: number; image_path: string; sort_order: number }>>
  getImagePath: (relativePath: string) => Promise<string>
  deleteImage: (id: number) => Promise<{ ok: boolean; error?: string }>
  readImage: (relativePath: string) => Promise<string | null>
  saveImageBuffer: (itemName: string, png: Uint8Array, priceId?: number) => Promise<{ ok: boolean; id?: number; path?: string; error?: string }>
  ocrRecognize: (input: { kind: 'buffer'; data: Uint8Array } | { kind: 'path'; path: string }) => Promise<{ text: string; qualityColor?: string; error?: string }>
  onOcrProgress: (cb: (p: { stage: 'startup' | 'download' | 'recognize'; percent: number }) => void) => () => void
  readClipboardImage: () => Promise<{ dataUrl: string; png: Uint8Array } | null>
  readClipboardText: () => Promise<string | null>
  exportScheme: (data: any) => Promise<{ ok: boolean; path?: string; error?: string }>
  exportExp: (data: any) => Promise<{ ok: boolean; path?: string; error?: string }>
  exportPrices: (rows: any[]) => Promise<{ ok: boolean; path?: string; error?: string }>
  importPrices: () => Promise<{ ok: boolean; rows?: any[]; error?: string }>
  scrapeClues: (serverName: string) => Promise<{
    added: number
    errors: string[]
    meta: { wall: boolean; wallMsg?: string; triedTieba: boolean; titles: string[]; pages: number; foundClues: number; diag: string[] }
  }>
  loadClues: (params: { serverName: string; source?: string; keyword?: string; limit?: number }) => Promise<ClueRecord[]>
  updateClueStatus: (id: number, status: string) => Promise<unknown>
  deleteClue: (id: number) => Promise<{ ok: boolean; deleted: number }>
  getTiebaMap: () => Promise<Record<string, string | null>>
  openWallVerify: (serverOrTiebaName: string) => Promise<{ ok: boolean }>
  setClueServer: (name: string) => Promise<void>
  clearClues: (serverName: string) => Promise<{ ok: boolean; deleted: number }>
  onClueProgress: (cb: (data: { source: string; done: number; total: number }) => void) => () => void
  onClueNew: (cb: (row: ClueRecord) => void) => () => void
  getSetting: (key: string) => Promise<string | null>
  setSetting: (key: string, value: string) => Promise<void>
  listGameWindows: () => Promise<GameWindow[]>
  activateGameWindow: (handle: string, idx?: number) => Promise<boolean>
  winPresetList: () => Promise<WinPreset[]>
  winPresetSet: (title: string, slot: number) => Promise<GameWindow[]>
  winPresetDelete: (title: string) => Promise<GameWindow[]>
  listDailyLinks: () => Promise<DailyLink[]>
  addDailyLink: (params: { group_name: string; icon: string; name: string; desc: string; url: string }) => Promise<{ ok: boolean; id: number }>
  deleteDailyLink: (id: number) => Promise<{ ok: boolean; deleted: number }>
  setShutdown: (hours: number) => Promise<ShutdownResult>
  cancelShutdown: () => Promise<{ ok: boolean }>
  shutdownStatus: () => Promise<ShutdownStatus>
  getAllExp: () => Promise<ExpRow[]>
  updateExp: (params: { level: number; field: string; value: string | number }) => Promise<ExpRow>
  addExpRow: () => Promise<ExpRow>
  deleteExpRow: (level: number) => Promise<{ ok: boolean }>
  resetExp: () => Promise<{ ok: boolean }>
  getAllMonsterExp: () => Promise<MonsterExpRow[]>
  updateMonsterExp: (params: { id: number; field: string; value: string | number }) => Promise<MonsterExpRow>
  addMonsterExpRow: (area?: string) => Promise<MonsterExpRow>
  duplicateMonsterExpRow: (id: number) => Promise<MonsterExpRow>
  deleteMonsterExpRow: (id: number) => Promise<{ ok: boolean }>
  resetMonsterExp: () => Promise<{ ok: boolean }>
  getAllQuizQuestions: () => Promise<QuizRow[]>
  deleteQuizQuestion: (id: number) => Promise<{ ok: boolean }>
  onSwitched: (cb: (payload: { idx: number; count: number }) => void) => () => void
  onWindowsChanged: (cb: (list: GameWindow[]) => void) => () => void
  ocrEngineStatus: () => Promise<{ installed: boolean; dir: string; giteeConfigured: boolean }>
  downloadOcrEngine: () => Promise<{ ok: boolean; error?: string }>
  onOcrEngineProgress: (cb: (p: { stage: 'downloading' | 'extracting'; received: number; total: number }) => void) => () => void
  checkForUpdates: () => Promise<UpdateInfo>
  downloadUpdate: (asset: ReleaseAsset) => Promise<{ ok: boolean; path?: string; error?: string }>
  installUpdate: (installerPath: string) => Promise<{ ok: boolean }>
  onUpdateProgress: (cb: (p: { received: number; total: number }) => void) => () => void
  onUpdateAvailable: (cb: (info: UpdateInfo) => void) => () => void
  onTrayCommand: (cb: (cmd: TrayCommand) => void) => () => void
}

interface DailyLink {
  id: number
  group_name: string
  icon: string
  name: string
  desc: string
  url: string
  sort_order: number
  created_at: string
}

interface ClueRecord {
  id: number
  server_name: string
  source: string
  keyword: string
  title: string
  content_preview: string
  url: string
  author_name: string
  price_text: string
  posted_at: string
  collected_at: string
  status: string
}

interface GameWindow {
  handle: string
  title: string
  pid: number
  processName: string
  visible: boolean
}

interface WinPreset {
  title: string
  slot: number
  label: string
}

interface ShutdownResult {
  ok: boolean
  error?: string
  hours?: number
  targetTime?: number
}

interface ShutdownStatus {
  active: boolean
  hours?: number
  remainingMs?: number
  targetTime?: number
}

interface ExpRow {
  level: number
  exp: number
  standard_unit_exp: number
  updated_at?: string
}

interface MonsterExpRow {
  id: number
  name: string
  area: string
  level: number
  base_exp: number
  fatigue: number
  quantity: number
  respawn_time: number
  multiplier: number
  sort_order: number
  updated_at?: string
}

interface ReleaseAsset {
  name: string
  browser_download_url: string
  size: number
}

interface UpdateInfo {
  hasUpdate: boolean
  version?: string
  tagName?: string
  notes?: string
  asset?: ReleaseAsset
  error?: string
}

interface QuizRow {
  id: number
  category: string
  question: string
  answer: string
  _q: string
  _a: string
  _qi: string
  _qp: string
  _ai: string
  _ap: string
  _search: string
  updated_at?: string
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
