import { BrowserWindow } from 'electron'
import { getDatabase } from '../database'
import { analyzeRates, RATE_MAX, RATE_MIN, type ExtractedItem } from './currency-units'

const SERVERS: string[] = [
  '得陇望蜀', '群雄逐鹿', '桃园结义', '牛刀小试', '铜台锁梦',
  '翩若惊鸿', '山海风云', '故地重游', '巧借东风', '皇榜征兵',
  '杜康解忧', '天下归心', '十八诸侯', '云骑长歌', '三足鼎立',
  '一代枭雄', '暗度陈仓', '单刀赴会', '抚琴退敌', '诗酒江陵',
  '百骑劫营', '威震江东', '一生所爱', '青梅拾酒',
]

const URL_TEMPLATE = 'https://uland.taobao.com/sem/tbsearch?bc_fl_src=tbsite_NOX36458&bd_vid=5173466194438421211&channelSrp=baiduSomama&clk1=d2811325e6aa361664c1b36ed00800d7&commend=all&ie=utf8&initiative_id=tbindexz_20170306&keyword=KW&localImgKey=&page=1&preLoadOrigin=https%3A%2F%2Fwww.taobao.com&q=KW&refpid=mm_26632258_3504122_32538762&search_type=item&sourceId=tb.index&spm=tbpc.pc_sem_alimama%2Fa.search_manual.0&ssid=s5-e&tab=all'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

// 持久化分区：用户手动登录淘宝一次后 Cookie 长期保留，价格明文可见
const TAOBAO_PARTITION = 'persist:taobao'

function buildUrl(serverName: string): string {
  const kw = `qq三国${serverName}游戏币`
  return URL_TEMPLATE.replace(/KW/g, encodeURIComponent(kw))
}

export type ScrapeResult = { rate: number | null; needLogin: boolean }

/*
 * 页内提取脚本（双路径，兼容淘宝多套页面布局）：
 * A. 新版布局：[class*="priceInt"] 价格元素，逐个关联所在商品卡。
 * B. 旧版布局：没有 priceInt 元素，价格是「¥」附近的纯数字文本节点，
 *    从数字节点向上找价格容器（含¥）→ 再向上找含三国币关键词的小卡片。
 * 卡片必须含 QQ三国/三国币/游戏币 关键词（排除「猜你喜欢」推荐流）；
 * 只采纳搜索结果按顺序的前 MAX_CARDS(10) 张有效卡片——淘宝按相关性排序，
 * 深处卡片多为虚高挂牌/钓鱼牌（如 666/888），不允许进入候选池；
 * 打码页（文本为 '?'）直接标记 masked，绝不全文兜底抓数字。
 */
