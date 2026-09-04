<template>
  <div class="page">
    <div class="page-head">
      <h2>币价波动</h2>
      <p>{{ appStore.currentServerName }} · 三国币兑换价格走势</p>
    </div>

    <!-- Tab：本区走势 / 全部大区币价 -->
    <div class="rate-tabs">
      <button class="rate-tab" :class="{ 'rate-tab--active': activeTab === 'trend' }" @click="activeTab = 'trend'">本区走势</button>
      <button class="rate-tab" :class="{ 'rate-tab--active': activeTab === 'all' }" @click="showAllTab">全部大区币价</button>
    </div>

    <template v-if="activeTab === 'trend'">
    <div class="card" v-if="rateHistory.length > 0">
      <!-- 统计卡片 -->
      <div class="rate-stats">
        <div class="rate-stat">
          <span class="rate-stat-label">当前</span>
          <!-- 未编辑时点击可修改 -->
          <span
            v-if="!editingCurrent"
            class="rate-stat-value rate-current-clickable"
            @click="startEditCurrent"
            title="点击修改当前币价"
          ><template v-if="appStore.currencyRate">{{ appStore.currencyRate.toFixed(2) }} 元/亿</template><template v-else>未获取到</template></span>
          <!-- 编辑中 -->
          <input
            v-else
            ref="currentInputRef"
            v-model="currentEditValue"
            class="rate-current-input"
            type="number" step="0.1"
            @keydown.enter="saveCurrentRate"
            @keydown.escape="cancelEditCurrent"
            @blur="saveCurrentRate"
          />
        </div>
        <div class="rate-stat">
          <span class="rate-stat-label">最高</span>
          <span class="rate-stat-value text-success">{{ rateMax }} 元/亿</span>
        </div>
        <div class="rate-stat">
          <span class="rate-stat-label">最低</span>
          <span class="rate-stat-value text-danger">{{ rateMin }} 元/亿</span>
        </div>
        <div class="rate-stat">
          <span class="rate-stat-label">记录数</span>
          <span class="rate-stat-value">{{ rateHistory.length }}</span>
        </div>
      </div>

      <!-- 折线图 -->
      <div class="chart-wrap" ref="chartWrapRef">
        <svg
          class="chart"
          :viewBox="`0 0 ${chartW} ${chartH}`"
          preserveAspectRatio="xMidYMid meet"
          @mousemove="onChartHover"
          @mouseleave="onChartLeave"
        >
          <!-- 网格线 -->
          <line
            v-for="(y, i) in yTicks" :key="'g'+i"
            :x1="padL" :y1="y" :x2="chartW - padR" :y2="y"
            stroke="var(--color-border)" stroke-width="0.5" stroke-dasharray="3,3"
          />
          <!-- Y轴标签 -->
          <text
            v-for="(y, i) in yTicks" :key="'yl'+i"
            :x="padL - 6" :y="y + 4"
            text-anchor="end" class="chart-label"
          >{{ yLabels[i] }}</text>
          <!-- X轴标签 -->
          <text
            v-for="(t, i) in xTicks" :key="'xl'+i"
            :x="t.x" :y="chartH - padB + 16"
            text-anchor="middle" class="chart-label"
          >{{ t.label }}</text>

          <!-- 折线下面积 -->
          <polygon
            :points="areaPoints"
            fill="url(#gradient)"
            opacity="0.3"
          />
          <!-- 折线 -->
          <polyline
            :points="linePoints"
            fill="none"
            stroke="var(--color-accent)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <!-- 透明捕获层（仅用于悬浮检测） -->
          <rect
            :x="padL" :y="padT"
            :width="plotW" :height="plotH"
            fill="transparent"
            style="cursor: crosshair"
          />

          <!-- 数据点圆点（可点击编辑；离群点空心描警示色） -->
          <circle
            v-for="(pt, i) in dataPoints" :key="'dp'+i"
            :cx="pt.x" :cy="pt.y" r="4"
            :fill="pt.off ? 'var(--color-bg)' : 'var(--color-accent)'"
            :stroke="pt.off ? 'var(--color-warning)' : 'var(--color-surface-1)'" stroke-width="1.5"
            :stroke-dasharray="pt.off ? '2,1.5' : 'none'"
            style="cursor: pointer"
            @click.stop="onPointClick(i)"
          />
          <!-- 不可见的大热区（方便点击） -->
          <circle
            v-for="(pt, i) in dataPoints" :key="'dh'+i"
            :cx="pt.x" :cy="pt.y" r="10"
            fill="transparent"
            style="cursor: pointer"
            @click.stop="onPointClick(i)"
          />

          <!-- 悬浮竖线 -->
          <line
            v-if="hoverPt"
            :x1="hoverPt.x" :y1="padT"
            :x2="hoverPt.x" :y2="chartH - padB"
            stroke="var(--color-text-tertiary)"
            stroke-width="1"
            stroke-dasharray="4,3"
            opacity="0.6"
          />
          <!-- 悬浮高亮圆点 -->
          <circle
            v-if="hoverPt"
            :cx="hoverPt.x" :cy="hoverPt.y" r="5"
            fill="var(--color-accent)"
            stroke="var(--color-surface-1)" stroke-width="2.5"
          />

          <!-- 最新点标记（无悬浮时显示） -->
          <circle
            v-if="dataPoints.length && !hoverPt"
            :cx="dataPoints[dataPoints.length-1].x"
            :cy="dataPoints[dataPoints.length-1].y" r="5"
            fill="var(--color-accent)"
            stroke="var(--color-surface-1)" stroke-width="2.5"
          />

          <!-- Tooltip（渲染在捕获层之上） -->
          <g v-if="hoverPt" class="chart-tooltip-group">
            <rect
              :x="tooltipBox.x" :y="tooltipBox.y"
              :width="tooltipBox.w" :height="tooltipBox.h"
              rx="4" ry="4"
              fill="var(--color-surface-2)"
              stroke="var(--color-border)" stroke-width="0.5"
              opacity="0.96"
            />
            <text
              :x="tooltipBox.tx" :y="tooltipBox.ty"
              text-anchor="middle" class="chart-tooltip-date"
            >{{ hoverDate }}</text>
            <!-- 普通模式 -->
            <text
              v-if="!isEditing"
              :x="tooltipBox.tx" :y="tooltipBox.ty + 16"
              text-anchor="middle" class="chart-tooltip-value"
              style="cursor: pointer"
            >{{ hoverRate }} 元/亿{{ hoverOff ? '（离群）' : '' }}</text>
            <text
              v-if="!isEditing"
              :x="tooltipBox.tx" :y="tooltipBox.ty + 28"
              text-anchor="middle" class="chart-tooltip-hint"
            >点击修改</text>
          </g>

          <defs>
            <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--color-accent)" stop-opacity="0.4" />
              <stop offset="100%" stop-color="var(--color-accent)" stop-opacity="0.02" />
            </linearGradient>
          </defs>
        </svg>

        <!-- 编辑输入框（绝对定位，HTML 元素） -->
        <input
          v-if="isEditing"
          ref="editInputRef"
          v-model="editValue"
          class="chart-edit-overlay"
          type="number" step="0.1"
          :style="editBoxStyle"
          @keydown.enter="saveEdit"
          @keydown.escape="cancelEdit"
          @blur="saveEdit"
        />
      </div>

      <!-- 离群点说明 -->
      <div class="chart-note" v-if="chartData.offCount > 0">
        <AppIcon icon="alert" :size="11" />
        有 {{ chartData.offCount }} 个离群点超出绘图范围，以空心点贴边标示（数据未丢失，悬浮可查看真实值）
        <button
          class="clean-outliers-btn"
          @click="cleanOutliers"
          :disabled="cleaningOutliers"
          title="从历史记录中删除这些离群点"
        >
          <AppIcon icon="loader" v-if="cleaningOutliers" :size="11" class="icon-spin" />
          <AppIcon icon="trash" v-else :size="11" />
          一键清理离群值
        </button>
      </div>

      <!-- 历史记录（缩小） -->
      <div class="rate-table-wrap">
        <table class="table">
          <thead><tr><th>时间</th><th>币价 (元/亿)</th></tr></thead>
          <tbody>
            <tr v-for="r in rateHistory.slice(0, 30)" :key="r.id">
              <td class="td-muted">{{ r.recorded_at }}</td>
              <td>{{ Number(r.rate).toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="hint" v-else>暂无币价记录 — 在侧边栏修改币价自动记录</div>
    </template>

    <!-- 全部大区币价 -->
    <template v-else>
      <div class="card all-card">
        <div class="all-head">
          <span class="all-summary">
            共 {{ allRates.length }} 个大区 · 已获取 <b>{{ fetchedCount }}</b> 个 · 未获取到 <b>{{ allRates.length - fetchedCount }}</b> 个
          </span>
          <span v-if="allTabMsg" class="all-msg">{{ allTabMsg }}</span>
        </div>
        <div v-if="appStore.taobaoNeedLogin" class="all-login-hint">
          <AppIcon icon="alert" :size="11" />
          淘宝打码了币价（未登录），刷新会拿不到数据，可回侧边栏登录淘宝后重试
        </div>
        <div class="all-table-wrap">
          <table class="table">
            <thead><tr><th>大区</th><th>币价 (元/亿)</th><th>更新时间</th><th class="th-op">操作</th></tr></thead>
            <tbody>
              <tr v-for="s in allRates" :key="s.id" :class="{ 'row-current': s.id === appStore.currentServerId }">
                <td>
                  {{ s.name }}
                  <span v-if="s.id === appStore.currentServerId" class="cur-tag">当前</span>
                </td>
                <td :class="{ 'td-muted': !s.currency_rate }">
                  {{ s.currency_rate ? Number(s.currency_rate).toFixed(2) : '未获取到' }}
                </td>
                <td class="td-muted">{{ s.updated_at || '—' }}</td>
                <td class="td-op">
                  <button
                    class="row-refresh"
                    :disabled="refreshingId !== null"
                    @click="refreshOne(s)"
                    :title="refreshingId === s.id ? '正在抓取…' : '单独刷新该大区币价'"
                  >
                    <AppIcon icon="loader" v-if="refreshingId === s.id" :size="12" class="icon-spin" />
                    <AppIcon icon="refresh" v-else :size="12" />
                    <span>{{ refreshingId === s.id ? '抓取中' : '刷新' }}</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="all-footnote">刷新 = 立即重抓该大区（绕过 3 小时缓存），抓取约需数秒，请勿连续点击多个大区</div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useAppStore } from '@/stores'
import { appConfirm } from '@/utils/confirm'

const appStore = useAppStore()

interface RateRecord { id: number; server_id: number; rate: number; recorded_at: string }
const rateHistory = ref<RateRecord[]>([])

const rateValues = computed(() => rateHistory.value.map(r => r.rate))
const rateMax = computed(() => rateValues.value.length ? Math.max(...rateValues.value).toFixed(2) : '-')
const rateMin = computed(() => rateValues.value.length ? Math.min(...rateValues.value).toFixed(2) : '-')

/* ── 图表参数 ── */
const padL = 48; const padR = 12; const padT = 8; const padB = 28
const chartW = 800; const chartH = 280
const plotW = chartW - padL - padR
const plotH = chartH - padT - padB

const chartData = computed(() => {
  const raw = rateHistory.value.slice().reverse() // oldest → newest
  if (raw.length === 0) return { vals: [] as number[], dates: [] as string[], dMin: 0, dMax: 1, offFlags: [] as boolean[], offCount: 0 }
  const vals = raw.map(r => r.rate)
  const dates = raw.map(r => r.recorded_at?.slice(0, 16) || '')

  // 离群感知的绘图域：主体取 P5~P95 分位带，再外扩 3 倍带宽；
  // 超出域的极值（如个别异常抓取）裁剪绘制，数据本身不丢失（tooltip 仍显示真实值）
  const sorted = vals.slice().sort((a, b) => a - b)
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))]
  let lo = q(0.05)
  let hi = q(0.95)
  if (hi - lo < 1e-9) {
    const allMin = sorted[0]
    const allMax = sorted[sorted.length - 1]
    lo = allMin; hi = allMax
  }
  const band = hi - lo
  const dMin = Math.max(sorted[0], lo - band * 3)
  const dMax = Math.min(sorted[sorted.length - 1], hi + band * 3)
  const offFlags = vals.map(v => v < dMin || v > dMax)
  return { vals, dates, dMin, dMax, offFlags, offCount: offFlags.filter(Boolean).length }
})

