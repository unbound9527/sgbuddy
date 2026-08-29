// scripts/publish-gitee.mjs —— 上传文件到 Gitee Release（CI 发布用）
// 用法：
//   GITEE_TOKEN=xxx node scripts/publish-gitee.mjs --tag v1.0.0 --file release/SG-Buddy-Setup-1.0.0.exe [--notes "发布说明"]
// 逻辑：tag 对应的 Release 不存在则创建；已存在则先删除同名附件再上传（幂等，可重复执行）
// 需要环境变量：GITEE_TOKEN（Gitee 私人令牌，仓库 secrets 中配置）
// 另见：electron/services/updater.ts 的 GITEE_OWNER/GITEE_REPO（应用内更新检测用，需保持一致）

import { statSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const OWNER = process.env.GITEE_OWNER || ''
const REPO = process.env.GITEE_REPO || ''
const TOKEN = process.env.GITEE_TOKEN || ''
const API = 'https://gitee.com/api/v5'

function arg(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

if (!OWNER || !REPO || !TOKEN) {
  console.error('❌ 需要 GITEE_OWNER / GITEE_REPO / GITEE_TOKEN 环境变量')
  process.exit(1)
}

const tag = arg('--tag')
const fileArg = arg('--file')
const notes = arg('--notes') || ''
if (!tag || !fileArg) {
  console.error('❌ 用法: publish-gitee.mjs --tag v1.0.0 --file <安装包路径> [--notes "..."]')
  process.exit(1)
}

const filePath = resolve(fileArg)
const fileName = filePath.split(/[\\/]/).pop()
const fileSize = statSync(filePath).size

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, opts)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gitee API ${opts.method || 'GET'} ${path} 失败（HTTP ${res.status}）: ${text.slice(0, 300)}`)
  }
  return res.status === 204 ? null : res.json()
}

// 1. 确保 Release 存在（tag 已由 git push 建立，这里创建 release 记录）
// 注意：Gitee 对不存在的 Release，GET /releases/tags/{tag} 返回 200 + null（也有 404 的情况），需都兼容
let release = await api(`/repos/${OWNER}/${REPO}/releases/tags/${encodeURIComponent(tag)}?access_token=${TOKEN}`).catch(() => null)
if (!release) {
  release = await api(`/repos/${OWNER}/${REPO}/releases?access_token=${TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tag_name: tag,
      name: `SG Buddy ${tag}`,
      body: notes,
      // Gitee 创建 Release 必须指定目标分支
      target_commitish: process.env.GITEE_BRANCH || 'main',
    }),
  })
  // 创建接口若返回空响应，回查一次
  if (!release) release = await api(`/repos/${OWNER}/${REPO}/releases/tags/${encodeURIComponent(tag)}?access_token=${TOKEN}`)
  console.log(`✅ 已创建 Release ${tag}`)
}

// 2. 删除同名旧附件（幂等重发布）
const existing = (release.assets || []).filter(a => a.name === fileName)
for (const asset of existing) {
  try {
    await api(
      `/repos/${OWNER}/${REPO}/releases/${tag}/attach_files/${asset.id}?access_token=${TOKEN}`,
      { method: 'DELETE' },
    )
    console.log(`🗑  已删除旧附件 ${asset.name}`)
  } catch (e) {
    console.warn(`⚠️  删除旧附件失败（继续上传）: ${e.message}`)
  }
}

// 3. 上传附件（multipart，走 curl：大文件上传可能超过 fetch/undici 默认 5 分钟响应超时）
console.log(`⬆️  上传 ${fileName}（${(fileSize / 1024 / 1024).toFixed(1)}MB）…`)
const uploadRes = spawnSync('curl', [
  '-sS', '--fail', '--connect-timeout', '30', '--max-time', process.env.CURL_MAX_TIME || '1800', '--retry', '2', '--retry-delay', '5',
  '-X', 'POST',
  `https://gitee.com/api/v5/repos/${OWNER}/${REPO}/releases/${encodeURIComponent(tag)}/attach_files?access_token=${TOKEN}`,
  '-F', `file=@${filePath}`,
], { encoding: 'utf8' })
if (uploadRes.status !== 0 || !uploadRes.stdout) {
  console.error(`❌ 上传失败: ${(uploadRes.stderr || `curl 退出码 ${uploadRes.status}`).slice(0, 300)}`)
  process.exit(1)
}
let uploaded = {}
try { uploaded = JSON.parse(uploadRes.stdout) } catch { /* 响应非 JSON 时原样打印 */ }
console.log(`✅ 上传完成: ${uploaded.browser_download_url || uploadRes.stdout.slice(0, 300)}`)
