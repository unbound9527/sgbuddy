import { describe, expect, it } from 'vitest'
import { settleDay } from './dayExp'
import type { DayExpRow, DaySettleOptions } from './dayExp'
import { WEEKLY_GRIND_MIN_CAP, WEEKLY_QIXIN_MIN_CAP, DEFAULT_BIG_FATIGUE_CAP, SYSTEM_DAILY_FATIGUE, DEFAULT_DECAY_RATES } from './grindExp'
import type { GrindConfig, GrindMonster } from './grindExp'

// 经验表：90 级升 91 需 150，sue 100；91 级升 92 需 200，sue 200；92 级升 93 需 300，sue 300
const expTable: DayExpRow[] = [
  { level: 90, exp: 150, sue: 100 },
  { level: 91, exp: 200, sue: 200 },
  { level: 92, exp: 300, sue: 300 },
]
// 只允许 90→91 跨一次的表（91 级经验巨大，剩余来源按 91 级重计价后不再跨级）
const oneCrossTable: DayExpRow[] = [
  { level: 90, exp: 150, sue: 100 },
  { level: 91, exp: 1e12, sue: 200 },
  { level: 92, exp: 300, sue: 300 },
]

// 怪物：90 级小怪。baseExp = 6000/24360 ⇒ 修正经验×14×效率 = 6000/小时
// （fatigue 0.25、qty 5、刷新 15s ⇒ 效率 300 PL/小时；单人不齐心乘数 1.0 ⇒ 每分钟经验 = 6000×倍率÷60）
const monster = (over: Partial<GrindMonster> = {}): GrindMonster => ({
  id: 1, name: '小怪', area: '塔郎甸', level: 90, baseExp: 6000 / 24360, fatigue: 0.25,
  multiplier: 10, quantity: 5, respawnTime: 15, ...over,
})

const baseCfg = (over?: Partial<GrindConfig>): GrindConfig => ({
  dailyHours: [1, 1, 1, 1, 1, 1, 1],
  doubleExpDays: [false, false, false, false, false, false, false],
  qiXinDays: [false, false, false, false, false, false, false],
  partySize: 1,
  intimacyLevel: 0,
  mentorBonus: 0, plumBonus: 0, titleBonus: 0, masteryBonus: 0,
  // 2026-08-23：唯一模式 = 等级段（全局勾选已移除）；默认单段 [1,200] 勾选种子行，等价旧全局默认
  segments: [{ levelFrom: 1, levelTo: 200, monsterIds: [1] }],
  decayRates: { ...DEFAULT_DECAY_RATES },
  bigFatigueCap: DEFAULT_BIG_FATIGUE_CAP,
  ...over,
})

const settle = (over: Partial<DaySettleOptions> = {}): ReturnType<typeof settleDay> => settleDay({
  level: 90,
  targetLevel: 92,
  carryExp: 0,
  expTable,
  totalBonusRate: () => 1,
  taskMult: () => 1,
  itemMult: () => 1,
  tasks: [],
  items: [],
  grind: {
    config: baseCfg(),
    monsters: [monster()],
    hours: 0,
    doubleExp: false,
    qiXin: false,
  },
  ...over,
})

