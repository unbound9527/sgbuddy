// 打怪最优地区组合（怪物经验 B 表 · 2026-08-23）
// 每个角色等级：候选群 = 等级差衰减窗口 [L−7, L+8] 内的**合格群**（衰减 > 0 且 效率 > 0，
// 与升级计算器 grindExp.ts 全局模式一致）；按地区分组。
// 默认组合口径（2026-08-27 起 = 地区间取**每周可获得经验最高**；2026-08-23 确认"效率最高"的实现）：
// 地区内取**全部合格群**（勾选即打——时间瓶颈下每小时经验单调增，即每周经验最高；
// 疲劳瓶颈下全部勾选未必是该地区每周经验最优，可由手动编辑（弹层）挑出更优组合）；
// 地区间取每周可获得经验 weeklyExp 最高者。
//   组合每小时经验 hourly = Σ(q × eff)；烧速 burnPerHour = Σ(eff)（复用计算器口径）
//   疲劳容量可烧分钟 = 5180 × 60 ÷ burnPerHour（周疲劳 = 系统 380×7 + 大疲劳 2520 = 5180）
//   每周经验 = min(周刷怪分钟 580, 疲劳容量可烧分钟) × hourly ÷ 60
// 两种瓶颈（仅作展示口径）：
//   时间瓶颈（burnPerHour ≤ 535.9/时，580 分钟内烧不完 5180 疲劳）→ 每周 580 分钟打满，
//   每周经验 ∝ hourly（与"每小时经验最高"同序）；
//   疲劳瓶颈（burnPerHour > 535.9/时，先烧完疲劳）→ 每周经验 = 5180 × 每疲劳经验（q 加权平均），
//   hourly 高 ≠ 每周经验高（2026-08-27 用户发现：疲劳瓶颈下应按 weeklyExp 选地区）。
// B 表支持按等级编辑组合（勾选窗口内合格群，可跨地区）并持久化（localStorage），
// 每级可恢复默认；编辑后的组合用 computeGrindComboStats 重算指标。
// 双倍/齐心/其他加成为乘性常数，不改变组合间排序，故 B 表不纳入。
// 全局因子（2026-08-27 起跟随升级计算器口径，经 opts 传入）：
//   衰减率 rates：跟随全局自定义衰减率（ecDecayRates），影响合格群判定、每小时经验与最优组合选取；
//   总倍率 bonusRate：封印加速 + 跨服王城胜利加成（= 1 + 加速率 + 王城加成，按角色等级查段），
//   乘进 q/每小时经验/每周经验；同一行内为乘性常数，不改变组合间排序。
import type { GrindMonster } from './grindExp'
import {
  correctedExp, decayRate, DEFAULT_BIG_FATIGUE_CAP, DEFAULT_DECAY_RATES,
  GRIND_EXP_BASE_MULT, monsterEfficiency, SYSTEM_DAILY_FATIGUE, WEEKLY_GRIND_MIN_CAP,
} from './grindExp'

export type BottleneckKind = 'time' | 'fatigue' | 'none'

export interface BestGrindGroupRow {
  level: number
  area: string // 最优地区；无候选时为 '—'
  groups: GrindMonster[] // 该地区全部合格群（组合，按怪物等级+名称升序）
  value: number // 组合单位疲劳经验 = Σ(q × eff) / Σ(eff)，q = 修正经验 × 14 × 衰减 × 总倍率（含 ×14 常数与封印/王城倍率）；无候选为 0
  hourlySum: number // 组合每小时经验 = Σ(q × eff)（含总倍率）；无候选为 0
  burnPerHour: number // 疲劳烧速（疲劳/时）= Σ(eff)；无候选为 0
  weeklyExp: number // 每周可获得经验 = min(580, 5180×60÷burn) × hourly ÷ 60（hourly 已含总倍率）；无候选为 0
  bottleneck: BottleneckKind // 瓶颈类型：time = 每周 580 分钟打满、fatigue = 先烧完疲劳、none = 无候选
}

export interface BestGrindOptions {
  from?: number // 起算等级，默认 84
  to?: number // 截止等级，默认 155
  rates?: Record<number, number> // 等级差衰减率表，默认 DEFAULT_DECAY_RATES；升级计算器全局自定义衰减率时传 ecDecayRates
  weeklyMinutes?: number // 每周刷怪上限（分钟），默认 WEEKLY_GRIND_MIN_CAP（580）
  weeklyFatigue?: number // 每周疲劳容量（疲劳点），默认 SYSTEM_DAILY_FATIGUE×7 + DEFAULT_BIG_FATIGUE_CAP（5180）
  bonusRate?: number | ((level: number) => number) // 总经验倍率 = 1 + 封印加速率 + 王城加成；可传固定值或按等级函数，默认 1
}

