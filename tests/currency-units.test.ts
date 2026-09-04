import { describe, expect, it } from 'vitest'
import { analyzeRates, median, targetRate, unitFactorToYi } from '../electron/services/currency-units'

const SRV = '得陇望蜀'

describe('unitFactorToYi —— 淘宝标题单位识别', () => {
  it('1000W / 一千万 → ×10', () => {
    expect(unitFactorToYi('QQ三国得陇望蜀游戏币三国币1000W/一千万')).toBeCloseTo(10)
    expect(unitFactorToYi('亿老板：QQ三国得陇望蜀张飞醉酒官渡之战游戏币三国币1000W')).toBeCloseTo(10)
  })

  it('1E / 1亿 → ×1', () => {
    expect(unitFactorToYi('亿老板：QQ三国得陇望蜀游戏币三国币1E/1亿')).toBeCloseTo(1)
    expect(unitFactorToYi('米修三国币：QQ三国得陇望蜀三国币1亿/1E游戏币qq三国游戏币')).toBeCloseTo(1)
  })

  it('10E / 10亿 → ÷10', () => {
    expect(unitFactorToYi('亿老板：QQ三国 得陇望蜀张飞醉酒官渡之战 游戏币三国币10E/10亿')).toBeCloseTo(0.1)
  })

  it('无单位标题 → null（丢弃，不猜）', () => {
    expect(unitFactorToYi('QQ三国得陇望蜀张飞醉酒官渡之战游戏币')).toBeNull()
  })
})

