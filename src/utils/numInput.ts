import { nextTick } from 'vue'
import type { ObjectDirective } from 'vue'

type NumInputEl = HTMLInputElement & {
  _numValue?: unknown
  _numBlurBound?: boolean
}

// 把状态值写回输入框；与当前内容一致时不写，避免无谓打断光标
function syncFromState(el: NumInputEl) {
  const next = el._numValue == null ? '' : String(el._numValue)
  if (el.value !== next) el.value = next
}

/**
 * 数字输入框取值绑定，用来替代 `:value`（带聚焦保护）。
 *
 * 为什么不能直接用 `:value`：Vue 的 patchDOMProp 对 value 只比较
 * 「DOM 当前字符串 ≠ 新状态值」就无条件覆盖，没有聚焦判断——
 * 而 `v-model` 内部的 vModelText.updated 是有的（activeElement 是自己时直接 return）。
 * 于是 `:value` + `@input` 的受控写法下，任意一次重渲染都会把用户正在输入的内容顶掉：
 *   - 清空重输时被立刻填回默认值/满额，退格删不掉；
 *   - 小数点打不进去——`<input type="number">` 在「1.」这种中间态下 `.value` 读出空串，
 *     setter 当成清空回落默认值，再被写回 DOM。
 *
 * 本指令只在输入框未聚焦时回写；失焦后再用状态值同步一次，
 * 把 setter 做过的钳制/回落（如「清空 = 回满额」）补显出来。
 */
export const vNum: ObjectDirective<NumInputEl> = {
  mounted(el, binding) {
    el._numValue = binding.value
    if (!el._numBlurBound) {
      el._numBlurBound = true
      // change 先于 blur 触发，等 Vue 把 setter 引发的状态更新渲染完再回写，否则会闪一下旧值
      el.addEventListener('blur', () => { nextTick(() => syncFromState(el)) })
    }
    syncFromState(el)
  },
  updated(el, binding) {
    el._numValue = binding.value
    if (document.activeElement === el) return // 用户正在输入，不抢这个框
    syncFromState(el)
  },
}
