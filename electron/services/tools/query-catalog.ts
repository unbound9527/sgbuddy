import { getDatabase } from '../../database'

export interface CatalogItem {
  name: string
  quality: string
  category: string
  slot_or_type: string
  benchmark_price: number
  market_price: number
  attr_notes: string
}

export interface QueryCatalogParams {
  category?: string
  keyword?: string
  quality?: string
  budget_max?: number
  limit?: number
}

export function queryCatalog(params: QueryCatalogParams): CatalogItem[] {
  const db = getDatabase()
  const conditions: string[] = []
  const sqlParams: unknown[] = []

  if (params.category && params.category !== '全部') {
    conditions.push('category = ?')
    sqlParams.push(params.category)
  }
  if (params.keyword) {
    conditions.push('name LIKE ?')
    sqlParams.push(`%${params.keyword}%`)
  }
  if (params.quality && params.quality !== '全部') {
    conditions.push('quality = ?')
    sqlParams.push(params.quality)
  }
  if (params.budget_max) {
    conditions.push('market_price <= ?')
    sqlParams.push(params.budget_max)
  }

  let sql = 'SELECT * FROM price_params'
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ')
  sql += ' ORDER BY market_price DESC'
  if (params.limit) { sql += ' LIMIT ?'; sqlParams.push(params.limit) }

  const rows = db.prepare(sql).all(...sqlParams) as any[]
  return rows.map(r => ({
    name: r.name,
    quality: r.quality || '',
    category: r.category || '装备',
    slot_or_type: r.slot_or_type || '',
    benchmark_price: r.benchmark_price || 0,
    market_price: r.market_price || 0,
    attr_notes: r.attr_notes || '',
  }))
}
