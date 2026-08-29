// 经验加成道具（升级计算器 · 时效型加成）
// 来源：《经验获取.md》"每日多C多经验 / 感恩的祝福 / 经验成长祝福语 / 经验无忧祝福语 /
// 三国小小勇士 / 三国小小战神 / 日日签的祝福"（2026-08-21 用户确认：成长/无忧祝福语也进加成道具）。
// 两类道具：
// - 百分比型（grindPct / itemPct / taskPct）：按百分比乘到对应来源经验上（打怪 / 吃经验道具 / 任务）；
// - 次数型（useMult）：每次使用给 useMult × 标准单位经验（如祝福语 0.25），每天次数由方案 ecItemCounts 决定；
//   其经验为独立来源，不乘"道具经验加成"百分比。
// 时效语义：生效窗口 = 第 startDay 天起，持续 startRemainDays 天（第 startDay 天即消耗 1 天）；
// 第 N 天生效条件 = enabled 且 startDay ≤ N ≤ startDay + startRemainDays - 1。
// startDay 缺省 = 1（模拟起始日即生效）；startRemainDays 缺省 = validDays（用户可调低表示"已用掉一部分"）。
// 目录 / 启用 / 开始天数 / 剩余天数全局共享（账号"现在"的库存状态），次数随方案。

export interface ExpBonusItem {
  id: string // 内置固定 id；自定义前缀 exp_bonus_custom_
  name: string
  validDays: number // 总有效期（天）
  grindPct: number // 打怪经验加成（%）
  itemPct: number // 道具经验加成（%，作用于经验道具）
  taskPct: number // 任务经验加成（%，作用于 taskIds）
  taskIds: string[] // 任务加成生效的任务 id（来自 activeTaskPool；空 = 不作用于任何任务）
  useMult?: number // 次数型道具：每次经验倍率（如祝福语 0.25）；undefined = 百分比型
  defaultCount?: number // 次数型默认每天次数（如祝福语 1440 = 每分钟一次）；方案未设次数时回退（2026-08-23 起）
  enabled: boolean // 是否启用
  startDay: number // 开始天数：模拟第几天起生效，缺省 1 = 起始日；调高 = 延后启用
  startRemainDays: number // 起始剩余天数（第 startDay 天起仍有效的天数），缺省 = validDays；不设上限（2026-08-23 起可超 validDays）
}

// 每日多C多经验覆盖的 10 项活动里，任务池（activity-calc.json）可对应的 8 项：
// 军团战、修行之途、军团战被 在任务池无对应条目，默认不勾，用户可手动补勾
export const DAILY_MULTI_C_TASK_IDS = [
  'legion_hunt', // 军团狩猎
  'legion_task', // 军团任务
  'guoling_muxian', // 国令募贤
  'beimangshan', // 北邙山
  'puzzle', // 拼图
  'yunshu_wuzi', // 运送物资
  'baguazhen', // 八卦阵
  'yuji_huanjing', // 于吉幻境
]

export const DEFAULT_BONUS_ITEMS: ExpBonusItem[] = [
  { id: 'bonus_daily_multi_c', name: '每日多C多经验', validDays: 120, grindPct: 0, itemPct: 0, taskPct: 100, taskIds: [...DAILY_MULTI_C_TASK_IDS], enabled: false, startDay: 1, startRemainDays: 120 },
  { id: 'bonus_ganen_zhufu', name: '感恩的祝福', validDays: 30, grindPct: 30, itemPct: 0, taskPct: 0, taskIds: [], enabled: false, startDay: 1, startRemainDays: 30 },
  { id: 'bonus_xiaoyongshi', name: '三国小小勇士', validDays: 180, grindPct: 5, itemPct: 5, taskPct: 0, taskIds: [], enabled: false, startDay: 1, startRemainDays: 180 },
  { id: 'bonus_xiaozhanshen', name: '三国小小战神', validDays: 360, grindPct: 5, itemPct: 0, taskPct: 0, taskIds: [], enabled: false, startDay: 1, startRemainDays: 360 },
  { id: 'bonus_ririqian', name: '日日签的祝福', validDays: 60, grindPct: 6, itemPct: 0, taskPct: 0, taskIds: [], enabled: false, startDay: 1, startRemainDays: 60 },
  { id: 'bonus_exp_bless', name: '经验成长祝福语', validDays: 180, grindPct: 0, itemPct: 0, taskPct: 0, taskIds: [], useMult: 0.25, defaultCount: 1440, enabled: false, startDay: 1, startRemainDays: 180 },
  { id: 'bonus_exp_wuyou', name: '经验无忧祝福语', validDays: 30, grindPct: 0, itemPct: 0, taskPct: 0, taskIds: [], useMult: 0.25, defaultCount: 1440, enabled: false, startDay: 1, startRemainDays: 30 },
]

