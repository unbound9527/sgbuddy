<template>
  <div class="page">
    <div class="page-head">
      <h2>物价图鉴</h2>
      <p>装备材料价格查询 · 成本利润管理</p>
    </div>

    <!-- OCR 引擎提示（录入截图识别依赖，未安装时展示） -->
    <div class="ocr-engine-hint ocr-banner" v-if="!ocrEngineInstalled && !ocrEngineGiteeConfigured">
      <span class="ocr-engine-hint-text"><AppIcon icon="alert" :size="12" /> 高精度 OCR 引擎未安装，且下载源未配置</span>
    </div>
    <div class="ocr-engine-hint ocr-banner" v-else-if="!ocrEngineInstalled && ocrEngineState === 'downloading'">
      <span class="ocr-engine-hint-text"><AppIcon icon="loader" :size="12" class="icon-spin" /> 正在下载 OCR 引擎 {{ Math.round(ocrEngineProgress * 100) }}%</span>
      <button class="ocr-engine-hint-btn" @click="showOcrEngineModal = true">查看详情</button>
    </div>
    <div class="ocr-engine-hint ocr-banner" v-else-if="!ocrEngineInstalled && ocrEngineState === 'extracting'">
      <span class="ocr-engine-hint-text"><AppIcon icon="loader" :size="12" class="icon-spin" /> 正在解压 OCR 引擎…（约 1 分钟）</span>
      <button class="ocr-engine-hint-btn" @click="showOcrEngineModal = true">查看详情</button>
    </div>
    <div class="ocr-engine-hint ocr-engine-hint--error ocr-banner" v-else-if="!ocrEngineInstalled && ocrEngineState === 'error'">
      <span class="ocr-engine-hint-text"><AppIcon icon="circle-x" :size="12" /> OCR 引擎下载失败，点击重试</span>
      <button class="ocr-engine-hint-btn" @click="showOcrEngineModal = true">重试</button>
    </div>
    <div class="ocr-engine-hint ocr-banner" v-else-if="!ocrEngineInstalled">
      <span class="ocr-engine-hint-text"><AppIcon icon="alert" :size="12" /> 高精度 OCR 引擎未安装，截图识别精度受限（下载约 55MB，一次安装永久使用）</span>
      <button class="ocr-engine-hint-btn" @click="showOcrEngineModal = true">下载引擎</button>
    </div>

    <div class="card">

      <div class="card-head">
        <h3>物价图鉴</h3>
        <button class="btn btn-accent" @click="openPriceForm()">+ 录入价格</button>
      </div>
          <!-- 筛选行 -->
          <div class="filter-row">
            <div class="search-sug-wrap" ref="searchWrapRef">
              <input
                v-model="searchText"
                class="input search-input"
                placeholder="搜索物品名称 · 拼音 / 首字母..."
                @focus="onSearchFocus"
                @keydown.down.prevent="sugHighlight = Math.min(sugHighlight + 1, sugItems.length - 1)"
                @keydown.up.prevent="sugHighlight = Math.max(sugHighlight - 1, -1)"
                @keydown.enter.prevent="onSearchEnter"
                @keydown.escape="sugVisible = false; showRecent = false"
                @input="onSearchInput"
              />
              <button v-if="searchText" class="search-clear-btn" @click="clearSearch" title="清除"><AppIcon icon="x" :size="12" /></button>
              <ul class="sug-dropdown" v-if="sugVisible && sugItems.length > 0">
                <li
                  v-for="(item, idx) in sugItems"
                  :key="item.name"
                  :class="{ 'sug-item--active': idx === sugHighlight }"
                  @mousedown.prevent="selectSug(item.name)"
                >
                  <span class="sug-name">{{ item.name }}</span>
                  <span class="sug-slot">{{ item.slot }}</span>
                </li>
                <li class="sug-overflow" v-if="sugTotal > sugItems.length">
                  还有 {{ sugTotal - sugItems.length }} 条匹配，请细化关键词
                </li>
              </ul>
              <!-- 最近搜索（无输入时展示，5列×6行） -->
              <div class="recent-dropdown" v-if="showRecent && recentSearches.length > 0 && !searchText">
                <div class="recent-head">
                  <span class="recent-head-title">最近搜索</span>
                  <button class="recent-head-clear" @click="clearRecentSearches(); showRecent = false" title="清空">清空</button>
                </div>
                <div class="recent-grid">
                  <button
                    v-for="name in recentSearches"
                    :key="name"
                    class="recent-chip"
                    @mousedown.prevent="selectSug(name)"
                    :title="name"
                  >{{ name }}</button>
                </div>
              </div>
            </div>
            <select v-model="priceCategoryFilter" class="select-sm">
              <option value="">全部分类</option>
              <option v-for="c in priceCategories" :key="c" :value="c">{{ c }}</option>
            </select>
            <div class="multi-select-wrap" :class="{ 'multi-select-wrap--open': showRangeDropdown }" ref="rangeDropdownRef">
              <button class="select-sm multi-select-trigger" @click="showRangeDropdown = !showRangeDropdown">
                <span class="multi-select-label">{{ priceRangeLabel }}</span>
                <AppIcon icon="chevron-down" :size="12" class="multi-select-arrow" />
              </button>
              <div class="multi-select-dropdown" v-if="showRangeDropdown">
                <label v-for="r in priceRangeOptions" :key="r.value" class="range-check-label">
                  <input type="checkbox" :value="r.value" v-model="priceRangeFilter" />
                  {{ r.label }}
                </label>
              </div>
            </div>
            <label class="hot-filter-label">
              <input type="checkbox" v-model="hotFilterOnly" /> 仅显示热门
            </label>
            <label class="hot-filter-label shop-filter-label">
              <input type="checkbox" v-model="shopItemsOnly" /> 仅显示商行物品
            </label>
            <button class="btn-ghost-xs" @click="exportPrices" title="导出当前筛选结果为 Excel"><AppIcon icon="download" :size="12" /> 导出</button>
            <button class="btn-ghost-xs" @click="importPrices" title="从同表头 Excel 导入物价数据"><AppIcon icon="upload" :size="12" /> 导入</button>
          </div>

          <div class="result-count" v-if="totalResultCount > 0">共 <strong>{{ totalResultCount }}</strong> 条结果<template v-if="totalResultCount > 500">（显示前500条）</template></div>

          <div class="table-wrap" v-if="mergedList.length > 0" ref="tableWrapRef" @scroll.passive="onTableScroll">
            <table class="table">
              <thead>
                <tr>
                  <th>物品</th>
                  <th>备注</th>
                  <th>成本价(万)</th>
                  <th class="th-sort" @click="toggleSort('market_price')">
                    市场价(万)
                    <span class="sort-arrow" v-if="sortField === 'market_price'">{{ sortDir === 'desc' ? '▼' : '▲' }}</span>
                    <span class="sort-arrow sort-arrow--inactive" v-else>⇅</span>
                  </th>
                  <th>走势</th>
                  <th class="th-sort" @click="toggleSort('profit_margin')">
                    利润率
                    <span class="sort-arrow" v-if="sortField === 'profit_margin'">{{ sortDir === 'desc' ? '▼' : '▲' }}</span>
                    <span class="sort-arrow sort-arrow--inactive" v-else>⇅</span>
                  </th>
                  <th class="th-sort" @click="toggleSort('updated_at')">
                    修改时间
                    <span class="sort-arrow" v-if="sortField === 'updated_at'">{{ sortDir === 'desc' ? '▼' : '▲' }}</span>
                    <span class="sort-arrow sort-arrow--inactive" v-else>⇅</span>
                  </th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="p in displayList" :key="p._key">                <tr :class="{ 'row-flash': flashKey === p._key }">
	                  <td class="td-name" :class="qualityColorClass(p)">
	                    <div class="td-name-row">
	                    <span class="td-name-text" @click="onItemNameClick(p._baseName)" title="点击查看图片/复制名称">{{ p._baseName }}</span>
	                    <span v-if="p.craft_level" class="td-craft-lv">{{ p.craft_level }}</span>
	                    <button class="btn-icon copy-name-btn" @click.stop="copyName(p._baseName)" title="复制名称"><span class="copy-icon"></span></button>
                    <button class="btn-icon img-btn" v-if="hasImage(p.price_id, p._baseName)" @click.stop="openImageViewer(p.price_id, p._baseName)" title="查看图片"><AppIcon icon="image" :size="14" /></button>
	                    </div>
	                  </td>
                  <td class="td-attr" @click="startAttrEdit(p)">
                    <template v-if="editingAttrKey === p._key">
                      <input
                        class="inline-input inline-input--wide"
                        type="text"
                        :value="getAttrDisplay(p)"
                        @blur="finishAttrEdit(p, ($event.target as HTMLInputElement).value)"
                        @keydown.enter="($event.target as HTMLInputElement).blur()"
                        @keydown.escape="cancelAttrEdit()"
                        autofocus
                      />
                    </template>
                    <template v-else>
                      <span class="attr-text">
                        <span class="attr-text-inner">{{ getAttrSummary(p) }}</span>
                        <span class="attr-tooltip" v-if="hasMoreText(p)">{{ getAttrFullText(p) }}</span>
                      </span>
                    </template>
                  </td>
                  <td style="white-space:nowrap">
                    <input
                      class="inline-input inline-input--price"
                      :class="priceColorClass(p.benchmark_price * 10000)"
                      type="number" step="0.01" min="0"
                      :value="(p.benchmark_price * 10000).toFixed(3)"
                      placeholder="0"
                      @blur="inlineSavePrice(p, 'benchmark', ($event.target as HTMLInputElement).value, p._key)"
                    />
                    <span class="trend-inline" :class="benchTrendClass(p.price_id)" :title="benchTrendTitle(p.price_id)">
                      {{ benchTrendArrow(p.price_id) }}
                    </span>
                  </td>
                  <td style="white-space:nowrap">
                    <input
                      class="inline-input inline-input--price"
                      :class="priceColorClass(p.market_price * 10000)"
                      type="number" step="0.01" min="0"
                      :value="(p.market_price * 10000).toFixed(3)"
                      placeholder="0"
                      @blur="inlineSavePrice(p, 'market', ($event.target as HTMLInputElement).value, p._key)"
                    />
                  </td>
                  <td class="td-sparkline">
                    <svg
                      v-if="hasSparkline(p.price_id)"
                      class="sparkline-svg"
                      :viewBox="`0 0 ${SPARK_W} ${SPARK_H}`"
                      @click.stop="openHistory(p)"
                      :title="getSparklineData(p.price_id)?.summary || '点击查看价格变化历史'"
                    >
                      <!-- 成本价线（细 + 半透明，层级低于市场价） -->
                      <polyline
                        v-if="getSparklineData(p.price_id)?.benchPath"
                        :points="getSparklineData(p.price_id)!.benchPath"
                        fill="none"
                        stroke="#5E6AD2"
                        stroke-width="0.8"
                        opacity="0.45"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                      <!-- 市场价线（实线，主视觉） -->
                      <polyline
                        v-if="getSparklineData(p.price_id)?.marketPath"
                        :points="getSparklineData(p.price_id)!.marketPath"
                        fill="none"
                        :stroke="getSparklineData(p.price_id)!.marketColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                      <!-- 末端标记点 -->
                      <circle
                        v-if="getSparklineData(p.price_id)?.endX"
                        :cx="getSparklineData(p.price_id)!.endX"
                        :cy="getSparklineData(p.price_id)!.endY"
                        r="2"
                        :fill="getSparklineData(p.price_id)!.marketColor"
                        stroke="var(--color-surface-1)"
                        stroke-width="1"
                      />
                    </svg>
                    <span
                      v-else
                      class="sparkline-empty"
                      @click.stop="openHistory(p)"
                      title="暂无走势数据 · 改价后自动生成"
                    >—</span>
                  </td>
                  <td>
                    <span v-if="p.profit_margin !== null" :class="p.profit_margin >= 0 ? 'text-success' : 'text-danger'">{{ p.profit_margin }}%</span>
                    <span v-else class="td-muted">-</span>
                  </td>
                  <td class="td-muted" style="font-size:var(--text-micro)">{{ formatTime(p.updated_at) }}</td>
                  <td class="td-actions">
                    <button class="btn-icon" @click.stop="editPriceById(p)" title="编辑"><AppIcon icon="pencil" :size="13" /></button>
                    <button class="btn-icon" @click.stop="copyItem(p)" title="复制"><AppIcon icon="copy" :size="13" /></button>
                    <button class="hot-toggle" :class="{ 'hot-toggle--on': p.is_hot }"
                      @click.stop="toggleHotOrAdd(p)" title="热门"><AppIcon icon="star" :size="15" /></button>
                    <template v-if="confirmingDelete === p._key">
                      <button class="btn-icon btn-icon--warn" @click.stop="confirmDeleteItem(p)" title="确认删除"><AppIcon icon="check" :size="13" /></button>
                      <button class="btn-icon" @click.stop="confirmingDelete = null" title="取消"><AppIcon icon="x" :size="13" /></button>
                    </template>
                    <button v-else class="btn-icon btn-icon--danger" @click.stop="confirmingDelete = p._key" title="删除"><AppIcon icon="x" :size="13" /></button>
                  </td>
                </tr>
                </template>
              </tbody>
            </table>
          </div>
          <div class="hint" v-else>正在加载图鉴数据...</div>

          <!-- 录入/编辑弹层（保持不变） -->
          <div class="modal-overlay" v-if="showPriceForm" @click.self="showPriceForm = false" @keydown.enter.prevent="savePrice">
            <div class="modal">
              <div class="modal-head">
                <h4>{{ editingPrice ? '编辑物价' : (priceForm.item_name ? '复制物价' : '录入物价') }}</h4>
                <button class="btn-icon" @click="showPriceForm = false"><AppIcon icon="x" :size="13" /></button>
              </div>
              <div class="modal-body">
                <div class="form-row">
                  <label class="form-label">物品名称<span v-if="ocrFields.has('item_name')" class="ocr-badge">OCR</span></label>
                  <input ref="nameInputRef" v-model="priceForm.item_name" class="input" placeholder="名称（Ctrl+V 粘贴图片/文字）" @input="ocrFields.delete('item_name')" />
                </div>
                <div class="form-row form-row--2col">
                  <div>
                    <label class="form-label">分类<span v-if="ocrFields.has('category')" class="ocr-badge">OCR</span></label>
                    <select v-model="priceForm.category" class="input">
                      <option v-for="c in priceCategories" :key="c" :value="c">{{ c }}</option>
                    </select>
                  </div>
                  <div>
                    <label class="form-label">品质/阶位<span v-if="ocrFields.has('quality')" class="ocr-badge">OCR</span></label>
                    <select v-model="priceForm.quality" class="input">
                      <option value="">不区分</option>
                      <option v-for="q in qualityOptions" :key="q" :value="q">{{ q }}</option>
                    </select>
                  </div>
                </div>
                <template v-if="priceForm.category === '装备'">
                  <div class="form-row form-row--2col">
                    <div>
                      <label class="form-label">部位<span v-if="ocrFields.has('slot')" class="ocr-badge">OCR</span></label>
                      <select v-model="priceForm.slot" class="input">
                        <option value="">不区分</option>
                        <option v-for="s in equipSlotOptions" :key="s" :value="s">{{ s }}</option>
                      </select>
                    </div>
                    <div>
                      <label class="form-label">装备等级<span v-if="ocrFields.has('equip_level')" class="ocr-badge">OCR</span></label>
                      <select v-model.number="priceForm.equip_level" class="input">
                        <option :value="0">不区分</option>
                        <option v-for="lv in equipLevelOptions" :key="lv" :value="lv">{{ lv }}级</option>
                      </select>
                    </div>
                  </div>
                  <div class="form-row form-row--2col">
                    <div>
                      <label class="form-label">职业<span v-if="ocrFields.has('equip_job')" class="ocr-badge">OCR</span></label>
                      <select v-model="priceForm.equip_job" class="input">
                        <option value="">不区分</option>
                        <option v-for="j in equipJobOptions" :key="j" :value="j">{{ j }}</option>
                      </select>
                    </div>
                    <div>
                      <label class="form-label">打造/词条<span v-if="ocrFields.has('craft_level')" class="ocr-badge">OCR</span></label>
                      <select v-model="priceForm.craft_level" class="input">
                        <option value="">不区分</option>
                        <option v-for="c in craftOptions" :key="c" :value="c">{{ c }}</option>
                      </select>
                    </div>
                  </div>
                  <div class="form-row">
                    <label class="form-label">备注<span v-if="ocrFields.has('attr_notes')" class="ocr-badge">OCR</span></label>
                    <input v-model="priceForm.attr_notes" class="input" placeholder="如：36攻 / 4满" @input="ocrFields.delete('attr_notes')" />
                  </div>
                </template>
                <template v-if="priceForm.category === '灵魄'">
                  <div class="form-row">
                    <label class="form-label">灵魄位置<span v-if="ocrFields.has('spirit_position')" class="ocr-badge">OCR</span></label>
                    <select v-model="priceForm.spirit_position" class="input">
                      <option value="">不限制</option>
                      <option value="利刃">利刃（武器/护手/上装）</option>
                      <option value="坚盾">坚盾（头盔/下装/鞋子/面具）</option>
                      <option value="灵啸">灵啸（项链/戒指）</option>
                      <option value="守神">守神（翅膀/符咒）</option>
                    </select>
                  </div>
                  <div class="form-row">
                    <label class="form-label">备注<span v-if="ocrFields.has('attr_notes')" class="ocr-badge">OCR</span></label>
                    <input v-model="priceForm.attr_notes" class="input" placeholder="如：36攻 / 4满 / 蓝开5" @input="ocrFields.delete('attr_notes')" />
                  </div>
                </template>
                <template v-if="priceForm.category !== '装备' && priceForm.category !== '灵魄'">
                  <div class="form-row">
                    <label class="form-label">规格描述<span v-if="ocrFields.has('attr_notes')" class="ocr-badge">OCR</span></label>
                    <input v-model="priceForm.attr_notes" class="input" placeholder="如：天品 / 10阶 / 36攻" @input="ocrFields.delete('attr_notes')" />
                  </div>
                </template>
                <div class="form-row">
                  <label class="form-label">成本价（万三国币）</label>
                  <input v-model.number="priceForm.benchmark_price" class="input" type="number" step="0.01" min="0" />
                </div>
                <div class="form-row">
                  <label class="form-label">市场价（万三国币）</label>
                  <input v-model.number="priceForm.market_price" class="input" type="number" step="0.01" min="0" />
                </div>
                <!-- 道具图片（全品类） -->
                <div class="form-row">
                  <label class="form-label">道具图片</label>
                  <div class="image-upload-row">
                    <div v-for="(img, idx) in formImages" :key="img.id || idx" class="image-thumb-wrap">
                      <img :src="img.path" class="image-thumb" @click="viewImage(img.path)" />
                      <button v-if="!ocrBusy" class="image-thumb-ocr" @click="ocrThumbnail(img)" title="识别图片"><AppIcon icon="search" :size="10" /></button>
                      <button class="image-thumb-del" @click="removeFormImage(idx)" title="删除"><AppIcon icon="x" :size="10" /></button>
                    </div>
                    <button class="image-add-btn" @click="addImage" title="添加图片">+</button>
                    <button class="image-add-btn image-add-btn--sm" @click="pasteFromClipboard()" title="粘贴剪贴板内容（图片自动识别 / 文字填入名称）"><AppIcon icon="copy" :size="18" /></button>
                  </div>
                  <!-- OCR 状态 -->
                  <div class="ocr-status" v-if="ocrBusy || ocrError || ocrText || ocrSimilar.length">
                    <template v-if="ocrBusy">
                      <span class="ocr-spinner"></span>
                      <span v-if="ocrProgress">
                        {{ ocrProgress.stage === 'download' ? '下载语言包' : ocrProgress.stage === 'startup' ? '启动识别引擎' : '识别中' }}{{ ocrProgress.stage === 'startup' ? '…' : ' ' + ocrProgress.percent + '%' }}
                      </span>
                      <span v-else>识别中…</span>
                    </template>
                    <template v-else-if="ocrError">
                      <span class="text-danger">{{ ocrError }}</span>
                      <button v-if="lastOcrThumb" class="btn btn-ghost btn-sm" @click="ocrThumbnail(lastOcrThumb)">重试</button>
                    </template>
                    <template v-else>
                      <span class="ocr-done"><AppIcon icon="check" :size="12" /> 已识别，字段已预填</span>
                      <span v-if="ocrSimilar.length" class="ocr-similar">已存在类似记录：{{ ocrSimilar.join(' / ') }}</span>
                      <details class="ocr-raw"><summary>查看识别文本</summary><pre>{{ ocrText }}</pre></details>
                    </template>
                  </div>
                </div>
              </div>
              <div class="modal-foot">
                <span class="text-danger" v-if="saveError" style="flex:1;font-size:var(--text-xs)">{{ saveError }}</span>
                <button class="btn btn-ghost" @click="showPriceForm = false">取消</button>
                <button class="btn btn-accent" @click="savePrice">保存</button>
              </div>
            </div>
          </div>

          <!-- OCR 引擎下载弹窗 -->
          <div class="modal-overlay" v-if="showOcrEngineModal" @click.self="showOcrEngineModal = false">
            <div class="modal modal--ocr">
              <div class="modal-head">
                <h4>下载高精度 OCR 引擎</h4>
                <button class="btn-icon" @click="showOcrEngineModal = false"><AppIcon icon="x" :size="13" /></button>
              </div>
              <div class="modal-body">
                <p class="ocr-dl-desc">
                  装备截图高精度识别（PaddleOCR-json）。从 Gitee 自动下载约 55MB 分卷并解压安装，一次安装永久使用，后续无需再下载。
                </p>

                <template v-if="ocrEngineState === 'downloading'">
                  <div class="update-progress">
                    <div class="update-progress-bar" :style="{ width: Math.round(ocrEngineProgress * 100) + '%' }"></div>
                    <span class="update-progress-text">{{ Math.round(ocrEngineProgress * 100) }}%</span>
                  </div>
                  <div class="ocr-dl-meta">
                    <span>已下载 {{ formatBytes(ocrEngineReceived) }} / {{ formatBytes(ocrEngineTotal) }}</span>
                    <span v-if="ocrEngineSpeed > 0">速度 {{ formatBytes(ocrEngineSpeed) }}/s</span>
                  </div>
                </template>

                <div class="ocr-extracting" v-else-if="ocrEngineState === 'extracting'">
                  <span class="ocr-extracting-icon"><AppIcon icon="loader" :size="14" class="icon-spin" /></span>
                  <span>下载完成，正在解压引擎…（约 240MB，可能需要 1 分钟，请耐心等待，不要关闭应用）</span>
                </div>

                <div class="ocr-done" v-else-if="ocrEngineState === 'done'">
                  <AppIcon icon="circle-check" :size="13" /> 引擎安装完成，识别已升级为高精度
                </div>

                <template v-else-if="ocrEngineState === 'error'">
                  <div class="update-error">下载失败：{{ ocrEngineError }}</div>
                </template>

                <div class="ocr-dl-actions">
                  <template v-if="ocrEngineState === 'idle' || ocrEngineState === 'error'">
                    <button class="btn btn-accent" @click="downloadOcrEngine">{{ ocrEngineState === 'error' ? '重试' : '开始下载' }}</button>
                    <button class="btn btn-ghost" @click="showOcrEngineModal = false">{{ ocrEngineState === 'error' ? '关闭' : '取消' }}</button>
                  </template>
                  <button v-else class="btn btn-ghost" @click="showOcrEngineModal = false">
                    {{ ocrEngineState === 'done' ? '完成' : '后台运行' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 价格历史弹层 -->
          <div class="modal-overlay" v-if="showHistoryModal" @click.self="showHistoryModal = false">
            <div class="modal modal--wide">
              <div class="modal-head">
                <h4>{{ historyItemName }} — 价格变化历史</h4>
                <button class="btn-icon" @click="showHistoryModal = false"><AppIcon icon="x" :size="13" /></button>
              </div>
              <div class="modal-body">
                <!-- 折线图 -->
                <div class="history-chart-wrap" v-if="historyChartData.length > 0">
                  <svg
                    class="chart"
                    :viewBox="`0 0 ${hChartW} ${hChartH}`"
                    preserveAspectRatio="xMidYMid meet"
                    @mousemove="onHistoryChartHover"
                    @mouseleave="onHistoryChartLeave"
                  >
                    <!-- 渐变定义 -->
                    <defs>
                      <linearGradient id="hMarketGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#f97316" stop-opacity="0.28" />
                        <stop offset="100%" stop-color="#f97316" stop-opacity="0.02" />
                      </linearGradient>
                    </defs>

                    <line v-for="(y, i) in hYTicks" :key="'hg'+i"
                      :x1="hPadL" :y1="y" :x2="hChartW - hPadR" :y2="y"
                      stroke="var(--color-border)" stroke-width="0.5" stroke-dasharray="3,3"
                    />
                    <text v-for="(y, i) in hYTicks" :key="'hyl'+i"
                      :x="hPadL - 6" :y="y + 4" text-anchor="end" class="chart-label"
                    >{{ hYLabels[i] }}</text>
                    <text v-for="(t, i) in hXTicks" :key="'hxl'+i"
                      :x="t.x" :y="hChartH - hPadB + 16" text-anchor="middle" class="chart-label"
                    >{{ t.label }}</text>

                    <!-- 市场价面积填充 -->
                    <polygon v-if="hMarketArea" :points="hMarketArea" fill="url(#hMarketGrad)" />

                    <!-- 成本价线（细蓝实线） -->
                    <polyline :points="hCostLine" fill="none" stroke="#5E6AD2" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                    <!-- 市场价线（粗橙实线） -->
                    <polyline :points="hMarketLine" fill="none" stroke="#f97316" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />

                    <!-- 末端标记点（最新值） -->
                    <circle v-if="hLastPt" :cx="hLastPt.x" :cy="hLastPt.costY" r="4"
                      fill="#5E6AD2" stroke="var(--color-surface-1)" stroke-width="2" />
                    <circle v-if="hLastPt && hLastPt.market > 0" :cx="hLastPt.x" :cy="hLastPt.marketY" r="4"
                      fill="#f97316" stroke="var(--color-surface-1)" stroke-width="2" />

                    <!-- 最高/最低价标记（标签自动避开坐标轴和图例） -->
                    <template v-if="hCostHigh">
                      <polygon :points="extremeDiamond(hCostHigh.x, hCostHigh.y, 5)" fill="#5E6AD2" stroke="var(--color-surface-1)" stroke-width="1.5" />
                      <text :x="extremeLabelX(hCostHigh.x, hCostHigh.y)" :y="extremeLabelY(hCostHigh.y, true)" text-anchor="middle" class="chart-extreme-label" fill="#5E6AD2">高 {{ fmtWan(hCostHigh.val) }}</text>
                    </template>
                    <template v-if="hCostLow">
                      <polygon :points="extremeDiamond(hCostLow.x, hCostLow.y, 5)" fill="#5E6AD2" stroke="var(--color-surface-1)" stroke-width="1.5" />
                      <text :x="extremeLabelX(hCostLow.x, hCostLow.y)" :y="extremeLabelY(hCostLow.y, false)" text-anchor="middle" class="chart-extreme-label" fill="#5E6AD2">低 {{ fmtWan(hCostLow.val) }}</text>
                    </template>
                    <template v-if="hMarketHigh">
                      <polygon :points="extremeDiamond(hMarketHigh.x, hMarketHigh.y, 5)" fill="#f97316" stroke="var(--color-surface-1)" stroke-width="1.5" />
                      <text :x="extremeLabelX(hMarketHigh.x, hMarketHigh.y)" :y="extremeLabelY(hMarketHigh.y, true)" text-anchor="middle" class="chart-extreme-label" fill="#f97316">高 {{ fmtWan(hMarketHigh.val) }}</text>
                    </template>
                    <template v-if="hMarketLow">
                      <polygon :points="extremeDiamond(hMarketLow.x, hMarketLow.y, 5)" fill="#f97316" stroke="var(--color-surface-1)" stroke-width="1.5" />
                      <text :x="extremeLabelX(hMarketLow.x, hMarketLow.y)" :y="extremeLabelY(hMarketLow.y, false)" text-anchor="middle" class="chart-extreme-label" fill="#f97316">低 {{ fmtWan(hMarketLow.val) }}</text>
                    </template>

                    <!-- 悬浮竖线 + 横线（十字光标） -->
                    <line v-if="hHoverPt" :x1="hHoverPt.x" :y1="hPadT" :x2="hHoverPt.x" :y2="hChartH - hPadB"
                      stroke="var(--color-text-tertiary)" stroke-width="1" stroke-dasharray="4,3" opacity="0.6" />
                    <line v-if="hHoverPt" :x1="hPadL" :y1="hHoverPt.costY" :x2="hChartW - hPadR" :y2="hHoverPt.costY"
                      stroke="var(--color-text-tertiary)" stroke-width="0.5" stroke-dasharray="3,3" opacity="0.35" />
                    <!-- 悬浮圆点：成本价 -->
                    <circle v-if="hHoverPt" :cx="hHoverPt.x" :cy="hHoverPt.costY" r="4.5"
                      fill="#5E6AD2" stroke="var(--color-surface-1)" stroke-width="2" />
                    <!-- 悬浮圆点：市场价 -->
                    <circle v-if="hHoverPt && hHoverPt.market > 0" :cx="hHoverPt.x" :cy="hHoverPt.marketY" r="4.5"
                      fill="#f97316" stroke="var(--color-surface-1)" stroke-width="2" />

                    <!-- Tooltip -->
                    <g v-if="hHoverPt" class="chart-tooltip-group">
                      <rect :x="hTooltipBox.x" :y="hTooltipBox.y" :width="hTooltipBox.w" :height="hTooltipBox.h"
                        rx="4" ry="4" fill="var(--color-surface-2)" stroke="var(--color-border)" stroke-width="0.5" opacity="0.96" />
                      <text :x="hTooltipBox.tx" :y="hTooltipBox.ty" text-anchor="middle" class="chart-tooltip-date">{{ hHoverDate }}</text>
                      <text :x="hTooltipBox.tx" :y="hTooltipBox.ty + 15" text-anchor="middle" class="chart-tooltip-value" fill="#5E6AD2">成本 {{ hHoverCost }}</text>
                      <text :x="hTooltipBox.tx" :y="hTooltipBox.ty + 30" text-anchor="middle" class="chart-tooltip-value" fill="#f97316">市场 {{ hHoverMarket }}</text>
                    </g>

                    <!-- 透明捕获层 -->
                    <rect :x="hPadL" :y="hPadT" :width="hPlotW" :height="hPlotH" fill="transparent" style="cursor: crosshair" />

                    <!-- 图例 -->
                    <rect :x="hChartW - hPadR - 130" y="6" width="12" height="3" rx="1.5" fill="#5E6AD2" />
                    <text :x="hChartW - hPadR - 114" y="11" class="chart-legend">成本价</text>
                    <rect :x="hChartW - hPadR - 60" y="6" width="12" height="3" rx="1.5" fill="#f97316" />
                    <text :x="hChartW - hPadR - 44" y="11" class="chart-legend">市场价</text>
                  </svg>
                </div>
                <div class="hint" v-else style="padding:20px">暂无历史变化记录</div>

                <!-- 历史表格 -->
                <div class="history-table-wrap" v-if="historyData.length > 0">
                  <table class="table">
                    <thead><tr><th>变更时间</th><th>成本价(万)</th><th>市场价(万)</th><th>成本变化</th><th>市场变化</th></tr></thead>
                    <tbody>
                      <tr v-for="(h, idx) in historyData" :key="h.id">
                        <td class="td-muted">{{ formatTime(h.changed_at) }}</td>
                        <td>{{ toWan(h.benchmark_price) }}</td>
                        <td>{{ toWan(h.market_price) }}</td>
                        <td>
                          <span v-if="idx < historyData.length - 1" :class="historyDiffClass(h.benchmark_price, historyData[idx+1].benchmark_price)">
                            {{ historyDiffArrow(h.benchmark_price, historyData[idx+1].benchmark_price) }}
                            {{ toWan(Math.abs(h.benchmark_price - historyData[idx+1].benchmark_price)) }}
                          </span>
                          <span v-else class="td-muted">-</span>
                        </td>
                        <td>
                          <span v-if="idx < historyData.length - 1" :class="historyDiffClass(h.market_price, historyData[idx+1].market_price)">
                            {{ historyDiffArrow(h.market_price, historyData[idx+1].market_price) }}
                            {{ toWan(Math.abs(h.market_price - historyData[idx+1].market_price)) }}
                          </span>
                          <span v-else class="td-muted">-</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

    </div>
  </div>
  <ImageViewer v-model="viewerVisible" :images="viewerImages" />
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onActivated, onUnmounted, watch, nextTick } from 'vue'
import { convertToPinyin } from 'tiny-pinyin'
import { useAppStore } from '@/stores'
import ImageViewer from '@/components/ImageViewer.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { parseOcrText } from '@/utils/fieldParser'

const appStore = useAppStore()
const { servers } = appStore

/* ── 1. 物价基准 ── */
interface PriceRecord {
  id: number; server_id: number; category: string; item_name: string
  quality: string; craft_level: string; attr_notes: string;
  benchmark_price: number; market_price: number; is_hot: number; updated_at: string
  equip_level?: number; equip_job?: string; spirit_position?: string; slot?: string
}

interface PriceHistory {
  id: number; price_param_id: number
  benchmark_price: number; market_price: number
  changed_at: string
}

type Trend = 'up' | 'down' | 'flat' | 'none'
interface TrendInfo { direction: Trend; pct: number | null }

const priceCategories = ['装备', '材料', '灵魄', '八阵图', '子女', '奥义', '灵珠', '羽灵', '元神', '灵兽', '其他']
const qualityOptions = computed(() => {
  if (priceForm.value.category === '灵兽') return ['天', '地', '玄', '妙', '凡']
  return ['黄色', '橙色', '红色', '绿色', '蓝色', '紫色']
})
const craftOptions = ['精致', '浑然', '天赐', '完美', '鬼神']
const equipLevelOptions = [70, 80, 90, 100, 110, 120, 130, 140, 150]
const equipJobOptions = ['剑侍', '豪杰', '阴阳士', '仙术士', '游侠', '唤灵']
const equipSlotOptions = ['武器', '头盔', '上装', '下装', '护手', '鞋子', '面具', '项链', '戒指', '翅膀', '符咒']

const priceRangeOptions = [
  { value: '0-1wan', label: '0-1万' },
  { value: '1-10wan', label: '1-10万' },
  { value: '10-100wan', label: '10-100万' },
  { value: '100-1000wan', label: '100-1000万' },
  { value: '1000wan-1yi', label: '1000万-1亿' },
  { value: '1-10yi', label: '1-10亿' },
  { value: '10yi+', label: '10亿+' },
]

const prices = ref<PriceRecord[]>([])
const priceCategoryFilter = ref('')
const priceRangeFilter = ref<string[]>([])
const showRangeDropdown = ref(false)
const rangeDropdownRef = ref<HTMLElement | null>(null)
const priceRangeLabel = computed(() => {
  if (priceRangeFilter.value.length === 0 || priceRangeFilter.value.length === priceRangeOptions.length) return '全部价格'
  if (priceRangeFilter.value.length <= 2) return priceRangeFilter.value.map(v => priceRangeOptions.find(o => o.value === v)!.label).join('、')
  return `已选 ${priceRangeFilter.value.length} 项`
})
const hotFilterOnly = ref(false)
const shopItemsOnly = ref(false)
const inventoryNames = ref<Set<string>>(new Set())
const sortField = ref<'market_price' | 'profit_margin' | 'updated_at' | null>(null)
const sortDir = ref<'asc' | 'desc'>('desc')
const confirmingDelete = ref<string | null>(null)
const flashKey = ref<string | null>(null)

// 属性/备注 编辑状态
const editingAttrKey = ref<string | null>(null)
const editingAttrBackup = ref('')

	function getAttrDisplay(p: { craft_level: string; attr_notes: string }): string {
	  // 仅显示属性备注，打造/词条已合并到物品列
	  return p.attr_notes || ''
	}

function getAttrFullText(p: { craft_level: string; attr_notes: string }): string {
  return getAttrDisplay(p)
}

function getAttrSummary(p: { craft_level: string; attr_notes: string }): string {
  const full = getAttrDisplay(p)
  if (!full) return '—'
  return full.length > 20 ? full.slice(0, 20) + '…' : full
}

function hasMoreText(p: { craft_level: string; attr_notes: string }): boolean {
  return getAttrDisplay(p).length > 20
}

function startAttrEdit(p: { _key: string; craft_level: string; attr_notes: string }) {
  editingAttrKey.value = p._key
  editingAttrBackup.value = getAttrDisplay(p)
}

function cancelAttrEdit() {
  editingAttrKey.value = null
  editingAttrBackup.value = ''
}

async function finishAttrEdit(
  row: { item_name: string; category: string; quality: string; craft_level: string; attr_notes: string; price_id: number; _key: string },
  rawValue: string
) {
  // 如果编辑状态已被取消（Escape 触发 blur），不保存
  if (editingAttrKey.value !== row._key) return
  const trimmed = rawValue.trim()
  // 如果值没变，直接取消编辑
  if (trimmed === editingAttrBackup.value) {
    editingAttrKey.value = null
    editingAttrBackup.value = ''
    return
  }
  editingAttrKey.value = null
  editingAttrBackup.value = ''
  await inlineSaveAttr(row, trimmed, row._key)
}

const totalResultCount = ref(0)
const showPriceForm = ref(false)
const editingPrice = ref<PriceRecord | null>(null)
const priceForm = ref({ item_name: '', category: '装备', quality: '', craft_level: '', attr_notes: '', benchmark_price: 0, market_price: 0, slot: '', equip_level: 0, equip_job: '', spirit_position: '' })
const nameInputRef = ref<HTMLInputElement | null>(null)
// 图片相关
const formImages = ref<Array<{ id?: number; path: string; relPath?: string }>>([])
const viewerVisible = ref(false)
const viewerImages = ref<string[]>([])
const imageCache = ref<Map<string, string[]>>(new Map()) // itemName → absolute paths

// 趋势（分别记录成本价和市场价的方向）
const benchTrendMap = ref<Map<number, TrendInfo>>(new Map())
const marketTrendMap = ref<Map<number, TrendInfo>>(new Map())

// 走势曲线数据：price_id → 市场价/成本价历史数组（用于内联 sparkline）
const sparklineMap = ref<Map<number, number[]>>(new Map())
const sparklineBenchMap = ref<Map<number, number[]>>(new Map())
// sparkline 渲染缓存：price_id → 预计算的路径/颜色，避免模板中重复调用 getSparklineData
const sparklineCache = ref<Map<number, SparklineData>>(new Map())

// 价格历史弹窗
const showHistoryModal = ref(false)
const historyItemName = ref('')
const historyData = ref<PriceHistory[]>([])

/* ── 历史图表参数 ── */
const hPadL = 48; const hPadR = 12; const hPadT = 24; const hPadB = 28
const hChartW = 700; const hChartH = 200
const hPlotW = hChartW - hPadL - hPadR
const hPlotH = hChartH - hPadT - hPadB

const historyChartData = computed(() => {
  const raw = historyData.value.slice().reverse() // oldest → newest
  if (raw.length === 0) return []
  const valsCost = raw.map(r => r.benchmark_price)
  const valsMarket = raw.map(r => r.market_price || 0)
  const allVals = [...valsCost, ...valsMarket].filter(v => v > 0)
  const min = allVals.length ? Math.min(...allVals) : 0
  const max = allVals.length ? Math.max(...allVals) : 1
  const range = max - min || 1
  const clampY = (val: number): number => {
    // 0 或负值钳位到绘图区底部，避免线条溢出 viewBox
    if (val <= 0) return hPadT + hPlotH
    return hPadT + hPlotH - ((val - min) / range) * hPlotH
  }
  return raw.map((r, i) => ({
    x: hPadL + (i / Math.max(1, raw.length - 1)) * hPlotW,
    costY: clampY(r.benchmark_price),
    marketY: clampY(r.market_price || 0),
    date: r.changed_at?.slice(5, 16) || '',
    cost: r.benchmark_price,
    market: r.market_price || 0,
  }))
})

const hCostLine = computed(() => historyChartData.value.map(p => `${p.x},${p.costY}`).join(' '))
const hMarketLine = computed(() => historyChartData.value.map(p => `${p.x},${p.marketY}`).join(' '))

// 市场价线下方面积填充路径
const hMarketArea = computed(() => {
  const data = historyChartData.value
  if (data.length < 2) return ''
  const bottom = hPadT + hPlotH
  return `${data[0].x},${bottom} ` + data.map(p => `${p.x},${p.marketY}`).join(' ') + ` ${data[data.length - 1].x},${bottom}`
})

// 末端点（最新值标记）
const hLastPt = computed(() => {
  const data = historyChartData.value
  return data.length > 0 ? data[data.length - 1] : null
})

// 最高/最低价标记点（成本价和市场价各找极值，排除 0 值）
interface ExtremePt { x: number; y: number; val: number; label: string }
const hCostHigh = computed<ExtremePt | null>(() => {
  const data = historyChartData.value.filter(p => p.cost > 0)
  if (data.length === 0) return null
  const pt = data.reduce((a, b) => a.cost > b.cost ? a : b)
  return { x: pt.x, y: pt.costY, val: pt.cost, label: '成本最高' }
})
const hCostLow = computed<ExtremePt | null>(() => {
  const data = historyChartData.value.filter(p => p.cost > 0)
  if (data.length === 0) return null
  const pt = data.reduce((a, b) => a.cost < b.cost ? a : b)
  // 避免最高最低是同一个点
  if (hCostHigh.value && pt.cost === hCostHigh.value.val) return null
  return { x: pt.x, y: pt.costY, val: pt.cost, label: '成本最低' }
})
const hMarketHigh = computed<ExtremePt | null>(() => {
  const data = historyChartData.value.filter(p => p.market > 0)
  if (data.length <= 1) return null
  const pt = data.reduce((a, b) => a.market > b.market ? a : b)
  return { x: pt.x, y: pt.marketY, val: pt.market, label: '市场最高' }
})
const hMarketLow = computed<ExtremePt | null>(() => {
  const data = historyChartData.value.filter(p => p.market > 0)
  if (data.length <= 1) return null
  const pt = data.reduce((a, b) => a.market < b.market ? a : b)
  if (hMarketHigh.value && pt.market === hMarketHigh.value.val) return null
  return { x: pt.x, y: pt.marketY, val: pt.market, label: '市场最低' }
})

/* ── 悬浮交互 ── */
const hHoverIdx = ref<number | null>(null)
const hHoverPt = computed(() => {
  if (hHoverIdx.value === null || hHoverIdx.value < 0) return null
  const data = historyChartData.value
  if (data.length === 0 || hHoverIdx.value >= data.length) return null
  return data[hHoverIdx.value]
})
const hHoverDate = computed(() => hHoverPt.value?.date ?? '')
const hHoverCost = computed(() => hHoverPt.value ? (hHoverPt.value.cost * 10000).toFixed(1) + ' 万' : '')
const hHoverMarket = computed(() => {
  if (!hHoverPt.value || hHoverPt.value.market <= 0) return '-'
  return (hHoverPt.value.market * 10000).toFixed(1) + ' 万'
})
const hTooltipBox = computed(() => {
  if (!hHoverPt.value) return { x: 0, y: 0, w: 0, h: 0, tx: 0, ty: 0 }
  const pw = 120; const ph = 52
  let bx = hHoverPt.value.x - pw / 2
  if (bx < hPadL) bx = hPadL + 2
  if (bx + pw > hChartW - hPadR) bx = hChartW - hPadR - pw - 2
  // 优先放在数据点上方
  let by = Math.min(hHoverPt.value.costY, hHoverPt.value.marketY || Infinity) - ph - 10
  if (by < hPadT) {
    // 上方空间不够 → 翻转到下方
    by = Math.max(hHoverPt.value.costY, hHoverPt.value.marketY || 0) + 14
    // 下方也不够 → 钳位到绘图区底部
    if (by + ph > hChartH - hPadB) {
      by = hChartH - hPadB - ph - 2
    }
  }
  return { x: bx, y: by, w: pw, h: ph, tx: bx + pw / 2, ty: by + 16 }
})

/** 菱形标记点坐标（用于最高/最低价） */
function extremeDiamond(cx: number, cy: number, r: number): string {
  return `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`
}
/** 极值标签 X 位置：靠左右移、靠右左移、靠近图例区额外左移 */
function extremeLabelX(x: number, y: number): number {
  // 右上角图例区域（约 hChartW-140, y<18），标签向左避开
  if (y < 22 && x > hChartW - hPadR - 150) return x - 48
  if (x < hPadL + 36) return x + 20
  if (x > hChartW - hPadR - 36) return x - 30
  return x
}
/** 极值标签 Y 位置：上方标签若贴顶则翻到下方，下方标签若贴底则翻到上方 */
function extremeLabelY(y: number, isHigh: boolean): number {
  if (isHigh) {
    // 高点标签默认放上方，太靠顶则翻到下方
    if (y < hPadT + 16) return y + 18
    return y - 8
  } else {
    // 低点标签默认放下方，太靠底（接近 X 轴标签）则翻到上方
    if (y > hChartH - hPadB - 24) return y - 8
    return y + 16
  }
}
/** 亿 → 万，简洁显示 */
function fmtWan(yi: number): string {
  return (yi * 10000).toFixed(1) + '万'
}

function onHistoryChartHover(e: MouseEvent) {
  const svg = e.currentTarget as SVGSVGElement
  const rect = svg.getBoundingClientRect()
  const mx = ((e.clientX - rect.left) / rect.width) * hChartW
  const my = ((e.clientY - rect.top) / rect.height) * hChartH
  const data = historyChartData.value
  if (data.length === 0) return
  if (mx < hPadL || mx > hChartW - hPadR || my < hPadT || my > hChartH - hPadB) {
    hHoverIdx.value = null; return
  }
  let nearest = 0; let minDist = Infinity
  for (let i = 0; i < data.length; i++) {
    const dist = Math.abs(data[i].x - mx)
    if (dist < minDist) { minDist = dist; nearest = i }
  }
  hHoverIdx.value = nearest
}
function onHistoryChartLeave() { hHoverIdx.value = null }

const hYTicks = computed(() => {
  if (historyChartData.value.length === 0) return []
  const allVals = historyChartData.value.flatMap(p => [p.cost, p.market]).filter(v => v > 0)
  const min = allVals.length ? Math.min(...allVals) : 0
  const max = allVals.length ? Math.max(...allVals) : 1
  const range = max - min || 1
  const count = 4
  const ticks: number[] = []
  for (let i = 0; i <= count; i++) {
    const val = min + (range * i) / count
    ticks.push(hPadT + hPlotH - ((val - min) / range) * hPlotH)
  }
  return ticks
})

const hYLabels = computed(() => {
  if (historyChartData.value.length === 0) return []
  const allVals = historyChartData.value.flatMap(p => [p.cost, p.market]).filter(v => v > 0)
  const min = allVals.length ? Math.min(...allVals) : 0
  const max = allVals.length ? Math.max(...allVals) : 1
  const range = max - min || 1
  const count = 4
  const labels: string[] = []
  for (let i = 0; i <= count; i++) {
    const val = min + (range * i) / count
    labels.push((val * 10000).toFixed(1))
  }
  return labels
})

const hXTicks = computed(() => {
  const data = historyChartData.value
  if (data.length <= 1) return []
  const count = Math.min(5, data.length)
  const ticks: Array<{ x: number; label: string }> = []
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i / (count - 1)) * (data.length - 1))
    ticks.push({ x: data[idx].x, label: data[idx].date })
  }
  return ticks
})

