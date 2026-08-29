import { BrowserWindow } from 'electron'
import { getDatabase } from '../database'

const SERVERS: string[] = [
  '得陇望蜀', '群雄逐鹿', '桃园结义', '牛刀小试', '铜台锁梦',
  '翩若惊鸿', '山海风云', '故地重游', '巧借东风', '皇榜征兵',
  '杜康解忧', '天下归心', '十八诸侯', '云骑长歌', '三足鼎立',
  '一代枭雄', '暗度陈仓', '单刀赴会', '抚琴退敌', '诗酒江陵',
  '百骑劫营', '威震江东', '一生所爱', '青梅拾酒',
]

const URL_TEMPLATE = 'https://uland.taobao.com/sem/tbsearch?bc_fl_src=tbsite_NOX36458&bd_vid=5173466194438421211&channelSrp=baiduSomama&clk1=d2811325e6aa361664c1b36ed00800d7&commend=all&ie=utf8&initiative_id=tbindexz_20170306&keyword=KW&localImgKey=&page=1&preLoadOrigin=https%3A%2F%2Fwww.taobao.com&q=KW&refpid=mm_26632258_3504122_32538762&search_type=item&sourceId=tb.index&spm=tbpc.pc_sem_alimama%2Fa.search_manual.0&ssid=s5-e&tab=all'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

function buildUrl(serverName: string): string {
  const kw = `qq三国${serverName}游戏币`
  return URL_TEMPLATE.replace(/KW/g, encodeURIComponent(kw))
}

function scrapeWithBrowser(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 800, height: 600, show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })

    const timeout = setTimeout(() => {
      try { win.destroy() } catch { /* ignore */ }
      resolve(null)
    }, 20000)

    win.loadURL(url, { userAgent: UA })

    win.webContents.on('did-finish-load', async () => {
      await new Promise(r => setTimeout(r, 3000))
      try {
        const price = await win.webContents.executeJavaScript(`
          (function() {
            var isPrice = function(v) { return v >= 20 && v <= 1000; }

            // 1. 搜卡片：前5个含QQ三国的卡片里找价格（20-1000，覆盖 元/千万 和 元/亿）
            var cards = document.querySelectorAll('[class*="card"], [class*="item"], [class*="Card"], [class*="Item"], [class*="result"], li, [class*="list"]>*')
            var checked = 0
            for (var i = 0; i < cards.length; i++) {
              if (checked >= 5) break
              if (!(cards[i].textContent||'').includes('QQ三国')) continue
              checked++
              var els = cards[i].querySelectorAll('[class*="price"], [class*="Price"], em, strong, .money, [class*="amount"], [class*="rmb"]')
              for (var j = 0; j < els.length; j++) {
                var n = parseFloat((els[j].textContent||'').replace(/[^\\d.]/g, ''))
                if (isPrice(n)) return n
              }
            }

            // 2. ¥符号后找价格
            var body = document.body?.innerText || ''
            var yen = body.match(/[¥￥]\\s*(\\d+(?:\\.\\d{1,2})?)/g)
            if (yen) for (var y=0;y<yen.length;y++) {
              var vy = parseFloat(yen[y].replace(/[^\\d.]/g,''))
              if (isPrice(vy)) return vy
            }

            // 3. 全文正则找价格
            var nums = body.match(/\\b([1-9]\\d{1,3})(?:\\.\\d{1,2})?\\b/g)
            if (nums) for (var x=0;x<nums.length;x++) {
              var vx = parseFloat(nums[x])
              if (isPrice(vx)) return vx
            }
            return null
          })()
        `)
        clearTimeout(timeout)
        try { win.destroy() } catch {}
        resolve(typeof price === 'number' ? price : null)
      } catch {
        clearTimeout(timeout)
        try { win.destroy() } catch {}
        resolve(null)
      }
    })

    win.webContents.on('did-fail-load', () => {
      clearTimeout(timeout)
      try { win.destroy() } catch {}
      resolve(null)
    })
  })
}

