<template>
  <div class="page">
    <div class="page-head">
      <h2>交易线索</h2>
      <p>从贴吧自动聚合出货线索</p>
    </div>

    <!-- 顶栏 -->
    <div class="top-bar">
      <div class="source-tabs">
        <button
          v-for="s in sourceTabs" :key="s.key"
          class="tab-btn" :class="{ 'tab-btn--active': sourceFilter === s.key }"
          @click="sourceFilter = s.key"
        >{{ s.label }}</button>
      </div>
      <div class="top-actions">
        <span class="refresh-info" v-if="lastRefreshTime">上次刷新 {{ lastRefreshTime }}</span>
        <button class="btn btn-accent" :disabled="isRefreshing" @click="doRefresh">
          <template v-if="isRefreshing"><AppIcon icon="loader" :size="13" class="icon-spin" /> 收集中...</template>
          <template v-else><AppIcon icon="rotate" :size="13" /> 刷新线索</template>
        </button>
        <button class="btn btn-danger" :disabled="isRefreshing || clues.length === 0" @click="doClear">
          <AppIcon icon="trash" :size="13" /> 清空
        </button>
      </div>
    </div>

    <!-- 关键词搜索 -->
    <div class="search-bar">
      <input
        v-model="searchText"
        type="text"
        class="search-input"
        placeholder="搜索标题 / 内容 / 发帖人 / 价格"
      />
      <button v-if="searchText" class="search-clear" @click="searchText = ''" title="清空"><AppIcon icon="x" :size="12" /></button>
    </div>

    <!-- 关键词筛选 -->
    <div class="kw-bar">
      <button
        v-for="kw in KEYWORDS" :key="kw"
        class="kw-tag" :class="{ 'kw-tag--active': keywordFilter.includes(kw) }"
        @click="toggleKeyword(kw)"
      >{{ kw }}</button>
    </div>

    <!-- 进度条 -->
    <div class="progress-bar" v-if="isRefreshing">
      <div class="progress-fill" :style="{ width: progressPct + '%' }"></div>
      <span class="progress-text">{{ progressLabel }}</span>
    </div>

    <!-- 抓取错误提示（如贴吧反爬验证墙 / 页面加载失败）：可点掉，避免一直卡在“收集中/0条”无从排查 -->
    <div v-if="errorMsg" class="clue-error">
      <span class="clue-error-icon"><AppIcon icon="alert" :size="14" /></span>
      <span class="clue-error-text">{{ errorMsg }}</span>
      <button
        v-if="wallDetected && !noTieba"
        class="clue-error-btn"
        @click="openWall"
        title="弹窗手动过一次百度安全验证，通过后 cookie 落盘，下次抓取不再被拦"
      >
        <AppIcon icon="external-link" :size="12" /> 去通过验证
      </button>
      <button class="clue-error-close" @click="errorMsg = ''" title="关闭"><AppIcon icon="x" :size="12" /></button>
    </div>

    <!-- 中性提示（非错误，如“已都在列表/暂无新出货”）：区分于红色错误条 -->
    <div v-if="infoMsg" class="clue-info">
      <span class="clue-info-icon"><AppIcon icon="info" :size="14" /></span>
      <span class="clue-info-text">{{ infoMsg }}</span>
      <button class="clue-error-close" @click="infoMsg = ''" title="关闭"><AppIcon icon="x" :size="12" /></button>
    </div>

    <!-- 线索列表 -->
    <div class="clue-list" v-if="filteredClues.length > 0">
      <a
        v-for="c in filteredClues" :key="c.id"
        :href="c.url" target="_blank" rel="noopener noreferrer"
        class="clue-card" :class="{ 'clue-card--new': c.status === 'new' }"
        @click="markRead(c)"
      >
        <div class="clue-card-left">
          <span class="source-badge" :class="'source-' + c.source">{{ sourceLabel(c.source) }}</span>
        </div>
        <div class="clue-card-body">
          <div class="clue-card-head">
            <span class="clue-kw">{{ c.keyword }}</span>
            <span class="clue-title">{{ c.title }}</span>
          </div>
          <div class="clue-card-meta">
            <span v-if="c.author_name">{{ c.author_name }}</span>
            <span v-if="c.price_text" class="clue-price">{{ c.price_text }}</span>
            <span v-if="c.posted_at" class="clue-date" :class="dateClass(c.posted_at)">
              <span class="clue-date-icon"><AppIcon :icon="dateIcon(c.posted_at)" :size="11" /></span>
              {{ c.posted_at }}
            </span>
          </div>
        </div>
        <div class="clue-card-right">
          <button class="btn-del" @click.prevent.stop="doDelete(c)" title="删除"><AppIcon icon="x" :size="12" /></button>
        </div>
      </a>
    </div>
    <div class="hint" v-else-if="!isRefreshing">
      <template v-if="clues.length > 0">
        无匹配线索
      </template>
      <template v-else-if="noTieba">
        {{ app.currentServerName }} 暂无对应贴吧
      </template>
      <template v-else>
        暂无线索 — 点击「刷新线索」开始收集
      </template>
    </div>
    <div class="hint" v-else>
      正在收集线索...
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useAppStore } from '@/stores'
import { matchesSearch, splitSearchTerms } from '@/utils/clueSearch'
import AppIcon from '@/components/ui/AppIcon.vue'