export interface DayBonusMults {
  grindMult: number // 打怪经验总倍率（1 + Σ打怪加成%）
  itemMult: number // 经验道具总倍率（1 + Σ道具加成%）
  taskMults: Record<string, number> // 任务倍率（仅对 taskIds 命中项存在，1 + Σ任务加成%）
}

// 第 day 天是否生效：enabled 且 在生效窗口内（startDay ≤ day ≤ startDay + startRemainDays - 1，第 startDay 天即消耗 1 天）
export function bonusActiveOnDay(b: ExpBonusItem, day: number): boolean {
  if (!b.enabled || day < 1) return false
  if (day < b.startDay) return false
  if (day > b.startDay + b.startRemainDays - 1) return false
  return true
}

// 第 day 天生效的加成倍率（生效窗口内有效）；百分比叠加为加法：5% + 6% → 1 + (5+6)/100 = ×1.11（同一来源内各道具百分比相加）
export function bonusMultsOnDay(bonuses: ExpBonusItem[], day: number): DayBonusMults {
  let grindPct = 0
  let itemPct = 0
  const taskPct: Record<string, number> = {}
  for (const b of bonuses) {
    if (!bonusActiveOnDay(b, day)) continue
    grindPct += b.grindPct
    itemPct += b.itemPct
    if (b.taskPct > 0) {
      const ids = b.taskIds?.length ? b.taskIds : null // 空作用域 → 不作用于任何任务
      if (ids) {
        for (const id of ids) taskPct[id] = (taskPct[id] ?? 0) + b.taskPct
      }
    }
  }
  const taskMults: Record<string, number> = {}
  for (const [id, pct] of Object.entries(taskPct)) taskMults[id] = 1 + pct / 100
  return {
    grindMult: 1 + grindPct / 100,
    itemMult: 1 + itemPct / 100,
    taskMults,
  }
}

// 第 day 天生效的次数型道具（useMult 非空 且在生效窗口内）：调用方以 mult = useMult 追加进当天 items
export function bonusUseItemsOnDay(bonuses: ExpBonusItem[], day: number): { id: string; mult: number }[] {
  const out: { id: string; mult: number }[] = []
  for (const b of bonuses) {
    if (!bonusActiveOnDay(b, day)) continue
    if (typeof b.useMult === 'number' && b.useMult > 0) out.push({ id: b.id, mult: b.useMult })
  }
  return out
}

// 加载校验：非法项丢弃、缺省字段回填（数值钳制），返回干净列表
export function sanitizeBonusItems(raw: unknown): ExpBonusItem[] {
  if (!Array.isArray(raw)) return []
  const out: ExpBonusItem[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const it = r as Partial<ExpBonusItem>
    if (typeof it.id !== 'string' || !it.id) continue
    if (typeof it.name !== 'string' || !it.name) continue
    const vd = Number(it.validDays)
    if (!Number.isFinite(vd) || vd < 1) continue // 无/非法/0 有效期 → 丢弃
    const validDays = Math.max(1, Math.round(vd)) // 有效天数不设上限（2026-08-23 用户确认）
    const useMult = typeof it.useMult === 'number' && it.useMult > 0 ? Math.max(0, it.useMult) : undefined
    out.push({
      id: it.id,
      name: it.name,
      validDays,
      grindPct: clampNum(it.grindPct, 0, 1000) ?? 0,
      itemPct: clampNum(it.itemPct, 0, 1000) ?? 0,
      taskPct: clampNum(it.taskPct, 0, 1000) ?? 0,
      taskIds: Array.isArray(it.taskIds)
        ? [...new Set(it.taskIds.filter((x): x is string => typeof x === 'string'))]
        : [],
      useMult,
      defaultCount: typeof it.defaultCount === 'number' && it.defaultCount > 0
        ? Math.min(1440, Math.round(it.defaultCount)) // 每天至多 1440 次（每分钟一次）
        : undefined,
      enabled: !!it.enabled,
      startDay: clampNum(it.startDay, 1, 3650) ?? 1,
      // 剩余天数不设上限（2026-08-23 用户确认）：可超 validDays，仅保留下限 1
      startRemainDays: Number.isFinite(Number(it.startRemainDays)) && Number(it.startRemainDays) >= 1
        ? Math.round(Number(it.startRemainDays))
        : validDays,
    })
  }
  return out
}

function clampNum(v: unknown, min: number, max: number): number | null {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.min(max, Math.max(min, n))
}
