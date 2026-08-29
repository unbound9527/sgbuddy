import { BrowserWindow } from 'electron'
import { getDatabase } from '../database'

// ── 常量 ──

// 区服 → 贴吧名映射（天下归心、一生所爱、青梅拾酒 无对应贴吧）
const TIEBA_MAP: Record<string, string> = {
  '得陇望蜀': '得陇望蜀吧', '群雄逐鹿': '三国群雄逐鹿吧', '桃园结义': '桃园结义吧',
  '牛刀小试': '牛刀小试吧', '铜台锁梦': '铜台锁梦吧', '翩若惊鸿': '翩若惊鸿吧',
  '山海风云': '山海风云吧', '故地重游': '故地重游吧', '巧借东风': '巧借东风吧',
  '皇榜征兵': '皇榜征兵吧', '杜康解忧': '杜康解忧吧',
  '十八诸侯': '十八诸侯吧', '云骑长歌': '云骑长歌吧', '三足鼎立': '三足鼎立吧',
  '一代枭雄': '一代枭雄吧', '暗度陈仓': '暗度陈仓吧', '单刀赴会': '单刀赴会吧',
  '抚琴退敌': '抚琴退敌吧', '诗酒江陵': '诗酒江陵吧', '百骑劫营': '百骑劫营吧',
  '威震江东': '威震江东吧',
}

function getTiebaName(serverName: string): string | null {
  return TIEBA_MAP[serverName] || null
}

interface ClueItem {
  source: string
  keyword: string
  title: string
  content_preview: string
  url: string
  author_name: string
  price_text: string
  posted_at: string
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

// ── BrowserWindow 复用加载器 ──

let scrapeWin: BrowserWindow | null = null

function getScrapeWin(): BrowserWindow {
  if (scrapeWin && !scrapeWin.isDestroyed()) return scrapeWin
  scrapeWin = new BrowserWindow({
    width: 1024, height: 768, show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })
  return scrapeWin
}

function loadAndExtract(url: string, jsExtract: string, timeout = 15000): Promise<any> {
  const win = getScrapeWin()
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeout)

    win.webContents.once('did-fail-load', () => { clearTimeout(timer); resolve(null) })

    const onFinish = async () => {
      await new Promise(r => setTimeout(r, 3000))
      try {
        const result = await win.webContents.executeJavaScript(jsExtract)
        clearTimeout(timer)
        resolve(result)
      } catch {
        clearTimeout(timer)
        resolve(null)
      }
    }
    win.webContents.once('did-finish-load', onFinish)

    win.loadURL(url, { userAgent: UA }).catch(() => { clearTimeout(timer); resolve(null) })
  })
}

// ── 贴吧抓取 ──
// 新版贴吧 (Vue 渲染) — 帖子数据在 <a> 链接的 textContent 中串联呈现
// 交易帖特征: "交易贴 |" 前缀、"出"/"明盘出"/"一口价" 等关键词
// 过滤: 置顶帖、广告、骗子曝光/攻略/交友区帖子

