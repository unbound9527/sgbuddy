<template>
  <div class="page">
    <!-- ══ 首屏就绪前只显示加载态：等「上次编辑的方案」解析完再决定进列表还是详情，避免先闪一下列表 ══ -->
    <div v-if="!schemesReady" class="boot-loading">
      <AppIcon icon="loader" :size="18" class="icon-spin" />
      <span>正在载入方案…</span>
    </div>

    <!-- ══ 方案列表模式：只显示方案卡片，点卡片进入详情 ══ -->
    <template v-else-if="!detailMode || !currentScheme">
      <div class="topbar">
        <div class="topbar-left">
          <h2>配号中心</h2>
          <span class="list-server" v-if="app.currentServerName" title="方案按大区隔离，只显示当前大区的方案">{{ app.currentServerName }}</span>
        </div>
      </div>

      <!-- 筛选栏：关键词 / 职业 / 等级 / 大区范围 -->
      <div class="scheme-filter">
        <div class="sf-search">
          <AppIcon icon="search" :size="13" />
          <input
            v-model="schemeFilter.keyword"
            class="sf-search-input"
            placeholder="搜索方案名 / 角色名（支持拼音）"
          />
          <button v-if="schemeFilter.keyword" class="sf-search-clear" @click="schemeFilter.keyword = ''" title="清除关键词"><AppIcon icon="x" :size="12" /></button>
        </div>

        <div class="sf-menu-wrap">
          <button class="sf-trigger" :class="{ 'sf-trigger--on': schemeFilter.jobs.length }" @click="toggleFilterMenu('job')">
            {{ filterJobLabel }} <AppIcon icon="chevron-down" :size="12" />
          </button>
          <div class="sf-menu" v-if="openFilterMenu === 'job'">
            <label v-for="j in jobOptions" :key="j" class="sf-opt">
              <input type="checkbox" :checked="schemeFilter.jobs.includes(j)" @change="toggleFilterJob(j)" /> {{ j }}
            </label>
            <div class="sf-menu-empty" v-if="jobOptions.length === 0">暂无方案</div>
          </div>
        </div>

        <div class="sf-menu-wrap">
          <button class="sf-trigger" :class="{ 'sf-trigger--on': schemeFilter.levels.length }" @click="toggleFilterMenu('level')">
            {{ filterLevelLabel }} <AppIcon icon="chevron-down" :size="12" />
          </button>
          <div class="sf-menu" v-if="openFilterMenu === 'level'">
            <label v-for="l in levelOptions" :key="l" class="sf-opt">
              <input type="checkbox" :checked="schemeFilter.levels.includes(l)" @change="toggleFilterLevel(l)" /> Lv.{{ l }}
            </label>
            <div class="sf-menu-empty" v-if="levelOptions.length === 0">暂无方案</div>
          </div>
        </div>

        <div class="sf-menu-wrap" v-if="powerOptions.length">
          <button class="sf-trigger" :class="{ 'sf-trigger--on': schemeFilter.powers.length }" @click="toggleFilterMenu('power')">
            {{ filterPowerLabel }} <AppIcon icon="chevron-down" :size="12" />
          </button>
          <div class="sf-menu sf-menu--power" v-if="openFilterMenu === 'power'">
            <label class="sf-opt sf-opt--hint">已设置战力的方案按以下档位筛选：</label>
            <label v-for="o in powerOptions" :key="o.value" class="sf-opt sf-opt--pw" :style="powerCssVarsByQuality(o.quality)">
              <input type="checkbox" :checked="schemeFilter.powers.includes(o.value)" @change="toggleFilterPower(o.value)" />
              <span class="pw-swatch" aria-hidden="true"></span>{{ o.label }}
            </label>
            <div class="sf-menu-empty" v-if="powerOptions.length === 0">暂无方案</div>
          </div>
        </div>

        <label class="sf-check" title="默认只显示当前大区的方案；取消勾选可查看其他大区的方案（灰卡，切换大区后可选）">
          <input type="checkbox" v-model="schemeFilter.onlyCurrentServer" /> 仅当前大区
        </label>

        <span class="sf-count">共 <strong>{{ listedSchemes.length }}</strong> 个</span>
        <button v-if="hasSchemeFilter" class="sf-reset" @click="resetSchemeFilter" title="恢复默认筛选">清除筛选</button>
      </div>

      <div class="scheme-list-scroll">
        <div class="scheme-card-grid">
          <div
            v-for="s in listedSchemes"
            :key="s.id"
            class="scheme-card"
            :class="{ 'scheme-card--active': currentScheme?.id === s.id, 'scheme-card--disabled': !isSchemeSelectable(s) }"
            :title="isSchemeSelectable(s) ? '' : `该方案属于「${serverNameOf(s.server_id)}」，切换大区后可选择`"
            @click="selectScheme(s)"
          >
            <div class="scc-top">
              <span class="scc-name" :title="s.name">{{ s.name }}</span>
              <span v-if="currentScheme?.id === s.id" class="scc-current">上次编辑</span>
            </div>
            <div class="scc-power" v-if="parsePower(s.power)" :style="powerCssVars(s.power)" :title="`战力：${powerDisplay(s.power)}`">
              <span class="scc-power-swatch" aria-hidden="true"></span>
              <span class="scc-power-txt">战力 {{ powerDisplay(s.power) }}</span>
            </div>
            <div class="scc-meta">
              <span class="badge badge--server" v-if="s.server_id" :title="`该方案属于大区「${serverNameOf(s.server_id)}」`"><AppIcon icon="globe" :size="10" /> {{ serverNameOf(s.server_id) }}</span>
              <span class="badge">{{ s.job }} Lv.{{ s.level_num }}</span>
              <span v-if="s.character_name" class="badge badge--char"><AppIcon icon="user" :size="10" /> {{ s.character_name }}</span>
            </div>
            <div class="scc-foot">
              <span class="scc-budget" title="方案内物品金额总和（即预算）"><AppIcon icon="coins" :size="12" /> {{ formatWan(schemeTotalWan(s)) }}</span>
              <span class="scc-actions" v-if="isSchemeSelectable(s)">
                <button class="scc-btn" title="复制方案" @click.stop="copyScheme(s)"><AppIcon icon="copy" :size="12" /></button>
                <button class="scc-btn" title="编辑方案" @click.stop="editScheme(s)"><AppIcon icon="edit" :size="12" /></button>
                <button class="scc-btn" title="删除方案" @click.stop="deleteScheme(s.id)"><AppIcon icon="x" :size="12" /></button>
              </span>
            </div>
          </div>
          <!-- 创建方案（虚卡片） -->
          <div class="scheme-card scheme-card--create" @click="openNewScheme" title="新建方案">
            <AppIcon icon="plus" :size="20" />
            <span class="scc-create-text">创建方案</span>
          </div>
        </div>
        <div class="hint" v-if="schemes.length === 0">当前大区还没有方案，点击「创建方案」开始</div>
        <div class="hint" v-else-if="listedSchemes.length === 0">
          {{ hasSchemeFilter ? '没有符合筛选条件的方案' : '当前大区还没有方案' }}
          <button v-if="hasSchemeFilter" class="sf-reset-inline" @click="resetSchemeFilter">清除筛选</button>
        </div>
      </div>
    </template>

    <!-- ══ 方案详情模式：整页展示当前方案内容 ══ -->
    <template v-else>
      <div class="topbar">
        <div class="topbar-left">
          <button class="btn btn-sm btn-back" @click="backToList" title="返回方案列表"><AppIcon icon="chevron-left" :size="14" /> 方案</button>
          <h2 class="detail-name" :title="currentScheme.name">{{ currentScheme.name }}</h2>
          <span class="badge">{{ currentScheme.job }} Lv.{{ currentScheme.level_num }}</span>
          <span v-if="currentScheme.character_name" class="badge badge--char"><AppIcon icon="user" :size="12" /> {{ currentScheme.character_name }}</span>
          <span
            v-if="parsePower(currentScheme.power)"
            class="scc-power scc-power--inline"
            :style="powerCssVars(currentScheme.power)"
            :title="`战力：${powerDisplay(currentScheme.power)}`"
          >
            <span class="scc-power-swatch" aria-hidden="true"></span>
            <span class="scc-power-txt">战力 {{ powerDisplay(currentScheme.power) }}</span>
          </span>
        </div>
        <div class="topbar-right">
          <button class="btn btn-sm" @click="exportToExcel"><AppIcon icon="download" :size="12" /> 导出 Excel</button>
        </div>
      </div>

      <!-- 进度仪表盘 -->
      <div class="dashboard">
        <div class="dash-row">
          <div class="dash-item dash-item--wide">
            <span class="dash-label" title="预算 = 方案内物品金额总和，随槽位选择自动计算"><AppIcon icon="coins" :size="14" /> 预算（物品合计）{{ (currentTotalWan / 10000).toFixed(1) }} 亿</span>
          </div>
          <div class="dash-item">
            <span class="dash-label" title="未锁定槽位金额合计（可继续调整的部分）"><AppIcon icon="unlock" :size="14" /> 可调 {{ (unlockedTotalWan / 10000).toFixed(1) }} 亿</span>
          </div>
        </div>
      </div>
    </template>

	    <!-- Tab 栏 -->
    <div class="tab-bar" v-if="detailMode && currentScheme">
      <button v-for="t in tabs" :key="t.key" class="tab" :class="{ 'tab--active': activeTab === t.key }" @click="switchTab(t.key)">
        <AppIcon :icon="t.icon" :size="14" /> {{ t.label }}
        <span class="tab-total" v-if="getTabTotal(t.key) > 0">{{ formatWan(getTabTotal(t.key)) }}</span>
      </button>
    </div>

    <!-- Tab 内容 -->
    <div class="tab-content" v-if="detailMode && currentScheme">
      <!-- 装备 -->
      <div class="slot-grid-2col" v-if="activeTab === 'equip'">
        <div v-for="g in equipGroups" :key="g.key" class="slot-section-card">
          <div class="sec-head"><AppIcon :icon="g.icon" :size="14" /> {{ g.label }}</div>
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
              <span class="sc-lock" :title="getLockTitle(s)" @click.stop="toggleLock(s)"><AppIcon :icon="isSlotLocked(s) ? 'lock' : 'unlock'" :size="14" /></span>
              <span v-if="isSlotLocked(s)" class="sc-lock-time" :title="getLockTitle(s)">{{ getLockTimeShort(s) }}</span>
              <span class="sc-label">{{ s }}</span>
              <span class="sc-val" :style="{ color: getQualityColor(getSlotQuality(s)) }">{{ getDetail(s) || '—' }}</span>
              <span v-if="getDetail(s) && catalogNotes[getDetail(s)]" class="sc-notes">{{ catalogNotes[getDetail(s)] }}</span>
              <span class="sc-price">{{ getPrice(s) }}</span>
              <span class="sc-img" v-if="getDetail(s) && slotImageExists(s)" @click.stop="openSlotImage(s)" title="查看图片"><AppIcon icon="image" :size="14" /></span>
              <span class="sc-clear" v-if="getDetail(s) && !isSlotLocked(s)" @click.stop="clearSlot(s)" title="清除"><AppIcon icon="x" :size="12" /></span>
              <span class="sc-arrow" v-if="!isSlotLocked(s)"><AppIcon icon="chevron-down" :size="12" /></span>
              <!-- 下拉面板 -->
              <div v-if="expandedSlot === s && !isSlotLocked(s)" class="slot-dropdown" @click.stop>
                <input
                  v-model="slotSearch[s]"
                  class="slot-dropdown-search"
                  :placeholder="ocrSearchBusy && ocrSearchSlot === s ? '识别中…' : '搜索物品...'"
                />
                <!-- OCR 识别反馈 -->
                <div v-if="ocrSearchSlot === s" class="ocr-search-hint">
                  <template v-if="ocrSearchBusy">
                    <span class="ocr-spinner-sm"></span> 识别中…
                  </template>
                  <template v-else>
                    <AppIcon icon="copy" :size="12" /> OCR 识别为「<strong>{{ ocrSearchText }}</strong>」
                    <button class="ocr-hint-close" @click="clearOcrHint" title="关闭"><AppIcon icon="x" :size="12" /></button>
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
                      <span class="sdi-img" v-if="optionHasImage(item)" @click.stop="viewOptionImage(item)" title="查看图片"><AppIcon icon="image" :size="14" /></span>
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
                        <button class="qa-btn-paste" @click="pasteImageToQuickAdd()" :disabled="quickAddOcrBusy" :title="quickAddOcrBusy ? '识别中…' : '粘贴图片识别（或 Ctrl+V）'"><AppIcon :icon="quickAddOcrBusy ? 'loader' : 'copy'" :size="14" :class="quickAddOcrBusy ? 'icon-spin' : ''" /></button>
                        <button class="qa-btn-paste" @click="selectImageToQuickAdd()" :disabled="quickAddOcrBusy" title="选择图片识别"><AppIcon icon="folder" :size="14" /></button>
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
                      <span v-if="slotSearch[s] && getSlotOptions(s).filter(o => !o._disabled).length === 0 && getSlotOptions(s).length > 0"><AppIcon icon="zap" :size="12" /> 未找到「{{ slotSearch[s] }}」，点击快速录入</span>
                      <span v-else><AppIcon icon="plus" :size="12" /> 快速录入新物品</span>
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
          <div class="sec-head"><AppIcon :icon="g.icon" :size="14" /> {{ g.label }}</div>
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
              <span class="sc-lock" :title="getLockTitle(s)" @click.stop="toggleLock(s)"><AppIcon :icon="isSlotLocked(s) ? 'lock' : 'unlock'" :size="14" /></span>
              <span v-if="isSlotLocked(s)" class="sc-lock-time" :title="getLockTitle(s)">{{ getLockTimeShort(s) }}</span>
              <span class="sc-label">{{ s.replace('灵','') }}</span>
              <span class="sc-val" :style="{ color: getQualityColor(getSlotQuality(s)) }">{{ getDetail(s) || '—' }}</span>
              <span v-if="getDetail(s) && catalogNotes[getDetail(s)]" class="sc-notes">{{ catalogNotes[getDetail(s)] }}</span>
              <span class="sc-price">{{ getPrice(s) }}</span>
              <span class="sc-img" v-if="getDetail(s) && slotImageExists(s)" @click.stop="openSlotImage(s)" title="查看图片"><AppIcon icon="image" :size="14" /></span>
              <span class="sc-clear" v-if="getDetail(s) && !isSlotLocked(s)" @click.stop="clearSlot(s)" title="清除"><AppIcon icon="x" :size="12" /></span>
              <span class="sc-arrow" v-if="!isSlotLocked(s)"><AppIcon icon="chevron-down" :size="12" /></span>
              <div v-if="expandedSlot === s && !isSlotLocked(s)" class="slot-dropdown" @click.stop>
                <input v-model="slotSearch[s]" class="slot-dropdown-search" :placeholder="ocrSearchBusy && ocrSearchSlot === s ? '识别中…' : '搜索物品...'" />
                <!-- OCR 识别反馈 -->
                <div v-if="ocrSearchSlot === s" class="ocr-search-hint">
                  <template v-if="ocrSearchBusy">
                    <span class="ocr-spinner-sm"></span> 识别中…
                  </template>
                  <template v-else>
                    <AppIcon icon="copy" :size="12" /> OCR 识别为「<strong>{{ ocrSearchText }}</strong>」
                    <button class="ocr-hint-close" @click="clearOcrHint" title="关闭"><AppIcon icon="x" :size="12" /></button>
                  </template>
                </div>
                <div class="slot-dropdown-list">
                  <template v-if="currentScheme">
                    <div v-for="item in getSlotOptions(s)" :key="item.name" class="slot-dropdown-item" :class="{ 'slot-dropdown-item--disabled': item._disabled }" @click="selectSlotItem(s, item)">
                      <span class="sdi-name" :style="{ color: getQualityColor(item._quality) }">{{ item.name }}</span>
                      <span v-if="item._notes" class="sdi-notes">{{ item._notes }}</span>
                      <span class="sdi-price">{{ item._price > 0 ? item._price + '万' : (item._hint || '—') }}</span>
                      <span class="sdi-img" v-if="optionHasImage(item)" @click.stop="viewOptionImage(item)" title="查看图片"><AppIcon icon="image" :size="14" /></span>
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
                        <button class="qa-btn-paste" @click="pasteImageToQuickAdd()" :disabled="quickAddOcrBusy" :title="quickAddOcrBusy ? '识别中…' : '粘贴图片识别（或 Ctrl+V）'"><AppIcon :icon="quickAddOcrBusy ? 'loader' : 'copy'" :size="14" :class="quickAddOcrBusy ? 'icon-spin' : ''" /></button>
                        <button class="qa-btn-paste" @click="selectImageToQuickAdd()" :disabled="quickAddOcrBusy" title="选择图片识别"><AppIcon icon="folder" :size="14" /></button>
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
                      <span v-if="slotSearch[s] && getSlotOptions(s).filter(o => !o._disabled).length === 0 && getSlotOptions(s).length > 0"><AppIcon icon="zap" :size="12" /> 未找到「{{ slotSearch[s] }}」，点击快速录入</span>
                      <span v-else><AppIcon icon="plus" :size="12" /> 快速录入新物品</span>
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
          <div class="sec-head"><AppIcon icon="scroll" :size="14" /> 养成系统</div>
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
              <span class="sc-lock" :title="getLockTitle(s)" @click.stop="toggleLock(s)"><AppIcon :icon="isSlotLocked(s) ? 'lock' : 'unlock'" :size="14" /></span>
              <span v-if="isSlotLocked(s)" class="sc-lock-time" :title="getLockTitle(s)">{{ getLockTimeShort(s) }}</span>
              <span class="sc-label">{{ s }}</span>
              <span class="sc-val" :style="{ color: getQualityColor(getSlotQuality(s)) }">{{ getDetail(s) || '—' }}</span>
              <span v-if="getDetail(s) && catalogNotes[getDetail(s)]" class="sc-notes">{{ catalogNotes[getDetail(s)] }}</span>
              <span class="sc-price">{{ getPrice(s) }}</span>
              <span class="sc-img" v-if="getDetail(s) && slotImageExists(s)" @click.stop="openSlotImage(s)" title="查看图片"><AppIcon icon="image" :size="14" /></span>
              <span class="sc-clear" v-if="getDetail(s) && !isSlotLocked(s)" @click.stop="clearSlot(s)" title="清除"><AppIcon icon="x" :size="12" /></span>
              <span class="sc-arrow" v-if="!isSlotLocked(s)"><AppIcon icon="chevron-down" :size="12" /></span>
              <!-- 下拉面板 -->
              <div v-if="expandedSlot === s && !isSlotLocked(s)" class="slot-dropdown" @click.stop>
                <input
                  v-model="slotSearch[s]"
                  class="slot-dropdown-search"
                  :placeholder="ocrSearchBusy && ocrSearchSlot === s ? '识别中…' : '搜索物品...'"
                />
                <!-- OCR 识别反馈 -->
                <div v-if="ocrSearchSlot === s" class="ocr-search-hint">
                  <template v-if="ocrSearchBusy">
                    <span class="ocr-spinner-sm"></span> 识别中…
                  </template>
                  <template v-else>
                    <AppIcon icon="copy" :size="12" /> OCR 识别为「<strong>{{ ocrSearchText }}</strong>」
                    <button class="ocr-hint-close" @click="clearOcrHint" title="关闭"><AppIcon icon="x" :size="12" /></button>
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
                      <span class="sdi-img" v-if="optionHasImage(item)" @click.stop="viewOptionImage(item)" title="查看图片"><AppIcon icon="image" :size="14" /></span>
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
                        <button class="qa-btn-paste" @click="pasteImageToQuickAdd()" :disabled="quickAddOcrBusy" :title="quickAddOcrBusy ? '识别中…' : '粘贴图片识别（或 Ctrl+V）'"><AppIcon :icon="quickAddOcrBusy ? 'loader' : 'copy'" :size="14" :class="quickAddOcrBusy ? 'icon-spin' : ''" /></button>
                        <button class="qa-btn-paste" @click="selectImageToQuickAdd()" :disabled="quickAddOcrBusy" title="选择图片识别"><AppIcon icon="folder" :size="14" /></button>
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
                      <span v-if="slotSearch[s] && getSlotOptions(s).filter(o => !o._disabled).length === 0 && getSlotOptions(s).length > 0"><AppIcon icon="zap" :size="12" /> 未找到「{{ slotSearch[s] }}」，点击快速录入</span>
                      <span v-else><AppIcon icon="plus" :size="12" /> 快速录入新物品</span>
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
	    <div class="scheme-notes" v-if="detailMode && currentScheme">
	      <span class="sn-label"><AppIcon icon="edit" :size="14" /></span>
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
        <div class="modal-head"><h4>{{ editingScheme ? '编辑方案' : '新建方案' }}</h4><button class="btn-icon" @click="showForm = false"><AppIcon icon="x" :size="16" /></button></div>
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
          <!-- 战力（可选）：阶 × 品质（下拉选择） -->
          <div class="form-row">
            <label class="form-label">战力<span class="form-opt-hint">可选</span></label>
            <div class="pw-dropdown-wrap" ref="pwDropdownRef">
              <button
                type="button"
                class="pw-trigger input"
                :class="{ 'pw-trigger--set': !!form.power }"
                :style="form.power ? powerCssVars(form.power) : {}"
                @click="togglePowerMenu"
              >
                <template v-if="form.power">
                  <span class="scc-power-swatch" aria-hidden="true"></span>
                  <span>战力 {{ powerDisplay(form.power) }}</span>
                </template>
                <template v-else><span class="pw-placeholder">未设置</span></template>
                <AppIcon icon="chevron-down" :size="12" class="pw-trigger-arrow" />
              </button>
              <div class="pw-menu" :class="{ 'pw-menu--up': pwMenuUp }" :style="{ maxHeight: pwMenuMaxH + 'px' }" v-if="pwMenuOpen" @click.stop>
                <button type="button" class="pw-menu-none" :class="{ 'pw-menu-item--active': !form.power }" @click="pickPower('')">
                  <span class="pw-swatch" aria-hidden="true"></span>未设置战力
                </button>
                <div class="pw-menu-divider"></div>
                <div class="pw-menu-opts">
                  <button
                    v-for="opt in POWER_COMBOS"
                    :key="opt.value"
                    type="button"
                    class="pw-menu-item"
                    :class="{ 'pw-menu-item--active': form.power === opt.value }"
                    :style="powerCssVarsByQuality(opt.quality)"
                    @click="pickPower(opt.value)"
                  >
                    <span class="pw-swatch" aria-hidden="true"></span>{{ opt.label }}
                  </button>
                </div>
              </div>
            </div>
          </div>
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
import { getQualityColor } from '@/utils/quality'
import { appConfirm } from '@/utils/confirm'
import BeastPanel from '@/components/beast/BeastPanel.vue'
import ShenyuanPanel from '@/components/shenyuan/ShenyuanPanel.vue'
import ImageViewer from '@/components/ImageViewer.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const app = useAppStore()