const app = useAppStore()

const KEYWORDS = ['出', '卖', '甩', '退坑', '弃坑', '脱坑', '清仓', '低价', '急出', '便宜', '甩卖', '代价']

const sourceTabs = [
  { key: 'all', label: '全部' },
  { key: 'tieba', label: '贴吧' },
]

// 主进程贴吧映射缓存（单一数据源，经 getTiebaMap 拉取，含无贴吧区服=null）
const tiebaMap = ref<Record<string, string | null>>({})

const noTieba = computed(() => {
  // 单一数据源：贴吧映射来自主进程 TIEBA_MAP（无贴吧区服=null / 未登记），避免前端硬编码失真
  const map = tiebaMap.value
  // 映射已加载时：该区服不在映射（null / 未登记）即视为无贴吧
  if (map && app.currentServerName) return !map[app.currentServerName]
  // 映射尚未加载：不展示无贴吧提示（避免误判，等映射就绪）
  return false
})
const sourceFilter = ref('all')
const keywordFilter = ref<string[]>([])
const searchText = ref('')
const searchTerms = computed(() => splitSearchTerms(searchText.value))
const clues = ref<ClueRecord[]>([])
const isRefreshing = ref(false)
const lastRefreshTime = ref('')
const progressPct = ref(0)
const progressLabel = ref('')
// 抓取失败提示（反爬拦截 / 页面加载失败等），null 表示无错误
const errorMsg = ref<string | null>(null)
// 是否确认被反爬验证墙拦截（决定是否显示「去通过验证」按钮）
const wallDetected = ref(false)
// 中性提示（非错误：已都在列表 / 暂无新出货等）
const infoMsg = ref<string | null>(null)

let cleanupProgress: (() => void) | null = null
let cleanupClueNew: (() => void) | null = null

function sourceLabel(s: string) {
  return { tieba: '贴吧' }[s] || s
}

function toggleKeyword(kw: string) {
  const idx = keywordFilter.value.indexOf(kw)
  if (idx >= 0) keywordFilter.value.splice(idx, 1)
  else keywordFilter.value.push(kw)
}

const filteredClues = computed(() => {
  let list = clues.value
  if (sourceFilter.value !== 'all') {
    list = list.filter(c => c.source === sourceFilter.value)
  }
  if (keywordFilter.value.length > 0) {
    list = list.filter(c => keywordFilter.value.includes(c.keyword))
  }
  if (searchTerms.value.length > 0) {
    list = list.filter(c => matchesSearch(c, searchTerms.value))
  }
  return list
})