function openHistory(row: { _baseName: string; price_id: number }) {
  historyItemName.value = row._baseName
  showHistoryModal.value = true
  loadHistory(row.price_id)
}

async function loadHistory(priceId: number) {
  try {
    // 过滤掉 benchmark_price 和 market_price 均为 0 的记录（0 表示未录入，无历史意义）
    const rows = await window.electronAPI.dbQuery(
      'SELECT * FROM price_history WHERE price_param_id=? AND NOT (benchmark_price <= 0 AND market_price <= 0) ORDER BY changed_at DESC',
      [priceId]
    ) as PriceHistory[]
    // 将 price_params 中的当前价格作为最新一条补入历史（仅当有实际价格时）
    const cur = await window.electronAPI.dbQuery(
      'SELECT id, benchmark_price, market_price, updated_at FROM price_params WHERE id=?',
      [priceId]
    ) as Array<{ id: number; benchmark_price: number; market_price: number; updated_at: string }>
    if (cur && cur.length > 0 && (cur[0].benchmark_price > 0 || cur[0].market_price > 0)) {
      const latest = {
        id: -1, // 虚拟 ID，表示当前值
        price_param_id: priceId,
        benchmark_price: cur[0].benchmark_price,
        market_price: cur[0].market_price,
        changed_at: cur[0].updated_at,
      }
      // 如果最新历史记录与当前值相同则跳过，否则补入（用值比对而非时间戳，避免同秒更新漏掉）
      const isDuplicate = rows.length > 0
        && rows[0].benchmark_price === cur[0].benchmark_price
        && rows[0].market_price === cur[0].market_price
      if (!isDuplicate) {
        rows.unshift(latest as any)
      }
    }
    historyData.value = rows
  } catch (e) { console.error('加载价格历史失败:', e); historyData.value = [] }
}

