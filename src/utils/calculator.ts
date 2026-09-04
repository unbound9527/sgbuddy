// 侧边栏计算器的纯逻辑层（无 Vue 依赖，便于单测）
//
// 状态机：tokens 保存「已确认」的操作数与运算符，currentNumber 是当前正在输入的数字。
// 按下运算符时，currentNumber 才会被提交进 tokens；因此 tokens 的末尾通常是运算符（等待下一个操作数）。

export type CalcToken = { type: 'num'; value: string } | { type: 'op'; value: string }

export interface CalcState {
  /** 已确认的 token 流 */
  tokens: CalcToken[]
  /** 当前正在输入 / 展示的数字 */
  currentNumber: string
  /** currentNumber 是否为录入中（false 表示它是占位 0 或上一步结果） */
  numberDirty: boolean
  /** 是否处于「= 已求值」展示态 */
  evaluated: boolean
  /** 求值展示态下用于回显的完整算式 */
  lastExpression: string
  /** currentNumber 是从 tokens 末尾「取出编辑」的操作数（值仍留在 token 流中），提交时原位替换/去重而非重复入栈 */
  mirrored: boolean
}

export function createCalcState(): CalcState {
  return { tokens: [], currentNumber: '0', numberDirty: false, evaluated: false, lastExpression: '', mirrored: false }
}

function isOpChar(c: string): boolean {
  return c === '+' || c === '-' || c === '*' || c === '/'
}

/** 出错后（如除零）任何输入都先复位，避免 Error 串进计算 */
function clearIfError(s: CalcState): void {
  if (s.currentNumber === 'Error') clearCalc(s)
}

/** 提交 currentNumber 进 token 流：mirrored 时原位替换/去重，否则正常入栈 */
function commitNumber(s: CalcState): void {
  const top = s.tokens[s.tokens.length - 1]
  if (s.mirrored && top && top.type === 'num') {
    if (top.value !== s.currentNumber) {
      s.tokens[s.tokens.length - 1] = { type: 'num', value: s.currentNumber }
    }
  } else {
    s.tokens.push({ type: 'num', value: s.currentNumber })
  }
  s.mirrored = false
}

/** 上方小字回显的算式文本 */
export function expressionText(s: CalcState): string {
  if (s.evaluated) return s.lastExpression ? `${s.lastExpression} =` : ''
  const top = s.tokens[s.tokens.length - 1]
  const mirroredNum = s.mirrored && s.numberDirty && top?.type === 'num'
  // mirrored 的操作数以 currentNumber 的实时值回显（可能已被改号/取反）
  const list: CalcToken[] = mirroredNum
    ? [...s.tokens.slice(0, -1), { type: 'num', value: s.currentNumber }]
    : s.tokens
  let expr = list.map(t => (t.type === 'op' ? ` ${t.value} ` : t.value)).join('')
  if (s.numberDirty && !mirroredNum) expr += s.currentNumber
  return expr
}

/** 把 tokens 渲染成算式（求值展示用） */
function tokensText(list: CalcToken[]): string {
  return list.map(t => (t.type === 'op' ? ` ${t.value} ` : t.value)).join('')
}

export function appendNum(s: CalcState, n: string): void {
  clearIfError(s)
  if (s.evaluated) {
    // 结果态直接敲数字 = 开启一轮全新计算
    s.tokens = []
    s.currentNumber = n
    s.lastExpression = ''
    s.evaluated = false
    s.numberDirty = true
    s.mirrored = false
    return
  }
  if (!s.numberDirty) {
    s.currentNumber = n
    s.numberDirty = true
  } else if (s.currentNumber === '0' && n === '0') {
    return
  } else if (s.currentNumber === '0' && n !== '0') {
    s.currentNumber = n
  } else {
    s.currentNumber += n
  }
}

export function appendDot(s: CalcState): void {
  clearIfError(s)
  if (s.evaluated) {
    s.tokens = []
    s.currentNumber = '0.'
    s.lastExpression = ''
    s.evaluated = false
    s.numberDirty = true
    s.mirrored = false
    return
  }
  if (!s.currentNumber.includes('.')) {
    s.currentNumber += '.'
    s.numberDirty = true
  }
}

