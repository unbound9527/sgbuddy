<template>
  <div class="scam-panel">
    <div class="scam-toolbar">
      <label class="scam-switch" title="开启后将在内容区顶部滚动显示本大区与通用骗术提醒">
        <input type="checkbox" :checked="store.tickerEnabled" @change="onToggleTicker" />
        <span class="switch-ui"></span>
        <span class="switch-label">滚动提醒</span>
      </label>
      <span class="toolbar-gap"></span>
      <select class="scam-select" v-model="scope">
        <option value="current">当前大区</option>
        <option value="all">全部大区</option>
      </select>
      <select class="scam-select" v-model="methodFilter">
        <option value="">全部手法</option>
        <option v-for="m in SCAM_METHODS" :key="m" :value="m">{{ m }}</option>
      </select>
      <input class="scam-search" v-model="keyword" placeholder="搜索游戏ID / 描述" />
      <button class="scam-add-btn" @click="openForm()">
        <AppIcon icon="plus" :size="13" /> 新增记录
      </button>
    </div>

    <div class="scam-card">
      <table class="scam-table" v-if="rows.length > 0">
        <thead>
          <tr>
            <th class="col-server">大区</th>
            <th class="col-name">游戏ID</th>
            <th class="col-method">手法</th>
            <th>描述</th>
            <th class="col-time">录入时间</th>
            <th class="col-op">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td class="col-server">{{ serverLabel(r.server_id) }}</td>
            <td class="col-name">{{ r.role_name }}</td>
            <td class="col-method"><span class="method-tag">{{ r.method }}</span></td>
            <td class="col-desc" :title="r.description">{{ r.description }}</td>
            <td class="col-time">{{ fmtTime(r.created_at) }}</td>
            <td class="col-op">
              <button class="op-btn" title="编辑" @click="openForm(r)"><AppIcon icon="pencil" :size="13" /></button>
              <button class="op-btn op-btn--danger" title="删除" @click="remove(r)"><AppIcon icon="trash" :size="13" /></button>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="scam-empty" v-else>
        <AppIcon icon="shield" :size="20" />
        <p>暂无记录。遇到骗子可点击「新增记录」录入其游戏ID与行骗手法，滚动提醒会同步更新。</p>
      </div>
    </div>

    <p class="scam-disclaimer">
      黑名单信息由本机录入、仅供参考，请自行甄别；请勿录入 QQ 号、手机号等他人隐私信息。
    </p>

    <div class="scam-modal-overlay" v-if="showForm" @click.self="showForm = false">
      <div class="scam-modal">
        <div class="scam-modal-head">
          <h3>{{ form.id ? '编辑记录' : '新增骗子记录' }}</h3>
          <button class="op-btn" title="关闭" @click="showForm = false"><AppIcon icon="x" :size="13" /></button>
        </div>
        <div class="scam-form">
          <label class="form-row">
            <span class="form-label">所属大区</span>
            <select class="form-input" v-model="form.server_id">
              <option :value="SCAM_GLOBAL_SERVER_ID">全大区通用</option>
              <option v-for="s in app.servers" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </label>
          <label class="form-row">
            <span class="form-label">游戏ID</span>
            <input class="form-input" v-model="form.role_name" :maxlength="20" placeholder="骗子在游戏内的角色名" />
          </label>
          <label class="form-row">
            <span class="form-label">行骗手法</span>
            <select class="form-input" v-model="form.method">
              <option v-for="m in SCAM_METHODS" :key="m" :value="m">{{ m }}</option>
            </select>
          </label>
          <label class="form-row">
            <span class="form-label">手法描述</span>
            <textarea
              class="form-input form-textarea"
              v-model="form.description"
              rows="4"
              placeholder="描述对方的具体行骗过程，例如：世界频道低价代充，收款后拉黑"
            ></textarea>
          </label>
          <div class="form-error" v-if="formError">{{ formError }}</div>
        </div>
        <div class="scam-modal-foot">
          <button class="btn-ghost" @click="showForm = false">取消</button>
          <button class="btn-primary" @click="save">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { useAppStore } from '@/stores'
