<!-- BeastPanel.vue —— 灵兽面板：左侧纵向分类 tab + 右侧可编辑品级卡槽 -->
<template>
  <div class="beast-panel">
    <div class="beast-tabs">
      <button
        v-for="cat in categories"
        :key="cat"
        class="beast-tab"
        :class="{ 'beast-tab--active': activeCat === cat }"
        @click="activeCat = cat"
      >{{ cat }}</button>
    </div>
    <div class="beast-content">
      <BeastCategory
        :title="activeCat"
        :grades="beastData[activeCat]"
        :scheme-details="schemeDetails"
        :catalog-prices="catalogPrices"
        :catalog-qualities="catalogQualities"
        :ai-slots="aiSlots"
        :expanded-slot="expandedSlot"
        :slot-search="slotSearch"
        :locked-slots="lockedSlots"
        :get-lock-title="getLockTitle"
        :get-slot-options="getSlotOptions"
        :get-quality-color="getQualityColor"
        :has-image="hasImage"
        :option-has-image="optionHasImage"
        @toggle="(k: string) => $emit('toggle', k)"
        @select="(k: string, item: any) => $emit('select', k, item)"
        @clear="(k: string) => $emit('clear', k)"
        @view-image="(name: string) => $emit('viewImage', name)"
        @view-option-image="(item: any) => $emit('viewOptionImage', item)"
        @toggle-lock="(k: string) => $emit('toggleLock', k)"
        @add-slot="addSlot"
        @del-slot="delSlot"
        @update-name="updateName"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import BeastCategory from './BeastCategory.vue'

const categories = ['猛兽', '精怪', '护甲', '魔卫', '长生', '呆萌', '神力', '灵佑']
const activeCat = ref(categories[0])

const STORAGE_KEY = 'sgbuddy-beast-data'

const DEFAULT_BEAST_DATA: Record<string, Record<string, string[]>> = {
  '猛兽': {
    '天品': ['天狼', '应龙'],
    '地品': ['霸王龙', '西羌豹', '巨型兽', '朱厌'],
    '玄品': ['熊猫', '双爪豹', '玄角龙'],
    '妙品': ['独角兽', '青纹虎', '奔雷狼'],
    '凡品': ['小野狼', '山猪', '野熊', '青蛇'],
  },
  '精怪': {
    '天品': ['凤凰', '九幽蝶'],
    '地品': ['灵鹿', '墨影精', '九尾狐'],
    '玄品': ['老树妖', '碧魂妖', '石灵'],
    '妙品': ['蝶妖', '灵萤', '雾妖'],
    '凡品': ['萤火', '树精', '小石怪'],
  },
  '护甲': {
    '天品': ['镇岳玄龟', '重甲鳌'],
    '地品': ['岩犀', '玄铠巨象', '象王'],
    '玄品': ['玄甲龟', '鳞甲兽', '三罗鳄'],
    '妙品': ['盾甲蟹', '重甲熊', '白豚蟹', '大猩猩'],
    '凡品': ['石甲龟', '硬壳虫', '岩甲兽'],
  },
  '魔卫': {
    '天品': ['执念魏王', '暗狱魔主'],
    '地品': ['暗影魔将', '蚀骨魔', '星晷', '风魑'],
    '玄品': ['毒牙蛛', '噬魂魔', '冥王'],
    '妙品': ['熔岩蝎', '暗影狼', '中元幽'],
    '凡品': ['暗影蝠', '毒蚊', '腐爪怪'],
  },
  '长生': {
    '天品': ['青元长生仙', '回春灵尊'],
    '地品': ['长生木灵', '碧泉灵', '苍虬', '长鬃兽'],
    '玄品': ['百草灵', '沐光灵', '三叶菇'],
    '妙品': ['翠灵鹿', '愈灵花妖', '灵芝兽'],
    '凡品': ['灵草精', '茯苓兽', '厚苔精'],
  },
  '呆萌': {
    '天品': ['双双', '睡呲'],
    '地品': ['云团兽', '肥啾仙', '眠眠兽'],
    '玄品': ['云朵团子', '肥绒兽', '奶团子'],
    '妙品': ['长耳兔', '胖绒熊', '圆啾啾', '香蕉猴'],
    '凡品': ['小松鼠', '团子兔', '糯团仔', '小鹰'],
  },
  '神力': {
    '天品': ['睚眦', '焚天战猿'],
    '地品': ['离火兽', '执念鸦王', '撼岩兽'],
    '玄品': ['狂力猿', '裂爪兽', '撼山猿', '千里驹', '御风雕', '白象'],
    '妙品': ['蛮力猿', '石锤精', '烈爪兽', '仓鼠长', '绿兽人', '年兽'],
    '凡品': ['小石锤兽', '蛮力熊', '石俑怪', '赤炎蚁', '火雉', '独眼虾', '飞刀蟹', '泥鳅'],
  },
  '灵佑': {
    '天品': ['白泽', '沧澜灵佑'],
    '地品': ['净世灵', '护阵灵', '沧波守卫'],
    '玄品': ['刺羊羊', '守御灵狐', '磐石灵'],
    '妙品': ['护佑蝶', '微光雀', '韧羽灵'],
    '凡品': ['微光灵', '守御灵', '护心灵'],
  },
}