const trendArrow = (info: TrendInfo | undefined): string => {
  if (!info || info.direction === 'none') return ''
  if (info.direction === 'up') return '▲'
  if (info.direction === 'down') return '▼'
  return '─'
}
const trendClass = (info: TrendInfo | undefined): string => {
  if (!info || info.direction === 'none') return 'trend-none'
  if (info.direction === 'up') return 'trend-up'
  if (info.direction === 'down') return 'trend-down'
  return 'trend-flat'
}
const trendTitle = (info: TrendInfo | undefined, label: string): string => {
  if (!info || info.direction === 'none') return ''
  if (info.direction === 'up') return `${label}上涨${info.pct !== null ? ' +' + info.pct + '%' : ''}`
  if (info.direction === 'down') return `${label}下跌${info.pct !== null ? ' -' + info.pct + '%' : ''}`
  return `${label}持平`
}
function benchTrendArrow(pid: number) { return trendArrow(benchTrendMap.value.get(pid)) }
function benchTrendClass(pid: number) { return trendClass(benchTrendMap.value.get(pid)) }
function benchTrendTitle(pid: number) { return trendTitle(benchTrendMap.value.get(pid), '成本价') }
function marketTrendArrow(pid: number) { return trendArrow(marketTrendMap.value.get(pid)) }
function marketTrendClass(pid: number) {
  // 市场价：涨=能卖更高=好事→绿色(success)，跌=卖得便宜=坏事→红色(danger)
  const info = marketTrendMap.value.get(pid)
  if (!info || info.direction === 'none') return 'trend-none'
  if (info.direction === 'up') return 'trend-down'
  if (info.direction === 'down') return 'trend-up'
  return 'trend-flat'
}
function marketTrendTitle(pid: number) {
  const info = marketTrendMap.value.get(pid)
  if (!info || info.direction === 'none') return ''
  if (info.direction === 'up') return `市场价上涨${info.pct !== null ? ' +' + info.pct + '%' : ''}`
  if (info.direction === 'down') return `市场价下跌${info.pct !== null ? ' -' + info.pct + '%' : ''}`
  return '市场价持平'
}

// 走势曲线 sparkline 参数
const SPARK_W = 64; const SPARK_H = 22; const SPARK_PAD = 2

interface SparklineData {
  marketPath: string
  benchPath: string
  marketColor: string
  summary: string
  endX: number
  endY: number
}

function getSparklineData(pid: number): SparklineData | null {
  return sparklineCache.value.get(pid) ?? null
}

function hasSparkline(pid: number): boolean {
  return sparklineCache.value.has(pid)
}

function historyDiffArrow(current: number, previous: number): string {
  if (current > previous) return '▲'
  if (current < previous) return '▼'
  return '─'
}

function historyDiffClass(current: number, previous: number): string {
  if (current > previous) return 'text-danger'
  if (current < previous) return 'text-success'
  return 'td-muted'
}

const priceSearch = ref('')
// 区服跟随全局当前大区
const effectiveServerId = computed(() => appStore.currentServerId ?? 0)

const searchText = ref('')
const sugVisible = ref(false)
const sugHighlight = ref(-1)
const showRecent = ref(false)
const searchWrapRef = ref<HTMLElement | null>(null)

// ── 最近搜索（最多30条，存 localStorage） ──
const RECENT_KEY = 'sgbuddy-recent-searches'
const MAX_RECENT = 30
const recentSearches = ref<string[]>([])

