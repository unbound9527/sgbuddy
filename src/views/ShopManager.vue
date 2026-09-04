<template>
  <div class="page">
    <div class="page-head">
      <h2>商行管理</h2>
      <p>持仓库存追踪 · 盈亏一目了然</p>
    </div>

    <!-- 商行标签栏 -->
    <div class="business-bar">
      <button
        v-for="(b, idx) in businesses"
        :key="idx"
        class="business-tab"
        :class="{ 'business-tab--active': businessId === idx }"
        @click="switchBusiness(idx)"
      >
        <span
          v-if="editingBusiness !== idx"
          class="business-tab-label"
          @dblclick.stop="startEditBusiness(idx)"
          :title="'双击编辑名称'"
        >{{ b }}</span>
        <input
          v-else
          class="business-name-input"
          v-model="businessDraft"
          @blur="commitBusiness(idx)"
          @keydown.enter.prevent="commitBusiness(idx)"
          @keydown.escape.prevent="editingBusiness = -1"
          @click.stop
        />
        <button
          v-if="businesses.length > 1"
          class="business-del"
          @click.stop="deleteBusiness(idx)"
          title="删除商行"
        ><AppIcon icon="x" :size="11" /></button>
      </button>
      <button class="business-tab business-tab--add" @click="addBusiness" title="新建商行"><AppIcon icon="plus" :size="14" /></button>
    </div>

    <div class="stats-row">
      <div class="stat-card"><span class="stat-label">持仓成本</span><span class="stat-value">{{ totalCost }} 万</span></div>
      <div class="stat-card"><span class="stat-label">预估市值</span><span class="stat-value">{{ totalValue }} 万</span></div>
      <div class="stat-card"><span class="stat-label">预估利润</span><span class="stat-value" :class="parseFloat(totalProfit) >= 0 ? 'text-success' : 'text-danger'">{{ parseFloat(totalProfit) >= 0 ? '+' : '' }}{{ totalProfit }} 万</span></div>
      <div class="stat-card"><span class="stat-label">预计利润率</span><span class="stat-value" :class="parseFloat(totalProfitMargin) >= 0 ? 'text-success' : 'text-danger'">{{ parseFloat(totalProfitMargin) >= 0 ? '+' : '' }}{{ totalProfitMargin }}%</span></div>
      <div class="stat-card"><span class="stat-label">持仓数</span><span class="stat-value">{{ holdingItems.length }}</span></div>
    </div>
    <div class="stats-row">
      <div class="stat-card stat-card--editable" @dblclick="startEditStalls" :title="'双击编辑大区商行总数'">
        <span class="stat-label">大区商行总数 <span class="info-dot" title="当前大区所有商行的铺面总数，可双击编辑"><AppIcon icon="info" :size="10" /></span></span>
        <span v-if="!editingStalls" class="stat-value">{{ totalStalls }}</span>
        <input
          v-else
          class="stalls-input"
          type="number"
          min="1"
          v-model="stallsDraft"
          @blur="commitStalls"
          @keydown.enter.prevent="commitStalls"
          @keydown.escape.prevent="editingStalls = false"
          @click.stop
          ref="stallsInputRef"
        />
      </div>
      <div class="stat-card"><span class="stat-label">物价指数 <span class="info-dot" :title="`物价指数 = 大区商行总数 ÷ 100 = ${totalStalls} ÷ 100 = ${priceIndex.toFixed(2)}`"><AppIcon icon="info" :size="10" /></span></span><span class="stat-value">{{ priceIndex.toFixed(2) }}</span></div>
      <div class="stat-card"><span class="stat-label">每日维护费用 <span class="info-dot" :title="`每日维护费用 = 物价指数 × 1000 × 24 × 已使用店铺数 = ${priceIndex.toFixed(2)} × 1000 × 24 × ${usedShopCount} = ${dailyMaintenance.toFixed(0)} 元`"><AppIcon icon="info" :size="10" /></span></span><span class="stat-value">{{ dailyMaintenance.toFixed(0) }} 元</span></div>
      <div class="stat-card"><span class="stat-label">每日活力消耗 <span class="info-dot" :title="`每日活力消耗 = 物价指数 × 45 × 24 × 已使用店铺数 = ${priceIndex.toFixed(2)} × 45 × 24 × ${usedShopCount} = ${dailyVitality.toFixed(0)}`"><AppIcon icon="info" :size="10" /></span></span><span class="stat-value">{{ dailyVitality.toFixed(0) }}</span></div>
      <div class="stat-card"><span class="stat-label">已使用店铺 <span class="info-dot" title="当前商行中有「持有」物品的店铺数量"><AppIcon icon="info" :size="10" /></span></span><span class="stat-value">{{ usedShopCount }} / 10</span></div>
    </div>

    <div class="shop-layout">
      <!-- 左侧店铺列表 -->
      <div class="shop-sidebar">
        <button
          v-for="i in 10"
          :key="i"
          class="shop-tab"
          :class="{ 'shop-tab--active': shopIndex === i - 1 }"
          @click="shopIndex = i - 1"
        >
          <span class="shop-tab-num">{{ i }}</span>
          <span
            v-if="editingAlias !== i - 1"
            class="shop-tab-label"
            @dblclick.stop="startEditAlias(i - 1)"
            :title="'双击编辑别名'"
          >{{ shopAliases[i - 1] }}</span>
          <input
            v-else
            class="shop-alias-input"
            v-model="aliasDraft"
            @blur="commitAlias(i - 1)"
            @keydown.enter.prevent="commitAlias(i - 1)"
            @keydown.escape.prevent="editingAlias = -1"
            @click.stop
            ref="aliasInputRef"
          />
          <span class="shop-tab-count">{{ shopItemCounts[i - 1] || 0 }}/10</span>
        </button>
      </div>

      <!-- 右侧表格 -->
      <div class="shop-main">
        <div class="card">
          <div class="card-head">
            <div class="card-head-left">
              <h3>{{ businesses[businessId] }} · {{ shopAliases[shopIndex] }}</h3>
              <span class="card-head-divider">·</span>
              <span class="rate-chip rate-chip--readonly" :title="taxTip">
                税{{ (taxRate * 100).toFixed(1) }}%
              </span>
              <label class="rate-chip" title="溢价率">
                溢
                <input type="number" step="0.1" min="0" max="100"
                  :value="(markupRate * 100).toFixed(1)"
                  @blur="saveMarkupRate(($event.target as HTMLInputElement).value)" />%
              </label>
            </div>
            <button class="btn btn-accent" :disabled="currentShopFull" @click="openForm()"><AppIcon icon="plus" :size="12" /> 入库</button>
          </div>
        <div class="table-wrap" v-if="shopItems.length > 0">
          <table class="table">
            <thead><tr>
              <th>物品</th><th>数量</th>
              <th class="th-sort" @click="toggleSort('buy_price')">市场价(万)<span class="sort-arrow" v-if="sortField === 'buy_price'">{{ sortDir === 'desc' ? '▼' : '▲' }}</span></th>
              <th class="th-sort" @click="toggleSort('target_price')">目标价(万)<span class="sort-arrow" v-if="sortField === 'target_price'">{{ sortDir === 'desc' ? '▼' : '▲' }}</span></th>
              <th>成本价(万)</th>
              <th class="th-sort" @click="toggleSort('cost')">成本<span class="sort-arrow" v-if="sortField === 'cost'">{{ sortDir === 'desc' ? '▼' : '▲' }}</span></th>
              <th class="th-sort" @click="toggleSort('margin')">利润率<span class="sort-arrow" v-if="sortField === 'margin'">{{ sortDir === 'desc' ? '▼' : '▲' }}</span></th>
              <th class="th-sort" @click="toggleSort('profit')">预估利润<span class="sort-arrow" v-if="sortField === 'profit'">{{ sortDir === 'desc' ? '▼' : '▲' }}</span></th>
              <th>状态</th><th>备注</th><th></th>
            </tr></thead>
            <tbody>
              <tr v-for="item in shopItems" :key="item.id" :class="{ 'row-high-margin': getMargin(item) >= 10 }">
                <td class="td-name" @click="copyItemName(item.item_name)" title="点击复制名称">{{ item.item_name }}</td>
                <td style="white-space:nowrap">
                  <input class="inline-input inline-input--qty" type="number" min="1"
                    :value="item.buy_quantity"
                    @blur="inlineSaveQty(item, ($event.target as HTMLInputElement).value)" />
                </td>
                <td style="white-space:nowrap">
                  <input class="inline-input inline-input--price" type="text" inputmode="decimal"
                    :value="item.buy_price" placeholder="0"
                    @blur="inlineSaveBuy(item, ($event.target as HTMLInputElement).value)" />
                </td>
                <td style="white-space:nowrap">
                  <input class="inline-input inline-input--price" type="text" inputmode="decimal"
                    :value="item.target_price || ''" placeholder="0"
                    @blur="inlineSaveTarget(item, ($event.target as HTMLInputElement).value)" />
                </td>
                <td>{{ item.target_price ? (item.target_price / (1 + markupRate)).toFixed(4) : '-' }}</td>
                <td>{{ parseFloat((item.buy_price * item.buy_quantity).toFixed(4)) }} 万</td>
                <td>
                  <span v-if="item.target_price && item.buy_price" :class="(((item.target_price * (1 - taxRate)) - item.buy_price) / item.buy_price) >= 0 ? 'text-success' : 'text-danger'">
                    {{ ((((item.target_price * (1 - taxRate)) - item.buy_price) / item.buy_price) * 100).toFixed(1) }}%
                  </span>
                  <span v-else class="td-muted">-</span>
                </td>
                <td>
                  <span v-if="item.target_price" :class="((item.target_price * (1 - taxRate)) - item.buy_price) >= 0 ? 'text-success' : 'text-danger'">
                    {{ parseFloat((((item.target_price * (1 - taxRate)) - item.buy_price) * item.buy_quantity).toFixed(4)) }} 万
                  </span>
                  <span v-else class="td-muted">-</span>
                </td>
                <td>
                  <select class="inline-select" :value="item.status" @change="inlineSaveStatus(item, ($event.target as HTMLSelectElement).value)">
                    <option value="持有">持有</option><option value="未持有">未持有</option><option value="已售">已售</option>
                  </select>
                </td>
                <td>
                  <input class="inline-input inline-input--notes" type="text"
                    :value="item.notes || ''" placeholder="-"
                    @blur="inlineSaveNotes(item, ($event.target as HTMLInputElement).value)" />
                </td>
                <td class="td-actions">
                  <button class="btn-icon" @click="editItem(item)"><AppIcon icon="pencil" :size="13" /></button>
                  <button class="btn-icon btn-icon--danger" @click="deleteItem(item.id)"><AppIcon icon="x" :size="13" /></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="hint" v-else>库存为空 — 点击「+ 入库」开始记录</div>
        </div>
      </div>
    </div>
  </div>

    <!-- 入库/编辑弹窗 -->
    <div class="modal-overlay" v-if="showForm" @click.self="showForm = false">
      <div class="modal">
        <div class="modal-head"><h4>{{ editing ? '编辑' : '入库' }} · {{ businesses[businessId] }} · {{ shopAliases[form.form_shop] }}</h4><button class="btn-icon" @click="showForm = false"><AppIcon icon="x" :size="13" /></button></div>
        <div class="modal-body">
          <div class="form-row sug-form-row">
            <label class="form-label">物品名称</label>
            <div class="search-sug-wrap" ref="sugWrapRef">
              <input
                v-model="form.item_name"
                class="input sug-input"
                placeholder="搜索物品名称 · 拼音 / 首字母..."
                @focus="onSugFocus"
                @keydown.down.prevent="sugHighlight = Math.min(sugHighlight + 1, sugItems.length - 1)"
                @keydown.up.prevent="sugHighlight = Math.max(sugHighlight - 1, -1)"
                @keydown.enter.prevent="onSugEnter"
                @keydown.escape="sugVisible = false"
                @input="onSugInput"
              />
              <ul class="sug-dropdown" v-if="sugVisible && sugItems.length > 0">
                <li
                  v-for="(item, idx) in sugItems"
                  :key="item.name"
                  :class="{ 'sug-item--active': idx === sugHighlight }"
                  @mousedown.prevent="selectSug(item.name)"
                >
                  <span class="sug-name">{{ item.name }}</span>
                  <span class="sug-slot">{{ item.slot }}</span>
                </li>
              </ul>
            </div>
          </div>
          <div class="form-row form-row--2col">
            <div><label class="form-label">市场价（万）</label><input v-model.number="form.buy_price" class="input" type="number" step="0.0001" /></div>
            <div><label class="form-label">数量</label><input v-model.number="form.buy_quantity" class="input" type="number" /></div>
          </div>
          <div class="form-row form-row--2col">
            <div><label class="form-label">目标价（万）</label><input v-model.number="form.target_price" class="input" type="number" step="0.0001" /></div>
            <div><label class="form-label">状态</label><select v-model="form.status" class="input"><option value="持有">持有</option><option value="未持有">未持有</option><option value="已售">已售</option></select></div>
          </div>
          <div class="form-row" v-if="form.target_price > 0">
            <label class="form-label">成本价（自动计算）<span class="form-label-hint"> = 目标价 ÷ (1 + 溢价率)</span></label>
            <span class="form-calc">{{ (form.target_price / (1 + markupRate)).toFixed(4) }} 万</span>
          </div>
          <div class="form-row form-row--2col">
            <div><label class="form-label">目标店铺</label>
              <select v-model.number="form.form_shop" class="input">
                <option v-for="i in 10" :key="i" :value="i - 1" :disabled="form.status === '持有' && isShopFull(i - 1) && (editing?.shop_index ?? -1) !== i - 1">
                  {{ shopAliases[i - 1] }}（{{ shopItemCounts[i - 1] }}/10）{{ form.status === '持有' && isShopFull(i - 1) && (editing?.shop_index ?? -1) !== i - 1 ? ' - 已满' : '' }}
                </option>
              </select>
            </div>
          </div>
          <div class="form-row"><label class="form-label">备注</label><input v-model="form.notes" class="input" /></div>
        </div>
        <div class="modal-foot"><button class="btn btn-ghost" @click="showForm = false">取消</button><button class="btn btn-accent" @click="saveItem">保存</button></div>
      </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated, nextTick, watch } from 'vue'