/* ── 单个抓取 ── */

function savePrice(serverName: string, price: number) {
  const db = getDatabase()
  db.prepare('UPDATE servers SET currency_rate=? WHERE name=?').run(price, serverName)
  const srv = db.prepare('SELECT id FROM servers WHERE name=?').get(serverName) as { id: number } | undefined
  if (srv) db.prepare('INSERT INTO currency_rate_history (server_id, rate) VALUES (?,?)').run(srv.id, price)
}

function adjustPrice(price: number | null): number | null {
  if (price === null || price <= 0) return null
  return price < 100 ? Math.round(price * 10 * 100) / 100 : price
}

// 3 小时内已抓取过则跳过（force=true 时忽略）
function getRecentPriceIfFresh(serverName: string): number | null {
  try {
    const db = getDatabase()
    const row = db.prepare(`
      SELECT r.rate, r.recorded_at
      FROM currency_rate_history r
      JOIN servers s ON s.id = r.server_id
      WHERE s.name = ?
      ORDER BY r.recorded_at DESC
      LIMIT 1
    `).get(serverName) as { rate: number; recorded_at: string } | undefined
    if (!row) return null
    const recordedAt = new Date(row.recorded_at.replace(' ', 'T')).getTime()
    const elapsed = Date.now() - recordedAt
    if (elapsed > 0 && elapsed < 3 * 60 * 60 * 1000) {
      return row.rate
    }
  } catch { /* fall through */ }
  return null
}

export async function scrapeOneServer(serverName: string, force = false): Promise<number | null> {
  if (!force) {
    const cached = getRecentPriceIfFresh(serverName)
    if (cached !== null) {
      console.log(`[币价抓取] ${serverName} → ${cached} 元/亿 (缓存)`)
      return cached
    }
  }

  const url = buildUrl(serverName)
  console.log(`[币价抓取] ${serverName}...`)
  const raw = await scrapeWithBrowser(url)
  const price = adjustPrice(raw)
  if (price !== null) {
    savePrice(serverName, price)
    console.log(`[币价抓取]   → ${price} 元/亿`)
  } else {
    console.log(`[币价抓取]   → 未提取到价格`)
  }
  return price
}

/* ── 批量抓取：当前大区优先 ── */

let pendingServer = ''

export function setPriorityServer(name: string) {
  pendingServer = name
}

export async function scrapeAllRates(force = false): Promise<{ updated: number; failed: number; currentPrice: number | null }> {
  const current = pendingServer || SERVERS[0]
  let updated = 0; let failed = 0; let currentPrice: number | null = null

  console.log('[币价抓取] 开始...')

  // 1. 当前大区先抓
  currentPrice = await scrapeOneServer(current, force)
  currentPrice !== null ? updated++ : failed++

  // 2. 其他大区后台异步
  const others = SERVERS.filter(s => s !== current)
  ;(async () => {
    for (let i = 0; i < others.length; i++) {
      const price = await scrapeOneServer(others[i], force)
      if (price !== null) console.log(`[币价抓取]   ${others[i]} → ${price} 元/亿`)
      await new Promise(r => setTimeout(r, 2000))
    }
    console.log(`[币价抓取] 后台完成`)
  })()

  return { updated, failed, currentPrice }
}

/* ── 定时调度 ── */

let midnightTimer: ReturnType<typeof setTimeout> | null = null

function msUntilMidnight(): number {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  return midnight.getTime() - now.getTime()
}

export function startCurrencyScheduler(): void {
  const schedule = () => {
    midnightTimer = setTimeout(() => {
      scrapeAllRates()
      schedule()
    }, msUntilMidnight())
  }
  schedule()
}

export function stopCurrencyScheduler(): void {
  if (midnightTimer) { clearTimeout(midnightTimer); midnightTimer = null }
}
