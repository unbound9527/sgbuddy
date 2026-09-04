import { describe, it, expect } from 'vitest'
import {
  createCalcState, appendNum, appendDot, appendOp, evaluate, toggleSign,
  clearCalc, clearEntry, backspace, expressionText, evaluateTokens,
} from './calculator'

function cur(n: number | string) {
  return String(n)
}

describe('evaluateTokens 基础运算', () => {
  it('加减乘除 & 优先级', () => {
    expect(evaluateTokens([{ type: 'num', value: '1' }, { type: 'op', value: '+' }, { type: 'num', value: '2' }, { type: 'op', value: '*' }, { type: 'num', value: '3' }])).toBe('7')
    expect(evaluateTokens([{ type: 'num', value: '10' }, { type: 'op', value: '-' }, { type: 'num', value: '4' }, { type: 'op', value: '/' }, { type: 'num', value: '2' }])).toBe('8')
  })
  it('除零返回 Error', () => {
    expect(evaluateTokens([{ type: 'num', value: '1' }, { type: 'op', value: '/' }, { type: 'num', value: '0' }])).toBe('Error')
  })
  it('浮点', () => {
    expect(evaluateTokens([{ type: 'num', value: '0.1' }, { type: 'op', value: '+' }, { type: 'num', value: '0.2' }])).toBe('0.3')
  })
})

describe('退格：录入中的数字', () => {
  it('逐个删除最后一位', () => {
    const s = createCalcState()
    appendNum(s, '1'); appendNum(s, '2'); appendNum(s, '3')
    backspace(s)
    expect(s.currentNumber).toBe('12')
    backspace(s)
    expect(s.currentNumber).toBe('1')
    backspace(s)
    expect(s.currentNumber).toBe('0')
    expect(s.numberDirty).toBe(false)
  })
  it('删除到负号时归零', () => {
    const s = createCalcState()
    appendNum(s, '5'); toggleSign(s) // -5
    expect(s.currentNumber).toBe('-5')
    backspace(s)
    expect(s.currentNumber).toBe('0')
    expect(s.numberDirty).toBe(false)
  })
  it('"1." 删掉点后剩 "1"（dirty 保持）', () => {
    const s = createCalcState()
    appendNum(s, '1'); appendDot(s) // '1.'
    backspace(s)
    expect(s.currentNumber).toBe('1')
    expect(s.numberDirty).toBe(true)
  })
  it('"0." 删除后视为清空当前输入项', () => {
    const s = createCalcState()
    appendDot(s) // '0.'
    backspace(s)
    expect(s.currentNumber).toBe('0')
    expect(s.numberDirty).toBe(false)
  })
})

describe('退格：跨运算符回退（真实计算器手感）', () => {
  it('5+2+ 再退格 → 回到上一步操作数 2', () => {
    const s = createCalcState()
    appendNum(s, '5'); appendOp(s, '+'); appendNum(s, '2'); appendOp(s, '+')
    backspace(s)
    expect(s.currentNumber).toBe('2')
    expect(s.numberDirty).toBe(true)
    // 能继续编辑
    appendNum(s, '3')
    expect(cur(s.currentNumber)).toBe('23')
  })
  it('2+ 再退格 → 回到 2', () => {
    const s = createCalcState()
    appendNum(s, '2'); appendOp(s, '+')
    backspace(s)
    expect(s.currentNumber).toBe('2')
    expect(s.numberDirty).toBe(true)
  })
  it('8- 退格回到 8；继续退格回到 0（无更多可回退）', () => {
    const s = createCalcState()
    appendNum(s, '8'); appendOp(s, '-')
    backspace(s)
    expect(s.currentNumber).toBe('8')
    backspace(s)
    expect(s.currentNumber).toBe('0')
    expect(s.numberDirty).toBe(false)
  })
  it('连续多个运算符时逐层回退（与真实计算器一致）', () => {
    const s = createCalcState()
    // 5 + 5 * / ：末尾连续运算符会被替换，最终等价于 "5 + 5 /"
    appendNum(s, '5'); appendOp(s, '+'); appendNum(s, '5'); appendOp(s, '*'); appendOp(s, '/')
    expect(s.tokens).toHaveLength(4) // [5, +, 5, /]
    // 退格 ① 跨回退：撤掉末尾 / ，回到上一个操作数 5
    backspace(s)
    expect(s.currentNumber).toBe('5')
    expect(s.numberDirty).toBe(true)
    // 退格 ② 删掉该操作数 5 的最后一位 → 变 0
    backspace(s)
    expect(s.currentNumber).toBe('0')
    expect(s.numberDirty).toBe(false)
    // 退格 ③ 无录入数字 → 回退 token 流里的 5（+ 前的那个）
    backspace(s)
    expect(s.currentNumber).toBe('5')
    expect(s.numberDirty).toBe(true)
    // 退格 ④ 再删 5 → 0
    backspace(s)
    expect(s.currentNumber).toBe('0')
    // 退格 ⑤ 撤掉 + → 回到最前面的 5
    backspace(s)
    expect(s.currentNumber).toBe('5')
    // 退格 ⑥ 删 5 → 0（无更多可回退）
    backspace(s)
    expect(s.currentNumber).toBe('0')
  })
})