function loadRecentSearches() {
  try {
    recentSearches.value = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
  } catch { recentSearches.value = [] }
}

function addRecentSearch(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return
  // 去重：已有则移到最前
  const idx = recentSearches.value.indexOf(trimmed)
  if (idx >= 0) recentSearches.value.splice(idx, 1)
  recentSearches.value.unshift(trimmed)
  if (recentSearches.value.length > MAX_RECENT) recentSearches.value.length = MAX_RECENT
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recentSearches.value)) } catch { /* ignore */ }
}

function clearRecentSearches() {
  recentSearches.value = []
  try { localStorage.removeItem(RECENT_KEY) } catch { /* ignore */ }
}

// 点击搜索区域外部时关闭 SUG / 最近搜索 下拉
function onDocumentClick(e: MouseEvent) {
  if (searchWrapRef.value && !searchWrapRef.value.contains(e.target as Node)) {
    sugVisible.value = false
    showRecent.value = false
  }
  if (rangeDropdownRef.value && !rangeDropdownRef.value.contains(e.target as Node)) {
    showRangeDropdown.value = false
  }
}
// ── 预计算名称索引：从 price_params 实时查名字并去重（同主搜索一致，按当前大区过滤）
// 名字→拼音是确定且与大区无关的：跨大区切换/多次重建 nameIndex 时复用缓存，
// 避免每次都对整库名字重复跑 tiny-pinyin（切大区主线程卡顿主因之一）。
const namePyCache = new Map<string, { py: string; fullPy: string }>()
function pinyinOf(name: string) {
  let hit = namePyCache.get(name)
  if (!hit) {
    hit = { py: toPinyinInitials(name), fullPy: toFullPinyin(name) }
    namePyCache.set(name, hit)
  }
  return hit
}
const nameIndex = computed(() => {
  const result: Array<{ name: string; slot: string; py: string; fullPy: string }> = []
  const seen = new Set<string>()
  const sid = effectiveServerId.value
  for (const p of prices.value) {
    if (sid > 0 && p.server_id !== sid) continue
    if (seen.has(p.item_name)) continue
    seen.add(p.item_name)
    const pyp = pinyinOf(p.item_name)
    result.push({ name: p.item_name, slot: p.category, py: pyp.py, fullPy: pyp.fullPy })
  }
  return result
})

// ── 拼音快速查找 Map（供 mergedList 搜索过滤使用）───
const pinyinMap = computed(() => {
  const map = new Map<string, { py: string; fullPy: string }>()
  for (const item of nameIndex.value) {
    map.set(item.name, { py: item.py, fullPy: item.fullPy })
  }
  return map
})

// SUG 候选：使用预计算名称索引，支持中文和拼音首字母匹配（同时匹配名称和分类）
const sugItems = computed(() => {
  const raw = searchText.value.trim()
  if (!raw) return []
  const kw = raw.toLowerCase()
  const max = 50
  const result: Array<{ name: string; py: string; slot: string }> = []
  for (const item of nameIndex.value) {
    if (item.name.includes(raw) || item.slot.includes(raw) || item.py.includes(kw) || item.fullPy.includes(kw)) {
      result.push({ name: item.name, py: item.py, slot: item.slot })
      if (result.length >= max) break
    }
  }
  return result
})
const sugTotal = computed(() => {
  // 统计总匹配数（仅在有搜索词时计算，用于展示"还有N条"提示）
  if (!searchText.value.trim()) return 0
  const kw = searchText.value.trim().toLowerCase()
  const raw = searchText.value.trim()
  let count = 0
  for (const item of nameIndex.value) {
    if (item.name.includes(raw) || item.slot.includes(raw) || item.py.includes(kw) || item.fullPy.includes(kw)) {
      count++
      if (count > 500) break // 防遍历过大
    }
  }
  return count
})

// 输入改变时自动控制下拉显隐
watch(searchText, (val) => {
  if (!val.trim()) {
    sugVisible.value = false
    showRecent.value = recentSearches.value.length > 0
    return
  }
  showRecent.value = false
  sugVisible.value = sugItems.value.length > 0
  sugHighlight.value = -1
})

// ESC 关闭价格表单弹窗；Ctrl+V 粘贴图片（统一经 IPC 读真实剪贴板：有图即识别，无图回退文本粘贴）
// 不依赖 clipboardData.types/files 判断——Electron 中 types 可能为 ["Files"]，微信/QQ 截图 DIB 图 files 为空
watch(showPriceForm, (visible) => {
  const onPaste = (e: ClipboardEvent) => {
    // 仅当焦点在可输入元素时才拦截（弹窗内输入框），否则交系统默认处理
    const el = document.activeElement as HTMLElement | null
    const canInsert = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    if (!canInsert) return
    e.preventDefault()
    pasteFromClipboard(e)
  }
  if (visible) {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') showPriceForm.value = false }
    document.addEventListener('keydown', onKey, { once: true })
    document.addEventListener('paste', onPaste)
    // 自动聚焦物品名称输入框（弹窗打开即就绪，Ctrl+V 无需手动点输入框）
    nextTick(() => { nameInputRef.value?.focus() })
  } else {
    document.removeEventListener('paste', onPaste)
    // 关闭即清空图片与 OCR 状态（覆盖复制/编辑等未重置入口，避免重开残留多张图）
    formImages.value = []
    pendingImages.value = []
    ocrBusy.value = false
    ocrProgress.value = null
    ocrError.value = ''
    ocrText.value = ''
    ocrFields.value = new Set()
    ocrSimilar.value = []
    lastOcrThumb.value = null
  }
})

function onSearchFocus() {
  if (searchText.value) {
    if (sugItems.value.length > 0) sugVisible.value = true
  } else {
    // 无输入内容时展示最近搜索
    showRecent.value = recentSearches.value.length > 0
  }
}

function selectSug(name: string) {
  searchText.value = name
  priceSearch.value = name
  sugVisible.value = false
  showRecent.value = false
  addRecentSearch(name)
}

let searchDebounce: ReturnType<typeof setTimeout> | null = null
function onSearchInput() {
  // 输入时防抖 300ms 自动搜索（不依赖 SUG）
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    priceSearch.value = searchText.value.trim()
  }, 300)
}

function onSearchEnter() {
  if (searchDebounce) { clearTimeout(searchDebounce); searchDebounce = null }
  if (sugItems.value.length > 0) {
    // 有 SUG 匹配：选中高亮项或第一项
    selectSug(sugItems.value[sugHighlight.value >= 0 ? sugHighlight.value : 0].name)
  } else {
    // 无 SUG 匹配：直接用输入文本搜索
    const q = searchText.value.trim()
    priceSearch.value = q
    sugVisible.value = false
    showRecent.value = false
    if (q) addRecentSearch(q)
  }
}

function clearSearch() {
  searchText.value = ''
  priceSearch.value = ''
  sugVisible.value = false
  // 清空后若未失焦则展示最近搜索
  showRecent.value = recentSearches.value.length > 0
}

const encycSlots = ['武器', '头盔', '上装', '下装', '护手', '鞋子', '面具', '项链', '戒指']
const encycData = ref<Array<{ name: string; slot: string; level: number; job_limit: string; category: string; grade?: number; drop_sources?: string; _source: 'equipment' | 'material' }>>([])

// 从物品名称智能解析等级/部位（如 "100级橙色武器" → "100级 / 武器"）
const ALL_SLOTS_FOR_PARSE = ['武器','头盔','上装','下装','护手','鞋子','面具','项链','戒指','翅膀','符咒','灵魄','八阵图','子女','灵兽','元神','灵珠','奥义']
function parseLevelSlot(name: string): string {
  const lvMatch = name.match(/(\d+)级/)
  const level = lvMatch ? lvMatch[1] : null
  let slot = ''
  for (const s of ALL_SLOTS_FOR_PARSE) {
    if (name.includes(s)) { slot = s; break }
  }
  if (level && slot) return `${level}级 / ${slot}`
  if (level) return `${level}级`
  if (slot) return slot
  return ''
}

// 图鉴索引（装备/特殊/材料 按 name 分组）仅依赖静态图鉴数据，与大区/筛选无关：
// 提到组件级缓存，避免每次切换大区/筛选时都在 mergedList 里重建这份 Map。
const ENCYC_EQUIP_SLOTS = ['武器','头盔','上装','下装','护手','鞋子','面具','项链','戒指']
const ENCYC_SPECIAL_SLOTS = ['翅膀','符咒','灵魄','八阵图','子女','灵兽','元神','灵珠','奥义','羽灵']
const encycIndex = computed(() => {
  const idx = new Map<string, { name: string; slot: string; level: number; job_limit: string; category: string; grade?: number; drop_sources?: string; _source: string }>()
  for (const e of encycData.value) {
    const isEquip = ENCYC_EQUIP_SLOTS.includes(e.slot)
    const isSpecial = ENCYC_SPECIAL_SLOTS.includes(e.slot)
    const k = isEquip ? `装备:${e.name}` : (isSpecial ? `${e.slot}:${e.name}` : `材料:${e.name}`)
    if (!idx.has(k)) idx.set(k, e)
    if (isSpecial) {
      const k2 = `其他:${e.name}`
      if (!idx.has(k2)) idx.set(k2, e)
    }
  }
  return idx
})

  const mergedList = computed(() => {
    const cat = priceCategoryFilter.value
    let items: Array<{ _key: string; _baseName: string; item_name: string; category: string; _detail: string; quality: string; craft_level: string; attr_notes: string; benchmark_price: number; market_price: number; profit_margin: number | null; updated_at: string; is_hot: number; price_id: number }> = []

    // ── 分类映射：旧分类 → 新三分类
    const knownCats = new Set(['装备', '材料', '灵魄', '八阵图', '子女', '奥义', '灵珠', '羽灵', '元神', '灵兽'])
    const mapCat = (c: string) => knownCats.has(c) ? c : '其他'

    // ═══════════════════════════════════════
    // 以 price_params 记录为驱动，一行一条
    // ═══════════════════════════════════════
    const filteredPrices = prices.value.filter(p => {
      if (effectiveServerId.value > 0 && p.server_id !== effectiveServerId.value) return false
      return !cat || mapCat(p.category) === cat
    })

    const encycByKey = encycIndex.value
    for (const p of filteredPrices) {

      // 查找匹配的图鉴条目
      const encycKey = p.category === '装备'
        ? `装备:${p.item_name}`
        : `${p.category}:${p.item_name}`
      const encyc = encycByKey.get(encycKey)

      const margin = p.benchmark_price > 0 && p.market_price > 0
        ? Math.round(((p.market_price - p.benchmark_price) / p.benchmark_price) * 10000) / 100
        : null

      items.push({
        _key: `price-${p.id}`,
        _baseName: p.item_name,
        item_name: p.item_name,
        category: p.category,
                _detail: (() => {
          const storedLv = (p as any).equip_level || 0
          const storedJob = (p as any).equip_job || ''
          if (encyc) {
            if (ENCYC_EQUIP_SLOTS.includes(encyc.slot)) {
              let detail = `${storedLv || encyc.level}级 / ${encyc.slot}`
              const jobLabel = storedJob || encyc.job_limit || ''
              if (jobLabel) detail += ` · ${jobLabel}`
              return detail
            }
            return encyc.drop_sources || ''
          }
          if (storedLv) {
            const slotMatch = p.item_name.match(new RegExp(ALL_SLOTS_FOR_PARSE.join('|')))
            const slotPart = slotMatch ? ` / ${slotMatch[0]}` : ''
            const jobPart = storedJob ? ` · ${storedJob}` : ''
            return `${storedLv}级${slotPart}${jobPart}`
          }
          return p.category === '装备'
            ? (parseLevelSlot(p.item_name) || [p.quality, p.craft_level, p.attr_notes].filter(Boolean).join(' / ') || '-')
            : (parseLevelSlot(p.item_name) || '-')
        })(),
        quality: p.quality || '',
        craft_level: p.craft_level || '',
        attr_notes: p.attr_notes || '',
        benchmark_price: p.benchmark_price,
        market_price: p.market_price || 0,
        profit_margin: margin,
        updated_at: p.updated_at || '',
        is_hot: p.is_hot || 0,
        price_id: p.id,
      })
    }

  if (priceSearch.value) {
    const raw = priceSearch.value.toLowerCase()
    // 别名映射
    const aliasMap: Record<string, string> = {
      // 翅膀 1c-6c
      '1c':'1阶 翅膀','2c':'2阶 翅膀','3c':'3阶 翅膀','4c':'4阶 翅膀','5c':'5阶 翅膀','6c':'6阶 翅膀',
      // 符咒 1f-6f
      '1f':'1级 符咒','2f':'2级 符咒','3f':'3级 符咒','4f':'4级 符咒','5f':'5级 符咒','6f':'6级 符咒',
      // 品质简写
      'hh':'红色','ch':'橙色','hs2':'黄色','lv':'绿色','lan':'蓝色','zi':'紫色',
      // 部位简写
      'wq':'武器','tk':'头盔','sz':'上装','xz':'下装','hs':'护手','xie':'鞋子',
      'mj':'面具','xl':'项链','jz':'戒指','cb':'翅膀','fz':'符咒',
      // 品类简写
      'lp':'灵魄','bz':'八阵图','bzt':'八阵图','ls':'灵兽','ys':'元神','yse':'元神',
      'lz':'灵珠','ay':'奥义','zn':'子女','cl':'材料','xhp':'消耗品',
      // 职业简写
      'js':'剑侍','hj':'豪杰','yy':'阴阳士','xs':'仙术士','yx':'游侠','hl':'唤灵',
      // 打造简写
      'jz2':'精致','hr':'浑然','gs':'鬼神','wm':'完美','tc':'天赐',
      '4m':'四满','5m':'五满','6m':'六满','8m':'八满',
      // 品质+等级快捷
      'hswq':'黄色武器','chwq':'橙色武器','hhwq':'红色武器',
      // 灵魄
      'px':'破风','pk':'破空','fx':'奋迅','jw':'禁卫','sn':'杀戮','ys2':'野兽',
      // 翅膀名
      'fzy':'枫之羽','dyz':'蝶之羽','yy2':'月影枫痕羽','xm':'晓梦迷蝶羽',
      'yl':'幽灵碧焰羽','hl2':'幻灵虹霓羽','xy':'血影冥光翼','xy2':'玄影伽蓝翼',
      'ts':'战天使之翼','ct':'炽天使之翼','ha':'黑暗之翼',
      // 八阵图
      '36g':'36攻','54g':'54攻','72g':'72攻',
      // 奥义
      'sb':'三板斧','sb2':'双满','3m2':'三满','5m2':'五满','dwm':'大完美','qt':'拳头',
      // 五虎元神
      'gy':'关羽','zf':'张飞','zy':'赵云','mc':'马超','hz':'黄忠','xhd':'夏侯惇','lx':'陆逊','dq':'大乔',
    }
    const kw = aliasMap[raw] || raw
    items = items.filter(i => {
      const txt = (i.item_name + ' ' + i.category + ' ' + i._detail + ' ' + (i.quality||'') + ' ' + (i.craft_level||'')).toLowerCase()
      if (txt.includes(kw)) return true
      const pinyin = pinyinMap.value.get(i._baseName)
      return pinyin ? (pinyin.py.includes(kw) || pinyin.fullPy.includes(kw)) : false
    })
  }
  if (hotFilterOnly.value) {
    items = items.filter(i => i.is_hot)
  }
  if (shopItemsOnly.value) {
    items = items.filter(i => inventoryNames.value.has(i._baseName))
  }
  // 市场价区间筛选（多选，OR 逻辑）
  if (priceRangeFilter.value.length > 0) {
    items = items.filter(i => {
      const price = i.market_price // 单位：亿
      return priceRangeFilter.value.some(range => {
        switch (range) {
          case '0-1wan':    return price >= 0 && price < 0.0001
          case '1-10wan':   return price >= 0.0001 && price < 0.001
          case '10-100wan': return price >= 0.001 && price < 0.01
          case '100-1000wan': return price >= 0.01 && price < 0.1
          case '1000wan-1yi': return price >= 0.1 && price < 1
          case '1-10yi':    return price >= 1 && price < 10
          case '10yi+':     return price >= 10
          default:          return true
        }
      })
    })
  }
  if (sortField.value) {
    items.sort((a, b) => {
      let va: number, vb: number
      if (sortField.value === 'profit_margin') {
        va = a.profit_margin ?? -9999
        vb = b.profit_margin ?? -9999
      } else if (sortField.value === 'market_price') {
        va = a.market_price || 0
        vb = b.market_price || 0
      } else {
        va = a.updated_at ? new Date(a.updated_at).getTime() : 0
        vb = b.updated_at ? new Date(b.updated_at).getTime() : 0
      }
      const dir = sortDir.value === 'desc' ? -1 : 1
      return va > vb ? dir : va < vb ? -dir : 0
    })
  } else {
    // 默认按 id 降序（最新录入的在前）
    items.sort((a, b) => {
      const va = a.price_id as number
      const vb = b.price_id as number
      return vb - va
    })
  }
  totalResultCount.value = items.length
  return items.slice(0, 500)
})

async function editPriceById(row: { item_name: string; category: string; quality: string; craft_level: string; attr_notes: string; price_id: number; _detail?: string }) {
  const p = prices.value.find(x => x.id === row.price_id)
  if (p) { openPriceForm(p); return }
  // 在 prices 内存中未找到，从数据库直接查询该记录
  try {
    const rows = await window.electronAPI.dbQuery(
      'SELECT * FROM price_params WHERE id=?',
      [row.price_id]
    ) as PriceRecord[]
    if (rows && rows.length > 0) { openPriceForm(rows[0]); return }
  } catch { /* ignore */ }
}