import { useAppStore } from '@/stores'
import { convertToPinyin } from 'tiny-pinyin'
import AppIcon from '@/components/ui/AppIcon.vue'

const app = useAppStore()

interface InvItem { id: number; item_name: string; buy_price: number; buy_quantity: number; target_price: number; status: string; notes: string; shop_index: number; business_id: number }
interface NameEntry { name: string; slot: string; py: string; fullPy: string }

const shopIndex = ref(0)
const businessId = ref(0)
const businesses = ref<string[]>(['国令商行'])
const editingBusiness = ref(-1)
const businessDraft = ref('')
const inventory = ref<InvItem[]>([])
const showForm = ref(false); const editing = ref<InvItem | null>(null)
const form = ref({ item_name: '', buy_price: 0, buy_quantity: 1, target_price: 0, status: '持有', notes: '', form_shop: 0 })

// ── 大区商行总数（按大区存储，可编辑） ──
const totalStalls = ref(100)
const editingStalls = ref(false)
const stallsDraft = ref('')
const stallsInputRef = ref<HTMLInputElement | null>(null)

function stallsKey() { return `shop_total_stalls_${app.currentServerId}` }

async function loadStalls() {
  try {
    const v = await window.electronAPI.getSetting(stallsKey())
    if (v) {
      const n = parseInt(v, 10)
      if (n > 0) totalStalls.value = n
    }
  } catch { /* use default */ }
}

