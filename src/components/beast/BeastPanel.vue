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
import { loadBeastData, saveBeastData } from '@/utils/beastData'

const categories = ['猛兽', '精怪', '护甲', '魔卫', '长生', '呆萌', '神力', '灵佑']
const activeCat = ref(categories[0])

const beastData = reactive(loadBeastData())

function addSlot(cat: string, grade: string) {
  if (!beastData[cat]) beastData[cat] = {}
  if (!beastData[cat][grade]) beastData[cat][grade] = []
  beastData[cat][grade].push('')
  saveBeastData(beastData)
}

function delSlot(cat: string, grade: string) {
  const arr = beastData[cat]?.[grade]
  if (arr && arr.length > 0) {
    arr.pop()
    saveBeastData(beastData)
  }
}

function updateName(cat: string, grade: string, idx: number, name: string) {
  const arr = beastData[cat]?.[grade]
  if (arr && idx < arr.length) {
    arr[idx] = name
    saveBeastData(beastData)
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
  background: transparent; font-size: var(--text-sm);
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
