// 模拟 currency-scraper.ts 的淘宝抓取链路，输出诊断信息用于对比修正
// 用法: npx electron scripts/rate-sim/main.js --servers=得陇望蜀,群雄逐鹿 [--wait=3500]
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-gpu-compositing')
app.disableHardwareAcceleration()
// 防止诊断窗口销毁后触发默认退出行为
app.on('window-all-closed', () => {})
// 可选：复用应用的淘宝分区（复制到临时目录后通过 SGB_SIM_UD 指向），带登录态抓取
if (process.env.SGB_SIM_UD) app.setPath('userData', process.env.SGB_SIM_UD)

const args = process.argv.slice(2)
function argOf(name, def) {
  const hit = args.find(a => a.startsWith('--' + name + '='))
  return hit ? hit.split('=').slice(1).join('=') : def
}
const serverArg = argOf('servers', '得陇望蜀,群雄逐鹿,桃园结义')
const waitMs = parseInt(argOf('wait', '3500'), 10)
const noUa = args.includes('--noua')
const warmup = args.includes('--warmup')
const detail = args.includes('--detail')
const outDir = path.join(__dirname, 'out')
fs.mkdirSync(outDir, { recursive: true })

const URL_TEMPLATE = 'https://uland.taobao.com/sem/tbsearch?bc_fl_src=tbsite_NOX36458&bd_vid=5173466194438421211&channelSrp=baiduSomama&clk1=d2811325e6aa361664c1b36ed00800d7&commend=all&ie=utf8&initiative_id=tbindexz_20170306&keyword=KW&localImgKey=&page=1&preLoadOrigin=https%3A%2F%2Fwww.taobao.com&q=KW&refpid=mm_26632258_3504122_32538762&search_type=item&sourceId=tb.index&spm=tbpc.pc_sem_alimama%2Fa.search_manual.0&ssid=s5-e&tab=all'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

function buildUrl(serverName) {
  const kw = `qq三国${serverName}游戏币`
  if (args.includes('--cleanurl')) {
    return 'https://uland.taobao.com/sem/tbsearch?keyword=' + encodeURIComponent(kw) + '&q=' + encodeURIComponent(kw)
  }
  return URL_TEMPLATE.replace(/KW/g, encodeURIComponent(kw))
}

// 与应用完全一致的提取脚本（用于对照）
const APP_EXTRACT = `
  (function() {
    var isPrice = function(v) { return v >= 20 && v <= 1000; }
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
    var body = document.body?.innerText || ''
    var yen = body.match(/[¥￥]\\s*(\\d+(?:\\.\\d{1,2})?)/g)
    if (yen) for (var y=0;y<yen.length;y++) {
      var vy = parseFloat(yen[y].replace(/[^\\d.]/g,''))
      if (isPrice(vy)) return vy
    }
    var nums = body.match(/\\b([1-9]\\d{1,3})(?:\\.\\d{1,2})?\\b/g)
    if (nums) for (var x=0;x<nums.length;x++) {
      var vx = parseFloat(nums[x])
      if (isPrice(vx)) return vx
    }
    return null
  })()
`

