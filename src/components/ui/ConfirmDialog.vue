<template>
  <Teleport to="body">
    <div v-if="confirmState.visible" class="confirm-overlay" @click.self="settleConfirm(false)">
      <div class="confirm-panel" role="alertdialog" aria-modal="true">
        <div class="confirm-icon" :class="{ 'confirm-icon--danger': confirmState.danger }">
          <AppIcon :icon="confirmState.danger ? 'alert' : 'help'" :size="18" />
        </div>
        <h4 class="confirm-title">{{ confirmState.title }}</h4>
        <div class="confirm-message">{{ confirmState.message }}</div>
        <div class="confirm-actions">
          <button class="confirm-btn confirm-btn--cancel" @click="settleConfirm(false)">
            {{ confirmState.cancelText }}
          </button>
          <button
            class="confirm-btn"
            :class="confirmState.danger ? 'confirm-btn--danger' : 'confirm-btn--primary'"
            @click="settleConfirm(true)"
          >
            {{ confirmState.confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { watch, onUnmounted } from 'vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { confirmState, settleConfirm } from '@/utils/confirm'

function onKeydown(e: KeyboardEvent) {
  if (!confirmState.visible) return
  if (e.key === 'Escape') {
    e.stopPropagation()
    settleConfirm(false)
  } else if (e.key === 'Enter') {
    e.stopPropagation()
    settleConfirm(true)
  }
}

window.addEventListener('keydown', onKeydown, true)

watch(
  () => confirmState.visible,
  (v) => {
    // 打开时让确认按钮获得焦点，回车即确认
    if (v) requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>('.confirm-btn--primary, .confirm-btn--danger')?.focus()
    })
  }
)

onUnmounted(() => window.removeEventListener('keydown', onKeydown, true))
</script>

<style scoped>
/* ═══ 全局二次确认弹窗（玻璃材质，规范见 docs/UI-STYLE.md §3.4）═══ */
.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(5, 6, 9, 0.45);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  animation: overlay-in 0.15s ease-out;
}
[data-theme="light"] .confirm-overlay {
  background: rgba(30, 35, 45, 0.25);
}

.confirm-panel {
  width: min(360px, 90vw);
  background: var(--glass-bg);
  backdrop-filter: blur(28px) saturate(1.5);
  -webkit-backdrop-filter: blur(28px) saturate(1.5);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-pop);
  padding: 22px 24px 18px;
  text-align: center;
  animation: modal-in 0.18s cubic-bezier(0.2, 0.8, 0.3, 1.1);
}
@supports not (backdrop-filter: blur(1px)) {
  .confirm-panel { background: var(--color-surface-1); }
}

.confirm-icon {
  width: 40px;
  height: 40px;
  margin: 0 auto 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-accent-bg);
  color: var(--color-accent);
}
.confirm-icon--danger {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.confirm-title {
  margin: 0 0 6px;
  font-size: var(--text-md);
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--color-text);
}

.confirm-message {
  font-size: var(--text-sm);
  line-height: 1.6;
  color: var(--color-text-secondary);
  white-space: pre-line;
  word-break: break-word;
}

.confirm-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 18px;
}

.confirm-btn {
  min-width: 84px;
  height: 32px;
  padding: 0 16px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 550;
  cursor: pointer;
  transition: all 0.12s ease;
}
.confirm-btn:focus-visible {
  outline: 2px solid var(--color-accent-ring);
  outline-offset: 1px;
}
.confirm-btn--cancel {
  background: var(--color-surface-2);
  color: var(--color-text-secondary);
}
.confirm-btn--cancel:hover {
  background: var(--color-surface-3);
  color: var(--color-text);
}
.confirm-btn--primary {
  background: var(--color-accent);
  color: #fff;
}
.confirm-btn--primary:hover {
  filter: brightness(1.08);
}
.confirm-btn--danger {
  background: var(--color-danger);
  color: #fff;
}
.confirm-btn--danger:hover {
  filter: brightness(1.08);
}
</style>
