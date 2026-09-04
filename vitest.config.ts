import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Windows 盘符大小写规避：Git Bash 会话里 process.cwd() 可能是小写盘符（d:\...），
// vitest 4 在 ESM 路径解析时大小写不一致会导致全部测试文件收集失败
// （TypeError: Cannot read properties of undefined (reading 'config')，参见 vitest#10812、angular#33559）。
// 这里把 root 强制规范为磁盘真实大小写。
const root = process.cwd().replace(/^[a-z]:/, c => c.toUpperCase())

export default defineConfig({
  root,
  resolve: {
    alias: { '@': path.resolve(root, 'src') },
  },
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
})
