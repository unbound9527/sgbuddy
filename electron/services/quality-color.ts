// electron/services/quality-color.ts —— 品质颜色识别
// 分析名称行文本框区域的文字像素颜色（QQ三国品质靠文字颜色区分），映射到品质色

import { nativeImage } from 'electron'

// 品质色相中心（HSV 色相角度）与容差
// 实测：游戏橙装名称行渲染色相约 350°（偏红），故橙色中心取 350°、红色容差收窄区分真红
const QUALITY_HUES: Array<{ name: string; h: number; tol: number }> = [
  { name: '红色', h: 0, tol: 6 },
  { name: '橙色', h: 350, tol: 22 },
  { name: '黄色', h: 50, tol: 18 },
  { name: '绿色', h: 120, tol: 30 },
  { name: '蓝色', h: 215, tol: 38 },
  { name: '紫色', h: 272, tol: 25 },
]

/** 主色相到品质色的角度差 */
function hueDiff(a: number, b: number): number {
  let d = Math.abs(a - b)
  if (d > 180) d = 360 - d
  return d
}

/**
 * 分析名称行区域文字颜色 → 品质名（红/橙/黄/绿/蓝/紫）
 * @param png 原图 PNG buffer
 * @param box 名称行文本框四点坐标 [左上,右上,右下,左下]
 * @returns 品质名；无法判定返回空串
 */
export function analyzeNameQuality(png: Buffer, box: number[][]): string {
  const img = nativeImage.createFromBuffer(png)
  if (img.isEmpty()) return ''
  const { width: w, height: h } = img.getSize()
  const bmp = img.toBitmap() // BGRA
  if (!box || box.length < 4) return ''

  const [x0, y0] = box[0], [x2, y2] = box[2]
  const xa = Math.max(0, Math.floor(x0)), xb = Math.min(w - 1, Math.ceil(x2))
  const ya = Math.max(0, Math.floor(y0)), yb = Math.min(h - 1, Math.ceil(y2))
  if (xb <= xa || yb <= ya) return ''

  // 收集高亮彩色像素（文字），按 15° 色相桶统计
  const hueBins = new Map<number, number>()
  let colored = 0
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) {
      const i = (y * w + x) * 4
      const b = bmp[i], g = bmp[i + 1], r = bmp[i + 2]
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      if (max < 120) continue // 背景（tooltip 深色半透明）
      const s = max === 0 ? 0 : (max - min) / max
      if (s < 0.3) continue // 白/灰文字（非品质色）
      let hue = 0
      const d = max - min
      if (max === r) hue = ((g - b) / d) * 60
      else if (max === g) hue = ((b - r) / d) * 60 + 120
      else hue = ((r - g) / d) * 60 + 240
      if (hue < 0) hue += 360
      const bucket = Math.round(hue / 15) * 15
      hueBins.set(bucket, (hueBins.get(bucket) ?? 0) + 1)
      colored++
    }
  }
  if (colored < 30) return '' // 彩色文字太少，不可判定

  const sorted = [...hueBins.entries()].sort((a, b) => b[1] - a[1])
  const [topHue, topCount] = sorted[0]
  const total = sorted.reduce((s, [, c]) => s + c, 0)
  if (topCount / total < 0.4) return '' // 主色占比过低，颜色混杂

  let best: string | null = null
  let bestDiff = 999
  for (const q of QUALITY_HUES) {
    const diff = hueDiff(topHue, q.h)
    if (diff <= q.tol && diff < bestDiff) { bestDiff = diff; best = q.name }
  }
  return best ?? ''
}
