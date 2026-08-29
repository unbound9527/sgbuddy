// src/utils/fieldParser.ts —— OCR 文本 → 表单字段的纯函数词库解析
// 无副作用、不依赖 Vue/Electron/DB，可独立单测
// 注意：tesseract/Umi-OCR 会在字符间插入空格（如「全 职业」「110 级」），匹配前先做去空格归一化

export interface ParsedFields {
  item_name: string
  category: string // 推断结果；无证据时为 ''（不预填）
  quality: string
  craft_level: string
  equip_job: string // 全职业 → ''（不区分）
  equip_level: number // 0 = 不区分
  slot: string
  spirit_position: string
  attr_notes: string // 手写备注（识别不产出，恒为空）
  matched: string[] // 被命中填值的字段名列表（UI 打 OCR 角标用）
}

// 与 DataCenter.vue 表单选项保持一致
export const SLOT_DICT = ['武器', '头盔', '上装', '下装', '护手', '鞋子', '面具', '项链', '戒指', '翅膀', '符咒']
export const JOB_DICT = ['剑侍', '豪杰', '阴阳士', '仙术士', '游侠', '唤灵']
export const QUALITY_DICT = ['黄色', '橙色', '红色', '绿色', '蓝色', '紫色']
export const SPIRIT_QUALITY_DICT = ['天', '地', '玄', '妙', '凡']
export const CRAFT_DICT = ['精致', '浑然', '天赐', '完美', '鬼神']
export const SPIRIT_POSITION_DICT = ['利刃', '坚盾', '灵啸', '守神']
export const EQUIP_LEVELS = [70, 80, 90, 100, 110, 120, 130, 140, 150]
export const OTHER_CATEGORY_DICT: Record<string, string> = {
  八阵图: '八阵图', 奥义: '奥义', 子女: '子女', 灵珠: '灵珠', 羽灵: '羽灵', 元神: '元神',
}
export const ALL_JOB_WORDS = ['全职业', '所有职业', '全部职业']
export const NO_LEVEL_WORDS = ['不限等级', '无等级要求', '无等级限制']
// 名称含这些字视为武器部位（QQ三国武器名后缀）
// 注意：不含「杖」——「驭日杖」实为鞋子名，名称推断不可靠时宁可不填部位
export const WEAPON_HINTS = ['剑', '刀', '弓', '扇', '爪', '针', '枪', '戟', '斧', '锤', '琴', '杖', '铃']
export const PRICE_LINE_RE = /万|亿|金|银/ // 价格行过滤

/** 名称中出现这些字 → 推断部位（优先匹配完整的部位词，这些是补充） */
export const SLOT_HINTS: Record<string, string[]> = {
  '武器': WEAPON_HINTS,
  '头盔': ['头', '帽', '冠', '盔'],
  '上装': ['甲', '外套'],
  '护手': ['手'],
  '下装': ['腿', '下', '裤', '裙'],
  '鞋子': ['鞋', '靴'],
}

/** 名称中出现这些词 → 直接推断分类（优先级高于常规品类推断） */
export const CATEGORY_NAME_HINTS: Record<string, string> = {
  '之灵': '灵魄',
  '天赋': '奥义',
  '幸运': '元神',
}

/** 奥义物品名称列表（用于匹配矫正 OCR 识别结果） */
export const AO_YI_NAMES = [
  '山海经', '易经', '淮南子', '遁甲天书',
  '孙子兵法', '孙膑兵法', '墨子', '孟德新书',
  '鬼谷遗文', '兵法二十四篇', '便宜十六策',
  '六韬', '太平要术', '青囊书', '神农本草经',
  '孟子', '论语', '尔雅', '楚辞', '诗经',
  '后羿射法', '射艺', '五禽戏',
  '太公兵法', '尉缭子', '吴子兵法', '三略',
]
export const LABEL_WORDS = ['职业', '等级', '部位', '打造', '价格', '物品名称', '属性']
// 以这些标签开头的行即使识别不出值也要消费（不进属性备注）
const LABEL_PREFIX_RE = /^(职业|等级|部位|打造|品质|价格|声望|耐久|物品名称|适用职业|运用职业|等级限制|装备声望|耐久度|需要装备)/
const NAME_PREFIX_RE = /^物品名称[:：]?/
const NAME_SUFFIX_RE = /\+(\d{1,3})$/

