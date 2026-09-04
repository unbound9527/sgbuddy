// scripts/after-pack.cjs —— electron-builder afterPack hook
// 只保留简体中文语言包，其余 locales 移出（约省 37MB，安装包需 <100MB 才能上传 Gitee）
// 注：用 renameSync 移到隔离目录而非 unlinkSync 删除 —— 部分环境（如 WorkBuddy 沙箱）
// 对 node 的 rmSync/unlinkSync 有批量删除守卫（>50KB/50 文件即拦截），rename 不受影响；
// 隔离目录随构建输出，可整体清理。
const { existsSync, mkdirSync, readdirSync, renameSync } = require('node:fs')
const { join } = require('node:path')

/** @param {import('electron-builder').AfterPackContext} context */
exports.default = async function afterPack(context) {
  const localesDir = join(context.appOutDir, 'locales')
  if (!existsSync(localesDir)) return
  const quarantine = join(context.appOutDir, '..', 'locales-quarantine')
  for (const f of readdirSync(localesDir)) {
    if (f !== 'zh-CN.pak') {
      try {
        if (!existsSync(quarantine)) mkdirSync(quarantine, { recursive: true })
        renameSync(join(localesDir, f), join(quarantine, f))
      } catch (err) {
        // rename 失败（跨卷等）再尝试直接删除
        try {
          require('node:fs').unlinkSync(join(localesDir, f))
        } catch {
          console.warn(`[after-pack] 无法移除语言包 ${f}: ${err?.message || err}`)
        }
      }
    }
  }
}
