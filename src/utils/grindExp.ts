// 每日打怪经验计算（升级计算器 · 打怪经验面板）
// 公式（用户 2026-08-16 定义，同步《经验获取.md》）：
// 1. 单群每小时经验 = 怪物修正经验 × 14 ÷ 疲劳 × 数量系数(中十倍数) × 效率值
//    （修正经验 = 基础经验 ÷ 疲劳；效率 = 3600 ÷ (打怪时间 + 刷新周期) × 疲劳 × 数量，
//    打怪时间默认 0——打死一批怪后刷新计时才开始，一批完整周期 = 打怪耗时 + 刷新周期）
// 2. 参与群与目标地图（2026-08-23 起唯一模式 = 等级段）：参与群 = 覆盖当天等级的段（GrindSegment，
//    闭区间）勾选并集，勾选即打、不做目标地图自动竞争——刷图路线由等级段手动指定（默认勾选来自经验表
//    B 表最优打怪群组合，2026-08-23 用户确认不再需要全局勾选）；等级未落在任何段内 → 当天不打怪、
//    经验 0、不烧疲劳。有 boss 图（东岭关/凤鸣山等）中衰减=0 的超窗口勾选群照打照烧（2026-08-19 口径，
//    烧疲劳无经验）；自强图（卧牛山/阳平关等）超窗口群打不了，不打不烧。
// 3. 等级差衰减：怪物比角色高 1~8 级、角色比怪物高 1~7 级各有衰减比例（可改），差超出范围无经验
// 4. 队伍人数/开齐心的乘数：不开齐心 1~5 人 100%/85%/80%/75%/68%，开齐心 100%/105%/109%/112%/115%
// 5. 周上限跨天累计：刷怪 580 分钟/周、齐心 240 分钟/周（由 remainingGrindMin/remainingQiXinMin 逐天递减）
// 6. 疲劳池约束（与时间上限并存，取先到者）：
//    系统疲劳 380/天（每天 0 点刷新、不累积）；大疲劳每周额度（默认 2520，设置可改，每周一 0 点重置）
//    当日可烧 = 380 + 本周剩余大疲劳；烧速 = Σ参与打怪的群效率——有 boss 图含无经验群（超+8 打怪
//    即耗疲劳，与经验无关）；无 boss 自强图只烧参与群（超+8/低等级群不打不烧），疲劳耗尽截断当日刷怪
// 7. 其他加成：好友亲密度、师徒、青梅、装备熟练度（称号 2026-08-23 起移除）、当天双倍时间、加成道具（bonusMult，2026-08-21）
// 8. 最终 = 目标地图群每小时经验总和 × 全部加成 × 当天刷怪小时数（分钟加权后 ÷ 60）

export interface GrindMonster {
  id: number
  name: string
  area: string
  level: number
  baseExp: number
  fatigue: number
  multiplier: number
  quantity: number // 每批刷怪数量
  respawnTime: number // 刷新周期（秒）
  killTime?: number // 打怪时间（秒/批）：打死一批怪所需时间，怪死后才开始刷新计时，缺省 0
}

// 等级段刷图配置（2026-08-23 恢复，来源 = 经验表 B 表最优打怪群组合）：一个段 = 闭区间
// [levelFrom, levelTo] 内勾选的怪物群。按当天角色等级取覆盖段勾选的并集，勾选即打、不做目标地图
// 自动竞争（2026-08-23 起唯一模式，全局勾选已移除）；等级未落在任何段内 → 当天不打怪。
export interface GrindSegment {
  levelFrom: number
  levelTo: number // 闭区间，含两端
  monsterIds: number[] // 本段勾选的怪物行（数据库行 id，每行独立勾选——同名行互不影响）
}