async function doRefresh() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  errorMsg.value = null
  infoMsg.value = null
  wallDetected.value = false
  progressPct.value = 0
  progressLabel.value = '启动中...'

  cleanupProgress?.()
  cleanupProgress = window.electronAPI.onClueProgress(({ source, done, total }) => {
    progressPct.value = total > 0 ? Math.round((done / total) * 100) : 0
    const labels: Record<string, string> = { tieba: '抓取贴吧', done: '完成' }
    progressLabel.value = labels[source] || source
  })

  // 抓一条、上屏一条：收到新线索立即插入列表顶部（去重），不等全部抓完
  cleanupClueNew?.()
  cleanupClueNew = window.electronAPI.onClueNew((row) => {
    // 只收当前大区的新线索（防抓取期间切区导致串服）
    if (row && row.server_name === app.currentServerName && !clues.value.some(x => x.id === row.id)) {
      clues.value.unshift(row as ClueRecord)
    }
  })

  try {
    const result = await window.electronAPI.scrapeClues(app.currentServerName)
    const m = result?.meta
    console.log('[线索] 新增:', result?.added, '条', JSON.stringify(m))

    if (m?.wall) wallDetected.value = true

    // 1) 明确错误优先（红条）
    if (result?.errors?.length) {
      errorMsg.value = result.errors.join('；')
    }
    // 2) 被反爬墙拦下 → 红条 + 出「去通过验证」按钮
    else if (m?.wall) {
      errorMsg.value = m.wallMsg || '贴吧触发了安全验证（反爬拦截）'
    }
    // 3) 真的没抓到任何（无错误、无新增）→ 给诊断，不再“静默 0 条”
    else if (result?.added === 0) {
      if (m && m.pages > 0) {
        if (m.foundClues > 0) {
          infoMsg.value = `本次检索到 ${m.foundClues} 条线索，但都已收录（无新增）`
        } else if (m.triedTieba === false) {
          errorMsg.value = `${app.currentServerName} 暂无对应贴吧，无法抓取`
        } else {
          const titles = (m.titles || []).filter(Boolean).join(' / ').slice(0, 90)
          let msg = `贴吧页面未识别到出货帖（尝试 ${m.pages} 页）。` +
            (titles ? `页面标题：${titles}` : '页面标题为空，可能未成功加载或被拦截')
          const d = (m.diag || []).filter(Boolean)
          if (d.length) msg += ` 候选前${Math.min(d.length, 6)}条：${d.slice(0, 6).join(' ⏎ ')}`
          errorMsg.value = msg
        }
      } else {
        infoMsg.value = '本轮未新增线索'
      }
    }
  } catch (e: any) {
    console.error('[线索] 抓取失败:', e)
    errorMsg.value = e?.message || '抓取失败，请查看主进程日志'
  }

  cleanupClueNew?.(); cleanupClueNew = null
  // 抓取结束后整体 reload 一次：补上定时调度可能并发新增、以及最新排序与已读状态
  await loadClues()
  lastRefreshTime.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  isRefreshing.value = false
  progressLabel.value = ''
}

/** 被反爬拦截时，让用户弹窗手动过一次验证（cookie 走默认 session，与抓取共享并持久化） */
async function openWall() {
  try {
    await window.electronAPI.openWallVerify(app.currentServerName)
  } catch (e) {
    console.error('[线索] 打开验证窗口失败:', e)
  }
}

async function doDelete(c: ClueRecord) {
  try {
    await window.electronAPI.deleteClue(c.id)
    clues.value = clues.value.filter(x => x.id !== c.id)
  } catch (e) { console.error('[线索] 删除失败:', e) }
}

async function doClear() {
  try {
    const r = await window.electronAPI.clearClues(app.currentServerName)
    if (r?.ok) {
      clues.value = []
      lastRefreshTime.value = ''
    }
  } catch (e) { console.error('[线索] 清空失败:', e) }
}

async function loadClues() {
  if (!app.currentServerName) return
  try {
    clues.value = await window.electronAPI.loadClues({
      serverName: app.currentServerName,
      limit: 200,
    }) as ClueRecord[]
  } catch (e) {
    console.error('[线索] 加载失败:', e)
  }
}

// ── 日期强化显示 ──（返回 AppIcon 图标名，展示分档见 dateClass）
function dateIcon(postedAt: string): string {
  if (!postedAt) return ''
  // 小时前 → 今天
  if (/小时前|分钟前|刚刚|秒前/.test(postedAt)) return 'clock'
  // 1天前 → 昨天
  if (/^1天前|昨天/.test(postedAt)) return 'calendar'
  // 2-7天前 → 本周
  if (/^[2-7]天前/.test(postedAt)) return 'calendar'
  // 其他 → 更早
  return 'calendar'
}