async function scrapeTieba(serverName: string): Promise<ClueItem[]> {
  const tiebaName = getTiebaName(serverName)
  if (!tiebaName) return [] // 该区服无对应贴吧
  const baseUrl = `https://tieba.baidu.com/f?kw=${encodeURIComponent(tiebaName)}&ie=utf-8`

  const extractJs = `
    (function() {
      var results = [];
      var seen = {};

      // 新版贴吧: 所有帖子链接都是 <a href="/p/[id]?fr=frs">
      var links = document.querySelectorAll('a[href*="tieba.baidu.com/p/"]');
      if (!links.length) links = document.querySelectorAll('a[href*="/p/"]');

      for (var i = 0; i < links.length; i++) {
        var a = links[i];
        var href = a.getAttribute('href') || '';
        var pid = href.match(/\\/p\\/(\\d+)/);
        if (!pid) continue;
        var pidStr = pid[1];
        if (seen[pidStr]) continue;
        seen[pidStr] = true;

        var text = (a.textContent || '').trim();
        if (text.length < 10) continue;

        // 过滤置顶/广告
        if (text.indexOf('置顶') === 0) continue;
        if (text.indexOf('广告') !== -1 && text.indexOf('查看') !== -1) continue;
        if (text.indexOf('天尊传奇') !== -1) continue;

        // 拆分作者/时间/标题
        var replyRe = /回复于(\\S+?)(?:\\s|$)/;
        var replyMatch = text.match(replyRe);
        var author = '', postedAt = '', title = text;

        if (replyMatch) {
          postedAt = replyMatch[1];
          var idx = replyMatch.index;
          var before = text.slice(0, idx).trim();
          // 去除非作者噪音
          before = before.replace(/贴吧成长等级.*$/, '').trim();
          before = before.replace(/本吧头衔\\s*\\S*$/, '').trim();
          author = before;
          title = text.slice(idx + replyMatch[0].length).trim();
        }

        if (!title || title.length < 3) continue;

        // 交易判断：标题包含指定关键词
        var tradeKw = title.match(/出|卖|甩|退坑|弃坑|脱坑|清仓|低价|急出|便宜|甩卖|代价/);
        if (!tradeKw) continue;

        // 价格提取
        var price = '';
        var pm = title.match(/(\\d+[\\.\\d]{1,2})\\s*[亿eE]/);
        if (!pm) pm = title.match(/一口价\\s*(\\d+[\\.\\d]*)/);
        if (pm) price = pm[1];

        var cleanUrl = 'https://tieba.baidu.com/p/' + pidStr;
        results.push({
          title: title.slice(0, 200),
          url: cleanUrl,
          author_name: author.slice(0, 30),
          posted_at: postedAt,
          price_text: price,
          keyword: tradeKw[0],
          content_preview: title.slice(0, 200),
          source: 'tieba'
        });

        if (results.length >= 30) break;
      }

      // 如果链接提取为空, 回退全文扫描
      if (results.length === 0) {
        var body = document.body?.innerText || '';
        var kws = ['甩卖', '退坑', '弃坑', '脱坑', '清仓', '急出', '甩卖', '低价', '便宜', '代价', '出', '卖', '甩'];
        for (var k = 0; k < kws.length; k++) {
          var kw = kws[k];
          var idx = body.indexOf(kw);
          while (idx !== -1) {
            var start = Math.max(0, idx - 20);
            var end = Math.min(body.length, idx + 150);
            var snippet = body.slice(start, end).replace(/\\s+/g, ' ').trim();
            if (/出|卖|甩|退坑|弃坑|脱坑|清仓|低价|急出|便宜|甩卖|代价/.test(snippet) && snippet.length > 5) {
              results.push({
                title: snippet.slice(0, 200),
                url: window.location.href,
                author_name: '',
                posted_at: '',
                price_text: '',
                keyword: kw,
                content_preview: snippet.slice(0, 200),
                source: 'tieba'
              });
            }
            if (results.length >= 15) break;
            idx = body.indexOf(kw, idx + 1);
          }
          if (results.length >= 15) break;
        }
      }

      return results;
    })()
  `

  // 优先抓交易贴专区 (tab=37695)，再补抓主页
  const results1 = await loadAndExtract(`${baseUrl}&tab=37695`, extractJs, 15000)
  const clues1 = (results1 || []) as ClueItem[]

  if (clues1.length >= 15) return clues1

  const results2 = await loadAndExtract(baseUrl, extractJs, 15000)
  const clues2 = (results2 || []) as ClueItem[]

  // 按帖子ID去重
  const seen = new Set<string>()
  const merged: ClueItem[] = []
  for (const c of [...clues1, ...clues2]) {
    const pid = c.url.match(/\/p\/(\d+)/)?.[1] || c.url
    if (!seen.has(pid)) { seen.add(pid); merged.push(c) }
  }
  return merged.slice(0, 30)
}

// ── 入库 ──

function saveClues(clues: ClueItem[], serverName: string): number {
  const db = getDatabase()
  const insert = db.prepare(`
    INSERT OR IGNORE INTO trade_clues
      (server_name, source, keyword, title, content_preview, url, author_name, price_text, posted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  let added = 0
  const tx = db.transaction(() => {
    for (const c of clues) {
      const r = insert.run(
        serverName, c.source, c.keyword, c.title, c.content_preview || '',
        c.url, c.author_name || '', c.price_text || '', c.posted_at || ''
      )
      if (r.changes > 0) added++
    }
  })
  tx()
  return added
}

// ── 主入口 ──

export async function scrapeAll(
  serverName: string,
  onProgress?: (source: string, done: number, total: number) => void
): Promise<{ added: number; errors: string[] }> {
  const errors: string[] = []
  let totalAdded = 0
  const sources = [
    { name: 'tieba', fn: () => scrapeTieba(serverName) },
  ]

  for (let i = 0; i < sources.length; i++) {
    const s = sources[i]
    onProgress?.(s.name, i, sources.length)
    try {
      const clues = await s.fn()
      if (clues.length > 0) {
        totalAdded += saveClues(clues, serverName)
      }
    } catch (e: any) {
      errors.push(`${s.name}: ${e.message}`)
    }
    // 来源之间间隔 2 秒
    await new Promise(r => setTimeout(r, 2000))
  }

  onProgress?.('done', sources.length, sources.length)
  return { added: totalAdded, errors }
}

// ── 定时调度 ──

let currentServer = ''
let clueTimer: ReturnType<typeof setInterval> | null = null

export function setClueServer(name: string) {
  currentServer = name
}

export function startClueScheduler(onProgress?: (source: string, done: number, total: number) => void) {
  if (clueTimer) clearInterval(clueTimer)
  clueTimer = setInterval(() => {
    if (currentServer) {
      console.log('[线索抓取] 定时任务:', currentServer)
      scrapeAll(currentServer, onProgress).then(
        r => console.log(`[线索抓取] 完成: +${r.added} 条`)
      )
    }
  }, 30 * 60 * 1000) // 30 分钟
}

export function stopClueScheduler() {
  if (clueTimer) { clearInterval(clueTimer); clueTimer = null }
}
