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
          {{ isRefreshing ? '⏳ 收集中...' : '🔄 刷新线索' }}
        </button>
        <button class="btn btn-danger" :disabled="isRefreshing || clues.length === 0" @click="doClear">
          🗑 清空
        </button>
      </div>
    </div>

    <!-- 关键词搜索 -->
    <div class="search-bar">
      <input
        v-model="searchText"
        type="text"
        class="search-input"
        placeholder="🔍 搜索标题 / 内容 / 发帖人 / 价格"
      />
      <button v-if="searchText" class="search-clear" @click="searchText = ''" title="清空">✕</button>
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
              <span class="clue-date-icon">{{ dateIcon(c.posted_at) }}</span>
              {{ c.posted_at }}
            </span>
          </div>
        </div>
        <div class="clue-card-right">
          <button class="btn-del" @click.prevent.stop="doDelete(c)" title="删除">✕</button>
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

const app = useAppStore()

const KEYWORDS = ['出', '卖', '甩', '退坑', '弃坑', '脱坑', '清仓', '低价', '急出', '便宜', '甩卖', '代价']

const sourceTabs = [
  { key: 'all', label: '全部' },
  { key: 'tieba', label: '贴吧' },
]

const NO_TIEBA = ['天下归心', '一生所爱', '青梅拾酒']
const noTieba = computed(() => NO_TIEBA.includes(app.currentServerName))
const sourceFilter = ref('all')
const keywordFilter = ref<string[]>([])
const searchText = ref('')
const searchTerms = computed(() => splitSearchTerms(searchText.value))
const clues = ref<ClueRecord[]>([])
const isRefreshing = ref(false)
const lastRefreshTime = ref('')
const progressPct = ref(0)
const progressLabel = ref('')

let cleanupProgress: (() => void) | null = null

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
  progressPct.value = 0
  progressLabel.value = '启动中...'

  cleanupProgress?.()
  cleanupProgress = window.electronAPI.onClueProgress(({ source, done, total }) => {
    progressPct.value = total > 0 ? Math.round((done / total) * 100) : 0
    const labels: Record<string, string> = { tieba: '抓取贴吧', done: '完成' }
    progressLabel.value = labels[source] || source
  })

  try {
    const result = await window.electronAPI.scrapeClues(app.currentServerName)
    console.log('[线索] 新增:', result.added, '条')
  } catch (e) {
    console.error('[线索] 抓取失败:', e)
  }

  await loadClues()
  lastRefreshTime.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  isRefreshing.value = false
  progressLabel.value = ''
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

// ── 日期强化显示 ──
function dateIcon(postedAt: string): string {
  if (!postedAt) return ''
  // 小时前 → 今天
  if (/小时前|分钟前|刚刚|秒前/.test(postedAt)) return '🕐'
  // 1天前 → 昨天
  if (/^1天前|昨天/.test(postedAt)) return '📅'
  // 2-7天前 → 本周
  if (/^[2-7]天前/.test(postedAt)) return '📅'
  // 其他 → 更早
  return '📆'
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
  await loadClues()
})

onUnmounted(() => {
  cleanupProgress?.()
})
</script>

<style scoped>
.page { height: 100%; display: flex; flex-direction: column; }
.page-head { margin-bottom: 16px; flex-shrink: 0; }
.page-head h2 { font-size: 26px; font-weight: 650; }
.page-head p { color: var(--color-text-secondary); font-size: 13.5px; margin-top: 4px; }

