// electron/services/updater.ts —— 更新检测与下载安装（应用本体 + OCR 引擎）
// 全部走 Gitee（国内网络可达）：
//   - 应用更新：查 Gitee Releases 最新版本，下载 nsis 安装包静默安装
//   - OCR 引擎：查固定 tag 为 ocr-engine 的 Release 附件（7z 分卷），下载合并解压到 userData
import { app, net } from 'electron'
import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

// ── 发布配置（Gitee 仓库，Release 上提供安装包与 OCR 引擎附件） ──
export const GITEE_OWNER = 'rookieee'
export const GITEE_REPO = 'sgbuddy'

const API_BASE = 'https://gitee.com/api/v5'

export interface ReleaseAsset {
  name: string
  browser_download_url: string
  size: number
}

export interface ReleaseInfo {
  tag_name: string
  name: string
  body: string
  assets: ReleaseAsset[]
}

export interface UpdateInfo {
  hasUpdate: boolean
  version?: string
  tagName?: string
  notes?: string
  asset?: ReleaseAsset
  error?: string
}

/** tag 名 → 版本号（v1.2.3 → 1.2.3） */
export function parseVersion(tag: string): string {
  const m = tag.replace(/^v/, '').match(/^\d+\.\d+\.\d+/)
  return m ? m[0] : tag
}

/** 版本比较：a > b → 正数，相等 → 0 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

function isConfigured(): boolean {
  return !!GITEE_OWNER && !!GITEE_REPO
}

/** 拉取 Gitee Release 信息：tag 为空取 latest，否则取指定 tag */
export async function getRelease(tag?: string): Promise<ReleaseInfo> {
  if (!isConfigured()) throw new Error('更新服务未配置（GITEE_OWNER / GITEE_REPO 为空）')
  const path = tag ? `releases/tags/${tag}` : 'releases/latest'
  const res = await net.fetch(`${API_BASE}/repos/${GITEE_OWNER}/${GITEE_REPO}/${path}`)
  if (!res.ok) {
    if (res.status === 404) throw new Error('仓库暂无 Release')
    throw new Error(`Gitee API 请求失败（HTTP ${res.status}）`)
  }
  const data = await res.json()
  return {
    tag_name: data.tag_name,
    name: data.name ?? '',
    body: data.body ?? '',
    assets: (data.assets ?? []).map((a: any) => ({
      name: a.name,
      browser_download_url: a.browser_download_url,
      size: a.size ?? 0,
    })),
  }
}

/** 检查应用更新：返回是否有新版本（出错时不打扰用户，hasUpdate=false + error） */
export async function checkForUpdates(): Promise<UpdateInfo> {
  try {
    const release = await getRelease()
    const version = parseVersion(release.tag_name)
    if (compareVersions(version, app.getVersion()) <= 0) return { hasUpdate: false }
    // 取 Windows 安装包附件（排除 blockmap）
    const asset = release.assets.find(a => /\.exe$/.test(a.name)) ?? release.assets[0]
    if (!asset) return { hasUpdate: true, version, tagName: release.tag_name, notes: release.body }
    return { hasUpdate: true, version, tagName: release.tag_name, notes: release.body, asset }
  } catch (e: any) {
    return { hasUpdate: false, error: e?.message ?? String(e) }
  }
}

/** 下载文件到 targetPath，实时上报进度 */
export async function downloadFile(
  url: string,
  targetPath: string,
  onProgress?: (p: { received: number; total: number }) => void,
): Promise<void> {
  const res = await net.fetch(url)
  if (!res.ok) throw new Error(`下载失败（HTTP ${res.status}）`)
  const total = Number(res.headers.get('content-length')) || 0
  let received = 0
  const out = createWriteStream(targetPath)
  const reader = res.body!.getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        out.write(Buffer.from(value))
        received += value.length
        if (total > 0) onProgress?.({ received, total })
      }
    }
  } finally {
    reader.releaseLock()
  }
  await new Promise<void>((resolve, reject) => {
    out.end((err) => (err ? reject(err) : resolve()))
  })
}

/** 下载安装包到 userData/update/ 并静默安装 */
export async function downloadUpdate(
  asset: ReleaseAsset,
  onProgress?: (p: { received: number; total: number }) => void,
): Promise<string> {
  const dir = join(app.getPath('userData'), 'update')
  mkdirSync(dir, { recursive: true })
  const target = join(dir, asset.name)
  await downloadFile(asset.browser_download_url, target, onProgress)
  return target
}

