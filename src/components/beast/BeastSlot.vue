<!-- BeastSlot.vue —— 卡槽单元：双击编辑灵兽名，点击展开下拉选择 -->
<template>
  <div
    class="beast-slot"
    :class="{
      'beast-slot--empty': !itemName,
      'beast-slot--open': expanded,
      'beast-slot--ai': ai,
      'beast-slot--editing': editing,
      'beast-slot--locked': locked,
    }"
    @click.stop="editing || locked ? null : $emit('toggle', slotKey)"
  >
    <!-- 编辑模式 -->
    <input
      v-if="editing"
      class="slot-edit-input"
      :value="hint"
      @blur="finishEdit($event)"
      @keydown.enter="finishEdit($event)"
      @keydown.escape="editing = false"
      @click.stop
      autofocus
    />
    <!-- 显示模式 -->
    <template v-else>
      <span class="slot-lock" :title="lockTitle" @click.stop="$emit('toggleLock', slotKey)">{{ locked ? '🔒' : '🔓' }}</span>
      <span v-if="itemName" class="slot-name" :style="{ color: nameColor }" @dblclick.stop="editing = true">{{ itemName }}</span>
      <span v-else class="slot-placeholder" @dblclick.stop="editing = true">{{ hint || '—' }}</span>
      <span v-if="itemName && price" class="slot-price">{{ price }}</span>
      <span v-if="itemName && hasImage && !locked" class="slot-img" @click.stop="$emit('viewImage', itemName)" title="查看图片">🖼</span>
      <span v-if="itemName && !locked" class="slot-clear" @click.stop="$emit('clear', slotKey)" title="清除">✕</span>
    </template>

    <!-- 下拉面板 -->
    <div v-if="expanded && !editing && !locked" class="slot-dropdown" @click.stop>
      <div class="slot-dropdown-list">
        <div
          v-for="item in options"
          :key="item.name"
          class="slot-dropdown-item"
          :class="{ 'slot-dropdown-item--disabled': item._disabled }"
          @click="selectAndClose(item)"
        >
          <span class="sdi-name" :style="{ color: getQualityColor(item._quality) }">{{ item.name }}</span>
          <span v-if="item._notes" class="sdi-notes">{{ item._notes }}</span>
          <span class="sdi-price">{{ item._price > 0 ? item._price + '万' : (item._hint || '—') }}</span>
          <span class="sdi-img" v-if="optionHasImage(item)" @click.stop="emit('viewOptionImage', item)" title="查看图片">🖼</span>
        </div>
        <div v-if="options && options.length === 0" class="slot-dropdown-empty">
          暂无物价数据
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  slotKey: string; itemName: string; nameColor: string; price: string
  ai: boolean; expanded: boolean; locked: boolean; lockTitle: string; hint: string; hasImage: boolean
  options: Array<{ name: string; _price: number; _notes: string; _quality: string; _disabled?: boolean; _hint?: string }>
  getQualityColor: (q: string) => string
  optionHasImage: (item: any) => boolean
}>()

const emit = defineEmits<{
  toggle: [key: string]; select: [key: string, item: any]; clear: [key: string]
  'update:hint': [slotKey: string, newName: string]
  viewImage: [itemName: string]
  viewOptionImage: [item: any]
  toggleLock: [key: string]
}>()

const editing = ref(false)

function selectAndClose(item: any) {
  if (props.locked) return
  // 未录入价格的占位行不可选中
  if (item._disabled) return
  emit('select', props.slotKey, item)
}

function finishEdit(e: Event) {
  const val = (e.target as HTMLInputElement).value.trim()
  editing.value = false
  if (val && val !== props.hint) {
    emit('update:hint', props.slotKey, val)
  }
}
</script>

<style scoped>
.beast-slot {
  position: relative;
  width: 64px; height: 64px;
  border: 0.5px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; cursor: pointer;
  font-size: 12px;
  transition: border-color .15s;
}
.beast-slot:hover { border-color: var(--color-accent); background: var(--color-surface-3); }
.beast-slot--empty { opacity: 0.5; border-style: dashed; }
.beast-slot--open { border-color: var(--color-accent); background: var(--color-accent-bg); opacity: 1; z-index: 101; }
.beast-slot--ai { border-left: 3px solid var(--color-accent); background: var(--color-accent-bg); }
.beast-slot--editing { border-color: var(--color-accent); opacity: 1; cursor: text; }
.slot-edit-input {
  width: 100%; height: 100%; border: none; background: transparent;
  text-align: center; font-size: 11px; color: var(--color-text);
  outline: none; padding: 2px;
}
.slot-placeholder { color: var(--color-text-tertiary); font-size: 11px; text-align: center; line-height: 1.2; overflow: hidden; }
.slot-name { font-size: 13px; text-align: center; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 58px; font-weight: 500; }
.slot-price { position: absolute; bottom: 1px; right: 3px; font-size: 10px; color: var(--color-accent); }
.slot-img { position: absolute; top: 0; left: 2px; font-size: 10px; cursor: pointer; opacity: 0.7; z-index: 1; }
.slot-img:hover { opacity: 1; }
.slot-lock { position: absolute; top: 0; left: 2px; font-size: 11px; cursor: pointer; opacity: 0.5; z-index: 1; transition: opacity 0.12s; }
.slot-lock:hover { opacity: 1; }
.beast-slot--locked { border-color: var(--color-accent); border-width: 2px; cursor: default; }
.beast-slot--locked:hover { background: var(--color-surface-3); }
.slot-clear { position: absolute; top: 0; right: 2px; font-size: 11px; color: var(--color-text-tertiary); line-height: 1; cursor: pointer; padding: 0 2px; }
.slot-clear:hover { color: var(--color-danger); }
.slot-dropdown {
  position: absolute; top: 100%; left: 0; z-index: 100;
  background: var(--color-surface-1); border: 0.5px solid var(--color-accent);
  border-radius: var(--radius-sm); box-shadow: 0 4px 12px rgba(0,0,0,.1);
  width: 200px; max-height: 180px; display: flex; flex-direction: column;
}
.slot-dropdown-list { flex: 1; overflow-y: auto; }
.slot-dropdown-item {
  display: flex; align-items: center; gap: 6px; padding: 5px 8px;
  font-size: 12px; cursor: pointer;
  border-bottom: 0.5px solid var(--color-border-light);
}
.slot-dropdown-item:hover { background: var(--color-hover); }
.slot-dropdown-item--disabled { opacity: 0.45; cursor: not-allowed; }
.slot-dropdown-item--disabled:hover { background: transparent; }
.sdi-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sdi-notes { flex: 2; font-size: 10.5px; color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 60px; }
.sdi-price { font-size: 11px; color: var(--color-accent); font-weight: 500; flex-shrink: 0; margin-left: auto; }
.sdi-img { font-size: 13px; flex-shrink: 0; cursor: pointer; opacity: 0.7; }
.sdi-img:hover { opacity: 1; }
.slot-dropdown-empty { padding: 12px; text-align: center; font-size: 12px; color: var(--color-text-tertiary); }
</style>