const clampY = (v: number) => Math.min(chartData.value.dMax, Math.max(chartData.value.dMin, v))

// 生成 1/2/5×10^n 的整刻度步长
function niceStep(range: number, ticks = 5): number {
  if (range <= 0) return 1
  const raw = range / ticks
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return nice * mag
}

const yTicks = computed(() => {
  const { dMin, dMax } = chartData.value
  const step = niceStep(dMax - dMin)
  const start = Math.ceil(dMin / step) * step
  const ticks: number[] = [padT + plotH] // 域底
  for (let v = start; v <= dMax + 1e-9; v += step) {
    ticks.push(padT + plotH - ((v - dMin) / (dMax - dMin)) * plotH)
  }
  return ticks
})

const yLabels = computed(() => {
  const { dMin, dMax } = chartData.value
  const step = niceStep(dMax - dMin)
  const start = Math.ceil(dMin / step) * step
  const labels: string[] = [dMin.toFixed(1)]
  for (let v = start; v <= dMax + 1e-9; v += step) {
    labels.push(v.toFixed(1))
  }
  return labels
})

const xTicks = computed(() => {
  const { dates } = chartData.value
  if (dates.length <= 1) return []
  const count = Math.min(6, dates.length)
  const ticks: Array<{ x: number; label: string }> = []
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i / (count - 1)) * (dates.length - 1))
    ticks.push({
      x: padL + (idx / Math.max(1, dates.length - 1)) * plotW,
      label: dates[idx]?.slice(5) || ''  // MM-DD HH:MM
    })
  }
  return ticks
})