const EQUIP_SLOTS = ['武器', '头盔', '上装', '下装', '护手', '鞋子', '面具', '项链', '戒指']
const SPIRIT_SLOTS = ['武器灵', '护手灵', '头盔灵', '上装灵', '下装灵', '鞋子灵', '面具灵', '翅膀灵', '符咒灵', '项链灵', '戒指灵']
const OTHER_SLOTS = ['八阵图', '子女', '奥义', '灵珠', '羽灵']
// 养成槽位随等级变化（灵珠/羽灵 120 级解锁），按方案等级取当前可见的养成槽位
function cultivateSlotsFor(level: number): string[] {
  if (level < 120) return OTHER_SLOTS.filter(s => s !== '灵珠' && s !== '羽灵')
  return [...OTHER_SLOTS]
}
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
  { key: 'atk', icon: 'swords', label: '攻击灵魄', slots: attackSpirits },
  { key: 'def', icon: 'shield', label: '防御灵魄', slots: defenseSpirits },
  { key: 'jwl', icon: 'gem', label: '首饰灵魄', slots: jewelrySpirits },
  { key: 'wing', icon: 'bird', label: '翅膀&符咒灵魄', slots: wingSpirits },
]

interface SlotPriceEntry { i: number; p: number; n: string; q: string }
interface Scheme { id: number; name: string; job: string; level_num: number; total_budget: number; details: Record<string,string>; slot_price_ids?: Record<string, number | SlotPriceEntry>; character_name?: string; notes?: string; server_id?: number | null; power?: string }

