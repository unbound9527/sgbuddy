import { describe, expect, it } from 'vitest'
import { computeBestGrindGroups, computeGrindComboStats, formatBestGrindGroups, listAreaFullCandidates, listGrindCandidates } from './bestGrindArea'
import type { GrindMonster } from './grindExp'

// 构造怪物群：baseExp/fatigue 决定修正经验；respawnTime/quantity/fatigue 决定效率
const m = (id: number, area: string, name: string, level: number, baseExp: number, fatigue = 10, respawnTime = 30, quantity = 3): GrindMonster =>
  ({ id, area, name, level, baseExp, fatigue, multiplier: 1, quantity, respawnTime, killTime: 0 })

describe('computeBestGrindGroups · 每级最优地区打怪群组合', () => {
  it('时间瓶颈下勾选即打：低值群同样贡献每小时经验，组合总和最高者胜（非每疲劳加权平均）', () => {
    // 地区 A：群1 q 高（1400）+ 群2 q 低（140）各 eff 100 → 每小时经验 154,000（每疲劳加权 770）
    // 地区 B：群3 q 中等（1190）eff 100 → 每小时经验 119,000（每疲劳加权 1190）
    // 时间瓶颈（burn 300 ≤ 536）→ 每周经验 ∝ 每小时经验总和 → A 胜（多打低值群也贡献经验）
    const rows = computeBestGrindGroups([
      m(1, 'A', '高值', 86, 1000, 10, 360, 1), // diff −2 衰减 1 → q 1400, eff 100
      m(2, 'A', '低值', 86, 100, 10, 360, 1), // q 140, eff 100
      m(3, 'B', '均衡', 84, 850, 10, 360, 1), // diff 0 衰减 1 → q 1190, eff 100
    ], { from: 84, to: 84 })
    const row = rows[0]
    expect(row.area).toBe('A')
    expect(row.groups.map(g => g.id).sort((a, b) => a - b)).toEqual([1, 2])
    expect(row.value).toBeCloseTo(770, 6) // 每疲劳加权平均反而低于 B（1190）——但每小时经验总和更高
    expect(row.hourlySum).toBeCloseTo(154000, 6)
    expect(row.burnPerHour).toBeCloseTo(200, 6)
    expect(row.bottleneck).toBe('time')
    expect(row.weeklyExp).toBeCloseTo((580 * 154000) / 60, 6) // 580 分钟打满
  })

  it('时间瓶颈（总烧速 ≤ 535.9）时降级取全部合格群：86 朵思与 92 天剑妖跨等级段合并', () => {
    // 地区 蜀：朵思大王 86（diff −2 衰减 1，q=1260）+ 天剑妖 92（diff −8 衰减 0.96，q=1075.2），eff 各 100
    //   → 总烧速 200 ≤ 535.9 烧不完疲劳 → 降级取全部合格群（每小时经验总和最大）；
    //     地区 魏：88 单群（q≈952.9）→ 蜀 胜
    const rows = computeBestGrindGroups([
      m(1, '蜀', '朵思大王', 86, 900, 10, 360, 1),
      m(2, '蜀', '天剑妖', 92, 800, 10, 360, 1),
      m(3, '魏', '单群', 88, 700, 10, 360, 1),
    ], { from: 84, to: 84 })
    expect(rows[0].area).toBe('蜀')
    expect(rows[0].groups.map(g => g.id).sort((a, b) => a - b)).toEqual([1, 2])
    expect(rows[0].value).toBeCloseTo(1167.6, 6) // (126000+107520)/200
    expect(rows[0].hourlySum).toBeCloseTo(233520, 6)
    expect(rows[0].bottleneck).toBe('time')
    expect(rows[0].weeklyExp).toBeCloseTo((580 * 233520) / 60, 6)
  })

  it('升级效率指标：q 高但烧速慢的地图，每周经验不如 q 低但刷得快的组合（核心反例）', () => {
    // 地区 A：单群每疲劳 q=1000，烧速 100/时 → 时间瓶颈，每周 = 580分×1000×100/60 ≈ 96.7 万
    // 地区 B：两群每疲劳 q=600 ×2，烧速 250×2=500/时 → 时间瓶颈，每周 = 580分×600×500/60 = 290 万
    // 每疲劳经验口径选 A（1000 > 600）；每周经验口径选 B（290 万 > 96.7 万）——刷新快/群多的图
    // 在时间瓶颈下靠每小时经验总量取胜
    const rows = computeBestGrindGroups([
      m(1, 'A', '高值慢刷', 84, (1000 / 14) * 10, 10, 360, 1), // q=1000, eff=100
      m(2, 'B', '低值快刷一', 84, (600 / 14) * 10, 10, 144, 1), // q=600, eff=250
      m(3, 'B', '低值快刷二', 84, (600 / 14) * 10, 10, 144, 1), // q=600, eff=250
    ], { from: 84, to: 84 })
    const row = rows[0]
    expect(row.area).toBe('B')
    expect(row.groups.map(g => g.id).sort((a, b) => a - b)).toEqual([2, 3])
    expect(row.value).toBeCloseTo(600, 6) // 每疲劳经验反而低于 A
    expect(row.hourlySum).toBeCloseTo(300000, 6)
    expect(row.burnPerHour).toBeCloseTo(500, 6)
    expect(row.bottleneck).toBe('time')
    expect(row.weeklyExp).toBeCloseTo((580 * 300000) / 60, 6)
  })

  it('疲劳瓶颈：烧速超过每周疲劳容量对应分钟（>535.9/时）时，每周经验 = 疲劳容量 × 每疲劳经验', () => {
    const rows = computeBestGrindGroups([
      m(1, 'X', '快刷', 84, (1000 / 14) * 100, 100, 360, 1), // q=1000, eff=1000 → 疲劳瓶颈
    ], { from: 84, to: 84 })
    const row = rows[0]
    expect(row.bottleneck).toBe('fatigue')
    // 疲劳容量分钟 = 5180×60/1000 = 310.8 分 < 580 → 每周经验 = 5180 × 1000 = 5,180,000
    expect(row.weeklyExp).toBeCloseTo(5180 * 1000, 4)
    expect(row.hourlySum).toBeCloseTo(1000 * 1000, 6)
  })

  it('默认组合 = 全部合格群（单位经验获取效率最高）：低 q 群加入提高每小时经验，即使稀释每疲劳经验', () => {
    // 地区 X：群1 q=1000 eff=600 + 群2 q=200 eff=600（同为 84 级）
    // → 默认取全部合格群（每小时经验 720,000 最大，勾选即打）；每疲劳加权降到 600、
    //   烧速 1200 → 疲劳瓶颈，每周 = 5180 × 600 = 3,108,000
    const rows = computeBestGrindGroups([
      m(1, 'X', '高值', 84, (1000 / 14) * 60, 60, 360, 1), // q=1000, eff=600
      m(2, 'X', '低值', 84, (200 / 14) * 60, 60, 360, 1), // q=200, eff=600
    ], { from: 84, to: 84 })
    const row = rows[0]
    expect(row.groups.map(g => g.id).sort((a, b) => a - b)).toEqual([1, 2])
    expect(row.value).toBeCloseTo(600, 6) // (1000×600 + 200×600) / 1200
    expect(row.hourlySum).toBeCloseTo(720000, 6)
    expect(row.bottleneck).toBe('fatigue')
    expect(row.weeklyExp).toBeCloseTo(5180 * 600, 6)
  })

  it('时间瓶颈时全部合格群都纳入（跨等级段）：103 高 q 群与 108 两群合并', () => {
    // 地区 X：103 级群 q=1000×0.9883(diff−3)=988.3 + 108 两群（q=576/672），eff 各 100
    // → q 降序 [103(988.3), 108乙(672), 108甲(576)]，总烧速 300 ≤ 535.9 烧不完疲劳
    //   → 降级取全部合格群（每小时经验总和最大）
    const rows = computeBestGrindGroups([
      m(1, 'X', '高值低段', 103, (1000 / 14) * 10, 10, 360, 1), // q=1000×0.9883=988.3, eff=100
      m(2, 'X', '108甲', 108, (600 / 14) * 10, 10, 360, 1), // q=600×0.96(diff−8)=576, eff=100
      m(3, 'X', '108乙', 108, (700 / 14) * 10, 10, 360, 1), // q=700×0.96=672, eff=100
    ], { from: 100, to: 100 })
    const row = rows[0]
    expect(row.groups.map(g => g.id).sort((a, b) => a - b)).toEqual([1, 2, 3])
    expect(row.value).toBeCloseTo(223630 / 300, 6) // 每小时经验总和/总烧速
    expect(row.hourlySum).toBeCloseTo(223630, 6) // 98,830 + 57,600 + 67,200
    expect(row.bottleneck).toBe('time')
    expect(row.weeklyExp).toBeCloseTo((580 * 223630) / 60, 6)
  })

  it('跨等级段合并凑疲劳能烧完：86 朵思 + 92 天剑妖（burn 600）达标 → 疲劳瓶颈', () => {
    // 单群都烧不完（burn 300 < 535.9）；按 q 降序合并后 burn 600 > 535.9 达标
    const rows = computeBestGrindGroups([
      m(1, 'X', '朵思大王', 86, (1000 / 14) * 30, 30, 360, 1), // q=1000, eff=300
      m(2, 'X', '天剑妖', 92, (800 / 14) * 30, 30, 360, 1), // q=800×0.96(diff−8)=768, eff=300
    ], { from: 84, to: 84 })
    const row = rows[0]
    expect(row.groups.map(g => g.id)).toEqual([1, 2]) // 前缀1 未达标 → 前缀2 达标 → 全纳入
    expect(row.bottleneck).toBe('fatigue')
    expect(row.value).toBeCloseTo(884, 6) // (1000×300+768×300)/600
    expect(row.weeklyExp).toBeCloseTo(5180 * 884, 6)
  })

  it('每周经验最高的地区胜出：即使其每小时经验或每疲劳加权更低（每周经验口径，2026-08-27）', () => {
    // 地区 A：两群 q=800 eff=300×2 → hourly 480,000（每疲劳 800，疲劳瓶颈，weekly = 5180×800 = 4,144,000）
    // 地区 B：单群 q=2000 eff=200 → hourly 400,000（每疲劳 2000 更高但每小时更低，时间瓶颈）
    // → A 的每周经验 4,144,000 > B 的 3,866,667，选 A
    const rows = computeBestGrindGroups([
      m(1, 'A', '达标一', 84, (800 / 14) * 30, 30, 360, 1), // q=800, eff=300
      m(2, 'A', '达标二', 84, (800 / 14) * 30, 30, 360, 1), // q=800, eff=300
      m(3, 'B', '高值未达标', 84, (2000 / 14) * 20, 20, 360, 1), // q=2000, eff=200
    ], { from: 84, to: 84 })
    const row = rows[0]
    expect(row.area).toBe('A')
    expect(row.bottleneck).toBe('fatigue')
    expect(row.weeklyExp).toBeCloseTo(5180 * 800, 6)
  })

  it('疲劳瓶颈下按每周经验选取：每小时经验更高的地区每周经验反而更低（核心回归，2026-08-27）', () => {
    // 地区 A：两群 q=600 eff=600×2 → hourly 720,000、burn 1200 疲劳瓶颈 → weekly = 5180×600 = 3,108,000
    // 地区 B：单群 q=800 eff=500 → hourly 400,000、burn 500 时间瓶颈 → weekly = 580×400000/60 = 3,866,667
    // 旧口径（hourly 最大）选 A；每周经验口径选 B（A 每小时高 80% 但每周经验低 20%）
    const rows = computeBestGrindGroups([
      m(1, 'A', '快刷一', 84, (600 / 14) * 60, 60, 360, 1), // q=600, eff=600
      m(2, 'A', '快刷二', 84, (600 / 14) * 60, 60, 360, 1), // q=600, eff=600
      m(3, 'B', '慢刷高值', 84, (800 / 14) * 50, 50, 360, 1), // q=800, eff=500
    ], { from: 84, to: 84 })
    const row = rows[0]
    expect(row.area).toBe('B')
    expect(row.hourlySum).toBeCloseTo(400000, 6) // 每小时经验反而更低
    expect(row.bottleneck).toBe('time')
    expect(row.weeklyExp).toBeCloseTo((580 * 400000) / 60, 6) // 每周经验更高
  })

  it('衰减窗口外（等级差超 −7~+8）的怪物不参与；同级衰减 1、跨 8 级 0.96', () => {
    const rows = computeBestGrindGroups([
      m(1, 'X', '同级', 84, 1000, 10, 360, 1), // diff 0 → 衰减 1
      m(2, 'X', '差9级', 93, 9999, 10, 360, 1), // diff −9 → 表外 0，排除
    ], { from: 84, to: 84 })
    expect(rows[0].groups.map(g => g.id)).toEqual([1])
  })

  it('效率数据无效（respawn_time ≤ 0）的群不是合格群，不参与组合', () => {
    const rows = computeBestGrindGroups([
      m(1, 'X', '有效', 84, 1000, 10, 360, 1),
      m(2, 'X', '无效率', 84, 9999, 10, 0, 1), // respawnTime 0 → monsterEfficiency 0 → 排除
    ], { from: 84, to: 84 })
    expect(rows[0].groups.map(g => g.id)).toEqual([1])
  })

  it('可传自定义衰减率表（复用计算器查表接口）', () => {
    // 自定义表：diff 0 → 衰减 0.5
    const rows = computeBestGrindGroups([
      m(1, 'X', '同级', 84, 1000, 10, 360, 1),
    ], { from: 84, to: 84, rates: { 0: 0.5 } })
    expect(rows[0].groups).toHaveLength(1)
  })

  it('自定义衰减率改变最优地区选取（B 表跟随全局衰减率口径，2026-08-27）', () => {
    // 默认表：A 的 84 级怪 diff 0 衰减 1（hourly 140,000）> B 的 91 级怪 diff −7 衰减 0.9726（hourly 136,164）
    const monsters = [
      m(1, 'A', '同级', 84, 1000, 10, 360, 1),
      m(2, 'B', '差7级', 91, 1000, 10, 360, 1),
    ]
    expect(computeBestGrindGroups(monsters, { from: 84, to: 84 })[0].area).toBe('A')
    // 自定义表把 diff 0 压到 0.5、diff −7 保持 1 → B 每小时 140,000 > A 70,000 → 改选 B
    const custom = computeBestGrindGroups(monsters, { from: 84, to: 84, rates: { 0: 0.5, [-7]: 1 } })[0]
    expect(custom.area).toBe('B')
    expect(custom.hourlySum).toBeCloseTo(140000, 6)
  })

  it('总倍率（数字型）等比放大经验指标，不改变组合选取与瓶颈（2026-08-27）', () => {
    // 沿用首用例两地区：A 两群 hourly 154,000 vs B 单群 hourly 119,000；倍率 1.25 后排序不变
    const rows = computeBestGrindGroups([
      m(1, 'A', '高值', 86, 1000, 10, 360, 1),
      m(2, 'A', '低值', 86, 100, 10, 360, 1),
      m(3, 'B', '均衡', 84, 850, 10, 360, 1),
    ], { from: 84, to: 84, bonusRate: 1.25 })
    const row = rows[0]
    expect(row.area).toBe('A')
    expect(row.groups.map(g => g.id).sort((a, b) => a - b)).toEqual([1, 2])
    expect(row.value).toBeCloseTo(770 * 1.25, 6)
    expect(row.hourlySum).toBeCloseTo(154000 * 1.25, 6)
    expect(row.burnPerHour).toBeCloseTo(200, 6) // 烧速不含倍率
    expect(row.bottleneck).toBe('time')
    expect(row.weeklyExp).toBeCloseTo((580 * 154000 * 1.25) / 60, 6)
  })

  it('总倍率（函数型）按行等级查段：不同等级行取各自倍率（2026-08-27）', () => {
    // 84 级怪在 L=84（diff 0）与 L=85（diff +1）行衰减均为 1 → 倍率按行等级取值
    const rows = computeBestGrindGroups([
      m(1, 'X', '同级', 84, 1000, 10, 360, 1), // q=1400, eff=100
    ], { from: 84, to: 85, bonusRate: (level: number) => (level === 84 ? 1.25 : 2) })
    expect(rows).toHaveLength(2)
    expect(rows[0].level).toBe(84)
    expect(rows[0].hourlySum).toBeCloseTo(140000 * 1.25, 6)
    expect(rows[0].weeklyExp).toBeCloseTo((580 * 140000 * 1.25) / 60, 6)
    expect(rows[1].level).toBe(85)
    expect(rows[1].hourlySum).toBeCloseTo(140000 * 2, 6)
  })

  it('无候选：地区为 —、群组为空、各指标为 0、瓶颈 none', () => {
    const rows = computeBestGrindGroups([], { from: 84, to: 84 })
    expect(rows[0].area).toBe('—')
    expect(rows[0].groups).toEqual([])
    expect(rows[0].value).toBe(0)
    expect(rows[0].hourlySum).toBe(0)
    expect(rows[0].burnPerHour).toBe(0)
    expect(rows[0].weeklyExp).toBe(0)
    expect(rows[0].bottleneck).toBe('none')
  })

  it('可传自定义每周分钟/疲劳容量（如按实际方案口径重算）', () => {
    // 默认 580 分钟、5180 疲劳；传 weeklyMinutes=100 → 时间瓶颈时有效分钟 = 100
    const rows = computeBestGrindGroups([
      m(1, 'X', '慢刷', 84, (1000 / 14) * 10, 10, 360, 1), // q=1000, eff=100
    ], { from: 84, to: 84, weeklyMinutes: 100 })
    expect(rows[0].bottleneck).toBe('time')
    expect(rows[0].weeklyExp).toBeCloseTo((100 * 100000) / 60, 6)
    // 传 weeklyFatigue=2000 → 疲劳容量分钟 = 2000×60/1000 = 120 分 < 100 分钟上限 580 → 疲劳瓶颈
    const rows2 = computeBestGrindGroups([
      m(1, 'X', '快刷', 84, (1000 / 14) * 100, 100, 360, 1), // q=1000, eff=1000
    ], { from: 84, to: 84, weeklyFatigue: 2000 })
    expect(rows2[0].bottleneck).toBe('fatigue')
    expect(rows2[0].weeklyExp).toBeCloseTo(2000 * 1000, 6)
  })

  it('from/to 控制产出范围；超窗口怪物（等级差超出 −7~+8）不参与', () => {
    // L=100 时怪物 84 级 diff +16 → 表外无衰减 → 排除 → 无候选
    const rows = computeBestGrindGroups([m(1, 'X', '远级', 84, 1000, 10, 360, 1)], { from: 100, to: 100 })
    expect(rows).toHaveLength(1)
    expect(rows[0].level).toBe(100)
    expect(rows[0].area).toBe('—')
  })
})

