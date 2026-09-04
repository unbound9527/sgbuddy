import { BrowserWindow } from 'electron'
import { getDatabase } from '../database'

// ── 常量 ──

// 区服 → 贴吧名映射；无对应贴吧的区服显式映射为 null（单一数据源，前端经 IPC 读取，勿再硬编码）
// null 表示该区服没有对应贴吧：抓取时静默跳过，并可在 UI 上提示。
export const TIEBA_MAP: Record<string, string | null> = {
  '得陇望蜀': '得陇望蜀吧', '群雄逐鹿': '三国群雄逐鹿吧', '桃园结义': '桃园结义吧',
  '牛刀小试': '牛刀小试吧', '铜台锁梦': '铜台锁梦吧', '翩若惊鸿': '翩若惊鸿吧',
  '山海风云': '山海风云吧', '故地重游': '故地重游吧', '巧借东风': '巧借东风吧',
  '皇榜征兵': '皇榜征兵吧', '杜康解忧': '杜康解忧吧',
  '十八诸侯': '十八诸侯吧', '云骑长歌': '云骑长歌吧', '三足鼎立': '三足鼎立吧',
  '一代枭雄': '一代枭雄吧', '暗度陈仓': '暗度陈仓吧', '单刀赴会': '单刀赴会吧',
  '抚琴退敌': '抚琴退敌吧', '诗酒江陵': '诗酒江陵吧', '百骑劫营': '百骑劫营吧',
  '威震江东': '威震江东吧',
  '天下归心': null, '一生所爱': null, '青梅拾酒': null,
}

/** 是否有对应贴吧 */
export function hasTieba(serverName: string): boolean {
  return !!getTiebaName(serverName)
}