async function saveStalls() {
  try {
    await window.electronAPI.setSetting(stallsKey(), String(totalStalls.value))
  } catch { /* ignore */ }
}

async function startEditStalls() {
  stallsDraft.value = String(totalStalls.value)
  editingStalls.value = true
  await nextTick()
  if (stallsInputRef.value) { stallsInputRef.value.focus(); stallsInputRef.value.select() }
}

async function commitStalls() {
  const v = parseInt(stallsDraft.value, 10)
  if (!isNaN(v) && v > 0) {
    totalStalls.value = v
    await saveStalls()
  }
  editingStalls.value = false
}

// ── 税率（根据已使用店铺数自动计算）& 溢价率（按大区存储） ──
const markupRate = ref(0.04)

function markupRateKey() { return `shop_markup_rate_${app.currentServerId}` }

async function loadRates() {
  try {
    const m = await window.electronAPI.getSetting(markupRateKey())
    if (m) markupRate.value = parseFloat(m)
  } catch { /* use defaults */ }
}
async function saveMarkupRate(raw: string) {
  const v = parseFloat(raw) / 100
  if (isNaN(v) || v < 0 || v > 1) return
  markupRate.value = v
  await window.electronAPI.setSetting(markupRateKey(), String(v))
}

// ── 店铺别名（按商行存储） ──
const shopAliases = ref<string[]>(Array.from({ length: 10 }, (_, i) => `店铺 ${i + 1}`))
const editingAlias = ref(-1)
const aliasDraft = ref('')
const aliasInputRef = ref<HTMLInputElement | null>(null)

function shopAliasKey(bid: number) { return `shop_aliases_${app.currentServerId}_${bid}` }

async function loadAliases() {
  try {
    const raw = await window.electronAPI.getSetting(shopAliasKey(businessId.value))
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length === 10) {
        shopAliases.value = parsed
        return
      }
    }
  } catch { /* use defaults */ }
  shopAliases.value = Array.from({ length: 10 }, (_, i) => `店铺 ${i + 1}`)
}

async function saveAliases() {
  try {
    await window.electronAPI.setSetting(shopAliasKey(businessId.value), JSON.stringify(shopAliases.value))
  } catch { /* ignore */ }
}

async function startEditAlias(idx: number) {
  aliasDraft.value = shopAliases.value[idx]
  editingAlias.value = idx
  await nextTick()
  const inputs = document.querySelectorAll('.shop-alias-input')
  const target = inputs[inputs.length - 1] as HTMLInputElement
  if (target) { target.focus(); target.select() }
}

async function commitAlias(idx: number) {
  const val = aliasDraft.value.trim()
  if (val) {
    shopAliases.value[idx] = val
    await saveAliases()
  }
  editingAlias.value = -1
}

// ── 商行管理（按大区存储） ──
function businessesKey() { return `shop_businesses_${app.currentServerId}` }

async function loadBusinesses() {
  try {
    const raw = await window.electronAPI.getSetting(businessesKey())
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        businesses.value = parsed
        return
      }
    }
  } catch { /* use defaults */ }
  // 当前大区无商行数据时初始化为默认
  businesses.value = ['国令商行']
}

async function saveBusinesses() {
  try {
    await window.electronAPI.setSetting(businessesKey(), JSON.stringify(businesses.value))
  } catch { /* ignore */ }
}

async function switchBusiness(bid: number) {
  businessId.value = bid
  shopIndex.value = 0
  await loadAliases()
}

async function addBusiness() {
  const name = `商行 ${businesses.value.length + 1}`
  businesses.value.push(name)
  await saveBusinesses()
  await switchBusiness(businesses.value.length - 1)
}

async function deleteBusiness(idx: number) {
  if (businesses.value.length <= 1) return
  // 检查该商行是否有物品
  const items = inventory.value.filter(i => (i.business_id || 0) === idx && i.status === '持有')
  if (items.length > 0) {
    alert(`「${businesses.value[idx]}」尚有 ${items.length} 件持仓物品，请先清空后再删除。`)
    return
  }
  businesses.value.splice(idx, 1)
  await saveBusinesses()
  // 重新索引：将 business_id > idx 的物品减 1（仅当前大区）
  await window.electronAPI.dbQuery(
    'UPDATE inventory SET business_id = business_id - 1 WHERE business_id > ? AND server_id=?',
    [idx, app.currentServerId]
  )
  // 调整当前选中的商行
  if (businessId.value === idx) {
    businessId.value = Math.min(idx, businesses.value.length - 1)
  } else if (businessId.value > idx) {
    businessId.value = businessId.value - 1
  }
  await switchBusiness(businessId.value)
  await loadInventory()
}

