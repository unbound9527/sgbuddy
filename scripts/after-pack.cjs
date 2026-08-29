// scripts/after-pack.cjs —— electron-builder afterPack hook
// 只保留简体中文语言包，其余 locales 删除（约省 37MB，安装包需 <100MB 才能上传 Gitee）
const { existsSync, readdirSync, unlinkSync } = require('node:fs')
const { join } = require('node:path')

/** @param {import('electron-builder').AfterPackContext} context */
exports.default = async function afterPack(context) {
  const localesDir = join(context.appOutDir, 'locales')
  if (!existsSync(localesDir)) return
  for (const f of readdirSync(localesDir)) {
    if (f !== 'zh-CN.pak') unlinkSync(join(localesDir, f))
  }
}