const dataPoints = computed(() => {
  const { vals, dMin, dMax } = chartData.value
  const range = dMax - dMin || 1
  return vals.map((v, i) => ({
    x: padL + (i / Math.max(1, vals.length - 1)) * plotW,
    y: padT + plotH - ((clampY(v) - dMin) / range) * plotH,
    val: v,
    off: v < dMin || v > dMax,
  }))
})

const linePoints = computed(() => {
  return dataPoints.value.map(p => `${p.x},${p.y}`).join(' ')
})

const areaPoints = computed(() => {
  const pts = dataPoints.value
  if (pts.length === 0) return ''
  const bottom = padT + plotH
  return `${pts[0].x},${bottom} ` + pts.map(p => `${p.x},${p.y}`).join(' ') + ` ${pts[pts.length-1].x},${bottom}`
})

/* ── 悬浮交互 ── */
const chartWrapRef = ref<HTMLElement | null>(null)
const hoverIndex = ref<number | null>(null)

const hoverPt = computed(() => {
  if (hoverIndex.value === null || hoverIndex.value < 0) return null
  const pts = dataPoints.value
  if (pts.length === 0 || hoverIndex.value >= pts.length) return null
  return pts[hoverIndex.value]
})

const hoverDate = computed(() => {
  if (hoverIndex.value === null) return ''
  const { dates } = chartData.value
  return dates[hoverIndex.value] || ''
})