export function appendOp(s: CalcState, op: string): void {
  clearIfError(s)
  if (s.evaluated) {
    s.tokens = [{ type: 'num', value: s.currentNumber }]
    s.lastExpression = ''
    s.evaluated = false
    s.mirrored = false
  } else if (s.numberDirty) {
    // 录入中的数字提交进 tokens（mirrored 时原位替换/去重）
    commitNumber(s)
  } else if (s.tokens.length > 0 && s.tokens[s.tokens.length - 1].type === 'op') {
    // 没输新数字 → 替换上一个运算符
    s.tokens[s.tokens.length - 1] = { type: 'op', value: op }
    return
  }
  s.tokens.push({ type: 'op', value: op })
  s.currentNumber = '0'
  s.numberDirty = false
}

export function evaluate(s: CalcState): void {
  clearIfError(s)
  if (s.tokens.length === 0) {
    // token 流已空（如退格取出最后一个操作数后按 =）：直接把当前输入作为结果
    if (s.numberDirty) {
      s.lastExpression = s.currentNumber
      s.numberDirty = false
      s.evaluated = true
      s.mirrored = false
    }
    return
  }
  if (s.numberDirty) {
    commitNumber(s)
  } else if (s.tokens[s.tokens.length - 1].type === 'op') {
    const lastNum = s.tokens.length > 1 ? s.tokens[s.tokens.length - 2].value : '0'
    s.tokens.push({ type: 'num', value: lastNum })
  }
  s.lastExpression = tokensText(s.tokens)
  const res = evaluateTokens(s.tokens)
  s.tokens = []
  s.currentNumber = res
  s.numberDirty = false
  s.evaluated = true
  s.mirrored = false
}

export function toggleSign(s: CalcState): void {
  clearIfError(s)
  if (s.evaluated) {
    // 对结果取反 → 退出求值态，结果转为可继续编辑的数字
    s.lastExpression = ''
    s.evaluated = false
    s.numberDirty = true
  }
  if (s.currentNumber === '0') return
  s.numberDirty = true
  if (s.currentNumber.startsWith('-')) {
    s.currentNumber = s.currentNumber.slice(1)
  } else {
    s.currentNumber = '-' + s.currentNumber
  }
}

/** 全部清除（C / Esc） */
export function clearCalc(s: CalcState): void {
  s.tokens = []
  s.currentNumber = '0'
  s.numberDirty = false
  s.evaluated = false
  s.lastExpression = ''
  s.mirrored = false
}

/**
 * 退格（Backspace），按真实计算器的手感逐层回退：
 *   1. 出错态 → 直接复位
 *   2. 结果态（= 之后）→ 结果转为可编辑数字，再删最后一位
 *   3. 录入中的数字 → 删最后一位；删空 / 只剩占位 0、符号残段 → 视为「清空当前输入项」
 *   4. 当前输入项已空 → 从 token 流逐层回退：
 *      末尾是运算符 → 撤掉它，其前的操作数取出编辑（暂留 token 流，提交时原位替换/去重）
 *      末尾是操作数 → 整体取出编辑（从 token 流移除）
 */
