// electron/services/umi-ocr.ts —— PaddleOCR-json 引擎管道直连（离线 OCR 主引擎）
// 直接驱动 Umi-OCR 内嵌的 PaddleOCR-json.exe（无 GUI 窗口，windowsHide 隐藏控制台）：
// stdin 写 JSON 行 {"image_base64": ...}，stdout 读 JSON 行结果
// 协议参照 Umi-OCR_plugins 的 PPOCR_api.py

import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export interface UmiRow {
  text: string
  score: number
  box: number[][]
}

export interface UmiResult {
  text: string // 过滤低置信度行后的拼接文本（供 fieldParser 使用）
  rows: UmiRow[]
  nameRow?: UmiRow // 识别出的名称行（含 box，供品质颜色分析）
}

export interface UmiOcrServiceOptions {
  exePath: string // PaddleOCR-json.exe 绝对路径
  cwd: string // 引擎工作目录（插件目录，config 相对路径基于此）
  configPath?: string // 语言配置，默认 models/config_chinese.txt
  initTimeoutMs?: number // 引擎初始化（模型加载）超时，默认 90s
  onStatus?: (s: { stage: 'startup' | 'ready' }) => void
}

const MIN_SCORE = 0.5 // 低于此置信度的行视为垃圾，不进解析文本

class UmiOcrImpl {
  private proc: ChildProcess | null = null
  private exePath: string
  private cwd: string
  private configPath: string
  private initTimeoutMs: number
  private onStatus?: UmiOcrServiceOptions['onStatus']
  private outBuf = ''
  private pending: Array<{ resolve: (rows: UmiRow[]) => void; reject: (e: Error) => void }> = []
  private initPromise: Promise<void> | null = null

  constructor(opts: UmiOcrServiceOptions) {
    this.exePath = opts.exePath
    this.cwd = opts.cwd
    this.configPath = opts.configPath ?? 'models/config_chinese.txt'
    this.initTimeoutMs = opts.initTimeoutMs ?? 90_000
    this.onStatus = opts.onStatus
  }

  private spawnEngine(): ChildProcess {
    if (!existsSync(this.exePath)) {
      throw new Error(`未找到 PaddleOCR 引擎：${this.exePath}`)
    }
    const proc = spawn(this.exePath, ['--config_path', this.configPath], {
      cwd: this.cwd,
      windowsHide: true, // 隐藏控制台窗口
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    this.outBuf = ''
    proc.stdout!.on('data', d => {
      this.outBuf += d.toString('utf8')
      let idx
      while ((idx = this.outBuf.indexOf('\n')) >= 0) {
        const line = this.outBuf.slice(0, idx).trim()
        this.outBuf = this.outBuf.slice(idx + 1)
        if (line) this.handleLine(line)
      }
    })
    proc.on('exit', () => {
      // 引擎意外退出：清理状态，下次识别会自动重启
      this.proc = null
      this.initPromise = null
      this.initDone = false
      for (const p of this.pending) p.reject(new Error('引擎已退出'))
      this.pending = []
    })
    return proc
  }

  /** 处理 stdout 行：初始化标志 or 识别结果 JSON */
  private handleLine(line: string) {
    if (line.includes('OCR init completed.')) {
      this.initDone = true
      this.onStatus?.({ stage: 'ready' })
      return
    }
    if (!this.pending.length) return // 初始化阶段的版本/模式行

    // 先弹出等待者——无论成功失败都必须释放，否则调用方永久挂起
    const p = this.pending.shift()!

    let res: any
    try { res = JSON.parse(line) } catch {
      // 非 JSON（引擎日志）→ 放回等待者，等下一行
      this.pending.unshift(p)
      return
    }

    // 处理错误码响应（data 可能为字符串而非数组）
    if (res.code && res.code !== 100) {
      const errMsg = typeof res.data === 'string' ? res.data : `引擎错误码 ${res.code}`
      p.reject(new Error(errMsg))
      return
    }

    // data 可能不是数组（如 code=100 但 data 为空对象或字符串），防御性处理
    const arr = Array.isArray(res.data) ? res.data : []
    const rows: UmiRow[] = arr.map((it: any) => ({
      text: String(it.text ?? ''),
      score: Number(it.score ?? 0),
      box: Array.isArray(it.box) ? it.box : [],
    }))
    p.resolve(rows)
  }

  /** 初始化引擎并等待模型加载完成 */
  private ensureInit(): Promise<void> {
    if (this.proc && this.initPromise) return this.initPromise
    this.onStatus?.({ stage: 'startup' })
    this.proc = this.spawnEngine()
    this.initPromise = new Promise<void>((resolve, reject) => {
      const deadline = Date.now() + this.initTimeoutMs
      const timer = setInterval(() => {
        if (this.initDone) { clearInterval(timer); resolve() }
        else if (!this.proc) { clearInterval(timer); reject(new Error('PaddleOCR 引擎启动失败')) }
        else if (Date.now() > deadline) { clearInterval(timer); reject(new Error('PaddleOCR 引擎初始化超时（90s）')) }
      }, 200)
    })
    return this.initPromise
  }

  private initDone = false

  /** 识别：返回过滤后的行文本 + 全量行 + 名称行 */
  async recognize(png: Buffer): Promise<UmiResult> {
    await this.ensureInit()
    const rows = await new Promise<UmiRow[]>((resolve, reject) => {
      this.pending.push({ resolve, reject })
      this.proc!.stdin!.write(JSON.stringify({ image_base64: png.toString('base64') }) + '\n')
      setTimeout(() => {
        const idx = this.pending.findIndex(p => p.resolve === resolve)
        if (idx >= 0) {
          this.pending.splice(idx, 1)
          // 超时说明引擎可能卡死了，杀掉重启，避免后续请求跟着遭殃
          this.killEngine()
          reject(new Error('识别超时（10s）'))
        }
      }, 10_000)
    })
    const kept = rows.filter(r => r.score >= MIN_SCORE).map(r => r.text)
    // 名称行（与 fieldParser 名称扫描启发式一致）：跳过符号开头/碎片行，取首个像名称的行
    const nameRow = rows.find(r => {
      const t = r.text.trim()
      if (r.score < 0.6) return false
      if (/^[［\[(（]/.test(t)) return false
      if (t.length < 2) return false
      return true
    })
    return { text: kept.join('\n'), rows, nameRow }
  }

  /** 杀掉当前引擎进程（超时/卡死时调用），下次识别会自动重启 */
  private killEngine() {
    if (this.proc) {
      try { this.proc.kill() } catch {}
      this.proc = null
    }
    this.initPromise = null
    this.initDone = false
    // 清空等待队列——引擎都没了，不会再有响应
    for (const p of this.pending) p.reject(new Error('引擎已重启'))
    this.pending = []
  }

  /** 结束引擎 */
  async dispose(): Promise<void> {
    if (this.proc) {
      try {
        this.proc.stdin!.write(JSON.stringify({ exit: '' }) + '\n')
      } catch { /* 已关闭 */ }
      setTimeout(() => { try { this.proc?.kill() } catch {} }, 300)
      this.proc = null
      this.initPromise = null
      this.initDone = false
    }
  }
}

export const createUmiOcrService = (opts: UmiOcrServiceOptions) => new UmiOcrImpl(opts)
