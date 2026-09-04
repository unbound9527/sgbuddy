// 币价单位折算纯函数 —— 与 Electron 解耦，可被单元测试复用
// 背景：淘宝商品标题带计价单位（1E/1亿、1000W/一千万、10E/10亿），
// 页面单价必须按单位折算为「元/亿」后才可入库。
// 用户权威规律：QQ三国各服币价恒落 200–900 元/亿；宁缺毋滥。

export type ExtractedItem = { price: number; title: string }

export const RATE_MIN = 200
export const RATE_MAX = 900

/**
 * 从标题识别计价单位，返回「单价 × factor = 元/亿」的系数。
 * 例：1000W/千万 → ×10；100W/百万 → ×100；10E/10亿 → ÷10；1E/1亿 → ×1。
 * 无法识别单位返回 null（调用方应丢弃该报价，不猜单位）。
 */
export function unitFactorToYi(title: string): number | null {
  // 数字+单位：1000W、500万、1E、10亿
  const wan = title.match(/(\d+(?:\.\d+)?)\s*[万Ww]/)
  if (wan) {
    const n = parseFloat(wan[1])
    if (n > 0 && n <= 10000) return 10000 / n
  }
  const yi = title.match(/(\d+(?:\.\d+)?)\s*[Ee亿]/)
  if (yi) {
    const n = parseFloat(yi[1])
    if (n > 0) return 1 / n
  }
  // 纯中文单位兜底：一千万、百万、十亿、一亿（注意「十亿」要先于「亿」判断）
  if (/千万/.test(title)) return 10
  if (/百万/.test(title)) return 100
  if (/十亿/.test(title)) return 0.1
  if (/亿/.test(title)) return 1
  return null
}

/**
 * ── v4 取值策略：合并池迭代底部锚定 + 跨档互证 + 历史时序保护 ──
 *
 * 噪声规律（实测归纳）：
 * 1. 噪声几乎总向上偏（虚高 666/888、钓鱼牌、单位误折算）→ 真实市场价是报价的
 *    「底部密集簇」而非最大簇。卖家互相竞争，真实挂牌必然挤在市场价附近。
 * 2. 同一市场价会以不同面额表达：1E 档 ¥290 ↔ 1000万 档 ¥29×10=290。
 *    同一簇内出现 ≥2 种面额 = 跨档互证，是最强信号——噪声几乎不可能跨面额巧合，
 *    低价钓鱼牌（低档孤立）也因此被识别。合并且分档双保险：即使某一面额
 *    整档被污染（1E 档全是钓鱼牌），真实价仍能从其它面额的簇中胜出。
 * 3. 库里有历史币价：新值偏离 >40% 否决该簇（防虚高页/整页噪声），
 *    偏离 ≤30% 视为一致（可作为孤立单卡的采纳依据）。
 *    注意：跨档互证优先于历史——历史值可能被旧引擎的垃圾值污染（如 618/123），
 *    若互证被历史否决压死，垃圾将永远洗不掉；且出界的存储值不作为历史参考。
 *
 * 流程（全部面额折算后合并成一个报价池，按价格升序迭代成簇，簇 = 最低价 ×1.15 以内）：
 * - 强证据（立即采纳）：簇内含 ≥2 种面额（跨档互证）或与历史一致（≤30%）
 * - 弱证据（备选）：簇内 ≥2 张同面额（成对虚高如 666×2 也满足，故仅为备选）
 * - 自底向上扫描：先取第一个强证据簇；没有强证据簇才退回第一个弱证据簇
 * - 历史硬否决（>40%）的簇直接跳过
 * - 全部簇无证据 → null（宁缺毋滥）
 * 残余风险（已知可接受）：无历史 + 单面额 + 成对钓鱼牌时弱证据可能误采纳，
 * 此时日志会完整打出簇判定，人工可查。
 */

export const LOW_SPREAD = 1.15 // 底部簇：最低价 ×1.15 以内视为同簇
export const HISTORY_TOL = 0.3 // 历史一致容差 ±30%
export const HISTORY_VETO = 0.4 // 历史硬否决阈值 >40%

export type AcceptedItem = { price: number; factor: number; rate: number; title: string }

export type BinStat = {
  factor: number
  total: number
  anchor: number // 该档最低折算价
  lowCount: number // 该档底部簇成员数
  lowMedian: number // 该档底部簇中位数
}

export type ClusterVerdict = {
  anchor: number
  lowMedian: number
  members: number
  factors: number[] // 簇内包含的面额档
  verdict: '采纳' | '弱簇备选采纳' | '历史时序否决' | '无佐证跳过'
}

export type RateDecision = {
  rate: number | null
  useYi: boolean // 采纳簇是否含 1E/1亿 直读档
  primaryFactor: number | null // 采纳簇的主面额（含 1E 取 1，否则取簇内第一个面额）
  accepted: AcceptedItem[]
  bins: BinStat[]
  clusters: ClusterVerdict[]
  evidence: { lowCluster: boolean; crossBin: boolean; history: boolean }
  stats: {
    total: number; noServer: number; noUnit: number
    outOfRange: number; nonCoin: number; accepted: number; yiPrimary: number
  }
}

