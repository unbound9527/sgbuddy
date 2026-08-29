<template>
  <div class="page">
    <!-- 顶栏 -->
    <div class="topbar">
      <div class="topbar-left">
        <h2>配号中心</h2>
      </div>
      <div class="topbar-center">
        <select v-model="selectedSchemeId" class="scheme-select" @change="onSchemeSelect">
          <option v-if="!currentScheme" :value="-1">请选择方案...</option>
          <option
            v-for="s in listedSchemes"
            :key="s.id"
            :value="s.id"
            :disabled="!isSchemeSelectable(s)"
          >{{ schemeLabel(s) }}</option>
        </select>
        <template v-if="currentScheme">
          <span v-if="currentScheme.character_name" class="badge badge--char">👤 {{ currentScheme.character_name }}</span>
          <span class="badge">{{ currentScheme.job }} Lv.{{ currentScheme.level_num }}</span>
        </template>
        <button class="btn btn-sm btn-ghost" :disabled="!currentScheme" @click="copyScheme" title="复制方案">⧉</button>
        <button class="btn btn-sm btn-ghost" :disabled="!currentScheme" @click="currentScheme && editScheme(currentScheme)" title="编辑方案">✎</button>
        <button class="btn btn-sm btn-ghost" :disabled="!currentScheme" @click="currentScheme && deleteScheme(currentScheme.id)" title="删除方案">✕</button>
        <button class="btn btn-sm btn-ghost" @click="openNewScheme" title="新增方案">+</button>
      </div>
      <div class="topbar-right">
        <button class="btn btn-sm" @click="exportToExcel" :disabled="!currentScheme">📥 导出 Excel</button>
      </div>
    </div>

    <!-- 方案信息 -->
    <!-- 进度仪表盘 -->
    <div class="dashboard" v-if="currentScheme">
      <div class="dash-row">
        <div class="dash-item dash-item--wide">
          <span class="dash-label">💰 预算 {{ (currentTotalWan / 10000).toFixed(1) }}/{{ currentScheme.total_budget }} 亿</span>
          <div class="dash-bar"><div class="dash-bar-fill" :class="currentTotalWan > currentScheme.total_budget * 10000 ? 'dash-bar-fill--over' : 'dash-bar-fill--budget'" :style="{ width: dashBudgetPercent + '%' }"></div></div>
          <span class="dash-pct" :class="{ 'text-danger': currentTotalWan > currentScheme.total_budget * 10000 }">{{ dashBudgetPercent }}%</span>
        </div>
        <div class="dash-item">
          <span class="dash-label" title="未锁定槽位金额合计（可继续调整的部分）">🔓 可调 {{ (unlockedTotalWan / 10000).toFixed(1) }} 亿</span>
        </div>
      </div>
    </div>
    <div class="hint" v-else>选择一个方案或新建后开始</div>

	    <!-- Tab 栏 -->
    <div class="tab-bar" v-if="currentScheme">
      <button v-for="t in tabs" :key="t.key" class="tab" :class="{ 'tab--active': activeTab === t.key }" @click="switchTab(t.key)">
        {{ t.icon }} {{ t.label }}
        <span class="tab-total" v-if="getTabTotal(t.key) > 0">{{ formatWan(getTabTotal(t.key)) }}</span>
      </button>
    </div>

    <!-- Tab 内容 -->
    <div class="tab-content" v-if="currentScheme">
      <!-- 装备 -->
      <div class="slot-grid-2col" v-if="activeTab === 'equip'">
        <div v-for="g in equipGroups" :key="g.key" class="slot-section-card">
          <div class="sec-head">{{ g.icon }} {{ g.label }}</div>
          <div class="sec-slots">
            <div v-for="s in g.slots" :key="s"
              class="slot-card"
              :class="{
                'slot-card--empty': !getDetail(s),
                'slot-card--open': expandedSlot === s,
                'slot-card--locked': isSlotLocked(s)
              }"
              @click.stop="toggleSlotDropdown(s)"
            >
              <span class="sc-lock" :title="getLockTitle(s)" @click.stop="toggleLock(s)">{{ isSlotLocked(s) ? '🔒' : '🔓' }}</span>
              <span v-if="isSlotLocked(s)" class="sc-lock-time" :title="getLockTitle(s)">{{ getLockTimeShort(s) }}</span>
              <span class="sc-label">{{ s }}</span>
              <span class="sc-val" :style="{ color: getQualityColor(getSlotQuality(s)) }">{{ getDetail(s) || '—' }}</span>
              <span v-if="getDetail(s) && catalogNotes[getDetail(s)]" class="sc-notes">{{ catalogNotes[getDetail(s)] }}</span>
              <span class="sc-price">{{ getPrice(s) }}</span>
              <span class="sc-img" v-if="getDetail(s) && slotImageExists(s)" @click.stop="openSlotImage(s)" title="查看图片">🖼</span>
              <span class="sc-clear" v-if="getDetail(s) && !isSlotLocked(s)" @click.stop="clearSlot(s)" title="清除">✕</span>
              <span class="sc-arrow" v-if="!isSlotLocked(s)">▾</span>
              <!-- 下拉面板 -->
              <div v-if="expandedSlot === s && !isSlotLocked(s)" class="slot-dropdown" @click.stop>
                <input
                  v-model="slotSearch[s]"
                  class="slot-dropdown-search"
                  :placeholder="ocrSearchBusy && ocrSearchSlot === s ? '🔍 识别中…' : '搜索物品...'"
                />
                <!-- OCR 识别反馈 -->
                <div v-if="ocrSearchSlot === s" class="ocr-search-hint">
                  <template v-if="ocrSearchBusy">
                    <span class="ocr-spinner-sm"></span> 识别中…
                  </template>
                  <template v-else>
                    📋 OCR 识别为「<strong>{{ ocrSearchText }}</strong>」
                    <button class="ocr-hint-close" @click="clearOcrHint" title="关闭">✕</button>
                  </template>
                </div>
                <div class="slot-dropdown-list">
                  <template v-if="currentScheme">
                    <div
                      v-for="item in getSlotOptions(s)"
                      :key="item.name"
                      class="slot-dropdown-item"
                      :class="{ 'slot-dropdown-item--disabled': item._disabled }"
                      @click="selectSlotItem(s, item)"
                    >
                      <span class="sdi-name" :style="{ color: getQualityColor(item._quality) }">{{ item.name }}</span>
                      <span v-if="item._notes" class="sdi-notes">{{ item._notes }}</span>
                      <span class="sdi-price">{{ item._price > 0 ? item._price + '万' : (item._hint || '—') }}</span>
                      <span class="sdi-img" v-if="optionHasImage(item)" @click.stop="viewOptionImage(item)" title="查看图片">🖼</span>
                    </div>
                  </template>
                  <div v-if="getSlotOptions(s).length === 0" class="slot-dropdown-empty">
                    {{ slotSearch[s] ? '无匹配物品' : '暂无物品数据' }}
                  </div>
                </div>
                <!-- 快速录入 -->
                <div class="slot-dropdown-quickadd">
                  <template v-if="quickAddSlot === s">
                    <div class="qa-form">
                      <div class="qa-row">
                        <input v-model="quickAddForm.item_name" class="qa-input" placeholder="物品名称" style="flex:1" @keydown.enter.prevent="submitQuickAdd(s)" />
                        <button class="qa-btn-paste" @click="pasteImageToQuickAdd()" :disabled="quickAddOcrBusy" :title="quickAddOcrBusy ? '识别中…' : '粘贴图片识别（或 Ctrl+V）'">{{ quickAddOcrBusy ? '⏳' : '📋' }}</button>
                        <button class="qa-btn-paste" @click="selectImageToQuickAdd()" :disabled="quickAddOcrBusy" title="选择图片识别">📁</button>
                      </div>
                      <div class="qa-row">
                        <span class="qa-price-wrap"><input v-model.number="quickAddForm.market_price" class="qa-input qa-input--price" type="number" step="0.01" min="0" placeholder="价格" @keydown.enter.prevent="submitQuickAdd(s)" /><span class="qa-unit">万</span></span>
                        <select v-model="quickAddForm.quality" class="qa-select">
                          <option value="">品质(可选)</option>
                          <option v-for="q in quickAddQualityOptions" :key="q" :value="q">{{ q }}</option>
                        </select>
                      </div>
                      <div class="qa-row">
                        <input v-model="quickAddForm.attr_notes" class="qa-input" placeholder="备注(选填)" style="flex:1" @keydown.enter.prevent="submitQuickAdd(s)" />
                      </div>
                      <div class="qa-actions">
                        <button class="btn btn-sm btn-accent" @click="submitQuickAdd(s)">保存并选中</button>
                        <button class="btn btn-sm btn-ghost" @click="quickAddSlot = null">取消</button>
                      </div>
                    </div>
                  </template>
                  <template v-else>
                    <div class="qa-trigger" @click="openQuickAdd(s)">
                      <span v-if="slotSearch[s] && getSlotOptions(s).filter(o => !o._disabled).length === 0 && getSlotOptions(s).length > 0">⚡ 未找到「{{ slotSearch[s] }}」，点击快速录入</span>
                      <span v-else>+ 快速录入新物品</span>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 灵魄 -->
      <div class="slot-grid-2col" v-if="activeTab === 'spirit'">
        <div class="slot-section-card" v-for="g in spiritGroups" :key="g.key">
          <div class="sec-head">{{ g.icon }} {{ g.label }}</div>
          <div class="sec-slots">
            <div v-for="s in g.slots" :key="s"
              class="slot-card"
              :class="{
                'slot-card--empty': !getDetail(s),
                'slot-card--open': expandedSlot === s,
                'slot-card--locked': isSlotLocked(s)
              }"
              @click.stop="toggleSlotDropdown(s)"
            >
              <span class="sc-lock" :title="getLockTitle(s)" @click.stop="toggleLock(s)">{{ isSlotLocked(s) ? '🔒' : '🔓' }}</span>
              <span v-if="isSlotLocked(s)" class="sc-lock-time" :title="getLockTitle(s)">{{ getLockTimeShort(s) }}</span>
              <span class="sc-label">{{ s.replace('灵','') }}</span>
              <span class="sc-val" :style="{ color: getQualityColor(getSlotQuality(s)) }">{{ getDetail(s) || '—' }}</span>
              <span v-if="getDetail(s) && catalogNotes[getDetail(s)]" class="sc-notes">{{ catalogNotes[getDetail(s)] }}</span>
              <span class="sc-price">{{ getPrice(s) }}</span>
              <span class="sc-img" v-if="getDetail(s) && slotImageExists(s)" @click.stop="openSlotImage(s)" title="查看图片">🖼</span>
              <span class="sc-clear" v-if="getDetail(s) && !isSlotLocked(s)" @click.stop="clearSlot(s)" title="清除">✕</span>
              <span class="sc-arrow" v-if="!isSlotLocked(s)">▾</span>
              <div v-if="expandedSlot === s && !isSlotLocked(s)" class="slot-dropdown" @click.stop>
                <input v-model="slotSearch[s]" class="slot-dropdown-search" :placeholder="ocrSearchBusy && ocrSearchSlot === s ? '🔍 识别中…' : '搜索物品...'" />
                <!-- OCR 识别反馈 -->
                <div v-if="ocrSearchSlot === s" class="ocr-search-hint">
                  <template v-if="ocrSearchBusy">
                    <span class="ocr-spinner-sm"></span> 识别中…
                  </template>
                  <template v-else>
                    📋 OCR 识别为「<strong>{{ ocrSearchText }}</strong>」
                    <button class="ocr-hint-close" @click="clearOcrHint" title="关闭">✕</button>
                  </template>
                </div>
                <div class="slot-dropdown-list">
                  <template v-if="currentScheme">
                    <div v-for="item in getSlotOptions(s)" :key="item.name" class="slot-dropdown-item" :class="{ 'slot-dropdown-item--disabled': item._disabled }" @click="selectSlotItem(s, item)">
                      <span class="sdi-name" :style="{ color: getQualityColor(item._quality) }">{{ item.name }}</span>
                      <span v-if="item._notes" class="sdi-notes">{{ item._notes }}</span>
                      <span class="sdi-price">{{ item._price > 0 ? item._price + '万' : (item._hint || '—') }}</span>
                      <span class="sdi-img" v-if="optionHasImage(item)" @click.stop="viewOptionImage(item)" title="查看图片">🖼</span>
                    </div>
                  </template>
                  <div v-if="getSlotOptions(s).length === 0" class="slot-dropdown-empty">
                    {{ slotSearch[s] ? '无匹配物品' : '暂无物品数据' }}
                  </div>
                </div>
                <!-- 快速录入 -->
                <div class="slot-dropdown-quickadd">
                  <template v-if="quickAddSlot === s">
                    <div class="qa-form">
                      <div class="qa-row">
                        <input v-model="quickAddForm.item_name" class="qa-input" placeholder="物品名称" style="flex:1" @keydown.enter.prevent="submitQuickAdd(s)" />
                        <button class="qa-btn-paste" @click="pasteImageToQuickAdd()" :disabled="quickAddOcrBusy" :title="quickAddOcrBusy ? '识别中…' : '粘贴图片识别（或 Ctrl+V）'">{{ quickAddOcrBusy ? '⏳' : '📋' }}</button>
                        <button class="qa-btn-paste" @click="selectImageToQuickAdd()" :disabled="quickAddOcrBusy" title="选择图片识别">📁</button>
                      </div>
                      <div class="qa-row">
                        <span class="qa-price-wrap"><input v-model.number="quickAddForm.market_price" class="qa-input qa-input--price" type="number" step="0.01" min="0" placeholder="价格" @keydown.enter.prevent="submitQuickAdd(s)" /><span class="qa-unit">万</span></span>
                        <select v-model="quickAddForm.quality" class="qa-select">
                          <option value="">品质(可选)</option>
                          <option v-for="q in quickAddQualityOptions" :key="q" :value="q">{{ q }}</option>
                        </select>
                      </div>
                      <div class="qa-row">
                        <input v-model="quickAddForm.attr_notes" class="qa-input" placeholder="备注(选填)" style="flex:1" @keydown.enter.prevent="submitQuickAdd(s)" />
                      </div>
                      <div class="qa-actions">
                        <button class="btn btn-sm btn-accent" @click="submitQuickAdd(s)">保存并选中</button>
                        <button class="btn btn-sm btn-ghost" @click="quickAddSlot = null">取消</button>
                      </div>
                    </div>
                  </template>
                  <template v-else>
                    <div class="qa-trigger" @click="openQuickAdd(s)">
                      <span v-if="slotSearch[s] && getSlotOptions(s).filter(o => !o._disabled).length === 0 && getSlotOptions(s).length > 0">⚡ 未找到「{{ slotSearch[s] }}」，点击快速录入</span>
                      <span v-else>+ 快速录入新物品</span>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 元神 -->
      <ShenyuanPanel
        v-if="activeTab === 'shenyuan'"
        :current-scheme="currentScheme"
        :expanded-slot="expandedSlot"
        :slot-search="slotSearch"
        :get-slot-options="getSlotOptions"
        :get-detail="getDetail"
        :get-slot-quality="getSlotQuality"
        :get-price="getPrice"
        :get-quality-color="getQualityColor"
        :get-notes="getNotes"
        :has-image="hasSlotImage"
        :option-has-image="optionHasImage"
        :is-slot-locked="isSlotLocked"
        :get-lock-title="getLockTitle"
        :get-lock-time-short="getLockTimeShort"
        :quick-add-slot="quickAddSlot"
        :quick-add-form="quickAddForm"
        :quick-add-quality-options="quickAddQualityOptions"
        :quick-add-ocr-busy="quickAddOcrBusy"
        :open-quick-add="openQuickAdd"
        :submit-quick-add="submitQuickAdd"
        :paste-image-to-quick-add="pasteImageToQuickAdd"
        :ocr-search-slot="ocrSearchSlot"
        :ocr-search-text="ocrSearchText"
        :ocr-search-busy="ocrSearchBusy"
        @toggle="toggleSlotDropdown"
        @select="selectSlotItem"
        @clear="clearShenyuanSlot"
        @view-image="openSlotImage"
        @view-option-image="viewOptionImage"
        @search="(k: string, v: string) => slotSearch[k] = v"
        @toggle-lock="toggleLock"
        @cancel-quick-add="quickAddSlot = null"
        @clear-ocr-hint="clearOcrHint"
      />

      <!-- 养成 -->
      <div class="slot-grid-2col" v-if="activeTab === 'cultivate'">
        <div class="slot-section-card">
          <div class="sec-head">📜 养成系统</div>
          <div class="sec-slots">
            <div v-for="s in filteredCultivateSlots" :key="s"
              class="slot-card"
              :class="{
                'slot-card--empty': !getDetail(s),
                'slot-card--open': expandedSlot === s,
                'slot-card--locked': isSlotLocked(s)
              }"
              @click.stop="toggleSlotDropdown(s)"
            >
              <span class="sc-lock" :title="getLockTitle(s)" @click.stop="toggleLock(s)">{{ isSlotLocked(s) ? '🔒' : '🔓' }}</span>
              <span v-if="isSlotLocked(s)" class="sc-lock-time" :title="getLockTitle(s)">{{ getLockTimeShort(s) }}</span>
              <span class="sc-label">{{ s }}</span>
              <span class="sc-val" :style="{ color: getQualityColor(getSlotQuality(s)) }">{{ getDetail(s) || '—' }}</span>
              <span v-if="getDetail(s) && catalogNotes[getDetail(s)]" class="sc-notes">{{ catalogNotes[getDetail(s)] }}</span>
              <span class="sc-price">{{ getPrice(s) }}</span>
              <span class="sc-img" v-if="getDetail(s) && slotImageExists(s)" @click.stop="openSlotImage(s)" title="查看图片">🖼</span>
              <span class="sc-clear" v-if="getDetail(s) && !isSlotLocked(s)" @click.stop="clearSlot(s)" title="清除">✕</span>
              <span class="sc-arrow" v-if="!isSlotLocked(s)">▾</span>
              <!-- 下拉面板 -->
              <div v-if="expandedSlot === s && !isSlotLocked(s)" class="slot-dropdown" @click.stop>
                <input
                  v-model="slotSearch[s]"
                  class="slot-dropdown-search"
                  :placeholder="ocrSearchBusy && ocrSearchSlot === s ? '🔍 识别中…' : '搜索物品...'"
                />
                <!-- OCR 识别反馈 -->
                <div v-if="ocrSearchSlot === s" class="ocr-search-hint">
                  <template v-if="ocrSearchBusy">
                    <span class="ocr-spinner-sm"></span> 识别中…
                  </template>
                  <template v-else>
                    📋 OCR 识别为「<strong>{{ ocrSearchText }}</strong>」
                    <button class="ocr-hint-close" @click="clearOcrHint" title="关闭">✕</button>
                  </template>
                </div>
                <div class="slot-dropdown-list">
                  <template v-if="currentScheme">
                    <div
                      v-for="item in getSlotOptions(s)"
                      :key="item.name"
                      class="slot-dropdown-item"
                      :class="{ 'slot-dropdown-item--disabled': item._disabled }"
                      @click="selectSlotItem(s, item)"
                    >
                      <span class="sdi-name" :style="{ color: getQualityColor(item._quality) }">{{ item.name }}</span>
                      <span v-if="item._notes" class="sdi-notes">{{ item._notes }}</span>
                      <span class="sdi-price">{{ item._price > 0 ? item._price + '万' : (item._hint || '—') }}</span>
                      <span class="sdi-img" v-if="optionHasImage(item)" @click.stop="viewOptionImage(item)" title="查看图片">🖼</span>
                    </div>
                  </template>
                  <div v-if="getSlotOptions(s).length === 0" class="slot-dropdown-empty">
                    {{ slotSearch[s] ? '无匹配物品' : '暂无物品数据' }}
                  </div>
                </div>
                <!-- 快速录入 -->
                <div class="slot-dropdown-quickadd">
                  <template v-if="quickAddSlot === s">
                    <div class="qa-form">
                      <div class="qa-row">
                        <input v-model="quickAddForm.item_name" class="qa-input" placeholder="物品名称" style="flex:1" @keydown.enter.prevent="submitQuickAdd(s)" />
                        <button class="qa-btn-paste" @click="pasteImageToQuickAdd()" :disabled="quickAddOcrBusy" :title="quickAddOcrBusy ? '识别中…' : '粘贴图片识别（或 Ctrl+V）'">{{ quickAddOcrBusy ? '⏳' : '📋' }}</button>
                        <button class="qa-btn-paste" @click="selectImageToQuickAdd()" :disabled="quickAddOcrBusy" title="选择图片识别">📁</button>
                      </div>
                      <div class="qa-row">
                        <span class="qa-price-wrap"><input v-model.number="quickAddForm.market_price" class="qa-input qa-input--price" type="number" step="0.01" min="0" placeholder="价格" @keydown.enter.prevent="submitQuickAdd(s)" /><span class="qa-unit">万</span></span>
                        <select v-model="quickAddForm.quality" class="qa-select">
                          <option value="">品质(可选)</option>
                          <option v-for="q in quickAddQualityOptions" :key="q" :value="q">{{ q }}</option>
                        </select>
                      </div>
                      <div class="qa-row">
                        <input v-model="quickAddForm.attr_notes" class="qa-input" placeholder="备注(选填)" style="flex:1" @keydown.enter.prevent="submitQuickAdd(s)" />
                      </div>
                      <div class="qa-actions">
                        <button class="btn btn-sm btn-accent" @click="submitQuickAdd(s)">保存并选中</button>
                        <button class="btn btn-sm btn-ghost" @click="quickAddSlot = null">取消</button>
                      </div>
                    </div>
                  </template>
                  <template v-else>
                    <div class="qa-trigger" @click="openQuickAdd(s)">
                      <span v-if="slotSearch[s] && getSlotOptions(s).filter(o => !o._disabled).length === 0 && getSlotOptions(s).length > 0">⚡ 未找到「{{ slotSearch[s] }}」，点击快速录入</span>
                      <span v-else>+ 快速录入新物品</span>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 灵兽 -->
      <div class="beast-tab-wrap" v-if="activeTab === 'pet'">
        <BeastPanel
          :scheme-details="currentScheme?.details || {}"
          :catalog-prices="catalogPrices"
          :catalog-notes="catalogNotes"
          :catalog-qualities="catalogQualities"
          :ai-slots="{}"
          :expanded-slot="expandedSlot"
          :slot-search="slotSearch"
          :locked-slots="lockedSlotsObj"
          :get-lock-title="getLockTitle"
          :get-slot-options="getSlotOptions"
          :get-quality-color="getQualityColor"
          :has-image="hasSlotImage"
          :option-has-image="optionHasImage"
          @toggle="toggleSlotDropdown"
          @select="selectSlotItem"
          @clear="clearSlot"
          @view-image="openSlotImage"
          @view-option-image="viewOptionImage"
          @search="(k: string, v: string) => slotSearch[k] = v"
          @toggle-lock="toggleLock"
        />
      </div>

	    </div>

	    <!-- 方案备注（点击直接编辑） -->
	    <div class="scheme-notes" v-if="currentScheme">
	      <span class="sn-label">📝</span>
	      <div v-if="editingNotes" class="sn-edit-wrap">
	        <textarea
	          v-model="editNotesText"
	          class="sn-textarea"
	          rows="5"
	          ref="notesTextareaRef"
	          @blur="saveNotes"
	          @keydown.escape.prevent="cancelNotesEdit"
	          @keydown.enter.ctrl="saveNotes"
	          placeholder="配装思路、注意事项..."
	        ></textarea>
	      </div>
	      <div v-else class="sn-text" :class="{ 'sn-text--empty': !currentScheme.notes }" @click="startNotesEdit" title="点击编辑备注">
	        {{ currentScheme.notes || '点击添加备注...' }}
	      </div>
	    </div>

	    <!-- 新建/编辑方案弹层 -->
    <div class="modal-overlay" v-if="showForm" @click.self="showForm = false">
      <div class="modal">
        <div class="modal-head"><h4>{{ editingScheme ? '编辑方案' : '新建方案' }}</h4><button class="btn-icon" @click="showForm = false">✕</button></div>
        <div class="modal-body">
          <div class="form-row"><label class="form-label">大区</label><input class="input" :value="formServerLabel" disabled title="方案固定绑定创建时的大区" /></div>
          <div class="form-row"><label class="form-label">方案名称</label><input v-model="form.name" class="input" placeholder="如：100级剑侍5亿配装" /></div>
          <div class="form-row"><label class="form-label">角色名</label><input v-model="form.character_name" class="input" placeholder="输入角色名称" /></div>
          <div class="form-row form-row--2col">
            <div><label class="form-label">职业</label>
              <select v-model="form.job" class="input"><option v-for="j in jobs" :key="j" :value="j">{{ j }}</option></select>
            </div>
            <div><label class="form-label">等级</label>
              <select v-model.number="form.level_num" class="input"><option v-for="l in levelNums" :key="l" :value="l">Lv.{{ l }}</option></select>
            </div>
          </div>
          <div class="form-row"><label class="form-label">预算（亿三国币）</label><input v-model.number="form.total_budget" class="input" type="number" step="0.1" min="0" /></div>
	        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" @click="showForm = false">取消</button>
          <button class="btn btn-accent" @click="saveScheme">{{ editingScheme ? '保存' : '创建' }}</button>
        </div>
      </div>
    </div>
  </div>
  <ImageViewer v-model="viewerVisible" :images="viewerImages" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated, reactive, nextTick, watch } from 'vue'