// 从 localStorage 恢复或使用默认值
function loadBeastData(): Record<string, Record<string, string[]>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return JSON.parse(JSON.stringify(DEFAULT_BEAST_DATA))
}

const beastData = reactive(loadBeastData())

function saveBeastData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(beastData))
}

function addSlot(cat: string, grade: string) {
  if (!beastData[cat]) beastData[cat] = {}
  if (!beastData[cat][grade]) beastData[cat][grade] = []
  beastData[cat][grade].push('')
  saveBeastData()
}

function delSlot(cat: string, grade: string) {
  const arr = beastData[cat]?.[grade]
  if (arr && arr.length > 0) {
    arr.pop()
    saveBeastData()
  }
}

function updateName(cat: string, grade: string, idx: number, name: string) {
  const arr = beastData[cat]?.[grade]
  if (arr && idx < arr.length) {
    arr[idx] = name
    saveBeastData()
  }
}

defineProps<{
  schemeDetails: Record<string, string>
  catalogPrices: Record<string, number>
  catalogQualities: Record<string, string>
  aiSlots: Record<string, boolean>
  expandedSlot: string | null
  slotSearch: Record<string, string>
  lockedSlots: Record<string, boolean>
  getLockTitle: (slot: string) => string
  getSlotOptions: (slot: string) => any[]
  getQualityColor: (q: string) => string
  hasImage: (name: string) => boolean
  optionHasImage: (item: any) => boolean
}>()

defineEmits<{
  toggle: [key: string]; select: [key: string, item: any]; clear: [key: string]
  viewImage: [name: string]; viewOptionImage: [item: any]; toggleLock: [key: string]
}>()
</script>

<style scoped>
.beast-panel { flex: 1; display: flex; overflow: hidden; }
.beast-tabs {
  width: 64px; flex-shrink: 0; display: flex; flex-direction: column;
  border-right: 0.5px solid var(--color-border-light);
  padding: 8px 0; overflow-y: auto;
}
.beast-tab {
  padding: 12px 8px; border: none; border-radius: 0;
  background: transparent; font-size: 13px;
  color: var(--color-text-tertiary); cursor: pointer;
  text-align: center; transition: all .12s;
}
.beast-tab:hover { color: var(--color-text); background: var(--color-surface-2); }
.beast-tab--active {
  color: var(--color-accent); background: var(--color-accent-bg);
  font-weight: 550; border-right: 2px solid var(--color-accent);
}
.beast-content { flex: 1; overflow-y: auto; padding: 10px 14px; }
</style>