async function startEditBusiness(idx: number) {
  businessDraft.value = businesses.value[idx]
  editingBusiness.value = idx
  await nextTick()
  const inputs = document.querySelectorAll('.business-name-input')
  const target = inputs[inputs.length - 1] as HTMLInputElement
  if (target) { target.focus(); target.select() }
}

async function commitBusiness(idx: number) {
  const val = businessDraft.value.trim()
  if (val) {
    businesses.value[idx] = val
    await saveBusinesses()
  }
  editingBusiness.value = -1
}

// ── SUG 相关 ──
const sugVisible = ref(false)
const sugHighlight = ref(-1)
const sugWrapRef = ref<HTMLElement | null>(null)
const nameIndex = ref<NameEntry[]>([])

const sugItems = computed(() => {
  const raw = form.value.item_name.trim()
  if (!raw) return []
  const kw = raw.toLowerCase()
  const result: Array<{ name: string; slot: string }> = []
  for (const item of nameIndex.value) {
    if (item.name.includes(raw) || item.py.includes(kw) || item.fullPy.includes(kw)) {
      result.push({ name: item.name, slot: item.slot })
      if (result.length >= 10) break
    }
  }
  return result
})

async function selectSug(name: string) {
  form.value.item_name = name
  sugVisible.value = false
  // 从物价图鉴带出：买入价 ← 市场价，目标价 = 买入价 × (1 + 溢价率)
  try {
    const sid = app.currentServerId
    if (sid) {
      const rows = await window.electronAPI.dbQuery(
        'SELECT benchmark_price, market_price FROM price_params WHERE item_name=? AND server_id=? LIMIT 1',
        [name, sid]
      ) as Array<{ benchmark_price: number; market_price: number }>
      if (rows.length > 0) {
        // 亿 → 万；买入价 = 物价图鉴市场价
        const mktWan = parseFloat((rows[0].market_price * 10000).toFixed(4))
        form.value.buy_price = mktWan
        form.value.target_price = parseFloat((mktWan * (1 + markupRate.value)).toFixed(4))
      }
    }
  } catch { /* ignore */ }
}

function onSugFocus() {
  if (form.value.item_name && sugItems.value.length > 0) sugVisible.value = true
}

function onSugInput() {
  sugVisible.value = sugItems.value.length > 0
  sugHighlight.value = -1
}

function onSugEnter() {
  if (sugItems.value.length > 0) {
    selectSug(sugItems.value[sugHighlight.value >= 0 ? sugHighlight.value : 0].name)
  }
}

// ── 拼音 ──
function toPinyinInitials(str: string): string {
  if (!str) return ''
  try {
    const full = convertToPinyin(str, ' ', true)
    return full.split(' ').map(s => s[0] || '').join('').toLowerCase()
  } catch {
    return str.replace(/[一-鿿]/g, '').toLowerCase()
  }
}

function toFullPinyin(str: string): string {
  if (!str) return ''
  try {
    return convertToPinyin(str, '', true).toLowerCase()
  } catch {
    return str.replace(/[一-鿿]/g, '').toLowerCase()
  }
}

// ── 构建名称索引 ──
async function loadNameIndex() {
  try {
    const prices = await window.electronAPI.dbQuery(
      "SELECT DISTINCT item_name, category FROM price_params ORDER BY item_name"
    ) as any[]
    const mat = await window.electronAPI.dbQuery(
      "SELECT name, category FROM material_library ORDER BY category, grade"
    ) as any[]
    const cat = await window.electronAPI.dbQuery(
      "SELECT item_name, category FROM item_catalog ORDER BY category, item_name"
    ) as any[]
    const seen = new Set<string>()
    const result: NameEntry[] = []
    for (const p of prices) {
      if (seen.has(p.item_name)) continue
      seen.add(p.item_name)
      result.push({ name: p.item_name, slot: p.category || '装备', py: toPinyinInitials(p.item_name), fullPy: toFullPinyin(p.item_name) })
    }
    for (const m of mat) {
      if (seen.has(m.name)) continue
      seen.add(m.name)
      result.push({ name: m.name, slot: m.category || '材料', py: toPinyinInitials(m.name), fullPy: toFullPinyin(m.name) })
    }
    for (const c of cat) {
      if (seen.has(c.item_name)) continue
      seen.add(c.item_name)
      result.push({ name: c.item_name, slot: c.category || '其他', py: toPinyinInitials(c.item_name), fullPy: toFullPinyin(c.item_name) })
    }
    nameIndex.value = result
  } catch (e) { console.error('加载物品名称索引失败:', e) }
}

// ── 当前店铺物品 ──
const STATUS_ORDER: Record<string, number> = { '持有': 0, '未持有': 1, '已售': 2 }
const sortField = ref<'buy_price' | 'target_price' | 'cost' | 'margin' | 'profit' | null>(null)
const sortDir = ref<'asc' | 'desc'>('desc')

function toggleSort(field: 'buy_price' | 'target_price' | 'cost' | 'margin' | 'profit') {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortField.value = field
    sortDir.value = 'desc'
  }
}

function itemsForShop(si: number) {
  const items = inventory.value.filter(i => (i.business_id || 0) === businessId.value && (i.shop_index || 0) === si)
  items.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9))
  if (sortField.value) {
    const dir = sortDir.value === 'desc' ? -1 : 1
    items.sort((a, b) => {
      const sa = STATUS_ORDER[a.status] ?? 9
      const sb = STATUS_ORDER[b.status] ?? 9
      if (sa !== sb) return 0
      let va = 0, vb = 0
      switch (sortField.value) {
        case 'buy_price': va = a.buy_price; vb = b.buy_price; break
        case 'target_price': va = a.target_price || 0; vb = b.target_price || 0; break
        case 'cost': va = a.buy_price * a.buy_quantity; vb = b.buy_price * b.buy_quantity; break
        case 'margin': va = a.target_price && a.buy_price ? (((a.target_price * (1 - taxRate.value)) - a.buy_price) / a.buy_price) : -Infinity; vb = b.target_price && b.buy_price ? (((b.target_price * (1 - taxRate.value)) - b.buy_price) / b.buy_price) : -Infinity; break
        case 'profit': va = ((a.target_price || 0) * (1 - taxRate.value)) - a.buy_price; vb = ((b.target_price || 0) * (1 - taxRate.value)) - b.buy_price; break
      }
      return (va - vb) * dir
    })
  }
  return items
}

const shopItems = computed(() => itemsForShop(shopIndex.value))

// 每个店铺的持有物品计数
const shopItemCounts = computed(() => {
  const counts: number[] = Array(10).fill(0)
  for (const item of inventory.value) {
    if (item.status !== '持有') continue
    if ((item.business_id || 0) !== businessId.value) continue
    const idx = item.shop_index || 0
    if (idx >= 0 && idx < 10) counts[idx]++
  }
  return counts
})