const EXTRACT_SCRIPT = `
  (function() {
    var items = []
    var maskedCount = 0
    var junkCount = 0
    var seen = {}
    var MAX_CARDS = 10

    function pushItem(price, title) {
      var key = price + '|' + title.slice(0, 60)
      if (seen[key]) return
      seen[key] = 1
      items.push({ price: price, title: title })
    }

    // A. priceInt 路径（querySelectorAll 本身按 DOM 顺序返回，即搜索结果排序）
    var intEls = document.querySelectorAll('[class*="priceInt"]')
    for (var i = 0; i < intEls.length && items.length < MAX_CARDS; i++) {
      var intEl = intEls[i]
      var text = (intEl.textContent || '').replace(/\\s+/g, '')
      var wrap = intEl.closest('[class*="priceWrapper"]') || intEl.parentElement
      var card = intEl.closest('li') || intEl.closest('[class*="card"], [class*="item"], [class*="Card"], [class*="Item"]')
      var title = ''
      if (card) {
        var tEl = card.querySelector('[class*="title"], [class*="Title"]')
        title = ((tEl && tEl.textContent) || card.textContent || '').replace(/\\s+/g, ' ').slice(0, 200)
      } else if (wrap && wrap.parentElement) {
        title = (wrap.parentElement.textContent || '').replace(/\\s+/g, ' ').slice(0, 200)
      }
      if (text.indexOf('?') !== -1 || text.indexOf('？') !== -1) { maskedCount++; continue }
      var m = text.match(/(\\d+(?:\\.\\d+)?)/)
      if (!m) continue
      // 卡片自身必须含三国币关键词：排除搜索页底部「猜你喜欢」推荐流的无关商品价格
      var cardText = ((card && card.textContent) || (wrap && wrap.parentElement && wrap.parentElement.textContent) || '')
      if (!/QQ三国|三国币|游戏币/.test(cardText)) { junkCount++; continue }
      pushItem(parseFloat(m[1]), title)
    }

    // B. 旧版布局兜底：无 priceInt 元素且未打码时，扫描「¥ 附近的纯数字」文本节点
    if (items.length === 0 && maskedCount === 0) {
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      var node
      var numRe = /^\\s*[¥￥]?\\s*(\\d{1,4}(?:\\.\\d{1,2})?)\\s*$/
      while ((node = walker.nextNode()) && items.length < MAX_CARDS) {
        var t = node.textContent || ''
        var nm = t.match(numRe)
        if (!nm) continue
        var price = parseFloat(nm[1])
        if (!(price >= 5 && price <= 2000)) continue
        // 向上找价格容器（含 ¥ 符号，文本很短）
        var el = node.parentElement, priceBox = null
        for (var lv = 0; el && lv < 4; lv++) {
          var ptxt = (el.textContent || '').replace(/\\s+/g, '')
          if (ptxt.indexOf('¥') !== -1 || ptxt.indexOf('￥') !== -1) { priceBox = el; break }
          el = el.parentElement
        }
        if (!priceBox) continue
        // 再向上找含三国币关键词的小卡片（限长，防止命中整页容器导致张冠李戴）
        var cur = priceBox, card2 = null
        for (var lv2 = 0; cur && lv2 < 8; lv2++) {
          var ctxt = cur.textContent || ''
          if (/QQ三国|三国币|游戏币/.test(ctxt) && ctxt.length < 600) { card2 = cur; break }
          cur = cur.parentElement
        }
        if (!card2) { junkCount++; continue }
        var tEl2 = card2.querySelector('[class*="title"], [class*="Title"]')
        var title2 = ((tEl2 && tEl2.textContent) || card2.textContent || '').replace(/\\s+/g, ' ').slice(0, 200)
        pushItem(price, title2)
      }
    }

    // hasCards：页面上确实是搜索结果页（含QQ三国/游戏币商品），用于区分「打码」和「页面异常」
    var body = (document.body && document.body.innerText) || ''
    var hasCards = /QQ三国|三国币|游戏币/.test(body) ? 1 : 0
    return { masked: maskedCount > 0 && items.length === 0, maskedCount: maskedCount, hasCards: hasCards, junkCount: junkCount, items: items }
  })()
`

type ExtractResult = { masked: boolean; maskedCount: number; hasCards?: number; junkCount?: number; items: ExtractedItem[] }

function scrapeWithBrowser(url: string): Promise<ExtractResult | null> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 800, height: 600, show: false,
      webPreferences: {
        nodeIntegration: false, contextIsolation: true,
        partition: TAOBAO_PARTITION, // 持久化分区：登录态跨会话保留
      },
    })

    const timeout = setTimeout(() => {
      try { win.destroy() } catch { /* ignore */ }
      resolve(null)
    }, 20000)

    win.loadURL(url, { userAgent: UA })

    win.webContents.on('did-finish-load', async () => {
      // 固定 3s + 轮询兜底：结果列表渲染慢的机器上 3s 可能拿到空页（沙箱实测），
      // 最多再等 10s 直到出现价格元素（打码页也有 priceInt 元素，不阻碍探测）
      const probe = `document.querySelectorAll('[class*="priceInt"]').length`
      for (let t = 0; t < 20; t++) {
        await new Promise(r => setTimeout(r, 500))
        try {
          const n = await win.webContents.executeJavaScript(probe)
          if (n > 0) break
        } catch { break }
      }
      try {
        const result = await win.webContents.executeJavaScript(EXTRACT_SCRIPT)
        clearTimeout(timeout)
        try { win.destroy() } catch {}
        resolve(result && typeof result === 'object' ? result as ExtractResult : null)
      } catch {
        clearTimeout(timeout)
        try { win.destroy() } catch {}
        resolve(null)
      }
    })

    win.webContents.on('did-fail-load', (_e, _code, _desc, _url, isMain) => {
      if (!isMain) return
      clearTimeout(timeout)
      try { win.destroy() } catch {}
      resolve(null)
    })
  })
}

