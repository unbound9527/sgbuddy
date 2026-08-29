import { describe, expect, it } from 'vitest'
import {
  correctedExp,
  dailyGrindExp,
  decayRate,
  intimacyBonus,
  monsterEfficiency,
  monsterGroupId,
  qiXinMultiplier,
  WEEKLY_GRIND_MIN_CAP,
  WEEKLY_QIXIN_MIN_CAP,
  DEFAULT_DECAY_RATES,
  SYSTEM_DAILY_FATIGUE,
  DEFAULT_BIG_FATIGUE_CAP,
  type GrindConfig,
  type GrindMonster,
} from './grindExp'

// 与种子数据一致：小怪 quantity=10、respawn_time=15（效率 384 PL/小时）
const m = (over: Partial<GrindMonster> = {}): GrindMonster => ({
  id: 1,
  name: '小怪',
  area: '卧牛山',
  level: 100,
  baseExp: 2505,
  fatigue: 0.16,
  multiplier: 10,
  quantity: 10,
  respawnTime: 15,
  ...over,
})

const baseCfg = (over?: Partial<GrindConfig>): GrindConfig => ({
  dailyHours: [1, 1, 1, 1, 1, 1, 1],
  doubleExpDays: [false, false, false, false, false, false, false],
  qiXinDays: [false, false, false, false, false, false, false],
  partySize: 1,
  intimacyLevel: 0,
  mentorBonus: 0,
  plumBonus: 0,
  titleBonus: 0,
  masteryBonus: 0,
  // 2026-08-23：唯一模式 = 等级段（全局勾选已移除）；默认单段 [1,200] 勾选种子行，等价旧全局默认
  segments: [{ levelFrom: 1, levelTo: 200, monsterIds: [1] }],
  decayRates: { ...DEFAULT_DECAY_RATES },
  ...over,
})

describe('monsterGroupId', () => {
  it('拼装为 地区+等级+名称', () => {
    expect(monsterGroupId(m())).toBe('卧牛山100小怪')
    expect(monsterGroupId({ area: '逍遥津渡口', level: 136, name: '精英' })).toBe('逍遥津渡口136精英')
  })
})

describe('correctedExp', () => {
  it('种子行 卧牛山100小怪：2505/0.16 × 1.45 = 22701.5625', () => {
    expect(correctedExp(m())).toBeCloseTo(22701.5625, 6)
  })
  it('multiplier 不同', () => {
    expect(correctedExp(m({ multiplier: 1 }))).toBeCloseTo(15656.25, 6)
  })
  it('fatigue <= 0 返回 0 防除零', () => {
    expect(correctedExp(m({ fatigue: 0 }))).toBe(0)
    expect(correctedExp(m({ fatigue: -1 }))).toBe(0)
  })
})

describe('monsterEfficiency', () => {
  it('卧牛山100小怪：(3600/15) × 0.16 × 10 = 384 PL/小时', () => {
    expect(monsterEfficiency(m())).toBeCloseTo(384, 10)
  })
  it('刷新周期 30 秒 → 192', () => {
    expect(monsterEfficiency(m({ respawnTime: 30 }))).toBeCloseTo(192, 10)
  })
  it('boss：quantity 1、刷新 90 秒', () => {
    expect(monsterEfficiency(m({ fatigue: 6.3, quantity: 1, respawnTime: 90 }))).toBeCloseTo(252, 10)
  })
  it('刷新周期 ≤ 0 / 疲劳 ≤ 0 / 数量 ≤ 0 → 0（无效率数据）', () => {
    expect(monsterEfficiency(m({ respawnTime: 0 }))).toBe(0)
    expect(monsterEfficiency(m({ respawnTime: -1 }))).toBe(0)
    expect(monsterEfficiency(m({ fatigue: 0 }))).toBe(0)
    expect(monsterEfficiency(m({ quantity: 0 }))).toBe(0)
  })
})

describe('decayRate', () => {
  const L = 100
  it('默认全表：diff = 角色−怪物 ∈ [−8, +7]', () => {
    // 小X = 怪物比角色高 X 级（角色低）；大X = 角色比怪物高 X 级
    const expected: Record<number, number> = {
      [-8]: 0.96, [-7]: 0.9726, [-6]: 0.9638, [-5]: 0.9638, [-4]: 0.9723, [-3]: 0.9883,
      [-2]: 1, [-1]: 1, [0]: 1, [1]: 1, [2]: 1, [3]: 1,
      [4]: 0.4, [5]: 0.3, [6]: 0.2, [7]: 0.1,
    }
    for (let diff = -8; diff <= 7; diff++) {
      expect(decayRate(L, L - diff)).toBeCloseTo(expected[diff], 10)
    }
  })
  it('表外（等级差超过范围）无经验：怪物高 9 级 / 角色高 8 级', () => {
    expect(decayRate(L, 92)).toBe(0) // L+8（角色高 8 级）
    expect(decayRate(L, 109)).toBe(0) // L+9（怪物高 9 级）
  })
  it('其他等级段同样成立', () => {
    expect(decayRate(120, 112)).toBe(0) // 差 8 级（角色高）
    expect(decayRate(120, 113)).toBeCloseTo(0.1, 10) // 大7
    expect(decayRate(120, 117)).toBe(1) // 大3
    expect(decayRate(120, 127)).toBeCloseTo(0.9726, 10) // 小7
    expect(decayRate(120, 128)).toBeCloseTo(0.96, 10) // 小8
  })
  it('可传自定义衰减表', () => {
    const rates = { 0: 0.5, 1: 0.25 }
    expect(decayRate(100, 100, rates)).toBe(0.5)
    expect(decayRate(100, 99, rates)).toBe(0.25)
    expect(decayRate(100, 98, rates)).toBe(0) // 表外 → 0
  })
})