async function toggleHotOrAdd(row: { price_id: number; is_hot: number }) {
  const p = prices.value.find(x => x.id === row.price_id)
  if (p) { toggleHot(p) }
}

async function loadEncycData() {
  try {
    const mat = await window.electronAPI.dbQuery(
      "SELECT name, category, grade, drop_sources FROM material_library ORDER BY category, grade"
    ) as any[]
    encycData.value = mat.map((m: any) => ({ ...m, slot: m.category, level: 0, job_limit: '', _source: 'material' as const }))
  } catch (e) { console.error('加载图鉴失败:', e) }
}

// ── 图片相关 ──
// 待保存图片队列（与 formImages 一一对应）：文件路径或剪贴板 buffer
const pendingImages = ref<Array<{ kind: 'file'; src: string } | { kind: 'buffer'; png: Uint8Array }>>([])

async function addImage() {
  const src = await window.electronAPI.selectImage()
  if (!src) return
  const dataUrl = await window.electronAPI.readImage(src)
  if (dataUrl) {
    // 每个物品只能有一张图片：先清除已有
    formImages.value = []
    pendingImages.value = []
    const entry = { path: dataUrl }
    formImages.value.push(entry)
    pendingImages.value.push({ kind: 'file', src })
    await ocrThumbnail(entry)
  }
}
let pasteBusy = false
async function pasteFromClipboard(e?: ClipboardEvent) {
  if (pasteBusy) return
  pasteBusy = true
  try {
    // 必须在异步 IPC 之前同步读取事件文本数据，否则 clipboardData 会被清空
    const eventText = e ? (e.clipboardData?.getData('text') || '') : ''
    // 先尝试读取剪贴板图片
    const img = await window.electronAPI.readClipboardImage()
    if (!img) {
      // 剪贴板无图片 → 获取文本：事件文本（已同步取出）> IPC 读剪贴板文本
      const text = eventText || (await window.electronAPI.readClipboardText() || '')
      if (text) {
        // 粘贴到当前聚焦的输入框，若不可用则回退到物品名称输入框
        const active = document.activeElement as HTMLInputElement | null
        const el = (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable))
          ? active : nameInputRef.value
        if (el) {
          const start = el.selectionStart ?? el.value.length
          const end = el.selectionEnd ?? el.value.length
          el.value = el.value.slice(0, start) + text + el.value.slice(end)
          el.dispatchEvent(new Event('input', { bubbles: true }))
          el.setSelectionRange(start + text.length, start + text.length)
          el.focus()
        }
      } else if (!e) {
        // 按钮点击且剪贴板中无图片也无文字
        ocrError.value = '剪贴板中没有图片或文字'
      }
      return
    }
    console.log(`[OCR] 剪贴板图片 ${img.png.length} bytes`)
    formImages.value = []
    pendingImages.value = []
    const entry = { path: img.dataUrl }
    formImages.value.push(entry)
    pendingImages.value.push({ kind: 'buffer', png: img.png })
    await ocrThumbnail(entry)
  } finally {
    pasteBusy = false
  }
}
async function removeFormImage(idx: number) {
  const img = formImages.value[idx]
  if (img?.id) {
    await window.electronAPI.deleteImage(img.id)
    // refresh cache for this record
    if (editingPrice.value?.id) imageCache.value.delete(`p${editingPrice.value.id}`)
    if (priceForm.value.item_name) imageCache.value.delete(priceForm.value.item_name)
  } else if (idx < pendingImages.value.length) {
    pendingImages.value.splice(idx, 1)
  }
  formImages.value.splice(idx, 1)
}
// 图片缓存键：新图按 price_id（p{id}），旧图（price_id 为空）回退 item_name
function imageCacheKey(priceId: number, itemName: string): string {
  return priceId ? `p${priceId}` : itemName
}
async function loadItemImages(priceId: number, itemName: string): Promise<string[]> {
  const key = imageCacheKey(priceId, itemName)
  if (imageCache.value.has(key)) {
    const cached = imageCache.value.get(key)!
    if (cached.length > 0 && !cached[0].startsWith('data:')) {
      // stale cache from old loadImageCache, refresh
      imageCache.value.delete(key)
    } else if (cached.length > 0) {
      return cached
    }
  }
  let rows = await window.electronAPI.listImages(itemName, priceId || undefined)
  // 旧数据（图片未绑定 price_id）：仅回退查未绑定的行，避免拿到其他同名记录的图
  if (rows.length === 0 && priceId) {
    rows = await window.electronAPI.dbQuery(
      'SELECT id, image_path, sort_order FROM equipment_images WHERE item_name=? AND price_id IS NULL ORDER BY sort_order',
      [itemName]
    ) as Array<{ id: number; image_path: string; sort_order: number }>
  }
  const dataUrls = (await Promise.all(rows.map(async r => await window.electronAPI.readImage(r.image_path)))).filter(Boolean) as string[]
  if (dataUrls.length > 0) {
    imageCache.value.set(key, dataUrls)
  } else {
    // 实际查无图片（记录无图/文件已丢失），清除标记避免物品列误显示 🖼
    imageCache.value.delete(key)
  }
  return dataUrls
}
function hasImage(priceId: number, itemName: string): boolean {
  // 新数据按 price_id 精确匹配；旧数据（图片未绑定 price_id）回退按 item_name 匹配
  return priceId
    ? imageCache.value.has(`p${priceId}`) || imageCache.value.has(itemName)
    : imageCache.value.has(itemName)
}
async function openImageViewer(priceId: number, itemName: string) {
  viewerImages.value = await loadItemImages(priceId, itemName)
  if (viewerImages.value.length) viewerVisible.value = true
}
function viewImage(dataUrl: string) {
  viewerImages.value = [dataUrl]
  viewerVisible.value = true
}
async function saveFormImages(itemName: string, priceId?: number) {
  const hasPending = pendingImages.value.length > 0
  for (const pend of pendingImages.value) {
    if (pend.kind === 'file') {
      await window.electronAPI.saveImage(itemName, pend.src, priceId)
    } else {
      await window.electronAPI.saveImageBuffer(itemName, pend.png, priceId)
    }
  }
  pendingImages.value = []
  // 仅当确实保存了图片才标记"已有图"；无图记录（含编辑时删图）不标记，否则物品列会误显示 🖼
  if (hasPending) {
    const key = imageCacheKey(priceId || 0, itemName)
    imageCache.value.set(key, [])
  }
}
async function loadFormImages(itemName: string, priceId?: number) {
  formImages.value = []
  pendingImages.value = []
  if (!itemName) return
  let rows = await window.electronAPI.listImages(itemName, priceId || undefined)
  // 旧数据（图片未绑定 price_id）：仅回退查未绑定的行，避免显示其他同名记录的图
  if (rows.length === 0 && priceId) {
    rows = await window.electronAPI.dbQuery(
      'SELECT id, image_path, sort_order FROM equipment_images WHERE item_name=? AND price_id IS NULL ORDER BY sort_order',
      [itemName]
    ) as Array<{ id: number; image_path: string; sort_order: number }>
  }
  for (const r of rows) {
    const dataUrl = await window.electronAPI.readImage(r.image_path)
    if (dataUrl) formImages.value.push({ id: r.id, path: dataUrl, relPath: r.image_path })
  }
}

// ── OCR 识别 ──
const ocrBusy = ref(false)
const ocrProgress = ref<{ stage: 'startup' | 'download' | 'recognize'; percent: number } | null>(null)
const ocrError = ref('')
const ocrText = ref('')
const ocrFields = ref<Set<string>>(new Set()) // 来自 OCR 预填的字段（打角标）
const ocrSimilar = ref<string[]>([]) // 与识别名称相似的已有记录
const lastOcrThumb = ref<{ id?: number; path: string; relPath?: string } | null>(null)

async function dataUrlToPng(dataUrl: string): Promise<Uint8Array> {
  const resp = await fetch(dataUrl)
  return new Uint8Array(await resp.arrayBuffer())
}

async function ocrThumbnail(img: { id?: number; path: string; relPath?: string }) {
  console.log(`[OCR] 开始识别 ${img.id ? `已入库图片 ${img.relPath}` : '剪贴板/新图片'}`)
  ocrBusy.value = true
  ocrError.value = ''
  ocrProgress.value = null
  lastOcrThumb.value = img
  try {
    // 全文 OCR + parseOcrText 字段提取（所有品类统一走这条路）
    const input = img.id && img.relPath
      ? { kind: 'path' as const, path: img.relPath }
      : { kind: 'buffer' as const, data: await dataUrlToPng(img.path) }
    const res = await window.electronAPI.ocrRecognize(input)
    if (res.error) { console.error('[OCR] 失败:', res.error); ocrError.value = res.error; return }
    ocrText.value = res.text
    if (!res.text.trim()) { console.warn('[OCR] 未识别到文字'); ocrError.value = '未识别到文字，请换更清晰的图片'; return }
    console.log('[OCR] 识别成功，解析字段 →', JSON.stringify(parseOcrText(res.text).matched), res.qualityColor ? `| 颜色品质: ${res.qualityColor}` : '')
    applyOcrFields(res.text, res.qualityColor)
  } catch (e: any) {
    console.error('[OCR] 异常:', e)
    ocrError.value = e?.message || '识别失败'
  } finally {
    ocrBusy.value = false
  }
}

function applyOcrFields(text: string, qualityColor = '') {
  const parsed = parseOcrText(text)
  ocrFields.value = new Set(parsed.matched)
  const f = priceForm.value
  if (parsed.category) f.category = parsed.category
  if (parsed.item_name) f.item_name = parsed.item_name
  // 品质：优先文字识别结果，其次名称行文字颜色（游戏品质主要靠颜色区分）
  if (parsed.quality) f.quality = parsed.quality
  else if (qualityColor) {
    f.quality = qualityColor
    ocrFields.value.add('quality')
  }
  if (parsed.craft_level) f.craft_level = parsed.craft_level
  if (parsed.matched.includes('equip_job') || parsed.equip_job) f.equip_job = parsed.equip_job
  if (parsed.equip_level > 0) f.equip_level = parsed.equip_level
  if (parsed.slot) f.slot = parsed.slot
  if (parsed.spirit_position) f.spirit_position = parsed.spirit_position
  // 已有类似记录提示（防重复录入）
  ocrSimilar.value = []
  if (parsed.item_name) {
    ocrSimilar.value = prices.value
      .map(p => p.item_name)
      .filter((n, i, arr) => arr.indexOf(n) === i)
      .filter(n => n.includes(parsed.item_name) || parsed.item_name.includes(n))
      .slice(0, 3)
    // 名称命中已有记录时，未识别的字段（部位/品质/等级/职业）从记录补全
    fillFromExistingRecord(parsed.item_name)
  }
}

/** 从已有价格记录补全未填字段（tooltip 常无部位文字，靠名称查库） */
function fillFromExistingRecord(name: string) {
  const rec = prices.value.find(p => p.item_name === name)
  if (!rec) return
  const f = priceForm.value
  const mark = (k: string) => { ocrFields.value.add(k) }
  if (!f.category && rec.category) { f.category = rec.category; mark('category') }
  if (!f.slot && rec.slot) { f.slot = rec.slot; mark('slot') }
  if (!f.quality && rec.quality) { f.quality = rec.quality; mark('quality') }
  if (!f.equip_level && rec.equip_level) { f.equip_level = rec.equip_level; mark('equip_level') }
  if (!f.equip_job && rec.equip_job) { f.equip_job = rec.equip_job; mark('equip_job') }
  if (!f.spirit_position && rec.spirit_position) { f.spirit_position = rec.spirit_position; mark('spirit_position') }
}

function openPriceForm(existing?: PriceRecord) {
  saveError.value = ''
  formImages.value = []
  pendingImages.value = []
  ocrBusy.value = false
  ocrProgress.value = null
  ocrError.value = ''
  ocrText.value = ''
  ocrFields.value = new Set()
  ocrSimilar.value = []
  lastOcrThumb.value = null
  if (existing) {
    editingPrice.value = existing
    priceForm.value = {
      item_name: existing.item_name, category: existing.category,
      quality: existing.quality || '', craft_level: existing.craft_level || '',
      attr_notes: existing.attr_notes || '',
      benchmark_price: Math.round(existing.benchmark_price * 10000 * 1000) / 1000,
      market_price: Math.round((existing.market_price || 0) * 10000 * 1000) / 1000,
      equip_level: existing.equip_level || 0,
      equip_job: existing.equip_job || '',
      spirit_position: existing.spirit_position || '',
      slot: existing.slot || '',
    }
    loadFormImages(existing.item_name, existing.id)
  } else {
    editingPrice.value = null
    priceForm.value = { item_name: '', category: '装备', quality: '', craft_level: '', attr_notes: '', benchmark_price: 0, market_price: 0, slot: '', equip_level: 0, equip_job: '', spirit_position: '' }
  }
  showPriceForm.value = true
}

const saveError = ref('')

async function ensureItemInCatalog(category: string, itemName: string, quality: string, craftLevel: string, attrNotes: string, spiritPosition: string = '', slot: string = '') {
  try {
    await window.electronAPI.dbQuery(
      `INSERT OR IGNORE INTO item_catalog (category, item_name, quality, craft_level, attr_notes, attrs, spirit_position, slot) VALUES (?,?,?,?,?,?,?,?)`,
      [category, itemName, quality || '', craftLevel || '', attrNotes || '', spiritPosition || '', slot || '']
    )
    // 同步更新同名物品的 spirit_position（同名物品可能有不同品质/词条组合，位置应一致）
    if (spiritPosition) {
      await window.electronAPI.dbQuery(
        `UPDATE item_catalog SET spirit_position=? WHERE category=? AND item_name=? AND spirit_position!=?`,
        [spiritPosition, category, itemName, spiritPosition]
      )
    }
  } catch (e) {
    console.warn('[物品目录] 写入失败:', e)
  }
}

async function savePrice() {
  const f = priceForm.value
  const sid = effectiveServerId.value
  saveError.value = ''
  if (!sid) { saveError.value = '请先在侧边栏或筛选栏选择一个大区'; return }
  if (!f.item_name) { saveError.value = '请填写物品名称'; return }
  const bv = fromWan(String(f.benchmark_price))
  const mv = fromWan(String(f.market_price))
  const targetId = editingPrice.value?.id ?? 0

  // 该物品历史价格（去重）≥5 个时，成本价若未赋值则自动取最低市场价
  let finalBv = bv
  if (bv <= 0 && mv > 0 && targetId > 0) {
    try {
      const historyPrices = await window.electronAPI.dbQuery(
        `SELECT DISTINCT market_price FROM price_history WHERE price_param_id=? AND market_price > 0`,
        [targetId]
      ) as Array<{ market_price: number }>
      const distinctPrices = new Set(historyPrices.map(r => r.market_price))
      distinctPrices.add(mv)
      if (distinctPrices.size >= 5) {
        finalBv = Math.min(...distinctPrices)
        console.log('[物价] 自动填成本价: %s 历史去重 %d 个市场价, 最低=%s亿', f.item_name, distinctPrices.size, finalBv)
      }
    } catch { /* 查询失败不影响主流程 */ }
  }
  // 市场价低于成本价时，自动将成本价降至市场价
  if (finalBv > mv && mv > 0) {
    finalBv = mv
  }
  const lv = f.equip_level || 0
  const job = f.equip_job || ''
  const sp = f.spirit_position || ''
  const sl = f.slot || ''

  // 仅在纯新增（无已有记录）时注册到全局物品目录
  if (targetId <= 0) {
    await ensureItemInCatalog(f.category, f.item_name, f.quality, f.craft_level, f.attr_notes, sp, sl)
  }

  // 更新前记录历史（仅当已有记录时）
  if (targetId > 0) {
    await recordPriceHistory(targetId)
  }

  const sql = targetId > 0
    ? `UPDATE price_params SET item_name=?,category=?,quality=?,craft_level=?,attr_notes=?,benchmark_price=?,market_price=?,slot=?,equip_level=?,equip_job=?,spirit_position=?,updated_at=datetime('now','localtime') WHERE id=?`
    : `INSERT INTO price_params (item_name,category,server_id,quality,craft_level,attr_notes,benchmark_price,market_price,slot,equip_level,equip_job,spirit_position,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now','localtime'))`
  const params = targetId > 0
    ? [f.item_name, f.category, f.quality, f.craft_level, f.attr_notes, finalBv, mv, sl, lv, job, sp, targetId]
    : [f.item_name, f.category, sid, f.quality, f.craft_level, f.attr_notes, finalBv, mv, sl, lv, job, sp]
  console.log('[物价] %s id=%s benchmark=%s亿 market=%s亿 level=%s job=%s', targetId > 0 ? 'UPDATE' : 'INSERT', targetId || 'NEW', finalBv, mv, lv || '-', job || '-')
  try {
    const r = await window.electronAPI.dbQuery(sql, params) as any
    if (!r?.changes) { saveError.value = '未写入任何记录，请检查数据'; return }
    // 新增记录用 lastInsertRowid，编辑用已有 id
    const savedId = targetId > 0 ? targetId : (r?.lastInsertRowid as number)
    await saveFormImages(f.item_name, savedId || undefined)
    showPriceForm.value = false
    await loadPrices()
    appStore.bumpPriceDataVersion() // 通知配号中心等页面刷新参考数据
    // 反向同步：市场价变更 → 更新商行库存中同名物品的买入价
    await syncMarketToInventory(f.item_name, sid, mv)
  } catch (e: any) { saveError.value = '保存失败: ' + (e.message || e); console.error('[物价] 保存异常:', e) }
}