const hoverRate = computed(() => {
  if (hoverIndex.value === null) return ''
  const { vals } = chartData.value
  return vals[hoverIndex.value]?.toFixed(2) ?? ''
})

const hoverOff = computed(() => {
  if (hoverIndex.value === null) return false
  return chartData.value.offFlags[hoverIndex.value] ?? false
})

const tooltipBox = computed(() => {
  if (!hoverPt.value) return { x: 0, y: 0, w: 0, h: 0, tx: 0, ty: 0 }
  const pw = 120; const ph = isEditing.value ? 46 : 52
  let bx = hoverPt.value.x - pw / 2
  if (bx < padL) bx = padL + 2
  if (bx + pw > chartW - padR) bx = chartW - padR - pw - 2
  let by = hoverPt.value.y - ph - 10
  if (by < padT) by = hoverPt.value.y + 14
  return { x: bx, y: by, w: pw, h: ph, tx: bx + pw / 2, ty: by + 16 }
})

function onChartHover(e: MouseEvent) {
  const svg = e.currentTarget as SVGSVGElement
  const rect = svg.getBoundingClientRect()
  const vbW = chartW
  const vbH = chartH
  const mx = ((e.clientX - rect.left) / rect.width) * vbW
  const my = ((e.clientY - rect.top) / rect.height) * vbH
  const pts = dataPoints.value
  if (pts.length === 0) return
  if (mx < padL || mx > chartW - padR || my < padT || my > chartH - padB) {
    // 编辑中不取消悬浮
    if (!isEditing.value) hoverIndex.value = null
    return
  }
  let nearest = 0
  let minDist = Infinity
  for (let i = 0; i < pts.length; i++) {
    const dist = Math.abs(pts[i].x - mx)
    if (dist < minDist) { minDist = dist; nearest = i }
  }
  hoverIndex.value = nearest
}