/* 顶栏 */
.top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-shrink: 0; gap: 12px; }
.source-tabs { display: flex; gap: 4px; }
.tab-btn {
  padding: 4px 14px; border-radius: 6px; border: none; background: transparent;
  font-size: 12.5px; color: var(--color-text-tertiary); cursor: pointer;
  font-family: inherit; transition: all 0.12s;
}
.tab-btn:hover { background: var(--color-surface-2); color: var(--color-text); }
.tab-btn--active { background: var(--color-accent-bg); color: var(--color-accent); font-weight: 550; }
.top-actions { display: flex; align-items: center; gap: 10px; }
.refresh-info { font-size: 11px; color: var(--color-text-tertiary); }
.btn { border: none; border-radius: 5px; cursor: pointer; font-size: 12.5px; font-weight: 500; padding: 6px 14px; font-family: inherit; }
.btn-accent { background: var(--color-accent); color: #fff; }
.btn-danger { background: var(--color-danger); color: #fff; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* 关键词搜索 */
.search-bar { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; flex-shrink: 0; }
.search-input {
  width: 320px; padding: 6px 10px; font-size: 12.5px; font-family: inherit;
  background: var(--color-surface-2); color: var(--color-text);
  border: 0.5px solid var(--color-border); border-radius: 5px;
  transition: border-color 0.1s;
}
.search-input:focus { outline: none; border-color: var(--color-accent-ring); }
.search-clear {
  background: none; border: none; cursor: pointer; font-size: 12px;
  color: var(--color-text-tertiary); padding: 2px 4px; border-radius: 3px; line-height: 1;
}
.search-clear:hover { color: var(--color-text); background: var(--color-surface-2); }

/* 关键词筛选 */
.kw-bar { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; flex-shrink: 0; }
.kw-tag {
  padding: 2px 10px; border-radius: 10px; border: 0.5px solid var(--color-border-light);
  background: var(--color-surface-1); font-size: 11.5px; color: var(--color-text-tertiary);
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
  height: 100%; background: var(--color-accent); opacity: 0.3;
  transition: width 0.3s ease; border-radius: 4px;
}
.progress-text {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: 11px; color: var(--color-text-secondary);
}

/* 线索列表 */
.clue-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.clue-card {
  display: flex; gap: 12px; padding: 10px 14px; border-radius: var(--radius-sm);
  background: var(--color-surface-1); border: 0.5px solid var(--color-border-light);
  text-decoration: none; color: inherit; cursor: pointer; align-items: center;
  transition: background 0.12s, border-color 0.12s;
}
.clue-card:hover { background: var(--color-surface-2); border-color: var(--color-accent); }
.clue-card--new { border-left: 3px solid var(--color-accent); }
.clue-card-left { flex-shrink: 0; }
.source-badge {
  font-size: 10px; padding: 2px 8px; border-radius: 8px; font-weight: 500;
}
.source-tieba { background: #e8f5e9; color: #2e7d32; }
.clue-card-body { flex: 1; min-width: 0; }
.clue-card-head { display: flex; gap: 8px; align-items: baseline; margin-bottom: 4px; }
.clue-kw {
  font-size: 10.5px; padding: 1px 6px; border-radius: 4px;
  background: var(--color-accent-bg); color: var(--color-accent); flex-shrink: 0;
}
.clue-title { font-size: 13px; font-weight: 500; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.clue-card-meta { display: flex; gap: 12px; font-size: 11px; color: var(--color-text-tertiary); align-items: center; }
.clue-price { color: var(--color-danger); font-weight: 550; }
.clue-date {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 1px 8px; border-radius: 10px;
  font-weight: 500; font-size: 10.5px;
  background: var(--color-surface-2);
  white-space: nowrap;
}
.clue-date-icon { font-size: 11px; line-height: 1; }
.date-recent { color: var(--color-accent); background: var(--color-accent-bg); }
.date-yesterday { color: #e65100; background: rgba(230,81,0,0.08); }
.date-week { color: var(--color-text-secondary); }
.date-older { color: var(--color-text-tertiary); }
.clue-card-right { flex-shrink: 0; }
.btn-del {
  width: 22px; height: 22px; border: none; border-radius: 4px;
  background: transparent; color: var(--color-text-tertiary);
  font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.12s;
}
.btn-del:hover { background: var(--color-danger); color: #fff; }

.hint { color: var(--color-text-tertiary); text-align: center; padding: 48px 20px; font-size: 12.5px; flex: 1; display: flex; align-items: center; justify-content: center; }

/* 暗色主题适配 */
[data-theme="dark"] .source-tieba { background: rgba(46,125,50,0.2); color: #81c784; }
</style>