async function deletePrice(id: number) {
  try {
    console.log('[删除] 删除价格记录 id=%s', id)
    const r = await window.electronAPI.dbQuery('DELETE FROM price_params WHERE id=?', [id]) as any
    console.log('[删除] 结果: changes=%s', r?.changes)
    await loadPrices()
    appStore.bumpPriceDataVersion()
  } catch (e) { console.error('删除失败:', e) }
}

const hasActiveFilters = computed(() => {
  return priceSearch.value || priceCategoryFilter.value || priceRangeFilter.value.length > 0 || hotFilterOnly.value
})

function clearFilters() {
  searchText.value = ''
  priceSearch.value = ''
  sugVisible.value = false
  priceCategoryFilter.value = ''
  priceRangeFilter.value = []
  hotFilterOnly.value = false
}

// ── 表格动态分页：切大区 / 筛选 / 排序只先渲染首屏，滚动到底才逐批追加，
// 避免整份大区列表一次性挂载（几百行 input + SVG 走势图）造成卡顿 ──
const RENDER_STEP = 120
const visibleCount = ref(RENDER_STEP)
const tableWrapRef = ref<HTMLElement | null>(null)
let pageRafId = 0

const displayList = computed(() => mergedList.value.slice(0, visibleCount.value))
const hasMoreRows = computed(() => visibleCount.value < mergedList.value.length)

function growPage() {
  const list = mergedList.value
  if (visibleCount.value < list.length) {
    visibleCount.value = Math.min(visibleCount.value + RENDER_STEP, list.length)
  }
}

// 一屏铺不满（列表较大但首屏未出现滚动条）时，逐帧补行直到可滚动或到底，
// 避免"看着像被截断"；一旦可滚动即停，其余交给滚动加载，控制 DOM 常驻规模。
function ensureScrollable() {
  const el = tableWrapRef.value
  if (!el || pageRafId) return
  const list = mergedList.value
  if (visibleCount.value >= list.length) return
  if (el.scrollHeight <= el.clientHeight) {
    growPage()
    pageRafId = requestAnimationFrame(() => { pageRafId = 0; ensureScrollable() })
  }
}

// 滚动接近底部 → 追加一批
function onTableScroll() {
  const el = tableWrapRef.value
  if (!el || !hasMoreRows.value || pageRafId) return
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 160) {
    pageRafId = requestAnimationFrame(() => { pageRafId = 0; growPage() })
  }
}

// 查询上下文（大区 + 搜索/分类/热门/区间 + 排序）变化 → 整批内容更换，回到首屏重新分页
const queryContext = computed(() =>
  [effectiveServerId.value, priceSearch.value, priceCategoryFilter.value,
   priceRangeFilter.value.join(','), hotFilterOnly.value, shopItemsOnly.value,
   sortField.value ?? '', sortDir.value].join('|')
)
watch(queryContext, () => {
  // 大区/筛选/排序切换 = 换一批数据，回到首屏从 RENDER_STEP 开始分页
  visibleCount.value = mergedList.value.length
    ? Math.min(RENDER_STEP, mergedList.value.length)
    : RENDER_STEP
  requestAnimationFrame(ensureScrollable)
}, { immediate: true })

// 数据本身变化但查询上下文未变（如某行价格保存后重载、删行）：保持已渲染规模，
// 列表变短时回落，避免只显示到旧截断位置之后露出空白。
watch(mergedList, (list) => {
  if (visibleCount.value > list.length) {
    visibleCount.value = Math.max(RENDER_STEP, list.length)
  }
  requestAnimationFrame(ensureScrollable)
})

// ── Excel 导出 / 导入（表头：物品名称 | 分类 | 品质 | 备注 | 成本价(万) | 市场价(万) | 热门） ──
async function exportPrices() {
  const rows = mergedList.value.map(r => ({
    item_name: r.item_name,
    category: r.category || '',
    quality: r.quality || '',
    attr_notes: r.attr_notes || '',
    benchmark_wan: Number((r.benchmark_price * 10000).toFixed(4)),
    market_wan: Number((r.market_price * 10000).toFixed(4)),
    hot: !!r.is_hot,
  }))
  const r = await window.electronAPI.exportPrices(rows)
  if (!r.ok && r.error !== '已取消') alert('导出失败：' + (r.error || '未知错误'))
}

async function importPrices() {
  const r = await window.electronAPI.importPrices()
  if (!r.ok) {
    if (r.error !== '已取消') alert('导入失败：' + (r.error || '未知错误'))
    return
  }
  const rows = r.rows || []
  if (rows.length === 0) { alert('文件中没有可导入的数据行'); return }

  let added = 0, updated = 0, skipped = 0
  for (const row of rows) {
    if (!row.item_name) { skipped++; continue }
    // 单位换算：Excel 存「万」，库中存「亿」（约定见 AGENTS.md）
    const bench = Number(row.benchmark_wan) || 0
    const mark = Number(row.market_wan) || 0
    const hot = row.hot ? 1 : 0
    const exist = prices.value.find(p =>
      p.item_name === row.item_name &&
      (p.category || '') === (row.category || '') &&
      (p.quality || '') === (row.quality || '')
    )
    try {
      if (exist) {
        await window.electronAPI.dbQuery(
          `UPDATE price_params SET benchmark_price=?, market_price=?, attr_notes=?, is_hot=?, updated_at=datetime('now','localtime') WHERE id=?`,
          [bench / 10000, mark / 10000, row.attr_notes || '', hot, exist.id]
        )
        updated++
      } else {
        await window.electronAPI.dbQuery(
          `INSERT INTO price_params (item_name, category, server_id, quality, attr_notes, benchmark_price, market_price, is_hot, updated_at)
           VALUES (?,?,?,?,?,?,?,?,datetime('now','localtime'))`,
          [row.item_name, row.category || '', appStore.currentServerId, row.quality || '', row.attr_notes || '', bench / 10000, mark / 10000, hot]
        )
        added++
      }
    } catch { skipped++ }
  }
  await loadPrices()
  alert(`导入完成：更新 ${updated} 条，新增 ${added} 条${skipped ? `，跳过 ${skipped} 条无效行` : ''}`)
}

// ── OCR 高精度引擎（下载/安装状态，提示横幅 + 弹窗） ──
const ocrEngineInstalled = ref(true)
const ocrEngineGiteeConfigured = ref(true)
const showOcrEngineModal = ref(false)
const ocrEngineState = ref<'idle' | 'downloading' | 'extracting' | 'done' | 'error'>('idle')
const ocrEngineProgress = ref(0)
const ocrEngineReceived = ref(0)
const ocrEngineTotal = ref(0)
const ocrEngineSpeed = ref(0)
const ocrEngineError = ref('')
// 速度计算用：上一次进度回调的时间戳与已下载字节数（EMA 平滑）
let ocrSpeedSample = { t: 0, bytes: 0 }

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

async function checkOcrEngine() {
  try {
    const st = await window.electronAPI.ocrEngineStatus()
    ocrEngineInstalled.value = st.installed
    ocrEngineGiteeConfigured.value = st.giteeConfigured
  } catch { /* ignore */ }
}

async function downloadOcrEngine() {
  if (ocrEngineState.value === 'downloading' || ocrEngineState.value === 'extracting') return
  ocrEngineState.value = 'downloading'
  ocrEngineError.value = ''
  ocrEngineProgress.value = 0
  ocrEngineReceived.value = 0
  ocrEngineTotal.value = 0
  ocrEngineSpeed.value = 0
  ocrSpeedSample = { t: 0, bytes: 0 }
  const res = await window.electronAPI.downloadOcrEngine()
  if (res.ok) {
    ocrEngineState.value = 'done'
    ocrEngineInstalled.value = true
    // 展示完成状态后自动关闭
    setTimeout(() => { showOcrEngineModal.value = false }, 1500)
  } else {
    ocrEngineState.value = 'error'
    ocrEngineError.value = res.error || '未知错误，请稍后重试'
  }
}

function onOcrEngineProgress(p: { stage: 'downloading' | 'extracting'; received: number; total: number }) {
  if (p.stage === 'downloading') {
    ocrEngineState.value = 'downloading'
    ocrEngineReceived.value = p.received
    ocrEngineTotal.value = p.total
    ocrEngineProgress.value = p.total > 0 ? p.received / p.total : 0
    // 瞬时速度（EMA 平滑），用于提示网速
    const now = Date.now()
    if (ocrSpeedSample.t > 0 && now > ocrSpeedSample.t) {
      const v = (p.received - ocrSpeedSample.bytes) / ((now - ocrSpeedSample.t) / 1000)
      ocrEngineSpeed.value = ocrEngineSpeed.value === 0 ? v : ocrEngineSpeed.value * 0.7 + v * 0.3
    }
    ocrSpeedSample = { t: now, bytes: p.received }
  } else if (p.stage === 'extracting') {
    ocrEngineState.value = 'extracting'
  }
}

// ESC 依次关闭页面内弹窗
function onGlobalKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (showPriceForm.value) showPriceForm.value = false
  else if (showOcrEngineModal.value) showOcrEngineModal.value = false
  else if (showHistoryModal.value) showHistoryModal.value = false
}

function toggleSort(field: 'market_price' | 'profit_margin' | 'updated_at') {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortField.value = field
    sortDir.value = 'desc'
  }
}

async function confirmDeleteItem(row: { item_name: string; price_id: number; _key: string }) {
  confirmingDelete.value = null
  await deleteItem(row)
}

async function deleteItem(row: { item_name: string; price_id: number }) {
  await deletePrice(row.price_id)
}

async function copyItem(row: { item_name: string; category: string; quality: string; craft_level: string; attr_notes: string; benchmark_price: number; market_price: number; price_id: number }) {
  // 弹出录入窗口，预填当前物品属性，编辑后提交新增一条
  editingPrice.value = null // 确保是新增而非编辑
  // 查找原始记录获取装备特有字段
  const orig = prices.value.find(x => x.id === row.price_id)
  priceForm.value = {
    item_name: row.item_name,
    category: row.category,
    quality: row.quality || '',
    craft_level: row.craft_level || '',
    attr_notes: row.attr_notes || '',
        benchmark_price: Math.round(row.benchmark_price * 10000 * 100) / 100,
    market_price: Math.round((row.market_price || 0) * 10000 * 100) / 100,
    equip_level: orig?.equip_level || 0,
    equip_job: orig?.equip_job || '',
    spirit_position: orig?.spirit_position || '',
    slot: orig?.slot || '',
  }
  showPriceForm.value = true
}

async function inlineSavePrice(
  row: { item_name: string; category: string; quality: string; craft_level: string; attr_notes: string; benchmark_price: number; market_price: number; price_id: number },
  field: 'benchmark' | 'market',
  rawValue: string,
  _key: string
) {
  const trimmed = rawValue.trim()
  if (trimmed !== '' && isNaN(parseFloat(trimmed))) return
  const val = fromWan(rawValue)  // 万 → 亿
  const oldVal = field === 'benchmark' ? row.benchmark_price : row.market_price
  if (Math.abs(val - oldVal) < 1e-10) return
  const sid = effectiveServerId.value
  if (!sid) return

  await recordPriceHistory(row.price_id)
  const col = field === 'benchmark' ? 'benchmark_price' : 'market_price'
  await window.electronAPI.dbQuery(
    `UPDATE price_params SET ${col}=?,updated_at=datetime('now','localtime') WHERE id=?`,
    [val, row.price_id]
  )
  // 更新市场价后自动维护成本价
  if (field === 'market' && val > 0) {
    // 情况1：成本价未赋值且历史去重 ≥5 → 自动取最低市场价
    if (row.benchmark_price <= 0) {
      try {
        const historyPrices = await window.electronAPI.dbQuery(
          `SELECT DISTINCT market_price FROM price_history WHERE price_param_id=? AND market_price > 0`,
          [row.price_id]
        ) as Array<{ market_price: number }>
        const distinctPrices = new Set(historyPrices.map(r => r.market_price))
        distinctPrices.add(val)
        if (distinctPrices.size >= 5) {
          const minPrice = Math.min(...distinctPrices)
          await recordPriceHistory(row.price_id)
          await window.electronAPI.dbQuery(
            `UPDATE price_params SET benchmark_price=?,updated_at=datetime('now','localtime') WHERE id=?`,
            [minPrice, row.price_id]
          )
          console.log('[物价] 内联编辑自动填成本价: %s → %s亿', row.item_name, minPrice)
        }
      } catch { /* 查询失败不影响主流程 */ }
    } else if (row.benchmark_price > val) {
      // 情况2：市场价跌到成本价以下 → 成本价跟随下调
      await recordPriceHistory(row.price_id)
      await window.electronAPI.dbQuery(
        `UPDATE price_params SET benchmark_price=?,updated_at=datetime('now','localtime') WHERE id=?`,
        [val, row.price_id]
      )
      console.log('[物价] 市场价低于成本价，自动下调: %s %s→%s亿', row.item_name, row.benchmark_price, val)
    }
  }
  await loadPrices()
  if (field === 'market') {
    await syncMarketToInventory(row.item_name, sid, val)
  }
  flashKey.value = `price-${row.price_id}`
  setTimeout(() => { if (flashKey.value === `price-${row.price_id}`) flashKey.value = null }, 700)
}

async function inlineSaveAttr(
  row: { item_name: string; category: string; quality: string; craft_level: string; attr_notes: string; price_id: number },
  rawValue: string,
  _key: string
) {
  const val = rawValue.trim()
  const sid = effectiveServerId.value
  if (!sid) return
  // 属性/备注列现在仅编辑 attr_notes，craft_level 保持不变（显示在物品列）
  if (val === (row.attr_notes || '')) return

  await recordPriceHistory(row.price_id)
  await window.electronAPI.dbQuery(
    `UPDATE price_params SET attr_notes=?,updated_at=datetime('now','localtime') WHERE id=?`,
    [val, row.price_id]
  )
  await loadPrices()
  flashKey.value = `price-${row.price_id}`
  setTimeout(() => { if (flashKey.value === `price-${row.price_id}`) flashKey.value = null }, 700)
}

async function toggleHot(p: PriceRecord) {
  const newVal = p.is_hot ? 0 : 1
  try {
    await window.electronAPI.dbQuery('UPDATE price_params SET is_hot=? WHERE id=?', [newVal, p.id])
    await loadPrices()
  } catch (e) { console.error('切换热门失败:', e) }
}

async function loadPrices() {
  try {
    prices.value = await window.electronAPI.dbQuery(
      `SELECT * FROM price_params ORDER BY updated_at DESC`
    ) as PriceRecord[]
    // 加载价格趋势 & 走势曲线
    await loadTrends()
    await loadSparklines()
    // 同步刷新图片缓存（新增价格记录可能关联了已有图片）
    await loadImageCache()
  } catch (e) { console.error('加载物价失败:', e) }
}

async function loadInventoryNames() {
  try {
    const sid = appStore.currentServerId
    if (!sid) { inventoryNames.value = new Set(); return }
    const rows = await window.electronAPI.dbQuery(
      'SELECT DISTINCT item_name FROM inventory WHERE server_id=?',
      [sid]
    ) as Array<{ item_name: string }>
    inventoryNames.value = new Set(rows.map(r => r.item_name))
  } catch { inventoryNames.value = new Set() }
}

async function recordPriceHistory(priceParamId: number) {
  try {
    // 仅当至少有一个价格 > 0 时才记录历史（0 表示未录入，无记录意义）
    const row = await window.electronAPI.dbQuery(
      `SELECT benchmark_price, market_price FROM price_params WHERE id=?`,
      [priceParamId]
    ) as Array<{ benchmark_price: number; market_price: number }>
    if (!row || row.length === 0) return
    const { benchmark_price, market_price } = row[0]
    if (benchmark_price <= 0 && market_price <= 0) return
    await window.electronAPI.dbQuery(
      `INSERT INTO price_history (price_param_id, benchmark_price, market_price) VALUES (?,?,?)`,
      [priceParamId, benchmark_price, market_price]
    )
  } catch (e) { console.error('记录价格历史失败:', e) }
}

async function syncMarketToInventory(itemName: string, serverId: number, marketPriceYi: number) {
  if (marketPriceYi <= 0) return
  try {
    const buyPriceWan = parseFloat((marketPriceYi * 10000).toFixed(4)) // 亿→万
    const rows = await window.electronAPI.dbQuery(
      `SELECT id FROM inventory WHERE item_name=? AND server_id=?`,
      [itemName, serverId]
    ) as Array<{ id: number }>
    if (!rows || rows.length === 0) return
    for (const r of rows) {
      await window.electronAPI.dbQuery(
        `UPDATE inventory SET buy_price=?, updated_at=datetime('now','localtime') WHERE id=?`,
        [buyPriceWan, r.id]
      )
    }
  } catch { /* ignore */ }
}

async function loadTrends() {
  try {
    const ids = prices.value.map(p => p.id)
    if (ids.length === 0) {
      benchTrendMap.value = new Map()
      marketTrendMap.value = new Map()
      return
    }
    // 批量查询每个 price_param 的最新一条历史记录的 benchmark_price 和 market_price
    const placeholders = ids.map(() => '?').join(',')
    const rows = await window.electronAPI.dbQuery(
      `SELECT h.price_param_id, h.benchmark_price, h.market_price
       FROM price_history h
       WHERE h.price_param_id IN (${placeholders})
         AND h.id = (
           SELECT MAX(id) FROM price_history h2 WHERE h2.price_param_id = h.price_param_id
         )`,
      ids
    ) as Array<{ price_param_id: number; benchmark_price: number; market_price: number }>
    const prevBench = new Map<number, number>()
    const prevMarket = new Map<number, number>()
    for (const r of rows) {
      prevBench.set(r.price_param_id, r.benchmark_price)
      prevMarket.set(r.price_param_id, r.market_price)
    }
    function computeTrendInfo(current: number, prev: number | undefined): TrendInfo {
      if (prev === undefined || prev <= 0) return { direction: 'none', pct: null }
      if (current > prev) return { direction: 'up', pct: Math.round(((current - prev) / prev) * 10000) / 100 }
      if (current < prev) return { direction: 'down', pct: Math.round(((prev - current) / prev) * 10000) / 100 }
      return { direction: 'flat', pct: 0 }
    }
    const bMap = new Map<number, TrendInfo>()
    const mMap = new Map<number, TrendInfo>()
    for (const p of prices.value) {
      bMap.set(p.id, computeTrendInfo(p.benchmark_price, prevBench.get(p.id)))
      mMap.set(p.id, computeTrendInfo(p.market_price, prevMarket.get(p.id)))
    }
    benchTrendMap.value = bMap
    marketTrendMap.value = mMap
  } catch (e) { console.error('加载趋势失败:', e) }
}

