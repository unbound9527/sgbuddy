<!-- BeastCategory.vue —— 单分类容器：标题 + 5 品级行 -->
<template>
  <div class="beast-category">
    <div class="sec-head">{{ title }}</div>
    <div class="sec-slots">
      <BeastGradeRow
        v-for="(names, grade) in grades"
        :key="grade"
        :label="grade"
        :category="title"
        :allowed-names="names"
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
        @add-slot="(c: string, g: string) => $emit('addSlot', c, g)"
        @del-slot="(c: string, g: string) => $emit('delSlot', c, g)"
        @update-name="(c: string, g: string, i: number, n: string) => $emit('updateName', c, g, i, n)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import BeastGradeRow from './BeastGradeRow.vue'
defineProps<{
  title: string
  grades: Record<string, string[]>
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
  addSlot: [cat: string, grade: string]; delSlot: [cat: string, grade: string]
  updateName: [cat: string, grade: string, idx: number, name: string]
}>()
</script>

<style scoped>
.sec-head { padding: 8px 14px; background: var(--color-surface-2); font-size: 13px; font-weight: 600; border-radius: var(--radius-sm) var(--radius-sm) 0 0; color: var(--color-text); }
.sec-slots { padding: 8px 12px; display: flex; flex-direction: column; gap: 2px; background: var(--color-surface-1); border: 0.5px solid var(--color-border-light); border-top: none; border-radius: 0 0 var(--radius-sm) var(--radius-sm); }
</style>