export interface GrindConfig {
  dailyHours: number[] // 每日刷怪时长（小时），7 项，周一~周日
  doubleExpDays: boolean[] // 每日双倍时间，7 项，周一~周日
  qiXinDays: boolean[] // 每日开齐心，7 项，周一~周日
  partySize: number // 队伍人数 1-5
  qiXinPartySize?: number // 开齐心人数 1-5，缺省 = 队伍人数；开齐心的分钟按此人数查开齐心表（不开齐心的分钟仍按队伍人数查表）
  intimacyLevel: number // 好友亲密度 0-10
  mentorBonus: number // 师徒加成（%）
  plumBonus: number // 青梅加成（%）
  titleBonus: number // 称号加成（%）；2026-08-23 起不再参与计算（保留字段兼容旧存储数据，界面已移除输入）
  masteryBonus: number // 装备熟练度加成（%）
  monsterIds?: number[] // 历史字段：全局勾选（2026-08-23 起计算不再使用，仅迁移——旧配置转为单段后弃用）
  segments?: GrindSegment[] // 等级段配置（2026-08-23 起唯一模式，默认由 B 表最优组合填充）；等级未落在任何段内 → 不打怪
  decayRates: Record<string, number> // 打怪衰减率表：key = 角色−怪物等级差（-7..7），值为衰减率 0~1
  bigFatigueCap?: number // 每周大疲劳额度（疲劳/周），默认 DEFAULT_BIG_FATIGUE_CAP
  startSystemFatigue?: number // 起始日（模拟第 1 天）剩余系统疲劳，缺省 = 满额 SYSTEM_DAILY_FATIGUE；仅影响第 1 天，之后每天 0 点刷新
  startBigFatigue?: number // 起始日剩余大疲劳（本周已用掉一部分可调低），缺省 = 满额（= bigFatigueCap）；仅影响首个 7 天组，之后每周重置回满额
}

export const WEEKLY_GRIND_MIN_CAP = 580
export const WEEKLY_QIXIN_MIN_CAP = 240
export const GRIND_EXP_BASE_MULT = 14
export const SYSTEM_DAILY_FATIGUE = 380 // 系统疲劳：每天 0 点刷新补满，当天用不完不累积
export const DEFAULT_BIG_FATIGUE_CAP = 2520 // 大疲劳：每周至多消耗，默认满额（吃双倍丸获得），可配置

// 人数齐心乘数（文章数据）：{ 无齐心, 开齐心 }
export const QIXIN_MULTIPLIER: Record<number, { noQiXin: number; qiXin: number }> = {
  1: { noQiXin: 1.0, qiXin: 1.0 },
  2: { noQiXin: 0.85, qiXin: 1.05 },
  3: { noQiXin: 0.8, qiXin: 1.09 },
  4: { noQiXin: 0.75, qiXin: 1.12 },
  5: { noQiXin: 0.68, qiXin: 1.15 },
}

// 好友亲密度经验加成（0-10 级，文章数据）
export const INTIMACY_BONUS: Record<number, number> = {
  0: 0, 1: 0.08, 2: 0.1, 3: 0.1, 4: 0.13, 5: 0.13,
  6: 0.15, 7: 0.15, 8: 0.18, 9: 0.18, 10: 0.2,
}

// 打怪衰减率默认表（可编辑）：key = 角色等级 − 怪物等级（diff），diff ∈ [−8, +7] 才有经验，表外无经验
// 小X = 角色比怪物低 X 级（怪物更高）；大X = 角色比怪物高 X 级（怪物更低）
// 小8 96%（默认值，可在设置中修改）、小7 97.26%、小6=小5 96.38%、小4 97.23%、小3 98.83%、
// 小2~大3（含同级）100%、大4 40%、大5 30%、大6 20%、大7 10%
export const DEFAULT_DECAY_RATES: Record<number, number> = {
  [-8]: 0.96, [-7]: 0.9726, [-6]: 0.9638, [-5]: 0.9638, [-4]: 0.9723, [-3]: 0.9883,
  [-2]: 1, [-1]: 1, [0]: 1, [1]: 1, [2]: 1, [3]: 1,
  [4]: 0.4, [5]: 0.3, [6]: 0.2, [7]: 0.1,
}
// 有序 diff 列表（−8..+7），供设置弹窗渲染编辑区
export const DECAY_RATE_DIFFS: number[] = Array.from({ length: 16 }, (_, i) => i - 8)

// 怪物群标识：地区+等级+名称（如 卧牛山100小怪）
export function monsterGroupId(m: Pick<GrindMonster, 'area' | 'level' | 'name'>): string {
  return `${m.area}${m.level}${m.name}`
}

// 按角色等级取勾选的怪物行：所有覆盖该等级的段取并集（去重，保持段内顺序）；
// 等级未落在任何段内或无段 → 空数组（不打怪、不烧疲劳，2026-08-20 用户确认）
export function segmentMonsterIds(config: GrindConfig, charLevel: number): number[] {
  const segs = config.segments
  if (!Array.isArray(segs) || segs.length === 0) return []
  const hit: number[] = []
  for (const s of segs) {
    const from = Number(s.levelFrom)
    const to = Number(s.levelTo)
    if (isNaN(from) || isNaN(to)) continue
    if (charLevel >= Math.min(from, to) && charLevel <= Math.max(from, to)) {
      for (const gid of s.monsterIds ?? []) {
        if (!hit.includes(gid)) hit.push(gid)
      }
    }
  }
  return hit
}