function dateClass(postedAt: string): string {
  if (!postedAt) return ''
  if (/小时前|分钟前|刚刚|秒前/.test(postedAt)) return 'date-recent'
  if (/^1天前|昨天/.test(postedAt)) return 'date-yesterday'
  if (/^[2-7]天前/.test(postedAt)) return 'date-week'
  return 'date-older'
}

async function markRead(c: ClueRecord) {
  if (c.status !== 'new') return
  try {
    await window.electronAPI.updateClueStatus(c.id, 'read')
    c.status = 'read'
  } catch { /* ignore */ }
}

// 区服切换时重新加载该服的线索
watch(() => app.currentServerName, async (name) => {
  if (name) await loadClues()
})

onMounted(async () => {
  await app.loadServers()
  // 拉取主进程贴吧映射（含无贴吧区服=null），作为 noTieba 空态判定的单一数据源
  try { tiebaMap.value = await window.electronAPI.getTiebaMap() } catch { /* 忽略，退化本地判断 */ }
  await loadClues()
})

onUnmounted(() => {
  cleanupProgress?.()
  cleanupClueNew?.()
})
</script>

<style scoped>
.page { height: 100%; display: flex; flex-direction: column; }
.page-head { margin-bottom: 16px; flex-shrink: 0; }
.page-head h2 { font-size: var(--text-lg); font-weight: 650; letter-spacing: -0.01em; }
.page-head p { color: var(--color-text-secondary); font-size: var(--text-sm); margin-top: 4px; }