import { SCAM_GLOBAL_SERVER_ID, SCAM_METHODS, useBlacklistStore, type ScamEntry } from '@/stores/blacklist'
import { appConfirm } from '@/utils/confirm'

const app = useAppStore()
const store = useBlacklistStore()

const rows = ref<ScamEntry[]>([])
const scope = ref<'current' | 'all'>('current')
const methodFilter = ref('')
const keyword = ref('')
const showForm = ref(false)
const formError = ref('')
const form = reactive({ id: 0, server_id: 0, role_name: '', method: '其他', description: '' })

async function load() {
  const sid = app.currentServerId
  if (scope.value === 'current' && !sid) {
    rows.value = []
    return
  }
  const conds: string[] = []
  const params: unknown[] = []
  if (scope.value === 'current' && sid) {
    conds.push('server_id IN (?, ?)')
    params.push(sid, SCAM_GLOBAL_SERVER_ID)
  }
  if (methodFilter.value) {
    conds.push('method = ?')
    params.push(methodFilter.value)
  }
  const kw = keyword.value.trim()
  if (kw) {
    conds.push('(role_name LIKE ? OR description LIKE ?)')
    params.push(`%${kw}%`, `%${kw}%`)
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
  try {
    rows.value = (await window.electronAPI.dbQuery(
      `SELECT * FROM scammer_blacklist ${where} ORDER BY updated_at DESC, id DESC`,
      params,
    )) as ScamEntry[]
  } catch (e) {
    console.error('加载骗子黑名单失败:', e)
    rows.value = []
  }
}

function serverLabel(serverId: number) {
  if (serverId === SCAM_GLOBAL_SERVER_ID) return '通用'
  return app.servers.find(s => s.id === serverId)?.name || `大区${serverId}`
}

function fmtTime(t: string | null) {
  return t ? t.slice(5, 16) : '--'
}

function openForm(row?: ScamEntry) {
  formError.value = ''
  if (row) {
    form.id = row.id
    form.server_id = row.server_id
    form.role_name = row.role_name
    form.method = row.method
    form.description = row.description
  } else {
    form.id = 0
    form.server_id = app.currentServerId ?? SCAM_GLOBAL_SERVER_ID
    form.role_name = ''
    form.method = '其他'
    form.description = ''
  }
  showForm.value = true
}

async function save() {
  formError.value = ''
  if (!form.role_name.trim()) {
    formError.value = '请填写游戏ID'
    return
  }
  try {
    if (form.id) {
      await window.electronAPI.dbQuery(
        `UPDATE scammer_blacklist
            SET server_id = ?, role_name = ?, method = ?, description = ?,
                updated_at = datetime('now','localtime')
          WHERE id = ?`,
        [form.server_id, form.role_name.trim(), form.method, form.description.trim(), form.id],
      )
    } else {
      await window.electronAPI.dbQuery(
        `INSERT INTO scammer_blacklist (server_id, role_name, method, description) VALUES (?, ?, ?, ?)`,
        [form.server_id, form.role_name.trim(), form.method, form.description.trim()],
      )
    }
    showForm.value = false
    store.bumpDataVersion()
    await load()
  } catch (e) {
    console.error('保存骗子记录失败:', e)
    formError.value = '保存失败，请重试'
  }
}

async function remove(row: ScamEntry) {
  if (!(await appConfirm({ title: '删除记录', message: `确定删除「${row.role_name}」的记录吗？`, confirmText: '删除', danger: true }))) return
  try {
    await window.electronAPI.dbQuery('DELETE FROM scammer_blacklist WHERE id = ?', [row.id])
    store.bumpDataVersion()
    await load()
  } catch (e) {
    console.error('删除骗子记录失败:', e)
  }
}

function onToggleTicker(e: Event) {
  store.setTickerEnabled((e.target as HTMLInputElement).checked)
}

watch([scope, methodFilter], load)
let kwTimer: number | undefined
watch(keyword, () => {
  window.clearTimeout(kwTimer)
  kwTimer = window.setTimeout(load, 250)
})
watch(() => app.currentServerId, () => {
  if (scope.value === 'current') load()
})

onMounted(load)
</script>

<style scoped>
.scam-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ── 工具栏 ── */
.scam-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.toolbar-gap {
  flex: 1;
}

.scam-select,
.scam-search {
  height: 30px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface-1);
  color: var(--color-text);
  font-size: var(--text-xs);
  outline: none;
}

