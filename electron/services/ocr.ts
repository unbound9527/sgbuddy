// electron/services/ocr.ts —— 本地 OCR 服务（与 Electron 解耦，可被调试脚本复用）
// 语言包下载缓存到 langDir，tesseract worker 经 langPath 指向本地目录，运行期不依赖网络。
// worker/core 均指向 node_modules 本地文件（打包进 asar），避免默认从 CDN 加载（国内不可达）。

import { createWorker, type Worker } from 'tesseract.js'
import { existsSync, mkdirSync } from 'node:fs'
import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type OcrInput = { kind: 'buffer'; data: Uint8Array } | { kind: 'path'; path: string }

export interface OcrServiceOptions {
  langDir: string // 语言包目录（不存在则自动创建）
  lang?: string // 默认 'chi_sim'
  bundleDir?: string // 内置语言包目录（离线优先；langDir 缺失时复制内置包，仍缺失才在线下载）
  onProgress?: (p: { stage: 'download' | 'recognize'; percent: number }) => void
}

// tesseract.js 本地 worker 与 core（打包进 asar，无需网络）
const WORKER_PATH = require.resolve('tesseract.js/dist/worker.min.js')
const CORE_PATH = require.resolve('tesseract.js-core/tesseract-core-lstm.wasm.js')

export interface OcrService {
  recognize(input: OcrInput): Promise<string>
  dispose(): Promise<void>
}

// naptha/tessdata gh-pages：best_int = tesseract.js LSTM 默认源（准确率最高）
// worker 默认 gzip:true，直接读 <lang>.traineddata.gz 并自动解压，故原样保存压缩文件
const LANG_DATA_URL = (lang: string) =>
  `https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0_best_int/${lang}.traineddata.gz`
const RECOGNIZE_TIMEOUT_MS = 30_000

class OcrImpl implements OcrService {
  private worker: Worker | null = null
  private ready: Promise<Worker> | null = null
  private langDir: string
  private lang: string
  private bundleDir?: string
  private onProgress?: OcrServiceOptions['onProgress']
  private queue: Promise<void> = Promise.resolve() // 串行化，同一时刻只跑一个识别

  constructor(opts: OcrServiceOptions) {
    this.langDir = opts.langDir
    this.lang = opts.lang ?? 'chi_sim'
    this.bundleDir = opts.bundleDir
    this.onProgress = opts.onProgress
  }

  /** 确保语言包存在：langDir → 内置包复制 → 在线下载（带进度），tesseract 经 langPath 从本地加载 */
  private async ensureLangData(): Promise<void> {
    const langPath = join(this.langDir, `${this.lang}.traineddata.gz`)
    if (existsSync(langPath)) return
    mkdirSync(this.langDir, { recursive: true })

    // 内置语言包：复制到 langDir（离线可用）
    if (this.bundleDir) {
      const bundled = join(this.bundleDir, `${this.lang}.traineddata.gz`)
      if (existsSync(bundled)) {
        await copyFile(bundled, langPath)
        return
      }
    }

    const url = LANG_DATA_URL(this.lang)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`语言包下载失败（HTTP ${res.status}），请检查网络后重试`)
    const total = Number(res.headers.get('content-length')) || 0
    if (!res.body) throw new Error('语言包下载失败：无响应数据')

    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let received = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        chunks.push(value)
        received += value.length
        if (total > 0) this.onProgress?.({ stage: 'download', percent: Math.round((received / total) * 100) })
      }
    }
    await writeFile(langPath, Buffer.concat(chunks))
  }

  private async getWorker(): Promise<Worker> {
    if (!this.ready) {
      this.ready = (async () => {
        await this.ensureLangData()
        const w = await createWorker(this.lang, 1, {
          langPath: this.langDir, // 本地目录（Node 分支走 adapter.readCache，不联网）
          workerPath: WORKER_PATH, // 本地 worker，避免默认从 CDN 加载
          corePath: CORE_PATH, // 本地 wasm core，避免默认从 CDN 加载
          logger: (m) => {
            if (m.status === 'recognizing text') {
              this.onProgress?.({ stage: 'recognize', percent: Math.round(m.progress * 100) })
            }
          },
        })
        this.worker = w
        return w
      })()
      // 初始化失败后允许下次重试
      this.ready.catch(() => { this.ready = null })
    }
    return this.ready
  }

  /** 识别失败/超时后终止 worker，下次调用重建 */
  private async resetWorker(): Promise<void> {
    this.ready = null
    const w = this.worker
    this.worker = null
    if (w) {
      try { await w.terminate() } catch { /* 已失效 */ }
    }
  }

  private async recognizeOnce(input: OcrInput): Promise<string> {
    const w = await this.getWorker()
    const data = input.kind === 'path' ? await readFile(input.path) : Buffer.from(input.data)
    const run = w.recognize(data).then(r => r.data.text)
    return await Promise.race([
      run,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('识别超时（30s）')), RECOGNIZE_TIMEOUT_MS)
      ),
    ])
  }

  async recognize(input: OcrInput): Promise<string> {
    // 串行化：等待前一个识别结束
    const prev = this.queue
    let release!: () => void
    this.queue = new Promise(res => { release = res })
    await prev
    try {
      try {
        return await this.recognizeOnce(input)
      } catch (err) {
        // 重建 worker 重试一次
        await this.resetWorker()
        return await this.recognizeOnce(input)
      }
    } finally {
      release()
    }
  }

  async dispose(): Promise<void> {
    await this.resetWorker()
  }
}

export const createOcrService = (opts: OcrServiceOptions): OcrService => new OcrImpl(opts)