/** 返回贴吧名；无贴吧时返回 null */
export function getTiebaName(serverName: string): string | null {
  const v = TIEBA_MAP[serverName]
  return v || null // 未登记视为无贴吧
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
  posted_at_abs: string
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

// ── 时间工具 ──
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** 相对文案("x小时前"/"昨天"/"x天前"/"刚刚") → 绝对时间；无法解析返回 '' */
export function parsePostedAbs(posted: string, now = Date.now()): string {
  if (!posted) return ''
  const t = /^(\d+)\s*秒前/.exec(posted)
  if (t) return toLocalStr(new Date(now - Number(t[1]) * 1000))
  const m = /^(\d+)\s*分钟前/.exec(posted)
  if (m) return toLocalStr(new Date(now - Number(m[1]) * 60 * 1000))
  const h = /^(\d+)\s*小时前/.exec(posted)
  if (h) return toLocalStr(new Date(now - Number(h[1]) * 3600 * 1000))
  if (/昨天/.test(posted)) {
    const d = new Date(now); d.setDate(d.getDate() - 1); return toLocalStr(d)
  }
  const day = /^(\d+)\s*天前/.exec(posted)
  if (day) { const d = new Date(now); d.setDate(d.getDate() - Number(day[1])); return toLocalStr(d) }
  if (/刚刚|现在/.test(posted)) return toLocalStr(new Date(now))
  // 形如 "09-03" / "2026-9-3 12:00" 的绝对格式
  const abs = /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(posted)
  if (abs) {
    const time = /\s(\d{1,2}):(\d{2})/.exec(posted)
    const d = new Date(Number(abs[1]), Number(abs[2]) - 1, Number(abs[3]),
      time ? Number(time[1]) : 0, time ? Number(time[2]) : 0)
    return toLocalStr(d)
  }
  const md = /(\d{1,2})[-/](\d{1,2})/.exec(posted)
  if (md) {
    const nowD = new Date(now)
    const time = /\s(\d{1,2}):(\d{2})/.exec(posted)
    const d = new Date(nowD.getFullYear(), Number(md[1]) - 1, Number(md[2]),
      time ? Number(time[1]) : 0, time ? Number(time[2]) : 0)
    return toLocalStr(d)
  }
  return ''
}

/** 转成本地 yyyy-MM-dd HH:mm:ss */
function toLocalStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

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

/**
 * 打开 url，等 DOM 就绪后执行 jsExtract 并返回结果。
 * - 事件监听存局部变量，成功/失败/超时统一清理，杜绝跨轮泄漏。
 * - 用 dom-ready（DOM 解析完即触发，比 did-finish-load 早且对 SPA/验证页更可靠）
 *   触发，随后轮询「帖子链接数稳定」替代固定 sleep：更快且避免水合未完成时抓空。
 *   若 dom-ready 一直不来（连不上/无限重定向），由外部 timeout 兜底，不会永久卡住。
 */
/** 单次页面抓取的诊断信息，用于「0 条却不知为何」时给前端/日志透传真实原因 */
export interface LoadMeta {
  url: string
  title: string        // 页面 <title>
  wall: boolean        // 是否被反爬验证墙拦下
  wallMsg: string      // 命中验证墙的说明（wall=true 时有值）
  ready: boolean       // 帖子链接是否达到稳定可见
  maxSeen: number      // 轮询中观察到的最多帖子链接数
  extractCount: number // 实际提取出的线索数
  err?: string         // 偶发错误说明
  diag?: string[]      // 调试 dump（SGB_CLUE_DEBUG=1 时，展示候选链接结构与过滤原因）
}

const WALL_RE = /安全验证|人机验证|验证码|访问验证|wappass|verify|百度安全/i
const WALL_BODY_RE = /百度安全验证|安全验证|请完成验证|拖动滑块|验证后才能继续|网络环境异常/i

function emptyMeta(url: string): LoadMeta {
  return { url, title: '', wall: false, wallMsg: '', ready: false, maxSeen: 0, extractCount: 0 }
}

function loadAndExtract(url: string, jsExtract: string, timeout = 15000, diagJs?: string): Promise<{ clues: ClueItem[]; meta: LoadMeta }> {
  const win = getScrapeWin()
  return new Promise((resolve, reject) => {
    const meta = emptyMeta(url)
    let settled = false
    let timer: ReturnType<typeof setTimeout>
    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      fn()
    }
    const resolveOk = (clues: ClueItem[], m: LoadMeta) => settle(() => resolve({ clues, meta: m }))
    const rejectErr = (e: any) => settle(() => reject(e instanceof Error ? e : new Error(String(e))))
    const cleanup = () => {
      clearTimeout(timer)
      win.webContents.removeListener('dom-ready', onReady)
      win.webContents.removeListener('did-finish-load', onReady)
      win.webContents.removeListener('did-fail-load', onFail)
    }
    timer = setTimeout(() => { console.log(`[线索抓取] ⏱ 页面超时 ${timeout}ms: ${url.slice(0, 70)}`); resolveOk([], meta) }, timeout)

    async function onReady() {
      try {
        // 读 title + 少量正文：判断是否为反爬验证墙（不只看标题，Baidu 的墙页多样）
        const snap: any = await win.webContents.executeJavaScript(
          `(function(){var t=document.title||'';var b=(document.body?document.body.innerText||'':'')||'';return {title:t,body:b.slice(0,300)};})()`
        ).catch(() => ({ title: '', body: '' }))
        const title = String(snap?.title || '')
        const body = String(snap?.body || '')
        meta.title = title
        console.log(`[线索抓取] 页面标题: ${JSON.stringify(title.slice(0, 50))} url=${url.slice(0, 70)}`)

        if (WALL_RE.test(title) || WALL_BODY_RE.test(body)) {
          meta.wall = true
          meta.wallMsg = '贴吧触发了安全验证（反爬拦截），点「去通过验证」在弹窗里过一次滑块后重试'
          console.log(`[线索抓取] ⛔ 被安全验证拦截 url=${url.slice(0, 70)} title=${JSON.stringify(title.slice(0, 40))}`)
          resolveOk([], meta) // 墙视为「本轮无结果 + wall 标记」，不再抛错，交由前端展示提示
          return
        }

        const probe = `(function(){var n=0;var l=document.querySelectorAll('a[href*="tieba.baidu.com/p/"],a[href*="/p/"]');for(var i=0;i<l.length;i++){var h=l[i].getAttribute('href')||'';if(/\\/p\\/\\d+/.test(h)&&(l[i].textContent||'').trim().length>=3)n++;}return n;})()`
        // 贴吧列表是异步分批渲染的：若帖子数在一两秒内只短暂稳定（如先出现 1~2 条），不能据此判定就绪，
        // 否则会过早 extract，只抓到第一批的 1 条（现象即“每页只出 1 条”）。
        // 正确判据：帖子数「停止增长达 2.5s」才认为渲染完成；有大量帖子（>=20）可提前放行；硬上限 14s 兜底。
        const t0 = Date.now()
        let lastGrowth = 0, prev = -1, maxSeen = 0
        let ready = false
        const MAX_POLL = 14000
        const GROW_WAIT = 2500
        while (Date.now() - t0 < MAX_POLL) {
          let c = 0
          try { c = await win.webContents.executeJavaScript(probe) } catch { break }
          if (c > maxSeen) maxSeen = c
          if (c > prev) lastGrowth = Date.now()  // 仍在增长 → 重置“稳定计时”
          prev = c
          if (maxSeen >= 20) { ready = true; break }          // 帖量足够大，直接判就绪
          if (Date.now() - lastGrowth > GROW_WAIT) { ready = true; break } // 已停止增长 2.5s
          await sleep(300)
        }
        meta.ready = ready
        meta.maxSeen = maxSeen
        console.log(`[线索抓取] 就绪 ready=${ready} maxSeen=${maxSeen} 耗时=${((Date.now() - t0) / 1000).toFixed(1)}s`)
        if (!ready) await sleep(1200)

        const result = await win.webContents.executeJavaScript(jsExtract)
        const clues = (Array.isArray(result) ? result : []) as ClueItem[]
        meta.extractCount = clues.length
        console.log(`[线索抓取] extract → ${clues.length} 条 url=${url.slice(0, 70)}`)
        // 诊断：结果过少/开启调试时，dump 候选链接结构帮助定位「为何只抓到这么少」
        if (diagJs && (clues.length <= 3 || process.env.SGB_CLUE_DEBUG)) {
          const d = await win.webContents.executeJavaScript(diagJs).catch(() => [])
          if (Array.isArray(d) && d.length) {
            meta.diag = (d as string[]).slice(0, 25)
            console.log('[线索抓取] 诊断候选:\n' + meta.diag.join('\n'))
          }
        }
        resolveOk(clues, meta)
      } catch (e: any) {
        console.log(`[线索抓取] extract 异常: ${e?.message} url=${url.slice(0, 70)}`)
        meta.err = String(e?.message || e)
        resolveOk([], meta) // executeJavaScript 偶发异常也归入「本轮 0 条 + 原因」，不静默吞掉
      }
    }
    function onFail(_e: any, code: number, desc: string, _url: string, isMainFrame: boolean) {
      console.log(`[线索抓取] did-fail-load code=${code} desc=${desc} main=${isMainFrame} url=${url.slice(0, 70)}`)
      if (code === -3 || code === -2) return // 正常导航取代，交给 onReady
      rejectErr(new Error(`页面加载失败 code=${code} ${desc}`.trim()))
    }

    win.webContents.once('dom-ready', onReady)
    win.webContents.once('did-finish-load', onReady)
    win.webContents.once('did-fail-load', onFail)
    console.log(`[线索抓取] ▶ 加载: ${url.slice(0, 70)}`)
    win.loadURL(url, { userAgent: UA }).catch((e) => { console.log(`[线索抓取] loadURL 异常: ${e?.message}`); rejectErr(e) })
  })
}

