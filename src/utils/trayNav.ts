/**
 * 托盘指令 → 攻略页分类的中转。
 * GameGuide 是懒加载 + keep-alive 组件：托盘事件发出时它可能尚未挂载，
 * 分类先暂存于此，GameGuide 挂载后再消费；已挂载时通过 window 自定义事件即时接收。
 */
export const GUIDE_OPEN_EVENT = 'sgbuddy:guide-open'

let pendingGuideCat = ''

export function setPendingGuideCat(cat: string): void {
  pendingGuideCat = cat
}

export function consumePendingGuideCat(): string {
  const cat = pendingGuideCat
  pendingGuideCat = ''
  return cat
}
