// scripts/build-ocr-engine.mjs —— 从本机 Umi-OCR 目录裁剪出最小 PaddleOCR-json 引擎并 7z 分卷压缩
//
// 用法：node scripts/build-ocr-engine.mjs [源目录]
//   源目录默认 resources/umi-ocr/UmiOCR-data/plugins/win7_x64_PaddleOCR-json
//   输出到 release/ocr-engine/ocr-engine.7z.001 ...（每卷 <90MB，适配 Gitee 附件 100MB 限制）
//
// 裁剪依据（已实测验证，见项目 README）：
//   - 必须保留：PaddleOCR-json.exe、models/ 中文三模型、mklml.dll、mkldnn.dll、
//     onnxruntime.dll、paddle2onnx.dll（去掉任一组 DLL 都会 0xC0000135 启动失败）
//   - 可删除：其他语种模型、Python 封装文件（PPOCR_*.py、__init__.py、__pycache__）、
//     i18n.csv、README.md
//   - 裁剪后约 252MB，7z -mx=9 压缩后约 55MB，单卷（<90MB）
//
// 打包后发布：把分卷上传到 Gitee Release（tag 固定为 ocr-engine），应用内自动下载解压安装。

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const SRC_DEFAULT = resolve('resources/umi-ocr/UmiOCR-data/plugins/win7_x64_PaddleOCR-json')
const OUT_DIR = resolve('release/ocr-engine')
const VOLUME_SIZE = '90m'

// 可删除的顶层文件（相对引擎目录）
const DEL_FILES = [
  'PPOCR_api.py',
  'PPOCR_config.py',
  'PPOCR_umi.py',
  '__init__.py',
  'i18n.csv',
  'README.md',
]
const DEL_DIRS = ['__pycache__']

// models/ 下可删除的其它语种模型与配置（只留简中）
const DEL_MODELS = [
  'chinese_cht_mobile_v2.0_rec_infer',
  'cyrillic_PP-OCRv3_rec_infer',
  'en_PP-OCRv3_rec_infer',
  'japan_PP-OCRv3_rec_infer',
  'korean_PP-OCRv3_rec_infer',
  'config_chinese_cht.txt',
  'config_cyrillic.txt',
  'config_en.txt',
  'config_japan.txt',
  'config_korean.txt',
  'configs.txt',
  'dict_chinese_cht.txt',
  'dict_cyrillic.txt',
  'dict_en.txt',
  'dict_japan.txt',
  'dict_korean.txt',
]

function find7za() {
  const candidates = [
    resolve('resources/7za.exe'),
    resolve('node_modules/app-builder-bin/win/x64/7za.exe'),
    'C:/Program Files/7-Zip/7z.exe',
    'C:/Program Files (x86)/7-Zip/7z.exe',
  ]
  for (const c of candidates) if (existsSync(c)) return c
  return null
}

const src = process.argv[2] ? resolve(process.argv[2]) : SRC_DEFAULT
if (!existsSync(join(src, 'PaddleOCR-json.exe'))) {
  console.error(`❌ 源目录不存在或不是引擎目录：${src}`)
  console.error('   默认从 resources/umi-ocr 读取（Umi-OCR 安装目录），可用参数指定：node scripts/build-ocr-engine.mjs <目录>')
  process.exit(1)
}

const sevenZa = find7za()
if (!sevenZa) {
  console.error('❌ 未找到 7za.exe（node_modules/app-builder-bin 或系统 7-Zip），无法压缩')
  process.exit(1)
}

// 1. 清理输出目录，复制到临时目录并裁剪
rmSync(OUT_DIR, { recursive: true, force: true })
mkdirSync(OUT_DIR, { recursive: true })
const tmp = join(OUT_DIR, '.tmp-engine')
rmSync(tmp, { recursive: true, force: true })
mkdirSync(tmp, { recursive: true })
cpSync(src, tmp, { recursive: true })

for (const f of DEL_FILES) {
  const p = join(tmp, f)
  if (existsSync(p)) rmSync(p, { force: true })
}
for (const d of DEL_DIRS) rmSync(join(tmp, d), { recursive: true, force: true })
for (const m of DEL_MODELS) rmSync(join(tmp, 'models', m), { recursive: true, force: true })

// 2. 压缩分卷（cwd 必须在 tmp 内，目录已就绪）
const base = join(OUT_DIR, 'ocr-engine.7z')
console.log(`压缩中（-mx=9 分卷 ${VOLUME_SIZE}）…`)
const r = spawnSync(sevenZa, ['a', '-t7z', '-mx=9', `-v${VOLUME_SIZE}`, '-y', base, '*'], {
  cwd: tmp,
  stdio: 'inherit',
})
if (r.error) {
  console.error('❌ 压缩失败:', r.error.message)
  process.exit(1)
}
if (r.status !== 0) {
  console.error(`❌ 压缩失败（退出码 ${r.status}）`)
  process.exit(1)
}

rmSync(tmp, { recursive: true, force: true })

// 3. 报告结果
const parts = readdirSync(OUT_DIR).filter(f => /^ocr-engine\.7z\.\d+$/.test(f)).sort()
const total = parts.reduce((s, f) => s + statSize(join(OUT_DIR, f)), 0)
console.log(`✅ 完成：${parts.length} 个分卷，共 ${(total / 1024 / 1024).toFixed(1)}MB → ${OUT_DIR}`)
console.log('   上传到 Gitee Release（tag: ocr-engine），应用内可自动下载安装。')

function statSize(p) {
  return existsSync(p) ? statSync(p).size : 0
}