// ── 抓取脚本（贴吧内执行，需保持 ES5 兼容写法）──
// 交易判定策略：
//   - 强交易词（退坑/甩卖/卖号/…）单独即可判定。
//   - 仅命中单字「出/卖/甩」时，需额外出现价格或交易物件名词，避免
//     「出bug/出现闪退/帮忙看看输出/出现骗子」等噪音（这些没有价格也没有交易物件）。
// 价格表达：全称「亿/万」及其玩家缩写 e/E（亿）、w/W（万）都算单位。
//   例：1.5亿 / 30E(=30亿) / 165万 / 30w(=30万)。
//   price_text 存「数值 + 归一化单位后缀」，前端可直接展示量级。
//   注：不误吃常规文本里的 e/w——仅在紧邻数字后且位于「数字+单位」合法形态时识别。

const EXTRACT_JS = `
(function() {
  var strong = /退坑|弃坑|脱坑|清仓|甩卖|急出|明盘|低价|便宜|代价|白菜价|处理价|不玩了|退游|卖号|出号|出手/;
  var generic = /出|卖|甩/;
  var object = /号|装备|仓库|材料|资源|金币|东西|大号|小号|成号|元神|宝物|经验/;
  // 价格形态：数字(可选小数) + 单位(亿|万 或缩写 e/E=亿, w/W=万)
  var priceRe = /(\\d+(?:\\.\\d+)?)\\s*(亿|万|e|E|w|W)/;

  function normUnit(u) {
    if (u === 'e' || u === 'E') return '亿';
    if (u === 'w' || u === 'W') return '万';
    return u;
  }

  // 弱信号判据用「动词与价格直接相邻」精确形态，避免「输出到3e」这类把「出」和远处数字连坐误判
  //  price 动词： 1.5e出 / 12亿出 / 30W 卖（价格在前，动词紧后，允许空格）
  var verbAfterPrice = /(\\d+(?:\\.\\d+)?)\\s*(亿|万|e|E|w|W)\\s*(出|卖|甩)/;
  //  price 动词： 出个号 12e / 卖全套 20E（动词在前，价格紧后）——主要由物件分支覆盖，此处兜底短句
  var verbBeforePrice = /(出|卖|甩)\\s*(\\d+(?:\\.\\d+)?)\\s*(亿|万|e|E|w|W)/;

  function matchTrade(title) {
    var s = title.match(strong);
    if (s) return s[0];
    // 弱信号：只有单字 出/卖/甩。需满足「像一条售卖/出让帖」——
    //   a) 单字动词必须是独立交易动词，而非嵌在 输出/出现/出bug 这类普通词里；
    //   b) 价格(数字+单位，含 e/E=亿、w/W=万)与该动词直接相邻，或动词在标题开头且紧随可交易物件。
    var g = title.match(generic);
    if (!g) return null;
    var gi = g.index;
    if (verbAfterPrice.test(title) || verbBeforePrice.test(title)) return g[0];
    // 开头动词 + 紧随物件名词（动词后 0..8 字内出现交易物件），如「出个满级战士号」
    if (gi <= 2 && object.test(title.slice(gi, gi + 8))) return g[0];
    return null;
  }

  function matchPrice(title) {
    var m = title.match(priceRe);
    if (m) return m[1] + normUnit(m[2]);
    m = title.match(/一口价\\s*(\\d+(?:\\.\\d+)?)/);
    if (m) return m[1];
    return '';
  }

  var results = [];
  var seen = {};
  var links = document.querySelectorAll('a[href*="tieba.baidu.com/p/"]');
  if (!links.length) links = document.querySelectorAll('a[href*="/p/"]');

  for (var i = 0; i < links.length; i++) {
    var a = links[i];
    var href = a.getAttribute('href') || '';
    var pidM = href.match(/\\/p\\/(\\d+)/);
    if (!pidM) continue;
    var pid = pidM[1];
    if (seen[pid]) continue;
    seen[pid] = true;

    var raw = (a.textContent || '').replace(/\\s+/g, ' ').trim();
    if (raw.length < 10) continue;
    if (raw.indexOf('置顶') === 0) continue;
    if (raw.indexOf('广告') !== -1 && raw.indexOf('查看') !== -1) continue;
    if (raw.indexOf('天尊传奇') !== -1) continue;

    var author = '', postedAt = '', title = raw;
    var reply = raw.match(/回复于(\\S+?)(?:\\s|$)/);
    if (reply) {
      postedAt = reply[1];
      var idx = reply.index;
      var before = raw.slice(0, idx).trim();
      before = before.replace(/贴吧成长等级[^ ]*\\s*/, ' ').trim();
      before = before.replace(/本吧头衔\\s*\\S+\\s*/, ' ').trim();
      before = before.replace(/\\s+/g, ' ').trim();
      author = before;
      title = raw.slice(idx + reply[0].length).trim();
    }

    var kw = matchTrade(title);
    if (!kw) continue;

    results.push({
      title: title.slice(0, 200),
      url: 'https://tieba.baidu.com/p/' + pid,
      author_name: author.slice(0, 30),
      posted_at: postedAt,
      price_text: matchPrice(title),
      keyword: kw,
      content_preview: title.slice(0, 200),
      source: 'tieba'
    });
    if (results.length >= 30) break;
  }
  return results;
})()
`

