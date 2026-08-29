<template>
  <div class="iv-overlay" v-if="modelValue" @click.self="close" @keydown="onKey">
    <button class="iv-close" @click="close">✕</button>
    <button class="iv-nav iv-nav--prev" v-if="images.length > 1" @click="prev">◀</button>
    <div class="iv-main">
      <img :src="current" class="iv-img" />
    </div>
    <button class="iv-nav iv-nav--next" v-if="images.length > 1" @click="next">▶</button>
    <div class="iv-thumbs" v-if="images.length > 1">
      <div
        v-for="(img, idx) in images" :key="idx"
        class="iv-thumb"
        :class="{ 'iv-thumb--active': idx === index }"
        @click="index = idx"
      >
        <img :src="img" class="iv-thumb-img" />
      </div>
    </div>
    <div class="iv-counter" v-if="images.length > 1">{{ index + 1 }} / {{ images.length }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'

const props = defineProps<{
  images: string[]  // data URLs (base64)
  modelValue: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>()

const index = ref(0)
const current = computed(() => props.images[index.value] || '')

function close() { emit('update:modelValue', false) }
function prev() { index.value = (index.value - 1 + props.images.length) % props.images.length }
function next() { index.value = (index.value + 1) % props.images.length }

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
  if (e.key === 'ArrowLeft') prev()
  if (e.key === 'ArrowRight') next()
}

// ESC/方向键全局监听（overlay 内 keydown 依赖焦点，图片放大后焦点丢失会失效）
watch(() => props.modelValue, (v) => {
  if (v) {
    index.value = 0
    document.addEventListener('keydown', onKey)
  } else {
    document.removeEventListener('keydown', onKey)
  }
})
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<style scoped>
.iv-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center;
  flex-direction: column;
}
.iv-close {
  position: absolute; top: 16px; right: 16px; z-index: 10;
  width: 36px; height: 36px; border-radius: 50%; border: none;
  background: rgba(255,255,255,0.15); color: #fff; font-size: 18px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.iv-close:hover { background: rgba(255,255,255,0.3); }
.iv-main { flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 60px; }
.iv-img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 4px; }
.iv-nav {
  position: absolute; top: 50%; transform: translateY(-50%); z-index: 10;
  width: 40px; height: 60px; border: none; background: rgba(255,255,255,0.1);
  color: #fff; font-size: 20px; cursor: pointer; border-radius: 4px;
}
.iv-nav:hover { background: rgba(255,255,255,0.25); }
.iv-nav--prev { left: 16px; }
.iv-nav--next { right: 16px; }
.iv-thumbs {
  display: flex; gap: 6px; padding: 8px 16px 12px; overflow-x: auto;
  max-width: 100%; justify-content: center;
}
.iv-thumb {
  width: 48px; height: 48px; flex-shrink: 0; border-radius: 4px;
  overflow: hidden; cursor: pointer; border: 2px solid transparent; opacity: 0.5;
}
.iv-thumb--active { border-color: #fff; opacity: 1; }
.iv-thumb-img { width: 100%; height: 100%; object-fit: cover; }
.iv-counter {
  color: rgba(255,255,255,0.6); font-size: 12px; padding-bottom: 4px;
}
</style>