const holdingItems = computed(() => inventory.value.filter(i => i.status === '持有' && (i.business_id || 0) === businessId.value))
const totalCost = computed(() => holdingItems.value.reduce((s, i) => s + i.buy_price * i.buy_quantity, 0).toFixed(4))
const totalValue = computed(() => holdingItems.value.reduce((s, i) => {
  const price = i.target_price ? i.target_price * (1 - taxRate.value) : i.buy_price
  return s + price * i.buy_quantity
}, 0).toFixed(4))

// ── 商行统计 ──
const priceIndex = computed(() => totalStalls.value / 100)

const usedShopCount = computed(() => {
  const used = new Set<number>()
  for (const item of inventory.value) {
    if (item.status !== '持有') continue
    if ((item.business_id || 0) !== businessId.value) continue
    const idx = item.shop_index || 0
    used.add(idx)
  }
  return used.size
})

const taxRate = computed(() => Math.max(0, 0.08 - usedShopCount.value * 0.005))

const taxTip = computed(() => {
  const rate = taxRate.value
  return `交易税率 = 8% − 已使用店铺数 × 0.5% = 8% − ${usedShopCount.value} × 0.5% = ${(rate * 100).toFixed(1)}%`
})

const dailyMaintenance = computed(() => priceIndex.value * 1000 * 24 * usedShopCount.value)
const dailyVitality = computed(() => priceIndex.value * 45 * 24 * usedShopCount.value)

const totalProfit = computed(() => (parseFloat(totalValue.value) - parseFloat(totalCost.value) - dailyMaintenance.value / 10000).toFixed(4))
const totalProfitMargin = computed(() => {
  const cost = parseFloat(totalCost.value)
  if (cost <= 0) return '0.00'
  return ((parseFloat(totalProfit.value) / cost) * 100).toFixed(2)
})


function getMargin(item: InvItem): number {
  if (!item.target_price || !item.buy_price) return 0
  return ((item.target_price * (1 - taxRate.value) - item.buy_price) / item.buy_price) * 100
}

// ── 店铺上限 ──
function isShopFull(idx: number): boolean {
  return (shopItemCounts.value[idx] || 0) >= 10
}
const currentShopFull = computed(() => isShopFull(shopIndex.value))

// ── CRUD ──
function openForm(existing?: InvItem) {
  if (existing) {
    editing.value = existing
    form.value = { item_name: existing.item_name, buy_price: existing.buy_price, buy_quantity: existing.buy_quantity, target_price: existing.target_price, status: existing.status, notes: existing.notes || '', form_shop: existing.shop_index || 0 }
  } else {
    if (isShopFull(shopIndex.value)) {
      alert(`「${shopAliases.value[shopIndex.value]}」持有数已达 10 条上限。如需录入请将状态改为「未持有」，或切换店铺。`)
      return
    }
    editing.value = null; form.value = { item_name: '', buy_price: 0, buy_quantity: 1, target_price: 0, status: '持有', notes: '', form_shop: shopIndex.value }
  }
  sugVisible.value = false
  showForm.value = true
}
function editItem(i: InvItem) { openForm(i) }
async function saveItem() {
  const f = form.value; if (!f.item_name) return
  const sid = app.currentServerId
  const targetShop = f.form_shop
  if (f.status === '持有' && isShopFull(targetShop)) {
    const isOwnShop = editing.value && (editing.value.shop_index || 0) === targetShop && editing.value.status === '持有'
    if (!isOwnShop) {
      alert(`「${shopAliases.value[targetShop]}」持有数已达 10 条上限，请选择其他店铺或将状态改为「未持有」。`)
      return
    }
  }
  if (editing.value) {
    await window.electronAPI.dbQuery(`UPDATE inventory SET item_name=?,buy_price=?,buy_quantity=?,target_price=?,status=?,notes=?,shop_index=?,business_id=?,updated_at=datetime('now','localtime') WHERE id=?`, [f.item_name, f.buy_price, f.buy_quantity, f.target_price, f.status, f.notes, targetShop, businessId.value, editing.value.id])
    // 同步物价图鉴：市场价 → price_params
    syncBoughtPrice(f.item_name, f.buy_price)
  } else {
    await window.electronAPI.dbQuery(`INSERT INTO inventory (item_name,server_id,buy_price,buy_quantity,target_price,status,notes,shop_index,business_id) VALUES (?,?,?,?,?,?,?,?,?)`, [f.item_name, sid, f.buy_price, f.buy_quantity, f.target_price, f.status, f.notes, targetShop, businessId.value])
    // 同步物价图鉴：市场价 → price_params
    syncBoughtPrice(f.item_name, f.buy_price)
  }
  showForm.value = false; await loadInventory()
}
async function copyItemName(name: string) {
  try {
    await navigator.clipboard.writeText(name)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = name; ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta); ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}

// ── 行内编辑 ──
async function inlineSaveBuy(item: InvItem, raw: string) {
  const val = parseFloat(raw)
  if (isNaN(val) || val < 0) { await loadInventory(); return }
  if (val === item.buy_price) return
  await window.electronAPI.dbQuery('UPDATE inventory SET buy_price=?, updated_at=datetime(\'now\',\'localtime\') WHERE id=?', [val, item.id])
  item.buy_price = val
  syncBoughtPrice(item.item_name, val)
}
async function inlineSaveTarget(item: InvItem, raw: string) {
  const val = parseFloat(raw)
  if (isNaN(val) || val < 0) { await loadInventory(); return }
  if (val === (item.target_price || 0)) return
  await window.electronAPI.dbQuery('UPDATE inventory SET target_price=?, updated_at=datetime(\'now\',\'localtime\') WHERE id=?', [val, item.id])
  item.target_price = val
}
async function inlineSaveQty(item: InvItem, raw: string) {
  const val = parseInt(raw, 10)
  if (isNaN(val) || val < 1) { await loadInventory(); return }
  if (val === item.buy_quantity) return
  await window.electronAPI.dbQuery('UPDATE inventory SET buy_quantity=?, updated_at=datetime(\'now\',\'localtime\') WHERE id=?', [val, item.id])
  item.buy_quantity = val
}
async function inlineSaveNotes(item: InvItem, raw: string) {
  const val = raw.trim()
  if (val === (item.notes || '')) return
  await window.electronAPI.dbQuery('UPDATE inventory SET notes=?, updated_at=datetime(\'now\',\'localtime\') WHERE id=?', [val, item.id])
  item.notes = val
}
async function inlineSaveStatus(item: InvItem, newStatus: string) {
  if (newStatus === item.status) return
  if (newStatus === '持有' && isShopFull(item.shop_index || 0)) {
    alert(`「${shopAliases.value[item.shop_index || 0]}」持有数已达 10 条上限，无法改为持有。`)
    await loadInventory(); return
  }
  await window.electronAPI.dbQuery('UPDATE inventory SET status=?, updated_at=datetime(\'now\',\'localtime\') WHERE id=?', [newStatus, item.id])
  item.status = newStatus
  await loadInventory()
}

