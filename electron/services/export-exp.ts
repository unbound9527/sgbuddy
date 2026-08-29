import * as ExcelJS from 'exceljs'
import { WATERMARK_TEXT } from './export-scheme'

export interface ExpExportData {
  // A 表：怪物经验表（含渲染列：单位经验 / 修正经验 / 效率）
  monsters: Array<{
    name: string; area: string; level: number
    base_exp: number; fatigue: number
    unit_exp: number | null       // 基础经验 ÷ 疲劳消耗
    multiplier: number
    adjusted_exp: number | null   // 单位经验 × 中十加成
    quantity: number
    respawn_time: number
    kill_time: number
    efficiency: number | null     // 每小时疲劳烧速 × 疲劳 × 数量
  }>
  // B 表：每级最优打怪群组合
  bestGrinds: Array<{ level: number; area: string; group: string; weeklyExp: number; explain: string }>
  // C 表：等级经验表
  levelExps: Array<{ level: number; exp: number; standard_unit_exp: number }>
}

// ── 样式工具 ──
const FONT: Partial<ExcelJS.Font> = { size: 12 }
const FONT_BOLD: Partial<ExcelJS.Font> = { size: 12, bold: true }
const NUM_FMT = '#,##0'

function addWatermark(ws: ExcelJS.Worksheet) {
  ws.headerFooter.oddHeader = `&C&24&"Arial,Italic"${WATERMARK_TEXT}`
  ws.headerFooter.oddFooter = `&C&10&"Arial"${WATERMARK_TEXT} 导出`
}

function styleHeader(ws: ExcelJS.Worksheet, cols: number) {
  const row = ws.getRow(1)
  row.height = 24
  for (let c = 1; c <= cols; c++) {
    const cell = ws.getCell(1, c)
    cell.font = FONT_BOLD
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8ECF1' } }
    cell.border = { bottom: { style: 'thin' } }
    cell.alignment = { vertical: 'middle' }
  }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols } }
}

function writeRows(ws: ExcelJS.Worksheet, rows: Array<Array<string | number | null>>) {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const row = ws.getRow(i + 2)
    r.forEach((v, c) => {
      const cell = row.getCell(c + 1)
      if (typeof v === 'number') {
        cell.value = v
        cell.numFmt = NUM_FMT
      } else if (v === null) {
        cell.value = '—'
      } else {
        cell.value = v
      }
      cell.font = FONT
    })
  }
}

// ═══════════════════════════════════════════════
export async function generateExpExcel(data: ExpExportData, filePath: string): Promise<void> {
  const wb = new ExcelJS.Workbook(); wb.creator = WATERMARK_TEXT

  // ═══ Sheet 1: A 怪物经验表 ═══
  const ws1 = wb.addWorksheet('A 怪物经验表'); addWatermark(ws1)
  ws1.columns = [
    { width: 22 }, { width: 14 }, { width: 8 }, { width: 14 }, { width: 10 },
    { width: 12 }, { width: 10 }, { width: 12 }, { width: 8 }, { width: 12 },
    { width: 12 }, { width: 13 },
  ]
  ;['怪物名称', '地区', '等级', '基础经验', '疲劳消耗', '单位经验', '中十倍数', '修正经验', '数量', '刷新周期(秒)', '打怪时间(秒)', '效率(PL/小时)']
    .forEach((h, i) => ws1.getCell(1, i + 1).value = h)
  styleHeader(ws1, 12)
  writeRows(ws1, data.monsters.map(m => [
    m.name, m.area, m.level, m.base_exp, m.fatigue,
    m.unit_exp, m.multiplier, m.adjusted_exp, m.quantity,
    m.respawn_time, m.kill_time, m.efficiency,
  ]))

  // ═══ Sheet 2: B 最优打怪组合 ═══
  const ws2 = wb.addWorksheet('B 最优打怪组合'); addWatermark(ws2)
  ws2.columns = [{ width: 8 }, { width: 14 }, { width: 46 }, { width: 16 }, { width: 70 }]
  ;['等级', '地区', '最优打怪群组合', '每周可获得经验', '为什么']
    .forEach((h, i) => ws2.getCell(1, i + 1).value = h)
  styleHeader(ws2, 5)
  writeRows(ws2, data.bestGrinds.map(g => [
    g.level, g.area, g.group, g.weeklyExp, g.explain,
  ]))

  // ═══ Sheet 3: C 等级经验表 ═══
  const ws3 = wb.addWorksheet('C 等级经验表'); addWatermark(ws3)
  ws3.columns = [{ width: 10 }, { width: 16 }, { width: 18 }]
  ;['等级', '升级经验', '标准单位经验'].forEach((h, i) => ws3.getCell(1, i + 1).value = h)
  styleHeader(ws3, 3)
  writeRows(ws3, data.levelExps.map(l => [l.level, l.exp, l.standard_unit_exp]))

  await wb.xlsx.writeFile(filePath)
}
