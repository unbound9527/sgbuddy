// Windows 盘符大小写规避包装：Git Bash 会话可能把 cwd 传成小写盘符（d:\...），
// vitest 4 的 ESM 模块运行器在大小写不一致时会全部测试文件收集失败
// （TypeError: Cannot read properties of undefined (reading 'config')，
//  参见 vitest#10812、angular/angular-cli#33559）。
// 本脚本用 fs.realpathSync 取磁盘真实大小写的规范路径，再以该 cwd 派生 vitest。
// 用法：node scripts/run-vitest.mjs [vitest 参数...]，或 npm test。
import { spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(here, '..')

// 修正盘符大小写：d:\... -> D:\...
const fixed = projectRoot.replace(/^[a-z]:/, c => c.toUpperCase())
let canonical
try {
  canonical = realpathSync(fixed)
} catch {
  canonical = fixed
}

const vitestEntry = path.join(canonical, 'node_modules', 'vitest', 'vitest.mjs')
const args = [vitestEntry, 'run', ...process.argv.slice(2)]

const r = spawnSync(process.execPath, args, {
  cwd: canonical,
  stdio: 'inherit',
  env: { ...process.env, VITEST_ROOT: canonical },
})
process.exit(r.status ?? 1)