// 诊断脚本：收集页面全部线索
const DIAG_EXTRACT = `
  (async function() {
    var body = (document.body && document.body.innerText) || ''
    var r = { title: document.title, url: location.href, bodyLen: body.length, bodyHead: body.slice(0, 1500), yen: [], cards: [], appReturn: null }

    // ¥ 及上下文
    var re = /[¥￥]\\s*\\d+(?:\\.\\d{1,2})?/g, m
    while ((m = re.exec(body)) !== null) {
      r.yen.push({ v: m[0], ctx: body.slice(Math.max(0, m.index - 60), m.index + 60).replace(/\\n/g, '|') })
      if (r.yen.length >= 30) break
    }

    // 复刻应用的卡片选择器，取前 8 个含QQ三国的卡片
    var cards = document.querySelectorAll('[class*="card"], [class*="item"], [class*="Card"], [class*="Item"], [class*="result"], li, [class*="list"]>*')
    var checked = 0
    for (var i = 0; i < cards.length; i++) {
      if (checked >= 8) break
      if (!(cards[i].textContent || '').includes('QQ三国')) continue
      checked++
      var c = { idx: checked, cls: cards[i].className && String(cards[i].className).slice(0, 120), title: '', priceEls: [] }
      var t = cards[i].querySelector('[class*="title"], [class*="Title"]')
      c.title = ((t && t.textContent) || cards[i].textContent || '').replace(/\\s+/g, ' ').slice(0, 120)
      var els = cards[i].querySelectorAll('[class*="price"], [class*="Price"], em, strong, .money, [class*="amount"], [class*="rmb"]')
      for (var j = 0; j < els.length && j < 10; j++) {
        c.priceEls.push({ cls: String(els[j].className).slice(0, 80), text: (els[j].textContent || '').replace(/\\s+/g, ' ').slice(0, 60) })
      }
      r.cards.push(c)
    }

    // 应用逻辑的返回值
    r.appReturn = ${APP_EXTRACT}

    // 新版提取脚本（与 currency-scraper.ts 的 EXTRACT_SCRIPT 一致）
    try {
      r.newExtract = await ${fs.readFileSync(path.join(__dirname, 'extract.js'), 'utf8')}
    } catch (e3) { r.newExtractErr = String(e3) }

    // 深挖：价格元素的真实字符码 & 页面JSON
    r.priceChars = []
    var pels = document.querySelectorAll('[class*="price"], [class*="Price"]')
    for (var p = 0; p < pels.length && p < 12; p++) {
      var t = (pels[p].textContent || '').trim()
      var codes = []
      for (var k = 0; k < t.length && k < 20; k++) codes.push(t.charCodeAt(k).toString(16))
      r.priceChars.push({ cls: String(pels[p].className).slice(0, 60), text: t.slice(0, 20), codes: codes.join(',') })
    }
    // 全文中非ASCII/异常字符统计（PUA区 E000-F8FF）
    var pua = body.match(/[\\uE000-\\uF8FF]/g)
    r.puaCount = pua ? pua.length : 0
    // 页面内嵌JSON中的价格线索
    var html = document.documentElement.outerHTML
    r.jsonHits = []
    var jre = /"(?:price|viewPrice|showPrice)[^"]*":\s*("?[^,}]{1,40})/g
    var jm
    while ((jm = jre.exec(html)) !== null && r.jsonHits.length < 20) r.jsonHits.push(jm[0].slice(0, 100))
    // data-属性中的价格
    var dre = /data-[a-z-]*price[a-z-]*="([^"]{1,30})"/g
    r.dataHits = []
    while ((jm = dre.exec(html)) !== null && r.dataHits.length < 20) r.dataHits.push(jm[1])
    r.htmlLen = html.length

    // 字体加载诊断
    var fel = document.querySelector('[class*="priceInt"]')
    r.priceFontFamily = fel ? getComputedStyle(fel).fontFamily : null
    r.fontsStatus = []
    document.fonts.forEach(function (f) {
      r.fontsStatus.push({ family: f.family, status: f.status })
    })

    // 原始 SSR HTML 中价格上下文（水合前是否有真数字）
    try {
      var orig = await fetch(location.href, { credentials: 'include' }).then(function (r) { return r.text() })
      r.origLen = orig.length
      r.origPriceCtx = []
      var pre = /priceInt[^>]*>([^<]{1,30})</g
      var pm
      while ((pm = pre.exec(orig)) !== null && r.origPriceCtx.length < 10) r.origPriceCtx.push(pm[1])
      // 找 SSR 里价格数字的另一种形态：带小数的 20-999
      var numsRe = />([1-9]\d{1,3}(?:\.\d)?)</g
      var seen = {}
      while ((pm = numsRe.exec(orig)) !== null && r.origPriceCtx.length < 24) {
        var v = parseFloat(pm[1])
        if (v >= 20 && v <= 999 && !seen[pm[1]]) { seen[pm[1]] = 1; r.origPriceCtx.push('num:' + pm[1]) }
      }
    } catch (e2) { r.origErr = String(e2) }
    return r
  })()
`

