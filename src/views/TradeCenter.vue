<template>
  <div class="page">
    <div class="page-head">
      <h2>交易中心</h2>
      <p>物价记录、利润计算、持仓管理</p>
    </div>

    <div class="layout layout--2col">
      <!-- 左：功能导航 -->
      <div class="card card--compact">
        <div class="card-head"><h3>功能</h3></div>
        <div class="tab-list">
          <div
            v-for="t in tabs" :key="t.key"
            class="tab-row"
            :class="{ 'tab-row--active': activeTab === t.key }"
            @click="activeTab = t.key"
          >
            <span class="tab-row-icon"><AppIcon :icon="t.icon" :size="14" /></span>
            <span>{{ t.label }}</span>
          </div>
        </div>
      </div>

      <!-- 右：内容 -->
      <div class="card">
        <template v-if="activeTab === 'prices'">
          <div class="card-head"><h3>物价本</h3></div>
          <div class="hint">物价记录功能开发中 — 将支持按区服/分类记录物品价格，展示历史曲线</div>
        </template>
        <template v-if="activeTab === 'profit'">
          <div class="card-head"><h3>利润计算器</h3></div>
          <div class="hint">利润计算功能开发中 — 将支持一键计算含税到手利润</div>
        </template>
        <template v-if="activeTab === 'inventory'">
          <div class="card-head"><h3>持仓库存</h3></div>
          <div class="hint">库存管理功能开发中 — 将支持记录持仓、追踪目标卖出价</div>
        </template>
        <template v-if="activeTab === 'logs'">
          <div class="card-head"><h3>交易日志</h3></div>
          <div class="hint">交易日志功能开发中 — 将支持每笔买卖记录、盈亏汇总</div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from '@/components/ui/AppIcon.vue'
const tabs = [
  { key: 'prices', label: '物价本', icon: 'copy' },
  { key: 'profit', label: '利润计算器', icon: 'calculator' },
  { key: 'inventory', label: '持仓库存', icon: 'package' },
  { key: 'logs', label: '交易日志', icon: 'edit' },
]
const activeTab = ref('prices')
</script>

<style scoped>
.page { height: 100%; display: flex; flex-direction: column; }
.page-head { margin-bottom: 22px; }
.page-head h2 { font-size: var(--text-lg); font-weight: 650; letter-spacing: -0.01em; }
.page-head p { color: var(--color-text-secondary); font-size: var(--text-sm); margin-top: 4px; }

.layout--2col {
  flex: 1; display: grid;
  grid-template-columns: 180px 1fr;
  gap: 14px; min-height: 0;
}

/* ── 卡片 ── */
.card {
  background: var(--color-surface-1);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  padding: 18px 20px;
  display: flex; flex-direction: column;
  overflow-y: auto;
}
.card--compact { padding: 16px; }
.card-head { margin-bottom: 12px; }
.card-head h3 { font-size: var(--text-md); font-weight: 600; }

/* ── 标签 ── */
.tab-list { display: flex; flex-direction: column; gap: 2px; }
.tab-row {
  display: flex; align-items: center; gap: 9px;
  padding: 8px 10px; border-radius: var(--radius-sm);
  cursor: pointer; font-size: var(--text-xs); color: var(--color-text-secondary);
  transition: all 0.1s ease;
}
.tab-row:hover { background: var(--color-surface-2); color: var(--color-text); }
.tab-row--active {
  background: var(--color-accent-bg); color: var(--color-accent);
  font-weight: 500;
}
.tab-row-icon { font-size: var(--text-md); line-height: 1; }

/* ── 通用 ── */
.hint {
  color: var(--color-text-tertiary); text-align: center;
  padding: 48px 20px; font-size: var(--text-xs);
  flex: 1; display: flex; align-items: center; justify-content: center;
}
</style>
