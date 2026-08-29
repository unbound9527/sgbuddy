/**
 * QQ三国币价自动抓取脚本
 * 从淘宝 API 获取各大区游戏币价格（取第一个商品金额）
 *
 * 用法（本机运行）: node scripts/scrape-currency-rates.mjs
 * 输出: scripts/rates-output.json
 */

import { writeFileSync } from 'fs'

const SERVERS = [
  '得陇望蜀', '群雄逐鹿', '桃园结义', '牛刀小试', '铜台锁梦',
  '翩若惊鸿', '山海风云', '故地重游', '巧借东风', '皇榜征兵',
  '杜康解忧', '天下归心', '十八诸侯', '云骑长歌', '三足鼎立',
  '一代枭雄', '暗度陈仓', '单刀赴会', '抚琴退敌', '诗酒江陵',
  '百骑劫营', '威震江东', '一生所爱', '青梅拾酒',
]

// API 端点（淘宝联盟搜索 API）
const API_BASE = 'https://searchapp.s.taobao.com/searchSem'

function buildApiUrl(serverName) {
  const kw = `qq三国${serverName}游戏币`
  const params = new URLSearchParams({
    keyword: kw,
    q: kw,
    tab: 'all',
    page: '1',
    search_type: 'item',
    bc_fl_src: 'tbsite_NOX36458',
    commend: 'all',
    ie: 'utf8',
    ssid: 's5-e',
    __bucket__: '1',
  })
  return `${API_BASE}?${params.toString()}`
}

function extractFirstPrice(data) {
  // 尝试多种 JSON 结构
  let items = null
  if (Array.isArray(data)) items = data
  else if (data.items) items = data.items
  else if (data.data?.items) items = data.data.items
  else if (data.result?.items) items = data.result.items
  else if (data.list) items = data.list
  else if (data.data?.list) items = data.data.list

  if (!items || items.length === 0) return null

  const first = items[0]
  // 淘宝商品价格字段可能是 price / reservePrice / view_price / sellPrice
  const raw = first.price ?? first.reservePrice ?? first.view_price ?? first.sellPrice ?? first.promotionPrice

  if (raw === null || raw === undefined) return null
  const price = parseFloat(raw)
  return price > 0 ? price : null
}

async function scrapeServer(serverName) {
  const url = buildApiUrl(serverName)
  console.log(`[${serverName}] 请求中...`)

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': 'https://uland.taobao.com/',
      },
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) {
      console.log(`[${serverName}] HTTP ${res.status}`)
      return { server: serverName, price: null, error: `HTTP ${res.status}` }
    }

    const text = await res.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      // 尝试从 HTML 中提取
      const match = text.match(/[¥￥]\s*(\d+(?:\.\d{1,2})?)/)
      if (match) {
        const price = parseFloat(match[1])
        console.log(`[${serverName}] → ${price} 元 (HTML提取)`)
        return { server: serverName, price }
      }
      return { server: serverName, price: null, error: '非JSON响应' }
    }

    const price = extractFirstPrice(data)
    if (price !== null) {
      console.log(`[${serverName}] → ${price} 元`)
    } else {
      console.log(`[${serverName}] 未提取到价格 (keys: ${Object.keys(data).join(',')})`)
    }

    return { server: serverName, price, error: price === null ? '未提取到价格' : null }
  } catch (err) {
    console.log(`[${serverName}] 请求失败: ${err.message}`)
    return { server: serverName, price: null, error: err.message }
  }
}

async function main() {
  console.log('QQ三国币价抓取')
  console.log(`共 ${SERVERS.length} 个大区\n`)

  const results = []
  for (const server of SERVERS) {
    const result = await scrapeServer(server)
    results.push(result)
    await new Promise((r) => setTimeout(r, 1200)) // 间隔1.2秒防限流
  }

  const success = results.filter((r) => r.price !== null)
  const failed = results.filter((r) => r.price === null)

  console.log(`\n===== 结果: ${success.length}/${SERVERS.length} =====`)
  for (const r of success) {
    console.log(`  ${r.server}: ${r.price} 元/亿`)
  }
  if (failed.length > 0) {
    console.log(`\n失败:`)
    for (const r of failed) console.log(`  ${r.server}: ${r.error}`)
  }

  writeFileSync('scripts/rates-output.json', JSON.stringify({
    scrapedAt: new Date().toISOString(),
    rates: Object.fromEntries(results.map((r) => [r.server, r.price])),
    errors: Object.fromEntries(failed.map((r) => [r.server, r.error])),
  }, null, 2), 'utf-8')

  console.log('\n→ scripts/rates-output.json')
}

main()