// 怪物修正经验（与 GameGuide.vue 怪物经验表「修正经验」列一致）
export function correctedExp(m: Pick<GrindMonster, 'baseExp' | 'fatigue' | 'multiplier'>): number {
  if (m.fatigue <= 0) return 0
  return (m.baseExp / m.fatigue) * (1 + (m.multiplier - 1) * 0.05)
}

// 怪物群效率（PL/小时），与 GameGuide.vue 怪物经验表「效率」列一致：
// 一批完整周期 = 打怪时间（打死一批怪，默认 0）+ 刷新周期（怪死后才开始计时刷新）；
// 每小时刷怪批数 3600/周期秒 × 每批数量 × 单只疲劳；刷新周期 ≤ 0 视为无效率数据
export function monsterEfficiency(m: Pick<GrindMonster, 'respawnTime' | 'fatigue' | 'quantity' | 'killTime'>): number {
  if (m.respawnTime <= 0 || m.fatigue <= 0 || m.quantity <= 0) return 0
  const killTime = Math.max(0, Number(m.killTime) || 0)
  return (3600 / (m.respawnTime + killTime)) * m.fatigue * m.quantity
}

// 打怪衰减率：diff = 角色−怪物等级 ∈ [−8, +7] 才有经验，查表得衰减率（可传自定义表）；表外 0（排除）
export function decayRate(charLevel: number, monsterLevel: number, rates: Record<number, number> = DEFAULT_DECAY_RATES): number {
  return rates[charLevel - monsterLevel] ?? 0
}

export function qiXinMultiplier(partySize: number, qiXin: boolean): number {
  const n = Math.min(5, Math.max(1, Math.round(partySize)))
  const entry = QIXIN_MULTIPLIER[n] ?? QIXIN_MULTIPLIER[1]
  return qiXin ? entry.qiXin : entry.noQiXin
}

export function intimacyBonus(level: number): number {
  const n = Math.min(10, Math.max(0, Math.round(level)))
  return INTIMACY_BONUS[n] ?? 0
}

export interface GrindGroupDetail {
  id: number // 怪物行 id
  area: string
  name: string
  level: number
  correctedExp: number
  efficiency: number // PL/小时（刷新周期 ≤ 0 时为 0）
  decay: number // 0..1；0 表示不在经验等级范围内
  hourly: number // 每小时经验 = 修正经验 × 14 × 衰减 × 效率
  eligible: boolean // 在目标地图内 且 衰减 > 0 且 效率 > 0（参与经验求和）
  burnsFatigue: boolean // 在目标地图内 且 效率 > 0（无论是否有经验，打怪都消耗疲劳 → 参与烧速）
  inTarget: boolean // 是否在参与计算的目标地图内（各地图参与群每疲劳经验最高者所在地图）
}

export interface GrindCalcResult {
  dailyExp: number // 每日打怪经验（未取整，调用方 Math.round）
  effectiveMinutes: number // min(当天时长×60, 本周剩余刷怪额度, 疲劳容量对应分钟)
  qiXinMinutes: number // 开齐心时 min(effective, 本周剩余齐心额度)，否则 0
  normalMinutes: number // 剩余分钟（按无齐心乘数）
  hourlySum: number // 目标地图勾选群的每小时经验总和（修正经验 × 14 × 衰减率 × 效率；不合格/无效率群不参与）
  burnPerHour: number // 疲劳烧速（疲劳/小时）= Σ目标地图有效率数据群（含无经验群）；无效率数据为 0
  fatigueUsed: number // 当日实际消耗疲劳 = 有效分钟 × 烧速 ÷ 60
  systemFatigueUsed: number // 其中系统疲劳部分（≤ 当天剩余系统疲劳，默认 380/天）
  bigFatigueUsed: number // 其中大疲劳部分（从本周剩余大疲劳中扣）
  fatigueLimited: boolean // 是否被疲劳容量截断（时间配置没用满）
  remainingBigFatigue: number // 当日扣减后本周剩余大疲劳
  targetArea: string | null // 参与计算的目标地图；无勾选或全部超等级范围时为 null
  groupDetails: GrindGroupDetail[]
  activeGroupCount: number // 参与计算（目标地图内且合格）的群数
  skippedGroupCount: number // 已勾选但不参与计算（不在目标地图）的群数
}

