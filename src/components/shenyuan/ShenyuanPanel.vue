<!-- ShenyuanPanel.vue —— 元神面板：5背包 + 5仓库×5槽位（固定结构，直接下拉选择） -->
<template>
  <div class="slot-grid-2col">
    <!-- 背包 -->
    <div class="slot-section-card">
      <div class="sec-head">🎒 背包</div>
      <div class="sec-slots">
        <div
          v-for="b in 5"
          :key="`元神:背包${b}`"
          class="slot-card"
          :class="{
            'slot-card--empty': !getDetail(`元神:背包${b}`),
            'slot-card--open': expandedSlot === `元神:背包${b}`,
            'slot-card--locked': isSlotLocked(`元神:背包${b}`)
          }"
          @click.stop="toggle(`元神:背包${b}`)"
        >
          <span class="sc-lock" :title="getLockTitle(`元神:背包${b}`)" @click.stop="$emit('toggleLock', `元神:背包${b}`)">{{ isSlotLocked(`元神:背包${b}`) ? '🔒' : '🔓' }}</span>
          <span v-if="isSlotLocked(`元神:背包${b}`)" class="sc-lock-time" :title="getLockTitle(`元神:背包${b}`)">{{ getLockTimeShort(`元神:背包${b}`) }}</span>
          <span class="sc-label">背包{{ b }}</span>
          <span class="sc-val" :style="{ color: getQualityColor(getSlotQuality(`元神:背包${b}`)) }">{{ getDetail(`元神:背包${b}`) || '—' }}</span>
          <span v-if="getDetail(`元神:背包${b}`) && getNotes(`元神:背包${b}`)" class="sc-notes">{{ getNotes(`元神:背包${b}`) }}</span>
          <span class="sc-price">{{ getPrice(`元神:背包${b}`) }}</span>
          <span class="sc-img" v-if="getDetail(`元神:背包${b}`) && hasImage(getDetail(`元神:背包${b}`))" @click.stop="viewImage(getDetail(`元神:背包${b}`))" title="查看图片">🖼</span>
          <span class="sc-clear" v-if="getDetail(`元神:背包${b}`) && !isSlotLocked(`元神:背包${b}`)" @click.stop="clear(`元神:背包${b}`)" title="清除">✕</span>
          <span class="sc-arrow" v-if="!isSlotLocked(`元神:背包${b}`)">▾</span>
          <div v-if="expandedSlot === `元神:背包${b}` && !isSlotLocked(`元神:背包${b}`)" class="slot-dropdown" @click.stop>
            <input
              :value="slotSearch[`元神:背包${b}`] || ''"
              class="slot-dropdown-search"
              :placeholder="ocrSearchBusy && ocrSearchSlot === `元神:背包${b}` ? '🔍 识别中…' : '搜索元神...'"
              @input="onSearch(`元神:背包${b}`, ($event.target as HTMLInputElement).value)"
            />
            <!-- OCR 识别反馈 -->
            <div v-if="ocrSearchSlot === `元神:背包${b}`" class="ocr-search-hint">
              <template v-if="ocrSearchBusy">
                <span class="ocr-spinner-sm"></span> 识别中…
              </template>
              <template v-else>
                📋 OCR 识别为「<strong>{{ ocrSearchText }}</strong>」
                <button class="ocr-hint-close" @click="clearOcrHint" title="关闭">✕</button>
              </template>
            </div>
            <div class="slot-dropdown-list">
              <template v-if="currentScheme">
                <div
                  v-for="item in getSlotOptions(`元神:背包${b}`)"
                  :key="item.name"
                  class="slot-dropdown-item"
                  @click="select(`元神:背包${b}`, item)"
                >
                  <span class="sdi-name" :style="{ color: getQualityColor(item._quality) }">{{ item.name }}</span>
                  <span v-if="item._notes" class="sdi-notes">{{ item._notes }}</span>
                  <span class="sdi-price">{{ item._price > 0 ? item._price + '万' : '—' }}</span>
                  <span class="sdi-img" v-if="optionHasImage(item)" @click.stop="viewOptionImage(item)" title="查看图片">🖼</span>
                </div>
              </template>
              <div v-if="getSlotOptions(`元神:背包${b}`).length === 0" class="slot-dropdown-empty">
                {{ slotSearch[`元神:背包${b}`] ? '无匹配物品' : '暂无物品数据' }}
              </div>
            </div>
            <!-- 快速录入 -->
            <div class="slot-dropdown-quickadd">
              <template v-if="quickAddSlot === `元神:背包${b}`">
                <div class="qa-form">
                  <div class="qa-row">
                    <input v-model="quickAddForm.item_name" class="qa-input" placeholder="物品名称" style="flex:1" @keydown.enter.prevent="submitQuickAdd(`元神:背包${b}`)" />
                    <button class="qa-btn-paste" @click="pasteImageToQuickAdd()" :disabled="quickAddOcrBusy" :title="quickAddOcrBusy ? '识别中…' : '粘贴图片识别（或 Ctrl+V）'">{{ quickAddOcrBusy ? '⏳' : '📋' }}</button>
                  </div>
                  <div class="qa-row">
                    <input v-model.number="quickAddForm.market_price" class="qa-input qa-input--price" type="number" step="0.01" min="0" placeholder="价格(万)" @keydown.enter.prevent="submitQuickAdd(`元神:背包${b}`)" />
                    <select v-model="quickAddForm.quality" class="qa-select">
                      <option value="">品质(可选)</option>
                      <option v-for="q in quickAddQualityOptions" :key="q" :value="q">{{ q }}</option>
                    </select>
                  </div>
                  <div class="qa-actions">
                    <button class="btn btn-sm btn-accent" @click="submitQuickAdd(`元神:背包${b}`)">保存并选中</button>
                    <button class="btn btn-sm btn-ghost" @click="cancelQuickAdd">取消</button>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="qa-trigger" @click="openQuickAdd(`元神:背包${b}`)">
                  <span v-if="slotSearch[`元神:背包${b}`] && getSlotOptions(`元神:背包${b}`).filter(o => !o._disabled).length === 0 && getSlotOptions(`元神:背包${b}`).length > 0">⚡ 未找到「{{ slotSearch[`元神:背包${b}`] }}」，点击快速录入</span>
                  <span v-else>+ 快速录入新物品</span>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 仓库 1~5 -->
    <div v-for="w in 5" :key="w" class="slot-section-card">
      <div class="sec-head">🏦 仓库{{ w }}</div>
      <div class="sec-slots">
        <div
          v-for="s in 5"
          :key="`元神:仓${w}槽${s}`"
          class="slot-card"
          :class="{
            'slot-card--empty': !getDetail(`元神:仓${w}槽${s}`),
            'slot-card--open': expandedSlot === `元神:仓${w}槽${s}`,
            'slot-card--locked': isSlotLocked(`元神:仓${w}槽${s}`)
          }"
          @click.stop="toggle(`元神:仓${w}槽${s}`)"
        >
          <span class="sc-lock" :title="getLockTitle(`元神:仓${w}槽${s}`)" @click.stop="$emit('toggleLock', `元神:仓${w}槽${s}`)">{{ isSlotLocked(`元神:仓${w}槽${s}`) ? '🔒' : '🔓' }}</span>
          <span v-if="isSlotLocked(`元神:仓${w}槽${s}`)" class="sc-lock-time" :title="getLockTitle(`元神:仓${w}槽${s}`)">{{ getLockTimeShort(`元神:仓${w}槽${s}`) }}</span>
          <span class="sc-label">槽{{ s }}</span>
          <span class="sc-val" :style="{ color: getQualityColor(getSlotQuality(`元神:仓${w}槽${s}`)) }">{{ getDetail(`元神:仓${w}槽${s}`) || '—' }}</span>
          <span v-if="getDetail(`元神:仓${w}槽${s}`) && getNotes(`元神:仓${w}槽${s}`)" class="sc-notes">{{ getNotes(`元神:仓${w}槽${s}`) }}</span>
          <span class="sc-price">{{ getPrice(`元神:仓${w}槽${s}`) }}</span>
          <span class="sc-img" v-if="getDetail(`元神:仓${w}槽${s}`) && hasImage(getDetail(`元神:仓${w}槽${s}`))" @click.stop="viewImage(getDetail(`元神:仓${w}槽${s}`))" title="查看图片">🖼</span>
          <span class="sc-clear" v-if="getDetail(`元神:仓${w}槽${s}`) && !isSlotLocked(`元神:仓${w}槽${s}`)" @click.stop="clear(`元神:仓${w}槽${s}`)" title="清除">✕</span>
          <span class="sc-arrow" v-if="!isSlotLocked(`元神:仓${w}槽${s}`)">▾</span>
          <div v-if="expandedSlot === `元神:仓${w}槽${s}` && !isSlotLocked(`元神:仓${w}槽${s}`)" class="slot-dropdown" @click.stop>
            <input
              :value="slotSearch[`元神:仓${w}槽${s}`] || ''"
              class="slot-dropdown-search"
              :placeholder="ocrSearchBusy && ocrSearchSlot === `元神:仓${w}槽${s}` ? '🔍 识别中…' : '搜索元神...'"
              @input="onSearch(`元神:仓${w}槽${s}`, ($event.target as HTMLInputElement).value)"
            />
            <!-- OCR 识别反馈 -->
            <div v-if="ocrSearchSlot === `元神:仓${w}槽${s}`" class="ocr-search-hint">
              <template v-if="ocrSearchBusy">
                <span class="ocr-spinner-sm"></span> 识别中…
              </template>
              <template v-else>
                📋 OCR 识别为「<strong>{{ ocrSearchText }}</strong>」
                <button class="ocr-hint-close" @click="clearOcrHint" title="关闭">✕</button>
              </template>
            </div>
            <div class="slot-dropdown-list">
              <template v-if="currentScheme">
                <div
                  v-for="item in getSlotOptions(`元神:仓${w}槽${s}`)"
                  :key="item.name"
                  class="slot-dropdown-item"
                  @click="select(`元神:仓${w}槽${s}`, item)"
                >
                  <span class="sdi-name" :style="{ color: getQualityColor(item._quality) }">{{ item.name }}</span>
                  <span v-if="item._notes" class="sdi-notes">{{ item._notes }}</span>
                  <span class="sdi-price">{{ item._price > 0 ? item._price + '万' : '—' }}</span>
                  <span class="sdi-img" v-if="optionHasImage(item)" @click.stop="viewOptionImage(item)" title="查看图片">🖼</span>
                </div>
              </template>
              <div v-if="getSlotOptions(`元神:仓${w}槽${s}`).length === 0" class="slot-dropdown-empty">
                {{ slotSearch[`元神:仓${w}槽${s}`] ? '无匹配物品' : '暂无物品数据' }}
              </div>
            </div>
            <!-- 快速录入 -->
            <div class="slot-dropdown-quickadd">
              <template v-if="quickAddSlot === `元神:仓${w}槽${s}`">
                <div class="qa-form">
                  <div class="qa-row">
                    <input v-model="quickAddForm.item_name" class="qa-input" placeholder="物品名称" style="flex:1" @keydown.enter.prevent="submitQuickAdd(`元神:仓${w}槽${s}`)" />
                    <button class="qa-btn-paste" @click="pasteImageToQuickAdd()" :disabled="quickAddOcrBusy" :title="quickAddOcrBusy ? '识别中…' : '粘贴图片识别（或 Ctrl+V）'">{{ quickAddOcrBusy ? '⏳' : '📋' }}</button>
                  </div>
                  <div class="qa-row">
                    <input v-model.number="quickAddForm.market_price" class="qa-input qa-input--price" type="number" step="0.01" min="0" placeholder="价格(万)" @keydown.enter.prevent="submitQuickAdd(`元神:仓${w}槽${s}`)" />
                    <select v-model="quickAddForm.quality" class="qa-select">
                      <option value="">品质(可选)</option>
                      <option v-for="q in quickAddQualityOptions" :key="q" :value="q">{{ q }}</option>
                    </select>
                  </div>
                  <div class="qa-actions">
                    <button class="btn btn-sm btn-accent" @click="submitQuickAdd(`元神:仓${w}槽${s}`)">保存并选中</button>
                    <button class="btn btn-sm btn-ghost" @click="cancelQuickAdd">取消</button>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="qa-trigger" @click="openQuickAdd(`元神:仓${w}槽${s}`)">
                  <span v-if="slotSearch[`元神:仓${w}槽${s}`] && getSlotOptions(`元神:仓${w}槽${s}`).filter(o => !o._disabled).length === 0 && getSlotOptions(`元神:仓${w}槽${s}`).length > 0">⚡ 未找到「{{ slotSearch[`元神:仓${w}槽${s}`] }}」，点击快速录入</span>
                  <span v-else>+ 快速录入新物品</span>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface SlotOption {
  name: string
  _id: number
  _price: number
  _disabled: boolean
  _hint: string
  _notes: string
  _quality: string
}

