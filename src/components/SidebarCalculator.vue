<template>
  <div class="sidebar-calc">
    <button class="calc-toggle" @click="open = !open" title="展开后可直接 Ctrl+V 粘贴算式计算">
      <span><AppIcon icon="calculator" :size="12" /> 计算器</span>
      <span class="calc-chevron" :class="{ 'calc-chevron--open': open }"><AppIcon icon="chevron-right" :size="10" /></span>
    </button>
    <div class="calc-body" v-show="open">
      <div class="calc-display">
        <span class="calc-expr">{{ expression || '&nbsp;' }}</span>
        <span class="calc-result">{{ result }}</span>
      </div>
      <div class="calc-grid">
        <button class="calc-btn calc-btn--fn" @click="pressClear">C</button>
        <button class="calc-btn calc-btn--fn" @click="pressClearEntry">CE</button>
        <button class="calc-btn calc-btn--fn" @click="pressBackspace" title="退格（Backspace）：删当前数最后一位，或回退上一个运算符">⌫</button>
        <button class="calc-btn calc-btn--op" @click="pressOp('/')">÷</button>

        <button class="calc-btn" @click="pressNum('7')">7</button>
        <button class="calc-btn" @click="pressNum('8')">8</button>
        <button class="calc-btn" @click="pressNum('9')">9</button>
        <button class="calc-btn calc-btn--op" @click="pressOp('*')">×</button>

        <button class="calc-btn" @click="pressNum('4')">4</button>
        <button class="calc-btn" @click="pressNum('5')">5</button>
        <button class="calc-btn" @click="pressNum('6')">6</button>
        <button class="calc-btn calc-btn--op" @click="pressOp('-')">−</button>

        <button class="calc-btn" @click="pressNum('1')">1</button>
        <button class="calc-btn" @click="pressNum('2')">2</button>
        <button class="calc-btn" @click="pressNum('3')">3</button>
        <button class="calc-btn calc-btn--op" @click="pressOp('+')">+</button>

        <button class="calc-btn calc-btn--zero" @click="pressNum('0')">0</button>
        <button class="calc-btn" @click="pressDot">.</button>
        <button class="calc-btn calc-btn--eq" @click="pressEvaluate">=</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import {
  createCalcState, expressionText, appendNum, appendDot, appendOp,
  evaluate, clearCalc, clearEntry, backspace, pasteInput,
} from '@/utils/calculator'

const open = ref(false)

const state = ref(createCalcState())

const expression = computed(() => expressionText(state.value))
const result = computed(() => state.value.currentNumber)

// 纯函数工具层为 (state, arg) 签名，模板点击需绑定当前 state
function pressNum(k: string) { appendNum(state.value, k) }
function pressOp(op: string) { appendOp(state.value, op) }
function pressDot() { appendDot(state.value) }
function pressEvaluate() { evaluate(state.value) }
function pressClear() { clearCalc(state.value) }
function pressClearEntry() { clearEntry(state.value) }
function pressBackspace() { backspace(state.value) }

// 计算器展开且焦点不在输入框/可编辑元素时：数字键/运算符/回车/退格/清除直接操作计算器；Ctrl+V 读剪贴板流式输入
function onGlobalKeydown(e: KeyboardEvent) {
  if (!open.value) return
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
  if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
    e.preventDefault()
    window.electronAPI.readClipboardText().then(text => {
      if (text) pasteInput(state.value, text)
    }).catch(() => {})
    return
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (e.key >= '0' && e.key <= '9') { e.preventDefault(); appendNum(state.value, e.key); return }
  if (e.key === '.') { e.preventDefault(); appendDot(state.value); return }
  const op = { '+': '+', '-': '-', '*': '*', '/': '/' }[e.key]
  if (op) { e.preventDefault(); appendOp(state.value, op); return }
  if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); evaluate(state.value); return }
  if (e.key === 'Backspace') { e.preventDefault(); backspace(state.value); return }
  if (e.key === 'Escape') { e.preventDefault(); clearCalc(state.value); return }
  if (e.key === 'Delete') { e.preventDefault(); clearEntry(state.value); return }
  if (e.key.toLowerCase() === 'c') { e.preventDefault(); clearCalc(state.value); return }
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
  border-bottom: 1px solid var(--color-border-light);
}

.calc-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 5px 8px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.12s ease;
}
.calc-toggle:hover {
  background: var(--color-surface-2);
  color: var(--color-text);
}
.calc-toggle:focus-visible {
  outline: 2px solid var(--color-accent-ring);
  outline-offset: 1px;
}

.calc-chevron {
  font-size: var(--text-micro);
  transition: transform 0.15s;
  display: inline-flex;
  align-items: center;
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
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm);
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-height: 46px;
  justify-content: center;
}

.calc-expr {
  font-size: var(--text-micro);
  color: var(--color-text-tertiary);
  min-height: 14px;
  line-height: 14px;
}

.calc-result {
  font-size: var(--text-lg);
  font-weight: 650;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.calc-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 3px;
}

.calc-btn {
  padding: 6px 0;
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  background: var(--color-surface-2);
  color: var(--color-text);
  transition: all 0.12s ease;
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
  font-size: var(--text-micro);
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
  font-size: var(--text-md);
}

.calc-btn--eq:hover {
  background: var(--color-accent-hover);
}

.calc-btn--zero {
  grid-column: span 2;
}
</style>