async function diag(server) {
  return new Promise(async (resolve) => {
    const win = new BrowserWindow({
      width: 1280, height: 900, show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })
    const finish = (data) => { try { win.destroy() } catch {} ; resolve(data) }
    const timeout = setTimeout(() => finish({ server, error: 'timeout 30s' }), 30000)

    if (warmup) {
      // 先访问淘宝首页领访客 Cookie，再进搜索页（限时 12s，超时也继续）
      try {
        await Promise.race([
          win.loadURL('https://www.taobao.com/', noUa ? {} : { userAgent: UA }),
          new Promise(r => setTimeout(r, 12000)),
        ])
        await new Promise(r => setTimeout(r, 3000))
      } catch { /* 忽略预热失败 */ }
    }
    win.loadURL(buildUrl(server), noUa ? {} : { userAgent: UA })
    if (detail) {
      // 进搜索页后取第一个商品链接，跳转详情页看价格是否明文
      await new Promise(r => setTimeout(r, waitMs))
      let itemUrl = null
      try {
        itemUrl = await win.webContents.executeJavaScript(`
          (function() {
            var a = document.querySelector('a[href*="item.htm"], a[href*="//item.taobao.com"], a[href*="detail.tmall.com"]')
            return a ? a.href : null
          })()
        `)
      } catch { /* ignore */ }
      console.log('  detail url:', itemUrl)
      if (itemUrl) {
        try {
          await Promise.race([
            win.loadURL(itemUrl, noUa ? {} : { userAgent: UA }),
            new Promise(r => setTimeout(r, 15000)),
          ])
          await new Promise(r => setTimeout(r, 4000))
          const img2 = await win.webContents.capturePage()
          fs.writeFileSync(path.join(outDir, encodeURIComponent(server) + '_detail.png'), img2.toPNG())
          const dtxt = await win.webContents.executeJavaScript(`
            (function() {
              var t = (document.body && document.body.innerText) || ''
              var m = t.match(/[¥￥]\\s*\\d+(?:\\.\\d{1,2})?/g) || []
              return { title: document.title, yen: m.slice(0, 15) }
            })()
          `)
          console.log('  detail title:', dtxt.title, 'yen:', JSON.stringify(dtxt.yen))
        } catch (e) { console.log('  detail err:', String(e)) }
      }
      clearTimeout(timeout)
      finish({ server, detailUrl: itemUrl })
      return
    }
    win.webContents.on('did-finish-load', async () => {
      await new Promise(r => setTimeout(r, waitMs))
      try {
        const d = await win.webContents.executeJavaScript(DIAG_EXTRACT)
        clearTimeout(timeout)
        // 截图价格区域，验证字体渲染后的真实数字
        try {
          const rects = await win.webContents.executeJavaScript(`
            (function() {
              var out = []
              var els = document.querySelectorAll('.Price--priceInt--BXYeCOI, [class*="priceInt"]')
              for (var i = 0; i < els.length && i < 6; i++) {
                var r = els[i].getBoundingClientRect()
                out.push({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) })
              }
              return out
            })()
          `)
          const img = await win.webContents.capturePage()
          const dpr = (await win.webContents.executeJavaScript('window.devicePixelRatio')).toString()
          const scale = parseFloat(dpr) || 1
          ;(rects || []).forEach((rc, i) => {
            if (rc.w <= 0 || rc.h <= 0) return
            const crop = img.crop({
              x: Math.round(rc.x * scale), y: Math.round(rc.y * scale),
              width: Math.round(rc.w * scale), height: Math.round(rc.h * scale),
            })
            fs.writeFileSync(path.join(outDir, `${encodeURIComponent(server)}_price${i}_dpr${scale}.png`), crop.toPNG())
          })
          fs.writeFileSync(path.join(outDir, encodeURIComponent(server) + '_full.png'), img.toPNG())
          d.shots = (rects || []).length
          d.dpr = scale
        } catch (e) { d.shotError = String(e) }
        finish({ server, ...d })
      } catch (e) {
        clearTimeout(timeout)
        finish({ server, error: String(e) })
      }
    })
    win.webContents.on('did-fail-load', (_e, code, desc, url, isMain) => {
      if (isMain) { clearTimeout(timeout); finish({ server, error: `did-fail-load ${code} ${desc}` }) }
    })
  })
}

app.whenReady().then(async () => {
  const servers = serverArg.split(',').map(s => s.trim()).filter(Boolean)
  const results = []
  for (const s of servers) {
    console.log(`[sim] ${s} ...`)
    const d = await diag(s)
    results.push(d)
    const appRaw = d.appReturn
    const adjusted = (typeof appRaw === 'number' && appRaw > 0)
      ? (appRaw < 100 ? Math.round(appRaw * 10 * 100) / 100 : appRaw)
      : null
    console.log(`  appReturn=${JSON.stringify(appRaw)} adjustPrice→${adjusted} cards=${(d.cards || []).length} yen=${(d.yen || []).length}`)
    fs.writeFileSync(path.join(outDir, encodeURIComponent(s) + '.json'), JSON.stringify(d, null, 2))
    await new Promise(r => setTimeout(r, 2000))
  }
  fs.writeFileSync(path.join(outDir, '_summary.json'), JSON.stringify(results, null, 2))
  console.log('[sim] done →', outDir)
  app.quit()
})
