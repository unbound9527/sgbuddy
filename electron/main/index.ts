import { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, Menu, nativeImage, shell, Tray } from 'electron'
import { exec } from 'child_process'
import { existsSync, mkdirSync, copyFileSync, unlinkSync, readFileSync, writeFileSync } from 'fs'
import { startCurrencyScheduler, scrapeAllRates, scrapeOneServer, setPriorityServer, openTaobaoLogin, isTaobaoLoggedIn } from '../services/currency-scraper'
import { scrapeAll, startClueScheduler, stopClueScheduler, setClueServer, deleteClueSoft, TIEBA_MAP, openWallVerifyWindow } from '../services/clue-scraper'
import { listGameWindows, activateWindow, refreshAndGet, getCachedWindows, applyPresetOrder, switchBySlot, startWindowWatcher, stopWindowWatcher } from '../services/window-manager'
import type { WinPreset } from '../services/window-manager'
import { join } from 'path'
import { initDatabase, getDatabase } from '../database'
import { EXP_TABLE_DEFAULTS } from '../database/exp-defaults'
import { MONSTER_EXP_DEFAULTS } from '../database/monster-exp-defaults'
import { isUnlocked, unlock } from '../services/auth'
import { generateExcel, type SchemeExportData } from '../services/export-scheme'
import { generateExpExcel, type ExpExportData } from '../services/export-exp'
import ExcelJS from 'exceljs'
import { type OcrInput, createOcrService } from '../services/ocr'
import { createUmiOcrService } from '../services/umi-ocr'
import { analyzeNameQuality } from '../services/quality-color'
import {
  GITEE_OWNER,
  GITEE_REPO,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  downloadOcrEngine,
  isOcrEngineInstalled,
  getOcrEngineDir,
  getOcrEngineExePath,
  type ReleaseAsset,
} from '../services/updater'

// Windows 终端 UTF-8 编码，确保中文日志正常显示
if (process.platform === 'win32') {
  try { require('child_process').execSync('chcp 65001 >nul 2>&1', { stdio: 'ignore' }) } catch { /* ignore */ }
}

// 开发调试：SGBUDDY_DEBUG_PORT=9222 时开放 CDP 端口，配合 scripts/dev-nav.mjs 使用
if (process.env.SGBUDDY_DEBUG_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', process.env.SGBUDDY_DEBUG_PORT)
}

let mainWindow: BrowserWindow | null = null
// 托盘
let tray: Tray | null = null
// true 表示正处于退出流程（app.quit() 已触发）：放行窗口关闭；false 时点 × 会触发退出
let quitting = false
// OCR 高精度引擎：PaddleOCR-json（下载安装到 userData/ocr-engine，或开发模式本机 resources/umi-ocr）
let umiOcr: ReturnType<typeof createUmiOcrService> | null = null
// OCR 降级引擎：Tesseract（内置语言包，离线可用）
let tessOcr: ReturnType<typeof createOcrService> | null = null

/** 解析 PaddleOCR 引擎目录：优先下载安装的（userData/ocr-engine），其次内置/开发资源 */
function getUmiEngineDir(): string | null {
  if (isOcrEngineInstalled()) return getOcrEngineDir()
  if (app.isPackaged) {
    const p = join(process.resourcesPath, 'umi-ocr', 'UmiOCR-data', 'plugins', 'win7_x64_PaddleOCR-json')
    return existsSync(p) ? p : null
  }
  const dev = join(__dirname, '..', '..', 'resources', 'umi-ocr', 'UmiOCR-data', 'plugins', 'win7_x64_PaddleOCR-json')
  return existsSync(dev) ? dev : null
}

