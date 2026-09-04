import { reactive } from 'vue'

/**
 * 全局二次确认弹窗（Promise 化，替代原生 window.confirm）。
 *
 * 用法：
 *   import { appConfirm } from '@/utils/confirm'
 *   if (!(await appConfirm({ message: '确定删除？', danger: true }))) return
 *
 * 弹窗 UI 由 ConfirmDialog.vue 渲染（挂载于 App.vue，全局唯一实例）。
 */

export interface ConfirmOptions {
  /** 弹窗标题，默认「操作确认」；危险操作建议「确认删除」等 */
  title?: string
  /** 正文内容，支持 \n 换行 */
  message: string
  /** 确认按钮文字，默认「确定」 */
  confirmText?: string
  /** 取消按钮文字，默认「取消」 */
  cancelText?: string
  /** 危险操作（删除/重置等）时为 true，确认按钮显示为红色 */
  danger?: boolean
}

interface ConfirmState {
  visible: boolean
  title: string
  message: string
  confirmText: string
  cancelText: string
  danger: boolean
  resolve: ((value: boolean) => void) | null
}

export const confirmState = reactive<ConfirmState>({
  visible: false,
  title: '操作确认',
  message: '',
  confirmText: '确定',
  cancelText: '取消',
  danger: false,
  resolve: null,
})

/** 弹出确认框，返回 Promise<boolean>：点击确认/回车 → true，取消/Esc/点遮罩 → false */
export function appConfirm(options: ConfirmOptions): Promise<boolean> {
  // 已有弹窗未决时，先按取消结算上一个（防御性，正常流程不会走到）
  if (confirmState.resolve) {
    confirmState.resolve(false)
    confirmState.resolve = null
  }
  confirmState.title = options.title ?? '操作确认'
  confirmState.message = options.message
  confirmState.confirmText = options.confirmText ?? '确定'
  confirmState.cancelText = options.cancelText ?? '取消'
  confirmState.danger = options.danger ?? false
  confirmState.visible = true
  return new Promise((resolve) => {
    confirmState.resolve = resolve
  })
}

/** 供 ConfirmDialog 内部调用：结算并关闭弹窗 */
export function settleConfirm(value: boolean) {
  if (!confirmState.visible) return
  confirmState.visible = false
  const resolve = confirmState.resolve
  confirmState.resolve = null
  resolve?.(value)
}