describe('listGrindCandidates · 编辑弹层候选（窗口内全部合格群，跨地区）', () => {
  it('窗口 [L−7, L+8] 过滤：窗外/无效率/无衰减群排除，带 q/eff 按等级升序', () => {
    const list = listGrindCandidates([
      m(5, '魏', '窗外低', 76, 1000, 10, 360, 1), // 76 < 77 → 排除
      m(1, '蜀', '朵思大王', 86, 900, 10, 360, 1), // q=1260, eff=100
      m(2, '蜀', '天剑妖', 92, 800, 10, 360, 1), // diff −8 → q=1075.2, eff=100
      m(3, '魏', '无效率', 88, 900, 10, 0, 1), // eff=0 → 排除
      m(4, '魏', '窗外高', 148, 900, 10, 360, 1), // 148 > 92 → 排除
    ], 84)
    expect(list.map(c => c.m.id)).toEqual([1, 2])
    expect(list[0].q).toBeCloseTo(1260, 6)
    expect(list[1].q).toBeCloseTo(1075.2, 6)
    expect(list[1].eff).toBeCloseTo(100, 6)
  })

  it('可传自定义衰减率表', () => {
    const list = listGrindCandidates([
      m(1, 'X', '同级', 84, 1000, 10, 360, 1),
    ], 84, { rates: { 0: 0.5 } })
    expect(list[0].q).toBeCloseTo(1400 * 0.5, 6)
  })

  it('可传总倍率（封印加速/王城）：q 同比放大（2026-08-27）', () => {
    const list = listGrindCandidates([
      m(1, 'X', '同级', 84, 1000, 10, 360, 1),
    ], 84, { bonusRate: 1.25 })
    expect(list[0].q).toBeCloseTo(1400 * 1.25, 6)
  })
})

