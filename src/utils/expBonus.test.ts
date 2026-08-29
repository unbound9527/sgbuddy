import { describe, expect, it } from 'vitest'
import {
  bonusMultsOnDay,
  bonusUseItemsOnDay,
  sanitizeBonusItems,
  DEFAULT_BONUS_ITEMS,
  DAILY_MULTI_C_TASK_IDS,
  type ExpBonusItem,
} from './expBonus'

const make = (over: Partial<ExpBonusItem> = {}): ExpBonusItem => ({
  id: 'test', name: '测试道具', validDays: 30, grindPct: 0, itemPct: 0, taskPct: 0,
  taskIds: [], enabled: true, startDay: 1, startRemainDays: 30, ...over,
})

describe('bonusMultsOnDay · 时效与叠加', () => {
  it('第 1 天即消耗 1 天：day ≤ startRemainDays 生效，day = startRemainDays + 1 失效', () => {
    const b = [make({ id: 'g', grindPct: 30, validDays: 30, startRemainDays: 30 })]
    expect(bonusMultsOnDay(b, 1).grindMult).toBe(1.3)
    expect(bonusMultsOnDay(b, 30).grindMult).toBe(1.3)
    expect(bonusMultsOnDay(b, 31).grindMult).toBe(1) // 到期次日失效
    expect(bonusMultsOnDay(b, 0).grindMult).toBe(1)
  })

  it('起始剩余天数调低 = 已用掉一部分，提前到期', () => {
    const b = [make({ id: 'g', grindPct: 30, validDays: 30, startRemainDays: 10 })]
    expect(bonusMultsOnDay(b, 10).grindMult).toBe(1.3)
    expect(bonusMultsOnDay(b, 11).grindMult).toBe(1)
  })

  it('开始天数延后生效：窗口 = 第 startDay 天起共 startRemainDays 天', () => {
    const b = [make({ id: 'g', grindPct: 30, validDays: 30, startDay: 5, startRemainDays: 10 })]
    expect(bonusMultsOnDay(b, 4).grindMult).toBe(1) // 未到开始天数
    expect(bonusMultsOnDay(b, 5).grindMult).toBe(1.3) // 第 5 天起生效（当天消耗 1 天）
    expect(bonusMultsOnDay(b, 14).grindMult).toBe(1.3) // 窗口最后一天
    expect(bonusMultsOnDay(b, 15).grindMult).toBe(1) // 次日失效
  })

  it('禁用项不生效', () => {
    const b = [make({ id: 'g', grindPct: 30, enabled: false })]
    expect(bonusMultsOnDay(b, 1).grindMult).toBe(1)
  })

  it('多个道具百分比加法叠加：5% + 6% → ×1.11', () => {
    const b = [
      make({ id: 'a', grindPct: 5 }),
      make({ id: 'b', grindPct: 6 }),
    ]
    expect(bonusMultsOnDay(b, 1).grindMult).toBeCloseTo(1.11, 10)
  })

  it('打怪/道具/任务三通道独立累计', () => {
    const b = [
      make({ id: 'a', grindPct: 30 }),
      make({ id: 'b', itemPct: 5 }),
      make({ id: 'c', taskPct: 100, taskIds: ['t1', 't2'] }),
    ]
    const m = bonusMultsOnDay(b, 1)
    expect(m.grindMult).toBe(1.3)
    expect(m.itemMult).toBe(1.05)
    expect(m.taskMults).toEqual({ t1: 2, t2: 2 })
  })

  it('taskMults 只作用于 taskIds 列出的任务；空作用域 = 不作用于任何任务', () => {
    const b = [make({ id: 'c', taskPct: 100, taskIds: [] })]
    const m = bonusMultsOnDay(b, 1)
    expect(m.taskMults).toEqual({}) // 空 taskIds 不写任何任务
    expect(m.taskMults['any']).toBeUndefined()
  })

  it('过期的任务加成道具不产生 taskMults', () => {
    const b = [make({ id: 'c', taskPct: 100, taskIds: ['t1'], validDays: 3, startRemainDays: 3 })]
    expect(bonusMultsOnDay(b, 4).taskMults).toEqual({})
  })
})

