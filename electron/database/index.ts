import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { MONSTER_EXP_DEFAULTS } from './monster-exp-defaults'
import quizBank from '../../src/data/quiz-bank.json'

let db: Database.Database

export function initDatabase(): void {
  const userDataPath = app.getPath('userData')
  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath, { recursive: true })
  }

  const dbPath = join(userDataPath, 'sgbuddy.db')
  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  createTables()
  // 迁移：新增 slot_price_ids 列（存储 {slot: priceParamId}）
  try { db.exec(`ALTER TABLE gear_schemes ADD COLUMN slot_price_ids TEXT DEFAULT '{}'`) } catch { /* 列已存在 */ }
  // 迁移：新增 power 列（配号方案战力，可选；存「阶+品质」如 "1金"/"3蓝"，空串=未设置）
  try { db.exec(`ALTER TABLE gear_schemes ADD COLUMN power TEXT DEFAULT ''`) } catch { /* 列已存在 */ }
  // 迁移：新增 equipment_images 表
  try { db.exec(`CREATE TABLE IF NOT EXISTS equipment_images (id INTEGER PRIMARY KEY AUTOINCREMENT, item_name TEXT NOT NULL, image_path TEXT NOT NULL, sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now','localtime')))`) } catch { /* 表已存在 */ }
  // 迁移：equipment_images 增加 price_id 列（图片与价格记录绑定，避免同名物品图片混用；旧数据为 NULL 按 item_name 回退）
  try { db.exec(`ALTER TABLE equipment_images ADD COLUMN price_id INTEGER DEFAULT NULL`) } catch { /* 列已存在 */ }
  // 迁移：清理重复图片（每个物品/价格记录只保留一张图片，保留最早插入的）
  try {
    db.exec(`
      DELETE FROM equipment_images WHERE id NOT IN (
        SELECT MIN(id) FROM equipment_images WHERE price_id IS NOT NULL GROUP BY price_id
        UNION
        SELECT MIN(id) FROM equipment_images WHERE price_id IS NULL GROUP BY item_name
      )
    `)
  } catch { /* 清理失败不阻塞启动 */ }
  // 迁移：新增 quantity 列（怪物经验表刷怪数量）
  try {
    db.exec(`ALTER TABLE monster_exp ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1`)
    // 仅当列刚被添加时修正已有数据 — 非高疲劳行默认改为 10
    db.exec(`UPDATE monster_exp SET quantity = 10 WHERE fatigue < 1.0`)
  } catch { /* 列已存在 */ }
  // 迁移：新增 respawn_time 列（怪物经验表刷新周期/秒）
  try { db.exec(`ALTER TABLE monster_exp ADD COLUMN respawn_time INTEGER NOT NULL DEFAULT 15`) } catch { /* 列已存在 */ }
  // 迁移：新增 multiplier 列（怪物经验表中十倍数）
  try { db.exec(`ALTER TABLE monster_exp ADD COLUMN multiplier INTEGER NOT NULL DEFAULT 10`) } catch { /* 列已存在 */ }
  // 迁移：新增 kill_time 列（怪物经验表打怪时间/秒，默认 2 秒 = 打死一批怪所需时间）
  try { db.exec(`ALTER TABLE monster_exp ADD COLUMN kill_time INTEGER NOT NULL DEFAULT 2`) } catch { /* 列已存在 */ }
  // 修正旧默认：kill_time 0（无打怪耗时）→ 2 秒（用户手动改过的非 0 值保留）
  try { db.exec(`UPDATE monster_exp SET kill_time = 2 WHERE kill_time = 0`) } catch { /* 列不存在 */ }
  // 迁移：删除 equipment_templates 表（已解耦，改用 price_params/material_library/item_catalog）
  try { db.exec(`DROP TABLE IF EXISTS equipment_templates`) } catch { /* 表已删除 */ }
  // ── price_params 价格单位约定 ──
  // benchmark_price / market_price / price_history 存储单位为「亿三国币」（界面统一按「万三国币」呈现：
  // 录入 fromWan 万→亿，行内编辑显示 ×10000）。请勿改动存储单位，改动需同步迁移两张表存量数据与全部换算点。
  // 迁移：price_params 增加 slot 部位列（配号中心按部位分配装备候选）
  try { db.exec(`ALTER TABLE price_params ADD COLUMN slot TEXT DEFAULT ''`) } catch { /* 列已存在 */ }
  // 迁移：item_catalog 增加 slot 部位列（与 price_params 保持一致）
  try { db.exec(`ALTER TABLE item_catalog ADD COLUMN slot TEXT DEFAULT ''`) } catch { /* 列已存在 */ }
  // 迁移：price_params 增加 attrs 属性列（OCR 识别属性与手写备注分离）
  try { db.exec(`ALTER TABLE price_params ADD COLUMN attrs TEXT DEFAULT ''`) } catch { /* 列已存在 */ }
  // 迁移：item_catalog 增加 attrs 属性列（配号中心候选笔记展示属性）
  try { db.exec(`ALTER TABLE item_catalog ADD COLUMN attrs TEXT DEFAULT ''`) } catch { /* 列已存在 */ }
  // 迁移：price_params 重建唯一约束含 attrs（同物品不同属性 = 不同记录）
  // SQLite 无法修改 UNIQUE，重建表搬迁数据（旧数据 attrs 为空，属性仍在 attr_notes 中）
  try {
    const priceSql = (db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='price_params'`).get() as any)?.sql ?? ''
    if (priceSql.includes('attrs') && !/UNIQUE\([^)]*attrs/.test(priceSql)) {
      db.exec(`
        BEGIN;
        CREATE TABLE price_params_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          server_id INTEGER NOT NULL,
          category TEXT NOT NULL,
          item_name TEXT NOT NULL,
          quality TEXT DEFAULT '',
          craft_level TEXT DEFAULT '',
          attr_notes TEXT DEFAULT '',
          attrs TEXT DEFAULT '',
          benchmark_price REAL DEFAULT 0,
          is_hot INTEGER DEFAULT 0,
          market_price REAL DEFAULT 0,
          equip_level INTEGER,
          equip_job TEXT DEFAULT '',
          spirit_position TEXT DEFAULT '',
          slot TEXT DEFAULT '',
          updated_at TEXT DEFAULT (datetime('now','localtime')),
          UNIQUE(server_id, category, item_name, quality, craft_level, attr_notes, attrs)
        );
        INSERT OR IGNORE INTO price_params_new (id, server_id, category, item_name, quality, craft_level, attr_notes, benchmark_price, is_hot, market_price, equip_level, equip_job, spirit_position, slot, updated_at)
          SELECT id, server_id, category, item_name,
            COALESCE(quality, ''), COALESCE(craft_level, ''), COALESCE(attr_notes, ''),
            benchmark_price, is_hot, market_price, equip_level, equip_job, spirit_position, slot, updated_at
          FROM price_params;
        DROP TABLE price_params;
        ALTER TABLE price_params_new RENAME TO price_params;
        COMMIT;
      `)
    }
  } catch (e) { console.warn('[迁移] price_params 唯一约束重建失败:', e) }
  // 迁移：asset_wallet 增加现金投入列（宝典解锁用现金购买装备时计入起步资金成本）
  try { db.exec('ALTER TABLE asset_wallet ADD COLUMN cash_injected REAL DEFAULT 0') } catch { /* 列已存在 */ }
  // 迁移：growth_journey 增加本宝典起步基准列（新建宝典时的既有配置估值，指标随选中宝典展示）
  try { db.exec('ALTER TABLE growth_journey ADD COLUMN starting_basis REAL DEFAULT 0') } catch { /* 列已存在 */ }
  // 迁移：宝典独立核算——流水挂 journey_id，宝典行记录各自初始流动资金
  try { db.exec('ALTER TABLE asset_records ADD COLUMN journey_id INTEGER') } catch { /* 列已存在 */ }
  try { db.exec('ALTER TABLE growth_journey ADD COLUMN starting_liquid REAL DEFAULT 0') } catch { /* 列已存在 */ }
  // 迁移：growth_journey 增加职业列（新建宝典时锁定配置职业，调整目标只能选同职业方案）
  try { db.exec("ALTER TABLE growth_journey ADD COLUMN job TEXT DEFAULT ''") } catch { /* 列已存在 */ }
  try {
    // 存量流水归入各服第一个激活宝典
    db.exec(`
      UPDATE asset_records SET journey_id = (
        SELECT MIN(gj.id) FROM growth_journey gj WHERE gj.server_id = asset_records.server_id AND gj.status = 'active'
      ) WHERE journey_id IS NULL
    `)
    // 首个激活宝典继承钱包的初始流动资金与初始固定（作为该宝典起步基准）；有流水的宝典不重复继承
    db.exec(`
      UPDATE growth_journey SET starting_liquid = COALESCE((
        SELECT w.starting_liquid FROM asset_wallet w WHERE w.server_id = growth_journey.server_id
      ), 0)
      WHERE starting_liquid = 0 AND NOT EXISTS (SELECT 1 FROM asset_records ar WHERE ar.journey_id = growth_journey.id)
        AND id IN (SELECT MIN(id) FROM growth_journey WHERE status = 'active' GROUP BY server_id)
    `)
    db.exec(`
      UPDATE growth_journey SET starting_basis = COALESCE((
        SELECT w.starting_fixed FROM asset_wallet w WHERE w.server_id = growth_journey.server_id
      ), 0)
      WHERE starting_basis = 0
        AND NOT EXISTS (SELECT 1 FROM asset_records ar WHERE ar.journey_id = growth_journey.id)
        AND id IN (SELECT MIN(id) FROM growth_journey WHERE status = 'active' GROUP BY server_id)
    `)
  } catch (e) { console.warn('[迁移] 宝典流水归集失败:', e) }
  // 迁移：背包按宝典独立——backpack_items 挂 journey_id（存量归到该服最新激活宝典，与默认选中一致）
  // SQLite 无法修改 UNIQUE，重建表搬迁数据
  try {
    const bpSql = (db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='backpack_items'`).get() as any)?.sql ?? ''
    if (!bpSql.includes('journey_id')) {
      db.exec(`
        BEGIN;
        CREATE TABLE backpack_items_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          server_id INTEGER NOT NULL,
          journey_id INTEGER NOT NULL DEFAULT 0,
          price_param_id INTEGER NOT NULL,
          item_name TEXT NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now','localtime')),
          updated_at TEXT DEFAULT (datetime('now','localtime')),
          UNIQUE(server_id, journey_id, price_param_id),
          FOREIGN KEY (server_id) REFERENCES servers(id)
        );
        INSERT INTO backpack_items_new (id, server_id, journey_id, price_param_id, item_name, quantity, created_at, updated_at)
          SELECT id, server_id,
            COALESCE((SELECT MAX(gj.id) FROM growth_journey gj WHERE gj.server_id = backpack_items.server_id AND gj.status = 'active'), 0),
            price_param_id, item_name, quantity, created_at, updated_at
          FROM backpack_items;
        DROP TABLE backpack_items;
        ALTER TABLE backpack_items_new RENAME TO backpack_items;
        COMMIT;
      `)
    }
  } catch (e) { console.warn('[迁移] 背包按宝典独立失败:', e) }
  // 迁移：背包唯一键含 item_name——图鉴外装备（price_param_id=0）也能按名字独立入库
  try {
    const bpSql = (db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='backpack_items'`).get() as any)?.sql ?? ''
    if (!/UNIQUE\([^)]*price_param_id[^)]*item_name/.test(bpSql)) {
      db.exec(`
        BEGIN;
        CREATE TABLE backpack_items_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          server_id INTEGER NOT NULL,
          journey_id INTEGER NOT NULL DEFAULT 0,
          price_param_id INTEGER NOT NULL DEFAULT 0,
          item_name TEXT NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now','localtime')),
          updated_at TEXT DEFAULT (datetime('now','localtime')),
          UNIQUE(server_id, journey_id, price_param_id, item_name),
          FOREIGN KEY (server_id) REFERENCES servers(id)
        );
        INSERT INTO backpack_items_new (id, server_id, journey_id, price_param_id, item_name, quantity, created_at, updated_at)
          SELECT id, server_id, journey_id, price_param_id, item_name, quantity, created_at, updated_at
          FROM backpack_items;
        DROP TABLE backpack_items;
        ALTER TABLE backpack_items_new RENAME TO backpack_items;
        COMMIT;
      `)
    }
  } catch (e) { console.warn('[迁移] 背包唯一键含物品名失败:', e) }
  // 背包不保留数量为 0 的物品（清历史残留；此后各扣减点会在归零时删行）
  try { db.exec('DELETE FROM backpack_items WHERE quantity <= 0') } catch { /* 表不存在时忽略 */ }
  // 迁移：清除配号方案中的孤立槽位 key「灵兽」
  // 背景：早期养成页签有一张独立的「灵兽」槽位卡，后被灵兽页签（key 格式：灵兽:分类:品级:序号）取代。
  // 遗留在 details/slot_price_ids 中的普通 key「灵兽」界面上没有任何卡槽 → 看不到、也上不了锁，
  // 金额却被统计进方案总价和「可调」，导致仪表盘「可调」永远清不掉。这里一次性清除（幂等）。
  try {
    const rows = db.prepare('SELECT id, details, slot_price_ids FROM gear_schemes').all() as any[]
    const upd = db.prepare('UPDATE gear_schemes SET details=?, slot_price_ids=? WHERE id=?')
    const scrub = () => {
      for (const r of rows) {
        const parse = (v: any) => { try { return typeof v === 'string' ? JSON.parse(v || '{}') : (v || {}) } catch { return {} } }
        const d = parse(r.details)
        const s = parse(r.slot_price_ids)
        let changed = false
        if (d && typeof d === 'object' && '灵兽' in d) { delete d['灵兽']; changed = true }
        if (s && typeof s === 'object' && '灵兽' in s) { delete s['灵兽']; changed = true }
        if (changed) upd.run(JSON.stringify(d), JSON.stringify(s), r.id)
      }
    }
    db.transaction(scrub)()
  } catch (e) { console.warn('[迁移] 清理孤立槽位「灵兽」失败:', e) }
  // 迁移：trade_clues 增加软删除墓碑列（删除不删行，靠 deleted_at 隔离，避免下次抓取同帖复活）
  try { db.exec(`ALTER TABLE trade_clues ADD COLUMN deleted_at TEXT DEFAULT NULL`) } catch { /* 列已存在 */ }
  // 迁移：trade_clues 增加绝对发帖时间列（posted_at 是相对文案「x小时前」；此列存归一化的 yyyy-MM-dd HH:mm:ss）
  try { db.exec(`ALTER TABLE trade_clues ADD COLUMN posted_at_abs TEXT DEFAULT ''`) } catch { /* 列已存在 */ }
  seedBaseData()
}

function createTables(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      currency_rate REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

	    CREATE TABLE IF NOT EXISTS price_params (
	      id INTEGER PRIMARY KEY AUTOINCREMENT,
	      server_id INTEGER NOT NULL,
	      category TEXT NOT NULL,
	      item_name TEXT NOT NULL,
	      quality TEXT DEFAULT '',
	      craft_level TEXT DEFAULT '',
	      attr_notes TEXT DEFAULT '',
	      attrs TEXT DEFAULT '',
	      benchmark_price REAL DEFAULT 0,
	      is_hot INTEGER DEFAULT 0,
	      market_price REAL DEFAULT 0,
	      equip_level INTEGER,
	      equip_job TEXT DEFAULT '',
	      spirit_position TEXT DEFAULT '',
	      updated_at TEXT DEFAULT (datetime('now','localtime')),
	      UNIQUE(server_id, category, item_name, quality, craft_level, attr_notes, attrs)
	    );

	    CREATE TABLE IF NOT EXISTS item_catalog (
	      id INTEGER PRIMARY KEY AUTOINCREMENT,
	      category TEXT NOT NULL,
	      item_name TEXT NOT NULL,
	      quality TEXT DEFAULT '',
	      craft_level TEXT DEFAULT '',
	      attr_notes TEXT DEFAULT '',
	      attrs TEXT DEFAULT '',
	      equip_level INTEGER,
	      equip_job TEXT DEFAULT '',
	      spirit_position TEXT DEFAULT '',
	      created_at TEXT DEFAULT (datetime('now','localtime')),
	      UNIQUE(category, item_name, quality, craft_level, attr_notes)
	    );

    CREATE TABLE IF NOT EXISTS gear_schemes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      character_name TEXT DEFAULT '',
      server_id INTEGER,
      level_range TEXT DEFAULT '',
      job TEXT DEFAULT '',
      level_num INTEGER DEFAULT 100,
      total_budget REAL DEFAULT 0,
      details TEXT DEFAULT '{}',
      notes TEXT DEFAULT '',
      power TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (server_id) REFERENCES servers(id)
    );

    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      server_id INTEGER,
      job TEXT NOT NULL,
      level INTEGER NOT NULL,
      current_gear TEXT DEFAULT '{}',
      growth_goals TEXT DEFAULT '{}',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (server_id) REFERENCES servers(id)
    );

    CREATE TABLE IF NOT EXISTS trade_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER,
      item_name TEXT NOT NULL,
      category TEXT DEFAULT '',
      trade_type TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      profit REAL DEFAULT 0,
      notes TEXT DEFAULT '',
      traded_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (server_id) REFERENCES servers(id)
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER,
      item_name TEXT NOT NULL,
      category TEXT DEFAULT '',
      buy_price REAL NOT NULL,
      buy_quantity INTEGER DEFAULT 1,
      target_price REAL DEFAULT 0,
      shop_index INTEGER DEFAULT 0,
      business_id INTEGER DEFAULT 0,
      status TEXT DEFAULT '持有',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (server_id) REFERENCES servers(id)
    );

    CREATE TABLE IF NOT EXISTS growth_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      log_type TEXT NOT NULL,
      detail TEXT DEFAULT '',
      cost REAL DEFAULT 0,
      logged_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS material_library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT DEFAULT '',
      grade INTEGER DEFAULT 1,
      synthesis_formula TEXT DEFAULT '{}',
      drop_sources TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

	    CREATE TABLE IF NOT EXISTS currency_rate_history (
	      id INTEGER PRIMARY KEY AUTOINCREMENT,
	      server_id INTEGER NOT NULL DEFAULT 0,
	      rate REAL NOT NULL,
	      recorded_at TEXT DEFAULT (datetime('now','localtime'))
	    );

	    CREATE TABLE IF NOT EXISTS trade_clues (
	      id INTEGER PRIMARY KEY AUTOINCREMENT,
	      server_name TEXT NOT NULL,
	      source TEXT NOT NULL,
	      keyword TEXT NOT NULL,
	      title TEXT NOT NULL,
	      content_preview TEXT DEFAULT '',
	      url TEXT NOT NULL,
	      author_name TEXT DEFAULT '',
	      price_text TEXT DEFAULT '',
	      posted_at TEXT DEFAULT '',
	      collected_at TEXT DEFAULT (datetime('now','localtime')),
	      status TEXT DEFAULT 'new',
	      UNIQUE(url)
		    );

		    CREATE TABLE IF NOT EXISTS ai_schemes (
		      id INTEGER PRIMARY KEY AUTOINCREMENT,
		      job TEXT NOT NULL,
		      level INTEGER NOT NULL,
		      budget INTEGER NOT NULL,
		      style TEXT NOT NULL DEFAULT '通用',
		      extra_notes TEXT DEFAULT '',
		      server_name TEXT DEFAULT '',
		      scheme_json TEXT NOT NULL,
		      total_cost INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT ''
      );

      -- 防骗黑名单：server_id 0 = 全大区通用条目；source local=本地录入 / cloud=云端同步（预留）
      -- 建表语句幂等（IF NOT EXISTS），存量数据库升级时自动补表
      CREATE TABLE IF NOT EXISTS scammer_blacklist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER NOT NULL DEFAULT 0,
        role_name TEXT NOT NULL,
        method TEXT NOT NULL DEFAULT '其他',
        description TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT 'local',
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS win_presets (
        title TEXT PRIMARY KEY,
        slot INTEGER NOT NULL DEFAULT 0,
        label TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS daily_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_name TEXT NOT NULL DEFAULT '',
        icon TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL,
        desc TEXT DEFAULT '',
        url TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS profit_calculations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      cost_price REAL NOT NULL,
      sell_price REAL NOT NULL,
      tax_rate REAL DEFAULT 0.03,
      stall_fee REAL DEFAULT 0,
      net_profit REAL NOT NULL,
      profit_margin REAL NOT NULL,
      calculated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- 养成宝典：钱包（每大区一条，起步资金冻结不随行情变化）
    CREATE TABLE IF NOT EXISTS asset_wallet (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      starting_liquid REAL DEFAULT 0,
      starting_fixed REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE(server_id)
    );

    -- 养成宝典：收支流水。source: active(活跃)/item(道具)/manual(直录)/gear(购装备)/adjust(纠错±)
    -- gear 类型计入余额公式但不计入收益统计；active 同日重提由渲染层覆盖
    CREATE TABLE IF NOT EXISTS asset_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      record_date TEXT NOT NULL,
      type TEXT NOT NULL,
      source TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      detail TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (server_id) REFERENCES servers(id)
    );

    -- 养成宝典：背包资产（按大区+图鉴物品聚合数量，估值按图鉴市场价实时折算）
    CREATE TABLE IF NOT EXISTS backpack_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      price_param_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE(server_id, price_param_id),
      FOREIGN KEY (server_id) REFERENCES servers(id)
    );

    -- 养成宝典：宝典档案（每大区可多条激活）。nodes JSON:
    -- [{slot, fromItem, toItem, fromPriceId, priceParamId, cost, claimed, paid, claimedAt, recordId}]
    CREATE TABLE IF NOT EXISTS growth_journey (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      name TEXT DEFAULT '',
      job TEXT DEFAULT '',
      current_snapshot TEXT DEFAULT '{}',
      target_snapshot TEXT DEFAULT '{}',
      nodes TEXT DEFAULT '[]',
      status TEXT DEFAULT 'active',
      opened_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (server_id) REFERENCES servers(id)
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      price_param_id INTEGER NOT NULL,
      benchmark_price REAL DEFAULT 0,
      market_price REAL DEFAULT 0,
      changed_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS boss_handbook (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL DEFAULT '',
      speed INTEGER DEFAULT 0,
      hp INTEGER DEFAULT 0,
      force INTEGER DEFAULT 0,
      intelligence INTEGER DEFAULT 0,
      constitution INTEGER DEFAULT 0,
      accuracy INTEGER DEFAULT 0,
      agility INTEGER DEFAULT 0,
      phys_atk INTEGER DEFAULT 0,
      phys_def INTEGER DEFAULT 0,
      magic_atk INTEGER DEFAULT 0,
      magic_def INTEGER DEFAULT 0,
      exp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 0,
      fervor INTEGER DEFAULT 0,
      charm_poly INTEGER DEFAULT 0,
      guard INTEGER DEFAULT 0,
      immortal INTEGER DEFAULT 0,
      bold_fields TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS level_exp (
      level INTEGER PRIMARY KEY,
      exp INTEGER NOT NULL DEFAULT 0,
      standard_unit_exp INTEGER DEFAULT 0,
      exp_time_no_accel TEXT DEFAULT '',
      cumulative_time_no_accel TEXT DEFAULT '',
      shenyou_unit_exp INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS monster_exp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      area TEXT NOT NULL DEFAULT '',
      level INTEGER NOT NULL DEFAULT 0,
      base_exp INTEGER NOT NULL DEFAULT 0,
      fatigue REAL NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL DEFAULT 1,
      respawn_time INTEGER NOT NULL DEFAULT 15,
      kill_time INTEGER NOT NULL DEFAULT 2,
      multiplier INTEGER NOT NULL DEFAULT 10,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS quiz_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL DEFAULT 'general',
      question TEXT NOT NULL DEFAULT '',
      answer TEXT NOT NULL DEFAULT '',
      _q TEXT DEFAULT '',
      _a TEXT DEFAULT '',
      _qi TEXT DEFAULT '',
      _qp TEXT DEFAULT '',
      _ai TEXT DEFAULT '',
      _ap TEXT DEFAULT '',
      _search TEXT DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `)

  // Migration: add bold_fields column if missing (2026-07-29)
  try {
    db.exec(`ALTER TABLE boss_handbook ADD COLUMN bold_fields TEXT DEFAULT '[]'`)
  } catch (_) {
    // column already exists, ignore
  }
}