describe('qiXinMultiplier', () => {
  it('全表', () => {
    expect(qiXinMultiplier(1, false)).toBe(1.0)
    expect(qiXinMultiplier(2, false)).toBeCloseTo(0.85, 10)
    expect(qiXinMultiplier(3, false)).toBeCloseTo(0.8, 10)
    expect(qiXinMultiplier(4, false)).toBeCloseTo(0.75, 10)
    expect(qiXinMultiplier(5, false)).toBeCloseTo(0.68, 10)
    expect(qiXinMultiplier(2, true)).toBeCloseTo(1.05, 10)
    expect(qiXinMultiplier(3, true)).toBeCloseTo(1.09, 10)
    expect(qiXinMultiplier(4, true)).toBeCloseTo(1.12, 10)
    expect(qiXinMultiplier(5, true)).toBeCloseTo(1.15, 10)
  })
  it('人数钳制到 1-5', () => {
    expect(qiXinMultiplier(0, false)).toBe(1.0)
    expect(qiXinMultiplier(6, false)).toBeCloseTo(0.68, 10)
    expect(qiXinMultiplier(2.4, false)).toBeCloseTo(0.85, 10)
  })
})

describe('intimacyBonus', () => {
  it('全表 0-10', () => {
    expect(intimacyBonus(0)).toBe(0)
    expect(intimacyBonus(1)).toBeCloseTo(0.08, 10)
    expect(intimacyBonus(2)).toBeCloseTo(0.1, 10)
    expect(intimacyBonus(3)).toBeCloseTo(0.1, 10)
    expect(intimacyBonus(4)).toBeCloseTo(0.13, 10)
    expect(intimacyBonus(5)).toBeCloseTo(0.13, 10)
    expect(intimacyBonus(6)).toBeCloseTo(0.15, 10)
    expect(intimacyBonus(7)).toBeCloseTo(0.15, 10)
    expect(intimacyBonus(8)).toBeCloseTo(0.18, 10)
    expect(intimacyBonus(9)).toBeCloseTo(0.18, 10)
    expect(intimacyBonus(10)).toBeCloseTo(0.2, 10)
  })
  it('钳制到 0-10', () => {
    expect(intimacyBonus(-1)).toBe(0)
    expect(intimacyBonus(11)).toBeCloseTo(0.2, 10)
  })
})