// ── 物价图鉴同步：买入价 → 市场价 ──
async function syncBoughtPrice(itemName: string, buyPrice: number) {
  const sid = app.currentServerId
  if (!sid) return
  try {
    const exist = await window.electronAPI.dbQuery(
      'SELECT id FROM price_params WHERE item_name=? AND server_id=? LIMIT 1',
      [itemName, sid]
    ) as any[]
    const mktYi = Math.round(buyPrice / 10000 * 10000000) / 10000000
    if (!exist || exist.length === 0) {
      await window.electronAPI.dbQuery(
        'INSERT OR IGNORE INTO item_catalog (category, item_name, quality, craft_level, attr_notes) VALUES (?,?,?,?,?)',
        ['其他', itemName, '', '', '']
      )
      await window.electronAPI.dbQuery(
        `INSERT OR REPLACE INTO price_params (item_name,category,server_id,quality,craft_level,attr_notes,benchmark_price,market_price,updated_at) VALUES (?,?,?,?,?,?,0,?,datetime('now','localtime'))`,
        [itemName, '其他', sid, '', '', '', mktYi]
      )
    } else {
      await window.electronAPI.dbQuery(
        `UPDATE price_params SET market_price=?, updated_at=datetime('now','localtime') WHERE id=?`,
        [mktYi, exist[0].id]
      )
    }
  } catch { /* ignore */ }
}

async function deleteItem(id: number) { await window.electronAPI.dbQuery('DELETE FROM inventory WHERE id=?', [id]); await loadInventory() }
async function loadInventory() {
  const sid = app.currentServerId
  if (!sid) { inventory.value = []; return }
  inventory.value = await window.electronAPI.dbQuery('SELECT * FROM inventory WHERE server_id=? ORDER BY updated_at DESC', [sid]) as InvItem[]
}

// ── 大区隔离迁移（一次性） ──
async function migrateServerIsolation() {
  try {
    const done = await window.electronAPI.getSetting('shop_server_migrated_v2')
    if (done === '1') return
  } catch { /* proceed */ }

  // 读取旧全局数据
  let oldBusinesses: string[] = []
  try {
    const raw = await window.electronAPI.getSetting('shop_businesses')
    if (raw) oldBusinesses = JSON.parse(raw)
  } catch { /* ignore */ }
  if (oldBusinesses.length === 0) {
    await window.electronAPI.setSetting('shop_server_migrated_v2', '1')
    return
  }

  // 查找大区 ID
  const servers = await window.electronAPI.dbQuery(
    "SELECT id, name FROM servers WHERE name IN ('得陇望蜀', '青梅拾酒')"
  ) as Array<{ id: number; name: string }>
  const dl = servers.find(s => s.name === '得陇望蜀')
  const qm = servers.find(s => s.name === '青梅拾酒')

  // 迁移商行 0 → 得陇望蜀
  if (dl && oldBusinesses.length >= 1) {
    await window.electronAPI.setSetting(`shop_businesses_${dl.id}`, JSON.stringify([oldBusinesses[0]]))
    // 迁移别名
    const aliases0 = await window.electronAPI.getSetting('shop_aliases_0')
    if (aliases0) await window.electronAPI.setSetting(`shop_aliases_${dl.id}_0`, aliases0)
    // 迁移 inventory: business_id=0 → server_id=dl.id
    await window.electronAPI.dbQuery(
      'UPDATE inventory SET server_id=? WHERE (business_id=0 OR business_id IS NULL) AND (server_id IS NULL OR server_id=0)',
      [dl.id]
    )
  }

  // 迁移商行 1 → 青梅拾酒
  if (qm && oldBusinesses.length >= 2) {
    await window.electronAPI.setSetting(`shop_businesses_${qm.id}`, JSON.stringify([oldBusinesses[1]]))
    const aliases1 = await window.electronAPI.getSetting('shop_aliases_1')
    if (aliases1) await window.electronAPI.setSetting(`shop_aliases_${qm.id}_0`, aliases1)
    // 迁移 inventory: business_id=1 → server_id=qm.id, business_id→0
    // 覆盖两种情况：server_id 未设置的（NULL/0），以及已经设为当前大区的
    await window.electronAPI.dbQuery(
      'UPDATE inventory SET business_id=0 WHERE business_id=1 AND (server_id IS NULL OR server_id=0 OR server_id=?)',
      [qm.id]
    )
    await window.electronAPI.dbQuery(
      'UPDATE inventory SET server_id=? WHERE business_id=0 AND (server_id IS NULL OR server_id=0)',
      [qm.id]
    )
  }

  // 迁移税率/溢价率
  const oldTax = await window.electronAPI.getSetting('shop_tax_rate')
  const oldMarkup = await window.electronAPI.getSetting('shop_markup_rate')
  if (dl) {
    if (oldTax) await window.electronAPI.setSetting(`shop_tax_rate_${dl.id}`, oldTax)
    if (oldMarkup) await window.electronAPI.setSetting(`shop_markup_rate_${dl.id}`, oldMarkup)
  }

  await window.electronAPI.setSetting('shop_server_migrated_v2', '1')
  console.log('[商行迁移] 大区隔离迁移完成')
}

// ── 点击外部关闭 SUG ──
function onDocClick(e: MouseEvent) {
  if (sugWrapRef.value && !sugWrapRef.value.contains(e.target as Node)) {
    sugVisible.value = false
  }
}

// ── 重新加载当前大区全部数据 ──
async function reloadAll() {
  await loadBusinesses()
  shopIndex.value = 0
  businessId.value = 0
  await loadRates()
  await loadStalls()
  await loadAliases()
  await loadInventory()
  lastLoadedServerId = app.currentServerId
}

// keep-alive 下页面被缓存但仍保持挂载：用 active-view + 待刷标记，
// 避免切大区时所有缓存页面的 reload 同时并发（隐藏页只标记，回到前台才真正重载）。
let activeView = false
let pendingReload = false
let everDeactivated = false
let lastLoadedServerId: number | null = null

onMounted(async () => {
  activeView = true
  app.loadServers()
  await migrateServerIsolation()
  await loadBusinesses()
  await loadRates()
  await loadStalls()
  await loadAliases()
  await loadInventory()
  await loadNameIndex()
  lastLoadedServerId = app.currentServerId
  document.addEventListener('click', onDocClick)
})

// 从其他页面切回：仅当本次是「再次激活」（非首挂载）且期间切过大区时，补一次重载。
// 首挂载的数据加载已由 onMounted 完成，避免重复加载。
onActivated(() => {
  activeView = true
  if (everDeactivated && (pendingReload || lastLoadedServerId !== app.currentServerId)) {
    pendingReload = false
    reloadAll()
  }
})
onDeactivated(() => {
  activeView = false
  everDeactivated = true
})

