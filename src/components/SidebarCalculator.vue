<template>
  <div class="sidebar-calc">
    <button class="calc-toggle" @click="open = !open" title="展开后可直接 Ctrl+V 粘贴算式计算">
      <span>🔢 计算器</span>
      <span class="calc-chevron" :class="{ 'calc-chevron--open': open }">▸</span>
    </button>
    <div class="calc-body" v-show="open">
      <div class="calc-display">
        <span class="calc-expr">{{ expression || '&nbsp;' }}</span>
        <span class="calc-result">{{ result }}</span>
      </div>
      <div class="calc-grid">
        <button class="calc-btn calc-btn--fn" @click="clear">C</button>
        <button class="calc-btn calc-btn--fn" @click="backspace">CE</button>
        <button class="calc-btn calc-btn--fn" @click="toggleSign">±</button>
        <button class="calc-btn calc-btn--op" @click="appendOp('/')">÷</button>

        <button class="calc-btn" @click="appendNum('7')">7</button>
        <button class="calc-btn" @click="appendNum('8')">8</button>
        <button class="calc-btn" @click="appendNum('9')">9</button>
        <button class="calc-btn calc-btn--op" @click="appendOp('*')">×</button>

        <button class="calc-btn" @click="appendNum('4')">4</button>
        <button class="calc-btn" @click="appendNum('5')">5</button>
        <button class="calc-btn" @click="appendNum('6')">6</button>
        <button class="calc-btn calc-btn--op" @click="appendOp('-')">−</button>

        <button class="calc-btn" @click="appendNum('1')">1</button>
        <button class="calc-btn" @click="appendNum('2')">2</button>
        <button class="calc-btn" @click="appendNum('3')">3</button>
        <button class="calc-btn calc-btn--op" @click="appendOp('+')">+</button>

        <button class="calc-btn calc-btn--zero" @click="appendNum('0')">0</button>
        <button class="calc-btn" @click="appendDot">.</button>
        <button class="calc-btn calc-btn--eq" @click="evaluate">=</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const open = ref(false)

type Token = { type: 'num'; value: string } | { type: 'op'; value: string }

const tokens = ref<Token[]>([])
const currentNumber = ref('0')
const evaluated = ref(false)
const numberDirty = ref(false)
const lastExpression = ref('')

const expression = computed(() => {
  if (evaluated.value) return lastExpression.value + ' ='
  const parts = tokens.value.map(t => t.type === 'op' ? ' ' + t.value + ' ' : t.value)
  let expr = parts.join('')
  if (numberDirty.value) {
    expr += currentNumber.value
  }
  return expr
})

const result = computed(() => currentNumber.value)

function appendNum(n: string) {
  if (evaluated.value) {
    tokens.value = []
    currentNumber.value = n
    evaluated.value = false
    numberDirty.value = true
    return
  }
  if (!numberDirty.value) {
    currentNumber.value = n
    numberDirty.value = true
  } else if (currentNumber.value === '0' && n === '0') {
    return
  } else if (currentNumber.value === '0' && n !== '0') {
    currentNumber.value = n
  } else {
    currentNumber.value += n
  }
}

function appendDot() {
  if (evaluated.value) {
    tokens.value = []
    currentNumber.value = '0.'
    evaluated.value = false
    numberDirty.value = true
    return
  }
  if (!currentNumber.value.includes('.')) {
    currentNumber.value += '.'
    numberDirty.value = true
  }
}

function appendOp(op: string) {
  if (evaluated.value) {
    tokens.value = [{ type: 'num', value: currentNumber.value }]
    evaluated.value = false
  } else if (numberDirty.value) {
    // 用户输入了数字，提交到 tokens
    tokens.value.push({ type: 'num', value: currentNumber.value })
  } else if (tokens.value.length > 0 && tokens.value[tokens.value.length - 1].type === 'op') {
    // 用户没输入新数字，替换上一个运算符
    tokens.value[tokens.value.length - 1] = { type: 'op', value: op }
    return
  }
  tokens.value.push({ type: 'op', value: op })
  currentNumber.value = '0'
  numberDirty.value = false
}

function evaluate() {
  if (tokens.value.length === 0) return
  if (numberDirty.value) {
    tokens.value.push({ type: 'num', value: currentNumber.value })
  } else if (tokens.value[tokens.value.length - 1].type === 'op') {
    const lastNum = tokens.value.length > 1 ? tokens.value[tokens.value.length - 2].value : '0'
    tokens.value.push({ type: 'num', value: lastNum })
  }
  // 保存表达式用于展示
  lastExpression.value = tokens.value.map(t => t.type === 'op' ? ' ' + t.value + ' ' : t.value).join('')
  const res = evaluateTokens(tokens.value)
  tokens.value = []
  currentNumber.value = res
  numberDirty.value = false
  evaluated.value = true
}