// ── 诊断脚本（SGB_CLUE_DEBUG=1 或提取结果过少时执行）──
// 逐条输出候选 `/p/` 链接的 href + 文本前段 + 长度 + 交易词命中情况，用于定位「每页只抓 1 条」。
const DIAG_JS = `
(function() {
  var strong = /退坑|弃坑|脱坑|清仓|甩卖|急出|明盘|低价|便宜|代价|白菜价|处理价|不玩了|退游|卖号|出号|出手/;
  var generic = /出|卖|甩/;
  var links = document.querySelectorAll('a[href*="/p/"]');
  var out = []; var seen = {}; var i;
  for (i = 0; i < links.length; i++) {
    var a = links[i];
    var href = a.getAttribute('href') || '';
    var m = href.match(/\\/p\\/(\\d+)/);
    if (!m) continue;
    if (seen[m[1]]) continue; seen[m[1]] = true;
    var raw = (a.textContent || '').replace(/\\s+/g, ' ').trim();
    var hitStrong = strong.test(raw) ? '强:' + (raw.match(strong) || [''])[0] : '';
    var hitGeneric = generic.test(raw) ? '含出/卖/甩' : '';
    out.push('[' + m[1] + '] len=' + raw.length + ' href=' + href.slice(0, 60) + ' text="' + raw.slice(0, 50) + '" ' + hitStrong + ' ' + hitGeneric);
    if (out.length >= 30) break;
  }
  return out;
})()
`