const schemes = ref<Scheme[]>([])
const currentScheme = ref<Scheme | null>(null)
const selectedSchemeId = ref(-1)
// 页面模式：false = 方案卡片列表；true = 某个方案的详情（整页展示仪表盘/槽位/备注）
const detailMode = ref(false)
const showForm = ref(false)
const editingScheme = ref<Scheme | null>(null)
const form = reactive({ name: '', job: '剑侍', level_num: 100, character_name: '', power: '' })
// 战力下拉菜单状态
const pwMenuOpen = ref(false)
// 面板打开方向：true=向上展开（触发按钮靠近视口底部、下方放不下时）；false=向下（默认）
const pwMenuUp = ref(false)
// 面板实际可用纵向高度上限（px，按打开侧视口剩余空间动态取；避免超高被视口截断）
const pwMenuMaxH = ref(248)
const pwDropdownRef = ref<HTMLElement | null>(null)
const jobs = ['剑侍', '豪杰', '阴阳士', '仙术士', '游侠', '唤灵']
const levelNums = [70,80,90,100,110,120,130,140,150]

// ── 战力（可选）：阶(一~五) × 品质(绿蓝紫金) ──
// power 存储为短码如 "1金" / "3蓝"，空串 = 未设置
const POWER_TIER_NUMS = [1, 2, 3, 4, 5]
const POWER_TIER_CN = ['一', '二', '三', '四', '五']
const POWER_QUALITIES = ['绿', '蓝', '紫', '金']
// 品质 → 徽标文字/块颜色（沿用项目品质配色，金用专用金色，与图鉴白/黄区分）
const POWER_QUALITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '绿': { bg: 'rgba(76,175,80,0.12)', text: '#3d9a44', border: 'rgba(76,175,80,0.4)' },
  '蓝': { bg: 'rgba(66,165,245,0.12)', text: '#2f8fe0', border: 'rgba(66,165,245,0.4)' },
  '紫': { bg: 'rgba(171,71,188,0.12)', text: '#a34ab5', border: 'rgba(171,71,188,0.4)' },
  '金': { bg: 'rgba(227,173,52,0.14)', text: '#c9971f', border: 'rgba(227,173,52,0.5)' },
}
// 品质中文颜色字符（卡内彩色方块填充用）
const POWER_QUALITY_FILL: Record<string, string> = {
  '绿': '#4CAF50', '蓝': '#42A5F5', '紫': '#AB47BC', '金': '#e3ad34',
}
// 下拉面板的全部可选项：按阶→品质展开，每项自带完整文字（如「一阶·金」）
const POWER_COMBOS = POWER_TIER_NUMS.flatMap(t =>
  POWER_QUALITIES.map(q => ({
    value: `${t}${q}`,
    quality: q,
    label: `${POWER_TIER_CN[t - 1]}阶·${q}`,
  }))
)
/** 解析 power 短码 → { tier(1-5), quality }，非法/空返回 null */
function parsePower(power?: string | null): { tier: number; quality: string } | null {
  if (!power) return null
  const m = String(power).trim().match(/^([1-5])([绿蓝紫金])$/)
  return m ? { tier: Number(m[1]), quality: m[2] } : null
}
/** 按品质字符返回 CSS 变量（供战力选择按钮使用），非法返回 {} */
function powerCssVarsByQuality(q: string): Record<string, string> {
  const c = POWER_QUALITY_COLORS[q]
  if (!c) return {}
  return { '--pw-bg': c.bg, '--pw-color': c.text, '--pw-border': c.border, '--pw-fill': POWER_QUALITY_FILL[q] }
}
/** 返回战力徽标的 CSS 变量（颜色随品质），未设置返回 {} */
function powerCssVars(power?: string | null): Record<string, string> {
  const p = parsePower(power)
  if (!p) return {}
  const c = POWER_QUALITY_COLORS[p.quality]
  return {
    '--pw-bg': c.bg,
    '--pw-color': c.text,
    '--pw-border': c.border,
    '--pw-fill': POWER_QUALITY_FILL[p.quality],
  }
}
/** 战力徽标显示文本："一阶·金" / "三阶·蓝"；未设置返回 '' */
function powerDisplay(power?: string | null): string {
  const p = parsePower(power)
  if (!p) return ''
  return `${POWER_TIER_CN[p.tier - 1]}阶·${p.quality}`
}
/** 下拉选择战力并收起菜单（空串=未设置） */
function pickPower(power: string) {
  form.power = power
  pwMenuOpen.value = false
}
/** 打开/收起战力菜单：打开时按触发按钮距视口底部的剩余空间决定展开方向与高度上限（避免面板超出屏幕） */
function togglePowerMenu() {
  if (pwMenuOpen.value) {
    pwMenuOpen.value = false
    return
  }
  pwMenuUp.value = false
  pwMenuMaxH.value = 248
  const trig = pwDropdownRef.value?.querySelector<HTMLElement>('.pw-trigger')
  if (trig) {
    const rect = trig.getBoundingClientRect()
    const maxH = 248 // 面板自然最大高度
    const spaceBelow = window.innerHeight - rect.bottom - 8
    if (spaceBelow >= maxH) {
      // 下方足够，向下展开
      pwMenuMaxH.value = maxH
    } else {
      // 下方放不下：优先向上，若上方也不够则取剩余空间较大的一侧；高度上限 = 该侧空间
      const spaceAbove = rect.top - 8
      pwMenuUp.value = spaceAbove >= spaceBelow
      pwMenuMaxH.value = Math.max(120, Math.min(maxH, pwMenuUp.value ? spaceAbove : spaceBelow))
    }
  }
  pwMenuOpen.value = true
}