function evaluateTokens(list: Token[]): string {
  // 两轮：先算 * /，再算 + -
  const mulDiv: Token[] = []
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

  // 第二轮：+ -
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

function fmtNum(n: number): string {
  if (!isFinite(n)) return 'Error'
  if (Number.isInteger(n)) return String(n)
  return parseFloat(n.toPrecision(12)).toString()
}

function toggleSign() {
  if (currentNumber.value === '0') return
  if (currentNumber.value.startsWith('-')) {
    currentNumber.value = currentNumber.value.slice(1)
  } else {
    currentNumber.value = '-' + currentNumber.value
  }
}

function clear() {
  tokens.value = []
  currentNumber.value = '0'
  numberDirty.value = false
  evaluated.value = false
  lastExpression.value = ''
}

function backspace() {
  if (evaluated.value) return
  if (currentNumber.value.length === 1 || (currentNumber.value.length === 2 && currentNumber.value.startsWith('-'))) {
    currentNumber.value = '0'
    numberDirty.value = false
  } else {
    currentNumber.value = currentNumber.value.slice(0, -1)
  }
}

// ── 粘贴 / 键盘输入 ──
// 粘贴按"字符流"顺序输入（与键盘一致）：数字/小数点直接输入，运算符进入下一操作数——
// 修复 2026-08-23 两个 bug：粘贴第二串数字时不再清空已有表达式；支持键盘直接输入。
// 粘贴内容含运算符时输入完毕自动求值（保留"整段算式粘贴出结果"的体验）。
// 支持 × ÷ − – — x X 等常见符号；千分位逗号、空格、无法识别的字符直接忽略

// 单字符归一化：返回可输入的 数字/. / + - * /，无法识别返回 null
function normalizeChar(ch: string): string | null {
  if (ch >= '0' && ch <= '9' || ch === '.') return ch
  if (ch === '+' ) return '+'
  if (ch === '-' || ch === '−' || ch === '–' || ch === '—') return '-'
  if (ch === '/' || ch === '÷') return '/'
  if (ch === '*' || ch === '×' || ch === 'x' || ch === 'X') return '*'
  return null
}

function pasteInput(text: string) {
  let hasOp = false
  let lastValid = ''
  for (const ch of text) {
    const c = normalizeChar(ch)
    if (c === null) continue
    if (c === '+' || c === '-' || c === '*' || c === '/') hasOp = true
    lastValid = c
  }
  for (const ch of text) {
    const c = normalizeChar(ch)
    if (c === null) continue
    if (c === '.') appendDot()
    else if (c === '+' || c === '-' || c === '*' || c === '/') appendOp(c)
    else appendNum(c)
  }
  // 整段算式粘贴 → 自动求值（原体验保留）；结尾是运算符（如 "123+"）则保持等待输入，不补算
  if (hasOp && lastValid !== '+' && lastValid !== '-' && lastValid !== '*' && lastValid !== '/') {
    evaluate()
  }
}

// 计算器展开且焦点不在输入框/可编辑元素时：数字键/运算符/回车/退格/清除直接操作计算器；Ctrl+V 读剪贴板流式输入
function onGlobalKeydown(e: KeyboardEvent) {
  if (!open.value) return
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
  if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
    e.preventDefault()
    window.electronAPI.readClipboardText().then(text => {
      if (text) pasteInput(text)
    }).catch(() => {})
    return
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (e.key >= '0' && e.key <= '9') { e.preventDefault(); appendNum(e.key); return }
  if (e.key === '.') { e.preventDefault(); appendDot(); return }
  const op = { '+': '+', '-': '-', '*': '*', '/': '/' }[e.key]
  if (op) { e.preventDefault(); appendOp(op); return }
  if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); evaluate(); return }
  if (e.key === 'Backspace') { e.preventDefault(); backspace(); return }
  if (e.key === 'Escape' || e.key === 'Delete' || e.key.toLowerCase() === 'c') { e.preventDefault(); clear(); return }
}

onMounted(() => document.addEventListener('keydown', onGlobalKeydown))
onUnmounted(() => document.removeEventListener('keydown', onGlobalKeydown))
</script>

<style scoped>
.sidebar-calc {
  padding: 4px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  -webkit-app-region: no-drag;
  border-bottom: 0.5px solid var(--color-border);
}

.calc-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 5px 8px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.12s;
}
.calc-toggle:hover {
  background: var(--color-surface-2);
  color: var(--color-text);
}

.calc-chevron {
  font-size: 10px;
  transition: transform 0.15s;
  display: inline-block;
}
.calc-chevron--open {
  transform: rotate(90deg);
}

.calc-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.calc-display {
  background: var(--color-surface-2);
  border: 0.5px solid var(--color-border);
  border-radius: 6px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-height: 46px;
  justify-content: center;
}

.calc-expr {
  font-size: 10px;
  color: var(--color-text-tertiary);
  min-height: 14px;
  line-height: 14px;
}

.calc-result {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}

.calc-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 3px;
}

.calc-btn {
  padding: 6px 0;
  border: none;
  border-radius: 5px;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  background: var(--color-surface-2);
  color: var(--color-text);
  transition: all 0.1s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.calc-btn:hover {
  background: var(--color-surface-3);
}

.calc-btn:active {
  transform: scale(0.95);
  opacity: 0.8;
}

.calc-btn--fn {
  color: var(--color-text-secondary);
  font-size: 11px;
}

.calc-btn--op {
  background: var(--color-accent-bg);
  color: var(--color-accent);
  font-weight: 600;
}

.calc-btn--op:hover {
  background: rgba(94, 106, 210, 0.2);
}

.calc-btn--eq {
  background: var(--color-accent);
  color: #fff;
  font-weight: 600;
  font-size: 15px;
}

.calc-btn--eq:hover {
  background: var(--color-accent-hover);
}

.calc-btn--zero {
  grid-column: span 2;
}
</style>