async function loadSparklines() {
  try {
    const ids = prices.value.map(p => p.id).filter(id => id > 0)
    if (ids.length === 0) {
      sparklineMap.value = new Map()
      sparklineBenchMap.value = new Map()
      return
    }
    const placeholders = ids.map(() => '?').join(',')

    // 批量查询每个 price_param 的最近历史（oldest → newest），同时取 market_price 和 benchmark_price
    const rows = await window.electronAPI.dbQuery(
      `SELECT h.price_param_id, h.benchmark_price, h.market_price, h.changed_at
       FROM price_history h
       WHERE h.price_param_id IN (${placeholders})
         AND NOT (h.benchmark_price <= 0 AND h.market_price <= 0)
       ORDER BY h.changed_at ASC`,
      ids
    ) as Array<{ price_param_id: number; benchmark_price: number; market_price: number; changed_at: string }>

    // 按 price_param_id 分组，每组取最近 20 条（跳过 0 值和极小值）
    const benchGroups = new Map<number, number[]>()
    const marketGroups = new Map<number, number[]>()
    for (const r of rows) {
      if (!benchGroups.has(r.price_param_id)) benchGroups.set(r.price_param_id, [])
      if (!marketGroups.has(r.price_param_id)) marketGroups.set(r.price_param_id, [])
      // 过滤 <= 0 和极小浮点噪声（< 0.0001 万 = 1 三国币视为无效）
      if (r.benchmark_price > 1e-8) benchGroups.get(r.price_param_id)!.push(r.benchmark_price)
      if (r.market_price > 1e-8) marketGroups.get(r.price_param_id)!.push(r.market_price)
    }

    const benchResult = new Map<number, number[]>()
    const marketResult = new Map<number, number[]>()
    for (const [pid, vals] of benchGroups) {
      benchResult.set(pid, vals.slice(-20))
    }
    for (const [pid, vals] of marketGroups) {
      marketResult.set(pid, vals.slice(-20))
    }

    // 补充当前价格作为最后一个数据点（跳过 0 值和极小浮点噪声）
    for (const p of prices.value) {
      // 成本价
      if (p.benchmark_price > 1e-8) {
        let arr = benchResult.get(p.id)
        if (!arr) { arr = []; benchResult.set(p.id, arr) }
        if (arr.length === 0 || Math.abs(arr[arr.length - 1] - p.benchmark_price) > 1e-10) {
          arr.push(p.benchmark_price)
        }
      }
      // 市场价
      if (p.market_price > 1e-8) {
        let arr = marketResult.get(p.id)
        if (!arr) { arr = []; marketResult.set(p.id, arr) }
        if (arr.length === 0 || Math.abs(arr[arr.length - 1] - p.market_price) > 1e-10) {
          arr.push(p.market_price)
        }
      }
    }
    sparklineBenchMap.value = benchResult
    sparklineMap.value = marketResult

    // 预计算所有 sparkline 渲染数据，避免模板中重复计算
    const cache = new Map<number, SparklineData>()
    const allPids = new Set([...benchResult.keys(), ...marketResult.keys()])
    for (const pid of allPids) {
      const marketVals = marketResult.get(pid)
      const benchVals = benchResult.get(pid)
      if ((!marketVals || marketVals.length < 2) && (!benchVals || benchVals.length < 2)) continue

      const allVals: number[] = []
      if (marketVals) allVals.push(...marketVals)
      if (benchVals) allVals.push(...benchVals)
      if (allVals.length === 0) continue

      const min = Math.min(...allVals)
      const max = Math.max(...allVals)
      const range = max - min || 1
      const yMin = min - range * 0.08
      const yMax = max + range * 0.08
      const yRange = yMax - yMin
      const plotW = SPARK_W - SPARK_PAD * 2
      const plotH = SPARK_H - SPARK_PAD * 2

      const toPath = (vals: number[]): string => {
        if (vals.length < 2) return ''
        return vals.map((v, i) => {
          const x = SPARK_PAD + (i / Math.max(1, vals.length - 1)) * plotW
          const y = SPARK_PAD + plotH - ((v - yMin) / yRange) * plotH
          return `${x.toFixed(1)},${y.toFixed(1)}`
        }).join(' ')
      }

      const marketPath = marketVals && marketVals.length >= 2 ? toPath(marketVals) : ''
      const benchPath = benchVals && benchVals.length >= 2 ? toPath(benchVals) : ''

      let marketColor = 'var(--color-text-tertiary)'
      if (marketVals && marketVals.length >= 2) {
        const first = marketVals[0]
        const last = marketVals[marketVals.length - 1]
        if (last > first) marketColor = 'var(--color-success)'
        else if (last < first) marketColor = 'var(--color-danger)'
      }

      // sparkline hover 摘要
      let summary = ''
      if (benchVals && benchVals.length >= 2) {
        const bFirst = (benchVals[0] * 10000).toFixed(1)
        const bLast = (benchVals[benchVals.length - 1] * 10000).toFixed(1)
        summary += `成本: ${bFirst}→${bLast}万`
      }
      if (marketVals && marketVals.length >= 2) {
        if (summary) summary += ' | '
        const mFirst = (marketVals[0] * 10000).toFixed(1)
        const mLast = (marketVals[marketVals.length - 1] * 10000).toFixed(1)
        summary += `市场: ${mFirst}→${mLast}万`
      }
      if (summary) summary += ` | 共${Math.max(benchVals?.length ?? 0, marketVals?.length ?? 0)}条`

      // 末端点坐标（优先市场价，用于标记最新值）
      const lastVals = marketVals && marketVals.length >= 2 ? marketVals : benchVals
      const lastVal = lastVals![lastVals!.length - 1]
      const endX = SPARK_PAD + plotW
      const endY = SPARK_PAD + plotH - ((lastVal - yMin) / yRange) * plotH

      cache.set(pid, { marketPath, benchPath, marketColor, summary, endX, endY })
    }
    sparklineCache.value = cache
  } catch (e) { console.error('加载走势曲线失败:', e) }
}

/* ── 2. 图鉴常量 ── */
const levels = [0, 70, 80, 90, 100, 110, 120, 130, 140, 150]
const levelLabels: Record<number, string> = { 0: '特殊', 70: '70级', 80: '80级', 90: '90级', 100: '100级', 110: '110级', 120: '120级', 130: '130级', 140: '140级', 150: '150级' }
const jobs = ['剑侍', '豪杰', '阴阳士', '仙术士', '游侠', '唤灵']
const slots = ['武器', '头盔', '上装', '下装', '护手', '鞋子', '面具', '项链', '戒指', '翅膀', '符咒', '灵魄', '八阵图', '子女', '灵兽', '元神', '灵珠', '奥义']
const matCategories = ['晶玉', '强化石', '打孔石', '修复石', '镶嵌宝石', '元素材料', '基础矿石', '装备之魂', '货币', '消耗品', '羽毛材料', '强化材料', '家园材料']

/* ── 工具函数 ── */
async function copyName(name: string) {
  try { await navigator.clipboard.writeText(name) } catch {}
}
async function onItemNameClick(name: string) {
  // 实时查询是否有图片，有则打开查看器，无则复制名称
  const rows = await window.electronAPI.listImages(name)
  if (rows.length > 0) {
    const dataUrls = (await Promise.all(rows.map(async r => await window.electronAPI.readImage(r.image_path)))).filter(Boolean) as string[]
    if (dataUrls.length > 0) {
      imageCache.value.set(name, dataUrls)
      viewerImages.value = dataUrls
      viewerVisible.value = true
      return
    }
  }
  imageCache.value.delete(name)
  await copyName(name)
}

function formatTime(t: string): string {
  if (!t) return '-'
  return t.slice(0, 19)  // "YYYY-MM-DD HH:MM:SS"
}

function priceColorClass(valWan: number): string {
  if (!valWan || valWan <= 0) return ''
  if (valWan <= 0.999) return 'price-c0'
  if (valWan <= 9.999) return 'price-c1'
  if (valWan <= 99.999) return 'price-c2'
  if (valWan <= 999.999) return 'price-c3'
  if (valWan <= 9999.999) return 'price-c4'
  if (valWan <= 99999.999) return 'price-c5'
  if (valWan <= 999999.999) return 'price-c6'
  return 'price-c7'
}

// 将品质/阶位/等级统一映射到道具颜色
function qualityColorClass(p: { quality?: string; craft_level?: string }): string {
  const val = (p.quality || p.craft_level || '').trim()
  if (!val) return 'quality-none'
  // 装备品质颜色
  if (['黄色', '橙色', '红色', '绿色', '蓝色', '紫色'].includes(val)) return 'quality-' + val
  // 灵兽品阶颜色
  if (val === '天') return 'quality-红色'
  if (val === '地') return 'quality-橙色'
  if (val === '玄') return 'quality-紫色'
  if (val === '妙') return 'quality-蓝色'
  if (val === '凡') return 'quality-绿色'
  // 阶/级 → 低阶绿、中阶蓝、高阶紫
  const m = val.match(/^(\d+)/)
  if (m) {
    const n = parseInt(m[1])
    if (n <= 2) return 'quality-绿色'
    if (n <= 4) return 'quality-蓝色'
    return 'quality-紫色'
  }
  return 'quality-none'
}

function toWan(yi: number): string {
  return yi ? (yi * 10000).toFixed(3) : ''
}
function fromWan(wan: string): number {
  const v = parseFloat(wan)
  if (isNaN(v) || v < 0) return 0
  return Math.round(v / 10000 * 10000000) / 10000000
}
function toPinyinInitials(str: string): string {
  if (!str) return ''
  try {
    // tiny-pinyin 返回完整拼音（空格分隔），取每段首字母即为拼音首字母
    const full = convertToPinyin(str, ' ', true)
    return full.split(' ').map(s => s[0] || '').join('').toLowerCase()
  } catch {
    // 回退：保留 ASCII 字符，中文用空
    return str.replace(/[\u4e00-\u9fff]/g, '').toLowerCase()
  }
}

function toFullPinyin(str: string): string {
  if (!str) return ''
  try {
    // 返回完整拼音（无分隔符），用于全拼模糊匹配
    return convertToPinyin(str, '', true).toLowerCase()
  } catch {
    return str.replace(/[一-鿿]/g, '').toLowerCase()
  }
}

/* ── 初始化 ── */
async function loadImageCache() {
  try {
    const rows = await window.electronAPI.dbQuery(
      'SELECT DISTINCT item_name, price_id FROM equipment_images ORDER BY item_name'
    ) as Array<{ item_name: string; price_id: number | null }>
    // Mark records that have images (lazy-load paths on demand)
    // 键：新图 p{price_id}，旧图（price_id 为空）回退 item_name
    for (const r of rows) {
      const key = r.price_id ? `p${r.price_id}` : r.item_name
      imageCache.value.set(key, [])
    }
  } catch { /* table may not exist yet */ }
}

onMounted(() => {
  appStore.loadServers()
  loadRecentSearches()
  loadPrices()
  loadEncycData()
  loadInventoryNames()
  loadImageCache()
  document.addEventListener('click', onDocumentClick)
  window.addEventListener('keydown', onGlobalKeydown)
  // OCR 进度（语言包下载 / 识别），仅在 ocrBusy 时更新避免进度显示残留
  window.electronAPI.onOcrProgress(p => { if (ocrBusy.value) ocrProgress.value = p })
  // 高精度引擎状态与下载进度
  checkOcrEngine()
  window.electronAPI.onOcrEngineProgress(onOcrEngineProgress)
})

// keep-alive 切回时刷新物价列表（配号中心等页面可能新增了物品）
onActivated(() => {
  loadPrices()
  loadImageCache()
})

// 切换大区时刷新商行物品列表
watch(() => appStore.currentServerId, () => {
  loadInventoryNames()
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  window.removeEventListener('keydown', onGlobalKeydown)
})
</script>

<style scoped>
.page { height: 100%; display: flex; flex-direction: column; }
.page-head { margin-bottom: 22px; }
.page-head h2 { font-size: var(--text-lg); font-weight: 650; letter-spacing: -0.01em; }
.page-head p { color: var(--color-text-secondary); font-size: var(--text-sm); margin-top: 4px; }

/* ── 卡片 ── */
.card {
  flex: 1; background: var(--color-surface-1);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  padding: 18px 20px; display: flex; flex-direction: column;
  overflow: visible;
}
.card-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 14px; flex-shrink: 0; gap: 12px; flex-wrap: wrap;
}
.card-head h3 { font-size: var(--text-md); font-weight: 600; }
.head-actions { display: flex; align-items: center; gap: 8px; }

