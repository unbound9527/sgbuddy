// 品质 → 字体颜色（配号中心 / 养成宝典等共用，支持单字和全名）
export const QUALITY_COLORS: Record<string, string> = {
  '白': '#C0C0C0', '白色': '#C0C0C0',
  '绿': '#4CAF50', '绿色': '#4CAF50',
  '蓝': '#42A5F5', '蓝色': '#42A5F5',
  '紫': '#AB47BC', '紫色': '#AB47BC',
  '黄': '#e2c044', '黄色': '#e2c044',
  '橙': '#e8883a', '橙色': '#e8883a',
  '红': '#EF5350', '红色': '#EF5350',
}

// 根据品质/灵兽品阶/阶位等级统一映射颜色
export function getQualityColor(quality: string): string {
  const val = (quality || '').trim()
  if (!val) return 'inherit'
  // 直接匹配装备品质
  if (QUALITY_COLORS[val]) return QUALITY_COLORS[val]
  // 灵兽品阶
  if (val === '天') return QUALITY_COLORS['红']
  if (val === '地') return QUALITY_COLORS['橙']
  if (val === '玄') return QUALITY_COLORS['紫']
  if (val === '妙') return QUALITY_COLORS['蓝']
  if (val === '凡') return QUALITY_COLORS['绿']
  // 阶/级 → 低阶绿、中阶蓝、高阶紫
  const m = val.match(/^(\d+)/)
  if (m) {
    const n = parseInt(m[1])
    if (n <= 2) return QUALITY_COLORS['绿']
    if (n <= 4) return QUALITY_COLORS['蓝']
    return QUALITY_COLORS['紫']
  }
  return 'inherit'
}
