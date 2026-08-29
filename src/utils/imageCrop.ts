// 图像裁剪 & 预处理工具（渲染进程，基于 Canvas API）

import type { OcrRegionDef } from '@/data/ocr-regions'

/** 将 dataURL 转换为 HTMLImageElement */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataUrl
  })
}

/**
 * 图像预处理：增强对比度，提升 OCR 识别率。
 * 使用 Canvas 像素操作：对比度拉伸 + 轻微锐化。
 */
export function preprocessImage(source: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = source.naturalWidth
  c.height = source.naturalHeight
  const ctx = c.getContext('2d')!
  ctx.drawImage(source, 0, 0)

  const imageData = ctx.getImageData(0, 0, c.width, c.height)
  const d = imageData.data

  // 计算亮度范围用于对比度拉伸
  let min = 255, max = 0
  for (let i = 0; i < d.length; i += 4) {
    const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114
    if (gray < min) min = gray
    if (gray > max) max = gray
  }

  const range = max - min || 1
  for (let i = 0; i < d.length; i += 4) {
    for (let j = 0; j < 3; j++) {
      // 对比度拉伸：把 [min,max] 映射到 [0,255]
      d[i + j] = Math.round(((d[i + j] - min) / range) * 255)
      // clamp
      if (d[i + j] < 0) d[i + j] = 0
      if (d[i + j] > 255) d[i + j] = 255
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return c
}

/**
 * 从图像中裁剪指定区域。
 * region 坐标为百分比（0-1），相对于原图尺寸。
 */
export function cropRegion(
  source: HTMLImageElement | HTMLCanvasElement,
  region: OcrRegionDef,
): HTMLCanvasElement {
  const srcW = 'naturalWidth' in source ? source.naturalWidth : source.width
  const srcH = 'naturalHeight' in source ? source.naturalHeight : source.height

  // 扩展裁剪区域 20% 以留余量
  const padX = region.w * srcW * 0.1
  const padY = region.h * srcH * 0.1

  const sx = Math.max(0, region.x * srcW - padX)
  const sy = Math.max(0, region.y * srcH - padY)
  const sw = Math.min(srcW - sx, region.w * srcW + padX * 2)
  const sh = Math.min(srcH - sy, region.h * srcH + padY * 2)

  const c = document.createElement('canvas')
  c.width = sw
  c.height = sh
  const ctx = c.getContext('2d')!
  ctx.drawImage(source as any, sx, sy, sw, sh, 0, 0, sw, sh)
  return c
}

/** Canvas 转 PNG buffer */
export function canvasToPng(canvas: HTMLCanvasElement): Uint8Array {
  const dataUrl = canvas.toDataURL('image/png')
  const base64 = dataUrl.split(',')[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Canvas 转 dataURL */
export function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png')
}

/**
 * 按区域配置裁剪图像并返回各区域的 PNG buffer。
 * 如果提供了 preprocessed 参数，从预处理后的画布裁剪；否则从原图裁剪。
 */
export async function cropRegionsFromDataUrl(
  dataUrl: string,
  regions: OcrRegionDef[],
): Promise<Array<{ key: string; label: string; png: Uint8Array }>> {
  const img = await loadImage(dataUrl)
  const preprocessed = preprocessImage(img)

  return regions.map(r => ({
    key: r.key,
    label: r.label,
    png: canvasToPng(cropRegion(preprocessed, r)),
  }))
}