import { useAppStore } from '@/stores'
import { convertToPinyin } from 'tiny-pinyin'
import { parseOcrText, type ParsedFields } from '@/utils/fieldParser'
import BeastPanel from '@/components/beast/BeastPanel.vue'
import ShenyuanPanel from '@/components/shenyuan/ShenyuanPanel.vue'
import ImageViewer from '@/components/ImageViewer.vue'

const app = useAppStore()

const EQUIP_SLOTS = ['武器', '头盔', '上装', '下装', '护手', '鞋子', '面具', '项链', '戒指']
const SPIRIT_SLOTS = ['武器灵', '护手灵', '头盔灵', '上装灵', '下装灵', '鞋子灵', '面具灵', '翅膀灵', '符咒灵', '项链灵', '戒指灵']
const OTHER_SLOTS = ['八阵图', '子女', '奥义', '灵珠', '羽灵']
// 翅膀 & 符咒固定名称列表
const FIXED_WING_NAMES = [
  '战天使之翼(男)', '血影冥光翼(男)', '枫之羽(男)', '幽灵碧焰羽(男)',
  '月影枫痕羽(男)', '飒飒流星翼(男)', '凌霄幻日翼(男)',
  '炽天使之翼(女)', '玄影伽蓝翼(女)', '幻灵虹霓羽(女)', '蝶之羽(女)', '晓梦谜蝶羽(女)',
]
const FIXED_CHARM_NAMES = [
  '符咒·万物', '符咒·徊翔', '符咒·坠星', '符咒·千叶',
  '符咒·凌雪', '符咒·飞羽', '符咒·星芒',
]
function getFixedSlotNames(slot: string): string[] {
  if (slot === '翅膀') return FIXED_WING_NAMES
  if (slot === '符咒') return FIXED_CHARM_NAMES
  return []
}