function onChartLeave() {
  if (!isEditing.value) hoverIndex.value = null
}

/* ── 点击编辑 ── */
const editingIndex = ref<number | null>(null)
const editValue = ref('')
const editInputRef = ref<HTMLInputElement | null>(null)
const isEditing = computed(() => editingIndex.value !== null && editingIndex.value === hoverIndex.value)

// 编辑框 CSS 位置：将 viewBox 坐标映射到 chart-wrap 内像素位置
const editBoxStyle = computed(() => {
  if (!hoverPt.value || !chartWrapRef.value) return { display: 'none' }
  const wrap = chartWrapRef.value
  const svg = wrap.querySelector('svg') as SVGSVGElement | null
  if (!svg) return { display: 'none' }
  const sr = svg.getBoundingClientRect()
  const wr = wrap.getBoundingClientRect()
  const scaleX = sr.width / chartW
  const scaleY = sr.height / chartH
  // viewBox 坐标 → wrap 内像素偏移
  const left = (hoverPt.value.x) * scaleX + (sr.left - wr.left)
  const top = (tooltipBox.value.y + tooltipBox.value.h - 22) * scaleY + (sr.top - wr.top)
  return {
    position: 'absolute' as const,
    left: `${left}px`,
    top: `${top}px`,
    width: `${tooltipBox.value.w * scaleX}px`,
    transform: 'translateX(-50%)',
    zIndex: 10,
  }
})

function onPointClick(idx: number) {
  if (isEditing.value) return
  hoverIndex.value = idx
  editingIndex.value = idx
  editValue.value = chartData.value.vals[idx]?.toFixed(2) ?? ''
}

async function saveEdit() {
  if (editingIndex.value === null) return
  const newRate = parseFloat(editValue.value)
  if (isNaN(newRate) || newRate <= 0) {
    cancelEdit()
    return
  }
  const raw = rateHistory.value.slice()
  const chartIdx = editingIndex.value
  const rawIdx = raw.length - 1 - chartIdx
  if (rawIdx < 0 || rawIdx >= raw.length) { cancelEdit(); return }

  const record = raw[rawIdx]
  const latest = raw[0]
  try {
    await window.electronAPI.dbQuery(
      'UPDATE currency_rate_history SET rate=? WHERE id=?',
      [newRate, record.id]
    )
    // 如果是最近一条，同步更新 servers 表 + 侧边栏（不额外插入历史）
    if (record.id === latest.id) {
      const sid = appStore.currentServerId
      if (sid) {
        await window.electronAPI.dbQuery(
          'UPDATE servers SET currency_rate=? WHERE id=?', [newRate, sid]
        )
      }
    }
  } catch (e) { console.error('修改币价失败:', e) }

  editingIndex.value = null
  editValue.value = ''
  await loadRateHistory()
  // 刷新侧边栏显示（重新从 DB 加载当前币价）
  if (record.id === latest.id) {
    const sid = appStore.currentServerId
    const name = appStore.currentServerName
    if (sid && name) await appStore.reloadCurrencyRate(sid, name)
  }
}

function cancelEdit() {
  editingIndex.value = null
  editValue.value = ''
}

/* ── 编辑当前币价（统计卡片） ── */
const editingCurrent = ref(false)
const currentEditValue = ref('')
const currentInputRef = ref<HTMLInputElement | null>(null)

function startEditCurrent() {
  if (!appStore.currencyRate) return
  currentEditValue.value = String(appStore.currencyRate)
  editingCurrent.value = true
  nextTick(() => {
    currentInputRef.value?.focus()
    currentInputRef.value?.select()
  })
}

