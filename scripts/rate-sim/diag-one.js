// 单区诊断：无卡片时导出页面文本与 DOM 关键结构
const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

const SERVER = process.argv[2] || '群雄逐鹿'
const URL_TEMPLATE = 'https://uland.taobao.com/sem/tbsearch?bc_fl_src=tbsite_NOX36458&bd_vid=5173466194438421211&channelSrp=baiduSomama&clk1=d2811325e6aa361664c1b36ed00800d7&commend=all&ie=utf8&initiative_id=tbindexz_20170306&keyword=KW&localImgKey=&page=1&preLoadOrigin=https%3A%2F%2Fwww.taobao.com&q=KW&refpid=mm_26632258_3504122_32538762&search_type=item&sourceId=tb.index&spm=tbpc.pc_sem_alimama%2Fa.search_manual.0&ssid=s5-e&tab=all'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

app.on('window-all-closed', () => {})
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 800, height: 600, show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, partition: 'persist:taobao' },
  })
  const kw = `qq三国${SERVER}游戏币`
  await win.loadURL(URL_TEMPLATE.replace(/KW/g, encodeURIComponent(kw)), { userAgent: UA })
  await new Promise(r => setTimeout(r, 6000))
  const EXTRACT_SCRIPT = fs.readFileSync(path.join(__dirname, 'extract.js'), 'utf8')
  const diag = await win.webContents.executeJavaScript(`(function(){
    const priceInts = document.querySelectorAll('[class*="priceInt"]').length
    const yiCount = (document.body.innerText.match(/[¥￥]/g) || []).length
    return {
      url: location.href,
      title: document.title,
      priceInts,
      yiCount,
      bodyHead: (document.body.innerText || '').replace(/\\n+/g, ' | ').slice(0, 500),
    }
  })()`)
  console.log(JSON.stringify(diag, null, 2))
  let extractResult = null
  try {
    extractResult = await win.webContents.executeJavaScript(EXTRACT_SCRIPT)
  } catch (e) {
    extractResult = { error: e.message }
  }
  console.log('extract:', JSON.stringify({
    error: extractResult.error,
    masked: extractResult.masked,
    maskedCount: extractResult.maskedCount,
    junkCount: extractResult.junkCount,
    itemCount: extractResult.items ? extractResult.items.length : 'N/A',
    first: extractResult.items && extractResult.items[0],
  }, null, 2))
  win.webContents.savePage('/tmp/v4-diag.html', 'HTMLComplete').catch(() => {})
  try { win.destroy() } catch {}
  app.exit(0)
})