/* ═══════════════════════════════════════
   Seed Data
   ═══════════════════════════════════════ */

function seedBaseData(): void {
  // 区服：始终尝试补入新区服（INSERT OR IGNORE）
  seedServers()

  const matCount = (db.prepare('SELECT COUNT(*) as cnt FROM material_library').get() as { cnt: number }).cnt

  if (matCount === 0) {
    seedMaterials()
    seedCommonMaterials()
  }
  seedDailyLinks()
  seedMonsterExp()
  seedQuiz()
  dedupeQuiz()
}

function seedMonsterExp(): void {
  const count = (db.prepare('SELECT COUNT(*) as cnt FROM monster_exp').get() as { cnt: number }).cnt
  if (count > 0) return

  const insert = db.prepare(
    'INSERT INTO monster_exp (name, area, level, base_exp, fatigue, quantity, respawn_time, multiplier) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
  const tx = db.transaction(() => {
    for (const row of MONSTER_EXP_DEFAULTS) {
      const isHighFatigue = row.fatigue >= 1.0
      const quantity = isHighFatigue ? 1 : 10
      const respawnTime = isHighFatigue ? 90 : 15
      insert.run(row.name, row.area, row.level, row.base_exp, row.fatigue, quantity, respawnTime, 10)
    }
  })
  tx()
}

function seedQuiz(): void {
  const count = (db.prepare('SELECT COUNT(*) as cnt FROM quiz_questions').get() as { cnt: number }).cnt
  if (count > 0) return

  const insert = db.prepare(`
    INSERT INTO quiz_questions (id, category, question, answer, _q, _a, _qi, _qp, _ai, _ap, _search)
    VALUES (@id, @category, @question, @answer, @_q, @_a, @_qi, @_qp, @_ai, @_ap, @_search)
  `)

  // JSON 里 id=102 有两条不同题目：重复的 id 传 null，交给 AUTOINCREMENT 重新分配
  const seen = new Set<number>()
  // 按「题目 + 答案」去重：问答对只保留第一条
  const seenQA = new Set<string>()
  const tx = db.transaction(() => {
    for (const q of quizBank as Array<Record<string, unknown>>) {
      const qaKey = `${String(q.question ?? '').trim()}${String(q.answer ?? '').trim()}`
      if (seenQA.has(qaKey)) continue
      seenQA.add(qaKey)
      const qid = typeof q.id === 'number' ? q.id : null
      const id = qid != null && !seen.has(qid) ? qid : null
      if (qid != null) seen.add(qid)
      insert.run({
        id,
        category: String(q.category ?? 'general'),
        question: String(q.question ?? ''),
        answer: String(q.answer ?? ''),
        _q: String(q._q ?? ''),
        _a: String(q._a ?? ''),
        _qi: String(q._qi ?? ''),
        _qp: String(q._qp ?? ''),
        _ai: String(q._ai ?? ''),
        _ap: String(q._ap ?? ''),
        _search: String(q._search ?? ''),
      })
    }
  })
  tx()
}

/** 按「题目 + 答案」去重（幂等，每次启动执行）：保留每组 id 最小的一条 */
function dedupeQuiz(): void {
  db.exec(`
    DELETE FROM quiz_questions
    WHERE EXISTS (
      SELECT 1 FROM quiz_questions AS b
      WHERE TRIM(b.question) = TRIM(quiz_questions.question)
        AND TRIM(b.answer) = TRIM(quiz_questions.answer)
        AND b.id < quiz_questions.id
    )
  `)
}

function seedServers(): void {
  // 先查出已有区服，避免重复插入（name 无唯一约束，INSERT OR IGNORE 不生效）
  const existing = new Set(
    (db.prepare('SELECT name FROM servers').all() as Array<{ name: string }>).map(r => r.name)
  )
  const insert = db.prepare('INSERT INTO servers (name) VALUES (?)')
  const names = [
    '得陇望蜀', '群雄逐鹿', '桃园结义', '牛刀小试', '铜台锁梦',
    '翩若惊鸿', '山海风云', '故地重游', '巧借东风', '皇榜征兵',
    '杜康解忧', '天下归心', '十八诸侯', '云骑长歌', '三足鼎立',
    '一代枭雄', '暗度陈仓', '单刀赴会', '抚琴退敌', '诗酒江陵',
    '百骑劫营', '威震江东', '一生所爱', '青梅拾酒',
  ]
  for (const n of names) {
    if (!existing.has(n)) insert.run(n)
  }

  // 删除不在列表中的旧区服
  const keep = names.map(n => `'${n}'`).join(',')
  db.exec(`DELETE FROM servers WHERE name NOT IN (${keep})`)
  // 去重：同名区服只保留 id 最小的（历史遗留数据）
  db.exec(`DELETE FROM servers WHERE id NOT IN (SELECT MIN(id) FROM servers GROUP BY name)`)
}

/* ── 材料图鉴（真实QQ三国数据） ── */

function seedMaterials(): void {
  const cnt = (db.prepare('SELECT COUNT(*) as cnt FROM material_library').get() as { cnt: number }).cnt
  if (cnt > 0) return

  const insert = db.prepare(`
    INSERT INTO material_library (name, category, grade, synthesis_formula, drop_sources, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const seed = db.transaction(() => {
    // ── 晶玉（1-15级，各黄/橙/红） ──
    for (let g = 1; g <= 15; g++) {
      const formula = g === 1 ? '无（基础材料）' : `5 个${g-1}级晶玉 → 1 个${g}级晶玉`
      for (const q of ['黄色','橙色','红色']) {
        insert.run(`${g}级${q}晶玉`, '晶玉', g, JSON.stringify({合成: formula, 品质: q}), '副本掉落 / 玩家交易', `${q}品质-${g}级`)
      }
    }

    // ── 强化灵宝（人阶/地阶/天阶） ──
    insert.run('人阶强化灵宝', '强化石', 1, JSON.stringify({说明: '基础强化材料，适用于低阶装备'}), '副本 / 活动 / 商城', '日常强化消耗')
    insert.run('地阶强化灵宝', '强化石', 2, JSON.stringify({说明: '中阶强化材料，适用于中阶装备'}), '副本 / 活动 / 商城', '中阶强化消耗')
    insert.run('天阶强化灵宝', '强化石', 3, JSON.stringify({说明: '高阶强化材料，适用于高阶装备'}), '副本 / 活动 / 商城', '高阶强化消耗')

    // ── 打孔石 ──
    const drillStones = [
      { g: 1, name: '初级嵌器之石', note: '打孔术入门' },
      { g: 2, name: '二级嵌器之石', note: '打孔术入门' },
      { g: 3, name: '三级嵌器玉石', note: '初级打孔术' },
      { g: 4, name: '四级嵌器宝石', note: '高级打孔秘法' },
      { g: 5, name: '五级嵌器灵石', note: '打孔禁法地之卷' },
    ]
    for (const d of drillStones) {
      insert.run(d.name, '打孔石', d.g, JSON.stringify({}), '镶工制作 / 商城 / 活动', d.note)
    }

    // ── 修复宝石 ──
    insert.run('次级修复宝石', '修复石', 1, JSON.stringify({合成: '凡晶石×1 + 小凿子×1'}), '工匠制作', '国令任务消耗品')
    insert.run('下品修复宝石', '修复石', 2, JSON.stringify({合成: '凡晶石×2 + 小凿子×2'}), '工匠制作', '国令任务消耗品')
    insert.run('中品修复宝石', '修复石', 3, JSON.stringify({合成: '黑岩石×2 + 精致凿×2'}), '工匠制作', '国令任务消耗品')
    insert.run('下品复原灵石', '修复石', 4, JSON.stringify({合成: '蓝纹玉×1 + 小凿子×1 + 绿松石×1'}), '工匠制作', '修复装备耐久')
    insert.run('中品复原灵石', '修复石', 5, JSON.stringify({合成: '符文水晶×1 + 精致凿×1 + 水晶×1'}), '工匠制作', '修复装备耐久')

    // ── 镶嵌宝石 ──
    insert.run('血气之玉', '镶嵌宝石', 1, JSON.stringify({效果: '+生命上限'}), '镶工制作', '镶嵌:头/衣/裤/面')
    insert.run('玄力水晶', '镶嵌宝石', 2, JSON.stringify({效果: '+蓝量上限'}), '镶工制作', '镶嵌:头/衣/裤/面')
    insert.run('再生之玉', '镶嵌宝石', 3, JSON.stringify({效果: '+回蓝速度'}), '镶工制作', '镶嵌:裤子')
    insert.run('化伤为命玉', '镶嵌宝石', 4, JSON.stringify({效果: '攻击吸血'}), '镶工制作', '镶嵌:物系武器')
    insert.run('化伤为体玉', '镶嵌宝石', 5, JSON.stringify({效果: '受伤回蓝'}), '镶工制作', '镶嵌:衣服')
    insert.run('必杀之玉', '镶嵌宝石', 6, JSON.stringify({效果: '+暴击率'}), '镶工制作', '镶嵌:物系武器')
    insert.run('宁神玉', '镶嵌宝石', 7, JSON.stringify({效果: '减少聚气'}), '镶工制作', '镶嵌:法系武器')
    insert.run('风行石', '镶嵌宝石', 8, JSON.stringify({效果: '+速度'}), '镶工制作', '镶嵌:鞋子')
    insert.run('荆棘石', '镶嵌宝石', 9, JSON.stringify({效果: '反弹伤害'}), '镶工制作', '镶嵌:衣服')

    // ── 元素材料 ──
    const elements = [
      { name: '水之精萃', chain: '水之微尘×10 = 井水×40' },
      { name: '火之精萃', chain: '火之微尘×10 = 烟煤×40' },
      { name: '土之精萃', chain: '土之微尘×10 = 松煤×10' },
      { name: '木之精萃', chain: '木之微尘×10 = 木炭×80' },
      { name: '金之精萃', chain: '金之微尘×10 = 精致凿×40' },
      { name: '银之精萃', chain: '银之微尘×10 = 小凿子×80' },
      { name: '铜之精萃', chain: '铜之微尘×10 = 小铁锥×40' },
      { name: '风之精萃', chain: '风之微尘×10' },
      { name: '雷之精萃', chain: '雷之微尘×10' },
      { name: '电之精萃', chain: '电之微尘×10' },
      { name: '生态之源', chain: '水火土木精萃各×1' },
      { name: '财富之源', chain: '金银铜精萃各×1' },
      { name: '能量之源', chain: '风雷电精萃各×1' },
    ]
    for (const e of elements) {
      insert.run(e.name, '元素材料', 1, JSON.stringify({合成链: e.chain}), '工匠合成', '装备打造必需材料')
    }

    // ── 基础矿石 ──
    const ores = [
      { name: '灰炭石', chain: '击杀流窜的窃贼 / 国家任务' },
      { name: '凡晶石', chain: '击杀流窜的窃贼 / 国家任务' },
      { name: '黑岩石', chain: '击杀流窜的窃贼 / 国家任务' },
      { name: '铁原石', chain: '击杀流窜的窃贼 / 军团商人' },
      { name: '石英石', chain: '击杀流窜的窃贼 / 军团商人' },
      { name: '绿松石', chain: '灰炭石×2 + 烟煤×2（工匠合成）' },
      { name: '水晶', chain: '凡晶石×2 + 烟煤×4（工匠合成）' },
      { name: '黑玛瑙', chain: '黑岩石×2 + 松煤×2（工匠合成）' },
      { name: '碎玉', chain: '副本产出' },
      { name: '轮回之力', chain: '副本产出' },
    ]
    for (const o of ores) {
      insert.run(o.name, '基础矿石', 1, JSON.stringify({来源: o.chain}), '打怪掉落 / 工匠合成', '')
    }
  })

  seed()
}

/* ── 常见材料补充（INSERT OR IGNORE，始终执行） ── */

function seedCommonMaterials(): void {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO material_library (name, category, grade, synthesis_formula, drop_sources, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const items: Array<{ name: string; category: string; grade: number; formula: string; source: string; note: string }> = [
    // 货币
    { name: '五铢', category: '货币', grade: 1, formula: '日常任务/活动产出', source: '日常任务 / 活动', note: '绑定货币' },
    { name: '三国点', category: '货币', grade: 1, formula: '充值获得', source: '充值 / 玩家交易', note: '商城消费货币' },
    // 消耗品
    { name: '帝休木', category: '消耗品', grade: 1, formula: '副本掉落', source: '副本 / 活动 / 商城', note: '经络系统消耗品' },
    { name: '香墨', category: '消耗品', grade: 1, formula: '军团商店/副本产出', source: '军团商店 / 副本', note: '国令任务/打造材料' },
    { name: '经验丸', category: '消耗品', grade: 1, formula: '活动/副本产出', source: '副本 / 活动 / 商城', note: '直接增加角色经验' },
    { name: '蟠桃', category: '消耗品', grade: 1, formula: '新手礼包/活动', source: '新手礼包 / 活动', note: '新手升级道具' },
    { name: '招贤令', category: '消耗品', grade: 1, formula: '商城/活动', source: '商城 / 活动', note: '国令任务额外次数' },
    { name: '通络丹', category: '消耗品', grade: 2, formula: '庖丁制作', source: '庖丁制作 / 玩家交易', note: '高级回复药品' },
    { name: '杜康酒', category: '消耗品', grade: 2, formula: '庖丁制作', source: '庖丁制作 / 玩家交易', note: '高级酿酒品' },
    // 羽毛
    { name: '未鉴定的羽毛', category: '羽毛材料', grade: 1, formula: '击杀大怪鸟掉落', source: '打怪掉落', note: '鉴定后获得1-5级羽毛' },
    { name: '灵鉴之玉', category: '羽毛材料', grade: 1, formula: '50个未鉴定羽毛兑换 / 商城', source: '兑换 / 商城', note: '羽毛鉴定道具' },
    { name: '1级羽毛', category: '羽毛材料', grade: 1, formula: '鉴定获得', source: '鉴定 / 玩家交易', note: '兑换1级翅膀(15根)' },
    { name: '2级羽毛', category: '羽毛材料', grade: 2, formula: '鉴定获得', source: '鉴定 / 玩家交易', note: '兑换2级翅膀' },
    { name: '3级羽毛', category: '羽毛材料', grade: 3, formula: '鉴定获得', source: '鉴定 / 玩家交易', note: '兑换3级翅膀(40根)' },
    { name: '4级羽毛', category: '羽毛材料', grade: 4, formula: '鉴定获得', source: '鉴定 / 玩家交易', note: '兑换4级翅膀(75根)' },
    { name: '5级羽毛', category: '羽毛材料', grade: 5, formula: '鉴定获得', source: '鉴定 / 玩家交易', note: '兑换5级翅膀(100根)' },
    { name: '七彩鸾羽', category: '羽毛材料', grade: 6, formula: '5级羽毛升级获得', source: '羽灵系统', note: '羽灵兑换道具' },
    // 技能升级道具（玉石匠合成）
    { name: '剑玲珑-4级', category: '消耗品', grade: 4, formula: '蓝田玉×25 + 剑玲珑-3级×25', source: '玉石匠合成', note: '剑侍 · 剑系招式升级' },
    { name: '剑玲珑-5级', category: '消耗品', grade: 5, formula: '蓝田玉×80 + 剑玲珑-3级×80', source: '玉石匠合成', note: '剑侍 · 剑系招式升级' },
    { name: '剑玲珑-6级', category: '消耗品', grade: 6, formula: '和田玉×50 + 剑玲珑-3级×50', source: '玉石匠合成', note: '剑侍 · 剑系招式升级' },
    { name: '剑玲珑-7级', category: '消耗品', grade: 7, formula: '和田玉×100 + 剑玲珑-3级×100', source: '玉石匠合成', note: '剑侍 · 剑系招式升级' },
    { name: '剑玲珑-8级', category: '消耗品', grade: 8, formula: '青白玉×100 + 剑玲珑-3级×100 + 紫水晶×1', source: '玉石匠合成', note: '剑侍 · 剑系招式升级' },
    { name: '剑玲珑-9级', category: '消耗品', grade: 9, formula: '青白玉×150 + 剑玲珑-3级×150 + 紫水晶×2', source: '玉石匠合成', note: '剑侍 · 剑系招式升级' },
    { name: '剑玲珑-10级', category: '消耗品', grade: 10, formula: '白玉×200 + 剑玲珑-3级×200 + 紫水晶×3', source: '玉石匠合成', note: '剑侍 · 剑系招式满级' },
    { name: '通天诰-4级', category: '消耗品', grade: 4, formula: '蓝田玉×25 + 通天诰-3级×25', source: '玉石匠合成', note: '仙术士 · 扇系招式升级' },
    { name: '通天诰-5级', category: '消耗品', grade: 5, formula: '蓝田玉×80 + 通天诰-3级×80', source: '玉石匠合成', note: '仙术士 · 扇系招式升级' },
    { name: '通天诰-6级', category: '消耗品', grade: 6, formula: '蓝田玉×100 + 通天诰-3级×100', source: '玉石匠合成', note: '仙术士 · 扇系招式升级' },
    { name: '通天诰-7级', category: '消耗品', grade: 7, formula: '和田玉×100 + 通天诰-3级×100', source: '玉石匠合成', note: '仙术士 · 扇系招式升级' },
    { name: '通天诰-8级', category: '消耗品', grade: 8, formula: '青白玉×100 + 通天诰-3级×100 + 紫水晶×1', source: '玉石匠合成', note: '仙术士 · 扇系招式升级' },
    { name: '通天诰-9级', category: '消耗品', grade: 9, formula: '青白玉×150 + 通天诰-3级×150 + 紫水晶×2', source: '玉石匠合成', note: '仙术士 · 扇系招式升级' },
    { name: '通天诰-10级', category: '消耗品', grade: 10, formula: '白玉×200 + 通天诰-3级×200 + 紫水晶×3', source: '玉石匠合成', note: '仙术士 · 扇系招式满级' },
    { name: '霸王樽-4级', category: '消耗品', grade: 4, formula: '蓝田玉×25 + 霸王樽-3级×25', source: '玉石匠合成', note: '豪杰 · 斧系招式升级' },
    { name: '霸王樽-5级', category: '消耗品', grade: 5, formula: '蓝田玉×80 + 霸王樽-3级×80', source: '玉石匠合成', note: '豪杰 · 斧系招式升级' },
    { name: '霸王樽-6级', category: '消耗品', grade: 6, formula: '蓝田玉×100 + 霸王樽-3级×100', source: '玉石匠合成', note: '豪杰 · 斧系招式升级' },
    { name: '霸王樽-7级', category: '消耗品', grade: 7, formula: '和田玉×100 + 霸王樽-3级×100', source: '玉石匠合成', note: '豪杰 · 斧系招式升级' },
    { name: '霸王樽-8级', category: '消耗品', grade: 8, formula: '青白玉×100 + 霸王樽-3级×100 + 紫水晶×1', source: '玉石匠合成', note: '豪杰 · 斧系招式升级' },
    { name: '霸王樽-9级', category: '消耗品', grade: 9, formula: '青白玉×150 + 霸王樽-3级×150 + 紫水晶×2', source: '玉石匠合成', note: '豪杰 · 斧系招式升级' },
    { name: '霸王樽-10级', category: '消耗品', grade: 10, formula: '白玉×200 + 霸王樽-3级×200 + 紫水晶×3', source: '玉石匠合成', note: '豪杰 · 斧系招式满级' },
    { name: '青琼玉-4级', category: '消耗品', grade: 4, formula: '蓝田玉×25 + 青琼玉-3级×25', source: '玉石匠合成', note: '仙术士 · 仙术系招式升级' },
    { name: '青琼玉-5级', category: '消耗品', grade: 5, formula: '蓝田玉×80 + 青琼玉-3级×80', source: '玉石匠合成', note: '仙术士 · 仙术系招式升级' },
    { name: '青琼玉-6级', category: '消耗品', grade: 6, formula: '蓝田玉×100 + 青琼玉-3级×100', source: '玉石匠合成', note: '仙术士 · 仙术系招式升级' },
    { name: '青琼玉-7级', category: '消耗品', grade: 7, formula: '和田玉×100 + 青琼玉-3级×100', source: '玉石匠合成', note: '仙术士 · 仙术系招式升级' },
    { name: '青琼玉-8级', category: '消耗品', grade: 8, formula: '青白玉×100 + 青琼玉-3级×100 + 紫水晶×1', source: '玉石匠合成', note: '仙术士 · 仙术系招式升级' },
    { name: '青琼玉-9级', category: '消耗品', grade: 9, formula: '青白玉×150 + 青琼玉-3级×150 + 紫水晶×2', source: '玉石匠合成', note: '仙术士 · 仙术系招式升级' },
    { name: '青琼玉-10级', category: '消耗品', grade: 10, formula: '白玉×200 + 青琼玉-3级×200 + 紫水晶×3', source: '玉石匠合成', note: '仙术士 · 仙术系招式满级' },
    { name: '弓弦月-4级', category: '消耗品', grade: 4, formula: '蓝田玉×25 + 弓弦月-3级×25', source: '玉石匠合成', note: '游侠 · 弓系招式升级' },
    { name: '弓弦月-5级', category: '消耗品', grade: 5, formula: '蓝田玉×80 + 弓弦月-3级×80', source: '玉石匠合成', note: '游侠 · 弓系招式升级' },
    { name: '弓弦月-6级', category: '消耗品', grade: 6, formula: '蓝田玉×100 + 弓弦月-3级×100', source: '玉石匠合成', note: '游侠 · 弓系招式升级' },
    { name: '弓弦月-7级', category: '消耗品', grade: 7, formula: '和田玉×100 + 弓弦月-3级×100', source: '玉石匠合成', note: '游侠 · 弓系招式升级' },
    { name: '弓弦月-8级', category: '消耗品', grade: 8, formula: '青白玉×100 + 弓弦月-3级×100 + 紫水晶×1', source: '玉石匠合成', note: '游侠 · 弓系招式升级' },
    { name: '弓弦月-9级', category: '消耗品', grade: 9, formula: '青白玉×150 + 弓弦月-3级×150 + 紫水晶×2', source: '玉石匠合成', note: '游侠 · 弓系招式升级' },
    { name: '弓弦月-10级', category: '消耗品', grade: 10, formula: '白玉×200 + 弓弦月-3级×200 + 紫水晶×3', source: '玉石匠合成', note: '游侠 · 弓系招式满级' },
    { name: '神机石-4级', category: '消耗品', grade: 4, formula: '蓝田玉×25 + 神机石-3级×25', source: '玉石匠合成', note: '阴阳士 · 杖系招式升级' },
    { name: '神机石-5级', category: '消耗品', grade: 5, formula: '蓝田玉×80 + 神机石-3级×80', source: '玉石匠合成', note: '阴阳士 · 杖系招式升级' },
    { name: '神机石-6级', category: '消耗品', grade: 6, formula: '蓝田玉×100 + 神机石-3级×100', source: '玉石匠合成', note: '阴阳士 · 杖系招式升级' },
    { name: '神机石-7级', category: '消耗品', grade: 7, formula: '和田玉×100 + 神机石-3级×100', source: '玉石匠合成', note: '阴阳士 · 杖系招式升级' },
    { name: '神机石-8级', category: '消耗品', grade: 8, formula: '青白玉×100 + 神机石-3级×100 + 紫水晶×1', source: '玉石匠合成', note: '阴阳士 · 杖系招式升级' },
    { name: '神机石-9级', category: '消耗品', grade: 9, formula: '青白玉×150 + 神机石-3级×150 + 紫水晶×2', source: '玉石匠合成', note: '阴阳士 · 杖系招式升级' },
    { name: '神机石-10级', category: '消耗品', grade: 10, formula: '白玉×200 + 神机石-3级×200 + 紫水晶×3', source: '玉石匠合成', note: '阴阳士 · 杖系招式满级' },
    // 强化
    { name: '玄铁', category: '强化材料', grade: 1, formula: '商城/活动', source: '商城 / 活动', note: '装备强化失败不掉级' },
    // 家园
    { name: '神木', category: '家园材料', grade: 1, formula: '家园物业礼包/活动', source: '物业礼包 / 活动', note: '家园家具制作材料' },
    // 装备之魂（6品质×6部位=36种）
    { name: '破裂的武器之魂', category: '装备之魂', grade: 1, formula: '1-29级绿/蓝装拆解', source: '拆解 / 精炼合成', note: '改造+1~2' },
    { name: '劣质的武器之魂', category: '装备之魂', grade: 2, formula: '5破裂=1劣质 / 拆解', source: '拆解 / 精炼合成', note: '改造+2~3' },
    { name: '普通的武器之魂', category: '装备之魂', grade: 3, formula: '5劣质=1普通 / 拆解 / 商城', source: '拆解 / 精炼 / 商城', note: '改造+3~4' },
    { name: '精致的武器之魂', category: '装备之魂', grade: 4, formula: '5普通=1精致 / 拆解(30-50级)', source: '拆解 / 精炼合成', note: '改造+4~5 / 三次改造激活四象' },
    { name: '无暇的武器之魂', category: '装备之魂', grade: 5, formula: '5精致=1无暇', source: '精炼合成', note: '改造+5~6' },
    { name: '完美的武器之魂', category: '装备之魂', grade: 6, formula: '5无暇=1完美', source: '精炼合成', note: '改造+6~7 / 最高品质' },
    { name: '破裂的帽子之魂', category: '装备之魂', grade: 1, formula: '1-29级绿/蓝装拆解', source: '拆解 / 精炼合成', note: '改造+1~2' },
    { name: '劣质的帽子之魂', category: '装备之魂', grade: 2, formula: '5破裂=1劣质 / 拆解', source: '拆解 / 精炼合成', note: '改造+2~3' },
    { name: '普通的帽子之魂', category: '装备之魂', grade: 3, formula: '5劣质=1普通 / 拆解 / 商城', source: '拆解 / 精炼 / 商城', note: '改造+3~4' },
    { name: '精致的帽子之魂', category: '装备之魂', grade: 4, formula: '5普通=1精致 / 拆解(30-50级)', source: '拆解 / 精炼合成', note: '改造+4~5 / 三次改造激活四象' },
    { name: '无暇的帽子之魂', category: '装备之魂', grade: 5, formula: '5精致=1无暇', source: '精炼合成', note: '改造+5~6' },
    { name: '完美的帽子之魂', category: '装备之魂', grade: 6, formula: '5无暇=1完美', source: '精炼合成', note: '改造+6~7 / 最高品质' },
    { name: '破裂的上装之魂', category: '装备之魂', grade: 1, formula: '1-29级绿/蓝装拆解', source: '拆解 / 精炼合成', note: '改造+1~2' },
    { name: '劣质的上装之魂', category: '装备之魂', grade: 2, formula: '5破裂=1劣质 / 拆解', source: '拆解 / 精炼合成', note: '改造+2~3' },
    { name: '普通的上装之魂', category: '装备之魂', grade: 3, formula: '5劣质=1普通 / 拆解 / 商城', source: '拆解 / 精炼 / 商城', note: '改造+3~4' },
    { name: '精致的上装之魂', category: '装备之魂', grade: 4, formula: '5普通=1精致 / 拆解(30-50级)', source: '拆解 / 精炼合成', note: '改造+4~5 / 三次改造激活四象' },
    { name: '无暇的上装之魂', category: '装备之魂', grade: 5, formula: '5精致=1无暇', source: '精炼合成', note: '改造+5~6' },
    { name: '完美的上装之魂', category: '装备之魂', grade: 6, formula: '5无暇=1完美', source: '精炼合成', note: '改造+6~7 / 最高品质' },
    { name: '破裂的护手之魂', category: '装备之魂', grade: 1, formula: '1-29级绿/蓝装拆解', source: '拆解 / 精炼合成', note: '改造+1~2' },
    { name: '劣质的护手之魂', category: '装备之魂', grade: 2, formula: '5破裂=1劣质 / 拆解', source: '拆解 / 精炼合成', note: '改造+2~3' },
    { name: '普通的护手之魂', category: '装备之魂', grade: 3, formula: '5劣质=1普通 / 拆解 / 商城', source: '拆解 / 精炼 / 商城', note: '改造+3~4' },
    { name: '精致的护手之魂', category: '装备之魂', grade: 4, formula: '5普通=1精致 / 拆解(30-50级)', source: '拆解 / 精炼合成', note: '改造+4~5 / 三次改造激活四象' },
    { name: '无暇的护手之魂', category: '装备之魂', grade: 5, formula: '5精致=1无暇', source: '精炼合成', note: '改造+5~6' },
    { name: '完美的护手之魂', category: '装备之魂', grade: 6, formula: '5无暇=1完美', source: '精炼合成', note: '改造+6~7 / 最高品质' },
    { name: '破裂的下装之魂', category: '装备之魂', grade: 1, formula: '1-29级绿/蓝装拆解', source: '拆解 / 精炼合成', note: '改造+1~2' },
    { name: '劣质的下装之魂', category: '装备之魂', grade: 2, formula: '5破裂=1劣质 / 拆解', source: '拆解 / 精炼合成', note: '改造+2~3' },
    { name: '普通的下装之魂', category: '装备之魂', grade: 3, formula: '5劣质=1普通 / 拆解 / 商城', source: '拆解 / 精炼 / 商城', note: '改造+3~4' },
    { name: '精致的下装之魂', category: '装备之魂', grade: 4, formula: '5普通=1精致 / 拆解(30-50级)', source: '拆解 / 精炼合成', note: '改造+4~5 / 三次改造激活四象' },
    { name: '无暇的下装之魂', category: '装备之魂', grade: 5, formula: '5精致=1无暇', source: '精炼合成', note: '改造+5~6' },
    { name: '完美的下装之魂', category: '装备之魂', grade: 6, formula: '5无暇=1完美', source: '精炼合成', note: '改造+6~7 / 最高品质' },
    { name: '破裂的鞋子之魂', category: '装备之魂', grade: 1, formula: '1-29级绿/蓝装拆解', source: '拆解 / 精炼合成', note: '改造+1~2' },
    { name: '劣质的鞋子之魂', category: '装备之魂', grade: 2, formula: '5破裂=1劣质 / 拆解', source: '拆解 / 精炼合成', note: '改造+2~3' },
    { name: '普通的鞋子之魂', category: '装备之魂', grade: 3, formula: '5劣质=1普通 / 拆解 / 商城', source: '拆解 / 精炼 / 商城', note: '改造+3~4' },
    { name: '精致的鞋子之魂', category: '装备之魂', grade: 4, formula: '5普通=1精致 / 拆解(30-50级)', source: '拆解 / 精炼合成', note: '改造+4~5 / 三次改造激活四象' },
    { name: '无暇的鞋子之魂', category: '装备之魂', grade: 5, formula: '5精致=1无暇', source: '精炼合成', note: '改造+5~6' },
    { name: '完美的鞋子之魂', category: '装备之魂', grade: 6, formula: '5无暇=1完美', source: '精炼合成', note: '改造+6~7 / 最高品质' },
    // 元神升阶石
    { name: '初阶元神升阶石', category: '消耗品', grade: 1, formula: '商城/活动/副本', source: '商城 / 活动 / 副本', note: '元神升阶材料·初阶' },
    { name: '二阶元神升阶石', category: '消耗品', grade: 2, formula: '商城/活动/副本', source: '商城 / 活动 / 副本', note: '元神升阶材料·二阶' },
    { name: '三阶元神升阶石', category: '消耗品', grade: 3, formula: '商城/活动/副本', source: '商城 / 活动 / 副本', note: '元神升阶材料·三阶' },
    { name: '四阶元神升阶石', category: '消耗品', grade: 4, formula: '商城/活动/副本', source: '商城 / 活动 / 副本', note: '元神升阶材料·四阶' },
    { name: '五阶元神升阶石', category: '消耗品', grade: 5, formula: '商城/活动/副本', source: '商城 / 活动 / 副本', note: '元神升阶材料·五阶' },
    { name: '六阶元神升阶石', category: '消耗品', grade: 6, formula: '商城/活动/副本', source: '商城 / 活动 / 副本', note: '元神升阶材料·六阶' },
    { name: '七阶元神升阶石', category: '消耗品', grade: 7, formula: '商城/活动/副本', source: '商城 / 活动 / 副本', note: '元神升阶材料·七阶' },
    { name: '八阶元神升阶石', category: '消耗品', grade: 8, formula: '商城/活动/副本', source: '商城 / 活动 / 副本', note: '元神升阶材料·八阶' },
    { name: '九阶元神升阶石', category: '消耗品', grade: 9, formula: '商城/活动/副本', source: '商城 / 活动 / 副本', note: '元神升阶材料·九阶' },
    // 玉石 & 灵珠
    { name: '羊脂玉', category: '基础矿石', grade: 5, formula: '高级副本/活动产出', source: '副本 / 活动 / 商城', note: '高级玉石，打造/合成材料' },
    { name: '圣灵珠', category: '消耗品', grade: 3, formula: '活动/副本产出', source: '活动 / 副本 / 商城', note: '灵珠相关消耗品' },
    { name: '武力之石', category: '消耗品', grade: 1, formula: '副本/活动产出', source: '副本 / 活动 / 商城', note: '临时提升武力属性' },
    { name: '智力之石', category: '消耗品', grade: 1, formula: '副本/活动产出', source: '副本 / 活动 / 商城', note: '临时提升智力属性' },
    { name: '体质之石', category: '消耗品', grade: 1, formula: '副本/活动产出', source: '副本 / 活动 / 商城', note: '临时提升体质属性' },
    { name: '迅捷之石', category: '消耗品', grade: 1, formula: '副本/活动产出', source: '副本 / 活动 / 商城', note: '临时提升速度属性' },

    // ══════════════════════════════════════
    // 一、野外采集/小偷副职基础原料
    // ══════════════════════════════════════
    ...[
      '炭黑','孔雀绿','朱砂','精品猪肉','漏网小鱼','带肉牛骨','桂圆','杏仁','果脯','鲜红辣椒',
      '豆瓣','精盐','干果','糯米','肉桂','辣酱','香料','八角','胡椒','莲子','井水','酵母','高级酵母','精制调味包',
      '凡晶石','黑岩石','铁原石','石英石','烟煤','松煤',
    ].map(n => ({ name: n, category: '副职原料', grade: 1, formula: '野外采集/击杀流窜的窃贼', source: '采集 / 打怪掉落 / 玩家交易', note: '副职基础原料' })),

    // ══════════════════════════════════════
    // 二、庖丁成品
    // ══════════════════════════════════════
    ...[
      '煮鸡蛋','双黄蛋','红红肉','清蒸小鱼','牙签滑鱼','卤大骨','钙化大骨','可乐鸡翅',
      '一飞冲天','含笑三步颠','海辣百川','英雄泪','男儿黑','美髯温酒','三锅头','女儿红',
      '猴儿酒','八粮液','太白酒','五花肉','饺子','糖心蛋','真纯',
    ].map(n => ({ name: n, category: '庖丁成品', grade: 1, formula: '庖丁制作', source: '庖丁制作 / 玩家交易', note: '红蓝/状态/体力药' })),

    // 鼓舞食盒（官方全名）
    { name: '鼓舞食盒', category: '庖丁成品', grade: 1, formula: '庖丁制作', source: '庖丁制作 / 玩家交易', note: '鼓舞·基础' },
    { name: '鼓舞特级食盒', category: '庖丁成品', grade: 2, formula: '庖丁制作', source: '庖丁制作 / 玩家交易', note: '鼓舞·特级' },
    { name: '鼓舞贡品食盒', category: '庖丁成品', grade: 3, formula: '庖丁制作', source: '庖丁制作 / 玩家交易', note: '鼓舞·贡品' },
    { name: '鼓舞极品食盒', category: '庖丁成品', grade: 4, formula: '庖丁制作', source: '庖丁制作 / 玩家交易', note: '鼓舞·极品' },
    { name: '鼓舞帝品食盒', category: '庖丁成品', grade: 5, formula: '庖丁制作', source: '庖丁制作 / 玩家交易', note: '鼓舞·帝品' },

    // ══════════════════════════════════════
    // 三、镶工半成品&镶嵌玉石
    // ══════════════════════════════════════
    ...[
      '蓝纹玉','符文水晶','乌金石','月光石','黑曜石',
    ].map(n => ({ name: n, category: '镶工玉石', grade: 1, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '镶工半成品/玉石' })),

    // 镶嵌宝石分级（次级/中高级/强效）
    { name: '次级血气之玉', category: '镶嵌宝石', grade: 1, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '+生命(次级)' },
    { name: '中级血气之玉', category: '镶嵌宝石', grade: 2, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '+生命(中级)' },
    { name: '次级再生之玉', category: '镶嵌宝石', grade: 1, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '+回蓝(次级)' },
    { name: '次级玄力水晶', category: '镶嵌宝石', grade: 1, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '+蓝量(次级)' },
    { name: '次级归灵水晶', category: '镶嵌宝石', grade: 1, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '归灵(次级)' },
    { name: '弱效化伤为命玉', category: '镶嵌宝石', grade: 1, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '攻击吸血(弱效)' },
    { name: '强效化伤为命玉', category: '镶嵌宝石', grade: 3, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '攻击吸血(强效)' },
    { name: '弱效化伤为体玉', category: '镶嵌宝石', grade: 1, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '受伤回蓝(弱效)' },
    { name: '强效化伤为体玉', category: '镶嵌宝石', grade: 3, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '受伤回蓝(强效)' },
    { name: '次级精准之石', category: '镶嵌宝石', grade: 1, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '+命中(次级)' },
    { name: '精准之石', category: '镶嵌宝石', grade: 2, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '+命中' },
    { name: '高级精准之石', category: '镶嵌宝石', grade: 3, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '+命中(高级)' },
    { name: '次级闪避之石', category: '镶嵌宝石', grade: 1, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '+闪避(次级)' },
    { name: '闪避之石', category: '镶嵌宝石', grade: 2, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '+闪避' },
    { name: '高级闪避之石', category: '镶嵌宝石', grade: 3, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '+闪避(高级)' },
    { name: '次级风行石', category: '镶嵌宝石', grade: 1, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '+速度(次级)' },
    { name: '高级风行石', category: '镶嵌宝石', grade: 3, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '+速度(高级)' },
    { name: '次级荆棘石', category: '镶嵌宝石', grade: 1, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '反弹伤害(次级)' },
    { name: '弱效宁神石', category: '镶嵌宝石', grade: 1, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '减少聚气(弱效)' },
    { name: '高级宁神石', category: '镶嵌宝石', grade: 3, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '减少聚气(高级)' },
    { name: '次级必杀石', category: '镶嵌宝石', grade: 1, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '+暴击(次级)' },
    { name: '高级必杀石', category: '镶嵌宝石', grade: 3, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '+暴击(高级)' },
    { name: '次级抗压石', category: '镶嵌宝石', grade: 1, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '+抗性(次级)' },
    { name: '抗压石', category: '镶嵌宝石', grade: 2, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '+抗性' },
    { name: '次级豪气石', category: '镶嵌宝石', grade: 1, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '+豪气(次级)' },
    { name: '豪气石', category: '镶嵌宝石', grade: 2, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '+豪气' },
    { name: '次级鹰眼石', category: '镶嵌宝石', grade: 1, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '+视野(次级)' },
    { name: '鹰眼石', category: '镶嵌宝石', grade: 2, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '+视野' },
    { name: '次级健足石', category: '镶嵌宝石', grade: 1, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '+健足(次级)' },
    { name: '健足石', category: '镶嵌宝石', grade: 2, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '+健足' },
    { name: '次级还神石', category: '镶嵌宝石', grade: 1, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '还神(次级)' },
    { name: '还神石', category: '镶嵌宝石', grade: 2, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '还神' },
    { name: '次级强身石', category: '镶嵌宝石', grade: 1, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '强身(次级)' },
    { name: '强身石', category: '镶嵌宝石', grade: 2, formula: '镶工合成', source: '镶工制作 / 玩家交易', note: '强身' },

    // ══════════════════════════════════════
    // 四、工匠强化、修复、增产道具
    // ══════════════════════════════════════
    { name: '次级强化宝石', category: '强化石', grade: 1, formula: '工匠合成', source: '工匠制作 / 玩家交易', note: '低阶强化' },
    { name: '下品强化宝石', category: '强化石', grade: 2, formula: '工匠合成', source: '工匠制作 / 玩家交易', note: '中阶强化' },
    { name: '中品强化宝石', category: '强化石', grade: 3, formula: '工匠合成', source: '工匠制作 / 玩家交易', note: '高阶强化' },
    { name: '上品复原灵石', category: '修复石', grade: 6, formula: '工匠合成', source: '工匠制作 / 玩家交易', note: '修复装备耐久(高级)' },
    { name: '翻新灵石', category: '修复石', grade: 7, formula: '工匠合成', source: '工匠制作 / 玩家交易', note: '装备翻新' },
    { name: '高级翻新灵石', category: '修复石', grade: 8, formula: '工匠合成', source: '工匠制作 / 玩家交易', note: '装备翻新(高级)' },
    { name: '如意金砧', category: '消耗品', grade: 1, formula: '工匠合成/活动', source: '工匠制作 / 玩家交易', note: '打孔防爆' },
    { name: '打孔防爆石', category: '消耗品', grade: 1, formula: '工匠合成/活动', source: '工匠制作 / 玩家交易', note: '打孔防爆' },
    { name: '初级高压锅', category: '消耗品', grade: 1, formula: '工匠合成', source: '工匠制作 / 玩家交易', note: '庖丁增产工具' },
    { name: '高级高压锅', category: '消耗品', grade: 2, formula: '工匠合成', source: '工匠制作 / 玩家交易', note: '庖丁增产工具(高级)' },
    { name: '初级制酒壶', category: '消耗品', grade: 1, formula: '工匠合成', source: '工匠制作 / 玩家交易', note: '庖丁酿酒工具' },
    { name: '高级制酒壶', category: '消耗品', grade: 2, formula: '工匠合成', source: '工匠制作 / 玩家交易', note: '庖丁酿酒工具(高级)' },

    // ══════════════════════════════════════
    // 五、玉石匠打孔石高级 & 升阶石 & 元素玉材
    // ══════════════════════════════════════
    ...[
      { g: 6, n: '六级嵌器神石' },
      { g: 7, n: '7级嵌器灵石' }, { g: 8, n: '8级嵌器灵石' }, { g: 9, n: '9级嵌器灵石' },
      { g: 10, n: '10级嵌器灵石' }, { g: 11, n: '11级嵌器灵石' }, { g: 12, n: '12级嵌器灵石' },
      { g: 13, n: '13级嵌器灵石' }, { g: 14, n: '14级嵌器灵石' },
    ].map(d => ({ name: d.n, category: '打孔石', grade: d.g, formula: '玉石匠合成', source: '玉石匠制作 / 玩家交易', note: `${d.g}级打孔石` })),

    // 元素微尘 & 玉（用户清单第五类）
    ...[
      '金之微尘','银之微尘','铜之微尘','风之微尘','雷之微尘','电之微尘','黄玉','橙玉','红玉',
    ].map(n => ({ name: n, category: '元素材料', grade: 1, formula: '玉石匠合成/分解', source: '玉石匠制作 / 玩家交易', note: '元素玉材' })),

    // ══════════════════════════════════════
    // 六、装备改造宝石
    // ══════════════════════════════════════
    { name: '初级改造宝石', category: '装备之魂', grade: 1, formula: '工匠合成/商城', source: '商城 / 工匠制作 / 玩家交易', note: '装备改造·初级' },
    { name: '中级改造宝石', category: '装备之魂', grade: 2, formula: '工匠合成/商城', source: '商城 / 工匠制作 / 玩家交易', note: '装备改造·中级' },
    { name: '高级改造宝石', category: '装备之魂', grade: 3, formula: '工匠合成/商城', source: '商城 / 工匠制作 / 玩家交易', note: '装备改造·高级' },

    // ══════════════════════════════════════
    // 七、元神副将流通道具
    // ══════════════════════════════════════
    { name: '鉴天符', category: '消耗品', grade: 1, formula: '活动/商城/副本', source: '商城 / 活动 / 玩家交易', note: '元神鉴定道具' },

    // 元神技能书
    ...[
      '爪击低级','爪击高级','气旋低级','气旋高级','突击低级','突击高级','符法低级','符法高级',
      '乱舞低级','祭魂低级','魂法低级','魂法高级','迸发低级','迸发高级','拾取低级','守护低级',
      '力场低级','逃脱低级','破甲低级','破甲高级','荆棘低级','荆棘高级','驻足低级','驻足高级',
      '冷峻低级','强悍低级','灵巧低级','狂野怒火','雪恨高级','嗜血高级','强悍高级','灵巧高级',
    ].map(n => ({ name: n, category: '元神技能书', grade: 1, formula: '副本/活动/军团掉落', source: '副本 / 活动 / 玩家交易', note: '元神技能书' })),

    // 流通精元
    ...[
      '小蛮猪精元','竹海侍卫精元','虚无战灵精元','蛮舞大祭祀精元','偏将精元','五虎精元','十阶精元',
    ].map(n => ({ name: n, category: '精元', grade: 1, formula: '副本/野外BOSS掉落', source: '副本 / 野外BOSS / 玩家交易', note: '元神精元' })),

    // ══════════════════════════════════════
    // 八、制符师传送卷
    // ══════════════════════════════════════
    { name: '回城符', category: '传送卷', grade: 1, formula: '制符师制作', source: '制符师制作 / 玩家交易', note: '回城' },
    ...[
      '巴郡传送卷','魏郡传送卷','吴郡传送卷','成都传送卷','洛阳传送卷','建业传送卷',
      '临江传送卷','襄阳传送卷','江夏传送卷','江陵传送卷','三江城传送卷','永昌郡传送卷',
      '枭首窟传送卷','八阵图传送卷','虎牢关传送卷','东吴水防传送卷','赤壁传送卷',
    ].map(n => ({ name: n, category: '传送卷', grade: 1, formula: '制符师制作', source: '制符师制作 / 玩家交易', note: '地图传送' })),
    ...[
      '置身事外符','缩地符','群体缩地符','队友单人召唤符','队友全员召唤符',
    ].map(n => ({ name: n, category: '传送卷', grade: 1, formula: '制符师制作', source: '制符师制作 / 玩家交易', note: '特殊传送/召唤' })),

    // ══════════════════════════════════════
    // 九、野外/副本循环挂机任务材料
    // ══════════════════════════════════════
    ...[
      '草料','金创药','清心露','邪蛊','驱鸟符','血鸟肉','枯骨','尸毒','腐蚀之心',
      '翠鸟羽','镏金印章','翡翠玉佩','精巧机簧','八门玄精','殇玉碎片',
    ].map(n => ({ name: n, category: '任务材料', grade: 1, formula: '野外/副本/挂机掉落', source: '打怪 / 副本 / 玩家交易', note: '循环任务材料' })),

    // ══════════════════════════════════════
    // 十一、符咒流通材料（碎片&成品）
    // ══════════════════════════════════════
    ...[
      '未鉴定符咒碎片','一级符咒碎片','二级符咒碎片','三级符咒碎片','四级符咒碎片',
      '五级符咒碎片','六级符咒碎片','七曜玲珑石','千叶碎片',
    ].map(n => ({ name: n, category: '符咒材料', grade: 1, formula: '副本/活动掉落', source: '副本 / 活动 / 玩家交易', note: '符咒碎片' })),
    ...[
      '符咒坠星','符咒千叶','符咒凌雪','符咒飞羽','符咒星芒','符咒天时','符咒徊翔','符咒万物',
    ].map(n => ({ name: n, category: '符咒材料', grade: 1, formula: '碎片合成/活动', source: '合成 / 活动 / 玩家交易', note: '符咒成品' })),

    // ══════════════════════════════════════
    // 十二、灵兽养成
    // ══════════════════════════════════════
    { name: '灵兽口粮', category: '灵兽材料', grade: 1, formula: '商城/活动/副本', source: '商城 / 活动 / 玩家交易', note: '灵兽喂养' },
    { name: '凡品进化丹', category: '灵兽材料', grade: 1, formula: '活动/副本/商城', source: '商城 / 活动 / 玩家交易', note: '灵兽进化·凡品' },
    { name: '地品进化丹', category: '灵兽材料', grade: 2, formula: '活动/副本/商城', source: '商城 / 活动 / 玩家交易', note: '灵兽进化·地品' },
    { name: '天品进化丹', category: '灵兽材料', grade: 3, formula: '活动/副本/商城', source: '商城 / 活动 / 玩家交易', note: '灵兽进化·天品' },
    { name: '灵兽低级技能书', category: '灵兽材料', grade: 1, formula: '活动/副本', source: '副本 / 活动 / 玩家交易', note: '灵兽技能·低级' },
    { name: '灵兽中级技能书', category: '灵兽材料', grade: 2, formula: '活动/副本', source: '副本 / 活动 / 玩家交易', note: '灵兽技能·中级' },
    { name: '灵兽高级技能书', category: '灵兽材料', grade: 3, formula: '活动/副本', source: '副本 / 活动 / 玩家交易', note: '灵兽技能·高级' },
    { name: '灵兽·闪击', category: '灵兽材料', grade: 3, formula: '活动/副本', source: '副本 / 活动 / 玩家交易', note: '灵兽技能·闪击' },
    { name: '灵兽·爪击', category: '灵兽材料', grade: 3, formula: '活动/副本', source: '副本 / 活动 / 玩家交易', note: '灵兽技能·爪击' },

    // ══════════════════════════════════════
    // 十三、灵魄、奥义、八阵图流通道具
    // ══════════════════════════════════════
    { name: '专注之灵', category: '灵魄', grade: 1, formula: '副本/活动', source: '副本 / 活动 / 玩家交易', note: '灵魄·专注' },
    { name: '绿色奥义', category: '奥义', grade: 1, formula: '副本/活动掉落', source: '副本 / 活动 / 玩家交易', note: '奥义·绿色' },
    { name: '蓝色奥义', category: '奥义', grade: 2, formula: '副本/活动掉落', source: '副本 / 活动 / 玩家交易', note: '奥义·蓝色' },
    { name: '紫色奥义', category: '奥义', grade: 3, formula: '副本/活动掉落', source: '副本 / 活动 / 玩家交易', note: '奥义·紫色' },
    { name: '单满拳头奥义', category: '奥义', grade: 3, formula: '副本/活动掉落', source: '副本 / 活动 / 玩家交易', note: '奥义·单满拳头' },
    { name: '八阵图碎片', category: '八阵图', grade: 1, formula: '副本/活动掉落', source: '副本 / 活动 / 玩家交易', note: '八阵图合成碎片' },
    { name: '白板八阵图', category: '八阵图', grade: 1, formula: '碎片合成', source: '合成 / 玩家交易', note: '未激活八阵图' },
    { name: '日月风华', category: '八阵图', grade: 1, formula: '活动/副本', source: '副本 / 活动 / 玩家交易', note: '八阵图升级材料' },
    { name: '灵珠原石', category: '灵珠', grade: 1, formula: '副本/活动掉落', source: '副本 / 活动 / 玩家交易', note: '灵珠原材料' },

    // ══════════════════════════════════════
    // 十四、装备打造模具（6部位×10-120级=66种）
    // ══════════════════════════════════════
    ...(() => {
      const parts = ['武器','头部','上衣','下装','护手','足部']
      const molds: Array<{ name: string; category: string; grade: number; formula: string; source: string; note: string }> = []
      for (const part of parts) {
        for (const lv of [10,20,30,40,50,60,70,80,90,100,110,120]) {
          molds.push({ name: `${lv}级${part}模`, category: '装备模具', grade: Math.floor(lv/10), formula: '工匠制作', source: '工匠制作 / 玩家交易', note: `${lv}级${part}打造模具` })
        }
      }
      return molds
    })(),

    // ══════════════════════════════════════
    // 十五、子女养成流通道具
    // ══════════════════════════════════════
    { name: '子女体魄丸', category: '子女材料', grade: 1, formula: '活动/副本/商城', source: '商城 / 活动 / 玩家交易', note: '子女体魄提升' },
    { name: '子女武智丸', category: '子女材料', grade: 1, formula: '活动/副本/商城', source: '商城 / 活动 / 玩家交易', note: '子女武力/智力提升' },
    { name: '子女抗性丸', category: '子女材料', grade: 1, formula: '活动/副本/商城', source: '商城 / 活动 / 玩家交易', note: '子女抗性提升' },
    { name: '子女进阶丹', category: '子女材料', grade: 2, formula: '活动/副本/商城', source: '商城 / 活动 / 玩家交易', note: '子女进阶' },
    { name: '子女被动技能书', category: '子女材料', grade: 2, formula: '活动/副本', source: '副本 / 活动 / 玩家交易', note: '子女被动技能' },
  ]

  // 增量去重：按 (name, category) 判断是否已存在，避免每次启动重复插入
  const existing = new Set(
    (db.prepare('SELECT name, category FROM material_library').all() as Array<{ name: string; category: string }>)
      .map(r => `${r.name}|${r.category}`)
  )

  const tx = db.transaction(() => {
    for (const item of items) {
      const key = `${item.name}|${item.category}`
      if (existing.has(key)) continue
      insert.run(item.name, item.category, item.grade, JSON.stringify({}), item.source, item.note)
      existing.add(key)
    }
  })
  tx()
}

/* ── 每日活动链接种子数据 ── */

function seedDailyLinks(): void {
  const count = (db.prepare('SELECT COUNT(*) as cnt FROM daily_links').get() as { cnt: number }).cnt
  if (count > 0) return

  const insert = db.prepare(`
    INSERT INTO daily_links (group_name, icon, name, desc, url, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const tx = db.transaction(() => {
    insert.run('每日 · 每天必点', '🎁', '每日签到', '公众号签到领奖', 'https://sg.qq.com/cp/a20240429gzhqd/', 0)
    insert.run('每日 · 每天必点', '🎮', 'WeGame 每日礼', '登录抽静修凭证/绑币', 'https://sg.qq.com/cp/a20260528sgwegame/?e_code=556516', 1)
    insert.run('每日 · 每天必点', '🛡️', '防盗防骗答题', '每日微课答题抽奖励', 'https://sg.qq.com/cp/a20260518sgfdfp/?atm_cl=ad&atm_pos=18858&e_code=556917', 2)
    insert.run('周期/活动 · 定期看看', '⚡', '闪现庆三国', '登录抽周边/绑币（每周）', 'https://sg.qq.com/cp/a20260528sgsx/?e_code=556518&atm_cl=ad&atm_pos=24150', 0)
    insert.run('周期/活动 · 定期看看', '💎', '心悦&三国', '心悦会员活跃礼包', 'https://sg.qq.com/cp/a20260528sgxy/?e_code=556517&atm_cl=ad&atm_pos=18988', 1)
    insert.run('周期/活动 · 定期看看', '🎵', '抖音共创激励', '发视频赢周边/绑币', 'https://sg.qq.com/cp/a20260525sgdygchd/?atm_cl=ad&atm_pos=18859&e_code=556918', 2)
  })
  tx()
}

export function getDatabase(): Database.Database {
  return db
}