/** Tesseract 降级引擎（懒创建；语言包：内置复制优先，缺失才在线下载） */
function getTesseractOcr() {
  if (!tessOcr) {
    tessOcr = createOcrService({
      langDir: join(app.getPath('userData'), 'tessdata'),
      bundleDir: app.isPackaged ? join(process.resourcesPath, 'ocr') : join(__dirname, '..', '..', 'resources'),
      onProgress: (p) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ocr:progress', { stage: p.stage, percent: p.percent })
        }
      },
    })
  }
  return tessOcr
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'SG Buddy — QQ三国助手',
    icon: getWindowIconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // 加载渲染进程
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 外部链接（如交易线索的贴吧帖子）一律交给系统默认浏览器，不在应用内开子窗口
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url).catch(() => {})
    }
    return { action: 'deny' }
  })
  // 阻止页面内导航离开应用（file:// 下误点相对链接会白屏）
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://') && !url.startsWith(process.env.ELECTRON_RENDERER_URL ?? 'app://')) {
      e.preventDefault()
      if (/^https?:\/\//i.test(url)) shell.openExternal(url).catch(() => {})
    }
  })

  // 点右上角 × / Alt+F4：退出整个程序（不再驻留托盘）。
  // 真正隐藏到托盘只由 Ctrl+Q 触发（hide() 不会走 close 事件）。
  mainWindow.on('close', () => {
    if (!quitting) {
      // 触发真正的退出流程；before-quit 会把 quitting 置 true，
      // 随后重入本 close 时放行窗口销毁。
      app.quit()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

/** 应用窗口图标：打包后在 resourcesPath，开发时在项目 resources/ */
function getAppIconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '..', '..', 'resources', 'icon.png')
}

/**
 * 窗口/任务栏图标（区别于托盘 png）：
 * Windows 上 BrowserWindow 的 icon 需用 .ico 才能真正显示到窗口标题栏与任务栏，
 * png 在 Windows 端经常被忽略 → 退回 exe 默认 Electron 图标。其余平台继续用 png。
 */
function getWindowIconPath(): string {
  const base = app.isPackaged ? process.resourcesPath : join(__dirname, '..', '..', 'resources')
  return process.platform === 'win32'
    ? join(base, 'icon.ico')
    : join(base, 'icon.png')
}

/** 显示并聚焦主窗口（窗口已销毁时重建） */
function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

/**
 * 显示主窗口并发送托盘指令。
 * payload.path    → 渲染层路由跳转；payload.cat → 攻略页分类（quiz 答题题库 / activity 活跃计算）
 * payload.action  → check-update 检查更新 / about 关于弹窗
 * 窗口加载中时延迟到加载完成再发送，避免事件丢失。
 */
function openMainWindow(payload: { path?: string; cat?: string; action?: 'check-update' | 'about' }): void {
  showMainWindow()
  const win = mainWindow
  if (!win || win.isDestroyed()) return
  const send = () => {
    if (!win.isDestroyed()) win.webContents.send('tray:command', payload)
  }
  if (win.webContents.isLoading()) win.webContents.once('did-finish-load', send)
  else send()
}

function createTray(): void {
  const icon = nativeImage.createFromPath(getAppIconPath())
  tray = new Tray(icon.isEmpty() ? getAppIconPath() : icon)
  tray.setToolTip('SG Buddy — QQ三国助手')
  // 左键单击显示主界面
  tray.on('click', () => showMainWindow())
  // 右键菜单：从上到下依次为 打开主界面/窗口管理/答题题库/活跃计算/检查更新/关于/退出
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开主界面', click: () => showMainWindow() },
    { label: '窗口管理', click: () => openMainWindow({ path: '/growth' }) },
    { label: '答题题库', click: () => openMainWindow({ path: '/guides', cat: 'quiz' }) },
    { label: '活跃计算', click: () => openMainWindow({ path: '/guides', cat: 'activity' }) },
    { label: '检查更新', click: () => openMainWindow({ action: 'check-update' }) },
    { label: '关于SG Buddy', click: () => openMainWindow({ action: 'about' }) },
    {
      label: '退出',
      click: () => app.quit(),
    },
  ]))
}