describe('settleDay · 升级中途重计价', () => {
  it('升级后剩余任务按新等级标准单位经验计价', () => {
    const r = settle({
      expTable: oneCrossTable,
      tasks: [{ id: 'a', count: 3 }],
    })
    // 90 级两个任务：100+100=200 ≥ 150 升级到 91（余 50）；第 3 个按 91 级 sue 200
    expect(r.dailyExp).toBe(400)
    expect(r.endLevel).toBe(91)
    expect(r.carryExp).toBe(250)
    expect(r.leveledUp).toBe(true)
  })

  it('任务→道具顺序：升级后剩余道具按新等级 sue 计价', () => {
    const r = settle({
      expTable: oneCrossTable,
      tasks: [{ id: 'a', count: 1 }], // 100，未升级
      items: [{ id: 'b', count: 3 }],
    })
    // 道具第 1 个 100 → 200 ≥ 150 升级（余 50）；剩余 2 个按 91 级 200 计价
    expect(r.dailyExp).toBe(600) // 100 + 100 + 200 + 200
    expect(r.endLevel).toBe(91)
    expect(r.carryExp).toBe(450)
  })

  it('升级后任务/道具同时换新等级封印加速倍率', () => {
    const r = settle({
      expTable: oneCrossTable,
      totalBonusRate: (lv) => (lv >= 91 ? 2 : 1),
      tasks: [{ id: 'a', count: 3 }],
    })
    // 第 1 个 100；第 2 个 100 → 升级（余 50）；第 3 个 200(sue91) × 2(倍率91) = 400
    expect(r.dailyExp).toBe(600)
    expect(r.endLevel).toBe(91)
    expect(r.carryExp).toBe(450)
  })

  it('打怪中途升级：升级前分钟按旧等级、剩余分钟按新等级衰减率/倍率', () => {
    const r = settle({
      totalBonusRate: (lv) => (lv >= 91 ? 2 : 1),
      expTable: oneCrossTable,
      grind: {
        config: baseCfg(), monsters: [monster()], hours: 1, doubleExp: false, qiXin: false,
      },
    })
    // 90 级每分钟 100（倍率 1）→ 1.5 分钟升 91；剩余 58.5 分钟 × 200（91 级倍率 2，diff=1 无衰减）
    expect(r.grindExp).toBe(11850) // 150 + 58.5×200
    expect(r.dailyExp).toBe(11850)
    expect(r.endLevel).toBe(91)
    expect(r.carryExp).toBe(11700)
    expect(r.grindMinutes).toBe(60)
  })

  it('分段模式：升级跨段自动切换打怪对象（90 级段 A → 91 级段 B）', () => {
    // 2026-08-20 分段模式：等级段手动指定刷图路线，升级跨段时按新等级取新段的怪物群
    // （2026-08-23 恢复：默认勾选 = 经验表 B 表最优打怪群组合，跨段口径一致）
    const segB = monster({ id: 2, level: 91, baseExp: 12000 / 24360 }) // 每分钟 200
    const r = settle({
      expTable: oneCrossTable,
      grind: {
        config: baseCfg({
          segments: [
            { levelFrom: 90, levelTo: 90, monsterIds: [1] },
            { levelFrom: 91, levelTo: 99, monsterIds: [2] },
          ],
        }),
        monsters: [monster(), segB],
        hours: 1, doubleExp: false, qiXin: false,
      },
    })
    // 90 级每分钟 100（段 A）→ 1.5 分钟升 91；剩余 58.5 分钟按段 B 每分钟 200
    expect(r.grindExp).toBe(11850) // 150 + 58.5×200
    expect(r.endLevel).toBe(91)
    expect(r.grindMinutes).toBe(60)
  })

  it('一天跨多级：逐级递归换算', () => {
    const r = settle({
      targetLevel: 93, // 92 级经验 300 也被消费，验证 91→92 段重计价
      expTable: [
        { level: 90, exp: 150, sue: 100 },
        { level: 91, exp: 200, sue: 200 },
        { level: 92, exp: 1e12, sue: 300 }, // 巨量：92 是结束等级，不跨 93
        { level: 93, exp: 1e12, sue: 400 },
      ],
      tasks: [{ id: 'a', count: 4 }],
    })
    // 100+100 → 升 91（余 50）；200 → 升 92（余 50）；300 → 余 350
    expect(r.dailyExp).toBe(700)
    expect(r.endLevel).toBe(92)
    expect(r.carryExp).toBe(350)
  })

  it('无升级时：各来源按起始等级计价，与原逐日逻辑一致', () => {
    const r = settle({
      expTable: [{ level: 90, exp: 1e12, sue: 100 }, { level: 91, exp: 1e12, sue: 200 }],
      tasks: [{ id: 'a', count: 2 }],
      items: [{ id: 'b', count: 1 }],
      grind: {
        config: baseCfg(), monsters: [monster()], hours: 1, doubleExp: false, qiXin: false,
      },
    })
    expect(r.grindExp).toBe(6000) // 60 分钟 × 100
    expect(r.dailyExp).toBe(6300) // 200 + 100 + 6000
    expect(r.endLevel).toBe(90)
    expect(r.carryExp).toBe(6300)
    expect(r.leveledUp).toBe(false)
  })

  it('开齐心：打怪分钟按齐心乘数，且消耗周齐心额度', () => {
    const r = settle({
      expTable: [{ level: 90, exp: 1e12, sue: 100 }], // 不升级，专注分钟流
      grind: {
        config: baseCfg({ partySize: 5 }), monsters: [monster()], hours: 1, doubleExp: false, qiXin: true,
      },
    })
    // 5 人开齐心乘数 1.15：每分钟 = 6000×1.15÷60 = 115
    expect(r.grindExp).toBe(6900)
    expect(r.remainingQiXinMin).toBe(WEEKLY_QIXIN_MIN_CAP - 60)
  })

  it('开齐心人数独立：开齐心段按 qiXinPartySize 乘数（5 人队 3 人开齐心 → ×1.09）', () => {
    const r = settle({
      expTable: [{ level: 90, exp: 1e12, sue: 100 }],
      grind: {
        config: baseCfg({ partySize: 5, qiXinPartySize: 3 }), monsters: [monster()], hours: 1, doubleExp: false, qiXin: true,
      },
    })
    // 每分钟 = 6000×1.09÷60 = 109 → 60 分钟 = 6540
    expect(r.grindExp).toBe(6540)
    expect(r.remainingQiXinMin).toBe(WEEKLY_QIXIN_MIN_CAP - 60)
  })

  it('疲劳容量：烧速高时按 (380 + 剩余大疲劳) ÷ 烧速 截断分钟，大疲劳递减', () => {
    // 效率 1000 PL/小时（fatigue 1.0、qty 5、刷新 18s）；3 小时意图
    const fast = monster({ fatigue: 1.0, quantity: 5, respawnTime: 18 })
    const r = settle({
      expTable: [{ level: 90, exp: 1e12, sue: 100 }],
      grind: {
        config: baseCfg(), monsters: [fast], hours: 3, doubleExp: false, qiXin: true,
      },
    })
    // 容量 = (380+2520)×60÷1000 = 174 分钟；疲劳 2900 = 380 系统 + 2520 大疲劳（全耗尽）
    expect(r.grindMinutes).toBe(174)
    expect(r.remainingGrindMin).toBe(WEEKLY_GRIND_MIN_CAP - 174)
    expect(r.remainingQiXinMin).toBe(WEEKLY_QIXIN_MIN_CAP - 174)
    expect(r.remainingBigFatigue).toBe(0)
    expect(r.dailyExp).toBeGreaterThan(0)
  })

  it('系统疲劳：每天 380，超出部分才扣大疲劳', () => {
    const r = settle({
      expTable: [{ level: 90, exp: 1e12, sue: 100 }],
      grind: {
        config: baseCfg(), monsters: [monster()], hours: 1, doubleExp: false, qiXin: false,
      },
    })
    // 60 分钟 × 300 PL/小时 = 300 疲劳 < 380 → 全系统疲劳，大疲劳不动
    expect(r.grindMinutes).toBe(60)
    expect(r.remainingBigFatigue).toBe(DEFAULT_BIG_FATIGUE_CAP)
    expect(r.remainingGrindMin).toBe(WEEKLY_GRIND_MIN_CAP - 60)
    expect(r.dailyExp).toBe(6000)
  })

  it('起始日剩余系统疲劳：容量 = 剩余系统 + 大疲劳，系统扣到剩余为止', () => {
    // 快怪烧速 1000 PL/小时：剩余系统 100 + 大疲劳 2520 = 2620 → 容量 157.2 分钟
    const fast = monster({ fatigue: 1.0, quantity: 5, respawnTime: 18 })
    const r = settle({
      expTable: [{ level: 90, exp: 1e12, sue: 100 }],
      remainingSystemFatigue: 100,
      grind: {
        config: baseCfg(), monsters: [fast], hours: 3, doubleExp: false, qiXin: false,
      },
    })
    expect(r.grindMinutes).toBeCloseTo(157.2, 6)
    expect(r.remainingBigFatigue).toBe(0) // 大疲劳 2520 全耗尽
    expect(r.remainingGrindMin).toBeCloseTo(WEEKLY_GRIND_MIN_CAP - 157.2, 6)
    expect(r.dailyExp).toBeGreaterThan(0)
  })

  it('无任何经验来源：当天 0 经验、不升级', () => {
    const r = settle({})
    expect(r.dailyExp).toBe(0)
    expect(r.grindExp).toBe(0)
    expect(r.endLevel).toBe(90)
    expect(r.carryExp).toBe(0)
  })
})