describe('targetRate —— v4 底部锚定 + 跨档互证 + 时序保护', () => {
  it('它区广告被排除；1E 孤立报价靠跨档互证采纳', () => {
    const rate = targetRate(
      [
        { price: 233.5, title: `亿老板：QQ三国${SRV}游戏币三国币1E/1亿` },
        { price: 278, title: 'QQ三国抚琴退敌游戏币1E/1亿' }, // 它区 → 排除
        { price: 23, title: `小孟三国币 QQ三国${SRV}官渡之战游戏币1000W` }, // 千万 ×10 = 230
      ],
      SRV,
    )
    expect(rate).toBe(231.75) // 1E(233.5) 与千万(230) 折算后同簇 → 跨档互证强证据，簇中位
  })

  it('1E 直读档与千万档接近时合并成簇（跨档互证）', () => {
    const rate = targetRate(
      [
        { price: 233.5, title: `QQ三国${SRV}游戏币1E/1亿` },
        { price: 234, title: `QQ三国${SRV}游戏币1亿` },
        { price: 26, title: `QQ三国${SRV}游戏币1000W` }, // 260
      ],
      SRV,
    )
    expect(rate).toBe(234) // 簇 [233.5, 234, 260]（260 在 233.5×1.15 内），簇中位
  })

  it('无标题命中目标大区 → null（宁缺毋滥）', () => {
    expect(
      targetRate([{ price: 278, title: 'QQ三国抚琴退敌游戏币1E/1亿' }], SRV),
    ).toBeNull()
  })

  it('折算后超出 200–900 的报价被过滤', () => {
    const rate = targetRate(
      [
        { price: 2, title: `QQ三国${SRV}游戏币1000W` }, // 20 → 过滤
        { price: 300, title: `QQ三国${SRV}游戏币1000W` }, // 3000 → 过滤
        { price: 24, title: `QQ三国${SRV}游戏币1000W` }, // 240 → 保留
      ],
      SRV,
      250, // 历史一致，孤立簇可采纳
    )
    expect(rate).toBe(240)
  })

  it('元宝/点券等非币类商品被排除（亿单价不同，混入会拉偏价格）', () => {
    const rate = targetRate(
      [
        { price: 290, title: `QQ三国${SRV}游戏币1E/1亿` },
        { price: 483, title: `QQ三国${SRV}元宝1亿` }, // 元宝 ≠ 游戏币
        { price: 500, title: `QQ三国${SRV}点券1亿` },
      ],
      SRV,
      300, // 孤立簇靠历史一致采纳
    )
    expect(rate).toBe(290)
  })

  it('店铺名噪声（123牌金币）→ 孤立簇跳过后采纳真实簇', () => {
    const rate = targetRate(
      [
        { price: 123, title: `123牌金币 QQ三国${SRV}张飞醉酒官渡之战游戏币1E` },
        { price: 233.5, title: `亿老板：QQ三国${SRV}游戏币三国币1E/1亿` },
        { price: 234.5, title: `QQ三国${SRV}游戏币1E` },
      ],
      SRV,
    )
    expect(rate).toBe(234) // 123 孤立簇跳过 → [233.5, 234.5] 底部簇
  })

  it('虚高成对陷阱（群雄逐鹿实测）：666×2 抢众数，底部锚定直接无视', () => {
    const rate = targetRate(
      [
        { price: 290, title: `亿老板：QQ三国${SRV}游戏币三国币1E` },
        { price: 295, title: `倾心三国币：QQ三国${SRV}1E游戏币` },
        { price: 888, title: `QQ三国${SRV}三国币1亿` },
        { price: 666, title: `云里金刚QQ三国${SRV}游戏币三国币1亿` },
        { price: 666, title: `QQ三国${SRV}三国币1E游戏币一亿` },
        { price: 300, title: `QQ三国${SRV}三国币1E游戏币` },
      ],
      SRV,
    )
    expect(rate).toBe(295) // 底部簇 [290,295,300] 中位
  })

  it('低价钓鱼牌：孤立低价被跳过，真实簇胜出', () => {
    const rate = targetRate(
      [
        { price: 21, title: `QQ三国${SRV}游戏币1E秒到` }, // 210 钓鱼
        { price: 290, title: `QQ三国${SRV}游戏币1E` },
        { price: 295, title: `QQ三国${SRV}游戏币1E` },
      ],
      SRV,
    )
    expect(rate).toBe(292.5)
  })

  it('整页虚高 + 历史时序否决：新值偏离历史 >40% 的簇被拒', () => {
    const rate = targetRate(
      [
        { price: 618, title: `QQ三国${SRV}游戏币1E` },
        { price: 666, title: `QQ三国${SRV}游戏币1E` },
        { price: 888, title: `QQ三国${SRV}游戏币1E` },
      ],
      SRV,
      290, // 候选簇 [618,666] 偏离 >40% → 否决；[888] 孤立 → null
    )
    expect(rate).toBeNull()
  })

  it('跨档互证压过被污染的历史值：618 脏历史不会卡死正确价', () => {
    const rate = targetRate(
      [
        { price: 21, title: `QQ三国${SRV}游戏币1000W` }, // 210
        { price: 219, title: `QQ三国${SRV}游戏币1E` }, // 219
        { price: 22, title: `QQ三国${SRV}游戏币1000W` }, // 220
      ],
      SRV,
      618, // 脏历史：219 偏差 65% 本应被否决，但簇内千万/1E 两档互证优先 → 采纳
    )
    expect(rate).toBe(219)
  })

  it('真实价格变动不被时序保护误杀（30% 内放行）', () => {
    const rate = targetRate(
      [
        { price: 350, title: `QQ三国${SRV}游戏币1E` },
        { price: 355, title: `QQ三国${SRV}游戏币1E` },
      ],
      SRV,
      290, // 352.5/290-1 ≈ 21.6% ≤ 30% → 放行
    )
    expect(rate).toBe(352.5)
  })

  it('跨档互证挡住低价钓鱼：低档无它档佐证被跳过', () => {
    const rate = targetRate(
      [
        { price: 21, title: `QQ三国${SRV}游戏币1E秒杀` }, // 210
        { price: 22, title: `QQ三国${SRV}游戏币1E限时` }, // 220
        { price: 29, title: `QQ三国${SRV}游戏币1000W` }, // 290
        { price: 28.9, title: `QQ三国${SRV}游戏币一千万` }, // 289
      ],
      SRV,
    )
    expect(rate).toBe(289.5) // [210,220] 簇无跨档佐证(±15%内无 289/290)？—— 220 vs 289 偏差 31% → 跳过 → 真实簇
  })
})

describe('analyzeRates 决策细节', () => {
  it('返回簇判定与证据链', () => {
    const d = analyzeRates(
      [
        { price: 290, title: `QQ三国${SRV}游戏币1E` },
        { price: 666, title: `QQ三国${SRV}游戏币1E` },
        { price: 28.9, title: `QQ三国${SRV}游戏币1000W` },
      ],
      SRV,
    )
    expect(d.rate).toBe(289.5) // 簇 [289(千万档), 290(1E档)] 跨档互证 → 簇中位
    expect(d.useYi).toBe(true)
    expect(d.evidence.crossBin).toBe(true) // 千万档与 1E 档同簇互证
    expect(d.clusters[0].verdict).toBe('采纳')
    expect(d.bins.length).toBe(2)
  })
})

describe('median', () => {
  it('奇数取中间，偶数取平均', () => {
    expect(median([1, 3, 5])).toBe(3)
    expect(median([230, 240])).toBe(235)
    expect(median([])).toBeNull()
  })
})
