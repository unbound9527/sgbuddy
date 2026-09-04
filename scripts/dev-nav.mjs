// Dev utility: click a sidebar nav item (or fire an action) inside the running
// Electron renderer via CDP. Usage:
//   node scripts/dev-nav.mjs nav <index>     — click the i-th sidebar nav item
//   node scripts/dev-nav.mjs nav list        — print nav labels
//   node scripts/dev-nav.mjs action rate|theme|close-modal
const wsUrl = process.argv[2]
const cmd = process.argv[3]
const arg = process.argv[4]

function evaluate(ws, expression) {
  return new Promise((resolve, reject) => {
    const onMsg = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id === 1) {
        ws.removeEventListener('message', onMsg)
        if (msg.error) reject(new Error(msg.error.message))
        else resolve(msg.result?.result?.value)
      }
    }
    ws.addEventListener('message', onMsg)
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }))
  })
}

const res = await fetch('http://127.0.0.1:9222/json')
const pages = await res.json()
const page = pages.find(p => p.type === 'page')
if (!page) { console.error('no page'); process.exit(1) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise(r => (ws.onopen = r))

let expr
if (cmd === 'nav') {
  if (arg === 'list') {
    expr = `[...document.querySelectorAll('.nav-item')].map(a => a.textContent.trim()).join(' | ')`
  } else {
    expr = `(() => { const items=[...document.querySelectorAll('.nav-item')]; const el=items[${arg}]; if(!el) return 'OUT_OF_RANGE'; el.click(); return 'OK:' + el.textContent.trim() })()`
  }
} else if (cmd === 'action') {
  const sel = { rate: 'button[title="查看币价波动"]', theme: 'button.theme-toggle' }[arg]
  if (arg === 'close-modal') expr = `(() => { const b=document.querySelector('.rate-modal-close'); if(b){b.click(); return 'closed'} return 'no-modal' })()`
  else if (sel) expr = `(() => { const b=document.querySelector('${sel}'); if(!b) return 'NOT_FOUND'; b.click(); return 'OK' })()`
  else { console.error('unknown action'); process.exit(1) }
} else {
  console.error('usage: node scripts/dev-nav.mjs <wsUrl> nav <i|list> | action <rate|theme|close-modal>')
  process.exit(1)
}
console.log(await evaluate(ws, expr))
ws.close()
process.exit(0)