interface QuickAddForm {
  item_name: string
  market_price: number
  quality: string
}

const props = defineProps<{
  currentScheme: { details: Record<string, string> } | null
  expandedSlot: string | null
  slotSearch: Record<string, string>
  getSlotOptions: (slot: string) => SlotOption[]
  getDetail: (slot: string) => string
  getSlotQuality: (slot: string) => string
  getPrice: (slot: string) => string
  getQualityColor: (q: string) => string
  getNotes: (slot: string) => string
  hasImage: (name: string) => boolean
  optionHasImage: (item: SlotOption) => boolean
  isSlotLocked: (slot: string) => boolean
  getLockTitle: (slot: string) => string
  getLockTimeShort: (slot: string) => string
  quickAddSlot: string | null
  quickAddForm: QuickAddForm
  quickAddQualityOptions: string[]
  quickAddOcrBusy: boolean
  ocrSearchSlot: string | null
  ocrSearchText: string
  ocrSearchBusy: boolean
  openQuickAdd: (slot: string) => void
  submitQuickAdd: (slot: string) => Promise<void>
  pasteImageToQuickAdd: () => void
}>()

const emit = defineEmits<{
  toggle: [key: string]; select: [key: string, item: SlotOption]; clear: [key: string]
  viewImage: [name: string]; viewOptionImage: [item: SlotOption]; search: [key: string, value: string]
  toggleLock: [key: string]; cancelQuickAdd: []; clearOcrHint: []
}>()

