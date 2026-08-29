// src/utils/clueSearch.ts —— 交易线索关键词搜索的纯函数
// 无副作用、不依赖 Vue/Electron/DB，可独立单测
// 匹配范围：keyword / title / content_preview / author_name / price_text，大小写不敏感

export interface SearchableClue {
  keyword: string
  title: string
  content_preview: string
  author_name: string
  price_text: string
}

/** 输入按空白拆分为多个小写词；空输入 → [] */
export function splitSearchTerms(text: string): string[] {
  return text.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

/** 所有词都命中任一字段才算匹配（AND）；无词时恒为 true */
export function matchesSearch(clue: SearchableClue, terms: string[]): boolean {
  if (terms.length === 0) return true
  const haystack = [
    clue.keyword,
    clue.title,
    clue.content_preview,
    clue.author_name,
    clue.price_text,
  ].filter(Boolean).join(' ').toLowerCase()
  return terms.every(t => haystack.includes(t.toLowerCase()))
}