describe('退格：求值结果态', () => {
  it('12+34= 后退格 → 46 转为可编辑再删一位 → 4', () => {
    const s = createCalcState()
    appendNum(s, '1'); appendNum(s, '2'); appendOp(s, '+'); appendNum(s, '3'); appendNum(s, '4'); evaluate(s)
    expect(s.currentNumber).toBe('46')
    expect(s.evaluated).toBe(true)
    backspace(s)
    expect(s.evaluated).toBe(false)
    expect(s.currentNumber).toBe('4')
    expect(s.numberDirty).toBe(true)
    expect(s.lastExpression).toBe('')
    // 继续可编辑
    appendNum(s, '9')
    expect(cur(s.currentNumber)).toBe('49')
  })
  it('结果再删空归零', () => {
    const s = createCalcState()
    appendNum(s, '8'); appendOp(s, '+'); appendNum(s, '8'); evaluate(s) // 16
    backspace(s)
    expect(s.currentNumber).toBe('1')
    backspace(s)
    expect(s.currentNumber).toBe('0')
  })
})

describe('退格：出错态', () => {
  it('除零 Error 后按退格 → 复位为 0', () => {
    const s = createCalcState()
    appendNum(s, '1'); appendOp(s, '/'); appendNum(s, '0'); evaluate(s)
    expect(s.currentNumber).toBe('Error')
    backspace(s)
    expect(s.currentNumber).toBe('0')
    expect(s.evaluated).toBe(false)
    expect(s.tokens).toHaveLength(0)
  })
})

describe('clearEntry / clearCalc', () => {
  it('CE 只清当前输入项，保留已确认算式', () => {
    const s = createCalcState()
    appendNum(s, '5'); appendOp(s, '+'); appendNum(s, '2'); appendNum(s, '2')
    clearEntry(s)
    expect(s.currentNumber).toBe('0')
    expect(s.numberDirty).toBe(false)
    expect(s.tokens).toHaveLength(2)
    appendNum(s, '4')
    evaluate(s)
    expect(s.currentNumber).toBe('9')
  })
  it('结果态按 CE → 全清（同 C）', () => {
    const s = createCalcState()
    appendNum(s, '5'); appendOp(s, '+'); appendNum(s, '5'); evaluate(s)
    clearEntry(s)
    expect(s.currentNumber).toBe('0')
    expect(s.evaluated).toBe(false)
    expect(s.tokens).toHaveLength(0)
  })
  it('C 全清', () => {
    const s = createCalcState()
    appendNum(s, '5'); appendOp(s, '+'); appendNum(s, '5'); appendOp(s, '-')
    clearCalc(s)
    expect(s.currentNumber).toBe('0')
    expect(s.tokens).toHaveLength(0)
    expect(s.numberDirty).toBe(false)
  })
})

describe('其他既有行为未回归', () => {
  it('toggleSign 结果态取反后能继续运算', () => {
    const s = createCalcState()
    appendNum(s, '5'); appendOp(s, '+'); appendNum(s, '5'); evaluate(s) // 10
    toggleSign(s)
    expect(s.currentNumber).toBe('-10')
    expect(s.numberDirty).toBe(true)
    appendNum(s, '5')
    expect(cur(s.currentNumber)).toBe('-105')
  })
  it('appendNum 结果态直接敲数字 = 新计算', () => {
    const s = createCalcState()
    appendNum(s, '9'); appendOp(s, '+'); appendNum(s, '9'); evaluate(s) // 18
    appendNum(s, '7')
    expect(s.currentNumber).toBe('7')
    expect(s.tokens).toHaveLength(0)
  })
  it('expressionText 求值态拼接等号', () => {
    const s = createCalcState()
    appendNum(s, '5'); appendOp(s, '+'); appendNum(s, '5'); evaluate(s)
    expect(expressionText(s)).toBe('5 + 5 =')
  })
})