/* 顶栏 */
.top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-shrink: 0; gap: 12px; }
.source-tabs { display: flex; gap: 4px; }
.tab-btn {
  padding: 4px 14px; border-radius: var(--radius-sm); border: none; background: transparent;
  font-size: var(--text-xs); color: var(--color-text-tertiary); cursor: pointer;
  font-family: inherit; transition: all 0.12s;
}
.tab-btn:hover { background: var(--color-surface-2); color: var(--color-text); }
.tab-btn--active { background: var(--color-accent-bg); color: var(--color-accent); font-weight: 550; }
.top-actions { display: flex; align-items: center; gap: 10px; }
.refresh-info { font-size: var(--text-micro); color: var(--color-text-tertiary); }
.btn { border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: var(--text-xs); font-weight: 500; padding: 6px 14px; font-family: inherit; transition: all 0.12s; }
.btn-accent { background: var(--color-accent); color: #fff; }
.btn-accent:hover:not(:disabled) { background: var(--color-accent-hover); }
.btn-danger { background: var(--color-danger-bg); color: var(--color-danger); }
.btn-danger:hover:not(:disabled) { background: var(--color-danger); color: #fff; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* 关键词搜索 */
.search-bar { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; flex-shrink: 0; }
.search-input {
  width: 320px; padding: 6px 10px; font-size: var(--text-xs); font-family: inherit;
  background: var(--color-surface-2); color: var(--color-text);
  border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  transition: border-color 0.12s;
}
.search-input:focus { outline: none; border-color: var(--color-accent-ring); }
.search-clear {
  background: none; border: none; cursor: pointer; font-size: var(--text-xs);
  color: var(--color-text-tertiary); padding: 2px 4px; border-radius: 3px; line-height: 1;
  display: inline-flex; align-items: center;
}
.search-clear:hover { color: var(--color-text); background: var(--color-surface-2); }

/* 关键词筛选 */
.kw-bar { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; flex-shrink: 0; }
.kw-tag {
  padding: 2px 10px; border-radius: 10px; border: 1px solid var(--color-border-light);
  background: var(--color-surface-1); font-size: var(--text-micro); color: var(--color-text-tertiary);
  cursor: pointer; font-family: inherit; transition: all 0.12s;
}
.kw-tag:hover { border-color: var(--color-accent); color: var(--color-text); }
.kw-tag--active { background: var(--color-accent-bg); color: var(--color-accent); border-color: var(--color-accent); }

/* 进度条 */
.progress-bar {
  height: 20px; background: var(--color-surface-2); border-radius: 4px;
  margin-bottom: 10px; position: relative; overflow: hidden; flex-shrink: 0;
}
.progress-fill {
  height: 100%; background: linear-gradient(90deg, #5B66D8, #8892F0);
  opacity: 0.35;
  transition: width 0.3s ease; border-radius: 4px;
}
.progress-text {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: var(--text-micro); color: var(--color-text-secondary);
}

/* 线索列表 */
.clue-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
.clue-card {
  display: flex; gap: 12px; padding: 10px 14px; border-radius: var(--radius-sm);
  background: var(--color-surface-1); border: 1px solid var(--color-border-light);
  box-shadow: var(--shadow-card);
  text-decoration: none; color: inherit; cursor: pointer; align-items: center;
  transition: background 0.12s, border-color 0.12s, transform 0.12s;
}
.clue-card:hover { background: var(--color-surface-2); border-color: var(--color-accent-ring); }
.clue-card--new { background: var(--color-accent-bg); border-color: var(--color-accent-ring); }
.clue-card--new:hover { background: var(--color-accent-bg); border-color: var(--color-accent); }
.clue-card-left { flex-shrink: 0; }
.source-badge {
  font-size: var(--text-micro); padding: 2px 8px; border-radius: 8px; font-weight: 500;
  background: var(--color-success-bg); color: var(--color-success);
}
.clue-card-body { flex: 1; min-width: 0; }
.clue-card-head { display: flex; gap: 8px; align-items: baseline; margin-bottom: 4px; }
.clue-kw {
  font-size: var(--text-micro); padding: 1px 6px; border-radius: 4px;
  background: var(--color-accent-bg); color: var(--color-accent); flex-shrink: 0;
}
.clue-title { font-size: var(--text-sm); font-weight: 500; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.clue-card-meta { display: flex; gap: 12px; font-size: var(--text-micro); color: var(--color-text-tertiary); align-items: center; }
.clue-price { color: var(--color-danger); font-weight: 550; }
.clue-date {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 1px 8px; border-radius: 10px;
  font-weight: 500; font-size: var(--text-micro);
  background: var(--color-surface-2);
  white-space: nowrap;
}
.clue-date-icon { font-size: var(--text-micro); line-height: 1; display: inline-flex; align-items: center; }
.date-recent { color: var(--color-accent); background: var(--color-accent-bg); }
.date-yesterday { color: var(--color-warning); background: var(--color-warning-bg); }
.date-week { color: var(--color-text-secondary); }
.date-older { color: var(--color-text-tertiary); }
.clue-card-right { flex-shrink: 0; }
.btn-del {
  width: 22px; height: 22px; border: none; border-radius: 4px;
  background: transparent; color: var(--color-text-tertiary);
  font-size: var(--text-xs); cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.12s;
}
.btn-del:hover { background: var(--color-danger); color: #fff; }

/* 抓取错误提示条 */
.clue-error {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; margin-bottom: 10px; border-radius: var(--radius-sm);
  background: var(--color-danger-bg); color: var(--color-danger);
  border: 1px solid var(--color-border);
  font-size: var(--text-xs); flex-shrink: 0;
}
.clue-error-icon { display: inline-flex; align-items: center; flex-shrink: 0; }
.clue-error-text { flex: 1; min-width: 0; line-height: 1.4; }
.clue-error-btn {
  border: 1px solid currentColor; border-radius: var(--radius-sm); background: transparent;
  color: inherit; cursor: pointer; font-size: var(--text-micro); font-family: inherit;
  padding: 3px 10px; flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px;
  transition: all 0.12s; font-weight: 500;
}
.clue-error-btn:hover { background: var(--color-danger); color: #fff; }
.clue-error-close {
  border: none; background: transparent; color: inherit; cursor: pointer;
  padding: 2px; border-radius: 4px; display: inline-flex; align-items: center;
  opacity: 0.7; font-size: var(--text-xs); line-height: 1;
}
.clue-error-close:hover { opacity: 1; background: var(--color-danger-bg); }

/* 中性提示条（区别于红色错误） */
.clue-info {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; margin-bottom: 10px; border-radius: var(--radius-sm);
  background: var(--color-accent-bg); color: var(--color-accent);
  border: 1px solid var(--color-border);
  font-size: var(--text-xs); flex-shrink: 0;
}
.clue-info-icon { display: inline-flex; align-items: center; flex-shrink: 0; }
.clue-info-text { flex: 1; min-width: 0; line-height: 1.4; }

.hint { color: var(--color-text-tertiary); text-align: center; padding: 48px 20px; font-size: var(--text-xs); flex: 1; display: flex; align-items: center; justify-content: center; }
</style>