const attackSpirits = ['武器灵', '护手灵', '上装灵']
const defenseSpirits = ['头盔灵', '面具灵', '下装灵', '鞋子灵']
const jewelrySpirits = ['项链灵', '戒指灵']
const wingSpirits = ['翅膀灵', '符咒灵']
const spiritGroups = [
  { key: 'atk', icon: '⚔', label: '攻击灵魄', slots: attackSpirits },
  { key: 'def', icon: '🛡', label: '防御灵魄', slots: defenseSpirits },
  { key: 'jwl', icon: '💍', label: '首饰灵魄', slots: jewelrySpirits },
  { key: 'wing', icon: '🕊', label: '翅膀&符咒灵魄', slots: wingSpirits },
]

interface SlotPriceEntry { i: number; p: number; n: string; q: string }
interface Scheme { id: number; name: string; job: string; level_num: number; total_budget: number; details: Record<string,string>; slot_price_ids?: Record<string, number | SlotPriceEntry>; character_name?: string; notes?: string; server_id?: number | null }

const schemes = ref<Scheme[]>([])
const currentScheme = ref<Scheme | null>(null)
const selectedSchemeId = ref(-1)
const showForm = ref(false)
const editingScheme = ref<Scheme | null>(null)
const form = reactive({ name: '', job: '剑侍', level_num: 100, total_budget: 5, character_name: '' })
const jobs = ['剑侍', '豪杰', '阴阳士', '仙术士', '游侠', '唤灵']
const levelNums = [70,80,90,100,110,120,130,140,150]

// Tab 切换
const activeTab = ref('equip')
function switchTab(key: string) {
  activeTab.value = key
}
const tabs = [
  { key: 'equip', label: '装备', icon: '⚔' },
  { key: 'spirit', label: '灵魄', icon: '🛡' },
  { key: 'shenyuan', label: '元神', icon: '⭐' },
  { key: 'cultivate', label: '养成', icon: '📜' },
  { key: 'pet', label: '灵兽', icon: '🐉' },
]

const equipGroups = [
  { key: 'atk', icon: '⚔', label: '攻击装备', slots: ['武器', '护手', '上装'] },
  { key: 'def', icon: '🛡', label: '防御装备', slots: ['头盔', '面具', '下装', '鞋子'] },
  { key: 'jwl', icon: '💍', label: '首饰装备', slots: ['项链', '戒指'] },
  { key: 'wing', icon: '🕊', label: '翅膀 & 符咒', slots: ['翅膀', '符咒'] },
]

const filteredCultivateSlots = computed(() => {
  const slots = [...OTHER_SLOTS]
  const lv = currentScheme.value?.level_num ?? 0
  if (lv < 120) return slots.filter(s => s !== '灵珠' && s !== '羽灵')
  return slots
})

// ── 元神槽位（固定结构：主元神 + 5仓库×5槽位） ──

// 30 个固定槽位 key：元神:背包1~5 + 元神:仓N槽M
const SHENYUAN_SLOTS: string[] = [
  ...Array.from({ length: 5 }, (_, i) => `元神:背包${i + 1}`),
  ...Array.from({ length: 5 }, (_, w) =>
    Array.from({ length: 5 }, (_, s) => `元神:仓${w + 1}槽${s + 1}`)
  ).flat(),
]

// 固定槽位列表（始终返回全部 26 个 key）
const shenyuanSlots = computed(() => SHENYUAN_SLOTS)

function getNotes(slot: string): string {
  const data = getSlotPriceData(slot)
  return data ? data.notes : ''
}

async function persistScheme(details: Record<string, string>, slotPriceIds: Record<string, number | SlotPriceEntry>) {
  if (!currentScheme.value) return
  await window.electronAPI.dbQuery(
    `UPDATE gear_schemes SET details=?,slot_price_ids=?,updated_at=datetime('now','localtime') WHERE id=?`,
    [JSON.stringify(details), JSON.stringify(slotPriceIds), currentScheme.value.id]
  )
  currentScheme.value.details = details
  currentScheme.value.slot_price_ids = slotPriceIds
}

// 清除：仅清空该槽位（位置固定）
async function clearShenyuanSlot(slot: string) {
  const scheme = currentScheme.value
  if (!scheme) return
  const details = { ...(scheme.details || {}), [slot]: '' }
  const sidMap = { ...(scheme.slot_price_ids || {}) }
  delete sidMap[slot]
  await persistScheme(details, sidMap)
}

function getTabCount(key: string) {
  if (!currentScheme.value) return 0
  const d = currentScheme.value.details || {}
  if (key === 'shenyuan') return shenyuanSlots.value.filter(s => d[s]).length
  if (key === 'equip') return [...EQUIP_SLOTS, '翅膀', '符咒'].filter(s => d[s]).length
  if (key === 'spirit') return SPIRIT_SLOTS.filter(s => d[s]).length
  if (key === 'pet') return Object.keys(d).filter(k => k.startsWith('灵兽:') && d[k]).length
  return filteredCultivateSlots.value.filter(s => d[s]).length
}

function getTabSlots(key: string): string[] {
  const d = currentScheme.value?.details || {}
  if (key === 'shenyuan') return shenyuanSlots.value.filter(s => d[s])
  if (key === 'equip') return [...EQUIP_SLOTS, '翅膀', '符咒'].filter(s => d[s])
  if (key === 'spirit') return SPIRIT_SLOTS.filter(s => d[s])
  if (key === 'pet') return Object.keys(d).filter(k => k.startsWith('灵兽:') && d[k])
  return filteredCultivateSlots.value.filter(s => d[s])
}


const catalogPrices = ref<Record<string,number>>({})
const catalogNotes = ref<Record<string,string>>({})
const catalogQualities = ref<Record<string,string>>({})
const spiritPositionMap = ref<Record<string,string>>({})
// 装备图片
const viewerVisible = ref(false)
const viewerImages = ref<string[]>([])
const itemsWithImages = ref<Set<string>>(new Set())

// ── 品质颜色映射（支持单字和全名） ──
const QUALITY_COLORS: Record<string, string> = {
  '白': '#C0C0C0', '白色': '#C0C0C0',
  '绿': '#4CAF50', '绿色': '#4CAF50',
  '蓝': '#42A5F5', '蓝色': '#42A5F5',
  '紫': '#AB47BC', '紫色': '#AB47BC',
  '黄': '#e2c044', '黄色': '#e2c044',
  '橙': '#e8883a', '橙色': '#e8883a',
  '红': '#EF5350', '红色': '#EF5350',
}

// 根据品质/阶位/等级统一映射颜色
function getQualityColor(quality: string): string {
  const val = (quality || '').trim()
  if (!val) return 'inherit'
  // 直接匹配装备品质
  if (QUALITY_COLORS[val]) return QUALITY_COLORS[val]
  // 灵兽品阶
  if (val === '天') return QUALITY_COLORS['红']
  if (val === '地') return QUALITY_COLORS['橙']
  if (val === '玄') return QUALITY_COLORS['紫']
  if (val === '妙') return QUALITY_COLORS['蓝']
  if (val === '凡') return QUALITY_COLORS['绿']
  // 阶/级 → 低阶绿、中阶蓝、高阶紫
  const m = val.match(/^(\d+)/)
  if (m) {
    const n = parseInt(m[1])
    if (n <= 2) return QUALITY_COLORS['绿']
    if (n <= 4) return QUALITY_COLORS['蓝']
    return QUALITY_COLORS['紫']
  }
  return 'inherit'
}

// ── 价格明细：item_name → 所有物价条目（每个条目 = 一个下拉行） ──
interface PriceEntry { id: number; price: number; notes: string; quality: string }
const priceDetailMap = ref<Map<string, PriceEntry[]>>(new Map())

// 从灵兽槽位 key 中提取灵兽名称（通过 localStorage 中的 beastData）
function getBeastNameForSlot(slot: string): string | null {
  if (!slot.startsWith('灵兽:')) return null
  const parts = slot.split(':')  // ['灵兽', category, grade, index]
  if (parts.length < 4) return null
  const category = parts[1]
  const grade = parts[2]
  const index = parseInt(parts[3]) - 1
  try {
    const beastData = JSON.parse(localStorage.getItem('sgbuddy-beast-data') || '{}')
    return beastData[category]?.[grade]?.[index] || null
  } catch { return null }
}

async function loadSlotPriceDetails(slot: string) {
  priceDetailMap.value.clear()
  const refKeys = getSlotRefKeys(slot)
  // 判断是否为养成类槽位（包括灵兽面板子槽位）
  const isCultivation = OTHER_SLOTS.includes(slot) || refKeys.some(k => OTHER_SLOTS.includes(k))
  const namesSet = new Set<string>()

  if (isCultivation) {
    // 养成槽位：仅从 price_params 按分类实时查询
  } else if (slot.startsWith('灵兽:')) {
    // 灵兽槽位：按当前槽位名称精确查询
    const beastName = getBeastNameForSlot(slot)
    if (beastName) namesSet.add(beastName)
  } else {
    // 装备/灵魄/翅膀/符咒：从 reference data 收集候选名
    for (const key of refKeys) {
      const names = slotRefMap.value.get(key)
      if (names) names.forEach(n => namesSet.add(n))
    }
    // 翅膀 / 符咒：使用固定名称列表
    const fixed = getFixedSlotNames(slot)
    fixed.forEach(n => namesSet.add(n))
  }

  if (namesSet.size === 0 && !isCultivation) return

  try {
    const batchSize = 100
    // 查询 1：按名称查询 price_params（装备类槽位）
    const namesArr = [...namesSet]
    if (namesArr.length > 0) {
      for (let i = 0; i < namesArr.length; i += batchSize) {
        const batch = namesArr.slice(i, i + batchSize)
        const placeholders = batch.map(() => '?').join(',')
        const rows = await window.electronAPI.dbQuery(
          `SELECT p.id, p.item_name, p.market_price, p.spirit_position, TRIM(COALESCE(p.attrs,'') || ' ' || COALESCE(p.attr_notes,'') || ' ' || COALESCE(p.craft_level,'')) as notes, p.quality FROM price_params p WHERE p.item_name IN (${placeholders}) AND p.server_id = ? ORDER BY p.item_name, p.market_price ASC`,
          [...batch, app.currentServerId]
        ) as Array<{ id: number; item_name: string; market_price: number; spirit_position: string; notes: string; quality: string }>
        for (const r of rows) {
          const price = Math.round((r.market_price || 0) * 10000)
          const notes = r.notes || ''
          const quality = r.quality || ''
          if (!priceDetailMap.value.has(r.item_name)) priceDetailMap.value.set(r.item_name, [])
          const entries = priceDetailMap.value.get(r.item_name)!
          if (!entries.some(e => e.price === price && e.notes === notes)) {
            entries.push({ id: r.id, price, notes, quality })
          }
          if (r.spirit_position && !spiritPositionMap.value[r.item_name]) {
            spiritPositionMap.value[r.item_name] = r.spirit_position
          }
        }
      }
    }
    // 查询 2：养成槽位按分类实时查询
    if (isCultivation) {
      const catPlaceholders = refKeys.map(() => '?').join(',')
      const rows2 = await window.electronAPI.dbQuery(
        `SELECT p.id, p.item_name, p.market_price, TRIM(COALESCE(p.attrs,'') || ' ' || COALESCE(p.attr_notes,'') || ' ' || COALESCE(p.craft_level,'')) as notes, p.quality FROM price_params p WHERE p.category IN (${catPlaceholders}) AND p.server_id = ? ORDER BY p.item_name, p.market_price ASC`,
        [...refKeys, app.currentServerId]
      ) as Array<{ id: number; item_name: string; market_price: number; notes: string; quality: string }>
      for (const r of rows2) {
        const price = Math.round((r.market_price || 0) * 10000)
        const notes = r.notes || ''
        const quality = r.quality || ''
        if (!priceDetailMap.value.has(r.item_name)) priceDetailMap.value.set(r.item_name, [])
        const entries = priceDetailMap.value.get(r.item_name)!
        if (!entries.some(e => e.price === price && e.notes === notes)) {
          entries.push({ id: r.id, price, notes, quality })
        }
      }
    }
    // 灵魄槽位：跨服务器查询 spirit_position（实时，不依赖预加载）
    const isSpiritSlot = SPIRIT_SLOTS.includes(slot)
    if (isSpiritSlot && namesArr.length > 0) {
      try {
        const batchSize2 = 200
        for (let i = 0; i < namesArr.length; i += batchSize2) {
          const batch = namesArr.slice(i, i + batchSize2)
          const placeholders = batch.map(() => '?').join(',')
          const posRows = await window.electronAPI.dbQuery(
            `SELECT item_name, spirit_position, COUNT(*) as cnt FROM price_params WHERE item_name IN (${placeholders}) AND spirit_position!='' AND category='灵魄' GROUP BY item_name, spirit_position ORDER BY cnt DESC`,
            batch
          ) as Array<{ item_name: string; spirit_position: string; cnt: number }>
          const posVotes = new Map<string, Map<string, number>>()
          for (const r of posRows) {
            if (!posVotes.has(r.item_name)) posVotes.set(r.item_name, new Map())
            posVotes.get(r.item_name)!.set(r.spirit_position, r.cnt)
          }
          for (const [name, votes] of posVotes) {
            let bestPos = ''; let bestCount = 0
            for (const [pos, count] of votes) {
              if (count > bestCount) { bestCount = count; bestPos = pos }
            }
            if (bestPos) spiritPositionMap.value[name] = bestPos
          }
        }
      } catch (e) { console.warn('loadSlotPriceDetails: spirit_position query failed', e) }
    }
  } catch (e) { console.warn('loadSlotPriceDetails failed:', e) }
}

