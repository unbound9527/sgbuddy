// scripts/release.mjs —— 一条命令完成发版
// 用法：node scripts/release.mjs <版本号>        例：node scripts/release.mjs 1.0.1
//   可选：--dry-run      只打印将要执行的步骤，不实际执行
//         --skip-build   跳过本地构建（复用已有 release/SG-Buddy-Setup-vX.Y.Z.exe）
//         --skip-publish 跳过 Gitee 上传（仅构建 + 推送 tag）
// 流程：改 package.json 版本 → 本地构建（EPERM 自动降级 electronDist 方案）→
//       提交推送 main → 打 tag 推两端（CI 由此创建 GitHub Release）→ 上传 Gitee Release
import { readFileSync, writeFileSync, existsSync, rmSync, statSync } from 'node:fs'

const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')
const skipBuild = argv.includes('--skip-build')
const skipPublish = argv.includes('--skip-publish')
const version = argv.find(a => /^\d+\.\d+\.\d+$/.test(a))

if (!version) {
  console.error('用法: node scripts/release.mjs <版本号> [--dry-run] [--skip-build] [--skip-publish]')
  process.exit(1)
}
const tag = `v${version}`
const exeName = `SG-Buddy-Setup-${tag}.exe`
const exePath = `release/${exeName}`

let failed = false
function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`)
  if (dryRun) return { status: 0 }
  const r = spawnSyncShell(cmd, opts)
  if (r.status !== 0) {
    if (opts.allowFail) {
      failed = true
      return r
    }
    console.error(`❌ 命令失败（退出码 ${r.status}）: ${cmd}`)
    process.exit(r.status ?? 1)
  }
  return r
}

import { spawnSync } from 'node:child_process'
function spawnSyncShell(cmd, opts = {}) {
  return spawnSync(cmd, { shell: true, stdio: 'inherit', ...opts })
}

// ── 0. 前置检查 ──
const dirty = spawnSyncShell('git status --porcelain', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
if (!dryRun && (dirty.stdout || '').trim()) {
  console.error('❌ 工作区不干净，先提交或暂存（git stash）后再发版：\n' + dirty.stdout)
  process.exit(1)
}
const pkgPath = 'package.json'
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
if (pkg.version === version) {
  console.error(`❌ package.json 版本已是 ${version}，请提供新版本号`)
  process.exit(1)
}

// ── 1. 改版本号并提交 ──
console.log(`\n== 版本号 ${pkg.version} → ${version} ==`)
pkg.version = version
if (!dryRun) {
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  run('git add package.json')
  run(`git commit -m "release: ${tag}"`)
}

// ── 2. 本地构建 ──
if (!skipBuild) {
  console.log('\n== 本地构建 ==')
  const mirrors = {
    ELECTRON_MIRROR: 'https://npmmirror.com/mirrors/electron/',
    ELECTRON_BUILDER_BINARIES_MIRROR: 'https://npmmirror.com/mirrors/electron-builder-binaries/',
  }
  run('npm run dist', { env: { ...process.env, ...mirrors }, allowFail: !dryRun })
  if (!dryRun && failed) {
    console.log('\n⚠️  npm run dist 失败（多为杀软锁 win-unpacked），改用 electronDist 方案重试…')
    for (const d of ['release/win-unpacked', 'release/win-unpacked.tmp']) {
      try { rmSync(d, { recursive: true, force: true }) } catch { /* 忽略 */ }
    }
    run('npm run build', { env: mirrors })
    run('npx electron-builder --win --publish never -c.electronDist=node_modules/electron/dist', { env: mirrors })
    failed = false
  }
  if (!dryRun) {
    if (!existsSync(exePath)) {
      console.error(`❌ 构建产物不存在: ${exePath}`)
      process.exit(1)
    }
    const size = statSync(exePath).size
    if (size < 50 * 1024 * 1024) {
      console.error(`❌ 构建产物异常（仅 ${(size / 1048576).toFixed(1)}MB）`)
      process.exit(1)
    }
    console.log(`\n✅ 构建完成: ${exePath}（${(size / 1048576).toFixed(1)}MB）`)
  }
}

// ── 3. 推送代码与 tag ──
console.log('\n== 推送 main 与 tag ==')
run('git push github main')
run('git push gitee main')
run(`git tag ${tag}`)
run(`git push github ${tag}`)
run(`git push gitee ${tag}`)

// ── 4. 上传 Gitee Release ──
if (!skipPublish) {
  console.log('\n== 上传 Gitee Release（幂等，可重跑） ==')
  run(`node scripts/publish-gitee.mjs --tag ${tag} --file "${exePath}" --notes "SG Buddy ${tag} 发布"`)
}

// ── 完成 ──
console.log(`
🎉 发版完成：${tag}
- Gitee Release: https://gitee.com/rookieee/sgbuddy/releases/tag/${tag}
- GitHub Release: 由 CI 在本轮 tag 触发后自动创建（几分钟到几十分钟）
  ${skipPublish ? '' : '- CI 随后也会直传 Gitee 一次（等价构建，自动覆盖本地刚传的附件，无需理会）'}
${dryRun ? '\n（本次为 --dry-run 预演，未实际执行）' : ''}`)
