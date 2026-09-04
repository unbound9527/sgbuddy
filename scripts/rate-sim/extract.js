
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
      var text = (intEl.textContent || '').replace(/\s+/g, '')
      var wrap = intEl.closest('[class*="priceWrapper"]') || intEl.parentElement
      var card = intEl.closest('li') || intEl.closest('[class*="card"], [class*="item"], [class*="Card"], [class*="Item"]')
      var title = ''
      if (card) {
        var tEl = card.querySelector('[class*="title"], [class*="Title"]')
        title = ((tEl && tEl.textContent) || card.textContent || '').replace(/\s+/g, ' ').slice(0, 200)
      } else if (wrap && wrap.parentElement) {
        title = (wrap.parentElement.textContent || '').replace(/\s+/g, ' ').slice(0, 200)
      }
      if (text.indexOf('?') !== -1 || text.indexOf('？') !== -1) { maskedCount++; continue }
      var m = text.match(/(\d+(?:\.\d+)?)/)
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
      var numRe = /^\s*[¥￥]?\s*(\d{1,4}(?:\.\d{1,2})?)\s*$/
      while ((node = walker.nextNode()) && items.length < MAX_CARDS) {
        var t = node.textContent || ''
        var nm = t.match(numRe)
        if (!nm) continue
        var price = parseFloat(nm[1])
        if (!(price >= 5 && price <= 2000)) continue
        // 向上找价格容器（含 ¥ 符号，文本很短）
        var el = node.parentElement, priceBox = null
        for (var lv = 0; el && lv < 4; lv++) {
          var ptxt = (el.textContent || '').replace(/\s+/g, '')
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
        var title2 = ((tEl2 && tEl2.textContent) || card2.textContent || '').replace(/\s+/g, ' ').slice(0, 200)
        pushItem(price, title2)
      }
    }

    // hasCards：页面上确实是搜索结果页（含QQ三国/游戏币商品），用于区分「打码」和「页面异常」
    var body = (document.body && document.body.innerText) || ''
    var hasCards = /QQ三国|三国币|游戏币/.test(body) ? 1 : 0
    return { masked: maskedCount > 0 && items.length === 0, maskedCount: maskedCount, hasCards: hasCards, junkCount: junkCount, items: items }
  })()
