import { describe, expect, it } from 'vitest'
import { matchesSearch, splitSearchTerms, type SearchableClue } from './clueSearch'

const clue: SearchableClue = {
  keyword: '出',
  title: '出 100级橙武鬼神 JS号 代价来',
  content_preview: '得陇望蜀成品号 法系 全身10阶',
  author_name: '小叶子',
  price_text: '800',
}

describe('splitSearchTerms', () => {
  it('按空白拆分并转小写', () => {
    expect(splitSearchTerms(' JS  100 ')).toEqual(['js', '100'])
  })

  it('空输入 / 纯空白 → 空数组', () => {
    expect(splitSearchTerms('')).toEqual([])
    expect(splitSearchTerms('   ')).toEqual([])
  })

  it('全角空格同样拆分', () => {
    expect(splitSearchTerms('JS　100')).toEqual(['js', '100'])
  })
})

describe('matchesSearch', () => {
  it('无词时恒匹配', () => {
    expect(matchesSearch(clue, [])).toBe(true)
  })

  it('命中标题（大小写不敏感）', () => {
    expect(matchesSearch(clue, ['js'])).toBe(true)
    expect(matchesSearch(clue, ['JS'])).toBe(true)
  })

  it('命中摘要', () => {
    expect(matchesSearch(clue, ['法系'])).toBe(true)
  })

  it('命中发帖人', () => {
    expect(matchesSearch(clue, ['小叶子'])).toBe(true)
  })

  it('命中价格', () => {
    expect(matchesSearch(clue, ['800'])).toBe(true)
  })

  it('命中抓取关键词', () => {
    expect(matchesSearch(clue, ['出'])).toBe(true)
  })

  it('多词 AND：全部命中才匹配', () => {
    expect(matchesSearch(clue, ['js', '法系'])).toBe(true)
    expect(matchesSearch(clue, ['js', '不存在的词'])).toBe(false)
  })

  it('未命中任何字段 → 不匹配', () => {
    expect(matchesSearch(clue, ['战士'])).toBe(false)
  })
})