// Tab 切换
const activeTab = ref('equip')
function switchTab(key: string) {
  activeTab.value = key
}
const tabs = [
  { key: 'equip', label: '装备', icon: 'swords' },
  { key: 'spirit', label: '灵魄', icon: 'shield' },
  { key: 'shenyuan', label: '元神', icon: 'star' },
  { key: 'cultivate', label: '养成', icon: 'scroll' },
  { key: 'pet', label: '灵兽', icon: 'ghost' },
]

const equipGroups = [
  { key: 'atk', icon: 'swords', label: '攻击装备', slots: ['武器', '护手', '上装'] },
  { key: 'def', icon: 'shield', label: '防御装备', slots: ['头盔', '面具', '下装', '鞋子'] },
  { key: 'jwl', icon: 'gem', label: '首饰装备', slots: ['项链', '戒指'] },
  { key: 'wing', icon: 'bird', label: '翅膀 & 符咒', slots: ['翅膀', '符咒'] },
]

const filteredCultivateSlots = computed(() => cultivateSlotsFor(currentScheme.value?.level_num ?? 0))

// 槽位是否属于当前界面存在的卡槽。
// 数据与 UI 可能不同步（旧版本存在的槽位后来被移除/改名，如早期养成页签的普通「灵兽」卡），
// 这类孤立 key 界面上看不到也上不了锁，其金额一律不计入总价/可调，避免统计被脏数据虚高。
function isVisibleSlot(slot: string, scheme?: Scheme | null): boolean {
  if (slot.startsWith('灵兽:') || slot.startsWith('元神:')) return true
  const s = scheme ?? currentScheme.value
  const cultivates = cultivateSlotsFor(s?.level_num ?? 0)
  return [...EQUIP_SLOTS, '翅膀', '符咒', ...SPIRIT_SLOTS, ...cultivates, ...SHENYUAN_SLOTS].includes(slot)
}

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

// ── 品质颜色映射（共用工具，见 src/utils/quality.ts） ──

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
      // 刷新图片集合，让图片按钮即时出现
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

// 方案物品金额总和（万三国币）= 预算（自动计算，不再手动填写）
// 优先累计 slot_price_ids 中冻结的价格；兼容旧方案（无 slot_price_ids）：回退到 catalogPrices
function schemeTotalWan(s: Scheme): number {
  const sidMap = s.slot_price_ids || {}
  let total = 0
  for (const [slot, val] of Object.entries(sidMap)) {
    if (!val || !(typeof val === 'object' && 'i' in val)) continue
    // 孤立槽位（界面已无对应卡槽）不参与统计
    if (!isVisibleSlot(slot, s)) continue
    total += (val as SlotPriceEntry).p
  }
  if (total === 0) {
    const details = s.details || {}
    for (const name of Object.values(details)) {
      if (name && catalogPrices.value[name]) {
        total += catalogPrices.value[name]
      }
    }
  }
  return total
}

const currentTotalWan = computed(() => (currentScheme.value ? schemeTotalWan(currentScheme.value) : 0))

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
// 未锁定槽位金额汇总（锁定=已确定不动的装备，未锁定=还可调整的预算空间）
const unlockedTotalWan = computed(() => {
  if (!currentScheme.value) return 0
  const sidMap = currentScheme.value.slot_price_ids || {}
  let total = 0
  for (const [slot, val] of Object.entries(sidMap)) {
    if (!val || !(typeof val === 'object' && 'i' in val)) continue
    // 孤立槽位无法上锁，不应计入「可调」
    if (!isVisibleSlot(slot)) continue
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
  const target = e.target as HTMLElement
  if (openFilterMenu.value && !target.closest('.sf-menu-wrap')) {
    closeFilterMenu()
  }
  if (pwMenuOpen.value && pwDropdownRef.value && !pwDropdownRef.value.contains(target)) {
    pwMenuOpen.value = false
  }
  if (expandedSlot.value) {
    if (!target.closest('.slot-dropdown') && !target.closest('.slot-card--open')) {
      closeDropdown()
    }
  }
}

// ESC 关闭下拉（优先关最上层的菜单）
function handleKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (openFilterMenu.value) {
    closeFilterMenu()
  } else if (pwMenuOpen.value) {
    pwMenuOpen.value = false
  } else if (expandedSlot.value) {
    closeDropdown()
  }
}

function serverNameOf(id?: number | null): string {
  if (!id) return '未分配'
  return app.servers.find(s => s.id === id)?.name || '未知大区'
}

function isSchemeSelectable(s: Scheme): boolean {
  const sid = app.currentServerId
  if (!sid) return false
  return s.server_id === sid
}

// ── 方案列表筛选 ──
const SCHEME_FILTER_KEY = 'sgbuddy-scheme-filter'
const schemeFilter = reactive({
  keyword: '',
  jobs: [] as string[],
  levels: [] as number[],
  powers: [] as string[],
  onlyCurrentServer: true,
})
const openFilterMenu = ref<'' | 'job' | 'level' | 'power'>('')

// 只列出真实存在的职业/等级，避免提供点不出结果的空选项
const jobOptions = computed(() => {
  const set = new Set<string>()
  for (const s of schemes.value) if (s.job) set.add(s.job)
  return jobs.filter(j => set.has(j))
})
const levelOptions = computed(() => {
  const set = new Set<number>()
  for (const s of schemes.value) if (s.level_num) set.add(s.level_num)
  return [...set].sort((a, b) => a - b)
})
// 已设置战力的档位选项（仅真实存在的组合，按 阶→品质 顺序）
const powerOptions = computed(() => {
  const present = new Set<string>()
  for (const s of schemes.value) {
    const p = parsePower(s.power)
    if (p) present.add(`${p.tier}${p.quality}`)
  }
  return POWER_COMBOS.filter(o => present.has(o.value))
})

// 「仅当前大区」是默认状态，关掉它才算一条筛选条件
const hasSchemeFilter = computed(() =>
  !!schemeFilter.keyword.trim() ||
  schemeFilter.jobs.length > 0 ||
  schemeFilter.levels.length > 0 ||
  schemeFilter.powers.length > 0 ||
  !schemeFilter.onlyCurrentServer
)
const filterJobLabel = computed(() => (schemeFilter.jobs.length ? `职业 ${schemeFilter.jobs.length}` : '全部职业'))
const filterLevelLabel = computed(() => (schemeFilter.levels.length ? `等级 ${schemeFilter.levels.length}` : '全部等级'))
const filterPowerLabel = computed(() => (schemeFilter.powers.length ? `战力 ${schemeFilter.powers.length}` : '全部战力'))

function toggleFilterMenu(m: 'job' | 'level' | 'power') {
  openFilterMenu.value = openFilterMenu.value === m ? '' : m
}
function closeFilterMenu() { openFilterMenu.value = '' }

function toggleFilterJob(j: string) {
  const i = schemeFilter.jobs.indexOf(j)
  if (i >= 0) schemeFilter.jobs.splice(i, 1)
  else schemeFilter.jobs.push(j)
}
function toggleFilterLevel(l: number) {
  const i = schemeFilter.levels.indexOf(l)
  if (i >= 0) schemeFilter.levels.splice(i, 1)
  else schemeFilter.levels.push(l)
}
function toggleFilterPower(v: string) {
  const i = schemeFilter.powers.indexOf(v)
  if (i >= 0) schemeFilter.powers.splice(i, 1)
  else schemeFilter.powers.push(v)
}

/** 关键词匹配：中文子串 / 全拼 / 拼音首字母，命中方案名或角色名任一即可 */
function matchSchemeKeyword(s: Scheme, kw: string): boolean {
  const q = kw.trim().toLowerCase()
  if (!q) return true
  const targets = [s.name, s.character_name || ''].filter(Boolean)
  return targets.some(t =>
    t.toLowerCase().includes(q) || toFullPinyin(t).includes(q) || toPinyinInitials(t).includes(q)
  )
}

const listedSchemes = computed(() => {
  const sid = app.currentServerId
  const rows = schemes.value.filter(s => {
    if (schemeFilter.onlyCurrentServer && s.server_id !== sid) return false
    if (schemeFilter.jobs.length && !schemeFilter.jobs.includes(s.job)) return false
    if (schemeFilter.levels.length && !schemeFilter.levels.includes(s.level_num)) return false
    if (schemeFilter.powers.length) {
      const p = parsePower(s.power)
      if (!p || !schemeFilter.powers.includes(`${p.tier}${p.quality}`)) return false
    }
    if (!matchSchemeKeyword(s, schemeFilter.keyword)) return false
    return true
  })
  // 当前大区优先，其余大区排在后面（灰卡，切换大区后可选）
  return [
    ...rows.filter(s => s.server_id === sid),
    ...rows.filter(s => s.server_id !== sid),
  ]
})

function resetSchemeFilter() {
  schemeFilter.keyword = ''
  schemeFilter.jobs = []
  schemeFilter.levels = []
  schemeFilter.powers = []
  schemeFilter.onlyCurrentServer = true
  closeFilterMenu()
}

// 筛选条件本地持久化，重开应用保留上次的查看口径
function loadSchemeFilter() {
  try {
    const raw = localStorage.getItem(SCHEME_FILTER_KEY)
    if (!raw) return
    const v = JSON.parse(raw)
    if (typeof v?.keyword === 'string') schemeFilter.keyword = v.keyword
    if (Array.isArray(v?.jobs)) schemeFilter.jobs = v.jobs.filter((x: unknown) => typeof x === 'string')
    if (Array.isArray(v?.levels)) schemeFilter.levels = v.levels.filter((x: unknown) => typeof x === 'number')
    if (Array.isArray(v?.powers)) schemeFilter.powers = v.powers.filter((x: unknown) => typeof x === 'string' && /^[1-5][绿蓝紫金]$/.test(x))
    if (typeof v?.onlyCurrentServer === 'boolean') schemeFilter.onlyCurrentServer = v.onlyCurrentServer
  } catch { /* 本地筛选配置损坏则退回默认值 */ }
}
watch(schemeFilter, v => {
  try { localStorage.setItem(SCHEME_FILTER_KEY, JSON.stringify(v)) } catch { /* 忽略写入失败 */ }
}, { deep: true })

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
  detailMode.value = false
}