async function scrapeTieba(serverName: string): Promise<{ clues: ClueItem[]; metas: LoadMeta[] }> {
  const tiebaName = getTiebaName(serverName)
  if (!tiebaName) return { clues: [], metas: [] }
  const baseUrl = `https://tieba.baidu.com/f?kw=${encodeURIComponent(tiebaName)}&ie=utf-8`

  const metas: LoadMeta[] = []
  // 优先交易贴专区 (tab=37695)，再补抓主页
  const r1 = await loadAndExtract(`${baseUrl}&tab=37695`, EXTRACT_JS, 15000, DIAG_JS)
  const clues1 = r1.clues
  metas.push(r1.meta)
  if (clues1.length >= 15) return { clues: clues1, metas }

  const r2 = await loadAndExtract(baseUrl, EXTRACT_JS, 15000, DIAG_JS)
  const clues2 = r2.clues
  metas.push(r2.meta)

  const seen = new Set<string>()
  const merged: ClueItem[] = []
  for (const c of [...clues1, ...clues2]) {
    const pid = c.url.match(/\/p\/(\d+)/)?.[1] || c.url
    if (!seen.has(pid)) { seen.add(pid); merged.push(c) }
  }
  return { clues: merged.slice(0, 30), metas }
}

// ── 入库（软删除墓碑不可见；靠 url 唯一键天然防「已删帖复活」）──