describe('dailyGrindExp', () => {
  // 100 小怪：修正 22701.5625、效率 384 PL/小时 → 每小时经验 = 修正 × 14 × 效率 = 122043600
  const HOURLY_100 = 22701.5625 * 384 * 14
  // 108 小怪：修正 36023.4375、效率同 384（quantity/respawnTime 继承默认）
  const monsters = [m(), m({ id: 2, level: 108, baseExp: 3975 })]

  it('手算基线：默认配置 1 小时 → 每小时经验 122043600', () => {
    const r = dailyGrindExp(baseCfg(), monsters, 100, 1)
    expect(r.effectiveMinutes).toBe(60)
    expect(r.normalMinutes).toBe(60)
    expect(r.qiXinMinutes).toBe(0)
    expect(r.targetArea).toBe('卧牛山')
    expect(r.hourlySum).toBeCloseTo(HOURLY_100, 6)
    expect(r.dailyExp).toBeCloseTo(HOURLY_100, 6)
    expect(r.activeGroupCount).toBe(1)
    expect(r.skippedGroupCount).toBe(0)
  })

  it('单群每小时 = 修正经验 × 14 × 衰减 × 效率', () => {
    const r = dailyGrindExp(baseCfg(), monsters, 100, 1)
    const d = r.groupDetails[0]
    expect(d.correctedExp).toBeCloseTo(22701.5625, 6)
    expect(d.efficiency).toBeCloseTo(384, 10)
    expect(d.decay).toBe(1)
    expect(d.hourly).toBeCloseTo(22701.5625 * 14 * 384, 6)
    expect(d.eligible).toBe(true)
    expect(d.inTarget).toBe(true)
  })

  it('打怪时间融入效率：一批完整周期 = 打怪时间 + 刷新周期，效率同比例下降', () => {
    // 默认周期 15 秒、效率 384 PL/时；打怪时间 5 秒 → 周期 20 秒 → 效率 288
    const kill5 = [m({ killTime: 5 })]
    const r = dailyGrindExp(baseCfg(), kill5, 100, 1, 1)
    expect(r.burnPerHour).toBeCloseTo((3600 / 20) * 0.16 * 10, 6)
    expect(r.burnPerHour).toBeCloseTo(288, 6)
    // 每疲劳经验不变：每小时经验随效率同比例下降（288/384）
    const base = dailyGrindExp(baseCfg(), monsters, 100, 1, 1)
    expect(r.dailyExp).toBeCloseTo(base.dailyExp * (288 / 384), 6)
    // 打怪时间缺省 0（旧数据）行为不变
    expect(monsterEfficiency(m({}))).toBeCloseTo(384, 6)
  })

  it('双倍时间 ×2', () => {
    const r = dailyGrindExp(baseCfg(), monsters, 100, 1, 1, { doubleExp: true })
    expect(r.dailyExp).toBeCloseTo(HOURLY_100 * 2, 4)
  })

  it('totalBonusRate 参与计算（经验加速 + 跨服王城加成）', () => {
    const r = dailyGrindExp(baseCfg(), monsters, 100, 2.2)
    expect(r.dailyExp).toBeCloseTo(HOURLY_100 * 2.2, 4)
  })

  it('开齐心：当天 60 分钟、周额度充足 → 全部享受齐心乘数', () => {
    const r = dailyGrindExp(baseCfg({ partySize: 5 }), monsters, 100, 1, 1, { qiXin: true })
    expect(r.qiXinMinutes).toBe(60)
    expect(r.normalMinutes).toBe(0)
    expect(r.dailyExp).toBeCloseTo((HOURLY_100 * 60 * 1.15) / 60, 4)
  })

  it('开齐心人数独立：开齐心分钟按 qiXinPartySize 查表、不开齐心分钟按队伍人数查表', () => {
    // 5 人队 3 人开齐心：开齐心分钟 ×1.09（3 人开齐心表），不开齐心分钟 ×0.68（5 人不开齐心表）
    const cfg = baseCfg({ partySize: 5, qiXinPartySize: 3 })
    const r = dailyGrindExp(cfg, monsters, 100, 1, 1, { qiXin: true })
    expect(r.qiXinMinutes).toBe(60)
    expect(r.dailyExp).toBeCloseTo((HOURLY_100 * 60 * 1.09) / 60, 4)
    const r2 = dailyGrindExp(cfg, monsters, 100, 1, 0.5)
    expect(r2.normalMinutes).toBe(30)
    expect(r2.dailyExp).toBeCloseTo((HOURLY_100 * 30 * 0.68) / 60, 4)
    // 缺省（未设 qiXinPartySize）时仍按队伍人数 5 人查开齐心表 ×1.15
    const r3 = dailyGrindExp(baseCfg({ partySize: 5 }), monsters, 100, 1, 1, { qiXin: true })
    expect(r3.dailyExp).toBeCloseTo((HOURLY_100 * 60 * 1.15) / 60, 4)
  })

  it('时长：2 小时、周额度充足 → 有效 120 分钟', () => {
    const r = dailyGrindExp(baseCfg(), monsters, 100, 1, 2)
    expect(r.effectiveMinutes).toBe(120)
    expect(r.normalMinutes).toBe(120)
  })

  it('时长上限：24 小时 → 时间 580 分钟与疲劳容量 (380+2520)÷384 分钟双约束取先到', () => {
    const r = dailyGrindExp(baseCfg(), monsters, 100, 1, 24)
    // 单群烧速 384 PL/时：疲劳容量 2900 对应 453.125 分钟 < 580 分钟 → 疲劳先截断
    expect(r.effectiveMinutes).toBeCloseTo(((SYSTEM_DAILY_FATIGUE + DEFAULT_BIG_FATIGUE_CAP) * 60) / 384, 6)
  })

  it('周剩余额度：当天 3 小时但本周只剩 30 分钟 → 有效 30 分钟', () => {
    const r = dailyGrindExp(baseCfg(), monsters, 100, 1, 3, { remainingGrindMin: 30 })
    expect(r.effectiveMinutes).toBe(30)
    expect(r.normalMinutes).toBe(30)
  })

  it('周剩余额度：剩余为 0 → 当天打怪 0', () => {
    const r = dailyGrindExp(baseCfg(), monsters, 100, 1, 3, { remainingGrindMin: 0 })
    expect(r.effectiveMinutes).toBe(0)
    expect(r.dailyExp).toBe(0)
  })

  it('齐心上限：本周齐心只剩 10 分钟 → 只前 10 分钟享受齐心乘数', () => {
    const r = dailyGrindExp(baseCfg({ partySize: 5 }), monsters, 100, 1, 3,
      { qiXin: true, remainingGrindMin: 180, remainingQiXinMin: 10 })
    expect(r.qiXinMinutes).toBe(10)
    expect(r.normalMinutes).toBe(170)
    const minutesMult = 10 * 1.15 + 170 * 0.68
    expect(r.dailyExp).toBeCloseTo((HOURLY_100 * minutesMult) / 60, 4)
  })

  it('当天时长 0 → 打怪经验 0', () => {
    expect(dailyGrindExp(baseCfg(), monsters, 100, 1, 0).dailyExp).toBe(0)
  })

  it('非固定系数加成（称号 2026-08-23 起不参与）', () => {
    const r = dailyGrindExp(
      baseCfg({ mentorBonus: 10, plumBonus: 5, titleBonus: 3, masteryBonus: 8, intimacyLevel: 5 }),
      monsters, 100, 1,
    )
    // (1+0.13) × (1+0.1) × (1+0.05 青梅，称号 3 已移除) × (1+0.08)
    expect(r.dailyExp).toBeCloseTo(HOURLY_100 * 1.13 * 1.1 * 1.05 * 1.08, 4)
  })

  it('加成道具打怪经验倍率（bonusMult）乘到每日经验与既有加成链', () => {
    // 感恩的祝福 30% → ×1.3；与师徒加成相乘（称号已移除，不再参与）
    const r = dailyGrindExp(
      baseCfg({ mentorBonus: 10, titleBonus: 5 }),
      monsters, 100, 1, 1, { bonusMult: 1.3 },
    )
    expect(r.dailyExp).toBeCloseTo(HOURLY_100 * 1.1 * 1.3, 4)
  })

  it('开齐心分钟同样受 bonusMult（qiXinPerMin）', () => {
    const cfg = baseCfg({ partySize: 5 })
    const r = dailyGrindExp(cfg, monsters, 100, 1, 1, { qiXin: true, bonusMult: 2 })
    expect(r.qiXinMinutes).toBe(60)
    expect(r.dailyExp).toBeCloseTo((HOURLY_100 * 60 * 1.15 * 2) / 60, 4)
  })

  it('未勾选任何怪物群 → 0', () => {
    expect(dailyGrindExp(baseCfg({ segments: [] }), monsters, 100, 1).dailyExp).toBe(0)
  })

  it('勾选即打：单地图全部勾选群参与（卧牛山 100+108 → 两群全参与，无减法）', () => {
    // 2026-08-23 等级段唯一模式：勾选即打，不做目标地图自动竞争
    const cfg = baseCfg({ segments: [{ levelFrom: 100, levelTo: 100, monsterIds: [1, 2] }] })
    const r = dailyGrindExp(cfg, monsters, 100, 1)
    expect(r.targetArea).toBe('卧牛山')
    expect(r.activeGroupCount).toBe(2)
    expect(r.skippedGroupCount).toBe(0)
    expect(r.hourlySum).toBeCloseTo(22701.5625 * 14 * 384 + 36023.4375 * 14 * 0.96 * 384, 6)
    expect(r.burnPerHour).toBeCloseTo(384 * 2, 6)
    const low = r.groupDetails.find((d) => d.id === 1)
    expect(low!.eligible).toBe(true)
    expect(low!.burnsFatigue).toBe(true)
  })

  it('跨地图勾选即打：超窗口群不打不烧，其余全部参与（无地图竞争）', () => {
    // 子午谷 113 超 +8（108 是上限）无衰减、无 boss → 不打不烧；卧牛山 100+108 全参与
    const all = [m(), m({ id: 2, level: 108, baseExp: 3975 }), m({ id: 3, level: 113, baseExp: 42865, area: '子午谷' })]
    const cfg = baseCfg({ segments: [{ levelFrom: 100, levelTo: 100, monsterIds: [1, 2, 3] }] })
    const r = dailyGrindExp(cfg, all, 100, 1)
    expect(r.targetArea).toBe('卧牛山')
    expect(r.activeGroupCount).toBe(2)
    expect(r.skippedGroupCount).toBe(1)
    expect(r.hourlySum).toBeCloseTo(22701.5625 * 14 * 384 + 36023.4375 * 14 * 0.96 * 384, 6)
    const ex = r.groupDetails.find((d) => d.id === 3)
    expect(ex).toBeDefined()
    expect(ex!.inTarget).toBe(false)
    expect(ex!.eligible).toBe(false)
    expect(ex!.decay).toBe(0)
  })

  it('勾选即打：同图同值群全部参与，跨地图也全部参与（无竞争淘汰）', () => {
    // 2026-08-23 等级段唯一模式：不做目标地图竞争——勾选的群全参与（低值群是否拖累整体由
    // 玩家在等级段设置弹窗手动取舍）
    const all = [
      m({ id: 1, area: '卧牛山', level: 100 }),
      m({ id: 2, area: '卧牛山', level: 100, name: '精英' }),
      m({ id: 3, area: '子午谷', level: 108, baseExp: 1000 }),
    ]
    const cfg = baseCfg({ segments: [{ levelFrom: 100, levelTo: 100, monsterIds: [1, 2, 3] }] })
    const r = dailyGrindExp(cfg, all, 100, 1)
    expect(r.targetArea).toBe('卧牛山、子午谷') // 参与群所在地图并集
    expect(r.activeGroupCount).toBe(3)
    expect(r.skippedGroupCount).toBe(0)
    expect(r.hourlySum).toBeCloseTo(22701.5625 * 14 * 384 * 2 + (1000 / 0.16) * 1.45 * 14 * 0.96 * 384, 6)
    expect(r.burnPerHour).toBeCloseTo(384 * 3, 6)
    expect(r.dailyExp).toBeCloseTo(r.hourlySum, 6)
  })

  it('分段模式基础：113 级按段勾选凤鸣山 115/118 群，勾选即打无竞争', () => {
    // 2026-08-20 用户口径：分段模式不做目标地图自动竞争——等级段手动指定刷图路线
    // （2026-08-23 恢复：默认勾选 = 经验表 B 表最优打怪群组合，计算层同口径）
    const all = [
      m({ id: 1, area: '凤鸣山', level: 115, baseExp: 11315, fatigue: 0.21 }),
      m({ id: 2, area: '凤鸣山', level: 118, baseExp: 12784, fatigue: 0.21 }),
    ]
    const cfg = baseCfg({
      segments: [{ levelFrom: 113, levelTo: 115, monsterIds: [1, 2] }],
    })
    const r = dailyGrindExp(cfg, all, 113, 1)
    expect(r.targetArea).toBe('凤鸣山')
    expect(r.activeGroupCount).toBe(2)
    expect(r.skippedGroupCount).toBe(0)
    const eff = (3600 / 15) * 0.21 * 10 // 504 PL/时
    expect(r.hourlySum).toBeCloseTo(
      (11315 / 0.21) * 1.45 * 14 * 1 * eff + // 115 群 diff -2 → 衰减 1
      (12784 / 0.21) * 1.45 * 14 * 0.9638 * eff, // 118 群 diff -5 → 衰减 0.9638
      0)
    expect(r.burnPerHour).toBeCloseTo(eff * 2, 6)
    expect(r.dailyExp).toBeCloseTo(r.hourlySum, 0)
  })

  it('分段模式：等级未落在任何段内 → 不打怪、经验 0、不烧疲劳', () => {
    // 2026-08-20 用户确认口径：未配置的等级当天不打怪
    const all = [m({ id: 1, area: '凤鸣山', level: 115, baseExp: 11315, fatigue: 0.21 })]
    const cfg = baseCfg({
      segments: [{ levelFrom: 113, levelTo: 115, monsterIds: [1] }],
    })
    const r = dailyGrindExp(cfg, all, 116, 1)
    expect(r.targetArea).toBe(null)
    expect(r.activeGroupCount).toBe(0)
    expect(r.groupDetails).toHaveLength(0)
    expect(r.hourlySum).toBe(0)
    expect(r.burnPerHour).toBe(0)
    expect(r.dailyExp).toBe(0)
  })

  it('分段模式用户场景复刻：113-115 凤鸣山 / 116-118 午口，跨段自动切换', () => {
    // 用户方案：113-115 打凤鸣山 115/118 群，116-118 打子午谷午口 121/122/124 群（种子数值）
    const all = [
      m({ id: 1, area: '凤鸣山', level: 115, baseExp: 11315, fatigue: 0.21 }),
      m({ id: 2, area: '凤鸣山', level: 118, baseExp: 12784, fatigue: 0.21 }),
      m({ id: 3, area: '子午谷午口', level: 121, baseExp: 20211, fatigue: 0.35 }),
      m({ id: 4, area: '子午谷午口', level: 122, baseExp: 20676, fatigue: 0.35 }),
      m({ id: 5, area: '子午谷午口', level: 124, baseExp: 21638, fatigue: 0.35 }),
    ]
    const cfg = baseCfg({
      segments: [
        { levelFrom: 113, levelTo: 115, monsterIds: [1, 2] },
        { levelFrom: 116, levelTo: 118, monsterIds: [3, 4, 5] },
      ],
    })
    const q = (baseExp: number, fatigue: number, decay: number) => (baseExp / fatigue) * 1.45 * 14 * decay
    const fmEff = (3600 / 15) * 0.21 * 10
    const wkEff = (3600 / 15) * 0.35 * 10

    // 115 级（段 113-115 末级）→ 凤鸣山 2 群
    const r115 = dailyGrindExp(cfg, all, 115, 1)
    expect(r115.targetArea).toBe('凤鸣山')
    expect(r115.activeGroupCount).toBe(2)
    expect(r115.hourlySum).toBeCloseTo((q(11315, 0.21, 1) + q(12784, 0.21, 0.9883)) * fmEff, 0)

    // 116 级（跨段）→ 午口 3 群，凤鸣山群不再参与
    const r116 = dailyGrindExp(cfg, all, 116, 1)
    expect(r116.targetArea).toBe('子午谷午口')
    expect(r116.activeGroupCount).toBe(3)
    expect(r116.groupDetails.find((d) => d.id === 1)).toBeUndefined()
    expect(r116.hourlySum).toBeCloseTo((q(20211, 0.35, 0.9638) + q(20676, 0.35, 0.9638) + q(21638, 0.35, 0.96)) * wkEff, 0)
  })

  it('分段模式：段内勾选多图不做竞争，全部参与（勾选即打）', () => {
    const all = [
      m({ id: 1, area: '卧牛山', level: 100 }),
      m({ id: 2, area: '子午谷', level: 108, baseExp: 1000 }),
    ]
    const cfg = baseCfg({
      segments: [{ levelFrom: 100, levelTo: 100, monsterIds: [1, 2] }],
    })
    const r = dailyGrindExp(cfg, all, 100, 1)
    expect(r.targetArea).toBe('卧牛山、子午谷') // 参与群所在地图并集（刷怪地图列显示）
    expect(r.activeGroupCount).toBe(2)
    expect(r.skippedGroupCount).toBe(0)
    expect(r.hourlySum).toBeCloseTo(
      22701.5625 * 14 * 1 * 384 + // 卧牛山 100（diff 0 → 衰减 1）
      (1000 / 0.16) * 1.45 * 14 * 0.96 * 384, // 子午谷 108（diff -8 → 衰减 0.96）
      0)
    expect(r.burnPerHour).toBeCloseTo(384 * 2, 6)
  })

  it('分段模式：段内超窗口自强图群不打不烧（勾选即打但超等级打不了）', () => {
    const all = [
      m({ id: 1, area: '卧牛山', level: 100 }),
      m({ id: 2, area: '卧牛山', level: 115, baseExp: 90000 }),
    ]
    const cfg = baseCfg({
      segments: [{ levelFrom: 100, levelTo: 100, monsterIds: [1, 2] }],
    })
    const r = dailyGrindExp(cfg, all, 100, 1)
    expect(r.targetArea).toBe('卧牛山')
    expect(r.activeGroupCount).toBe(1)
    expect(r.skippedGroupCount).toBe(1)
    const out = r.groupDetails.find((d) => d.id === 2)!
    expect(out.eligible).toBe(false) // 超 +8 窗口无经验
    expect(out.burnsFatigue).toBe(false) // 自强图打不了不烧
    expect(out.inTarget).toBe(false)
  })

  it('全部勾选群超过 +8 级 → 无目标地图、经验 0', () => {
    const all = [m({ id: 3, level: 113, baseExp: 42865, area: '子午谷' })]
    const cfg = baseCfg({ segments: [{ levelFrom: 100, levelTo: 100, monsterIds: [3] }] })
    const r = dailyGrindExp(cfg, all, 100, 1)
    expect(r.targetArea).toBe(null)
    expect(r.activeGroupCount).toBe(0)
    expect(r.hourlySum).toBe(0)
    expect(r.dailyExp).toBe(0)
  })

  it('同图超范围群（+15 级）仍计入明细：自强图超+8 群不打不烧', () => {
    const all = [m(), m({ id: 3, level: 115, baseExp: 90000, area: '卧牛山' })]
    const cfg = baseCfg({ segments: [{ levelFrom: 100, levelTo: 100, monsterIds: [1, 3] }] })
    const r = dailyGrindExp(cfg, all, 100, 1)
    expect(r.targetArea).toBe('卧牛山')
    expect(r.activeGroupCount).toBe(1)
    expect(r.hourlySum).toBeCloseTo(HOURLY_100, 6)
    const ex = r.groupDetails.find((d) => d.id === 3)
    expect(ex).toBeDefined()
    expect(ex!.inTarget).toBe(false) // 勾选即打：无效率数据/超窗口 → 不参与（不进目标地图竞争）
    expect(ex!.eligible).toBe(false)
    expect(ex!.burnsFatigue).toBe(false) // 2026-08-19：自强图超+8 群打不了，不参与疲劳消耗
    expect(ex!.decay).toBe(0)
  })

  it('无 boss 自强图：超+8 勾选群不参与、不烧疲劳（勾选 = 等级足够时再参与）', () => {
    // 2026-08-19 用户口径：自强地图玩家有意识不打超等级的怪；原"无经验群也烧疲劳"仅适用于有 boss 地图
    const all = [m(), m({ id: 3, level: 115, baseExp: 90000, area: '卧牛山' })]
    const cfg = baseCfg({ segments: [{ levelFrom: 100, levelTo: 100, monsterIds: [1, 3] }] })
    const r = dailyGrindExp(cfg, all, 100, 1)
    // 烧速只来自 100 群 384（115 群不参与）
    expect(r.burnPerHour).toBeCloseTo(384, 6)
    expect(r.hourlySum).toBeCloseTo(HOURLY_100, 6)
    expect(r.dailyExp).toBeCloseTo(HOURLY_100, 6)
    // 1 小时烧 384 疲劳：系统 380 + 大疲劳 4，本周剩余大疲劳 2516
    expect(r.fatigueUsed).toBeCloseTo(384, 6)
    expect(r.systemFatigueUsed).toBeCloseTo(SYSTEM_DAILY_FATIGUE, 6)
    expect(r.bigFatigueUsed).toBeCloseTo(4, 6)
    expect(r.remainingBigFatigue).toBeCloseTo(DEFAULT_BIG_FATIGUE_CAP - 4, 6)
  })

  it('自定义衰减表生效（config.decayRates）', () => {
    const cfg = baseCfg({ decayRates: { ...DEFAULT_DECAY_RATES, [4]: 0.5 } })
    const r = dailyGrindExp(cfg, monsters, 104, 1)
    expect(r.groupDetails[0].decay).toBe(0.5)
    expect(r.hourlySum).toBeCloseTo(22701.5625 * 14 * 0.5 * 384, 6)
  })

  it('全局衰减率优先于 config.decayRates（2026-08-27 升级计算器全局共享）', () => {
    const cfg = baseCfg({ decayRates: { ...DEFAULT_DECAY_RATES, [4]: 0.5 } }) // 旧方案残留值不生效
    const r = dailyGrindExp(cfg, monsters, 104, 1, 1, { decayRates: { ...DEFAULT_DECAY_RATES, [4]: 0.25 } })
    expect(r.groupDetails[0].decay).toBe(0.25)
    expect(r.hourlySum).toBeCloseTo(22701.5625 * 14 * 0.25 * 384, 6)
  })

  it('同图无效率数据（刷新周期 0）的群不参与求和，明细中标记', () => {
    const all = [m(), m({ id: 4, area: '卧牛山', level: 101, baseExp: 5567, respawnTime: 0 })]
    const cfg = baseCfg({ segments: [{ levelFrom: 100, levelTo: 100, monsterIds: [1, 4] }] })
    const r = dailyGrindExp(cfg, all, 100, 1)
    expect(r.targetArea).toBe('卧牛山')
    expect(r.activeGroupCount).toBe(1)
    expect(r.hourlySum).toBeCloseTo(HOURLY_100, 6)
    const ex = r.groupDetails.find((d) => d.id === 4)
    expect(ex).toBeDefined()
    expect(ex!.inTarget).toBe(false) // 无效率数据 → 不参与（勾选即打但不烧不打）
    expect(ex!.eligible).toBe(false)
    expect(ex!.efficiency).toBe(0)
    expect(ex!.decay).toBe(1)
  })

  it('勾选群全部无效率数据 → 求和与日经验均为 0', () => {
    const all = [m({ respawnTime: 0 })]
    const r = dailyGrindExp(baseCfg(), all, 100, 1)
    expect(r.activeGroupCount).toBe(0)
    expect(r.hourlySum).toBe(0)
    expect(r.dailyExp).toBe(0)
  })

  it('空等级段 / 未知 id / 空怪物列表安全返回 0', () => {
    const r0 = dailyGrindExp(baseCfg({ segments: [] }), monsters, 100, 1)
    expect(r0.dailyExp).toBe(0)
    expect(r0.hourlySum).toBe(0)

    const cfg2 = baseCfg({ segments: [{ levelFrom: 100, levelTo: 100, monsterIds: [9999] }] })
    expect(dailyGrindExp(cfg2, monsters, 100, 1).dailyExp).toBe(0)

    expect(dailyGrindExp(baseCfg(), [], 100, 1).dailyExp).toBe(0)
  })

  describe('疲劳池（系统 380/天 + 大疲劳 2520/周）', () => {
    // 单群烧速 384 PL/时：1 小时烧 384 = 系统 380 + 大疲劳 4
    it('1 小时：先扣系统 380、超出 4 扣大疲劳，本周剩余 2516', () => {
      const r = dailyGrindExp(baseCfg(), monsters, 100, 1, 1)
      expect(r.burnPerHour).toBeCloseTo(384, 6)
      expect(r.fatigueUsed).toBeCloseTo(384, 6)
      expect(r.systemFatigueUsed).toBeCloseTo(SYSTEM_DAILY_FATIGUE, 6)
      expect(r.bigFatigueUsed).toBeCloseTo(4, 6)
      expect(r.remainingBigFatigue).toBeCloseTo(DEFAULT_BIG_FATIGUE_CAP - 4, 6)
      expect(r.fatigueLimited).toBe(false)
    })

    it('单群 8 小时：当日容量 2900 截断于 453.125 分钟，大疲劳当日烧尽', () => {
      const r = dailyGrindExp(baseCfg(), monsters, 100, 1, 8)
      expect(r.effectiveMinutes).toBeCloseTo((2900 * 60) / 384, 6)
      expect(r.fatigueUsed).toBeCloseTo(2900, 6)
      expect(r.systemFatigueUsed).toBe(SYSTEM_DAILY_FATIGUE)
      expect(r.bigFatigueUsed).toBeCloseTo(DEFAULT_BIG_FATIGUE_CAP, 6)
      expect(r.remainingBigFatigue).toBe(0)
      expect(r.fatigueLimited).toBe(true)
    })

    it('有 boss 图（东岭关）多群：勾选即打全参与，超+8 无经验群仍烧疲劳', () => {
      // 有 boss 地图超+8 群（115）不给经验但照耗疲劳（2026-08-19 口径，等级段模式下保留）
      const all = [
        m({ id: 1, area: '东岭关', level: 103 }),
        m({ id: 2, area: '东岭关', level: 105, baseExp: 3000 }),
        m({ id: 3, area: '东岭关', level: 115, baseExp: 90000 }),
        m({ id: 9, area: '东岭关', level: 103, name: 'boss', fatigue: 6.3, quantity: 1, respawnTime: 90 }),
      ]
      const cfg = baseCfg({ segments: [{ levelFrom: 103, levelTo: 103, monsterIds: [1, 2, 3] }] })
      const r = dailyGrindExp(cfg, all, 103, 1, 2)
      expect(r.targetArea).toBe('东岭关')
      expect(r.activeGroupCount).toBe(2) // 单图不减法：103/105 合格全参与；115 衰减 0 无经验
      expect(r.hourlySum).toBeCloseTo(22701.5625 * 14 * 384 + 27187.5 * 14 * 384, 6)
      const low = r.groupDetails.find((d) => d.id === 1)!
      expect(low.eligible).toBe(true)
      expect(low.burnsFatigue).toBe(true)
      const out = r.groupDetails.find((d) => d.id === 3)!
      expect(out.eligible).toBe(false)
      expect(out.burnsFatigue).toBe(true) // 超+8 无经验群仍参与烧速
      // 烧速 = 103/105/115 三群 384×3 = 1152（boss 行未勾选不参与）
      expect(r.burnPerHour).toBeCloseTo(384 * 3, 6)
      // 2 小时烧 2304 = 系统 380 + 大疲劳 1924，本周剩余大疲劳 596
      expect(r.fatigueUsed).toBeCloseTo(1152 * 2, 6)
      expect(r.systemFatigueUsed).toBe(SYSTEM_DAILY_FATIGUE)
      expect(r.bigFatigueUsed).toBeCloseTo(1152 * 2 - 380, 6)
      expect(r.remainingBigFatigue).toBeCloseTo(DEFAULT_BIG_FATIGUE_CAP - (1152 * 2 - 380), 6)
      expect(r.dailyExp).toBeCloseTo((r.hourlySum / r.burnPerHour) * r.fatigueUsed, 6)
    })

    it('剩余大疲劳传入：当日容量 = 380 + 剩余', () => {
      const r = dailyGrindExp(baseCfg(), monsters, 100, 1, 1, { remainingBigFatigue: 100 })
      expect(r.effectiveMinutes).toBe(60) // 384 ≤ 480，不截断
      expect(r.bigFatigueUsed).toBeCloseTo(4, 6)
      expect(r.remainingBigFatigue).toBeCloseTo(96, 6)
    })

    it('起始日剩余系统疲劳传入：容量 = 剩余系统 + 剩余大疲劳，系统扣到剩余为止', () => {
      // 烧速 384 PL/时：剩余系统 100 + 大疲劳 100 = 200 → 容量 31.25 分钟
      const r = dailyGrindExp(baseCfg(), monsters, 100, 1, 1,
        { remainingSystemFatigue: 100, remainingBigFatigue: 100 })
      expect(r.effectiveMinutes).toBeCloseTo((200 * 60) / 384, 6)
      expect(r.fatigueUsed).toBeCloseTo(200, 6)
      expect(r.systemFatigueUsed).toBe(100)
      expect(r.bigFatigueUsed).toBe(100)
      expect(r.remainingBigFatigue).toBe(0)
      expect(r.fatigueLimited).toBe(true)
    })

    it('起始日剩余系统疲劳充足时不截断：系统消耗不超过剩余值', () => {
      const r = dailyGrindExp(baseCfg(), monsters, 100, 1, 0.5,
        { remainingSystemFatigue: 200, remainingBigFatigue: 0 })
      expect(r.effectiveMinutes).toBe(30) // 192 ≤ 200，不截断
      expect(r.systemFatigueUsed).toBeCloseTo(192, 6)
      expect(r.bigFatigueUsed).toBe(0)
      expect(r.fatigueLimited).toBe(false)
    })

    it('自定义额度：bigFatigueCap 0 → 每天只有系统 380', () => {
      const r = dailyGrindExp(baseCfg({ bigFatigueCap: 0 }), monsters, 100, 1, 2)
      expect(r.effectiveMinutes).toBeCloseTo((380 * 60) / 384, 6)
      expect(r.systemFatigueUsed).toBe(SYSTEM_DAILY_FATIGUE)
      expect(r.bigFatigueUsed).toBe(0)
      expect(r.remainingBigFatigue).toBe(0)
      expect(r.fatigueLimited).toBe(true)
    })

    it('无效率数据（burn=0）：无疲劳约束，退回纯时间模型', () => {
      const all = [m({ respawnTime: 0 })]
      const r = dailyGrindExp(baseCfg(), all, 100, 1, 24)
      expect(r.burnPerHour).toBe(0)
      expect(r.effectiveMinutes).toBe(WEEKLY_GRIND_MIN_CAP)
      expect(r.fatigueUsed).toBe(0)
      expect(r.fatigueLimited).toBe(false)
    })

    it('低烧速：时间上限 580 分钟先于疲劳生效', () => {
      const low = [m({ respawnTime: 30 })] // 192 PL/时
      const r = dailyGrindExp(baseCfg(), low, 100, 1, 24)
      expect(r.effectiveMinutes).toBe(WEEKLY_GRIND_MIN_CAP)
    })

    it('周剩余刷怪与剩余大疲劳同时为 0 → 当天打怪 0', () => {
      const r = dailyGrindExp(baseCfg(), monsters, 100, 1, 1,
        { remainingGrindMin: 0, remainingBigFatigue: 0 })
      expect(r.effectiveMinutes).toBe(0)
      expect(r.dailyExp).toBe(0)
    })
  })
})