// 解析总倍率：函数型按等级取值（封印加速率随角色等级分段），数字型直接使用；缺省 1
function resolveBonusRate(opts: BestGrindOptions, level: number): number {
  const b = opts.bonusRate
  return typeof b === 'function' ? b(level) : (b ?? 1)
}

// 窗口内合格群 + 其 q/eff（供 B 表编辑弹层列出候选；按等级、id 升序）
export interface GrindCandidate {
  m: GrindMonster
  q: number // 每疲劳经验 = 修正经验 × 14 × 衰减 × 总倍率（含 ×14 常数与封印/王城倍率）
  eff: number // 疲劳烧速（疲劳/时）
  inWindow: boolean // 是否在衰减窗口 [L−7, L+8] 内（窗口外群可勾选保存但本级不参与统计）
}

// 组合统计（供编辑后的自定义组合重算指标；空组合 → 全 0 + bottleneck none）
export interface GrindComboStats {
  value: number
  hourlySum: number
  burnPerHour: number
  weeklyExp: number
  bottleneck: BottleneckKind
}

// 某等级窗口 [L−7, L+8] 内全部合格群（跨地区），供编辑弹层勾选
export function listGrindCandidates(monsters: GrindMonster[], level: number, opts: BestGrindOptions = {}): GrindCandidate[] {
  const rates = opts.rates ?? DEFAULT_DECAY_RATES
  const br = resolveBonusRate(opts, level)
  const list: GrindCandidate[] = []
  for (const m of monsters) {
    if (m.fatigue <= 0 || m.baseExp <= 0) continue
    if (m.level < level - 7 || m.level > level + 8) continue
    if (decayRate(level, m.level, rates) <= 0) continue
    const eff = monsterEfficiency(m)
    if (eff <= 0) continue
    list.push({ m, q: correctedExp(m) * GRIND_EXP_BASE_MULT * decayRate(level, m.level, rates) * br, eff, inWindow: true })
  }
  return list.sort((a, b) => a.m.level - b.m.level || a.m.name.localeCompare(b.m.name, 'zh-CN') || a.m.id - b.m.id)
}

// 编辑弹层候选（2026-08-23 用户口径）：衰减窗口 [L−7, L+8] 内有合格群的地图，列出该地图**全部**
// 合格群（含窗口外群——升级到相邻等级后可打，可提前勾选保存，但本级不参与统计、无衰减不烧疲劳）。
// 无窗口内合格群的地图不列出；窗口外群 inWindow = false（UI 灰显 + 「窗口外」标记）。
export function listAreaFullCandidates(monsters: GrindMonster[], level: number, opts: BestGrindOptions = {}): GrindCandidate[] {
  const rates = opts.rates ?? DEFAULT_DECAY_RATES
  const br = resolveBonusRate(opts, level)
  // 第一遍：窗口内合格群（衰减 > 0 且 效率 > 0）所在地图集合
  const areas = new Set<string>()
  for (const m of monsters) {
    if (m.fatigue <= 0 || m.baseExp <= 0) continue
    if (m.level < level - 7 || m.level > level + 8) continue
    if (decayRate(level, m.level, rates) <= 0) continue
    if (monsterEfficiency(m) <= 0) continue
    areas.add(m.area)
  }
  if (areas.size === 0) return []
  // 第二遍：这些地图的全部合格群（含窗口外）
  const list: GrindCandidate[] = []
  for (const m of monsters) {
    if (m.fatigue <= 0 || m.baseExp <= 0) continue
    if (!areas.has(m.area)) continue
    const eff = monsterEfficiency(m)
    if (eff <= 0) continue
    const decay = decayRate(level, m.level, rates)
    list.push({ m, q: correctedExp(m) * GRIND_EXP_BASE_MULT * decay * br, eff, inWindow: decay > 0 })
  }
  return list.sort((a, b) => a.m.level - b.m.level || a.m.name.localeCompare(b.m.name, 'zh-CN') || a.m.id - b.m.id)
}

