// scripts/sync-release-to-gitee.mjs —— 把 GitHub Release 上的安装包同步到 Gitee Release
// 用途：在 Gitee Go 流水线（国内服务器）中运行，替代 GitHub Actions → Gitee 的慢速跨境直传
// 用法：
//   node scripts/sync-release-to-gitee.mjs --tag v1.0.0
//   可选 --repo unbound9527/sgbuddy（默认 GitHub 仓库）、--name 指定附件名（默认 SG-Buddy-Setup-<tag>.exe）
// 依赖环境变量：GITEE_TOKEN / GITEE_OWNER / GITEE_REPO（Gitee Go 流水线环境变量中配置）
// 流程：从 GitHub Release（公开仓库免鉴权）下载安装包到临时目录 → 复用 publish-gitee.mjs 上传

import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function arg(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const tag = arg('--tag')
if (!tag) {
  console.error('❌ 用法: sync-release-to-gitee.mjs --tag v1.0.0 [--repo owner/repo] [--name 附件名]')
  process.exit(1)
}
const ghRepo = arg('--repo') || 'unbound9527/sgbuddy'
const assetName = arg('--name') || `SG-Buddy-Setup-${tag}.exe`

if (!process.env.GITEE_TOKEN || !process.env.GITEE_OWNER || !process.env.GITEE_REPO) {
  console.error('❌ 需要 GITEE_OWNER / GITEE_REPO / GITEE_TOKEN 环境变量（Gitee Go 环境变量中配置）')
  process.exit(1)
}

const url = `https://github.com/${ghRepo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(assetName)}`

// 1. 下载（GitHub Release，公开仓库；Gitee 国内服务器到 GitHub 的下载速度远好于反向）
console.log(`⬇️  下载 ${url} …`)
const tmpDir = mkdtempSync(join(tmpdir(), 'sgbuddy-sync-'))
const filePath = join(tmpDir, assetName)
try {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status}（确认 GitHub Release 已创建且附件存在）`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 1024 * 1024) throw new Error(`下载内容异常（仅 ${buf.length} 字节）`)
  const { writeFileSync } = await import('node:fs')
  writeFileSync(filePath, buf)
  console.log(`✅ 下载完成（${(buf.length / 1024 / 1024).toFixed(1)}MB）`)
} catch (e) {
  rmSync(tmpDir, { recursive: true, force: true })
  console.error(`❌ 下载失败: ${e.message}`)
  process.exit(1)
}

// 2. 上传到 Gitee Release（复用发布脚本，幂等）
const { spawnSync } = await import('node:child_process')
const r = spawnSync('node', [
  'scripts/publish-gitee.mjs',
  '--tag', tag,
  '--file', filePath,
  '--notes', `SG Buddy ${tag} 发布（安装包由 CI 构建并同步）`,
], { stdio: 'inherit' })
rmSync(tmpDir, { recursive: true, force: true })
process.exit(r.status ?? 1)
