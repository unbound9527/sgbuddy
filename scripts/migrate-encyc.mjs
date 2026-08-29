import initSqlJs from 'sql.js'
import fs from 'fs'
import path from 'path'

const DB_PATH = path.join(process.env.APPDATA, 'sgbuddy', 'sgbuddy.db')

// ── 安全检查：确保 App 已关闭（无 WAL 文件残留） ──
const WAL_PATH = DB_PATH + '-wal'
const SHM_PATH = DB_PATH + '-shm'
if (fs.existsSync(WAL_PATH) || fs.existsSync(SHM_PATH)) {
  console.error('❌ 请先关闭 sgbuddy App 再运行此脚本！（检测到 WAL/SHM 文件）')
  console.error(`   ${WAL_PATH}`)
  console.error(`   ${SHM_PATH}`)
  process.exit(1)
}

const SPECIAL_SLOTS = ['翅膀', '符咒', '灵魄', '八阵图', '子女', '灵兽', '元神', '灵珠', '奥义']

async function main() {
  console.log('═══════════════════════════════════════')
  console.log('  物价图鉴 · 虚拟行 → 真实行 迁移脚本')
  console.log('═══════════════════════════════════════')
  console.log(`  数据库: ${DB_PATH}`)

  const SQL = await initSqlJs()
  const fileBuffer = fs.readFileSync(DB_PATH)
  const db = new SQL.Database(fileBuffer)

  // ── Step 1: 统计初始状态 ──
  const before = {
    catalog: db.exec('SELECT COUNT(*) as n FROM item_catalog')[0].values[0][0],
    prices:  db.exec('SELECT COUNT(*) as n FROM price_params')[0].values[0][0],
    servers: db.exec('SELECT COUNT(*) as n FROM servers')[0].values[0][0],
    equip:   db.exec('SELECT COUNT(*) as n FROM equipment_templates')[0].values[0][0],
    mat:     db.exec('SELECT COUNT(*) as n FROM material_library')[0].values[0][0],
  }
  console.log(`\n  ── 迁移前 ──`)
  console.log(`  servers:             ${before.servers}`)
  console.log(`  equipment_templates: ${before.equip}`)
  console.log(`  material_library:    ${before.mat}`)
  console.log(`  item_catalog:        ${before.catalog}`)
  console.log(`  price_params:        ${before.prices}`)

  // ── Step 2: 填充 item_catalog ──
  // 装备（标准槽位）
  db.run(`
    INSERT OR IGNORE INTO item_catalog (category, item_name, quality, craft_level, attr_notes)
    SELECT '装备', name, '', '', '' FROM equipment_templates
  `)

  // 特殊槽位（翅膀、符咒、灵魄等）— category = slot 名
  db.run(`
    INSERT OR IGNORE INTO item_catalog (category, item_name, quality, craft_level, attr_notes)
    SELECT slot, name, '', '', '' FROM equipment_templates
    WHERE slot IN (${SPECIAL_SLOTS.map(s => `'${s}'`).join(',')})
  `)

  // 材料 — category = '材料'
  db.run(`
    INSERT OR IGNORE INTO item_catalog (category, item_name, quality, craft_level, attr_notes)
    SELECT '材料', name, '', '', '' FROM material_library
  `)

  const afterCatalog = db.exec('SELECT COUNT(*) as n FROM item_catalog')[0].values[0][0]
  console.log(`\n  ── item_catalog ──`)
  console.log(`  新增: ${afterCatalog - before.catalog} (${before.catalog} → ${afterCatalog})`)

  // ── Step 3: 为所有大区 × 所有 item_catalog 创建 price_params ──
  // 使用 WHERE NOT EXISTS 避免覆盖已有记录
  db.run(`
    INSERT INTO price_params
      (item_name, category, server_id, quality, craft_level, attr_notes,
       benchmark_price, market_price, spirit_position, is_hot, updated_at)
    SELECT ic.item_name, ic.category, s.id,
           ic.quality, ic.craft_level, ic.attr_notes,
           0, 0, '', 0, datetime('now','localtime')
    FROM item_catalog ic
    CROSS JOIN servers s
    WHERE NOT EXISTS (
      SELECT 1 FROM price_params pp
      WHERE pp.item_name = ic.item_name
        AND pp.server_id = s.id
    )
  `)

  const afterPrices = db.exec('SELECT COUNT(*) as n FROM price_params')[0].values[0][0]
  console.log(`\n  ── price_params ──`)
  console.log(`  新增: ${afterPrices - before.prices} (${before.prices} → ${afterPrices})`)

  // ── Step 4: 写入数据库 ──
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(DB_PATH, buffer)
  db.close()

  console.log(`\n  ✅ 迁移完成！`)
  console.log(`  新增 item_catalog 记录: ${afterCatalog - before.catalog}`)
  console.log(`  新增 price_params 记录: ${afterPrices - before.prices}`)
  console.log(`═══════════════════════════════════════\n`)
}

main().catch(err => {
  console.error('❌ 迁移失败:', err)
  process.exit(1)
})