describe('listAreaFullCandidates · 编辑弹层候选（窗口内群所在地图的全部群，窗外灰显）', () => {
  it('有窗口内合格群的地图列出全部合格群：窗外群 inWindow=false 保留，q 按实际衰减', () => {
    const list = listAreaFullCandidates([
      m(1, '蜀', '朵思大王', 86, 900, 10, 360, 1), // 窗口内 → inWindow=true
      m(2, '蜀', '天剑妖', 92, 800, 10, 360, 1), // diff −8 → 窗口内，q=1075.2
      m(3, '蜀', '窗外群', 95, 900, 10, 360, 1), // 95 > 92 → 窗口外，但同图 → 保留 inWindow=false
      m(4, '魏', '窗内群', 88, 700, 10, 360, 1), // 窗口内 → 魏 有窗口内群
      m(5, '魏', '窗外群', 76, 700, 10, 360, 1), // 窗口外同图 → 保留
      m(6, '吴', '无窗内群', 148, 900, 10, 360, 1), // 吴 无窗口内合格群 → 整个地图不列出
      m(7, '吴', '无效率', 86, 900, 10, 0, 1), // eff=0 → 排除
    ], 84)
    // 全部按等级升序：魏 76（窗外）、蜀 86、魏 88、蜀 92、蜀 95（窗外）
    expect(list.map(c => c.m.id)).toEqual([5, 1, 4, 2, 3])
    expect(list.map(c => c.inWindow)).toEqual([false, true, true, true, false])
    expect(list[4].m.id).toBe(3)
    expect(list[4].q).toBeCloseTo(900 * 14 * 0, 6) // 窗外无衰减 → q=0（本级无经验）
    expect(list[3].q).toBeCloseTo((800 / 10) * 14 * 0.96, 6)
  })

  it('无任何窗口内合格群 → 空列表', () => {
    expect(listAreaFullCandidates([
      m(1, '吴', '远级', 100, 900, 10, 360, 1),
      m(2, '吴', '无效率', 86, 900, 10, 0, 1),
    ], 84)).toEqual([])
  })
})