/** 归一化：去掉所有空白（OCR 常在字符间插空格） */
function normalize(line: string): string {
  return line.replace(/\s+/g, '')
}

/** 灵兽品质「天地玄妙凡」是单字，要求该行带「品质/品级」标签才匹配，避免误伤名称（如「天怒剑」） */
function matchSpiritQuality(rawLine: string): string | null {
  const norm = rawLine.replace(/\s+/g, '') // 标签同样会被 OCR 插空格
  if (!/(品质|品级)/.test(norm)) return null
  for (const q of SPIRIT_QUALITY_DICT) {
    if (new RegExp(`(^|[：:])${q}([：:]|$)`).test(norm)) return q
  }
  return null
}

/** 等级就近取 70~150 档 */
function nearestEquipLevel(n: number): number {
  return EQUIP_LEVELS.reduce((best, lv) => (Math.abs(lv - n) < Math.abs(best - n) ? lv : best), EQUIP_LEVELS[0])
}

export function parseOcrText(text: string): ParsedFields {
  const out: ParsedFields = {
    item_name: '', category: '', quality: '', craft_level: '', equip_job: '',
    equip_level: 0, slot: '', spirit_position: '', attr_notes: '', matched: [],
  }
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const normLines = lines.map(normalize)
  const consumed = new Set<number>()

  // ── 品类推断 ──
  // 优先级：名称特征词 > 显式品类关键词 > 装备证据 > 灵兽品质 > 部位提示字
  let category = ''
  const nameHintCat = CATEGORY_NAME_HINTS[Object.keys(CATEGORY_NAME_HINTS).find(k => normLines.some(l => l.includes(k))) ?? '']
  if (nameHintCat) category = nameHintCat
  else if (normLines.some(l => l.includes('灵魄'))) category = '灵魄'
  else if (normLines.some(l => Object.keys(OTHER_CATEGORY_DICT).some(w => l.includes(w)))) {
    // 显式品类关键词：奥义/八阵图/子女/灵珠/羽灵/元神（先于装备证据，避免「遁甲天书」的「甲」误判装备）
    for (const [word, cat] of Object.entries(OTHER_CATEGORY_DICT)) {
      if (normLines.some(l => l.includes(word))) { category = cat; break }
    }
  }
  else if (normLines.some(l => SLOT_DICT.some(s => l.includes(s)))) category = '装备'
  else if (normLines.some(l => WEAPON_HINTS.some(w => l.includes(w)))) category = '装备'
  else if (lines.some(matchSpiritQuality)) category = '灵兽'
  else if (normLines.some(l => Object.keys(SLOT_HINTS).some(s => SLOT_HINTS[s].some(h => l.includes(h))))) category = '装备'
  if (category) {
    out.category = category
    out.matched.push('category')
  }

  // ── 名称预留：tooltip 顶部行是物品名（跳过标签行/符号开头行/碎片行，取首个像名称的行）──
  // 顺带从名称提取打造（如「鬼神的羲和驭日杖」→ 鬼神）与部位（部位词或武器字）
  for (let i = 0; i < Math.min(3, normLines.length); i++) {
    const line = normLines[i]
    if (consumed.has(i)) continue
    if (LABEL_PREFIX_RE.test(line)) continue
    if (/^[［\[(（]/.test(line)) continue // 品质标签行常以「［」开头（如「［青龙]」）
    if (line.length < 2) continue // 碎片行（游戏名最短 3 字，不误伤）
    let name = line.replace(NAME_PREFIX_RE, '')
    name = name.replace(NAME_SUFFIX_RE, '')
    // 打造词条前缀剥离（如「鬼神的羲和驭日杖」→「羲和驭日杖」），仅剥离前缀避免误伤名称中间的词
    const craftPrefix = CRAFT_DICT.find(c => name.startsWith(c))
    if (craftPrefix) {
      name = name.slice(craftPrefix.length)
      name = name.replace(/^的/, '') // 「鬼神的X」中间的「的」
    }
    out.item_name = name
    out.matched.push('item_name')
    consumed.add(i)
    const craft = CRAFT_DICT.find(c => name.includes(c)) ?? craftPrefix
    if (craft) {
      out.craft_level = craft
      out.matched.push('craft_level')
    }
    if (category === '装备') {
      // 先匹配完整的部位词（武器/头盔/上装/下装/护手/鞋子/面具/项链/戒指）
      let slot = SLOT_DICT.find(s => name.includes(s))
      // 没找到则用名称提示字推断
      if (!slot) {
        for (const [s, hints] of Object.entries(SLOT_HINTS)) {
          if (hints.some(h => name.includes(h))) { slot = s; break }
        }
      }
      if (slot) {
        out.slot = slot
        out.matched.push('slot')
      }
    }
    break
  }

  // ── 奥义名称矫正：从全文匹配已知奥义名称 ──
  if (category === '奥义') {
    const foundAoYi = AO_YI_NAMES.find(n => normLines.some(l => l.includes(normalize(n))))
    if (foundAoYi) {
      if (out.item_name !== foundAoYi) {
        console.log(`[奥义] 名称矫正: ${out.item_name} → ${foundAoYi}`)
        out.item_name = foundAoYi
      }
    }
  }

  // ── 逐行词库匹配 ──
  for (let i = 0; i < lines.length; i++) {
    if (consumed.has(i)) continue
    const raw = lines[i]
    const norm = normLines[i]

    // 品质
    const spiritQ = matchSpiritQuality(raw)
    const quality = QUALITY_DICT.find(q => norm.includes(q)) ?? spiritQ
    if (quality && !out.quality) {
      out.quality = quality
      out.matched.push('quality')
      consumed.add(i)
      continue
    }

    // 打造
    const craft = CRAFT_DICT.find(c => norm.includes(c))
    if (craft && !out.craft_level) {
      out.craft_level = craft
      out.matched.push('craft_level')
      consumed.add(i)
      continue
    }

    // 职业（全职业 → '' 不区分，不占角标）
    const allJob = ALL_JOB_WORDS.find(w => norm.includes(w))
    if (allJob && !out.equip_job) {
      out.equip_job = ''
      consumed.add(i)
      continue
    }
    const job = JOB_DICT.find(j => norm.includes(j))
    if (job && !out.equip_job) {
      out.equip_job = job
      out.matched.push('equip_job')
      consumed.add(i)
      continue
    }

    // 等级（不限等级 → 0 不区分，不占角标；「等级限制：100」无「级」字也能匹配）
    if (NO_LEVEL_WORDS.some(w => norm.includes(w)) && out.equip_level === 0) {
      consumed.add(i)
      continue
    }
    const lvLabel = norm.match(/等级限制[:：了]?(\d{2,3})/)
    const lvGhost = norm.match(/等级限制[:：了]?(\d)[幽丽矗曲吨]/) // 游戏字体「00」连笔形近字：1幽/1丽/1吨 → 100
    const lvMatch = norm.match(/(\d{2,3})级/)
    const lvNum = lvLabel ? Number(lvLabel[1])
      : lvGhost ? Number(lvGhost[1]) * 100
      : lvMatch ? Number(lvMatch[1]) : null
    if (lvNum !== null && out.equip_level === 0) {
      out.equip_level = nearestEquipLevel(lvNum)
      out.matched.push('equip_level')
      consumed.add(i)
      continue
    }
    // 等级限制行识别失败（值非纯数字，如「1幽」）→ 消费该行但不填等级，用户手动选
    if (norm.includes('等级限制') && out.equip_level === 0) {
      consumed.add(i)
      continue
    }

    // 灵魄位置
    const pos = SPIRIT_POSITION_DICT.find(p => norm.includes(p))
    if (pos && category === '灵魄' && !out.spirit_position) {
      out.spirit_position = pos
      out.matched.push('spirit_position')
      consumed.add(i)
      continue
    }

    // 部位（仅装备品类；灵魄行里的部位描述不误判）
    const slot = SLOT_DICT.find(s => norm.includes(s))
    if (slot && category === '装备' && !out.slot) {
      out.slot = slot
      out.matched.push('slot')
      consumed.add(i)
      continue
    }

    // 其他标签行（职业/等级/部位/声望/耐久等识别不出值时也消费，不进属性备注）
    if (LABEL_PREFIX_RE.test(norm)) {
      consumed.add(i)
      continue
    }
  }

  // ── 属性已移除，不再从 OCR 提取 ──

  return out
}
