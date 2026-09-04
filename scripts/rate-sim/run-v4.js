// v4 币价全大区沙箱实测：复刻生产链路（extract.js + currency-units.cjs）
// 用法：node_modules electron 运行，SGB_SIM_UD 指向登录态分区副本
//   env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron run-v4.js
const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

const units = require('./currency-units.cjs')
const EXTRACT_SCRIPT = fs.readFileSync(path.join(__dirname, 'extract.js'), 'utf8')

const SERVERS = [
  '得陇望蜀', '群雄逐鹿', '桃园结义', '牛刀小试', '铜台锁梦',
  '翩若惊鸿', '山海风云', '故地重游', '巧借东风', '皇榜征兵',
  '杜康解忧', '天下归心', '十八诸侯', '云骑长歌', '三足鼎立',
  '一代枭雄', '暗度陈仓', '单刀赴会', '抚琴退敌', '诗酒江陵',
  '百骑劫营', '威震江东', '一生所爱', '青梅拾酒',
]

const URL_TEMPLATE = 'https://uland.taobao.com/sem/tbsearch?bc_fl_src=tbsite_NOX36458&bd_vid=5173466194438421211&channelSrp=baiduSomama&clk1=d2811325e6aa361664c1b36ed00800d7&commend=all&ie=utf8&initiative_id=tbindexz_20170306&keyword=KW&localImgKey=&page=1&preLoadOrigin=https%3A%2F%2Fwww.taobao.com&q=KW&refpid=mm_26632258_3504122_32538762&search_type=item&sourceId=tb.index&spm=tbpc.pc_sem_alimama%2Fa.search_manual.0&ssid=s5-e&tab=all'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

function buildUrl(serverName) {
  const kw = `qq三国${serverName}游戏币`
  return URL_TEMPLATE.replace(/KW/g, encodeURIComponent(kw))
}

function scrapeOne(serverName) {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 800, height: 600, show: false,
      webPreferences: {
        nodeIntegration: false, contextIsolation: true,
        partition: 'persist:taobao',
      },
    })
    const finish = (r) => { try { win.destroy() } catch {} ; resolve(r) }
    const timeout = setTimeout(() => finish({ error: 'timeout' }), 25000)
    win.loadURL(buildUrl(serverName), { userAgent: UA })
    win.webContents.on('did-finish-load', async () => {
      // 轮询等待结果渲染（沙箱 --disable-gpu 渲染慢，固定 3s 常常不够）
      const probe = `document.querySelectorAll('[class*="priceInt"]').length`
      let ready = false
      for (let t = 0; t < 24; t++) {
        await new Promise(r => setTimeout(r, 500))
        try {
          const n = await win.webContents.executeJavaScript(probe)
          if (n > 0) { ready = true; break }
        } catch { break }
      }
      try {
        const result = await win.webContents.executeJavaScript(EXTRACT_SCRIPT)
        clearTimeout(timeout)
        finish({ extracted: result, ready })
      } catch (e) {
        clearTimeout(timeout)
        finish({ error: 'execute failed: ' + e.message })
      }
    })
    win.webContents.on('did-fail-load', (_e, _c, _d, _u, isMain) => {
      if (!isMain) return
      clearTimeout(timeout)
      finish({ error: 'load failed' })
    })
  })
}

function report(serverName, res) {
  if (res.error) { console.log(`[${serverName}] 错误: ${res.error}`); return }
  const ex = res.extracted
  if (ex.masked) { console.log(`[${serverName}] 打码（needLogin），明文卡 ${ex.items.length}，打码计数 ${ex.maskedCount}`); return }
  if (!ex.items.length) { console.log(`[${serverName}] 无卡片（hasCards=${ex.hasCards}，垃圾 ${ex.junkCount ?? 0}）`); return }
  const d = units.analyzeRates(ex.items, serverName, null) // 沙箱无 DB，无历史时序保护
  const ev = d.evidence
  const evStr = `低簇${ev.lowCluster ? '√' : '×'} 跨档${ev.crossBin ? '√' : '×'} 历史-`
  console.log(`[${serverName}] ${d.rate === null ? '没获取到' : d.rate + ' 元/亿'} ` +
    `(采纳 ${d.stats.accepted}/${d.stats.total}，它区 ${d.stats.noServer}，非币类 ${d.stats.nonCoin}，无单位 ${d.stats.noUnit}，出界 ${d.stats.outOfRange}，1E直读 ${d.stats.yiPrimary}，垃圾 ${ex.junkCount ?? 0}；${evStr})`)
  console.log(`  簇: ${d.clusters.map(c => `${c.anchor}(×${c.members},${c.factors.join('/')}档)${c.verdict}`).join(' -> ')}`)
  const sorted = [...d.accepted].sort((a, b) => a.rate - b.rate)
  for (const a of sorted.slice(0, 10)) {
    console.log(`    ¥${a.price}×${a.factor}=${a.rate}  ${a.title.slice(0, 44)}`)
  }
}

app.on('window-all-closed', () => {})
app.whenReady().then(async () => {
  console.log('=== v4 全大区实测开始（沙箱无历史值，时序保护不参与） ===')
  for (const srv of SERVERS) {
    const res = await scrapeOne(srv)
    report(srv, res)
    await new Promise(r => setTimeout(r, 1500))
  }
  // 打码/失败的补抓一轮（淘宝按请求随机翻转打码）
  console.log('=== 补抓轮 ===')
  for (const srv of SERVERS) {
    const res = await scrapeOne(srv)
    if (res.error || (res.extracted && (res.extracted.masked || !res.extracted.items.length))) {
      console.log(`[补抓 ${srv}]`)
      report(srv, res)
      await new Promise(r => setTimeout(r, 1500))
    }
  }
  console.log('=== 完成 ===')
  app.exit(0)
})