.scam-search {
  width: 180px;
}

.scam-search:focus,
.scam-select:focus {
  border-color: var(--color-accent);
}

.scam-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: #fff;
  font-size: var(--text-xs);
  cursor: pointer;
  transition: background 0.12s ease;
}

.scam-add-btn:hover {
  background: var(--color-accent-hover);
}

/* ── 开关 ── */
.scam-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.scam-switch input {
  display: none;
}

.switch-ui {
  position: relative;
  width: 30px;
  height: 17px;
  border-radius: 999px;
  background: var(--color-surface-3);
  border: 1px solid var(--color-border);
  transition: background 0.15s ease, border-color 0.15s ease;
}

.switch-ui::after {
  content: '';
  position: absolute;
  top: 1px;
  left: 1px;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--color-text-secondary);
  transition: transform 0.15s ease, background 0.15s ease;
}

.scam-switch input:checked + .switch-ui {
  background: var(--color-warning-bg);
  border-color: var(--color-warning);
}

.scam-switch input:checked + .switch-ui::after {
  transform: translateX(13px);
  background: var(--color-warning);
}

.switch-label {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

/* ── 列表 ── */
.scam-card {
  background: var(--color-surface-1);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.scam-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-xs);
}

.scam-table th,
.scam-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--color-border-light);
}

.scam-table thead th {
  font-size: var(--text-micro);
  font-weight: 600;
  color: var(--color-text-tertiary);
  background: var(--color-surface-2);
}

.scam-table tbody tr:last-child td {
  border-bottom: none;
}

.scam-table tbody tr:hover {
  background: var(--color-hover);
}

.col-server {
  width: 110px;
  color: var(--color-text-tertiary);
}

.col-name {
  width: 130px;
  font-weight: 600;
  color: var(--color-warning);
}

.col-method {
  width: 130px;
}

.method-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: var(--radius-sm);
  background: var(--color-danger-bg);
  color: var(--color-danger);
  font-size: var(--text-micro);
}

.col-desc {
  color: var(--color-text-secondary);
  max-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-time {
  width: 100px;
  color: var(--color-text-tertiary);
}

.col-op {
  width: 64px;
  white-space: nowrap;
}

.op-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.op-btn:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.op-btn--danger:hover {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.scam-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 36px 20px;
  color: var(--color-text-tertiary);
  font-size: var(--text-xs);
}

.scam-disclaimer {
  margin: 0;
  font-size: var(--text-micro);
  color: var(--color-text-tertiary);
}

/* ── 弹窗 ── */
.scam-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(5, 6, 9, 0.45);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  animation: scam-overlay-in 0.15s ease-out;
}

.scam-modal {
  width: 420px;
  max-width: calc(100vw - 48px);
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  box-shadow: var(--shadow-pop);
  animation: scam-modal-in 0.18s cubic-bezier(0.2, 0.8, 0.3, 1.1);
}

.scam-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 0;
}

.scam-modal-head h3 {
  margin: 0;
  font-size: var(--text-md);
  color: var(--color-text);
}

.scam-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-label {
  font-size: var(--text-micro);
  color: var(--color-text-tertiary);
}

.form-input {
  height: 32px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface-1);
  color: var(--color-text);
  font-size: var(--text-xs);
  outline: none;
  font-family: inherit;
}

.form-input:focus {
  border-color: var(--color-accent);
}

.form-textarea {
  height: auto;
  padding: 8px 10px;
  resize: vertical;
  line-height: 1.5;
}

.form-error {
  font-size: var(--text-micro);
  color: var(--color-danger);
}

.scam-modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 0 16px 16px;
}

.btn-ghost,
.btn-primary {
  height: 30px;
  padding: 0 14px;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
}

.btn-ghost {
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-secondary);
}

.btn-ghost:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.btn-primary {
  border: none;
  background: var(--color-accent);
  color: #fff;
}

.btn-primary:hover {
  background: var(--color-accent-hover);
}

@keyframes scam-overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scam-modal-in {
  from { opacity: 0; transform: translateY(10px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