// 当天打怪配置（由调用方按星期几从 config 选定；周剩余额度由逐天模拟跨天递减，每周重置）
export interface GrindDayOptions {
  doubleExp?: boolean // 当天双倍时间
  qiXin?: boolean // 当天开齐心
  remainingGrindMin?: number // 本周剩余刷怪上限（分钟）
  remainingQiXinMin?: number // 本周剩余齐心上限（分钟）
  remainingBigFatigue?: number // 本周剩余大疲劳（疲劳点），默认满额
  remainingSystemFatigue?: number // 当天剩余系统疲劳（疲劳点），默认满额 SYSTEM_DAILY_FATIGUE（逐天模拟仅第 1 天可 < 满额）
  bonusMult?: number // 加成道具打怪经验倍率（2026-08-21，默认 1；逐天模拟按当天未过期道具计算）
  decayRates?: Record<number, number> // 打怪衰减率表（2026-08-27 起全局共享，由调用方传入；缺省 = config.decayRates 旧值 / 默认表）
}

// totalBonusRate = 1 + 经验加速 + 跨服王城胜利经验加成（由 Vue 侧 getTotalBonusRate 传入）
export interface GrindRates {
  hourlySum: number // 目标地图勾选群的每小时经验总和（修正经验 × 14 × 衰减率 × 效率；不合格/无效率群不参与）
  burnPerHour: number // 疲劳烧速（疲劳/小时）= Σ目标地图有效率数据群（含无经验群）；无效率数据为 0
  qiXinPerMin: number // 开齐心的分钟每分钟经验（hourlySum × 加成 × 齐心乘数 ÷ 60）
  normalPerMin: number // 无齐心的分钟每分钟经验
  targetArea: string | null
  groupDetails: GrindGroupDetail[]
  activeGroupCount: number
  skippedGroupCount: number
}

// 某等级下的打怪速率（不含时长分配）：群明细 / 小时经验 / 疲劳烧速 / 每分钟经验。
// 与 dailyGrindExp 共享群筛选与加成逻辑；逐天模拟中升级中途换等级重计价时按新等级调用。
export function grindRatesAtLevel(
  config: GrindConfig,
  monsters: GrindMonster[],
  charLevel: number,
  totalBonusRate: number,
  options: { doubleExp?: boolean; bonusMult?: number; decayRates?: Record<number, number> } = {},
): GrindRates {
  // 2026-08-23：按数据库行 id 查怪物（每行独立——同名怪物行互不合并，勾选哪行按哪行计算）
  const byId = new Map(monsters.map((m) => [m.id, m]))
  // 衰减率全局共享（2026-08-27）：options.decayRates 优先（升级计算器全局设定），config.decayRates 仅兼容旧数据
  const rates: Record<number, number> = options.decayRates ?? config.decayRates ?? DEFAULT_DECAY_RATES

  // 等级段（2026-08-23 起唯一模式，全局勾选已移除）：按当天等级取覆盖段的勾选并集；未覆盖 → 空（不打怪）
  const selected = segmentMonsterIds(config, charLevel)
    .map((gid) => byId.get(gid))
    .filter((m): m is GrindMonster => !!m)
  // 有 boss 地图（东岭关/凤鸣山等）衰减=0 的超窗口勾选群照打照烧（2026-08-19 口径）。
  const bossAreas = new Set(monsters.filter((mm) => mm.name === 'boss').map((mm) => mm.area))

  // 勾选即打，不做目标地图自动竞争——刷图路线由等级段手动指定（默认勾选来自 B 表最优打怪群组合）。
  // 参与 = 有效率数据 且（有经验 或 所在图有 boss 超窗口照烧）；自强图超窗口群打不了，不打不烧。
  const groupDetails: GrindGroupDetail[] = []
  let hourlySum = 0
  let burnPerHour = 0
  let activeCount = 0
  let inTargetCount = 0
  const areas = new Set<string>()
  for (const m of selected) {
    const ce = correctedExp(m)
    const eff = monsterEfficiency(m)
    const decay = decayRate(charLevel, m.level, rates)
    const takesPart = eff > 0 && (decay > 0 || bossAreas.has(m.area))
    const inTarget = takesPart
    if (inTarget) inTargetCount++
    const eligible = takesPart && decay > 0 && eff > 0
    const burnsFatigue = takesPart && eff > 0
    const hourly = ce * GRIND_EXP_BASE_MULT * decay * eff
    groupDetails.push({ id: m.id, area: m.area, name: m.name, level: m.level, correctedExp: ce, efficiency: eff, decay, hourly, eligible, burnsFatigue, inTarget })
    if (eligible) { hourlySum += hourly; activeCount++ }
    if (burnsFatigue) burnPerHour += eff
    if (takesPart) areas.add(m.area)
  }
  // 参与群所在地图并集（一段内可勾多图；跨段升级当天"刷怪地图"列显示多图）
  const targetArea = areas.size > 0 ? [...areas].join('、') : null
  const skippedGroupCount = selected.length - inTargetCount

  const bonusMult =
    totalBonusRate *
    (1 + intimacyBonus(config.intimacyLevel)) *
    (1 + (Number(config.mentorBonus) || 0) / 100) *
    (1 + (Number(config.plumBonus) || 0) / 100) *
    (1 + (Number(config.masteryBonus) || 0) / 100) *
    (options.bonusMult ?? 1) *
    (options.doubleExp ? 2 : 1)

  return {
    hourlySum,
    burnPerHour,
    // 开齐心的分钟按开齐心人数查开齐心表（缺省 = 队伍人数）；不开齐心的分钟按队伍人数查不开齐心表
    qiXinPerMin: (hourlySum * bonusMult * qiXinMultiplier(config.qiXinPartySize ?? config.partySize, true)) / 60,
    normalPerMin: (hourlySum * bonusMult * qiXinMultiplier(config.partySize, false)) / 60,
    targetArea,
    groupDetails,
    activeGroupCount: activeCount,
    skippedGroupCount,
  }
}