/* ── 单个抓取 ── */

function readLastRate(serverName: string): number | null {
  try {
    const row = getDatabase().prepare('SELECT currency_rate FROM servers WHERE name=?').get(serverName) as { currency_rate: number | null } | undefined
    const rate = row?.currency_rate ?? null
    // 旧引擎垃圾值（100/123 等）出界，不作为时序保护参考，等于无历史
    return rate !== null && rate >= RATE_MIN && rate <= RATE_MAX ? rate : null
  } catch {
    return null
  }
}

function savePrice(serverName: string, price: number) {
  const db = getDatabase()
  db.prepare('UPDATE servers SET currency_rate=? WHERE name=?').run(price, serverName)
  const srv = db.prepare('SELECT id FROM servers WHERE name=?').get(serverName) as { id: number } | undefined
  if (srv) db.prepare('INSERT INTO currency_rate_history (server_id, rate) VALUES (?,?)').run(srv.id, price)
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
    // 旧版提取器的已知噪声值（店铺名"123牌金币"/大促 618/标题规格 100/1000）不作为缓存，
    // 强制重抓以触发打码检测（登录提示）
    if ([100, 123, 618, 1000].includes(row.rate)) return null
    const recordedAt = new Date(row.recorded_at.replace(' ', 'T')).getTime()
    const elapsed = Date.now() - recordedAt
    if (elapsed > 0 && elapsed < 3 * 60 * 60 * 1000) {
      return row.rate
    }
  } catch { /* fall through */ }
  return null
}

export async function scrapeOneServer(serverName: string, force = false): Promise<ScrapeResult> {
  if (!force) {
    const cached = getRecentPriceIfFresh(serverName)
    if (cached !== null) {
      console.log(`[币价抓取] ${serverName} -> 未重抓（3 小时内已抓取过）`)
      return { rate: cached, needLogin: false }
    }
  }

  const url = buildUrl(serverName)
  console.log(`[币价抓取] ${serverName} -> 抓取中...`)
  const extracted = await scrapeWithBrowser(url)
  if (!extracted) {
    console.log(`[币价抓取] ${serverName} -> 没获取到（页面加载失败）`)
    return { rate: null, needLogin: false }
  }

  // 打码判定：价格元素全是 '?'；或结果页商品都在但一个可读价格都没有（同为反爬变体页）
  const looksMasked = extracted.masked || ((extracted.hasCards ?? 0) > 0 && extracted.items.length === 0)
  if (looksMasked) {
    // 淘宝对未登录会话打码价格：不再兜底猜测，明确提示需要登录
    console.log(`[币价抓取] ${serverName} -> 没获取到（被反爬打码，可登录淘宝后重试）`)
    return { rate: null, needLogin: true }
  }

  const lastRate = readLastRate(serverName)
  const detail = analyzeRates(extracted.items, serverName, lastRate)
  if (detail.rate !== null) {
    savePrice(serverName, detail.rate)
    // 采样日志：币价对不上时，看采纳样本即可定位是哪些报价算出来的
    const pool = detail.primaryFactor !== null
      ? detail.accepted.filter(a => a.factor === detail.primaryFactor)
      : detail.accepted
    const samples = pool.slice(0, 10)
      .map(a => `${a.title.slice(0, 40)}… ¥${a.price}×${a.factor}=${a.rate}`)
      .join(' | ')
    const ev = detail.evidence
    const histTag = lastRate !== null ? (ev.history ? `历史√(${lastRate})` : '历史×') : '历史-'
    const evStr = `低簇${ev.lowCluster ? '√' : '×'} 跨档${ev.crossBin ? '√' : '×'} ${histTag}`
    console.log(`[币价抓取] ${serverName} -> ${detail.rate} 元/亿` +
      `（采纳 ${detail.stats.accepted}/${detail.stats.total}，它区 ${detail.stats.noServer}，非币类 ${detail.stats.nonCoin}，无单位 ${detail.stats.noUnit}，出界 ${detail.stats.outOfRange}，1E直读档 ${detail.stats.yiPrimary}${detail.useYi ? '主档' : ''}，推荐流噪声 ${extracted.junkCount ?? 0}；${evStr}）`)
    if (samples) console.log(`[币价抓取]   采样: ${samples}`)
    if (detail.clusters.length > 1) {
      console.log('[币价抓取]   簇判定: ' + detail.clusters
        .map(c => `${c.anchor}(×${c.members})${c.verdict}`)
        .join(' -> '))
    }
  } else {
    const ev = detail.evidence
    const clusterStr = detail.clusters.length
      ? `；簇判定: ${detail.clusters.map(c => `${c.anchor}(×${c.members})${c.verdict}`).join(' -> ')}`
      : ''
    console.log(`[币价抓取] ${serverName} -> 没获取到（无标题命中本区的可信报价，宁缺毋滥；总数 ${detail.stats.total}，它区 ${detail.stats.noServer}，非币类 ${detail.stats.nonCoin}，无单位 ${detail.stats.noUnit}，出界 ${detail.stats.outOfRange}${clusterStr}）`)
  }
  return { rate: detail.rate, needLogin: false }
}

