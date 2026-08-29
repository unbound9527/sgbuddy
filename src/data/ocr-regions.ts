// OCR 区域配置 —— 每种装备类型的截图区域坐标（百分比，0-1）
// 由标注工具 docs/ocr/annotator.html 生成

export interface OcrRegionDef {
  key: string       // 'name' | 'craft_lv' | 'level'
  label: string
  x: number         // 左上角 x（相对图片宽度）
  y: number         // 左上角 y（相对图片高度）
  w: number         // 宽度（相对图片宽度）
  h: number         // 高度（相对图片高度）
}

export interface OcrTypeConfig {
  type: string
  regions: OcrRegionDef[]
}

/**
 * 按装备类型索引的区域配置。
 * 键为 priceForm.category 的值（装备/灵魄/元神/八阵图/子女/灵珠/羽灵/奥义/灵兽）。
 * 未配置的类型回退到全文 OCR。
 */
export const OCR_REGION_CONFIGS: Record<string, OcrTypeConfig> = {
  '装备': {
    type: '装备',
    regions: [
      { key: 'name',      label: '名字',     x: 0.1817, y: 0.0811, w: 0.2684, h: 0.0337 },
      { key: 'craft_lv',  label: '打造等级', x: 0.0288, y: 0.0841, w: 0.1467, h: 0.0337 },
      { key: 'level',     label: '等级',     x: 0.241,  y: 0.848,  w: 0.0843, h: 0.0249 },
    ],
  },
  '灵魄': {
    type: '灵魄',
    regions: [
      { key: 'name',  label: '名字', x: 0.2964, y: 0.0914, w: 0.4094, h: 0.0704 },
    ],
  },
  '元神': {
    type: '元神',
    regions: [
      { key: 'name',  label: '名字', x: 0.2705, y: 0.1031, w: 0.0894, h: 0.0411 },
      { key: 'level', label: '等级', x: 0.6361, y: 0.0987, w: 0.0547, h: 0.0381 },
    ],
  },
}

/** 获取某类型的区域配置，未配置返回 null */
export function getRegionConfig(category: string): OcrTypeConfig | null {
  return OCR_REGION_CONFIGS[category] || null
}