/** 启动 nsis 安装器静默安装，随后退出应用（安装器会等待应用退出后覆盖文件） */
export function installUpdate(installerPath: string): void {
  spawn(installerPath, ['/S'], { detached: true, stdio: 'ignore' }).unref()
  setTimeout(() => app.quit(), 1500)
}

// ── OCR 引擎（PaddleOCR-json 裁剪版，7z 分卷） ──

export const OCR_ENGINE_TAG = 'ocr-engine'

/** 引擎下载/安装进度：downloading = 拉取分卷中，extracting = 7za 解压中（耗时较长，用于提示用户未卡死） */
export interface OcrEngineProgress {
  stage: 'downloading' | 'extracting'
  received: number
  total: number
}

/** 从 Release 附件中筛出引擎分卷（按名称排序），不写死卷数 */
function getOcrEngineParts(assets: ReleaseAsset[]): ReleaseAsset[] {
  return assets
    .filter(a => /^ocr-engine\.7z\.\d+$/.test(a.name))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** 已安装的引擎目录（userData/ocr-engine），目录内含 PaddleOCR-json.exe */
export function getOcrEngineDir(): string {
  return join(app.getPath('userData'), 'ocr-engine')
}

export function getOcrEngineExePath(): string {
  return join(getOcrEngineDir(), 'PaddleOCR-json.exe')
}

export function isOcrEngineInstalled(): boolean {
  return existsSync(getOcrEngineExePath())
}

/** 定位 7za（解压引擎分卷用）：打包 → resources/7za.exe；开发 → app-builder-bin */
export function resolve7zaPath(): string | null {
  if (app.isPackaged) {
    const bundled = join(process.resourcesPath, '7za.exe')
    return existsSync(bundled) ? bundled : null
  }
  const dev = join(__dirname, '..', '..', 'node_modules', 'app-builder-bin', 'win', 'x64', '7za.exe')
  if (existsSync(dev)) return dev
  // 系统 7-Zip
  const sys = 'C:/Program Files/7-Zip/7z.exe'
  return existsSync(sys) ? sys : null
}

/**
 * 下载并安装 OCR 引擎：从 ocr-engine tag 的 Release 拉分卷 → 合并解压到 userData/ocr-engine。
 * 引擎目录结构保持相对路径（models/config_chinese.txt 相对 cwd 解析），直接以插件目录内容为根。
 */
export async function downloadOcrEngine(onProgress?: (p: OcrEngineProgress) => void): Promise<void> {
  const release = await getRelease(OCR_ENGINE_TAG)
  const parts = getOcrEngineParts(release.assets)
  if (parts.length === 0) {
    throw new Error('OCR 引擎发布不存在（release 无分卷附件）')
  }
  const sevenZip = resolve7zaPath()
  if (!sevenZip) throw new Error('未找到 7za.exe，无法解压引擎')

  const tmpDir = join(app.getPath('userData'), 'ocr-engine-tmp')
  rmSync(tmpDir, { recursive: true, force: true })
  mkdirSync(tmpDir, { recursive: true })

  try {
    // 按顺序下载分卷，进度按总字节数合并上报
    const totalAll = parts.reduce((s, a) => s + (a.size || 0), 0)
    let receivedAll = 0
    for (const part of parts) {
      await downloadFile(part.browser_download_url, join(tmpDir, part.name), (p) => {
        onProgress?.({ stage: 'downloading', received: receivedAll + p.received, total: totalAll })
      })
      receivedAll += part.size || 0
    }

    const targetDir = getOcrEngineDir()
    rmSync(targetDir, { recursive: true, force: true })
    mkdirSync(targetDir, { recursive: true })
    // 解压 240MB 引擎耗时较长（可达 1 分钟），先通知 UI 切换到解压阶段，避免用户以为卡死
    onProgress?.({ stage: 'extracting', received: totalAll, total: totalAll })
    await new Promise<void>((resolve, reject) => {
      // 7za 解压分卷只需指定第一个卷，自动读取后续卷
      const firstPart = parts[0].name
      const proc = spawn(sevenZip, ['x', join(tmpDir, firstPart), `-o${targetDir}`, '-y'], {
        windowsHide: true,
        stdio: 'ignore',
      })
      proc.on('error', reject)
      proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`引擎解压失败（退出码 ${code}）`))))
    })
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
}