describe('computeGrindComboStats · 自定义组合重算指标', () => {
  it('跨地区部分勾选：按勾选群重算 value/hourly/burn/weekly/bottleneck', () => {
    const stats = computeGrindComboStats([
      m(1, '蜀', '朵思大王', 86, 900, 10, 360, 1), // q=1260, eff=100
      m(2, '蜀', '天剑妖', 92, 800, 10, 360, 1), // q=1075.2, eff=100
    ], 84)
    expect(stats.hourlySum).toBeCloseTo(233520, 6)
    expect(stats.burnPerHour).toBeCloseTo(200, 6)
    expect(stats.value).toBeCloseTo(1167.6, 6)
    expect(stats.bottleneck).toBe('time')
    expect(stats.weeklyExp).toBeCloseTo((580 * 233520) / 60, 6)
  })

  it('空组合/全窗口外 → 全 0 + none（失效 id 或留空勾选）', () => {
    const empty = computeGrindComboStats([], 84)
    expect(empty).toEqual({ value: 0, hourlySum: 0, burnPerHour: 0, weeklyExp: 0, bottleneck: 'none' })
    const filtered = computeGrindComboStats([m(3, '魏', '远级', 93, 9999, 10, 360, 1)], 84) // 93 > 92 → 过滤
    expect(filtered.bottleneck).toBe('none')
  })

  it('疲劳瓶颈：勾选群烧速超 535.9/时 → 每周 = 疲劳容量 × 每疲劳经验', () => {
    const stats = computeGrindComboStats([
      m(1, 'X', '快刷', 84, (1000 / 14) * 100, 100, 360, 1), // q=1000, eff=1000
    ], 84)
    expect(stats.bottleneck).toBe('fatigue')
    expect(stats.weeklyExp).toBeCloseTo(5180 * 1000, 6)
  })

  it('总倍率缩放经验指标：hourlySum/value/weeklyExp 同比放大，burnPerHour 与瓶颈不变（2026-08-27）', () => {
    const monster = m(1, 'X', '慢刷', 84, (1000 / 14) * 10, 10, 360, 1) // q=1000, eff=100
    const base = computeGrindComboStats([monster], 84)
    const boosted = computeGrindComboStats([monster], 84, { bonusRate: 1.25 })
    expect(boosted.hourlySum).toBeCloseTo(base.hourlySum * 1.25, 6)
    expect(boosted.value).toBeCloseTo(base.value * 1.25, 6)
    expect(boosted.weeklyExp).toBeCloseTo(base.weeklyExp * 1.25, 6)
    expect(boosted.burnPerHour).toBeCloseTo(base.burnPerHour, 6)
    expect(boosted.bottleneck).toBe(base.bottleneck)
  })
})

describe('formatBestGrindGroups · 组合显示串', () => {
  it('按等级+名称升序拼接并带数量，同名同级行数量相加', () => {
    expect(formatBestGrindGroups([
      m(2, '蜀', '天剑妖', 92, 100),
      m(1, '蜀', '朵思大王', 86, 100),
      m(4, '蜀', '天剑妖', 92, 100, 10, 30, 5), // 同名同级行 → 合并一项、数量相加
      m(3, '蜀', '蔡文姬', 148, 100),
    ])).toBe('86朵思大王(3) · 92天剑妖(8) · 148蔡文姬(3)')
  })

  it('同名不同级不合并；数量合并后显示总和', () => {
    const list = formatBestGrindGroups([
      m(9, '蜀', '天剑妖', 90, 100),
      m(8, '蜀', '天剑妖', 88, 100, 10, 30, 2),
      m(7, '蜀', '天剑妖', 90, 100),
    ])
    // 等级升序：88 在前；90 级两行合并为 (6)
    expect(list).toBe('88天剑妖(2) · 90天剑妖(6)')
  })

  it('空群 → 无候选', () => {
    expect(formatBestGrindGroups([])).toBe('无候选')
  })
})
