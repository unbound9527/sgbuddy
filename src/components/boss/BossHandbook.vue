<template>
  <div class="boss-wrap">
    <!-- 工具栏 -->
    <div class="boss-toolbar">
      <div class="boss-toolbar-left">
        <input
          :value="store.searchQuery"
          class="boss-search"
          placeholder="&#x1F50D; 搜索怪物名称..."
          @input="store.setSearch(($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="boss-toolbar-right">
        <button class="boss-btn boss-btn-add" @click="onAdd">+ 新增</button>
        <button
          class="boss-btn boss-btn-del"
          :disabled="!store.selectedId"
          @click="confirmDelete"
        >&#x1F5D1; 删除</button>
        <button
          class="boss-btn boss-btn-up"
          :disabled="!store.selectedId"
          @click="store.selectedId && store.moveRow(store.selectedId, 'up')"
        >&#x2191; 上移</button>
        <button
          class="boss-btn boss-btn-down"
          :disabled="!store.selectedId"
          @click="store.selectedId && store.moveRow(store.selectedId, 'down')"
        >&#x2193; 下移</button>
      </div>
    </div>

    <!-- 顶部横向滚动条 -->
    <div
      v-if="store.filteredRows.length > 0"
      ref="scrollTopEl"
      class="boss-scroll-top"
      @scroll="onTopScroll"
    >
      <div class="boss-scroll-spacer" :style="{ width: scrollSpacerW + 'px', height: '1px' }"></div>
    </div>

    <!-- 表格容器 -->
    <div
      class="boss-table-wrap"
      v-if="store.filteredRows.length > 0"
      ref="tableWrapEl"
      @scroll="onTableScroll"
    >
      <table class="boss-table">
        <thead>
          <tr>
            <th
              v-for="col in COLUMNS"
              :key="col.key"
              :class="['boss-th', { 'boss-th--name': col.key === 'name' }]"
              :style="colWidths[col.key] ? { width: colWidths[col.key] + 'px', minWidth: colWidths[col.key] + 'px' } : {}"
            >
              <div
                class="boss-th-inner"
                :class="{ 'boss-th-clickable': col.key === 'level' }"
                @click="col.key === 'level' && store.cycleLevelSort()"
              >
                <span>{{ col.label }}</span>
                <span v-if="col.key === 'level' && store.levelSort !== 'none'" class="boss-sort-arrow">
                  {{ store.levelSort === 'asc' ? '▲' : '▼' }}
                </span>
                <button
                  v-if="col.key !== 'name'"
                  class="boss-filter-btn"
                  :class="{ active: store.columnFilters.has(col.key) }"
                  @click.stop="toggleFilter(col.key)"
                  title="筛选"
                >&#x25BE;</button>
              </div>
              <div
                class="boss-col-resizer"
                @mousedown.prevent="startResize($event, col.key)"
              ></div>
            </th>
          </tr>
          <!-- 筛选输入行 -->
          <tr v-if="activeFilterKey" class="boss-filter-row">
            <th
              v-for="col in COLUMNS"
              :key="'f-' + col.key"
              class="boss-th-filter"
            >
              <input
                v-if="col.key === activeFilterKey"
                :ref="(el: any) => { if (el) filterInputs[col.key] = el }"
                v-model="filterValue"
                type="number"
                class="boss-filter-input"
                placeholder="筛选数值..."
                @input="onFilterInput(col.key, ($event.target as HTMLInputElement).value)"
                @keydown.escape="closeFilter"
                @blur="closeFilter"
                autofocus
              />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in store.filteredRows"
            :key="row.id"
            :class="['boss-tr', { 'boss-tr--selected': store.selectedId === row.id }]"
            @click="store.selectRow(row.id)"
          >
            <td
              v-for="col in COLUMNS"
              :key="col.key"
              :class="['boss-td', {
                'boss-td--name': col.key === 'name',
                'boss-td--num': col.key !== 'name',
                'boss-td--level': col.key === 'level'
              }]"
              :style="colWidths[col.key] ? { width: colWidths[col.key] + 'px', minWidth: colWidths[col.key] + 'px' } : {}"
              @dblclick.stop="startEdit(row, col.key)"
              @keydown="onCellKeydown($event, row, col.key)"
            >
              <input
                v-if="editingCell?.id === row.id && editingCell?.field === col.key"
                :ref="(el: any) => { if (el) editInputEl = el }"
                v-model="editValue"
                :type="col.key === 'name' ? 'text' : 'number'"
                class="boss-cell-input"
                @blur="commitEdit(row, col.key)"
                @keydown.enter="commitEdit(row, col.key)"
                @keydown.escape="cancelEdit"
                @keydown="onEditKeydown($event, row, col.key)"
                @input="validateInput(col.key)"
              />
              <span v-else :class="{ 'boss-cell-bold': isBold(row, col.key) || col.key === 'level' }">
                {{ formatCell(row[col.key], col.key) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 空状态 -->
    <div class="boss-empty" v-else-if="!store.loading">
      <span class="boss-empty-icon">&#x1F479;</span>
      <p>暂无数据</p>
      <p class="boss-empty-hint">点击「+ 新增」添加第一条Boss记录</p>
    </div>

    <!-- 删除确认弹窗 (使用全局 modal 样式) -->
    <div class="modal-overlay" v-if="showDeleteConfirm" @click.self="showDeleteConfirm = false">
      <div class="modal modal--confirm">
        <div class="modal-head">
          <h4>确认删除</h4>
        </div>
        <div class="modal-body">
          <p>确定要删除选中的Boss记录吗？此操作不可撤销。</p>
        </div>
        <div class="modal-foot">
          <button class="boss-modal-btn-cancel" @click="showDeleteConfirm = false">取消</button>
          <button class="boss-modal-btn-danger" @click="doDelete">确认删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useBossHandbook, COLUMNS } from '@/stores/bossHandbook'

const store = useBossHandbook()

const editingCell = ref<{ id: number; field: keyof BossRow } | null>(null)
const editValue = ref('')
const editInputEl = ref<HTMLInputElement | null>(null)
const showDeleteConfirm = ref(false)
const activeFilterKey = ref<string | null>(null)
const filterValue = ref('')
const filterInputs = ref<Record<string, HTMLInputElement>>({})

// Column widths (px) — persisted per session, not saved to DB
const colWidths = ref<Record<string, number>>({})

// Top horizontal scrollbar
const scrollTopEl = ref<HTMLDivElement>()
const tableWrapEl = ref<HTMLDivElement>()
const scrollSpacerW = ref(0)
let scrollLock = false

function updateScrollSpacer() {
  const tw = tableWrapEl.value
  if (tw) scrollSpacerW.value = tw.scrollWidth
}

function onTopScroll() {
  if (scrollLock) return
  scrollLock = true
  if (tableWrapEl.value) tableWrapEl.value.scrollLeft = scrollTopEl.value!.scrollLeft
  scrollLock = false
}

function onTableScroll() {
  if (scrollLock) return
  scrollLock = true
  if (scrollTopEl.value) scrollTopEl.value.scrollLeft = tableWrapEl.value!.scrollLeft
  scrollLock = false
}

let resizeObs: ResizeObserver | null = null

onMounted(() => {
  store.loadRows()
  resizeObs = new ResizeObserver(() => updateScrollSpacer())
  nextTick(() => {
    if (tableWrapEl.value) resizeObs!.observe(tableWrapEl.value)
  })
})

onUnmounted(() => {
  resizeObs?.disconnect()
})

// Update spacer when filtered rows change
watch(() => store.filteredRows, () => nextTick(() => updateScrollSpacer()))

function formatCell(val: unknown, key: string): string {
  if (val === null || val === undefined || val === '') return ''
  if (key === 'name') return String(val)
  return String(val)
}

function isBold(row: BossRow, key: string): boolean {
  try {
    const fields: string[] = JSON.parse(row.bold_fields || '[]')
    return fields.includes(key)
  } catch {
    return false
  }
}

function onCellKeydown(e: KeyboardEvent, row: BossRow, field: keyof BossRow) {
  // Ctrl+B: toggle bold (skip when editing this cell)
  if (e.ctrlKey && e.key === 'b') {
    e.preventDefault()
    if (!editingCell.value || editingCell.value.id !== row.id || editingCell.value.field !== field) {
      store.toggleBold(row.id, field as string)
    }
  }
}

function startEdit(row: BossRow, field: keyof BossRow) {
  editingCell.value = { id: row.id, field }
  editValue.value = field === 'name' ? String(row[field]) : (row[field] === 0 ? '' : String(row[field]))
  nextTick(() => {
    editInputEl.value?.focus()
    editInputEl.value?.select()
  })
}

function validateInput(field: keyof BossRow) {
  if (field === 'name') {
    // Name: text only, remove non-text chars (keep Chinese, letters, digits, basic symbols)
    editValue.value = editValue.value.replace(/[^一-龥a-zA-Z0-9\s\-_.·()（）]/g, '')
  } else {
    // Numeric: integer only
    editValue.value = editValue.value.replace(/[^0-9-]/g, '')
  }
}

function commitEdit(row: BossRow, field: keyof BossRow) {
  if (!editingCell.value) return
  if (field === 'name') {
    store.updateCell(row.id, field, editValue.value.trim())
  } else {
    const num = editValue.value === '' ? 0 : parseInt(editValue.value) || 0
    store.updateCell(row.id, field, num)
  }
  editingCell.value = null
}

function cancelEdit() {
  editingCell.value = null
}

function onEditKeydown(e: KeyboardEvent, row: BossRow, field: keyof BossRow) {
  if (e.key === 'Tab') {
    e.preventDefault()
    navigateCell(e, row, field)
  }
}

async function navigateCell(e: KeyboardEvent, row: BossRow, field: keyof BossRow) {
  // Commit the current edit first
  commitEdit(row, field)

  // Wait for DOM to clean up the old input before creating a new one
  await nextTick()

  // Find current position in visible grid
  const colIndex = COLUMNS.findIndex(c => c.key === field)
  const rowIndex = store.filteredRows.findIndex(r => r.id === row.id)

  // Compute target position
  const direction = e.shiftKey ? -1 : 1
  let newColIndex = colIndex + direction
  let newRowIndex = rowIndex

  if (newColIndex >= COLUMNS.length) {
    newColIndex = 0
    newRowIndex++
  } else if (newColIndex < 0) {
    newColIndex = COLUMNS.length - 1
    newRowIndex--
  }

  // Start editing target cell if it exists
  const targetRow = store.filteredRows[newRowIndex]
  if (targetRow) {
    startEdit(targetRow, COLUMNS[newColIndex].key)
  }
}

async function onAdd() {
  const newRow = await store.addRow()
  if (newRow) {
    await nextTick()
    // Start editing the name cell of the new row
    startEdit(newRow, 'name')
  }
}

function confirmDelete() {
  if (!store.selectedId) return
  showDeleteConfirm.value = true
}

async function doDelete() {
  if (!store.selectedId) return
  await store.deleteRow(store.selectedId)
  showDeleteConfirm.value = false
}

// Column filter
function toggleFilter(key: string) {
  if (activeFilterKey.value === key) {
    closeFilter()
  } else {
    activeFilterKey.value = key
    filterValue.value = store.columnFilters.get(key) ?? ''
    nextTick(() => {
      filterInputs.value[key]?.focus()
    })
  }
}

function onFilterInput(field: string, value: string) {
  store.setColumnFilter(field, value)
}

function closeFilter() {
  activeFilterKey.value = null
  filterValue.value = ''
}

// Column resize
let resizingCol: string | null = null
let resizeStartX = 0
let resizeStartWidth = 0

function startResize(e: MouseEvent, key: string) {
  resizingCol = key
  resizeStartX = e.clientX
  const header = (e.target as HTMLElement).closest('th')
  resizeStartWidth = header?.offsetWidth ?? 100

  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onResize(e: MouseEvent) {
  if (!resizingCol) return
  const delta = e.clientX - resizeStartX
  const newWidth = Math.max(60, resizeStartWidth + delta)
  colWidths.value[resizingCol] = newWidth
}

function stopResize() {
  resizingCol = null
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}
</script>

<style scoped>
.boss-wrap { display: flex; flex-direction: column; gap: 12px; height: 100%; }

/* 工具栏 */
.boss-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-shrink: 0;
}
.boss-toolbar-left { flex: 1; }
.boss-toolbar-right { display: flex; gap: 6px; }

.boss-search {
  width: 260px; padding: 7px 10px; font-size: 12.5px; font-family: inherit;
  background: var(--color-surface-1); color: var(--color-text);
  border: 0.5px solid var(--color-border); border-radius: 6px;
  outline: none; transition: border-color 0.12s;
}
.boss-search:focus { border-color: var(--color-accent-ring); }
.boss-search::placeholder { color: var(--color-text-tertiary); }

.boss-btn {
  padding: 6px 12px; font-size: 12px; font-family: inherit;
  border: 0.5px solid var(--color-border); border-radius: 6px;
  cursor: pointer; transition: all 0.12s;
  background: var(--color-surface-1); color: var(--color-text-secondary);
}
.boss-btn:hover:not(:disabled) { background: var(--color-surface-2); color: var(--color-text); }
.boss-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.boss-btn-add { background: var(--color-accent); color: #fff; border-color: var(--color-accent); }
.boss-btn-add:hover { background: var(--color-accent-hover); }

/* 表格容器 */
/* 顶部横向滚动条镜像 */
.boss-scroll-top {
  overflow-x: auto; overflow-y: hidden;
  border: 0.5px solid var(--color-border);
  border-bottom: none;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  background: var(--color-surface-1);
}
.boss-scroll-spacer { height: 1px; }

.boss-table-wrap {
  flex: 1; overflow: auto; border: 0.5px solid var(--color-border);
  border-top: none;
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  background: var(--color-surface-1);
}

.boss-table {
  border-collapse: separate; border-spacing: 0; table-layout: fixed; min-width: 100%;
  font-size: 12px;
}

/* 表头 */
.boss-th {
  position: sticky; top: 0; z-index: 2;
  background: var(--color-surface-2); padding: 8px 6px;
  text-align: center; font-weight: 600; font-size: 11.5px;
  color: var(--color-text-secondary); white-space: nowrap;
  border-bottom: 1px solid var(--color-border);
  min-width: 60px; overflow: hidden;
}
.boss-th--name { min-width: 120px; }

.boss-th-inner {
  display: flex; align-items: center; justify-content: center; gap: 4px;
}

.boss-filter-btn {
  background: none; border: none; cursor: pointer; font-size: 10px;
  color: var(--color-text-tertiary); padding: 0 2px; line-height: 1;
}
.boss-filter-btn:hover, .boss-filter-btn.active { color: var(--color-accent); }

.boss-th-clickable { cursor: pointer; user-select: none; }
.boss-th-clickable:hover { color: var(--color-text); }
.boss-sort-arrow { font-size: 10px; margin-left: 2px; }

.boss-filter-row .boss-th-filter {
  position: sticky; top: 32px; z-index: 1;
  background: var(--color-surface-1); padding: 4px 6px;
  border-bottom: 0.5px solid var(--color-border-light);
}

.boss-filter-input {
  width: 100%; padding: 4px 6px; font-size: 11px; font-family: inherit;
  background: var(--color-surface-2); color: var(--color-text);
  border: 0.5px solid var(--color-accent-ring); border-radius: 4px;
  outline: none; text-align: center;
}

/* 列宽拖拽手柄 */
.boss-col-resizer {
  position: absolute; right: 0; top: 0; bottom: 0;
  width: 5px; cursor: col-resize; background: transparent;
  transition: background 0.1s;
}
.boss-col-resizer:hover { background: var(--color-accent-ring); }

/* 数据行 */
.boss-tr { transition: background 0.08s; }
.boss-tr:hover { background: var(--color-surface-2); }
.boss-tr--selected { background: var(--color-accent-bg) !important; outline: 1px solid var(--color-accent-ring); outline-offset: -1px; }

.boss-td {
  padding: 6px; text-align: center; border-bottom: 0.5px solid var(--color-border-light);
  color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.boss-td--name { text-align: left; padding-left: 10px; font-weight: 500; }
.boss-td--num { font-variant-numeric: tabular-nums; }
.boss-td--level { font-weight: 700; }
.boss-cell-bold { font-weight: 700; }

/* 编辑输入框 */
.boss-cell-input {
  width: 100%; padding: 2px 4px; font-size: 12px; font-family: inherit;
  background: var(--color-surface-1); color: var(--color-text);
  border: 1px solid var(--color-accent); border-radius: 3px;
  outline: none; text-align: inherit;
}
.boss-td--num .boss-cell-input { text-align: center; }

/* 空状态 */
.boss-empty { text-align: center; padding: 60px 20px; color: var(--color-text-tertiary); }
.boss-empty-icon { font-size: 48px; display: block; margin-bottom: 12px; }
.boss-empty-hint { font-size: 11px; margin-top: 6px; color: var(--color-text-tertiary); }

/* 确认弹窗按钮 (modal 结构样式复用全局 .modal-overlay / .modal / .modal-head / .modal-body / .modal-foot) */
.boss-modal-btn-cancel {
  padding: 6px 14px; font-size: 12px; font-family: inherit;
  background: var(--color-surface-2); color: var(--color-text-secondary);
  border: 0.5px solid var(--color-border); border-radius: 6px; cursor: pointer;
}
.boss-modal-btn-danger {
  padding: 6px 14px; font-size: 12px; font-family: inherit;
  background: var(--color-danger); color: #fff;
  border: none; border-radius: 6px; cursor: pointer;
}
</style>
