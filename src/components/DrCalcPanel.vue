<template>
  <div class="dr-calc-wrap">
    <!-- 总减伤 + 标准表入口（始终可见） -->
    <div class="dr-total-bar">
      <span class="dr-total-label"><AppIcon icon="shield" :size="14" /> 总减伤</span>
      <span class="dr-total-value">{{ totalDR }}</span>
      <div class="dr-total-spacer"></div>
      <button class="dr-guide-link" @click="showGuideModal = true" title="查看减伤标准表"><AppIcon icon="book" :size="13" /> 查看减伤标准表</button>
    </div>

    <!-- 子 tab -->
    <div class="dr-subtabs">
      <button
        v-for="t in subTabs"
        :key="t.key"
        class="dr-subtab"
        :class="{ 'dr-subtab--active': subTab === t.key }"
        @click="subTab = t.key"
      >{{ t.label }}</button>
    </div>

    <!-- 减伤输入：四大模块双列 -->
    <div v-if="subTab === 'input'" class="dr-modules-grid">
      <!-- 模块1 基础属性 -->
      <div class="dr-module">
        <h3 class="dr-module-title">基础属性</h3>
        <p class="dr-module-note">F1 禁卫为游戏原生禁卫物防基数，是减伤底层计算参数；专注属性降低受到的物理伤害</p>
        <div class="dr-controls">
          <div class="dr-control">
            <span class="dr-control-label">F1 禁卫 1<span class="dr-help" data-tip="分别填写角色 F1 面板 4 条绿色禁卫属性数字">?</span></span>
            <input type="number" class="dr-input" :value="inputs.jinwei1" min="0" @input="setNum('jinwei1', $event)" />
          </div>
          <div class="dr-control">
            <span class="dr-control-label">F1 禁卫 2<span class="dr-help" data-tip="分别填写角色 F1 面板 4 条绿色禁卫属性数字">?</span></span>
            <input type="number" class="dr-input" :value="inputs.jinwei2" min="0" @input="setNum('jinwei2', $event)" />
          </div>
          <div class="dr-control">
            <span class="dr-control-label">F1 禁卫 3<span class="dr-help" data-tip="分别填写角色 F1 面板 4 条绿色禁卫属性数字">?</span></span>
            <input type="number" class="dr-input" :value="inputs.jinwei3" min="0" @input="setNum('jinwei3', $event)" />
          </div>
          <div class="dr-control">
            <span class="dr-control-label">F1 禁卫 4<span class="dr-help" data-tip="分别填写角色 F1 面板 4 条绿色禁卫属性数字">?</span></span>
            <input type="number" class="dr-input" :value="inputs.jinwei4" min="0" @input="setNum('jinwei4', $event)" />
          </div>
          <div class="dr-control">
            <span class="dr-control-label">韧性（0~50）</span>
            <div class="dr-control-row">
              <input type="number" class="dr-input" :value="inputs.toughness" min="0" max="50" @input="setToughness" />
              <span class="dr-toughness-pct">{{ toughnessPct }}</span>
            </div>
          </div>
          <div class="dr-control">
            <span class="dr-control-label">专注 - 翅膀</span>
            <input type="number" class="dr-input" :value="inputs.focusWing" min="0" @input="setNum('focusWing', $event)" />
          </div>
          <div class="dr-control">
            <span class="dr-control-label">专注 - 符咒</span>
            <input type="number" class="dr-input" :value="inputs.focusCharm" min="0" @input="setNum('focusCharm', $event)" />
          </div>
        </div>
      </div>

      <!-- 模块2 装备 -->
      <div class="dr-module">
        <h3 class="dr-module-title">装备</h3>
        <p class="dr-module-note">四象：相同四象的两装备数值累加</p>
        <div class="dr-controls">
          <div class="dr-control">
            <span class="dr-control-label">头部强化</span>
            <input type="number" class="dr-input" :value="inputs.helmStrengthen" min="0" @input="setNum('helmStrengthen', $event)" />
          </div>
          <div class="dr-control">
            <span class="dr-control-label">四象之盾</span>
            <input type="number" class="dr-input" :value="inputs.fourElephantShield" min="0" @input="setNum('fourElephantShield', $event)" />
          </div>
          <div class="dr-control">
            <span class="dr-control-label">头部物防</span>
            <input type="number" class="dr-input" :value="inputs.helmDef" min="0" @input="setNum('helmDef', $event)" />
          </div>
          <div class="dr-control">
            <span class="dr-control-label">上装物防</span>
            <input type="number" class="dr-input" :value="inputs.armorDef" min="0" @input="setNum('armorDef', $event)" />
          </div>
          <div class="dr-control">
            <span class="dr-control-label">下装物防</span>
            <input type="number" class="dr-input" :value="inputs.pantsDef" min="0" @input="setNum('pantsDef', $event)" />
          </div>
        </div>
      </div>

      <!-- 模块3 灵魄 -->
      <div class="dr-module">
        <h3 class="dr-module-title">灵魄</h3>
        <p class="dr-module-note">只填写物伤减免，基础属性已包含在 F1 中</p>
        <div class="dr-controls">
          <div class="dr-control">
            <span class="dr-control-label">头部</span>
            <input type="number" class="dr-input" :value="inputs.spiritHelm" min="0" @input="setNum('spiritHelm', $event)" />
          </div>
          <div class="dr-control">
            <span class="dr-control-label">面具</span>
            <input type="number" class="dr-input" :value="inputs.spiritMask" min="0" @input="setNum('spiritMask', $event)" />
          </div>
          <div class="dr-control">
            <span class="dr-control-label">下装</span>
            <input type="number" class="dr-input" :value="inputs.spiritPants" min="0" @input="setNum('spiritPants', $event)" />
          </div>
          <div class="dr-control">
            <span class="dr-control-label">足部</span>
            <input type="number" class="dr-input" :value="inputs.spiritFeet" min="0" @input="setNum('spiritFeet', $event)" />
          </div>
          <div class="dr-control">
            <span class="dr-control-label">翅膀</span>
            <input type="number" class="dr-input" :value="inputs.spiritWing" min="0" @input="setNum('spiritWing', $event)" />
          </div>
          <div class="dr-control">
            <span class="dr-control-label">符咒</span>
            <input type="number" class="dr-input" :value="inputs.spiritCharm" min="0" @input="setNum('spiritCharm', $event)" />
          </div>
        </div>
      </div>

      <!-- 模块4 其他 & BUFF -->
      <div class="dr-module">
        <h3 class="dr-module-title">其他 &amp; BUFF</h3>
        <div class="dr-controls">
          <div class="dr-control">
            <span class="dr-control-label">奥义</span>
            <input type="number" class="dr-input" :value="inputs.aoyi" min="0" @input="setNum('aoyi', $event)" />
          </div>
          <div class="dr-control">
            <span class="dr-control-label">灵兽图鉴</span>
            <input type="number" class="dr-input" :value="inputs.beastTome" min="0" @input="setNum('beastTome', $event)" />
          </div>
          <div class="dr-control">
            <span class="dr-control-label">天书</span>
            <input type="number" class="dr-input" :value="inputs.tianshu" min="0" @input="setNum('tianshu', $event)" />
          </div>
          <div class="dr-control">
            <span class="dr-control-label">羽灵等级</span>
            <input type="number" class="dr-input" :value="inputs.yulingLevel" min="0" @input="setNum('yulingLevel', $event)" />
          </div>
          <div class="dr-control">
            <span class="dr-control-label">结拜</span>
            <select v-model="inputs.jiebaiLevel" class="dr-input">
              <option v-for="lv in 10" :key="lv" :value="lv">{{ lv }}级</option>
            </select>
          </div>
          <div class="dr-control">
            <span class="dr-control-label">XS 盾（仙术士护盾）</span>
            <select v-model="inputs.xsShield" class="dr-input">
              <option :value="false">无</option>
              <option :value="true">有</option>
            </select>
          </div>
          <div class="dr-control">
            <span class="dr-control-label">钙化</span>
            <select v-model="inputs.gaohua" class="dr-input">
              <option :value="false">无</option>
              <option :value="true">有</option>
            </select>
          </div>
          <div class="dr-control">
            <span class="dr-control-label">YX盾</span>
            <input type="number" class="dr-input" :value="inputs.yxShield" min="0" @input="setNum('yxShield', $event)" />
          </div>
        </div>
      </div>
    </div>

    <!-- 副本对照表 -->
    <div class="dr-section" v-if="subTab === 'dungeon'">
      <h3 class="dr-section-title"><AppIcon icon="swords" :size="14" /> 副本减伤对照<span class="dr-section-note">×N 为专注倍率</span></h3>
      <div class="dr-table-wrap">
        <table class="dr-table">
          <thead>
            <tr>
              <th class="dr-th-name">副本</th>
              <th v-for="diff in DIFF_LABELS" :key="diff.key">{{ diff.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in dungeonRows" :key="row.name">
              <td class="dr-td-name">{{ row.name }}</td>
              <td v-for="cell in row.cells" :key="cell.key" :class="cellClass(cell.status)">
                <span class="dr-cell-val">{{ cell.val }}</span>
                <span v-if="cell.mark" class="dr-cell-mark" :class="cell.mark.cls">{{ cell.mark.text }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 野外对照表 -->
    <div class="dr-section" v-if="subTab === 'wild'">
      <h3 class="dr-section-title"><AppIcon icon="map" :size="14" /> 野外减伤对照</h3>
      <div class="dr-table-wrap">
        <table class="dr-table">
          <thead>
            <tr>
              <th class="dr-th-name">地图</th>
              <th>专注倍率</th>
              <th>减伤要求</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in wildRows" :key="row.name">
              <td class="dr-td-name">{{ row.name }}</td>
              <td class="dr-td-focus">{{ row.focus }}</td>
              <td :class="cellClass(row.status)">
                <span class="dr-cell-val">{{ row.val }}</span>
                <span v-if="row.mark" class="dr-cell-mark" :class="row.mark.cls">{{ row.mark.text }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 减伤标准表弹层 -->
    <div class="modal-overlay" v-if="showGuideModal" @click.self="showGuideModal = false">
      <div class="modal">
        <div class="modal-head">
          <h4><AppIcon icon="shield" :size="16" /> 减伤标准表</h4>
          <button class="btn-icon" @click="showGuideModal = false"><AppIcon icon="x" :size="15" /></button>
        </div>
        <div class="modal-body">
          <div class="dr-section">
            <h3 class="dr-section-title"><AppIcon icon="swords" :size="14" /> 副本减伤要求</h3>
            <div class="dr-table-wrap">
              <table class="dr-table">
                <thead>
                  <tr>
                    <th class="dr-th-name">副本</th>
                    <th v-for="diff in DIFF_LABELS" :key="diff.key">{{ diff.label }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="d in dungeons" :key="d.name">
                    <td class="dr-td-name">{{ d.name }}</td>
                    <td v-for="diff in DIFF_LABELS" :key="diff.key">{{ formatValue((d as any)[diff.key]) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="dr-section">
            <h3 class="dr-section-title"><AppIcon icon="map" :size="14" /> 野外减伤标准</h3>
            <div class="dr-table-wrap">
              <table class="dr-table">
                <thead>
                  <tr>
                    <th class="dr-th-name">地图</th>
                    <th>专注</th>
                    <th>减伤</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="w in wilderness" :key="w.name">
                    <td class="dr-td-name">{{ w.name }}</td>
                    <td>{{ formatFocus(w.focusMultiplier) }}</td>
                    <td>{{ formatVal(w.damageReduction) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import drData from '@/data/damage-reduction-table.json'
import { calcTotalDR, DEFAULT_DR_INPUTS, toughnessInfo, type DRInputs } from '@/utils/damageReduction'

interface DrDiff { value: number | null; multiplier: number | null }
interface DrDungeon { name: string; normal: DrDiff; hero: DrDiff; warrior: DrDiff; saint: DrDiff }
interface DrWilderness { name: string; focusMultiplier: number | null; damageReduction: number | null }

const DIFF_LABELS = [
  { key: 'normal', label: '普通' },
  { key: 'hero', label: '英雄' },
  { key: 'warrior', label: '战神' },
  { key: 'saint', label: '武圣' },
] as const

const STORAGE_KEY = 'sgbuddy-dr-values'

const dungeons = (drData as any).dungeons as DrDungeon[]
const wilderness = (drData as any).wilderness as DrWilderness[]

// ── 子 tab：输入 / 副本对照 / 野外对照 ──
const subTab = ref('input')
const subTabs = [
  { key: 'input', label: '减伤输入' },
  { key: 'dungeon', label: '副本对照' },
  { key: 'wild', label: '野外对照' },
]

// ── 用户输入（localStorage 持久化） ──
function loadSaved(): Partial<DRInputs> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      return p.inputs && typeof p.inputs === 'object' ? p.inputs : {}
    }
  } catch { /* ignore */ }
  return {}
}

const inputs = ref<DRInputs>({ ...DEFAULT_DR_INPUTS, ...loadSaved() })
// 校验恢复的数据：韧性 0~50、结拜 1~10
inputs.value.toughness = Math.min(50, Math.max(0, inputs.value.toughness || 0))
inputs.value.jiebaiLevel = Math.min(10, Math.max(1, inputs.value.jiebaiLevel || 10))

watch(inputs, () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ inputs: inputs.value }))
}, { deep: true })

// 数字输入：空 → 0，非负
function setNum(key: Exclude<keyof DRInputs, 'xsShield' | 'gaohua' | 'jiebaiLevel'>, e: Event) {
  const v = (e.target as HTMLInputElement).value
  const n = v === '' ? 0 : Number(v)
  ;(inputs.value as unknown as Record<string, number>)[key] = Number.isFinite(n) ? Math.max(0, n) : 0
}
// 韧性：0~50 钳制
function setToughness(e: Event) {
  const v = (e.target as HTMLInputElement).value
  const n = v === '' ? 0 : Number(v)
  inputs.value.toughness = Number.isFinite(n) ? Math.min(50, Math.max(0, n)) : 0
}

// ── 总减伤（占位公式：各模块直接相加） ──
const totalDR = computed(() => calcTotalDR(inputs.value))
// 韧性右侧百分比：查韧性表取「减少受到的怪物伤害」
const toughnessPct = computed(() => {
  const info = toughnessInfo(inputs.value.toughness)
  return (info ? info.monsterDR : 0).toFixed(2) + '%'
})

// ── 对照表计算逻辑 ──
function effective(entry: DrDiff | number | null): number | null {
  if (entry === null || entry === undefined) return null
  if (typeof entry === 'number') return entry
  return entry.value
}

type CellStatus = 'none' | 'ok' | 'fail'

function cellStatus(req: number | null): CellStatus {
  if (req === null) return 'none'
  return totalDR.value >= req ? 'ok' : 'fail'
}
function cellClass(status: CellStatus): string {
  return `dr-cell dr-cell--${status}`
}
// 勾/叉标记及其颜色类；无数据时为 null（不显示标记）
function cellMark(req: number | null): { text: string; cls: string } | null {
  const s = cellStatus(req)
  if (s === 'none') return null
  return s === 'ok' ? { text: '✓', cls: 'dr-mark--ok' } : { text: '✗', cls: 'dr-mark--fail' }
}

// ── 显示格式化 ──
// 副本格子：基础数值 + 专注倍率（无倍率即 1，不显示）
function formatValue(entry: DrDiff): string {
  if (entry.value === null) return '—'
  if (entry.multiplier === null || entry.multiplier === 1) return String(entry.value)
  return `${entry.value} ×${entry.multiplier}`
}
function formatFocus(m: number | null): string {
  if (m === null) return '—'
  return `×${m}`
}
function formatVal(v: number | null): string {
  return v === null ? '—' : String(v)
}

// ── 视图模型（预先计算，模板只做展示） ──
const dungeonRows = computed(() =>
  dungeons.map(d => {
    const cells = DIFF_LABELS.map(diff => {
      const entry = (d as any)[diff.key] as DrDiff
      const req = effective(entry)
      return {
        key: diff.key,
        val: formatValue(entry),
        status: cellStatus(req),
        mark: cellMark(req),
      }
    })
    return { name: d.name, cells }
  })
)

const wildRows = computed(() =>
  wilderness.map(w => {
    const req = effective(w.damageReduction)
    return {
      name: w.name,
      focus: formatFocus(w.focusMultiplier),
      val: formatVal(w.damageReduction),
      status: cellStatus(req),
      mark: cellMark(req),
    }
  })
)

// ── 减伤标准表弹层 ──
const showGuideModal = ref(false)
</script>

<style scoped>
.dr-calc-wrap { display: flex; flex-direction: column; gap: 10px; padding-bottom: 4px; }

/* ── 总减伤 ── */
.dr-total-bar {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 14px; border-radius: var(--radius-md);
  background: var(--color-accent-bg); border: 1px solid var(--color-accent-ring);
  box-shadow: var(--shadow-card);
  flex-shrink: 0;
}
.dr-total-label { display: inline-flex; align-items: center; gap: 5px; font-size: var(--text-sm); font-weight: 600; color: var(--color-text); }
.dr-total-value {
  font-size: var(--text-xl); font-weight: 650; color: var(--color-accent);
  font-variant-numeric: tabular-nums; line-height: 1; letter-spacing: -0.02em;
}
.dr-total-spacer { flex: 1; }
.dr-guide-link {
  display: inline-flex; align-items: center; gap: 5px;
  border: 1px solid var(--color-border-light); background: var(--color-surface-1);
  color: var(--color-accent); font-size: var(--text-xs); font-family: inherit; cursor: pointer;
  padding: 5px 12px; border-radius: var(--radius-sm); transition: all 0.12s ease; flex-shrink: 0;
}
.dr-guide-link:hover { border-color: var(--color-accent); background: var(--color-accent-bg); }

/* ── 子 tab ── */
.dr-subtabs { display: flex; gap: 4px; flex-shrink: 0; }
.dr-subtab {
  padding: 5px 14px; border: none; border-radius: var(--radius-sm);
  background: var(--color-surface-2); color: var(--color-text-secondary);
  font-size: var(--text-xs); font-family: inherit; cursor: pointer; transition: all 0.12s ease;
}
.dr-subtab:hover { background: var(--color-hover); color: var(--color-text); }
.dr-subtab--active { background: var(--color-accent-bg); color: var(--color-accent); font-weight: 600; }

/* ── 模块（双列紧凑） ── */
.dr-modules-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: start; }
.dr-module {
  background: var(--color-surface-1); border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md); padding: 10px 12px;
  box-shadow: var(--shadow-card);
  display: flex; flex-direction: column; gap: 6px;
}
.dr-module-title {
  margin: 0; font-size: var(--text-sm); font-weight: 650; color: var(--color-text);
  border-left: 3px solid var(--color-accent); padding-left: 7px; line-height: 1.3;
}
.dr-module-note { margin: 0; font-size: var(--text-micro); color: var(--color-text-tertiary); line-height: 1.5; }
.dr-controls {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 8px; align-items: start;
}
.dr-control { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.dr-control-label {
  font-size: var(--text-micro); font-weight: 550; color: var(--color-text-secondary);
  line-height: 1.3; min-height: 27px;
}
.dr-control-row { display: flex; align-items: center; gap: 5px; }
.dr-input {
  width: 100%; padding: 5px 8px; font-size: var(--text-xs); font-family: inherit;
  background: var(--color-surface-2); color: var(--color-text);
  border: 1px solid var(--color-border-light); border-radius: var(--radius-sm); min-width: 0;
}
.dr-input:focus { outline: none; border-color: var(--color-accent-ring); }
/* 原生 select（结拜 / XS 盾 / 钙化）：appearance none + 自定义 chevron */
select.dr-input {
  appearance: none; -webkit-appearance: none; cursor: pointer;
  background-color: var(--color-surface-2);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8F98' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 8px center;
  padding-right: 26px;
}
.dr-toughness-pct {
  font-size: var(--text-micro); color: var(--color-accent); font-weight: 600;
  white-space: nowrap; font-variant-numeric: tabular-nums;
}

/* ── 问号说明图标 ── */
.dr-help {
  display: inline-flex; align-items: center; justify-content: center;
  width: 13px; height: 13px; border-radius: 50%;
  font-size: var(--text-micro); color: var(--color-text-tertiary);
  border: 1px solid var(--color-border-light); cursor: help;
  margin-left: 3px; position: relative; vertical-align: 1px;
}
.dr-help:hover { color: var(--color-accent); border-color: var(--color-accent); }
.dr-help:hover::after {
  content: attr(data-tip);
  position: absolute; left: 0; top: calc(100% + 5px); z-index: 20;
  width: 200px; padding: 6px 8px; border-radius: var(--radius-sm);
  background: var(--color-surface-3); border: 1px solid var(--color-border-light);
  color: var(--color-text-secondary); font-size: var(--text-micro); line-height: 1.5;
  white-space: normal; font-weight: 400;
}

/* ── 分节（对照表） ── */
.dr-section {
  background: var(--color-surface-1); border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md); overflow: hidden;
  box-shadow: var(--shadow-card);
}
.dr-section-title {
  margin: 0; padding: 10px 14px; font-size: var(--text-sm); font-weight: 600;
  display: flex; align-items: center;
  background: var(--color-surface-2); border-bottom: 0.5px solid var(--color-border-light);
}
.dr-section-title .dr-section-note { margin-left: 8px; }
.dr-section-note { font-size: var(--text-micro); font-weight: 400; color: var(--color-text-tertiary); }
.dr-table-wrap { overflow-x: auto; }
.dr-table { width: 100%; border-collapse: collapse; font-size: var(--text-xs); }
.dr-table th {
  padding: 7px 12px; text-align: left; font-size: var(--text-micro); font-weight: 550;
  color: var(--color-text-secondary); background: var(--color-surface-2);
  border-bottom: 0.5px solid var(--color-border-light); white-space: nowrap;
}
.dr-table td {
  padding: 7px 12px; border-bottom: 0.5px solid var(--color-border-light);
  white-space: nowrap;
}
.dr-table tbody tr:last-child td { border-bottom: none; }
.dr-th-name { min-width: 90px; }
.dr-td-name { font-weight: 550; color: var(--color-text); }
.dr-td-focus { color: var(--color-text-secondary); }