describe('settleDay · 加成道具（2026-08-21）', () => {
  it('任务加成只作用于 taskBonusMults 命中的任务', () => {
    const r = settle({
      expTable: [{ level: 90, exp: 1e12, sue: 100 }], // 不升级，便于核算
      tasks: [
        { id: 'a', count: 2 },
        { id: 'b', count: 2 },
      ],
      taskBonusMults: { a: 2 }, // b 不加成
    })
    expect(r.dailyExp).toBe(600) // a: 100×2×2=400；b: 100×2=200
  })

  it('道具经验加成乘到所有经验道具上', () => {
    const r = settle({
      expTable: [{ level: 90, exp: 1e12, sue: 100 }], // 不升级，便于核算
      items: [{ id: 'x', count: 3 }],
      itemBonusMult: 1.1,
    })
    expect(r.dailyExp).toBe(330) // 3 × 100 × 1.1
  })

  it('次数型道具 mult 覆盖 itemMult 且不乘 itemBonusMult', () => {
    const r = settle({
      items: [{ id: 'use', count: 4, mult: 0.25 }],
      itemBonusMult: 1.5, // 次数型不受影响
    })
    expect(r.dailyExp).toBe(100) // 4 × 100 × 0.25，不乘 1.5
  })

  it('打怪加成倍率乘到打怪经验（含升级中途跨越路径）', () => {
    const r = settle({
      expTable: oneCrossTable,
      grind: {
        config: baseCfg(), monsters: [monster()], hours: 1, doubleExp: false, qiXin: false,
      },
      grindBonusMult: 2,
    })
    // 90 级每分钟 100×2 = 200 → 0.75 分钟升 91（跨越段 150 经验）；剩余 59.25 分钟 × 200 = 11850
    expect(r.grindExp).toBe(12000) // 150 + 59.25×200
    expect(r.dailyExp).toBe(12000)
    expect(r.endLevel).toBe(91)
    expect(r.carryExp).toBe(11850)
  })

  it('打怪加成不影响任务与道具（分开乘）', () => {
    const r = settle({
      tasks: [{ id: 'a', count: 1 }],
      items: [{ id: 'x', count: 1 }],
      grindBonusMult: 2,
    })
    expect(r.dailyExp).toBe(200) // 任务 100 + 道具 100，打怪加成不污染
  })
})