/** 新增成功后返回该行完整记录（含自增 id），供调用方逐条推送前端做流式展示 */
function saveClues(clues: ClueItem[], serverName: string): any[] {
  const db = getDatabase()
  const now = Date.now()
  const insert = db.prepare(`
    INSERT OR IGNORE INTO trade_clues
      (server_name, source, keyword, title, content_preview, url, author_name, price_text, posted_at, posted_at_abs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const fetchRow = db.prepare(`SELECT * FROM trade_clues WHERE id = ?`)

  const inserted: any[] = []
  const tx = db.transaction(() => {
    for (const c of clues) {
      const r = insert.run(
        serverName, c.source, c.keyword, c.title, c.content_preview || '',
        c.url, c.author_name || '', c.price_text || '', c.posted_at || '',
        c.posted_at_abs || parsePostedAbs(c.posted_at, now)
      )
      if (r.changes > 0) {
        const row = fetchRow.get(r.lastInsertRowid)
        if (row) inserted.push(row)
      }
    }
  })
  tx()
  return inserted
}

/** 软删除单条线索：置 deleted_at，使 load 不可见且刷新不会复活 */
export function deleteClueSoft(id: number): { ok: boolean; deleted: number } {
  const db = getDatabase()
  const r = db.prepare(`UPDATE trade_clues SET deleted_at = datetime('now','localtime'), status='deleted' WHERE id = ? AND deleted_at IS NULL`).run(id)
  return { ok: r.changes > 0, deleted: r.changes }
}

// ── 主入口（并发串行：用 Promise 链排队，防止定时与手动刷新共用窗口时互相打断）──

export interface ScrapeResult {
  added: number
  errors: string[]
  /** 本次抓取诊断，0 条/被拦时用于前端提示真实原因 */
  meta: {
    wall: boolean            // 是否被反爬验证墙拦
    wallMsg?: string
    triedTieba: boolean
    titles: string[]         // 观察到的页面标题
    pages: number            // 尝试加载了几页
    foundClues: number       // 抓取逻辑识别出多少条（未入库去重前）
    diag: string[]           // 候选链接诊断（结果少/调试时填充）
  }
}

let scrapeChain: Promise<any> = Promise.resolve()

export async function scrapeAll(
  serverName: string,
  onProgress?: (source: string, done: number, total: number) => void,
  onNewClue?: (row: any) => void
): Promise<ScrapeResult> {
  const task = () => scrapeAllInner(serverName, onProgress, onNewClue)
  const result = await (scrapeChain = scrapeChain.then(task, task))
  return result
}

async function scrapeAllInner(
  serverName: string,
  onProgress?: (source: string, done: number, total: number) => void,
  onNewClue?: (row: any) => void
): Promise<ScrapeResult> {
  const errors: string[] = []
  const meta: ScrapeResult['meta'] = { wall: false, triedTieba: hasTieba(serverName), titles: [], pages: 0, foundClues: 0, diag: [] }
  let totalAdded = 0
  if (!hasTieba(serverName)) {
    onProgress?.('done', 1, 1)
    return { added: 0, errors: [], meta }
  }
  const sources = [
    { name: 'tieba', fn: () => scrapeTieba(serverName) },
  ]
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i]
    onProgress?.(s.name, i, sources.length)
    try {
      const { clues, metas } = await s.fn()
      for (const m of metas) {
        meta.pages++
        if (m.title) meta.titles.push(m.title.slice(0, 60))
        if (m.wall) { meta.wall = true; meta.wallMsg = m.wallMsg || '被反爬验证墙拦截' }
        if (m.err) errors.push(`${s.name}: ${m.err}`)
        if (m.diag && m.diag.length) meta.diag.push(...m.diag)
      }
      meta.foundClues += clues.length
      if (clues.length > 0) {
        const inserted = saveClues(clues, serverName)
        totalAdded += inserted.length
        // 逐条推送新线索，前端收到即上屏（仅手动刷新路径传了 onNewClue；定时调度不传则跳过）
        for (const row of inserted) onNewClue?.(row)
      }
    } catch (e: any) {
      errors.push(`${s.name}: ${e.message}`)
    }
    await sleep(2000)
  }
  onProgress?.('done', sources.length, sources.length)
  return { added: totalAdded, errors, meta }
}

// ── 反爬验证墙：手动过验证 ──

// 独立于 scrapeWin 的可见窗口：让用户手动过一次百度安全验证。
// 关键点：它与抓取窗口同用默认 session → cookie 共享且持久化到磁盘；
// 用户拖动滑块通过后，后续后台/手动抓取复用这份已验证会话，不再被拦。
// 用独立窗口而非复用 scrapeWin，避免用户正在过验证时被并行抓取的 loadURL 打断。
let wallVerifyWin: BrowserWindow | null = null

/**
 * 打开（或聚焦）一个可见窗口加载 tieba 列表页，供用户手动完成「百度安全验证」。
 * @param tiebaName 贴吧名，如「得陇望蜀吧」；用它拼列表地址。
 */
export function openWallVerifyWindow(tiebaName: string): void {
  const url = `https://tieba.baidu.com/f?kw=${encodeURIComponent(tiebaName)}&ie=utf-8`
  const load = () => { if (wallVerifyWin) wallVerifyWin.loadURL(url, { userAgent: UA }).catch(() => {}) }
  if (wallVerifyWin && !wallVerifyWin.isDestroyed()) {
    load()
    wallVerifyWin.show()
    wallVerifyWin.focus()
    return
  }
  wallVerifyWin = new BrowserWindow({
    width: 1120, height: 820, autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })
  load()
  wallVerifyWin.on('closed', () => { wallVerifyWin = null })
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