/* ── 单元格状态 ── */
.dr-cell { transition: background 0.15s; }
.dr-cell--ok { background: rgba(52, 199, 89, 0.10); }
.dr-cell--ok .dr-cell-val { color: var(--color-success); font-weight: 600; }
.dr-cell--fail { background: rgba(255, 69, 58, 0.10); }
.dr-cell--fail .dr-cell-val { color: var(--color-danger); font-weight: 600; }
.dr-cell-val { font-variant-numeric: tabular-nums; }
.dr-cell-mark { margin-left: 5px; font-size: var(--text-micro); font-weight: 700; }
.dr-mark--ok { color: var(--color-success); }
.dr-mark--fail { color: var(--color-danger); }

/* ── 减伤标准表弹层（玻璃） ── */
.modal-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(5, 6, 9, 0.45);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex; align-items: center; justify-content: center;
  animation: overlay-in 0.15s ease-out;
}
[data-theme="light"] .modal-overlay { background: rgba(30, 35, 45, 0.25); }
.modal {
  background: var(--glass-bg); border: 1px solid var(--glass-border);
  backdrop-filter: blur(28px) saturate(1.5);
  -webkit-backdrop-filter: blur(28px) saturate(1.5);
  border-radius: var(--radius-lg); width: 560px; max-width: 92vw;
  box-shadow: var(--shadow-pop); display: flex; flex-direction: column; max-height: 80vh;
  animation: modal-in 0.18s cubic-bezier(0.2, 0.8, 0.3, 1.1);
}
@supports not (backdrop-filter: blur(1px)) {
  .modal { background: var(--color-surface-1); }
}
.modal-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 0.5px solid var(--color-border-light); flex-shrink: 0; }
.modal-head h4 { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-md); font-weight: 600; margin: 0; }
.btn-icon {
  width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  background: none; border: none; cursor: pointer; font-size: var(--text-md);
  color: var(--color-text-tertiary); border-radius: var(--radius-sm); transition: all 0.12s ease;
}
.btn-icon:hover { background: var(--color-surface-2); color: var(--color-text); }
.modal-body { padding: 14px 18px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; min-height: 0; }
.modal .dr-section { box-shadow: none; }
.modal .dr-section-title { border: none; padding: 0 0 6px; background: transparent; }
.modal .dr-table tbody tr:nth-child(even) td { background: var(--color-surface-2); }

@media (max-width: 860px) {
  .dr-modules-grid { grid-template-columns: 1fr; }
}
</style>