async function saveCurrentRate() {
  if (!editingCurrent.value) return
  const newRate = parseFloat(currentEditValue.value)
  if (isNaN(newRate) || newRate <= 0) {
    cancelEditCurrent()
    return
  }
  // 通过 store 更新（会同时更新 servers 表 + 插入历史记录 + 刷新侧边栏）
  appStore.setCurrencyRate(newRate)
  editingCurrent.value = false
  currentEditValue.value = ''
  await loadRateHistory()
}

function cancelEditCurrent() {
  editingCurrent.value = false
  currentEditValue.value = ''
}

/* ── 一键清理离群值：删除图表中标为离群（超出 P5~P95 ± 3 倍带宽绘图域）的历史记录 ── */
const cleaningOutliers = ref(false)

async function cleanOutliers() {
  if (cleaningOutliers.value) return
  const { dMin, dMax } = chartData.value
  const outliers = rateHistory.value.filter(r => r.rate < dMin || r.rate > dMax)
  if (!outliers.length) return
  // 预览去重后的离群值（最多展示 5 个）
  const uniq = [...new Set(outliers.map(r => Number(r.rate).toFixed(2)))]
  const preview = uniq.slice(0, 5).join('、') + (uniq.length > 5 ? ` 等 ${uniq.length} 种` : '')
  const ok = await appConfirm({
    title: '清理离群值',
    message: `将删除 ${outliers.length} 条离群记录（${preview}）。\n\n此操作不可恢复。`,
    confirmText: '删除',
    danger: true,
  })
  if (!ok) return
  cleaningOutliers.value = true
  try {
    const ids = outliers.map(r => r.id)
    await window.electronAPI.dbQuery(
      `DELETE FROM currency_rate_history WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids
    )
    // 若最新一条被删（它是侧边栏「当前值」的来源），把 servers 回退到剩余最新一条（无剩余则置 0 = 未获取到）
    const latest = rateHistory.value[0]
    if (outliers.some(r => r.id === latest.id)) {
      const next = rateHistory.value.find(r => !ids.includes(r.id)) // DESC 序 → 剩余最新
      const sid = appStore.currentServerId
      if (sid) {
        await window.electronAPI.dbQuery(
          'UPDATE servers SET currency_rate=? WHERE id=?', [next ? next.rate : 0, sid]
        )
        if (appStore.currentServerName) {
          await appStore.reloadCurrencyRate(sid, appStore.currentServerName)
        }
      }
    }
  } catch (e) {
    console.error('清理离群值失败:', e)
  } finally {
    cleaningOutliers.value = false
  }
  await loadRateHistory()
}

watch(isEditing, async (val) => {
  if (val) {
    await nextTick()
    editInputRef.value?.focus()
    editInputRef.value?.select()
  }
})

async function loadRateHistory() {
  try {
    const sid = appStore.currentServerId
    if (!sid) { rateHistory.value = []; return }
    rateHistory.value = await window.electronAPI.dbQuery(
      'SELECT * FROM currency_rate_history WHERE server_id=? ORDER BY recorded_at DESC',
      [sid]
    ) as RateRecord[]
  } catch (e) { console.error('加载币价历史失败:', e) }
}

onMounted(() => {
  appStore.loadServers()
  loadRateHistory()
})

watch(() => appStore.currentServerId, () => {
  loadRateHistory()
})

/* ── 全部大区币价 tab ── */
const activeTab = ref<'trend' | 'all'>('trend')
interface ServerRateRow { id: number; name: string; currency_rate: number; updated_at: string | null }
const allRates = ref<ServerRateRow[]>([])
const refreshingId = ref<number | null>(null)
const allTabMsg = ref('')
const fetchedCount = computed(() => allRates.value.filter(s => s.currency_rate > 0).length)

async function loadAllRates() {
  try {
    allRates.value = await window.electronAPI.dbQuery(`
      SELECT s.id, s.name, s.currency_rate,
        (SELECT h.recorded_at FROM currency_rate_history h WHERE h.server_id = s.id ORDER BY h.recorded_at DESC LIMIT 1) AS updated_at
      FROM servers s ORDER BY s.id
    `) as ServerRateRow[]
  } catch (e) { console.error('加载各大区币价失败:', e) }
}

async function showAllTab() {
  activeTab.value = 'all'
  allTabMsg.value = ''
  await loadAllRates()
}

/** 单独刷新某个大区：force=true 绕过 3 小时缓存，立即重抓 */
async function refreshOne(s: ServerRateRow) {
  if (refreshingId.value !== null) return
  refreshingId.value = s.id
  allTabMsg.value = ''
  try {
    const res = await window.electronAPI.scrapeOne(s.name, true)
    if (res?.needLogin) {
      appStore.taobaoNeedLogin = true
      allTabMsg.value = `${s.name}：淘宝打码了币价（未登录），请先在侧边栏登录淘宝`
    } else if (res?.price) {
      allTabMsg.value = `${s.name}：已更新为 ${Number(res.price).toFixed(2)} 元/亿`
    } else if (res?.error) {
      allTabMsg.value = `${s.name}：抓取出错，请稍后重试`
      console.error('单独刷新币价失败:', res.error)
    } else {
      allTabMsg.value = `${s.name}：未获取到可信币价（宁缺毋滥，可稍后重试）`
    }
    await loadAllRates()
    // 刷新的是当前大区时，同步侧边栏显示
    if (s.id === appStore.currentServerId) {
      await appStore.reloadCurrencyRate(s.id, s.name)
    }
  } catch (e) {
    console.error('单独刷新币价失败:', e)
    allTabMsg.value = `${s.name}：刷新出错`
  } finally {
    refreshingId.value = null
  }
}
</script>

<style scoped>
.page { height: 100%; display: flex; flex-direction: column; }
.page-head { margin-bottom: 22px; }
.page-head h2 { font-size: var(--text-lg); font-weight: 650; letter-spacing: -0.01em; }
.page-head p { color: var(--color-text-secondary); font-size: var(--text-sm); margin-top: 4px; }

.card {
  flex: 1; background: var(--color-surface-1);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  padding: 18px 20px; display: flex; flex-direction: column;
  overflow-y: auto; min-height: 0;
}

/* ── 统计卡片 ── */
.rate-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; flex-shrink: 0; }
.rate-stat {
  padding: 10px 12px; border-radius: var(--radius-sm);
  background: var(--color-slot-bg); text-align: center;
  display: flex; flex-direction: column; gap: 4px;
}
.rate-stat-label { font-size: var(--text-micro); color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.03em; }
.rate-stat-value { font-size: var(--text-md); font-weight: 650; letter-spacing: -0.02em; }
.rate-current-clickable { cursor: pointer; border-bottom: 1px dashed var(--color-text-tertiary); }
.rate-current-clickable:hover { color: var(--color-accent); border-bottom-color: var(--color-accent); }
.rate-current-input {
  width: 90px; padding: 2px 4px; font-size: var(--text-md); font-weight: 650; font-family: inherit;
  text-align: center; background: var(--color-surface-1); color: var(--color-text);
  border: 1px solid var(--color-accent); border-radius: var(--radius-sm); outline: none;
  -moz-appearance: textfield;
}
.rate-current-input::-webkit-inner-spin-button,
.rate-current-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

/* ── 折线图 ── */
.chart-wrap { flex-shrink: 0; margin-bottom: 12px; position: relative; }
.chart { width: 100%; height: auto; display: block; }
.chart-label { font-size: var(--text-micro); fill: var(--color-text-tertiary); font-family: inherit; }
.chart-tooltip-date { font-size: var(--text-micro); fill: var(--color-text-tertiary); font-family: inherit; }
.chart-tooltip-value { font-size: var(--text-sm); font-weight: 650; fill: var(--color-text); font-family: inherit; }
.chart-tooltip-group { pointer-events: none; }
.chart-tooltip-hint { font-size: var(--text-micro); fill: var(--color-text-tertiary); font-family: inherit; opacity: 0.7; }
.chart-edit-overlay {
  font-family: inherit; font-size: var(--text-xs); font-weight: 650;
  text-align: center; padding: 2px 6px; height: 24px;
  background: var(--color-surface-1); color: var(--color-text);
  border: 1px solid var(--color-accent); border-radius: var(--radius-sm);
  outline: none; box-sizing: border-box;
  -moz-appearance: textfield;
}
.chart-edit-overlay::-webkit-inner-spin-button,
.chart-edit-overlay::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.chart-note {
  display: flex; align-items: center; gap: 5px;
  font-size: var(--text-micro); color: var(--color-warning);
  margin: -4px 0 10px; flex-shrink: 0;
}
.clean-outliers-btn {
  margin-left: auto; display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 10px; border-radius: var(--radius-sm);
  background: transparent; border: 1px solid var(--color-warning);
  color: var(--color-warning); cursor: pointer;
  font-size: var(--text-micro); font-family: inherit;
  transition: color 0.15s, background 0.15s;
}
.clean-outliers-btn:hover:not(:disabled) { background: var(--color-warning); color: var(--color-bg); }
.clean-outliers-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── 表格（缩小） ── */
.rate-table-wrap { flex: 1; overflow-y: auto; min-height: 0; max-height: 200px; }
.table { width: 100%; border-collapse: collapse; font-size: var(--text-xs); }
.table th {
  text-align: left; padding: 6px 10px; font-size: var(--text-micro); font-weight: 600;
  color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.03em;
  border-bottom: 0.5px solid var(--color-border-light); position: sticky; top: 0;
  background: var(--color-surface-1);
}
.table td { padding: 5px 10px; border-bottom: 0.5px solid var(--color-border-light); }
.table tbody tr:hover { background: var(--color-surface-2); }
.td-muted { color: var(--color-text-tertiary); }

/* ── 通用 ── */
.hint {
  color: var(--color-text-tertiary); text-align: center;
  padding: 48px 20px; font-size: var(--text-xs);
  flex: 1; display: flex; align-items: center; justify-content: center;
}
.text-success { color: var(--color-success); }
.text-danger { color: var(--color-danger); }

/* ── Tab 栏 ── */
.rate-tabs { display: flex; gap: 6px; margin-bottom: 14px; flex-shrink: 0; }
.rate-tab {
  padding: 6px 14px; border-radius: var(--radius-sm);
  background: transparent; color: var(--color-text-secondary);
  border: 1px solid transparent; cursor: pointer;
  font-size: var(--text-xs); font-family: inherit;
  transition: color 0.15s, background 0.15s;
}
.rate-tab:hover { color: var(--color-text); background: var(--color-surface-2); }
.rate-tab--active {
  color: var(--color-accent); background: var(--color-slot-bg);
  border-color: var(--color-border-light); font-weight: 600;
}

/* ── 全部大区币价 ── */
.all-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; flex-shrink: 0; }
.all-summary { font-size: var(--text-xs); color: var(--color-text-secondary); }
.all-summary b { color: var(--color-text); }
.all-msg { font-size: var(--text-xs); color: var(--color-accent); text-align: right; }
.all-login-hint {
  display: flex; align-items: center; gap: 5px;
  font-size: var(--text-micro); color: var(--color-warning);
  margin-bottom: 8px; flex-shrink: 0;
}
.all-table-wrap { flex: 1; overflow-y: auto; min-height: 0; }
.all-table-wrap .table tbody tr:hover { background: var(--color-surface-2); }
.row-current td { background: var(--color-slot-bg); }
.cur-tag {
  margin-left: 6px; padding: 1px 6px; border-radius: 999px;
  font-size: var(--text-micro); color: var(--color-accent);
  border: 1px solid var(--color-accent); opacity: 0.85;
}
.th-op, .td-op { width: 96px; text-align: right; }
.row-refresh {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 10px; border-radius: var(--radius-sm);
  background: transparent; border: 1px solid var(--color-border-light);
  color: var(--color-text-secondary); cursor: pointer;
  font-size: var(--text-micro); font-family: inherit;
  transition: color 0.15s, border-color 0.15s;
}
.row-refresh:hover:not(:disabled) { color: var(--color-accent); border-color: var(--color-accent); }
.row-refresh:disabled { opacity: 0.5; cursor: not-allowed; }
.all-footnote { margin-top: 8px; font-size: var(--text-micro); color: var(--color-text-tertiary); flex-shrink: 0; }
</style>