export function dailyGrindExp(
  config: GrindConfig,
  monsters: GrindMonster[],
  charLevel: number,
  totalBonusRate: number,
  hoursPerDay = 1,
  options: GrindDayOptions = {},
): GrindCalcResult {
  const rates = grindRatesAtLevel(config, monsters, charLevel, totalBonusRate, {
    doubleExp: options.doubleExp,
    bonusMult: options.bonusMult,
    decayRates: options.decayRates,
  })
  const { burnPerHour, hourlySum } = rates

  // 当天时长 + 本周剩余额度 + 疲劳容量上限 + 齐心拆分
  const hours = Math.max(0, Number(hoursPerDay) || 0)
  const remainingGrindMin = options.remainingGrindMin ?? WEEKLY_GRIND_MIN_CAP
  const remainingQiXinMin = options.remainingQiXinMin ?? WEEKLY_QIXIN_MIN_CAP
  const bigFatigueCap = config.bigFatigueCap ?? DEFAULT_BIG_FATIGUE_CAP
  const remainingBigFatigue = Math.max(0, options.remainingBigFatigue ?? bigFatigueCap)
  // 当天剩余系统疲劳：默认满额 380/天（0 点刷新）；起始日可设置已消耗后的剩余值
  const remainingSystemFatigue = Math.max(0, options.remainingSystemFatigue ?? SYSTEM_DAILY_FATIGUE)
  // 疲劳容量上限对应分钟 = (当天剩余系统疲劳 + 本周剩余大疲劳) ÷ 烧速；烧速 ≤ 0 时无疲劳约束
  const fatigueMinuteCap = burnPerHour > 0
    ? ((remainingSystemFatigue + remainingBigFatigue) * 60) / burnPerHour
    : Infinity
  const effectiveMinutes = Math.min(hours * 60, Math.max(0, remainingGrindMin), fatigueMinuteCap)
  const qiXinMinutes = options.qiXin ? Math.min(effectiveMinutes, Math.max(0, remainingQiXinMin)) : 0
  const normalMinutes = effectiveMinutes - qiXinMinutes

  // 疲劳消耗：先扣系统疲劳（当天剩余、不跨天），超出部分扣大疲劳（本周剩余递减）
  const fatigueUsed = (effectiveMinutes * burnPerHour) / 60
  const systemFatigueUsed = Math.min(remainingSystemFatigue, fatigueUsed)
  const bigFatigueUsed = Math.max(0, fatigueUsed - systemFatigueUsed)
  const fatigueLimited = burnPerHour > 0 && fatigueMinuteCap < hours * 60

  // 每分钟经验加权（开齐心分钟按齐心乘数，其余按无齐心乘数）
  const dailyExp = rates.qiXinPerMin * qiXinMinutes + rates.normalPerMin * normalMinutes

  return {
    dailyExp,
    effectiveMinutes,
    qiXinMinutes,
    normalMinutes,
    hourlySum,
    burnPerHour,
    fatigueUsed,
    systemFatigueUsed,
    bigFatigueUsed,
    fatigueLimited,
    remainingBigFatigue: Math.max(0, remainingBigFatigue - bigFatigueUsed),
    targetArea: rates.targetArea,
    groupDetails: rates.groupDetails,
    activeGroupCount: rates.activeGroupCount,
    skippedGroupCount: rates.skippedGroupCount,
  }
}
