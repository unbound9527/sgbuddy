// 逐天模拟 · 单日经验结算（升级计算器）
// 口径（用户 2026-08-18 定义）：
// - 当天经验按 任务 → 道具 → 打怪 顺序累计（瞬时来源在前，打怪时长在后）；
// - 任一来源导致累计经验跨过升级线时立刻升级，**剩余**来源按新等级重计价：
//   任务/道具 = 新等级标准单位经验 × 新等级总倍率；打怪 = 新等级衰减率下的分钟经验；
// - 打怪为分钟流：先开齐心分钟、后无齐心分钟；升级中途换等级后，剩余分钟按新等级
//   速率/烧速继续，疲劳容量与周上限（刷怪/齐心/大疲劳）逐段按实际烧速记账；
// - 一天可跨多级（递归处理），最终剩余经验与结束等级返回供逐天循环继续。
import {
  grindRatesAtLevel,
  WEEKLY_GRIND_MIN_CAP,
  WEEKLY_QIXIN_MIN_CAP,
  DEFAULT_BIG_FATIGUE_CAP,
  SYSTEM_DAILY_FATIGUE,
} from './grindExp'
import type { GrindConfig, GrindMonster, GrindRates } from './grindExp'

export interface DayExpRow {
  level: number
  exp: number // 该级升到下一级所需经验
  sue: number // 该级标准单位经验
}

export interface DaySettleOptions {
  level: number // 当天起始等级
  targetLevel: number
  carryExp: number // 当天起始已积累（含初始进度）
  expTable: DayExpRow[]
  // 逐天模拟性能优化（可选）：预构建的经验等级 Map 与打怪速率查询，避免每天重建/重复全量扫描；
  // 缺省时内部按原逻辑重建/直接计算
  expMap?: Map<number, DayExpRow>
  grindRates?: (level: number, totalBonusRate: number, doubleExp: boolean) => GrindRates
  totalBonusRate: (level: number) => number // 封印加速等总倍率（等级相关）
  taskMult: (id: string, level: number) => number // 任务倍率（可随等级段变化）
  itemMult: (id: string) => number
  tasks: { id: string; count: number }[] // 当天各任务可用次数（已按星期/周上限折算）
  items: { id: string; count: number; mult?: number }[] // 当天各道具可用次数；mult = 次数型加成道具每次倍率（覆盖 itemMult，且不乘 itemBonusMult，2026-08-21）
  taskBonusMults?: Record<string, number> // 加成道具任务倍率（2026-08-21）：仅对命中任务生效，默认 1
  itemBonusMult?: number // 加成道具道具经验倍率（2026-08-21，作用于经验道具，默认 1）
  grindBonusMult?: number // 加成道具打怪经验倍率（2026-08-21，默认 1）
  grind: {
    config: GrindConfig
    monsters: GrindMonster[]
    hours: number // 当天刷怪时长（小时）
    doubleExp: boolean
    qiXin: boolean
  }
  remainingGrindMin?: number // 本周剩余刷怪上限（分钟）
  remainingQiXinMin?: number // 本周剩余齐心上限（分钟）
  remainingBigFatigue?: number // 本周剩余大疲劳（疲劳点）
  remainingSystemFatigue?: number // 当天剩余系统疲劳（疲劳点），默认满额 380（0 点刷新）；逐天模拟仅第 1 天传起始日剩余
}

export interface DaySettleResult {
  dailyExp: number // 当天总经验（任务/道具逐次取整，打怪合计取整）
  grindExp: number // 当天打怪经验（取整）
  endLevel: number
  carryExp: number // 结算后累计经验（不足升级的部分）
  leveledUp: boolean
  grindMinutes: number // 实际有效打怪分钟（疲劳/周上限截断后）
  remainingGrindMin: number
  remainingQiXinMin: number
  remainingBigFatigue: number
}