// 详情页返回方案列表（保留 currentScheme 以维持「上次编辑」标记与恢复现场）
function backToList() {
  detailMode.value = false
}

async function applySchemeForServer(serverId: number) {
  const lastId = readLastSchemeId(serverId)
  const s = lastId > 0 ? schemes.value.find(x => x.id === lastId && x.server_id === serverId) : undefined
  if (s) await selectScheme(s)
  else clearCurrentScheme()
}

async function selectScheme(s: Scheme) {
  if (!isSchemeSelectable(s)) return
  currentScheme.value = s
  selectedSchemeId.value = s.id
  detailMode.value = true  // 点卡片 → 整页切换到方案详情
  rememberScheme(s)
  loadLockedSlots(s.id)
  await cleanupLegacyShenyuanKeys()
  // 迁移旧格式（纯数字 id）→ 新格式（{i,p,n,q}）
  await migrateSlotPrices()
  // 兼容更早期数据：details 有物品但 slot_price_ids 缺失的槽位，按物品名回查图鉴补齐
  await backfillMissingSlotPrices()
  syncCatalogFromSlotPrices()
}

// details 里配了物品但 slot_price_ids 缺记录的槽位（早期版本未持久化价格），按物品名回查图鉴补齐。
// 不补齐会导致依赖 slot_price_ids 的功能（养成宝典快照、金额汇总）取不到价格，只有配号中心自身因有名称兜底能显示。
async function backfillMissingSlotPrices() {
  const scheme = currentScheme.value
  if (!scheme) return
  const details = scheme.details || {}
  const sidMap = { ...(scheme.slot_price_ids || {}) }
  const missing: string[] = []
  for (const [slot, name] of Object.entries(details)) {
    if (!(name || '').trim()) continue
    const v = sidMap[slot]
    const ok = typeof v === 'number' ? v > 0 : !!v && typeof v === 'object' && 'i' in (v as object)
    if (ok) continue
    missing.push(slot)
  }
  if (!missing.length) return
  const names = [...new Set(missing.map(s => (details[s] || '').trim()))]
  try {
    const placeholders = names.map(() => '?').join(',')
    const rows = await window.electronAPI.dbQuery(
      `SELECT id, item_name, market_price, quality, TRIM(COALESCE(attrs,'') || ' ' || COALESCE(attr_notes,'') || ' ' || COALESCE(craft_level,'')) as notes FROM price_params WHERE item_name IN (${placeholders}) AND server_id = ? ORDER BY market_price ASC`,
      [...names, app.currentServerId]
    ) as Array<{ id: number; item_name: string; market_price: number; quality: string; notes: string }>
    // 同名多条时取最便宜的一条（与槽位下拉默认排序一致）
    const byName = new Map<string, { id: number; market_price: number; quality: string; notes: string }>()
    for (const r of rows) if (!byName.has(r.item_name)) byName.set(r.item_name, r)
    let changed = false
    for (const slot of missing) {
      const r = byName.get((details[slot] || '').trim())
      if (!r) continue
      sidMap[slot] = { i: r.id, p: Math.round((r.market_price || 0) * 10000), n: r.notes || '', q: r.quality || '' }
      changed = true
    }
    if (!changed) return
    scheme.slot_price_ids = sidMap
    await window.electronAPI.dbQuery(
      `UPDATE gear_schemes SET slot_price_ids=? WHERE id=?`,
      [JSON.stringify(sidMap), scheme.id]
    )
  } catch (e) { console.warn('[配号中心] backfillMissingSlotPrices 失败:', e) }
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
  form.name = ''; form.character_name = ''; form.job = '剑侍'; form.level_num = 100; form.power = ''
  pwMenuOpen.value = false; pwMenuUp.value = false; pwMenuMaxH.value = 248
  showForm.value = true
}
function editScheme(s: Scheme) {
  editingScheme.value = s
  form.name = s.name; form.character_name = s.character_name || ''; form.job = s.job || '剑侍'; form.level_num = s.level_num || 100; form.power = s.power || ''
  pwMenuOpen.value = false; pwMenuUp.value = false; pwMenuMaxH.value = 248
  showForm.value = true
}
async function saveScheme() {
  if (!form.name) return
  try {
    if (editingScheme.value) {
      // 预算不再手动填写：以方案内物品金额总和为准（万 → 亿），随保存同步到 total_budget 字段
      const derivedBudgetYi = Number((schemeTotalWan(editingScheme.value) / 10000).toFixed(4))
      await window.electronAPI.dbQuery(
        `UPDATE gear_schemes SET name=?,character_name=?,job=?,level_num=?,total_budget=?,power=?,updated_at=datetime('now','localtime') WHERE id=?`,
        [form.name, form.character_name, form.job, form.level_num, derivedBudgetYi, form.power, editingScheme.value.id])
      app.bumpSchemeDataVersion()
      showForm.value = false; await loadSchemes()
      const updated = schemes.value.find(s => s.id === editingScheme.value!.id)
      if (updated) {
        // 编辑入口在方案列表卡片上 → 保存后停留列表，不跳详情；仅把编辑对象记为「上次编辑」
        currentScheme.value = updated
        selectedSchemeId.value = updated.id
        detailMode.value = false
        rememberScheme(updated)
      }
    } else {
      const sid = app.currentServerId
      if (!sid) { alert('请先选择大区'); return }
      await window.electronAPI.dbQuery(
        `INSERT INTO gear_schemes (name,character_name,job,level_num,total_budget,details,power,server_id,updated_at) VALUES (?,?,?,?,?,'{}',?,?,datetime('now','localtime'))`,
        [form.name, form.character_name, form.job, form.level_num, 0, form.power, sid])
      app.bumpSchemeDataVersion()
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
  if (!(await appConfirm({ title: '删除方案', message: `确定删除方案「${scheme?.name || '未命名'}」？此操作不可撤销。`, confirmText: '删除', danger: true }))) return
  const serverId = scheme?.server_id
  await window.electronAPI.dbQuery('DELETE FROM gear_schemes WHERE id=?', [id])
  app.bumpSchemeDataVersion()
  if (currentScheme.value?.id === id) {
    clearCurrentScheme()
    if (serverId) localStorage.removeItem(lastSchemeStorageKey(serverId))
  }
  await loadSchemes()
}
async function copyScheme(s?: Scheme) {
  const src = s || currentScheme.value
  if (!src) return
  try {
    const sid = src.server_id || app.currentServerId
    if (!sid) { alert('请先选择大区'); return }
    const newName = (src.name || '未命名') + ' (副本)'
    await window.electronAPI.dbQuery(
      `INSERT INTO gear_schemes (name,character_name,job,level_num,total_budget,details,slot_price_ids,notes,power,server_id,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now','localtime'))`,
      [newName, src.character_name, src.job, src.level_num, Number((schemeTotalWan(src) / 10000).toFixed(4)), JSON.stringify(src.details || {}), JSON.stringify(src.slot_price_ids || {}), src.notes || '', src.power || '', sid]
    )
    app.bumpSchemeDataVersion()
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
  loadSchemeFilter()
  document.addEventListener('click', handleClickOutside); document.addEventListener('keydown', handleKeydown); document.addEventListener('paste', onSlotSearchPaste)
  try {
    // loadReferenceData（4 次查询，只写 slotRefMap/equipMetaMap）与 loadServers（只写 store 大区）
    // 互不依赖，并行省掉一轮串行等待。
    await Promise.all([loadReferenceData(), app.loadServers()])
    // 必须在 loadServers 之后：migrate 要用 currentServerId
    await migrateNullServerIds()
    // 必须在 migrate 之后：把补写上的 server_id 读回来。
    // 原先在链首还多调了一次 loadSchemes —— 它与上面两步都无依赖，属冗余（等于全表行 JSON.parse 两遍），已去掉。
    await loadSchemes()
    refreshImageSet()
    // 关键：先解析「上次编辑的方案」，再放行首屏渲染。
    // selectScheme 内部是同步置好 currentScheme / detailMode 后才 await 后续迁移，
    // 所以 schemesReady 置 true 的那一帧直接就是详情页，不会再先渲染一次列表。
    if (app.currentServerId) await applySchemeForServer(app.currentServerId)
  } finally {
    // 放在 finally 里：加载链任何一步抛错也要放行，避免整页卡在加载态
    schemesReady.value = true
  }
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
      name: s.name, job: s.job, level_num: s.level_num, total_budget: Number((schemeTotalWan(s) / 10000).toFixed(4)),
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
.topbar-left h2 { font-size:var(--text-lg); font-weight:650; letter-spacing:-0.01em; margin:0; }
.topbar-center { display:flex; align-items:center; gap:8px; flex:1; }
.topbar-right { display:flex; align-items:center; gap:6px; }
/* ── 方案列表模式 ── */
.scheme-list-scroll { flex:1; overflow-y:auto; padding:2px 2px 24px; }
.scheme-card-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:12px; }
.scheme-card { display:flex; flex-direction:column; gap:8px; padding:14px 16px; min-height:104px; min-width:0; background:var(--color-surface-1); border:1px solid var(--color-border-light); border-radius:var(--radius-md); box-shadow:var(--shadow-card); cursor:pointer; transition:border-color 0.12s, transform 0.12s; }
.scheme-card:hover { border-color:var(--color-accent-ring); transform:translateY(-1px); }
.scheme-card--active { border-color:var(--color-accent); background:var(--color-accent-bg); }
.scheme-card--disabled { opacity:0.55; cursor:not-allowed; }
.scheme-card--disabled:hover { transform:none; border-color:var(--color-border-light); }
.scc-top { display:flex; align-items:center; gap:6px; min-width:0; }
.scc-name { flex:1; min-width:0; font-size:var(--text-md); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.scc-current { flex-shrink:0; font-size:var(--text-micro); font-weight:600; color:var(--color-accent); }

/* ── 战力徽标（配色随品质，卡片上突出强调）── */
.scc-power {
  display:inline-flex; align-items:center; gap:6px; align-self:flex-start;
  padding:3px 10px 3px 8px; border-radius:999px;
  background:var(--pw-bg, var(--color-surface-2)); border:1px solid var(--pw-border, var(--color-border));
  font-size:var(--text-xs); font-weight:600; color:var(--pw-color, var(--color-text-secondary));
  line-height:1; width:max-content; letter-spacing:0.01em;
}
.scc-power-swatch { width:9px; height:9px; border-radius:2px; background:var(--pw-fill, #888); box-shadow:0 0 0 1px rgba(255,255,255,0.4) inset; }
.scc-power-txt { white-space:nowrap; }
/* 详情页顶栏内的内联战力徽标（右侧操作钮前不换行） */
.scc-power--inline { align-self:center; font-size:var(--text-micro); padding:3px 9px 3px 7px; }
.scc-power--inline .scc-power-swatch { width:8px; height:8px; }
.scc-meta { display:flex; flex-wrap:wrap; gap:4px; }
.scc-foot { display:flex; align-items:center; justify-content:space-between; gap:6px; margin-top:auto; min-height:22px; }
.scc-budget { display:flex; align-items:center; gap:4px; font-size:var(--text-sm); font-weight:600; color:var(--color-accent); white-space:nowrap; }
.scc-actions { display:flex; gap:2px; opacity:0; transition:opacity 0.12s; }
.scheme-card:hover .scc-actions, .scheme-card--active .scc-actions { opacity:1; }
.scc-btn { display:flex; align-items:center; border:none; background:transparent; color:var(--color-text-tertiary); cursor:pointer; padding:3px; border-radius:4px; }
.scc-btn:hover { background:var(--color-hover); color:var(--color-text); }
.scheme-card--create { align-items:center; justify-content:center; gap:4px; min-height:104px; border-style:dashed; border-color:var(--color-border); background:transparent; box-shadow:none; color:var(--color-text-tertiary); }
.scheme-card--create:hover { border-color:var(--color-accent); color:var(--color-accent); background:var(--color-accent-bg); transform:translateY(-1px); }
.scc-create-text { font-size:var(--text-sm); font-weight:550; }
.list-server { font-size:var(--text-xs); color:var(--color-text-tertiary); background:var(--color-surface-2); padding:2px 10px; border-radius:10px; }

/* ── 方案列表筛选栏 ── */
.scheme-filter { display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:12px 0 10px; flex-shrink:0; }
.sf-search { display:flex; align-items:center; gap:6px; width:240px; height:28px; padding:0 8px; background:var(--color-surface-1); border:1px solid var(--color-border-light); border-radius:var(--radius-sm); color:var(--color-text-tertiary); }
.sf-search:focus-within { border-color:var(--color-accent-ring); }
.sf-search-input { flex:1; min-width:0; border:none; background:transparent; outline:none; font-family:inherit; font-size:var(--text-xs); color:var(--color-text); }
.sf-search-input::placeholder { color:var(--color-text-tertiary); }
.sf-search-clear { display:flex; align-items:center; flex-shrink:0; border:none; background:transparent; color:var(--color-text-tertiary); cursor:pointer; padding:2px; border-radius:4px; }
.sf-search-clear:hover { background:var(--color-hover); color:var(--color-text); }

.sf-menu-wrap { position:relative; }
.sf-trigger { display:flex; align-items:center; gap:4px; height:28px; padding:0 10px; font-family:inherit; font-size:var(--text-xs); color:var(--color-text-secondary); background:var(--color-surface-1); border:1px solid var(--color-border-light); border-radius:var(--radius-sm); cursor:pointer; white-space:nowrap; }
.sf-trigger:hover { background:var(--color-surface-2); border-color:var(--color-border); }
.sf-trigger--on { color:var(--color-accent); background:var(--color-accent-bg); border-color:var(--color-accent-ring); }
.sf-menu { position:absolute; top:calc(100% + 4px); left:0; z-index:60; min-width:136px; padding:4px; background:var(--glass-bg); border:1px solid var(--glass-border); border-radius:var(--radius-sm); box-shadow:var(--shadow-pop); backdrop-filter:blur(20px) saturate(1.4); animation:modal-in 0.14s ease-out; }
.sf-opt { display:flex; align-items:center; gap:6px; padding:5px 8px; border-radius:4px; font-size:var(--text-xs); color:var(--color-text-secondary); cursor:pointer; white-space:nowrap; }
.sf-opt:hover { background:var(--color-hover); color:var(--color-text); }
.sf-opt input { margin:0; cursor:pointer; accent-color:var(--color-accent); }
.sf-menu-empty { padding:6px 8px; font-size:var(--text-micro); color:var(--color-text-tertiary); }
.sf-menu--power { min-width:190px; max-height:280px; overflow-y:auto; }
.sf-opt--hint { cursor:default; color:var(--color-text-tertiary); font-size:var(--text-micro); }
.sf-opt--pw .pw-swatch { margin:0 2px 0 0; }

.sf-check { display:flex; align-items:center; gap:5px; font-size:var(--text-xs); color:var(--color-text-secondary); cursor:pointer; white-space:nowrap; user-select:none; }
.sf-check input { margin:0; cursor:pointer; accent-color:var(--color-accent); }
.sf-count { font-size:var(--text-xs); color:var(--color-text-tertiary); }
.sf-count strong { font-weight:600; color:var(--color-text-secondary); }
.sf-reset { border:none; background:transparent; color:var(--color-accent); font-family:inherit; font-size:var(--text-xs); cursor:pointer; padding:3px 6px; border-radius:4px; }
.sf-reset:hover { background:var(--color-accent-bg); }
.sf-reset-inline { display:block; margin:10px auto 0; padding:4px 14px; border:none; border-radius:var(--radius-sm); background:var(--color-accent-bg); color:var(--color-accent); font-family:inherit; font-size:var(--text-xs); cursor:pointer; }

/* ── 方案详情模式顶栏 ── */
.btn-back { display:flex; align-items:center; gap:2px; background:var(--color-surface-2); color:var(--color-text-secondary); }
.btn-back:hover { background:var(--color-hover); color:var(--color-text); }
.detail-name { font-size:var(--text-lg); font-weight:650; letter-spacing:-0.01em; margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:360px; }

/* ── 帮助弹层 ── */
.help-box { padding:12px 16px; border-radius:var(--radius-sm); background:var(--color-surface-2); border:1px solid var(--color-border-light); box-shadow:var(--shadow-card); font-size:var(--text-xs); color:var(--color-text-secondary); line-height:1.8; margin-bottom:8px; flex-shrink:0; }
.help-box p { margin:0; }
.btn-close-help { margin-top:6px; border:none; background:var(--color-accent); color:#fff; border-radius:4px; padding:3px 10px; font-size:var(--text-micro); cursor:pointer; font-family:inherit; }
.btn-help { width:26px; height:26px; border-radius:50%; border:1px solid var(--color-border); background:var(--color-surface-1); font-size:var(--text-sm); font-weight:600; color:var(--color-text-tertiary); cursor:pointer; display:flex; align-items:center; justify-content:center; }
.btn-help:hover { border-color:var(--color-accent); color:var(--color-accent); }

/* ── 信息栏 ── */
/* ── 仪表盘 ── */
.dashboard { padding: 10px 14px; background: var(--color-surface-1); border: 1px solid var(--color-border-light); border-radius: var(--radius-md); box-shadow: var(--shadow-card); margin-bottom: 8px; flex-shrink: 0; }
.dash-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.dash-item { display: flex; align-items: center; gap: 6px; font-size: var(--text-xs); color: var(--color-text-secondary); }
.dash-item--wide { flex: 1; min-width: 180px; }
.dash-label { white-space: nowrap; min-width: 120px; }
.dash-bd-item strong { color: var(--color-accent); margin-left: 2px; }

/* ── Tab ── */
.tab-bar { display:flex; gap:2px; margin-top:4px; flex-shrink:0; }
.tab { padding:8px 18px; border:none; border-radius:6px 6px 0 0; background:transparent; font-size:var(--text-sm); font-family:inherit; color:var(--color-text-tertiary); cursor:pointer; transition:all 0.12s; }
.tab:hover { color:var(--color-text); background:var(--color-surface-2); }
.tab--active { color:var(--color-accent); background:var(--color-accent-bg); font-weight:550; }
.tab-count { font-size:var(--text-micro); margin-left:4px; opacity:0.6; }
.tab-total { font-size:var(--text-micro); margin-left:4px; color:var(--color-accent); }

/* ── Tab 内容 ── */
.tab-content { flex:1; overflow-y:auto; padding:14px 0; }
.slot-grid-2col { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:14px; align-content:start; }
.slot-section-card { min-width:0; background:var(--color-surface-1); border:1px solid var(--color-border-light); border-radius:var(--radius-md); box-shadow:var(--shadow-card); overflow:visible; }
.sec-head { padding:10px 14px; background:var(--color-surface-2); font-size:var(--text-sm); font-weight:600; }
.sec-slots { padding:8px; display:flex; flex-direction:column; gap:3px; }
.slot-card { display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:var(--radius-sm); background:var(--color-surface-2); font-size:var(--text-xs); }
.slot-card--empty { opacity:0.5; }
.slot-card--ai { border-left:3px solid var(--color-accent); background:var(--color-accent-bg); }
.sc-label { width:42px; flex-shrink:0; font-weight:550; color:var(--color-text-secondary); font-size:var(--text-micro); }
.sc-val { flex:2 1 0; color:var(--color-text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }
.slot-card--empty .sc-val { color:var(--color-text-tertiary); }
.sc-notes { flex:1 1 0; max-width:180px; font-size:var(--text-micro); color:var(--color-text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }
.sc-price { font-size:var(--text-micro); color:var(--color-accent); font-weight:500; flex-shrink:0; }

/* ── 思考面板 ── */
.thinking-panel { position:fixed; right:0; bottom:0; width:320px; max-height:50vh; background:var(--color-surface-1); border:1px solid var(--color-border-light); border-radius:var(--radius-md) 0 0 0; box-shadow:var(--shadow-card); z-index:100; display:flex; flex-direction:column; }
.thinking-head { display:flex; justify-content:space-between; align-items:center; padding:8px 12px; border-bottom:0.5px solid var(--color-border-light); font-size:var(--text-sm); font-weight:550; flex-shrink:0; }
.btn-close-think { background:none; border:none; font-size:var(--text-md); cursor:pointer; color:var(--color-text-tertiary); }
.thinking-body { flex:1; overflow-y:auto; padding:8px 12px; display:flex; flex-direction:column; gap:2px; }
.thinking-line { font-size:var(--text-micro); color:var(--color-text-secondary); padding:3px 0; border-bottom:0.5px solid var(--color-border-light); }

/* ── 通用 ── */
.hint { color:var(--color-text-tertiary); text-align:center; padding:36px; font-size:var(--text-xs); }

/* 首屏加载态：占位高度贴近列表态，避免出现「加载→列表→详情」的二次位移 */
.boot-loading {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 60px 0;
  color: var(--color-text-tertiary);
  font-size: var(--text-xs);
}
.badge { font-size:var(--text-micro); padding:2px 8px; border-radius:10px; background:var(--color-accent-bg); color:var(--color-accent); }
.badge--char { background:var(--color-surface-3); color:var(--color-text-secondary); }
.badge--server { background:var(--color-surface-3); color:var(--color-text-secondary); }

/* ── 方案备注（点击编辑） ── */
.scheme-notes {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 10px 12px; margin: 2px 0;
  background: var(--color-surface-2); border-radius: var(--radius-sm);
  font-size: var(--text-xs); color: var(--color-text-secondary);
  line-height: 1.6; flex-shrink: 0; cursor: pointer;
  min-height: 100px;
}
.scheme-notes:hover { background: var(--color-surface-3); }
.sn-label { flex-shrink: 0; font-size: var(--text-sm); margin-top: 2px; }
.sn-text { white-space: pre-wrap; word-break: break-word; min-width: 0; flex: 1; padding: 4px 0; }
.sn-text--empty { color: var(--color-text-tertiary); font-style: italic; }
.sn-edit-wrap { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.sn-textarea {
  width: 100%; padding: 8px 10px; font-size: var(--text-xs); font-family: inherit;
  background: var(--color-surface-1); color: var(--color-text);
  border: 0.5px solid var(--color-accent); border-radius: var(--radius-sm);
  resize: vertical; min-height: 120px; line-height: 1.6; outline: none;
}
.text-danger { color:var(--color-danger); }
.text-warn { color:#e65100; }

.btn { border:none; border-radius:5px; cursor:pointer; font-size:var(--text-xs); font-weight:500; padding:5px 12px; font-family:inherit; transition:all 0.12s; }
.btn:disabled { opacity:0.4; cursor:not-allowed; }
.btn-accent { background:var(--color-accent); color:#fff; }
.btn-accent:hover { opacity:0.9; }
.btn-ai { background:linear-gradient(135deg,#5E6AD2,#8B5CF6); color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:var(--text-sm); font-weight:550; padding:7px 16px; font-family:inherit; }
.btn-ai:hover { opacity:0.9; }
.btn-ai:disabled { opacity:0.5; cursor:not-allowed; }
.btn-ghost { background:transparent; color:var(--color-text-secondary); }
.btn-ghost:hover { background:var(--color-hover); }
.btn-sm { font-size:var(--text-micro); padding:3px 8px; }
.btn-icon { background:none; border:none; cursor:pointer; font-size:var(--text-lg); color:var(--color-text-tertiary); }

.modal-overlay { position:fixed; inset:0; background:rgba(5,6,9,0.45); backdrop-filter:blur(10px); display:flex; align-items:center; justify-content:center; z-index:200; animation:overlay-in 0.15s ease-out; }
.modal { background:var(--glass-bg); border:1px solid var(--glass-border); border-radius:var(--radius-lg); width:420px; max-width:90vw; box-shadow:var(--shadow-pop); backdrop-filter:blur(28px) saturate(1.5); animation:modal-in 0.18s cubic-bezier(0.2,0.8,0.3,1.1); }
.modal-head { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:0.5px solid var(--color-border-light); }
.modal-head h4 { font-size:var(--text-md); font-weight:600; margin:0; }
.modal-body { padding:20px; display:flex; flex-direction:column; gap:14px; }
.modal-foot { display:flex; justify-content:flex-end; gap:8px; padding:14px 20px; border-top:0.5px solid var(--color-border-light); }
.form-row { display:flex; flex-direction:column; gap:4px; }
.form-row--2col { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.form-label { font-size:var(--text-micro); font-weight:500; color:var(--color-text-secondary); }
.input { width:100%; padding:7px 10px; font-size:var(--text-xs); font-family:inherit; background:var(--color-surface-2); color:var(--color-text); border:0.5px solid var(--color-border); border-radius:var(--radius-sm); }
.input:disabled { opacity:0.7; cursor:not-allowed; color:var(--color-text-secondary); }
.input:focus { outline:none; border-color:var(--color-accent-ring); }

/* ── 战力下拉（阶 × 品质）── */
.form-opt-hint { margin-left:6px; font-weight:400; color:var(--color-text-tertiary); }
.pw-dropdown-wrap { position:relative; }
.pw-trigger {
  display:flex; align-items:center; gap:6px; justify-content:flex-start;
  cursor:pointer; text-align:left;
  color:var(--color-text); font-weight:500;
}
.pw-trigger:not(.pw-trigger--set) { color:var(--color-text-tertiary); font-weight:400; }
.pw-trigger:hover { border-color:var(--color-accent-ring); }
.pw-trigger .scc-power-swatch { flex-shrink:0; }
.pw-trigger-arrow { margin-left:auto; flex-shrink:0; color:var(--color-text-tertiary); }
.pw-trigger--set { color:var(--pw-color, var(--color-text)); background:var(--pw-bg, var(--color-surface-2)); }
.pw-placeholder { color:var(--color-text-tertiary); }
.pw-menu {
  position:absolute; top:calc(100% + 4px); left:0; width:100%; z-index:220;
  max-height:248px; overflow-y:auto; padding:6px;
  background:var(--glass-bg); border:1px solid var(--glass-border);
  border-radius:var(--radius-sm); box-shadow:var(--shadow-pop);
  backdrop-filter:blur(20px) saturate(1.4); animation:modal-in 0.14s ease-out;
}
.pw-menu--up { top:auto; bottom:calc(100% + 4px); }
.pw-menu-none {
  width:100%; display:flex; align-items:center; gap:6px; text-align:left; padding:5px 8px;
  font-family:inherit; font-size:var(--text-xs); color:var(--color-text-tertiary);
  background:transparent; border:none; border-radius:5px; cursor:pointer;
}
.pw-menu-none:hover { background:var(--color-hover); color:var(--color-text); }
.pw-menu-divider { height:1px; margin:5px 0; background:var(--color-border-light); }
.pw-menu-opts {
  display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:5px;
}
.pw-menu-item {
  display:flex; align-items:center; justify-content:flex-start; gap:5px; height:28px; padding:0 7px;
  border-radius:5px; border:1px solid var(--color-border); background:var(--color-surface-1);
  font-family:inherit; font-size:var(--text-xs); font-weight:500;
  color:var(--pw-color, var(--color-text-secondary)); cursor:pointer; transition:all 0.1s;
  white-space:nowrap; overflow:hidden;
}
.pw-menu-item:hover { border-color:var(--pw-color, var(--color-accent-ring)); background:var(--pw-bg, var(--color-surface-2)); }
.pw-menu-item--active {
  background:var(--pw-bg, var(--color-accent-bg));
  border-color:var(--pw-color, var(--color-accent));
  color:var(--pw-color, var(--color-accent));
  box-shadow:0 0 0 1px var(--pw-color, var(--color-accent)) inset;
  font-weight:600;
}
.pw-menu-item--active:hover { border-color:var(--pw-color, var(--color-accent)); }
.pw-swatch { width:8px; height:8px; flex-shrink:0; border-radius:2px; background:var(--pw-fill, var(--color-text-tertiary)); }

/* ── 设置面板 ── */
.btn-ghost--active { background: var(--color-accent-bg); color: var(--color-accent); }
.settings-panel {
  margin-bottom: 14px; padding: 14px 16px;
  background: var(--color-surface-1); border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md); box-shadow: var(--shadow-card);
  display: flex; flex-direction: column; gap: 12px;
}
.st-row { display: flex; gap: 12px; }
.st-row--end { align-items: center; }
.st-field { flex: 1; min-width: 0; }
.st-label { display: block; font-size: var(--text-micro); font-weight: 500; color: var(--color-text-tertiary); margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.03em; }
.st-input { width: 100%; }
.st-hint { font-size: var(--text-micro); margin-left: 6px; white-space: nowrap; }
.model-pills { display: flex; gap: 8px; flex-wrap: wrap; }
.model-pill {
  display: flex; flex-direction: column; gap: 2px;
  padding: 8px 10px; border-radius: 6px; cursor: pointer;
  background: var(--color-surface-2); border: 0.5px solid var(--color-border);
  transition: all 0.12s; font-family: inherit; text-align: left;
}
.model-pill:hover { border-color: var(--color-accent-ring); }
.model-pill--active { background: var(--color-accent-bg); border-color: var(--color-accent); }
.model-pill-name { font-size: var(--text-xs); font-weight: 600; color: var(--color-text); }
.model-pill--active .model-pill-name { color: var(--color-accent); }
.model-pill-desc { font-size: var(--text-micro); color: var(--color-text-tertiary); }
.test-result { font-size: var(--text-xs); }
.prompt-details { margin-top: 4px; }
.prompt-summary { cursor: pointer; font-size: var(--text-xs); font-weight: 500; color: var(--color-text-secondary); padding: 4px 0; user-select: none; }
.prompt-summary:hover { color: var(--color-text); }
.prompt-editor {
  width: 100%; margin-top: 8px; padding: 10px; font-size: var(--text-xs);
  font-family: 'SF Mono','Cascadia Code','Consolas',monospace;
  background: var(--color-surface-2); color: var(--color-text);
  border: 0.5px solid var(--color-border); border-radius: var(--radius-sm);
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
.sc-arrow { font-size: var(--text-micro); color: var(--color-text-tertiary); flex-shrink: 0; }
.sc-img { font-size: var(--text-sm); flex-shrink: 0; cursor: pointer; opacity: 0.7; }
.sc-img:hover { opacity: 1; }
.sc-lock { font-size: var(--text-sm); cursor: pointer; flex-shrink: 0; opacity: 0.5; transition: opacity 0.12s; }
.sc-lock:hover { opacity: 1; }
.sc-lock-time { font-size: var(--text-micro); color: var(--color-accent); flex-shrink: 0; white-space: nowrap; opacity: 0.8; }
/* 锁定槽位：淡金底 + 虚线描边，暗示「冻结待复核」，不再用左侧色条 */
.slot-card--locked {
  border: 1px dashed var(--color-warning);
  background: linear-gradient(180deg, var(--color-warning-bg), transparent);
  cursor: default;
}
.slot-card--locked:hover { background: var(--color-warning-bg); }
.sc-clear { font-size: var(--text-micro); color: var(--color-text-tertiary); cursor: pointer; flex-shrink: 0; padding: 0 2px; }
.sc-clear:hover { color: var(--color-danger); }
.slot-dropdown {
  position: absolute; left: 0; right: 0; top: 100%; z-index: 100;
  background: var(--color-surface-2); border: 1px solid var(--color-border-light);
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  box-shadow: var(--shadow-pop);
  max-height: 280px; display: flex; flex-direction: column;
}
.slot-dropdown-search {
  width: 100%; padding: 8px 10px; font-size: var(--text-xs); font-family: inherit;
  background: var(--color-surface-3); color: var(--color-text);
  border: none; border-bottom: 0.5px solid var(--color-border-light);
  outline: none; border-radius: 0;
}
.slot-dropdown-search:focus { border-color: var(--color-accent-ring); }
.slot-dropdown-list { flex: 1; overflow-y: auto; }
.slot-dropdown-item {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 10px; font-size: var(--text-xs); cursor: pointer;
  border-bottom: 0.5px solid var(--color-border-light);
}
.slot-dropdown-item:hover { background: var(--color-hover); }
.slot-dropdown-item--disabled { opacity: 0.45; cursor: not-allowed; }
.slot-dropdown-item--disabled:hover { background: transparent; }
.sdi-name { flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px; }
.sdi-notes { flex: 2; font-size: var(--text-micro); color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 60px; }
.sdi-price { font-size: var(--text-micro); color: var(--color-accent); font-weight: 500; flex-shrink: 0; margin-left: auto; }
.sdi-img { font-size: var(--text-sm); flex-shrink: 0; cursor: pointer; opacity: 0.7; }
.sdi-img:hover { opacity: 1; }

/* ── 下拉空状态 ── */
.slot-dropdown-empty {
  padding: 16px 10px; text-align: center; font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

/* ── OCR 搜索提示 ── */
.ocr-search-hint {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 10px; font-size: var(--text-micro); color: var(--color-accent);
  background: var(--color-accent-bg); border-bottom: 0.5px solid var(--color-border-light);
}
.ocr-search-hint strong { font-weight: 600; }
.ocr-hint-close {
  margin-left: auto; background: none; border: none; cursor: pointer;
  font-size: var(--text-micro); color: var(--color-text-tertiary); padding: 0 2px;
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
  padding: 8px 10px; font-size: var(--text-micro); color: var(--color-accent);
  cursor: pointer; text-align: center; transition: background 0.12s;
}
.qa-trigger:hover { background: var(--color-accent-bg); }
.qa-form {
  padding: 8px 10px; display: flex; flex-direction: column; gap: 6px;
}
.qa-input {
  width: 100%; padding: 5px 8px; font-size: var(--text-micro); font-family: inherit;
  background: var(--color-surface-3); color: var(--color-text);
  border: 0.5px solid var(--color-border); border-radius: var(--radius-sm);
  outline: none;
}
.qa-input:focus { border-color: var(--color-accent-ring); }
.qa-input--price { width: 96px; flex-shrink: 0; }
.qa-price-wrap { display: flex; align-items: center; flex-shrink: 0; }
.qa-unit { font-size: var(--text-micro); color: var(--color-text-muted); margin-left: 3px; }
.qa-row { display: flex; gap: 6px; align-items: center; }
.qa-select {
  flex: 1; padding: 5px 26px 5px 6px; font-size: var(--text-micro); font-family: inherit;
  background-color: var(--color-surface-3);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8F98' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 6px center;
  appearance: none; -webkit-appearance: none;
  color: var(--color-text);
  border: 0.5px solid var(--color-border); border-radius: var(--radius-sm);
  outline: none; cursor: pointer;
}
.qa-select:focus { border-color: var(--color-accent-ring); }
.qa-actions { display: flex; gap: 6px; justify-content: flex-end; }
.qa-btn-paste {
  flex-shrink: 0; width: 28px; height: 28px; padding: 0;
  font-size: var(--text-md); line-height: 1; cursor: pointer;
  background: var(--color-surface-3); color: var(--color-text-secondary);
  border: 0.5px solid var(--color-border); border-radius: 4px;
  transition: all 0.12s;
}
.qa-btn-paste:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
.qa-btn-paste:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── 灵兽面板 ── */
.beast-tab-wrap { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
</style>