/* ── Segmented ── */
.segmented { display: flex; border-radius: 5px; overflow: hidden; border: 0.5px solid var(--color-border); }
.seg-btn {
  padding: 5px 12px; font-size: var(--text-xs); border: none; cursor: pointer;
  background: transparent; color: var(--color-text-secondary);
  font-family: inherit; transition: all 0.1s;
}
.seg-btn--active { background: var(--color-accent); color: #fff; }
.seg-btn:not(.seg-btn--active):hover { background: var(--color-surface-2); }

/* ── 表格 ── */
.table-wrap { flex: 1; overflow-y: auto; min-height: 0; }
.table { width: 100%; border-collapse: collapse; font-size: var(--text-xs); }
.table th {
  text-align: left; padding: 8px 10px; font-size: var(--text-micro); font-weight: 600;
  color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.03em;
  border-bottom: 0.5px solid var(--color-border-light); position: sticky; top: 0;
  background: var(--color-surface-1); user-select: none;
}
.th-sort { cursor: pointer; transition: color 0.1s; }
.th-sort:hover { color: var(--color-accent); }
.sort-arrow { font-size: var(--text-micro); margin-left: 2px; color: var(--color-accent); }
.sort-arrow--inactive { color: var(--color-text-tertiary); opacity: 0.3; }
.table td { padding: 8px 10px; border-bottom: 0.5px solid var(--color-border-light); }
.table tbody tr:hover { background: var(--color-surface-2); }
.table tbody tr { transition: background 0.15s; }
@keyframes flash-save {
  0% { background: rgba(56,180,100,0.18); }
  100% { background: transparent; }
}
.row-flash { animation: flash-save 0.6s ease-out; }
.td-name { font-weight: 500; min-width: 0; }
.td-name-text { cursor: pointer; white-space: nowrap; flex-shrink: 0; }
.td-name-text:hover { color: var(--color-accent); }
.td-craft-lv {
  font-size: var(--text-micro); font-weight: 400; color: var(--color-text-tertiary);
  white-space: nowrap; flex-shrink: 0;
}
.td-craft-lv::before {
  content: '·';
  margin-right: 1px;
}
.copy-name-btn { font-size: var(--text-micro); opacity: 0; transition: opacity 0.12s; display: inline-flex; align-items: center; }
.table tbody tr:hover .copy-name-btn { opacity: 1; }
.copy-icon {
  display: inline-block; width: 10px; height: 10px;
  border: 1.2px solid var(--color-text-tertiary); border-radius: 1.5px;
  position: relative;
}
.copy-icon::after {
  content: ''; position: absolute;
  top: -2.5px; left: 2.5px;
  width: 10px; height: 10px;
  border: 1.2px solid var(--color-text-tertiary); border-radius: 1.5px;
  background: var(--color-surface-1);
}
.quality-none { color: var(--color-text); }         /* 白/默认 */
.quality-黄色 { color: #e2c044; }                    /* 黄 */
.quality-橙色 { color: #e8883a; }                    /* 橙 */
.quality-红色 { color: #e84040; }                    /* 红 */
.quality-绿色 { color: #4caf50; }                    /* 绿 */
.quality-蓝色 { color: #42a5f5; }                    /* 蓝 */
.quality-紫色 { color: #ab47bc; }                    /* 紫 */
.td-muted { color: var(--color-text-tertiary); }

.badge-sm {
  font-size: var(--text-micro); font-weight: 500; padding: 1px 7px; border-radius: 8px;
  background: var(--color-accent-bg); color: var(--color-accent);
}

/* ── 热门切换 ── */
.hot-toggle {
  background: none; border: none; cursor: pointer; font-size: var(--text-md);
  color: var(--color-text-tertiary); opacity: 0.4; transition: all 0.1s; padding: 2px 4px;
}
.hot-toggle:hover { color: var(--color-warning); opacity: 0.8; }
.hot-toggle--on { color: var(--color-warning); opacity: 1; }
.hot-toggle--on :deep(svg) { fill: currentColor; filter: drop-shadow(0 0 3px rgba(232, 163, 61, 0.45)); }

/* ── 按钮 ── */
.btn {
  border: none; border-radius: 5px; cursor: pointer;
  font-size: var(--text-xs); font-weight: 500; padding: 5px 12px;
  transition: all 0.12s ease; font-family: inherit; white-space: nowrap;
}
.btn-accent { background: var(--color-accent); color: #fff; }
.btn-accent:hover { background: var(--color-accent-hover); }
.btn-ghost { background: transparent; color: var(--color-text-secondary); }
.btn-ghost:hover { background: var(--color-hover); color: var(--color-text); }
.btn-icon {
  background: none; border: none; cursor: pointer; font-size: var(--text-sm);
  color: var(--color-text-tertiary); padding: 2px 6px; border-radius: 3px; transition: all 0.12s;
}
.btn-icon:hover { background: var(--color-surface-2); color: var(--color-text); transform: scale(1.15); }
.btn-icon:active { transform: scale(0.92); }
.btn-icon--danger:hover { color: var(--color-danger); background: rgba(220,60,60,0.12); }
.btn-icon--warn { color: var(--color-warning); }
.btn-icon--warn:hover { background: rgba(226,192,68,0.15); transform: scale(1.15); }

.select-sm {
  padding: 5px 8px; font-size: var(--text-xs); font-family: inherit;
  background: var(--color-surface-2); color: var(--color-text);
  border: 0.5px solid var(--color-border); border-radius: var(--radius-sm); cursor: pointer;
}
.select-sm:focus { outline: none; border-color: var(--color-accent-ring); }
/* 原生 select：appearance:none + 自定义 chevron（参照 global.css .server-select） */
select.select-sm,
select.input {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 26px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8F98' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
}
select.select-sm option,
select.input option {
  background: var(--color-surface-1);
  color: var(--color-text);
}

/* ── 输入框 ── */
.input {
  width: 100%; padding: 7px 10px; font-size: var(--text-xs); font-family: inherit;
  background: var(--color-surface-2); color: var(--color-text);
  border: 0.5px solid var(--color-border); border-radius: var(--radius-sm);
  transition: border-color 0.1s;
}
.input:focus { outline: none; border-color: var(--color-accent-ring); }

.inline-input {
  width: 70px; padding: 3px 6px; font-size: var(--text-xs); font-family: inherit;
  background: var(--color-surface-2); color: var(--color-text);
  border: 0.5px solid transparent; border-radius: var(--radius-sm); text-align: right;
  transition: border-color 0.1s;
  -moz-appearance: textfield;
}
.inline-input::-webkit-inner-spin-button,
.inline-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.inline-input:focus { outline: none; border-color: var(--color-accent-ring); background: var(--color-surface-1); }
.inline-input::placeholder { color: var(--color-text-tertiary); font-size: var(--text-micro); }
.inline-input--wide { width: 110px; text-align: left; }
.inline-input--price { width: 60px; }

/* 价格颜色分级（万为单位） */
.price-c0 { color: var(--color-text); }   /* ≤0.999万 · 跟随主题（浅色下为深色，深色下为白色） */
.price-c1 { color: #3b82f6; }   /* ≤9.999万 · 深蓝色 */
.price-c2 { color: #22c55e; }   /* ≤99.999万 · 绿色 */
.price-c3 { color: #f97316; }   /* ≤999.999万 · 橙色 */
.price-c4 { color: #a855f7; }   /* ≤9999.999万 · 紫色 */
.price-c5 { color: #ef4444; }   /* ≤99999.999万 · 红色 */
.price-c6 { color: #eab308; }   /* ≤999999.999万 · 黄色 */
.price-c7 { color: #38bdf8; }   /* > 999999.999万 · 浅蓝色 */

.td-actions { display: flex; gap: 2px; white-space: nowrap; }

/* ── 筛选行 ── */
.filter-row { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; align-items: center; }
.result-count { font-size: var(--text-xs); color: var(--color-text-tertiary); margin-bottom: 10px; }
.result-count strong { color: var(--color-text); }
.search-input { width: 320px !important; flex-shrink: 0; }

/* ── SUG 搜索下拉 ── */
.search-sug-wrap { position: relative; display: inline-block; }
.search-clear-btn {
  position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer; font-size: var(--text-xs);
  color: var(--color-text-tertiary); padding: 2px 4px; border-radius: 3px;
  line-height: 1; z-index: 1;
}
.search-clear-btn:hover { color: var(--color-text); background: var(--color-surface-2); }
.sug-dropdown {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 100;
  background: var(--color-surface-1); border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm); list-style: none; margin: 4px 0 0; padding: 4px 0;
  max-height: 260px; overflow-y: auto; box-shadow: var(--shadow-card);
}
.sug-dropdown li {
  padding: 6px 12px; cursor: pointer; font-size: var(--text-xs);
  display: flex; justify-content: space-between; align-items: center;
  transition: background 0.08s;
}
.sug-dropdown li:hover,
.sug-item--active { background: var(--color-accent-bg); }
.sug-overflow {
  padding: 6px 12px; font-size: var(--text-micro); color: var(--color-text-tertiary);
  text-align: center; border-top: 0.5px solid var(--color-border-light);
  cursor: default; pointer-events: none;
}
.sug-name { color: var(--color-text); }
.sug-slot { color: var(--color-text-tertiary); font-size: var(--text-micro); }

/* ── 最近搜索下拉 ── */
.recent-dropdown {
  position: absolute; top: 100%; left: 0; z-index: 100;
  background: var(--color-surface-1); border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm); margin: 4px 0 0; box-shadow: var(--shadow-card);
  min-width: 640px; padding: 10px 12px 12px;
}
.recent-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 8px;
}
.recent-head-title {
  font-size: var(--text-micro); font-weight: 550; color: var(--color-text-tertiary);
}
.recent-head-clear {
  background: none; border: none; cursor: pointer;
  font-size: var(--text-micro); color: var(--color-text-tertiary); font-family: inherit;
  padding: 2px 6px; border-radius: 3px;
}
.recent-head-clear:hover { background: var(--color-surface-2); color: var(--color-danger); }
.recent-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}
.recent-chip {
  padding: 6px 8px; font-size: var(--text-xs); font-family: inherit;
  background: var(--color-surface-2); color: var(--color-text);
  border: 0.5px solid var(--color-border-light); border-radius: 5px;
  cursor: pointer; text-align: center; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
  transition: all 0.08s;
}
.recent-chip:hover {
  background: var(--color-accent-bg); border-color: var(--color-accent);
  color: var(--color-accent);
}
.hot-filter-label {
  display: flex; align-items: center; gap: 5px; font-size: var(--text-xs);
  color: var(--color-text-secondary); cursor: pointer; user-select: none;
  padding: 4px 8px; border-radius: 5px; border: 0.5px solid var(--color-border);
  transition: all 0.1s; white-space: nowrap;
}
.hot-filter-label:hover { border-color: var(--color-warning); color: var(--color-warning); }
.hot-filter-label input[type="checkbox"] { accent-color: var(--color-warning); cursor: pointer; }
.shop-filter-label:hover { border-color: var(--color-accent); color: var(--color-accent); }
.shop-filter-label input[type="checkbox"] { accent-color: var(--color-accent); }

.multi-select-wrap { position: relative; }
.multi-select-trigger {
  display: flex; align-items: center; gap: 6px; min-width: 110px;
}
.multi-select-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
.multi-select-arrow {
  color: var(--color-text-tertiary);
  flex-shrink: 0;
  transition: transform 0.12s ease;
}
.multi-select-wrap--open .multi-select-arrow { transform: rotate(180deg); }
.multi-select-dropdown {
  position: absolute; top: 100%; left: 0; z-index: 100;
  margin-top: 3px; background: var(--color-surface-2);
  border: 1px solid var(--color-border-light); border-radius: var(--radius-sm);
  padding: 6px 4px; display: flex; flex-direction: column; gap: 1px;
  min-width: 120px; box-shadow: var(--shadow-card);
}
.range-check-label {
  display: flex; align-items: center; gap: 6px; font-size: var(--text-xs);
  color: var(--color-text-secondary); cursor: pointer; user-select: none;
  padding: 4px 8px; border-radius: 4px; transition: background 0.08s;
  white-space: nowrap;
}
.range-check-label:hover { background: var(--color-accent-bg); color: var(--color-text); }
.range-check-label input[type="checkbox"] { accent-color: var(--color-accent); cursor: pointer; }

.btn-ghost-xs {
  background: transparent; border: 0.5px solid var(--color-border);
  color: var(--color-text-tertiary); font-size: var(--text-micro); padding: 4px 10px;
  border-radius: 5px; cursor: pointer; font-family: inherit; transition: all 0.12s;
}
.btn-ghost-xs:hover { color: var(--color-text); border-color: var(--color-text-secondary); }

/* ── 表单 ── */
.form-row { display: flex; flex-direction: column; gap: 4px; }
.form-row--2col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.form-row--3col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
.form-label { font-size: var(--text-micro); font-weight: 500; color: var(--color-text-secondary); }

/* ── 弹层 ── */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(5,6,9,0.45);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex; align-items: center; justify-content: center; z-index: 200;
  animation: overlay-in 0.15s ease-out;
}
.modal {
  background: var(--glass-bg); border: 1px solid var(--glass-border);
  backdrop-filter: blur(28px) saturate(1.5);
  -webkit-backdrop-filter: blur(28px) saturate(1.5);
  border-radius: var(--radius-lg); width: 420px; max-width: 92vw;
  box-shadow: var(--shadow-pop);
  animation: modal-in 0.18s cubic-bezier(0.2, 0.8, 0.3, 1.1);
  /* 适配小屏（笔记本）：整体不超出视口，头部固定、内容区滚动 */
  display: flex; flex-direction: column;
  max-height: min(680px, 90vh);
}
@supports not (backdrop-filter: blur(1px)) {
  .modal { background: var(--color-surface-1); }
}
.modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 0.5px solid var(--color-border-light);
}
.modal-head h4 { font-size: var(--text-md); font-weight: 600; }
.modal-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; }
.modal-foot {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 14px 20px; border-top: 0.5px solid var(--color-border-light);
}

/* ── 通用 ── */
.hint {
  color: var(--color-text-tertiary); text-align: center;
  padding: 48px 20px; font-size: var(--text-xs);
  flex: 1; display: flex; align-items: center; justify-content: center;
}
.text-success { color: var(--color-success); }
.text-danger { color: var(--color-danger); }
.text-warning { color: var(--color-warning); }

/* ── 趋势箭头（内联） ── */
.trend-inline { font-size: var(--text-micro); margin-left: 3px; vertical-align: middle; }
.trend-up { color: var(--color-danger); }
.trend-down { color: var(--color-success); }
.trend-flat { color: var(--color-text-tertiary); }
.trend-none { display: none; }

/* ── 走势曲线 sparkline ── */
.td-sparkline { padding: 2px 6px !important; text-align: center; vertical-align: middle; }
.sparkline-svg {
  width: 64px; height: 22px; display: inline-block;
  cursor: pointer; vertical-align: middle;
  border-radius: 3px; transition: background 0.12s;
}
.sparkline-svg:hover { background: var(--color-surface-2); }
.sparkline-empty {
  font-size: var(--text-micro); color: var(--color-text-tertiary);
  cursor: pointer; padding: 2px 6px; border-radius: 3px;
  transition: color 0.12s, background 0.12s;
}
.sparkline-empty:hover { color: var(--color-accent); background: var(--color-surface-2); }

/* ── 宽弹层 ── */
.modal--wide { width: 680px; max-width: 92vw; }
.modal--ocr { width: 440px; }
.ocr-dl-desc { font-size: var(--text-xs); line-height: 1.6; color: var(--color-text-tertiary); }
.ocr-dl-actions { display: flex; gap: 8px; justify-content: flex-end; }

/* OCR 引擎横幅（页面级，替代原侧边栏提示） */
.ocr-banner { margin: 0 0 12px; flex-direction: row; align-items: center; gap: 10px; }
.ocr-banner .ocr-engine-hint-text { flex: 1; }

/* ── 历史图表 ── */
.history-chart-wrap { margin-bottom: 16px; }
.chart { width: 100%; height: auto; display: block; }
.chart-label { font-size: var(--text-micro); fill: var(--color-text-tertiary); font-family: inherit; }
.chart-legend { font-size: var(--text-micro); fill: var(--color-text-secondary); font-family: inherit; }
.chart-extreme-label { font-size: var(--text-micro); font-weight: 600; font-family: inherit; pointer-events: none; paint-order: stroke fill; stroke: var(--color-surface-1); stroke-width: 2.5px; stroke-linecap: round; stroke-linejoin: round; }
.chart-tooltip-date { font-size: var(--text-micro); fill: var(--color-text-tertiary); font-family: inherit; }
.chart-tooltip-value { font-size: var(--text-xs); font-weight: 650; font-family: inherit; }
.chart-tooltip-group { pointer-events: none; }

/* ── 历史表格 ── */
.history-table-wrap { max-height: 260px; overflow-y: auto; }

/* ── 属性备注 Tooltip ── */
.td-attr {
  cursor: pointer;
  min-width: 80px;
}
.td-attr:hover {
  background: var(--color-surface-2);
}
.attr-text {
  position: relative;
  display: inline-block;
  max-width: 100%;
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
}
.attr-text-inner {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.attr-tooltip {
  display: none;
  position: absolute;
  left: 0;
  bottom: calc(100% + 4px);
  max-width: 360px;
  width: max-content;
  padding: 8px 12px;
  background: var(--color-surface-1);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  z-index: 50;
  box-shadow: var(--shadow-card);
  color: var(--color-text);
}
.attr-text:hover .attr-tooltip {
  display: block;
}
/* 图片上传 */
.image-upload-row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.image-thumb-wrap { position: relative; width: 64px; height: 64px; border-radius: 4px; overflow: hidden; border: 1px solid var(--color-border); }
.image-thumb { width: 100%; height: 100%; object-fit: cover; cursor: pointer; }
.image-thumb-del { position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; border-radius: 50%; border: none; background: rgba(0,0,0,0.5); color: #fff; font-size: var(--text-micro); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.td-name-row { display: flex; align-items: center; gap: 4px; }
.note-picker-wrap { position: relative; display: flex; gap: 4px; }
.note-picker-btn { flex-shrink: 0; width: 28px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-surface-2); color: var(--color-text-secondary); cursor: pointer; }
.note-picker-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }
.note-picker { position: absolute; top: calc(100% + 4px); right: 0; z-index: 60; width: 240px; max-height: 220px; display: flex; flex-direction: column; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface-1); box-shadow: 0 4px 16px rgba(0,0,0,0.18); overflow: hidden; }
.note-picker-head { display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; border-bottom: 1px solid var(--color-border-light); font-size: var(--text-xs); color: var(--color-text-secondary); }
.note-picker-list { overflow-y: auto; padding: 4px 0; }
.note-picker-item { display: flex; align-items: center; gap: 6px; padding: 4px 10px; font-size: var(--text-xs); cursor: pointer; }
.note-picker-item:hover { background: var(--color-hover); }
.note-picker-empty { padding: 12px 10px; font-size: var(--text-xs); color: var(--color-text-tertiary); }
.attr-arrow { cursor: pointer; color: var(--color-text-tertiary); font-size: var(--text-micro); transition: transform 0.12s; user-select: none; flex-shrink: 0; }
.attr-arrow:hover { color: var(--color-accent); }
.attr-arrow--open { transform: rotate(90deg); color: var(--color-accent); }
/* 展开行：colspan 合并整行，属性横向平铺自动换行 */
.td-attrs-row { padding: 6px 12px 8px !important; background: var(--color-surface-2); }
.td-attrs-list { display: flex; flex-wrap: wrap; gap: 5px; width: 100%; }
/* 每个属性一个输入框样式的格子，可点击编辑 */
.td-attr-item { font-size: var(--text-xs); line-height: 1.5; padding: 2px 9px; border-radius: 4px; background: var(--color-surface-1); border: 1px solid var(--color-border); color: var(--color-text); white-space: nowrap; cursor: text; }
.td-attr-item:hover { border-color: var(--color-accent); }
.td-attr-input { width: 120px; font-size: var(--text-xs); padding: 2px 8px; border: 1px solid var(--color-accent); border-radius: 4px; background: var(--color-surface-1); color: var(--color-text); }
.td-attr-add { width: 26px; border: 1px dashed var(--color-border); border-radius: 4px; background: transparent; color: var(--color-text-tertiary); font-size: var(--text-md); cursor: pointer; align-self: center; }
.td-attr-add:hover { border-color: var(--color-accent); color: var(--color-accent); }
.image-add-btn { width: 64px; height: 64px; border-radius: 4px; border: 1px dashed var(--color-border); background: var(--color-surface-2); color: var(--color-text-tertiary); font-size: var(--text-xl); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.image-add-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }
.image-add-btn--sm { width: 40px; height: 64px; font-size: var(--text-lg); }
.image-thumb-ocr { position: absolute; bottom: 2px; right: 2px; width: 18px; height: 18px; border-radius: 50%; border: none; background: rgba(0,0,0,0.5); color: #fff; font-size: var(--text-micro); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.image-thumb-ocr:hover { background: var(--color-accent); }
.ocr-badge { display: inline-block; margin-left: 4px; padding: 0 4px; border-radius: 3px; background: var(--color-accent); color: #fff; font-size: var(--text-micro); line-height: 14px; vertical-align: 1px; }
.ocr-status { margin-top: 6px; font-size: var(--text-xs); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ocr-spinner { width: 12px; height: 12px; border: 2px solid var(--color-border); border-top-color: var(--color-accent); border-radius: 50%; animation: ocr-spin 0.8s linear infinite; display: inline-block; }
@keyframes ocr-spin { to { transform: rotate(360deg); } }
.ocr-done { color: var(--color-success, #4caf50); }
.ocr-similar { color: var(--color-warning, #f59e0b); }
.ocr-raw summary { cursor: pointer; color: var(--color-text-secondary); user-select: none; }
.ocr-raw pre { max-height: 140px; overflow: auto; margin: 4px 0 0; padding: 8px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-surface-2); font-size: var(--text-micro); white-space: pre-wrap; word-break: break-all; }
.btn-icon.img-btn { font-size: var(--text-md); padding: 0 4px; }
</style>