/**
 * 折算全部报价为 元/亿，并按目标大区过滤，返回详细决策结果（含被采纳样本与淘汰统计）：
 * - 标题必须含游戏币/三国币/金币（同页还有元宝/点券/装备等品类，亿单价完全不同）
 * - 标题必须包含目标大区名（避免同页它区广告/多区并列稀释价格）
 * - 折算后落 [200, 900] 才有效
 * - lastRate：该大区库中的上次币价（无历史传 null），用于时序保护
 */
const COIN_RE = /游戏币|三国币|金币/
const NON_COIN_RE = /元宝|点券|装备|代练|账号|出租|代充/

export function analyzeRates(items: ExtractedItem[], serverName: string, lastRate: number | null = null): RateDecision {
  const accepted: AcceptedItem[] = []
  let noServer = 0; let noUnit = 0; let outOfRange = 0; let nonCoin = 0
  let yiPrimary = 0
  for (const it of items) {
    if (!(it.price > 0)) { noUnit++; continue }
    if (NON_COIN_RE.test(it.title) || !COIN_RE.test(it.title)) { nonCoin++; continue }
    if (!it.title.includes(serverName)) { noServer++; continue }
    const f = unitFactorToYi(it.title)
    if (f === null) { noUnit++; continue }
    const rate = Math.round(it.price * f * 100) / 100
    if (rate < RATE_MIN || rate > RATE_MAX) { outOfRange++; continue }
    accepted.push({ price: it.price, factor: f, rate, title: it.title })
    if (f === 1) yiPrimary++
  }

  // 分档统计（仅用于日志观察各面额分布）
  const ratesByFactor = new Map<number, number[]>()
  for (const a of accepted) {
    if (!ratesByFactor.has(a.factor)) ratesByFactor.set(a.factor, [])
    ratesByFactor.get(a.factor)!.push(a.rate)
  }
  const bins: BinStat[] = [...ratesByFactor.entries()].map(([factor, rates]) => {
    const s = [...rates].sort((a, b) => a - b)
    const anchor = s[0]
    const low = s.filter(v => v <= anchor * LOW_SPREAD)
    return { factor, total: rates.length, anchor, lowCount: low.length, lowMedian: median(low)! }
  })

  // 合并池：全部面额按折算价升序，自底向上迭代成簇
  const clusters: ClusterVerdict[] = []
  const sorted = [...accepted].sort((a, b) => a.rate - b.rate)
  let i = 0
  while (i < sorted.length) {
    const anchor = sorted[i].rate
    let j = i
    while (j < sorted.length && sorted[j].rate <= anchor * LOW_SPREAD) j++
    const members = sorted.slice(i, j)
    const factors = [...new Set(members.map(m => m.factor))]
    clusters.push({
      anchor,
      lowMedian: median(members.map(m => m.rate))!,
      members: members.length,
      factors,
      verdict: '无佐证跳过',
    })
    i = j
  }

  // 簇判定：跨档互证最强（历史值可能被旧引擎污染，压不过两种面额的独立一致），
  // 其次历史一致；历史否决只拦「无跨档互证」的簇（防整页虚高），不拦互证簇
  let chosenIdx = -1
  let chosenStrong = false
  let fallbackIdx = -1
  for (let k = 0; k < clusters.length; k++) {
    const c = clusters[k]
    const dev = lastRate !== null ? Math.abs(c.lowMedian / lastRate - 1) : null
    const histOk = dev !== null && dev <= HISTORY_TOL
    const crossStrong = c.factors.length >= 2
    if (crossStrong) {
      c.verdict = '采纳'
      chosenIdx = k; chosenStrong = true
      break
    }
    if (dev !== null && dev > HISTORY_VETO) { c.verdict = '历史时序否决'; continue }
    if (histOk) {
      c.verdict = '采纳'
      chosenIdx = k; chosenStrong = true
      break
    }
    if (c.members >= 2 && fallbackIdx === -1) {
      fallbackIdx = k
      c.verdict = '弱簇备选采纳'
    }
  }
  if (chosenIdx === -1 && fallbackIdx !== -1) chosenIdx = fallbackIdx
  const chosen = chosenIdx >= 0 ? clusters[chosenIdx] : null
  if (chosen && !chosenStrong && chosen.verdict === '弱簇备选采纳') {
    // 弱簇最终被采纳，保持标记以便日志区分强/弱采纳
  }

  const rate = chosen ? chosen.lowMedian : null
  const evidence = {
    lowCluster: chosen ? chosen.members >= 2 : false,
    crossBin: chosen ? chosen.factors.length >= 2 : false,
    history: false,
  }
  if (chosen) {
    const dev = lastRate !== null ? Math.abs(chosen.lowMedian / lastRate - 1) : null
    evidence.history = dev !== null && dev <= HISTORY_TOL
  }

  return {
    rate,
    useYi: chosen ? chosen.factors.includes(1) : false,
    primaryFactor: chosen ? (chosen.factors.includes(1) ? 1 : chosen.factors[0]) : null,
    accepted,
    bins,
    clusters,
    evidence,
    stats: {
      total: items.length, noServer, noUnit, outOfRange, nonCoin,
      accepted: accepted.length, yiPrimary,
    },
  }
}

/** 便捷封装：只取最终币价 */
export function targetRate(items: ExtractedItem[], serverName: string, lastRate: number | null = null): number | null {
  return analyzeRates(items, serverName, lastRate).rate
}

/** 中位数；空数组返回 null */
export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round(((s[mid - 1] + s[mid]) / 2) * 100) / 100
}