/* ── 批量抓取：当前大区优先 ── */

let pendingServer = ''

export function setPriorityServer(name: string) {
  pendingServer = name
}

export async function scrapeAllRates(force = false): Promise<{ updated: number; failed: number; currentPrice: number | null; needLogin: boolean }> {
  const current = pendingServer || SERVERS[0]
  let updated = 0; let failed = 0; let currentPrice: number | null = null

  console.log('[币价抓取] 开始批量抓取（v4: 底部锚定+跨档互证+时序保护）')

  // 1. 当前大区先抓
  const first = await scrapeOneServer(current, force)
  currentPrice = first.rate
  first.rate !== null ? updated++ : failed++

  // 2. 价格被打码说明未登录淘宝，其余大区同样会被打码，整批短路
  if (first.needLogin) {
    console.log('[币价抓取] 淘宝价格打码（需登录），本次跳过其余大区')
    return { updated, failed, currentPrice, needLogin: true }
  }

  // 3. 其他大区后台异步
  const others = SERVERS.filter(s => s !== current)
  ;(async () => {
    for (let i = 0; i < others.length; i++) {
      const r = await scrapeOneServer(others[i], force)
      if (r.needLogin) {
        console.log(`[币价抓取] ${others[i]} -> 没获取到（被反爬打码），中止后台批次`)
        break
      }
      await new Promise(r2 => setTimeout(r2, 2000))
    }
    console.log('[币价抓取] 后台完成')
  })()

  return { updated, failed, currentPrice, needLogin: false }
}

/* ── 登录淘宝（Cookie 持久化到 TAOBAO_PARTITION） ── */

let loginWin: BrowserWindow | null = null

export function openTaobaoLogin(): void {
  if (loginWin && !loginWin.isDestroyed()) {
    loginWin.focus()
    return
  }
  loginWin = new BrowserWindow({
    width: 1100, height: 800, show: true,
    title: '登录淘宝（登录一次即可自动获取币价）',
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      partition: TAOBAO_PARTITION,
    },
  })
  loginWin.loadURL('https://login.taobao.com/member/login.jhtml', { userAgent: UA })
  loginWin.on('closed', () => { loginWin = null })
}

export function isTaobaoLoggedIn(): Promise<boolean> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 800, height: 600, show: false,
      webPreferences: {
        nodeIntegration: false, contextIsolation: true,
        partition: TAOBAO_PARTITION,
      },
    })
    const done = (v: boolean) => { try { win.destroy() } catch {}; resolve(v) }
    const timeout = setTimeout(() => done(false), 15000)
    win.loadURL('https://www.taobao.com/', { userAgent: UA })
      .then(async () => {
        await new Promise(r => setTimeout(r, 2500))
        try {
          const nick = await win.webContents.executeJavaScript(`
            (function() {
              var el = document.querySelector('.site-nav-login-info-nick, [class*="nick"]')
              return el ? (el.textContent || '').trim() : ''
            })()
          `)
          clearTimeout(timeout)
          done(!!nick)
        } catch { clearTimeout(timeout); done(false) }
      })
      .catch(() => { clearTimeout(timeout); done(false) })
  })
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
