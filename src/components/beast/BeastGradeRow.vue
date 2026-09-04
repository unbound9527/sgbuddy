<!-- BeastGradeRow.vue —— 单条品级行：标签 + N 个可编辑卡槽 + 增删按钮 -->
<template>
  <div class="beast-grade-row">
    <span class="grade-label">{{ label }}</span>
    <div class="grade-slots">
      <BeastSlot
        v-for="(beastName, i) in allowedNames"
        :key="`${category}:${label}:${i}`"
        :slot-key="`灵兽:${category}:${label}:${i + 1}`"
        :item-name="schemeDetails[`灵兽:${category}:${label}:${i + 1}`] || ''"
        :name-color="getQualityColor(catalogQualities[schemeDetails[`灵兽:${category}:${label}:${i + 1}`]] || '')"
        :price="catalogPrices[schemeDetails[`灵兽:${category}:${label}:${i + 1}`]] ? catalogPrices[schemeDetails[`灵兽:${category}:${label}:${i + 1}`]] + '万' : ''"
        :has-image="hasImage(schemeDetails[`灵兽:${category}:${label}:${i + 1}`] || '')"
        :ai="!!aiSlots[`灵兽:${category}:${label}:${i + 1}`]"
        :expanded="expandedSlot === `灵兽:${category}:${label}:${i + 1}`"
        :locked="!!lockedSlots[`灵兽:${category}:${label}:${i + 1}`]"
        :lock-title="getLockTitle(`灵兽:${category}:${label}:${i + 1}`)"
        :search="slotSearch[`灵兽:${category}:${label}:${i + 1}`] || ''"
        :options="slotOptions(`灵兽:${category}:${label}:${i + 1}`, beastName)"
        :hint="beastName"
        :get-quality-color="getQualityColor"
        :option-has-image="optionHasImage"
        @view-image="(name: string) => $emit('viewImage', name)"
        @view-option-image="(item: any) => $emit('viewOptionImage', item)"
        @toggle="(k: string) => $emit('toggle', k)"
        @select="(k: string, item: any) => $emit('select', k, item)"
        @clear="(k: string) => $emit('clear', k)"
        @update:hint="(k: string, v: string) => $emit('updateName', category, label, i, v)"
        @toggle-lock="(k: string) => $emit('toggleLock', k)"
      />
      <!-- 新增 / 删除 按钮 -->
      <button class="beast-row-btn" @click.stop="$emit('addSlot', category, label)" title="新增槽位">+</button>
      <button v-if="allowedNames.length > 0" class="beast-row-btn beast-row-btn--del" @click.stop="$emit('delSlot', category, label)" title="删除末尾槽位">−</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import BeastSlot from './BeastSlot.vue'

const props = defineProps<{
  label: string; category: string; allowedNames: string[]
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

function filteredOptions(all: any[], beastName: string) {
  return all.filter((o: any) => o.name === beastName)
}

function slotOptions(slotKey: string, beastName: string) {
  return filteredOptions(props.getSlotOptions(slotKey), beastName)
}
</script>

<style scoped>
.beast-grade-row { display: flex; align-items: center; gap: 8px; padding: 2px 0; }
.grade-label { width: 48px; flex-shrink: 0; font-size: var(--text-sm); font-weight: 550; color: var(--color-text-secondary); text-align: right; }
.grade-slots { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.beast-row-btn {
  width: 32px; height: 32px; border: 0.5px dashed var(--color-border);
  border-radius: var(--radius-sm); background: transparent;
  color: var(--color-text-tertiary); font-size: var(--text-lg); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: all 0.12s ease;
}
.beast-row-btn:hover { border-color: var(--color-accent); color: var(--color-accent); background: var(--color-accent-bg); }
.beast-row-btn--del:hover { border-color: var(--color-danger); color: var(--color-danger); background: transparent; }
</style>