// 从 slot_price_ids 提取单个槽位的持久化属性（价格直接从 DB 持久化数据读取）
function getSlotPriceData(slot: string): { price: number; notes: string; quality: string } | null {
  if (!currentScheme.value) return null
  const raw = currentScheme.value.slot_price_ids?.[slot]
  if (!raw) return null
  if (typeof raw === 'object' && 'i' in raw) {
    const v = raw as SlotPriceEntry
    return { price: v.p, notes: v.n, quality: v.q }
  }
  // 旧格式（纯数字 id）: 无法直接从持久化数据获取价格，返回 null 走 fallback
  return null
}

// 同步 catalogPrices/catalogNotes/catalogQualities（供 BeastPanel 等依赖 itemName 索引的组件）
function syncCatalogFromSlotPrices() {
  if (!currentScheme.value) return
  const details = currentScheme.value.details || {}
  const sidMap = currentScheme.value.slot_price_ids || {}
  for (const [slot, val] of Object.entries(sidMap)) {
    if (!val || !(typeof val === 'object' && 'i' in val)) continue
    const v = val as SlotPriceEntry
    const name = details[slot]
    if (name) {
      catalogPrices.value[name] = v.p
      catalogNotes.value[name] = v.n
      catalogQualities.value[name] = v.q
    }
  }
}

// ── 槽位下拉状态 ──
const expandedSlot = ref<string | null>(null)
const slotSearch = ref<Record<string, string>>({})

// ── 快速录入状态 ──
const quickAddSlot = ref<string | null>(null)
const quickAddForm = reactive({ item_name: '', market_price: 0, quality: '', attr_notes: '' })
const quickAddOcrParsed = ref<ParsedFields | null>(null) // OCR 解析的完整字段
const quickAddQualityOptions = ['黄色', '橙色', '红色', '绿色', '蓝色', '紫色', '天', '地', '玄', '妙', '凡']
const quickAddOcrBusy = ref(false)
const quickAddPendingImage = ref<{ kind: 'buffer'; png: Uint8Array } | { kind: 'file'; src: string } | null>(null) // 待保存的图片

// ── 搜索框 OCR 识别反馈 ──
const ocrSearchSlot = ref<string | null>(null)
const ocrSearchText = ref('')
const ocrSearchBusy = ref(false)
let ocrSearchTimer: ReturnType<typeof setTimeout> | null = null

function showOcrHint(slot: string, text: string) {
  ocrSearchSlot.value = slot
  ocrSearchText.value = text
  if (ocrSearchTimer) clearTimeout(ocrSearchTimer)
  ocrSearchTimer = setTimeout(() => { ocrSearchSlot.value = null; ocrSearchText.value = '' }, 6000)
}

function clearOcrHint() {
  ocrSearchSlot.value = null
  ocrSearchText.value = ''
  if (ocrSearchTimer) { clearTimeout(ocrSearchTimer); ocrSearchTimer = null }
}

/** OCR 识别并填入快速录入表单 */
async function quickAddOcr(input: { kind: 'buffer'; data: Uint8Array } | { kind: 'path'; path: string }) {
  quickAddOcrBusy.value = true
  try {
    const res = await window.electronAPI.ocrRecognize(input)
    if (res.error) {
      console.error('[快速录入] OCR失败:', res.error)
      return
    }
    const parsed = parseOcrText(res.text)
    // 品质：优先文字识别结果，其次名称行颜色
    if (!parsed.quality && res.qualityColor) parsed.quality = res.qualityColor
    quickAddOcrParsed.value = parsed
    if (parsed.item_name) quickAddForm.item_name = parsed.item_name
    if (parsed.quality) quickAddForm.quality = parsed.quality
  } catch (e: any) {
    console.error('[快速录入] OCR失败:', e)
  } finally {
    quickAddOcrBusy.value = false
  }
}

/** 从剪贴板粘贴图片 → OCR */
async function pasteImageToQuickAdd() {
  if (quickAddOcrBusy.value) return
  const img = await window.electronAPI.readClipboardImage()
  if (!img) {
    console.log('[快速录入] 剪贴板无图片')
    return
  }
  quickAddPendingImage.value = { kind: 'buffer', png: img.png }
  await quickAddOcr({ kind: 'buffer', data: img.png })
}

/** 从文件选择图片 → OCR */
async function selectImageToQuickAdd() {
  if (quickAddOcrBusy.value) return
  const src = await window.electronAPI.selectImage()
  if (!src) return
  quickAddPendingImage.value = { kind: 'file', src }
  await quickAddOcr({ kind: 'path', path: src })
}

/** Ctrl+V 粘贴图片识别（仅在快速录入表单内生效） */
function onQuickAddPaste(e: ClipboardEvent) {
  const el = document.activeElement as HTMLElement | null
  if (!el?.closest('.qa-form')) return
  e.preventDefault()
  pasteImageToQuickAdd()
}

// 快速录入表单打开/关闭时注册/注销粘贴事件
watch(quickAddSlot, (val) => {
  if (val) {
    document.addEventListener('paste', onQuickAddPaste)
  } else {
    document.removeEventListener('paste', onQuickAddPaste)
    quickAddPendingImage.value = null
  }
})

/** 在槽位搜索框中 Ctrl+V 粘贴图片 → OCR 识别 → 填入搜索词、自动打开快速录入表单（与物价图鉴录入行为一致） */
async function onSlotSearchPaste(e: ClipboardEvent) {
  const el = document.activeElement as HTMLElement | null
  if (!el?.classList.contains('slot-dropdown-search')) return
  // 剪贴板有文本时走默认粘贴行为
  const types = e.clipboardData?.types || []
  if (types.some(t => t === 'text/plain' || t === 'Text')) return
  // 无文本 → 尝试图片 OCR
  e.preventDefault()
  const slot = expandedSlot.value
  if (!slot) return

  ocrSearchBusy.value = true
  ocrSearchSlot.value = slot
  ocrSearchText.value = ''
  try {
    const img = await window.electronAPI.readClipboardImage()
    if (!img) { ocrSearchBusy.value = false; ocrSearchSlot.value = null; return }
    const res = await window.electronAPI.ocrRecognize({ kind: 'buffer', data: img.png })
    ocrSearchBusy.value = false
    if (res.error || !res.text.trim()) { ocrSearchSlot.value = null; return }
    const parsed = parseOcrText(res.text)
    if (!parsed.item_name) { ocrSearchSlot.value = null; return }
    // 填入搜索词 + 显示反馈提示条
    slotSearch.value[slot] = parsed.item_name
    showOcrHint(slot, parsed.item_name)
    // 自动打开快速录入表单，预填识别到的名称和品质（与物价图鉴录入价格行为一致）
    openQuickAdd(slot)
    if (parsed.quality) quickAddForm.quality = parsed.quality
    else if (res.qualityColor) quickAddForm.quality = res.qualityColor
  } catch { ocrSearchBusy.value = false; ocrSearchSlot.value = null }
}

/** 根据槽位推断 price_params 分类 */
function inferCategory(slot: string): string {
  if (slot.startsWith('元神:')) return '元神'
  if (slot.startsWith('灵兽:')) return '灵兽'
  if (SPIRIT_SLOTS.includes(slot)) return '灵魄'
  if (slot === '八阵图') return '八阵图'
  if (slot === '子女') return '子女'
  if (slot === '奥义') return '奥义'
  if (slot === '灵珠') return '灵珠'
  if (slot === '羽灵') return '羽灵'
  return '装备'
}

function openQuickAdd(slot: string) {
  quickAddSlot.value = slot
  quickAddForm.item_name = slotSearch.value[slot] || ''
  quickAddForm.market_price = 0
  quickAddForm.quality = ''
  quickAddForm.attr_notes = ''
  quickAddOcrParsed.value = null
}

async function submitQuickAdd(slot: string) {
  const name = quickAddForm.item_name.trim()
  if (!name) return
  const price = quickAddForm.market_price
  if (price <= 0) return

  // 价格转换：表单填的是万，数据库存的是亿
  const priceYi = price / 10000

  // OCR 解析结果优先，回退槽位推断
  const parsed = quickAddOcrParsed.value
  const category = parsed?.category || inferCategory(slot)
  const quality = quickAddForm.quality || parsed?.quality || ''
  const craftLevel = parsed?.craft_level || ''
  const itemSlot = parsed?.slot || ''
  const equipLevel = parsed?.equip_level || 0
  const equipJob = parsed?.equip_job || ''
  const spiritPos = parsed?.spirit_position || ''

  try {
    // 先注册物品到全局目录
    const result = await window.electronAPI.dbQuery(
      `INSERT INTO price_params (item_name,category,server_id,quality,craft_level,attr_notes,benchmark_price,market_price,slot,equip_level,equip_job,spirit_position,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now','localtime'))`,
      [name, category, app.currentServerId, quality, craftLevel, quickAddForm.attr_notes, 0, priceYi, itemSlot, equipLevel, equipJob, spiritPos]
    ) as any

    // 保存粘贴/选择的图片（绑定到新记录的 price_id）
    const newId = result?.lastInsertRowid as number | undefined
    const pending = quickAddPendingImage.value
    if (newId && pending) {
      if (pending.kind === 'buffer') {
        await window.electronAPI.saveImageBuffer(name, pending.png, newId)
      } else {
        await window.electronAPI.saveImage(name, pending.src, newId)
      }
      quickAddPendingImage.value = null
      // 刷新图片集合，让 🖼 按钮即时出现
      refreshImageSet()
    }

    // 刷新数据
    await loadReferenceData()
    await loadSlotPriceDetails(slot)
    app.bumpPriceDataVersion()

    // 自动选中新录入的物品
    if (newId) {
      const options = getSlotOptions(slot)
      const newItem = options.find(o => o._id === newId)
      if (newItem) {
        await selectSlotItem(slot, newItem)
      }
    }

    // 重置快速录入状态
    quickAddSlot.value = null
    quickAddForm.item_name = ''
    quickAddForm.market_price = 0
    quickAddForm.quality = ''
    quickAddForm.attr_notes = ''
    quickAddOcrParsed.value = null
    quickAddPendingImage.value = null
  } catch (e: any) {
    console.error('快速录入失败:', e)
  }
}