// 切换大区时重新加载全部数据：仅当页面正被查看才立即重载；隐藏时挂起待刷标记
// （去抖合并，避免快速连切大区时多轮 reload 并发叠加）
let reloadTimer: ReturnType<typeof setTimeout> | null = null
watch(() => app.currentServerId, (newId, oldId) => {
  if (!newId || newId === oldId) return
  if (!activeView) { pendingReload = true; return }
  if (reloadTimer) clearTimeout(reloadTimer)
  reloadTimer = setTimeout(async () => {
    reloadTimer = null
    await reloadAll()
  }, 80)
})

onUnmounted(() => {
  if (reloadTimer) clearTimeout(reloadTimer)
  document.removeEventListener('click', onDocClick)
})
</script>

<style scoped>
.page { height: 100%; display: flex; flex-direction: column; }
.page-head { margin-bottom: 10px; flex-shrink: 0; }
.page-head h2 { font-size: var(--text-lg); font-weight: 650; letter-spacing: -0.01em; }
.page-head p { color: var(--color-text-secondary); font-size: var(--text-sm); margin-top: 4px; }
.stats-row { display: grid; grid-template-columns: repeat(5,1fr); gap: 8px; margin-bottom: 8px; flex-shrink: 0; }
.stat-card { padding: 7px 12px; background: var(--color-surface-1); border: 1px solid var(--color-border-light); border-radius: var(--radius-md); box-shadow: var(--shadow-card); display: flex; flex-direction: column; gap: 2px; }
.stat-card--editable { cursor: text; }
.stat-card--editable:hover { border-color: var(--color-accent-ring); }
.stat-label { font-size: var(--text-micro); color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.03em; display: flex; align-items: center; gap: 3px; }
.info-dot {
  display: inline-flex; align-items: center; justify-content: center;
  width: 14px; height: 14px; font-size: var(--text-micro); font-weight: 600;
  border-radius: 50%; cursor: help;
  color: var(--color-text-tertiary); background: var(--color-surface-2);
  transition: color 0.1s, background 0.1s;
  flex-shrink: 0;
}
.info-dot:hover { color: var(--color-accent); background: var(--color-accent-bg); }
.stat-value { font-size: var(--text-lg); font-weight: 650; letter-spacing: -0.02em; }
.stalls-input {
  width: 100%; padding: 2px 4px; font-size: var(--text-lg); font-weight: 650; font-family: inherit;
  background: var(--color-surface-2); color: var(--color-text);
  border: 0.5px solid var(--color-accent-ring); border-radius: var(--radius-sm); outline: none;
  -moz-appearance: textfield;
}
.stalls-input::-webkit-inner-spin-button,
.stalls-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

/* ── 卡片标题栏 ── */
.card-head-left { display: flex; align-items: center; gap: 6px; }
.card-head-divider { color: var(--color-text-tertiary); font-size: var(--text-sm); }
.rate-chip {
  display: inline-flex; align-items: center; gap: 1px;
  padding: 1px 6px; font-size: var(--text-micro); border-radius: 10px;
  background: var(--color-surface-2); color: var(--color-text-tertiary);
  cursor: text; font-weight: 500; border: 0.5px solid transparent;
}
.rate-chip:hover { color: var(--color-text-secondary); }
.rate-chip input {
  width: 28px; padding: 0; border: none; background: transparent;
  color: var(--color-text); font-size: var(--text-micro); font-family: inherit; font-weight: 500;
  text-align: right; outline: none;
}
.rate-chip:focus-within { border-color: var(--color-accent-ring); color: var(--color-accent); }
.rate-chip--readonly {
  cursor: help; user-select: none;
}
.rate-chip--readonly:hover { color: var(--color-accent); border-color: var(--color-accent-ring); }
.rate-chip input::-webkit-inner-spin-button,
.rate-chip input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.rate-chip input { -moz-appearance: textfield; }

/* ── 商行标签栏 ── */
.business-bar {
  display: flex; align-items: center; gap: 4px;
  margin-bottom: 10px; flex-shrink: 0; flex-wrap: wrap;
}
.business-tab {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 12px; border: 0.5px solid var(--color-border-light);
  border-radius: 14px; background: var(--color-surface-1);
  color: var(--color-text-secondary); cursor: pointer;
  font-family: inherit; font-size: var(--text-xs); transition: all 0.12s;
}
.business-tab:hover { background: var(--color-surface-2); color: var(--color-text); }
.business-tab--active { background: var(--color-accent-bg); color: var(--color-accent); border-color: var(--color-accent-ring); }
.business-tab-label { cursor: text; }
.business-tab-label:hover { text-decoration: underline; text-decoration-style: dashed; text-underline-offset: 2px; }
.business-name-input {
  width: 80px; padding: 1px 4px; font-size: var(--text-xs); font-family: inherit;
  background: var(--color-surface-2); color: var(--color-text);
  border: 0.5px solid var(--color-accent-ring); border-radius: var(--radius-sm);
  text-align: center; outline: none;
}
.business-del {
  background: none; border: none; cursor: pointer; font-size: var(--text-md);
  color: var(--color-text-tertiary); padding: 0 1px; line-height: 1;
  border-radius: 50%;
}
.business-del:hover { color: var(--color-danger); background: var(--color-surface-2); }
.business-tab--add {
  width: 28px; height: 28px; padding: 0; justify-content: center;
  border-radius: 50%; font-size: var(--text-lg); font-weight: 600;
  color: var(--color-text-tertiary);
}
.business-tab--add:hover { color: var(--color-accent); border-color: var(--color-accent-ring); }

/* ── 店铺布局 ── */
.shop-layout { display: flex; flex: 1; min-height: 0; gap: 0; }
.shop-sidebar {
  width: 52px; flex-shrink: 0;
  display: flex; flex-direction: column; gap: 0px;
  padding: 4px 2px; background: var(--color-surface-1);
  border-right: 0.5px solid var(--color-border-light);
  border-radius: var(--radius-md) 0 0 var(--radius-md);
  overflow-y: auto;
}
.shop-tab {
  display: flex; flex-direction: column; align-items: center; gap: 0px;
  padding: 4px 1px; border: none; border-radius: 3px;
  background: transparent; color: var(--color-text-secondary);
  cursor: pointer; font-family: inherit; font-size: var(--text-xs);
  transition: all 0.12s;
}
.shop-tab:hover { background: var(--color-surface-2); color: var(--color-text); }
.shop-tab--active { background: var(--color-accent-bg); color: var(--color-accent); }
.shop-tab-num { font-size: var(--text-sm); font-weight: 700; line-height: 1; }
.shop-tab-label {
  font-size: 8px; opacity: 0.7; max-width: 44px; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; cursor: text; line-height: 1.1;
}
.shop-tab-label:hover { opacity: 1; text-decoration: underline; text-decoration-style: dashed; text-underline-offset: 2px; }
.shop-tab-count { font-size: 7px; opacity: 0.45; line-height: 1; }
.shop-alias-input {
  width: 44px; padding: 1px 2px; font-size: 8px; font-family: inherit;
  background: var(--color-surface-2); color: var(--color-text);
  border: 0.5px solid var(--color-accent-ring); border-radius: var(--radius-sm);
  text-align: center; outline: none;
}

