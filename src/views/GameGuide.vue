<template>
  <div class="page" :class="{ 'page--detail': activeCat }">
    <!-- 首页：卡片网格 -->
    <template v-if="!activeCat">
      <div class="page-head">
        <h2>游戏攻略</h2>
        <p>QQ三国全系统速查手册 · 点击卡片进入详情 · 拖动卡片可自定义排序</p>
      </div>

      <!-- 常用卡片网格（数量自定） -->
      <div
        v-if="favCards.length > 0"
        :class="['card-grid', { 'card-grid--dropzone': cardDragOverZone === 'fav' }]"
        @dragover.prevent="onZoneDragOver($event, 'fav')"
        @dragleave="onZoneDragLeave('fav')"
        @drop.prevent="onZoneDrop('fav')"
      >
        <div
          v-for="cat in favCards"
          :key="cat.key"
          :class="['grid-card', 'grid-card--featured', {
            'grid-card--dragging': cardDragKey === cat.key,
            'grid-card--dragover': cardDragOverKey === cat.key && cardDragKey !== cat.key,
          }]"
          draggable="true"
          @click="openCat(cat)"
          @dragstart="onCardDragStart($event, cat.key)"
          @dragend="onCardDragEnd"
          @dragover.prevent="onCardDragOver($event, cat.key)"
          @dragleave="onCardDragLeave(cat.key)"
          @drop.prevent.stop="onCardDrop(cat.key)"
        >
          <span class="grid-card-icon">{{ cat.icon }}</span>
          <span class="grid-card-label">{{ cat.label }}</span>
          <span v-if="toolKeySet.has(cat.key)" class="grid-card-badge">互动</span>
          <button class="grid-card-unfav" title="移出常用" @click.stop="removeFav(cat.key)">✕</button>
        </div>
      </div>
      <div v-else class="card-grid-empty">🎯 拖拽卡片到常用区即可置顶显示</div>

      <!-- 其他卡片（默认折叠） -->
      <div class="card-collapse-bar" v-if="otherCards.length > 0">
        <button class="card-collapse-btn" @click="expanded = !expanded">
          {{ expanded ? '▲ 收起' : '⋯ 展开全部（' + otherCards.length + '）' }}
        </button>
        <small v-if="expanded" class="card-collapse-hint">把常用卡片拖到上面区域即设为常用，其余收起后不显示</small>
      </div>
      <div
        v-if="expanded && otherCards.length > 0"
        :class="['card-grid', { 'card-grid--dropzone': cardDragOverZone === 'other' }]"
        @dragover.prevent="onZoneDragOver($event, 'other')"
        @dragleave="onZoneDragLeave('other')"
        @drop.prevent="onZoneDrop('other')"
      >
        <div
          v-for="cat in otherCards"
          :key="cat.key"
          :class="['grid-card', 'grid-card--featured', {
            'grid-card--dragging': cardDragKey === cat.key,
            'grid-card--dragover': cardDragOverKey === cat.key && cardDragKey !== cat.key,
          }]"
          draggable="true"
          @click="openCat(cat)"
          @dragstart="onCardDragStart($event, cat.key)"
          @dragend="onCardDragEnd"
          @dragover.prevent="onCardDragOver($event, cat.key)"
          @dragleave="onCardDragLeave(cat.key)"
          @drop.prevent.stop="onCardDrop(cat.key)"
        >
          <span class="grid-card-icon">{{ cat.icon }}</span>
          <span class="grid-card-label">{{ cat.label }}</span>
          <span v-if="toolKeySet.has(cat.key)" class="grid-card-badge">互动</span>
        </div>
      </div>

    </template>

    <!-- 详情页 -->
    <template v-else>
      <div class="detail-head">
        <button class="back-btn" @click="goBackFromDetail">← 返回</button>
        <h2>{{ activeCatLabel }}</h2>
      </div>
      <div class="content">
        <!-- 每日活动（周期活动 + 每日活动） -->
        <template v-if="activeCat === 'daily'">
          <div class="daily-acts">
            <div class="daily-acts-head">
              <span class="daily-acts-title">🎯 每日活动 · 每日必领</span>
              <small class="daily-acts-sub">日常福利一键直达 · 别错过每日奖励</small>
            </div>
            <div
              v-for="group in dailyActivityGroups"
              :key="group.label"
              class="daily-act-group"
            >
              <span class="daily-act-group-label">{{ group.label }}</span>
              <div class="daily-act-grid">
                <div
                  v-for="act in group.items"
                  :key="act.id"
                  class="daily-act-card-wrap"
                >
                  <a
                    :href="act.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="daily-act-card"
                  >
                    <span class="daily-act-icon">{{ act.icon }}</span>
                    <span class="daily-act-name">{{ act.name }}</span>
                    <span class="daily-act-desc">{{ act.desc }}</span>
                    <span class="daily-act-arrow">↗</span>
                  </a>
                  <button class="daily-act-delete" @click.prevent.stop="deleteLink(act.id)" title="删除此链接">✕</button>
                </div>
              </div>
            </div>

            <!-- 添加链接 -->
            <div class="daily-act-add-section">
              <button v-if="!showAddForm" class="daily-act-add-btn" @click="showAddForm = true">+ 添加链接</button>
              <div v-else class="daily-act-form">
                <div class="daily-act-form-row">
                  <select v-model="newLink.group_name" class="daily-act-input">
                    <option value="每日 · 每天必点">每日 · 每天必点</option>
                    <option value="周期/活动 · 定期看看">周期/活动 · 定期看看</option>
                    <option value="">自定义分组...</option>
                  </select>
                  <input v-if="!newLink.group_name" v-model="newLink.group_name" class="daily-act-input" placeholder="新分组名称" />
                  <input v-model="newLink.icon" class="daily-act-input daily-act-input--icon" placeholder="🎁" maxlength="2" />
                </div>
                <div class="daily-act-form-row">
                  <input v-model="newLink.name" class="daily-act-input" placeholder="名称" />
                  <input v-model="newLink.desc" class="daily-act-input" placeholder="描述" />
                </div>
                <div class="daily-act-form-row">
                  <input v-model="newLink.url" class="daily-act-input daily-act-input--url" placeholder="https://..." />
                </div>
                <div class="daily-act-form-actions">
                  <button class="daily-act-form-submit" @click="addLink" :disabled="adding || !newLink.name || !newLink.url">确认添加</button>
                  <button class="daily-act-form-cancel" @click="showAddForm = false; newLink.group_name = '每日 · 每天必点'">取消</button>
                </div>
              </div>
            </div>
          </div>
        </template>
        <!-- 常用链接特殊渲染 -->
        <template v-else-if="activeCat === 'links'">
          <div v-for="group in linkGroups" :key="group.group" class="link-group">
            <h3 class="link-group-title">{{ group.group }}</h3>
            <div class="link-card-list">
              <a v-for="link in group.links" :key="link.url" :href="link.url" target="_blank" rel="noopener noreferrer" class="link-card">
                <div class="link-card-body">
                  <span class="link-card-title">{{ link.title }}</span>
                  <span class="link-card-desc">{{ link.desc }}</span>
                </div>
                <span class="link-card-arrow">↗</span>
              </a>
            </div>
          </div>
        </template>
        <!-- 答题题库 -->
        <template v-else-if="activeCat === 'quiz'">
          <div class="quiz-wrap">
            <!-- 搜索栏 -->
            <div class="quiz-toolbar">
              <div class="quiz-search-bar">
                <input
                  v-model="quizSearch"
                  class="quiz-search-input"
                  placeholder="题目每个字拼音首字母 / 关键词"
                  @input="onQuizSearch"
                  @keydown.enter="onQuizSearch"
                  autofocus
                />
                <button class="quiz-search-btn" @click="onQuizSearch">🔍 检索</button>
              </div>
              <div class="quiz-filters">
                <button
                  v-for="f in quizFilters"
                  :key="f.key"
                  :class="['quiz-filter-chip', { active: quizFilter === f.key }]"
                  @click="quizFilter = f.key; onQuizSearch()"
                >{{ f.label }}<span class="quiz-filter-count">{{ f.count }}</span></button>
              </div>
            </div>

            <!-- 统计条 -->
            <div class="quiz-stats" v-if="hasQuizSearch || quizResults.length > 0">
              {{ hasQuizSearch ? '找到' : '共' }} <strong>{{ quizTotalFiltered }}</strong> {{ hasQuizSearch ? '条' : '题' }}
            </div>

            <!-- 题目表格 -->
            <div class="quiz-table-wrap" v-if="quizResults.length > 0">
              <table class="quiz-table">
                <thead>
                  <tr>
                    <th class="quiz-th-q">题目</th>
                    <th class="quiz-th-a">答案</th>
                    <th class="quiz-th-op">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="q in quizResults" :key="q.id">
                    <td class="quiz-td-q">{{ q.question }}</td>
                    <td class="quiz-td-a">{{ q.answer }}</td>
                    <td class="quiz-td-op">
                      <button class="quiz-op-btn" @click="deleteQuizItem(q)">✕ 删除</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 空状态 -->
            <div class="quiz-empty" v-if="hasQuizSearch && quizTotalFiltered === 0">
              <span class="quiz-empty-icon">😕</span>
              <p>未找到匹配的题目</p>
              <p class="quiz-empty-hint">试试换个关键词，如"关羽"、"赤壁"、"军团"</p>
            </div>

            <!-- 热门搜索 -->
            <div class="quiz-hot-tags" v-if="!hasQuizSearch">
              <span class="quiz-hot-label">热门搜索：</span>
              <button v-for="t in hotTags" :key="t" class="quiz-hot-tag" @click="quizSearch = t; onQuizSearch()">{{ t }}</button>
            </div>
          </div>
        </template>
        <!-- 升级攻略（可编辑表格） -->
        <template v-else-if="activeCat === 'leveling'">
          <div class="leveling-wrap">
            <!-- Sheet 标签栏 -->
            <div class="lv-sheets-bar">
              <div class="lv-sheets-tabs">
                <div
                  v-for="(sheet, si) in levelingSheets"
                  :key="si"
                  :class="['lv-sheet-tab', { active: si === activeSheetIndex }]"
                  @click="switchSheet(si)"
                  @dblclick="startRename(si)"
                >
                  <template v-if="renamingSheetIdx === si">
                    <input
                      class="lv-sheet-rename-input"
                      :value="sheet.name"
                      @keydown.enter="finishRename(si, $event.target as HTMLInputElement)"
                      @keydown.escape="renamingSheetIdx = -1"
                      @blur="finishRename(si, $event.target as HTMLInputElement)"
                      @click.stop
                      autofocus
                    />
                  </template>
                  <template v-else>
                    {{ sheet.name }}
                  </template>
                </div>
              </div>
              <div class="lv-sheets-actions">
                <button class="lv-sheet-btn-add" @click="addSheet" title="添加攻略Sheet">+</button>
                <button
                  v-if="levelingSheets.length > 1"
                  class="lv-sheet-btn-del"
                  @click="deleteSheet(activeSheetIndex)"
                  title="删除当前Sheet"
                >−</button>
              </div>
            </div>

            <!-- 工具栏 -->
            <div class="lv-toolbar">
              <div class="lv-toolbar-left">
                <span class="lv-edit-hint">💡 双击单元格编辑，失焦自动保存</span>
                <button class="lv-btn lv-btn-reset" @click="resetLeveling">🔄 重置默认</button>
                <button class="lv-btn lv-btn-add" @click="addLevelingRow">➕ 添加等级段</button>
              </div>
              <div class="lv-toolbar-right">
                <span class="lv-stage-count">{{ activeStages.length }} 个阶段</span>
              </div>
            </div>

            <!-- 表格 -->
            <div class="leveling-table-wrap" v-if="activeStages.length > 0">
              <table class="leveling-table">
                <thead>
                  <tr>
                    <th class="lv-th-lv">等级段</th>
                    <th class="lv-th-core">核心任务</th>
                    <th class="lv-th-todo">必做事项</th>
                    <th class="lv-th-prep">提前准备</th>
                    <th class="lv-th-tip">关键提示</th>
                    <th class="lv-th-act">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, ri) in activeStages" :key="ri">
                    <td class="lv-td-lv" @dblclick.stop="startEdit(ri, 'level')">
                      <input v-if="isEditingCell(ri, 'level')" data-editing class="lv-input lv-input-lv" v-model="row.level" @blur="finishEdit" @keydown.enter="finishEdit" @keydown.escape="cancelEdit" />
                      <span v-else class="lv-badge">{{ row.level }}</span>
                    </td>
                    <td class="lv-td-core" @dblclick.stop="startEdit(ri, 'core')">
                      <textarea v-if="isEditingCell(ri, 'core')" data-editing class="lv-textarea" v-model="row.core" rows="1" @input="autoResize" @blur="finishEdit" @keydown.escape="cancelEdit"></textarea>
                      <span v-else v-html="nl2br(row.core)"></span>
                    </td>
                    <td class="lv-td-todo" @dblclick.stop="startEdit(ri, 'todo')">
                      <textarea v-if="isEditingCell(ri, 'todo')" data-editing class="lv-textarea" v-model="row.todo" rows="1" placeholder="每行一项，无需编号" @input="autoResize" @blur="finishEdit" @keydown.escape="cancelEdit"></textarea>
                      <ol v-else class="lv-ol"><li v-for="(li, i) in todoLines(row.todo)" :key="i">{{ li }}</li></ol>
                    </td>
                    <td class="lv-td-prep" @dblclick.stop="startEdit(ri, 'prepare')">
                      <textarea v-if="isEditingCell(ri, 'prepare')" data-editing class="lv-textarea" v-model="row.prepare" rows="1" @input="autoResize" @blur="finishEdit" @keydown.escape="cancelEdit"></textarea>
                      <span v-else v-html="nl2br(row.prepare)"></span>
                    </td>
                    <td class="lv-td-tip" @dblclick.stop="startEdit(ri, 'tip')">
                      <textarea v-if="isEditingCell(ri, 'tip')" data-editing class="lv-textarea" v-model="row.tip" rows="1" @input="autoResize" @blur="finishEdit" @keydown.escape="cancelEdit"></textarea>
                      <span v-else v-html="nl2br(row.tip)"></span>
                    </td>
                    <td class="lv-td-act">
                      <button class="lv-btn-del" @click="deleteLevelingRow(ri)" title="删除此行">✕</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 空 sheet 提示 -->
            <div class="lv-empty-sheet" v-else>
              <span class="lv-empty-icon">📈</span>
              <p>暂无等级段数据</p>
              <button class="lv-btn lv-btn-add" @click="addLevelingRow">➕ 添加第一个等级段</button>
            </div>

          </div>
        </template>
        <!-- 活跃计算 -->
        <template v-else-if="activeCat === 'activity'">
          <div class="activity-wrap">
            <!-- 进度条区域 -->
            <div class="act-progress-section">
              <div class="act-progress-header">
                <span class="act-progress-label">今日活跃：<strong>{{ totalPoints }}</strong> / {{ cfg.target }}</span>
                <span v-if="remainingToFull > 0" class="act-progress-remain">距满档还差 <strong>{{ remainingToFull }}</strong></span>
                <span v-else class="act-progress-done">✅ 已满档</span>
              </div>
              <div class="act-progress-bar-wrap">
                <div class="act-progress-bar" :style="{ width: progressPct + '%' }" :class="{ full: isFull }"></div>
                <div class="act-progress-tier act-progress-tier-1" :style="{ left: tier1Pct + '%' }">
                  <span class="act-tier-marker-label">{{ tier1Threshold }}</span>
                </div>
                <div class="act-progress-tier act-progress-tier-2" :style="{ left: tier2Pct + '%' }">
                  <span class="act-tier-marker-label">{{ tier2Threshold }}</span>
                </div>
                <div class="act-progress-tier act-progress-tier-3" :style="{ left: '100%' }" title="3档（满档）">
                  <span class="act-tier-marker-label">{{ cfg.target }}</span>
                </div>
              </div>
              <div class="act-rewards">
                <!-- 1档 -->
                <span :class="['act-reward', { reached: currentTier >= 1 }]">
                  ① {{ cfg.tier1 }}w
                </span>
                <span class="act-reward-sep">│</span>
                <!-- 2档 -->
                <span :class="['act-reward', { reached: currentTier >= 2 }]">
                  ② {{ cfg.tier2 }}w
                </span>
                <span class="act-reward-sep">│</span>
                <!-- 3档 -->
                <span :class="['act-reward', { reached: currentTier >= 3 }]">
                  ③ {{ cfg.tier3 }}w
                </span>
                <span class="act-reward-sep">·</span>
                <span class="act-reward-total">预计总奖励 <strong>{{ cfg.tier1 + cfg.tier2 + cfg.tier3 }}w</strong></span>
              </div>
            </div>

            <!-- 选择器 + 工具按钮 -->
            <div class="act-selectors">
              <div class="act-selector">
                <label>等级</label>
                <select v-model.number="activityLevel">
                  <option v-for="lv in levels" :key="lv" :value="lv">{{ lv }}级</option>
                </select>
              </div>
              <div class="act-selector">
                <label>星期</label>
                <select v-model.number="activityDay">
                  <option v-for="d in dayOptions" :key="d.value" :value="d.value">{{ d.label }}</option>
                </select>
              </div>
              <div class="act-selector">
                <label>大区</label>
                <select v-model="activityServer">
                  <option v-for="s in allServers" :key="s" :value="s">{{ s }}</option>
                </select>
              </div>
              <div class="act-selector act-selector--btns">
                <label>&nbsp;</label>
                <div class="act-toolbar-btns">
                  <button class="act-wage-btn" @click="showWageModal = true">💰 工资汇总</button>
                  <button class="act-wage-btn" @click="openTaskMgr()">⚙ 任务管理</button>
                </div>
              </div>
            </div>

            <!-- 福利任务栏 -->
            <div class="act-bonus-bar">
              <span class="act-bonus-label">⭐ 福利任务 · {{ activityServer }} · {{ dayLabel }}</span>
              <span v-if="bonusTasks.length === 0" class="act-bonus-empty">（未配置，点击任务卡片 ☆ 设置）</span>
              <span v-if="bonusLimitHint" class="act-bonus-hint">{{ bonusLimitHint }}</span>
              <div class="act-bonus-tags">
                <span v-for="t in bonusTasks" :key="t.id" class="act-bonus-tag">
                  {{ t.name }}<em>×2</em>
                  <button class="act-bonus-remove" @click.stop="toggleBonus(t.id)" title="移除">✕</button>
                </span>
              </div>
            </div>

            <!-- 任务网格 -->
            <div class="act-task-grid" v-if="visibleTasks.length > 0">
              <div
                v-for="t in visibleTasks"
                :key="t.id"
                :class="['act-task-card', {
                  'act-task-card--bonus': t.isBonus && !t.levelTooHigh,
                  'act-task-card--disabled': t.levelTooHigh,
                  'act-task-card--done': taskCount(t.id) > 0,
                  'act-task-card--maxed': taskCount(t.id) >= (t.maxCompletions ?? 1) && (t.maxCompletions ?? 1) > 1,
                  'act-task-card--dragging': dragId === t.id,
                  'act-task-card--dragover': dragOverId === t.id && dragId !== t.id,
                }]"
                draggable="true"
                @click="!t.levelTooHigh && incrementTask(t.id)"
                @dragstart="onDragStart($event, t.id)"
                @dragend="onDragEnd"
                @dragover.prevent="onDragOver($event, t.id)"
                @dragleave="onDragLeave(t.id)"
                @drop.prevent="onDrop(t.id)"
              >
                <div class="act-task-head">
                  <span class="act-task-name">{{ t.name }}</span>
                  <div class="act-task-head-right">
                    <button
                      v-if="!t.levelTooHigh"
                      :class="['act-star-btn', { active: t.isBonus }]"
                      @click.stop="toggleBonus(t.id)"
                      :title="t.isBonus ? '取消福利' : '设为福利任务（翻倍）'"
                    >{{ t.isBonus ? '⭐' : '☆' }}</button>
                    <span v-if="t.isBonus && !t.levelTooHigh" class="act-task-badge">✨翻倍</span>
                    <span v-if="t.levelTooHigh" class="act-task-badge act-task-badge--lock">🔒{{ t.minLevel }}级</span>
                  </div>
                </div>
                <div class="act-task-pts">+{{ t.displayPoints }} 活跃</div>
                <div class="act-task-bottom">
                  <label class="act-task-check" :class="{ disabled: t.levelTooHigh }" @click.stop>
                    <input
                      type="checkbox"
                      :checked="taskCount(t.id) > 0"
                      :disabled="t.levelTooHigh"
                      @change="incrementTask(t.id)"
                    />
                  </label>
                  <span v-if="(t.maxCompletions ?? 1) > 1" class="act-task-count" :class="{ maxed: taskCount(t.id) >= (t.maxCompletions ?? 1) }">
                    {{ taskCount(t.id) }}/{{ t.maxCompletions }}
                  </span>
                </div>
              </div>
            </div>

            <!-- 空状态：当天无可用任务 -->
            <div class="act-empty" v-else>
              <span class="act-empty-icon">📋</span>
              <p>当天没有可用任务</p>
            </div>

            <!-- 任务管理弹窗 -->
            <div class="modal-overlay" v-if="showTaskMgr" @click.self="showTaskMgr = false">
              <div class="modal modal--task-mgr">
                <div class="modal-head">
                  <h4>⚙ 活跃任务管理</h4>
                  <div class="modal-head-actions">
                    <button class="task-add-btn" @click="addTaskToPool">＋ 新增</button>
                    <button class="btn-icon" @click="showTaskMgr = false">✕</button>
                  </div>
                </div>
                <div class="modal-body task-mgr-body">
                  <div class="task-list">
                    <div
                      v-for="(t, ti) in editingTaskPool" :key="ti"
                      class="task-row"
                      :class="{ 'task-row--open': expandedTask === ti }"
                    >
                      <!-- 主行 -->
                      <div class="task-row-main">
                        <button
                          class="task-expand-btn"
                          :class="{ open: expandedTask === ti }"
                          @click="expandedTask = expandedTask === ti ? -1 : ti"
                          title="等级活跃点"
                        >▸</button>
                        <div class="task-row-fields">
                          <input v-model="t.name" class="task-field task-field-name" placeholder="任务名称" />
                          <div class="task-field-group">
                            <input v-model.number="t.points" type="number" min="1"
                              class="task-field task-field-pts" />
                            <span class="task-field-suffix">活跃</span>
                          </div>
                          <div class="task-field-group task-field-lv-group">
                            <select v-model.number="t.minLevel" class="task-field task-field-sel">
                              <option v-for="lv in levels" :key="lv" :value="lv">{{ lv }}</option>
                            </select>
                            <span class="task-lv-sep">–</span>
                            <select v-model.number="t.maxLevel" class="task-field task-field-sel">
                              <option :value="0">不限</option>
                              <option v-for="lv in levels" :key="lv" :value="lv">{{ lv }}</option>
                            </select>
                            <span class="task-field-suffix">级</span>
                          </div>
                          <div class="task-field-group task-field-count-group">
                            <input v-model.number="t.maxCompletions" type="number" min="1"
                              class="task-field task-field-count" placeholder="1" />
                            <span class="task-field-suffix">次</span>
                          </div>
                          <div class="task-days">
                            <button
                              v-for="d in dayOptions" :key="d.value"
                              :class="['day-chip', { on: t.days.includes(d.value) }]"
                              @click="toggleTaskDay(t, d.value)"
                            >{{ d.label.slice(1) }}</button>
                          </div>
                        </div>
                        <button class="task-del-btn" @click="removeTaskFromPool(ti)" title="删除">✕</button>
                      </div>
                      <!-- 等级活跃点子行 -->
                      <div v-if="expandedTask === ti" class="task-level-row">
                        <span class="task-level-hint">等级活跃点 · 留空使用默认 {{ t.points }}</span>
                        <div class="task-level-inputs">
                          <label v-for="lv in levels" :key="lv" class="task-level-item">
                            <span class="task-level-lv">{{ lv }}</span>
                            <input
                              v-num="t.levelPoints?.[lv]"
                              @input="setLevelPoint(t, lv, ($event.target as HTMLInputElement).value)"
                              type="number" min="1"
                              class="task-level-input"
                              :placeholder="String(t.points)"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="modal-foot">
                  <button class="task-reset-btn" @click="resetTaskPool">恢复默认</button>
                  <span class="modal-foot-spacer"></span>
                  <span class="task-mgr-count">{{ editingTaskPool.length }} 个任务</span>
                  <button class="task-save-btn" @click="saveTaskPool">保存</button>
                </div>
              </div>
            </div>

            <!-- 工资汇总弹窗 -->
            <div class="modal-overlay" v-if="showWageModal" @click.self="showWageModal = false">
              <div class="modal modal--wage">
                <div class="modal-head">
                  <h4>💰 各等级活跃工资汇总</h4>
                  <button class="btn-icon" @click="showWageModal = false">✕</button>
                </div>
                <div class="modal-body">
                  <table class="wage-table">
                    <thead>
                      <tr><th>等级</th><th>满档活跃</th><th>1档活跃点</th><th>2档活跃点</th><th>1档工资</th><th>2档工资</th><th>3档工资</th><th>总计</th></tr>
                    </thead>
                    <tbody>
                      <tr v-for="lv in levels" :key="lv" :class="{ 'wage-row--current': lv === activityLevel }">
                        <td class="wage-td-lv">{{ lv }}级</td>
                        <td class="wage-td-editable" @click="startWageEdit(lv, 'target')">
                          <input v-if="wageEdit?.lv === lv && wageEdit?.field === 'target'"
                            v-model="wageEditValue" type="number" min="1" step="1"
                            class="wage-input"
                            @keydown.enter="saveWageEdit"
                            @keydown.escape="cancelWageEdit"
                            @blur="saveWageEdit"
                            @click.stop
                          />
                          <span v-else class="wage-val">{{ wageSummary[lv].target }}</span>
                        </td>
                        <td class="wage-td-editable" @click="startWageEdit(lv, 'tier1Pt')">
                          <input v-if="wageEdit?.lv === lv && wageEdit?.field === 'tier1Pt'"
                            v-model="wageEditValue" type="number" min="0" step="1"
                            class="wage-input"
                            @keydown.enter="saveWageEdit"
                            @keydown.escape="cancelWageEdit"
                            @blur="saveWageEdit"
                            @click.stop
                          />
                          <span v-else class="wage-val">{{ wageSummary[lv].tier1Pt }}</span>
                        </td>
                        <td class="wage-td-editable" @click="startWageEdit(lv, 'tier2Pt')">
                          <input v-if="wageEdit?.lv === lv && wageEdit?.field === 'tier2Pt'"
                            v-model="wageEditValue" type="number" min="0" step="1"
                            class="wage-input"
                            @keydown.enter="saveWageEdit"
                            @keydown.escape="cancelWageEdit"
                            @blur="saveWageEdit"
                            @click.stop
                          />
                          <span v-else class="wage-val">{{ wageSummary[lv].tier2Pt }}</span>
                        </td>
                        <td class="wage-td-editable" @click="startWageEdit(lv, 'tier1')">
                          <input v-if="wageEdit?.lv === lv && wageEdit?.field === 'tier1'"
                            v-model="wageEditValue" type="number" min="0" step="1"
                            class="wage-input"
                            @keydown.enter="saveWageEdit"
                            @keydown.escape="cancelWageEdit"
                            @blur="saveWageEdit"
                            @click.stop
                          />
                          <span v-else class="wage-val">{{ wageSummary[lv].tier1 }}w</span>
                        </td>
                        <td class="wage-td-editable" @click="startWageEdit(lv, 'tier2')">
                          <input v-if="wageEdit?.lv === lv && wageEdit?.field === 'tier2'"
                            v-model="wageEditValue" type="number" min="0" step="1"
                            class="wage-input"
                            @keydown.enter="saveWageEdit"
                            @keydown.escape="cancelWageEdit"
                            @blur="saveWageEdit"
                            @click.stop
                          />
                          <span v-else class="wage-val">{{ wageSummary[lv].tier2 }}w</span>
                        </td>
                        <td class="wage-td-editable" @click="startWageEdit(lv, 'tier3')">
                          <input v-if="wageEdit?.lv === lv && wageEdit?.field === 'tier3'"
                            v-model="wageEditValue" type="number" min="0" step="1"
                            class="wage-input"
                            @keydown.enter="saveWageEdit"
                            @keydown.escape="cancelWageEdit"
                            @blur="saveWageEdit"
                            @click.stop
                          />
                          <span v-else class="wage-val">{{ wageSummary[lv].tier3 }}w</span>
                        </td>
                        <td class="wage-td-total">{{ wageSummary[lv].total }}w</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </template>
        <!-- Boss图鉴 -->
        <template v-else-if="activeCat === 'boss'">
          <BossHandbook />
        </template>
        <!-- 四象搭配 -->
        <template v-else-if="activeCat === 'sxdp'">
          <div class="sxdp-wrap">
            <div class="sxdp-toolbar">
              <div class="sxdp-toolbar-right">
                <button v-if="sxdpFilterActive" class="lv-btn lv-btn-reset" @click="clearSxdpFilters">✕ 清除筛选</button>
                <span class="lv-stage-count">
                  <template v-if="sxdpFilterActive">{{ sxdpVisibleRows.length }} / {{ sxdpData.length }} 套搭配</template>
                  <template v-else>{{ sxdpData.length }} 套搭配</template>
                </span>
              </div>
            </div>
            <div class="sxdp-table-wrap" v-if="sxdpData.length > 0">
              <table class="sxdp-table">
                <thead>
                  <tr>
                    <th v-for="col in sxdpColumns" :key="col">
                      <div class="sxdp-th-label">{{ col }}</div>
                      <select
                        class="sxdp-filter-select"
                        :class="{ active: !!sxdpFilters[col] }"
                        :style="{ color: sxdpFilters[col] ? sxdpColor(sxdpFilters[col]) : '' }"
                        :value="sxdpFilters[col] || ''"
                        :title="`按${col}筛选`"
                        @change="setSxdpFilter(col, ($event.target as HTMLSelectElement).value)"
                      >
                        <option value="">全部</option>
                        <option v-for="opt in SXDP_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
                      </select>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, i) in sxdpVisibleRows" :key="i">
                    <td
                      v-for="col in sxdpColumns"
                      :key="col"
                      :style="{ color: sxdpColor(item[col]) }"
                    >
                      {{ item[col] }}
                    </td>
                  </tr>
                  <tr v-if="sxdpVisibleRows.length === 0">
                    <td :colspan="sxdpColumns.length + 1" class="sxdp-td-nomatch">
                      没有符合筛选条件的搭配
                      <button class="lv-btn lv-btn-reset" @click="clearSxdpFilters">✕ 清除筛选</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="lv-empty-sheet" v-else>
              <span class="lv-empty-icon">☯</span>
              <p>暂无四象搭配数据</p>
            </div>
          </div>
        </template>
        <!-- 升级计算器 -->
        <template v-else-if="activeCat === 'exp-calc'">
          <div class="exp-calc-wrap">
            <!-- 方案选择 -->
            <div class="ec-preset-bar">
              <div class="ec-preset-tabs">
                <div
                  v-for="(p, pi) in ecPresets"
                  :key="pi"
                  :class="['ec-preset-tab', { active: pi === ecActiveIdx }]"
                  :title="`${p.startLevel}升${p.targetLevel}`"
                  @click="switchPreset(pi)"
                >
                  {{ presetTitle(p) }}
                </div>
              </div>
              <div class="ec-preset-actions">
                <button class="ec-preset-btn-add" @click="addPreset" title="添加方案">+</button>
                <button
                  v-if="ecPresets.length > 1"
                  class="ec-preset-btn-del"
                  @click="deletePreset(ecActiveIdx)"
                  title="删除当前方案"
                >−</button>
              </div>
            </div>

            <!-- 控制栏 -->
            <div class="ec-toolbar">
              <div class="ec-level-row">
                <label class="ec-level-label">等级</label>
                <div class="ec-level-start-group">
                  <input type="number" v-model.number="ecStartLevel" min="1" max="155" class="ec-level-input" />
                  <span class="ec-progress-label">进度</span>
                  <input type="number" v-model.number="ecStartProgress" min="0" max="100" class="ec-progress-input" />
                  <span class="ec-progress-unit">%</span>
                </div>
                <span class="ec-level-arrow">→</span>
                <input type="number" v-model.number="ecTargetLevel" min="1" max="155" class="ec-level-input" />
                <span v-if="ecTargetLevel <= ecStartLevel" class="ec-level-warn">⚠ 目标需大于起始</span>
              </div>
              <div class="ec-level-row">
                <label class="ec-level-label">起始星期</label>
                <select v-model.number="ecStartWeekdaySelect" class="ec-level-input ec-start-weekday-select" title="今天 = 动态跟随当天所在的星期；选具体星期则固定（随方案保存）">
                  <option :value="0">今天</option>
                  <option v-for="d in 7" :key="d" :value="d">周{{ WEEKDAY_CHARS[d - 1] }}</option>
                </select>
              </div>
              <div class="ec-toolbar-btns">
                <button class="ec-rate-btn" @click="openAccelModal">🔒 全局经验</button>
                <button class="ec-rate-btn" @click="openRateModal">⚙ 倍率设置</button>
              </div>
            </div>

            <!-- 三栏主体：活跃任务 | 逐天明细 | 经验道具 -->
            <div class="ec-calc-body">

              <!-- 左栏：面板列（活跃任务） -->
              <div class="ec-sidebar-col ec-sidebar-col--left">
                <section class="ec-panel" :class="{ 'ec-panel--collapsed': !ecPanelOpen('tasks') }">
                  <div class="ec-panel-head" @click="toggleEcPanel('tasks')" title="点击折叠/展开">
                    <span class="ec-panel-caret">{{ ecPanelOpen('tasks') ? '▾' : '▸' }}</span>
                    <span class="ec-panel-title">🎯 活跃任务</span>
                    <span class="ec-task-sub-count">（{{ ecActiveAllTasks.length }} 项在用）</span>
                    <span class="grind-segment-spacer"></span>
                    <button v-if="ecActiveAllTasks.length > 0" class="grind-head-btn" title="一键清除已勾选的任务" @click.stop="clearEcTasks">✕ 清除</button>
                  </div>
                  <div class="ec-panel-body" v-show="ecPanelOpen('tasks')">
                    <template v-if="ecAllTasksChips.length > 0">
                      <div class="ec-task-grid">
                        <label
                          v-for="t in ecAllTasksChips"
                          :key="t.id"
                          v-show="(ecCompletions[t.id] ?? 0) > 0 || ecShowAllTasks"
                          :class="['ec-task-chip', {
                            checked: (ecCompletions[t.id] ?? 0) > 0,
                            maxed: (ecCompletions[t.id] ?? 0) >= (t.maxCompletions ?? 1) && (t.maxCompletions ?? 1) > 1,
                          }]"
                          @click.prevent="cycleEcTask(t.id)"
                        >
                          <input type="checkbox" class="ec-chip-checkbox" :checked="(ecCompletions[t.id] ?? 0) > 0"
                            @click.stop @change="setTaskCheck(t.id, ($event.target as HTMLInputElement).checked)" />
                          <span class="ec-task-chip-name">{{ t.name }}</span>
                          <span v-if="taskTypeBadge(t)" class="ec-task-chip-type">{{ taskTypeBadge(t) }}</span>
                          <span v-if="!t.days.includes(activityDay)" class="ec-task-chip-closed" title="该任务今天不开放，已在逐天明细中按开放日计算">休</span>
                          <span class="ec-task-chip-rate">×{{ getEffectiveTaskMultiplier(t.id, ecStartLevel) || 0 }}</span>
                          <span v-if="(t.maxCompletions ?? 1) > 1" class="ec-task-chip-count-label" :class="{ maxed: (ecCompletions[t.id] ?? 0) >= (t.maxCompletions ?? 1) }">
                            {{ ecCompletions[t.id] ?? 0 }}/{{ t.maxCompletions }}
                          </span>
                        </label>
                      </div>
                      <div class="ec-items-toggle" v-if="ecActiveAllTasks.length < ecAllTasksChips.length">
                        <button class="ec-items-toggle-btn" @click="ecShowAllTasks = !ecShowAllTasks">
                          {{ ecShowAllTasks ? '△ 收起未选中' : '▽ 显示全部（' + (ecAllTasksChips.length - ecActiveAllTasks.length) + ' 项未选）' }}
                        </button>
                      </div>
                    </template>
                    <div class="ec-task-empty" v-else>
                      <template v-if="ecAvailableTasks.length > 0">所有活跃任务倍率均为 0，已全部隐藏（可在 ⚙ 倍率设置中调整倍率）</template>
                      <template v-else>当前等级无可用的活跃任务</template>
                    </div>
                  </div>
                </section>
              </div>

              <!-- 中：逐天明细（超过 5 年仍未达标 / 经验表数据不足时不展开明细，显示摘要 + 提醒） -->
            <div class="ec-result-section" v-if="ecTargetLevel > ecStartLevel && (ecSelectedTasks.size > 0 || ecActiveItems.length > 0 || grindActive)">
              <template v-if="ecSimHideTable">
                <div class="ec-result-head">📊 升级模拟<span class="ec-days-summary-note">（{{ ecSimStop === 'cap' ? '超过 5 年仍无法达到目标级' : '经验表数据不足' }}，不展开逐天明细）</span></div>
                <div class="ec-days-summary">
                  <div class="ec-days-summary-route">{{ ecStartLevel }} 级 → {{ ecTargetLevel }} 级</div>
                  <div class="ec-days-summary-est">{{ ecSimEstimateText }}</div>
                  <div class="ec-days-remind">⚠ {{ ecSimLongHint }}</div>
                </div>
              </template>
              <template v-else>
                <div class="ec-result-head">📊 逐天明细
                  <span v-if="ecDayRows.length > 0" class="ec-total-days">预计 <strong>{{ ecTotalDays }}</strong></span>
                </div>
                <div class="ec-detail-table-wrap">
                  <table class="ec-detail-table">
                    <thead>
                      <tr>
                        <th>天数</th>
                        <th>等级</th>
                        <th>刷怪地图</th>
                        <th>当日经验</th>
                        <th>打怪经验</th>
                        <th class="ec-th-progress">升级进度</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="row in ecDayRows"
                        :key="row.day"
                        :class="{ 'ec-day-row--levelup': row.leveledUp }"
                        class="ec-day-row"
                        @click="setStartFromDay(row)"
                        title="点击将起始等级设为当前行状态"
                      >
                        <td :title="row.bonusExpiring.length > 0 ? '🧧 ' + row.bonusExpiring.join('、') + ' 今日到期（加成次日失效）' : undefined">第{{ row.day }}天（{{ weekdayNameOfDay(row.day) }}）</td>
                        <td :title="row.leveledUp ? row.startLevel + '级 → ' + row.endLevel + '级（当天升级）' : row.startLevel + '级'">
                          <span :class="{ 'ec-levelup-new': row.leveledUp }">{{ row.endLevel }}</span>
                        </td>
                        <td class="ec-td-areas" :title="row.grindAreas.length > 0 ? row.grindAreas.join('、') : '当天无有效刷怪'">
                          {{ row.grindAreas.length > 0 ? row.grindAreas.join('、') : '—' }}
                        </td>
                        <td :title="row.dailyExp.toLocaleString()">{{ fmtExp(row.dailyExp) }}</td>
                        <td :title="row.grindExp.toLocaleString()">{{ fmtExp(row.grindExp) }}</td>
                        <td class="ec-td-progress">
                          <div class="ec-progress-cell">
                            <div class="ec-progress-bar-wrap">
                              <div class="ec-progress-bar" :style="{ width: row.progressPct + '%' }"></div>
                            </div>
                            <span class="ec-progress-pct">{{ row.progressText }}</span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </template>
            </div>
            <div class="hint ec-mid-hint" v-else-if="ecTargetLevel > ecStartLevel && ecSelectedTasks.size === 0 && ecActiveItems.length === 0 && bonusUseActiveCount === 0 && !grindActive">
              请至少勾选一个活跃任务、经验道具、次数型加成道具或配置打怪经验
            </div>

              <!-- 右栏：面板列（打怪经验 / 经验道具） -->
              <div class="ec-sidebar-col ec-sidebar-col--right">

                <!-- 打怪经验面板 -->
                <section class="ec-panel" :class="{ 'ec-panel--collapsed': !ecPanelOpen('monster-kill') }">
                  <div class="ec-panel-head" @click="toggleEcPanel('monster-kill')" title="点击折叠/展开">
                    <span class="ec-panel-caret">{{ ecPanelOpen('monster-kill') ? '▾' : '▸' }}</span>
                    <span class="ec-panel-title">⚔ 打怪经验</span>
                    <span class="grind-segment-spacer"></span>
                    <button class="grind-head-btn" title="重置本方案等级段为「经验表 → B 最优打怪群组合」默认（每级组合含自定义编辑，同组合相邻等级合并为段）" @click.stop="applyBestGrindCombo">默认</button>
                    <button class="grind-head-btn" title="每日刷怪时长 / 双倍时间 / 队伍 / 亲密度 / 师徒 / 青梅 / 熟练度 / 每周大疲劳设置（效率自动按怪物群计算；疲劳 380/天 + 大疲劳 2520/周，耗尽后截断当日刷怪）；打怪衰减率在 🔒 全局经验" @click.stop="grindSettingsOpen = true">⚙</button>
                  </div>
                  <div class="ec-panel-body" v-show="ecPanelOpen('monster-kill')">
                    <!-- 首日（起始星期）刷怪结果：有效分钟、开齐心、疲劳消耗明细（先扣系统再扣大疲劳） -->
                    <div class="grind-result-strip" v-if="grindActive">
                      <span>首日（{{ WEEKDAY_NAMES[grindStartWeekday - 1] }}）刷怪 {{ Math.round(grindResult.effectiveMinutes) }} 分钟</span>
                      <span v-if="grindResult.qiXinMinutes > 0">开齐心 {{ Math.round(grindResult.qiXinMinutes) }} 分钟</span>
                      <span>疲劳 {{ Math.round(grindResult.fatigueUsed) }}（系统 {{ Math.round(grindResult.systemFatigueUsed) }} + 大疲劳 {{ Math.round(grindResult.bigFatigueUsed) }}）</span>
                      <span v-if="grindResult.fatigueLimited" class="grind-fatigue-limited"
                        title="配置时长超过当日疲劳容量（系统 {{ grindStartSystemFatigue }} + 本周剩余大疲劳），超出部分无法刷怪">⚠ 当日疲劳耗尽</span>
                    </div>
                    <div v-if="grindMonsterList.length === 0" class="ec-task-empty">怪物数据加载中…</div>
                    <template v-else>
                      <!-- 等级段（2026-08-23 起唯一模式，全局勾选已移除）：只读摘要——实际等级段设置 + 各段勾选
                           地图情况；勾选配置移入"等级段设置"弹窗，默认 = 经验表 B 表最优打怪群组合 -->
                      <div class="grind-segments">
                        <template v-if="grindSegments.length > 0">
                          <div v-for="(sum, si) in grindSegmentSummaries" :key="si" class="grind-seg-summary"
                            :title="`段 ${sum.seg.levelFrom}~${sum.seg.levelTo} 级 · ${sum.seg.monsterIds.length} 个怪物群（点击打开等级段设置）`"
                            @click="openSegmentSettings(si)">
                            <span class="grind-seg-summary-range">{{ sum.seg.levelFrom }}~{{ sum.seg.levelTo }}</span>
                            <span v-if="sum.maps.length > 0" class="grind-seg-summary-maps">
                              <span v-for="mp in sum.maps" :key="mp.area" class="grind-seg-summary-map">{{ mp.area }} {{ mp.count }}群</span>
                            </span>
                            <span v-else class="grind-seg-summary-empty">未勾选怪物群</span>
                            <span class="grind-seg-summary-actions">
                              <button class="be-reset-btn" title="恢复本段为 B 表最优打怪群组合（清除本段自定义勾选）" @click.stop="restoreSegmentDefault(si)">↺ 默认</button>
                            </span>
                          </div>
                          <div class="grind-seg-summary-hint">等级未覆盖的天数不打怪 · 点击等级段行或下方按钮修改</div>
                        </template>
                        <div v-else class="grind-empty-tip">尚未配置等级段（等级未覆盖的天数不打怪）</div>
                        <button class="grind-seg-edit-btn" @click="openSegmentSettings()">⚙ 等级段设置</button>
                      </div>
                    </template>
                  </div>
                </section>

                <!-- 打怪经验设置弹窗（队伍/亲密度/师徒/青梅/熟练度；称号 2026-08-23 起移除；打怪衰减率 2026-08-27 起移入 🔒 全局经验设定弹窗） -->
                <div class="modal-overlay" v-if="grindSettingsOpen" @click.self="grindSettingsOpen = false">
                  <div class="modal grind-modal" style="width: 560px; max-width: 92vw; max-height: 86vh;">
                    <div class="modal-head">
                      <h4>⚔ 打怪经验设置</h4>
                      <button class="btn-icon" @click="grindSettingsOpen = false">✕</button>
                    </div>
                    <div class="modal-body grind-modal-body">
                      <!-- 每日设置：按周配置刷怪时长 / 开齐心 / 双倍时间 -->
                      <div class="grind-sec">
                        <div class="grind-sec-title">每日设置<span class="grind-sec-sub">按周配置 · 模拟按起始星期循环取当天</span></div>
                        <div class="grind-day-table">
                          <div class="grind-day-row grind-day-head">
                            <span class="grind-day-param"></span>
                            <span v-for="w in WEEKDAY_NAMES" :key="w" class="grind-day-weekday">{{ w }}</span>
                          </div>
                          <div class="grind-day-row">
                            <span class="grind-day-param">刷怪时长</span>
                            <label v-for="(w, i) in WEEKDAY_NAMES" :key="w" class="grind-day-cell">
                              <input type="number" class="rate-input grind-input" v-num="grindConfig.dailyHours[i] ?? 0" min="0" max="24" step="0.5"
                                @input="setGrindDailyHour(i, ($event.target as HTMLInputElement).value)" />
                            </label>
                          </div>
                          <div class="grind-day-row">
                            <span class="grind-day-param">开齐心</span>
                            <label v-for="(w, i) in WEEKDAY_NAMES" :key="w" class="grind-day-cell">
                              <input type="checkbox" class="grind-day-check" :checked="!!grindConfig.qiXinDays[i]" @change="setGrindDayFlag('qiXinDays', i, ($event.target as HTMLInputElement).checked)" />
                            </label>
                          </div>
                          <div class="grind-day-row">
                            <span class="grind-day-param">双倍时间</span>
                            <label v-for="(w, i) in WEEKDAY_NAMES" :key="w" class="grind-day-cell">
                              <input type="checkbox" class="grind-day-check" :checked="!!grindConfig.doubleExpDays[i]" @change="setGrindDayFlag('doubleExpDays', i, ($event.target as HTMLInputElement).checked)" />
                            </label>
                          </div>
                        </div>
                        <div class="grind-day-sums">
                          <span :class="['grind-sum-chip', { over: weeklyGrindHours * 60 > WEEKLY_GRIND_MIN_CAP }]">
                            刷怪 {{ weeklyGrindHours.toFixed(1) }} 小时/周
                            <span class="grind-sum-cap">上限 {{ WEEKLY_GRIND_MIN_CAP }} 分钟</span>
                          </span>
                          <span :class="['grind-sum-chip', { over: qiXinWeeklyMinutes > WEEKLY_QIXIN_MIN_CAP }]">
                            <template v-if="qiXinWeeklyMinutes > WEEKLY_QIXIN_MIN_CAP">⚠ 开齐心 {{ Math.round(qiXinWeeklyMinutes) }} 分钟/周，超上限，超出部分不计齐心乘数</template>
                            <template v-else>开齐心 {{ Math.round(qiXinWeeklyMinutes) }} 分钟/周</template>
                            <span class="grind-sum-cap">上限 {{ WEEKLY_QIXIN_MIN_CAP }} 分钟</span>
                          </span>
                          <span :class="['grind-sum-chip', { over: weeklyFatigueEstimate > weeklyFatigueCap }]"
                            :title="'按首日目标地图烧速 ' + grindTotalEfficiency + ' PL/小时 估算；实际按逐天模拟逐日扣减：先扣系统疲劳 380/天，再扣大疲劳'">
                            <template v-if="weeklyFatigueEstimate > weeklyFatigueCap">⚠ 预计疲劳 {{ Math.round(weeklyFatigueEstimate) }}/周，超上限，超出部分刷不了</template>
                            <template v-else>预计疲劳 {{ Math.round(weeklyFatigueEstimate) }}/周</template>
                            <span class="grind-sum-cap">上限 {{ weeklyFatigueCap }}（系统 {{ SYSTEM_DAILY_FATIGUE * 7 }} + 大疲劳 {{ grindConfig.bigFatigueCap }}）</span>
                          </span>
                        </div>
                      </div>

                      <!-- 队伍与经验加成：队伍人数 / 好友亲密度 / 师徒 / 青梅 / 装备熟练度（称号 2026-08-23 起移除） -->
                      <div class="grind-sec">
                        <div class="grind-sec-title">队伍与经验加成<span class="grind-sec-sub">队伍人数 · 好友亲密度 · 师徒 / 青梅 / 装备熟练度</span></div>
                        <div class="grind-pair-grid">
                          <label class="grind-field">
                            <span class="grind-field-label">队伍人数
                              <span class="grind-info" title="组队打怪经验（不开齐心分钟按队伍人数查表）：1人100% / 2人85% / 3人80% / 4人75% / 5人68%；开齐心分钟按开齐心人数查表（1人100% / 2人105% / 3人109% / 4人112% / 5人115%）。5人队全开齐心约为不开齐心的 1.69 倍。">ⓘ</span>
                            </span>
                            <select class="grind-select" :value="grindConfig.partySize" @change="setGrindInt('partySize', Number(($event.target as HTMLSelectElement).value))">
                              <option v-for="n in 5" :key="n" :value="n">{{ n }}人</option>
                            </select>
                          </label>
                          <label class="grind-field">
                            <span class="grind-field-label">开齐心人数
                              <span class="grind-info" title="开齐心的分钟按开齐心人数查开齐心表（2人105% / 3人109% / 4人112% / 5人115%），不开齐心的分钟仍按队伍人数查不开齐心表。默认与队伍人数一致，可单独调低（如 5 人队只有 3 人开齐心 → 开齐心分钟 ×109%、不开齐心分钟 ×68%）。">ⓘ</span>
                            </span>
                            <select class="grind-select" :value="grindConfig.qiXinPartySize ?? grindConfig.partySize"
                              @change="setGrindQiXinPartySize(Number(($event.target as HTMLSelectElement).value))">
                              <option v-for="n in Math.max(1, Math.min(5, Number(grindConfig.partySize) || 1))" :key="n" :value="n">{{ n }}人</option>
                            </select>
                          </label>
                          <label class="grind-field">
                            <span class="grind-field-label">好友亲密度
                              <span class="grind-info" title="好友亲密度经验加成（打怪经验）：0级 0% / 1级 8% / 2级 10% / 3级 10% / 4级 13% / 5级 13% / 6级 15% / 7级 15% / 8级 18% / 9级 18% / 10级 20%">ⓘ</span>
                            </span>
                            <select class="grind-select" :value="grindConfig.intimacyLevel" @change="setGrindInt('intimacyLevel', Number(($event.target as HTMLSelectElement).value))">
                              <option v-for="n in 11" :key="n - 1" :value="n - 1">{{ n - 1 }}级</option>
                            </select>
                          </label>
                          <label v-for="b in GRIND_BONUS_FIELDS" :key="b.key" class="grind-field">
                            <span class="grind-field-label">{{ b.label }}</span>
                            <div class="grind-num-wrap">
                              <input type="number" class="rate-input grind-input" v-num="grindConfig[b.key]" min="0" step="0.1"
                                @input="setGrindNumber(b.key, ($event.target as HTMLInputElement).value)" />
                              <span class="grind-num-unit">%</span>
                            </div>
                          </label>
                          <label class="grind-field">
                            <span class="grind-field-label">每周大疲劳
                              <span class="grind-info" title="大疲劳：每周至多消耗 2520（吃双倍丸获得，默认满额，吃少了可调低）。系统疲劳每天 0 点发放 380、当天用不完不累积；刷怪先扣系统疲劳、扣完再扣大疲劳；疲劳耗尽后当日刷怪时长自动截断（时间上限 580 分钟/周与疲劳上限并存，取先到者）。">ⓘ</span>
                            </span>
                            <div class="grind-num-wrap">
                              <input type="number" class="rate-input grind-input" v-num="grindConfig.bigFatigueCap" min="0" :max="DEFAULT_BIG_FATIGUE_CAP" step="50"
                                @input="setBigFatigueCap(($event.target as HTMLInputElement).value)" />
                              <span class="grind-num-unit">/周</span>
                            </div>
                          </label>
                          <label class="grind-field">
                            <span class="grind-field-label">起始日剩余系统疲劳
                              <span class="grind-info" title="模拟第 1 天开始时已剩余的系统疲劳：每天 0 点发放 380，若今天已刷掉一部分可调低；仅影响模拟第 1 天，之后每天恢复满额 380。清空 = 满额 380。">ⓘ</span>
                            </span>
                            <div class="grind-num-wrap">
                              <input type="number" class="rate-input grind-input" v-num="grindStartSystemFatigue" min="0" :max="SYSTEM_DAILY_FATIGUE" step="10"
                                @input="setGrindStartFatigue('startSystemFatigue', ($event.target as HTMLInputElement).value, SYSTEM_DAILY_FATIGUE)" />
                              <span class="grind-num-unit">/380</span>
                            </div>
                          </label>
                          <label class="grind-field">
                            <span class="grind-field-label">起始日剩余大疲劳
                              <span class="grind-info" title="模拟开始时本周剩余大疲劳：若本周已用掉一部分可调低；仅影响起始日所在周，每周一 0 点重置回每周大疲劳满额。清空 = 满额（= 每周大疲劳）。">ⓘ</span>
                            </span>
                            <div class="grind-num-wrap">
                              <input type="number" class="rate-input grind-input" v-num="grindStartBigFatigue" min="0" :max="grindConfig.bigFatigueCap ?? DEFAULT_BIG_FATIGUE_CAP" step="50"
                                @input="setGrindStartFatigue('startBigFatigue', ($event.target as HTMLInputElement).value, grindConfig.bigFatigueCap ?? DEFAULT_BIG_FATIGUE_CAP)" />
                              <span class="grind-num-unit">/周</span>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 等级段设置弹窗（分段模式的刷图怪物群勾选，主面板只读显示摘要；默认勾选来自 B 表最优组合） -->
                <div class="modal-overlay" v-if="segmentSettingsOpen" @click.self="segmentSettingsOpen = false">
                  <div class="modal grind-modal" style="width: 560px; max-width: 92vw; max-height: 86vh;">
                    <div class="modal-head">
                      <h4>⚙ 等级段刷图设置<span class="grind-sec-sub">按等级段指定刷图怪物群 · 勾选即打（不做地图竞争）· 默认 = 经验表 B 表最优组合</span></h4>
                      <button class="btn-icon" @click="segmentSettingsOpen = false">✕</button>
                    </div>
                    <div class="modal-body grind-modal-body">
                      <div class="grind-sec">
                        <!-- 等级段切换行：每个段在一行内编辑起止等级，点击切换下方勾选列表 -->
                        <div class="grind-seg-tabs">
                          <div v-for="(seg, si) in grindSegments" :key="si"
                            :class="['grind-seg-tab', { active: segEditingIdx === si }]"
                            :title="`${seg.levelFrom}~${seg.levelTo} 级 · 已勾选 ${seg.monsterIds.length} 个怪物群（点击切换）`"
                            @click="segEditingIdx = si">
                            <input type="number" class="rate-input grind-input grind-seg-tab-input" v-num="seg.levelFrom"
                              min="1" max="200" title="本段起始等级（闭区间）" @click.stop
                              @change="setSegmentLevel(si, 'levelFrom', ($event.target as HTMLInputElement).value)" />
                            <span class="grind-seg-tab-tilde">~</span>
                            <input type="number" class="rate-input grind-input grind-seg-tab-input" v-num="seg.levelTo"
                              min="1" max="200" title="本段结束等级（闭区间，含两端）" @click.stop
                              @change="setSegmentLevel(si, 'levelTo', ($event.target as HTMLInputElement).value)" />
                            <span class="grind-seg-tab-count" v-if="seg.monsterIds.length > 0">{{ seg.monsterIds.length }}</span>
                            <button class="grind-seg-tab-del" title="删除本等级段（可用 ＋ 在缺口处补回）" @click.stop="removeSegment(si)">✕</button>
                          </div>
                          <button class="grind-seg-tab-add" title="在未覆盖的等级缺口处新增一段（删除中间段后可点此补回）" @click="addSegment()">＋</button>
                        </div>
                        <!-- 当前选中段的怪物群勾选：列出该段刷怪范围 [段起−7, 段止+8] 内有群怪的地图的全部怪群；
                             窗口外群灰显可勾（升级到相邻等级后可打，本级无经验不参与统计） -->
                        <template v-if="grindSegments.length > 0">
                          <div class="grind-seg-hint">
                            段 {{ grindSegments[activeSegIdx]?.levelFrom }}~{{ grindSegments[activeSegIdx]?.levelTo }} 级打怪：勾选即打（不做地图竞争）· 等级未覆盖的天数不打怪 · 灰显 = 段窗口外（本级无经验）
                          </div>
                          <div class="grind-areas">
                            <template v-if="segmentEditMonsters.length > 0">
                              <div v-for="area in segmentEditAreas" :key="area" class="grind-area">
                                <div class="grind-area-head" @click="toggleGrindArea(area, segAreaCheckedCount(activeGrindSeg, area))" title="点击展开/折叠">
                                  <span class="grind-area-caret">{{ grindAreaOpen(area, segAreaCheckedCount(activeGrindSeg, area)) ? '▾' : '▸' }}</span>
                                  <span class="grind-area-name">{{ area }}</span>
                                  <span v-if="segAreaCheckedCount(activeGrindSeg, area) > 0" class="grind-area-checked-count">{{ segAreaCheckedCount(activeGrindSeg, area) }}</span>
                                </div>
                                <template v-if="grindAreaOpen(area, segAreaCheckedCount(activeGrindSeg, area))">
                                  <template v-for="sg in grindSegmentsInArea(area, segmentEditMonsters)" :key="sg.key">
                                    <div class="grind-area-seg">{{ sg.label }}</div>
                                    <div class="grind-area-groups">
                                      <label v-for="g in sg.groups" :key="g.id"
                                        :class="['grind-group-chip', { checked: activeGrindSeg.monsterIds.includes(g.id) }, { 'grind-group-chip--off': !segMonsterInWindow(g, activeGrindSeg) }]"
                                        :title="`${area}${g.level}${g.name}（数量 ${g.quantity}）`"
                                        @click.prevent="toggleSegMonster(activeSegIdx, g.id)">
                                        <input type="checkbox" class="grind-checkbox" :checked="activeGrindSeg.monsterIds.includes(g.id)" @click.stop="toggleSegMonster(activeSegIdx, g.id)" />
                                        {{ g.level }}{{ g.name }}({{ g.quantity }})
                                      </label>
                                    </div>
                                  </template>
                                </template>
                              </div>
                            </template>
                            <div v-else class="grind-empty-tip">该段刷怪范围内暂无怪物数据</div>
                          </div>
                        </template>
                        <div v-else class="grind-empty-tip">尚未配置等级段，点击上方"＋"添加（等级未覆盖的天数不打怪）</div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 经验道具面板：默认折叠，点击标题展开/折叠（2026-08-27 恢复支持折叠） -->
                <section class="ec-panel" :class="{ 'ec-panel--collapsed': !ecPanelOpen('items') }">
                  <div class="ec-panel-head" @click="toggleEcPanel('items')" title="点击折叠/展开">
                    <span class="ec-panel-caret">{{ ecPanelOpen('items') ? '▾' : '▸' }}</span>
                    <span class="ec-panel-title">💊 经验道具</span>
                    <span class="ec-task-sub-count">（{{ ecActiveItemCount }} 种在用）</span>
                    <span class="grind-segment-spacer"></span>
                    <button v-if="ecActiveItemCount > 0" class="grind-head-btn" title="一键取消全部勾选（数量与列表顺序保留，重新勾选即恢复）" @click.stop="clearEcItems">✕ 清除</button>
                  </div>
                  <div class="ec-panel-body" v-show="ecPanelOpen('items')">
                    <div class="ec-task-grid">
                      <label
                        v-for="item in ecSortedItems"
                        :key="item.id"
                        v-show="isEcItemSelected(item.id) || ecShowAllItems"
                        :class="['ec-task-chip', {
                          checked: isEcItemSelected(item.id),
                        }]"
                        title="点击整块或名称切换勾选（取消勾选后数量保留）"
                        @click.prevent="toggleEcItem(item.id)"
                      >
                        <input type="checkbox" class="ec-chip-checkbox" :checked="isEcItemSelected(item.id)" @click.stop="toggleEcItem(item.id)" />
                        <span class="ec-task-chip-name"
                          :title="itemDaysOf(item).length >= 7 ? itemDisplayName(item) : itemDisplayName(item) + '（只在 ' + weekDaysText(itemDaysOf(item)) + ' 能吃）'">{{ itemDisplayName(item) }}</span>
                        <span v-if="!itemDaysOf(item).includes(activityDay)" class="ec-task-chip-closed" title="该道具今天不开放，已在逐天明细中按开放日计算">休</span>
                        <span v-if="itemPeriodOf(item) === 'weekly'" class="ec-task-chip-type">🗓 每周</span>
                        <span class="ec-task-chip-rate">×{{ getItemMultiplier(item.id) }}</span>
                        <input
                          type="number"
                          class="ec-item-count-input"
                          v-num="ecItemCounts[item.id] ?? 0"
                          @input="setItemCount(item.id, ($event.target as HTMLInputElement).value)"
                          @click.stop
                          min="0"
                          :max="itemMaxCount(item)"
                          :title="(itemPeriodOf(item) === 'weekly' ? '每周可用次数' : '每日可用次数') + (itemPeriodOf(item) === 'weekly' && item.maxPerWeek ? '（至多 ' + item.maxPerWeek + ' 个/周）' : '') + (itemDaysOf(item).length < 7 ? '（只在 ' + weekDaysText(itemDaysOf(item)) + ' 能吃）' : '') + '（填入数量即自动勾选，清零即取消勾选；取消勾选不影响已填数量）'"
                          placeholder="0"
                        />
                      </label>
                    </div>
                    <div class="ec-items-toggle" v-if="ecActiveItemCount < allExpItems.length">
                      <button class="ec-items-toggle-btn" @click="ecShowAllItems = !ecShowAllItems">
                        {{ ecShowAllItems ? '△ 收起未选中' : '▽ 显示全部（' + (allExpItems.length - ecActiveItemCount) + ' 种未选）' }}
                      </button>
                    </div>
                  </div>
                </section>

                <!-- 加成道具面板（时效型：百分比加成 + 次数型祝福语；第 1 天起按剩余天数生效，到期次日失效） -->
                <section class="ec-panel" :class="{ 'ec-panel--collapsed': !ecPanelOpen('bonus') }">
                  <div class="ec-panel-head" @click="toggleEcPanel('bonus')" title="点击折叠/展开">
                    <span class="ec-panel-caret">{{ ecPanelOpen('bonus') ? '▾' : '▸' }}</span>
                    <span class="ec-panel-title">🧧 加成道具</span>
                    <span class="ec-task-sub-count">（{{ activeBonusCount }} 项生效）</span>
                    <span class="grind-segment-spacer"></span>
                    <button class="grind-head-btn" title="新增自定义加成道具" @click.stop="addBonusItem">+ 新增</button>
                  </div>
                  <div class="ec-panel-body" v-show="ecPanelOpen('bonus')">
                    <div class="bonus-list">
                      <!-- 每行一个道具：☑ 勾选启用 | 名称 + 剩余天数 + ⚙ 设置（效果/类型/数值在设置弹窗内） -->
                      <div v-for="item in bonusItems" :key="item.id" class="bonus-row" :class="{ 'bonus-row--off': !bonusItemEnabled(item.id) }">
                        <input type="checkbox" class="ec-chip-checkbox bonus-enable-check" :checked="bonusItemEnabled(item.id)"
                          :title="(bonusItemEnabled(item.id) ? '停用 ' : '启用 ') + item.name + '（本方案勾选即启用，不勾不计入本方案模拟，其他方案互不影响）'"
                          @change="setBonusEnabled(item.id, ($event.target as HTMLInputElement).checked)" />
                        <span class="bonus-name" :title="bonusDesc(item)">{{ item.name }}</span>
                        <span class="bonus-summary bonus-remain">剩{{ item.startRemainDays }}/{{ item.validDays }}天</span>
                        <button class="bonus-config-btn" title="打开加成道具设置（类型/数值/任务范围/开始天数/有效期）" @click="openBonusModal(item.id)">⚙ 设置</button>
                      </div>
                      <div v-if="bonusItems.length === 0" class="ec-task-empty">暂无加成道具，点击「+ 新增」添加</div>
                    </div>
                  </div>
                </section>

                <!-- 加成道具设置弹窗（行内保持一行摘要，详细配置在弹窗内编辑，对齐倍率设置弹窗） -->
                <div class="modal-overlay" v-if="bonusModalItem" @click.self="bonusModalItemId = null">
                  <div class="modal grind-modal" style="width: 480px; max-width: 92vw; max-height: 86vh;">
                    <div class="modal-head">
                      <h4>🧧 加成道具设置</h4>
                      <button class="btn-icon" @click="bonusModalItemId = null" title="关闭">✕</button>
                    </div>
                    <div class="modal-body grind-modal-body">
                      <div class="bonus-modal-row">
                        <span class="bonus-modal-label">名称</span>
                        <input class="rate-item-name-input" v-model="editingBonusName" autofocus
                          @keydown.enter="commitBonusName" @keydown.escape="bonusModalItemId = null" @blur="commitBonusName" />
                      </div>
                      <div class="bonus-modal-row">
                        <span class="bonus-modal-label">类型</span>
                        <div class="bonus-type-toggle">
                          <button :class="['bonus-type-btn', { active: bonusModalItem.useMult === undefined }]"
                            title="百分比型：按百分比加成 打怪/道具/任务 经验"
                            @click="setBonusType(bonusModalItem.id, false)">% 百分比型</button>
                          <button :class="['bonus-type-btn', { active: bonusModalItem.useMult !== undefined }]"
                            title="次数型：每次使用给 倍率 × 标准单位经验（如祝福语 0.25），每天次数随方案保存"
                            @click="setBonusType(bonusModalItem.id, true)">× 次数型</button>
                        </div>
                      </div>
                      <!-- 百分比型：三个来源加成 -->
                      <template v-if="bonusModalItem.useMult === undefined">
                        <div class="bonus-modal-row">
                          <span class="bonus-modal-label">打怪加成</span>
                          <input type="number" class="rate-input bonus-modal-input" v-num="bonusModalItem.grindPct || ''"
                            min="0" step="0.1" placeholder="0" title="打怪经验加成（%）"
                            @input="setBonusPct(bonusModalItem.id, 'grindPct', ($event.target as HTMLInputElement).value)" />
                          <span class="bonus-modal-hint">%</span>
                        </div>
                        <div class="bonus-modal-row">
                          <span class="bonus-modal-label">道具加成</span>
                          <input type="number" class="rate-input bonus-modal-input" v-num="bonusModalItem.itemPct || ''"
                            min="0" step="0.1" placeholder="0" title="道具经验加成（%，作用于吃经验道具获得的经验）"
                            @input="setBonusPct(bonusModalItem.id, 'itemPct', ($event.target as HTMLInputElement).value)" />
                          <span class="bonus-modal-hint">%</span>
                        </div>
                        <div class="bonus-modal-row">
                          <span class="bonus-modal-label">任务加成</span>
                          <input type="number" class="rate-input bonus-modal-input" v-num="bonusModalItem.taskPct || ''"
                            min="0" step="0.1" placeholder="0" title="任务经验加成（%，作用于下方「任务范围」勾选的任务；翻倍 = 100）"
                            @input="setBonusPct(bonusModalItem.id, 'taskPct', ($event.target as HTMLInputElement).value)" />
                          <span class="bonus-modal-hint">%</span>
                        </div>
                      </template>
                      <!-- 次数型：每次倍率 + 每天次数（次数随方案，不设 60 上限） -->
                      <template v-else>
                        <div class="bonus-modal-row">
                          <span class="bonus-modal-label">每次倍率</span>
                          <input type="number" class="rate-input bonus-modal-input" v-num="bonusModalItem.useMult"
                            min="0" step="0.01" title="每次使用给 倍率 × 标准单位经验（类型请用上方按钮切换）"
                            @input="setBonusUseMult(bonusModalItem.id, ($event.target as HTMLInputElement).value)" />
                          <span class="bonus-modal-hint">× 标准单位经验</span>
                        </div>
                        <div class="bonus-modal-row">
                          <span class="bonus-modal-label">每天次数</span>
                          <input type="number" class="rate-input bonus-modal-input" v-num="ecItemCounts[bonusModalItem.id] ?? (bonusModalItem.defaultCount ?? 0)"
                            min="0" :max="BONUS_USE_DAILY_MAX" step="1" title="每天使用次数（随方案保存；未设置时内置祝福语默认 1440 = 每分钟一次，至多 1440 次/天，不设 60 上限）"
                            @input="setItemCount(bonusModalItem.id, ($event.target as HTMLInputElement).value)" />
                          <span class="bonus-modal-hint">次/天（随方案保存{{ bonusModalItem.defaultCount ? `，默认 ${bonusModalItem.defaultCount}` : '' }}）</span>
                        </div>
                      </template>
                      <div class="bonus-modal-row">
                        <span class="bonus-modal-label">开始天数</span>
                        <input type="number" class="rate-input bonus-modal-input" v-num="bonusModalItem.startDay"
                          min="1" max="3650" step="1" title="模拟第 N 天起生效（第 N 天即消耗 1 天）；默认 1 = 起始日；调高 = 延后启用；清空 = 回起始日"
                          @input="setBonusStartDay(bonusModalItem.id, ($event.target as HTMLInputElement).value)" />
                        <span class="bonus-modal-hint">第 1 天 = 起始日（默认）</span>
                      </div>
                      <div class="bonus-modal-row">
                        <span class="bonus-modal-label">有效天数</span>
                        <input type="number" class="rate-input bonus-modal-input" v-num="bonusModalItem.validDays"
                          min="1" step="1" title="总有效期（天），不设上限；调低时剩余天数自动收窄到新上限"
                          @input="setBonusValidDays(bonusModalItem.id, ($event.target as HTMLInputElement).value)" />
                        <span class="bonus-modal-hint">总有效期（不设上限）</span>
                      </div>
                      <div class="bonus-modal-row">
                        <span class="bonus-modal-label">剩余天数</span>
                        <input type="number" class="rate-input bonus-modal-input" v-num="bonusModalItem.startRemainDays"
                          min="1" step="1" title="生效窗口 = 第 开始天数 天起共 剩余天数 天；不设上限，可超过总有效期；调低 = 已用掉一部分；清空 = 回满总有效期"
                          @input="setBonusRemain(bonusModalItem.id, ($event.target as HTMLInputElement).value)" />
                        <span class="bonus-modal-hint">天（不设上限；总有效期 {{ bonusModalItem.validDays }} 天）</span>
                      </div>
                      <!-- 任务加成作用域（taskPct > 0 或已勾选任务时显示） -->
                      <div v-if="bonusModalItem.taskPct > 0 || bonusModalItem.taskIds.length > 0" class="bonus-modal-row bonus-modal-row--col">
                        <span class="bonus-modal-label">任务范围</span>
                        <div class="bonus-modal-hint">任务经验 × (1 + 任务加成%)；勾选即生效、不勾不生效</div>
                        <div class="bonus-task-chips">
                          <label v-for="t in ALL_BONUS_TASKS" :key="t.id"
                            :class="['ec-task-chip', { checked: bonusModalItem.taskIds.includes(t.id) }]">
                            <input type="checkbox" class="ec-chip-checkbox" :checked="bonusModalItem.taskIds.includes(t.id)"
                              @change="toggleBonusTaskId(bonusModalItem.id, t.id)" />
                            <span class="ec-task-chip-name">{{ t.name }}</span>
                          </label>
                          <div v-if="ALL_BONUS_TASKS.length === 0" class="rate-column-empty">当前等级无可用的活跃任务</div>
                        </div>
                      </div>
                      <div v-if="isCustomBonusItem(bonusModalItem.id)" class="bonus-modal-del">
                        <button class="bonus-modal-del-btn" @click="deleteBonusItem(bonusModalItem.id)">✕ 删除此道具</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 倍率设置弹窗（统一：任务倍率 + 等级段倍率） -->
            <div class="modal-overlay" v-if="showRateModal" @click.self="closeRateModal">
              <div class="modal modal--rate" style="width: auto; max-width: min(960px, 94vw);">
                <div class="modal-head">
                  <h4>⚙ 倍率设置</h4>
                  <div class="ec-subtabs">
                    <button
                      :class="['ec-subtab', { 'ec-subtab--active': rateSubTab === 'tasks' }]"
                      @click="rateSubTab = 'tasks'"
                    >任务倍率</button>
                    <button
                      :class="['ec-subtab', { 'ec-subtab--active': rateSubTab === 'ranges' }]"
                      @click="rateSubTab = 'ranges'"
                    >等级段倍率</button>
                  </div>
                  <button class="btn-icon" @click="closeRateModal">✕</button>
                </div>

                <!-- Tab: 任务倍率 -->
                <div class="modal-body rate-modal-body rate-modal-body--cols" v-show="rateSubTab === 'tasks'">
                  <div class="rate-hint">倍率 × 标准单位经验 × 次数 = 该任务/道具贡献的经验值。已配置等级段倍率的任务不在此处显示，请到「等级段倍率」标签页设置。</div>

                  <!-- 搜索过滤 -->
                  <div class="rate-filter-bar">
                    <input
                      v-model="rateFilter"
                      class="me-filter-input rate-filter-input"
                      placeholder="🔍 搜索任务/道具名称..."
                    />
                    <button v-if="rateFilter" class="btn-icon" @click="rateFilter = ''" title="清除搜索">✕</button>
                  </div>

                  <!-- 经验加成两列：活跃任务 / 每日经验道具（打怪经验在打怪面板中配置，为等级与策略相关计算结果而非静态倍率） -->
                  <div class="rate-columns">
                    <!-- 列1 活跃任务 -->
                      <div class="rate-column">
                      <div class="rate-column-head">🎯 活跃任务<span class="rate-column-count">{{ filteredRateTasks.length }}</span><span class="rate-drag-tip">⣿ 可拖拽排序</span></div>
                      <div class="rate-column-body">
                        <div v-for="t in filteredRateTasks" :key="t.id" class="rate-row"
                          :class="{
                            'rate-row--dragging': rateTaskDrag.dragId.value === t.id,
                            'rate-row--dragover': rateTaskDrag.dragOverId.value === t.id && rateTaskDrag.dragId.value !== t.id,
                          }"
                          :draggable="!rateFilter"
                          :title="rateFilter ? '搜索过滤中，清除搜索后可拖拽排序' : '拖拽整行调整顺序'"
                          @dragstart="rateTaskDrag.onDragStart($event, t.id)"
                          @dragend="rateTaskDrag.onDragEnd"
                          @dragover.prevent="rateTaskDrag.onDragOver($event, t.id)"
                          @dragleave="rateTaskDrag.onDragLeave(t.id)"
                          @drop.prevent="rateTaskDrag.onDrop(t.id)"
                        >
                          <span class="rate-drag-handle">⣿</span>
                          <span class="rate-task-name" :title="t.name">{{ t.name }}</span>
                          <input type="number" class="rate-input"
                            v-num="ecMultipliers[t.id] ?? ''"
                            placeholder="0"
                            @input="setMultiplier(t.id, ($event.target as HTMLInputElement).value)"
                            min="0" step="0.1" />
                        </div>
                        <div v-if="filteredRateTasks.length === 0" class="rate-column-empty">{{ rateFilter ? '🔍 无匹配任务' : '暂无任务' }}</div>
                      </div>
                    </div>

                    <!-- 列2 每日经验道具（支持新增/改名/删除自定义道具） -->
                      <div class="rate-column">
                      <div class="rate-column-head">💊 经验道具<span class="rate-column-count">{{ filteredRateItems.length }}</span><span class="rate-drag-tip">⣿ 可拖拽排序</span>
                        <button class="rate-item-add-btn" @click="addExpItem" title="新增经验道具">+ 新增</button>
                      </div>
                      <div class="rate-column-body">
                        <template v-for="item in filteredRateItems" :key="item.id">
                          <div class="rate-row"
                            :class="{
                              'rate-row--dragging': rateItemDrag.dragId.value === item.id,
                              'rate-row--dragover': rateItemDrag.dragOverId.value === item.id && rateItemDrag.dragId.value !== item.id,
                            }"
                            :draggable="!rateFilter && editingItemId !== item.id"
                            :title="rateFilter ? '搜索过滤中，清除搜索后可拖拽排序' : '拖拽整行调整顺序'"
                            @dragstart="rateItemDrag.onDragStart($event, item.id)"
                            @dragend="rateItemDrag.onDragEnd"
                            @dragover.prevent="rateItemDrag.onDragOver($event, item.id)"
                            @dragleave="rateItemDrag.onDragLeave(item.id)"
                            @drop.prevent="rateItemDrag.onDrop(item.id)"
                          >
                            <span class="rate-drag-handle">⣿</span>
                            <template v-if="editingItemId === item.id">
                              <input
                                class="rate-item-name-input"
                                v-model="editingItemName"
                                @keydown.enter="commitItemName"
                                @keydown.escape="editingItemId = null"
                                @blur="commitItemName"
                                autofocus
                              />
                            </template>
                            <template v-else>
                              <span class="rate-item-name-group">
                                <span class="rate-task-name" :title="item.name">{{ itemDisplayName(item) }}</span>
                                <button class="rate-item-btn" @click="startEditItemName(item.id)" title="编辑名称">✏️</button>
                              </span>
                            </template>
                            <button
                              class="rate-item-period"
                              :class="{ 'rate-item-period--weekly': itemPeriodOf(item) === 'weekly' }"
                              :title="itemPeriodOf(item) === 'weekly' ? '每周道具：次数为每周可用数，逐天明细按周分摊' + (item.maxPerWeek ? '（至多 ' + item.maxPerWeek + ' 个/周）' : '') : '每日道具：每天可用该次数'"
                              @click="toggleItemPeriod(item.id)"
                            >{{ itemPeriodOf(item) === 'weekly' ? '🗓 每周' : '每日' }}</button>
                            <button
                              class="rate-item-period"
                              :class="{ 'rate-item-period--weekly': editingItemDaysId === item.id }"
                              :title="itemDaysOf(item).length >= 7 ? '开放日：每天都能吃' : '开放日：只在 ' + weekDaysText(itemDaysOf(item)) + ' 能吃（点击可修改）'"
                              @click="editingItemDaysId = editingItemDaysId === item.id ? null : item.id"
                            >{{ itemDaysLabel(item) }}</button>
                            <input type="number" class="rate-input"
                              v-num="ecItemMultipliers[item.id] ?? item.baseMultiplier"
                              @input="setItemMultiplier(item.id, ($event.target as HTMLInputElement).value)"
                              min="0" step="0.01" />
                            <button v-if="isCustomItem(item.id)" class="rate-item-btn rate-item-del" @click="deleteExpItem(item.id)" title="删除此道具">✕</button>
                          </div>
                          <div v-if="editingItemDaysId === item.id" class="rate-item-days-bar">
                            <span class="rate-item-days-hint">开放日：道具只在勾选的星期可吃（全选 = 每天都能吃）</span>
                            <button
                              v-for="d in dayOptions" :key="d.value"
                              :class="['day-chip', { on: itemDaysOf(item).includes(d.value) }]"
                              @click="toggleItemDay(item, d.value)"
                            >{{ d.label.slice(1) }}</button>
                          </div>
                        </template>
                        <div v-if="filteredRateItems.length === 0" class="rate-column-empty">{{ rateFilter ? '🔍 无匹配道具' : '暂无道具' }}</div>
                      </div>
                    </div>

                  </div>
                </div>

                <!-- Tab: 等级段倍率 -->
                <div class="modal-body rate-modal-body" v-show="rateSubTab === 'ranges'">
                  <div class="rate-hint">设置活动在各等级段的默认经验倍率。用户未手动设置任务倍率时，将使用此处的等级段倍率。可自由增删等级段和活动。</div>
                  <div class="rate-section" v-for="(def, actId) in editingLevelMults" :key="actId">
                    <div class="rate-section-head">
                      {{ def.name }}
                      <button class="lvmult-del-act" @click="deleteLevelMultActivity(actId)" title="删除此活动">✕</button>
                    </div>
                    <div class="lvmult-table-wrap">
                      <table class="lvmult-table">
                        <thead>
                          <tr>
                            <th>最低等级</th>
                            <th>最高等级</th>
                            <th>倍率</th>
                            <th class="lvmult-th-act"></th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(r, ri) in def.ranges" :key="ri">
                            <td class="lvmult-td-lv">
                              <input type="number" class="rate-input"
                                v-model.number="r.minLevel"
                                min="1" max="155" />
                            </td>
                            <td class="lvmult-td-lv">
                              <input type="number" class="rate-input"
                                v-model.number="r.maxLevel"
                                min="1" max="155" />
                            </td>
                            <td class="lvmult-td-mult">
                              <input type="number" class="rate-input"
                                v-model.number="r.multiplier"
                                min="0" step="0.1" />
                            </td>
                            <td class="lvmult-td-act">
                              <button class="lvmult-del-btn" @click="deleteLevelMultRange(actId, ri)" title="删除此等级段">✕</button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <button class="lvmult-add-btn" @click="addLevelMultRange(actId)">+ 添加等级段</button>
                    </div>
                  </div>
                  <div class="lvmult-add-act">
                    <button class="lvmult-add-btn" @click="addLevelMultActivity">+ 添加活动等级段配置</button>
                  </div>
                </div>

                <div class="modal-foot">
                  <button class="task-reset-btn" @click="goToActivityCalc">📋 活跃计算器</button>
                  <span class="modal-foot-spacer"></span>
                  <button class="task-save-btn" @click="closeRateModal">保存</button>
                </div>
              </div>
            </div>

            <!-- 全局经验设定弹窗（封印加速 & 王城加成 & 打怪衰减率，均不随方案切换） -->
            <div class="modal-overlay" v-if="showAccelModal" @click.self="closeAccelModal">
              <div class="modal modal--rate">
                <div class="modal-head">
                  <h4>🔒 全局经验设定</h4>
                  <button class="btn-icon" @click="closeAccelModal">✕</button>
                </div>
                <div class="modal-body rate-modal-body">
                  <div class="rate-hint">经验计算 = 基础经验 × (1 + 封印加速率 + 王城加成)。勾选启用封印加速。</div>
                  <label class="ec-accel-toggle">
                    <input type="checkbox" :checked="ecAccelEnabled" @change="toggleAccel" />
                    <span>启用封印加速</span>
                  </label>
                  <div class="rate-section" v-if="ecAccelEnabled">
                    <div class="rate-section-head">🔒 封印加速等级段<span class="rate-level-hint">加速率填百分比，如 20 = 20%</span></div>
                    <div class="lvmult-table-wrap">
                      <table class="lvmult-table">
                        <thead>
                          <tr>
                            <th class="lvmult-td-lv">起始等级</th>
                            <th class="lvmult-td-lv">结束等级</th>
                            <th class="lvmult-td-mult">加速率（%）</th>
                            <th class="lvmult-th-act"></th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(tier, i) in editingAccelTiers" :key="i">
                            <td class="lvmult-td-lv">
                              <input type="number" class="rate-input" v-model.number="tier.minLevel" min="1" max="155" />
                            </td>
                            <td class="lvmult-td-lv">
                              <input type="number" class="rate-input" v-model.number="tier.maxLevel" min="1" max="155" />
                            </td>
                            <td class="lvmult-td-mult">
                              <input type="number" class="rate-input" v-model.number="tier.rate" min="0" max="500" step="1" />
                            </td>
                            <td class="lvmult-td-act">
                              <button class="lvmult-del-btn" @click="deleteAccelTier(i)" title="删除此等级段">✕</button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <button class="lvmult-add-btn" @click="addAccelTier">+ 添加等级段</button>
                    </div>
                  </div>
                  <div class="rate-section">
                    <div class="rate-section-head">🏰 跨服王城胜利经验加成</div>
                    <div class="rate-row">
                      <span class="rate-task-name">王城胜利加成率（%）</span>
                      <input type="number" class="rate-input"
                        v-num="Math.round(ecWangchengBonus * 100)"
                        @input="setWangchengBonus(($event.target as HTMLInputElement).value)"
                        min="0" max="200" step="1" />
                    </div>
                  </div>
                  <!-- 打怪衰减率：全局共享（不随方案切换，2026-08-27 起与封印加速同属全局经验设定） -->
                  <div class="rate-section">
                    <div class="rate-section-head">🔒 打怪衰减率<span class="rate-level-hint">小X = 怪物比角色高 X 级 · 大X = 角色比怪物高 X 级 · 可编辑 · 全局共享</span></div>
                    <div class="grind-decay-grid">
                      <label v-for="diff in DECAY_RATE_DIFFS" :key="diff" :class="['grind-decay-cell', { same: diff === 0 }]">
                        <span class="grind-decay-label">{{ decayRateLabel(diff) }}</span>
                        <div class="grind-num-wrap">
                          <input type="number" class="rate-input" v-num="decayRatePct(diff)" min="0" max="100" step="0.01"
                            @input="setDecayRate(diff, ($event.target as HTMLInputElement).value)" />
                          <span class="grind-num-unit">%</span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
                <div class="modal-foot">
                  <button class="task-reset-btn" @click="resetAccelTiers">恢复默认</button>
                  <span class="modal-foot-spacer"></span>
                  <button class="task-save-btn" @click="closeAccelModal">确定</button>
                </div>
              </div>
            </div>
          </div>

        </template>
        <!-- 怪物基础经验表（A 表）+ 每级最高效率打怪群（B 表，只读） -->
        <template v-else-if="activeCat === 'monster-exp'">
          <div class="exp-table-wrap">
            <div class="exp-table-toolbar">
              <div class="exp-table-toolbar-left">
                <div class="exp-tab-switch">
                  <button class="exp-tab-btn" :class="{ active: monsterExpView === 'a' }" @click="monsterExpView = 'a'">A 怪物经验表</button>
                  <button class="exp-tab-btn" :class="{ active: monsterExpView === 'b' }" @click="monsterExpView = 'b'">B 最优打怪组合</button>
                  <button class="exp-tab-btn" :class="{ active: monsterExpView === 'c' }" @click="monsterExpView = 'c'">C 等级经验表</button>
                </div>
                <span v-if="monsterExpView === 'a'" class="exp-table-hint">💡 淡色底、值带虚线的列可双击编辑；灰字 ⚙ 列自动计算不可编辑 · 共 {{ filteredMonsterExp.length }} / {{ monsterExpData.length }} 条</span>
                <button v-if="monsterExpView === 'a'" class="lv-btn lv-btn-add" @click="addMonsterExpRow">➕ 新增怪物</button>
              </div>
              <div class="exp-table-toolbar-right">
                <button class="lv-btn" :disabled="exportingExp" title="把 A 怪物经验表 / B 最优打怪组合 / C 等级经验表导出为一个 Excel 文件" @click="exportExpExcel">{{ exportingExp ? '⏳ 导出中…' : '📥 导出 Excel' }}</button>
              </div>
            </div>
            <!-- A 表：怪物数据（可编辑，B 表数据源） -->
            <template v-if="monsterExpView === 'a'">
              <div class="exp-table-scroll" v-if="filteredMonsterExp.length > 0">
              <table class="exp-table">
                <thead>
                  <tr>
                    <th class="me-th-name">怪物名称</th>
                    <th
                      class="me-th-area"
                      :class="{ 'me-th-area--filtered': monsterExpAreaFilter }"
                      @click="toggleAreaFilterMenu"
                      :title="monsterExpAreaFilter ? '当前筛选：' + monsterExpAreaFilter + '，点击更换' : '点击按地区筛选'"
                    >
                      <span v-if="monsterExpAreaFilter" class="me-area-dot">●</span>地区
                      <span class="me-area-caret">{{ meAreaFilterOpen ? '▲' : '▼' }}</span>
                      <div v-if="meAreaFilterOpen" class="me-area-menu">
                        <div class="me-area-backdrop" @click.stop="meAreaFilterOpen = false"></div>
                        <div class="me-area-items">
                          <button
                            class="me-area-item"
                            :class="{ 'me-area-item--active': !monsterExpAreaFilter }"
                            @click.stop="setAreaFilter(null)"
                          >全部 <span class="me-area-count">{{ monsterExpData.length }}</span></button>
                          <button
                            v-for="a in monsterExpAreas"
                            :key="a.name"
                            class="me-area-item"
                            :class="{ 'me-area-item--active': monsterExpAreaFilter === a.name }"
                            @click.stop="setAreaFilter(a.name)"
                          >{{ a.name }} <span class="me-area-count">{{ a.count }}</span></button>
                        </div>
                      </div>
                    </th>
                    <th class="me-th-lv" @click="toggleMonsterExpSort" style="cursor:pointer; user-select:none;">
                      等级 {{ monsterExpSortDir === 'asc' ? '▲' : '▼' }}
                    </th>
                    <th class="me-th-exp">基础经验</th>
                    <th class="me-th-fatigue">疲劳消耗</th>
                    <th class="me-th-unit me-th-ro" title="自动计算：基础经验 ÷ 疲劳消耗，不可编辑">单位经验 ⚙</th>
                    <th class="me-th-mult">中十倍数</th>
                    <th class="me-th-adj me-th-ro" title="自动计算：单位经验 × 中十加成，不可编辑">修正经验 ⚙</th>
                    <th class="me-th-qty">数量</th>
                    <th class="me-th-respawn">刷新周期(秒)</th>
                    <th class="me-th-kill">打怪时间(秒)</th>
                    <th class="me-th-eff me-th-ro" title="自动计算：每小时疲劳烧速 × 疲劳 × 数量，不可编辑">效率(PL/小时) ⚙</th>
                    <th class="exp-th-act"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, ri) in filteredMonsterExp" :key="row.id" :id="'me-row-' + row.id">
                    <td class="me-td-name me-td-editable" @dblclick.stop="startMeEdit(ri, 'name')">
                      <input v-if="isMeEditing(ri, 'name')" data-me-editing class="exp-input" v-model="meEditValue" @blur="finishMeEdit(ri, 'name')" @keydown.enter="finishMeEdit(ri, 'name')" @keydown.escape="cancelMeEdit" autofocus />
                      <span v-else>{{ row.name }}</span>
                    </td>
                    <td class="me-td-area me-td-editable" @dblclick.stop="startMeEdit(ri, 'area')">
                      <input v-if="isMeEditing(ri, 'area')" data-me-editing class="exp-input" v-model="meEditValue" @blur="finishMeEdit(ri, 'area')" @keydown.enter="finishMeEdit(ri, 'area')" @keydown.escape="cancelMeEdit" autofocus />
                      <span v-else>{{ row.area }}</span>
                    </td>
                    <td class="me-td-lv me-td-editable" @dblclick.stop="startMeEdit(ri, 'level')">
                      <input v-if="isMeEditing(ri, 'level')" data-me-editing class="exp-input" v-model.number="meEditValue" @blur="finishMeEdit(ri, 'level')" @keydown.enter="finishMeEdit(ri, 'level')" @keydown.escape="cancelMeEdit" autofocus />
                      <span v-else>{{ row.level }}</span>
                    </td>
                    <td class="me-td-exp me-td-editable" :class="{ 'me-td-exp-zero': row.base_exp === 0 }" @dblclick.stop="startMeEdit(ri, 'base_exp')">
                      <input v-if="isMeEditing(ri, 'base_exp')" data-me-editing class="exp-input" v-model.number="meEditValue" @blur="finishMeEdit(ri, 'base_exp')" @keydown.enter="finishMeEdit(ri, 'base_exp')" @keydown.escape="cancelMeEdit" autofocus />
                      <span v-else>{{ row.base_exp.toLocaleString() }}</span>
                    </td>
                    <td class="me-td-fatigue me-td-editable" @dblclick.stop="startMeEdit(ri, 'fatigue')">
                      <input v-if="isMeEditing(ri, 'fatigue')" data-me-editing class="exp-input" v-model.number="meEditValue" @blur="finishMeEdit(ri, 'fatigue')" @keydown.enter="finishMeEdit(ri, 'fatigue')" @keydown.escape="cancelMeEdit" autofocus />
                      <span v-else>{{ row.fatigue }}</span>
                    </td>
                    <td class="me-td-unit">
                      <span>{{ row.fatigue > 0 ? (row.base_exp / row.fatigue).toFixed(1) : '—' }}</span>
                    </td>
                    <td class="me-td-mult me-td-editable" @dblclick.stop="startMeEdit(ri, 'multiplier')">
                      <input v-if="isMeEditing(ri, 'multiplier')" data-me-editing class="exp-input" v-model.number="meEditValue" @blur="finishMeEdit(ri, 'multiplier')" @keydown.enter="finishMeEdit(ri, 'multiplier')" @keydown.escape="cancelMeEdit" autofocus />
                      <span v-else>{{ row.multiplier }}</span>
                    </td>
                    <td class="me-td-adj">
                      <span>{{ row.fatigue > 0 ? ((row.base_exp / row.fatigue) * (1 + (row.multiplier - 1) * 0.05)).toFixed(1) : '—' }}</span>
                    </td>
                    <td class="me-td-qty me-td-editable" @dblclick.stop="startMeEdit(ri, 'quantity')">
                      <input v-if="isMeEditing(ri, 'quantity')" data-me-editing class="exp-input" v-model.number="meEditValue" @blur="finishMeEdit(ri, 'quantity')" @keydown.enter="finishMeEdit(ri, 'quantity')" @keydown.escape="cancelMeEdit" autofocus />
                      <span v-else>{{ row.quantity }}</span>
                    </td>
                    <td class="me-td-respawn me-td-editable" @dblclick.stop="startMeEdit(ri, 'respawn_time')">
                      <input v-if="isMeEditing(ri, 'respawn_time')" data-me-editing class="exp-input" v-model.number="meEditValue" @blur="finishMeEdit(ri, 'respawn_time')" @keydown.enter="finishMeEdit(ri, 'respawn_time')" @keydown.escape="cancelMeEdit" autofocus />
                      <span v-else>{{ row.respawn_time }}</span>
                    </td>
                    <td class="me-td-kill me-td-editable" @dblclick.stop="startMeEdit(ri, 'kill_time')" title="打死一批怪所需时间(秒)，怪死后才开始刷新计时">
                      <input v-if="isMeEditing(ri, 'kill_time')" data-me-editing class="exp-input" v-model.number="meEditValue" @blur="finishMeEdit(ri, 'kill_time')" @keydown.enter="finishMeEdit(ri, 'kill_time')" @keydown.escape="cancelMeEdit" autofocus />
                      <span v-else>{{ row.kill_time ?? 2 }}</span>
                    </td>
                    <td class="me-td-eff">
                      <span>{{ row.respawn_time > 0 ? ((3600 / (row.respawn_time + (row.kill_time ?? 2))) * row.fatigue * row.quantity).toFixed(1) : '—' }}</span>
                    </td>
                    <td class="exp-td-act">
                      <button class="lv-btn-copy" @click="duplicateMonsterExpRow(row.id)" title="复制此行，新增一条相同数据">⧉</button>
                      <button class="lv-btn-del" @click="deleteMonsterExpRow(row.id)" title="删除此行">✕</button>
                    </td>
                  </tr>
                </tbody>
              </table>
              </div>
              <div class="hint" v-else-if="monsterExpData.length === 0">加载中...</div>
              <div class="hint" v-else>无匹配结果</div>
            </template>
            <!-- B 表：每级"最优打怪群组合"（默认 = 单位经验获取效率最高；可编辑、每级可恢复默认） -->
            <template v-else-if="monsterExpView === 'b'">
              <div class="exp-table-scroll">
                <table class="exp-table">
                  <thead>
                    <tr>
                      <th class="be-th-lv">等级</th>
                      <th class="be-th-area">地区</th>
                      <th class="be-th-group">最优打怪群组合</th>
                      <th class="be-th-week">每周可获得经验</th>
                      <th class="be-th-why">为什么</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in bestGrindAreaRows" :key="row.level" :class="{ 'be-tr--edited': row.overridden }">
                      <td class="be-td-lv">{{ row.level }}</td>
                      <td class="be-td-area">{{ row.area }}</td>
                      <td class="be-td-group">
                        <span class="be-group-text">{{ row.group }}</span>
                        <button class="be-edit-btn" @click="openGrindEdit(row.level)" :title="'编辑 ' + row.level + ' 级打怪群组合'">✎ 编辑</button>
                        <button v-if="row.overridden" class="be-reset-btn" @click="resetGrindCombo(row.level)" :title="'恢复默认组合（清除 ' + row.level + ' 级自定义）'">↺ 恢复默认</button>
                      </td>
                      <td class="be-td-week" :class="row.weekClass">{{ row.weekText }}</td>
                      <td class="be-td-why">{{ row.explain }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="hint">💡 默认组合 = 地区内全部合格群（勾选即打）、地区间取每周经验最高（疲劳瓶颈下每小时经验高 ≠ 每周经验高，按每周经验比，2026-08-27 起），由 A 表自动计算，每级一行。可点 ✎ 编辑该级组合（勾选窗口 {{ BEST_GRIND_LEVEL_FROM }}~{{ BEST_GRIND_LEVEL_TO }} 内群怪所在地图的全部怪群，可跨地区），保存后存本机、行内重算指标，每周经验与默认组合相比增长显示红色、降低显示绿色；点 ↺ 恢复默认清除该级自定义。窗口外的怪群可提前勾选保存（升级到相邻等级后可打，本级无经验不参与统计）。指标 = 每周可获得经验：每周刷怪上限 580 分钟、疲劳容量 5180（系统 380×7 + 大疲劳 2520，默认值），取先到者 × 每小时经验；烧速 &gt; 535.9/时即疲劳瓶颈（每周 = 5180 × 每疲劳经验）。全局因子（2026-08-27 起）：打怪衰减率跟随全局经验设定弹窗的自定义值（改衰减率会同时改变最优组合与数值）；经验值含封印加速 + 王城加成总倍率（按本行等级查段，倍率 ≠ 1 时在「为什么」列标注），双倍/齐心为乘性常数不改变组合间排序、不纳入。A 表增删改或全局经验设定修改后自动刷新。</div>
              <!-- 编辑弹层：勾选窗口内群怪所在地图的全部怪群组成自定义组合（作用于单级） -->
              <div class="modal-overlay" v-if="grindEditLevel !== null" @click.self="closeGrindEdit()">
                <div class="modal grind-modal" style="width: 640px; max-width: 92vw; max-height: 86vh;">
                  <div class="modal-head">
                    <h4>✎ 打怪群组合 · {{ grindEditTitle }}</h4>
                    <button class="btn-icon" @click="closeGrindEdit()">✕</button>
                  </div>
                  <div class="modal-body grind-modal-body">
                    <div class="grind-cand-tip">勾选 {{ grindEditTitle }} 衰减窗口（{{ grindEditLevel !== null ? grindEditLevel - 7 : '' }}~{{ grindEditLevel !== null ? grindEditLevel + 8 : '' }} 级）内群怪所在地图的全部怪群，可跨地区；灰显 = 窗口外（本级无经验，勾选保存、升级到相邻等级后可打）。不勾选 = 无候选。</div>
                    <div v-for="(areaGroups, area) in grindEditCandidates" :key="area" class="grind-cand-area">
                      <div class="grind-cand-area-name">{{ area }}</div>
                      <label v-for="c in areaGroups" :key="c.m.id" class="grind-cand-item"
                        :class="[{ 'grind-cand-item--checked': grindEditChecked.has(c.m.id) }, { 'grind-cand-item--off-window': !c.inWindow }]">
                        <input type="checkbox" class="grind-day-check" :checked="grindEditChecked.has(c.m.id)" @change="toggleGrindEdit(c.m.id)" />
                        <span class="grind-cand-name">{{ c.m.level }}{{ c.m.name }}({{ c.m.quantity }})</span>
                        <span v-if="!c.inWindow" class="grind-cand-off">窗口外</span>
                        <span class="grind-cand-meta">每疲劳 {{ Math.round(c.q).toLocaleString('zh-CN') }} · 烧速 {{ Math.round(c.eff).toLocaleString('zh-CN') }}/时</span>
                      </label>
                    </div>
                    <div v-if="Object.keys(grindEditCandidates).length === 0" class="hint">该等级窗口内无合格群</div>
                  </div>
                  <div class="modal-foot">
                    <span class="grind-cand-count">已勾选 {{ grindEditChecked.size }} 群</span>
                    <span class="modal-foot-spacer"></span>
                    <button class="lv-btn" @click="closeGrindEdit()">取消</button>
                    <button class="lv-btn lv-btn-add" @click="saveGrindEdit()">保存</button>
                  </div>
                </div>
              </div>
            </template>
            <!-- C 表：等级经验表（原独立卡片，2026-08-23 融合） -->
            <template v-else>
              <div class="exp-table-toolbar">
                <div class="exp-table-toolbar-left">
                  <span class="exp-table-hint">💡 双击单元格编辑，失焦自动保存 · 共 {{ expData.length }} 行</span>
                </div>
                <div class="exp-table-toolbar-right">
                  <button class="lv-btn lv-btn-add" @click="addExpRow">➕ 新增行</button>
                </div>
              </div>
              <div class="exp-table-scroll" v-if="expData.length > 0">
                <table class="exp-table">
                  <thead>
                    <tr>
                      <th class="exp-th-lv">等级</th>
                      <th class="exp-th-exp">升级经验</th>
                      <th class="exp-th-su">标准单位经验</th>
                      <th class="exp-th-act"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, ri) in expData" :key="row.level">
                      <td class="exp-td-lv">{{ row.level }}</td>
                      <td class="exp-td-exp" @dblclick.stop="startExpEdit(ri, 'exp')">
                        <input v-if="isExpEditing(ri, 'exp')" data-exp-editing class="exp-input" v-model.number="expEditValue" @blur="finishExpEdit(ri, 'exp')" @keydown.enter="finishExpEdit(ri, 'exp')" @keydown.escape="cancelExpEdit" autofocus />
                        <span v-else>{{ row.exp.toLocaleString() }}</span>
                      </td>
                      <td class="exp-td-su" @dblclick.stop="startExpEdit(ri, 'standard_unit_exp')">
                        <input v-if="isExpEditing(ri, 'standard_unit_exp')" data-exp-editing class="exp-input" v-model.number="expEditValue" @blur="finishExpEdit(ri, 'standard_unit_exp')" @keydown.enter="finishExpEdit(ri, 'standard_unit_exp')" @keydown.escape="cancelExpEdit" autofocus />
                        <span v-else>{{ row.standard_unit_exp.toLocaleString() }}</span>
                      </td>
                      <td class="exp-td-act">
                        <button class="lv-btn-del" @click="deleteExpRow(row.level)" title="删除此行">✕</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="hint" v-else>加载中...</div>
            </template>
          </div>
        </template>
        <!-- 减伤标准表 -->
        <template v-else-if="activeCat === 'dr-table'">
          <div class="dr-wrap">
            <div class="dr-section">
              <h3 class="dr-section-title">⚔ 副本减伤要求</h3>
              <div class="dr-table-wrap">
                <table class="dr-table">
                  <thead>
                    <tr>
                      <th class="dr-th-name">副本</th>
                      <th>普通</th>
                      <th>英雄</th>
                      <th>战神</th>
                      <th>武圣</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="d in drDungeons" :key="d.name">
                      <td class="dr-td-name">{{ d.name }}</td>
                      <td>{{ formatDungeonCell(d.normal) }}</td>
                      <td>{{ formatDungeonCell(d.hero) }}</td>
                      <td>{{ formatDungeonCell(d.warrior) }}</td>
                      <td>{{ formatDungeonCell(d.saint) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="dr-section">
              <h3 class="dr-section-title">🗺 野外减伤标准</h3>
              <div class="dr-table-wrap">
                <table class="dr-table dr-table--wild">
                  <thead>
                    <tr>
                      <th class="dr-th-name">地图</th>
                      <th>专注</th>
                      <th>减伤</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="w in drWilderness" :key="w.name">
                      <td class="dr-td-name">{{ w.name }}</td>
                      <td>{{ formatFocus(w.focusMultiplier) }}</td>
                      <td>{{ formatDR(w.damageReduction) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </template>
        <!-- 韧性表 -->
        <template v-else-if="activeCat === 'toughness'">
          <div class="toughness-wrap">
            <div class="exp-table-toolbar">
              <div class="exp-table-toolbar-left">
                <span class="exp-table-hint">💡 韧性等级对应「减少受到的怪物伤害」，减伤计算器查本表实时展示百分比 · 精华/五铢/活力列为升到该等级的加点消耗 · 精华单价来自物价图鉴，可直接编辑同步</span>
              </div>
              <div class="exp-table-toolbar-right">
                <span class="toughness-calc-label">从</span>
                <input v-num="toughFrom" type="number" min="1" max="50" class="task-level-input" @input="toughFrom = clampToughLevel(Number(($event.target as HTMLInputElement).value))" />
                <span class="toughness-calc-label">级到</span>
                <input v-num="toughTo" type="number" min="1" max="50" class="task-level-input" @input="toughTo = clampToughLevel(Number(($event.target as HTMLInputElement).value))" />
                <span class="toughness-calc-label">级</span>
              </div>
            </div>
            <!-- 区间计算结果：属性变化 / 加点消耗 / 精华市场成本（未录入时补录并同步回物价图鉴） -->
            <div class="toughness-calc" v-if="toughCalc">
              <div class="toughness-calc-line">
                <span class="toughness-calc-line-label">精华单价（万三国币）</span>
                <span class="toughness-calc-value">韧性之精华</span>
                <input v-num="renPriceInput" type="number" min="0" step="0.01" class="task-level-input toughness-price-input" placeholder="未录入" @input="renPriceInput = ($event.target as HTMLInputElement).value" @blur="saveEssencePriceOnBlur()" />
              </div>
              <div class="toughness-calc-line">
                <span class="toughness-calc-line-label">属性变化</span>
                <span class="toughness-calc-value">体质 +{{ toughCalc.constitution }} 点</span>
                <span class="toughness-calc-sep">·</span>
                <span class="toughness-calc-value">破甲忽略 +{{ toughCalc.armorIgnore.toFixed(1) }}%</span>
                <span class="toughness-calc-sep">·</span>
                <span class="toughness-calc-value">生命上限 +{{ toughCalc.healthCap }}%</span>
                <span class="toughness-calc-sep">·</span>
                <span class="toughness-calc-value">怪物减伤 +{{ toughCalc.monsterDR.toFixed(1) }}%</span>
              </div>
              <div class="toughness-calc-line">
                <span class="toughness-calc-line-label">加点消耗</span>
                <span class="toughness-calc-value">精华 {{ toughCalc.essence }} 个</span>
                <span class="toughness-calc-sep">·</span>
                <span class="toughness-calc-value" :title="toughCalc.wuzhu.toLocaleString()">五铢 {{ fmtExp(toughCalc.wuzhu) }}</span>
                <span class="toughness-calc-sep">·</span>
                <span class="toughness-calc-value" :title="toughCalc.vitality.toLocaleString()">活力 {{ fmtExp(toughCalc.vitality) }}</span>
                <span class="toughness-calc-sep">·</span>
                <span class="toughness-calc-value">韧性精华成本</span>
                <span v-if="renCostShown" class="toughness-calc-cost" :title="`单价 ${fmtExp((toughEssenceCosts ?? 0) / toughCalc.essence)} 三国币/个 × ${toughCalc.essence} 个`">{{ fmtEssenceCost(toughEssenceCosts ?? 0) }} 三国币</span>
                <span v-else class="toughness-calc-missing">未录入</span>
              </div>
            </div>
            <div class="toughness-calc-err" v-else>目标等级需高于起始等级</div>
            <div class="exp-table-scroll">
              <table class="exp-table toughness-table">
                <thead>
                  <tr>
                    <th class="tough-th-level">等级</th>
                    <th>体质</th>
                    <th>破甲&反击忽略</th>
                    <th>生命上限</th>
                    <th>怪物减伤</th>
                    <th>精华</th>
                    <th>五铢</th>
                    <th>活力</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in toughnessRows" :key="row.level">
                    <td class="tough-td-level">{{ row.level }}</td>
                    <td>+{{ row.constitution }} 点</td>
                    <td>降低 {{ row.armorIgnore.toFixed(1) }}%</td>
                    <td>+{{ row.healthCap }}%</td>
                    <td class="tough-td-dr">减少 {{ row.monsterDR.toFixed(1) }}%</td>
                    <td>{{ row.essence }}</td>
                    <td :title="row.wuzhu.toLocaleString()">{{ fmtExp(row.wuzhu) }}</td>
                    <td :title="row.vitality.toLocaleString()">{{ fmtExp(row.vitality) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
        <!-- 普通攻略内容 -->
        <template v-else>
          <div class="card" v-if="currentGuides.length > 0">
            <div v-for="g in currentGuides" :key="g.title" class="guide-card">
              <div class="guide-card-head">
                <h4>{{ g.title }}</h4>
                <span class="badge-sm">{{ g.level }}</span>
              </div>
              <p class="guide-body" v-html="g.body"></p>
              <div class="guide-tags" v-if="g.tags">
                <span v-for="t in g.tags" :key="t" class="guide-tag">{{ t }}</span>
              </div>
            </div>
          </div>
          <div class="hint" v-else>攻略整理中...</div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, shallowRef, computed, watch, nextTick } from 'vue'
import levelingData from '@/data/leveling-guide.json'
import activityCalcData from '@/data/activity-calc.json'
import BossHandbook from '@/components/boss/BossHandbook.vue'
import drData from '@/data/damage-reduction-table.json'
import toughnessData from '@/data/toughness-table.json'
import activityExpMultipliers from '@/data/activity-exp-multipliers.json'
import {
  dailyGrindExp,
  monsterEfficiency,
  monsterGroupId,
  WEEKLY_GRIND_MIN_CAP,
  WEEKLY_QIXIN_MIN_CAP,
  SYSTEM_DAILY_FATIGUE,
  DEFAULT_BIG_FATIGUE_CAP,
  DECAY_RATE_DIFFS,
  DEFAULT_DECAY_RATES,
  grindRatesAtLevel,
  type GrindCalcResult,
  type GrindConfig,
  type GrindMonster,
  type GrindRates,
  type GrindSegment,
} from '@/utils/grindExp'
import { computeBestGrindGroups, computeGrindComboStats, formatBestGrindGroups, listAreaFullCandidates, listGrindCandidates } from '@/utils/bestGrindArea'
import { settleDay, type DayExpRow } from '@/utils/dayExp'
import {
  bonusMultsOnDay,
  bonusUseItemsOnDay,
  sanitizeBonusItems,
  DEFAULT_BONUS_ITEMS,
  type ExpBonusItem,
} from '@/utils/expBonus'
// 数字输入框绑定：代替 :value，聚焦期间不回写 DOM（否则重渲染会顶掉正在输入的内容）
import { vNum } from '@/utils/numInput'
import { useAppStore } from '@/stores'

type ActivityDef = { id: string; name: string; points: number; days: number[]; minLevel: number; maxLevel?: number; maxCompletions?: number; levelPoints?: Record<number, number>; note: string; type?: 'daily' | 'some' | 'weekly' }
type TierConfig = { target: number; tier1: number; tier2: number; tier3: number; tier1Pt?: number; tier2Pt?: number }
type ServerBonus = Record<string, Record<string, string[]>>

const activities = (activityCalcData as any).activities as ActivityDef[]
const serverBonus = (activityCalcData as any).serverBonus as ServerBonus
const tierConfig = (activityCalcData as any).tierConfig as Record<string, TierConfig>

// 所有大区名列表
const allServers = Object.keys(serverBonus)

// 自定义任务池（null = 使用默认）
const customTaskPool = ref<ActivityDef[] | null>(null)
const activeTaskPool = computed(() => customTaskPool.value ?? activities)

// 任务类型归属：显式 type 优先，无 type 时按 days 推断（7 天=每天，≤2 天=每周，其余=某几天）
// 类型已固定（历史设置保留生效），不再提供编辑入口
type TaskType = 'daily' | 'some' | 'weekly'

function taskTypeOf(t: ActivityDef): TaskType {
  if (t.type) return t.type
  if (t.days.length >= 7) return 'daily'
  if (t.days.length <= 2) return 'weekly'
  return 'some'
}

// 某天某道具可用次数：先按开放日过滤（当天不开放 → 0）；
// 每日道具开放日每天 count 个；每周道具每周 count 个，按累计配额均匀分摊到该周开放日（每周总量不变）
function itemCountOnDay(item: ExpItem, day: number): number {
  const total = ecItemCounts.value[item.id] ?? 0
  if (total <= 0) return 0
  const days = itemDaysOf(item)
  const dow = ((day - 1) % 7) + 1
  if (!days.includes(dow)) return 0
  if (itemPeriodOf(item) !== 'weekly') return total
  // 到当天为止该道具累计开放次数（跨周累计）：每周 days.length 个开放日
  const opensUpTo = Math.floor((day - 1) / 7) * days.length + days.filter(d => d <= dow).length
  return Math.floor(opensUpTo * total / days.length) - Math.floor((opensUpTo - 1) * total / days.length)
}

// 某天某任务可完成的次数：只在 days 当天出现；每周任务按每周上限 maxCompletions 分摊到可用日
function taskCountOnDay(t: ActivityDef, dow: number): number {
  if (!t.days.includes(dow)) return 0
  const count = ecCompletions.value[t.id] ?? 1
  if (taskTypeOf(t) !== 'weekly') return count
  const max = t.maxCompletions ?? 1
  const perWeek = Math.max(1, Math.min(count, max))
  const weekDayIdx = t.days.filter(d => d <= dow).length // 该周内第几个可用日
  return weekDayIdx <= perWeek ? 1 : 0
}

// 任务管理弹窗
const showTaskMgr = ref(false)
const editingTaskPool = ref<ActivityDef[]>([])

function openTaskMgr() {
  editingTaskPool.value = JSON.parse(JSON.stringify(activeTaskPool.value))
  showTaskMgr.value = true
}

function addTaskToPool() {
  const newId = 'custom_' + Date.now()
  editingTaskPool.value.unshift({ id: newId, name: '新任务', points: 10, days: [1,2,3,4,5,6,7], minLevel: 70, maxLevel: 0, maxCompletions: 1, note: '' })
}

function removeTaskFromPool(idx: number) {
  editingTaskPool.value.splice(idx, 1)
}

function toggleTaskDay(t: ActivityDef, day: number) {
  if (t.days.includes(day)) {
    t.days = t.days.filter(d => d !== day)
  } else {
    t.days = [...t.days, day].sort()
  }
}

async function saveTaskPool() {
  const oldPool = customTaskPool.value ?? activities
  const oldIds = new Set(oldPool.map(t => t.id))
  customTaskPool.value = JSON.parse(JSON.stringify(editingTaskPool.value))
  showTaskMgr.value = false
  await window.electronAPI.setSetting('activity_task_pool', JSON.stringify(customTaskPool.value))
  // 清理已删除任务的残留配置（各方案勾选/次数、任务倍率、等级段倍率），避免幽灵勾选
  const removed = oldPool.filter(t => !customTaskPool.value!.some(x => x.id === t.id)).map(t => t.id)
  if (removed.length > 0) cleanupTaskConfigs(new Set(removed))
}

// 清理指定任务的残留配置：各方案勾选/完成次数、全局任务倍率、等级段倍率
function cleanupTaskConfigs(removedIds: Set<string>) {
  let presetsChanged = false
  for (const p of ecPresets.value) {
    const completions = { ...p.completions }
    let dirty = false
    for (const id of removedIds) {
      if (id in completions) { delete completions[id]; dirty = true }
    }
    if (dirty) { p.completions = completions; presetsChanged = true }
  }
  if (presetsChanged) savePresets()

  const mult = { ...ecMultipliers.value }
  let multChanged = false
  for (const id of removedIds) {
    if (id in mult) { delete mult[id]; multChanged = true }
  }
  if (multChanged) { ecMultipliers.value = mult; saveShared() }

  const lvl = { ...levelMults.value }
  let lvlChanged = false
  for (const id of removedIds) {
    if (id in lvl) { delete lvl[id]; lvlChanged = true }
  }
  if (lvlChanged) { levelMults.value = lvl; saveLevelMults() }
}

function resetTaskPool() {
  editingTaskPool.value = JSON.parse(JSON.stringify(activities))
}

const expandedTask = ref(-1)

function setLevelPoint(t: ActivityDef, lv: number, raw: string) {
  const v = raw.trim()
  if (v === '') {
    // 删除覆盖，使用默认值
    if (t.levelPoints) {
      delete t.levelPoints[lv]
      if (Object.keys(t.levelPoints).length === 0) delete t.levelPoints
    }
    return
  }
  const n = parseInt(v)
  if (isNaN(n) || n < 1) return
  if (!t.levelPoints) t.levelPoints = {}
  t.levelPoints[lv] = n
}


// 选择器状态（等级/星期/大区 2026-08-27 起持久化：改动即存、启动恢复；未保存过时星期默认今天）
const todayJs = new Date().getDay()
const ACTIVITY_SEL_KEY = 'activity_selectors'
const activityLevel = ref(70)
const activityDay = ref(todayJs === 0 ? 7 : todayJs)
const activityServer = ref(allServers[0] || '')

async function loadActivitySelectors() {
  try {
    const raw = await window.electronAPI.getSetting(ACTIVITY_SEL_KEY)
    if (!raw) return
    const s = JSON.parse(raw)
    if (levels.includes(s.level)) activityLevel.value = s.level
    if (Number.isInteger(s.day) && s.day >= 1 && s.day <= 7) activityDay.value = s.day
    if (typeof s.server === 'string' && allServers.includes(s.server)) activityServer.value = s.server
  } catch { /* use defaults */ }
}

async function saveActivitySelectors() {
  try {
    await window.electronAPI.setSetting(ACTIVITY_SEL_KEY, JSON.stringify({
      level: activityLevel.value, day: activityDay.value, server: activityServer.value,
    }))
  } catch { /* ignore */ }
}

// 已完成任务次数: taskId → 完成次数
const completedTasks = ref<Record<string, number>>({})

function taskCount(taskId: string): number {
  return completedTasks.value[taskId] ?? 0
}

function maxCompletionsFor(taskId: string): number {
  const t = activeTaskPool.value.find(a => a.id === taskId)
  return t?.maxCompletions ?? 1
}

// 工资汇总弹窗
const showWageModal = ref(false)

// 各等级工资汇总
const wageSummary = computed(() => {
  const summary: Record<number, { target: number; tier1Pt: number; tier2Pt: number; tier1: number; tier2: number; tier3: number; total: number }> = {}
  for (const lv of levels) {
    const base = tierConfig[String(lv)] || { target: 300, tier1: 0, tier2: 0, tier3: 0 }
    const custom = customTiers.value[String(lv)]
    const target = custom?.target ?? base.target
    const t1 = custom?.tier1 ?? base.tier1
    const t2 = custom?.tier2 ?? base.tier2
    const t3 = custom?.tier3 ?? base.tier3
    const t1p = custom?.tier1Pt ?? base.tier1Pt ?? Math.round(target / 3)
    const t2p = custom?.tier2Pt ?? base.tier2Pt ?? Math.round(target * 2 / 3)
    summary[lv] = { target, tier1Pt: t1p, tier2Pt: t2p, tier1: t1, tier2: t2, tier3: t3, total: t1 + t2 + t3 }
  }
  return summary
})

// 工资汇总编辑状态
const wageEdit = ref<{ lv: number; field: string } | null>(null)
const wageEditValue = ref('')

function startWageEdit(lv: number, field: string) {
  const ws = wageSummary.value[lv]
  wageEdit.value = { lv, field }
  wageEditValue.value = String((ws as any)[field] ?? 0)
}

async function saveWageEdit() {
  if (!wageEdit.value) return
  const { lv, field } = wageEdit.value
  const val = parseInt(wageEditValue.value)
  if (isNaN(val) || val < 0) { cancelWageEdit(); return }
  const lvKey = String(lv)
  if (!customTiers.value[lvKey]) {
    const base = tierConfig[lvKey] || { target: 300, tier1: 0, tier2: 0, tier3: 0 }
    customTiers.value[lvKey] = { target: base.target, tier1: base.tier1, tier2: base.tier2, tier3: base.tier3 }
  }
  (customTiers.value[lvKey] as any)[field] = val
  wageEdit.value = null
  wageEditValue.value = ''
  await saveAllTiers()
}

function cancelWageEdit() {
  wageEdit.value = null
  wageEditValue.value = ''
}

// ── 缓存 key ──
function cacheKey(prefix: string): string {
  return `${prefix}:${activityLevel.value}:${activityDay.value}:${activityServer.value}`
}

// 自定义档位奖励（按等级缓存）
const customTiers = ref<Record<string, { target?: number; tier1: number; tier2: number; tier3: number; tier1Pt?: number; tier2Pt?: number }>>({})

// 当前组合的福利任务 ID 集合（运行时）
const bonusSet = ref<Set<string>>(new Set())

// 当前组合的任务排序
const taskOrder = ref<string[]>([])

// ── 加载缓存 ──
let cacheGen = 0
async function loadCache() {
  const gen = ++cacheGen
  const ck = cacheKey('activity_check')
  const bk = cacheKey('activity_bonus')
  const ok = cacheKey('activity_order')
  const tk = `activity_tiers_all`

  try {
    const [checks, bonus, order, tiersAll] = await Promise.all([
      window.electronAPI.getSetting(ck),
      window.electronAPI.getSetting(bk),
      window.electronAPI.getSetting(ok),
      window.electronAPI.getSetting(tk),
    ])
    if (gen !== cacheGen) return // stale, discard
    // 加载已完成次数（兼容旧格式：数组按 count=1 处理）
    const rawChecks: string[] | Record<string, number> | null = checks ? JSON.parse(checks) : null
    let nextChecks: Record<string, number> | null = null
    if (Array.isArray(rawChecks)) {
      if (rawChecks.length > 0) {
        const obj: Record<string, number> = {}
        for (const id of rawChecks) obj[id] = 1
        nextChecks = obj
      }
    } else if (rawChecks && typeof rawChecks === 'object') {
      const hasPositive = Object.values(rawChecks).some(v => v > 0)
      if (hasPositive) nextChecks = rawChecks as Record<string, number>
    }
    if (nextChecks) {
      completedTasks.value = nextChecks
    }
    // else: keep previous completedTasks (do not clear, do not save)
    // 加载福利任务并清理当前等级不可用的任务
    const rawBonus: string[] = bonus ? JSON.parse(bonus) : []
    bonusSet.value = new Set(rawBonus.filter(id => {
      const task = activeTaskPool.value.find(a => a.id === id)
      const maxLv = task?.maxLevel || 999
      return task && task.minLevel <= activityLevel.value && maxLv >= activityLevel.value
    }))
    taskOrder.value = order ? JSON.parse(order) : []
    if (tiersAll) {
      customTiers.value = JSON.parse(tiersAll)
    }
  } catch { /* use defaults */ }
}

const saveTimers: Record<string, ReturnType<typeof setTimeout>> = {}
function debouncedSave(key: string, fn: () => void) {
  if (saveTimers[key]) clearTimeout(saveTimers[key])
  saveTimers[key] = setTimeout(fn, 300)
}

// ── 拖拽排序 ──
const dragId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)

function onDragStart(e: DragEvent, id: string) {
  dragId.value = id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }
}

function onDragEnd() {
  dragId.value = null
  dragOverId.value = null
}

function onDragOver(e: DragEvent, id: string) {
  if (dragId.value && dragId.value !== id) {
    dragOverId.value = id
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  }
}

function onDragLeave(id: string) {
  if (dragOverId.value === id) {
    dragOverId.value = null
  }
}

function onDrop(targetId: string) {
  if (!dragId.value || dragId.value === targetId) return
  // 用 visibleTasks 的顺序（已包含自定义排序），而非原始数据顺序
  const ids = visibleTasks.value.map(t => t.id)
  const fromIdx = ids.indexOf(dragId.value)
  const toIdx = ids.indexOf(targetId)
  if (fromIdx < 0 || toIdx < 0) return
  ids.splice(fromIdx, 1)
  ids.splice(toIdx, 0, dragId.value)
  taskOrder.value = ids
  dragId.value = null
  dragOverId.value = null
  debouncedSave('order', saveOrder)
}

async function saveChecks() {
  // Only persist non-zero entries
  const obj: Record<string, number> = {}
  for (const [id, count] of Object.entries(completedTasks.value)) {
    if (count > 0) obj[id] = count
  }
  await window.electronAPI.setSetting(cacheKey('activity_check'), JSON.stringify(obj))
}

async function saveBonus() {
  await window.electronAPI.setSetting(cacheKey('activity_bonus'), JSON.stringify([...bonusSet.value]))
}

async function saveOrder() {
  await window.electronAPI.setSetting(cacheKey('activity_order'), JSON.stringify(taskOrder.value))
}

async function saveAllTiers() {
  await window.electronAPI.setSetting('activity_tiers_all', JSON.stringify(customTiers.value))
}


// ── 活跃计算 常量 ──

// 活跃任务默认排序
const DEFAULT_TASK_ORDER = [
  'legion_task',      // 军团任务
  'gaixia_xueyi',     // 垓下学艺
  'mieshu_jingcang',  // 灭鼠靖仓
  'yunshu_wuzi',      // 运送物资
  'tuiju_xiaolian',   // 推举孝廉
  'puzzle',           // 拼图
  'shijiu_yunyou',    // 诗酒云游
  'qiqizhen',         // 七旗阵
  'beimangshan',      // 勇闯北邙山
  'baguazhen',        // 八卦阵
  'yewai_boss',       // 野外boss
  'yewai_guaiwu',     // 野外怪物
  'yuji_huanjing',    // 于吉幻境
  'guoling_muxian',   // 国令募贤
  'bianjing',         // 边境争夺战
]

const levels = [70, 80, 90, 100, 110, 120, 130, 140, 150]
const dayOptions = [
  { value: 1, label: '周一' }, { value: 2, label: '周二' },
  { value: 3, label: '周三' }, { value: 4, label: '周四' },
  { value: 5, label: '周五' }, { value: 6, label: '周六' },
  { value: 7, label: '周日' },
]

// ── 活跃计算 computed ──

const cfg = computed<TierConfig>(() => {
  const base = tierConfig[String(activityLevel.value)] || { target: 300, tier1: 0, tier2: 0, tier3: 0 }
  const custom = customTiers.value[String(activityLevel.value)]
  if (custom) {
    return { ...base, target: custom.target ?? base.target, tier1: custom.tier1, tier2: custom.tier2, tier3: custom.tier3, tier1Pt: custom.tier1Pt ?? base.tier1Pt, tier2Pt: custom.tier2Pt ?? base.tier2Pt }
  }
  return base
})

const dayLabel = computed(() => {
  const d = dayOptions.find(x => x.value === activityDay.value)
  return d?.label ?? ''
})

// 福利任务对象数组
const bonusTasks = computed(() => {
  return activeTaskPool.value.filter(a => bonusSet.value.has(a.id) && a.minLevel <= activityLevel.value)
})

// 增强后的任务列表（带衍生字段）
type TaskView = ActivityDef & { isBonus: boolean; levelTooHigh: boolean; displayPoints: number }

const visibleTasks = computed<TaskView[]>(() => {
  let list = activeTaskPool.value
    .filter(a => a.days.includes(activityDay.value) && a.minLevel <= activityLevel.value && (a.maxLevel || 999) >= activityLevel.value)
    .map(a => {
      const isBonus = bonusSet.value.has(a.id)
      const maxLv = a.maxLevel || 999
      const levelTooHigh = a.minLevel > activityLevel.value || maxLv < activityLevel.value
      const pts = a.levelPoints?.[activityLevel.value] ?? a.points
      const displayPoints = levelTooHigh ? 0 : isBonus ? pts * 2 : pts
      return { ...a, isBonus, levelTooHigh, displayPoints }
    })

  // 按自定义排序或默认排序重排
  const orderSource = taskOrder.value.length > 0 ? taskOrder.value : DEFAULT_TASK_ORDER
  const orderMap = new Map(orderSource.map((id, i) => [id, i]))
  list.sort((a, b) => {
    const ai = orderMap.get(a.id) ?? 999
    const bi = orderMap.get(b.id) ?? 999
    return ai - bi
  })

  return list
})

// 总分
const totalPoints = computed(() => {
  let sum = 0
  for (const t of visibleTasks.value) {
    const count = taskCount(t.id)
    if (count > 0) {
      sum += t.displayPoints * count
    }
  }
  return sum
})

// 档位阈值
const tier1Threshold = computed(() => cfg.value.tier1Pt ?? Math.round(cfg.value.target / 3))
const tier2Threshold = computed(() => cfg.value.tier2Pt ?? Math.round(cfg.value.target * 2 / 3))

const currentTier = computed(() => {
  const pts = totalPoints.value
  if (pts >= cfg.value.target) return 3
  if (pts >= tier2Threshold.value) return 2
  if (pts >= tier1Threshold.value) return 1
  return 0
})

const remainingToFull = computed(() => Math.max(0, cfg.value.target - totalPoints.value))
const isFull = computed(() => totalPoints.value >= cfg.value.target)

const progressPct = computed(() => Math.min(100, (totalPoints.value / cfg.value.target) * 100))
const tier1Pct = computed(() => (tier1Threshold.value / cfg.value.target) * 100)
const tier2Pct = computed(() => (tier2Threshold.value / cfg.value.target) * 100)

// 初始化：如果当前星期没有对应的默认大区，取第一个
if (!activityServer.value || !serverBonus[activityServer.value]) {
  activityServer.value = allServers[0] || ''
}

function incrementTask(taskId: string) {
  const max = maxCompletionsFor(taskId)
  const cur = taskCount(taskId)
  const next = cur === 0 ? max : cur - 1
  completedTasks.value = { ...completedTasks.value, [taskId]: next }
  debouncedSave('checks', saveChecks)
}

const bonusLimitHint = ref('')

function toggleBonus(taskId: string) {
  // 检查任务是否对当前等级可用
  const task = activeTaskPool.value.find(a => a.id === taskId)
  const maxLv = task?.maxLevel || 999
  if (!task || task.minLevel > activityLevel.value || maxLv < activityLevel.value) return

  if (bonusSet.value.has(taskId)) {
    const next = new Set(bonusSet.value)
    next.delete(taskId)
    bonusSet.value = next
    bonusLimitHint.value = ''
  } else {
    if (bonusSet.value.size >= 3) {
      bonusLimitHint.value = '最多设置3个福利任务'
      setTimeout(() => { bonusLimitHint.value = '' }, 2000)
      return
    }
    const next = new Set(bonusSet.value)
    next.add(taskId)
    bonusSet.value = next
    bonusLimitHint.value = ''
  }
  debouncedSave('bonus', saveBonus)
}

watch([activityLevel, activityDay, activityServer], () => {
  loadCache()
  saveActivitySelectors() // 选择器改动即持久化，下次启动恢复（2026-08-27）
})

const activeCat = ref('')

// ── 答题题库（只读，数据来自 quiz_questions 表） ──

const quizSearch = ref('')
const hasQuizSearch = computed(() => quizSearch.value.trim() !== '')
const quizFilter = ref('all')
const quizResults = ref<QuizRow[]>([])
const quizQuestions = ref<QuizRow[]>([])
const quizLoaded = ref(false)
const quizLoading = ref(false)

const quizFilters = computed(() => {
  const cats: Record<string, number> = { all: quizQuestions.value.length }
  for (const q of quizQuestions.value) {
    cats[q.category] = (cats[q.category] || 0) + 1
  }
  return [
    { key: 'all', label: '全部', count: cats.all },
    { key: 'threeKingdoms', label: '三国知识', count: cats.threeKingdoms || 0 },
    { key: 'qqGameBasic', label: '游戏相关', count: (cats.qqGameBasic || 0) + (cats.qqGameItems || 0) + (cats.qqGameSystems || 0) },
    { key: 'general', label: '百科常识', count: (cats.general || 0) + (cats.mixed || 0) },
  ]
})

const hotTags = ['关羽', '赤壁之战', '诸葛亮', '军团', '副职业', '五虎上将', '灵魄']

const quizTotalFiltered = computed(() => quizResults.value.length)

// 进入题库时懒加载数据库数据
watch(activeCat, (cat) => {
  if (cat === 'quiz' && !quizLoaded.value) loadQuizData()
})

async function loadQuizData() {
  if (quizLoading.value) return
  quizLoading.value = true
  try {
    const rows = await window.electronAPI.getAllQuizQuestions()
    if (rows && Array.isArray(rows) && rows.length > 0) {
      quizQuestions.value = rows as QuizRow[]
    }
    quizLoaded.value = true
    if (activeCat.value === 'quiz') onQuizSearch()
  } catch (e) {
    console.warn('loadQuizData failed:', e)
  } finally {
    quizLoading.value = false
  }
}

function onQuizSearch() {
  let pool = quizQuestions.value
  if (quizFilter.value === 'threeKingdoms') {
    pool = pool.filter(q => q.category === 'threeKingdoms')
  } else if (quizFilter.value === 'qqGameBasic') {
    pool = pool.filter(q => ['qqGameBasic', 'qqGameItems', 'qqGameSystems'].includes(q.category))
  } else if (quizFilter.value === 'general') {
    pool = pool.filter(q => ['general', 'mixed'].includes(q.category))
  }

  // 无搜索词时不展示题目，默认只显示筛选与热门搜索；检索后才出结果
  const kw = quizSearch.value.trim().toLowerCase()
  if (!kw) {
    quizResults.value = []
    return
  }
  const keywords = kw.split(/\s+/)

  // Filter + smart score:
  //   1000 = literal match in question/answer text
  //   200  = match at start of question initials (keyword hits first word)
  //   50   = match in question initials (anywhere)
  //   10   = match in answer initials or full pinyin
  //   Tiebreaker: shorter question = more relevant
  const scored: { item: QuizRow; score: number }[] = []
  for (const q of pool) {
    const qi = q._qi || ''
    const ai = q._ai || ''
    const qp = q._qp || ''
    const ap = q._ap || ''
    const qText = q.question.toLowerCase()
    const aText = q.answer.toLowerCase()

    let totalScore = 0
    let matchFound = false

    for (const k of keywords) {
      let kScore = 0

      // Literal text match in question: highest priority
      if (qText.includes(k)) {
        kScore = Math.max(kScore, 1000 + (1000 - qText.indexOf(k)))
      }
      // Literal text match in answer
      if (aText.includes(k)) {
        kScore = Math.max(kScore, 800 + (800 - aText.indexOf(k)))
      }
      // Match at the very start of question initials
      if (qi.startsWith(k)) {
        kScore = Math.max(kScore, 400)
      }
      // Match in question initials
      const qiIdx = qi.indexOf(k)
      if (qiIdx >= 0) {
        // Score higher for earlier matches at word boundaries
        const boundaryBonus = qiIdx === 0 || /[^a-z]/.test(qi[qiIdx - 1] || '') ? 100 : 0
        kScore = Math.max(kScore, 200 + boundaryBonus - qiIdx)
      }
      // Match in answer initials
      if (ai.includes(k)) {
        kScore = Math.max(kScore, 50)
      }
      // Match in full pinyin
      if (qp.includes(k) || ap.includes(k)) {
        kScore = Math.max(kScore, 10)
      }

      if (kScore > 0) {
        matchFound = true
        totalScore += kScore
      }
    }

    if (!matchFound) continue

    // Tiebreaker: shorter questions are more likely directly about the topic
    totalScore += Math.max(0, 500 - q.question.length)

    scored.push({ item: q, score: totalScore })
  }

  scored.sort((a, b) => b.score - a.score)
  quizResults.value = scored.map(s => s.item)
}

// ── 题目删除 ──

async function deleteQuizItem(q: QuizRow) {
  if (!confirm(`确定删除这道题？\n\n「${q.question}」\n\n此操作不可撤销。`)) return
  try {
    await window.electronAPI.deleteQuizQuestion(q.id)
    quizQuestions.value = quizQuestions.value.filter(r => r.id !== q.id)
    onQuizSearch()
  } catch (e: any) {
    console.warn('deleteQuizQuestion failed:', e?.message || e)
    alert(`删除失败：${e?.message || e}`)
  }
}

const categories = [
  { key: 'daily', label: '每日活动', icon: '🎯' },
  { key: 'quiz', label: '答题题库', icon: '❓' },
  { key: 'leveling', label: '升级攻略', icon: '📈' },
  { key: 'activity', label: '活跃计算', icon: '📊' },
  { key: 'boss', label: 'Boss图鉴', icon: '👹' },
  { key: 'beasts', label: '灵宠八阵', icon: '🐉' },
  { key: 'children', label: '子女', icon: '👶' },
  { key: 'talisman2', label: '符咒&天书', icon: '📿' },
  { key: 'spirits', label: '灵魄', icon: '💎' },
  { key: 'aoyi', label: '奥义', icon: '📜' },
  { key: 'meridian', label: '经络', icon: '☯' },
  { key: 'lingzhu', label: '灵珠', icon: '🔮' },
  { key: 'home', label: '家园', icon: '🏡' },
  { key: 'dungeon', label: '副本', icon: '⚔' },
  { key: 'legion', label: '军团', icon: '🏰' },
  { key: 'subjob', label: '副职', icon: '🔧' },
  { key: 'intimacy', label: '亲密度', icon: '💕' },
  { key: 'playbook', label: '攻略&指南', icon: '📖' },
  { key: 'misc', label: '其他', icon: '📦' },
  { key: 'wings', label: '羽灵', icon: '🪶' },
  { key: 'sxdp', label: '四象搭配', icon: '☯' },
  { key: 'exp-calc', label: '升级计算器', icon: '🧮' },
  { key: 'monster-exp', label: '经验表', icon: '👾' },
  { key: 'dr-table', label: '减伤标准表', icon: '🛡️' },
  { key: 'toughness', label: '韧性表', icon: '💪' },
  { key: 'links', label: '官网攻略', icon: '🔗' },
]

const toolCards = computed(() => categories.filter(c => ['daily', 'quiz', 'leveling', 'activity', 'boss'].includes(c.key)))
const infoCards = computed(() => categories.filter(c => ['sxdp', 'exp-calc', 'monster-exp', 'dr-table', 'toughness'].includes(c.key)))

// ── 攻略卡片拖拽排序（持久化） ──
// 保存顺序为扁平 key 数组（全部卡片），null 表示使用默认顺序
const cardOrder = ref<string[] | null>(null)

// 互动工具卡片 key 集合（决定「互动」标记）
const toolKeySet = new Set(['daily', 'quiz', 'leveling', 'activity', 'boss'])

function orderedCards<T extends { key: string }>(list: T[]): T[] {
  const order = cardOrder.value
  if (!order || order.length === 0) return list
  const idx = new Map(order.map((k, i) => [k, i]))
  return [...list].sort((a, b) => (idx.get(a.key) ?? 999) - (idx.get(b.key) ?? 999))
}

// 全部攻略卡片（工具卡片在前，资料卡片在后，按自定义顺序排序）
const allCards = computed(() => orderedCards([...toolCards.value, ...infoCards.value]))

// 常用卡片（用户拖拽自定义，数量不限），其余卡片默认折叠
const DEFAULT_FAV_KEYS = ['daily', 'quiz', 'leveling', 'activity', 'boss']
const favKeys = ref<string[]>([...DEFAULT_FAV_KEYS])
const favSet = computed(() => new Set(favKeys.value))
const expanded = ref(false)

// 常用区 / 其他区（各自保持全局顺序）
const favCards = computed(() => allCards.value.filter(c => favSet.value.has(c.key)))
const otherCards = computed(() => allCards.value.filter(c => !favSet.value.has(c.key)))

const cardDragKey = ref<string | null>(null)
const cardDragOverKey = ref<string | null>(null)

function onCardDragStart(e: DragEvent, key: string) {
  cardDragKey.value = key
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', key)
  }
}

function onCardDragEnd() {
  cardDragKey.value = null
  cardDragOverKey.value = null
}

function onCardDragOver(e: DragEvent, key: string) {
  if (cardDragKey.value && cardDragKey.value !== key) {
    cardDragOverKey.value = key
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  }
}

function onCardDragLeave(key: string) {
  if (cardDragOverKey.value === key) cardDragOverKey.value = null
}

// 应用一次卡片移动：newFlat 为新的全局顺序，nextFavs 为移动后的常用集合
function applyCardMove(newFlat: string[], nextFavs: Set<string>) {
  cardOrder.value = newFlat
  favKeys.value = newFlat.filter(k => nextFavs.has(k))
  debouncedSave('cardOrder', saveCardOrder)
  debouncedSave('cardFavs', saveCardFavs)
}

function onCardDrop(targetKey: string) {
  const draggedKey = cardDragKey.value
  cardDragKey.value = null
  cardDragOverKey.value = null
  cardDragOverZone.value = null
  if (!draggedKey || draggedKey === targetKey) return

  const favList = favCards.value.map(c => c.key)
  const otherList = otherCards.value.map(c => c.key)
  const inFav = favSet.value.has(draggedKey)

  if (inFav === favSet.value.has(targetKey)) {
    // 同区内重排
    const list = inFav ? favList : otherList
    list.splice(list.indexOf(draggedKey), 1)
    list.splice(list.indexOf(targetKey), 0, draggedKey)
    applyCardMove([...favList, ...otherList], favSet.value)
  } else {
    // 跨区：移出原区，插入目标区目标位置
    const from = inFav ? favList : otherList
    const to = inFav ? otherList : favList
    from.splice(from.indexOf(draggedKey), 1)
    to.splice(to.indexOf(targetKey), 0, draggedKey)
    const next = new Set(favKeys.value)
    inFav ? next.delete(draggedKey) : next.add(draggedKey)
    applyCardMove([...favList, ...otherList], next)
  }
}

// 拖到区域空白处：追加到该区末尾（跨区时同时改变常用属性）
function onZoneDrop(zone: 'fav' | 'other') {
  const draggedKey = cardDragKey.value
  cardDragKey.value = null
  cardDragOverKey.value = null
  cardDragOverZone.value = null
  if (!draggedKey) return

  const favList = favCards.value.map(c => c.key)
  const otherList = otherCards.value.map(c => c.key)
  const inFav = favSet.value.has(draggedKey)
  const targetIsFav = zone === 'fav'

  if (inFav === targetIsFav) {
    const list = inFav ? favList : otherList
    list.splice(list.indexOf(draggedKey), 1)
    list.push(draggedKey)
    applyCardMove([...favList, ...otherList], favSet.value)
  } else {
    const from = inFav ? favList : otherList
    const to = inFav ? otherList : favList
    from.splice(from.indexOf(draggedKey), 1)
    to.push(draggedKey)
    const next = new Set(favKeys.value)
    inFav ? next.delete(draggedKey) : next.add(draggedKey)
    applyCardMove([...favList, ...otherList], next)
  }
}

const cardDragOverZone = ref<'fav' | 'other' | null>(null)

function onZoneDragOver(e: DragEvent, zone: 'fav' | 'other') {
  if (cardDragKey.value) {
    cardDragOverZone.value = zone
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  }
}

function onZoneDragLeave(zone: 'fav' | 'other') {
  if (cardDragOverZone.value === zone) cardDragOverZone.value = null
}

// 一键移出常用（✕ 按钮）
function removeFav(key: string) {
  const next = new Set(favKeys.value)
  next.delete(key)
  applyCardMove(allCards.value.map(c => c.key), next)
}

async function loadCardOrder() {
  try {
    const saved = await window.electronAPI.getSetting('guide_card_order')
    if (saved) cardOrder.value = JSON.parse(saved)
    const favSaved = await window.electronAPI.getSetting('guide_card_favs')
    if (favSaved) {
      const parsed = JSON.parse(favSaved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const validKeys = new Set(categories.map(c => c.key))
        favKeys.value = parsed.filter(k => validKeys.has(k))
      }
    }
  } catch { /* 使用默认顺序 */ }
}

async function saveCardOrder() {
  if (!cardOrder.value) return
  await window.electronAPI.setSetting('guide_card_order', JSON.stringify(cardOrder.value))
}

async function saveCardFavs() {
  await window.electronAPI.setSetting('guide_card_favs', JSON.stringify(favKeys.value))
}

loadCardOrder()

// ── 四象搭配数据 ──
const SXDP_STORAGE_KEY = 'guide_sxdp_data'
const sxdpColumns = ['帽子', '衣服', '护手', '裤子', '鞋子', '武器'] as const
const SXDP_OPTIONS = ['青龙', '朱雀', '白虎', '玄武'] as const
type SxdpRow = Record<string, string>
const defaultSxdpData: SxdpRow[] = [
  { 帽子: '青龙', 衣服: '朱雀', 护手: '白虎', 裤子: '玄武', 鞋子: '玄武', 武器: '白虎' },
  { 帽子: '青龙', 衣服: '朱雀', 护手: '白虎', 裤子: '玄武', 鞋子: '朱雀', 武器: '白虎' },
  { 帽子: '青龙', 衣服: '青龙', 护手: '朱雀', 裤子: '青龙', 鞋子: '朱雀', 武器: '玄武' },
  { 帽子: '白虎', 衣服: '玄武', 护手: '青龙', 裤子: '玄武', 鞋子: '朱雀', 武器: '青龙' },
  { 帽子: '白虎', 衣服: '玄武', 护手: '青龙', 裤子: '朱雀', 鞋子: '玄武', 武器: '青龙' },
  { 帽子: '白虎', 衣服: '玄武', 护手: '青龙', 裤子: '玄武', 鞋子: '玄武', 武器: '白虎' },
  { 帽子: '朱雀', 衣服: '白虎', 护手: '玄武', 裤子: '青龙', 鞋子: '青龙', 武器: '玄武' },
  { 帽子: '朱雀', 衣服: '白虎', 护手: '玄武', 裤子: '青龙', 鞋子: '白虎', 武器: '玄武' },
  { 帽子: '朱雀', 衣服: '白虎', 护手: '玄武', 裤子: '白虎', 鞋子: '白虎', 武器: '朱雀' },
  { 帽子: '玄武', 衣服: '青龙', 护手: '朱雀', 裤子: '白虎', 鞋子: '白虎', 武器: '朱雀' },
  { 帽子: '玄武', 衣服: '青龙', 护手: '朱雀', 裤子: '白虎', 鞋子: '青龙', 武器: '朱雀' },
  { 帽子: '玄武', 衣服: '玄武', 护手: '青龙', 裤子: '玄武', 鞋子: '青龙', 武器: '白虎' },
]

const sxdpData = ref<SxdpRow[]>(JSON.parse(JSON.stringify(defaultSxdpData)))

// 启动时从 settings 加载已保存数据（只读展示，无编辑能力）
async function loadSxdp() {
  try {
    const saved = await window.electronAPI.getSetting(SXDP_STORAGE_KEY)
    if (saved) {
      const data = JSON.parse(saved)
      if (Array.isArray(data)) sxdpData.value = data
    }
  } catch (_) { /* 使用默认值 */ }
}
loadSxdp()

const SXDP_COLORS: Record<string, string> = {
  '青龙': '#4CAF50',
  '朱雀': '#EF5350',
  '白虎': '#B0B0B0',
  '玄武': '#E8A030',
}

function sxdpColor(text: string): string {
  return SXDP_COLORS[text] || 'inherit'
}

// ── 表头筛选（各部位独立，空串 = 全部；仅视图状态，不持久化）──
const sxdpFilters = ref<Record<string, string>>({})

const sxdpFilterActive = computed(() => sxdpColumns.some(c => !!sxdpFilters.value[c]))

const sxdpVisibleRows = computed(() => {
  const cols = sxdpColumns.filter(c => !!sxdpFilters.value[c])
  return sxdpData.value.filter(row => cols.every(c => row[c] === sxdpFilters.value[c]))
})

function setSxdpFilter(col: string, value: string) {
  if (value) sxdpFilters.value[col] = value
  else delete sxdpFilters.value[col]
}

function clearSxdpFilters() {
  sxdpFilters.value = {}
}

const activeCatLabel = computed(() => {
  const c = categories.find(x => x.key === activeCat.value)
  return c ? `${c.icon} ${c.label}` : ''
})

// 详情页返回：默认回首页；从升级计算器跳入活跃计算器时，返回原处
const prevActiveCat = ref('')

function goBackFromDetail() {
  activeCat.value = prevActiveCat.value || ''
  prevActiveCat.value = ''
}

function openCat(cat: typeof categories[0]) {
  prevActiveCat.value = ''
  activeCat.value = cat.key
}

// ── 减伤标准表 ──

interface DrDiff { value: number | null; multiplier: number | null }
interface DrDungeon { name: string; normal: DrDiff; hero: DrDiff; warrior: DrDiff; saint: DrDiff }
interface DrWilderness { name: string; focusMultiplier: number | null; damageReduction: number | null }

const drDungeons = (drData as any).dungeons as DrDungeon[]
const drWilderness = (drData as any).wilderness as DrWilderness[]

// ── 韧性表 ──
interface ToughnessRow { level: number; constitution: number; armorIgnore: number; healthCap: number; monsterDR: number; essence: number; wuzhu: number; vitality: number }
const toughnessRows = (toughnessData as any).rows as ToughnessRow[]

// A→B 级区间计算：属性变化 + 加点消耗（消耗 = A+1..B 各级累计，即从 A 升到 B 所需总量）
const toughFrom = ref(1)
const toughTo = ref(50)

function clampToughLevel(n: number): number {
  if (!Number.isFinite(n)) return 1
  return Math.min(50, Math.max(1, Math.round(n)))
}

const toughCalc = computed(() => {
  const from = clampToughLevel(toughFrom.value)
  const to = clampToughLevel(toughTo.value)
  if (to <= from) return null
  const a = toughnessRows[from - 1]
  const b = toughnessRows[to - 1]
  const costs = toughnessRows.slice(from, to)
  return {
    from, to,
    constitution: b.constitution - a.constitution,
    armorIgnore: b.armorIgnore - a.armorIgnore,
    healthCap: b.healthCap - a.healthCap,
    monsterDR: b.monsterDR - a.monsterDR,
    essence: costs.reduce((s, r) => s + r.essence, 0),
    wuzhu: costs.reduce((s, r) => s + r.wuzhu, 0),
    vitality: costs.reduce((s, r) => s + r.vitality, 0),
  }
})

// 精华市场成本：单价（物价图鉴 price_params，单位万）× 区间精华数；未录入时在本表补录并同步回图鉴
const appStore = useAppStore()

interface EssencePriceRec { id: number | null; serverId: number; price: number }
const renEssence = ref<EssencePriceRec | null>(null) // 韧性之精华
const renPriceInput = ref('')
const ESSENCE_NAME = '韧性之精华'

async function loadEssencePrices() {
  const sid = appStore.currentServerId ?? 0
  try {
    // 当前大区优先；未选大区时取第一条
    const rows = await window.electronAPI.dbQuery(
      'SELECT id, server_id, market_price FROM price_params WHERE item_name=? AND (?=0 OR server_id=?) ORDER BY server_id LIMIT 1',
      [ESSENCE_NAME, sid, sid]
    ) as Array<{ id: number; server_id: number; market_price: number }>
    renEssence.value = rows && rows.length > 0
      ? { id: rows[0].id, serverId: rows[0].server_id, price: rows[0].market_price || 0 }
      : null
  } catch {
    renEssence.value = null
  }
  // 单价输入框显示当前价格（亿 → 万三国币，与图鉴录入单位一致）；未录入留空
  renPriceInput.value = renEssence.value && renEssence.value.price > 0 ? String(renEssence.value.price * 10000) : ''
}

// 补录单价（万三国币，与图鉴录入口径一致）：已有记录则更新，否则插入到当前大区（未选大区用 1）
async function saveEssencePrice() {
  const priceWan = parseFloat(renPriceInput.value)
  if (!Number.isFinite(priceWan) || priceWan < 0) return
  // 万 → 亿（price_params 存储单位为亿，与图鉴 fromWan 一致）
  const priceYi = Math.round(priceWan / 10000 * 1e7) / 1e7
  const rec = renEssence.value
  const sid = appStore.currentServerId ?? 0
  try {
    if (rec && rec.id != null) {
      // 与图鉴行内编辑一致：改价前把当前价格记入 price_history（0 价不记）
      const cur = await window.electronAPI.dbQuery(
        'SELECT benchmark_price, market_price FROM price_params WHERE id=?',
        [rec.id]
      ) as Array<{ benchmark_price: number; market_price: number }>
      if (cur && cur.length > 0 && (cur[0].benchmark_price > 0 || cur[0].market_price > 0)) {
        await window.electronAPI.dbQuery(
          'INSERT INTO price_history (price_param_id, benchmark_price, market_price) VALUES (?,?,?)',
          [rec.id, cur[0].benchmark_price, cur[0].market_price]
        )
      }
      await window.electronAPI.dbQuery(
        "UPDATE price_params SET market_price=?, updated_at=datetime('now','localtime') WHERE id=?",
        [priceYi, rec.id]
      )
    } else {
      await window.electronAPI.dbQuery(
        "INSERT INTO price_params (item_name,category,server_id,quality,craft_level,attr_notes,benchmark_price,market_price,slot,equip_level,equip_job,spirit_position,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now','localtime'))",
        [ESSENCE_NAME, '其他', sid > 0 ? sid : 1, '', '', '', 0, priceYi, '', 0, '', '']
      )
    }
  } catch { /* ignore */ }
}

// 成本金额精确显示：亿保留 4 位小数（如 14.5365亿），万 2 位，与图鉴单价核对时不留疑点

// 区间精华总成本（三国币）：单价(亿三国币，price_params 存储单位) × 1e8 × 数量。
// 输入框有值时优先用输入值（万→亿，实时预览），否则退回库中单价
const toughEssenceCosts = computed(() => {
  const n = toughCalc.value?.essence ?? 0
  if (!toughCalc.value || !n) return null
  const renWan = parseFloat(renPriceInput.value)
  const renPrice = Number.isFinite(renWan) ? renWan / 10000 : (renEssence.value?.price ?? 0)
  return renPrice * 1e8 * n
})

// 成本显示条件：库中已录入或输入框正在录入（实时预览）
const renCostShown = computed(() => (renEssence.value != null && renEssence.value.price > 0) || renPriceInput.value.trim() !== '')

// 失焦即保存（与图鉴行内编辑一致）；清空或与库中一致时不写库
async function saveEssencePriceOnBlur() {
  if (renPriceInput.value.trim() === '') return
  const priceWan = parseFloat(renPriceInput.value)
  if (!Number.isFinite(priceWan) || priceWan < 0) return
  const newYi = Math.round(priceWan / 10000 * 1e7) / 1e7
  if (renEssence.value && Math.abs(newYi - (renEssence.value.price || 0)) < 1e-10) return
  await saveEssencePrice()
  await loadEssencePrices()
}

// 成本金额精确显示：亿保留 4 位小数（如 14.5365亿），万 2 位，与图鉴单价核对时不留疑点
function fmtEssenceCost(n: number): string {
  if (n >= 1e8) return (n / 1e8).toFixed(4).replace(/\.?0+$/, '') + '亿'
  if (n >= 1e4) return (n / 1e4).toFixed(2).replace(/\.?0+$/, '') + '万'
  return n.toLocaleString()
}

watch(() => appStore.currentServerId, () => { loadEssencePrices() })
loadEssencePrices()

function formatDungeonCell(entry: DrDiff): string {
  if (entry.value === null) return '—'
  if (entry.multiplier === null || entry.multiplier === 1) return String(entry.value)
  return `${entry.value} (×${entry.multiplier})`
}

function formatFocus(multiplier: number | null): string {
  if (multiplier === null) return '—'
  return `×${multiplier}`
}

function formatDR(value: number | null): string {
  if (value === null) return '—'
  return String(value)
}

// ── 链接分组 ──

const linkGroups = [
  {
    group: '官方入口',
    links: [
      { title: '官网首页', desc: '公告、活动、版本资讯一站直达', url: 'https://sg.qq.com/web201706/index.shtml' },
      { title: '游戏下载', desc: '完整客户端与历史补丁下载', url: 'https://sg.qq.com/web201706/download.shtml' },
      { title: '新闻公告', desc: '版本更新、维护停机通知', url: 'https://sg.qq.com/webplat/info/news_version3/159/24483/24484/24485/m17774/list_1.shtml' },
      { title: '最新活动', desc: '限时福利与运营活动汇总', url: 'https://sg.qq.com/webplat/info/news_version3/159/24483/24484/24486/m17774/list_1.shtml' },
      { title: '系统公告', desc: '官方处罚名单与规则公示', url: 'https://sg.qq.com/webplat/info/news_version3/159/24483/24484/24487/m17774/list_1.shtml' },
    ],
  },
  {
    group: '玩家工具',
    links: [
      { title: '资料站', desc: '装备、技能、副本、地图数据查询', url: 'https://sg.qq.com/cp/a20160415zlz/' },
      { title: '攻略站', desc: '官方攻略、进阶技巧整理', url: 'https://sg.qq.com/cp/a20230414sgssgw/' },
      { title: '新手引导', desc: '入门教程与核心系统介绍', url: 'https://sg.qq.com/cp/a20200601introduction/index.html' },
      { title: '职业介绍', desc: '六大职业定位与技能预览', url: 'https://sg.qq.com/cp/a20170606job/' },
    ],
  },
  {
    group: '社区服务',
    links: [
      { title: '官方论坛', desc: '玩家交流、BUG反馈、建议提交', url: 'https://sg.gamebbs.qq.com/forum.php' },
      { title: '腾讯客服', desc: '被盗找回、充值纠纷、账号问题', url: 'https://kf.qq.com/touch/kfgames/A1013/v2/PCweb/conf/index.html?scene_id=CSCE20231214100808gCnARbiI#/home' },
      { title: '游戏充值', desc: '三国点、VIP、礼包购买', url: 'https://sg.qq.com/comm-htdocs/pay/new_index.htm?t=sg' },
      { title: '兑换中心', desc: 'CDKey、积分、活动道具兑换', url: 'https://sg.qq.com/cp/a20260306sgdhzx/index.html' },
      { title: '每日签到', desc: '公众号签到领奖，每日福利必领', url: 'https://sg.qq.com/cp/a20240429gzhqd/' },
      { title: '新服预约', desc: '开服预约与预约礼包领取', url: 'https://sg.qq.com/cp/a20200412zxxt/index.html' },
      { title: '官方微博', desc: '@QQ三国官方微博 最新动态', url: 'https://weibo.com/u/6084387652' },
    ],
  },
  {
    group: '媒体资源',
    links: [
      { title: '视频站', desc: 'CG、版本宣传片、玩家投稿', url: 'https://sg.qq.com/cp/a20170105trzq/videolist.shtml' },
      { title: '壁纸下载', desc: '官方高清壁纸与同人画作', url: 'https://sg.qq.com/web201706/wallpapers.shtml' },
      { title: '游戏直播', desc: '官方直播与赛事回放', url: 'https://sg.qq.com/cp/a20161130live/' },
    ],
  },
  {
    group: '安全相关',
    links: [
      { title: '安全规则', desc: '游戏行为规范与处罚条例', url: 'https://sg.qq.com/service/rules.htm' },
      { title: '账号注销', desc: 'QQ账号注销申请入口', url: 'https://zc.qq.com/chs/index.html' },
    ],
  },
]

// ── 每日活动入口（数据库驱动）──

interface DailyLinkItem {
  id: number
  group_name: string
  icon: string
  name: string
  desc: string
  url: string
  sort_order: number
}

const dailyLinks = ref<DailyLinkItem[]>([])

const dailyActivityGroups = computed(() => {
  const map = new Map<string, DailyLinkItem[]>()
  for (const link of dailyLinks.value) {
    const arr = map.get(link.group_name)
    if (arr) {
      arr.push(link)
    } else {
      map.set(link.group_name, [link])
    }
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }))
})

async function loadDailyLinks() {
  try {
    dailyLinks.value = await window.electronAPI.listDailyLinks()
  } catch { /* empty */ }
}

// 添加表单
const showAddForm = ref(false)
const newLink = ref({ group_name: '每日 · 每天必点', icon: '🔗', name: '', desc: '', url: '' })
const adding = ref(false)

async function addLink() {
  const { group_name, icon, name, desc, url } = newLink.value
  if (!name.trim() || !url.trim()) return
  adding.value = true
  try {
    const result = await window.electronAPI.addDailyLink({ group_name, icon, name: name.trim(), desc: desc.trim(), url: url.trim() })
    if (result.ok) {
      dailyLinks.value.push({
        id: result.id,
        group_name,
        icon,
        name: name.trim(),
        desc: desc.trim(),
        url: url.trim(),
        sort_order: 999,
      })
      newLink.value = { group_name: '每日 · 每天必点', icon: '🔗', name: '', desc: '', url: '' }
      showAddForm.value = false
    }
  } catch { /* ignore */ }
  adding.value = false
}

async function deleteLink(id: number) {
  try {
    await window.electronAPI.deleteDailyLink(id)
    dailyLinks.value = dailyLinks.value.filter(l => l.id !== id)
  } catch { /* ignore */ }
}

// 加载自定义任务池
async function loadTaskPool() {
  try {
    const saved = await window.electronAPI.getSetting('activity_task_pool')
    if (saved) customTaskPool.value = JSON.parse(saved)
  } catch { /* use default */ }
}

// 初始化加载
loadDailyLinks()
loadCache()
loadTaskPool()
loadActivitySelectors()

// ── 攻略数据 ──

type GuideItem = { title: string; level: string; body: string; tags: string[] }

const guides: Record<string, GuideItem[]> = {
  // 灵宠八阵图
  beasts: [
    { title: '元神评价等级对照表', level: '核心', body: '平庸(0.00-1.49) → 尚可(1.50-1.99) → 良好(2.00-2.49) → 优秀(2.50-2.99) → 卓越(3.00-3.49) → 至尊(3.50-3.99) → 天人(4.00-4.49) → 无双(4.50-4.99) → 修罗(5.00)。成长丸上限5.00。', tags: ['评价', '等级'] },
    { title: '元神属性加点参考', level: '核心', body: '0点=10% | 100点≈17.4% | 200点≈25.4% | 300点≈33.2% | 500点≈47.7% | 800点≈66.9% | 1039点≈80.1% | 1451点≈99.6%。攻击配合=点数/800，上限800点。', tags: ['加点', '属性'] },
    { title: '物理系元神推荐', level: '参考', body: '五虎元神(关羽/张飞/赵云/马超/黄忠)为首选，真·关羽成长最高。次选夏侯惇（吸血）、陆逊（高攻）。平民可选波才过渡。', tags: ['物理', '推荐'] },
    { title: '法术系元神推荐', level: '参考', body: '真·大乔（法系T0）、洛神·甄宓（群体加成）。次选诸葛果、小乔。法术元神优先堆魔攻和暴击。', tags: ['法术', '推荐'] },
    { title: '灵兽出战推荐', level: '核心', body: '物理系：天狼(天品,核心)、霸王龙(爆发)、朱厌(PK)。法术系：凤凰(天品,核心)、九尾狐(控制)、白泽(辅助)。灵兽优先天品，技能书打满再出战。', tags: ['灵兽', '出战'] },
    { title: '八阵图速查', level: '核心', body: '36攻四满(入门)→54攻五满(进阶)→72攻六满(高配)→八满(毕业)。每提升一档约增伤6-8%。购买看攻击数值，满值才叫"满"。价格视区服而定。', tags: ['八阵图', '攻击'] },
  ],
  // 子女
  children: [
    { title: '子女类型与职业匹配', level: '入门', body: '剑侍/豪杰/游侠选对应物系子女，阴阳士/仙术士/唤灵选法系子女。子女职业与主号一致时协同效果最佳。', tags: ['职业', '选择'] },
    { title: '子女主动技能推荐', level: '核心', body: '副本必备：无限盾（持续减伤）、回春（群体回血）。输出向：寒冰裂（法系AOE）、破甲击（物理破防）。PK向：沉默、眩晕控制技能优先。', tags: ['技能', '副本'] },
    { title: '子女培养成本估算', level: '参考', body: '基础培养至100级约500-800万。解锁4格主动技能槽约1000-1500万。打满6本技能书视品质2000万-1亿不等。', tags: ['成本', '预算'] },
    { title: '子女亲密度与装备', level: '技巧', body: '亲密度≥90%时属性加成最大(+20%)，每日互动提升，离线7天下降。子女可穿戴专属装备，符咒选对应等级优先HP和防御。', tags: ['亲密度', '装备'] },
  ],
  // 符咒&天书
  talisman2: [
    { title: '符咒1-6级速查', level: '核心', body: '1级坠星(HP+200)|2级千叶(HP+300)|3级凌雪(HP+500)|4级飞羽(HP+1000)|5级星芒(HP+2000,兑换30碎片+1950万)|6级徊翔(HP+3000,45碎片+5660万,概率抗青龙/雪恨)。回血0.5%-1.88%/次递增。', tags: ['符咒', '等级'] },
    { title: '符咒碎片获取', level: '参考', body: '七旗副本（主要）、北邙山活动、商城购买、比武擂台赛、国令任务。每日副本必刷，活动期间碎片加倍。注灵可重置随机属性，推荐先出核心属性再锁定。', tags: ['碎片', '获取'] },
    { title: '天书三大妙法', level: '核心', body: '乾坤护体：抵抗破甲+受伤超25%后续减伤。万灵皆庇：对怪伤害提升+降低怪物伤害(刷本核心)。虚明洞彻：降低子女受伤+子女攻击概率附加最大生命值伤害。', tags: ['天书', '妙法'] },
    { title: '天书修行策略', level: '参考', body: '完成飞升后开启。每条1-150级，每10级获1次潜心苦修(上限15次)。优先拉满万灵皆庇→乾坤护体→虚明洞彻。阶段目标每条50级。', tags: ['策略', '优先级'] },
  ],
  // 灵魄
  spirits: [
    { title: '灵魄槽位对应表', level: '核心', body: '武器/护手/面具/项链/戒指→攻击灵魄。头盔/上装/下装/鞋子/翅膀/符咒→防御灵魄。攻位放输出，防位放生存。', tags: ['槽位', '搭配'] },
    { title: '攻击灵魄推荐（PVE）', level: '核心', body: '破风之灵(普攻增伤15%,通用首选)>破空之灵(技能增伤)>奋迅之灵(物攻+10%+抗性)>野兽之灵(对怪增伤)。PVE优先破风+野兽组合。', tags: ['攻击', 'PVE'] },
    { title: '防御灵魄推荐', level: '核心', body: '禁卫之灵(物防+血量,物理系)>守护之灵(全减伤5%,通用)>不动之灵(暴击抵抗)>仙法之灵(魔防,针对法系)。坦优先禁卫+不动，脆皮优先守护+仙法。', tags: ['防御', '推荐'] },
    { title: '灵魄合成与省钱', level: '技巧', body: '3白→1绿、3绿→1蓝、3蓝→1紫。紫灵魄属性约白2倍。攻击位优先紫(输出提升明显)，防御位蓝够用。合成失败不吞材料。', tags: ['合成', '省钱'] },
  ],
  // 奥义
  aoyi: [
    { title: '奥义档次速查', level: '核心', body: '单满三板斧(20级/10天赋)→门槛。双满(30级/20天赋)→性价比之选。三四五满(40级/30-50天赋)→稳步提升。小完美→缺部分增伤。大完美(50级/60+天赋)→毕业，技能组合2+6+1+1。', tags: ['档次', '速查'] },
    { title: '核心技能详解', level: '核心', body: '三板斧(剑侍T0,真实伤害+吸血)。灭意凌云(增加物攻)。痛击(百分比增伤)。灭器(对怪增伤~12%)。灼伤(易伤~8%,团队受益)。震慑夺魂(PK击晕)。资质满10.00提供约39.39%增伤/减伤。', tags: ['技能', '效果'] },
    { title: '各职业奥义选择', level: '参考', body: '剑侍→统御(三板斧必选)|豪杰→霸道(增伤减伤均衡)|阴阳士→毁灭(法系AOE)|仙术士→仁心(治疗辅助)|游侠→神射手(远程爆发)|唤灵→通灵(召唤控制)。', tags: ['职业', '选择'] },
    { title: '购买避坑', level: '技巧', body: '1.确认领悟等级足够解锁+天赋点够点满。2.同叫"单满"价差可能因附带有用技能或高资质。3.书名(孙子/孙膑兵法)无属性区别,只看内在技能。', tags: ['购买', '避坑'] },
  ],
  // 经络
  meridian: [
    { title: '经络系统入门', level: '入门', body: '59级开启(Y键)，18处经络，每处2选1，最高5层。消耗经验+三国币+帝休木。每周4次修习(满级8次)，点错可遗忘。100级三层约1400亿经验+8800万+882帝休木。', tags: ['入门', '机制'] },
    { title: '100级物理系图谱', level: '核心', body: '虎虎生威+黑熊：武力2/奋迅3/仙法1/生命2。巨熊震吼+虎扑：24物攻+2%吸血+25%二次攻击。优先选奋迅和武力方向。', tags: ['100级', '物理'] },
    { title: '100级法术系图谱', level: '核心', body: 'YY：鸟飞+猿提(生命3/仙法1/禁卫1/智力1/妖法1)。XS①：鹿奔+金猿(教化3/仙法1/生命3/禁卫1)。XS②：鹿奔+平沙(教化2/生命3/禁卫2)。', tags: ['100级', '法术'] },
    { title: '各等级进度', level: '参考', body: '59级→6经络/1层/1图谱|79级→9经络/2层/2图谱|100级→12经络/3层/2图谱|120级→15经络/4层/3图谱|130级→18经络/5层/3图谱(如虎虎+虎扑+巨熊)。', tags: ['等级', '进度'] },
  ],
  // 灵珠
  lingzhu: [
    { title: '灵珠系统入门', level: '入门', body: '灵珠是镶嵌在装备上的高级强化道具，类似灵魄但提供不同属性维度。共8种灵珠：破风、天罡、地煞、长生、不灭、归元、玄黄、混元。每种灵珠有白绿蓝紫四档品质。', tags: ['系统', '入门'] },
    { title: '灵珠类型与效果', level: '核心', body: '破风·灵珠：物攻+暴击(物理系核心)。天罡·灵珠：物防+血量(坦克首选)。地煞·灵珠：魔防+抗性(针对法系)。长生·灵珠：血量+回血(通用生存)。不灭·灵珠：减伤+韧性(高难副本)。归元·灵珠：全属性+经验加成(万金油)。玄黄·灵珠：攻击+穿透(PVP)。混元·灵珠：全属性综合(顶级灵珠)。', tags: ['类型', '效果'] },
    { title: '灵珠合成与升级', level: '参考', body: '3同品质灵珠→1高品(3白→1绿→1蓝→1紫)。合成消耗三国币+灵珠碎片(副本/活动产出)。紫色灵珠属性约为白色2.5倍。优先升级攻击位灵珠。', tags: ['合成', '升级'] },
    { title: '灵珠获取途径', level: '参考', body: '军团副本(周常)、北邙山活动、商城限购、比武擂台、节日活动兑换。灵珠碎片可在军团商店用点券兑换。建议优先军团副本稳定获取。', tags: ['获取', '途径'] },
  ],
  // 家园
  home: [
    { title: '家园系统总览', level: '入门', body: '庭院种植→收获经验/奥义经验/子女经验/亲密度道具。室内家具→每周经验/活力/修复耐久/临时武智/炫装存储。广场舞→经验+10活跃。物业礼包→每月1-5号按繁荣度发放。', tags: ['系统', '总览'] },
    { title: '庭院种植速查', level: '核心', body: '周期：今晚种→明晚施肥→后天收。作物：材料(三叶草/柳木)、亲密度(雏菊/薰衣草/百合)、经验(小麦/土豆)、灵蕴果(低/中/高)、子女糖果(彩虹糖/棉花糖/波板糖)、高级(太极草/珍珠蚌)。种子：工资/军团/商城。', tags: ['种植', '作物'] },
    { title: '家具与风水', level: '核心', body: '庭院属性(华丽⇄简约/精致⇄粗犷/人气⇄禅意)决定可种作物。总翻倍率=基础(设计图)+家具(总风水÷20)，上限85%。天人合一(基础1000=50%)+家具700=85%满翻倍。', tags: ['家具', '风水'] },
    { title: '投入预算参考', level: '参考', body: '入门500万(5-15%翻倍)|性价比1.5亿(70%翻倍,天人图+2级家具+5神木面包树套)|进阶2亿(77%)|壕配3-4亿(85%满翻)。不玩可出售回收约90%成本。', tags: ['预算', '性价比'] },
    { title: '热门搭配方案', level: '技巧', body: '面包树套(5神木,~1500-2000万)：覆盖糖果+家具材料+经验+灵蕴果，最泛用。明珠红豆套：全亲密度作物+中果。中果+面包树套：14种作物。', tags: ['搭配', '方案'] },
  ],
  // 副本
  dungeon: [
    { title: '孟获洞（60级）', level: '入门', body: '普通难度适合转职任务，英雄以上才出技能书。组队建议1仙术+4输出。', tags: ['60级', '技能书'] },
    { title: '过关斩将（90级）', level: '核心', body: '减伤门槛约170，90级以上主力副本。BOSS破防后输出翻倍，务必带奋破元神。物理系帽子强化20以上优先堆抗眩晕。', tags: ['90级', '减伤'] },
    { title: '单骑救主（100级）', level: '核心', body: '减伤170+，输出达标才能过。灵魄优先选破空，对群怪伤害提升稳定。组队1仙术+3输出+1坦克。', tags: ['100级', '灵魄'] },
    { title: '岐山（110级）', level: '高阶', body: '减伤门槛180以上，对物攻和抗性要求进一步提高。BOSS机制复杂，建议看视频攻略熟悉技能轴。', tags: ['110级', '抗性'] },
  ],
  // 升级攻略（表格数据）
  leveling: [] as GuideItem[], // 占位，实际数据用 levelingStages
  // 军团
  legion: [
    { title: '军团等级与规模', level: '入门', body: '1级(20人)→2级(25人)→3级(30人)→4级(40人)→5级(50人)→...→10级。升级需发展度+资材，资材不足1000会降级甚至解散。', tags: ['等级', '规模'] },
    { title: '军团任务与收益', level: '核心', body: '每日10次军团任务→点券+声望+资材/发展度。70级军团运送→宝包(经验丸/抗性丸/活力丸)，终极礼包几率出高级材料和极品碎片。军团副本每周五开启→丰厚奖励。', tags: ['任务', '收益'] },
    { title: '军团加成与商店', level: '核心', body: '同军团组队人数越多经验加成越高。军团商店可购买副职材料、技能书(需点券+官爵)。月度贡献第一→军团勋章/齐心协力丸/SVIP张飞大补丸。', tags: ['加成', '商店'] },
    { title: '日常节奏', level: '参考', body: '1.上线先军团任务→稳定点券。2.组队尽量同军团→经验最大化。3.关注副本开启→提前准备战车药品。4.每月高活跃→争取贡献排名。5.资材紧张时主动捐献→防降级。', tags: ['日常', '节奏'] },
  ],
  // 副职
  subjob: [
    { title: '五大副职速览', level: '入门', body: '初阶3选1：工匠(强化灵宝/修复石)、镶工(宝石/改造石)、庖丁(料理/肥料)。高阶(10级转)：玉石匠(技能石/打孔石,最强后期)、制符师(传送符/秘籍,细水长流)。', tags: ['职业', '速览'] },
    { title: '工匠 & 镶工', level: '参考', body: '工匠：活力转化效率高(500活力≈5W)，产品稳销，适合新手/小号挂机。镶工：最赚钱初阶(黑曜石→中改,1.5W活力净赚~150W)，启动资金~200W，需军团高级合成书。', tags: ['工匠', '镶工'] },
    { title: '庖丁 & 高阶副职', level: '参考', body: '庖丁：升级最快，国令刚需(红红肉/三锅头)+家园肥料5种，推荐人手1个庖丁小号。玉石匠：后期最强，技能石+高级打孔石保值。制符师：独家传送符+秘籍，不可替代。', tags: ['庖丁', '高阶'] },
    { title: '最优路线推荐', level: '核心', body: '单号：初阶镶工→高阶玉石匠(中期收益+后期潜力)。多号流(5号)：主号庖丁+玉石匠/仙术士庖丁/小号①制符师/小号②镶工/小号③工匠→全产业链覆盖。', tags: ['路线', '推荐'] },
  ],
  // 亲密度
  intimacy: [
    { title: '夫妻系统', level: '核心', body: '结婚后双方组队可获得攻击+防御+血量加成。亲密度等级1-20级，每级提升加成比例。亲密度通过组队打怪、赠送鲜花/礼物提升。高等级夫妻可获得专属称号和技能(如夫妻传送)。', tags: ['夫妻', '加成'] },
    { title: '结拜系统', level: '核心', body: '3-6人结拜，组队获得攻击/防御/血量加成。结拜等级1-10级，加成逐级递增。结拜任务(每日/每周)提升亲密度。高等级结拜可获得专属状态和称号。', tags: ['结拜', '加成'] },
    { title: '师徒系统', level: '参考', body: '师父收徒后，徒弟升级双方获得师徒值+经验奖励。师徒组队经验加成+10-30%。出师时根据师徒值获得丰厚奖励(经验丸/强化材料)。师父每月可收3名徒弟。', tags: ['师徒', '经验'] },
    { title: '亲密度提升攻略', level: '技巧', body: '夫妻/结拜：每日组队副本+互赠鲜花(商行购买或家园种植)。每月情人节活动期间亲密度获取加倍。师徒：督促徒弟做日常任务+副本，师徒任务必做满。', tags: ['提升', '攻略'] },
  ],
  // 攻略&指南
  playbook: [
    { title: '1-70级快速冲级', level: '入门', body: '主线做到30级→吃新手礼包蟠桃。国令任务+华容道副本双管齐下。用招贤令连做三次国令经验最大化。争取当天升到70级。', tags: ['升级', '新手'] },
    { title: '70-100级稳步提升', level: '核心', body: '武圣/过关副本是主力经验来源。合理分配疲劳值，挂机选桃花渡口或蜗牛山。卡100级攒够了装备和资源再突破。', tags: ['升级', '100级'] },
    { title: '100级+ 日常规划', level: '高阶', body: '每日定军山、运物资、答题、收集任务必做。单个活跃号日收益1.6-2.1元，配合副本可达2.8-5.5元/号。', tags: ['日常', '搬砖'] },
    { title: '新手装备优先级', level: '入门', body: '武器满强化→二级翅膀→符鬼注灵(4符1)→橙色首饰面具→元神(预算10%)→奥义+八阵图→灵兽(最后补)。50级前系统送啥穿啥，别浪费钱打孔。', tags: ['装备', '优先级'] },
    { title: '100级配号方案', level: '核心', body: '装备>八阵图>奥义>灵魄>子女>技能元神>攻击灵兽>护甲灵兽>元神。武器满强化+20，面具选橙色(与红色物攻相同更划算)。', tags: ['配号', '100级'] },
    { title: '国家差价套利', level: '技巧', body: '吴魏蜀三国市场不通，低价区买入到高价区卖出。每天逛襄阳、江陵主城摊位和商行掌握实时价格。', tags: ['套利', '三国'] },
    { title: '囤货技巧', level: '技巧', body: '强化灵宝、打孔防爆石版本更新时暴涨。材料(经验丸/帝休木/香墨)选不易贬值的逢低买入。三国点每天浮动，低买高卖。', tags: ['囤货', '材料'] },
    { title: '倒卖捡漏', level: '核心', body: '盯紧国家频道弃坑甩卖。新区红利：1月1日和7月1日开新区，前两个月比例高(700-900元/亿)快进快出。', tags: ['倒卖', '新区'] },
    { title: '答题题库速查', level: '参考', body: '推举孝廉常考：千里走单骑→关羽 / 七步成诗→曹植 / 官渡之战→曹操胜袁绍 / 诸葛亮病死→五丈原 / 三国真将军→赵云。谋士大赛常考：八仙→铁拐李 / 人工降雨→干冰 / 五大部门→农业 / 焚风→阿尔卑斯山。', tags: ['答题', '题库'] },
    { title: '国令工资速查表', level: '参考', body: '50级≈5万|60级≈12万|70级≈23万|80级≈27万|90-100级≈35万|101-109级≈36万|110+≈40万。≥30级在宫廷传令官接取，每天10环。副职业自产修复宝石降成本。', tags: ['国令', '工资'] },
    { title: '资源分布速查', level: '参考', body: '灰炭石/凡晶石：新手村。黑岩石/铁原石：江陵东郊、襄阳南郊。石英石：临江、江夏。矿点15分钟刷新。矿工配合工匠自产强化灵宝/修复宝石最省钱。', tags: ['资源', '地图'] },
    { title: '5000元以下100级搬砖经验', level: '收藏', body: '贴吧精华帖：5000元预算内100级搬砖配装全流程，含每日副本/活动优先级、装备采购顺序、三国点套利技巧。<br><a href="https://tieba.baidu.com/p/7509570031" target="_blank">查看原文 →</a>', tags: ['搬砖', '100级', '精华帖'] },
  ],
  // 其他
  misc: [
    { title: '强化等级与成本', level: '核心', body: '0→1:1颗|1→5:每级2颗|6→8:每级4颗|9→12:需天阶灵宝。整件0→20正常运气5000-8000万，脸黑可达1.5亿。转移符可转移强化等级，成本约为重强化的15-20%。', tags: ['强化', '成本'] },
    { title: '强化灵宝对照', level: '参考', body: '人阶(日常强化消耗) → 地阶(中阶强化核心) → 天阶(高阶强化硬通货，稀缺保值)。+10以上建议防爆石，玄铁可保护不掉级。', tags: ['灵宝', '等级'] },
    { title: '四项抗性修炼', level: '入门', body: '奋迅(物攻+1%/级)、妖法(魔攻+1%/级)、禁卫(物防+1%/级)、仙法(魔防+1%/级)。每级消耗2000金钱+100活力，最高40级。物理优先奋迅+禁卫，法术优先妖法+仙法。', tags: ['抗性', '修炼'] },
    { title: '武力/智力/韧性', level: '核心', body: '每1点武力/智力=对应攻击+3+伤害+1.5%。在江陵太上老君处修炼，消耗活力+精华。韧性满级：体质+10/破甲抵抗/生命上限+50%/怪物减伤19.5%。', tags: ['武智', '韧性'] },
    { title: '六职业心法速查', level: '入门', body: 'JS:轻灵术(灵活)/激将计(拉仇恨)/玉石俱焚(反击)。HJ:不灭金身(减伤)/挑衅四方(群嘲)。YY:真气护体(体质)/火凤附体(增伤)。XS:智谋术(智力)/宁静致远(减蓄气)。游侠:佑弦一意(增伤)/迅捷如风(提速)。唤灵:流铃万激(充能)/千符神御(伤害转回血)。', tags: ['心法', '速查'] },
  ],
  // 羽灵
  wings: [
    { title: '翅膀1-5阶速查', level: '入门', body: '1阶：15根1级羽毛→速+10/跳+10/HP+300。2阶：1阶翅+15根2级羽→速+20/攻+18/HP+500。3阶：2阶+40根3级羽→攻+24/防+12/HP+1000。4阶：3阶+75根4级羽→攻+36/防+18/HP+1500。5阶：4阶+100根5级羽→攻+60/防+30/HP+2000+异常免疫25%。', tags: ['翅膀', '等阶'] },
    { title: '羽毛鉴定与获取', level: '参考', body: '未鉴定羽毛用灵鉴之玉鉴定→随机获得1-5级羽毛。灵鉴之玉：击杀通鉴之灵/皇宫秘宝任务/50未鉴定兑换/商城。羽毛可交易，低买高卖有套利空间。', tags: ['羽毛', '鉴定'] },
    { title: '羽灵系统（新版本）', level: '核心', body: '翅膀满5阶后开启羽灵培养。升级五毛得七彩鸾羽兑换。羽灵可镶嵌在翅膀中，改变外观+提升面板数值。包含技能特效(自在飞花/星河迎光等)伤害/控制/治疗/属性增益。全新配饰【青鸾·羽灵】可佩带至3阶+翅膀。', tags: ['羽灵', '新系统'] },
    { title: '翅膀投入策略', level: '技巧', body: '新手先做2阶(成本低/属性够用)→100级后升4阶(攻防质变)→满级冲5阶(异常免疫)。羽毛活动期间大量产出时低价囤货。女性角色蝶之羽/炽天使之翼可优先做。', tags: ['策略', '投入'] },
  ],
}

const currentGuides = computed(() => guides[activeCat.value] || [])

// ── 升级攻略（多Sheet + 可编辑 + 持久化）──

const STORAGE_KEY = 'leveling_guide_v2'

type Stage = { level: string; core: string; todo: string; prepare: string; tip: string }
type Sheet = { name: string; stages: Stage[] }

const editingCell = ref<{ row: number; field: string } | null>(null)
const editingBackup = ref('')
const activeSheetIndex = ref(0)
const renamingSheetIdx = ref(-1)

// 用 JSON 导入作为默认值，运行时从 settings 加载覆盖
const defaultSheets: Sheet[] = JSON.parse(JSON.stringify((levelingData as any).sheets || [{ name: '默认', stages: (levelingData as any).stages || [] }]))

const levelingSheets = ref<Sheet[]>(JSON.parse(JSON.stringify(defaultSheets)))

// 当前激活的 sheet
const activeSheet = computed(() => levelingSheets.value[activeSheetIndex.value] || levelingSheets.value[0])
const activeStages = computed({
  get: () => activeSheet.value?.stages || [],
  set: (v) => { if (activeSheet.value) activeSheet.value.stages = v },
})

// 启动时从 settings 加载已保存数据
async function loadLeveling() {
  try {
    const saved = await window.electronAPI.getSetting(STORAGE_KEY)
    if (saved) {
      const data = JSON.parse(saved)
      if (data.sheets?.length) {
        levelingSheets.value = data.sheets
      } else if (data.stages?.length) {
        // 兼容旧格式：单 sheet 迁移
        levelingSheets.value = [{ name: '升级攻略', stages: data.stages }]
      }
    }
  } catch (_) { /* 使用默认值 */ }
}
loadLeveling()

function isEditingCell(row: number, field: string): boolean {
  const c = editingCell.value
  return c !== null && c.row === row && c.field === field
}

async function startEdit(row: number, field: string) {
  const stage = activeStages.value[row]
  if (!stage) return
  editingBackup.value = (stage as any)[field] || ''
  editingCell.value = { row, field }
  await nextTick()
  const el = document.querySelector('[data-editing]') as HTMLInputElement | HTMLTextAreaElement | null
  if (!el) return
  if (el instanceof HTMLTextAreaElement) {
    el.style.height = '0'
    el.style.height = el.scrollHeight + 'px'
  }
  el.focus()
  el.select()
}

function finishEdit() {
  if (editingCell.value) {
    editingCell.value = null
    saveLeveling()
  }
}

function cancelEdit() {
  if (!editingCell.value) return
  const stage = activeStages.value[editingCell.value.row]
  if (stage) {
    ;(stage as any)[editingCell.value.field] = editingBackup.value
  }
  editingCell.value = null
}

function autoResize(e: Event) {
  const el = e.target as HTMLTextAreaElement
  el.style.height = '0'
  el.style.height = el.scrollHeight + 'px'
}

async function saveLeveling() {
  editingCell.value = null
  try {
    const data = { sheets: levelingSheets.value }
    await window.electronAPI.setSetting(STORAGE_KEY, JSON.stringify(data))
  } catch (_) { /* ignore */ }
}

function resetLeveling() {
  editingCell.value = null
  levelingSheets.value = JSON.parse(JSON.stringify(defaultSheets))
  activeSheetIndex.value = 0
  saveLeveling()
}

// ── Sheet 操作 ──

function switchSheet(idx: number) {
  editingCell.value = null
  activeSheetIndex.value = idx
  renamingSheetIdx.value = -1
}

function addSheet() {
  levelingSheets.value.push({ name: '新建攻略', stages: [] })
  activeSheetIndex.value = levelingSheets.value.length - 1
  saveLeveling()
}

function deleteSheet(idx: number) {
  if (levelingSheets.value.length <= 1) return
  levelingSheets.value.splice(idx, 1)
  if (activeSheetIndex.value >= levelingSheets.value.length) {
    activeSheetIndex.value = levelingSheets.value.length - 1
  }
  renamingSheetIdx.value = -1
  saveLeveling()
}

function startRename(idx: number) {
  renamingSheetIdx.value = idx
}

function finishRename(idx: number, el: HTMLInputElement | null) {
  const name = (el?.value || '').trim()
  if (name && levelingSheets.value[idx]) {
    levelingSheets.value[idx].name = name
    saveLeveling()
  }
  renamingSheetIdx.value = -1
}

// ── 行操作（操作当前 sheet）──

function addLevelingRow() {
  editingCell.value = null
  activeStages.value.push({ level: '新等级', core: '', todo: '', prepare: '', tip: '' })
  saveLeveling()
}

function deleteLevelingRow(idx: number) {
  activeStages.value.splice(idx, 1)
  saveLeveling()
}

// ── 等级经验表 ──

interface ExpRow {
  level: number
  exp: number
  standard_unit_exp: number
}

const expData = ref<ExpRow[]>([])
const expEditCell = ref<{ row: number; field: string } | null>(null)
const expEditValue = ref<string | number>('')
const expEditBackup = ref<string | number>('')

// ── 怪物基础经验表 ──

interface MonsterExpRow {
  id: number
  name: string
  area: string
  level: number
  base_exp: number
  fatigue: number
  quantity: number
  respawn_time: number
  kill_time: number
  multiplier: number
  sort_order: number
  updated_at?: string
}

const monsterExpData = ref<MonsterExpRow[]>([])
const monsterExpAreaFilter = ref<string | null>(null) // 表头"地区"筛选：null = 全部
const meAreaFilterOpen = ref(false)
const monsterExpSortDir = ref<'asc' | 'desc'>('asc')
const meEditCell = ref<{ row: number; field: string } | null>(null)
const meEditValue = ref<string | number>('')
const meEditBackup = ref<string | number>('')
// 怪物经验视图：A = 怪物经验表（可编辑，数据源）；B = 每级最优打怪组合（只读，由 A 表自动计算）
const monsterExpView = ref<'a' | 'b' | 'c'>('a')

const filteredMonsterExp = computed(() => {
  let list = [...monsterExpData.value]
  // 地区筛选（表头"地区"菜单）
  if (monsterExpAreaFilter.value) {
    list = list.filter(r => r.area === monsterExpAreaFilter.value)
  }
  // Sort by level
  list.sort((a, b) => {
    return monsterExpSortDir.value === 'asc' ? a.level - b.level : b.level - a.level
  })
  return list
})

// ── B 表：84~155 每个角色等级"最优地区 + 打怪群组合"（2026-08-23）──
// 指标（用户 2026-08-23 口径）：每周可获得经验 = min(周刷怪 580 分钟, 周疲劳容量可烧分钟) ×
// 每小时经验 ÷ 60；周疲劳容量 = 系统疲劳 380×7 + 大疲劳 2520 = 5180（默认值）。
// 时间瓶颈（烧速 ≤ 535.9/时）：580 分钟打满、疲劳烧不完 → 每周经验 ∝ 每小时经验总和 Σ(q×效率)，
// 多群/高刷新群有优势；疲劳瓶颈（烧速 > 535.9/时）：先烧完 5180 疲劳 → 每周经验 = 5180 ×
// 每疲劳经验（q 加权平均）。双倍/齐心为乘性常数不改变组合间排序。候选 = 衰减窗口 [L−7, L+8]
// 内合格群（衰减 > 0 且 效率 > 0）。全局因子（2026-08-27 起）：衰减率跟随全局自定义 ecDecayRates
// （影响合格群/每小时经验/最优组合），总倍率 = 封印加速 + 王城加成（getTotalBonusRate 按行等级查段，
// 乘进 q/每小时经验/每周经验，不改变组合间排序）。A 表增删改或全局经验设定修改后自动刷新。
// 默认组合口径 = **每周可获得经验最高**（2026-08-27 起；2026-08-23 确认为"效率最高"，
// 时间瓶颈下每周经验 ∝ 每小时经验故同序）：地区内全部合格群（勾选即打），
// 地区间取每周经验 weeklyExp 最高——疲劳瓶颈下 hourly 高 ≠ 每周经验高（例：96 级东岭关
// 每周 36.6 亿 > 塔郎甸 18.6 亿，但塔郎甸每小时 4.53 亿 > 东岭关 4.44 亿，旧口径会选错）。
// **每级一行**（2026-08-23 晚，不合并等级段）。
// 支持编辑单级组合（勾选窗口内群怪所在地图的全部怪群、可跨地区，窗口外灰显可提前勾选），
// 持久化 localStorage（sgbuddy-grind-combos），每级可恢复默认。
// 编辑后的组合按 computeGrindComboStats 重算指标（失效/窗口外 id 不参与统计）。
const BEST_GRIND_LEVEL_FROM = 84
const BEST_GRIND_LEVEL_TO = 155
const GRIND_COMBOS_KEY = 'sgbuddy-grind-combos'

function loadGrindCombos(): Record<string, number[]> {
  try {
    const raw = localStorage.getItem(GRIND_COMBOS_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      if (p && typeof p === 'object') return p as Record<string, number[]>
    }
  } catch { /* ignore */ }
  return {}
}

const grindComboOverrides = reactive<Record<string, number[]>>(loadGrindCombos())

function saveGrindCombos() {
  localStorage.setItem(GRIND_COMBOS_KEY, JSON.stringify(grindComboOverrides))
}

// 编辑弹层：等级 + 勾选的群 id 集合；保存/恢复默认作用于该级
const grindEditLevel = ref<number | null>(null)
const grindEditChecked = ref<Set<number>>(new Set())

// 弹层标题：单级 "84 级"
const grindEditTitle = computed(() => {
  if (grindEditLevel.value === null) return ''
  return `${grindEditLevel.value} 级`
})

// 弹层候选：窗口内群怪所在地图的**全部**合格群（窗口外灰显 inWindow=false），按地区分组；
// 衰减率跟随全局自定义（ecDecayRates），q 含封印加速/王城总倍率（按编辑等级查段）
const grindEditCandidates = computed<Record<string, Array<{ m: GrindMonster; q: number; eff: number; inWindow: boolean }>>>(() => {
  const lv = grindEditLevel.value
  if (lv === null) return {}
  const map: Record<string, Array<{ m: GrindMonster; q: number; eff: number; inWindow: boolean }>> = {}
  for (const c of listAreaFullCandidates(grindMonsterList.value, lv, {
    rates: ecDecayRates.value,
    bonusRate: getTotalBonusRate(lv),
  })) {
    const arr = map[c.m.area]
    if (arr) arr.push(c)
    else map[c.m.area] = [c]
  }
  return map
})

function openGrindEdit(level: number) {
  // 编辑起点 = 当前生效组合：自定义编辑优先；无自定义时自动计算的最优组合也转换为勾选（2026-08-23 用户口径）
  grindEditChecked.value = new Set(bestGrindComboGroupsFor(level).map(g => g.id))
  grindEditLevel.value = level
}

function toggleGrindEdit(id: number) {
  const s = new Set(grindEditChecked.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  grindEditChecked.value = s
}

function saveGrindEdit() {
  if (grindEditLevel.value !== null) {
    grindComboOverrides[String(grindEditLevel.value)] = [...grindEditChecked.value]
    saveGrindCombos()
  }
  grindEditLevel.value = null
}

function closeGrindEdit() {
  grindEditLevel.value = null
}

function resetGrindCombo(level: number) {
  delete grindComboOverrides[String(level)]
  saveGrindCombos()
}

// 行 = 等级（每级一行，2026-08-23 晚起不合并等级段；段内指标即该级指标）。
// 全局因子（2026-08-27 起）：衰减率跟随 ecDecayRates（影响合格群/最优组合），
// 总倍率 = 封印加速 + 王城加成（getTotalBonusRate 按行等级查段，乘进 q/每小时经验/每周经验）。
// 默认组合 = 地区内全部合格群、地区间取每周可获得经验最高（2026-08-27 起，见 bestGrindArea.ts）；
// 手动编辑行按与默认组合的每周经验差值标色：增长红、降低绿（weekClass）。
const bestGrindAreaRows = computed<Array<{ level: number; area: string; group: string; weekText: string; weeklyExp: number; explain: string; overridden: boolean; weekClass: '' | 'up' | 'down' }>>(() => {
  const rows = computeBestGrindGroups(grindMonsterList.value, {
    from: BEST_GRIND_LEVEL_FROM,
    to: BEST_GRIND_LEVEL_TO,
    rates: ecDecayRates.value,
    bonusRate: getTotalBonusRate,
  })
  const byId = new Map(grindMonsterList.value.map(g => [g.id, g] as const))
  return rows.map(r => {
    const br = getTotalBonusRate(r.level)
    const brTxt = Math.abs(br - 1) < 1e-9 ? '' : `总倍率 ×${br} · `
    const override = grindComboOverrides[String(r.level)]
    if (!Array.isArray(override)) {
      return {
        level: r.level,
        area: r.area,
        group: formatBestGrindGroups(r.groups),
        weekText: Math.round(r.weeklyExp).toLocaleString('zh-CN'),
        weeklyExp: Math.round(r.weeklyExp),
        explain: r.bottleneck === 'none'
          ? '无候选'
          : r.bottleneck === 'time'
            ? `${brTxt}时间瓶颈 · 每小时 ${Math.round(r.hourlySum).toLocaleString('zh-CN')} 经验（${r.groups.length} 群）· 每周 580 分钟打满，疲劳烧不完`
            : `${brTxt}疲劳瓶颈 · 每疲劳 ${Math.round(r.value)} 经验 · 烧速 ${Math.round(r.burnPerHour)}/时 · 580 分钟未满先烧完 5180 疲劳`,
        overridden: false,
        weekClass: '',
      }
    }
    // 已编辑：按 id 找回群（失效 id 忽略）→ 重算指标（窗口外群无衰减不参与统计）
    const groups = override.map(id => byId.get(id)).filter((g): g is GrindMonster => !!g)
    const st = computeGrindComboStats(groups, r.level, { rates: ecDecayRates.value, bonusRate: br })
    const areas = [...new Set(groups.map(g => g.area))].join('+') || '—'
    // 手动组合 vs 默认组合的每周经验：增长红色、降低绿色（2026-08-27 用户要求）
    const weekClass = st.weeklyExp > r.weeklyExp ? 'up' : st.weeklyExp < r.weeklyExp ? 'down' : ''
    return {
      level: r.level,
      area: areas,
      group: formatBestGrindGroups(groups),
      weekText: Math.round(st.weeklyExp).toLocaleString('zh-CN'),
      weeklyExp: Math.round(st.weeklyExp),
      explain: st.bottleneck === 'none'
        ? '已编辑 · 无候选（勾选为空或全部失效）'
        : st.bottleneck === 'time'
          ? `已编辑 · ${brTxt}时间瓶颈 · 每小时 ${Math.round(st.hourlySum).toLocaleString('zh-CN')} 经验（${groups.length} 群）· 每周 580 分钟打满，疲劳烧不完`
          : `已编辑 · ${brTxt}疲劳瓶颈 · 每疲劳 ${Math.round(st.value)} 经验 · 烧速 ${Math.round(st.burnPerHour)}/时 · 580 分钟未满先烧完 5180 疲劳`,
      overridden: true,
      weekClass,
    }
  })
})

async function loadExpData() {
  try {
    const rows = await window.electronAPI.getAllExp()
    if (rows && Array.isArray(rows) && rows.length > 0) {
      expData.value = rows as ExpRow[]
    }
  } catch (e) {
    console.warn('loadExpData failed:', e)
  }
}

function isExpEditing(row: number, field: string): boolean {
  const c = expEditCell.value
  return c !== null && c.row === row && c.field === field
}

function startExpEdit(row: number, field: string) {
  const r = expData.value[row]
  if (!r) return
  const val = (r as any)[field]
  expEditBackup.value = val
  expEditValue.value = val
  expEditCell.value = { row, field }
}

async function finishExpEdit(row: number, field: string) {
  if (!expEditCell.value) return
  expEditCell.value = null
  const r = expData.value[row]
  if (!r) return
  const newVal = expEditValue.value
  // Skip if unchanged
  if (newVal === expEditBackup.value) return
  try {
    const updated = await window.electronAPI.updateExp({ level: r.level, field, value: newVal })
    if (updated) {
      expData.value[row] = updated as ExpRow
    }
  } catch (e: any) {
    // Revert on validation error
    ;(r as any)[field] = expEditBackup.value
    console.warn('updateExp failed:', e?.message || e)
  }
}

function cancelExpEdit() {
  if (!expEditCell.value) return
  const r = expData.value[expEditCell.value.row]
  if (r) {
    ;(r as any)[expEditCell.value.field] = expEditBackup.value
  }
  expEditCell.value = null
}

async function addExpRow() {
  try {
    const row = await window.electronAPI.addExpRow()
    if (row) {
      expData.value.push(row as ExpRow)
    }
  } catch (e) {
    console.warn('addExpRow failed:', e)
  }
}

async function deleteExpRow(level: number) {
  try {
    await window.electronAPI.deleteExpRow(level)
    expData.value = expData.value.filter(r => r.level !== level)
  } catch (e) {
    console.warn('deleteExpRow failed:', e)
  }
}

async function resetExpData() {
  try {
    await window.electronAPI.resetExp()
    await loadExpData()
  } catch (e) {
    console.warn('resetExpData failed:', e)
  }
}

// ── 怪物基础经验表 函数 ──

async function loadMonsterExp() {
  try {
    const rows = await window.electronAPI.getAllMonsterExp()
    if (rows && Array.isArray(rows) && rows.length > 0) {
      monsterExpData.value = (rows as MonsterExpRow[])
        .slice()
        .sort((a, b) => a.level - b.level || a.area.localeCompare(b.area) || a.name.localeCompare(b.name))
    }
  } catch (e) {
    console.warn('loadMonsterExp failed:', e)
  }
}

function isMeEditing(row: number, field: string): boolean {
  const c = meEditCell.value
  return c !== null && c.row === row && c.field === field
}

function startMeEdit(row: number, field: string) {
  const list = filteredMonsterExp.value
  const r = list[row]
  if (!r) return
  const val = (r as any)[field]
  meEditBackup.value = val
  meEditValue.value = val
  meEditCell.value = { row, field }
}

async function finishMeEdit(row: number, field: string) {
  if (!meEditCell.value) return
  meEditCell.value = null
  const list = filteredMonsterExp.value
  const r = list[row]
  if (!r) return
  const newVal = meEditValue.value
  if (newVal === meEditBackup.value) return
  try {
    const updated = await window.electronAPI.updateMonsterExp({ id: r.id, field, value: newVal })
    if (updated) {
      // Find and update in source data
      const idx = monsterExpData.value.findIndex(d => d.id === r.id)
      if (idx >= 0) monsterExpData.value[idx] = updated as MonsterExpRow
    }
  } catch (e: any) {
    ;(r as any)[field] = meEditBackup.value
    console.warn('updateMonsterExp failed:', e?.message || e)
    if (e?.message) alert(`保存失败：${e.message}`)
  }
}

function cancelMeEdit() {
  if (!meEditCell.value) return
  const list = filteredMonsterExp.value
  const r = list[meEditCell.value.row]
  if (r) {
    ;(r as any)[meEditCell.value.field] = meEditBackup.value
  }
  meEditCell.value = null
}

function toggleMonsterExpSort() {
  monsterExpSortDir.value = monsterExpSortDir.value === 'asc' ? 'desc' : 'asc'
}

// 地区列表（按首次出现顺序）及各地区行数，供表头"地区"筛选菜单渲染
const monsterExpAreas = computed(() => {
  const counts = new Map<string, number>()
  for (const r of monsterExpData.value) counts.set(r.area, (counts.get(r.area) ?? 0) + 1)
  return [...counts.entries()].map(([name, count]) => ({ name, count }))
})
function toggleAreaFilterMenu() {
  meAreaFilterOpen.value = !meAreaFilterOpen.value
}
function setAreaFilter(name: string | null) {
  monsterExpAreaFilter.value = name
  meAreaFilterOpen.value = false
  meEditCell.value = null // 与文本筛选一致：失焦取消行内编辑
}

async function addMonsterExpRow() {
  try {
    // 地区筛选下新增：新行直接带当前筛选地区，新增后滚动到新行（任何排序下都可见）
    const row = await window.electronAPI.addMonsterExpRow(monsterExpAreaFilter.value ?? undefined)
    if (row) {
      monsterExpData.value.push(row as MonsterExpRow)
      requestAnimationFrame(() => {
        document.getElementById('me-row-' + row.id)?.scrollIntoView({ block: 'center' })
      })
    }
  } catch (e) {
    console.warn('addMonsterExpRow failed:', e)
  }
}

async function deleteMonsterExpRow(id: number) {
  const row = monsterExpData.value.find(r => r.id === id)
  // 删除是直接写数据库的破坏性操作：列出怪物信息二次确认（2026-08-27 起）
  const label = row ? `「${row.name}」（${row.level} 级 · ${row.area}）` : '该行'
  if (!confirm(`确定删除 ${label} 的怪物数据？此操作不可恢复。`)) return
  try {
    await window.electronAPI.deleteMonsterExpRow(id)
    monsterExpData.value = monsterExpData.value.filter(r => r.id !== id)
  } catch (e) {
    console.warn('deleteMonsterExpRow failed:', e)
  }
}

async function duplicateMonsterExpRow(id: number) {
  try {
    const row = await window.electronAPI.duplicateMonsterExpRow(id)
    if (row) {
      monsterExpData.value.push(row as MonsterExpRow)
    }
  } catch (e) {
    console.warn('duplicateMonsterExpRow failed:', e)
  }
}

// ── 经验表导出 Excel（A/B/C 三表 → 一个文件，渲染列按界面口径重算） ──
const exportingExp = ref(false)

async function exportExpExcel() {
  if (exportingExp.value) return
  try {
    exportingExp.value = true
    const monsters = monsterExpData.value
      .slice()
      .sort((a, b) => a.level - b.level || a.area.localeCompare(b.area) || a.name.localeCompare(b.name))
      .map(r => {
        const kill = r.kill_time ?? 2
        const unit = r.fatigue > 0 ? +(r.base_exp / r.fatigue).toFixed(1) : null
        return {
          name: r.name, area: r.area, level: r.level,
          base_exp: r.base_exp, fatigue: r.fatigue,
          unit_exp: unit,
          multiplier: r.multiplier,
          adjusted_exp: r.fatigue > 0 ? +((r.base_exp / r.fatigue) * (1 + (r.multiplier - 1) * 0.05)).toFixed(1) : null,
          quantity: r.quantity,
          respawn_time: r.respawn_time,
          kill_time: kill,
          efficiency: r.respawn_time > 0 ? +((3600 / (r.respawn_time + kill)) * r.fatigue * r.quantity).toFixed(1) : null,
        }
      })
    const res = await window.electronAPI.exportExp({
      monsters,
      bestGrinds: bestGrindAreaRows.value.map(r => ({
        level: r.level, area: r.area, group: r.group,
        weeklyExp: r.weeklyExp, explain: r.explain,
      })),
      levelExps: expData.value.map(r => ({
        level: r.level, exp: r.exp, standard_unit_exp: r.standard_unit_exp,
      })),
    })
    if (!res.ok && res.error !== '已取消') alert(res.error || '导出失败')
  } catch (e: any) {
    alert('导出失败：' + (e?.message || e))
  } finally {
    exportingExp.value = false
  }
}

// 进入经验表卡片（A/B/C 三表）时加载数据
watch(activeCat, (cat) => {
  if (cat === 'monster-exp') {
    if (expData.value.length === 0) loadExpData()
    if (monsterExpData.value.length === 0) loadMonsterExp()
  }
})

// 换行转换
function nl2br(s: string) { return s.replace(/\n/g, '<br>') }

// 必做事项 → 有序列表（自动编号，去除手动序号）
function todoLines(s: string): string[] {
  if (!s) return []
  return s.split('\n')
    .map(l => l.replace(/^[\d①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]+[\.\、\)\)\s]*\s*/, '').trim())
    .filter(l => l)
}

// ── 升级计算器 ──

interface EcPreset {
  startLevel: number; targetLevel: number
  startProgress: number   // 0-100，起始等级经验进度百分比
  completions: Record<string, number>
  itemCounts: Record<string, number>
  itemChecked?: Record<string, boolean> // 道具勾选（2026-08-27 起与数量解耦随方案保存）：false=取消勾选但已填数量保留；缺省沿用旧规则（数量>0 即视为勾选）
  grind?: GrindConfig      // 打怪经验设置（2026-08-19 起每方案独立，缺省 = 默认配置）
  startWeekday?: number    // 起始星期（随方案独立）：0 = 今天（动态跟随当天），1-7=周一到周日（固定）；未设置（undefined 旧数据）与旧占位 0 均按"今天"解析（2026-08-27 恢复"今天"选项）
  bonusEnabled?: Record<string, boolean> // 加成道具启用勾选（2026-08-23 起随方案独立；缺省 = 回退全局定义 enabled）
}

function makeDefaultPreset(): EcPreset {
  return {
    startLevel: 70, targetLevel: 100, startProgress: 0,
    completions: {}, itemCounts: {},
    startWeekday: 0, // 默认"今天"（动态跟随当天）
    grind: makeDefaultGrindConfig(),
  }
}

const ecPresets = ref<EcPreset[]>([makeDefaultPreset()])
const ecActiveIdx = ref(0)

// 全局共享设定（不随方案切换）
const ecMultipliers = ref<Record<string, number>>({})
const ecItemMultipliers = ref<Record<string, number>>({})
const ecAccelEnabled = ref(true)
const ecWangchengBonus = ref(0)
// 打怪衰减率（2026-08-27 起全局共享，不随方案切换；各方案旧 grind.decayRates 仅作一次性迁移种子）
const ecDecayRates = ref<Record<number, number>>({ ...DEFAULT_DECAY_RATES })

// 方案内字段（随方案切换）
const ecStartLevel = computed({ get: () => ecPresets.value[ecActiveIdx.value].startLevel, set: v => { ecPresets.value[ecActiveIdx.value].startLevel = v; savePresets() } })
const ecTargetLevel = computed({ get: () => ecPresets.value[ecActiveIdx.value].targetLevel, set: v => { ecPresets.value[ecActiveIdx.value].targetLevel = v; savePresets() } })
const ecStartProgress = computed({ get: () => ecPresets.value[ecActiveIdx.value].startProgress, set: v => { ecPresets.value[ecActiveIdx.value].startProgress = v; savePresets() } })
const ecCompletions = computed({ get: () => ecPresets.value[ecActiveIdx.value].completions, set: v => { ecPresets.value[ecActiveIdx.value].completions = v } })
const ecItemCounts = computed({ get: () => ecPresets.value[ecActiveIdx.value].itemCounts, set: v => { ecPresets.value[ecActiveIdx.value].itemCounts = v } })
// 起始星期随方案独立：0 = 今天（动态跟随当天），1-7 = 周一~周日（固定，随方案保存）；
// 未设置（undefined，旧数据）与旧占位 0 均按"今天"解析（2026-08-27 恢复"今天"选项）
function todayEcWeekday(): number {
  return new Date().getDay() || 7
}
// 计算用：始终返回具体星期（今天 → 取当天所在星期）
const ecStartWeekday = computed(() => {
  const v = ecPresets.value[ecActiveIdx.value].startWeekday
  return v && v >= 1 && v <= 7 ? v : todayEcWeekday()
})
// 选择框绑定：未设置/0 显示"今天"；选"今天"存 0（动态），选具体星期固定
const ecStartWeekdaySelect = computed({
  get: () => {
    const v = ecPresets.value[ecActiveIdx.value].startWeekday
    return v && v >= 1 && v <= 7 ? v : 0
  },
  set: v => {
    const n = Number(v)
    ecPresets.value[ecActiveIdx.value].startWeekday = n === 0 ? 0 : Math.min(7, Math.max(1, n))
    savePresets()
  },
})

const showRateModal = ref(false)
const rateSubTab = ref<'tasks' | 'ranges'>('tasks')
const showAccelModal = ref(false)
const ecItemLastCounts = ref<Record<string, number>>({})
const ecShowAllItems = ref(true) // 面板常开后默认展示完整道具列表（与任务面板一致），可点「收起未选中」
const ecShowAllTasks = ref(true) // 默认展示完整任务列表（未勾选的也可见），可点「收起未选中」
// 侧边栏面板折叠状态（key 为面板名，如 tasks / bonus / monster-kill / items）；经验道具面板默认折叠（2026-08-27 恢复支持折叠）
const ecPanelCollapsed = ref<Record<string, boolean>>({ bonus: true, items: true })
function toggleEcPanel(key: string) {
  ecPanelCollapsed.value[key] = !ecPanelCollapsed.value[key]
}
function ecPanelOpen(key: string): boolean {
  return !ecPanelCollapsed.value[key]
}

// 周几文字：days 数组 → "一三五"（周一三五）
const WEEKDAY_CHARS = ['一', '二', '三', '四', '五', '六', '日']
function weekDaysText(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b)
  // 连续区间缩写（如 周一~周五 → 一~五），不连续保留逐日列出（如 一三五）
  const isContiguous = sorted.length > 1 && sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1)
  if (isContiguous) {
    return `${WEEKDAY_CHARS[(sorted[0] - 1) % 7]}~${WEEKDAY_CHARS[(sorted[sorted.length - 1] - 1) % 7]}`
  }
  return sorted.map(d => WEEKDAY_CHARS[(d - 1) % 7]).join('')
}
// 经验值紧凑显示：≥1亿 → "3.45亿"，≥1万 → "567.8万"，否则原样（完整数字由 title 提供）
function fmtExp(n: number): string {
  if (n >= 1e8) return (n / 1e8).toFixed(2).replace(/\.?0+$/, '') + '亿'
  if (n >= 1e4) return (n / 1e4).toFixed(1).replace(/\.?0+$/, '') + '万'
  return n.toLocaleString()
}
const ecExpData = ref<ExpRow[]>([])

// 封印加速等级段（rate 为百分比数值，如 20 = 20%）
type AccelTier = { minLevel: number; maxLevel: number; rate: number }

const DEFAULT_ACCEL_TIERS: AccelTier[] = [
  { minLevel: 1, maxLevel: 69, rate: 20 },
  { minLevel: 70, maxLevel: 89, rate: 25 },
  { minLevel: 90, maxLevel: 99, rate: 100 },
  { minLevel: 100, maxLevel: 109, rate: 110 },
  { minLevel: 110, maxLevel: 114, rate: 110 },
  { minLevel: 115, maxLevel: 145, rate: 120 },
  { minLevel: 146, maxLevel: 150, rate: 120 },
  { minLevel: 151, maxLevel: 154, rate: 70 },
]

function getDefaultAccelTiers(): AccelTier[] {
  return DEFAULT_ACCEL_TIERS.map(t => ({ ...t }))
}

// 运行时数据：默认 + 用户覆盖（随 saveShared 持久化）
const accelTiers = ref<AccelTier[]>(getDefaultAccelTiers())

// 校验并钳制用户数据（等级 1~155 且 min<=max，加速率 >= 0）
function sanitizeAccelTiers(raw: unknown): AccelTier[] {
  const arr = Array.isArray(raw) ? raw : []
  const out: AccelTier[] = []
  for (const r of arr) {
    const t = (r ?? {}) as Partial<AccelTier>
    const min = Number(t.minLevel), max = Number(t.maxLevel), rate = Number(t.rate)
    if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(rate)) continue
    out.push({
      minLevel: Math.min(155, Math.max(1, Math.min(min, max))),
      maxLevel: Math.min(155, Math.max(1, Math.max(min, max))),
      rate: Math.min(500, Math.max(0, rate)),
    })
  }
  return out.length > 0 ? out : getDefaultAccelTiers()
}

function getAccelRate(level: number): number {
  const tier = accelTiers.value.find(t => level >= t.minLevel && level <= t.maxLevel)
  return tier ? tier.rate / 100 : 0
}

// 弹窗编辑副本：确定时才提交
const editingAccelTiers = ref<AccelTier[]>([])
const editingDecayRates = ref<Record<number, number>>({ ...DEFAULT_DECAY_RATES }) // 打怪衰减率编辑副本（提交时才落全局）

function openAccelModal() {
  editingAccelTiers.value = accelTiers.value.map(t => ({ ...t }))
  editingDecayRates.value = { ...ecDecayRates.value }
  showAccelModal.value = true
}

function toggleAccel() {
  ecAccelEnabled.value = !ecAccelEnabled.value
  saveEcAccel()
}

function setWangchengBonus(raw: string) {
  const v = parseInt(raw)
  if (raw.trim() === '') { ecWangchengBonus.value = 0; return }
  if (isNaN(v) || v < 0) return
  ecWangchengBonus.value = Math.min(200, v) / 100
}

function addAccelTier() {
  const last = editingAccelTiers.value[editingAccelTiers.value.length - 1]
  editingAccelTiers.value = [
    ...editingAccelTiers.value,
    { minLevel: last ? last.maxLevel + 1 : 1, maxLevel: last ? last.maxLevel + 10 : 155, rate: 20 },
  ]
}

function deleteAccelTier(idx: number) {
  if (editingAccelTiers.value.length <= 1) return // 至少保留一个
  editingAccelTiers.value = editingAccelTiers.value.filter((_, i) => i !== idx)
}

function resetAccelTiers() {
  editingAccelTiers.value = getDefaultAccelTiers()
  editingDecayRates.value = { ...DEFAULT_DECAY_RATES }
}

async function closeAccelModal() {
  accelTiers.value = sanitizeAccelTiers(editingAccelTiers.value)
  ecDecayRates.value = sanitizeDecayRates(editingDecayRates.value)
  showAccelModal.value = false
  await saveShared()
}

// 获取总经验加成率：封印加速 + 跨服王城胜利经验加成
function getTotalBonusRate(level: number): number {
  const accel = ecAccelEnabled.value ? getAccelRate(level) : 0
  return 1 + accel + ecWangchengBonus.value
}

// ── 活动等级段倍率 ──
type MultRange = { minLevel: number; maxLevel: number; multiplier: number }
type ActivityMultDef = { name: string; defaultMultiplier: number; ranges: MultRange[] }

const LEVEL_MULT_KEY = 'exp_calc_level_mults'

// 从 JSON 获取默认值
function getDefaultLevelMults(): Record<string, ActivityMultDef> {
  return JSON.parse(JSON.stringify((activityExpMultipliers as any).activities))
}

// 运行时数据：默认 + 用户覆盖
const levelMults = ref<Record<string, ActivityMultDef>>(getDefaultLevelMults())

// 获取指定活动在指定等级下的等级段倍率
function getLevelBasedMultiplier(activityId: string, level: number): number {
  const def = levelMults.value[activityId]
  if (!def) return 0
  for (const r of def.ranges) {
    if (level >= r.minLevel && level <= r.maxLevel) {
      return r.multiplier
    }
  }
  return def.defaultMultiplier ?? 0
}

// 获取任务的有效倍率：用户自定义 > 等级段倍率 > 0
function getEffectiveTaskMultiplier(activityId: string, level: number): number {
  const userVal = ecMultipliers.value[activityId]
  if (userVal !== undefined && userVal !== null) return userVal
  return getLevelBasedMultiplier(activityId, level)
}

// 检查某个活动是否配置了等级段倍率
function hasLevelMult(activityId: string): boolean {
  return activityId in levelMults.value
}

// 等级段倍率 tooltip
function levelMultTooltip(activityId: string): string {
  const def = levelMults.value[activityId]
  if (!def) return ''
  return def.ranges
    .filter(r => r.multiplier > 0)
    .map(r => `${r.minLevel}-${r.maxLevel}级: ×${r.multiplier}`)
    .join('\n')
}

// ── 倍率设置弹窗（统一：任务倍率 + 等级段倍率）──
const editingLevelMults = ref<Record<string, ActivityMultDef>>({})

function openRateModal() {
  // 弹出编辑副本：当前 levelMults 的深拷贝
  editingLevelMults.value = JSON.parse(JSON.stringify(levelMults.value))
  showRateModal.value = true
}

async function closeRateModal() {
  // 保存等级段倍率
  levelMults.value = JSON.parse(JSON.stringify(editingLevelMults.value))
  showRateModal.value = false
  await saveShared()
  await saveLevelMults()
}

function goToActivityCalc() {
  prevActiveCat.value = activeCat.value // 记住来源，返回时回到原处
  showRateModal.value = false
  activeCat.value = 'activity'
}

// 等级段编辑：增/删 活动 & 等级段
function deleteLevelMultActivity(actId: string) {
  const copy = { ...editingLevelMults.value }
  delete copy[actId]
  editingLevelMults.value = copy
}

function deleteLevelMultRange(actId: string, idx: number) {
  const def = editingLevelMults.value[actId]
  if (!def || def.ranges.length <= 1) return // 至少保留一个
  const copy = { ...editingLevelMults.value }
  copy[actId] = { ...def, ranges: def.ranges.filter((_, i) => i !== idx) }
  editingLevelMults.value = copy
}

function addLevelMultRange(actId: string) {
  const def = editingLevelMults.value[actId]
  if (!def) return
  const last = def.ranges[def.ranges.length - 1]
  const copy = { ...editingLevelMults.value }
  copy[actId] = {
    ...def,
    ranges: [
      ...def.ranges,
      {
        minLevel: last ? last.maxLevel + 1 : 1,
        maxLevel: last ? last.maxLevel + 10 : 155,
        multiplier: 1.0,
      },
    ],
  }
  editingLevelMults.value = copy
}

function addLevelMultActivity() {
  const id = 'new_activity_' + Date.now()
  const copy = { ...editingLevelMults.value }
  copy[id] = {
    name: '新活动',
    defaultMultiplier: 1.0,
    ranges: [{ minLevel: 1, maxLevel: 155, multiplier: 1.0 }],
  }
  editingLevelMults.value = copy
}

async function saveLevelMults() {
  await window.electronAPI.setSetting(LEVEL_MULT_KEY, JSON.stringify(levelMults.value))
}

async function loadLevelMults() {
  try {
    const raw = await window.electronAPI.getSetting(LEVEL_MULT_KEY)
    if (raw) {
      levelMults.value = JSON.parse(raw)
    }
  } catch { /* use defaults */ }
}

// ── 经验道具 ──
type ItemPeriod = 'daily' | 'weekly'

interface ExpItem {
  id: string; name: string; baseMultiplier: number;
  period?: ItemPeriod   // 周期：默认每日；每周道具的次数为「每周可用数」，按周分摊
  days?: number[]       // 开放日（1-7 = 周一~周日）：默认全周（每天都能吃）；与活跃任务一致，可限定某几天
  maxPerWeek?: number   // 每周使用上限（如神游丸每周至多 14 个）：weekly 时数量输入钳制到此值
}

const EXP_ITEMS: ExpItem[] = [
  // 经验成长/无忧祝福语已迁入加成道具（bonus_exp_bless / bonus_exp_wuyou，带有效期，2026-08-21）
  { id: 'exp_zhangfei', name: '张飞扭蛋大补丸', baseMultiplier: 25 },
  { id: 'exp_super_zhangfei', name: '超级张飞扭蛋大补丸', baseMultiplier: 50 },
  { id: 'exp_xiaomai', name: '小麦', baseMultiplier: 8 },
  { id: 'exp_tudou', name: '土豆', baseMultiplier: 11 },
  { id: 'exp_yumi', name: '玉米', baseMultiplier: 20 },
  { id: 'exp_qiwang', name: '棋王顶级丸', baseMultiplier: 2.4429 },
  { id: 'exp_bianjing_wawa', name: '边境小丸子', baseMultiplier: 5 },
  { id: 'exp_zilong', name: '子龙经验丹', baseMultiplier: 5 },
  { id: 'exp_yongshi', name: '勇士徽章', baseMultiplier: 5.75 },
  { id: 'exp_yuelong', name: '跃龙', baseMultiplier: 8 },
  { id: 'exp_pantao', name: '蟠桃', baseMultiplier: 9.4 },
  { id: 'exp_tenglong', name: '腾龙', baseMultiplier: 10 },
  { id: 'exp_feilong', name: '飞龙', baseMultiplier: 12 },
  { id: 'exp_shenlong', name: '神龙', baseMultiplier: 15 },
  { id: 'exp_bianjing_putong', name: '边境普通丸子', baseMultiplier: 18 },
  { id: 'exp_shenyou', name: '神游丸', baseMultiplier: 23, period: 'weekly', maxPerWeek: 14 },
  { id: 'exp_qingmei_yellow', name: '青梅黄色', baseMultiplier: 30 },
  { id: 'exp_qingmei_green', name: '青梅绿色', baseMultiplier: 15 },
  { id: 'exp_xiaozhang', name: '校长', baseMultiplier: 37.5 },
  { id: 'exp_kuilei', name: '傀儡', baseMultiplier: 40 },
  { id: 'exp_longhua', name: '龙华', baseMultiplier: 40 },
  { id: 'exp_haohua', name: '豪华丸', baseMultiplier: 50 },
  { id: 'exp_shilong', name: '蚀龙', baseMultiplier: 100 },
  { id: 'exp_hebo', name: '河伯内丹', baseMultiplier: 100 },
]

// ── 自定义经验道具 + 名称/周期编辑（持久化到 exp_calc_items） ──
const ITEMS_KEY = 'exp_calc_items'
const expItemCustoms = ref<ExpItem[]>([])
const expItemNameOverrides = ref<Record<string, string>>({})
const expItemPeriods = ref<Record<string, ItemPeriod>>({})
const expItemDays = ref<Record<string, number[]>>({}) // 开放日覆盖（全周不存，回退默认）
const expItemUsed = ref<string[]>([]) // 曾勾选过的道具 id（顺序即展示优先序，清除勾选后仍在最前便于恢复）
const editingItemId = ref<string | null>(null)
const editingItemName = ref('')
const editingItemDaysId = ref<string | null>(null) // 正在编辑开放日的道具行
const ALL_WEEK = [1, 2, 3, 4, 5, 6, 7]

// 全部道具 = 内置 + 自定义
const allExpItems = computed<ExpItem[]>(() => [...EXP_ITEMS, ...expItemCustoms.value])

// 展示名：优先用户改名，未改回退原名
function itemDisplayName(item: ExpItem): string {
  return expItemNameOverrides.value[item.id] ?? item.name
}

// 周期：用户切换优先，其次数据自带，默认每日
function itemPeriodOf(item: ExpItem): ItemPeriod {
  return expItemPeriods.value[item.id] ?? item.period ?? 'daily'
}

// 开放日：用户覆盖优先，其次数据自带，默认全周（每天都能吃）
function itemDaysOf(item: ExpItem): number[] {
  return expItemDays.value[item.id] ?? item.days ?? ALL_WEEK
}

// 切换某天的开放状态；全选（7 天）时回退默认不存
function toggleItemDay(item: ExpItem, day: number) {
  const cur = itemDaysOf(item)
  const next = cur.includes(day) ? cur.filter(d => d !== day) : [...cur, day].sort((a, b) => a - b)
  const copy = { ...expItemDays.value }
  if (next.length >= 7) delete copy[item.id]
  else copy[item.id] = next
  expItemDays.value = copy
  saveExpItems()
}

// 开放日按钮文字：全周 → "每天"；部分 → 周几缩写（一三五 / 一~五）
function itemDaysLabel(item: ExpItem): string {
  const days = itemDaysOf(item)
  if (days.length >= 7) return '每天'
  return weekDaysText(days)
}

function toggleItemPeriod(id: string) {
  const item = allExpItems.value.find(i => i.id === id)
  if (!item) return
  const next: ItemPeriod = itemPeriodOf(item) === 'daily' ? 'weekly' : 'daily'
  expItemPeriods.value = { ...expItemPeriods.value, [id]: next }
  saveExpItems()
}

// 自定义道具（id 前缀 exp_custom_，可删除；内置道具固定）
function isCustomItem(id: string): boolean {
  return id.startsWith('exp_custom_')
}

async function saveExpItems() {
  await window.electronAPI.setSetting(ITEMS_KEY, JSON.stringify({
    customs: expItemCustoms.value,
    nameOverrides: expItemNameOverrides.value,
    periods: expItemPeriods.value,
    days: expItemDays.value,
    used: expItemUsed.value,
  }))
}

// 记录勾选历史（勾选时调用；曾勾选的道具在列表中排最前，清除后便于恢复）
function markItemUsed(id: string) {
  if (expItemUsed.value.includes(id)) return
  expItemUsed.value = [...expItemUsed.value, id]
  saveExpItems()
}

async function loadExpItems() {
  try {
    const raw = await window.electronAPI.getSetting(ITEMS_KEY)
    if (raw) {
      const s = JSON.parse(raw)
      if (Array.isArray(s.customs)) {
        expItemCustoms.value = s.customs.filter((i: unknown) => {
          const it = i as Partial<ExpItem> | null
          return !!it && typeof it.id === 'string' && typeof it.name === 'string'
        })
      }
      if (s.nameOverrides && typeof s.nameOverrides === 'object') {
        expItemNameOverrides.value = { ...s.nameOverrides }
      }
      if (s.periods && typeof s.periods === 'object') {
        const periods: Record<string, ItemPeriod> = {}
        for (const [k, v] of Object.entries(s.periods)) {
          if (v === 'daily' || v === 'weekly') periods[k] = v
        }
        expItemPeriods.value = periods
      }
      if (s.days && typeof s.days === 'object') {
        const days: Record<string, number[]> = {}
        for (const [k, v] of Object.entries(s.days)) {
          if (Array.isArray(v)) {
            const arr = v.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7)
            if (arr.length > 0 && arr.length < 7) days[k] = [...new Set(arr)].sort((a, b) => a - b)
          }
        }
        expItemDays.value = days
      }
      if (Array.isArray(s.used)) {
        expItemUsed.value = (s.used as unknown[]).filter((x): x is string => typeof x === 'string')
      }
    }
  } catch { /* ignore */ }
}

function addExpItem() {
  const id = 'exp_custom_' + Date.now()
  expItemCustoms.value = [...expItemCustoms.value, { id, name: '新道具', baseMultiplier: 1 }]
  startEditItemName(id) // 新增后直接进入改名
  saveExpItems()
}

function startEditItemName(id: string) {
  const item = allExpItems.value.find(i => i.id === id)
  if (!item) return
  editingItemId.value = id
  editingItemName.value = itemDisplayName(item)
}

function commitItemName() {
  const id = editingItemId.value
  if (!id) return
  const name = editingItemName.value.trim()
  if (name) {
    expItemNameOverrides.value = { ...expItemNameOverrides.value, [id]: name }
    saveExpItems()
  }
  editingItemId.value = null
}

function deleteExpItem(id: string) {
  expItemCustoms.value = expItemCustoms.value.filter(i => i.id !== id)
  const ov = { ...expItemNameOverrides.value }
  delete ov[id]
  expItemNameOverrides.value = ov
  const per = { ...expItemPeriods.value }
  delete per[id]
  expItemPeriods.value = per
  const days = { ...expItemDays.value }
  delete days[id]
  expItemDays.value = days
  expItemUsed.value = expItemUsed.value.filter(x => x !== id)
  const mult = { ...ecItemMultipliers.value }
  delete mult[id]
  ecItemMultipliers.value = mult
  const cnt = { ...ecItemCounts.value }
  delete cnt[id]
  ecItemCounts.value = cnt
  saveExpItems()
  savePresets()
}

// 道具倍率（可覆盖 baseMultiplier）+ 每日使用次数
const ITEM_DEFAULT_MAX = 60

// 数量输入上限：weekly 道具受游戏每周使用上限约束（如神游丸每周至多 14 个）
function itemMaxCount(item: ExpItem): number {
  if (itemPeriodOf(item) === 'weekly' && item.maxPerWeek) return Math.min(ITEM_DEFAULT_MAX, item.maxPerWeek)
  return ITEM_DEFAULT_MAX
}

// 次数型加成道具（祝福语等）每天次数不设 60 上限：每分钟一次，至多 1440 次/天
// （2026-08-21 用户指定：经验无忧/经验成长祝福语不限 60）
const BONUS_USE_DAILY_MAX = 1440
function itemCountMax(id: string): number {
  const item = allExpItems.value.find(i => i.id === id)
  if (item) return itemMaxCount(item)
  if (bonusItems.value.some(b => b.id === id && typeof b.useMult === 'number')) return BONUS_USE_DAILY_MAX
  return ITEM_DEFAULT_MAX
}

function getItemMultiplier(id: string): number {
  const item = allExpItems.value.find(i => i.id === id)
  return ecItemMultipliers.value[id] ?? item?.baseMultiplier ?? 0
}

// 一键清除已勾选的道具：全部取消勾选但已填数量保留（列表顺序不变，重新勾选即恢复）
function clearEcItems() {
  const p = ecPresets.value[ecActiveIdx.value]
  if (ecActiveItemCount.value === 0) return
  const m: Record<string, boolean> = { ...(p.itemChecked ?? {}) }
  for (const item of allExpItems.value) {
    if ((p.itemCounts[item.id] ?? 0) > 0) m[item.id] = false
  }
  p.itemChecked = m
  ecShowAllItems.value = true // 清空后自动展开全部，方便恢复勾选
  saveEcItems()
}

// 道具是否已勾选启用（2026-08-27 起与数量解耦）：数量 > 0 且未显式取消（itemChecked[id] !== false）。
// 数量保留语义：取消勾选只记录显式关闭，输入框里的数量不动；旧数据无显式记录时按数量判断
function isEcItemSelected(id: string): boolean {
  const p = ecPresets.value[ecActiveIdx.value]
  if ((p.itemCounts[id] ?? 0) <= 0) return false
  const m = p.itemChecked
  return !(m && m[id] === false)
}

// 显式写入道具勾选状态（不解动数量）；preserve 未传时保持原 itemChecked 其他条目
function setEcItemChecked(p: EcPreset, id: string, checked: boolean) {
  p.itemChecked = { ...(p.itemChecked ?? {}), [id]: checked }
}

function toggleEcItem(id: string) {
  const p = ecPresets.value[ecActiveIdx.value]
  if (isEcItemSelected(id)) {
    // 取消勾选：数量保持不变，仅显式关闭；再勾选即原样恢复
    setEcItemChecked(p, id, false)
  } else {
    setEcItemChecked(p, id, true)
    markItemUsed(id) // 记录勾选历史（保持排序靠前）
    // 数量为空时恢复上次填过的值（受上限钳制），首次默认 1
    if ((p.itemCounts[id] ?? 0) <= 0) {
      const item = allExpItems.value.find(i => i.id === id)
      const prev = Math.min(ecItemLastCounts.value[id] ?? 1, item ? itemMaxCount(item) : ITEM_DEFAULT_MAX)
      p.itemCounts = { ...p.itemCounts, [id]: prev }
    }
  }
  saveEcItems()
}

function setItemCount(id: string, raw: string) {
  const p = ecPresets.value[ecActiveIdx.value]
  const v = parseInt(raw)
  if (raw.trim() === '' || v === 0) {
    const copy = { ...p.itemCounts }
    delete copy[id]
    p.itemCounts = copy
    setEcItemChecked(p, id, false) // 数量清零视为取消勾选
    saveEcItems()
    return
  }
  if (v > 0) {
    markItemUsed(id) // 记录勾选历史（保持排序靠前）
    setEcItemChecked(p, id, true) // 手动填数量 = 直接启用该道具
    ecItemLastCounts.value = { ...ecItemLastCounts.value, [id]: v }
  }
  if (isNaN(v) || v < 0) return
  const clamped = Math.min(v, itemCountMax(id))
  if (clamped <= 0) {
    const copy = { ...p.itemCounts }
    delete copy[id]
    p.itemCounts = copy
  } else {
    p.itemCounts = { ...p.itemCounts, [id]: clamped }
  }
  saveEcItems()
}

// ── 加成道具（时效型，2026-08-21） ──
// 来源：《经验获取.md》每日多C多经验 / 感恩的祝福 / 经验成长祝福语 / 经验无忧祝福语 /
// 三国小小勇士 / 三国小小战神 / 日日签的祝福。百分比型按 % 乘到 打怪/道具/任务 经验上；
// 次数型（useMult，如祝福语 0.25）每次给 倍率 × 标准单位经验，每天次数随方案（ecItemCounts）。
// 目录 / 启用 / 剩余天数全局共享（账号"现在"的库存状态）；次数随方案（与经验道具一致）。
const BONUS_KEY = 'exp_calc_bonus'
const bonusItems = ref<ExpBonusItem[]>([])
const editingBonusId = ref<string | null>(null)
const editingBonusName = ref('')
const bonusModalItemId = ref<string | null>(null) // 正在设置弹窗内编辑的加成道具（行内保持一行摘要）
const bonusModalItem = computed(() => bonusItems.value.find(b => b.id === bonusModalItemId.value) ?? null)
const ALL_BONUS_TASKS = computed(() => ecAvailableTasks.value)

// 当前方案是否启用某加成道具：方案记录优先（2026-08-23 起方案独立），无记录回退全局定义 enabled（旧数据过渡）
function bonusItemEnabled(id: string): boolean {
  const map = ecPresets.value[ecActiveIdx.value].bonusEnabled
  if (map && id in map) return !!map[id]
  const item = bonusItems.value.find(b => b.id === id)
  return item ? item.enabled : false
}

// 当前方案生效的加成道具列表（供模拟计算；置 enabled:true 保证通过工具函数窗口检查）
const enabledBonusItems = computed(() =>
  bonusItems.value.filter(b => bonusItemEnabled(b.id)).map(b => ({ ...b, enabled: true })),
)

// 次数型加成道具的默认每天次数（id → defaultCount；方案未显式设置次数时回退，如祝福语 1440）
const bonusDefaultCounts = computed(() => new Map(bonusItems.value.map(b => [b.id, b.defaultCount ?? 0] as const)))

// 生效中的加成道具数（用于面板计数，随方案）
const activeBonusCount = computed(() => bonusItems.value.filter(b => bonusItemEnabled(b.id)).length)

// 次数型加成道具中当天生效且有次数（方案次数或内置默认，如祝福语 1440）的 → 视为经验来源
const bonusUseActiveCount = computed(() =>
  enabledBonusItems.value.filter(b => typeof b.useMult === 'number' && (ecItemCounts.value[b.id] ?? b.defaultCount ?? 0) > 0).length,
)

function isCustomBonusItem(id: string): boolean {
  return id.startsWith('exp_bonus_custom_')
}

async function saveBonusItems() {
  await window.electronAPI.setSetting(BONUS_KEY, JSON.stringify({ items: bonusItems.value }))
}

// 首次使用（无存量数据）：写内置种子；同时迁移旧"经验成长祝福语"（exp_bless → bonus_exp_bless）
async function loadBonusItems() {
  try {
    const raw = await window.electronAPI.getSetting(BONUS_KEY)
    if (!raw) {
      bonusItems.value = DEFAULT_BONUS_ITEMS.map(b => ({ ...b }))
      migrateExpBless()
      await Promise.all([saveBonusItems(), savePresets(), saveExpItems(), saveShared()])
      return
    }
    const s = JSON.parse(raw)
    const sanitized = sanitizeBonusItems(s.items)
    // 存量列表只保留内置种子顺序中的 id（内置定义以代码为准）+ 自定义项，避免旧内置残留
    const builtinIds = new Set(DEFAULT_BONUS_ITEMS.map(b => b.id))
    const kept = [...DEFAULT_BONUS_ITEMS.map(b => ({ ...b }))]
    for (const it of sanitized) {
      if (builtinIds.has(it.id)) {
        const idx = kept.findIndex(k => k.id === it.id)
        if (idx >= 0) kept[idx] = it
      } else {
        kept.push(it)
      }
    }
    bonusItems.value = kept
  } catch { /* ignore */ }
}

// 旧经验道具 exp_bless 迁入加成道具 bonus_exp_bless（幂等；仅首次生成种子时调用）
function migrateExpBless() {
  const oldId = 'exp_bless'
  const newId = 'bonus_exp_bless'
  let changed = false
  for (const p of ecPresets.value) {
    const v = p.itemCounts[oldId]
    if (v !== undefined) {
      delete p.itemCounts[oldId]
      p.itemCounts[newId] = v
      changed = true
    }
  }
  if (expItemUsed.value.includes(oldId)) {
    expItemUsed.value = expItemUsed.value.map(x => (x === oldId ? newId : x))
    changed = true
  }
  const mult = { ...ecItemMultipliers.value }
  if (mult[oldId] !== undefined) {
    mult[newId] = mult[oldId]
    delete mult[oldId]
    changed = true
  }
  if (changed) ecItemMultipliers.value = mult
}

function addBonusItem() {
  const id = 'exp_bonus_custom_' + Date.now()
  bonusItems.value = [
    ...bonusItems.value,
    { id, name: '新加成道具', validDays: 30, grindPct: 0, itemPct: 0, taskPct: 0, taskIds: [], enabled: false, startDay: 1, startRemainDays: 30 },
  ]
  openBonusModal(id) // 新增后弹窗改名
  saveBonusItems()
}

function startEditBonusName(id: string) {
  const item = bonusItems.value.find(i => i.id === id)
  if (!item) return
  editingBonusId.value = id
  editingBonusName.value = item.name
}

function commitBonusName() {
  const id = editingBonusId.value
  if (!id) return
  const name = editingBonusName.value.trim()
  if (name) {
    bonusItems.value = bonusItems.value.map(i => (i.id === id ? { ...i, name } : i))
    saveBonusItems()
  }
  editingBonusId.value = null
}

function deleteBonusItem(id: string) {
  bonusItems.value = bonusItems.value.filter(i => i.id !== id)
  const cnt = { ...ecItemCounts.value }
  delete cnt[id]
  ecItemCounts.value = cnt
  // 各方案残留的启用记录一并清理
  for (const p of ecPresets.value) {
    if (p.bonusEnabled && id in p.bonusEnabled) {
      const next = { ...p.bonusEnabled }
      delete next[id]
      p.bonusEnabled = next
    }
  }
  saveBonusItems()
  savePresets()
}

// 启用/停用（面板行 ☑ 勾选直接控制）：勾选随方案保存，各方案互不影响（2026-08-23 起）
function setBonusEnabled(id: string, checked: boolean) {
  const p = ecPresets.value[ecActiveIdx.value]
  if (!p.bonusEnabled) p.bonusEnabled = {}
  p.bonusEnabled = { ...p.bonusEnabled, [id]: checked }
  savePresets()
}

// 百分比输入（空 = 0）
function setBonusPct(id: string, key: 'grindPct' | 'itemPct' | 'taskPct', raw: string) {
  const v = parseFloat(raw)
  if (isNaN(v) || v < 0) return
  bonusItems.value = bonusItems.value.map(i => (i.id === id ? { ...i, [key]: v } : i))
  saveBonusItems()
}

// 有效天数（总有效期）：不设上限（2026-08-23 用户确认）；调低时剩余天数收窄到新上限
function setBonusValidDays(id: string, raw: string) {
  const v = parseInt(raw)
  if (isNaN(v) || v < 1) return
  bonusItems.value = bonusItems.value.map(i => (i.id === id
    ? { ...i, validDays: v, startRemainDays: Math.min(i.startRemainDays, v) }
    : i))
  saveBonusItems()
}

// 剩余天数：清空 = 回满总有效期；不设上限（2026-08-23 用户确认，可超 validDays）
function setBonusRemain(id: string, raw: string) {
  if (raw.trim() === '') {
    bonusItems.value = bonusItems.value.map(i => (i.id === id ? { ...i, startRemainDays: i.validDays } : i))
    saveBonusItems()
    return
  }
  const v = parseInt(raw)
  if (isNaN(v) || v < 1) return
  bonusItems.value = bonusItems.value.map(i => (i.id === id ? { ...i, startRemainDays: v } : i))
  saveBonusItems()
}

// 开始天数：清空 = 回第 1 天（起始日）；钳制 1~3650（延后启用 = 模拟第 N 天才生效）
function setBonusStartDay(id: string, raw: string) {
  const v = raw.trim() === '' ? 1 : parseInt(raw)
  if (isNaN(v) || v < 1) return
  bonusItems.value = bonusItems.value.map(i => (i.id === id ? { ...i, startDay: Math.min(3650, v) } : i))
  saveBonusItems()
}

// 类型切换（弹窗内显式设置）：百分比型 ⇄ 次数型（次数型初始倍率 1）
function setBonusType(id: string, use: boolean) {
  const item = bonusItems.value.find(i => i.id === id)
  if (!item) return
  const isUse = typeof item.useMult === 'number'
  if (isUse === use) return
  bonusItems.value = bonusItems.value.map(i => (i.id === id ? { ...i, useMult: use ? 1 : undefined } : i))
  saveBonusItems()
}

// 次数型每次倍率：仅更新数值（>0 才写入）；空/非法输入不改类型、保留旧值
// （类型只能通过弹窗内「类型」按钮显式切换，输入过程中退格/清空不会切回百分比型）
function setBonusUseMult(id: string, raw: string) {
  const v = parseFloat(raw)
  if (isNaN(v) || v <= 0) return
  bonusItems.value = bonusItems.value.map(i => (i.id === id ? { ...i, useMult: v } : i))
  saveBonusItems()
}

// 打开设置弹窗（名称进入编辑态，失焦/回车提交；弹窗内编辑全部配置）
function openBonusModal(id: string) {
  bonusModalItemId.value = id
  startEditBonusName(id)
}

function toggleBonusTaskId(id: string, taskId: string) {
  const item = bonusItems.value.find(i => i.id === id)
  if (!item) return
  const next = item.taskIds.includes(taskId)
    ? item.taskIds.filter(x => x !== taskId)
    : [...item.taskIds, taskId]
  bonusItems.value = bonusItems.value.map(i => (i.id === id ? { ...i, taskIds: next } : i))
  saveBonusItems()
}

// 悬停说明：效果摘要 + 生效窗口
function bonusDesc(item: ExpBonusItem): string {
  const parts: string[] = []
  if (typeof item.useMult === 'number') parts.push(`每次 ×${item.useMult} 标准单位经验`)
  if (item.grindPct > 0) parts.push(`打怪 +${item.grindPct}%`)
  if (item.itemPct > 0) parts.push(`道具 +${item.itemPct}%`)
  if (item.taskPct > 0) parts.push(`任务 +${item.taskPct}%（${item.taskIds.length} 项）`)
  const eff = parts.length > 0 ? parts.join(' · ') : '无加成效果'
  const window = item.startDay > 1 ? `第 ${item.startDay} 天起生效` : '起始日（第 1 天）起生效'
  return `${item.name}：${eff} · ${window}，共 ${item.startRemainDays} 天`
}

// ── 每日打怪经验 ──
// 2026-08-19 起打怪配置随方案独立（原全局共享 GRIND_KEY 仅作一次性迁移种子）
const GRIND_KEY = 'exp_calc_grind'

function makeDefaultGrindConfig(): GrindConfig {
  return {
    dailyHours: [1, 1, 1, 1, 1, 1, 1],
    doubleExpDays: [false, false, false, false, false, false, false],
    qiXinDays: [false, false, false, false, false, false, false],
    partySize: 5,
    intimacyLevel: 0,
    mentorBonus: 0,
    plumBonus: 0,
    titleBonus: 0,
    masteryBonus: 0,
    segments: [],
    decayRates: { ...DEFAULT_DECAY_RATES },
    bigFatigueCap: DEFAULT_BIG_FATIGUE_CAP,
  }
}

// 2026-08-23：monsterIds 从 monsterGroupId 字符串迁移为数据库行 id（每行独立勾选，同名行互不影响）。
// 加载时把旧字符串 gid（地区+等级+名称）转成匹配的所有行 id；数字 id（新格式）原样保留。
function migrateMonsterIds(rawIds: unknown, rows: MonsterExpRow[]): number[] {
  const out = new Set<number>()
  if (!Array.isArray(rawIds)) return []
  for (const x of rawIds) {
    if (typeof x === 'number' && Number.isInteger(x)) { out.add(x); continue }
    if (typeof x !== 'string') continue
    for (const r of rows) if (monsterGroupId(r) === x) out.add(r.id)
  }
  return [...out].slice(0, 500)
}
// 迁移段数组（预设/方案的 segments[].monsterIds）
function migrateSegsRaw(segs: unknown, rows: MonsterExpRow[]): unknown {
  if (!Array.isArray(segs)) return segs
  for (const s of segs) {
    if (s && typeof s === 'object' && Array.isArray((s as Record<string, unknown>).monsterIds)) {
      (s as Record<string, unknown>).monsterIds = migrateMonsterIds((s as Record<string, unknown>).monsterIds, rows)
    }
  }
  return segs
}
// 迁移方案级 grind raw（monsterIds + segments[].monsterIds）
function migrateGrindRaw(raw: unknown, rows: MonsterExpRow[]): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const r = raw as Record<string, unknown>
  if (Array.isArray(r.monsterIds)) r.monsterIds = migrateMonsterIds(r.monsterIds, rows)
  if (Array.isArray(r.segments)) r.segments = migrateSegsRaw(r.segments, rows)
  return raw
}

// 打怪衰减率表清洗：合并用户覆盖（钳制 0~1），缺省项用默认表；供全局设定加载与旧方案数据读取共用
function sanitizeDecayRates(raw: unknown): Record<number, number> {
  const rates: Record<number, number> = { ...DEFAULT_DECAY_RATES }
  if (raw && typeof raw === 'object') {
    for (const k of Object.keys(raw as Record<string, unknown>)) {
      const diff = Number(k)
      const n = Number((raw as Record<string, unknown>)[k])
      if (!isNaN(diff) && !isNaN(n)) rates[diff] = Math.min(1, Math.max(0, n))
    }
  }
  return rates
}

function sanitizeGrindConfig(raw: unknown): GrindConfig {
  const d = makeDefaultGrindConfig()
  if (!raw || typeof raw !== 'object') return d
  const r = raw as Record<string, unknown>
  const clampNum = (v: unknown, min: number, max: number, fallback: number) => {
    const n = Number(v)
    return isNaN(n) ? fallback : Math.min(max, Math.max(min, n))
  }
  // 等级段（2026-08-23 起唯一模式，默认由 B 表最优组合填充）：有合法 levelFrom/levelTo 的段保留；
  // 无等级字段的旧格式段（历史迁移产物，只有 monsterIds）并入 monsterIds（由 loadPresets 转为单段）
  const rawSegs = Array.isArray(r.segments) ? r.segments : []
  const segments: GrindSegment[] = []
  const segIds: number[] = [] // 无等级字段的旧格式段勾选并集（并入 monsterIds）
  for (const s of rawSegs.slice(0, 20)) {
    const sraw = (s && typeof s === 'object') ? s as Record<string, unknown> : {}
    if (!Array.isArray(sraw.monsterIds)) continue
    const ids = [...new Set((sraw.monsterIds as unknown[]).filter((x): x is number => typeof x === 'number' && Number.isInteger(x)))].slice(0, 500)
    const from = Number(sraw.levelFrom)
    const to = Number(sraw.levelTo)
    if (!isNaN(from) && !isNaN(to) && typeof sraw.levelFrom === 'number' && typeof sraw.levelTo === 'number') {
      // 新格式段：保留（含空勾选的新建段草稿——避免新增段在重载/套用预设时静默消失）
      let lo = Math.round(clampNum(sraw.levelFrom, 1, 200, 1))
      let hi = Math.round(clampNum(sraw.levelTo, 1, 200, 200))
      if (lo > hi) { const t = lo; lo = hi; hi = t }
      segments.push({ levelFrom: lo, levelTo: hi, monsterIds: ids })
    } else {
      for (const x of ids) segIds.push(x)
    }
  }
  // 历史字段 monsterIds：计算已不使用，仅保留供 loadPresets 迁移为单段（旧配置无段时）
  const rawIds = Array.isArray(r.monsterIds) ? r.monsterIds : []
  const monsterIds = [...new Set([...segIds, ...(rawIds as unknown[]).filter((x): x is number => typeof x === 'number' && Number.isInteger(x))])].slice(0, 500)
  // 每日时长：优先新字段 dailyHours（7 项补齐），兼容旧字段 hoursPerDay（每天一致）
  const rawHours = Array.isArray(r.dailyHours) ? (r.dailyHours as unknown[]).slice(0, 7).map(v => clampNum(v, 0, 24, 0)) : null
  const dailyHours = rawHours
    ? [...rawHours, ...Array(7 - rawHours.length).fill(0)]
    : Array(7).fill(clampNum(r.hoursPerDay, 0, 24, 1))
  // 每日开齐心/双倍时间：优先新字段（7 项补齐），兼容旧布尔字段（每天一致）
  const boolDays = (key: string, fallback: boolean): boolean[] => {
    const a = r[key]
    if (Array.isArray(a)) {
      const arr = (a as unknown[]).slice(0, 7).map(v => !!v)
      return [...arr, ...Array(7 - arr.length).fill(false)]
    }
    if (typeof a === 'boolean') return Array(7).fill(a)
    return Array(7).fill(fallback)
  }
  const bigFatigueCap = Math.round(clampNum(r.bigFatigueCap, 0, DEFAULT_BIG_FATIGUE_CAP, DEFAULT_BIG_FATIGUE_CAP))
  // 起始日剩余疲劳（缺省 undefined = 满额）：系统 ≤ 380/天（仅第 1 天），大疲劳 ≤ 每周大疲劳额度
  const startSystemFatigue = typeof r.startSystemFatigue === 'number'
    ? Math.round(clampNum(r.startSystemFatigue, 0, SYSTEM_DAILY_FATIGUE, SYSTEM_DAILY_FATIGUE))
    : undefined
  const startBigFatigue = typeof r.startBigFatigue === 'number'
    ? Math.round(clampNum(r.startBigFatigue, 0, bigFatigueCap, bigFatigueCap))
    : undefined
  const partySize = Math.round(clampNum(r.partySize, 1, 5, 5))
  // 开齐心人数（缺省 undefined = 跟随队伍人数）：1 ~ 队伍人数
  const qiXinPartySize = typeof r.qiXinPartySize === 'number'
    ? Math.round(clampNum(r.qiXinPartySize, 1, partySize, partySize))
    : undefined
  return {
    dailyHours,
    doubleExpDays: boolDays('doubleExpDays', false),
    qiXinDays: boolDays('qiXinDays', false),
    partySize,
    qiXinPartySize,
    intimacyLevel: Math.round(clampNum(r.intimacyLevel, 0, 10, 0)),
    mentorBonus: clampNum(r.mentorBonus, 0, 500, 0),
    plumBonus: clampNum(r.plumBonus, 0, 500, 0),
    titleBonus: clampNum(r.titleBonus, 0, 500, 0),
    masteryBonus: clampNum(r.masteryBonus, 0, 500, 0),
    bigFatigueCap,
    startSystemFatigue,
    startBigFatigue,
    monsterIds,
    // 等级段按起止等级从低到高排列（起升序，同级按止升序）
    segments: segments.sort((a, b) => a.levelFrom - b.levelFrom || a.levelTo - b.levelTo),
    // 衰减率表：保留旧数据（2026-08-27 起计算用全局 ecDecayRates，此字段仅迁移种子/兼容）
    decayRates: sanitizeDecayRates(r.decayRates),
  }
}

// 打怪配置 = 当前方案的 grind 字段：原地修改直接落到方案对象，切换方案自动跟随（loadPresets 已保证每方案 grind 非空）
const grindConfig = computed<GrindConfig>({
  get: () => ecPresets.value[ecActiveIdx.value].grind ?? makeDefaultGrindConfig(),
  set: v => {
    ecPresets.value[ecActiveIdx.value].grind = v
    savePresets()
  },
})

async function saveGrindConfig() {
  await savePresets() // 配置已随方案保存（PRESETS_KEY）
}

// 数值字段输入（沿用 setItemCount/setWangchengBonus 的手写解析风格，避免空串污染）
function setGrindNumber(key: 'mentorBonus' | 'plumBonus' | 'masteryBonus', raw: string) {
  if (raw.trim() === '') {
    grindConfig.value[key] = 0
  } else {
    const v = parseFloat(raw)
    if (!isNaN(v) && v >= 0) grindConfig.value[key] = v
  }
  saveGrindConfig()
}

// 每周大疲劳额度（疲劳点，上限 2520）：清空恢复默认满额
function setBigFatigueCap(raw: string) {
  if (raw.trim() === '') {
    grindConfig.value.bigFatigueCap = DEFAULT_BIG_FATIGUE_CAP
  } else {
    const v = parseFloat(raw)
    if (!isNaN(v) && v >= 0) grindConfig.value.bigFatigueCap = Math.min(DEFAULT_BIG_FATIGUE_CAP, Math.round(v))
  }
  saveGrindConfig()
}

// 起始日剩余疲劳（系统/大疲劳）：清空恢复满额（undefined = 缺省满额）
function setGrindStartFatigue(key: 'startSystemFatigue' | 'startBigFatigue', raw: string, max: number) {
  if (raw.trim() === '') {
    grindConfig.value[key] = undefined
  } else {
    const v = parseFloat(raw)
    if (!isNaN(v) && v >= 0) grindConfig.value[key] = Math.min(max, Math.round(v))
  }
  saveGrindConfig()
}

// 每日刷怪时长（周一~周日），替换数组以触发响应式
function setGrindDailyHour(idx: number, raw: string) {
  const dailyHours = [...grindConfig.value.dailyHours]
  if (raw.trim() === '') {
    dailyHours[idx] = 0
  } else {
    const v = parseFloat(raw)
    if (!isNaN(v) && v >= 0) dailyHours[idx] = v
  }
  grindConfig.value.dailyHours = dailyHours
  saveGrindConfig()
}

// 星期名称（周一~周日），用于设置弹窗与结果标注
const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

// 本周刷怪时长合计（小时）
const weeklyGrindHours = computed(() =>
  grindConfig.value.dailyHours.reduce((s, h) => s + (Number(h) || 0), 0),
)
// 本周开齐心时长合计（分钟）：仅统计开齐心那天的设定时长
const qiXinWeeklyMinutes = computed(() =>
  WEEKDAY_NAMES.reduce((s, _, i) => s + (grindConfig.value.qiXinDays[i] ? (Number(grindConfig.value.dailyHours[i]) || 0) * 60 : 0), 0),
)
// 本周预计疲劳消耗（按首日目标地图烧速估算）：周刷怪小时 × 烧速（PL/小时）
const weeklyFatigueEstimate = computed(() =>
  weeklyGrindHours.value * grindTotalEfficiency.value,
)
// 本周疲劳总量上限 = 系统 380×7 + 大疲劳额度
const weeklyFatigueCap = computed(() =>
  SYSTEM_DAILY_FATIGUE * 7 + (grindConfig.value.bigFatigueCap ?? DEFAULT_BIG_FATIGUE_CAP),
)
// 起始日剩余系统疲劳/大疲劳（缺省 = 满额），供面板首日预览与设置输入显示
const grindStartSystemFatigue = computed(() =>
  grindConfig.value.startSystemFatigue ?? SYSTEM_DAILY_FATIGUE,
)
const grindStartBigFatigue = computed(() =>
  grindConfig.value.startBigFatigue ?? (grindConfig.value.bigFatigueCap ?? DEFAULT_BIG_FATIGUE_CAP),
)

// 模拟第 N 天（1-based）的星期名称，供明细表标注
function weekdayNameOfDay(day: number): string {
  return WEEKDAY_NAMES[(grindStartWeekday.value - 1 + day - 1) % 7]
}

function setGrindInt(key: 'partySize' | 'intimacyLevel', val: number) {
  grindConfig.value[key] = val
  saveGrindConfig()
}

// 开齐心人数（1 ~ 队伍人数）：设为与队伍人数一致时恢复缺省（undefined = 跟随队伍人数）
function setGrindQiXinPartySize(val: number) {
  const partySize = Math.min(5, Math.max(1, Math.round(Number(grindConfig.value.partySize) || 5)))
  const n = Math.min(partySize, Math.max(1, Math.round(val)))
  grindConfig.value.qiXinPartySize = n >= partySize ? undefined : n
  saveGrindConfig()
}

// 每日开齐心/双倍时间（周一~周日），替换数组以触发响应式
function setGrindDayFlag(key: 'doubleExpDays' | 'qiXinDays', idx: number, val: boolean) {
  const arr = [...grindConfig.value[key]]
  arr[idx] = val
  grindConfig.value[key] = arr
  saveGrindConfig()
}

// 打怪衰减率（角色−怪物等级差 diff，输入百分比）：清空恢复默认值，钳制 0~100%；
// 全局共享（不随方案切换）：先写弹窗编辑副本，确定时经 closeAccelModal 落全局并持久化
function setDecayRate(diff: number, raw: string) {
  const rates = { ...editingDecayRates.value }
  if (raw.trim() === '') {
    rates[diff] = DEFAULT_DECAY_RATES[diff] ?? 0
  } else {
    const v = parseFloat(raw)
    if (!isNaN(v) && v >= 0) rates[diff] = Math.min(100, v) / 100
  }
  editingDecayRates.value = rates
}

// 衰减率编辑区标签：小X = 怪物比角色高 X 级；大X = 角色比怪物高 X 级
function decayRateLabel(diff: number): string {
  if (diff < 0) return `小${-diff}`
  if (diff > 0) return `大${diff}`
  return '同级'
}
// 衰减率显示百分比（保留两位小数，读弹窗编辑副本）
function decayRatePct(diff: number): number {
  return Math.round((editingDecayRates.value[diff] ?? DEFAULT_DECAY_RATES[diff] ?? 0) * 10000) / 100
}

// 经验加成字段（师徒 / 青梅 / 装备熟练度），供设置弹窗 v-for 渲染；
// 称号加成 2026-08-23 起移除（存储字段 titleBonus 保留兼容旧数据，不再参与计算）
const GRIND_BONUS_FIELDS = [
  { key: 'mentorBonus', label: '师徒' },
  { key: 'plumBonus', label: '青梅' },
  { key: 'masteryBonus', label: '熟练度' },
] as const

// 怪物数据 → 计算模型（quantity/respawn_time/kill_time 用于自动计算效率）
function toGrindMonster(r: MonsterExpRow): GrindMonster {
  return {
    id: r.id, name: r.name, area: r.area, level: r.level, baseExp: r.base_exp, fatigue: r.fatigue,
    multiplier: r.multiplier, quantity: r.quantity, respawnTime: r.respawn_time, killTime: r.kill_time ?? 2,
  }
}

const grindMonsterList = computed<GrindMonster[]>(() => monsterExpData.value.map(toGrindMonster))

// 打怪经验设置弹窗（每日时长 / 队伍 / 加成 / 大疲劳）
const grindSettingsOpen = ref(false)

// 等级段弹窗地区折叠状态（按地区名；默认折叠，已勾选怪物的地区自动展开）
// checkedCount 可选：作为"未手动折叠"时的默认展开判定（按当前段勾选数）
const grindAreaCollapsed = ref<Record<string, boolean>>({})
function grindAreaOpen(area: string, checkedCount?: number): boolean {
  if (grindAreaCollapsed.value[area] !== undefined) return !grindAreaCollapsed.value[area]
  return (checkedCount ?? 0) > 0
}
function toggleGrindArea(area: string, checkedCount?: number) {
  grindAreaCollapsed.value[area] = grindAreaOpen(area, checkedCount)
}
// monsters 可选：浏览全部怪物（缺省 = 全部怪物）；
// id = 数据库行 id（2026-08-23 起：每行独立勾选，同名行互不影响）
function grindGroupsByArea(area: string, monsters: GrindMonster[] = grindMonsterList.value): Array<{ id: number; level: number; name: string; quantity: number }> {
  return monsters
    .filter(r => r.area === area)
    .map(r => ({ id: r.id, level: r.level, name: r.name, quantity: r.quantity }))
}

// 地图下按等级段分组（5 级一段，如 100~104 级）；升级过程等级跨度大时按段浏览勾选；
// 段内群按「怪物等级 + 名称」升序（2026-08-27 用户指定）
interface GrindSegGroups { key: number; label: string; groups: Array<{ id: number; level: number; name: string; quantity: number }> }
function grindSegmentsInArea(area: string, monsters: GrindMonster[] = grindMonsterList.value): GrindSegGroups[] {
  const segs = new Map<number, GrindSegGroups>()
  for (const g of grindGroupsByArea(area, monsters)) {
    const lo = Math.floor(g.level / 5) * 5
    let seg = segs.get(lo)
    if (!seg) {
      seg = { key: lo, label: `${lo}~${lo + 4} 级`, groups: [] }
      segs.set(lo, seg)
    }
    seg.groups.push(g)
  }
  for (const seg of segs.values()) {
    seg.groups.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'zh-CN') || a.id - b.id)
  }
  return [...segs.values()].sort((a, b) => a.key - b.key)
}

// B 表某等级的最优打怪群组合（该级自定义编辑优先，否则默认 = 单位经验获取效率最高的全部合格群）；
// 无候选返回 []。B 表即打怪预设（2026-08-23 起替代原等级段预设），供「默认」按钮/新方案/编辑弹窗套用；
// 衰减率跟随全局自定义 ecDecayRates（2026-08-27 起），倍率仅影响指标不影响组合选取
function bestGrindComboGroupsFor(level: number): GrindMonster[] {
  const byId = new Map(grindMonsterList.value.map(g => [g.id, g] as const))
  const override = grindComboOverrides[String(level)]
  if (Array.isArray(override)) {
    return override.map(id => byId.get(id)).filter((g): g is GrindMonster => !!g)
  }
  const rows = computeBestGrindGroups(grindMonsterList.value, {
    from: level, to: level, rates: ecDecayRates.value, bonusRate: getTotalBonusRate(level),
  })
  return rows[0]?.groups ?? []
}

// ===== 等级段（2026-08-23 起唯一模式，全局勾选已移除；默认勾选 = 经验表 B 表最优打怪群组合）：
// 按等级段指定刷图怪物群，勾选即打、不做目标地图自动竞争；等级未落在任何段内 → 当天不打怪 =====

const segmentSettingsOpen = ref(false)

// 当前方案的等级段列表（get 保证非空数组；原地修改段对象后 saveGrindConfig 持久化）
const grindSegments = computed<GrindSegment[]>(() => grindConfig.value.segments ?? [])

// 当前选中/编辑怪物群的段下标（点击段 tab 切换；越界自动回退 0）
const segEditingIdx = ref<number | null>(null)
// 有效选中下标（无段时 -1）：供模板取当前段勾选列表
const activeSegIdx = computed(() => {
  const n = grindSegments.value.length
  if (n === 0) return -1
  return segEditingIdx.value !== null && segEditingIdx.value >= 0 && segEditingIdx.value < n ? segEditingIdx.value : 0
})
// 当前选中段对象（模板在 grindSegments.length > 0 的 v-if 内使用，安全断言非空）
const activeGrindSeg = computed<GrindSegment>(() => grindSegments.value[activeSegIdx.value]!)

// 从 B 表每级最优组合（含自定义编辑）推导等级段：组合签名（排序群 id）相同的相邻等级合并为一段
function segmentsFromBestCombos(startLevel: number, targetLevel: number): GrindSegment[] {
  const segs: GrindSegment[] = []
  let cur: GrindSegment | null = null
  let curSig = ''
  for (let lv = startLevel; lv <= targetLevel; lv++) {
    if (lv < BEST_GRIND_LEVEL_FROM || lv > BEST_GRIND_LEVEL_TO) continue
    const groups = bestGrindComboGroupsFor(lv)
    const sig = groups.map(g => g.id).sort((a, b) => a - b).join(',')
    if (cur && sig === curSig && lv === cur.levelTo + 1) {
      cur.levelTo = lv
    } else {
      cur = { levelFrom: lv, levelTo: lv, monsterIds: groups.map(g => g.id) }
      curSig = sig
      segs.push(cur)
    }
  }
  return segs
}

// 默认：按等级段用 B 表每级最优组合（同组合相邻等级合并为段）重置本方案的等级段配置
function applyBestGrindCombo() {
  const from = ecStartLevel.value
  const to = ecTargetLevel.value
  const segs = segmentsFromBestCombos(from, to)
  if (segs.length === 0) {
    alert(`等级范围 ${from}~${to} 无可用打怪群组合（B 表无候选）`)
    return
  }
  const total = segs.reduce((s, x) => s + x.monsterIds.length, 0)
  if (!confirm(`重置等级段为 B 表最优打怪群组合默认：${segs.length} 段（${segs[0].levelFrom}~${segs[segs.length - 1].levelTo} 级、共 ${total} 群），替换当前方案的等级段配置？`)) return
  grindConfig.value.segments = segs
  segEditingIdx.value = 0
  saveGrindConfig()
}

// 打开等级段设置弹窗：默认选中第 1 段；传入下标时切换到对应段
// 打开时清除当前段已勾选地图的手动折叠记录 → 默认展开已勾选群怪所在地图
function openSegmentSettings(si?: number) {
  if (si !== undefined && si < grindSegments.value.length) {
    segEditingIdx.value = si
  } else if (segEditingIdx.value === null && grindSegments.value.length > 0) {
    segEditingIdx.value = 0
  }
  const seg = grindSegments.value[segEditingIdx.value ?? 0]
  if (seg && seg.monsterIds.length > 0) {
    const checkedAreas = new Set(segmentEditMonsters.value.filter(m => seg.monsterIds.includes(m.id)).map(m => m.area))
    for (const a of checkedAreas) delete grindAreaCollapsed.value[a]
  }
  segmentSettingsOpen.value = true
}

function toggleSegMonster(si: number, gid: number) {
  const seg = (grindConfig.value.segments ?? [])[si]
  if (!seg) return
  seg.monsterIds = seg.monsterIds.includes(gid)
    ? seg.monsterIds.filter(x => x !== gid)
    : [...seg.monsterIds, gid]
  saveGrindConfig()
}

// 等级段按起止等级从低到高原地排序（起升序，同级按止升序），返回排序后的段数组
function sortSegments(): GrindSegment[] {
  const segs = grindConfig.value.segments ?? []
  segs.sort((a, b) => a.levelFrom - b.levelFrom || a.levelTo - b.levelTo)
  return segs
}

// 段对象在配置中的当前下标（排序后按对象引用重定位选中段）
function segIndex(seg: GrindSegment): number {
  return (grindConfig.value.segments ?? []).indexOf(seg)
}

// 段起止等级输入：钳制 1~200，起>止自动交换（闭区间）；修改后按等级重排并保持当前段选中
function setSegmentLevel(si: number, key: 'levelFrom' | 'levelTo', raw: string) {
  const seg = (grindConfig.value.segments ?? [])[si]
  if (!seg) return
  const n = Math.min(200, Math.max(1, Math.round(Number(raw) || 1)))
  seg[key] = n
  if (seg.levelFrom > seg.levelTo) {
    const t = seg.levelFrom
    seg.levelFrom = seg.levelTo
    seg.levelTo = t
  }
  sortSegments()
  segEditingIdx.value = segIndex(seg)
  saveGrindConfig()
}

// 新增段的落点：在 [起始, 目标] 内找第一个未覆盖等级的缺口（缺口止 = 下一段起 − 1，无下一段 = 目标）；
// 已全部覆盖时退化为 { from: 目标, to: 目标 }（单级可编辑段）。删除中间段后再 ＋ 会直接补回原缺口。
function segmentGapForAdd(segs: GrindSegment[], floor: number, cap: number): { from: number; to: number } {
  const list = [...segs].sort((a, b) => a.levelFrom - b.levelFrom || a.levelTo - b.levelTo)
  let si = 0
  for (let lv = floor; lv <= cap; lv++) {
    while (si < list.length && list[si].levelTo < lv) si++
    if (si < list.length && lv >= list[si].levelFrom && lv <= list[si].levelTo) continue
    let k = si
    while (k < list.length && list[k].levelFrom <= lv) k++
    const to = k < list.length ? Math.min(list[k].levelFrom - 1, cap) : cap
    return { from: lv, to }
  }
  return { from: cap, to: cap }
}

// 追加等级段：落在 [起始, 目标] 内第一个未覆盖等级的缺口上；按等级重排后自动展开编辑
function addSegment() {
  const segs = grindConfig.value.segments ?? []
  const gap = segmentGapForAdd(segs, ecStartLevel.value, ecTargetLevel.value)
  const seg: GrindSegment = { levelFrom: gap.from, levelTo: gap.to, monsterIds: [] }
  grindConfig.value.segments = [...segs, seg]
  sortSegments()
  segEditingIdx.value = segIndex(seg)
  saveGrindConfig()
}

function removeSegment(si: number) {
  grindConfig.value.segments = (grindConfig.value.segments ?? []).filter((_, i) => i !== si)
  // 越界钳回末尾；删空时回到 0（绝不置 -1——否则其他路径在段非空时仍会取到越界下标）
  if (segEditingIdx.value !== null && segEditingIdx.value >= (grindConfig.value.segments ?? []).length) {
    segEditingIdx.value = Math.max(0, (grindConfig.value.segments ?? []).length - 1)
  }
  saveGrindConfig()
}

// 恢复某段为 B 表默认组合：按该段等级范围从 B 表重新推导（可能拆成多段），其余段不动
function restoreSegmentDefault(si: number) {
  const segs = grindConfig.value.segments ?? []
  const seg = segs[si]
  if (!seg) return
  const derived = segmentsFromBestCombos(seg.levelFrom, seg.levelTo)
  const next = [...segs.filter((_, i) => i !== si), ...derived]
    .sort((a, b) => a.levelFrom - b.levelFrom || a.levelTo - b.levelTo)
  grindConfig.value.segments = next
  const ref = derived[0]
  segEditingIdx.value = ref ? next.indexOf(ref) : Math.max(0, next.length - 1)
  saveGrindConfig()
}

// 段内某地区已勾选的怪物群数量（展开头显示；按全部怪物统计——勾选可能含段窗口外群）
function segAreaCheckedCount(seg: GrindSegment, area: string, monsters: GrindMonster[] = grindMonsterList.value): number {
  return monsters.filter(r => r.area === area && seg.monsterIds.includes(r.id)).length
}

// 段编辑弹窗怪物列表：段刷怪范围 [段起−7, 段止+8] 内有合格群的地图的**全部**合格群
// （2026-08-23 与 B 表编辑弹层同口径：窗口外灰显可勾、升级到相邻等级后可打）
const segmentEditMonsters = computed<GrindMonster[]>(() => {
  const seg = grindSegments.value[activeSegIdx.value]
  if (!seg) return []
  const from = seg.levelFrom
  const to = seg.levelTo
  const qualified = (m: GrindMonster) => m.fatigue > 0 && m.baseExp > 0 && monsterEfficiency(m) > 0
  const areas = new Set(grindMonsterList.value
    .filter(m => qualified(m) && m.level >= from - 7 && m.level <= to + 8)
    .map(m => m.area))
  if (areas.size === 0) return []
  return grindMonsterList.value
    .filter(m => qualified(m) && areas.has(m.area))
    .sort((a, b) => a.level - b.level || a.id - b.id)
})
const segmentEditAreas = computed<string[]>(() => {
  const areas: string[] = []
  for (const r of segmentEditMonsters.value) if (!areas.includes(r.area)) areas.push(r.area)
  return areas
})
// 群是否在段衰减窗口 [段起−7, 段止+8] 内（窗口外灰显：本级无经验，升级到相邻等级后可打）
function segMonsterInWindow(m: Pick<GrindMonster, 'level'>, seg: GrindSegment): boolean {
  return m.level >= seg.levelFrom - 7 && m.level <= seg.levelTo + 8
}

// 主面板分段摘要：每段一行（起止等级 + 各勾选地图的群数），供只读展示
const grindSegmentSummaries = computed(() =>
  grindSegments.value.map(seg => {
    const gidSet = new Set(seg.monsterIds)
    const byArea = new Map<string, number>()
    for (const r of grindMonsterList.value) {
      if (gidSet.has(r.id)) byArea.set(r.area, (byArea.get(r.area) ?? 0) + 1)
    }
    const maps = [...byArea].map(([area, count]) => ({ area, count }))
    return { seg, maps }
  }),
)

// 面板结果（以起始等级为快照、首日星期配置展示；逐天模拟按当天起始等级/星期另算）
const grindStartWeekday = computed(() =>
  ecStartWeekday.value > 0 ? ecStartWeekday.value : (new Date().getDay() || 7),
)
// 首日（起始星期）当天的打怪配置，供面板展示与计算
const grindToday = computed(() => {
  const wd = grindStartWeekday.value - 1
  return {
    hours: grindConfig.value.dailyHours[wd] ?? 0,
    doubleExp: !!grindConfig.value.doubleExpDays[wd],
    qiXin: !!grindConfig.value.qiXinDays[wd],
  }
})
const grindResult = computed<GrindCalcResult>(() =>
  dailyGrindExp(grindConfig.value, grindMonsterList.value, ecStartLevel.value, getTotalBonusRate(ecStartLevel.value),
    grindToday.value.hours, {
      doubleExp: grindToday.value.doubleExp,
      qiXin: grindToday.value.qiXin,
      // 衰减率全局共享（不随方案切换）
      decayRates: ecDecayRates.value,
      // 首日预览按起始日剩余疲劳计算（起始系统疲劳/大疲劳缺省 = 满额）；加成道具按第 1 天生效值
      remainingSystemFatigue: grindStartSystemFatigue.value,
      remainingBigFatigue: grindStartBigFatigue.value,
      bonusMult: bonusMultsOnDay(enabledBonusItems.value, 1).grindMult,
    }),
)
// 疲劳消耗总量 = 目标地图怪物群的效率之和（PL/小时，含无经验群——打怪即耗疲劳）
const grindTotalEfficiency = computed(() =>
  Math.round(grindResult.value.burnPerHour),
)
// 已配置打怪：任一等级段勾选了怪物群且至少有一天设置了时长（面板首日可能恰好为 0 但周内其他天 >0）
const grindActive = computed(() =>
  (grindConfig.value.segments ?? []).some(s => (s.monsterIds ?? []).length > 0) &&
    grindConfig.value.dailyHours.some(h => (Number(h) || 0) > 0),
)

// ── 方案持久化 ──
const PRESETS_KEY = 'exp_calc_presets'
const SHARED_KEY = 'exp_calc_shared'

async function savePresets() {
  const cleaned = ecPresets.value.map(p => ({
    ...p,
    completions: filterNonZero(p.completions),
    itemCounts: filterNonZero(p.itemCounts),
  }))
  await window.electronAPI.setSetting(PRESETS_KEY, JSON.stringify(cleaned))
}

async function saveShared() {
  await window.electronAPI.setSetting(SHARED_KEY, JSON.stringify({
    multipliers: ecMultipliers.value,
    itemMultipliers: ecItemMultipliers.value,
    accelEnabled: ecAccelEnabled.value,
    wangchengBonus: ecWangchengBonus.value,
    accelTiers: accelTiers.value,
    decayRates: ecDecayRates.value,        // 打怪衰减率（2026-08-27 起全局共享，不随方案切换）
    rateTaskOrder: rateTaskOrder.value,  // 倍率弹窗任务列拖拽顺序（2026-08-27）
    rateItemOrder: rateItemOrder.value,  // 倍率弹窗道具列拖拽顺序（2026-08-27）
  }))
}

function filterNonZero(obj: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(obj)) { if (v > 0) out[k] = v }
  return out
}

// save 函数：方案数据走 savePresets，共享数据走 saveShared
async function saveEcItems() { await savePresets() }
async function saveEcAccel() { await saveShared() }
async function saveEcCompletions() { await savePresets() }

async function loadPresets() {
  try {
    const raw = await window.electronAPI.getSetting(PRESETS_KEY)
    if (raw) {
      ecPresets.value = JSON.parse(raw)
      // 向后兼容：旧预设可能没有 startProgress
      for (const p of ecPresets.value) {
        if (p.startProgress === undefined) p.startProgress = 0
      }
    }
    // 迁移 2026-08-19 前的全局打怪配置（GRIND_KEY）：作为各方案 grind 的种子，此后每方案独立保存
    let legacyGrind: GrindConfig | undefined
    try {
      const legacyRaw = await window.electronAPI.getSetting(GRIND_KEY)
      if (legacyRaw) legacyGrind = sanitizeGrindConfig(migrateGrindRaw(JSON.parse(legacyRaw), monsterExpData.value))
    } catch { /* 无旧配置或解析失败：各方案用默认配置 */ }
    // 迁移 2026-08-20 前的全局起始星期（SHARED_KEY.startWeekday）：作为各方案 startWeekday 的种子
    // （旧值 0 = 今天占位，现由 ecStartWeekday getter 兼容解析为"动态当天"，不迁移写死）
    let legacyStartWeekday: number | undefined
    const sharedRaw = await window.electronAPI.getSetting(SHARED_KEY)
    let sharedHasDecayRates = false
    if (sharedRaw) {
      const s = JSON.parse(sharedRaw)
      ecMultipliers.value = s.multipliers ?? {}
      ecItemMultipliers.value = s.itemMultipliers ?? {}
      ecAccelEnabled.value = s.accelEnabled ?? true
      ecWangchengBonus.value = s.wangchengBonus ?? 0
      if (s.accelTiers) accelTiers.value = sanitizeAccelTiers(s.accelTiers)
      if (s.decayRates) { ecDecayRates.value = sanitizeDecayRates(s.decayRates); sharedHasDecayRates = true }
      if (Array.isArray(s.rateTaskOrder)) rateTaskOrder.value = s.rateTaskOrder.filter((x: unknown): x is string => typeof x === 'string')
      if (Array.isArray(s.rateItemOrder)) rateItemOrder.value = s.rateItemOrder.filter((x: unknown): x is string => typeof x === 'string')
      if (s.startWeekday !== undefined) legacyStartWeekday = Math.min(7, Math.max(0, s.startWeekday))
    } else {
      // 迁移旧格式
      const [mult, accel, itemMult] = await Promise.all([
        window.electronAPI.getSetting('exp_calc_multipliers'),
        window.electronAPI.getSetting('exp_calc_accel_enabled'),
        window.electronAPI.getSetting('exp_calc_item_multipliers'),
      ])
      if (mult) ecMultipliers.value = JSON.parse(mult)
      if (itemMult) ecItemMultipliers.value = JSON.parse(itemMult)
      if (accel !== null) ecAccelEnabled.value = accel === '1'
      if (mult || itemMult || accel !== null) await saveShared()
    }
    for (const p of ecPresets.value) {
      const g = sanitizeGrindConfig(migrateGrindRaw(p.grind ?? legacyGrind, monsterExpData.value))
      // 2026-08-23 全局勾选移除：旧配置无等级段时，monsterIds 转为单段 [起始, 目标]（勾选沿用，防旧方案丢失）
      if ((g.segments ?? []).length === 0 && (g.monsterIds ?? []).length > 0) {
        g.segments = [{ levelFrom: p.startLevel, levelTo: p.targetLevel, monsterIds: g.monsterIds ?? [] }]
      }
      p.grind = g
      if (p.startWeekday === undefined && legacyStartWeekday !== undefined) p.startWeekday = legacyStartWeekday
    }
    // 迁移 2026-08-27：打怪衰减率改为全局共享——旧数据分散在各方案 grind.decayRates，
    // 全局无设定时取首个改了衰减率的方案的值为种子（各方案一致则保持默认表）
    if (!sharedHasDecayRates) {
      for (const p of ecPresets.value) {
        const rates = sanitizeDecayRates(p.grind?.decayRates)
        if (JSON.stringify(rates) !== JSON.stringify(DEFAULT_DECAY_RATES)) {
          ecDecayRates.value = rates
          await saveShared()
          break
        }
      }
    }
  } catch { /* use defaults */ }
}

// ── 方案管理 ──
function addPreset() {
  const p = makeDefaultPreset()
  // 新方案继承当前打怪配置与起始星期（深拷贝防共享），勾选/道具数从零开始；
  // 等级段默认按新方案 [起始, 目标] 套用 B 表每级最优组合推导（2026-08-23：打怪经验默认
  // 即按经验表 B 的最优打怪群组合按等级段勾选）；B 表无候选时回退按起始等级单段勾选，
  // 仍无候选则保留继承的等级段
  const g = sanitizeGrindConfig(grindConfig.value)
  const segs = segmentsFromBestCombos(p.startLevel, p.targetLevel)
  if (segs.length > 0) {
    g.segments = segs
  } else {
    const combo = bestGrindComboGroupsFor(p.startLevel)
    if (combo.length > 0) g.segments = [{ levelFrom: p.startLevel, levelTo: p.targetLevel, monsterIds: combo.map(m => m.id) }]
  }
  p.grind = g
  // 起始星期默认"今天"（动态跟随当天，makeDefaultPreset 已置 0），不继承当前方案的固定星期
  // 加成道具启用勾选随方案（2026-08-23 起）：新方案继承当前方案实际生效的勾选（定义仍全局共享）
  p.bonusEnabled = Object.fromEntries(
    bonusItems.value.filter(b => bonusItemEnabled(b.id)).map(b => [b.id, true]),
  )
  ecPresets.value = [...ecPresets.value, p]
  ecActiveIdx.value = ecPresets.value.length - 1
  savePresets()
}

function deletePreset(idx: number) {
  if (ecPresets.value.length <= 1) return
  // 删除方案二次确认（2026-08-23 起，防止误删整份方案配置）
  if (!confirm(`确定删除方案「${presetTitle(ecPresets.value[idx])}」？此操作不可撤销。`)) return
  ecPresets.value = ecPresets.value.filter((_, i) => i !== idx)
  if (ecActiveIdx.value >= ecPresets.value.length) ecActiveIdx.value = ecPresets.value.length - 1
  savePresets()
}

function switchPreset(idx: number) {
  ecActiveIdx.value = idx
  // 不重置 ecShowAllItems：面板常开 + 取消勾选保留数量的语义下，切方案保持列表展开状态
}

// 方案标题：自动取起始等级升目标等级（如 80升100），随等级输入同步更新
function presetTitle(p: EcPreset): string {
  return `${p.startLevel}升${p.targetLevel}`
}

// 所有任务列表（按类型分类，用于倍率弹窗；type 优先，无则按 days 推断）
const ecAllTasks = computed(() => activeTaskPool.value)
const ecDailyAllTasks = computed(() => ecAllTasks.value.filter(a => taskTypeOf(a) === 'daily'))
const ecSomeDayAllTasks = computed(() => ecAllTasks.value.filter(a => taskTypeOf(a) === 'some'))
const ecWeeklyAllTasks = computed(() => ecAllTasks.value.filter(a => taskTypeOf(a) === 'weekly'))

// 任务倍率 tab：排除已配置等级段倍率的任务（它们归「等级段倍率」tab 管理）
const ecDailyAllTasksNoLevelMult = computed(() => ecDailyAllTasks.value.filter(t => !hasLevelMult(t.id)))
const ecSomeDayAllTasksNoLevelMult = computed(() => ecSomeDayAllTasks.value.filter(t => !hasLevelMult(t.id)))
const ecWeeklyAllTasksNoLevelMult = computed(() => ecWeeklyAllTasks.value.filter(t => !hasLevelMult(t.id)))

// ── 倍率弹窗任务 tab：搜索过滤 + 分组折叠 ──
const rateFilter = ref('')
function filterRateList<T extends { name: string }>(list: T[]): T[] {
  const kw = rateFilter.value.trim().toLowerCase()
  if (!kw) return list
  return list.filter(t => t.name.toLowerCase().includes(kw))
}

// ── 倍率弹窗拖拽排序（2026-08-27）：任务/道具两列支持拖拽改序，顺序持久化在 exp_calc_shared ──
// 通用拖拽排序器：getOrderedIds 返回当前完整展示顺序（无搜索过滤时 = 全量），drop 后交给 commit 持久化
function makeDragSort(getOrderedIds: () => string[], commit: (ids: string[]) => void) {
  const dragId = ref<string | null>(null)
  const dragOverId = ref<string | null>(null)
  const onDragStart = (e: DragEvent, id: string) => {
    dragId.value = id
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', id)
    }
  }
  const onDragEnd = () => { dragId.value = null; dragOverId.value = null }
  const onDragOver = (e: DragEvent, id: string) => {
    if (dragId.value && dragId.value !== id) {
      dragOverId.value = id
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    }
  }
  const onDragLeave = (id: string) => { if (dragOverId.value === id) dragOverId.value = null }
  const onDrop = (targetId: string) => {
    if (!dragId.value || dragId.value === targetId) return
    const ids = getOrderedIds()
    const from = ids.indexOf(dragId.value)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return
    ids.splice(from, 1)
    ids.splice(to, 0, dragId.value)
    commit(ids)
    dragId.value = null
    dragOverId.value = null
  }
  return { dragId, dragOverId, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop }
}

// 自定义顺序（id 列表；已删除的任务/道具 id 残留无害，展示时按未知排末尾）
const rateTaskOrder = ref<string[]>([])
const rateItemOrder = ref<string[]>([])

function applyRateOrder<T extends { id: string }>(list: T[], order: string[]): T[] {
  if (order.length === 0) return list
  const idx = new Map(order.map((id, i) => [id, i]))
  return [...list].sort((a, b) => (idx.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (idx.get(b.id) ?? Number.MAX_SAFE_INTEGER))
}

const rateTaskDrag = makeDragSort(
  () => filteredRateTasks.value.map(t => t.id),
  ids => { rateTaskOrder.value = ids; saveShared() },
)
const rateItemDrag = makeDragSort(
  () => filteredRateItems.value.map(i => i.id),
  ids => { rateItemOrder.value = ids; saveShared() },
)

// 任务列表合并展示：每天 → 某几天 → 每周（类型顺序），再按用户拖拽的自定义顺序重排
const filteredRateTasks = computed(() => applyRateOrder(filterRateList([
  ...ecDailyAllTasksNoLevelMult.value,
  ...ecSomeDayAllTasksNoLevelMult.value,
  ...ecWeeklyAllTasksNoLevelMult.value,
]), rateTaskOrder.value))
const filteredRateItems = computed(() => applyRateOrder(filterRateList(allExpItems.value), rateItemOrder.value))

// 可用任务：按等级过滤，展示完整任务列表（不按今天开放过滤，今天不开放的以「今日不开」标记）
const ecAvailableTasks = computed(() => {
  return activeTaskPool.value.filter(a =>
    a.minLevel <= ecStartLevel.value &&
    (a.maxLevel || 999) >= ecStartLevel.value
  )
})

// 任务按类型排序（每天 → 某几天 → 每周），统一在一个列表中展示
// 倍率为 0 的任务无经验贡献，未勾选的隐藏（已勾选的仍展示，便于查看完整勾选状态）
const ecAllTasksChips = computed(() => {
  const shown = (a: ActivityDef) => {
    const checked = (ecCompletions.value[a.id] ?? 0) > 0
    return checked || getEffectiveTaskMultiplier(a.id, ecStartLevel.value) > 0
  }
  return [
    ...ecAvailableTasks.value.filter(a => taskTypeOf(a) === 'daily' && shown(a)),
    ...ecAvailableTasks.value.filter(a => taskTypeOf(a) === 'some' && shown(a)),
    ...ecAvailableTasks.value.filter(a => taskTypeOf(a) === 'weekly' && shown(a)),
  ]
})

// 已选中的任务
const ecActiveAllTasks = computed(() => ecAllTasksChips.value.filter(a => (ecCompletions.value[a.id] ?? 0) > 0))

// 任务类型小标：每天不显示；某几天显示周几；每周显示周几+每周上限
function taskTypeBadge(t: ActivityDef): string {
  const type = taskTypeOf(t)
  if (type === 'daily') return ''
  const wd = weekDaysText(t.days)
  if (type === 'weekly') {
    const max = t.maxCompletions ?? 1
    return `🗓 ${wd}${max > 1 ? '×' + max : ''}`
  }
  return `📅 ${wd}`
}

// 经验道具排序：倍率设置中拖出的自定义顺序（2026-08-27 起与倍率弹窗共用同一顺序，
// 拖拽后立即作用于面板展示）；无自定义顺序时回退旧逻辑——勾选中或曾勾选过的道具排最前
// （按历史记录顺序），其余按固定顺序在后，方便恢复时查找
const ecSortedItems = computed(() => {
  if (rateItemOrder.value.length > 0) return applyRateOrder(allExpItems.value, rateItemOrder.value)
  const usedSet = new Set(expItemUsed.value)
  if (usedSet.size === 0) return [...allExpItems.value]
  return [
    ...allExpItems.value.filter(i => usedSet.has(i.id)),
    ...allExpItems.value.filter(i => !usedSet.has(i.id)),
  ]
})

// 已勾选启用的道具数（面板计数；取消勾选但数量保留的道具不计入"在用"）
const ecActiveItemCount = computed(() => allExpItems.value.filter(item => isEcItemSelected(item.id)).length)

// 经验道具中已勾选启用（参与模拟）的
const ecActiveItems = computed(() => allExpItems.value.filter(item => isEcItemSelected(item.id)))

// 加载经验数据（复用 exp-table IPC）
async function loadEcExpData() {
  try {
    const rows = await window.electronAPI.getAllExp()
    if (rows && Array.isArray(rows) && rows.length > 0) {
      ecExpData.value = rows as ExpRow[]
    }
  } catch (e) {
    console.warn('loadEcExpData failed:', e)
  }
}

function findExpRow(level: number): ExpRow | undefined {
  return ecExpData.value.find(r => r.level === level)
}

// 逐天明细
interface EcDayRow {
  day: number
  startLevel: number
  endLevel: number
  dailyExp: number
  grindExp: number
  cumulativeExp: number
  leveledUp: boolean
  progressText: string    // "24.7%"（不显示具体经验值）
  progressPct: number     // 0-100
  carryExp: number        // 供点击回设用
  grindAreas: string[]    // 当天刷怪地图（跨级升级日取各等级目标地图并集；无有效刷怪为空数组）
  bonusExpiring: string[] // 当天到期的加成道具（名称列表，天数列 title 提示）
}

// 模拟终止原因：达标 / 5 年安全上限未达 / 经验表数据不足（模拟不截断零经验日，完整跑完 MAX_DAYS）
type EcSimStop = 'reached' | 'cap' | 'noExpRow'

const ecSimResultRaw = computed<{ rows: EcDayRow[]; stop: EcSimStop }>(() => {
  if (ecTargetLevel.value <= ecStartLevel.value) return { rows: [], stop: 'reached' }
  if (ecSelectedTasks.value.size === 0 && ecActiveItems.value.length === 0 && bonusUseActiveCount.value === 0 && !grindActive.value) return { rows: [], stop: 'reached' }

  // ── 本次模拟的静态依赖只准备一次（1825 天循环内复用，避免每天重建/线性查找；5 年模拟卡顿根因）──
  const expTable = ecExpData.value.map((row) => ({ level: row.level, exp: row.exp, sue: row.standard_unit_exp }))
  const expRowMap = new Map(ecExpData.value.map((row) => [row.level, row]))
  const expMap = new Map(expTable.map((r) => [r.level, r])) // 供 settleDay 跳过每天重建（152 项 × 1825 天）
  const taskMap = new Map(activeTaskPool.value.map((t) => [t.id, t]))
  const itemsList = allExpItems.value
  const itemBaseMult = new Map(itemsList.map((i) => [i.id, i.baseMultiplier]))
  const userItemMult = ecItemMultipliers.value
  // 打怪速率按（等级, 总倍率, 双倍）缓存：一次模拟内等级只变 ~40 次，避免每天重复全量扫描怪物群
  const grindRateCache = new Map<string, GrindRates>()
  const grindRatesOf = (lv: number, tbr: number, dbl: boolean): GrindRates => {
    const key = `${lv}|${tbr}|${dbl ? 1 : 0}`
    let rr = grindRateCache.get(key)
    if (!rr) { rr = grindRatesAtLevel(grindConfig.value, grindMonsterList.value, lv, tbr, { doubleExp: dbl, decayRates: ecDecayRates.value }); grindRateCache.set(key, rr) }
    return rr
  }
  // 当天任务可用次数只依赖星期几（任务可用日/每周限次与周数无关）→ 预构建 7 份，循环内按 dow 直接取
  const tasksByDow = new Map<number, { id: string; count: number }[]>()
  for (let d = 1; d <= 7; d++) {
    const list: { id: string; count: number }[] = []
    for (const id of ecSelectedTasks.value) {
      const t = taskMap.get(id)
      if (!t) continue
      const count = taskCountOnDay(t, d)
      if (count > 0) list.push({ id, count })
    }
    tasksByDow.set(d, list)
  }
  // 倍率按等级缓存（等级段内不变）：总倍率 ~40 个等级；任务倍率按等级重建整张表（28 任务 × ~40 等级）
  const tbrCache = new Map<number, number>()
  const tbrOf = (lv: number): number => {
    let v = tbrCache.get(lv)
    if (v === undefined) { v = getTotalBonusRate(lv); tbrCache.set(lv, v) }
    return v
  }
  let taskMultLevel = -1
  let taskMultByLevel: Record<string, number> = {}
  const taskMultOf = (id: string, lv: number): number => {
    if (lv !== taskMultLevel) {
      taskMultLevel = lv
      const rec: Record<string, number> = {}
      for (const tid of ecSelectedTasks.value) rec[tid] = getEffectiveTaskMultiplier(tid, lv)
      taskMultByLevel = rec
    }
    return taskMultByLevel[id] ?? 0
  }
  const itemMultOf = (id: string): number => userItemMult[id] ?? itemBaseMult.get(id) ?? 0

  const rows: EcDayRow[] = []
  let currentLevel = ecStartLevel.value
  // 初始进度
  let carryExp = 0
  const firstRow = expRowMap.get(currentLevel)
  if (firstRow && ecStartProgress.value > 0) {
    carryExp = Math.floor(firstRow.exp * ecStartProgress.value / 100)
  }
  let totalEarned = 0
  let day = 0
  const MAX_DAYS = 365 * 5  // 安全上限（5 年），防止死循环；达上限仍未到目标等级时按 cap 显示
  // 起始星期：1-7=固定周一到周日；未设置时 ecStartWeekday getter 动态返回当天所在星期
  const startWeekday = ecStartWeekday.value
  // 本周剩余刷怪/齐心上限（分钟）与大疲劳剩余（疲劳点）：按自然周重置——每周一 0 点恢复满额；
  // 起始日所在周大疲劳剩余取起始日剩余（缺省 = 满额，本周已消耗部分由起始设置弥补）
  let weekRemainGrind = WEEKLY_GRIND_MIN_CAP
  let weekRemainQiXin = WEEKLY_QIXIN_MIN_CAP
  let weekRemainBigFatigue = grindStartBigFatigue.value
  let stop: EcSimStop = 'reached'

  while (currentLevel < ecTargetLevel.value && day < MAX_DAYS) {
    day++
    const dow = ((startWeekday - 1 + (day - 1)) % 7) + 1 // 当天星期（1-7）
    const startLevel = currentLevel // 当天起始等级（升级中途来源按新等级重计价，见 settleDay）
    const expRow = expRowMap.get(currentLevel)
    if (!expRow) { stop = 'noExpRow'; break }

    // 周上限额度按自然周跨天累计：每周一（当天为周一，day 1 除外）0 点恢复满额
    if (day > 1 && dow === 1) {
      weekRemainGrind = WEEKLY_GRIND_MIN_CAP
      weekRemainQiXin = WEEKLY_QIXIN_MIN_CAP
      weekRemainBigFatigue = grindConfig.value.bigFatigueCap ?? DEFAULT_BIG_FATIGUE_CAP
    }

    // 当天任务/道具可用次数（任务按星期可用性，道具按天分布）；未勾选启用的道具不参与模拟
    const tasks = tasksByDow.get(dow)! // 预构建的任务列表（按星期取；可用次数已在构建时计算）
    const items: { id: string; count: number; mult?: number }[] = []
    for (const item of itemsList) {
      if (!isEcItemSelected(item.id)) continue
      const count = itemCountOnDay(item, day)
      if (count > 0) items.push({ id: item.id, count })
    }
    // 次数型加成道具（祝福语等）：当天未过期且方案配了次数才吃；mult 覆盖道具倍率
    const bm = bonusMultsOnDay(enabledBonusItems.value, day)
    for (const u of bonusUseItemsOnDay(enabledBonusItems.value, day)) {
      // 次数：方案显式设置优先；未设置时回退内置默认次数（祝福语 1440 = 每分钟一次）
      const count = ecItemCounts.value[u.id] ?? bonusDefaultCounts.value.get(u.id) ?? 0
      if (count > 0) items.push({ id: u.id, count, mult: u.mult })
    }

    // 单日结算：任务 → 道具 → 打怪 顺序累计；任一来源跨过升级线时立刻升级，
    // 剩余任务/道具按新等级标准单位经验 × 新等级封印加速倍率、打怪按新等级衰减率重新计价
    const r = settleDay({
      level: startLevel,
      targetLevel: ecTargetLevel.value,
      carryExp,
      expTable,
      expMap,
      grindRates: grindRatesOf,
      totalBonusRate: tbrOf,
      taskMult: taskMultOf,
      itemMult: itemMultOf,
      taskBonusMults: bm.taskMults,
      itemBonusMult: bm.itemMult,
      grindBonusMult: bm.grindMult,
      tasks,
      items,
      grind: {
        config: grindConfig.value,
        monsters: grindMonsterList.value,
        hours: grindConfig.value.dailyHours[dow - 1] ?? 0,
        doubleExp: !!grindConfig.value.doubleExpDays[dow - 1],
        qiXin: !!grindConfig.value.qiXinDays[dow - 1],
      },
      remainingGrindMin: weekRemainGrind,
      remainingQiXinMin: weekRemainQiXin,
      remainingBigFatigue: weekRemainBigFatigue,
      // 起始日剩余系统疲劳仅第 1 天生效（当天已消耗一部分可调低）；之后每天 0 点刷新恢复满额 380
      remainingSystemFatigue: day === 1 ? grindStartSystemFatigue.value : undefined,
    })
    weekRemainGrind = r.remainingGrindMin
    weekRemainQiXin = r.remainingQiXinMin
    weekRemainBigFatigue = r.remainingBigFatigue
    const { dailyExp, grindExp } = r

    // 当天到期的加成道具（到期日 = 开始天数 + 剩余天数 - 1，次日失效）
    const expiring = bonusItems.value.filter(b => bonusItemEnabled(b.id) && b.startDay + b.startRemainDays - 1 === day).map(b => b.name)

    if (dailyExp <= 0) {
      // 当日无经验收入，跳过（不截断：无来源的日也保留在明细里，超长期由表头提醒提示）
      rows.push({
        day, startLevel, endLevel: startLevel, dailyExp, grindExp, cumulativeExp: totalEarned,
        leveledUp: false, progressText: '—', progressPct: 0, carryExp, grindAreas: [], bonusExpiring: expiring,
      })
      continue
    }

    totalEarned += dailyExp
    carryExp = r.carryExp
    currentLevel = r.endLevel

    const currentNeeded = expRowMap.get(Math.min(currentLevel, ecTargetLevel.value - 1))?.exp ?? 1
    const pct = Math.min(100, Math.round((carryExp / currentNeeded) * 1000) / 10)

    // 当天刷怪地图：升级日两段（升级前/后等级）都可能刷怪，取目标地图并集；无有效刷怪分钟为空
    const grindAreas: string[] = []
    if (r.grindMinutes > 0) {
      const seen = new Set<string>()
      const lvls = r.endLevel > startLevel ? [startLevel, r.endLevel] : [startLevel]
      for (const lv of lvls) {
        const area = grindRatesOf(lv, 1, false).targetArea // 显示用速率（总倍率按 1 计算，targetArea 与倍率无关）
        if (area) seen.add(area)
      }
      grindAreas.push(...seen)
    }

    rows.push({
      day,
      startLevel,
      endLevel: currentLevel,
      dailyExp,
      grindExp,
      cumulativeExp: totalEarned,
      leveledUp: r.leveledUp,
      progressText: `${pct}%`,
      progressPct: pct, // 真实进度；升级行由背景色标记，条不强制满
      carryExp,
      grindAreas,
      bonusExpiring: expiring,
    })
  }
  // while 正常退出但未达标（day 达到 5 年安全上限）→ cap；达标（reached）/ 提前终止（stuck/noExpRow）保持原值
  if (currentLevel < ecTargetLevel.value && stop === 'reached') stop = 'cap'
  return { rows, stop }
})

// 逐天明细行（模板循环用；重量级模拟只算一次，派生只读）
const ecDayRows = computed<EcDayRow[]>(() => ecSimResult.value.rows)
// 模拟终止原因（表头显示：预计天数 / 5 年上限未达 / 经验来源耗尽 / 经验表数据不足）
const ecSimStop = computed(() => ecSimResult.value.stop)

// 总天数（表头数值；仅 stop = reached 时展示）
const ecTotalDays = computed(() => {
  return ecSimResult.value.rows.length + ' 天'
})

// 超长期（超过 5 年仍未达标 = 5 年模拟上限内 stop = cap；以及经验表数据不足 noExpRow）：
// 不展开逐天明细，只显示摘要 + 提醒（模拟本身完整跑完不截断）
const ecSimHideTable = computed(() => ecSimResult.value.stop !== 'reached')
// 摘要的天数表述（明确、不矛盾）：5 年上限未达 → 「超过 N 天（第 N 天仍为 X 级）」；经验表不足 → 「无法达到目标等级（…）」
const ecSimEstimateText = computed(() => {
  const { rows, stop } = ecSimResult.value
  if (rows.length === 0) return ''
  const n = rows.length
  const lastLvl = rows[rows.length - 1]?.endLevel ?? ecStartLevel.value
  if (stop === 'cap') return `超过 ${n} 天（5 年模拟到第 ${n} 天仍为 ${lastLvl} 级，未达 ${ecTargetLevel.value} 级）`
  return `无法达到目标等级（经验表数据不足，模拟到第 ${n} 天为 ${lastLvl} 级）`
})
// 提醒文案（随摘要显示；每日经验由任务/道具/打怪的固定配置决定）
const ecSimLongHint = computed(() => {
  return `属超长期目标——每日经验由任务/道具/打怪的固定配置决定，可核对 ⚙ 倍率设置、打怪时长、加成道具，或将目标等级拆分成多个阶段`
})

// 点击明细行：将起始等级设为该行状态
function setStartFromDay(row: EcDayRow) {
  const newLevel = row.leveledUp ? row.endLevel : row.startLevel
  const expRow = findExpRow(newLevel)
  const newProgress = expRow && expRow.exp > 0
    ? Math.min(100, Math.round((row.carryExp / expRow.exp) * 100))
    : 0
  if (!confirm(`将起始等级设为 ${newLevel} 级 ${newProgress}%（第 ${row.day} 天）？`)) return
  ecStartLevel.value = newLevel
  ecStartProgress.value = newProgress
}

// ecSelectedTasks 从 ecCompletions 派生（count>0 = 勾选）
const ecSelectedTasks = computed(() => {
  return new Set(Object.keys(ecCompletions.value).filter(id => (ecCompletions.value[id] ?? 0) > 0))
})

// 一键清除已勾选的任务（各方案 completions 清空）
function clearEcTasks() {
  if (ecSelectedTasks.value.size === 0) return
  ecCompletions.value = {}
  saveEcCompletions()
}

// 点击循环：0 → 1 → 2 → ... → max → 0
function cycleEcTask(id: string) {
  const task = activeTaskPool.value.find(a => a.id === id)
  const max = task?.maxCompletions ?? 1
  const cur = ecCompletions.value[id] ?? 0
  const next = cur >= max ? 0 : cur + 1
  if (next === 0) {
    const copy = { ...ecCompletions.value }
    delete copy[id]
    ecCompletions.value = copy
  } else {
    ecCompletions.value = { ...ecCompletions.value, [id]: next }
  }
  saveEcCompletions()
}

// 勾选框：勾选 → 1 次；取消 → 0 次（次数循环仍通过点击文字操作）
function setTaskCheck(id: string, checked: boolean) {
  if (checked) {
    ecCompletions.value = { ...ecCompletions.value, [id]: 1 }
  } else {
    const copy = { ...ecCompletions.value }
    delete copy[id]
    ecCompletions.value = copy
  }
  saveEcCompletions()
}

// 倍率
function setMultiplier(id: string, raw: string) {
  const v = parseFloat(raw)
  if (isNaN(v) || v < 0) return
  ecMultipliers.value = { ...ecMultipliers.value, [id]: v }
}

function setItemMultiplier(id: string, raw: string) {
  const v = parseFloat(raw)
  if (isNaN(v) || v < 0) return
  ecItemMultipliers.value = { ...ecItemMultipliers.value, [id]: v }
}

watch(activeCat, async (cat) => {
  if (cat === 'exp-calc') {
    if (ecExpData.value.length === 0) loadEcExpData()
    // 先加载怪物表再加载方案：loadPresets 需把旧 monsterIds（monsterGroupId 字符串）迁移为行 id
    if (monsterExpData.value.length === 0) await loadMonsterExp()
    await Promise.all([loadPresets(), loadLevelMults(), loadExpItems()])
    await loadBonusItems() // 依赖 presets/items 已加载（迁移 exp_bless 需读各方案 itemCounts）
    // 一次性清理任务池中已不存在任务的残留配置（删除任务后的幽灵勾选/倍率）
    const poolIds = new Set(activeTaskPool.value.map(t => t.id))
    const orphans = [...new Set([
      ...Object.keys(ecMultipliers.value),
      ...Object.keys(levelMults.value),
      ...ecPresets.value.flatMap(p => Object.keys(p.completions)),
    ])].filter(id => !poolIds.has(id))
    if (orphans.length > 0) cleanupTaskConfigs(new Set(orphans))
  }
})

// ── 模拟结果防抖发布（必须放在所有 ecSim* 声明之后：ecSimResultRaw 引用了 ecSelectedTasks 等，
//    immediate watch 在 setup 期间同步求值，放在前面会触发 TDZ ReferenceError 导致整页白屏） ──
// 防抖 150ms 后才对外发布：逐天明细最多上千行 × 6 列，
// 每敲一个键都同步重渲染会把主线程占满，等级/进度这类输入框就跟不上手。
// 下游（ecDayRows / ecSimStop / ecTotalDays / ...）全部读这份快照，摘要与明细保持一致。
const ecSimResult = shallowRef<{ rows: EcDayRow[]; stop: EcSimStop }>({ rows: [], stop: 'reached' })
let ecSimTimer: ReturnType<typeof setTimeout> | undefined
watch(ecSimResultRaw, (v) => {
  clearTimeout(ecSimTimer)
  // 首次/空结果立即出，避免切进标签页时白屏 150ms
  if (ecSimResult.value.rows.length === 0) { ecSimResult.value = v; return }
  ecSimTimer = setTimeout(() => { ecSimResult.value = v }, 150)
}, { immediate: true })

</script>

<style scoped>
.page { height: 100%; display: flex; flex-direction: column; }
.page-head { margin-bottom: 20px; flex-shrink: 0; }
.page-head h2 { font-size: 26px; font-weight: 650; }
.page-head p { color: var(--color-text-secondary); font-size: 13.5px; margin-top: 4px; }

/* 每日活动入口区 */
.daily-acts {
  padding: 14px 16px; margin-bottom: 16px; border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--color-accent-bg), var(--color-surface-1));
  border: 1px solid var(--color-accent); flex-shrink: 0;
}
.daily-acts-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.daily-acts-title { font-size: 15px; font-weight: 650; color: var(--color-accent); }
.daily-acts-sub { font-size: 11.5px; color: var(--color-text-tertiary); }
.daily-act-group { margin-bottom: 10px; }
.daily-act-group:last-child { margin-bottom: 0; }
.daily-act-group-label {
  display: inline-block; font-size: 10.5px; font-weight: 600;
  color: var(--color-text-tertiary); margin-bottom: 8px; padding-left: 2px;
}
.daily-act-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.daily-act-card {
  position: relative; display: flex; flex-direction: column; gap: 2px;
  padding: 10px 12px; border-radius: var(--radius-sm);
  background: var(--color-surface-1); border: 0.5px solid var(--color-border-light);
  text-decoration: none; color: inherit; cursor: pointer;
  transition: transform 0.12s, background 0.12s, border-color 0.12s;
}
.daily-act-card:hover { transform: translateY(-1px); background: var(--color-surface-2); border-color: var(--color-accent); }
.daily-act-icon { font-size: 20px; margin-bottom: 2px; }
.daily-act-name { font-size: 13px; font-weight: 600; color: var(--color-text); }
.daily-act-desc { font-size: 11px; color: var(--color-text-tertiary); line-height: 1.4; }
.daily-act-arrow { position: absolute; top: 8px; right: 10px; font-size: 12px; color: var(--color-text-tertiary); }
.daily-act-card:hover .daily-act-arrow { color: var(--color-accent); }
@media (max-width: 700px) { .daily-act-grid { grid-template-columns: repeat(2, 1fr); } }

/* 删除按钮 */
.daily-act-card-wrap { position: relative; }
.daily-act-delete {
  position: absolute; top: 2px; right: 2px;
  width: 18px; height: 18px; border-radius: 3px;
  font-size: 10px; line-height: 1;
  display: flex; align-items: center; justify-content: center;
  border: none; background: transparent;
  color: var(--color-text-tertiary); cursor: pointer;
  opacity: 0; transition: opacity 0.12s, color 0.12s, background 0.12s;
}
.daily-act-card-wrap:hover .daily-act-delete { opacity: 1; }
.daily-act-delete:hover { color: #e74c3c; background: rgba(231, 76, 60, 0.08); }

/* 添加链接区域 */
.daily-act-add-section { margin-top: 10px; }
.daily-act-add-btn {
  font-size: 12px; font-family: inherit;
  padding: 5px 14px; border-radius: 6px;
  border: 1px dashed var(--color-border-light);
  background: var(--color-surface-1); color: var(--color-text-tertiary);
  cursor: pointer; transition: all 0.12s;
}
.daily-act-add-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }

.daily-act-form {
  display: flex; flex-direction: column; gap: 6px;
  padding: 10px; border-radius: var(--radius-sm);
  border: 1px solid var(--color-accent); background: var(--color-accent-bg);
}
.daily-act-form-row { display: flex; gap: 6px; }
.daily-act-input {
  flex: 1; padding: 5px 8px; font-size: 12px; font-family: inherit;
  border: 1px solid var(--color-border-light); border-radius: 4px;
  background: var(--color-surface-1); color: var(--color-text);
  outline: none; transition: border-color 0.12s;
}
.daily-act-input:focus { border-color: var(--color-accent); }
.daily-act-input--icon { flex: 0 0 56px; text-align: center; }
.daily-act-form-actions { display: flex; gap: 8px; justify-content: flex-end; }
.daily-act-form-submit, .daily-act-form-cancel {
  padding: 4px 14px; border-radius: 4px; font-size: 12px; font-family: inherit;
  cursor: pointer; transition: opacity 0.12s;
}
.daily-act-form-submit {
  border: 1px solid var(--color-accent); background: var(--color-accent); color: #fff;
}
.daily-act-form-submit:hover { opacity: 0.85; }
.daily-act-form-submit:disabled { opacity: 0.4; cursor: not-allowed; }
.daily-act-form-cancel {
  border: 1px solid var(--color-border-light); background: var(--color-surface-1);
  color: var(--color-text-secondary);
}
.daily-act-form-cancel:hover { border-color: var(--color-text-tertiary); }

/* 卡片网格 */
.grid-card {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; padding: 20px 12px; border-radius: var(--radius-md);
  background: var(--color-surface-1); border: 0.5px solid var(--color-border-light);
  cursor: pointer; transition: all 0.15s; min-height: 90px;
}
.grid-card:hover { background: var(--color-surface-2); border-color: var(--color-accent); transform: translateY(-1px); }
.grid-card-icon { font-size: 28px; }
.grid-card-label { font-size: 12.5px; font-weight: 500; color: var(--color-text); text-align: center; }

/* 互动工具卡片高亮 */
.grid-card--featured {
  background: linear-gradient(135deg, var(--color-accent-bg), var(--color-surface-1));
  border-color: var(--color-accent);
  border-width: 1px;
  position: relative;
}
.grid-card--featured:hover {
  background: linear-gradient(135deg, var(--color-accent-bg), var(--color-surface-2));
  border-color: var(--color-accent);
  box-shadow: 0 2px 12px rgba(94, 106, 210, 0.12);
}
.grid-card-badge {
  position: absolute; top: 6px; right: 8px;
  font-size: 9.5px; font-weight: 600; padding: 1px 6px; border-radius: 6px;
  background: var(--color-accent); color: #fff;
  opacity: 0.75; letter-spacing: 0.3px;
}

/* 拖拽排序状态 */
.grid-card--dragging { opacity: 0.45; cursor: grabbing; }
.grid-card--dragover {
  outline: 2px dashed var(--color-accent);
  outline-offset: -2px;
}
.card-grid--dropzone {
  outline: 2px dashed var(--color-accent);
  outline-offset: -2px;
  border-radius: var(--radius-md);
}

/* 移出常用按钮（悬停显示） */
.grid-card { position: relative; }
.grid-card-unfav {
  position: absolute; top: 5px; left: 7px;
  width: 16px; height: 16px; padding: 0;
  display: flex; align-items: center; justify-content: center;
  border: none; border-radius: 50%;
  background: transparent;
  color: var(--color-text-tertiary);
  font-size: 10px; cursor: pointer;
  opacity: 0; transition: all 0.1s;
}
.grid-card:hover .grid-card-unfav { opacity: 1; }
.grid-card-unfav:hover { background: var(--color-surface-3); color: var(--color-danger); }

/* 常用区空状态 */
.card-grid-empty {
  padding: 22px;
  border: 1.5px dashed var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-tertiary);
  font-size: 12.5px;
  text-align: center;
}

/* 攻略卡片网格（4 列） */
.card-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  flex-shrink: 0;
}
.card-grid .grid-card {
  min-height: 72px;
  padding: 14px 12px;
}
.card-grid .grid-card-icon {
  font-size: 22px;
}
.card-grid .grid-card-label {
  font-size: 13px;
  font-weight: 600;
}

/* 展开/折叠栏 */
.card-collapse-bar {
  display: flex; align-items: center; gap: 10px;
  margin-top: 14px; flex-shrink: 0;
}
.card-collapse-btn {
  padding: 5px 14px;
  border: 0.5px dashed var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-1);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.1s;
}
.card-collapse-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-bg);
}
.card-collapse-hint { font-size: 11px; color: var(--color-text-tertiary); }

/* 详情页 */
.detail-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; flex-shrink: 0; }
.detail-head h2 { font-size: 20px; font-weight: 650; }
.back-btn {
  background: var(--color-surface-2); border: 0.5px solid var(--color-border-light);
  border-radius: 6px; padding: 4px 12px; cursor: pointer; font-size: 12.5px;
  color: var(--color-text-secondary); font-family: inherit; transition: all 0.1s;
}
.back-btn:hover { background: var(--color-accent-bg); color: var(--color-accent); }
.content { flex: 1; overflow-y: auto; }
.card { display: flex; flex-direction: column; gap: 10px; }
.guide-card { padding: 16px 18px; background: var(--color-surface-1); border: 0.5px solid var(--color-border-light); border-radius: var(--radius-md); }
.guide-card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.guide-card-head h4 { font-size: 14px; font-weight: 600; }
.guide-body { font-size: 12.5px; color: var(--color-text-secondary); line-height: 1.7; }
.guide-body :deep(a) { color: var(--color-accent); text-decoration: none; }
.guide-body :deep(a:hover) { text-decoration: underline; }
.guide-tags { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
.guide-tag { font-size: 10.5px; padding: 2px 8px; border-radius: 8px; background: var(--color-surface-2); color: var(--color-text-tertiary); }

.badge-sm { font-size: 10.5px; padding: 1px 7px; border-radius: 8px; background: var(--color-accent-bg); color: var(--color-accent); }
.hint { color: var(--color-text-tertiary); text-align: center; padding: 48px 20px; font-size: 12.5px; }

/* 链接卡片 */
.link-group { margin-bottom: 18px; }
.link-group-title { font-size: 12px; font-weight: 600; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; padding-left: 2px; }
.link-card-list { display: flex; flex-direction: column; gap: 4px; }
.link-card {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; border-radius: var(--radius-sm);
  background: var(--color-surface-1); border: 0.5px solid var(--color-border-light);
  text-decoration: none; color: inherit; transition: background 0.12s, border-color 0.12s; cursor: pointer;
}
.link-card:hover { background: var(--color-surface-2); border-color: var(--color-accent); }
.link-card-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.link-card-title { font-size: 13px; font-weight: 500; color: var(--color-text); }
.link-card-desc { font-size: 11.5px; color: var(--color-text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.link-card-arrow { font-size: 14px; color: var(--color-text-tertiary); flex-shrink: 0; margin-left: 12px; transition: color 0.12s; }
.link-card:hover .link-card-arrow { color: var(--color-accent); }

/* ═══════════════════════════════════════════
   答题题库
   ═══════════════════════════════════════════ */
.quiz-wrap {
  display: flex; flex-direction: column; gap: 12px; height: 100%;
}

/* 工具栏 */
.quiz-toolbar {
  display: flex; flex-direction: column; gap: 10px; flex-shrink: 0;
}

/* 搜索栏 */
.quiz-search-bar {
  display: flex; gap: 0;
}
.quiz-search-input {
  flex: 1; border: 1px solid var(--color-border-light);
  border-right: none; border-radius: var(--radius-sm) 0 0 var(--radius-sm);
  padding: 9px 14px; font-size: 13.5px; font-family: inherit;
  color: var(--color-text); background: var(--color-surface-1);
  outline: none; transition: border-color 0.15s;
}
.quiz-search-input:focus { border-color: var(--color-accent); }
.quiz-search-input::placeholder { color: var(--color-text-tertiary); font-size: 12.5px; }
.quiz-search-btn {
  padding: 9px 16px; border: 1px solid var(--color-accent);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  background: var(--color-accent); color: #fff;
  font-size: 13px; font-family: inherit; font-weight: 500;
  cursor: pointer; white-space: nowrap;
  transition: opacity 0.12s;
}
.quiz-search-btn:hover { opacity: 0.88; }

/* 分类筛选 */
.quiz-filters {
  display: flex; gap: 8px; flex-wrap: wrap;
}
.quiz-filter-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 12px; border-radius: 14px;
  font-size: 12px; font-family: inherit; font-weight: 500;
  border: 1px solid var(--color-border-light);
  background: var(--color-surface-1);
  color: var(--color-text-secondary);
  cursor: pointer; transition: all 0.12s;
}
.quiz-filter-chip:hover { border-color: var(--color-accent); color: var(--color-accent); }
.quiz-filter-chip.active {
  background: var(--color-accent); color: #fff; border-color: var(--color-accent);
}
.quiz-filter-count { font-size: 10.5px; opacity: 0.7; }
.quiz-filter-chip.active .quiz-filter-count { opacity: 0.9; }

/* 统计条 */
.quiz-stats {
  font-size: 12.5px; color: var(--color-text-secondary); flex-shrink: 0;
}
.quiz-stats strong { color: var(--color-accent); }

/* 表格 */
.quiz-table-wrap {
  flex: 1; overflow-y: auto; border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-light);
}
.quiz-table {
  width: 100%; border-collapse: collapse; table-layout: fixed;
}
.quiz-table thead {
  position: sticky; top: 0; z-index: 1;
}
.quiz-table th {
  padding: 10px 14px; font-size: 12.5px; font-weight: 600;
  text-align: left; color: var(--color-text-secondary);
  background: var(--color-surface-2);
  border-bottom: 1px solid var(--color-border-light);
}
.quiz-th-q { width: 58%; }
.quiz-th-a { width: 32%; }
.quiz-th-op { width: 72px; }
.quiz-table td {
  padding: 9px 14px; font-size: 13px; line-height: 1.55;
  border-bottom: 0.5px solid var(--color-border-light);
  vertical-align: top;
}
.quiz-table tbody tr { transition: background 0.1s; }
.quiz-table tbody tr:hover { background: var(--color-surface-2); }
.quiz-table tbody tr:last-child td { border-bottom: none; }
.quiz-td-q { color: var(--color-text); word-break: break-all; }
.quiz-td-a {
  color: var(--color-accent); font-weight: 600; word-break: break-all;
}
.quiz-td-op { text-align: center; }
.quiz-op-btn {
  padding: 2px 8px; border: none; background: transparent;
  color: var(--color-text-tertiary); font-size: 11.5px; font-family: inherit;
  border-radius: 6px; cursor: pointer; transition: all 0.1s;
}
.quiz-op-btn:hover { background: rgba(220, 53, 69, 0.12); color: var(--color-danger, #dc3545); }

/* 空状态 */
.quiz-empty { text-align: center; padding: 48px 20px; flex: 1; }
.quiz-empty-icon { font-size: 36px; opacity: 0.6; display: block; margin-bottom: 12px; }
.quiz-empty p { font-size: 14px; color: var(--color-text-secondary); margin: 0; }
.quiz-empty-hint { font-size: 12px; color: var(--color-text-tertiary); margin-top: 8px; }

/* 热门搜索 */
.quiz-hot-tags {
  display: flex; align-items: center; justify-content: flex-start;
  gap: 8px; flex-wrap: wrap; margin: 2px 0 14px;
}
.quiz-hot-label { font-size: 12px; color: var(--color-text-tertiary); }
.quiz-hot-tag {
  padding: 4px 12px; border-radius: 14px; font-size: 12px; font-family: inherit;
  border: 1px solid var(--color-border-light); background: var(--color-surface-1);
  color: var(--color-accent); cursor: pointer; transition: all 0.12s;
}
.quiz-hot-tag:hover { background: var(--color-accent); color: #fff; border-color: var(--color-accent); }

/* ═══════════════════════════════════════════
   升级攻略（可编辑表格）
   ═══════════════════════════════════════════ */
.leveling-wrap {
  display: flex; flex-direction: column; height: 100%; gap: 10px;
}

/* Sheet 标签栏 */
.lv-sheets-bar {
  display: flex; align-items: center; gap: 6px; flex-shrink: 0;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--color-border-light);
}
.lv-sheets-tabs {
  display: flex; align-items: center; gap: 4px; flex: 1; overflow-x: auto;
  scrollbar-width: none;
}
.lv-sheets-tabs::-webkit-scrollbar { display: none; }
.lv-sheet-tab {
  padding: 5px 14px; border-radius: 6px 6px 0 0;
  font-size: 12.5px; font-weight: 500; white-space: nowrap;
  cursor: pointer; user-select: none;
  color: var(--color-text-tertiary);
  border: 1px solid transparent;
  transition: all 0.12s;
}
.lv-sheet-tab:hover {
  color: var(--color-text); background: var(--color-surface-2);
}
.lv-sheet-tab.active {
  color: var(--color-accent); font-weight: 600;
  background: var(--color-accent-bg);
  border-color: var(--color-accent);
  border-bottom-color: transparent;
}
.lv-sheet-rename-input {
  width: 140px; padding: 1px 6px; font-size: 12.5px; font-family: inherit;
  border: 1px solid var(--color-accent); border-radius: 3px;
  color: var(--color-text); background: var(--color-surface-1);
  outline: none;
}
.lv-sheets-actions {
  display: flex; gap: 4px; flex-shrink: 0;
}
.lv-sheet-btn-add,
.lv-sheet-btn-del {
  width: 24px; height: 24px; border-radius: 4px; font-size: 16px;
  font-family: inherit; line-height: 1; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--color-border-light);
  background: var(--color-surface-1);
  color: var(--color-text-tertiary);
  transition: all 0.12s;
}
.lv-sheet-btn-add:hover { border-color: var(--color-accent); color: var(--color-accent); }
.lv-sheet-btn-del:hover { border-color: #e74c3c; color: #e74c3c; }

/* 空 sheet */
.lv-empty-sheet {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 10px;
  padding: 40px 20px; color: var(--color-text-tertiary);
}
.lv-empty-icon { font-size: 36px; opacity: 0.6; }
.lv-empty-sheet p { font-size: 13px; margin: 0; }
.lv-empty-hint { font-size: 12px; opacity: 0.7; }

/* 工具栏 */
.lv-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; flex-shrink: 0; flex-wrap: wrap;
}
.lv-toolbar-left {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.lv-toolbar-right {
  display: flex; align-items: center; gap: 10px; flex-shrink: 0;
}
.lv-edit-hint {
  font-size: 11.5px; color: var(--color-text-tertiary);
  font-weight: 500; white-space: nowrap; margin-right: 4px;
}
.lv-stage-count {
  font-size: 11.5px; color: var(--color-text-tertiary);
  font-weight: 500; white-space: nowrap;
}
.lv-btn {
  padding: 6px 14px; border-radius: 6px; font-size: 12.5px; font-family: inherit;
  font-weight: 500; border: 1px solid var(--color-border-light);
  background: var(--color-surface-1); color: var(--color-text);
  cursor: pointer; transition: all 0.12s; white-space: nowrap;
}
.lv-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }
.lv-btn-reset { color: var(--color-text-tertiary); font-size: 12px; }
.lv-btn-add { border-style: dashed; }

/* 表格容器 */
.leveling-table-wrap {
  flex: 1; overflow: auto; border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-light);
  background: var(--color-surface-1);
}
.leveling-table {
  width: 100%; border-collapse: collapse; table-layout: fixed; min-width: 920px;
}
.leveling-table thead {
  position: sticky; top: 0; z-index: 2;
}
.leveling-table th {
  padding: 10px 10px; font-size: 12.5px; font-weight: 650;
  text-align: left; color: #fff;
  background: var(--color-accent);
  border-right: 1px solid rgba(255,255,255,0.12);
  white-space: nowrap; letter-spacing: 0.5px;
}
.leveling-table th:last-child { border-right: none; }
.lv-th-lv { width: 7%; text-align: center; }
.lv-th-core { width: 16%; }
.lv-th-todo { width: 26%; }
.lv-th-prep { width: 26%; }
.lv-th-tip { width: 18%; }
.lv-th-act { width: 4%; text-align: center; }

.leveling-table td {
  padding: 8px 10px; font-size: 12.5px; line-height: 1.65;
  border-right: 1px solid var(--color-border-light);
  border-bottom: 1px solid var(--color-border-light);
  vertical-align: top; color: var(--color-text-secondary);
}
.leveling-table td:last-child { border-right: none; }

/* 斑马纹 */
.leveling-table tbody tr:nth-child(even) td {
  background: var(--color-surface-2);
}
.leveling-table tbody tr:hover td {
  background: var(--color-accent-bg);
}

/* 等级列 */
.lv-td-lv {
  text-align: center; vertical-align: middle !important;
}
.lv-badge {
  display: inline-block; padding: 4px 12px; border-radius: 10px;
  font-size: 12px; font-weight: 700; white-space: nowrap;
  background: var(--color-accent); color: #fff;
}
.lv-td-core span { color: var(--color-text); font-weight: 500; }
.lv-td-tip span { font-size: 12px; color: var(--color-text-tertiary); font-style: italic; }

/* 有序列表（必做事项） */
.lv-ol {
  margin: 0; padding-left: 18px; list-style: decimal;
}
.lv-ol li {
  font-size: 12.5px; line-height: 1.65; color: var(--color-text-secondary);
  padding: 0; margin: 0;
}
.lv-ol li + li { margin-top: 2px; }

/* 编辑模式输入框 — 与查看模式无缝融合 */
.lv-input, .lv-textarea {
  width: 100%; box-sizing: border-box; padding: 0;
  border: 1px solid transparent; border-radius: 0;
  font-size: 12.5px; font-family: inherit; line-height: 1.65;
  color: var(--color-text-secondary); background: transparent;
  outline: none; resize: vertical;
  transition: border-color 0.15s, background 0.15s;
}
.lv-input:hover, .lv-textarea:hover {
  background: rgba(94, 106, 210, 0.03);
}
.lv-input:focus, .lv-textarea:focus {
  border-bottom-color: var(--color-accent);
  background: rgba(94, 106, 210, 0.04);
}
.lv-input-lv {
  text-align: center; font-weight: 600; width: 70px;
  font-size: 12px; color: #fff;
}
/* 等级段输入框在编辑模式下与badge融合 */
.lv-td-lv .lv-input-lv {
  padding: 4px 12px; border-radius: 10px;
  background: var(--color-accent); color: #fff;
  border: 2px solid transparent;
}
.lv-td-lv .lv-input-lv:focus {
  border-color: rgba(255,255,255,0.5);
  background: var(--color-accent);
  border-bottom-color: rgba(255,255,255,0.5);
}
.lv-textarea { min-height: 40px; }
.lv-textarea::placeholder {
  color: var(--color-text-tertiary); opacity: 0.5; font-style: italic;
}

/* 删除按钮 */
.lv-btn-del {
  padding: 2px 7px; border-radius: 4px; font-size: 13px; font-family: inherit;
  border: 1px solid transparent; background: transparent;
  color: var(--color-text-tertiary); cursor: pointer; transition: all 0.12s;
  line-height: 1;
}
.lv-btn-del:hover { color: #e74c3c; border-color: #e74c3c; background: #e74c3c11; }
.lv-btn-copy {
  padding: 2px 7px; border-radius: 4px; font-size: 13px; font-family: inherit;
  border: 1px solid transparent; background: transparent;
  color: var(--color-text-tertiary); cursor: pointer; transition: all 0.12s;
  line-height: 1; margin-right: 2px;
}
.lv-btn-copy:hover { color: #3b82f6; border-color: #3b82f6; background: #3b82f611; }
.lv-td-act { text-align: center; vertical-align: middle !important; }

/* 响应式 */

/* ═══════════════════════════════════════════
   活跃计算
   ═══════════════════════════════════════════ */
.activity-wrap {
  display: flex; flex-direction: column; height: 100%; gap: 12px;
  overflow-y: auto;
}

/* ── 进度条区域 ── */
.act-progress-section {
  padding: 18px 22px; border-radius: var(--radius-md);
  background: linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 8%, transparent), var(--color-surface-1));
  border: 1px solid color-mix(in srgb, var(--color-accent) 22%, transparent);
  color: var(--color-text); flex-shrink: 0;
}
.act-progress-header {
  display: flex; align-items: baseline; justify-content: space-between;
  margin-bottom: 12px; flex-wrap: wrap; gap: 10px;
}
.act-progress-label { font-size: 13.5px; color: var(--color-text-secondary); }
.act-progress-label strong { font-size: 30px; font-weight: 700; margin: 0 4px; color: var(--color-text); }
.act-progress-remain { font-size: 12.5px; color: var(--color-text-secondary); }
.act-progress-remain strong { font-size: 15px; font-weight: 600; color: var(--color-text); }
.act-progress-done { font-size: 14px; font-weight: 600; color: var(--color-success); }
.act-progress-bar-wrap {
  position: relative; height: 8px; border-radius: 4px;
  background: var(--color-surface-3); margin-bottom: 14px; overflow: visible;
}
.act-progress-bar {
  height: 100%; border-radius: 4px;
  background: linear-gradient(90deg, var(--color-accent), var(--color-accent-hover));
  transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 8px color-mix(in srgb, var(--color-accent) 25%, transparent);
}
.act-progress-bar.full {
  background: linear-gradient(90deg, var(--color-success), #66bb6a);
  box-shadow: 0 0 8px color-mix(in srgb, var(--color-success) 25%, transparent);
}
.act-progress-tier {
  position: absolute; top: -3px; width: 3px; height: 14px;
  border-radius: 1.5px; background: var(--color-text); transform: translateX(-50%);
  transition: opacity 0.2s;
}
.act-progress-tier-1 { opacity: 0.4; }
.act-progress-tier-2 { opacity: 0.65; }
.act-progress-tier-3 { background: var(--color-warning); opacity: 1; }
.act-tier-marker-label {
  position: absolute; top: -15px; left: 50%; transform: translateX(-50%);
  font-size: 9.5px; font-weight: 600; color: var(--color-text-tertiary);
  white-space: nowrap;
}

.act-rewards { display: flex; align-items: center; gap: 6px; font-size: 12.5px; flex-wrap: wrap; }
.act-reward { opacity: 0.5; transition: opacity 0.2s; }
.act-reward.reached { opacity: 1; font-weight: 600; }
.act-reward-sep { opacity: 0.25; color: var(--color-text-tertiary); }
.act-reward-total { margin-left: 4px; opacity: 0.75; color: var(--color-text-secondary); }
.act-reward-total strong { font-size: 14px; color: var(--color-accent); }

/* ── 选择器栏 ── */
.act-selectors {
  display: flex; gap: 12px; align-items: flex-end; flex-shrink: 0; flex-wrap: wrap;
}
.act-selector { display: flex; flex-direction: column; gap: 4px; }
.act-selector label {
  font-size: 11px; font-weight: 600; color: var(--color-text-tertiary);
  text-transform: uppercase; letter-spacing: 0.5px;
}
.act-selector select {
  padding: 7px 34px 7px 12px; border-radius: 6px;
  font-size: 13.5px; font-family: inherit; font-weight: 500;
  border: 1px solid var(--color-border-light);
  background: var(--color-surface-1); color: var(--color-text);
  cursor: pointer; outline: none; appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 10px center;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.act-selector select:hover { border-color: var(--color-text-tertiary); }
.act-selector select:focus { border-color: var(--color-accent); box-shadow: 0 0 0 2px var(--color-accent-ring); }

/* ── 福利任务栏 ── */
/* 工资汇总按钮 */
.act-toolbar-btns {
  display: flex; gap: 6px;
}
.act-wage-btn {
  padding: 7px 14px; border-radius: 6px; font-size: 12px; font-family: inherit; font-weight: 500;
  border: 1px solid var(--color-border-light); background: var(--color-surface-1);
  color: var(--color-text-secondary); cursor: pointer; transition: all 0.15s;
  line-height: 1.4; white-space: nowrap;
}
.act-wage-btn:hover { border-color: var(--color-accent); color: var(--color-accent); background: var(--color-accent-bg); }

/* 工资汇总表格 */
.wage-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.wage-table th {
  padding: 8px 10px; font-size: 11px; font-weight: 600;
  color: var(--color-text-tertiary); text-align: center;
  border-bottom: 1px solid var(--color-border-light);
}
.wage-table td {
  padding: 7px 10px; text-align: center; border-bottom: 0.5px solid var(--color-border-light);
}
.wage-td-lv { font-weight: 600; color: var(--color-text); }
.wage-td-total { font-weight: 650; color: var(--color-accent); }
.wage-row--current { background: var(--color-accent-bg); }
.wage-row--current .wage-td-lv { color: var(--color-accent); }
.wage-td-editable { cursor: pointer; }
.wage-td-editable:hover { background: var(--color-surface-2); }
.wage-val { border-bottom: 1px dashed transparent; }
.wage-td-editable:hover .wage-val { border-bottom-color: var(--color-text-tertiary); }
.wage-input {
  width: 52px; padding: 2px 4px; font-size: 12px; font-family: inherit; font-weight: 500;
  text-align: center; color: var(--color-text);
  background: var(--color-surface-1);
  border: 1px solid var(--color-accent); border-radius: 3px; outline: none;
  -moz-appearance: textfield;
}
.wage-input::-webkit-inner-spin-button,
.wage-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

/* 小弹窗 */
.modal--wage { max-width: 960px; width: auto; }

.act-bonus-bar {
  display: flex; align-items: center; gap: 10px; flex-shrink: 0;
  padding: 9px 14px; border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--color-accent) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-accent) 18%, transparent);
  flex-wrap: wrap;
}
.act-bonus-label { font-size: 12.5px; font-weight: 600; color: var(--color-accent); }
.act-bonus-empty { font-size: 11.5px; color: var(--color-text-tertiary); font-style: italic; }
.act-bonus-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.act-bonus-tag {
  display: inline-flex; align-items: center; gap: 2px;
  padding: 2px 10px; border-radius: 11px; font-size: 11.5px; font-weight: 500;
  background: var(--color-accent); color: #fff;
}
.act-bonus-tag em { font-style: normal; opacity: 0.7; margin-left: 2px; font-size: 10px; }
.act-bonus-remove {
  background: none; border: none; color: inherit;
  cursor: pointer; font-size: 10px; padding: 0 0 0 4px;
  opacity: 0.55; line-height: 1;
}
.act-bonus-remove:hover { opacity: 1; }
.act-bonus-hint { font-size: 11px; color: var(--color-warning); font-weight: 500; }

/* ── 任务网格 ── */
.act-task-grid {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px;
  flex: 1; overflow-y: auto; align-content: start; padding-bottom: 12px;
}
.act-task-card {
  display: flex; flex-direction: column; gap: 3px;
  padding: 7px 9px; border-radius: var(--radius-sm);
  background: var(--color-surface-1);
  border: 1px solid var(--color-border-light);
  transition: all 0.18s; cursor: pointer;
  position: relative;
}
.act-task-card:hover {
  border-color: color-mix(in srgb, var(--color-accent) 30%, transparent);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.act-task-card--bonus {
  background: color-mix(in srgb, var(--color-accent) 6%, transparent);
  border-color: color-mix(in srgb, var(--color-accent) 35%, transparent);
}
.act-task-card--bonus:hover { border-color: var(--color-accent); }
.act-task-card--disabled { opacity: 0.4; pointer-events: none; }
.act-task-card--done {
  border-color: color-mix(in srgb, var(--color-success) 45%, transparent);
  background: color-mix(in srgb, var(--color-success) 4%, transparent);
}
.act-task-card--dragging { opacity: 0.35; transform: scale(0.97); }
.act-task-card--dragover {
  border-top: 2px solid var(--color-accent);
  border-top-left-radius: 0; border-top-right-radius: 0;
}
.act-task-head { display: flex; align-items: center; justify-content: space-between; gap: 3px; }
.act-task-name { font-size: 11px; font-weight: 600; color: var(--color-text); line-height: 1.3; }
.act-task-badge {
  font-size: 8.5px; font-weight: 600; padding: 1px 5px; border-radius: 3px;
  background: var(--color-accent); color: #fff; white-space: nowrap; line-height: 1.4;
}
.act-task-badge--lock { background: var(--color-text-tertiary); }
.act-task-head-right { display: flex; align-items: center; gap: 3px; flex-shrink: 0; }
.act-star-btn {
  background: none; border: none; cursor: pointer;
  font-size: 14px; line-height: 1; padding: 0;
  color: var(--color-text-tertiary);
  opacity: 0.7; transition: opacity 0.12s, transform 0.12s, color 0.12s;
}
.act-star-btn:hover { opacity: 0.85; transform: scale(1.2); }
.act-star-btn.active { opacity: 1; color: #f0c040; }
.act-task-pts { font-size: 10.5px; font-weight: 700; color: var(--color-accent); }
.act-task-card--disabled .act-task-pts { color: var(--color-text-tertiary); }
.act-task-bottom {
  display: flex; align-items: center; justify-content: space-between; gap: 4px;
  margin-top: 1px;
}
.act-task-check {
  display: flex; align-items: center; cursor: pointer;
  user-select: none;
}
.act-task-check.disabled { cursor: not-allowed; opacity: 0.5; }
.act-task-check input[type="checkbox"] {
  width: 11px; height: 11px; cursor: pointer; accent-color: var(--color-accent);
  border-radius: 2px;
}
.act-task-count {
  font-size: 10px; font-weight: 700;
  padding: 1px 5px; border-radius: 3px;
  background: var(--color-accent); color: #fff;
  white-space: nowrap; line-height: 1.4;
}
.act-task-count.maxed {
  background: var(--color-success);
}
.act-task-card--maxed {
  border-color: color-mix(in srgb, var(--color-success) 55%, transparent) !important;
  background: color-mix(in srgb, var(--color-success) 6%, transparent) !important;
}
.act-task-card--bonus.act-task-card--maxed {
  border-color: color-mix(in srgb, #f0c040 55%, transparent) !important;
  background: color-mix(in srgb, #f0c040 10%, transparent) !important;
}

/* 空状态 */
.act-empty {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 10px;
  color: var(--color-text-tertiary);
}
.act-empty-icon { font-size: 36px; opacity: 0.6; }
.act-empty p { font-size: 13px; }

/* 响应式 */
@media (max-width: 1000px) { .act-task-grid { grid-template-columns: repeat(4, 1fr); } }
@media (max-width: 700px) { .act-task-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 500px) { .act-task-grid { grid-template-columns: repeat(2, 1fr); } }

/* ── 弹窗（工资汇总）── */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center; z-index: 200;
}
.modal {
  background: var(--color-surface-1); border: 0.5px solid var(--color-border);
  border-radius: var(--radius-lg); width: 420px; max-width: 90vw;
  box-shadow: 0 16px 40px rgba(0,0,0,0.3);
}
.modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 0.5px solid var(--color-border-light);
}
.modal-head h4 { font-size: 15px; font-weight: 600; }
.modal-head-actions { display: flex; align-items: center; gap: 8px; }
.modal-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; overflow-x: auto; }
.modal-foot {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 14px 20px; border-top: 0.5px solid var(--color-border-light);
}
.btn-icon {
  width: 28px; height: 28px; border-radius: 4px; border: none;
  background: transparent; color: var(--color-text-tertiary);
  font-size: 14px; cursor: pointer; display: flex; align-items: center;
  justify-content: center; transition: all 0.1s;
}
.btn-icon:hover { background: var(--color-surface-2); color: var(--color-text); }

/* ── 任务管理弹窗 ── */
.modal--task-mgr { max-width: 860px; width: auto; }
.task-mgr-body { padding: 0 20px 20px !important; gap: 0 !important; }

/* 任务列表 */
.task-list {
  display: flex; flex-direction: column;
  max-height: 55vh; overflow-y: auto;
}

/* 单行 */
.task-row {
  border-bottom: 1px solid var(--color-border-light);
}
.task-row:first-child { border-top: 1px solid var(--color-border-light); }
.task-row--open { background: var(--color-surface-2); }

/* 主行 */
.task-row-main {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 0;
}

/* 展开按钮 */
.task-expand-btn {
  width: 22px; height: 22px; border-radius: 4px; font-size: 11px; font-family: inherit;
  border: none; background: transparent; color: var(--color-text-tertiary);
  cursor: pointer; transition: all 0.15s; padding: 0; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.task-expand-btn:hover { background: var(--color-surface-3); color: var(--color-accent); }
.task-expand-btn.open { transform: rotate(90deg); color: var(--color-accent); }

/* 字段区域 */
.task-row-fields {
  display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; flex-wrap: wrap;
}
.task-field-group { display: flex; align-items: center; gap: 0; flex-shrink: 0; }

/* 通用字段 input */
.task-field {
  padding: 4px 6px; font-size: 12.5px; font-family: inherit;
  border: 1px solid transparent; border-radius: 4px;
  background: transparent; color: var(--color-text); outline: none;
  transition: border-color 0.12s, background 0.12s;
}
.task-field:hover { background: var(--color-surface-3); }
.task-field:focus { border-color: var(--color-accent); background: var(--color-surface-1); }

.task-field-name { min-width: 110px; flex: 1; }
.task-field-pts { width: 46px; text-align: center; }
.task-field-suffix { font-size: 10.5px; color: var(--color-text-tertiary); padding-left: 2px; }

.task-field-sel { width: 56px; text-align: center; cursor: pointer; appearance: none; }
.task-lv-sep { font-size: 11px; color: var(--color-text-tertiary); padding: 0 1px; }
.task-field-lv-group { gap: 0; }
.task-field-count-group { gap: 0; }
.task-field-count { width: 36px; text-align: center; }
.task-field-count::-webkit-inner-spin-button,
.task-field-count::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

/* 开放日 chips */
.task-days { display: flex; gap: 2px; flex-shrink: 0; }
.day-chip {
  padding: 2px 5px; border-radius: 4px; font-size: 10.5px; font-family: inherit; font-weight: 500;
  border: 1px solid transparent; background: transparent;
  color: var(--color-text-tertiary); cursor: pointer; transition: all 0.12s;
  line-height: 1.5; min-width: 20px; text-align: center;
}
.day-chip:hover { background: var(--color-surface-3); color: var(--color-text); }
.day-chip.on {
  background: var(--color-accent); color: #fff; border-color: var(--color-accent);
}

/* 删除按钮 */
.task-del-btn {
  width: 24px; height: 24px; border-radius: 4px; font-size: 12px; font-family: inherit;
  border: none; background: transparent; color: var(--color-text-tertiary);
  cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  transition: all 0.12s;
}
.task-del-btn:hover { color: #e74c3c; background: rgba(231,76,60,0.08); }

/* 等级活跃子行 */
.task-level-row {
  padding: 8px 0 12px 32px; display: flex; flex-direction: column; gap: 8px;
  border-top: 1px dashed var(--color-border-light);
}
.task-level-hint { font-size: 10.5px; color: var(--color-text-tertiary); }
.task-level-inputs { display: flex; gap: 6px; flex-wrap: wrap; }
.task-level-item {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
}
.task-level-lv {
  font-size: 10px; font-weight: 650; color: var(--color-text-tertiary);
}
.task-level-input {
  width: 44px; height: 26px; text-align: center;
  padding: 2px 4px; font-size: 12px; font-family: inherit;
  border: 1px solid var(--color-border-light); border-radius: 4px;
  background: var(--color-surface-1); color: var(--color-text); outline: none;
  transition: border-color 0.12s;
  -moz-appearance: textfield;
}
.task-level-input::-webkit-inner-spin-button,
.task-level-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.task-level-input:hover { border-color: var(--color-text-tertiary); }
.task-level-input:focus { border-color: var(--color-accent); }
.task-level-input::placeholder { color: var(--color-text-tertiary); font-size: 10.5px; }

/* footer */
.task-add-btn {
  padding: 5px 14px; border-radius: 6px; font-size: 12px; font-family: inherit; font-weight: 500;
  border: 1px dashed var(--color-accent); background: transparent;
  color: var(--color-accent); cursor: pointer; transition: all 0.15s;
}
.task-add-btn:hover { background: var(--color-accent-bg); border-style: solid; }
.task-save-btn {
  padding: 6px 20px; border-radius: 6px; font-size: 13px; font-family: inherit; font-weight: 550;
  border: none; background: var(--color-accent); color: #fff;
  cursor: pointer; transition: opacity 0.15s;
}
.task-save-btn:hover { opacity: 0.85; }
.task-reset-btn {
  padding: 6px 14px; border-radius: 6px; font-size: 12px; font-family: inherit;
  border: 1px solid var(--color-border-light); background: transparent;
  color: var(--color-text-secondary); cursor: pointer; transition: all 0.12s;
}
.task-reset-btn:hover { border-color: var(--color-text-tertiary); color: var(--color-text); }
.task-mgr-count { font-size: 12px; color: var(--color-text-tertiary); }
.modal-foot-spacer { flex: 1; }
.modal-head-actions { display: flex; align-items: center; gap: 8px; }

/* ═══════════════════════════════════════════
   四象搭配（只读表格，支持表头筛选）
   ═══════════════════════════════════════════ */
.sxdp-wrap {
  display: flex; flex-direction: column; height: 100%; gap: 10px;
}
.sxdp-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; flex-shrink: 0; flex-wrap: wrap;
}
.sxdp-toolbar-right {
  display: flex; align-items: center; gap: 8px;
}
.sxdp-table-wrap {
  flex: 1; overflow: auto; border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-light);
  background: var(--color-surface-1);
}
.sxdp-table {
  width: 100%; border-collapse: separate; border-spacing: 0;
  table-layout: fixed; min-width: 680px;
}
.sxdp-table thead {
  position: sticky; top: 0; z-index: 2;
}
.sxdp-table th {
  padding: 10px 8px; font-size: 13px; font-weight: 700;
  text-align: center; color: #fff;
  background: #1a1a1a;
  border-right: 1px solid rgba(255,255,255,0.1);
  white-space: nowrap;
}
.sxdp-table th:last-child { border-right: none; }
.sxdp-table td {
  padding: 10px 8px; font-size: 13px; font-weight: 600;
  text-align: center; line-height: 1.5;
  border-right: 1px solid var(--color-border-light);
  border-bottom: 1px solid var(--color-border-light);
  vertical-align: middle;
}
.sxdp-table td:last-child { border-right: none; }
.sxdp-table tbody tr:nth-child(even) td {
  background: var(--color-surface-2);
}
.sxdp-table tbody tr:hover td {
  background: var(--color-accent-bg);
}
.sxdp-table tbody tr:last-child td { border-bottom: none; }
.sxdp-th-label { margin-bottom: 5px; }
/* 表头筛选：深色表头内的下拉，选中值时高亮描边 */
.sxdp-filter-select {
  width: 100%; padding: 2px 4px; border-radius: 4px;
  font-size: 11.5px; font-family: inherit; font-weight: 600;
  text-align: center; cursor: pointer;
  color: rgba(255,255,255,0.55);
  border: 1px solid rgba(255,255,255,0.18);
  background: rgba(255,255,255,0.06);
  outline: none; transition: border-color 0.12s, background 0.12s;
}
.sxdp-filter-select:hover { border-color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.12); }
.sxdp-filter-select.active {
  border-color: var(--color-accent); background: rgba(255,255,255,0.14);
}
.sxdp-filter-select option { color: var(--color-text); background: var(--color-surface-1); font-weight: 600; }
.sxdp-td-nomatch {
  padding: 28px 12px !important; text-align: center;
  font-size: 13px; font-weight: 500; color: var(--color-text-tertiary);
}
.sxdp-td-nomatch .lv-btn { margin-left: 10px; }

/* ═══════════════════════════════════════════
   等级经验表
   ═══════════════════════════════════════════ */
.exp-table-wrap {
  display: flex; flex-direction: column; height: 100%; gap: 10px;
}
.exp-table-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; flex-shrink: 0; flex-wrap: wrap;
}
.exp-table-toolbar-left {
  display: flex; align-items: center; gap: 8px;
}
/* A/B 表切换（怪物经验表 = A 可编辑 / 最高效率打怪群 = B 只读） */
.exp-tab-switch {
  display: flex; align-items: center; gap: 2px;
  padding: 2px; border-radius: 6px; background: var(--color-surface-2);
}
.exp-tab-btn {
  padding: 4px 10px; border: none; border-radius: 5px;
  background: transparent; color: var(--color-text-secondary);
  font-size: 12px; font-weight: 600; font-family: inherit; cursor: pointer;
  transition: all 0.12s;
}
.exp-tab-btn:hover { color: var(--color-text); }
.exp-tab-btn.active { background: var(--color-accent); color: #fff; }
.exp-table-toolbar-right {
  display: flex; align-items: center; gap: 6px;
}
.exp-table-hint {
  font-size: 11.5px; color: var(--color-text-tertiary);
}
.exp-table-scroll {
  flex: 1; overflow: auto; border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-light);
  background: var(--color-surface-1);
}
.exp-table {
  width: 100%; border-collapse: separate; border-spacing: 0;
  table-layout: fixed; min-width: 820px;
}
.exp-table thead {
  position: sticky; top: 0; z-index: 2;
}
.exp-table th {
  padding: 10px 6px; font-size: 12.5px; font-weight: 700;
  text-align: center; color: #2e7d32;
  background: #e8f5e9;
  border-right: 1px solid rgba(0,0,0,0.06);
  border-bottom: 2px solid #c8e6c9;
  white-space: nowrap;
}
.exp-table th:last-child { border-right: none; }
.exp-table td {
  padding: 6px 6px; font-size: 12px;
  text-align: center; line-height: 1.5;
  border-right: 1px solid var(--color-border-light);
  border-bottom: 0.5px solid var(--color-border-light);
  vertical-align: middle; color: var(--color-text-secondary);
  background: #fff;
}
.exp-table td:last-child { border-right: none; }
.exp-table tbody tr:hover td {
  background: #f5f5f5;
}
.exp-table tbody tr:last-child td { border-bottom: none; }

.exp-th-lv { width: 8%; }
.exp-th-exp { width: 38%; }
.exp-th-su { width: 38%; }
.exp-th-act { width: 4%; }

.exp-td-lv {
  font-weight: 700; color: var(--color-text);
}
.exp-td-exp, .exp-td-su {
  cursor: pointer;
}
.exp-td-exp:hover, .exp-td-su:hover {
  background: rgba(94, 106, 210, 0.04);
}

/* Inline edit input */
.exp-input {
  width: 100%; box-sizing: border-box; padding: 2px 4px;
  font-size: 12px; font-family: inherit; text-align: center;
  color: var(--color-text); background: var(--color-surface-1);
  border: 1px solid var(--color-accent); border-radius: 3px;
  outline: none;
}

.exp-td-act {
  text-align: center; vertical-align: middle !important;
}

/* ── 怪物基础经验表 ── */

.me-filter-input {
  width: 180px; padding: 4px 8px; font-size: 12px;
  color: var(--color-text); background: var(--color-surface-1);
  border: 1px solid var(--color-border-light); border-radius: 4px;
  outline: none; transition: border-color 0.12s;
}
.me-filter-input:focus { border-color: var(--color-accent); }
.me-filter-input::placeholder { color: var(--color-text-tertiary); }

.me-th-name { width: 10%; }
.me-th-area {
  width: 10%; position: relative; cursor: pointer; user-select: none;
  transition: color 0.12s;
}
.me-th-area:hover { color: #1b5e20; }
.me-th-area--filtered { color: #c62828 !important; }
.me-th-area--filtered .me-area-caret { color: #c62828; }
.me-area-dot { margin-right: 3px; font-size: 9px; color: #c62828; vertical-align: 1px; }
.me-area-caret { font-size: 10px; margin-left: 2px; opacity: 0.75; }
.me-area-menu { position: absolute; top: 100%; left: 0; z-index: 30; }
.me-area-backdrop { position: fixed; inset: 0; }
.me-area-items {
  position: relative; min-width: 150px; max-height: 300px; overflow-y: auto;
  background: var(--color-surface-3); border: 0.5px solid var(--color-border);
  border-radius: 6px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25); padding: 4px;
  display: flex; flex-direction: column; gap: 1px;
}
.me-area-item {
  display: flex; align-items: center; gap: 6px; width: 100%;
  padding: 5px 9px; border: none; border-radius: 4px;
  background: transparent; color: var(--color-text-secondary);
  font-size: 12px; font-family: inherit; text-align: left; cursor: pointer;
  white-space: nowrap;
}
.me-area-item:hover { background: var(--color-hover); color: var(--color-text); }
.me-area-item--active { background: var(--color-accent-bg); color: var(--color-accent); font-weight: 600; }
.me-area-count { margin-left: auto; font-size: 10.5px; color: var(--color-text-tertiary); font-weight: 400; }
/* B 表（每级最高效率打怪群，只读）：等级 / 地区 / 最高效率打怪群 */
.be-th-lv { width: 6%; }
.be-th-area { width: 12%; }
.be-th-group { width: 40%; text-align: left !important; padding-left: 12px !important; }
.be-th-week { width: 13%; }
.be-th-why { width: 29%; text-align: left !important; padding-left: 12px !important; }
.be-td-lv { font-weight: 700; color: var(--color-text); }
.be-td-area { color: var(--color-text-secondary); }
.be-td-group { text-align: left; padding-left: 12px; color: var(--color-text); }
.be-td-week { font-weight: 700; color: var(--color-accent, var(--color-text)); }
/* 手动编辑组合的每周经验与默认组合比较：增长红色、降低绿色（2026-08-27 用户要求） */
.be-td-week.up { color: #e74c3c; }
.be-td-week.down { color: #27ae60; }
.be-td-why { text-align: left; padding-left: 12px; font-size: 12px; color: var(--color-text-secondary); line-height: 1.4; }
.be-group-text { margin-right: 8px; }
.be-edit-btn, .be-reset-btn {
  padding: 2px 8px; border-radius: 4px; font-size: 11.5px; font-family: inherit;
  border: 1px solid var(--color-border-light); background: transparent;
  color: var(--color-text-tertiary); cursor: pointer; transition: all 0.12s;
}
.be-edit-btn:hover { color: var(--color-accent); border-color: var(--color-accent); }
.be-reset-btn:hover { color: #e74c3c; border-color: #e74c3c; }
.be-tr--edited .be-td-lv { color: var(--color-accent, #3b82f6); }
.grind-cand-tip { font-size: 12px; color: var(--color-text-secondary); }
.grind-cand-area { display: flex; flex-direction: column; gap: 4px; }
.grind-cand-area-name { font-size: 12px; font-weight: 600; color: var(--color-accent, var(--color-text)); border-bottom: 0.5px solid var(--color-border-light); padding-bottom: 2px; margin-top: 4px; }
.grind-cand-item { display: flex; align-items: center; gap: 8px; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12.5px; }
.grind-cand-item:hover { background: var(--color-surface-2); }
.grind-cand-item--checked { background: var(--color-surface-2); }
/* 窗口外怪群（本级无经验）：灰显可勾选，升级到相邻等级后可打 */
.grind-cand-item--off-window { opacity: 0.62; }
.grind-cand-item--off-window .grind-cand-name { color: var(--color-text-tertiary); }
.grind-cand-off { flex: 0 0 auto; font-size: 10px; padding: 0 4px; border-radius: 8px; border: 0.5px solid var(--color-border-light); color: var(--color-text-tertiary); }
.grind-cand-name { flex: 0 0 auto; color: var(--color-text); }
.grind-cand-meta { color: var(--color-text-tertiary); font-size: 11.5px; }
.grind-cand-count { font-size: 12px; color: var(--color-text-secondary); align-self: center; margin-right: auto; }

.me-th-lv { width: 6%; }
.me-th-exp { width: 10%; }
.me-th-fatigue { width: 7%; }
.me-th-unit { width: 9%; }
.me-th-mult { width: 6%; }
.me-th-adj { width: 9%; }
.me-th-qty { width: 5%; }
.me-th-respawn { width: 7%; }
.me-th-kill { width: 7%; }
.me-th-eff { width: 11%; }

/* 可编辑列 vs 只读列区分（2026-08-27）：可编辑列 = 淡色底 + 值下虚线 + 文本光标，
   双击进入编辑；只读列（单位经验/修正经验/效率，自动计算）表头灰显带 ⚙ 标记 */
.me-td-editable {
  cursor: text;
  background: rgba(94, 106, 210, 0.05);
}
.me-td-editable:hover {
  background: rgba(94, 106, 210, 0.12);
}
.exp-table .me-td-editable > span {
  border-bottom: 1px dashed var(--color-border);
  padding-bottom: 1px;
}
.me-th-ro {
  color: var(--color-text-tertiary);
  font-weight: 500;
  cursor: help;
}
.me-td-lv {
  font-weight: 700; color: var(--color-text);
}
.me-td-exp-zero span {
  color: #e74c3c;
  font-weight: 700;
}
.me-td-unit, .me-td-adj, .me-td-eff {
  font-variant-numeric: tabular-nums;
  color: var(--color-text-secondary);
}
.me-td-qty, .me-td-respawn, .me-td-kill {
  font-variant-numeric: tabular-nums;
}

/* ═══════════════════════════════════════════
   升级计算器
   ═══════════════════════════════════════════ */
.exp-calc-wrap {
  display: flex; flex-direction: column; gap: 8px; height: 100%;
  overflow: hidden;
}

/* 方案选择 */
.ec-preset-bar {
  display: flex; align-items: center; gap: 6px; flex-shrink: 0;
  padding-bottom: 4px; border-bottom: 1px solid var(--color-border-light);
}
.ec-preset-tabs {
  display: flex; align-items: center; gap: 4px; flex: 1; overflow-x: auto;
  scrollbar-width: none;
}
.ec-preset-tabs::-webkit-scrollbar { display: none; }
.ec-preset-tab {
  padding: 4px 12px; border-radius: 6px 6px 0 0;
  font-size: 12px; font-weight: 500; white-space: nowrap;
  cursor: pointer; user-select: none;
  color: var(--color-text-tertiary); border: 1px solid transparent;
  transition: all 0.12s;
}
.ec-preset-tab:hover { color: var(--color-text); background: var(--color-surface-2); }
.ec-preset-tab.active {
  color: var(--color-accent); font-weight: 600;
  background: var(--color-accent-bg); border-color: var(--color-accent);
  border-bottom-color: transparent;
}
.ec-preset-actions { display: flex; gap: 4px; flex-shrink: 0; }
.ec-preset-btn-add, .ec-preset-btn-del {
  width: 22px; height: 22px; border-radius: 4px; font-size: 14px;
  font-family: inherit; line-height: 1; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--color-border-light);
  background: var(--color-surface-1); color: var(--color-text-tertiary);
  transition: all 0.12s;
}
.ec-preset-btn-add:hover { border-color: var(--color-accent); color: var(--color-accent); }
.ec-preset-btn-del:hover { border-color: #e74c3c; color: #e74c3c; }

/* 控制栏 */
.ec-toolbar {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  flex-shrink: 0; flex-wrap: nowrap;
  padding: 8px 12px; border-radius: var(--radius-sm);
  background: var(--color-surface-1); border: 0.5px solid var(--color-border-light);
}
.ec-level-row {
  display: flex; align-items: center; gap: 6px;
  min-width: 0; flex: 0 1 auto;
}
.ec-level-label {
  font-size: 12px; font-weight: 650; color: var(--color-text-secondary);
  white-space: nowrap; flex-shrink: 0;
}
.ec-level-input {
  width: 72px; padding: 4px 6px; border-radius: 4px; font-size: 13px; font-family: inherit;
  border: 1px solid var(--color-border-light); background: var(--color-surface-2);
  color: var(--color-text); outline: none; transition: border-color 0.12s;
  text-align: center; -moz-appearance: textfield; flex-shrink: 0;
}
.ec-level-input::-webkit-inner-spin-button,
.ec-level-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
/* 起始星期选择：与左侧标签拉开间隔（原提示文案已移除） */
.ec-start-weekday-select { margin-left: 8px; }
.ec-task-chip-type {
  font-size: 9.5px; color: var(--color-text-tertiary); font-weight: 400;
  padding: 0 5px; border: 0.5px solid var(--color-border-light); border-radius: 8px;
  background: var(--color-surface-2); white-space: nowrap; flex-shrink: 0;
}
.ec-task-chip-closed {
  font-size: 9px; color: var(--color-text-tertiary); opacity: 0.85;
  border: 0.5px dashed var(--color-border-light); border-radius: 8px;
  padding: 0 5px; white-space: nowrap; flex-shrink: 0;
}
.ec-level-input:hover { border-color: var(--color-text-tertiary); }
.ec-level-input:focus { border-color: var(--color-accent); }

/* 起始等级进度 */
.ec-level-start-group {
  display: flex; align-items: center; gap: 4px;
  background: var(--color-surface-2); border-radius: 6px;
  padding: 2px 4px 2px 2px; border: 0.5px solid var(--color-border-light);
  flex-shrink: 0;
}
.ec-progress-label {
  font-size: 10.5px; color: var(--color-text-tertiary); font-weight: 500;
}
.ec-progress-input {
  width: 44px; padding: 3px 4px; text-align: center;
  font-size: 13px; font-family: inherit; font-weight: 550;
  border: 1px solid var(--color-border-light); border-radius: 3px;
  background: var(--color-surface-1); color: var(--color-text);
  outline: none; transition: border-color 0.12s;
  -moz-appearance: textfield; flex-shrink: 0;
}
.ec-progress-input::-webkit-inner-spin-button,
.ec-progress-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.ec-progress-input:focus { border-color: var(--color-accent); }
.ec-progress-unit {
  font-size: 11px; color: var(--color-text-tertiary); font-weight: 500;
}

.ec-level-arrow {
  font-size: 14px; color: var(--color-text-tertiary); font-weight: 600; flex-shrink: 0;
}
.ec-level-warn {
  font-size: 11px; color: #e8a030; font-weight: 500; white-space: nowrap; flex-shrink: 0;
}
.ec-level-range {
  font-size: 12.5px; color: var(--color-text-secondary); white-space: nowrap; flex-shrink: 0;
}
.ec-total-days {
  font-size: 13px; color: var(--color-accent); white-space: nowrap;
  margin-left: 8px; font-weight: 500;
}
.ec-total-days strong { font-size: 16px; font-weight: 700; }
/* 未达目标等级（5 年上限耗尽）警示 */
/* 超长期摘要（超过 5 年仍未达标 / 经验表数据不足，不展开逐天明细） */
.ec-days-summary-note { margin-left: 8px; font-size: 11px; font-weight: 400; color: var(--color-text-tertiary); }
.ec-days-summary {
  display: flex; flex-direction: column; gap: 8px;
  padding: 12px 14px; border-radius: var(--radius-md);
  background: var(--color-surface-1); border: 0.5px solid var(--color-border-light);
}
.ec-days-summary-route { font-size: 13px; font-weight: 600; color: var(--color-text); }
.ec-days-summary-est { font-size: 13px; font-weight: 600; color: var(--color-accent); line-height: 1.5; }
/* 超长期提醒 */
.ec-days-remind {
  padding: 8px 12px; border-radius: 6px;
  background: rgba(255, 191, 0, 0.10); border: 0.5px solid rgba(255, 191, 0, 0.45);
  color: var(--color-text-secondary); font-size: 12px; line-height: 1.6;
}
.ec-toolbar-btns { display: flex; gap: 6px; flex-shrink: 0; }

/* 三栏主体：活跃任务 | 逐天明细 | 经验道具 */
.ec-calc-body {
  flex: 1; min-height: 0;
  display: flex; gap: 10px; align-items: stretch;
}

/* 左右侧栏：面板列容器，可堆叠多个独立面板（活跃任务/经验道具/打怪经验等） */
.ec-sidebar-col {
  width: 250px; flex-shrink: 0; min-height: 0;
  display: flex; flex-direction: column; gap: 10px;
}

/* ── 打怪经验面板 ── */
/* 输入框与下拉框样式统一（border/圆角/背景/高度一致，保证队伍与加成区各项对齐） */
input.grind-input {
  width: 100%; padding: 4px 6px; font-size: 11.5px; box-sizing: border-box;
  border: 1px solid var(--color-border-light); border-radius: 4px;
  background: var(--color-surface-1); color: var(--color-text); min-width: 0;
}
.grind-select { width: 100%; padding: 4px 6px; font-size: 11.5px; border: 1px solid var(--color-border-light); border-radius: 4px; background: var(--color-surface-1); color: var(--color-text); min-width: 0; }
.grind-check { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; color: var(--color-text-secondary); cursor: pointer; user-select: none; }
.grind-segment-spacer { flex: 1; }
.grind-areas { display: flex; flex-direction: column; gap: 4px; }
.grind-area-head {
  font-size: 10px; font-weight: 600; color: var(--color-text-tertiary);
  padding: 2px 4px; cursor: pointer; user-select: none;
  display: flex; align-items: center; gap: 3px; border-radius: 4px;
}
.grind-area-head:hover { background: var(--color-surface-2); color: var(--color-text-secondary); }
.grind-area-caret { font-size: 9px; width: 10px; flex-shrink: 0; }
.grind-area-name { flex: 1; min-width: 0; }
.grind-area-checked-count {
  font-size: 9px; font-weight: 600; color: var(--color-accent);
  background: var(--color-accent-bg); border-radius: 8px; padding: 0 5px; line-height: 1.4;
}
.grind-area-seg { font-size: 9.5px; color: var(--color-text-tertiary); padding-left: 6px; margin-top: 1px; opacity: 0.8; }
.grind-area-groups { display: flex; flex-wrap: wrap; gap: 3px; }
.grind-info { font-size: 11px; color: var(--color-text-tertiary); cursor: help; flex-shrink: 0; line-height: 1.2; }
.grind-info:hover { color: var(--color-accent); }
.grind-group-chip { padding: 2px 6px; font-size: 10.5px; border-radius: 3px; border: 1px solid var(--color-border-light); background: var(--color-surface-1); color: var(--color-text-secondary); cursor: pointer; user-select: none; display: inline-flex; align-items: center; gap: 3px; }
.grind-group-chip:hover { border-color: var(--color-accent); }
.grind-group-chip.checked { background: var(--color-accent-bg); border-color: var(--color-accent); color: var(--color-accent); }
.grind-checkbox { accent-color: var(--color-accent); margin: 0; cursor: pointer; }
.grind-head-btn { padding: 1px 6px; font-size: 11px; border: 1px solid var(--color-border-light); border-radius: 3px; background: var(--color-surface-1); color: var(--color-text-tertiary); cursor: pointer; line-height: 1.4; white-space: nowrap; flex-shrink: 0; }
.grind-head-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }
.grind-empty-tip { font-size: 10.5px; color: var(--color-text-tertiary); padding: 4px 2px; }

/* 等级段：切换行（每段一行内编辑起止等级，点击切换）+ 下方当前段勾选列表（复用 grind-areas） */
.grind-segments { display: flex; flex-direction: column; gap: 4px; }
.grind-seg-tabs { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.grind-seg-tab {
  display: inline-flex; align-items: center; gap: 2px;
  padding: 1px 3px 1px 4px; font-size: 10.5px;
  border: 1px solid var(--color-border-light); border-radius: 3px;
  background: var(--color-surface-1); color: var(--color-text-secondary);
  cursor: pointer; user-select: none;
}
.grind-seg-tab:hover { border-color: var(--color-accent); }
.grind-seg-tab.active { background: var(--color-accent-bg); border-color: var(--color-accent); color: var(--color-accent); font-weight: 600; }
.grind-seg-tab-input {
  width: 30px; padding: 1px 1px; text-align: center; font-size: 10.5px;
  border: none; background: transparent; color: inherit; -moz-appearance: textfield;
}
.grind-seg-tab-input::-webkit-outer-spin-button, .grind-seg-tab-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.grind-seg-tab-input:focus { outline: 1px solid var(--color-accent); border-radius: 2px; background: var(--color-surface-1); }
.grind-seg-tab-tilde { font-size: 9px; color: var(--color-text-tertiary); }
.grind-seg-tab-count {
  font-size: 9px; font-weight: 600; color: var(--color-accent);
  background: var(--color-accent-bg); border-radius: 8px; padding: 0 4px; line-height: 1.4;
}
.grind-seg-tab-del {
  padding: 0 2px; font-size: 9px; line-height: 1.4; border: none; background: transparent;
  color: var(--color-text-tertiary); cursor: pointer; border-radius: 2px;
}
.grind-seg-tab-del:hover { color: var(--color-danger, #e05); background: var(--color-surface-2); }
.grind-seg-tab-add {
  padding: 1px 7px; font-size: 11px; line-height: 1.5;
  border: 1px dashed var(--color-border-light); border-radius: 3px;
  background: transparent; color: var(--color-text-tertiary); cursor: pointer;
}
.grind-seg-tab-add:hover { border-color: var(--color-accent); color: var(--color-accent); }
.grind-seg-hint { font-size: 9.5px; color: var(--color-text-tertiary); }

/* 分段模式主面板摘要（只读）：每段一行 起止等级 + 勾选地图群数，点击行打开设置弹窗 */
.grind-seg-summary {
  display: flex; flex-wrap: wrap; align-items: center; gap: 3px 5px;
  padding: 3px 5px; font-size: 10.5px;
  border: 1px solid var(--color-border-light); border-radius: 3px;
  background: var(--color-surface-1); color: var(--color-text-secondary);
  cursor: pointer; user-select: none;
}
.grind-seg-summary:hover { border-color: var(--color-accent); }
.grind-seg-summary-range {
  font-weight: 650; color: var(--color-accent);
  background: var(--color-accent-bg); border-radius: 3px; padding: 0 4px;
}
.grind-seg-summary-maps { display: inline-flex; flex-wrap: wrap; gap: 3px; min-width: 0; }
.grind-seg-summary-map {
  font-size: 9.5px; padding: 0 4px; border-radius: 8px;
  background: var(--color-surface-2); border: 0.5px solid var(--color-border-light);
}
.grind-seg-summary-empty { font-size: 9.5px; color: var(--color-text-tertiary); }
.grind-seg-summary-actions { display: inline-flex; gap: 2px; margin-left: auto; }
.grind-seg-summary-hint { font-size: 9.5px; color: var(--color-text-tertiary); }
.grind-seg-edit-btn {
  align-self: flex-start; padding: 2px 8px; font-size: 10.5px;
  border: 1px solid var(--color-border-light); border-radius: 3px;
  background: var(--color-surface-1); color: var(--color-text-secondary);
  cursor: pointer;
}
.grind-seg-edit-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }
/* 段勾选列表中窗口外群灰显（本级无经验，升级到相邻等级后可打） */
.grind-group-chip--off { opacity: 0.62; }

/* ── 设置弹窗：统一分区（左侧强调线标题 + 内容列） ── */
.grind-sec { display: flex; flex-direction: column; gap: 7px; }
.grind-sec-title {
  font-size: 12px; font-weight: 650; color: var(--color-text);
  border-left: 3px solid var(--color-accent); padding-left: 8px;
  display: flex; align-items: baseline; gap: 6px; line-height: 1.3;
}
.grind-sec-sub { font-size: 10px; font-weight: 400; color: var(--color-text-tertiary); }
.grind-modal { display: flex; flex-direction: column; }

/* 打怪面板首日结果条：有效分钟 / 开齐心 / 疲劳消耗明细 */
.grind-result-strip {
  display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline;
  font-size: 10.5px; color: var(--color-text-secondary);
  background: var(--color-surface-2); border: 0.5px solid var(--color-border-light);
  border-radius: 8px; padding: 5px 8px; margin-bottom: 6px; line-height: 1.5;
}
.grind-fatigue-limited { color: var(--color-danger); font-weight: 600; }
.grind-modal .modal-head { flex-shrink: 0; }
.grind-modal-body { flex: 1; min-height: 0; overflow-y: auto; }

/* 字段（下拉 / 输入 + 名称在上） */
/* 队伍与经验加成区：5 列网格（10 项恰好 2 行），label 预留两行高度使控件行对齐 */
.grind-pair-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.grind-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.grind-field-label { font-size: 10.5px; color: var(--color-text-secondary); display: inline-flex; align-items: center; gap: 3px; line-height: 1.3; min-height: 28px; }
.grind-field .grind-info { font-size: 10px; }

/* 带 % 后缀的数字输入 */
.grind-num-wrap { position: relative; display: flex; align-items: center; }
.grind-num-wrap .grind-input { padding-right: 16px; }
.grind-num-unit { position: absolute; right: 5px; font-size: 9.5px; color: var(--color-text-tertiary); pointer-events: none; }
.grind-day-table { display: flex; flex-direction: column; gap: 4px; background: var(--color-surface-2); border: 0.5px solid var(--color-border-light); border-radius: 8px; padding: 8px 10px; }
.grind-day-row { display: grid; grid-template-columns: 64px repeat(7, 1fr); gap: 4px; align-items: center; }
.grind-day-param { font-size: 10.5px; color: var(--color-text-secondary); font-weight: 500; }
.grind-day-head .grind-day-weekday { font-weight: 600; color: var(--color-text-secondary); padding-bottom: 2px; }
.grind-day-weekday { font-size: 10.5px; color: var(--color-text-tertiary); text-align: center; }
.grind-day-cell { display: flex; justify-content: center; align-items: center; }
.grind-day-cell .grind-input { width: 100%; min-width: 0; text-align: center; }
.grind-day-check { accent-color: var(--color-accent); margin: 0; cursor: pointer; }
.grind-day-sums { display: flex; flex-wrap: wrap; gap: 6px; }
.grind-sum-chip {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 10.5px; padding: 3px 9px; border-radius: 10px;
  background: var(--color-surface-1); border: 0.5px solid var(--color-border-light);
  color: var(--color-text-secondary); line-height: 1.4;
}
.grind-sum-chip.over { background: rgba(255, 69, 58, 0.08); border-color: var(--color-danger); color: var(--color-danger); }
.grind-sum-cap { font-size: 9.5px; color: var(--color-text-tertiary); }
.grind-sum-chip.over .grind-sum-cap { color: var(--color-danger); opacity: 0.8; }
.grind-decay-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 7px 8px; }
.grind-decay-cell { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.grind-decay-label { font-size: 9.5px; color: var(--color-text-tertiary); text-align: center; line-height: 1.2; }
.grind-decay-cell.same { background: var(--color-accent-bg); border-radius: 4px; padding: 2px 0; }
.grind-decay-cell.same .grind-decay-label { color: var(--color-accent); font-weight: 650; }
/* 打怪衰减率输入框：与封印加速等级段输入框同尺寸同风格（右侧留白给 % 单位） */
.grind-decay-cell .rate-input {
  width: 70px; padding: 4px 16px 4px 6px;
  font-size: 12px; font-family: inherit;
  background: var(--color-surface-2); color: var(--color-text);
  border: 0.5px solid var(--color-border); border-radius: 4px;
  text-align: center;
}
.grind-decay-cell .rate-input:focus {
  outline: none; border-color: var(--color-accent-ring);
}

/* 单个面板：标题固定 + 内容独立滚动 */
.ec-panel {
  flex: 1; min-height: 0;
  display: flex; flex-direction: column;
  border-radius: var(--radius-sm);
  background: var(--color-surface-1);
  border: 0.5px solid var(--color-border);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18); /* 与页面背景拉开层次，独立卡片感 */
  overflow: hidden;
}
.ec-panel--collapsed { flex: 0 0 auto; }
.ec-panel-head {
  flex-shrink: 0;
  display: flex; align-items: center; gap: 5px;
  padding: 8px 10px;
  background: var(--color-surface-2);
  border-bottom: 0.5px solid var(--color-border-light);
  cursor: pointer; user-select: none;
  transition: background 0.12s;
}
.ec-panel-head:hover { background: var(--color-surface-3); }
.ec-panel-caret {
  font-size: 10px; color: var(--color-text-tertiary);
  width: 12px; flex-shrink: 0;
}
.ec-panel-title {
  font-size: 11.5px; font-weight: 650; color: var(--color-text);
}
.ec-panel-body {
  flex: 1; min-height: 0;
  overflow-y: auto;
  padding: 8px 10px;
  display: flex; flex-direction: column; gap: 6px;
}

.ec-rate-btn {
  padding: 3px 8px; border-radius: 4px; font-size: 11.5px; font-family: inherit;
  border: 1px solid var(--color-border-light); background: var(--color-surface-2);
  color: var(--color-text-secondary); cursor: pointer; transition: all 0.12s;
  white-space: nowrap; flex-shrink: 0;
}
.ec-rate-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }

.ec-task-grid {
  display: grid; grid-template-columns: 1fr; gap: 4px;
}
.ec-task-chip {
  display: flex; align-items: center; gap: 4px;
  padding: 5px 8px; border-radius: 4px;
  border: 1px solid var(--color-border-light);
  background: var(--color-surface-2);
  cursor: pointer; user-select: none;
  transition: all 0.12s;
}
.ec-task-chip:hover { border-color: var(--color-accent); }
.ec-task-chip.checked {
  background: var(--color-accent-bg); border-color: var(--color-accent);
}
.ec-chip-checkbox {
  accent-color: var(--color-accent); margin: 0; cursor: pointer; flex-shrink: 0;
}
.ec-task-chip-name {
  flex: 1; font-size: 11.5px; color: var(--color-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
}
.ec-task-chip-rate {
  font-size: 10px; color: var(--color-text-tertiary);
  background: var(--color-surface-1); padding: 1px 4px; border-radius: 3px; flex-shrink: 0;
}
.ec-task-chip-count-label {
  font-size: 10px; color: var(--color-text-tertiary);
  background: var(--color-surface-1); padding: 1px 4px; border-radius: 3px; flex-shrink: 0;
}
.ec-task-chip-count-label.maxed {
  color: var(--color-accent); background: var(--color-accent-bg); font-weight: 600;
}
.ec-task-chip.maxed {
  border-color: var(--color-accent);
}
.ec-item-count-input {
  width: 44px; padding: 1px 3px; text-align: center; flex-shrink: 0;
  font-size: 11px; font-family: inherit; font-weight: 600;
  border: 1px solid var(--color-border-light); border-radius: 3px;
  background: var(--color-surface-1); color: var(--color-text);
  outline: none; transition: border-color 0.12s;
  -moz-appearance: textfield;
}
.ec-item-count-input::-webkit-inner-spin-button,
.ec-item-count-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.ec-item-count-input:focus { border-color: var(--color-accent); }
.ec-task-sub-count {
  font-weight: 400; font-size: 9.5px; color: var(--color-text-tertiary);
}
.ec-items-toggle {
  margin-top: 4px; text-align: center;
}
.ec-items-toggle-btn {
  font-size: 10.5px; font-family: inherit; padding: 2px 10px; border-radius: 3px;
  border: 1px solid var(--color-border-light); background: transparent;
  color: var(--color-text-tertiary); cursor: pointer; transition: all 0.12s;
}
.ec-items-toggle-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }
.ec-task-empty {
  font-size: 12.5px; color: var(--color-text-tertiary);
  text-align: center; padding: 20px;
}

/* ── 加成道具面板（2026-08-21，时效型） ──
   每行一个道具，仅 名称 | 剩余天数 | ⚙ 设置 三列（固定列各行对齐）；
   启用/类型/数值/任务范围/开始天数/有效期 均在设置弹窗内编辑。 */
.bonus-list {
  display: flex; flex-direction: column; gap: 5px;
}
.bonus-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto; /* ☑ | 名称 | 剩X/Y天 | ⚙：后两列各行对齐 */
  align-items: center; gap: 4px;
  padding: 5px 8px; border-radius: 4px;
  border: 1px solid var(--color-border-light);
  background: var(--color-surface-2);
  min-height: 30px; /* 与经验道具 chip 行等高：5px 上下内边距 + 20px 内容 */
  transition: opacity 0.12s;
}
.bonus-row--off { opacity: 0.62; } /* 未启用（面板行取消勾选）变暗提示 */
.bonus-name {
  min-width: 0; /* 与 ec-task-chip-name 一致：占满剩余宽度、超长省略 */
  font-size: 11.5px; color: var(--color-text); font-weight: 500;
  line-height: 20px; /* 行高与徽标/按钮统一，保证文本与徽标文字同一水平线 */
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
/* 效果/剩余天数徽标 + ⚙ 按钮：固定等高 20px、文字垂直居中 */
.bonus-summary,
.bonus-config-btn {
  display: inline-flex; align-items: center;
  height: 20px; line-height: 1;
  flex-shrink: 0; white-space: nowrap;
}
.bonus-remain {
  justify-self: start; /* 作为独立列，与各行"剩X/Y天"左对齐 */
}
/* 效果/剩余天数徽标：与经验道具 chip 的 ×倍率 / 休 / 🗓 徽标同款 */
.bonus-summary {
  font-size: 10px; color: var(--color-text-tertiary);
  background: var(--color-surface-1); padding: 0 4px; border-radius: 3px;
}
.bonus-config-btn {
  font-size: 10px; font-family: inherit; padding: 0 6px; border-radius: 3px;
  border: 1px solid var(--color-border-light); background: transparent;
  color: var(--color-text-secondary); cursor: pointer; transition: all 0.12s;
}
.bonus-config-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }
/* 设置弹窗内的任务 chip 列表 */
.bonus-task-chips {
  display: flex; flex-wrap: wrap; gap: 4px; max-height: 150px; overflow-y: auto;
}
.bonus-task-chips .ec-task-chip { padding: 2px 6px; }

/* ── 加成道具设置弹窗（2026-08-21） ── */
.bonus-modal-row {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.bonus-modal-row--col {
  flex-direction: column; align-items: flex-start; gap: 6px;
}
.bonus-modal-label {
  width: 72px; flex-shrink: 0; font-size: 12px; color: var(--color-text-secondary);
}
.bonus-modal-input { width: 96px; flex-shrink: 0; }
.bonus-modal-hint { font-size: 11px; color: var(--color-text-tertiary); }
/* 类型切换：与 ec-subtab 同款 */
.bonus-type-toggle { display: flex; gap: 6px; }
.bonus-type-btn {
  padding: 4px 12px; border-radius: 4px; font-size: 11.5px; font-family: inherit;
  border: 1px solid var(--color-border-light); background: var(--color-surface-2);
  color: var(--color-text-secondary); cursor: pointer; transition: all 0.12s;
}
.bonus-type-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }
.bonus-type-btn.active {
  background: var(--color-accent-bg); border-color: var(--color-accent);
  color: var(--color-accent); font-weight: 600;
}
.bonus-modal-del {
  display: flex; justify-content: flex-end; padding-top: 8px;
  border-top: 0.5px solid var(--color-border-light);
}
.bonus-modal-del-btn {
  padding: 3px 10px; font-size: 11px; font-family: inherit;
  border: 1px solid var(--color-border-light); border-radius: 4px;
  background: transparent; color: var(--color-danger, #dc3545); cursor: pointer; transition: all 0.12s;
}
.bonus-modal-del-btn:hover { background: rgba(220, 53, 69, 0.12); border-color: var(--color-danger, #dc3545); }

/* 中间栏：无勾选时的提示（垂直水平居中） */
.ec-mid-hint {
  flex: 1; min-height: 0;
  display: flex; align-items: center; justify-content: center;
}

/* 计算结果 = 逐天明细 */
.ec-result-section {
  flex: 1; display: flex; flex-direction: column; min-height: 0;
  border-radius: var(--radius-md);
  background: var(--color-surface-1);
  border: 1px solid var(--color-accent);
  overflow: hidden; /* 标题与表格共用圆角，成一体卡片 */
}
.ec-result-head {
  padding: 10px 14px; font-size: 14px; font-weight: 650; color: var(--color-text);
  background: var(--color-accent-bg);
  border-bottom: 1px solid var(--color-accent);
  flex-shrink: 0;
}
/* 逐天明细 */
.ec-detail-table-wrap {
  overflow: auto; flex: 1; min-height: 0;
}
.ec-detail-table {
  width: 100%; border-collapse: collapse; font-size: 12px;
  font-variant-numeric: tabular-nums; /* 数字等宽，列对齐不跳动 */
}
.ec-detail-table th {
  position: sticky; top: 0; z-index: 1; /* 滚动时表头固定 */
  padding: 7px 6px; font-size: 11px; font-weight: 650;
  text-align: right; color: var(--color-text-secondary);
  background: var(--color-surface-2);
  border-bottom: 1px solid var(--color-border-light);
  white-space: nowrap;
}
.ec-detail-table th:first-child { text-align: center; }
.ec-detail-table th.ec-th-progress { text-align: center; }
.ec-detail-table td {
  padding: 6px 6px; text-align: right;
  border-bottom: 0.5px solid var(--color-border-light);
  color: var(--color-text-secondary); white-space: nowrap;
}
.ec-detail-table tbody tr:last-child td { border-bottom: none; }
.ec-detail-table td:first-child {
  text-align: center; font-weight: 600; color: var(--color-text);
}
.ec-td-areas { /* 刷怪地图列：长地图名省略号截断，悬停 title 看全名 */
  max-width: 110px; overflow: hidden; text-overflow: ellipsis;
}
.ec-detail-table tbody tr:nth-child(even) td { background: var(--color-surface-2); }
.ec-detail-table tbody tr:hover td { background: var(--color-accent-bg); }

/* 逐天明细：行可点击 */
.ec-day-row { cursor: pointer; }
.ec-day-row:hover td { background: var(--color-accent-bg) !important; }

/* 逐天明细：升级行高亮 */
.ec-day-row--levelup td { background: rgba(255, 193, 7, 0.12) !important; }
.ec-day-row--levelup:hover td { background: rgba(255, 193, 7, 0.2) !important; }
.ec-levelup-new { color: var(--color-accent); font-weight: 700; }

/* 升级进度条：居中，百分比在条右侧（主题色），accent 同色系渐变 */
.ec-progress-cell {
  display: flex; align-items: center; justify-content: center; gap: 5px;
}
.ec-progress-bar-wrap {
  width: 84px; height: 9px; flex-shrink: 0;
  background: var(--color-surface-2);
  border: 0.5px solid var(--color-border-light);
  border-radius: 5px;
  overflow: hidden;
}
.ec-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--color-accent), var(--color-accent-hover));
  transition: width 0.2s;
}
.ec-progress-pct {
  font-size: 10px; font-weight: 500; line-height: 1;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

/* 倍率弹窗 */
.modal--rate { max-width: 480px; }
.rate-modal-body {
  max-height: 60vh; overflow-y: auto;
}
.rate-hint {
  font-size: 11.5px; color: var(--color-text-tertiary);
  margin-bottom: 12px; padding: 6px 10px;
  background: var(--color-accent-bg); border-radius: 4px;
}
.rate-section { margin-bottom: 16px; }
.rate-section:last-child { margin-bottom: 0; }
.rate-section-head {
  font-size: 12px; font-weight: 650; color: var(--color-text);
  margin-bottom: 8px; padding-bottom: 6px;
  border-bottom: 1px solid var(--color-border-light);
}
/* 倍率弹窗任务 tab：搜索 + 折叠 */
.rate-filter-bar {
  display: flex; align-items: center; gap: 6px; margin-bottom: 12px;
}
.rate-filter-input { flex: 1; width: auto; }
.rate-list {
  display: flex; flex-direction: column; gap: 6px;
}
.rate-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; border-radius: 6px;
  border: 0.5px solid var(--color-border-light);
  transition: background 0.1s;
}
.rate-row:hover { background: var(--color-surface-2); }
/* 拖拽排序（倍率弹窗任务/道具两列，2026-08-27）：手柄 + 拖拽中/悬停高亮 */
.rate-drag-handle {
  flex-shrink: 0; cursor: grab;
  color: var(--color-text-tertiary);
  font-size: 11px; line-height: 1;
  padding: 0 2px; user-select: none;
}
.rate-drag-tip {
  margin-left: auto;
  font-size: 10px; font-weight: 400; color: var(--color-text-tertiary);
}
.rate-row--dragging { opacity: 0.45; }
.rate-row--dragover { border-color: var(--color-accent); background: var(--color-accent-bg); }
.rate-task-name {
  font-size: 13px; color: var(--color-text); font-weight: 500;
}
.rate-input {
  width: 80px; padding: 5px 8px; text-align: center;
  font-size: 13px; font-family: inherit;
  border: 1px solid var(--color-border-light); border-radius: 4px;
  background: var(--color-surface-1); color: var(--color-text);
  outline: none; transition: border-color 0.12s;
  -moz-appearance: textfield;
}
.rate-input::-webkit-inner-spin-button,
.rate-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.rate-input:focus { border-color: var(--color-accent); }

/* ── 任务倍率 tab：两列布局（活跃任务 / 每日经验道具；打怪经验在打怪面板配置） ── */
.rate-modal-body--cols {
  overflow: hidden;
  max-height: none;
}
.rate-columns {
  display: grid; grid-template-columns: repeat(2, 1fr);
  gap: 10px; align-items: stretch; min-height: 0;
}
.rate-column {
  background: var(--color-surface-2);
  border: 0.5px solid var(--color-border-light);
  border-radius: var(--radius-sm);
  display: flex; flex-direction: column; min-height: 0;
  overflow: hidden;
}
.rate-column-head {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 10px; font-size: 12px; font-weight: 650; color: var(--color-text);
  background: var(--color-surface-1);
  border-bottom: 0.5px solid var(--color-border-light);
  flex-shrink: 0;
}
.rate-column-count {
  font-size: 10.5px; font-weight: 500; color: var(--color-text-tertiary);
}
.rate-column-body {
  overflow-y: auto; max-height: 56vh; min-height: 120px;
  padding: 6px; display: flex; flex-direction: column; gap: 4px;
}
.rate-column-empty {
  margin: 6px; padding: 22px 10px; text-align: center; font-size: 11.5px;
  color: var(--color-text-tertiary); line-height: 1.6;
  border: 1px dashed var(--color-border); border-radius: 6px;
}
.rate-column .rate-row { padding: 5px 8px; }
.rate-column .rate-task-name {
  flex: 1; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.rate-item-name-group {
  display: flex; align-items: center; gap: 3px;
  flex: 1; min-width: 0;
}
.rate-item-name-group .rate-task-name { flex: 1; }
.rate-item-btn {
  width: 18px; height: 18px; flex-shrink: 0;
  border: none; border-radius: 4px; background: transparent;
  color: var(--color-text-tertiary); font-size: 10px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: all 0.12s;
}
.rate-item-btn:hover { background: var(--color-surface-3); color: var(--color-text); }
.rate-item-del:hover { background: rgba(220, 53, 69, 0.12); color: var(--color-danger, #dc3545); }
/* 道具周期切换（每天/每周） */
.rate-item-period {
  flex-shrink: 0; padding: 2px 6px; font-size: 9.5px; font-family: inherit;
  border: 1px solid var(--color-border-light); border-radius: 3px;
  background: transparent; color: var(--color-text-tertiary); cursor: pointer;
  white-space: nowrap; transition: all 0.12s;
}
.rate-item-period:hover { border-color: var(--color-accent); color: var(--color-accent); }
.rate-item-period--weekly {
  background: var(--color-accent-bg); color: var(--color-accent);
  border-color: var(--color-accent-ring); font-weight: 600;
}
/* 道具开放日编辑条（倍率弹窗展开行） */
.rate-item-days-bar {
  display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
  padding: 4px 6px;
  background: var(--color-surface-1);
  border: 0.5px dashed var(--color-border-light); border-radius: 4px;
}
.rate-item-days-hint {
  font-size: 10px; color: var(--color-text-tertiary);
  margin-right: 2px; flex-shrink: 0;
}
.rate-item-name-input {
  flex: 1; min-width: 0; padding: 3px 6px; font-size: 12px; font-family: inherit;
  border: 1px solid var(--color-accent); border-radius: 4px;
  background: var(--color-surface-1); color: var(--color-text); outline: none;
}
.rate-item-add-btn {
  margin-left: auto; padding: 2px 8px; font-size: 10.5px; font-family: inherit;
  border: 1px dashed var(--color-border); border-radius: 4px;
  background: transparent; color: var(--color-text-secondary); cursor: pointer;
  transition: all 0.12s;
}
.rate-item-add-btn:hover {
  border-color: var(--color-accent); color: var(--color-accent);
  background: var(--color-accent-bg);
}
@media (max-width: 860px) {
  .rate-columns { grid-template-columns: 1fr; }
  .rate-column-body { max-height: 40vh; }
}

/* 封印加速 */
.ec-accel-toggle {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 0; margin-bottom: 8px;
  font-size: 13px; color: var(--color-text); cursor: pointer; user-select: none;
}
.ec-accel-toggle input[type="checkbox"] {
  accent-color: var(--color-accent); width: 16px; height: 16px; cursor: pointer;
}

/* 等级段倍率提示 */
.rate-level-hint {
  font-size: 10.5px; color: var(--color-success); font-weight: 500;
  margin-left: 6px; white-space: nowrap;
}

/* 等级段倍率编辑表 */
.lvmult-table-wrap {
  overflow-x: auto; margin-top: 6px;
}
.lvmult-table {
  width: 100%; border-collapse: collapse; font-size: 12px;
}
.lvmult-table th {
  padding: 6px 10px; text-align: left; font-size: 11px; font-weight: 550;
  color: var(--color-text-secondary); background: var(--color-surface-2);
  border-bottom: 0.5px solid var(--color-border-light);
}
.lvmult-table td {
  padding: 5px 10px; border-bottom: 0.5px solid var(--color-border-light);
}
.lvmult-td-range {
  color: var(--color-text-secondary); min-width: 100px;
}
.lvmult-td-mult {
  width: 90px;
}
.lvmult-table .rate-input {
  width: 70px; padding: 4px 6px;
  font-size: 12px; font-family: inherit;
  background: var(--color-surface-2); color: var(--color-text);
  border: 0.5px solid var(--color-border); border-radius: 4px;
}
.lvmult-table .rate-input:focus {
  outline: none; border-color: var(--color-accent-ring);
}

/* 统一倍率弹窗 sub-tabs */
.ec-subtabs {
  display: flex; gap: 2px; margin: 0 12px;
  background: var(--color-surface-2); border-radius: 6px; padding: 2px;
}
.ec-subtab {
  padding: 4px 14px; font-size: 12px; font-weight: 500; font-family: inherit;
  border: none; border-radius: 5px; cursor: pointer;
  background: transparent; color: var(--color-text-secondary);
  transition: all 0.12s;
}
.ec-subtab:hover { color: var(--color-text); }
.ec-subtab--active {
  background: var(--color-surface-1); color: var(--color-accent);
  box-shadow: 0 0.5px 2px rgba(0,0,0,0.08);
}

/* 等级段倍率编辑：level input cells */
.lvmult-td-lv { width: 90px; }
.lvmult-td-mult { width: 90px; }
.lvmult-td-act { width: 32px; text-align: center; }
.lvmult-th-act { width: 32px; }

/* 等级段倍率：增删按钮 */
.lvmult-del-btn, .lvmult-del-act {
  width: 22px; height: 22px; border-radius: 4px;
  border: none; background: transparent;
  color: var(--color-text-tertiary); font-size: 12px;
  cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  transition: all 0.12s;
}
.lvmult-del-btn:hover, .lvmult-del-act:hover {
  background: rgba(220, 53, 69, 0.12); color: var(--color-danger, #dc3545);
}
.lvmult-del-act {
  margin-left: auto; font-size: 11px;
}

.lvmult-add-btn {
  margin-top: 8px; padding: 5px 14px; font-size: 11.5px; font-weight: 500; font-family: inherit;
  border: 1px dashed var(--color-border); border-radius: 4px;
  background: transparent; color: var(--color-text-secondary); cursor: pointer;
  transition: all 0.12s;
}
.lvmult-add-btn:hover {
  border-color: var(--color-accent); color: var(--color-accent);
  background: var(--color-accent-bg);
}

.lvmult-add-act {
  margin-top: 12px; text-align: center;
}

@media (max-width: 700px) {
  .ec-calc-body { flex-direction: column; }
  .ec-sidebar-col { width: auto; max-height: 240px; }
  .ec-panel { flex: 1 1 auto; }
  .ec-task-grid { grid-template-columns: repeat(2, 1fr); }
  .ec-result-cards { grid-template-columns: 1fr; }
  .ec-toolbar { flex-direction: column; align-items: stretch; }
}

/* ── 减伤标准表 ── */
.dr-wrap {
  display: flex; flex-direction: column; gap: 18px;
}
.dr-section {
  display: flex; flex-direction: column; gap: 8px;
}
.dr-section-title {
  font-size: 14px; font-weight: 700; margin: 0;
  color: var(--color-text);
}
.dr-table-wrap {
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-light);
  background: var(--color-surface-1);
  overflow: auto;
}
.dr-table {
  width: 100%; border-collapse: separate; border-spacing: 0;
  table-layout: fixed; min-width: 420px;
}
.dr-table thead {
  position: sticky; top: 0; z-index: 2;
}
.dr-table th {
  padding: 10px 8px; font-size: 13px; font-weight: 700;
  text-align: center; color: #2e7d32;
  background: #e8f5e9;
  border-right: 1px solid rgba(0,0,0,0.06);
  border-bottom: 2px solid #c8e6c9;
  white-space: nowrap;
}
.dr-table th:last-child { border-right: none; }
.dr-table td {
  padding: 8px 8px; font-size: 13px;
  text-align: center; line-height: 1.5;
  border-right: 1px solid var(--color-border-light);
  border-bottom: 0.5px solid var(--color-border-light);
  vertical-align: middle; color: var(--color-text-secondary);
}
.dr-table td:last-child { border-right: none; }
.dr-table tbody tr:nth-child(even) td {
  background: var(--color-surface-2);
}
.dr-table tbody tr:hover td {
  background: var(--color-accent-bg);
}
.dr-table tbody tr:last-child td { border-bottom: none; }
.dr-th-name { width: 30%; }
.dr-table--wild .dr-th-name { width: 40%; }
.dr-td-name {
  font-weight: 700; color: var(--color-text);
}

/* ── 韧性表 ── */
.toughness-wrap { display: flex; flex-direction: column; gap: 10px; }
.toughness-calc-label { font-size: 12px; color: var(--color-text-secondary); white-space: nowrap; }
/* 区间计算结果卡片：属性变化 / 加点消耗 / 市场成本 分段展示 */
.toughness-calc {
  display: flex; flex-direction: column; gap: 6px;
  padding: 10px 12px; border-radius: var(--radius-sm);
  background: var(--color-surface-1); border: 0.5px solid var(--color-border-light);
}
.toughness-calc-line {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  font-size: 12.5px; line-height: 1.6;
}
.toughness-calc-line-label {
  font-size: 12px; color: var(--color-text-tertiary);
  white-space: nowrap; flex-shrink: 0;
}
.toughness-calc-value { color: var(--color-text); font-variant-numeric: tabular-nums; white-space: nowrap; }
.toughness-calc-cost { color: var(--color-accent); font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
.toughness-calc-sep { color: var(--color-border-strong, rgba(128,128,128,0.35)); }
.toughness-calc-missing { color: var(--color-text-tertiary); white-space: nowrap; }
.toughness-calc-err {
  padding: 10px 12px; border-radius: var(--radius-sm);
  border: 0.5px dashed var(--color-danger);
  color: var(--color-danger); font-size: 12.5px;
}
.toughness-price-input { width: 60px; }
.toughness-table.toughness-table { min-width: 720px; }
.toughness-table .tough-th-level { width: 60px; }
.toughness-table .tough-td-level { font-weight: 600; color: var(--color-text); }
.toughness-table .tough-td-dr { font-weight: 600; color: var(--color-accent); }
</style>
