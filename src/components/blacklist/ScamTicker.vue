<template>
  <div v-if="visible" class="scam-ticker" :class="{ 'scam-ticker--paused': paused }">
    <span class="ticker-badge">
      <AppIcon icon="alert" :size="12" />
      <span>防骗黑名单</span>
    </span>
    <div
      class="ticker-viewport"
      title="点击打开 游戏攻略 → 防骗黑名单"
      @click="openPanel"
      @mouseenter="paused = true"
      @mouseleave="paused = false"
    >
      <div class="ticker-track" :style="{ animationDuration: duration + 's' }">
        <span v-for="(item, i) in loopItems" :key="i" class="ticker-item" :title="item.description">
          <span class="ticker-server">【{{ serverLabel(item.server_id) }}】</span>
          <span class="ticker-name">{{ item.role_name }}</span>
          <span class="ticker-method">{{ item.method }}</span>
          <span class="ticker-desc" v-if="item.description">{{ item.description }}</span>
        </span>
      </div>
    </div>
    <button
      class="ticker-close"
      title="关闭滚动（可在 游戏攻略 → 防骗黑名单 重新开启）"
      @click="close"
    >
      <AppIcon icon="x" :size="12" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/ui/AppIcon.vue'
import { useAppStore } from '@/stores'
import { SCAM_GLOBAL_SERVER_ID, useBlacklistStore } from '@/stores/blacklist'
import { GUIDE_OPEN_EVENT, setPendingGuideCat } from '@/utils/trayNav'

const SCAM_CAT_KEY = 'anti-scam'

const router = useRouter()
const app = useAppStore()
const store = useBlacklistStore()

const paused = ref(false)

const visible = computed(() => store.tickerEnabled && store.tickerItems.length > 0)

// 无缝循环：先把列表重复到足够宽（≥4 条，避免窄内容右侧留白），再整体复制两份，
// 轨道从 0 平移到 -50% 后归位，肉眼无缝
const loopItems = computed(() => {
  const base = store.tickerItems
  if (base.length === 0) return []
  let copy = [...base]
  while (copy.length < 4) copy = [...copy, ...base]
  return [...copy, ...copy]
})

// 按条目数量估算轨道宽度，控制在约 90px/s 的阅读速度
const duration = computed(() => Math.max(16, Math.round((loopItems.value.length / 2) * 3.6)))

function serverLabel(serverId: number) {
  if (serverId === SCAM_GLOBAL_SERVER_ID) return '通用'
  return app.servers.find(s => s.id === serverId)?.name || `大区${serverId}`
}

function openPanel() {
  // 与托盘打开攻略分类同一条通道：GameGuide 未挂载时暂存、挂载时消费，已挂载则事件直达
  setPendingGuideCat(SCAM_CAT_KEY)
  window.dispatchEvent(new CustomEvent(GUIDE_OPEN_EVENT, { detail: SCAM_CAT_KEY }))
  router.push('/guides')
}

function close() {
  store.setTickerEnabled(false)
}

onMounted(() => {
  store.loadTickerItems(app.currentServerId)
})

watch(() => app.currentServerId, (sid) => { store.loadTickerItems(sid) })
watch(() => store.dataVersion, () => { store.loadTickerItems(app.currentServerId) })
</script>

<style scoped>
/* 固定在内容区底部（侧边栏右侧），不随内容滚动；
   高度与 main-content 底部内边距一致，滚到底时不遮挡内容 */
.scam-ticker {
  position: fixed;
  left: var(--sidebar-width);
  right: 0;
  bottom: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 32px;
  padding: 0 10px 0 12px;
  /* 不透明底色叠加警示色调，内容从条上滚过时不透底 */
  background: linear-gradient(var(--color-warning-bg), var(--color-warning-bg)) var(--color-surface-1);
  border-top: 1px solid var(--color-border);
}

.ticker-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  background: var(--color-warning-bg);
  color: var(--color-warning);
  font-size: var(--text-micro);
  font-weight: 600;
}

.ticker-viewport {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  cursor: pointer;
}

.ticker-track {
  display: inline-flex;
  white-space: nowrap;
  will-change: transform;
  animation: scam-ticker-scroll linear infinite;
}

.scam-ticker--paused .ticker-track {
  animation-play-state: paused;
}

@keyframes scam-ticker-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

.ticker-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: 46px;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.ticker-server {
  color: var(--color-text-tertiary);
}

.ticker-name {
  color: var(--color-warning);
  font-weight: 600;
}

.ticker-method {
  color: var(--color-danger);
}

.ticker-desc {
  max-width: 380px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ticker-close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.ticker-close:hover {
  background: var(--color-hover);
  color: var(--color-text);
}
</style>
