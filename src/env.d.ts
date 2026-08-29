/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

interface ElectronAPI {
  dbQuery: (sql: string, params?: unknown[]) => Promise<unknown>
  dbTransaction: (statements: { sql: string; params?: unknown[] }[]) => Promise<unknown[]>
  launchApp: (exePath: string) => Promise<{ ok: boolean; error?: string }>
  detectGamePath: (existingPath?: string) => Promise<string | null>
  selectGamePath: () => Promise<string | null>
  getAppVersion: () => Promise<string>
  openExternal: (url: string) => Promise<{ ok: boolean; error?: string }>
  scrapeOne: (serverName: string, force?: boolean) => Promise<{ price: number | null }>
  scrapeRates: (force?: boolean) => Promise<{ updated: number; failed: number }>
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
  scrapeClues: (serverName: string) => Promise<{ added: number; errors: string[] }>
  loadClues: (params: { serverName: string; source?: string; keyword?: string; limit?: number }) => Promise<ClueRecord[]>
  updateClueStatus: (id: number, status: string) => Promise<unknown>
  deleteClue: (id: number) => Promise<{ ok: boolean; deleted: number }>
  setClueServer: (name: string) => Promise<void>
  clearClues: (serverName: string) => Promise<{ ok: boolean; deleted: number }>
  onClueProgress: (cb: (data: { source: string; done: number; total: number }) => void) => () => void
  getSetting: (key: string) => Promise<string | null>
  setSetting: (key: string, value: string) => Promise<void>
  listDailyLinks: () => Promise<DailyLink[]>
  addDailyLink: (params: { group_name: string; icon: string; name: string; desc: string; url: string }) => Promise<{ ok: boolean; id: number }>
  deleteDailyLink: (id: number) => Promise<{ ok: boolean; deleted: number }>
  listGameWindows: () => Promise<GameWindow[]>
  activateGameWindow: (handle: string, idx?: number) => Promise<boolean>
  winPresetList: () => Promise<WinPreset[]>
  winPresetSet: (title: string, slot: number) => Promise<GameWindow[]>
  winPresetDelete: (title: string) => Promise<GameWindow[]>
  authStatus: () => Promise<{ locked: boolean }>
  authUnlock: (password: string) => Promise<{ ok: boolean }>
  setShutdown: (hours: number) => Promise<ShutdownResult>
  cancelShutdown: () => Promise<{ ok: boolean }>
  shutdownStatus: () => Promise<ShutdownStatus>
  onSwitched: (cb: (payload: { idx: number; count: number }) => void) => () => void
  // 等级经验表
  getAllExp: () => Promise<ExpRow[]>
  updateExp: (params: { level: number; field: string; value: string | number }) => Promise<ExpRow>
  addExpRow: () => Promise<ExpRow>
  deleteExpRow: (level: number) => Promise<{ ok: boolean }>
  resetExp: () => Promise<{ ok: boolean }>
  // 怪物基础经验表
  getAllMonsterExp: () => Promise<MonsterExpRow[]>
  updateMonsterExp: (params: { id: number; field: string; value: string | number }) => Promise<MonsterExpRow>
  addMonsterExpRow: (area?: string) => Promise<MonsterExpRow>
  duplicateMonsterExpRow: (id: number) => Promise<MonsterExpRow>
  deleteMonsterExpRow: (id: number) => Promise<{ ok: boolean }>
  resetMonsterExp: () => Promise<{ ok: boolean }>
  // 答题题库
  getAllQuizQuestions: () => Promise<QuizRow[]>
  deleteQuizQuestion: (id: number) => Promise<{ ok: boolean }>
  // OCR 引擎安装状态 / 下载
  ocrEngineStatus: () => Promise<{ installed: boolean; dir: string; giteeConfigured: boolean }>
  downloadOcrEngine: () => Promise<{ ok: boolean; error?: string }>
  onOcrEngineProgress: (cb: (p: { stage: 'downloading' | 'extracting'; received: number; total: number }) => void) => () => void
  // 应用更新（Gitee Release）
  checkForUpdates: () => Promise<UpdateInfo>
  downloadUpdate: (asset: ReleaseAsset) => Promise<{ ok: boolean; path?: string; error?: string }>
  installUpdate: (installerPath: string) => Promise<{ ok: boolean }>
  onUpdateProgress: (cb: (p: { received: number; total: number }) => void) => () => void
  onUpdateAvailable: (cb: (info: UpdateInfo) => void) => () => void
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

interface BossRow {
  id: number
  sort_order: number
  name: string
  speed: number
  hp: number
  force: number
  intelligence: number
  constitution: number
  accuracy: number
  agility: number
  phys_atk: number
  phys_def: number
  magic_atk: number
  magic_def: number
  exp: number
  level: number
  fervor: number
  charm_poly: number
  guard: number
  immortal: number
  bold_fields: string
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

interface Window {
  electronAPI: ElectronAPI
}