export function backspace(s: CalcState): void {
  if (s.currentNumber === 'Error') {
    clearCalc(s)
    return
  }

  if (s.evaluated) {
    s.evaluated = false
    s.lastExpression = ''
    s.numberDirty = true
  }

  if (s.numberDirty) {
    // 科学计数法（如 1e+21）无法逐位删，整体清空当前输入项
    let next = s.currentNumber.includes('e') ? '' : s.currentNumber.slice(0, -1)
    if (next === '-' || next === '.') next = ''
    if (next === '' || next === '0' || !/\d/.test(next)) {
      // 删到空 / 占位 0 / 只剩 - . 等残段 → 视为「清空当前输入项」
      s.currentNumber = '0'
      s.numberDirty = false
    } else {
      s.currentNumber = next
    }
    return
  }

  // 无录入中的数字：从 token 流逐层回退
  const last = s.tokens[s.tokens.length - 1]
  if (!last) {
    s.currentNumber = '0'
    s.mirrored = false
    return
  }
  s.tokens.pop()
  if (last.type === 'op') {
    const prev = s.tokens[s.tokens.length - 1]
    if (prev && prev.type === 'num') {
      // 撤掉运算符，其前的操作数取出编辑（值暂留 token 流）
      s.currentNumber = prev.value
      s.numberDirty = true
      s.mirrored = true
    } else {
      s.currentNumber = '0'
      s.mirrored = false
    }
  } else {
    // 操作数整体取出编辑
    s.currentNumber = last.value
    s.numberDirty = true
    s.mirrored = false
  }
}

/** 清除当前输入项（CE / Delete），保留已确认的算式 */
export function clearEntry(s: CalcState): void {
  if (s.evaluated) {
    clearCalc(s)
    return
  }
  s.currentNumber = '0'
  s.numberDirty = false
}

// ── 求值 ──
// 两轮：先算 * /，再算 + -
export function evaluateTokens(list: CalcToken[]): string {
  const mulDiv: CalcToken[] = []
  for (let i = 0; i < list.length; i++) {
    const t = list[i]
    if (t.type === 'op' && (t.value === '*' || t.value === '/')) {
      const prev = parseFloat(mulDiv.pop()!.value)
      const next = list[++i]
      if (!next || next.type !== 'num') return 'Error'
      const curr = parseFloat(next.value)
      let r: number
      if (t.value === '*') r = prev * curr
      else r = curr !== 0 ? prev / curr : NaN
      if (isNaN(r)) return 'Error'
      mulDiv.push({ type: 'num', value: fmtNum(r) })
    } else {
      mulDiv.push(t)
    }
  }

  let result = NaN
  let pendingOp = '+'
  for (const t of mulDiv) {
    if (t.type === 'op') {
      pendingOp = t.value
    } else {
      const val = parseFloat(t.value)
      if (isNaN(val)) return 'Error'
      if (isNaN(result)) {
        result = val
      } else if (pendingOp === '+') {
        result += val
      } else {
        result -= val
      }
    }
  }
  if (isNaN(result)) return 'Error'
  return fmtNum(result)
}

export function fmtNum(n: number): string {
  if (!isFinite(n)) return 'Error'
  if (Number.isInteger(n)) return String(n)
  return parseFloat(n.toPrecision(12)).toString()
}

// ── 粘贴 / 键盘流式输入 ──
// 按字符流顺序输入（与键盘一致）：数字/小数点直接输入，运算符进入下一操作数。
// 支持 × ÷ − – — x X 等常见符号；千分位逗号、空格、无法识别的字符直接忽略。

/** 单字符归一化：返回可输入的 数字 / . / + - * /，无法识别返回 null */
export function normalizeChar(ch: string): string | null {
  if ((ch >= '0' && ch <= '9') || ch === '.') return ch
  if (ch === '+') return '+'
  if (ch === '-' || ch === '−' || ch === '–' || ch === '—') return '-'
  if (ch === '/' || ch === '÷') return '/'
  if (ch === '*' || ch === '×' || ch === 'x' || ch === 'X') return '*'
  return null
}

/** 粘贴 / 流式输入：结尾不是运算符时自动求值，保留「整段算式粘贴出结果」的体验 */
export function pasteInput(s: CalcState, text: string): void {
  let hasOp = false
  let lastValid = ''
  for (const ch of text) {
    const c = normalizeChar(ch)
    if (c === null) continue
    if (isOpChar(c)) hasOp = true
    lastValid = c
  }
  for (const ch of text) {
    const c = normalizeChar(ch)
    if (c === null) continue
    if (c === '.') appendDot(s)
    else if (isOpChar(c)) appendOp(s, c)
    else appendNum(s, c)
  }
  if (hasOp && !isOpChar(lastValid)) evaluate(s)
}