// ── 槽位锁定状态（slot → 锁定时间戳 ms） ──
const lockedSlots = ref<Record<string, number>>({})
function loadLockedSlots(schemeId: number) {
  try {
    const raw = localStorage.getItem(`sgbuddy-locked-slots-${schemeId}`)
    if (!raw) { lockedSlots.value = {}; return }
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      // 兼容旧格式（数组 → 以当前时间作为兜底时间戳）
      const now = Date.now()
      const rec: Record<string, number> = {}
      for (const k of parsed) rec[k] = now
      lockedSlots.value = rec
    } else {
      lockedSlots.value = parsed
    }
  } catch { lockedSlots.value = {} }
}
function saveLockedSlots() {
  if (!currentScheme.value) return
  localStorage.setItem(
    `sgbuddy-locked-slots-${currentScheme.value.id}`,
    JSON.stringify(lockedSlots.value)
  )
}
function toggleLock(slot: string) {
  if (slot in lockedSlots.value) {
    delete lockedSlots.value[slot]
  } else {
    lockedSlots.value[slot] = Date.now()
  }
  lockedSlots.value = { ...lockedSlots.value } // trigger reactivity
  saveLockedSlots()
}
function isSlotLocked(slot: string): boolean {
  return slot in lockedSlots.value
}
function getLockTitle(slot: string): string {
  const ts = lockedSlots.value[slot]
  if (!ts) return '点击锁定'
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  const time = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  return `已锁定于 ${time} · 点击解锁`
}
function getLockTimeShort(slot: string): string {
  const ts = lockedSlots.value[slot]
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const lockedSlotsObj = computed(() => {
  const obj: Record<string, boolean> = {}
  for (const k of Object.keys(lockedSlots.value)) obj[k] = true
  return obj
})

function closeDropdown() {
  if (expandedSlot.value) {
    delete slotSearch.value[expandedSlot.value]
    expandedSlot.value = null
  }
  quickAddSlot.value = null
  clearOcrHint()
}

// ── 参考数据缓存（槽位→物品名映射） ──
const slotRefMap = ref<Map<string, string[]>>(new Map())
const equipMetaMap = ref<Map<string, { level: number; job_limit: string }>>(new Map())

// 灵魄位置 → 槽位映射
const SPIRIT_POSITION_SLOTS: Record<string, string[]> = {
  '利刃': ['武器灵', '护手灵', '上装灵'],
  '坚盾': ['头盔灵', '面具灵', '下装灵', '鞋子灵'],
  '灵啸': ['项链灵', '戒指灵'],
  '守神': ['翅膀灵', '符咒灵'],
}

// 槽位 → 灵魄位置反向映射
function getSpiritPosition(slot: string): string | null {
  for (const [pos, slots] of Object.entries(SPIRIT_POSITION_SLOTS)) {
    if (slots.includes(slot)) return pos
  }
  return null
}

// ── Pinyin search helpers ──
function toPinyinInitials(str: string): string {
  if (!str) return ''
  try {
    const full = convertToPinyin(str, ' ', true)
    return full.split(' ').map(s => s[0] || '').join('').toLowerCase()
  } catch {
    return str.replace(/[一-鿿]/g, '').toLowerCase()
  }
}
function toFullPinyin(str: string): string {
  if (!str) return ''
  try {
    return convertToPinyin(str, '', true).toLowerCase()
  } catch {
    return str.replace(/[一-鿿]/g, '').toLowerCase()
  }
}

const currentTotalWan = computed(() => {
  if (!currentScheme.value) return 0
  const sidMap = currentScheme.value.slot_price_ids || {}
  let total = 0
  for (const val of Object.values(sidMap)) {
    if (!val || !(typeof val === 'object' && 'i' in val)) continue
    total += (val as SlotPriceEntry).p
  }
  // 兼容旧方案（无 slot_price_ids）：回退到 catalogPrices
  if (total === 0) {
    const details = currentScheme.value.details || {}
    for (const name of Object.values(details)) {
      if (name && catalogPrices.value[name]) {
        total += catalogPrices.value[name]
      }
    }
  }
  return total
})

// ── 仪表盘数据 ──
const dashTotalSlots = computed(() => {
  if (!currentScheme.value) return 0
  return EQUIP_SLOTS.length + 2 + SPIRIT_SLOTS.length + filteredCultivateSlots.value.length + SHENYUAN_SLOTS.length
})
const dashFilledSlots = computed(() => {
  if (!currentScheme.value) return 0
  const d = currentScheme.value.details || {}
  let count = 0
  for (const s of [...EQUIP_SLOTS, '翅膀', '符咒', ...SPIRIT_SLOTS, ...filteredCultivateSlots.value, ...SHENYUAN_SLOTS]) {
    if (d[s]) count++
  }
  // 灵兽
  for (const k of Object.keys(d)) { if (k.startsWith('灵兽:') && d[k]) count++ }
  return count
})
const dashSlotPercent = computed(() => dashTotalSlots.value ? Math.round(dashFilledSlots.value / dashTotalSlots.value * 100) : 0)
const dashBudgetPercent = computed(() => {
  const budgetWan = (currentScheme.value?.total_budget || 1) * 10000
  return Math.min(100, Math.round(currentTotalWan.value / budgetWan * 100))
})
// 未锁定槽位金额汇总（锁定=已确定不动的装备，未锁定=还可调整的预算空间）
const unlockedTotalWan = computed(() => {
  if (!currentScheme.value) return 0
  const sidMap = currentScheme.value.slot_price_ids || {}
  let total = 0
  for (const [slot, val] of Object.entries(sidMap)) {
    if (!val || !(typeof val === 'object' && 'i' in val)) continue
    if (isSlotLocked(slot)) continue
    total += (val as SlotPriceEntry).p
  }
  return total
})

function getTabTotal(key: string): number {
  if (!currentScheme.value) return 0
  const sidMap = currentScheme.value.slot_price_ids || {}
  let total = 0
  for (const [slot, val] of Object.entries(sidMap)) {
    if (!val || !(typeof val === 'object' && 'i' in val)) continue
    const v = val as SlotPriceEntry
    if (key === 'equip' && [...EQUIP_SLOTS, '翅膀', '符咒'].includes(slot)) total += v.p
    else if (key === 'spirit' && SPIRIT_SLOTS.includes(slot)) total += v.p
    else if (key === 'shenyuan' && slot.startsWith('元神:')) total += v.p
    else if (key === 'cultivate' && filteredCultivateSlots.value.includes(slot)) total += v.p
    else if (key === 'pet' && slot.startsWith('灵兽:')) total += v.p
  }
  return total
}
function formatWan(wan: number): string {
  if (!wan) return '—'
  if (wan >= 10000) {
    const yi = wan / 10000
    return (Number.isInteger(yi) ? yi.toString() : yi.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')) + '亿'
  }
  return wan + '万'
}

function getDetail(slot: string) { return currentScheme.value?.details?.[slot] || '' }
function getSlotQuality(slot: string): string {
  // 优先从 slot_price_ids 读取该槽位独立的品质（避免同名物品不同品质时互相覆盖）
  const data = getSlotPriceData(slot)
  if (data && data.quality) return data.quality
  // 兼容旧方案（无 slot_price_ids 或旧格式纯数字 id）
  const name = getDetail(slot)
  if (!name) return ''
  return catalogQualities.value[name] || ''
}
function getPrice(slot: string): string {
  if (!currentScheme.value) return ''
  // 直接从 slot_price_ids 持久化数据读取（选中时冻结的价格）
  const data = getSlotPriceData(slot)
  if (data) return data.price + '万'
  // 兼容旧方案（无 slot_price_ids 或旧格式纯数字 id）：回退到 catalogPrices
  const name = getDetail(slot)
  if (!name) return ''
  if (!(name in catalogPrices.value)) return '—'
  return (catalogPrices.value[name] || 0) + '万'
}

// ── 槽位下拉逻辑 ──

// 槽位 → 参考数据源映射
function getSlotRefKeys(slot: string): string[] {
  // 灵兽面板槽位：统一映射到灵兽数据源
  if (slot.startsWith('灵兽:')) return ['灵兽', '灵兽材料']
  // 灵魄槽位统一走灵魄数据
  if (SPIRIT_SLOTS.includes(slot)) return ['灵魄']
  // 养成系统
  if (slot === '八阵图') return ['八阵图']
  if (slot === '子女') return ['子女', '子女材料']
  if (slot === '奥义') return ['奥义']
  if (slot === '灵珠') return ['灵珠']
  if (slot === '羽灵') return ['羽灵']
  if (slot === '灵兽') return ['灵兽', '灵兽材料']
  if (slot.startsWith('元神:')) return ['元神']
  if (slot === '元神') return ['元神']
  // 翅膀 / 符咒：候选名只用固定硬编码列表
  if (slot === '翅膀' || slot === '符咒') return []
  // 装备槽位精确匹配
  return [slot]
}

interface SlotOption {
  name: string
  _id: number
  _price: number
  _disabled: boolean
  _hint: string
  _notes: string
  _quality: string
}

function getSlotOptions(slot: string): SlotOption[] {
  const scheme = currentScheme.value
  if (!scheme) return []

  const refKeys = getSlotRefKeys(slot)
  const isSpirit = SPIRIT_SLOTS.includes(slot)
  const spiritPos = isSpirit ? getSpiritPosition(slot) : null
  const isCultivation = OTHER_SLOTS.includes(slot) || refKeys.some(k => OTHER_SLOTS.includes(k))

  // 收集候选物品名
  const candidates = new Set<string>()
  if (isCultivation) {
    // 养成槽位（含灵兽面板子槽位）：直接来自 priceDetailMap（实时查询结果）
    for (const [itemName, entries] of priceDetailMap.value) {
      if (entries && entries.length > 0) candidates.add(itemName)
    }
  } else if (slot.startsWith('灵兽:')) {
    // 灵兽槽位：按当前槽位名称精确取候选
    const beastName = getBeastNameForSlot(slot)
    if (beastName) candidates.add(beastName)
  } else {
    // 装备/灵魄/翅膀/符咒：来自 reference data
    for (const key of refKeys) {
      const names = slotRefMap.value.get(key)
      if (names) names.forEach(n => candidates.add(n))
    }
    // 翅膀 / 符咒：追加固定名称列表
    const fixed = getFixedSlotNames(slot)
    fixed.forEach(n => candidates.add(n))
  }

  const search = (slotSearch.value[slot] || '').toLowerCase()
  const result: SlotOption[] = []

  for (const name of candidates) {
    // 装备槽位：职业 + 等级过滤
    if (EQUIP_SLOTS.includes(slot) || slot === '翅膀' || slot === '符咒') {
      const meta = equipMetaMap.value.get(name)
      if (meta) {
        if (meta.job_limit && scheme.job && meta.job_limit !== scheme.job) continue
        if (meta.level > 0 && scheme.level_num > 0 && meta.level > scheme.level_num) continue
      }
    }
    // 奥义：职业过滤
    if (slot === '奥义') {
      const meta = equipMetaMap.value.get(name)
      if (meta?.job_limit && scheme.job && meta.job_limit !== scheme.job) continue
    }
    // 灵魄：spirit_position 过滤
    if (isSpirit && spiritPos) {
      const itemSp = spiritPositionMap.value[name]
      if (itemSp && itemSp !== spiritPos) continue
    }

    // 查找该物品的所有物价条目
    const entries = priceDetailMap.value.get(name)
    if (entries && entries.length > 0) {
      for (const entry of entries) {
        if (search && !name.toLowerCase().includes(search) && !toPinyinInitials(name).includes(search) && !toFullPinyin(name).includes(search)) continue
        const quality = entry.quality || ''
        result.push({ name, _id: entry.id, _price: entry.price, _disabled: false, _hint: '', _notes: entry.notes, _quality: quality })
      }
    } else {
      // 无物价条目：仅当无搜索词时显示占位行（不可选中，提示未录入价格）
      if (!search) {
        result.push({ name, _id: 0, _price: 0, _disabled: true, _hint: '未录入价格', _notes: '', _quality: '' })
      }
    }
  }

  // 去重（同 name + price + notes）
  const seen = new Set<string>()
  const deduped: SlotOption[] = []
  for (const r of result) {
    const key = `${r.name}|${r._price}|${r._notes}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(r)
  }

  // 排序：有价格的在前，价格低的在前
  deduped.sort((a, b) => {
    if (a._price && !b._price) return -1
    if (!a._price && b._price) return 1
    if (a._price && b._price) return a._price - b._price
    return a.name.localeCompare(b.name)
  })

  return deduped
}

function toggleSlotDropdown(slot: string) {
  if (isSlotLocked(slot)) return
  if (expandedSlot.value === slot) {
    closeDropdown()
  } else {
    expandedSlot.value = slot
    if (!slotSearch.value[slot]) slotSearch.value[slot] = ''
    // 异步加载该槽位的物价明细，加载完成后刷新下拉
    loadSlotPriceDetails(slot).then(() => {
      if (expandedSlot.value === slot) { /* loaded */ }
    })
    // 下一帧聚焦搜索框
    setTimeout(() => {
      const input = document.querySelector('.slot-dropdown-search') as HTMLInputElement
      input?.focus()
    }, 50)
  }
}

async function selectSlotItem(slot: string, item: SlotOption) {
  if (isSlotLocked(slot)) return
  if (!currentScheme.value) return
  // 未录入价格的占位行不可选中
  if (item._disabled) return
  // 更新 details + slot_price_ids（持久化完整道具属性：id/price/notes/quality）
  const details = { ...(currentScheme.value.details || {}), [slot]: item.name }
  const entry: SlotPriceEntry = { i: item._id, p: item._price, n: item._notes || '', q: item._quality || '' }
  const slot_price_ids = { ...(currentScheme.value.slot_price_ids || {}), [slot]: entry }
  await window.electronAPI.dbQuery(
    `UPDATE gear_schemes SET details=?,slot_price_ids=?,updated_at=datetime('now','localtime') WHERE id=?`,
    [JSON.stringify(details), JSON.stringify(slot_price_ids), currentScheme.value.id]
  )
  currentScheme.value.details = details
  currentScheme.value.slot_price_ids = slot_price_ids
  // 同步兼容数据（BeastPanel 等依赖 itemName 索引）
  catalogPrices.value[item.name] = item._price
  catalogNotes.value[item.name] = item._notes
  catalogQualities.value[item.name] = item._quality || ''
  // 关闭下拉并清理搜索
  closeDropdown()
}

async function clearSlot(slot: string) {
  if (isSlotLocked(slot)) return
  if (!currentScheme.value) return
  const details = { ...currentScheme.value.details }
  const slot_price_ids = { ...(currentScheme.value.slot_price_ids || {}) }
  delete details[slot]
  delete slot_price_ids[slot]
  await window.electronAPI.dbQuery(
    `UPDATE gear_schemes SET details=?,slot_price_ids=?,updated_at=datetime('now','localtime') WHERE id=?`,
    [JSON.stringify(details), JSON.stringify(slot_price_ids), currentScheme.value.id]
  )
  currentScheme.value.details = details
  currentScheme.value.slot_price_ids = slot_price_ids
}

// 点击外部关闭下拉
function handleClickOutside(e: MouseEvent) {
  if (expandedSlot.value) {
    const target = e.target as HTMLElement
    if (!target.closest('.slot-dropdown') && !target.closest('.slot-card--open')) {
      closeDropdown()
    }
  }
}

// ESC 关闭下拉
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && expandedSlot.value) {
    closeDropdown()
  }
}

function serverNameOf(id?: number | null): string {
  if (!id) return '未分配'
  return app.servers.find(s => s.id === id)?.name || '未知大区'
}

function schemeLabel(s: Scheme): string {
  const budget = Number(s.total_budget) || 0
  return `${serverNameOf(s.server_id)} · ${s.name} · ${s.job} Lv.${s.level_num} · ${budget}亿`
}

function isSchemeSelectable(s: Scheme): boolean {
  const sid = app.currentServerId
  if (!sid) return false
  return s.server_id === sid
}

const listedSchemes = computed(() => {
  const sid = app.currentServerId
  return [
    ...schemes.value.filter(s => s.server_id === sid),
    ...schemes.value.filter(s => s.server_id !== sid),
  ]
})

const formServerLabel = computed(() => {
  if (editingScheme.value) return serverNameOf(editingScheme.value.server_id)
  return app.currentServerName || '当前大区'
})

function lastSchemeStorageKey(serverId: number) {
  return `sgbuddy-last-scheme-id-${serverId}`
}

function readLastSchemeId(serverId: number): number {
  const per = Number(localStorage.getItem(lastSchemeStorageKey(serverId)))
  if (per > 0) return per
  const old = Number(localStorage.getItem('sgbuddy-last-scheme-id'))
  if (old > 0) {
    const s = schemes.value.find(x => x.id === old)
    if (s && s.server_id === serverId) return old
  }
  return 0
}

function rememberScheme(s: Scheme) {
  if (s.server_id) localStorage.setItem(lastSchemeStorageKey(s.server_id), String(s.id))
}

function clearCurrentScheme() {
  currentScheme.value = null
  selectedSchemeId.value = -1
}

async function applySchemeForServer(serverId: number) {
  const lastId = readLastSchemeId(serverId)
  const s = lastId > 0 ? schemes.value.find(x => x.id === lastId && x.server_id === serverId) : undefined
  if (s) await selectScheme(s)
  else clearCurrentScheme()
}

function onSchemeSelect() {
  const s = schemes.value.find(x => x.id === selectedSchemeId.value)
  if (!s || !isSchemeSelectable(s)) {
    selectedSchemeId.value = currentScheme.value?.id ?? -1
    return
  }
  selectScheme(s)
}

async function selectScheme(s: Scheme) {
  if (!isSchemeSelectable(s)) return
  currentScheme.value = s
  selectedSchemeId.value = s.id
  rememberScheme(s)
  loadLockedSlots(s.id)
  await cleanupLegacyShenyuanKeys()
  // 迁移旧格式（纯数字 id）→ 新格式（{i,p,n,q}）
  await migrateSlotPrices()
  syncCatalogFromSlotPrices()
}

// 将 slot_price_ids 中的旧格式（纯数字 id）升级为新格式（完整属性对象）
async function migrateSlotPrices() {
  if (!currentScheme.value) return
  const sidMap = currentScheme.value.slot_price_ids || {}
  const legacySlots: Array<{ slot: string; id: number }> = []
  for (const [slot, val] of Object.entries(sidMap)) {
    if (val && typeof val === 'number' && val > 0) {
      legacySlots.push({ slot, id: val })
    }
  }
  if (!legacySlots.length) return

  const ids = legacySlots.map(s => s.id)
  const rows = await window.electronAPI.dbQuery(
    `SELECT id, market_price, quality, TRIM(COALESCE(attrs,'') || ' ' || COALESCE(attr_notes,'') || ' ' || COALESCE(craft_level,'')) as notes FROM price_params WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids
  ) as Array<{ id: number; market_price: number; quality: string; notes: string }>
  const rowMap = new Map<number, { price: number; notes: string; quality: string }>()
  for (const r of rows) {
    rowMap.set(r.id, { price: Math.round((r.market_price || 0) * 10000), notes: r.notes || '', quality: r.quality || '' })
  }

  const updated = { ...sidMap }
  for (const { slot, id } of legacySlots) {
    const data = rowMap.get(id)
    if (data) {
      updated[slot] = { i: id, p: data.price, n: data.notes, q: data.quality }
    }
  }
  currentScheme.value.slot_price_ids = updated
  await window.electronAPI.dbQuery(
    `UPDATE gear_schemes SET slot_price_ids=? WHERE id=?`,
    [JSON.stringify(updated), currentScheme.value.id]
  )
}

// 清理旧格式元神键（上一版动态槽位 元神:N 与更早养成系统 元神），固定结构无需迁移
async function cleanupLegacyShenyuanKeys() {
  const scheme = currentScheme.value
  if (!scheme) return
  const details = { ...(scheme.details || {}) } as Record<string, string>
  const sidMap = { ...(scheme.slot_price_ids || {}) }
  let changed = false

  // 清理 v1 动态槽位残留（'元神' 或 '元神:数字'）
  const legacyKeys = Object.keys(details).filter(k => k === '元神' || /^元神:\d+$/.test(k))
  for (const k of legacyKeys) { delete details[k]; delete sidMap[k]; changed = true }

  // 迁移：旧「元神:主」→ 新「元神:背包1」
  if (details['元神:主'] || sidMap['元神:主']) {
    details['元神:背包1'] = details['元神:主'] || details['元神:背包1'] || ''
    sidMap['元神:背包1'] = sidMap['元神:主'] || sidMap['元神:背包1']
    delete details['元神:主']; delete sidMap['元神:主']
    changed = true
  }

  if (changed) await persistScheme(details, sidMap)
}

function openNewScheme() {
  editingScheme.value = null
  form.name = ''; form.character_name = ''; form.job = '剑侍'; form.level_num = 100; form.total_budget = 5
  showForm.value = true
}
function editScheme(s: Scheme) {
  editingScheme.value = s
  form.name = s.name; form.character_name = s.character_name || ''; form.job = s.job || '剑侍'; form.level_num = s.level_num || 100; form.total_budget = s.total_budget
  showForm.value = true
}
async function saveScheme() {
  if (!form.name) return
  try {
    if (editingScheme.value) {
      await window.electronAPI.dbQuery(
        `UPDATE gear_schemes SET name=?,character_name=?,job=?,level_num=?,total_budget=?,updated_at=datetime('now','localtime') WHERE id=?`,
        [form.name, form.character_name, form.job, form.level_num, form.total_budget, editingScheme.value.id])
      showForm.value = false; await loadSchemes()
      const updated = schemes.value.find(s => s.id === editingScheme.value!.id)
      if (updated) await selectScheme(updated)
    } else {
      const sid = app.currentServerId
      if (!sid) { alert('请先选择大区'); return }
      await window.electronAPI.dbQuery(
        `INSERT INTO gear_schemes (name,character_name,job,level_num,total_budget,details,server_id,updated_at) VALUES (?,?,?,?,?,'{}',?,datetime('now','localtime'))`,
        [form.name, form.character_name, form.job, form.level_num, form.total_budget, sid])
      const rows = await window.electronAPI.dbQuery('SELECT last_insert_rowid() as id', []) as any[]
      const newId = rows?.[0]?.id
      showForm.value = false; await loadSchemes()
      if (newId) {
        const created = schemes.value.find(s => s.id === newId)
        if (created) await selectScheme(created)
        lockedSlots.value = {}  // 新方案默认无锁定
      }
    }
  } catch (e: any) { alert('保存失败: ' + (e?.message || e)) }
}
async function deleteScheme(id: number) {
  const scheme = schemes.value.find(s => s.id === id)
  if (!confirm(`确定删除方案「${scheme?.name || '未命名'}」？此操作不可撤销。`)) return
  const serverId = scheme?.server_id
  await window.electronAPI.dbQuery('DELETE FROM gear_schemes WHERE id=?', [id])
  if (currentScheme.value?.id === id) {
    clearCurrentScheme()
    if (serverId) localStorage.removeItem(lastSchemeStorageKey(serverId))
  }
  await loadSchemes()
}
async function copyScheme() {
  if (!currentScheme.value) return
  try {
    const s = currentScheme.value
    const sid = s.server_id || app.currentServerId
    if (!sid) { alert('请先选择大区'); return }
    const newName = (s.name || '未命名') + ' (副本)'
    await window.electronAPI.dbQuery(
      `INSERT INTO gear_schemes (name,character_name,job,level_num,total_budget,details,slot_price_ids,notes,server_id,updated_at) VALUES (?,?,?,?,?,?,?,?,?,datetime('now','localtime'))`,
      [newName, s.character_name, s.job, s.level_num, s.total_budget, JSON.stringify(s.details || {}), JSON.stringify(s.slot_price_ids || {}), s.notes || '', sid]
    )
    const rows = await window.electronAPI.dbQuery('SELECT last_insert_rowid() as id', []) as any[]
    const newId = rows?.[0]?.id
    await loadSchemes()
    if (newId) {
      const copied = schemes.value.find(x => x.id === newId)
      if (copied) await selectScheme(copied)
      lockedSlots.value = {} // 副本默认全部未锁定
    }
  } catch (e: any) { alert('复制失败: ' + (e?.message || e)) }
}
async function loadSchemes() {
  const rows = await window.electronAPI.dbQuery('SELECT * FROM gear_schemes ORDER BY updated_at DESC') as any[]
  schemes.value = rows.map(r => ({
    ...r,
    details: typeof r.details === 'string' ? JSON.parse(r.details || '{}') : (r.details || {}),
    slot_price_ids: typeof r.slot_price_ids === 'string' ? JSON.parse(r.slot_price_ids || '{}') : (r.slot_price_ids || {}),
  }))
}

async function loadReferenceData() {
  const slotMap = new Map<string, string[]>()
  const metaMap = new Map<string, { level: number; job_limit: string }>()

  // 装备/养成类候选与元数据：来自 price_params（录过价的物品）
  try {
    const priceRows = await window.electronAPI.dbQuery(
      "SELECT item_name, category, slot, IFNULL(MAX(equip_level), 0) as equip_level, IFNULL(MAX(equip_job), '') as equip_job FROM price_params WHERE category IN ('装备','灵魄','八阵图','子女','奥义','灵珠','羽灵','元神') GROUP BY item_name, category, slot",
      []
    ) as Array<{ item_name: string; category: string; slot: string; equip_level: number; equip_job: string }>
    for (const r of priceRows) {
      const key = r.slot || r.category
      if (!slotMap.has(key)) slotMap.set(key, [])
      if (!slotMap.get(key)!.includes(r.item_name)) {
        slotMap.get(key)!.push(r.item_name)
      }
      if (r.equip_level || r.equip_job) {
        metaMap.set(r.item_name, { level: r.equip_level || 0, job_limit: r.equip_job || '' })
      }
    }
  } catch (e) { console.warn('loadReferenceData: price_params query failed', e) }

  // 材料图鉴 → 类别映射（用于养成系统槽位等）
  try {
    const matRows = await window.electronAPI.dbQuery(
      'SELECT name, category FROM material_library', []
    ) as Array<{ name: string; category: string }>
    for (const r of matRows) {
      if (!slotMap.has(r.category)) slotMap.set(r.category, [])
      if (!slotMap.get(r.category)!.includes(r.name)) {
        slotMap.get(r.category)!.push(r.name)
      }
    }
  } catch (e) { console.warn('loadReferenceData: material_library query failed', e) }

  // 从 price_params 补充 reference data 中缺失的灵魄名称（如手动录入但不在模板中的灵魄）
  try {
    const extraSpirits = await window.electronAPI.dbQuery(
      "SELECT DISTINCT item_name FROM price_params WHERE category='灵魄'", []
    ) as Array<{ item_name: string }>
    const existing = new Set(slotMap.get('灵魄') || [])
    for (const r of extraSpirits) {
      if (!existing.has(r.item_name)) {
        if (!slotMap.has('灵魄')) slotMap.set('灵魄', [])
        slotMap.get('灵魄')!.push(r.item_name)
      }
    }
  } catch (e) { console.warn('loadReferenceData: extra spirits query failed', e) }

  // 从 price_params 补充元神名称（元神槽位下拉按 category='元神' 全量取，不受 slot 字段影响）
  try {
    const extraShenyuan = await window.electronAPI.dbQuery(
      "SELECT DISTINCT item_name FROM price_params WHERE category='元神'", []
    ) as Array<{ item_name: string }>
    const existing = new Set(slotMap.get('元神') || [])
    for (const r of extraShenyuan) {
      if (!existing.has(r.item_name)) {
        if (!slotMap.has('元神')) slotMap.set('元神', [])
        slotMap.get('元神')!.push(r.item_name)
      }
    }
  } catch (e) { console.warn('loadReferenceData: extra shenyuan query failed', e) }

  slotRefMap.value = slotMap
  equipMetaMap.value = metaMap
}

/* ── 方案备注（点击编辑） ── */
const editingNotes = ref(false)
const editNotesText = ref('')
const notesTextareaRef = ref<HTMLTextAreaElement | null>(null)

function startNotesEdit() {
  editNotesText.value = currentScheme.value?.notes || ''
  editingNotes.value = true
  nextTick(() => notesTextareaRef.value?.focus())
}

async function saveNotes() {
  if (!currentScheme.value) return
  const val = editNotesText.value.trim()
  editingNotes.value = false
  if (val === (currentScheme.value.notes || '')) return
  await window.electronAPI.dbQuery(
    `UPDATE gear_schemes SET notes=?,updated_at=datetime('now','localtime') WHERE id=?`,
    [val, currentScheme.value.id]
  )
  currentScheme.value.notes = val
}

function cancelNotesEdit() {
  editingNotes.value = false
}

// ── 装备图片 ──
// 子组件（ShenyuanPanel/BeastPanel）按物品名称调用
function hasSlotImage(itemName: string): boolean {
  return itemsWithImages.value.has(itemName)
}
function slotImageExists(slot: string): boolean {
  const name = getDetail(slot)
  if (!name) return false
  // 优先按 price_id 精确匹配
  const sidEntry = getSlotPriceEntry(slot)
  if (sidEntry) return itemsWithImages.value.has(`p${sidEntry.i}`) || itemsWithImages.value.has(name)
  // 旧数据回退 item_name
  return itemsWithImages.value.has(name)
}
function getSlotPriceEntry(slot: string): SlotPriceEntry | null {
  const raw = currentScheme.value?.slot_price_ids?.[slot]
  if (raw && typeof raw === 'object' && 'i' in raw) return raw as SlotPriceEntry
  return null
}
async function openSlotImage(slotOrName: string) {
  // 兼容：参数可能是槽位 key（主模板调用），也可能是物品名称（子组件 $emit）
  const detail = getDetail(slotOrName)
  const name = detail || slotOrName
  if (!name) return
  let priceId: number | undefined
  if (detail) { // 是槽位 key，可查 price_id
    const sidEntry = getSlotPriceEntry(slotOrName)
    priceId = sidEntry?.i
  }
  // 优先按 price_id 查询
  let rows = priceId ? await window.electronAPI.listImages(name, priceId) : await window.electronAPI.listImages(name)
  // 旧数据回退
  if (rows.length === 0 && priceId) rows = await window.electronAPI.listImages(name)
  if (!rows.length) {
    const key = priceId ? `p${priceId}` : name
    itemsWithImages.value.delete(key)
    return
  }
  const dataUrls = (await Promise.all(rows.map(async r => await window.electronAPI.readImage(r.image_path)))).filter(Boolean) as string[]
  viewerImages.value = dataUrls
  if (viewerImages.value.length) viewerVisible.value = true
}
async function refreshImageSet() {
  try {
    const rows = await window.electronAPI.dbQuery(
      'SELECT DISTINCT item_name, price_id FROM equipment_images'
    ) as Array<{ item_name: string; price_id: number | null }>
    const set = new Set<string>()
    for (const r of rows) {
      set.add(r.price_id ? `p${r.price_id}` : r.item_name)
    }
    itemsWithImages.value = set
  } catch { itemsWithImages.value = new Set() }
}

// ── 下拉选项图片预览 ──
function optionHasImage(item: SlotOption): boolean {
  if (item._id > 0) {
    if (itemsWithImages.value.has(`p${item._id}`)) return true
  }
  return itemsWithImages.value.has(item.name)
}

async function viewOptionImage(item: SlotOption) {
  if (!item.name) return
  // 优先按 price_id 查询图片
  let rows = item._id > 0 ? await window.electronAPI.listImages(item.name, item._id) : await window.electronAPI.listImages(item.name)
  // 旧数据回退
  if (rows.length === 0 && item._id > 0) rows = await window.electronAPI.listImages(item.name)
  if (!rows.length) {
    if (item._id > 0) itemsWithImages.value.delete(`p${item._id}`)
    itemsWithImages.value.delete(item.name)
    return
  }
  const dataUrls = (await Promise.all(rows.map(async r => await window.electronAPI.readImage(r.image_path)))).filter(Boolean) as string[]
  viewerImages.value = dataUrls
  if (viewerImages.value.length) viewerVisible.value = true
}

const schemesReady = ref(false)

async function migrateNullServerIds() {
  const sid = app.currentServerId
  if (!sid) return
  await window.electronAPI.dbQuery('UPDATE gear_schemes SET server_id=? WHERE server_id IS NULL', [sid])
}

onMounted(async () => {
  await loadSchemes(); await loadReferenceData(); await app.loadServers()
  await migrateNullServerIds()
  await loadSchemes()
  refreshImageSet()
  document.addEventListener('click', handleClickOutside); document.addEventListener('keydown', handleKeydown); document.addEventListener('paste', onSlotSearchPaste)
  schemesReady.value = true
  if (app.currentServerId) await applySchemeForServer(app.currentServerId)
})

watch(() => app.currentServerId, async (newId, oldId) => {
  if (!schemesReady.value) return
  if (newId === oldId) return
  if (!newId) { clearCurrentScheme(); return }
  if (currentScheme.value?.server_id === newId) return
  await applySchemeForServer(newId)
})

// 实时刷新：物价数据版本号变化（录入/修改/删除）→ 立即重新加载参考数据
let refreshTimer: ReturnType<typeof setTimeout> | null = null
watch(() => app.priceDataVersion, () => {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(async () => {
    await loadReferenceData()
    refreshImageSet()
  }, 300)
})

async function exportToExcel() {
  if (!currentScheme.value) return
  try {
    const s = currentScheme.value
    // 收集灵兽数据（平铺所有已选灵兽）
    const beastSlots: Array<{ slotKey: string; category: string; grade: string; name: string }> = []
    try {
      const stored = JSON.parse(localStorage.getItem('sgbuddy-beast-data') || '{}')
      const details = s.details || {}
      for (const [slotKey, name] of Object.entries(details)) {
        if (!slotKey.startsWith('灵兽:')) continue
        const parts = slotKey.split(':') // ['灵兽', category, grade, index]
        if (parts.length >= 3) {
          beastSlots.push({ slotKey, category: parts[1], grade: parts[2], name })
        }
      }
    } catch { /* ignore */ }

    // 收集元神数据（主元神 + 5仓库×5槽位）
    const shenyuanGroups = [
      { label: '背包', slots: Array.from({ length: 5 }, (_, i) => `元神:背包${i + 1}`) },
      ...Array.from({ length: 5 }, (_, w) => ({
        label: `仓库${w + 1}`,
        slots: Array.from({ length: 5 }, (_, s) => `元神:仓${w + 1}槽${s + 1}`),
      })),
    ]

    // JSON 序列化去掉 Vue 响应式代理，确保 IPC 可克隆
    const payload = JSON.parse(JSON.stringify({
      name: s.name, job: s.job, level_num: s.level_num, total_budget: s.total_budget,
      character_name: s.character_name, notes: s.notes,
      details: s.details || {},
      slot_price_ids: s.slot_price_ids || {},
      lockedSlots: { ...lockedSlots.value },
      equipGroups: equipGroups.map(g => ({ label: g.label, slots: [...g.slots] })),
      spiritGroups: spiritGroups.map(g => ({ label: g.label, slots: [...g.slots] })),
      shenyuanGroups,
      cultivateSlots: [...filteredCultivateSlots.value],
      beastSlots: beastSlots.length > 0 ? beastSlots : undefined,
      itemQualities: { ...catalogQualities.value },
    }))
    const result = await window.electronAPI.exportScheme(payload)
    if (result.error && result.error !== '已取消') {
      alert('导出失败: ' + result.error)
    }
  } catch (e: any) {
    alert('导出异常: ' + (e?.message || e))
  }
}

// 从其他页面切回时刷新价格和图片缓存（与物价图鉴保持一致）
onActivated(() => {
  refreshImageSet()
  if (currentScheme.value) {
    syncCatalogFromSlotPrices()
  }
})

onUnmounted(() => { document.removeEventListener('click', handleClickOutside); document.removeEventListener('keydown', handleKeydown); document.removeEventListener('paste', onQuickAddPaste); document.removeEventListener('paste', onSlotSearchPaste) })
</script>

<style scoped>
.page { height:100%; display:flex; flex-direction:column; overflow:hidden; }

/* ── 顶栏 ── */
.topbar { display:flex; align-items:center; gap:12px; padding-bottom:12px; border-bottom:0.5px solid var(--color-border-light); flex-shrink:0; }
.topbar-left { display:flex; align-items:center; gap:8px; }
.topbar-left h2 { font-size:22px; font-weight:650; margin:0; }
.topbar-center { display:flex; align-items:center; gap:8px; flex:1; }
.topbar-right { display:flex; align-items:center; gap:6px; }
.scheme-select { padding:5px 8px; font-size:12.5px; font-family:inherit; background:var(--color-surface-2); color:var(--color-text); border:0.5px solid var(--color-border); border-radius:5px; min-width:260px; max-width:420px; }
.scheme-select option:disabled { color: var(--color-text-tertiary); }

/* ── 帮助弹层 ── */
.help-box { padding:12px 16px; border-radius:var(--radius-sm); background:var(--color-surface-2); border:0.5px solid var(--color-border-light); font-size:12px; color:var(--color-text-secondary); line-height:1.8; margin-bottom:8px; flex-shrink:0; }
.help-box p { margin:0; }
.btn-close-help { margin-top:6px; border:none; background:var(--color-accent); color:#fff; border-radius:4px; padding:3px 10px; font-size:11px; cursor:pointer; font-family:inherit; }
.btn-help { width:26px; height:26px; border-radius:50%; border:1px solid var(--color-border); background:var(--color-surface-1); font-size:13px; font-weight:600; color:var(--color-text-tertiary); cursor:pointer; display:flex; align-items:center; justify-content:center; }
.btn-help:hover { border-color:var(--color-accent); color:var(--color-accent); }

/* ── 信息栏 ── */
/* ── 仪表盘 ── */
.dashboard { padding: 10px 14px; background: var(--color-surface-1); border: 0.5px solid var(--color-border-light); border-radius: var(--radius-md); margin-bottom: 8px; flex-shrink: 0; }
.dash-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.dash-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-text-secondary); }
.dash-item--wide { flex: 1; min-width: 180px; }
.dash-label { white-space: nowrap; min-width: 120px; }
.dash-bar { flex: 1; height: 8px; background: var(--color-surface-2); border-radius: 4px; overflow: hidden; }
.dash-bar-fill { height: 100%; border-radius: 4px; transition: width 0.4s; }
.dash-bar-fill--slot { background: var(--color-accent); }
.dash-bar-fill--budget { background: var(--color-success); }
.dash-bar-fill--over { background: var(--color-danger); }
.dash-pct { font-size: 11px; font-weight: 600; min-width: 32px; text-align: right; }
.dash-breakdown { margin-top: 8px; padding-top: 8px; border-top: 0.5px solid var(--color-border-light); gap: 12px; }
.dash-bd-item { font-size: 11px; color: var(--color-text-secondary); }
.dash-bd-item strong { color: var(--color-accent); margin-left: 2px; }

/* ── Tab ── */
.tab-bar { display:flex; gap:2px; margin-top:4px; flex-shrink:0; }
.tab { padding:8px 18px; border:none; border-radius:6px 6px 0 0; background:transparent; font-size:13px; font-family:inherit; color:var(--color-text-tertiary); cursor:pointer; transition:all 0.12s; }
.tab:hover { color:var(--color-text); background:var(--color-surface-2); }
.tab--active { color:var(--color-accent); background:var(--color-accent-bg); font-weight:550; }
.tab-count { font-size:10.5px; margin-left:4px; opacity:0.6; }
.tab-total { font-size:10.5px; margin-left:4px; color:var(--color-accent); }

/* ── Tab 内容 ── */
.tab-content { flex:1; overflow-y:auto; padding:14px 0; }
.slot-grid-2col { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:14px; align-content:start; }
.slot-section-card { min-width:0; background:var(--color-surface-1); border:0.5px solid var(--color-border-light); border-radius:var(--radius-md); overflow:visible; }
.sec-head { padding:10px 14px; background:var(--color-surface-2); font-size:13px; font-weight:600; }
.sec-slots { padding:8px; display:flex; flex-direction:column; gap:3px; }
.slot-card { display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:var(--radius-sm); background:var(--color-surface-2); font-size:12px; }
.slot-card--empty { opacity:0.5; }
.slot-card--ai { border-left:3px solid var(--color-accent); background:var(--color-accent-bg); }
.sc-label { width:42px; flex-shrink:0; font-weight:550; color:var(--color-text-secondary); font-size:11px; }
.sc-val { flex:2 1 0; color:var(--color-text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }
.slot-card--empty .sc-val { color:var(--color-text-tertiary); }
.sc-notes { flex:1 1 0; max-width:180px; font-size:10.5px; color:var(--color-text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }
.sc-price { font-size:10.5px; color:var(--color-accent); font-weight:500; flex-shrink:0; }

/* ── 思考面板 ── */
.thinking-panel { position:fixed; right:0; bottom:0; width:320px; max-height:50vh; background:var(--color-surface-1); border:0.5px solid var(--color-border); border-radius:var(--radius-md) 0 0 0; box-shadow:-2px -2px 12px rgba(0,0,0,0.1); z-index:100; display:flex; flex-direction:column; }
.thinking-head { display:flex; justify-content:space-between; align-items:center; padding:8px 12px; border-bottom:0.5px solid var(--color-border-light); font-size:13px; font-weight:550; flex-shrink:0; }
.btn-close-think { background:none; border:none; font-size:14px; cursor:pointer; color:var(--color-text-tertiary); }
.thinking-body { flex:1; overflow-y:auto; padding:8px 12px; display:flex; flex-direction:column; gap:2px; }
.thinking-line { font-size:11px; color:var(--color-text-secondary); padding:3px 0; border-bottom:0.5px solid var(--color-border-light); }

/* ── 通用 ── */
.hint { color:var(--color-text-tertiary); text-align:center; padding:36px; font-size:12.5px; }
.badge { font-size:11px; padding:2px 8px; border-radius:10px; background:var(--color-accent-bg); color:var(--color-accent); }
.badge--char { background:var(--color-surface-3); color:var(--color-text-secondary); }

/* ── 方案备注（点击编辑） ── */
.scheme-notes {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 10px 12px; margin: 2px 0;
  background: var(--color-surface-2); border-radius: var(--radius-sm);
  font-size: 12px; color: var(--color-text-secondary);
  line-height: 1.6; flex-shrink: 0; cursor: pointer;
  min-height: 100px;
}
.scheme-notes:hover { background: var(--color-surface-3); }
.sn-label { flex-shrink: 0; font-size: 13px; margin-top: 2px; }
.sn-text { white-space: pre-wrap; word-break: break-word; min-width: 0; flex: 1; padding: 4px 0; }
.sn-text--empty { color: var(--color-text-tertiary); font-style: italic; }
.sn-edit-wrap { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.sn-textarea {
  width: 100%; padding: 8px 10px; font-size: 12px; font-family: inherit;
  background: var(--color-surface-1); color: var(--color-text);
  border: 0.5px solid var(--color-accent); border-radius: 4px;
  resize: vertical; min-height: 120px; line-height: 1.6; outline: none;
}
.text-danger { color:var(--color-danger); }
.text-warn { color:#e65100; }

.btn { border:none; border-radius:5px; cursor:pointer; font-size:12.5px; font-weight:500; padding:5px 12px; font-family:inherit; transition:all 0.12s; }
.btn:disabled { opacity:0.4; cursor:not-allowed; }
.btn-accent { background:var(--color-accent); color:#fff; }
.btn-accent:hover { opacity:0.9; }
.btn-ai { background:linear-gradient(135deg,#5E6AD2,#8B5CF6); color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:550; padding:7px 16px; font-family:inherit; }
.btn-ai:hover { opacity:0.9; }
.btn-ai:disabled { opacity:0.5; cursor:not-allowed; }
.btn-ghost { background:transparent; color:var(--color-text-secondary); }
.btn-ghost:hover { background:var(--color-hover); }
.btn-sm { font-size:11px; padding:3px 8px; }
.btn-icon { background:none; border:none; cursor:pointer; font-size:16px; color:var(--color-text-tertiary); }

.modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; z-index:200; }
.modal { background:var(--color-surface-1); border:0.5px solid var(--color-border); border-radius:var(--radius-lg); width:420px; max-width:90vw; box-shadow:0 16px 40px rgba(0,0,0,0.3); }
.modal-head { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:0.5px solid var(--color-border-light); }
.modal-head h4 { font-size:15px; font-weight:600; margin:0; }
.modal-body { padding:20px; display:flex; flex-direction:column; gap:14px; }
.modal-foot { display:flex; justify-content:flex-end; gap:8px; padding:14px 20px; border-top:0.5px solid var(--color-border-light); }
.form-row { display:flex; flex-direction:column; gap:4px; }
.form-row--2col { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.form-label { font-size:11.5px; font-weight:500; color:var(--color-text-secondary); }
.input { width:100%; padding:7px 10px; font-size:12.5px; font-family:inherit; background:var(--color-surface-2); color:var(--color-text); border:0.5px solid var(--color-border); border-radius:5px; }
.input:disabled { opacity:0.7; cursor:not-allowed; color:var(--color-text-secondary); }
.input:focus { outline:none; border-color:var(--color-accent-ring); }

/* ── 设置面板 ── */
.btn-ghost--active { background: var(--color-accent-bg); color: var(--color-accent); }
.settings-panel {
  margin-bottom: 14px; padding: 14px 16px;
  background: var(--color-surface-1); border: 0.5px solid var(--color-border-light);
  border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 12px;
}
.st-row { display: flex; gap: 12px; }
.st-row--end { align-items: center; }
.st-field { flex: 1; min-width: 0; }
.st-label { display: block; font-size: 10.5px; font-weight: 500; color: var(--color-text-tertiary); margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.03em; }
.st-input { width: 100%; }
.st-hint { font-size: 10.5px; margin-left: 6px; white-space: nowrap; }
.model-pills { display: flex; gap: 8px; flex-wrap: wrap; }
.model-pill {
  display: flex; flex-direction: column; gap: 2px;
  padding: 8px 10px; border-radius: 6px; cursor: pointer;
  background: var(--color-surface-2); border: 0.5px solid var(--color-border);
  transition: all 0.12s; font-family: inherit; text-align: left;
}
.model-pill:hover { border-color: var(--color-accent-ring); }
.model-pill--active { background: var(--color-accent-bg); border-color: var(--color-accent); }
.model-pill-name { font-size: 12px; font-weight: 600; color: var(--color-text); }
.model-pill--active .model-pill-name { color: var(--color-accent); }
.model-pill-desc { font-size: 10px; color: var(--color-text-tertiary); }
.test-result { font-size: 12px; }
.prompt-details { margin-top: 4px; }
.prompt-summary { cursor: pointer; font-size: 12.5px; font-weight: 500; color: var(--color-text-secondary); padding: 4px 0; user-select: none; }
.prompt-summary:hover { color: var(--color-text); }
.prompt-editor {
  width: 100%; margin-top: 8px; padding: 10px; font-size: 12px;
  font-family: 'SF Mono','Cascadia Code','Consolas',monospace;
  background: var(--color-surface-2); color: var(--color-text);
  border: 0.5px solid var(--color-border); border-radius: 5px;
  resize: vertical; outline: none; line-height: 1.6;
}
.prompt-editor:focus { border-color: var(--color-accent-ring); }
.prompt-actions { margin-top: 6px; }
.text-success { color: var(--color-success); }
.text-muted { color: var(--color-text-tertiary); }

@media (max-width:900px) { .slot-grid-2col { grid-template-columns:1fr; } }

/* ── 槽位下拉 ── */
.slot-card { position: relative; cursor: pointer; }
.slot-card:hover { background: var(--color-surface-3); }
.slot-card--open { border-color: var(--color-accent); background: var(--color-accent-bg); z-index: 101; opacity: 1; }
.sc-arrow { font-size: 10px; color: var(--color-text-tertiary); flex-shrink: 0; }
.sc-img { font-size: 13px; flex-shrink: 0; cursor: pointer; opacity: 0.7; }
.sc-img:hover { opacity: 1; }
.sc-lock { font-size: 13px; cursor: pointer; flex-shrink: 0; opacity: 0.5; transition: opacity 0.12s; }
.sc-lock:hover { opacity: 1; }
.sc-lock-time { font-size: 10px; color: var(--color-accent); flex-shrink: 0; white-space: nowrap; opacity: 0.8; }
.slot-card--locked { border-left: 2px solid var(--color-accent); cursor: default; }
.slot-card--locked:hover { background: var(--color-surface-3); }
.sc-clear { font-size: 11px; color: var(--color-text-tertiary); cursor: pointer; flex-shrink: 0; padding: 0 2px; }
.sc-clear:hover { color: var(--color-danger); }
.slot-dropdown {
  position: absolute; left: 0; right: 0; top: 100%; z-index: 100;
  background: var(--color-surface-2); border: 0.5px solid var(--color-accent);
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  box-shadow: 0 8px 24px rgba(0,0,0,0.6);
  max-height: 280px; display: flex; flex-direction: column;
}
.slot-dropdown-search {
  width: 100%; padding: 8px 10px; font-size: 12px; font-family: inherit;
  background: var(--color-surface-3); color: var(--color-text);
  border: none; border-bottom: 0.5px solid var(--color-border-light);
  outline: none; border-radius: 0;
}
.slot-dropdown-search:focus { border-color: var(--color-accent); }
.slot-dropdown-list { flex: 1; overflow-y: auto; }
.slot-dropdown-item {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 10px; font-size: 12px; cursor: pointer;
  border-bottom: 0.5px solid var(--color-border-light);
}
.slot-dropdown-item:hover { background: var(--color-hover); }
.slot-dropdown-item--disabled { opacity: 0.45; cursor: not-allowed; }
.slot-dropdown-item--disabled:hover { background: transparent; }
.sdi-name { flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px; }
.sdi-notes { flex: 2; font-size: 10.5px; color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 60px; }
.sdi-price { font-size: 11px; color: var(--color-accent); font-weight: 500; flex-shrink: 0; margin-left: auto; }
.sdi-img { font-size: 13px; flex-shrink: 0; cursor: pointer; opacity: 0.7; }
.sdi-img:hover { opacity: 1; }

/* ── 下拉空状态 ── */
.slot-dropdown-empty {
  padding: 16px 10px; text-align: center; font-size: 12px;
  color: var(--color-text-tertiary);
}

/* ── OCR 搜索提示 ── */
.ocr-search-hint {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 10px; font-size: 11px; color: var(--color-accent);
  background: var(--color-accent-bg); border-bottom: 0.5px solid var(--color-border-light);
}
.ocr-search-hint strong { font-weight: 600; }
.ocr-hint-close {
  margin-left: auto; background: none; border: none; cursor: pointer;
  font-size: 11px; color: var(--color-text-tertiary); padding: 0 2px;
}
.ocr-hint-close:hover { color: var(--color-text); }
.ocr-spinner-sm {
  display: inline-block; width: 12px; height: 12px;
  border: 2px solid var(--color-surface-3);
  border-top-color: var(--color-accent); border-radius: 50%;
  animation: qa-spin 0.6s linear infinite;
}
@keyframes qa-spin { to { transform: rotate(360deg); } }

/* ── 快速录入 ── */
.slot-dropdown-quickadd {
  border-top: 0.5px solid var(--color-border-light);
  flex-shrink: 0;
}
.qa-trigger {
  padding: 8px 10px; font-size: 11.5px; color: var(--color-accent);
  cursor: pointer; text-align: center; transition: background 0.12s;
}
.qa-trigger:hover { background: var(--color-accent-bg); }
.qa-form {
  padding: 8px 10px; display: flex; flex-direction: column; gap: 6px;
}
.qa-input {
  width: 100%; padding: 5px 8px; font-size: 11.5px; font-family: inherit;
  background: var(--color-surface-3); color: var(--color-text);
  border: 0.5px solid var(--color-border); border-radius: 4px;
  outline: none;
}
.qa-input:focus { border-color: var(--color-accent); }
.qa-input--price { width: 96px; flex-shrink: 0; }
.qa-price-wrap { display: flex; align-items: center; flex-shrink: 0; }
.qa-unit { font-size: 11px; color: var(--color-text-muted); margin-left: 3px; }
.qa-row { display: flex; gap: 6px; align-items: center; }
.qa-select {
  flex: 1; padding: 5px 6px; font-size: 11.5px; font-family: inherit;
  background: var(--color-surface-3); color: var(--color-text);
  border: 0.5px solid var(--color-border); border-radius: 4px;
  outline: none;
}
.qa-select:focus { border-color: var(--color-accent); }
.qa-actions { display: flex; gap: 6px; justify-content: flex-end; }
.qa-btn-paste {
  flex-shrink: 0; width: 28px; height: 28px; padding: 0;
  font-size: 14px; line-height: 1; cursor: pointer;
  background: var(--color-surface-3); color: var(--color-text-secondary);
  border: 0.5px solid var(--color-border); border-radius: 4px;
  transition: all 0.12s;
}
.qa-btn-paste:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
.qa-btn-paste:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── 灵兽面板 ── */
.beast-tab-wrap { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
</style>