// 给定群列表（跨地区、任意勾选）重算组合指标；群为空或全不合格 → 全 0 + none
export function computeGrindComboStats(groups: GrindMonster[], level: number, opts: BestGrindOptions = {}): GrindComboStats {
  const rates = opts.rates ?? DEFAULT_DECAY_RATES
  const br = resolveBonusRate(opts, level)
  const weeklyMinutes = opts.weeklyMinutes ?? WEEKLY_GRIND_MIN_CAP
  const weeklyFatigue = opts.weeklyFatigue ?? SYSTEM_DAILY_FATIGUE * 7 + DEFAULT_BIG_FATIGUE_CAP
  let hourlySum = 0
  let burnPerHour = 0
  for (const m of groups) {
    if (m.fatigue <= 0 || m.baseExp <= 0) continue
    if (m.level < level - 7 || m.level > level + 8) continue
    const rate = decayRate(level, m.level, rates)
    if (rate <= 0) continue
    const eff = monsterEfficiency(m)
    if (eff <= 0) continue
    hourlySum += correctedExp(m) * GRIND_EXP_BASE_MULT * rate * eff * br
    burnPerHour += eff
  }
  if (burnPerHour <= 0) return { value: 0, hourlySum: 0, burnPerHour: 0, weeklyExp: 0, bottleneck: 'none' }
  const fatigueMinutes = (weeklyFatigue * 60) / burnPerHour
  const weeklyExp = (Math.min(weeklyMinutes, fatigueMinutes) * hourlySum) / 60
  return {
    value: hourlySum / burnPerHour,
    hourlySum,
    burnPerHour,
    weeklyExp,
    bottleneck: fatigueMinutes < weeklyMinutes ? 'fatigue' : 'time',
  }
}

// 每个等级的最优地区 + 打怪群组合（默认 = 地区内全部合格群、地区间取每周可获得经验最高；
// A 表数据变化后重新调用即刷新）
export function computeBestGrindGroups(monsters: GrindMonster[], opts: BestGrindOptions = {}): BestGrindGroupRow[] {
  const from = opts.from ?? 84
  const to = opts.to ?? 155
  const rows: BestGrindGroupRow[] = []
  for (let L = from; L <= to; L++) {
    // 候选：衰减窗口 [L−7, L+8] 内合格群（衰减 > 0 且 效率 > 0，与计算器一致）
    const candidates = listGrindCandidates(monsters, L, opts)
    // 按地区分组（记录每群 q/eff）
    const byArea = new Map<string, Array<{ q: number; eff: number; m: GrindMonster }>>()
    for (const c of candidates) {
      const arr = byArea.get(c.m.area)
      if (arr) arr.push({ q: c.q, eff: c.eff, m: c.m })
      else byArea.set(c.m.area, [{ q: c.q, eff: c.eff, m: c.m }])
    }
    // 默认组合 = 地区内全部合格群（勾选即打）；地区间取每周可获得经验 weeklyExp 最高者
    // （2026-08-27 用户口径：疲劳瓶颈下 hourly 高 ≠ 每周经验高，须按 weeklyExp 比较）
    let best: { area: string; groups: GrindMonster[]; stats: GrindComboStats } | null = null
    for (const [area, entries] of byArea) {
      const groups = entries.map((e) => e.m)
      const stats = computeGrindComboStats(groups, L, opts)
      if (!best || stats.weeklyExp > best.stats.weeklyExp) {
        best = { area, groups, stats }
      }
    }
    rows.push({
      level: L,
      area: best ? best.area : '—',
      groups: best ? sortGrindMonsters(best.groups) : [],
      value: best ? best.stats.value : 0,
      hourlySum: best ? best.stats.hourlySum : 0,
      burnPerHour: best ? best.stats.burnPerHour : 0,
      weeklyExp: best ? best.stats.weeklyExp : 0,
      bottleneck: best ? best.stats.bottleneck : 'none',
    })
  }
  return rows
}

// 组合显示串：按「怪物等级 + 名称」升序、`86朵思大王(10) · 92天剑妖(10)`（2026-08-23 加数量，
// 与打怪面板 chip 样式 `103韩福(10)` 一致）；同名同级行（重复录入）合并为一项且数量相加
// （2026-08-27 起），无候选 → '无候选'
export function formatBestGrindGroups(groups: GrindMonster[]): string {
  const qty = new Map<string, number>()
  const order: string[] = []
  for (const g of sortGrindMonsters(groups)) {
    const key = `${g.level}${g.name}`
    if (!qty.has(key)) {
      qty.set(key, 0)
      order.push(key)
    }
    qty.set(key, qty.get(key)! + g.quantity)
  }
  return order.length > 0 ? order.map(k => `${k}(${qty.get(k)})`).join(' · ') : '无候选'
}

// 怪物群展示排序：等级升序，同级按名称升序（再按 id 保证稳定）（2026-08-27 用户指定）
export function sortGrindMonsters(groups: GrindMonster[]): GrindMonster[] {
  return [...groups].sort((a, b) =>
    a.level - b.level || a.name.localeCompare(b.name, 'zh-CN') || a.id - b.id,
  )
}
