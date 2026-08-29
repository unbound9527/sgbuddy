import { describe, expect, it } from 'vitest'
import { parseOcrText } from './fieldParser'

// 测试文本模拟 tesseract 输出风格：字符间带空格（如「全 职业」「110 级」）
describe('parseOcrText', () => {
  it('装备全字段：名称/品类/部位/等级/职业/打造', () => {
    const r = parseOcrText(`常 仪 策 月 剑
部 位 : 武器
装备 等 级 : 110 级
适用 职业 : 剑侍
打造 : 完美
价格 : 5000 万`)
    expect(r.item_name).toBe('常仪策月剑')
    expect(r.category).toBe('装备')
    expect(r.slot).toBe('武器')
    expect(r.equip_level).toBe(110)
    expect(r.equip_job).toBe('剑侍')
    expect(r.craft_level).toBe('完美')
    expect(r.matched).toEqual(expect.arrayContaining([
      'category', 'slot', 'equip_level', 'equip_job', 'craft_level', 'item_name',
    ]))
  })

  it('全职业 → 职业不区分且不打角标', () => {
    const r = parseOcrText(`常 仪 策 月 剑
适用 职业 : 全 职业`)
    expect(r.equip_job).toBe('')
    expect(r.matched).not.toContain('equip_job')
  })

  it('无等级行 → 等级不区分', () => {
    const r = parseOcrText(`常 仪 策 月 剑
部 位 : 武器`)
    expect(r.equip_level).toBe(0)
    expect(r.matched).not.toContain('equip_level')
  })

  it('「不限等级」→ 等级不区分且不打角标', () => {
    const r = parseOcrText(`常 仪 策 月 剑
装备 等级 : 不限 等级`)
    expect(r.equip_level).toBe(0)
    expect(r.matched).not.toContain('equip_level')
  })

  it('灵魄：品类+位置', () => {
    const r = parseOcrText(`攻 击 灵 魄
灵 魄 位 置 : 利 刃`)
    expect(r.category).toBe('灵魄')
    expect(r.spirit_position).toBe('利刃')
    expect(r.item_name).toBe('攻击灵魄')
  })

  it('灵兽：品质「天」带标签才识别', () => {
    const r = parseOcrText(`九 尾 灵 兽
品 质 : 天`)
    expect(r.category).toBe('灵兽')
    expect(r.quality).toBe('天')
  })

  it('装备名含单字「天」不误判品质', () => {
    const r = parseOcrText(`天 怒 剑
部 位 : 武器`)
    expect(r.quality).toBe('')
    expect(r.item_name).toBe('天怒剑')
  })

  it('八阵图 → 品类推断', () => {
    const r = parseOcrText(`风 雷 八 阵 图`)
    expect(r.category).toBe('八阵图')
  })

  it('无品类证据 → 不预填品类', () => {
    const r = parseOcrText(`金 刚 石
稀 有 矿 物`)
    expect(r.category).toBe('')
    expect(r.item_name).toBe('金刚石')
  })

  it('「之灵」→ 灵魄', () => {
    const r = parseOcrText(`疾 风 之 灵
灵 魄 位 置 : 利 刃`)
    expect(r.category).toBe('灵魄')
    expect(r.item_name).toBe('疾风之灵')
  })

  it('「天赋」→ 奥义', () => {
    const r = parseOcrText(`遁 甲 天 书
天 赋 : 灭 意 凌 云`)
    expect(r.category).toBe('奥义')
    expect(r.item_name).toBe('遁甲天书')
  })

  it('「幸运」→ 元神', () => {
    const r = parseOcrText(`青 龙 元 神
幸 运 : 1 0 0`)
    expect(r.category).toBe('元神')
  })

  it('部位提示字：杖→武器，冠→头盔，甲→上装，手→护手，裙→下装，靴→鞋子', () => {
    const cases = [
      ['驭 日 杖', '武器'],
      ['紫 金 冠', '头盔'],
      ['玄 武 甲', '上装'],
      ['烈 焰 手', '护手'],
      ['凤 羽 裙', '下装'],
      ['疾 风 靴', '鞋子'],
    ]
    for (const [name, expected] of cases) {
      const r = parseOcrText(`${name}
部 位 : 装 备`)
      expect(r.slot).toBe(expected)
    }
  })

  it('奥义名称矫正：识别出已知奥义名应覆盖提取的名称', () => {
    // 模拟 OCR 把「遁甲天书」识别得乱七八糟，但文本中仍有正确的
    const r = parseOcrText(`遁 甲 天 书
天 赋 等 级 : 1 0`)
    expect(r.category).toBe('奥义')
    expect(r.item_name).toBe('遁甲天书')
  })

})