function toggle(key: string) { if (props.isSlotLocked(key)) return; emit('toggle', key) }
function select(key: string, item: SlotOption) { if (props.isSlotLocked(key)) return; emit('select', key, item) }
function clear(key: string) { if (props.isSlotLocked(key)) return; emit('clear', key) }
function viewImage(name: string) { emit('viewImage', name) }
function viewOptionImage(item: SlotOption) { emit('viewOptionImage', item) }
function onSearch(key: string, value: string) { emit('search', key, value) }
function cancelQuickAdd() { emit('cancelQuickAdd') }
function clearOcrHint() { emit('clearOcrHint') }
</script>

<style scoped>
/* ── 与 GearCenter 槽位一致的样式（scoped 需自带，无法复用父组件 scoped 样式） ── */
.slot-grid-2col { display:grid; grid-template-columns:1fr 1fr; gap:14px; align-content:start; }
.slot-section-card { background:var(--color-surface-1); border:0.5px solid var(--color-border-light); border-radius:var(--radius-md); overflow:visible; }
.sec-head { padding:10px 14px; background:var(--color-surface-2); font-size:13px; font-weight:600; }
.sec-slots { padding:8px; display:flex; flex-direction:column; gap:3px; }
.slot-card { display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:var(--radius-sm); background:var(--color-surface-2); font-size:12px; }
.slot-card--empty { opacity:0.5; }
.sc-label { width:42px; flex-shrink:0; font-weight:550; color:var(--color-text-secondary); font-size:11px; }
.sc-val { flex:2 1 0; color:var(--color-text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }
.slot-card--empty .sc-val { color:var(--color-text-tertiary); }
.sc-notes { flex:1 1 0; font-size:10.5px; color:var(--color-text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }
.sc-price { font-size:10.5px; color:var(--color-accent); font-weight:500; flex-shrink:0; }
.slot-card { position: relative; cursor: pointer; }
.slot-card:hover { background: var(--color-surface-3); }
.slot-card--open { border-color: var(--color-accent); background: var(--color-accent-bg); z-index: 101; opacity: 1; }
.sc-arrow { font-size: 10px; color: var(--color-text-tertiary); flex-shrink: 0; }
.sc-img { font-size: 13px; flex-shrink: 0; cursor: pointer; opacity: 0.7; }
.sc-img:hover { opacity: 1; }
.sc-lock { font-size: 13px; cursor: pointer; flex-shrink: 0; opacity: 0.5; transition: opacity 0.12s; }
.sc-lock:hover { opacity: 1; }
.sc-lock-time { font-size: 10px; color: var(--color-accent); flex-shrink: 0; white-space: nowrap; opacity: 0.8; }
.slot-card--locked { border-left: 2px solid var(--color-accent); cursor: default; }
.slot-card--locked:hover { background: var(--color-surface-3); }
.sc-clear { font-size: 11px; color: var(--color-text-tertiary); cursor: pointer; flex-shrink: 0; padding: 0 2px; }
.sc-clear:hover { color: var(--color-danger); }
.slot-dropdown {
  position: absolute; left: 0; right: 0; top: 100%; z-index: 100;
  background: var(--color-surface-2); border: 0.5px solid var(--color-accent);
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  box-shadow: 0 8px 24px rgba(0,0,0,0.6);
  max-height: 280px; display: flex; flex-direction: column;
}
.slot-dropdown-search {
  width: 100%; padding: 8px 10px; font-size: 12px; font-family: inherit;
  background: var(--color-surface-3); color: var(--color-text);
  border: none; border-bottom: 0.5px solid var(--color-border-light);
  outline: none; border-radius: 0;
}
.slot-dropdown-search:focus { border-color: var(--color-accent); }
.slot-dropdown-list { flex: 1; overflow-y: auto; }
.slot-dropdown-item {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 10px; font-size: 12px; cursor: pointer;
  border-bottom: 0.5px solid var(--color-border-light);
}
.slot-dropdown-item:hover { background: var(--color-hover); }
.sdi-name { flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px; }
.sdi-notes { flex: 2; font-size: 10.5px; color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 60px; }
.sdi-price { font-size: 11px; color: var(--color-accent); font-weight: 500; flex-shrink: 0; margin-left: auto; }
.sdi-img { font-size: 13px; flex-shrink: 0; cursor: pointer; opacity: 0.7; }
.sdi-img:hover { opacity: 1; }
.slot-dropdown-empty {
  padding: 16px 10px; text-align: center; font-size: 12px;
  color: var(--color-text-tertiary);
}

/* ── OCR 搜索提示 ── */
.ocr-search-hint {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 10px; font-size: 11px; color: var(--color-accent);
  background: var(--color-accent-bg); border-bottom: 0.5px solid var(--color-border-light);
}
.ocr-search-hint strong { font-weight: 600; }
.ocr-hint-close {
  margin-left: auto; background: none; border: none; cursor: pointer;
  font-size: 11px; color: var(--color-text-tertiary); padding: 0 2px;
}
.ocr-hint-close:hover { color: var(--color-text); }
.ocr-spinner-sm {
  display: inline-block; width: 12px; height: 12px;
  border: 2px solid var(--color-surface-3);
  border-top-color: var(--color-accent); border-radius: 50%;
  animation: qa-spin 0.6s linear infinite;
}
@keyframes qa-spin { to { transform: rotate(360deg); } }

/* ── 快速录入 ── */
.slot-dropdown-quickadd {
  border-top: 0.5px solid var(--color-border-light);
  flex-shrink: 0;
}
.qa-trigger {
  padding: 8px 10px; font-size: 11.5px; color: var(--color-accent);
  cursor: pointer; text-align: center; transition: background 0.12s;
}
.qa-trigger:hover { background: var(--color-accent-bg); }
.qa-form {
  padding: 8px 10px; display: flex; flex-direction: column; gap: 6px;
}
.qa-input {
  width: 100%; padding: 5px 8px; font-size: 11.5px; font-family: inherit;
  background: var(--color-surface-3); color: var(--color-text);
  border: 0.5px solid var(--color-border); border-radius: 4px;
  outline: none;
}
.qa-input:focus { border-color: var(--color-accent); }
.qa-input--price { width: 100px; flex-shrink: 0; }
.qa-row { display: flex; gap: 6px; align-items: center; }
.qa-select {
  flex: 1; padding: 5px 6px; font-size: 11.5px; font-family: inherit;
  background: var(--color-surface-3); color: var(--color-text);
  border: 0.5px solid var(--color-border); border-radius: 4px;
  outline: none;
}
.qa-select:focus { border-color: var(--color-accent); }
.qa-actions { display: flex; gap: 6px; justify-content: flex-end; }
.qa-btn-paste {
  flex-shrink: 0; width: 28px; height: 28px; padding: 0;
  font-size: 14px; line-height: 1; cursor: pointer;
  background: var(--color-surface-3); color: var(--color-text-secondary);
  border: 0.5px solid var(--color-border); border-radius: 4px;
  transition: all 0.12s;
}
.qa-btn-paste:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
.qa-btn-paste:disabled { opacity: 0.5; cursor: not-allowed; }

@media (max-width:900px) { .slot-grid-2col { grid-template-columns:1fr; } }
</style>