export function settleDay(o: DaySettleOptions): DaySettleResult {
  const expMap = o.expMap ?? new Map(o.expTable.map((r) => [r.level, r]))
  const rowOf = (lv: number) => expMap.get(lv)
  const neededOf = (lv: number) => rowOf(lv)?.exp ?? Infinity
  const sueOf = (lv: number) => rowOf(lv)?.sue ?? 0

  let lvl = o.level
  let carry = o.carryExp
  let remGrind = Math.max(0, o.remainingGrindMin ?? WEEKLY_GRIND_MIN_CAP)
  let remQiXin = Math.max(0, o.remainingQiXinMin ?? WEEKLY_QIXIN_MIN_CAP)
  let remBig = Math.max(0, o.remainingBigFatigue ?? DEFAULT_BIG_FATIGUE_CAP)
  let sysLeft = Math.max(0, o.remainingSystemFatigue ?? SYSTEM_DAILY_FATIGUE) // 当天剩余系统疲劳（默认 380/天，不随段刷新）
  let dayExp = 0
  let grindExp = 0
  let grindMinutes = 0

  // 升级推进：把累计经验按当前等级逐级消化（可连升多级）
  const advanceLevel = () => {
    while (lvl < o.targetLevel && carry >= neededOf(lvl)) {
      carry -= neededOf(lvl)
      lvl++
    }
  }
  // 单笔来源经验入账（任务/道具原子单位，升级发生在单位之间）
  const earn = (exp: number) => {
    dayExp += exp
    carry += exp
    advanceLevel()
  }

  // 1) 活跃任务：逐次结算，每次按当前等级 单位经验 × 任务倍率 × 总倍率 × 加成道具任务倍率（按任务命中）
  for (const t of o.tasks) {
    for (let i = 0; i < t.count; i++) {
      if (lvl >= o.targetLevel) break
      earn(Math.round(sueOf(lvl) * o.taskMult(t.id, lvl) * o.totalBonusRate(lvl) * (o.taskBonusMults?.[t.id] ?? 1)))
    }
  }

  // 2) 经验道具：同样逐次结算（道具倍率不随等级变化，单位经验与总倍率随等级）；
  //    次数型加成道具（mult 覆盖）为独立来源，不乘 道具经验加成倍率 itemBonusMult
  for (const it of o.items) {
    for (let i = 0; i < it.count; i++) {
      if (lvl >= o.targetLevel) break
      const baseMult = it.mult ?? o.itemMult(it.id)
      const bonus = it.mult !== undefined ? 1 : (o.itemBonusMult ?? 1)
      earn(Math.round(sueOf(lvl) * baseMult * o.totalBonusRate(lvl) * bonus))
    }
  }

  // 3) 打怪：分钟流（先开齐心分钟、后无齐心分钟）
  //    每分钟经验随当前等级变化（衰减率/目标地图/总倍率），疲劳容量 = (当天剩余系统疲劳 + 剩余大疲劳) ÷ 烧速
  //    段内跨过升级线时按分钟拆分：升级前的分钟按旧等级、升级后的剩余分钟按新等级重新进入循环
  const hours = Math.max(0, Number(o.grind.hours) || 0)
  let minutesLeft = hours * 60
  while (minutesLeft > 0 && lvl < o.targetLevel) {
    const tbr = o.totalBonusRate(lvl)
    const rr = o.grindRates
      ? o.grindRates(lvl, tbr, !!o.grind.doubleExp)
      : grindRatesAtLevel(o.grind.config, o.grind.monsters, lvl, tbr, { doubleExp: o.grind.doubleExp })
    const grindMult = o.grindBonusMult ?? 1 // 加成道具打怪经验倍率（当天未过期的打怪加成道具）
    const qpm = rr.qiXinPerMin * grindMult
    const npm = rr.normalPerMin * grindMult
    const capFatigue = rr.burnPerHour > 0
      ? ((sysLeft + remBig) * 60) / rr.burnPerHour
      : Infinity
    const segMin = Math.min(minutesLeft, remGrind, capFatigue)
    if (segMin <= 0) break
    const qiXinSeg = o.grind.qiXin && remQiXin > 0 ? Math.min(segMin, remQiXin) : 0
    const normalSeg = segMin - qiXinSeg
    const segExp = qiXinSeg * qpm + normalSeg * npm
    const needed = neededOf(lvl)

    if (carry + segExp < needed) {
      // 整段消费：不升级
      carry += segExp
      grindExp += segExp
      const fatigue = (segMin * rr.burnPerHour) / 60
      const sysU = Math.min(sysLeft, fatigue)
      const bigU = Math.max(0, fatigue - sysU)
      sysLeft -= sysU
      remBig = Math.max(0, remBig - bigU)
      remGrind -= segMin
      remQiXin -= qiXinSeg
      minutesLeft -= segMin
      grindMinutes += segMin
      continue
    }

    // 段内升级：先消费至跨越点（开齐心部分在前，其次无齐心部分）
    const qiXinTotal = qiXinSeg * qpm
    let mCross: number
    let consumedQiXin: number
    if (carry + qiXinTotal >= needed) {
      mCross = (needed - carry) / qpm
      consumedQiXin = mCross
    } else {
      mCross = qiXinSeg + (needed - carry - qiXinTotal) / npm
      consumedQiXin = qiXinSeg
    }
    mCross = Math.min(mCross, segMin) // 浮点误差钳制，不超过段内分钟
    // 升级前消费 mCross 分钟（经验恰好填满升级线，剩余清 0）
    grindExp += mCross <= qiXinSeg
      ? mCross * qpm
      : qiXinTotal + (mCross - qiXinSeg) * npm
    carry = 0
    lvl++
    const fatigue = (mCross * rr.burnPerHour) / 60
    const sysU = Math.min(sysLeft, fatigue)
    const bigU = Math.max(0, fatigue - sysU)
    sysLeft -= sysU
    remBig = Math.max(0, remBig - bigU)
    remGrind -= mCross
    remQiXin -= consumedQiXin
    minutesLeft -= mCross
    grindMinutes += mCross
    // 剩余分钟以新等级重新进入循环（新衰减率/新烧速/新疲劳容量）
  }

  dayExp += Math.round(grindExp)
  return {
    dailyExp: dayExp,
    grindExp: Math.round(grindExp),
    endLevel: lvl,
    carryExp: carry,
    leveledUp: lvl > o.level,
    grindMinutes,
    remainingGrindMin: remGrind,
    remainingQiXinMin: remQiXin,
    remainingBigFatigue: remBig,
  }
}
