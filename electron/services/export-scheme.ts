import * as ExcelJS from 'exceljs'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { getDatabase } from '../database'

export const WATERMARK_TEXT = 'SG Buddy'

export interface SchemeExportData {
  name: string; job: string; level_num: number; total_budget: number
  character_name?: string; notes?: string
  details: Record<string, string>
  slot_price_ids?: Record<string, { i: number; p: number; n: string; q: string } | number>
  lockedSlots?: Record<string, number>   // slot → lock timestamp ms
  equipGroups: Array<{ label: string; slots: string[] }>
  spiritGroups: Array<{ label: string; slots: string[] }>
  shenyuanGroups: Array<{ label: string; slots: string[] }>
  cultivateSlots: string[]
  beastSlots?: Array<{ slotKey: string; category: string; grade: string; name: string }>
  itemQualities?: Record<string, string>   // itemName → quality (物价图鉴中的品质)
}

function getSlot(m: Record<string, any>, slot: string) { const v = m[slot]; return (v && typeof v === 'object' && 'p' in v) ? v as { p: number; n: string; q: string } : null }
function slotPrice(m: Record<string, any>, s: string) { return getSlot(m, s)?.p ?? 0 }
function slotNotes(m: Record<string, any>, s: string) { return getSlot(m, s)?.n ?? '' }
function slotQuality(m: Record<string, any>, s: string, itemQualities: Record<string, string>, itemName: string): string {
  const q = getSlot(m, s)?.q
  if (q) return q
  return itemQualities[itemName] || ''
}
function formatLockTime(ts: number | undefined): string {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// ── 品质 → Excel 颜色 ──
const COLOR_MAP: Record<string, string> = {
  '白': 'FFC0C0C0', '白色': 'FFC0C0C0',
  '绿': 'FF4CAF50', '绿色': 'FF4CAF50',
  '蓝': 'FF2196F3', '蓝色': 'FF2196F3',
  '紫': 'FF9C27B0', '紫色': 'FF9C27B0',
  '橙': 'FFFF9800', '橙色': 'FFFF9800',
  '红': 'FFF44336', '红色': 'FFF44336',
  '金': 'FFFFD700', '金色': 'FFFFD700',
  '天': 'FFFF4444', '地': 'FFFF8800', '玄': 'FFAA00FF', '妙': 'FF4488FF', '凡': 'FF888888',
}
function qualityColor(q: string): string {
  if (!q) return 'FF333333'
  if (COLOR_MAP[q]) return COLOR_MAP[q]
  const n = Number(q)
  if (!isNaN(n)) { if (n <= 2) return COLOR_MAP['绿']; if (n <= 4) return COLOR_MAP['蓝']; return COLOR_MAP['紫'] }
  for (const [k, v] of Object.entries(COLOR_MAP)) { if (k.length > 1 && q.includes(k)) return v }
  return 'FF333333'
}

// ── 样式工具 ──
const FONT: Partial<ExcelJS.Font> = { size: 24 }
function applyQualityFont(cell: ExcelJS.Cell, quality: string) { cell.font = { size: 24, color: { argb: qualityColor(quality) }, bold: true } }
function setNameCell(ws: ExcelJS.Worksheet, row: number, col: number, name: string, quality: string) {
  const cell = ws.getCell(row, col); cell.value = name || '—'; if (name) applyQualityFont(cell, quality)
}
function addWatermark(ws: ExcelJS.Worksheet) {
  ws.headerFooter.oddHeader = `&C&24&"Arial,Italic"${WATERMARK_TEXT}`
  ws.headerFooter.oddFooter = `&C&10&"Arial"${WATERMARK_TEXT} 导出`
}
function protectSheet(ws: ExcelJS.Worksheet) {
  ws.protect('', { selectLockedCells: true, selectUnlockedCells: true, formatCells: false, formatColumns: false, formatRows: false, insertColumns: false, insertRows: false, insertHyperlinks: false, deleteColumns: false, deleteRows: false, sort: false, autoFilter: false, pivotTables: false })
}
function styleHeader(ws: ExcelJS.Worksheet, row: number, cols: number) {
  for (let c = 1; c <= cols; c++) { const cell = ws.getCell(row, c); cell.font = { bold: true, size: 24 }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8ECF1' } }; cell.border = { bottom: { style: 'thin' } } }
}
function styleTotal(ws: ExcelJS.Worksheet, row: number, cols: number) {
  for (let c = 1; c <= cols; c++) { const cell = ws.getCell(row, c); cell.font = { bold: true, size: 24 }; cell.border = { top: { style: 'thin' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } } }
}

// ── 图片 ──
function insertItemImages(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, itemName: string, row: number, col: number) {
  if (!itemName) return 0
  try {
    const imagesDir = join(app.getPath('userData'), 'images')
    const db = getDatabase()
    const rows = db.prepare('SELECT image_path FROM equipment_images WHERE item_name=? ORDER BY sort_order').all(itemName) as Array<{ image_path: string }>
    if (!rows.length) return 0
    let count = 0
    for (const r of rows) {
      const fullPath = join(imagesDir, r.image_path.replace('images/', ''))
      if (!existsSync(fullPath)) continue
      try {
        const buf = readFileSync(fullPath)
        const ext = fullPath.split('.').pop()?.toLowerCase() || 'png'
        const imgId = wb.addImage({ buffer: buf, extension: ext as 'png' | 'jpeg' })
        ws.addImage(imgId, { tl: { col: col + count * 0.8, row: row - 1 }, ext: { width: 50, height: 50 } })
        count++
      } catch { /* skip broken image */ }
    }
    return count
  } catch { return 0 }
}

// ═══════════════════════════════════════════════
export async function generateExcel(data: SchemeExportData, filePath: string): Promise<void> {
  const wb = new ExcelJS.Workbook(); wb.creator = WATERMARK_TEXT
  const m = (data.slot_price_ids || {}) as Record<string, any>
  const iq = data.itemQualities || {}
  const ls = data.lockedSlots || {}

  // 预算汇总
  let eqTotal = 0, spTotal = 0, syTotal = 0, cuTotal = 0, beTotal = 0
  data.equipGroups.forEach(g => g.slots.forEach(s => eqTotal += slotPrice(m, s)))
  data.spiritGroups.forEach(g => g.slots.forEach(s => spTotal += slotPrice(m, s)))
  data.shenyuanGroups.forEach(g => g.slots.forEach(s => syTotal += slotPrice(m, s)))
  data.cultivateSlots.forEach(s => cuTotal += slotPrice(m, s))
  if (data.beastSlots) data.beastSlots.forEach(b => beTotal += slotPrice(m, b.slotKey))
  const allTotal = eqTotal + spTotal + syTotal + cuTotal + beTotal

  // ═══ Sheet 1: 方案概览 ═══
  const ws1 = wb.addWorksheet('方案概览'); addWatermark(ws1)
  ws1.columns = [{ width: 22 }, { width: 56 }]
  let r = 1
  ws1.getCell(`A${r}`).value = '属性'; ws1.getCell(`B${r}`).value = '内容'; styleHeader(ws1, r, 2)
  for (const [k, v] of [['方案名称', data.name], ['角色', data.character_name || '—'], ['职业', data.job], ['等级', `Lv.${data.level_num}`], ['预算', `${data.total_budget} 亿`]] as [string, string][]) {
    r++; ws1.getCell(`A${r}`).value = k; ws1.getCell(`A${r}`).font = FONT; ws1.getCell(`B${r}`).value = v; ws1.getCell(`B${r}`).font = FONT
  }
  r += 2
  ws1.getCell(`A${r}`).value = '费用类别'; ws1.getCell(`B${r}`).value = '合计'; styleHeader(ws1, r, 2)
  for (const [label, total] of [['装备槽位', eqTotal], ['灵魄槽位', spTotal], ['元神', syTotal], ['养成系统', cuTotal], ['灵兽', beTotal]] as [string, number][]) {
    r++; ws1.getCell(`A${r}`).value = label; ws1.getCell(`A${r}`).font = FONT; ws1.getCell(`B${r}`).value = total > 0 ? total + '万' : '—'; ws1.getCell(`B${r}`).font = FONT
  }
  r++; styleTotal(ws1, r, 2)
  ws1.getCell(`A${r}`).value = '总计'; ws1.getCell(`B${r}`).value = allTotal > 0 ? allTotal + '万（约' + (allTotal / 10000).toFixed(2) + '亿）' : '—'
  protectSheet(ws1)

  // ═══ Sheet 2: 装备槽位 ═══
  const ws2 = wb.addWorksheet('装备槽位'); addWatermark(ws2)
  ws2.columns = [{ width: 18 }, { width: 14 }, { width: 44 }, { width: 30 }, { width: 16 }, { width: 18 }, { width: 20 }]
  ;['分组', '部位', '道具', '备注', '价格', '锁定时间', '图片'].forEach((h, i) => ws2.getCell(1, i + 1).value = h)
  styleHeader(ws2, 1, 7)
  let r2 = 2; ws2.getRow(1).height = 28
  for (const g of data.equipGroups) {
    for (const s of g.slots) {
      const name = data.details[s] || ''
      ws2.getRow(r2).height = 60
      ws2.getCell(`A${r2}`).value = g.label; ws2.getCell(`A${r2}`).font = FONT
      ws2.getCell(`B${r2}`).value = s; ws2.getCell(`B${r2}`).font = FONT
      setNameCell(ws2, r2, 3, name, slotQuality(m, s, iq, name))
      ws2.getCell(`D${r2}`).value = slotNotes(m, s); ws2.getCell(`D${r2}`).font = FONT
      const p = slotPrice(m, s); ws2.getCell(`E${r2}`).value = p ? p + '万' : ''; ws2.getCell(`E${r2}`).font = FONT
      ws2.getCell(`F${r2}`).value = formatLockTime(ls[s]); ws2.getCell(`F${r2}`).font = { size: 20, color: { argb: 'FF888888' } }
      insertItemImages(wb, ws2, name, r2, 7)
      r2++
    }
  }
  styleTotal(ws2, r2, 7); ws2.getCell(`A${r2}`).value = '合计'; ws2.getCell(`E${r2}`).value = eqTotal > 0 ? eqTotal + '万' : ''
  protectSheet(ws2)

  // ═══ Sheet 3: 灵魄槽位 ═══
  const ws3 = wb.addWorksheet('灵魄槽位'); addWatermark(ws3)
  ws3.columns = [{ width: 20 }, { width: 14 }, { width: 44 }, { width: 30 }, { width: 16 }, { width: 18 }, { width: 20 }]
  ;['分组', '部位', '道具', '备注', '价格', '锁定时间', '图片'].forEach((h, i) => ws3.getCell(1, i + 1).value = h)
  styleHeader(ws3, 1, 7); ws3.getRow(1).height = 28
  let r3 = 2
  for (const g of data.spiritGroups) {
    for (const s of g.slots) {
      const name = data.details[s] || ''
      ws3.getRow(r3).height = 60
      ws3.getCell(`A${r3}`).value = g.label; ws3.getCell(`A${r3}`).font = FONT
      ws3.getCell(`B${r3}`).value = s.replace('灵', ''); ws3.getCell(`B${r3}`).font = FONT
      setNameCell(ws3, r3, 3, name, slotQuality(m, s, iq, name))
      ws3.getCell(`D${r3}`).value = slotNotes(m, s); ws3.getCell(`D${r3}`).font = FONT
      const p = slotPrice(m, s); ws3.getCell(`E${r3}`).value = p ? p + '万' : ''; ws3.getCell(`E${r3}`).font = FONT
      ws3.getCell(`F${r3}`).value = formatLockTime(ls[s]); ws3.getCell(`F${r3}`).font = { size: 20, color: { argb: 'FF888888' } }
      insertItemImages(wb, ws3, name, r3, 7)
      r3++
    }
  }
  styleTotal(ws3, r3, 7); ws3.getCell(`A${r3}`).value = '合计'; ws3.getCell(`E${r3}`).value = spTotal > 0 ? spTotal + '万' : ''
  protectSheet(ws3)

  // ═══ Sheet 4: 元神 ═══
  const ws4 = wb.addWorksheet('元神'); addWatermark(ws4)
  ws4.columns = [{ width: 18 }, { width: 14 }, { width: 44 }, { width: 30 }, { width: 16 }, { width: 18 }, { width: 20 }]
  ;['分组', '槽位', '道具', '备注', '价格', '锁定时间', '图片'].forEach((h, i) => ws4.getCell(1, i + 1).value = h)
  styleHeader(ws4, 1, 7); ws4.getRow(1).height = 28
  let r4 = 2
  for (const g of data.shenyuanGroups) {
    for (const s of g.slots) {
      const name = data.details[s] || ''
      ws4.getRow(r4).height = 60
      ws4.getCell(`A${r4}`).value = g.label; ws4.getCell(`A${r4}`).font = FONT
      const slotLabel = s.startsWith('元神:背包') ? s.replace('元神:背包', '背包') : s.replace(/^元神:仓\d+/, '')
      ws4.getCell(`B${r4}`).value = slotLabel; ws4.getCell(`B${r4}`).font = FONT
      setNameCell(ws4, r4, 3, name, slotQuality(m, s, iq, name))
      ws4.getCell(`D${r4}`).value = slotNotes(m, s); ws4.getCell(`D${r4}`).font = FONT
      const p = slotPrice(m, s); ws4.getCell(`E${r4}`).value = p ? p + '万' : ''; ws4.getCell(`E${r4}`).font = FONT
      ws4.getCell(`F${r4}`).value = formatLockTime(ls[s]); ws4.getCell(`F${r4}`).font = { size: 20, color: { argb: 'FF888888' } }
      insertItemImages(wb, ws4, name, r4, 7)
      r4++
    }
  }
  styleTotal(ws4, r4, 7); ws4.getCell(`A${r4}`).value = '合计'; ws4.getCell(`E${r4}`).value = syTotal > 0 ? syTotal + '万' : ''
  protectSheet(ws4)

  // ═══ Sheet 5: 养成系统 ═══
  const ws5 = wb.addWorksheet('养成系统'); addWatermark(ws5)
  ws5.columns = [{ width: 14 }, { width: 44 }, { width: 30 }, { width: 16 }, { width: 18 }, { width: 20 }]
  ;['槽位', '道具', '备注', '价格', '锁定时间', '图片'].forEach((h, i) => ws5.getCell(1, i + 1).value = h)
  styleHeader(ws5, 1, 6); ws5.getRow(1).height = 28
  let r5 = 2
  for (const s of data.cultivateSlots) {
    const name = data.details[s] || ''
    ws5.getRow(r5).height = 60
    ws5.getCell(`A${r5}`).value = s; ws5.getCell(`A${r5}`).font = FONT
    setNameCell(ws5, r5, 2, name, slotQuality(m, s, iq, name))
    ws5.getCell(`C${r5}`).value = slotNotes(m, s); ws5.getCell(`C${r5}`).font = FONT
    const p = slotPrice(m, s); ws5.getCell(`D${r5}`).value = p ? p + '万' : ''; ws5.getCell(`D${r5}`).font = FONT
    ws5.getCell(`E${r5}`).value = formatLockTime(ls[s]); ws5.getCell(`E${r5}`).font = { size: 20, color: { argb: 'FF888888' } }
    insertItemImages(wb, ws5, name, r5, 6)
    r5++
  }
  styleTotal(ws5, r5, 6); ws5.getCell(`A${r5}`).value = '合计'; ws5.getCell(`D${r5}`).value = cuTotal > 0 ? cuTotal + '万' : ''
  protectSheet(ws5)

  // ═══ Sheet 6: 灵兽 ═══
  if (data.beastSlots && data.beastSlots.length > 0) {
    const ws6 = wb.addWorksheet('灵兽'); addWatermark(ws6)
    ws6.columns = [{ width: 14 }, { width: 10 }, { width: 36 }, { width: 30 }, { width: 16 }, { width: 18 }, { width: 20 }]
    ;['组别', '品阶', '灵兽', '备注', '价格', '锁定时间', '图片'].forEach((h, i) => ws6.getCell(1, i + 1).value = h)
    styleHeader(ws6, 1, 7); ws6.getRow(1).height = 28
    let r6 = 2
    for (const b of data.beastSlots) {
      ws6.getRow(r6).height = 60
      ws6.getCell(`A${r6}`).value = b.category; ws6.getCell(`A${r6}`).font = FONT
      ws6.getCell(`B${r6}`).value = b.grade; ws6.getCell(`B${r6}`).font = FONT
      setNameCell(ws6, r6, 3, b.name, slotQuality(m, b.slotKey, iq, b.name))
      ws6.getCell(`D${r6}`).value = slotNotes(m, b.slotKey); ws6.getCell(`D${r6}`).font = FONT
      const p = slotPrice(m, b.slotKey); ws6.getCell(`E${r6}`).value = p ? p + '万' : ''; ws6.getCell(`E${r6}`).font = FONT
      ws6.getCell(`F${r6}`).value = formatLockTime(ls[b.slotKey]); ws6.getCell(`F${r6}`).font = { size: 20, color: { argb: 'FF888888' } }
      insertItemImages(wb, ws6, b.name, r6, 7)
      r6++
    }
    styleTotal(ws6, r6, 7); ws6.getCell(`A${r6}`).value = '合计'; ws6.getCell(`E${r6}`).value = beTotal > 0 ? beTotal + '万' : ''
    protectSheet(ws6)
  }

  await wb.xlsx.writeFile(filePath)
}