// 注册 IPC 处理
function registerIpcHandlers(): void {
  const db = getDatabase()

  ipcMain.handle('db:query', (_event, sql: string, params?: unknown[]) => {
    const startTime = Date.now()
    const isSelect = sql.trim().toUpperCase().startsWith('SELECT')
    // 写操作打印完整 SQL + 参数
    if (!isSelect) {
      console.log('[DB:QUERY] %s | params=%s', sql.trim().slice(0, 200), JSON.stringify(params))
    }
    try {
      let result: any
      if (isSelect) {
        result = db.prepare(sql).all(...(params ?? []))
        if (Array.isArray(result)) {
          console.log('[DB:QUERY] SELECT 返回 %s 行 (%dms)', result.length, Date.now() - startTime)
        }
      } else {
        result = db.prepare(sql).run(...(params ?? []))
        console.log('[DB:QUERY] 写入完成 changes=%s lastInsertRowid=%s (%dms)',
          (result as any)?.changes, (result as any)?.lastInsertRowid, Date.now() - startTime)
      }
      return result
    } catch (e: any) {
      console.error('[DB:QUERY] ❌ 错误:', e.message, '| SQL:', sql.trim().slice(0, 200))
      throw e
    }
  })

  ipcMain.handle('db:transaction', (_event, statements: { sql: string; params?: unknown[] }[]) => {
    const runMany = db.transaction(() => {
      const results: unknown[] = []
      for (const stmt of statements) {
        results.push(db.prepare(stmt.sql).run(...(stmt.params ?? [])))
      }
      return results
    })
    return runMany()
  })

  ipcMain.handle('app:launch', async (_event, exePath: string) => {
    try {
      await shell.openPath(exePath)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle('app:detect-game-path', async (_event, existingPath?: string) => {
    if (!existingPath) return null
    try {
      return existsSync(existingPath) ? existingPath : null
    } catch { return null }
  })

  ipcMain.handle('app:version', async () => app.getVersion())

  // 用系统默认浏览器打开外部链接（仅允许 http/https，防止任意协议注入）
  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    if (/^https?:\/\//.test(url)) {
      await shell.openExternal(url)
      return { ok: true }
    }
    return { ok: false, error: '仅支持 http/https 链接' }
  })

  ipcMain.handle('app:select-game-path', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '选择 QQ三国 启动程序',
      filters: [
        { name: 'QQ三国启动程序', extensions: ['exe'] },
        { name: '所有文件', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('app:scrape-one', async (_event, serverName: string, force?: boolean) => {
    try {
      const { rate, needLogin } = await scrapeOneServer(serverName, !!force)
      return { price: rate, needLogin }
    } catch (e) {
      return { price: null, needLogin: false, error: String(e) }
    }
  })

  ipcMain.handle('app:scrape-rates', async (_event, force?: boolean) => {
    try {
      const result = await scrapeAllRates(!!force)
      return { ...result, ok: true }
    } catch (e) {
      return { updated: 0, failed: 23, currentPrice: null, needLogin: false, ok: false, error: String(e) }
    }
  })

  // 打开淘宝登录窗口；关闭后检查登录态并返回
  ipcMain.handle('currency:login', async () => {
    openTaobaoLogin()
    return { ok: true }
  })

  ipcMain.handle('currency:login-status', async () => {
    try {
      return { loggedIn: await isTaobaoLoggedIn() }
    } catch (e) {
      return { loggedIn: false, error: String(e) }
    }
  })


  // ── 交易线索 ──

  ipcMain.handle('clue:scrape', async (_event, serverName: string) => {
    try {
      const win = mainWindow
      const result = await scrapeAll(
        serverName,
        (source, done, total) => {
          if (win && !win.isDestroyed()) {
            win.webContents.send('clue:progress', { source, done, total })
          }
        },
        // 手动刷新时逐条推送新线索：前端收到即上屏（clue:new），无需等全部抓完
        (row) => {
          if (win && !win.isDestroyed()) {
            win.webContents.send('clue:new', row)
          }
        }
      )
      return result
    } catch (e: any) {
      return { added: 0, errors: [e.message], meta: { wall: false, triedTieba: true, titles: [], pages: 0, foundClues: 0, diag: [] } }
    }
  })

  ipcMain.handle('clue:load', (_event, params: {
    serverName: string; source?: string; keyword?: string; limit?: number
  }) => {
    const db = getDatabase()
    let sql = 'SELECT * FROM trade_clues WHERE server_name = ? AND deleted_at IS NULL'
    const sqlParams: unknown[] = [params.serverName]

    if (params.source) {
      sql += ' AND source = ?'
      sqlParams.push(params.source)
    }
    if (params.keyword) {
      sql += ' AND keyword = ?'
      sqlParams.push(params.keyword)
    }
    sql += ' ORDER BY collected_at DESC'
    if (params.limit) {
      sql += ' LIMIT ?'
      sqlParams.push(params.limit)
    }
    return db.prepare(sql).all(...sqlParams)
  })

  ipcMain.handle('clue:update-status', (_event, id: number, status: string) => {
    const db = getDatabase()
    return db.prepare('UPDATE trade_clues SET status = ? WHERE id = ?').run(status, id)
  })

  // 删除单条 → 软删除（墓碑）：load 不可见，下次抓取因 url 唯一键不会复活
  ipcMain.handle('clue:delete', (_event, id: number) => {
    return deleteClueSoft(id)
  })

  // 区服-贴吧映射单一数据源：前端读取主进程同一份 TIEBA_MAP（避免两处硬编码不一致）
  ipcMain.handle('clue:tieba-map', () => {
    return TIEBA_MAP
  })

  // 被反爬拦截时：弹出可见窗口让用户手动过一次「百度安全验证」
  // 传 serverName（如「得陇望蜀」）或直接传贴吧名；cookie 走默认 session，与抓取共享且持久化
  ipcMain.handle('clue:open-wall', (_event, serverOrTiebaName: string) => {
    const tiebaName = TIEBA_MAP[serverOrTiebaName] || serverOrTiebaName
    openWallVerifyWindow(tiebaName)
    return { ok: true }
  })

  ipcMain.handle('clue:set-server', (_event, name: string) => {
    setClueServer(name)
    setPriorityServer(name)
  })

  ipcMain.handle('clue:clear', async (_event, serverName: string) => {
    const db = getDatabase()
    const r = db.prepare('DELETE FROM trade_clues WHERE server_name = ?').run(serverName)
    return { ok: true, deleted: r.changes }
  })

  // ── 定时关机（Windows 系统级，即使应用退出也生效）───

  let shutdownTargetTime: number = 0   // 计划关机的时间戳 (ms)
  let shutdownHours: number = 0

  ipcMain.handle('shutdown:set', async (_event, hours: number) => {
    if (process.platform !== 'win32') return { ok: false, error: '仅支持 Windows 系统' }

    // 先取消已有的（无论本应用还是系统级的）
    exec('shutdown /a', () => { /* 忽略 */ })

    const seconds = hours * 3600
    exec(`shutdown /s /t ${seconds}`, (err) => {
      if (err) {
        console.error('[定时关机] 系统关机命令失败:', err.message)
        shutdownTargetTime = 0
        return
      }
      console.log(`[定时关机] 已提交系统关机计划，${hours} 小时后执行`)
    })

    shutdownTargetTime = Date.now() + seconds * 1000
    shutdownHours = hours
    console.log(`[定时关机] 预计关机时间: ${new Date(shutdownTargetTime).toLocaleString()}`)
    return { ok: true, hours, targetTime: shutdownTargetTime }
  })

  ipcMain.handle('shutdown:cancel', async () => {
    shutdownTargetTime = 0
    shutdownHours = 0
    exec('shutdown /a', (err) => {
      if (err) console.error('[定时关机] 取消失败:', err.message)
      else console.log('[定时关机] 已取消系统关机计划')
    })
    return { ok: true }
  })

  ipcMain.handle('shutdown:status', async () => {
    if (shutdownTargetTime === 0) return { active: false }
    const remainingMs = Math.max(0, shutdownTargetTime - Date.now())
    // 如果剩余时间 ≤ 0，说明已过期（可能已关机或取消），重置状态
    if (remainingMs <= 0) {
      shutdownTargetTime = 0
      return { active: false }
    }
    return {
      active: true,
      hours: shutdownHours,
      remainingMs,
      targetTime: shutdownTargetTime,
    }
  })

  // ── 每日活动链接 ──

  ipcMain.handle('daily-link:list', async () => {
    const db = getDatabase()
    return db.prepare(
      'SELECT id, group_name, icon, name, desc, url, sort_order, created_at FROM daily_links ORDER BY group_name, sort_order'
    ).all()
  })

  ipcMain.handle('daily-link:add', async (_event, params: {
    group_name: string; icon: string; name: string; desc: string; url: string
  }) => {
    const db = getDatabase()
    const r = db.prepare(
      'INSERT INTO daily_links (group_name, icon, name, desc, url, sort_order) VALUES (?, ?, ?, ?, ?, 0)'
    ).run(params.group_name, params.icon, params.name, params.desc, params.url)
    return { ok: true, id: Number(r.lastInsertRowid) }
  })

  ipcMain.handle('daily-link:delete', async (_event, id: number) => {
    const db = getDatabase()
    const r = db.prepare('DELETE FROM daily_links WHERE id = ?').run(id)
    return { ok: true, deleted: r.changes }
  })

  // ── 窗口管理密码保护 ──

  ipcMain.handle('auth:status', async () => {
    return { locked: !isUnlocked() }
  })

  ipcMain.handle('auth:unlock', async (_event, password: string) => {
    const ok = unlock(password)
    return { ok }
  })

  // ── 窗口管理（QQ三国窗口枚举与切换） ──

  ipcMain.handle('window:list', async () => {
    if (!isUnlocked()) return { locked: true }
    const windows = await listGameWindows()
    // 加载预设并按 slot 排序
    const rows = db.prepare('SELECT title, slot, label FROM win_presets ORDER BY slot').all() as WinPreset[]
    if (rows.length > 0) applyPresetOrder(rows)
    return getCachedWindows()
  })

  ipcMain.handle('window:activate', async (_event, handle: string, idx?: number) => {
    if (!isUnlocked()) return false
    if (idx !== undefined && idx >= 0) {
      activeWinIdx = idx
    }
    return await activateWindow(handle)
  })

  // ── 窗口预设（编号/顺序） ──

  ipcMain.handle('win-preset:list', async () => {
    if (!isUnlocked()) return []
    return db.prepare('SELECT title, slot FROM win_presets ORDER BY slot').all()
  })

  ipcMain.handle('win-preset:set', async (_event, title: string, slot: number) => {
    if (!isUnlocked()) return null
    // 若分配 slot>0，先清除同一 slot 的其他窗口（确保 slot 唯一）
    if (slot > 0) db.prepare("UPDATE win_presets SET slot = 0 WHERE slot = ? AND title != ?").run(slot, title)
    db.prepare('INSERT OR REPLACE INTO win_presets (title, slot) VALUES (?, ?)').run(title, slot)
    // 即时更新缓存排序
    const rows = db.prepare('SELECT title, slot FROM win_presets ORDER BY slot').all() as WinPreset[]
    if (rows.length > 0) applyPresetOrder(rows)
    return getCachedWindows()
  })

  ipcMain.handle('win-preset:delete', async (_event, title: string) => {
    if (!isUnlocked()) return null
    db.prepare('DELETE FROM win_presets WHERE title = ?').run(title)
    const rows = db.prepare('SELECT title, slot FROM win_presets ORDER BY slot').all() as WinPreset[]
    if (rows.length > 0) applyPresetOrder(rows)
    return getCachedWindows()
  })

  // ── 装备图片 ──
  const imagesDir = join(app.getPath('userData'), 'images')

  ipcMain.handle('image:select', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '选择装备图片',
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      properties: ['openFile'],
    })
    return result.canceled ? null : result.filePaths[0] || null
  })

  ipcMain.handle('image:save', async (_event, itemName: string, sourcePath: string, priceId?: number) => {
    try {
      if (!existsSync(imagesDir)) mkdirSync(imagesDir, { recursive: true })
      const db = getDatabase()
      // 每个物品只能有唯一一张图片：先删除已有图片再插入新图
      if (priceId) {
        const existing = db.prepare('SELECT image_path FROM equipment_images WHERE price_id=?').all(priceId) as Array<{ image_path: string }>
        for (const row of existing) {
          const oldPath = join(imagesDir, row.image_path.replace('images/', ''))
          try { if (existsSync(oldPath)) unlinkSync(oldPath) } catch {}
        }
        db.prepare('DELETE FROM equipment_images WHERE price_id=?').run(priceId)
      } else {
        const existing = db.prepare('SELECT image_path FROM equipment_images WHERE item_name=? AND price_id IS NULL').all(itemName) as Array<{ image_path: string }>
        for (const row of existing) {
          const oldPath = join(imagesDir, row.image_path.replace('images/', ''))
          try { if (existsSync(oldPath)) unlinkSync(oldPath) } catch {}
        }
        db.prepare('DELETE FROM equipment_images WHERE item_name=? AND price_id IS NULL').run(itemName)
      }
      const ext = sourcePath.split('.').pop() || 'png'
      const filename = `${itemName.replace(/[\\/:*?"<>|]/g, '_')}_${Date.now()}.${ext}`
      const destPath = join(imagesDir, filename)
      copyFileSync(sourcePath, destPath)
      const result = priceId
        ? db.prepare('INSERT INTO equipment_images (item_name, image_path, price_id, sort_order) VALUES (?,?,?,0)').run(itemName, `images/${filename}`, priceId)
        : db.prepare('INSERT INTO equipment_images (item_name, image_path, sort_order) VALUES (?,?,0)').run(itemName, `images/${filename}`)
      return { ok: true, id: result.lastInsertRowid as number, path: `images/${filename}` }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  })

  ipcMain.handle('image:list', (_event, itemName: string, priceId?: number) => {
    const db = getDatabase()
    if (priceId) {
      return db.prepare(
        'SELECT id, image_path, sort_order FROM equipment_images WHERE price_id=? ORDER BY sort_order'
      ).all(priceId) as Array<{ id: number; image_path: string; sort_order: number }>
    }
    return db.prepare(
      'SELECT id, image_path, sort_order FROM equipment_images WHERE item_name=? ORDER BY sort_order'
    ).all(itemName) as Array<{ id: number; image_path: string; sort_order: number }>
  })

  ipcMain.handle('image:get-path', (_event, relativePath: string) => {
    return join(imagesDir, relativePath.replace('images/', ''))
  })

  ipcMain.handle('image:read', (_event, filePath: string) => {
    try {
      let fullPath: string
      if (filePath.startsWith('images/')) {
        fullPath = join(imagesDir, filePath.replace('images/', ''))
      } else if (filePath.match(/^[A-Za-z]:[\\/]/) || filePath.startsWith('/')) {
        fullPath = filePath  // absolute path
      } else {
        fullPath = join(imagesDir, filePath)
      }
      if (!existsSync(fullPath)) return null
      const buf = readFileSync(fullPath)
      const ext = fullPath.split('.').pop()?.toLowerCase() || 'png'
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png'
      return `data:${mime};base64,${buf.toString('base64')}`
    } catch { return null }
  })

  ipcMain.handle('image:delete', (_event, id: number) => {
    try {
      const db = getDatabase()
      const row = db.prepare('SELECT image_path FROM equipment_images WHERE id=?').get(id) as { image_path: string } | undefined
      if (row) {
        const fullPath = join(imagesDir, row.image_path.replace('images/', ''))
        try { unlinkSync(fullPath) } catch { /* file may not exist */ }
        db.prepare('DELETE FROM equipment_images WHERE id=?').run(id)
      }
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  })

  // ── OCR 图片识别 ──
  // 主引擎：PaddleOCR-json（下载安装或本机开发资源，无窗口离线）；tesseract 作为降级
  const getUmiOcr = () => {
    const engineDir = getUmiEngineDir()
    if (!engineDir) return null
    if (!umiOcr) {
      umiOcr = createUmiOcrService({
        exePath: join(engineDir, 'PaddleOCR-json.exe'),
        cwd: engineDir,
        onStatus: (s) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            // startup: 引擎启动中；ready: 引擎就绪但识别尚未开始 → 0% 而非 100%，避免"卡在 100%"假象
            mainWindow.webContents.send('ocr:progress', {
              stage: s.stage === 'startup' ? 'startup' : 'recognize',
              percent: s.stage === 'startup' ? 100 : 0,
            })
          }
        },
      })
    }
    return umiOcr
  }

  ipcMain.handle('ocr:recognize', async (_event, input: OcrInput) => {
    try {
      // 相对 images/ 的路径解析到 imagesDir（渲染层传的是 listImages 返回的 image_path）
      const resolved: OcrInput = input.kind === 'path' && input.path.startsWith('images/')
        ? { kind: 'path', path: join(imagesDir, input.path.replace('images/', '')) }
        : input
      const data = resolved.kind === 'path' ? readFileSync(resolved.path) : Buffer.from(resolved.data)
      const paddle = getUmiOcr()
      if (paddle) {
        const result = await paddle.recognize(data)
        // 品质颜色：分析名称行文字颜色
        let qualityColor = ''
        if (result.nameRow) {
          try { qualityColor = analyzeNameQuality(data, result.nameRow.box) } catch { /* 颜色分析失败不影响识别 */ }
        }
        return { text: result.text, qualityColor, engine: 'paddle' }
      }
      // 降级：Tesseract（识别率一般，但离线可用）
      const text = await getTesseractOcr().recognize(resolved)
      return { text, engine: 'tesseract' }
    } catch (e: any) {
      return { text: '', error: e?.message || '识别失败' }
    }
  })

  // ── OCR 引擎安装状态 / 下载 ──

  ipcMain.handle('ocr:engine-status', async () => ({
    installed: isOcrEngineInstalled(),
    dir: getOcrEngineDir(),
    giteeConfigured: !!(GITEE_OWNER && GITEE_REPO),
  }))

  ipcMain.handle('ocr:engine-download', async () => {
    try {
      await downloadOcrEngine((p) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ocr:engine-progress', p)
      })
      // 引擎已更换，销毁旧实例，下次识别重建
      umiOcr?.dispose()
      umiOcr = null
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e?.message || '引擎下载失败' }
    }
  })

  // ── 应用更新（Gitee Release） ──

  ipcMain.handle('update:check', async () => checkForUpdates())

  ipcMain.handle('update:download', async (_event, asset: ReleaseAsset) => {
    try {
      const path = await downloadUpdate(asset, (p) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update:progress', p)
      })
      return { ok: true, path }
    } catch (e: any) {
      return { ok: false, error: e?.message || '更新包下载失败' }
    }
  })

  ipcMain.handle('update:install', async (_event, installerPath: string) => {
    installUpdate(installerPath)
    return { ok: true }
  })

  ipcMain.handle('clipboard:read-image', () => {
    const img = clipboard.readImage()
    if (img.isEmpty()) return null
    const png = img.toPNG()
    return { dataUrl: `data:image/png;base64,${png.toString('base64')}`, png }
  })

  ipcMain.handle('clipboard:read-text', () => {
    return clipboard.readText() || null
  })

  ipcMain.handle('image:save-buffer', async (_event, itemName: string, png: Uint8Array, priceId?: number) => {
    try {
      if (!existsSync(imagesDir)) mkdirSync(imagesDir, { recursive: true })
      const db = getDatabase()
      // 每个物品只能有唯一一张图片：先删除已有图片再插入新图
      if (priceId) {
        const existing = db.prepare('SELECT image_path FROM equipment_images WHERE price_id=?').all(priceId) as Array<{ image_path: string }>
        for (const row of existing) {
          const oldPath = join(imagesDir, row.image_path.replace('images/', ''))
          try { if (existsSync(oldPath)) unlinkSync(oldPath) } catch {}
        }
        db.prepare('DELETE FROM equipment_images WHERE price_id=?').run(priceId)
      } else {
        const existing = db.prepare('SELECT image_path FROM equipment_images WHERE item_name=? AND price_id IS NULL').all(itemName) as Array<{ image_path: string }>
        for (const row of existing) {
          const oldPath = join(imagesDir, row.image_path.replace('images/', ''))
          try { if (existsSync(oldPath)) unlinkSync(oldPath) } catch {}
        }
        db.prepare('DELETE FROM equipment_images WHERE item_name=? AND price_id IS NULL').run(itemName)
      }
      const filename = `${itemName.replace(/[\\/:*?"<>|]/g, '_')}_${Date.now()}.png`
      const destPath = join(imagesDir, filename)
      writeFileSync(destPath, Buffer.from(png))
      const result = priceId
        ? db.prepare('INSERT INTO equipment_images (item_name, image_path, price_id, sort_order) VALUES (?,?,?,0)').run(itemName, `images/${filename}`, priceId)
        : db.prepare('INSERT INTO equipment_images (item_name, image_path, sort_order) VALUES (?,?,0)').run(itemName, `images/${filename}`)
      return { ok: true, id: result.lastInsertRowid as number, path: `images/${filename}` }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  })

  // ── 方案导出 Excel ──
  ipcMain.handle('export:scheme', async (_event, data: SchemeExportData) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow!, {
        title: '导出配装方案',
        defaultPath: `${data.name || '配装方案'}.xlsx`,
        filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }],
      })
      if (result.canceled || !result.filePath) return { ok: false, error: '已取消' }
      await generateExcel(data, result.filePath)
      shell.showItemInFolder(result.filePath)
      return { ok: true, path: result.filePath }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  })

  // ── 经验表导出 Excel（A 怪物经验表 / B 最优打怪组合 / C 等级经验表，三表一个文件） ──
  ipcMain.handle('export:exp', async (_event, data: ExpExportData) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow!, {
        title: '导出经验表',
        defaultPath: '经验表.xlsx',
        filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }],
      })
      if (result.canceled || !result.filePath) return { ok: false, error: '已取消' }
      await generateExpExcel(data, result.filePath)
      shell.showItemInFolder(result.filePath)
      return { ok: true, path: result.filePath }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  })

  // ── 物价导出 / 导入 Excel（表头：物品名称 | 分类 | 品质 | 备注 | 成本价(万) | 市场价(万) | 热门） ──
  const PRICE_HEADERS = ['物品名称', '分类', '品质', '备注', '成本价(万)', '市场价(万)', '热门']
  ipcMain.handle('prices:export', async (_event, rows: Array<{
    item_name: string; category?: string; quality?: string; attr_notes?: string
    benchmark_wan?: number; market_wan?: number; hot?: boolean
  }>) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow!, {
        title: '导出物价数据',
        defaultPath: '物价图鉴.xlsx',
        filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }],
      })
      if (result.canceled || !result.filePath) return { ok: false, error: '已取消' }
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('物价')
      ws.addRow(PRICE_HEADERS)
      ws.getRow(1).font = { bold: true }
      for (const r of rows) {
        ws.addRow([
          r.item_name, r.category || '', r.quality || '', r.attr_notes || '',
          r.benchmark_wan ?? 0, r.market_wan ?? 0, r.hot ? '是' : '',
        ])
      }
      ws.columns.forEach(col => { col.width = 14 })
      ws.getColumn(1).width = 22
      ws.getColumn(4).width = 26
      await wb.xlsx.writeFile(result.filePath)
      shell.showItemInFolder(result.filePath)
      return { ok: true, path: result.filePath }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  })

  ipcMain.handle('prices:import', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow!, {
        title: '导入物价数据',
        filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }],
        properties: ['openFile'],
      })
      if (result.canceled || !result.filePaths[0]) return { ok: false, error: '已取消' }
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.readFile(result.filePaths[0])
      const ws = wb.worksheets[0]
      if (!ws) return { ok: false, error: '文件中没有工作表' }

      // 校验表头（允许顺序一致；至少要求包含「物品名称」与「市场价(万)」）
      const headerRow = ws.getRow(1)
      const headers: string[] = []
      headerRow.eachCell((cell, col) => { headers[col] = String(cell.value ?? '').trim() })
      const nameCol = headers.indexOf('物品名称')
      const marketCol = headers.indexOf('市场价(万)')
      if (nameCol < 0 || marketCol < 0) {
        return { ok: false, error: `表头不匹配：需要包含「物品名称」和「市场价(万)」，实际为：${headers.filter(Boolean).join(' | ')}` }
      }
      const colOf = (name: string) => headers.indexOf(name)

      const rows: Array<{
        item_name: string; category: string; quality: string; attr_notes: string
        benchmark_wan: number; market_wan: number; hot: boolean
      }> = []
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return
        const get = (name: string) => {
          const col = colOf(name)
          return col > 0 ? row.getCell(col).value : null
        }
        const text = (name: string) => {
          const v = get(name)
          if (v == null) return ''
          if (typeof v === 'object' && 'text' in (v as object)) return String((v as { text: unknown }).text ?? '').trim()
          return String(v).trim()
        }
        const num = (name: string) => {
          const v = get(name)
          const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
          return isNaN(n) ? 0 : n
        }
        const item_name = text('物品名称')
        if (!item_name) return
        rows.push({
          item_name,
          category: text('分类'),
          quality: text('品质'),
          attr_notes: text('备注'),
          benchmark_wan: num('成本价(万)'),
          market_wan: num('市场价(万)'),
          hot: text('热门') === '是' || text('热门') === '1',
        })
      })
      return { ok: true, rows }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  })

  // ── 应用设置（DB替代localStorage） ──
  ipcMain.handle('setting:get', (_event, key: string) => {
    const db = getDatabase()
    const row = db.prepare('SELECT value FROM app_settings WHERE key=?').get(key) as { value: string } | undefined
    return row?.value || null
  })
  ipcMain.handle('setting:set', (_event, key: string, value: string) => {
    const db = getDatabase()
    db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?,?)').run(key, value)
  })

  // ── 等级经验表 ──

  ipcMain.handle('exp-table:getAll', async () => {
    const db = getDatabase()
    return db.prepare('SELECT * FROM level_exp ORDER BY level').all()
  })

  ipcMain.handle('exp-table:update', async (_event, params: { level: number; field: string; value: string | number }) => {
    const db = getDatabase()
    const allowedFields = ['exp', 'standard_unit_exp']
    if (!allowedFields.includes(params.field)) {
      throw new Error(`不允许的字段: ${params.field}`)
    }
    const num = Number(params.value)
    if (!Number.isInteger(num) || num < 0) {
      throw new Error(`${params.field} 必须是非负整数`)
    }
    db.prepare(`UPDATE level_exp SET ${params.field} = ?, updated_at = datetime('now','localtime') WHERE level = ?`)
      .run(params.value, params.level)
    return db.prepare('SELECT * FROM level_exp WHERE level = ?').get(params.level)
  })

  ipcMain.handle('exp-table:add', async () => {
    const db = getDatabase()
    const maxRow = db.prepare('SELECT MAX(level) as maxLv FROM level_exp').get() as { maxLv: number } | undefined
    const nextLv = (maxRow?.maxLv ?? 0) + 1
    db.prepare(`INSERT INTO level_exp (level, exp, standard_unit_exp)
      VALUES (?, 0, 0)`).run(nextLv)
    return db.prepare('SELECT * FROM level_exp WHERE level = ?').get(nextLv)
  })

  ipcMain.handle('exp-table:delete', async (_event, level: number) => {
    const db = getDatabase()
    db.prepare('DELETE FROM level_exp WHERE level = ?').run(level)
    return { ok: true }
  })

  ipcMain.handle('exp-table:reset', async () => {
    const db = getDatabase()
    db.prepare('DELETE FROM level_exp').run()
    const insert = db.prepare(
      'INSERT INTO level_exp (level, exp, standard_unit_exp) VALUES (?, ?, ?)'
    )
    const tx = db.transaction(() => {
      for (const row of EXP_TABLE_DEFAULTS) {
        insert.run(row[0], row[1], row[2])
      }
    })
    tx()
    return { ok: true }
  })

  // ── 怪物基础经验表 ──

  ipcMain.handle('monster-exp:getAll', async () => {
    const db = getDatabase()
    return db.prepare('SELECT * FROM monster_exp ORDER BY level, area, name').all()
  })

  ipcMain.handle('monster-exp:update', async (_event, params: { id: number; field: string; value: string | number }) => {
    const db = getDatabase()
    const allowedFields = ['name', 'area', 'level', 'base_exp', 'fatigue', 'quantity', 'respawn_time', 'kill_time', 'multiplier']
    if (!allowedFields.includes(params.field)) {
      throw new Error(`不允许的字段: ${params.field}`)
    }
    if (params.field === 'level' || params.field === 'base_exp') {
      const num = Number(params.value)
      if (!Number.isInteger(num) || num < 0) {
        throw new Error(`${params.field} 必须是非负整数`)
      }
    }
    if (params.field === 'fatigue') {
      const num = Number(params.value)
      if (isNaN(num) || num < 0) {
        throw new Error('疲劳消耗必须是非负数字')
      }
    }
    if (params.field === 'quantity' || params.field === 'respawn_time' || params.field === 'kill_time' || params.field === 'multiplier') {
      const num = Number(params.value)
      if (!Number.isInteger(num) || num < 0) {
        throw new Error(`${params.field} 必须是非负整数`)
      }
    }
    db.prepare(`UPDATE monster_exp SET ${params.field} = ?, updated_at = datetime('now','localtime') WHERE id = ?`)
      .run(params.value, params.id)
    return db.prepare('SELECT * FROM monster_exp WHERE id = ?').get(params.id)
  })

  ipcMain.handle('monster-exp:add', async (_event, area?: string) => {
    const db = getDatabase()
    // 默认等级 1、地区取当前筛选地区（地区筛选下新增可直接看到新行）
    db.prepare(`INSERT INTO monster_exp (name, area, level, base_exp, fatigue, quantity, respawn_time, multiplier)
      VALUES ('新怪物', ?, 1, 0, 0, 10, 15, 10)`).run(area ?? '')
    const row = db.prepare('SELECT * FROM monster_exp ORDER BY id DESC LIMIT 1').get()
    return row
  })

  ipcMain.handle('monster-exp:duplicate', async (_event, id: number) => {
    const db = getDatabase()
    const src = db.prepare('SELECT * FROM monster_exp WHERE id = ?').get(id) as
      | { name: string; area: string; level: number; base_exp: number; fatigue: number; quantity: number; respawn_time: number; multiplier: number; kill_time: number }
      | undefined
    if (!src) throw new Error(`怪物不存在: id=${id}`)
    db.prepare(`INSERT INTO monster_exp (name, area, level, base_exp, fatigue, quantity, respawn_time, multiplier, kill_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(src.name, src.area, src.level, src.base_exp, src.fatigue, src.quantity, src.respawn_time, src.multiplier, src.kill_time)
    const row = db.prepare('SELECT * FROM monster_exp ORDER BY id DESC LIMIT 1').get()
    return row
  })

  ipcMain.handle('monster-exp:delete', async (_event, id: number) => {
    const db = getDatabase()
    db.prepare('DELETE FROM monster_exp WHERE id = ?').run(id)
    return { ok: true }
  })

  ipcMain.handle('monster-exp:reset', async () => {
    const db = getDatabase()
    db.prepare('DELETE FROM monster_exp').run()
    const insert = db.prepare(
      'INSERT INTO monster_exp (name, area, level, base_exp, fatigue, quantity, respawn_time, multiplier) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    const tx = db.transaction(() => {
      for (const row of MONSTER_EXP_DEFAULTS) {
        const isHighFatigue = row.fatigue >= 1.0
        const quantity = isHighFatigue ? 1 : 10
        const respawnTime = isHighFatigue ? 90 : 15
        insert.run(row.name, row.area, row.level, row.base_exp, row.fatigue, quantity, respawnTime, 10)
      }
    })
    tx()
    return { ok: true }
  })

  // ── 答题题库（数据来自 quiz_questions 表） ──

  ipcMain.handle('quiz:getAll', async () => {
    const db = getDatabase()
    return db.prepare('SELECT * FROM quiz_questions ORDER BY id').all()
  })

  ipcMain.handle('quiz:delete', async (_event, id: number) => {
    const db = getDatabase()
    db.prepare('DELETE FROM quiz_questions WHERE id = ?').run(id)
    return { ok: true }
  })
}

// 禁用 WebRTC（本应用不需要），消除 STUN DNS 解析错误日志
app.commandLine.appendSwitch('disable-webrtc')
// 禁用 STUN 探测
app.commandLine.appendSwitch('force-fieldtrials', 'WebRTC-UseWebrtcDscp/Disabled/')

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  initDatabase()
  registerIpcHandlers()
  createWindow()
  createTray()
  await initWindows()
  registerGlobalShortcuts()
  // 窗口监视：主进程每秒检测一次，窗口开/关/托盘隐藏时推送给渲染进程（准实时，替代前端轮询）
  startWindowWatcher((list) => {
    if (mainWindow && !mainWindow.isDestroyed() && isUnlocked()) {
      mainWindow.webContents.send('windows:changed', list)
    }
  })
  startCurrencyScheduler()
  startClueScheduler((source, done, total) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('clue:progress', { source, done, total })
    }
  })
  // 启动后静默检查更新：有新版本时通知渲染进程，出错不打扰
  checkForUpdates().then((info) => {
    if (info.hasUpdate && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:available', info)
    }
  })
})

let activeWinIdx = -1

/** 启动时主动刷新窗口列表并加载预设排序 */
async function initWindows(): Promise<void> {
  try {
    refreshAndGet()
    if (isUnlocked()) {
      const db = getDatabase()
      const rows = db.prepare('SELECT title, slot, label FROM win_presets ORDER BY slot').all() as WinPreset[]
      if (rows.length > 0) applyPresetOrder(rows)
    }
    console.log('[窗口初始化] 检测到 %d 个游戏窗口', getCachedWindows().length)
  } catch (e: any) {
    console.error('[窗口初始化] 失败:', e?.message || e)
  }
}

function registerGlobalShortcuts(): void {
  // Ctrl+1~5: 激活固定位置窗口（切换前先刷新缓存，新开/已关的窗口立即生效）
  for (let i = 1; i <= 5; i++) {
    const slot = i
    const ok = globalShortcut.register(`Ctrl+${i}`, () => {
      if (!isUnlocked()) return
      const list = refreshAndGet()
      if (list.length === 0) return
      const result = switchBySlot(slot)
      if (result >= 0) {
        activeWinIdx = result
        notifyRenderer(list.length)
      }
    })
    if (!ok) console.log(`[快捷键] Ctrl+${i} 注册失败（可能已被其他应用占用）`)
  }

  // Ctrl+Q: 隐藏到托盘（窗口不退出、后台调度继续运行；点托盘图标可恢复）。
  // 与关闭窗口语义相反：Ctrl+Q 只隐藏，点 × 才是退出。
  const hideOk = globalShortcut.register('Ctrl+Q', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.hide()
    }
  })
  if (!hideOk) console.log('[快捷键] Ctrl+Q 注册失败（可能已被其他应用占用）')

  console.log('[快捷键] 全局快捷键已注册: Ctrl+1~5, Ctrl+Q(隐藏到托盘)')
}

/** 通知渲染进程当前激活窗口和窗口数量 */
function notifyRenderer(winCount: number) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('shortcut:switched', {
      idx: activeWinIdx,
      count: winCount,
    })
  }
}

// 任何退出路径（托盘菜单、更新安装器重启 app.quit()）都放行窗口关闭
app.on('before-quit', () => {
  quitting = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  stopClueScheduler()
  stopWindowWatcher()
  // 关闭 OCR 引擎子进程
  umiOcr?.dispose()
  tessOcr?.dispose()
  tray?.destroy()
  tray = null
})

app.on('window-all-closed', () => {
  // 托盘常驻：窗口隐藏（而非销毁）时调度器继续在后台运行；
  // 真正退出由托盘菜单触发，清理在 will-quit 中完成
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