.shop-main {
  flex: 1; display: flex; flex-direction: column;
  padding: 0 0 0 8px; min-width: 0;
}

.card { flex: 1; background: var(--color-surface-1); border: 1px solid var(--color-border-light); border-radius: var(--radius-md); box-shadow: var(--shadow-card); padding: 8px 8px; display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
.card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-shrink: 0; }
.card-head h3 { font-size: var(--text-sm); font-weight: 600; }
.table-wrap { flex: 1; overflow-y: auto; }
.table { width: 100%; border-collapse: collapse; font-size: var(--text-micro); }
.table th { text-align: left; padding: 5px 6px; font-size: var(--text-micro); font-weight: 600; color: var(--color-text-tertiary); border-bottom: 0.5px solid var(--color-border-light); position: sticky; top: 0; background: var(--color-surface-1); }
.th-sort { cursor: pointer; user-select: none; }
.th-sort:hover { color: var(--color-accent); }
.sort-arrow { font-size: 7px; margin-left: 1px; color: var(--color-accent); }
.table td { padding: 3px 6px; border-bottom: 0.5px solid var(--color-border-light); white-space: nowrap; }
.table tbody tr:hover { background: var(--color-surface-2); }
.row-high-margin { background: rgba(255, 152, 0, 0.12); }
.row-high-margin:hover { background: rgba(255, 152, 0, 0.20); }
.td-name { font-weight: 500; cursor: pointer; user-select: all; min-width: 120px; }
.td-name:active { opacity: 0.7; }
.td-muted { color: var(--color-text-tertiary); }
.td-notes { max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-text-secondary); font-size: var(--text-micro); }

/* ── 行内编辑（与物价图鉴一致） ── */
.inline-input {
  width: 60px; padding: 2px 4px; font-size: var(--text-micro); font-family: inherit;
  background: var(--color-surface-2); color: var(--color-text);
  border: 0.5px solid transparent; border-radius: var(--radius-sm); text-align: right;
  transition: border-color 0.1s;
  -moz-appearance: textfield;
}
.inline-input::-webkit-inner-spin-button,
.inline-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.inline-input:focus { outline: none; border-color: var(--color-accent-ring); background: var(--color-surface-1); }
.inline-input::placeholder { color: var(--color-text-tertiary); font-size: var(--text-micro); }
.inline-input--price { width: 54px; }
.inline-input--qty { width: 42px; text-align: center; }
.inline-input--notes { width: 64px; text-align: left; }
.inline-select {
  padding: 1px 3px; font-size: var(--text-micro); font-family: inherit;
  background: var(--color-surface-2); color: var(--color-text);
  border: 0.5px solid transparent; border-radius: var(--radius-sm);
  outline: none; cursor: pointer;
}
.inline-select:focus { border-color: var(--color-accent-ring); background-color: var(--color-surface-1); }
.td-actions { display: flex; gap: 2px; }
.badge-sm { font-size: var(--text-micro); padding: 1px 7px; border-radius: 8px; }
.badge-hold { background: var(--color-accent-bg); color: var(--color-accent); }
.badge-sold { background: var(--color-surface-2); color: var(--color-text-tertiary); }

.btn { border: none; border-radius: 5px; cursor: pointer; font-size: var(--text-xs); font-weight: 500; padding: 6px 14px; font-family: inherit; }
.btn-accent { background: var(--color-accent); color: #fff; }
.btn-accent:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-ghost { background: transparent; color: var(--color-text-secondary); }
.btn-icon { background: none; border: none; cursor: pointer; font-size: var(--text-sm); color: var(--color-text-tertiary); padding: 2px 6px; border-radius: 3px; }
.btn-icon:hover { background: var(--color-surface-2); color: var(--color-text); }
.btn-icon--danger:hover { color: var(--color-danger); }
.input { width: 100%; padding: 7px 10px; font-size: var(--text-xs); font-family: inherit; background: var(--color-surface-2); color: var(--color-text); border: 0.5px solid var(--color-border); border-radius: var(--radius-sm); }
.input:focus { outline: none; border-color: var(--color-accent-ring); }
select.input { cursor: pointer; }
/* 原生 select：appearance:none + 自定义 chevron（参照 global.css .server-select） */
select.input,
select.inline-select {
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8F98' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  padding-right: 26px;
}
select.inline-select { padding-right: 16px; background-position: right 3px center; }
select.input option,
select.inline-select option {
  background: var(--color-surface-1);
  color: var(--color-text);
}
.form-row { margin-bottom: 12px; }
.form-label { display: block; font-size: var(--text-micro); color: var(--color-text-secondary); margin-bottom: 4px; }
.form-row--2col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.form-calc { font-size: var(--text-xs); color: var(--color-accent); font-weight: 500; }
.form-label-hint { font-weight: 400; color: var(--color-text-tertiary); font-size: var(--text-micro); }
.modal-overlay { position: fixed; inset: 0; background: rgba(5,6,9,0.45); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; z-index: 200; animation: overlay-in 0.15s ease-out; }
.modal { background: var(--glass-bg); border: 1px solid var(--glass-border); backdrop-filter: blur(28px) saturate(1.5); -webkit-backdrop-filter: blur(28px) saturate(1.5); border-radius: var(--radius-lg); width: 420px; max-width: 90vw; box-shadow: var(--shadow-pop); animation: modal-in 0.18s cubic-bezier(0.2, 0.8, 0.3, 1.1); }
@supports not (backdrop-filter: blur(1px)) {
  .modal { background: var(--color-surface-1); }
}
.modal-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 0.5px solid var(--color-border-light); }
.modal-head h4 { font-size: var(--text-md); font-weight: 600; }
.modal-body { padding: 16px 18px; }
.modal-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 0.5px solid var(--color-border-light); }
.hint { color: var(--color-text-tertiary); text-align: center; padding: 48px 20px; font-size: var(--text-xs); }
.text-success { color: var(--color-success); }
.text-danger { color: var(--color-danger); }

/* ── SUG ── */
.sug-form-row { position: relative; }
.search-sug-wrap { position: relative; }
.sug-dropdown {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 250;
  background: var(--color-surface-2); border: 1px solid var(--color-border-light);
  border-radius: 0 0 var(--radius-sm) var(--radius-sm); list-style: none; padding: 4px 0; margin: 0;
  box-shadow: var(--shadow-pop);
}
.sug-dropdown li {
  padding: 6px 10px; cursor: pointer; font-size: var(--text-xs);
  display: flex; justify-content: space-between; align-items: center;
  transition: background 0.08s;
}
.sug-dropdown li:hover,
.sug-item--active { background: var(--color-accent-bg); }
.sug-name { color: var(--color-text); }
.sug-slot { color: var(--color-text-tertiary); font-size: var(--text-micro); }
</style>