describe('bonusUseItemsOnDay · 次数型道具', () => {
  it('只返回生效（启用且未过期）的次数型道具', () => {
    const b = [
      make({ id: 'use1', useMult: 0.25 }),
      make({ id: 'use2', useMult: 0.5, enabled: false }),
      make({ id: 'use3', useMult: 1, validDays: 5, startRemainDays: 5 }),
      make({ id: 'pct', grindPct: 30 }), // 百分比型不含
    ]
    expect(bonusUseItemsOnDay(b, 3)).toEqual([
      { id: 'use1', mult: 0.25 },
      { id: 'use3', mult: 1 },
    ])
    expect(bonusUseItemsOnDay(b, 6)).toEqual([{ id: 'use1', mult: 0.25 }]) // use3 到期
  })

  it('开始天数未到不生效', () => {
    const b = [make({ id: 'use1', useMult: 0.25, startDay: 3, startRemainDays: 2 })]
    expect(bonusUseItemsOnDay(b, 2)).toEqual([]) // 未到开始天数
    expect(bonusUseItemsOnDay(b, 3)).toEqual([{ id: 'use1', mult: 0.25 }])
    expect(bonusUseItemsOnDay(b, 4)).toEqual([{ id: 'use1', mult: 0.25 }])
    expect(bonusUseItemsOnDay(b, 5)).toEqual([]) // 窗口结束
  })
})

describe('sanitizeBonusItems · 加载校验', () => {
  it('丢弃非法项、回填缺省字段、钳制数值', () => {
    const out = sanitizeBonusItems([
      { id: 'a', name: '正常', validDays: 30, grindPct: 30, enabled: true },
      { id: '', name: '缺 id', validDays: 30 },
      { id: 'b', name: '坏有效期', validDays: 0 },
      { id: 'c', name: 123 as unknown as string, validDays: 30 },
      { id: 'd', name: '超限', validDays: 30, grindPct: 5000, startRemainDays: 99, startDay: 9999, taskIds: ['t1', 't1', 7 as unknown as string] },
    ])
    expect(out.length).toBe(2)
    expect(out[0]).toMatchObject({ id: 'a', grindPct: 30, itemPct: 0, taskPct: 0, taskIds: [], enabled: true, startDay: 1, startRemainDays: 30 }) // startDay 缺省 = 1（起始日）
    expect(out[1]).toMatchObject({ id: 'd', grindPct: 1000, startDay: 3650, startRemainDays: 99, taskIds: ['t1'] }) // 钳制/去重/剩余天数不设上限（99 > 有效 30 保留）/开始天数 ≤ 3650
  })

  it('有效天数与剩余天数均不设上限（超长原样保留）', () => {
    const out = sanitizeBonusItems([
      { id: 'long', name: '长期道具', validDays: 99999, startRemainDays: 99999, startDay: 2 },
      { id: 'clamp', name: '剩余超有效期', validDays: 30, startRemainDays: 40 },
    ])
    expect(out[0]).toMatchObject({ id: 'long', validDays: 99999, startRemainDays: 99999 })
    expect(out[1]).toMatchObject({ id: 'clamp', validDays: 30, startRemainDays: 40 }) // 剩余不设上限（2026-08-23）
  })

  it('非数组返回空列表', () => {
    expect(sanitizeBonusItems(null)).toEqual([])
    expect(sanitizeBonusItems({ items: [] })).toEqual([])
  })
})

describe('内置种子', () => {
  it('7 个内置道具与文档一致（每日多C 8 项任务、祝福语 0.25 次数型）', () => {
    expect(DEFAULT_BONUS_ITEMS.length).toBe(7)
    const multiC = DEFAULT_BONUS_ITEMS.find(b => b.id === 'bonus_daily_multi_c')!
    expect(multiC.taskPct).toBe(100)
    expect(multiC.taskIds).toEqual(DAILY_MULTI_C_TASK_IDS)
    expect(multiC.validDays).toBe(120)
    const bless = DEFAULT_BONUS_ITEMS.find(b => b.id === 'bonus_exp_bless')!
    expect(bless.useMult).toBe(0.25)
    expect(bless.validDays).toBe(180)
    const wuyou = DEFAULT_BONUS_ITEMS.find(b => b.id === 'bonus_exp_wuyou')!
    expect(wuyou.useMult).toBe(0.25)
    expect(wuyou.validDays).toBe(30)
    const ganen = DEFAULT_BONUS_ITEMS.find(b => b.id === 'bonus_ganen_zhufu')!
    expect(ganen.grindPct).toBe(30)
  })
})
