<template>
  <div class="page">
    <div class="page-head">
      <h2>养成宝典</h2>
      <p>资产 → 攒钱 → 解锁节点 → 装备落地，搬砖收入看得见</p>
    </div>

    <div v-if="loading" class="hint">加载中...</div>

    <!-- ── 开局引导 / 新建宝典：无激活宝典或主动新建时 ── -->
    <div v-else-if="showSetup || journeys.length === 0" class="setup-card">
      <div class="setup-title"><AppIcon icon="sparkles" :size="16" /> {{ wallet ? '新建宝典' : '开启宝典' }}</div>
      <p class="setup-desc">
        从「配号中心」应用一份方案作为<b>当前配置</b>，另一份作为<b>目标配置</b>。
        流动资金达到节点价格即解锁节点，点击节点将装备应用到当前配置，代表更进一步。
      </p>
      <div class="setup-form">
        <label class="field-label">当前配置（代表现有装备）</label>
        <select class="field-select" v-model="setupCurrentId">
          <option :value="0">空白开局（当前无装备）</option>
          <option v-for="s in schemes" :key="s.id" :value="s.id">{{ s.name }}（{{ s.job || '未设职业' }} · {{ s.level_num }}级）</option>
        </select>
        <label class="field-label">目标配置（要达成的方案，需与当前配置同职业）</label>
        <select class="field-select" v-model="setupTargetId">
          <option :value="0" disabled>选择目标方案</option>
          <option v-for="s in setupTargetCandidates" :key="s.id" :value="s.id">{{ s.name }}（{{ s.job || '未设职业' }} · {{ s.level_num }}级）</option>
        </select>
        <span v-if="setupJobFilter && setupTargetCandidates.length === 0" class="setup-warn">没有与当前配置职业「{{ setupJobFilter }}」相同的方案 — 先到「配号中心」创建</span>
        <label class="field-label">初始流动资金（万三国币，留空为 0）
          <input class="field-input" type="number" min="0" step="0.01" v-num="setupLiquidWan"
            @input="setupLiquidWan = ($event.target as HTMLInputElement).value" />
        </label>
      </div>
      <div class="setup-hint">
        <AppIcon icon="info" :size="12" />
        每个宝典独立记账（流动资金、活跃收入、流水互不影响）。本宝典投入 = 当前配置装备价值（按图鉴市场价）+ 后续现金解锁；流动资金从「初始流动资金」起步，靠收支条目记账积累，之后可随时点顶部「流动」校正为游戏内实际金额。
      </div>
      <div class="setup-actions">
        <button class="btn btn-accent" :disabled="!setupTargetId || setupSaving" @click="openBook">
          <AppIcon icon="rocket" :size="13" /> {{ setupSaving ? '开启中...' : (wallet ? '创建宝典' : '开启宝典') }}
        </button>
        <button v-if="wallet && journeys.length > 0" class="btn btn-ghost" @click="showSetup = false">取消</button>
        <span v-if="schemes.length === 0" class="setup-warn">尚未找到本大区方案 — 先到「配号中心」创建</span>
      </div>
    </div>

    <!-- ── 主态：单页纵排 ── -->
    <template v-else>
      <!-- 指标条（弱化，一眼扫过即可） -->
      <div class="metrics-bar">
        <span class="mx" :title="`本宝典投入 = 开宝典时全身装备价值 ${fmtWan(journey?.starting_basis ?? 0)} + 现金解锁累计 ${fmtWan(cashInjected)}`">
          <span class="mx-label">投入</span><span class="mx-value">{{ fmtWan(journeyInvested) }}</span>
        </span>
        <span class="mx-sep"></span>
        <span class="mx" title="总资产 = 流动资金 + 固定装备（当前配置现值）+ 背包道具">
          <span class="mx-label">总资产</span><span class="mx-value">{{ fmtWan(totalAsset) }}</span>
        </span>
        <span class="mx-sep"></span>
        <span class="mx mx--click" title="流动资金 = 初始流动 + 收入 − 支出 + 校正；点击调整（校正账面与游戏内实际金额不符）" @click="openLiquidModal">
          <span class="mx-label">流动</span><span class="mx-value">{{ fmtWan(liquid) }}</span>
          <AppIcon icon="pencil" :size="10" class="mx-edit" />
        </span>
        <span class="mx-sep"></span>
        <span class="mx"><span class="mx-label">固定</span><span class="mx-value">{{ fmtWan(fixedValue) }}</span></span>
        <span class="mx-sep"></span>
        <span class="mx mx--click" title="背包材料按图鉴市场价实时折算，点击盘点（产出/买入入背包，卖出扣减）" @click="showBpModal = true">
          <span class="mx-label">背包</span><span class="mx-value">{{ fmtWan(backpackValue) }}</span>
        </span>
        <span class="mx-sep"></span>
        <span class="mx"><span class="mx-label">今日净收</span>
          <span class="mx-value" :class="todayNet > 0 ? 'mx-value--up' : todayNet < 0 ? 'mx-value--down' : ''">{{ (todayNet > 0 ? '+' : '') + fmtWan(todayNet) }}</span>
        </span>
        <span class="mx-sep"></span>
        <span class="mx" :title="daysHint">
          <span class="mx-label">距下一节点</span>
          <span class="mx-value">{{ daysToNextLabel }}</span>
        </span>
      </div>

      <!-- 宝典切换条 -->
      <div class="journey-bar" v-if="journeys.length > 0">
        <span class="journey-label"><AppIcon icon="scroll" :size="12" /> 宝典</span>
        <button v-for="j in journeys" :key="j.id" class="journey-chip"
          :class="{ 'journey-chip--on': journey?.id === j.id }" @click="selectJourney(j.id)"
          :title="`切换到「${j.name}」（共享账号钱包与流水）`">
          {{ j.name }}<small>{{ j.nodes.filter(n => n.claimed).length }}/{{ j.nodes.length }}</small>
        </button>
        <button class="journey-chip journey-chip--add" @click="startNewJourney">
          <AppIcon icon="plus" :size="11" /> 新建宝典
        </button>
        <button class="journey-chip journey-chip--del" @click="deleteJourney"
          :title="`删除当前宝典「${journey?.name}」及其流水（不可恢复）`">
          <AppIcon icon="trash" :size="11" /> 删除宝典
        </button>
      </div>

      <!-- ═══ 宝典进度（第一屏） ═══ -->
      <section class="sec">
        <div class="book-head">
          <span class="sec-title"><AppIcon icon="sparkles" :size="13" /> 宝典进度</span>
          <span class="book-progress"><b>{{ claimedCount }}</b> / {{ nodes.length }} 节点</span>
          <span class="book-remain" v-if="nextNode">还差 <b>{{ fmtWan(remainingCost) }}</b> 解锁「{{ nextNode.slot }} · {{ nextNode.toItem }}」</span>
          <span class="book-remain book-remain--done" v-else-if="nodes.length > 0">
            宝典达成 🎉
            <button class="btn btn-accent btn-xs" @click="openTargetModal"><AppIcon icon="target" :size="11" /> 设定新目标</button>
          </span>
          <span class="tab-actions">
            <button class="btn btn-ghost btn-xs" @click="openCfg()"><AppIcon icon="grid" :size="11" /> 配置对比</button>
            <button class="btn btn-ghost btn-xs" @click="openTargetModal" title="以相同职业的新方案替换当前目标"><AppIcon icon="target" :size="11" /> 更换目标</button>
            <button class="btn btn-ghost btn-xs" @click="openOrderModal"><AppIcon icon="list" :size="11" /> 节点顺序</button>
          </span>
        </div>
        <div class="node-track" ref="nodeTrackEl" @wheel="onTrackWheel" v-if="nodes.length > 0">
          <div v-for="(n, i) in nodes" :key="nodeKey(n)" class="node"
            :class="[{ 'node--dragging': dragKey === nodeKey(n), 'node--dragover': dragOverKey === nodeKey(n) && dragKey !== nodeKey(n) }, 'node--' + nodeState(n)]"
            :style="nodeProgressStyle(n)"
            :draggable="!n.claimed"
            :title="n.claimed
              ? '已解锁（按解锁时间排列）'
              : nodeState(n) === 'locked'
                ? `解锁进度 ${liquid >= 0 ? Math.min(100, Math.round((liquid / Math.max(n.cost, 1)) * 100)) : 0}%（流动 ${fmtWan(liquid)} / 需 ${fmtWan(n.cost)}）· 拖动调整优先级`
                : '拖动调整解锁优先级（当前第 ' + (i + 1) + ' 位）'"
            @click="onNodeClick(n)"
            @dragstart="onNodeDragStart(n, $event)"
            @dragover="onNodeDragOver(n, $event)"
            @drop.prevent="onNodeDrop(n)"
            @dragend="dragKey = null; dragOverKey = null">
            <div class="node-dot"><AppIcon :icon="nodeIcon(n)" :size="13" /></div>
            <div class="node-idx">第 {{ i + 1 }} 站 · {{ slotLabel(n.slot) }}<template v-if="(n.round ?? 0) > 0"> · 第{{ (n.round ?? 0) + 1 }}轮</template></div>
            <div class="node-item" :title="n.toItem">{{ n.toItem }}</div>
            <div class="node-cost">
              <template v-if="n.claimed">已入手 {{ fmtWan(n.paid) }}{{ n.cash ? '（现金）' : n.manual ? '（手动）' : '' }}</template>
              <template v-else-if="nodeState(n) === 'unlocked'">可解锁 · {{ fmtWan(n.cost) }}</template>
              <template v-else>需 {{ fmtWan(n.cost) }}</template>
            </div>
          </div>
        </div>
        <div v-else class="hint hint--cta">
          当前配置与目标配置已一致，没有待达成节点。
          <button class="btn btn-accent btn-xs" @click="openTargetModal"><AppIcon icon="target" :size="11" /> 设定新目标</button>
        </div>
      </section>

      <!-- ═══ 今日账单（记账：一次提交） ═══ -->
      <section class="sec sec--grow">
        <div class="book-head">
          <span class="sec-title"><AppIcon icon="calculator" :size="13" /> 今日账单</span>
          <span v-if="todayBillExists" class="bill-submited"><AppIcon icon="circle-check" :size="11" /> 已提交 · 修改后重新提交将覆盖今天</span>
          <span class="tab-actions">
            <button class="btn btn-ghost btn-xs" @click="openLiquidModal"
              title="校正账面金额与游戏内实际不符（漏记、赠礼、手续费等），不计入今日净收">
              <AppIcon icon="coins" :size="11" /> 调整资金
            </button>
            <button class="btn btn-ghost btn-xs" @click="openCalModal"><AppIcon icon="calendar" :size="11" /> 收益日历</button>
          </span>
        </div>
        <div class="bill-grid">
          <!-- 活跃收入 -->
          <div class="ledger-card">
            <div class="ledger-card-head">
              <span class="ledger-card-title"><AppIcon icon="activity" :size="13" /> 活跃收入</span>
              <span class="tab-actions">
                <button class="btn btn-ghost btn-xs" @click="openCharsModal"><AppIcon icon="users" :size="11" /> 设置号</button>
                <button class="btn btn-ghost btn-xs" @click="openTierEdit"><AppIcon icon="pencil" :size="11" /> 档位工资</button>
              </span>
            </div>
            <div class="tier-hint">档位为累计收入：2 档 = 1+2 档之和，3 档 = 1+2+3 档之和；点已选档位取消（今天没打）</div>
            <div class="list-area">
              <div v-if="chars.length === 0" class="ledger-empty">
                还没有配置号 — 点「设置号」添加有几个号、各是什么等级
              </div>
              <div v-for="(c, i) in chars" :key="i" class="char-row">
                <span class="char-name" :title="c.name">{{ c.name || '号' + (i + 1) }}</span>
                <span class="char-band">{{ c.band }}级</span>
                <button v-for="t in [1, 2, 3]" :key="t" class="tier-btn"
                  :class="{ 'tier-btn--on': charTiers[i] === t }" @click="pickTier(i, t)">
                  {{ t }}档<small>{{ tierCumAmountWan(c.band, t) }}w</small>
                </button>
                <span class="char-amt">{{ charTiers[i] ? '+' + fmtWanShort(wanNumToYi(tierCumAmountWan(c.band, charTiers[i]))) : '' }}</span>
              </div>
            </div>
            <div class="ledger-total">活跃合计 <b>{{ fmtWan(activeTotalYi) }}</b></div>
          </div>

          <!-- 流水条目（道具 + 直录合并） -->
          <div class="ledger-card">
            <div class="ledger-card-head">
              <span class="ledger-card-title"><AppIcon icon="package" :size="13" /> 收支条目</span>
            </div>
            <div class="entry-input-row">
              <button class="dir-flip" :class="entryDirection === 'income' ? 'dir-flip--in' : 'dir-flip--out'"
                :title="entryDirection === 'income' ? '当前记收入 · 点击切换为支出' : '当前记支出 · 点击切换为收入'"
                @click="flipEntryDirection">
                <AppIcon icon="refresh" :size="11" /> {{ entryDirection === 'income' ? '收入' : '支出' }}
              </button>
              <div v-if="!entryParam" class="item-search">
                <input class="field-input" type="text" v-model="entryQuery" placeholder="搜索物价图鉴（留空显示最近录入）"
                  @input="entryParam = null"
                  @focus="entrySearchFocused = true"
                  @blur="entrySearchFocused = false" />
                <div v-if="entrySearchFocused && !entryParam && entryQuery.trim() === '' && recentItems.length > 0" class="item-drop">
                  <div class="item-drop-head">最近录入</div>
                  <button v-for="p in recentItems" :key="p.id" class="item-drop-row" @mousedown.prevent @click="pickItem(p)">
                    <span class="item-drop-name">{{ p.item_name }}</span>
                    <span class="item-drop-meta">{{ p.category }} · 市 {{ fmtWan(p.market_price) }}</span>
                  </button>
                </div>
                <div v-else-if="entrySearchFocused && !entryParam && entryQuery.trim() !== '' && entryMatches.length > 0" class="item-drop">
                  <button v-for="p in entryMatches" :key="p.id" class="item-drop-row" @mousedown.prevent @click="pickItem(p)">
                    <span class="item-drop-name">{{ p.item_name }}</span>
                    <span class="item-drop-meta">{{ p.category }} · 市 {{ fmtWan(p.market_price) }}</span>
                  </button>
                </div>
              </div>
              <!-- 选中道具后：一行显示 方向 | 名称 | 数量 | 卖出来源 | 单价，名称完整展示 -->
              <div v-else class="entry-item-name" :title="`${entryParam.item_name} · 市 ${fmtWan(entryParam.market_price)}`">
                <span class="entry-item-name-text">{{ entryParam.item_name }}</span>
                <button class="entry-item-clear" @click="clearEntryItem" title="重选物品"><AppIcon icon="x" :size="11" /></button>
              </div>
              <label v-if="entryParam" class="entry-mini-field entry-mini-field--qty">
                <span>数量</span>
                <input class="field-input" type="number" min="1" step="1" v-num="entryQty"
                  @input="entryQty = ($event.target as HTMLInputElement).value" />
              </label>
              <label v-if="entryParam && entryDirection === 'income'" class="entry-mini-field entry-mini-field--bp"
                :title="'卖出的是背包里的存货选「背包出库」（自动扣减背包数量），当日产出直接卖选「产出即卖」（背包不动）'">
                <span>卖出来源<template v-if="bpStockOf(entryParam) > 0"> · 背包 {{ bpStockOf(entryParam) }}</template></span>
                <button class="bp-toggle" :class="{ 'bp-toggle--on': entryFromBackpack }" @click="entryFromBackpack = !entryFromBackpack">
                  <AppIcon icon="backpack" :size="11" /> {{ entryFromBackpack ? '背包出库' : '产出即卖' }}
                </button>
              </label>
              <label class="entry-mini-field entry-mini-field--amt"
                :title="entryParam ? `图鉴市价 ${fmtWan(entryParam.market_price)}，默认已按市价填写` : ''">
                <span>{{ entryParam ? '单价（万）' : '金额（万）' }}</span>
                <input class="field-input" type="number" min="0" step="0.01" v-num="entryUnitWan"
                  @input="entryUnitWan = ($event.target as HTMLInputElement).value" />
              </label>
            </div>
            <button class="btn btn-ghost entry-add" :disabled="wanToYi(entryUnitWan) <= 0" @click="addEntry">
              <AppIcon icon="plus" :size="12" /> 加入账单
            </button>
            <div class="list-area">
              <div v-if="entries.length === 0" class="ledger-empty">暂无条目 — 道具买卖和零散收支都在这里添加</div>
              <div v-for="e in entries" :key="e.key" class="entry-row">
                <button class="rec-badge entry-dir" :class="e.direction === 'income' ? 'rec-badge--in' : 'rec-badge--out'"
                  :disabled="e.committed"
                  :title="e.committed
                    ? '已计入今日账单 — 改动后重新提交今日账单生效'
                    : (e.direction === 'income' ? '收入 · 点击切换为支出' : '支出 · 点击切换为收入')"
                  @click="toggleEntryDir(e.key)">
                  {{ e.direction === 'income' ? '收' : '支' }}
                </button>
                <button v-if="e.kind === 'item' && e.direction === 'income'" class="bp-chip"
                  :class="e.fromBackpack ? 'bp-chip--on' : 'bp-chip--off'" :disabled="e.committed"
                  :title="e.committed
                    ? '已计入今日账单 — 改动后重新提交今日账单生效'
                    : (e.fromBackpack ? '卖出已从背包扣减 · 点击改为产出即卖' : '产出即卖（背包不动）· 点击改为从背包扣减')"
                  @click="flipEntryBp(e)">
                  <AppIcon icon="backpack" :size="10" /> {{ e.fromBackpack ? '背包出库' : '产出即卖' }}
                </button>
                <span class="entry-detail">{{ entryText(e) }}</span>
                <span class="rec-amount" :class="e.direction === 'income' ? 'rec-amount--in' : 'rec-amount--out'">
                  {{ (e.direction === 'income' ? '+' : '−') + fmtWanShort(wanNumToYi(entryAmountWan(e))) }}
                </span>
                <button class="btn btn-xs" :class="e.committed ? 'btn-ghost' : 'btn-accent'" :disabled="e.committed"
                  :title="e.committed ? '已计入今日账单 — 改动后重新提交今日账单生效' : '立即单独计入今日账单（不影响其他条目）'"
                  @click="commitEntry(e)">
                  <AppIcon icon="check" :size="11" /> {{ e.committed ? '已计入' : '计入' }}
                </button>
                <button class="band-del" @click="removeEntry(e.key)" title="移除"><AppIcon icon="x" :size="11" /></button>
              </div>
            </div>
            <div class="ledger-total">条目合计 <b>{{ (entriesTotalYi >= 0 ? '+' : '') + fmtWan(entriesTotalYi) }}</b></div>
          </div>
        </div>

        <!-- 一次提交 -->
        <div class="bill-footer">
          <span class="bill-net">今日合计
            <b :class="billNetYi >= 0 ? 'mx-value--up' : 'mx-value--down'">{{ (billNetYi >= 0 ? '+' : '') + fmtWan(billNetYi) }}</b>
          </span>
          <button class="btn btn-accent" @click="submitBill">
            <AppIcon icon="save" :size="12" /> {{ todayBillExists ? '重新提交今日账单' : '提交今日账单' }}
          </button>
        </div>
      </section>

    </template>

    <!-- ── 节点顺序弹窗 ── -->
    <div v-if="showOrderModal" class="overlay" @click.self="showOrderModal = false">
      <div class="modal">
        <div class="modal-title"><AppIcon icon="list" :size="15" /> 节点解锁顺序</div>
        <div class="modal-sub">越靠前越先解锁（决定「距下一节点」）；已解锁节点固定置前，不参与排序。主界面节点轨道也可直接拖动调整。</div>
        <div v-if="pendingOrder.length === 0" class="ledger-empty">没有待解锁节点 — 已全部达成</div>
        <div v-else class="order-list">
          <div v-for="(n, i) in pendingOrder" :key="nodeKey(n)" class="order-row"
            :class="{ 'order-row--hot': nodeState(n) === 'unlocked' }">
            <span class="order-idx">{{ i + 1 }}</span>
            <span class="order-slot">{{ slotLabel(n.slot) }}</span>
            <span class="order-item" :title="n.toItem">{{ n.toItem }}</span>
            <span class="order-cost">{{ fmtWan(n.cost) }}</span>
            <button class="btn btn-xs btn-ghost" :disabled="i === 0" @click="moveNode(n, -1)" title="上移"><AppIcon icon="chevron-up" :size="11" /></button>
            <button class="btn btn-xs btn-ghost" :disabled="i === pendingOrder.length - 1" @click="moveNode(n, 1)" title="下移"><AppIcon icon="chevron-down" :size="11" /></button>
          </div>
        </div>
        <button class="btn btn-ghost modal-btn" :disabled="pendingOrder.length === 0" @click="sortByCost">
          <AppIcon icon="arrow-up" :size="12" /> 按价格升序恢复
        </button>
      </div>
    </div>

    <!-- ── 调整目标配置弹窗（只做「替换为新方案」；逐槽位微调请用「配置对比」） ── -->
    <div v-if="showTargetModal" class="overlay" @click.self="showTargetModal = false">
      <div class="modal modal--wide">
        <div class="modal-title"><AppIcon icon="target" :size="15" /> 调整目标配置</div>
        <div class="modal-sub">
          以所选方案作为全新目标（仅限同职业）：已解锁节点（已入手装备）原样保留为历史站，只重算待解锁节点。方案未配置的槽位不再作为目标，对应未解锁节点会被取消。逐槽位微调请用「配置对比」。
        </div>

        <div class="tg-now">
          <span>已达成 <b>{{ claimedCount }}</b> 站</span>
          <span>待解锁 <b>{{ nodes.length - claimedCount }}</b> 站</span>
          <span>剩余门槛 <b>{{ fmtWan(pendingCost) }}</b></span>
        </div>

        <label class="field-label">新目标方案{{ journeyJob ? `（仅限「${journeyJob}」职业）` : '' }}</label>
        <select class="field-select" v-model="targetSchemeId">
          <option :value="0" disabled>选择方案</option>
          <option v-for="s in targetSchemeCandidates" :key="s.id" :value="s.id">{{ s.name }}（{{ s.job || '未设职业' }} · {{ s.level_num }}级）</option>
        </select>
        <div v-if="targetSchemeCandidates.length === 0" class="setup-warn">{{ journeyJob ? `没有与当前职业「${journeyJob}」相同的方案 — 先到「配号中心」创建` : '尚未找到本大区方案 — 先到「配号中心」创建' }}</div>

        <label class="field-label">宝典名称（留空保持原名「{{ journey?.name }}」）
          <input class="field-input" type="text" v-model="targetNameInput" :placeholder="targetNameSuggest" />
        </label>

        <template v-if="targetReady">
          <div class="tg-preview">
            <div class="tg-preview-row"><span>新增节点</span><b class="tg-num--add">+{{ targetPreview.added }}</b></div>
            <div class="tg-preview-row"><span>目标变更</span><b class="tg-num--chg">~{{ targetPreview.updated }}</b></div>
            <div class="tg-preview-row"><span>取消节点</span><b class="tg-num--del">−{{ targetPreview.dropped }}</b></div>
            <div class="tg-preview-row tg-preview-row--total">
              <span>调整后待解锁</span><b>{{ targetPreview.pendingCount }} 站 · {{ fmtWan(targetPreview.pendingCost) }}</b>
            </div>
          </div>
          <button class="btn btn-accent modal-btn" :disabled="targetSaving" @click="confirmTargetChange">
            <AppIcon icon="check" :size="13" /> {{ targetSaving ? '更新中...' : '更新目标并重建节点' }}
          </button>
        </template>
        <div v-else class="tg-preview tg-preview--empty">选择方案后查看变更预览</div>
      </div>
    </div>

    <!-- ── 配置对比弹窗（当前 vs 目标同屏对比，目标槽位可直接改选 = 原逐槽位调整） ── -->
    <div v-if="showCurModal" class="overlay" @click.self="showCurModal = false">
      <div class="modal modal--cfg">
        <!-- 极简工具面板：仅页签 + 槽位编辑，右上角提供关闭 -->
        <nav class="cfg-nav">
          <button v-for="t in CFG_TABS" :key="t.key" class="cfg-tab"
            :class="{ 'cfg-tab--on': cfgTab === t.key }" @click="cfgTab = t.key">
            <span class="cfg-tab-icon"><AppIcon :icon="t.icon" :size="14" /></span>
            <span class="cfg-tab-name">{{ t.label }}</span>
            <small v-if="cfgTabCounts[t.key] > 0" class="cfg-tab-cnt">{{ cfgTabCounts[t.key] }}</small>
          </button>
          <button class="cfg-close" @click="showCurModal = false" title="关闭（ESC）"><AppIcon icon="x" :size="15" /></button>
        </nav>

        <!-- 灵兽分类二级页签（固定不滚动） -->
        <div v-if="cfgTab === 'beast' && beastCatRows.length > 1" class="cfg-sub">
          <button v-for="g in beastCatRows" :key="g.cat" class="cfg-tab cfg-tab--sub"
            :class="{ 'cfg-tab--on': beastCat === g.cat }" @click="beastCat = g.cat">
            {{ g.cat }}<small> {{ g.rows.length }}</small>
          </button>
        </div>

        <!-- 槽位编辑（当前只读 → 目标可改），唯一滚动区 -->
        <section class="cfg-sheet">
          <div class="tg-custom">
            <div v-for="g in cfgGroups" :key="g.cat" class="tg-cs-group">
              <div class="tg-cs-group-label">{{ cfgTabLabel }}<template v-if="cfgTab === 'beast'"> · {{ g.cat }}</template></div>
              <div class="tg-cs-head"><span>槽位</span><span>当前</span><span>目标</span><span></span></div>
              <div v-for="cs in g.rows" :key="cs.slot" class="tg-cs-row"
                :class="{ 'tg-cs-row--chg': cs.picked || cs.cleared, 'tg-cs-row--diff': csDiffers(cs) }">
                <div class="tg-cs-slot" :title="cs.slot">{{ customSlotLabel(cs.slot) }}</div>
                <div class="tg-cs-cell">
                  <input class="field-input tg-cs-input tg-cs-input--ro" type="text" :value="cs.current"
                    :style="{ color: getQualityColor(curQualityOf(cs)) }"
                    placeholder="（空）" readonly tabindex="-1" title="当前配置（不可修改）" />
                  <span class="tg-cs-price">{{ cs.current && curPriceOf(cs) > 0 ? fmtWan(curPriceOf(cs)) : '—' }}</span>
                </div>
                <div class="tg-cs-cell">
                  <template v-if="!cs.cleared">
                    <div class="item-search">
                      <input class="field-input tg-cs-input" type="text" v-model="cs.query"
                        :style="{ color: tgtInputColor(cs) }"
                        placeholder="搜索图鉴物品…"
                        @focus="cs.focused = true" @blur="cs.focused = false"
                        @input="customQueryInput(cs)" />
                      <div v-if="cs.focused && customMatches(cs).length > 0" class="item-drop">
                        <button v-for="p in customMatches(cs)" :key="p.id" class="item-drop-row" @mousedown.prevent="customPickSlot(cs, p)">
                          <span class="item-drop-name" :style="{ color: getQualityColor(p.quality) }">{{ p.item_name }}</span>
                          <span class="sdi-img" v-if="optionHasImage(p)" @mousedown.stop.prevent="viewOptionImage(p)" title="查看图片"><AppIcon icon="image" :size="13" /></span>
                          <span class="item-drop-meta">{{ dropMeta(p) }}</span>
                        </button>
                      </div>
                    </div>
                    <span class="tg-cs-price">{{ (cs.picked || cs.target) && tgtPriceOf(cs) > 0 ? fmtWan(tgtPriceOf(cs)) : '—' }}</span>
                  </template>
                  <span v-else class="tg-cs-cleared">已清除</span>
                </div>
                <div class="tg-cs-act">
                  <button v-if="cs.picked || cs.cleared" class="btn btn-ghost btn-xs" @click="customResetSlot(cs)" title="还原为该槽位原有目标">
                    <AppIcon icon="history" :size="11" /> 还原
                  </button>
                  <button v-else-if="cs.target" class="band-del" @click="customClearSlot(cs)" title="从目标中清除该槽位">
                    <AppIcon icon="x" :size="11" />
                  </button>
                </div>
              </div>
            </div>
            <div v-if="cfgGroups.every(g => g.rows.length === 0)" class="ledger-empty">没有匹配的槽位</div>
          </div>
        </section>

        <!-- 底部操作栏：独立常驻的保存入口（无改动时禁用置灰） -->
        <footer class="cfg-foot">
          <span class="cfg-foot-note" :class="{ 'cfg-foot-note--dirty': cfgHasChanges }">
            {{ cfgHasChanges ? `已调整 ${cfgChangeCount} 处目标槽位` : '当前与目标一致，暂无待保存改动' }}
          </span>
          <button class="btn btn-accent cfg-save" :disabled="cfgSaving || !cfgHasChanges" @click="confirmCfgTarget">
            <AppIcon icon="check" :size="13" /> {{ cfgSaving ? '保存中…' : '保存调整' }}
          </button>
        </footer>
      </div>
    </div>

    <!-- ── 背包资产弹窗 ── -->
    <div v-if="showBpModal" class="overlay" @click.self="showBpModal = false">
      <div class="modal modal--cal">
        <div class="modal-title"><AppIcon icon="backpack" :size="15" /> 背包资产</div>
        <div class="modal-sub">产出/买入入背包（不动资金）；点行内「售出」直接记今日收入并扣减库存。也可在记卖出账单时选「背包出库」自动扣减、「产出即卖」不动背包。当日产出想留库就先在下面入库</div>
        <div class="bp-add">
          <div class="item-search">
            <input class="field-input" type="text" v-model="bpQuery" placeholder="搜索图鉴物品入库（产出登记，不动资金）"
              @focus="bpSearchFocused = true" @blur="bpSearchFocused = false" />
            <div v-if="bpSearchFocused && !bpParam && bpQuery.trim() === '' && recentItems.length > 0" class="item-drop">
              <div class="item-drop-head">最近录入</div>
              <button v-for="p in recentItems" :key="p.id" class="item-drop-row" @mousedown.prevent @click="bpPick(p)">
                <span class="item-drop-name">{{ p.item_name }}</span>
                <span class="item-drop-meta">{{ p.category }} · 市 {{ fmtWan(p.market_price) }}</span>
              </button>
            </div>
            <div v-else-if="bpSearchFocused && !bpParam && bpQuery.trim() !== '' && bpMatches.length > 0" class="item-drop">
              <button v-for="p in bpMatches" :key="p.id" class="item-drop-row" @mousedown.prevent @click="bpPick(p)">
                <span class="item-drop-name">{{ p.item_name }}</span>
                <span class="item-drop-meta">{{ p.category }} · 市 {{ fmtWan(p.market_price) }}</span>
              </button>
            </div>
          </div>
          <label v-if="bpParam" class="entry-mini-field entry-mini-field--qty">
            <span>数量</span>
            <input class="field-input" type="number" min="1" step="1" v-num="bpQty"
              @input="bpQty = ($event.target as HTMLInputElement).value" />
          </label>
          <button class="btn btn-accent" :disabled="!bpParam" @click="bpAdd">
            <AppIcon icon="plus" :size="12" /> 入库
          </button>
        </div>
        <div class="list-area bp-list">
          <div v-if="backpack.length === 0" class="ledger-empty">背包空空如也 — 支出买入的道具提交账单后会自动入到这里</div>
          <div v-for="b in backpack" :key="b.id" class="bp-row" :class="{ 'bp-row--sell': bpSellId === b.id }">
            <template v-if="bpSellId !== b.id">
              <span class="bp-name" :title="b.item_name">{{ b.item_name }}</span>
              <span class="bp-qty">×{{ b.quantity }}</span>
              <span class="bp-price">市 {{ fmtWan(unitMarket(b)) }}</span>
              <span class="bp-sum">{{ fmtWan(unitMarket(b) * b.quantity) }}</span>
              <input class="field-input bp-op-qty" type="number" min="1" step="1" v-num="bpOpQtyOf(b)"
                @input="setBpOpQty(b, ($event.target as HTMLInputElement).value)" />
              <button class="btn btn-ghost btn-xs" :title="`入库 ${bpOpQtyOf(b)} 个（产出登记）`" @click="bpOp(b, 1)"><AppIcon icon="plus" :size="11" /></button>
              <button class="btn btn-ghost btn-xs" :title="`出库 ${bpOpQtyOf(b)} 个（消耗/赠送，不动资金）`" @click="bpOp(b, -1)"><AppIcon icon="x" :size="11" /></button>
              <button class="btn btn-ghost btn-xs bp-sell-btn" :title="`售出 ${bpOpQtyOf(b)} 个（记今日收入并扣减背包）`" @click="bpSellStart(b)"><AppIcon icon="coins" :size="11" /></button>
              <button class="band-del" title="删除记录（纠错用）" @click="bpDel(b)"><AppIcon icon="trash" :size="11" /></button>
            </template>
            <template v-else>
              <span class="bp-name" :title="b.item_name">{{ b.item_name }}</span>
              <span class="bp-qty">×{{ b.quantity }}</span>
              <label class="bp-sell-field">数量
                <input class="field-input bp-sell-qty" type="number" min="1" :max="b.quantity" step="1" v-num="bpSellQty"
                  @input="bpSellQty = ($event.target as HTMLInputElement).value" />
              </label>
              <label class="bp-sell-field">单价(万)
                <input class="field-input bp-sell-wan" type="number" min="0" step="0.01" v-num="bpSellWan"
                  @input="bpSellWan = ($event.target as HTMLInputElement).value" />
              </label>
              <span class="bp-sell-sum" :class="{ 'bp-sell-sum--off': !bpSellValid(b) }">+{{ fmtWan(bpSellPreview) }}</span>
              <button class="btn btn-accent btn-xs" :disabled="!bpSellValid(b)" @click="bpSellConfirm(b)"
                :title="bpSellValid(b) ? '确认售出：扣减背包并记入今日收入' : '需 1 ≤ 数量 ≤ 库存 且单价 > 0'">
                <AppIcon icon="check" :size="11" /> 售出
              </button>
              <button class="btn btn-ghost btn-xs" @click="bpSellCancel"><AppIcon icon="x" :size="11" /> 取消</button>
            </template>
          </div>
        </div>
        <div class="cfg-total">背包总估值 <b>{{ fmtWan(backpackValue) }}</b>（数量 × 图鉴市场价，随行情实时变动）</div>
      </div>
    </div>

    <!-- ── 调整流动资金弹窗 ── -->
    <div v-if="showLiquidModal" class="overlay" @click.self="showLiquidModal = false">
      <div class="modal">
        <div class="modal-title"><AppIcon icon="coins" :size="15" /> 调整流动资金</div>
        <div class="modal-sub">
          校正账面金额与游戏内实际不符（漏记卖货、赠礼、手续费损耗、起步本金等）。只影响当前宝典「{{ journey?.name }}」，其他宝典与装备流水互不影响；校正不计入今日净收与收益统计。
        </div>
        <div class="liquid-now">
          <span>当前账面流动资金</span>
          <b>{{ fmtWan(liquid) }}</b>
        </div>
        <div class="liquid-mode">
          <button class="liquid-mode-btn" :class="{ 'liquid-mode-btn--on': liquidMode === 'set' }" @click="liquidMode = 'set'">
            校正为实际金额
          </button>
          <button class="liquid-mode-btn" :class="{ 'liquid-mode-btn--on': liquidMode === 'delta' }" @click="liquidMode = 'delta'">
            按差额增减
          </button>
        </div>
        <div v-if="liquidMode === 'delta'" class="liquid-mode">
          <button class="liquid-mode-btn" :class="{ 'liquid-mode-btn--on': liquidDeltaDir === 'in' }" @click="liquidDeltaDir = 'in'">
            <AppIcon icon="plus" :size="11" /> 增加
          </button>
          <button class="liquid-mode-btn" :class="{ 'liquid-mode-btn--on': liquidDeltaDir === 'out' }" @click="liquidDeltaDir = 'out'">
            <AppIcon icon="x" :size="11" /> 减少
          </button>
        </div>
        <label class="field-label">
          {{ liquidMode === 'set' ? '游戏内实际金额（万三国币）' : '增减金额（万三国币，填正数）' }}
          <input class="field-input" type="number" min="0" step="0.01" v-num="liquidInputWan"
            @input="liquidInputWan = ($event.target as HTMLInputElement).value" />
        </label>
        <div class="liquid-delta" :class="liquidDeltaYi >= 0 ? 'mx-value--up' : 'mx-value--down'">
          <template v-if="liquidMode === 'set'">
            校正为 <b>{{ fmtWan(liquidTargetYi) }}</b> · 差额
            <b>{{ (liquidDeltaYi >= 0 ? '+' : '−') + fmtWan(Math.abs(liquidDeltaYi)) }}</b>
          </template>
          <template v-else>
            调整 <b>{{ (liquidDeltaYi >= 0 ? '+' : '−') + fmtWan(Math.abs(liquidDeltaYi)) }}</b> · 调整后
            <b>{{ fmtWan(liquidTargetYi) }}</b>
          </template>
        </div>
        <label class="field-label">备注（可选）
          <input class="field-input" type="text" v-model="liquidNote" placeholder="如：漏记上周卖货 / 起步本金 / 手续费损耗" />
        </label>
        <button class="btn btn-accent modal-btn" :disabled="liquidDeltaYi === 0" @click="saveLiquidAdjust">
          <AppIcon icon="save" :size="12" /> 保存调整
        </button>
        <div v-if="adjustRecs.length > 0" class="liquid-history">
          <div class="ledger-card-title"><AppIcon icon="history" :size="12" /> 历史校正（{{ adjustRecs.length }} 条）</div>
          <div v-for="r in adjustRecs" :key="r.id" class="rec-row">
            <span class="rec-time">{{ r.record_date.slice(5) }} {{ shortTime(r.created_at) }}</span>
            <span class="rec-badge rec-badge--adjust">调整</span>
            <span class="rec-detail">{{ adjustNote(r) || '资金校正' }}</span>
            <span class="rec-amount" :class="amountClass(r)">{{ amountText(r) }}</span>
            <button class="band-del" @click="deleteRecord(r)" title="删除该校正（流动资金回滚）"><AppIcon icon="trash" :size="11" /></button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── 收益日历弹窗 ── -->
    <div v-if="showCalModal" class="overlay" @click.self="showCalModal = false">
      <div class="modal modal--ledger">
        <div class="modal-title"><AppIcon icon="calendar" :size="15" /> 收益日历</div>
        <div class="cal-cols">
        <div class="cal-card cal-card--main">
          <div class="cal-nav">
            <button class="cal-nav-btn" @click="shiftMonth(-1)"><AppIcon icon="chevron-left" :size="13" /></button>
            <span class="cal-title">{{ calY }} 年 {{ calM }} 月</span>
            <button class="cal-nav-btn" @click="shiftMonth(1)"><AppIcon icon="chevron-right" :size="13" /></button>
            <button class="btn btn-ghost btn-xs" @click="toToday">回到本月</button>
            <div class="cal-sums">
              <span class="cal-sum cal-sum--in">收入 {{ fmtWan(monthSum.income) }}</span>
              <span class="cal-sum cal-sum--out">支出 {{ fmtWan(monthSum.expense) }}</span>
              <span class="cal-sum cal-sum--gear">装备投入 {{ fmtWan(monthSum.gear) }}</span>
              <span class="cal-sum" :class="monthSum.net >= 0 ? 'cal-sum--in' : 'cal-sum--out'">净 {{ (monthSum.net >= 0 ? '+' : '') + fmtWan(monthSum.net) }}</span>
            </div>
          </div>
          <div class="cal-grid">
            <span v-for="w in ['一', '二', '三', '四', '五', '六', '日']" :key="w" class="cal-weekday">{{ w }}</span>
            <span v-for="b in calLead" :key="'b' + b" class="cal-cell cal-cell--blank"></span>
            <button v-for="c in calDays" :key="c.d" class="cal-cell"
              :class="{ 'cal-cell--today': isToday(c.d), 'cal-cell--sel': selectedDay === c.d }" @click="selectedDay = c.d">
              <span class="cal-day">{{ c.d }}</span>
              <span v-if="c.hasGear" class="cal-gear-dot" title="当日有装备投入"></span>
              <span v-if="c.net !== 0" class="cal-net" :class="c.net > 0 ? 'cal-net--in' : 'cal-net--out'">
                {{ (c.net > 0 ? '+' : '') + fmtWanShort(c.net) }}
              </span>
            </button>
          </div>
          <div v-if="selectedDay" class="day-detail">
            <div class="ledger-card-title" style="margin-bottom: 6px"><AppIcon icon="calendar" :size="13" /> {{ calY }}-{{ pad2(calM) }}-{{ pad2(selectedDay) }} 流水</div>
            <div v-if="dayRecs.length === 0" class="ledger-empty">当天无记录</div>
            <div v-for="r in dayRecs" :key="r.id" class="rec-row">
              <span class="rec-time">{{ shortTime(r.created_at) }}</span>
              <span class="rec-badge" :class="'rec-badge--' + r.source">{{ sourceLabel(r.source) }}</span>
              <span class="rec-detail">{{ recordDetailText(r) }}</span>
              <span class="rec-amount" :class="amountClass(r)">{{ amountText(r) }}</span>
              <button v-if="r.source !== 'gear'" class="band-del" @click="deleteRecord(r)" title="删除"><AppIcon icon="trash" :size="11" /></button>
              <span v-else class="rec-lock"><AppIcon icon="lock" :size="11" /></span>
            </div>
          </div>
        </div>

        <!-- 右列：历史累计 + 年度统计 -->
        <div class="cal-side">
        <!-- 历史累计 -->
        <div class="cal-card">
          <div class="cal-nav">
            <span class="cal-title"><AppIcon icon="trending-up" :size="13" /> 历史累计</span>
            <span v-if="totalSum.firstDate" class="cal-sum">自 {{ totalSum.firstDate }} 起</span>
          </div>
          <div class="total-grid">
            <div class="total-cell"><span>累计收入</span><b class="cal-net--in">+{{ fmtWan(totalSum.income) }}</b></div>
            <div class="total-cell"><span>累计支出</span><b class="cal-net--out">-{{ fmtWan(totalSum.expense) }}</b></div>
            <div class="total-cell"><span>装备投入</span><b class="total-warn">{{ fmtWan(totalSum.gear) }}</b></div>
            <div class="total-cell"><span>累计净收益</span><b :class="totalSum.net >= 0 ? 'cal-net--in' : 'cal-net--out'">{{ (totalSum.net >= 0 ? '+' : '') + fmtWan(totalSum.net) }}</b></div>
            <div class="total-cell"><span>记账天数</span><b>{{ totalSum.dayCount }} 天</b></div>
            <div class="total-cell"><span>记账日均净</span><b :class="totalSum.avgNet >= 0 ? 'cal-net--in' : 'cal-net--out'">{{ (totalSum.avgNet >= 0 ? '+' : '') + fmtWan(totalSum.avgNet) }}</b></div>
          </div>
        </div>

        <div class="cal-card">
          <div class="cal-nav">
            <button class="cal-nav-btn" @click="calBase = new Date(calY - 1, calM - 1, 1)"><AppIcon icon="chevron-left" :size="13" /></button>
            <span class="cal-title">{{ calY }} 年度</span>
            <button class="cal-nav-btn" @click="calBase = new Date(calY + 1, calM - 1, 1)"><AppIcon icon="chevron-right" :size="13" /></button>
            <div class="cal-sums">
              <span class="cal-sum cal-sum--in">全年收入 {{ fmtWan(yearSum.income) }}</span>
              <span class="cal-sum cal-sum--out">全年支出 {{ fmtWan(yearSum.expense) }}</span>
              <span class="cal-sum cal-sum--gear">装备投入 {{ fmtWan(yearSum.gear) }}</span>
              <span class="cal-sum" :class="yearSum.net >= 0 ? 'cal-sum--in' : 'cal-sum--out'">净 {{ (yearSum.net >= 0 ? '+' : '') + fmtWan(yearSum.net) }}</span>
            </div>
          </div>
          <div class="year-rows">
            <div v-for="m in yearMonths" :key="m.m" class="year-row" @click="jumpMonth(m.m)">
              <span class="year-label">{{ m.m }}月</span>
              <div class="year-bar-wrap">
                <div class="year-bar" :class="m.net >= 0 ? 'year-bar--in' : 'year-bar--out'"
                  :style="{ width: yearBarWidth(m.net) + '%' }"></div>
              </div>
              <span class="year-net" :class="m.net > 0 ? 'cal-net--in' : m.net < 0 ? 'cal-net--out' : ''">
                {{ m.net === 0 ? '—' : (m.net > 0 ? '+' : '') + fmtWanShort(m.net) }}
              </span>
            </div>
          </div>
          <div v-if="bestDay" class="year-best"><AppIcon icon="crown" :size="12" /> 年度最佳：{{ bestDay.date }} 净 {{ '+' + fmtWan(bestDay.net) }}</div>
        </div>
        </div>
        </div>
      </div>
    </div>

    <!-- ── 节点弹窗 ── -->
    <div v-if="modalNode" class="overlay" @click.self="modalNode = null">
      <div class="modal">
        <div class="modal-title">
          <AppIcon :icon="nodeIcon(modalNode)" :size="15" />
          {{ slotLabel(modalNode.slot) }} · {{ modalNode.toItem }}
        </div>
        <div class="modal-sub">
          <template v-if="modalNode.claimed">
            {{ modalNode.claimedAt }}
            {{ modalNode.cash ? '现金投入解锁，投入' : modalNode.manual ? '手动解锁，取得价' : '入手，扣款' }}
            {{ fmtWan(modalNode.paid) }}
            <template v-if="modalNode.cash">（计入本宝典投入）</template>
            <template v-else-if="modalNode.manual">（未扣流动资金）</template>
          </template>
          <template v-else-if="nodeState(modalNode) === 'unlocked'">流动资金已达标，可应用到当前配置</template>
          <template v-else>
            还差 <b>{{ fmtWan(modalNode.cost - liquid) }}</b> 流动资金（当前 {{ fmtWan(liquid) }} / 需 {{ fmtWan(modalNode.cost) }}）— 也可手动或现金解锁
          </template>
        </div>
        <div class="diff-row diff-row--modal">
          <span class="diff-slot">{{ modalNode.slot }}</span>
          <span class="diff-item">{{ modalNode.fromItem || '（空）' }}</span>
          <span class="diff-arrow"><AppIcon icon="chevron-right" :size="12" /></span>
          <span class="diff-item">{{ modalNode.toItem }}</span>
        </div>

        <template v-if="modalNode.claimed">
          <button class="btn btn-danger modal-btn" @click="undoNode(modalNode)">
            <AppIcon icon="history" :size="12" /> 撤销应用（回退配置{{ modalNode.recordId ? '并删除对应扣款流水' : '' }}）
          </button>
        </template>
        <template v-else-if="nodeState(modalNode) === 'unlocked'">
          <label class="field-label">实际成交价（万，默认节点价）
            <input class="field-input" type="number" min="0" step="0.01" v-num="applyPaidWan"
              @input="applyPaidWan = ($event.target as HTMLInputElement).value" />
          </label>
          <button class="btn btn-accent modal-btn" @click="confirmApplyNode('liquid')">
            <AppIcon icon="circle-check" :size="13" /> 应用到当前配置（扣流动资金）
          </button>
          <button class="btn btn-ghost modal-btn" @click="confirmApplyNode('cash')">
            <AppIcon icon="coins" :size="12" /> 现金投入解锁（计入本宝典投入）
          </button>
        </template>
        <template v-else>
          <label class="field-label">节点价格（万，按实际行情调整）
            <input class="field-input" type="number" min="0" step="0.01" v-num="editCostWan"
              @input="editCostWan = ($event.target as HTMLInputElement).value" />
          </label>
          <button class="btn btn-ghost modal-btn" @click="saveNodeCost"><AppIcon icon="save" :size="12" /> 更新节点价</button>
          <div class="modal-divider"></div>
          <label class="field-label">实际取得价（万）
            <input class="field-input" type="number" min="0" step="0.01" v-num="applyPaidWan"
              @input="applyPaidWan = ($event.target as HTMLInputElement).value" />
          </label>
          <button class="btn btn-accent modal-btn" @click="confirmApplyNode('cash')">
            <AppIcon icon="coins" :size="12" /> 现金投入解锁（计入本宝典投入）
          </button>
          <button class="btn btn-ghost modal-btn" @click="confirmApplyNode('manual')">
            <AppIcon icon="circle-check" :size="13" /> 手动解锁并应用（不扣款、不计成本）
          </button>
        </template>
      </div>
    </div>

    <!-- ── 号设置 ── -->
    <div v-if="showCharsModal" class="overlay" @click.self="showCharsModal = false">
      <div class="modal">
        <div class="modal-title"><AppIcon icon="users" :size="15" /> 设置参与活跃的号</div>
        <div class="modal-sub">主面板按这里的号列表逐号选择今日档位</div>
        <div v-if="charsDraft.length === 0" class="ledger-empty">还没有号 — 点下面添加</div>
        <div v-for="(c, i) in charsDraft" :key="i" class="cfg-row">
          <input class="field-input cfg-name" type="text" v-model="c.name" placeholder="号名（可选）" />
          <select class="field-select cfg-band" v-model.number="c.band">
            <option :value="0" disabled>等级段</option>
            <option v-for="lv in LV_BANDS" :key="lv" :value="lv">{{ lv }}级</option>
          </select>
          <button class="band-del" @click="charsDraft.splice(i, 1)" title="删除"><AppIcon icon="trash" :size="11" /></button>
        </div>
        <button class="btn btn-ghost modal-btn" @click="charsDraft.push({ name: '', band: 100 })">
          <AppIcon icon="plus" :size="12" /> 添加一个号
        </button>
        <button class="btn btn-accent modal-btn" :disabled="charsDraft.some(c => !c.band)" @click="saveChars">
          <AppIcon icon="save" :size="12" /> 保存
        </button>
      </div>
    </div>

    <!-- ── 档位工资编辑 ── -->
    <div v-if="showTierModal" class="overlay" @click.self="showTierModal = false">
      <div class="modal modal--wide">
        <div class="modal-title"><AppIcon icon="activity" :size="15" /> 活跃档位工资（万三国币）</div>
        <div class="modal-sub">与「游戏攻略 → 活跃计算」共用一份数据，在此修改后全应用生效</div>
        <div class="tier-table">
          <div class="tier-row tier-row--head"><span>等级段</span><span>① 档</span><span>② 档</span><span>③ 档</span></div>
          <div v-for="lv in LV_BANDS" :key="lv" class="tier-row">
            <span class="band-lv">{{ lv }}级</span>
            <input v-for="t in [1, 2, 3]" :key="t" class="field-input" type="number" min="0" step="0.1"
              v-num="tierDraft[lv]?.[('tier' + t) as 'tier1'] ?? 0"
              @input="setTierDraft(lv, t, ($event.target as HTMLInputElement).value)" />
          </div>
        </div>
        <button class="btn btn-accent modal-btn" @click="saveTierEdits"><AppIcon icon="save" :size="12" /> 保存工资表</button>
      </div>
    </div>

    <!-- 提交提醒（不整页刷新，轻提示告知已落库） -->
    <transition name="toast-pop">
      <div v-if="toastMsg" class="toast"><AppIcon icon="circle-check" :size="13" /> {{ toastMsg }}</div>
    </transition>

    <ImageViewer v-model="viewerVisible" :images="viewerImages" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, onActivated, onDeactivated, watch } from 'vue'
import { useAppStore } from '@/stores'
import { vNum } from '@/utils/numInput'
import AppIcon from '@/components/ui/AppIcon.vue'
import ImageViewer from '@/components/ImageViewer.vue'
import activityCalcData from '@/data/activity-calc.json'
import { convertToPinyin } from 'tiny-pinyin'
import { loadBeastData, BEAST_CATS, BEAST_GRADES } from '@/utils/beastData'
import { getQualityColor } from '@/utils/quality'
import { appConfirm } from '@/utils/confirm'

const app = useAppStore()
const loading = ref(true)

// ── 单位换算：库存一律「亿」，界面一律「万」 ──
function wanToYi(wan: string): number {
  const v = parseFloat(wan)
  if (isNaN(v) || v < 0) return 0
  return Math.round((v / 10000) * 1e7) / 1e7
}
function wanNumToYi(v: number): number {
  return Math.round((v / 10000) * 1e7) / 1e7
}
function fmtWan(yi: number | null | undefined): string {
  const v = (yi ?? 0) * 10000
  const abs = Math.abs(v)
  if (abs === 0) return '0 万'
  const s = abs >= 100 ? v.toFixed(0) : abs >= 1 ? v.toFixed(1) : v.toFixed(2)
  return s + ' 万'
}
function fmtWanShort(yi: number): string {
  const v = yi * 10000
  const abs = Math.abs(v)
  return abs >= 100 ? v.toFixed(0) : abs >= 1 ? v.toFixed(1) : v.toFixed(2)
}
function round7(v: number): number { return Math.round(v * 1e7) / 1e7 }
function pad2(n: number): string { return String(n).padStart(2, '0') }
function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
// 响应式「今天」：只在跨零点时由 checkDayRollover 推进。
// 所有按日判定（今日流水/账单是否已提交/日历高亮）都必须依赖它，
// 不能直接用 todayStr()——非响应式，computed 永远不会因日期变化重算。
const todayKey = ref(todayStr())
function nowLocal(): string {
  return new Date().toLocaleString('zh-CN', { hour12: false })
}
function shortTime(s: string): string {
  const m = /\d{2}:\d{2}:\d{2}/.exec(s || '')
  return m ? m[0].slice(0, 5) : ''
}

// ── 数据结构 ──
interface SlotPriceEntry { i: number; p: number; n: string; q: string }
interface Snapshot { details: Record<string, string>; slot_price_ids: Record<string, number | SlotPriceEntry> }
interface Wallet { id: number; starting_liquid: number; starting_fixed: number; cash_injected?: number }
interface JNode {
  slot: string; fromItem: string; toItem: string
  fromPriceId: number | null; priceParamId: number | null
  cost: number; claimed: boolean; paid: number | null; claimedAt: string | null; recordId: number | null
  manual?: boolean // 手动解锁：装备在账本外取得，不写扣款流水
  cash?: boolean // 现金投入解锁：不扣流动资金，单列「投入」指标
  round?: number // 目标轮次：同一槽位被新目标再次纳入时 +1，旧站保留为已解锁历史
  costEdited?: boolean // 手动改过节点价：目标刷新时不再用图鉴价覆盖
}
// 节点唯一标识 = 槽位 + 轮次（同一槽位可有多轮历史站）
function nodeKey(n: JNode): string { return `${n.slot}#${n.round ?? 0}` }
interface Journey {
  id: number; name: string
  job?: string // 本宝典配置职业（新建宝典时锁定，调整目标只能选同职业方案）
  current_snapshot: Snapshot; target_snapshot: Snapshot
  nodes: JNode[]; status: string
  starting_basis?: number // 本宝典既有资本（新建时的当前配置估值，计入该宝典起步）
  starting_liquid?: number // 本宝典初始流动资金（各宝典独立核算）
}
interface Scheme {
  id: number; name: string; job: string; level_num: number; total_budget: number
  details: Record<string, string>; slot_price_ids: Record<string, number | SlotPriceEntry>
}
interface PriceRow { id: number; item_name: string; category: string; quality: string; notes: string; benchmark_price: number; market_price: number; equip_job: string; equip_level: number; spirit_position: string; slot: string }
interface Rec {
  id: number; record_date: string; type: string; source: string
  amount: number; detail: string; created_at: string; journey_id?: number | null
}

// 节点范围：配号中心全部槽位（9 装备 + 翅膀/符咒 + 11 灵魄 + 八阵图/子女/奥义/灵珠/羽灵 + 30 元神）
const EQUIP_SLOTS = ['武器', '头盔', '上装', '下装', '护手', '鞋子', '面具', '项链', '戒指', '翅膀', '符咒']
const SPIRIT_SLOTS = ['武器灵', '护手灵', '头盔灵', '上装灵', '下装灵', '鞋子灵', '面具灵', '翅膀灵', '符咒灵', '项链灵', '戒指灵']
const OTHER_SLOTS = ['八阵图', '子女', '奥义', '灵珠', '羽灵']
const SHENYUAN_SLOTS: string[] = [
  ...Array.from({ length: 5 }, (_, i) => `元神:背包${i + 1}`),
  ...Array.from({ length: 5 }, (_, w) =>
    Array.from({ length: 5 }, (_, s) => `元神:仓${w + 1}槽${s + 1}`)
  ).flat(),
]
const NODE_SLOTS = [...EQUIP_SLOTS, ...SPIRIT_SLOTS, ...OTHER_SLOTS, ...SHENYUAN_SLOTS]
const LV_BANDS = [70, 80, 90, 100, 110, 120, 130, 140, 150]

const wallet = ref<Wallet | null>(null)
// 多宝典：每大区可同时存在多个激活宝典（如主力号/副力号各一条），journey 为当前选中的
const journeys = ref<Journey[]>([])
const activeJourneyId = ref<number | null>(null)
const journey = computed(() => journeys.value.find(j => j.id === activeJourneyId.value) ?? journeys.value[0] ?? null)
const schemes = ref<Scheme[]>([])
const priceRows = ref<PriceRow[]>([])
const records = ref<Rec[]>([])
// 背包资产（按大区+图鉴物品聚合）
interface BpItem { id: number; price_param_id: number; item_name: string; quantity: number }
const backpack = ref<BpItem[]>([])

const priceMap = computed(() => {
  const m = new Map<number, PriceRow>()
  for (const p of priceRows.value) m.set(p.id, p)
  return m
})

function parseJSON<T>(s: unknown, def: T): T {
  try { const v = JSON.parse((s as string) || ''); return (v ?? def) as T } catch { return def }
}
function resolvePriceId(snap: Snapshot, slot: string): number | null {
  const v = snap.slot_price_ids?.[slot]
  if (v == null) return null
  return typeof v === 'number' ? v : (v?.i ?? null)
}

// 兜底版价格解析：快照没记价格 id（旧方案/旧快照遗留）时，按物品名回查图鉴。
// 注意：① 已存的 id 若指向的物品名与槽位物品名不符（换物品遗留/错数据），同样视为无效走兜底；
// ② 同名条目可能有多条（不同品质/属性价格差异巨大，如禁卫之灵 绿25万/紫9700万），
//    无 ORDER BY 的查询返回顺序不可靠（可能被索引序打乱），必须显式取市价最低的一条。
function resolvePriceIdLoose(snap: Snapshot, slot: string): number | null {
  const name = (snap.details?.[slot] || '').trim()
  const id = resolvePriceId(snap, slot)
  if (id != null) {
    const row = priceMap.value.get(id)
    if (row && (!name || row.item_name === name)) return id
  }
  if (name) {
    let best: PriceRow | null = null
    for (const p of priceRows.value) {
      if (p.item_name !== name) continue
      if (!best || p.market_price < best.market_price) best = p
    }
    if (best) return best.id
  }
  // 最终兜底：图鉴重导入后物品名可能变过（快照记的是旧名，如「流火潮日长袍」→「流火溯日长袍」），
  // 按名字查不到时，只要快照记录的价格 id 仍指向存在的条目就沿用 —— 宁可按旧条目计价，也不能把该槽位算成 0
  return id
}

// 槽位市场价（亿）：先按快照价格 id，缺失时按物品名兜底
function snapshotMarketPrice(snap: Snapshot, slot: string): number {
  const id = resolvePriceIdLoose(snap, slot)
  return id != null ? (priceMap.value.get(id)?.market_price ?? 0) : 0
}

// ── 加载 ──
async function loadAll() {
  const sid = app.currentServerId
  if (!sid) { loading.value = false; return }
  // 换大区时重置会话内状态
  if (loadedServerId !== sid) {
    entries.value = []
    charTiers.value = []
    loadedJourneyKey = ''
  }
  loadedServerId = sid
  loading.value = true
  try {
    const ws = await window.electronAPI.dbQuery(
      'SELECT id, starting_liquid, starting_fixed, cash_injected FROM asset_wallet WHERE server_id=? LIMIT 1', [sid]
    ) as Array<Wallet>
    wallet.value = ws[0] ?? null

    const js = await window.electronAPI.dbQuery(
      "SELECT id, name, job, current_snapshot, target_snapshot, nodes, status, starting_basis, starting_liquid FROM growth_journey WHERE server_id=? AND status='active' ORDER BY id DESC",
      [sid]
    ) as Array<{ id: number; name: string; job: string | null; current_snapshot: string; target_snapshot: string; nodes: string; status: string; starting_basis: number | null; starting_liquid: number | null }>
    journeys.value = js.map(row => ({
      id: row.id,
      name: row.name,
      job: row.job ?? '',
      current_snapshot: parseJSON<Snapshot>(row.current_snapshot, { details: {}, slot_price_ids: {} }),
      target_snapshot: parseJSON<Snapshot>(row.target_snapshot, { details: {}, slot_price_ids: {} }),
      nodes: parseJSON<JNode[]>(row.nodes, []),
      status: row.status,
      starting_basis: row.starting_basis ?? 0,
      starting_liquid: row.starting_liquid ?? 0,
    }))
    const savedJourneyId = Number(localStorage.getItem(`sgbuddy-active-journey-${sid}`) || 0)
    const sel = journeys.value.find(x => x.id === savedJourneyId) ?? journeys.value[0] ?? null
    activeJourneyId.value = sel?.id ?? null

    await loadSchemesAndPrices()

    // 节点自愈：历史版本按物品名比对差异，同名不同图鉴条目的目标变更（换灵魄品质/装备条目）漏建了节点。
    // 价格表就绪后按最新派生逻辑重建一次，有差异才写库（幂等，修过即不再触发）
    await repairJourneyNodes()

    await loadBackpack()

    await loadJourneyScoped()
    // loadJourneyScoped 受会话缓存保护（同宝典只首载一次），提交/删除/撤销等写操作后流水必须取最新，
    // 否则覆盖式重提时按陈旧流水回滚背包，导致同一笔卖出重复扣减
    await refreshJourneyRecords()
  } catch (e) {
    console.error('[宝典] 加载失败:', e)
  } finally {
    loading.value = false
  }
}

// 方案/物价列表（keep-alive 缓存下从配号中心/物价图鉴返回时需要刷新）
async function loadSchemesAndPrices() {
  const sid = app.currentServerId
  if (!sid) return
  const ss = await window.electronAPI.dbQuery(
    'SELECT id, name, job, level_num, total_budget, details, slot_price_ids FROM gear_schemes WHERE server_id=? OR server_id IS NULL ORDER BY updated_at DESC',
    [sid]
  ) as Array<{ id: number; name: string; job: string; level_num: number; total_budget: number; details: string; slot_price_ids: string }>
  schemes.value = ss.map(s => ({
    ...s,
    details: parseJSON<Record<string, string>>(s.details, {}),
    slot_price_ids: parseJSON<Record<string, number | SlotPriceEntry>>(s.slot_price_ids, {}),
  }))
  priceRows.value = await window.electronAPI.dbQuery(
    'SELECT id, item_name, category, quality, benchmark_price, market_price, TRIM(COALESCE(attrs,\'\') || \' \' || COALESCE(attr_notes,\'\') || \' \' || COALESCE(craft_level,\'\')) as notes, COALESCE(equip_job,\'\') as equip_job, COALESCE(equip_level,0) as equip_level, COALESCE(spirit_position,\'\') as spirit_position, COALESCE(slot,\'\') as slot FROM price_params WHERE server_id=? ORDER BY item_name, market_price ASC', [sid]
  ) as Array<PriceRow>
}

// 会话内标记：大区 / 宝典×大区 的账单回填只做一次
let loadedServerId: number | null = null
let loadedJourneyKey = ''
let loadedJourneyId: number | null = null
let hydratedBillKey = ''
// keep-alive 缓存：页面隐藏时切大区不并发重载，回到前台再补
let activeView = false
let pendingReload = false
let everDeactivated = false

// 当前宝典的流水与账单表单（切换宝典/大区时重新加载）
async function loadJourneyScoped() {
  const sid = app.currentServerId
  const jid = activeJourneyId.value
  if (!sid || !jid) {
    records.value = []
    entries.value = []
    charTiers.value = []
    loadedJourneyId = null
    return
  }
  const key = `${sid}:${jid}`
  // 活跃档位勾选各宝典独立：切换前把当前勾选快照存回上一个宝典，切换后恢复本宝典的快照
  if (loadedJourneyId != null) charTiersByJourney.value[loadedJourneyId] = [...charTiers.value]
  if (loadedJourneyKey === key) return
  loadedJourneyKey = key
  loadedJourneyId = jid
  entries.value = []
  hydratedBillKey = ''
  records.value = await window.electronAPI.dbQuery(
    'SELECT id, record_date, type, source, amount, detail, created_at, journey_id FROM asset_records WHERE server_id=? AND journey_id=? ORDER BY record_date DESC, id DESC',
    [sid, jid]
  ) as Array<Rec>
  await Promise.all([loadTiers(), loadChars()])
  await hydrateBillFromToday()
  // 恢复本宝典的勾选快照（loadChars 只给中立默认值；今日账单回填已含在上次快照里）
  const saved = charTiersByJourney.value[jid]
  if (saved) charTiers.value = chars.value.map((_, i) => saved[i] ?? 3)
}

// 只刷新当前宝典的流水列表（不动表单条目与 hydration 状态，保留未提交草稿）
async function refreshJourneyRecords() {
  const sid = app.currentServerId
  const jid = activeJourneyId.value
  if (!sid || !jid) return
  records.value = await window.electronAPI.dbQuery(
    'SELECT id, record_date, type, source, amount, detail, created_at, journey_id FROM asset_records WHERE server_id=? AND journey_id=? ORDER BY record_date DESC, id DESC',
    [sid, jid]
  ) as Array<Rec>
}

// 今天已有账单时，把已提交的档位勾选与条目回填到表单，便于修改后重新提交
async function hydrateBillFromToday() {
  const sid = app.currentServerId
  const jid = activeJourneyId.value
  if (!sid || !jid) return
  const key = `${sid}:${jid}`
  if (hydratedBillKey === key) return
  hydratedBillKey = key
  if (!todayBillExists.value) return
  const active = todayRecs.value.find(r => r.source === 'active')
  if (active) {
    const d = parseJSON<any>(active.detail, {})
    const picked = (d.chars || []) as Array<{ name: string; band: number; tier: number }>
    charTiers.value = chars.value.map(c =>
      picked.find(p => p.band === c.band && (!p.name || !c.name || p.name === c.name))?.tier ?? 0)
  }
  for (const r of todayRecs.value) {
    if (r.source !== 'item' && r.source !== 'manual') continue
    const d = parseJSON<any>(r.detail, {})
    entries.value.push({
      key: entryKey++,
      direction: r.type === 'income' ? 'income' : 'expense',
      kind: r.source === 'item' ? 'item' : 'manual',
      itemName: d.item_name || '',
      priceParamId: d.price_param_id ?? null,
      quantity: d.quantity ?? 1,
      unitWan: r.source === 'item'
        ? String(d.unit_price_wan ?? Math.round((priceMap.value.get(d.price_param_id)?.market_price || 0) * 10000 * 100) / 100)
        : String(Math.round(r.amount * 10000 * 100) / 100),
      fromBackpack: r.source === 'item' ? !!d.from_backpack : undefined,
      committed: true, // 已在今日流水里，条目级改动需走「重新提交今日账单」整体生效
    })
  }
}

// ── 跨日切换（自然日 00:00 切日）──
// 应用长期开着时不会重挂载，必须主动推进 todayKey，否则「今日账单」判定永远停在昨天：
// 既会误显示「重新提交今日账单」，更危险的是提交时会拿昨天的流水做背包回滚（重复扣减）。
function resetBillForNewDay(prevKey: string) {
  const dropped = entries.value.filter(e => e.committed).length
  // 已提交的条目属于昨天的流水，留着会被重复写进今天，必须移除；未提交草稿保留继续录入
  if (dropped) entries.value = entries.value.filter(e => !e.committed)
  charTiers.value = charTiers.value.map(() => 0) // 活跃档位是每日重选的
  hydratedBillKey = '' // 放开回填锁，按新的一天重新判定
  // 日历弹窗正好停在旧的那天（含跨月）时，跟着挪到新的一天
  if (showCalModal.value && ymPrefix.value === prevKey.slice(0, 7)) toToday()
  showToast(dropped
    ? `已跨日 · 账单切到今天，移除 ${dropped} 条昨日已提交条目`
    : '已跨日 · 账单已切到今天')
}
function checkDayRollover() {
  const t = todayStr()
  if (t === todayKey.value) return
  const prevKey = todayKey.value
  todayKey.value = t
  resetBillForNewDay(prevKey)
}
let dayTimer = 0
function onVisibilityChange() { if (!document.hidden) checkDayRollover() }

// ── 资产推导（流动资金/记账均按当前选中宝典独立核算） ──
const sumIncome = computed(() => records.value.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0))
const sumExpense = computed(() => records.value.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0))
const sumAdjust = computed(() => records.value.filter(r => r.type === 'adjust').reduce((s, r) => s + r.amount, 0))
const liquid = computed(() =>
  round7((journey.value?.starting_liquid ?? 0) + sumIncome.value - sumExpense.value + sumAdjust.value))

function snapshotFixedValue(snap: Snapshot): number {
  let sum = 0
  for (const slot of Object.keys(snap.slot_price_ids || {})) {
    const id = resolvePriceIdLoose(snap, slot)
    if (id != null) sum += priceMap.value.get(id)?.market_price ?? 0
  }
  // details 里配了物品但没记价格 id 的槽位（旧快照遗留）也要计入
  for (const [slot, name] of Object.entries(snap.details || {})) {
    if (!(name || '').trim() || resolvePriceId(snap, slot) != null) continue
    sum += snapshotMarketPrice(snap, slot)
  }
  return round7(sum)
}
// 固定资产只算当前选中宝典的当前配置（指标契合选中宝典，不做多宝典汇总）
const fixedValue = computed(() => journey.value ? snapshotFixedValue(journey.value.current_snapshot) : 0)

// 换下装备自动并入背包：解锁节点时旧装备 +1 入库（估值走背包指标），不再单列库存

// 背包资产估值：数量 × 图鉴市场价（实时）
const unitMarket = (b: BpItem): number => priceMap.value.get(b.price_param_id)?.market_price ?? 0
const backpackValue = computed(() =>
  round7(backpack.value.reduce((s, b) => s + unitMarket(b) * b.quantity, 0)))

const totalAsset = computed(() => round7(liquid.value + fixedValue.value + backpackValue.value))
// 起步基准：本宝典初始流动 + 初始固定/既有资本（迁移时首个宝典继承钱包初始值）；现金投入单列「投入」指标
// 投入 = 开宝典时全身装备价值（既有资本）+ 现金解锁累计
const cashInjected = computed(() =>
  round7((journey.value?.nodes ?? []).filter(n => n.claimed && n.cash).reduce((s, n) => s + (n.paid ?? 0), 0)))
const journeyInvested = computed(() =>
  round7((journey.value?.starting_basis ?? 0) + cashInjected.value))

// ── 流动资金校正（账面与游戏内实际不符时调整，只影响当前宝典，不计入收益统计） ──
// 落一条 type='adjust' 的流水（signed 金额），liquid 公式已包含 sumAdjust
const adjustRecs = computed(() => records.value.filter(r => r.type === 'adjust'))
function adjustNote(r: Rec): string {
  return parseJSON<{ note?: string }>(r.detail, {}).note || ''
}
const showLiquidModal = ref(false)
const liquidMode = ref<'set' | 'delta'>('set')
const liquidDeltaDir = ref<'in' | 'out'>('in')
const liquidInputWan = ref('')
const liquidNote = ref('')

// 输入值（亿）：增减模式按方向取正负，避免出现负数输入框被 wanToYi 归零
const liquidInputYi = computed(() => {
  const v = wanToYi(liquidInputWan.value)
  return liquidMode.value === 'delta' && liquidDeltaDir.value === 'out' ? -v : v
})
const liquidTargetYi = computed(() =>
  liquidMode.value === 'set' ? liquidInputYi.value : round7(liquid.value + liquidInputYi.value))
const liquidDeltaYi = computed(() => round7(liquidTargetYi.value - liquid.value))

function openLiquidModal() {
  liquidMode.value = 'set'
  liquidDeltaDir.value = 'in'
  liquidInputWan.value = String(Math.round(liquid.value * 10000 * 100) / 100)
  liquidNote.value = ''
  showLiquidModal.value = true
}

async function saveLiquidAdjust() {
  const sid = app.currentServerId
  const jid = activeJourneyId.value
  if (!sid || !jid) return
  const delta = liquidDeltaYi.value
  if (delta === 0) return
  await window.electronAPI.dbQuery(
    'INSERT INTO asset_records (server_id, journey_id, record_date, type, source, amount, detail) VALUES (?,?,?,?,?,?,?)',
    [sid, jid, todayKey.value, 'adjust', 'adjust', delta,
      JSON.stringify({ note: liquidNote.value.trim(), from: liquid.value, to: liquidTargetYi.value })]
  )
  liquidInputWan.value = ''
  liquidNote.value = ''
  showLiquidModal.value = false
  await refreshJourneyRecords()
  showToast(`流动资金已${delta > 0 ? '增加' : '减少'} ${fmtWan(Math.abs(delta))}`)
}

const todayRecs = computed(() => records.value.filter(r => r.record_date === todayKey.value))
const todayNet = computed(() => {
  let net = 0
  for (const r of todayRecs.value) {
    if (r.type === 'income') net += r.amount
    else if (r.type === 'expense' && r.source !== 'gear') net -= r.amount
  }
  return round7(net)
})
const todayBillExists = computed(() =>
  todayRecs.value.some(r => r.source === 'active' || r.source === 'item' || r.source === 'manual'))

// ── 开局引导 / 新建宝典 ──
const showSetup = ref(false)
const setupCurrentId = ref(0)
const setupTargetId = ref(0)
const setupLiquidWan = ref('')
const setupSaving = ref(false)

// 目标配置必须与当前配置同职业（空白开局不限制职业，以所选目标方案的职业为准）
const setupJobFilter = computed(() => (schemes.value.find(x => x.id === setupCurrentId.value)?.job || '').trim())
const setupTargetCandidates = computed(() => {
  if (!setupJobFilter.value) return schemes.value
  return schemes.value.filter(s => (s.job || '').trim() === setupJobFilter.value)
})
watch([setupCurrentId, schemes], () => {
  // 当前配置职业变化后，已选目标若不再同职业则清掉重选
  if (setupTargetId.value && !setupTargetCandidates.value.some(s => s.id === setupTargetId.value)) {
    setupTargetId.value = 0
  }
})

function schemeSnapshot(id: number): Snapshot {
  const s = schemes.value.find(x => x.id === id)
  if (!s) return { details: {}, slot_price_ids: {} }
  return {
    details: { ...s.details },
    slot_price_ids: { ...s.slot_price_ids },
  }
}

async function openBook() {
  if (!setupTargetId.value || setupSaving.value) return
  const sid = app.currentServerId
  if (!sid) return
  const targetScheme = schemes.value.find(x => x.id === setupTargetId.value)
  // 双保险：目标方案必须与当前配置同职业
  if (setupJobFilter.value && (targetScheme?.job || '').trim() !== setupJobFilter.value) {
    showToast('目标配置方案需与当前配置同职业')
    return
  }
  setupSaving.value = true
  try {
    const current = schemeSnapshot(setupCurrentId.value)
    const target = schemeSnapshot(setupTargetId.value)
    const journeyJob = setupJobFilter.value || (targetScheme?.job || '').trim()
    // 流动资金从「初始流动资金」起步，后续靠收支条目记账积累，也可随时校正；
    // 本宝典投入 = 当前配置估值（既有装备资本，各宝典独立）
    const startingBasis = snapshotFixedValue(current)
    const startingLiquid = wanToYi(setupLiquidWan.value)
    const stmts: Array<{ sql: string; params?: unknown[] }> = []
    if (!wallet.value) {
      stmts.push({
        sql: 'INSERT INTO asset_wallet (server_id, starting_liquid, starting_fixed) VALUES (?,?,?)',
        params: [sid, 0, startingBasis],
      })
    }
    stmts.push({
      sql: 'INSERT INTO growth_journey (server_id, name, job, current_snapshot, target_snapshot, nodes, starting_basis, starting_liquid) VALUES (?,?,?,?,?,?,?,?)',
      params: [sid, targetName(), journeyJob, JSON.stringify(current), JSON.stringify(target), JSON.stringify(buildNodes(current, target)), startingBasis, startingLiquid],
    })
    const rs = await window.electronAPI.dbTransaction(stmts) as Array<{ lastInsertRowid: number | bigint }>
    const newId = Number(rs[rs.length - 1]?.lastInsertRowid ?? 0)
    showSetup.value = false
    await loadAll()
    if (newId) selectJourney(newId)
  } finally {
    setupSaving.value = false
  }
}
function targetName(): string {
  const t = schemes.value.find(x => x.id === setupTargetId.value)
  return t ? `${t.name} 养成` : '养成计划'
}

function selectJourney(id: number) {
  activeJourneyId.value = id
  const sid = app.currentServerId
  if (sid) localStorage.setItem(`sgbuddy-active-journey-${sid}`, String(id))
  loadJourneyScoped().catch(() => {})
  loadBackpack().catch(() => {}) // 背包按宝典独立，切换宝典时同步刷新
}

// ── 节点生成与应用 ──
// 目标槽位与当前是否存在真实差异：物品名不同，或同名但指向不同图鉴条目。
// 灵魄/装备图鉴存在大量同名多条目（不同品质/等级价格差异巨大，如 禁卫之灵 绿25万/紫9700万、
// 野兽之灵 绿135万/紫25.6亿），只比物品名会漏掉「同名换品质」的目标变更（P0：节点漏建）。
function snapshotDiffers(current: Snapshot, target: Snapshot, slot: string): boolean {
  const toItem = (target.details?.[slot] || '').trim()
  const fromItem = (current.details?.[slot] || '').trim()
  if (!toItem || toItem !== fromItem) return !!toItem && toItem !== fromItem
  const toId = resolvePriceIdLoose(target, slot)
  const fromId = resolvePriceIdLoose(current, slot)
  return toId != null && fromId != null && toId !== fromId
}

function buildNodes(current: Snapshot, target: Snapshot): JNode[] {
  const nodes: JNode[] = []
  for (const slot of NODE_SLOTS) {
    const toItem = (target.details?.[slot] || '').trim()
    const fromItem = (current.details?.[slot] || '').trim()
    if (!toItem || !snapshotDiffers(current, target, slot)) continue
    const pid = resolvePriceIdLoose(target, slot)
    nodes.push({
      slot, fromItem, toItem,
      fromPriceId: resolvePriceIdLoose(current, slot),
      priceParamId: pid,
      // 节点门槛价按图鉴「市场价」快照（买入参考），固定资产估值同样用市场价
      cost: pid ? (priceMap.value.get(pid)?.market_price ?? 0) : 0,
      claimed: false, paid: null, claimedAt: null, recordId: null,
    })
  }
  // 灵兽槽为动态槽位（灵兽:分类:品级:序号），按两份快照的并集补齐节点
  const beastKeys = new Set<string>()
  for (const k of Object.keys(target.details || {})) if (k.startsWith('灵兽:')) beastKeys.add(k)
  for (const k of Object.keys(current.details || {})) if (k.startsWith('灵兽:')) beastKeys.add(k)
  for (const slot of beastKeys) {
    const toItem = (target.details?.[slot] || '').trim()
    const fromItem = (current.details?.[slot] || '').trim()
    if (!toItem || !snapshotDiffers(current, target, slot)) continue
    const pid = resolvePriceIdLoose(target, slot)
    nodes.push({
      slot, fromItem, toItem,
      fromPriceId: resolvePriceIdLoose(current, slot),
      priceParamId: pid,
      // 节点门槛价按图鉴「市场价」快照（买入参考），固定资产估值同样用市场价
      cost: pid ? (priceMap.value.get(pid)?.market_price ?? 0) : 0,
      claimed: false, paid: null, claimedAt: null, recordId: null,
    })
  }
  nodes.sort((a, b) => a.cost - b.cost) // 便宜在前：越早攒够越早解锁
  return nodes
}

// 灵兽动态槽位（灵兽:分类:品级:序号）转短标签（去掉"灵兽"前缀，节点图标已表明身份）；其余槽位原样
function slotLabel(slot: string): string {
  if (slot.startsWith('灵兽:')) {
    const parts = slot.split(':')
    const idx = Number(parts[3] || 0)
    return `${parts[1] || ''}·${parts[2] || ''} ${idx + 1}号`
  }
  return slot
}

// 展示顺序：已解锁按解锁时间排前（新解锁的紧随已解锁队列），未解锁按设定的优先级（存储顺序）排后
const nodes = computed(() => {
  const all = journey.value?.nodes ?? []
  const claimed = all.filter(n => n.claimed).sort((a, b) => claimedTime(a) - claimedTime(b))
  return [...claimed, ...all.filter(n => !n.claimed)]
})
function claimedTime(n: JNode): number {
  const t = n.claimedAt ? new Date(n.claimedAt).getTime() : NaN
  return isNaN(t) ? 0 : t
}
const claimedCount = computed(() => nodes.value.filter(n => n.claimed).length)
const nextNode = computed(() => nodes.value.find(n => !n.claimed) ?? null)
const remainingCost = computed(() => {
  const next = nextNode.value
  return next ? Math.max(0, round7(next.cost - liquid.value)) : 0
})

function nodeState(n: JNode): 'claimed' | 'unlocked' | 'locked' {
  if (n.claimed) return 'claimed'
  return liquid.value >= n.cost ? 'unlocked' : 'locked'
}
function nodeIcon(n: JNode): string {
  const s = nodeState(n)
  return s === 'claimed' ? 'circle-check' : s === 'unlocked' ? 'unlock' : 'lock'
}
// 锁定节点解锁进度：只在下一个未解锁节点上显示整卡背景渐变 + 边框颜色随流动资金/节点价加深，越接近达标越亮
// 渐变始终有可见弱底（0% 进度也显示淡 accent 底与边框），保证各宝典锁定节点样式统一
function nodeProgressStyle(n: JNode): Record<string, string> {
  if (n.claimed || nodeState(n) !== 'locked' || n.cost <= 0) return {}
  const next = nextNode.value
  if (!next || nodeKey(next) !== nodeKey(n)) return {} // 仅下一个未解锁节点显示进度背景
  const p = Math.min(1, Math.max(0, liquid.value / n.cost))
  const pct = Math.round(p * 100)
  return {
    borderColor: `color-mix(in srgb, var(--color-accent) ${Math.max(pct, 15)}%, var(--color-border-light))`,
    backgroundImage: `linear-gradient(to right, var(--color-accent-bg) ${pct}%, color-mix(in srgb, var(--color-accent-bg) 18%, transparent) ${pct}%)`,
  }
}

const modalNode = ref<JNode | null>(null)
const applyPaidWan = ref('')
const editCostWan = ref('')

function onNodeClick(n: JNode) {
  modalNode.value = n
  if (n.claimed) return
  applyPaidWan.value = String(Math.round(n.cost * 10000 * 100) / 100)
  editCostWan.value = String(Math.round(n.cost * 10000 * 100) / 100)
}

// 换下装备自动入背包：解锁 +1 入库，撤销 -1 出库（背包按宝典独立，估值随背包指标）
// 图鉴外装备（fromPriceId 为空）用 price_param_id=0 占位，按物品名独立入库（估值 0）
function oldGearBackpackStmts(n: JNode, sid: number, journeyId: number | null, direction: 1 | -1): Array<{ sql: string; params?: unknown[] }> {
  if (!n.fromItem || !journeyId) return []
  const pid = n.fromPriceId ?? 0
  if (direction === 1) {
    return [{
      sql: `INSERT INTO backpack_items (server_id, journey_id, price_param_id, item_name, quantity) VALUES (?,?,?,?,1)
        ON CONFLICT(server_id, journey_id, price_param_id, item_name) DO UPDATE SET quantity = quantity + 1, updated_at=datetime('now','localtime')`,
      params: [sid, journeyId, pid, n.fromItem],
    }]
  }
  // 撤销：出库 1 个，数量归零的行一并删除（背包不保留 0 数量物品）
  return [
    {
      sql: "UPDATE backpack_items SET quantity = MAX(0, quantity - 1), updated_at=datetime('now','localtime') WHERE server_id=? AND journey_id=? AND price_param_id=? AND item_name=?",
      params: [sid, journeyId, pid, n.fromItem],
    },
    { sql: 'DELETE FROM backpack_items WHERE quantity <= 0' },
  ]
}

async function confirmApplyNode(mode: 'liquid' | 'cash' | 'manual' = 'liquid') {
  const n = modalNode.value
  const j = journey.value
  const w = wallet.value
  if (!n || !j || n.claimed) return
  const sid = app.currentServerId
  if (!sid) return
  const paid = wanToYi(applyPaidWan.value)
  if (paid <= 0) return
  n.claimed = true
  n.paid = paid
  n.claimedAt = nowLocal()
  n.recordId = null
  n.manual = mode === 'manual' || undefined
  n.cash = mode === 'cash' || undefined
  // 当前快照推进到目标
  j.current_snapshot.details[n.slot] = n.toItem
  const targetEntry = j.target_snapshot.slot_price_ids?.[n.slot]
  if (targetEntry != null) j.current_snapshot.slot_price_ids[n.slot] = targetEntry

  if (mode === 'cash') {
    // 现金投入：不扣流动资金，计入本宝典投入（搬砖收益不因此虚增）
    await window.electronAPI.dbTransaction([
      { sql: "UPDATE asset_wallet SET cash_injected=COALESCE(cash_injected,0)+?, updated_at=datetime('now','localtime') WHERE id=?",
        params: [paid, w?.id ?? 0] },
      { sql: "UPDATE growth_journey SET current_snapshot=?, nodes=?, updated_at=datetime('now','localtime') WHERE id=?",
        params: [JSON.stringify(j.current_snapshot), JSON.stringify(j.nodes), j.id] },
      ...oldGearBackpackStmts(n, sid, j.id, 1),
    ])
  } else if (mode === 'manual') {
    // 手动解锁：装备在账本外取得/自制，不写扣款流水、不扣流动资金
    await window.electronAPI.dbTransaction([
      { sql: "UPDATE growth_journey SET current_snapshot=?, nodes=?, updated_at=datetime('now','localtime') WHERE id=?",
        params: [JSON.stringify(j.current_snapshot), JSON.stringify(j.nodes), j.id] },
      ...oldGearBackpackStmts(n, sid, j.id, 1),
    ])
  } else {
    const rs = await window.electronAPI.dbTransaction([
      { sql: 'INSERT INTO asset_records (server_id, journey_id, record_date, type, source, amount, detail) VALUES (?,?,?,?,?,?,?)',
        params: [sid, j.id, todayKey.value, 'expense', 'gear', paid, JSON.stringify({ slot: n.slot, item: n.toItem, journey_id: j.id })] },
      { sql: "UPDATE growth_journey SET current_snapshot=?, nodes=?, updated_at=datetime('now','localtime') WHERE id=?",
        params: [JSON.stringify(j.current_snapshot), JSON.stringify(j.nodes), j.id] },
      ...oldGearBackpackStmts(n, sid, j.id, 1),
    ]) as Array<{ lastInsertRowid: number | bigint }>
    const rid = Number(rs?.[0]?.lastInsertRowid ?? 0)
    if (rid) {
      n.recordId = rid
      await persistNodes()
    }
  }
  modalNode.value = null
  await loadAll()
}

async function undoNode(n: JNode) {
  const j = journey.value
  const w = wallet.value
  const sid = app.currentServerId
  if (!j || !n.claimed || !sid) return
  const cashPaid = n.cash ? (n.paid ?? 0) : 0
  const extra = n.recordId ? '并删除对应扣款流水' : cashPaid > 0 ? '并从「投入」中扣回该笔现金投入' : ''
  if (!(await appConfirm({ title: '撤销装备', message: `撤销「${n.slot} · ${n.toItem}」？将回退当前配置${extra}。`, confirmText: '撤销', danger: true }))) return
  j.current_snapshot.details[n.slot] = n.fromItem
  if (n.fromPriceId) j.current_snapshot.slot_price_ids[n.slot] = n.fromPriceId
  else delete j.current_snapshot.slot_price_ids[n.slot]
  n.claimed = false
  n.paid = null
  n.claimedAt = null
  n.manual = false
  n.cash = false
  const stmts: Array<{ sql: string; params?: unknown[] }> = []
  if (n.recordId) stmts.push({ sql: 'DELETE FROM asset_records WHERE id=?', params: [n.recordId] })
  if (cashPaid > 0 && w) {
    stmts.push({
      sql: "UPDATE asset_wallet SET cash_injected=MAX(COALESCE(cash_injected,0)-?, 0), updated_at=datetime('now','localtime') WHERE id=?",
      params: [cashPaid, w.id],
    })
  }
  stmts.push(...oldGearBackpackStmts(n, sid ?? 0, j.id, -1))
  n.recordId = null
  stmts.push({
    sql: "UPDATE growth_journey SET current_snapshot=?, nodes=?, updated_at=datetime('now','localtime') WHERE id=?",
    params: [JSON.stringify(j.current_snapshot), JSON.stringify(j.nodes), j.id],
  })
  await window.electronAPI.dbTransaction(stmts)
  modalNode.value = null
  await loadAll()
}

async function saveNodeCost() {
  const n = modalNode.value
  const j = journey.value
  if (!n || !j) return
  n.cost = wanToYi(editCostWan.value)
  n.costEdited = true // 手动定价后，后续调整目标不再用图鉴价覆盖
  await persistNodes()
  modalNode.value = null
}

// ── 节点排序：拖动设定解锁优先级，可一键恢复按价格升序 ──
const dragKey = ref<string | null>(null)
const dragOverKey = ref<string | null>(null)

// 节点轨道：竖向滚轮转横向滚动（不显示横向滚动条）
const nodeTrackEl = ref<HTMLElement | null>(null)
function onTrackWheel(e: WheelEvent) {
  const el = nodeTrackEl.value
  if (!el || el.scrollWidth <= el.clientWidth) return
  e.preventDefault()
  el.scrollLeft += e.deltaY
}

function onNodeDragStart(n: JNode, e: DragEvent) {
  if (n.claimed) return // 已解锁节点按时间固定在前，不参与排序
  dragKey.value = nodeKey(n)
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', nodeKey(n))
  }
}
function onNodeDragOver(n: JNode, e: DragEvent) {
  if (n.claimed || !dragKey.value || dragKey.value === nodeKey(n)) return
  e.preventDefault()
  dragOverKey.value = nodeKey(n)
}
async function onNodeDrop(target: JNode) {
  const j = journey.value
  const from = dragKey.value
  dragKey.value = null
  dragOverKey.value = null
  if (!j || !from || from === nodeKey(target) || target.claimed) return
  const dragged = j.nodes.find(x => nodeKey(x) === from)
  if (!dragged || dragged.claimed) return
  const arr = j.nodes
  const fromIdx = arr.findIndex(x => nodeKey(x) === from)
  const toIdx = arr.findIndex(x => nodeKey(x) === nodeKey(target))
  if (fromIdx < 0 || toIdx < 0) return
  const [moved] = arr.splice(fromIdx, 1)
  arr.splice(toIdx, 0, moved)
  await persistNodes()
}
async function persistNodes(j?: Journey) {
  const tj = j ?? journey.value
  if (!tj) return
  await window.electronAPI.dbQuery(
    "UPDATE growth_journey SET nodes=?, updated_at=datetime('now','localtime') WHERE id=?",
    [JSON.stringify(tj.nodes), tj.id]
  )
}
async function sortByCost() {
  const j = journey.value
  if (!j) return
  j.nodes = [...j.nodes].sort((a, b) => a.cost - b.cost)
  await persistNodes(j)
}

// ── 新建宝典 ──
function startNewJourney() {
  setupCurrentId.value = 0
  setupTargetId.value = 0
  setupLiquidWan.value = ''
  modalNode.value = null
  showSetup.value = true
}

// ── 调整目标配置：在现有目标基础上推进，已解锁节点保留为历史站 ──
// 目标变更后重算待解锁节点：沿用未解锁节点的优先级顺序，已解锁槽位再次纳入目标时另起新一轮（round+1）
function rebuildNodesForTarget(current: Snapshot, target: Snapshot, prev: JNode[]) {
  const prevNodes = prev.map(n => JSON.parse(JSON.stringify(n)) as JNode)
  const slots = new Set<string>(NODE_SLOTS)
  for (const k of Object.keys(target.details || {})) slots.add(k)
  // 每个槽位取轮次最大的那一站作为「最新一站」
  const latestBySlot = new Map<string, JNode>()
  for (const n of prevNodes) {
    const cur = latestBySlot.get(n.slot)
    if (!cur || (n.round ?? 0) > (cur.round ?? 0)) latestBySlot.set(n.slot, n)
  }
  const need = (slot: string) => {
    const toItem = (target.details?.[slot] || '').trim()
    const fromItem = (current.details?.[slot] || '').trim()
    // 物品名不同，或同名但指向不同图鉴条目（同名多品质/多价格）都算目标变更
    return toItem && snapshotDiffers(current, target, slot) ? { toItem, fromItem } : null
  }
  const fill = (n: JNode, slot: string, d: { toItem: string; fromItem: string }): boolean => {
    const pid = resolvePriceIdLoose(target, slot)
    // 换物品，或同名但换了图鉴条目（品质/等级升级），都视为目标变更
    const changed = n.toItem !== d.toItem
      || (pid != null && n.priceParamId != null && n.priceParamId !== pid)
    n.fromItem = d.fromItem
    n.fromPriceId = resolvePriceIdLoose(current, slot)
    n.toItem = d.toItem
    n.priceParamId = pid
    if (changed) n.costEdited = false // 换了目标物品 → 门槛价重新跟图鉴
    if (!n.costEdited) n.cost = pid ? (priceMap.value.get(pid)?.market_price ?? 0) : 0
    return changed
  }

  const keep: JNode[] = [] // 已解锁的历史站（新目标下无需再动）
  const pend: JNode[] = [] // 待解锁：沿用原有优先级顺序
  const fresh: JNode[] = [] // 新一轮节点
  let added = 0, updated = 0, dropped = 0

  for (const n of prevNodes) {
    const d = need(n.slot)
    if (!d) {
      if (n.claimed) keep.push(n) // 已达成：保留为历史站
      else dropped++ // 未解锁且新目标不再需要 → 取消
      continue
    }
    if (n.claimed) { keep.push(n); continue } // 该槽位已达成过，新目标另起一轮 → 见下方 fresh
    // 同一槽位被更新轮次的节点取代（旧轮次未解锁即被新目标覆盖）→ 只保留最新一站
    if (latestBySlot.get(n.slot) !== n) { dropped++; continue }
    if (fill(n, n.slot, d)) updated++
    pend.push(n)
  }
  for (const slot of slots) {
    const d = need(slot)
    if (!d) continue
    const latest = latestBySlot.get(slot)
    if (latest && !latest.claimed) continue // 已作为待解锁节点沿用
    const pid = resolvePriceIdLoose(target, slot)
    fresh.push({
      slot, fromItem: d.fromItem, toItem: d.toItem,
      fromPriceId: resolvePriceIdLoose(current, slot),
      priceParamId: pid,
      cost: pid ? (priceMap.value.get(pid)?.market_price ?? 0) : 0,
      claimed: false, paid: null, claimedAt: null, recordId: null,
      round: latest ? (latest.round ?? 0) + 1 : 0,
    })
    added++
  }
  fresh.sort((a, b) => a.cost - b.cost) // 新节点按价格升序排在后段
  const pending = [...pend, ...fresh]
  return { nodes: [...keep, ...pending], pending, added, updated, dropped }
}

// 节点集签名：只比较派生关键字段（槽位/轮次/解锁态/目标与来源物品/价格条目/手动改价），
// 用于判断节点是否与目标快照同步，避免每次加载都无谓写库
function nodeSignature(ns: JNode[]): string {
  return ns.map(n => [
    n.slot, n.round ?? 0, n.claimed ? 1 : 0,
    n.toItem, n.fromItem, n.priceParamId ?? '',
    n.costEdited ? `e${n.cost}` : '',
  ].join('#')).join(';')
}

// 节点自愈：目标快照与节点集不同步时（旧版本按物品名比对漏建节点），按最新派生逻辑重建并持久化。
// 已解锁历史站原样保留、未解锁节点沿用原顺序、手动改过价的节点不被覆盖 —— 与「保存目标调整」同一套规则
async function repairJourneyNodes() {
  for (const j of journeys.value) {
    const r = rebuildNodesForTarget(j.current_snapshot, j.target_snapshot, j.nodes)
    if (nodeSignature(r.nodes) === nodeSignature(j.nodes)) continue
    await window.electronAPI.dbQuery(
      "UPDATE growth_journey SET nodes=?, updated_at=datetime('now','localtime') WHERE id=?",
      [JSON.stringify(r.nodes), j.id]
    )
    j.nodes = r.nodes
    console.info(`[宝典] 「${j.name}」节点与目标快照不同步，已自愈重建：补 ${r.added} / 变更 ${r.updated} / 取消 ${r.dropped}`)
  }
}

const showTargetModal = ref(false)
const targetSchemeId = ref(0)
const targetNameInput = ref('')
const targetSaving = ref(false)

// 待解锁节点门槛合计（当前目标）
const pendingCost = computed(() =>
  round7((journey.value?.nodes ?? []).filter(n => !n.claimed).reduce((s, n) => s + n.cost, 0)))

// 本宝典配置职业：优先取建档时锁定的 job；旧档未存则按当前/目标快照反查方案职业。
// 反查要求严格 100% 全槽位命中容易因节点解锁后槽位变化/方案微调而失败，导致职业无法识别、职业过滤失效；
// 因此改为「与某方案重叠度最高的方案」，并设最低阈值，重叠不足才视为职业未知（不限制）。
const journeyScheme = computed(() => {
  const j = journey.value
  if (!j) return null
  const storedId = schemes.value.find(s => s.id === (j as any).scheme_id)?.id
  const bestMatch = (snap: Snapshot): Scheme | null => {
    const entries = Object.entries(snap.details || {}).filter(([, v]) => (v || '').trim())
    if (entries.length === 0) return null
    let best: Scheme | null = null
    let bestRatio = 0
    for (const s of schemes.value) {
      let hit = 0
      for (const [k, v] of entries) if ((s.details[k] || '').trim() === v.trim()) hit++
      const ratio = hit / entries.length
      if (ratio > bestRatio) { bestRatio = ratio; best = s }
    }
    return bestRatio >= 0.7 ? best : null
  }
  return (storedId ? schemes.value.find(s => s.id === storedId) : null)
    || bestMatch(j.current_snapshot)
    || bestMatch(j.target_snapshot)
})
const journeyJob = computed(() => {
  const stored = (journey.value?.job || '').trim()
  if (stored) return stored
  return (journeyScheme.value?.job || '').trim()
})

// 调整目标只能选与本宝典同职业的方案（职业未知时不限制）
const targetSchemeCandidates = computed(() => {
  if (!journeyJob.value) return schemes.value
  return schemes.value.filter(s => (s.job || '').trim() === journeyJob.value)
})

const targetNameSuggest = computed(() => {
  const s = schemes.value.find(x => x.id === targetSchemeId.value)
  return s ? `${s.name} 养成` : (journey.value?.name ?? '')
})

// ── 配置对比弹窗：当前 vs 目标同屏对比，目标槽位可直接改选（原「逐槽位调整」已合并至此） ──
interface CustomSlotState {
  slot: string
  current: string // 当前配置里该槽位的物品（只读展示）
  target: string // 目标方案里该槽位的物品（'' = 未纳入目标）
  picked: PriceRow | null // 新选定的图鉴物品
  cleared: boolean // 从目标中清除该槽位
  query: string
  focused: boolean
}
const customSlots = ref<CustomSlotState[]>([])
const showCurModal = ref(false)
const cfgSaving = ref(false)

// 位置分页：屏幕内只看一类位置，避免一屏塞下全部槽位
type CfgTab = 'equip' | 'spirit' | 'grow' | 'shenyuan' | 'beast'
const cfgTab = ref<CfgTab>('equip')
const CFG_TABS: Array<{ key: CfgTab; label: string; icon: string }> = [
  { key: 'equip', label: '装备', icon: 'swords' },
  { key: 'spirit', label: '灵魄', icon: 'gem' },
  { key: 'grow', label: '养成', icon: 'wand' },
  { key: 'shenyuan', label: '元神', icon: 'ghost' },
  { key: 'beast', label: '灵兽', icon: 'bird' },
]
const cfgTabLabel = computed(() => CFG_TABS.find(t => t.key === cfgTab.value)?.label ?? '')

// 各页签槽位数（页签上的小计数）
const cfgTabCounts = computed<Record<CfgTab, number>>(() => {
  const c: Record<CfgTab, number> = { equip: 0, spirit: 0, grow: 0, shenyuan: 0, beast: 0 }
  for (const cs of customSlots.value) {
    if (cs.slot.startsWith('灵兽:')) c.beast++
    else if (SHENYUAN_SLOTS.includes(cs.slot)) c.shenyuan++
    else if (SPIRIT_SLOTS.includes(cs.slot)) c.spirit++
    else if (OTHER_SLOTS.includes(cs.slot)) c.grow++
    else if (EQUIP_SLOTS.includes(cs.slot)) c.equip++
  }
  return c
})

function buildCustomSlots() {
  const j = journey.value
  const tgt = j?.target_snapshot?.details ?? {}
  const cur = j?.current_snapshot?.details ?? {}
  // 全部槽位都展示（含当前/目标都为空的），方便对任意槽位做修改/补充/新增；
  // 灵兽槽位与配号中心同源（beastData 布局）且 key 同为 1 起（灵兽:分类:品级:序号，序号从 1 开始），
  // 与 DB 快照/方案的槽位 key 完全一致，保证读值不错位
  const set = new Set<string>(NODE_SLOTS)
  const beastData = loadBeastData()
  // 灵兽：每个位置都有专属名字（分类·品级·序号[1起] → 名字），槽位为空也直接显示其名字
  const beastName = (slot: string): string => {
    const p = slot.split(':') // ['灵兽', 分类, 品级, 序号(1起)]
    if (p.length < 4) return ''
    // beastData 数组是 0 基，序号(1起) 转数组下标要减 1
    return beastData?.[p[1]]?.[p[2]]?.[Number(p[3] || 1) - 1] ?? ''
  }
  for (const [cat, grades] of Object.entries(beastData || {})) {
    for (const [grade, names] of Object.entries(grades || {})) {
      names.forEach((_, i) => set.add(`灵兽:${cat}:${grade}:${i + 1}`))
    }
  }
  for (const [k, v] of Object.entries(tgt)) if ((v || '').trim()) set.add(k)
  for (const [k, v] of Object.entries(cur)) if ((v || '').trim()) set.add(k)
  customSlots.value = [...set].map(slot => {
    const t = (tgt[slot] || '').trim()
    // 灵兽槽位：当前/目标为空时用该位置的名字占位展示（仍可改选）
    const fallback = slot.startsWith('灵兽:') ? beastName(slot) : ''
    return {
      slot,
      current: (cur[slot] || '').trim() || (slot.startsWith('灵兽:') ? fallback : ''),
      target: t || (slot.startsWith('灵兽:') ? fallback : ''),
      picked: null,
      cleared: false,
      query: t || (slot.startsWith('灵兽:') ? fallback : ''), // 右侧输入框初始即显示目标方案物品（改选时直接输入覆盖）
      focused: false,
    }
  })
}

// 灵兽位置名：分类·品级 N号（1起） → 具体名字（buildCustomSlots 的空槽位占位来源）
function beastSlotName(slot: string): string {
  if (!slot.startsWith('灵兽:')) return ''
  const p = slot.split(':')
  return (loadBeastData()?.[p[1]]?.[p[2]]?.[Number(p[3] || 1) - 1] ?? '')
}

// 配置对比打开期间：节点解锁/撤销会推进 current_snapshot，实时同步到左侧「当前配置」列
// 无论弹窗是否开着都持续同步（customSlots 仅在 buildCustomSlots 后存在，开启后即已刷新）；
// 这样节点落地后重开配置对比、或弹窗打开期间快照被推进，左列都能取到最新当前装备。
function syncCustomCurrent() {
  if (!showCurModal.value || customSlots.value.length === 0) return
  const cur = journey.value?.current_snapshot?.details ?? {}
  for (const cs of customSlots.value) {
    const live = (cur[cs.slot] || '').trim()
    if (live) cs.current = live
    else if (cs.slot.startsWith('灵兽:')) cs.current = beastSlotName(cs.slot)
    else cs.current = ''
  }
}
watch(() => journey.value?.current_snapshot, syncCustomCurrent, { deep: true })
// 节点落地会整段重载 journey（loadAll 换新对象）；仅在弹窗开着时重建左列快照字段，目标侧的编辑(picked/cleared/query)不受影响
watch(() => journey.value, () => {
  if (showCurModal.value && customSlots.value.length > 0) {
    const cur = journey.value?.current_snapshot?.details ?? {}
    for (const cs of customSlots.value) {
      if (cs.picked || cs.cleared) continue // 目标侧有未保存编辑的槽位保留其状态
      const live = (cur[cs.slot] || '').trim()
      if (live) cs.current = live
      else if (cs.slot.startsWith('灵兽:')) cs.current = beastSlotName(cs.slot)
      else cs.current = ''
    }
  }
})

function customSlotLabel(slot: string): string {
  if (slot.startsWith('元神:')) return slot.replace('元神:', '')
  // 灵兽:分类:品级:序号 → 分类·品级 N号
  if (slot.startsWith('灵兽:')) {
    const p = slot.split(':')
    return `${p[1] || '灵兽'}·${p[2] || ''} ${Number(p[3] || 1)}号`
  }
  return slotLabel(slot)
}

// 当前页签下的槽位行（按配号中心的槽位顺序排列）
const CFG_TAB_ORDER = [...EQUIP_SLOTS, ...SPIRIT_SLOTS, ...OTHER_SLOTS, ...SHENYUAN_SLOTS]
const cfgRows = computed(() => {
  const tab = cfgTab.value
  const inTab = (slot: string) =>
    tab === 'equip' ? EQUIP_SLOTS.includes(slot)
      : tab === 'spirit' ? SPIRIT_SLOTS.includes(slot)
      : tab === 'grow' ? OTHER_SLOTS.includes(slot)
      : SHENYUAN_SLOTS.includes(slot)
  return customSlots.value
    .filter(cs => inTab(cs.slot))
    .sort((a, b) => {
      const ia = CFG_TAB_ORDER.indexOf(a.slot)
      const ib = CFG_TAB_ORDER.indexOf(b.slot)
      if (ia !== ib) return (ia < 0 ? 9999 : ia) - (ib < 0 ? 9999 : ib)
      return a.slot.localeCompare(b.slot, 'zh')
    })
})

// 灵兽页签：按配号中心布局按分类分组（分类 → 品级顺序 → 序号）
const beastCatRows = computed(() => {
  const keyOf = (slot: string) => {
    const p = slot.split(':') // ['灵兽', 分类, 品级, 序号]
    const g = BEAST_GRADES.indexOf(p[2] || '')
    return { g: g < 0 ? 99 : g, i: Number(p[3] || 0) }
  }
  return BEAST_CATS
    .map(cat => ({
      cat,
      rows: customSlots.value
        .filter(cs => cs.slot.startsWith(`灵兽:${cat}:`))
        .sort((a, b) => {
          const A = keyOf(a.slot); const B = keyOf(b.slot)
          return A.g - B.g || A.i - B.i
        }),
    }))
    .filter(g => g.rows.length > 0)
})

// 灵兽页签内二级分类 tab（猛兽/精怪/护甲/...），'' = 未选（自动落到第一个有槽位的分类）
const beastCat = ref('')
watch([cfgTab, beastCatRows], () => {
  if (cfgTab.value !== 'beast') { beastCat.value = ''; return }
  const cats = beastCatRows.value.map(g => g.cat)
  if (!beastCat.value || !cats.includes(beastCat.value)) beastCat.value = cats[0] || ''
})

// 渲染分组：非灵兽页签只有一组（页签名）；灵兽页签按二级分类 tab 只显示当前分类一组
const cfgGroups = computed(() => {
  if (cfgTab.value !== 'beast') return [{ cat: cfgTabLabel.value, rows: cfgRows.value }]
  return beastCatRows.value.filter(g => !beastCat.value || g.cat === beastCat.value)
})

// 各位置价格（像配号中心一样：物品名 + 市场价；旧快照没记价格 id 时按物品名兜底）
function curPriceOf(cs: CustomSlotState): number {
  const j = journey.value
  if (!cs.current || !j) return 0
  return snapshotMarketPrice(j.current_snapshot, cs.slot)
}
function tgtPriceOf(cs: CustomSlotState): number {
  if (cs.picked) return cs.picked.market_price
  const j = journey.value
  if (!cs.target || !j) return 0
  return snapshotMarketPrice(j.target_snapshot, cs.slot)
}

// 各位置品质（用于字体着色，同配号中心）
function snapQuality(snap: Snapshot, slot: string): string {
  const id = resolvePriceIdLoose(snap, slot)
  return id != null ? (priceMap.value.get(id)?.quality || '') : ''
}
function curQualityOf(cs: CustomSlotState): string {
  const j = journey.value
  if (!cs.current || !j) return ''
  return snapQuality(j.current_snapshot, cs.slot)
}
function tgtQualityOf(cs: CustomSlotState): string {
  if (cs.picked) return cs.picked.quality
  const j = journey.value
  if (!cs.target || !j) return ''
  return snapQuality(j.target_snapshot, cs.slot)
}
// 右侧输入框文字颜色：已选中 → 所选物品品质色；文本与目标一致 → 目标品质色；输入搜索词中 → 默认色
function tgtInputColor(cs: CustomSlotState): string {
  if (cs.picked) return getQualityColor(cs.picked.quality)
  if (cs.query && cs.query === cs.target) return getQualityColor(tgtQualityOf(cs))
  return 'inherit'
}

// 下拉行右侧信息：品质 · 备注 · 市价
function dropMeta(p: PriceRow): string {
  return [p.quality || '', (p.notes || '').trim(), '市 ' + fmtWan(p.market_price)].filter(Boolean).join(' · ')
}

// ── 道具图片（槽位下拉有图时显示查看图标，与配号中心逻辑一致） ──
const viewerVisible = ref(false)
const viewerImages = ref<string[]>([])
const itemsWithImages = ref<Set<string>>(new Set()) // 键：`p{price_id}` 或 item_name
async function refreshImageSet() {
  try {
    const rows = await window.electronAPI.dbQuery(
      'SELECT DISTINCT item_name, price_id FROM equipment_images'
    ) as Array<{ item_name: string; price_id: number | null }>
    const set = new Set<string>()
    for (const r of rows) set.add(r.price_id ? `p${r.price_id}` : r.item_name)
    itemsWithImages.value = set
  } catch { itemsWithImages.value = new Set() }
}
function optionHasImage(p: PriceRow): boolean {
  if (itemsWithImages.value.has(`p${p.id}`)) return true
  return itemsWithImages.value.has(p.item_name)
}
async function viewOptionImage(p: PriceRow) {
  if (!p) return
  let rows = p.id > 0 ? await window.electronAPI.listImages(p.item_name, p.id) : await window.electronAPI.listImages(p.item_name)
  // 旧数据回退：图片未绑定 price_id
  if (rows.length === 0 && p.id > 0) rows = await window.electronAPI.listImages(p.item_name)
  if (!rows.length) {
    itemsWithImages.value.delete(`p${p.id}`)
    itemsWithImages.value.delete(p.item_name)
    return
  }
  const dataUrls = (await Promise.all(rows.map(async r => await window.electronAPI.readImage(r.image_path)))).filter(Boolean) as string[]
  viewerImages.value = dataUrls
  if (viewerImages.value.length) viewerVisible.value = true
}

// 灵魄槽位 → 灵魄位置（与配号中心 SPIRIT_POSITION_SLOTS 一致）
const SPIRIT_POSITION_SLOTS: Record<string, string[]> = {
  '利刃': ['武器灵', '护手灵', '上装灵'],
  '坚盾': ['头盔灵', '面具灵', '下装灵', '鞋子灵'],
  '灵啸': ['项链灵', '戒指灵'],
  '守神': ['翅膀灵', '符咒灵'],
}
function slotSpiritPosition(slot: string): string | null {
  for (const [pos, slots] of Object.entries(SPIRIT_POSITION_SLOTS)) {
    if (slots.includes(slot)) return pos
  }
  return null
}

// 下拉候选：与配号中心各槽位逻辑一致 —— 装备按职业+等级过滤、灵魄按位置过滤、灵兽按该位置名字精确、其余养成按 category 过滤（八阵图/子女/奥义/灵珠/羽灵/元神）
function slotCandidates(cs: CustomSlotState): PriceRow[] {
  const slot = cs.slot
  const kw = cs.query.trim().toLowerCase()
  const byKw = (list: PriceRow[]) => {
    if (!kw) return list
    return list.filter(p => {
      const txt = (p.item_name + ' ' + p.category + ' ' + (p.quality || '')).toLowerCase()
      if (txt.includes(kw)) return true
      const py = pinyinOf(p.item_name)
      return (py.initials && py.initials.includes(kw)) || (py.full && py.full.includes(kw))
    })
  }
  const sc = journeyScheme.value
  const job = journeyJob.value

  // 装备槽位：职业 + 等级过滤（与配号中心一致；装备物品 category='装备'，槽位在 slot 字段）
  if (EQUIP_SLOTS.includes(slot)) {
    let list = priceRows.value.filter(p => (p.slot || '') === slot || (p.category === '装备' && (p.slot || '') === slot))
    if (job) list = list.filter(p => !p.equip_job || p.equip_job === job)
    if (sc && sc.level_num > 0) list = list.filter(p => p.equip_level <= 0 || p.equip_level <= sc.level_num)
    return byKw(list)
  }
  // 灵魄槽位：位置过滤
  const spiritPos = slotSpiritPosition(slot)
  if (spiritPos) {
    let list = priceRows.value.filter(p => p.category === '灵魄')
    if (spiritPos) list = list.filter(p => !p.spirit_position || p.spirit_position === spiritPos)
    return byKw(list)
  }
  // 灵兽槽位：仅该位置的名字（可被关键词放宽匹配，但默认只有这一个候选）
  if (slot.startsWith('灵兽:')) {
    const name = beastSlotName(slot)
    const list = name ? priceRows.value.filter(p => p.item_name === name) : []
    return byKw(list).length ? byKw(list) : (kw ? byKw(priceRows.value) : list)
  }
  // 其余养成槽位（八阵图/子女/奥义/灵珠/羽灵/元神）：按 category 过滤，与配号中心 getSlotRefKeys 一致
  // 八阵图 → 八阵图；子女 → 子女+子女材料；奥义 → 奥义(职业过滤)；灵珠 → 灵珠；羽灵 → 羽灵；元神:→ 元神
  const catSet = ((): string[] | null => {
    if (slot === '八阵图') return ['八阵图']
    if (slot === '子女') return ['子女', '子女材料']
    if (slot === '奥义') return ['奥义']
    if (slot === '灵珠') return ['灵珠']
    if (slot === '羽灵') return ['羽灵']
    if (slot.startsWith('元神:')) return ['元神']
    return null
  })()
  if (catSet) {
    let list = priceRows.value.filter(p => catSet.includes(p.category))
    // 奥义：职业过滤（与配号中心一致，用物品 equip_job 匹配）
    if (slot === '奥义' && job) list = list.filter(p => !p.equip_job || p.equip_job === job)
    return byKw(list)
  }
  // 未知槽位兜底：全量
  return byKw(priceRows.value)
}

function customMatches(cs: CustomSlotState): PriceRow[] {
  const kw = cs.query.trim().toLowerCase()
  if (!kw) {
    // 留空即自动弹出默认候选：与配号中心一致的槽位候选，优先最近录入，否则按候选（装备/灵魄/灵兽已按槽位过滤）
    const recent = recentItems.value.filter(p => !cs.slot.startsWith('灵兽:'))
    if (recent.length) return recent
    return slotCandidates(cs).slice(0, 20)
  }
  return slotCandidates(cs).slice(0, 20)
}
// 目标配置该槽位当前持久化的价格 id（按存储值取，不做物品名兜底；null = 目标里没记该槽位价格）
function tgtStoredPriceId(cs: CustomSlotState): number | null {
  const j = journey.value
  return j ? resolvePriceId(j.target_snapshot, cs.slot) : null
}
// 目标配置是否真正记录了这个槽位（防止灵兽空槽位的占位名被误判为「已有内容」）
function tgtSlotFilled(cs: CustomSlotState): boolean {
  const j = journey.value
  if (!j) return false
  const snap = j.target_snapshot
  return !!((snap.details?.[cs.slot] || '').trim() || tgtStoredPriceId(cs) != null)
}
// 配置对比行的差异高亮：物品名不同，或同名但指向不同图鉴条目（同名多品质/多价格，如换灵魄品质）
function csDiffers(cs: CustomSlotState): boolean {
  if (cs.cleared) return false
  if ((cs.current || '') !== (cs.target || '')) return true
  const j = journey.value
  if (!j) return false
  const cid = resolvePriceIdLoose(j.current_snapshot, cs.slot)
  const tid = resolvePriceIdLoose(j.target_snapshot, cs.slot)
  return cid != null && tid != null && cid !== tid
}

function customPickSlot(cs: CustomSlotState, p: PriceRow) {
  cs.picked = p
  cs.query = p.item_name
  cs.cleared = false
  cs.focused = false
  // 重选与目标配置「相同价格条目」(id 相同) 的道具 = 目标其实没变化 → 还原为未编辑态，不记为修改
  if (tgtSlotFilled(cs) && tgtStoredPriceId(cs) === p.id) {
    customResetSlot(cs)
  }
}
function customQueryInput(cs: CustomSlotState) {
  cs.picked = null // 重新输入视为改选
  cs.cleared = false
}
function customClearSlot(cs: CustomSlotState) {
  // 目标本来就没记录这个槽位 → 清除无意义，不构成变化，保持未编辑态
  if (!tgtSlotFilled(cs)) { customResetSlot(cs); return }
  cs.picked = null
  cs.query = ''
  cs.cleared = true
}
function customResetSlot(cs: CustomSlotState) {
  cs.picked = null
  cs.cleared = false
  cs.query = cs.target // 还原：输入框放回原目标物品
}

// 逐槽位调整后的目标快照：现有目标 + 已选物品覆盖 / 已清除槽位移除
const cfgTargetSnapshot = computed<Snapshot>(() => {
  const j = journey.value
  const base: Snapshot = {
    details: { ...(j?.target_snapshot.details || {}) },
    slot_price_ids: { ...(j?.target_snapshot.slot_price_ids || {}) },
  }
  for (const cs of customSlots.value) {
    if (cs.picked) {
      base.details[cs.slot] = cs.picked.item_name
      base.slot_price_ids[cs.slot] = cs.picked.id
    } else if (cs.cleared) {
      delete base.details[cs.slot]
      delete base.slot_price_ids[cs.slot]
    }
  }
  return base
})
const cfgTargetValue = computed(() => snapshotFixedValue(cfgTargetSnapshot.value))

const cfgHasChanges = computed(() => customSlots.value.some(cs => cs.picked || cs.cleared))
const cfgChangeCount = computed(() => customSlots.value.filter(cs => cs.picked || cs.cleared).length)
const cfgPreview = computed(() => {
  const j = journey.value
  if (!j || !cfgHasChanges.value) return { added: 0, updated: 0, dropped: 0, pendingCount: 0, pendingCost: 0 }
  const r = rebuildNodesForTarget(j.current_snapshot, cfgTargetSnapshot.value, j.nodes)
  return {
    added: r.added,
    updated: r.updated,
    dropped: r.dropped,
    pendingCount: r.pending.length,
    pendingCost: round7(r.pending.reduce((s, n) => s + n.cost, 0)),
  }
})

function openCfg() {
  cfgTab.value = 'equip'
  buildCustomSlots()
  showCurModal.value = true
  refreshImageSet() // 打开即刷新图片集合，让有图道具的查看图标即时出现
}

async function confirmCfgTarget() {
  const j = journey.value
  if (!j || cfgSaving.value || !cfgHasChanges.value) return
  const t = cfgTargetSnapshot.value
  const preview = cfgPreview.value
  const claimedCountNow = j.nodes.filter(n => n.claimed).length
  const msg = `保存目标调整：新增 ${preview.added} 个节点、目标变更 ${preview.updated} 个、取消 ${preview.dropped} 个。已解锁的 ${claimedCountNow} 站历史保留不变。`
  if (!(await appConfirm({ title: '保存目标调整', message: msg, confirmText: '保存' }))) return
  cfgSaving.value = true
  try {
    const r = rebuildNodesForTarget(j.current_snapshot, t, j.nodes)
    await window.electronAPI.dbQuery(
      "UPDATE growth_journey SET target_snapshot=?, nodes=?, updated_at=datetime('now','localtime') WHERE id=?",
      [JSON.stringify(t), JSON.stringify(r.nodes), j.id]
    )
    showCurModal.value = false
    await loadAll()
    showToast(`目标已更新：新增 ${r.added} 站、取消 ${r.dropped} 站`)
  } finally {
    cfgSaving.value = false
  }
}

// ── 调整目标配置：只做「替换为新方案」（同职业方案） ──
const nextTargetSnapshot = computed<Snapshot | null>(() => {
  if (!targetSchemeId.value) return null
  return schemeSnapshot(targetSchemeId.value)
})

const targetReady = computed(() => targetSchemeId.value > 0)
const targetPreview = computed(() => {
  const j = journey.value
  const t = nextTargetSnapshot.value
  if (!j || !t) return { added: 0, updated: 0, dropped: 0, pendingCount: 0, pendingCost: 0 }
  const r = rebuildNodesForTarget(j.current_snapshot, t, j.nodes)
  return {
    added: r.added,
    updated: r.updated,
    dropped: r.dropped,
    pendingCount: r.pending.length,
    pendingCost: round7(r.pending.reduce((s, n) => s + n.cost, 0)),
  }
})

function openTargetModal() {
  targetSchemeId.value = 0
  targetNameInput.value = ''
  targetSaving.value = false
  showTargetModal.value = true
}

async function confirmTargetChange() {
  const j = journey.value
  const t = nextTargetSnapshot.value
  if (!j || !t || targetSaving.value) return
  // 双保险：替换目标时所选方案必须与本宝典同职业
  const sc = schemes.value.find(x => x.id === targetSchemeId.value)
  if (journeyJob.value && (sc?.job || '').trim() !== journeyJob.value) {
    showToast('新目标方案需与本宝典当前配置同职业')
    return
  }
  const preview = targetPreview.value
  const claimedCountNow = j.nodes.filter(n => n.claimed).length
  const msg = `替换目标：新增 ${preview.added} 个节点、目标变更 ${preview.updated} 个、取消 ${preview.dropped} 个。已解锁的 ${claimedCountNow} 站历史保留不变。`
  if (!(await appConfirm({ title: '替换目标', message: msg, confirmText: '替换' }))) return
  targetSaving.value = true
  try {
    const r = rebuildNodesForTarget(j.current_snapshot, t, j.nodes)
    const name = targetNameInput.value.trim() || j.name
    await window.electronAPI.dbQuery(
      "UPDATE growth_journey SET target_snapshot=?, nodes=?, name=?, updated_at=datetime('now','localtime') WHERE id=?",
      [JSON.stringify(t), JSON.stringify(r.nodes), name, j.id]
    )
    showTargetModal.value = false
    await loadAll()
    showToast(`目标已更新：新增 ${r.added} 站、取消 ${r.dropped} 站`)
  } finally {
    targetSaving.value = false
  }
}

// ── 删除宝典：宝典档案与挂在其名下的流水一并删除（钱包与其他宝典不受影响） ──
async function deleteJourney() {
  const j = journey.value
  const sid = app.currentServerId
  if (!j || !sid) return
  if (!(await appConfirm({ title: '删除宝典', message: `删除宝典「${j.name}」？该宝典的流动资金、全部流水（收益/支出/装备投入）与背包将一并删除，无法恢复。钱包与其他宝典不受影响。`, confirmText: '删除', danger: true }))) return
  await window.electronAPI.dbTransaction([
    { sql: 'DELETE FROM asset_records WHERE journey_id=?', params: [j.id] },
    { sql: 'DELETE FROM backpack_items WHERE journey_id=?', params: [j.id] },
    { sql: 'DELETE FROM growth_journey WHERE id=?', params: [j.id] },
  ])
  localStorage.removeItem(`sgbuddy-active-journey-${sid}`)
  await loadAll()
}

// ── 节点解锁顺序：弹窗内微调优先级（主界面节点轨道也可直接拖动） ──
const showOrderModal = ref(false)
// 已解锁节点固定置前，弹窗只编辑未解锁节点的优先级（即 growth_journey.nodes 的存储顺序）
const pendingOrder = computed(() => (journey.value?.nodes ?? []).filter(n => !n.claimed))
function openOrderModal() {
  showOrderModal.value = true
}
async function moveNode(n: JNode, delta: number) {
  const j = journey.value
  if (!j) return
  const arr = j.nodes
  const slots = arr.map((x, i) => (x.claimed ? null : i)).filter((i): i is number => i != null)
  const cur = slots.findIndex(i => nodeKey(arr[i]) === nodeKey(n))
  const to = cur + delta
  if (cur < 0 || to < 0 || to >= slots.length) return
  const a = slots[cur]
  const b = slots[to]
  ;[arr[a], arr[b]] = [arr[b], arr[a]]
  await persistNodes()
}

// ── 今日账单：活跃收入 ──
const baseTiers = (activityCalcData as any).tierConfig as Record<string, { target: number; tier1: number; tier2: number; tier3: number }>
const customTiers = ref<Record<string, { tier1?: number; tier2?: number; tier3?: number }>>({})

async function loadTiers() {
  const saved = await window.electronAPI.getSetting('activity_tiers_all')
  customTiers.value = parseJSON<Record<string, { tier1?: number; tier2?: number; tier3?: number }>>(saved, {})
}
function tierAmountWan(lv: number, t: number): number {
  const base = baseTiers[String(lv)] || { target: 0, tier1: 0, tier2: 0, tier3: 0 }
  const custom = customTiers.value[String(lv)]
  const key = ('tier' + t) as 'tier1'
  return (custom as any)?.[key] ?? base[key] ?? 0
}
// 档位为累计收入：选 t 档 = 获得 1..t 档之和
function tierCumAmountWan(lv: number, t: number): number {
  let s = 0
  for (let k = 1; k <= t; k++) s += tierAmountWan(lv, k)
  return s
}

// 号配置（按大区存 app_settings）：设置里有几个号、各什么等级；主面板逐号单选今日档位
interface CharCfg { name: string; band: number }
const chars = ref<CharCfg[]>([])
const charTiers = ref<number[]>([])
// 活跃档位勾选按宝典独立（会话级）：key = journey id，切换宝典时由 loadJourneyScoped 存取。
// 已提交今日账单的勾选由 hydrateBillFromToday 从流水回填（持久层），未提交的勾选只在会话内隔离
const charTiersByJourney = ref<Record<number, number[]>>({})
const charsKey = computed(() => `growth_book_chars_${app.currentServerId}`)

async function loadChars() {
  const saved = await window.electronAPI.getSetting(charsKey.value)
  const list = parseJSON<CharCfg[]>(saved, [])
  // 先给中立默认值（满档），不保留上一宝典的勾选（防止切宝典串档）；
  // 本宝典会话快照由 loadJourneyScoped 在 loadChars 之后恢复，今日已提交档位由 hydrateBillFromToday 回填
  chars.value = list
  charTiers.value = list.map(() => 3)
}
function pickTier(i: number, t: number) {
  charTiers.value[i] = charTiers.value[i] === t ? 0 : t
}
const activeTotalWan = computed(() => chars.value.reduce((s, c, i) => {
  const t = charTiers.value[i]
  return s + (t ? tierCumAmountWan(c.band, t) : 0)
}, 0))
const activeTotalYi = computed(() => wanNumToYi(activeTotalWan.value))

const showCharsModal = ref(false)
const charsDraft = ref<CharCfg[]>([])

function openCharsModal() {
  charsDraft.value = JSON.parse(JSON.stringify(chars.value)) as CharCfg[]
  showCharsModal.value = true
}
async function saveChars() {
  chars.value = charsDraft.value.filter(c => c.band > 0)
  charTiers.value = chars.value.map((_, i) => charTiers.value[i] ?? 3) // 新号默认满档
  await window.electronAPI.setSetting(charsKey.value, JSON.stringify(chars.value))
  showCharsModal.value = false
}

// 档位工资编辑（写回 activity_tiers_all，与攻略页共用）
const showTierModal = ref(false)
const tierDraft = ref<Record<number, { tier1: number; tier2: number; tier3: number }>>({})

function openTierEdit() {
  const draft: Record<number, { tier1: number; tier2: number; tier3: number }> = {}
  for (const lv of LV_BANDS) {
    draft[lv] = { tier1: tierAmountWan(lv, 1), tier2: tierAmountWan(lv, 2), tier3: tierAmountWan(lv, 3) }
  }
  tierDraft.value = draft
  showTierModal.value = true
}
function setTierDraft(lv: number, t: number, val: string) {
  const v = parseFloat(val)
  const d = tierDraft.value[lv]
  if (!d || isNaN(v) || v < 0) return
  d[('tier' + t) as 'tier1'] = v
}
async function saveTierEdits() {
  const next = { ...customTiers.value }
  for (const lv of LV_BANDS) {
    const d = tierDraft.value[lv]
    if (!d) continue
    const base = baseTiers[String(lv)]
    next[String(lv)] = {
      ...(base || { target: 0, tier1: 0, tier2: 0, tier3: 0 }),
      tier1: d.tier1, tier2: d.tier2, tier3: d.tier3,
    }
  }
  customTiers.value = next
  await window.electronAPI.setSetting('activity_tiers_all', JSON.stringify(next))
  showTierModal.value = false
}

// ── 今日账单：收支条目（道具 + 直录合并） ──
interface BillEntry {
  key: number; direction: 'income' | 'expense'; kind: 'item' | 'manual'
  itemName: string; priceParamId: number | null
  quantity: number; unitWan: string
  fromBackpack?: boolean // 收入道具条目：true=卖的是背包存货（扣减背包），false=产出即卖（不动背包）
  committed?: boolean // 已单独计入今日账单
}
const entries = ref<BillEntry[]>([])
let entryKey = 1

const entryDirection = ref<'income' | 'expense'>('income')
const entryFromBackpack = ref(false) // 收入道具条目的卖出来源，默认产出即卖（不误扣背包）
const entryQuery = ref('')
const entryParam = ref<PriceRow | null>(null)
const entryQty = ref('1')
const entryUnitWan = ref('')
const entrySearchFocused = ref(false)

const entryMatches = computed(() => searchPriceRows(entryQuery.value))

// 与物价图鉴同款搜索：物品名/分类文本 + 拼音首字母 + 全拼
function searchPriceRows(query: string): PriceRow[] {
  const kw = query.trim().toLowerCase()
  if (!kw) return []
  return priceRows.value.filter(p => {
    const txt = (p.item_name + ' ' + p.category + ' ' + (p.quality || '')).toLowerCase()
    if (txt.includes(kw)) return true
    const py = pinyinOf(p.item_name)
    return (py.initials && py.initials.includes(kw)) || (py.full && py.full.includes(kw))
  }).slice(0, 20)
}

// 最近录入过的道具（按流水时间倒序去重），搜索框留空时作为提示展示
const recentItems = computed(() => {
  const seen = new Set<number>()
  const out: PriceRow[] = []
  for (const r of records.value) {
    if (r.source !== 'item') continue
    const pid = parseJSON<any>(r.detail, {}).price_param_id
    if (!pid || seen.has(pid)) continue
    const p = priceMap.value.get(pid)
    if (!p) continue
    seen.add(pid)
    out.push(p)
    if (out.length >= 8) break
  }
  return out
})

const pyCache = new Map<string, { initials: string; full: string }>()
function pinyinOf(name: string): { initials: string; full: string } {
  let v = pyCache.get(name)
  if (!v) {
    v = { initials: toPinyinInitials(name), full: toFullPinyin(name) }
    pyCache.set(name, v)
  }
  return v
}
function toPinyinInitials(str: string): string {
  if (!str) return ''
  try {
    // tiny-pinyin 返回完整拼音（空格分隔），取每段首字母即为拼音首字母
    return convertToPinyin(str, ' ', true).split(' ').map(s => s[0] || '').join('').toLowerCase()
  } catch {
    return str.replace(/[\u4e00-\u9fff]/g, '').toLowerCase()
  }
}
function toFullPinyin(str: string): string {
  if (!str) return ''
  try {
    return convertToPinyin(str, '', true).replace(/\s+/g, '').toLowerCase()
  } catch {
    return str.replace(/[\u4e00-\u9fff]/g, '').toLowerCase()
  }
}
function pickItem(p: PriceRow) {
  entryParam.value = p
  entryQuery.value = p.item_name
  entryUnitWan.value = String(Math.round((p.market_price || 0) * 10000 * 100) / 100)
  entryFromBackpack.value = false // 默认产出即卖；卖的是背包存货时手动改为背包出库
}
function flipEntryDirection() {
  entryDirection.value = entryDirection.value === 'income' ? 'expense' : 'income'
  entryFromBackpack.value = false
}
function clearEntryItem() {
  entryParam.value = null
  entryQuery.value = ''
  entryFromBackpack.value = false
}
// 背包里该物品的现有数量（卖出开关旁提示，便于判断该不该扣背包）
function bpStockOf(p: PriceRow): number {
  return backpack.value.find(b => b.price_param_id === p.id)?.quantity ?? 0
}
function addEntry() {
  const unit = parseFloat(entryUnitWan.value) || 0
  if (unit <= 0) return
  entries.value.push({
    key: entryKey++,
    direction: entryDirection.value,
    kind: entryParam.value ? 'item' : 'manual',
    itemName: entryParam.value?.item_name || '',
    priceParamId: entryParam.value?.id ?? null,
    quantity: parseInt(entryQty.value) || 1,
    unitWan: String(unit),
    fromBackpack: entryDirection.value === 'income' && entryParam.value ? entryFromBackpack.value : undefined,
  })
  entryParam.value = null
  entryQuery.value = ''
  entryQty.value = '1'
  entryUnitWan.value = ''
  entryFromBackpack.value = false
}
function removeEntry(key: number) {
  entries.value = entries.value.filter(e => e.key !== key)
}
function toggleEntryDir(key: number) {
  const e = entries.value.find(x => x.key === key)
  if (!e || e.committed) return // 已计入的条目改动走「重新提交今日账单」整体生效
  e.direction = e.direction === 'income' ? 'expense' : 'income'
  e.committed = false // 内容变了需重新计入
}
function flipEntryBp(e: BillEntry) {
  if (e.committed) return
  e.fromBackpack = !e.fromBackpack
  e.committed = false
}
function entryAmountWan(e: BillEntry): number {
  return (parseFloat(e.unitWan) || 0) * (e.kind === 'item' ? e.quantity : 1)
}
function entryText(e: BillEntry): string {
  if (e.kind === 'item') return `${e.itemName} ×${e.quantity}（单价 ${fmtWanShort(wanNumToYi(parseFloat(e.unitWan)))} 万）`
  return '直录'
}
const entriesTotalYi = computed(() => round7(entries.value.reduce((s, e) => {
  const amt = wanNumToYi(entryAmountWan(e))
  return s + (e.direction === 'income' ? amt : -amt)
}, 0)))
const billNetYi = computed(() => round7(activeTotalYi.value + entriesTotalYi.value))

// 历史平均日净收益（收入−支出，不含装备投入；按有记账的天数平均）
const avgDailyNet = computed(() => {
  const days = new Set(records.value.map(r => r.record_date))
  if (days.size === 0) return 0
  let net = 0
  for (const r of records.value) {
    if (r.type === 'income') net += r.amount
    else if (r.type === 'expense' && r.source !== 'gear') net -= r.amount
  }
  return round7(net / days.size)
})

// 按历史平均日净收益，估算距下一节点解锁的天数
const daysToNextNode = computed(() => {
  if (!nextNode.value) return null
  const daily = avgDailyNet.value
  if (daily <= 0) return null
  return Math.ceil(remainingCost.value / daily)
})
const daysToNextLabel = computed(() => {
  if (!nextNode.value) return '已达成'
  if (daysToNextNode.value == null) return '—'
  return `${daysToNextNode.value} 天`
})
const daysHint = computed(() => {
  if (!nextNode.value) return '宝典节点已全部解锁'
  const days = new Set(records.value.map(r => r.record_date)).size
  const base = `按历史平均日净收益 ${fmtWan(avgDailyNet.value)}/天 估算（共 ${days} 个记账日）`
  return `${base}，解锁「${nextNode.value.slot} · ${nextNode.value.toItem}」还需 ${fmtWan(remainingCost.value)}`
})

// ── 轻提示（提交/计入成功反馈，不做整页刷新） ──
const toastMsg = ref('')
let toastTimer: number | undefined
function showToast(msg: string) {
  toastMsg.value = msg
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toastMsg.value = '' }, 2400)
}

// 单条条目的落库语句：收支流水 + 道具背包联动（整单提交与单独计入共用）
// stockLeft：本次写入批次内的剩余库存视图（同单多条同物品条目依次扣减），缺省时直接读当前背包
function entryStmts(sid: number, journeyId: number | null, today: string, e: BillEntry, stockLeft?: Map<number, number>): Array<{ sql: string; params?: unknown[] }> {
  const detail: Record<string, unknown> = e.kind === 'item'
    ? { price_param_id: e.priceParamId, item_name: e.itemName, quantity: e.quantity, unit_price_wan: parseFloat(e.unitWan) || 0 }
    : {}
  const backpackStmts: Array<{ sql: string; params?: unknown[] }> = []
  if (e.kind === 'item' && e.priceParamId) {
    const pid = e.priceParamId
    if (e.direction === 'expense') {
      // 买入：入库到当前宝典背包（同单内后续卖出可扣这批）
      backpackStmts.push({
        sql: `INSERT INTO backpack_items (server_id, journey_id, price_param_id, item_name, quantity) VALUES (?,?,?,?,?)
          ON CONFLICT(server_id, journey_id, price_param_id, item_name) DO UPDATE SET quantity = quantity + excluded.quantity, updated_at=datetime('now','localtime')`,
        params: [sid, journeyId, pid, e.itemName, e.quantity],
      })
      if (stockLeft) stockLeft.set(pid, (stockLeft.get(pid) ?? 0) + e.quantity)
    } else {
      detail.from_backpack = !!e.fromBackpack
      if (e.fromBackpack) {
        // 背包出库：按批次剩余库存扣减，实际扣减量写回 detail 供重提/删除时精确回滚
        const left = stockLeft?.get(pid) ?? backpack.value.find(b => b.price_param_id === pid)?.quantity ?? 0
        const deducted = Math.min(e.quantity, left)
        if (stockLeft) stockLeft.set(pid, Math.max(0, left - e.quantity))
        if (deducted > 0) {
          backpackStmts.push({
            sql: "UPDATE backpack_items SET quantity = quantity - ?, updated_at=datetime('now','localtime') WHERE server_id=? AND journey_id=? AND price_param_id=?",
            params: [deducted, sid, journeyId, pid],
          })
          // 卖完（数量归零）的行一并删除，背包不保留 0 数量物品
          backpackStmts.push({ sql: 'DELETE FROM backpack_items WHERE quantity <= 0' })
        }
        detail.deducted = deducted
      }
      // 产出即卖（from_backpack=false）：只记收入流水，不动背包
    }
  }
  return [
    {
      sql: 'INSERT INTO asset_records (server_id, journey_id, record_date, type, source, amount, detail) VALUES (?,?,?,?,?,?,?)',
      params: [sid, journeyId, today, e.direction, e.kind, wanNumToYi(entryAmountWan(e)), JSON.stringify(detail)],
    },
    ...backpackStmts,
  ]
}

// 撤销一条道具流水的背包影响（覆盖式重提 / 删除流水时回滚，保证不重复扣减、不重复入库）
function reverseRecordBackpackStmts(sid: number, r: Rec): Array<{ sql: string; params?: unknown[] }> {
  if (r.source !== 'item' || !r.journey_id) return []
  const d = parseJSON<any>(r.detail, {})
  const pid = d.price_param_id
  if (!pid) return []
  if (r.type === 'income') {
    const back = Number(d.deducted) || 0
    if (back <= 0) return []
    return [{
      sql: "UPDATE backpack_items SET quantity = quantity + ?, updated_at=datetime('now','localtime') WHERE server_id=? AND journey_id=? AND price_param_id=?",
      params: [back, sid, r.journey_id, pid],
    }]
  }
  const qty = Number(d.quantity) || 1
  // 买入回滚（移除入库数量），归零的行一并删除
  return [
    {
      sql: "UPDATE backpack_items SET quantity = MAX(0, quantity - ?), updated_at=datetime('now','localtime') WHERE server_id=? AND journey_id=? AND price_param_id=?",
      params: [qty, sid, r.journey_id, pid],
    },
    { sql: 'DELETE FROM backpack_items WHERE quantity <= 0' },
  ]
}

// 一次提交今日账单：活跃 1 条 + 条目 N 条，重提覆盖（装备流水不受影响）
async function submitBill() {
  const sid = app.currentServerId
  if (!sid) return
  const jid = activeJourneyId.value
  const today = todayKey.value // 与「今日账单」判定同源，避免读 UI 用 A 日期、落库用 B 日期
  const wasSubmitted = todayBillExists.value // 提交前状态：决定 toast 是「提交」还是「重新提交」
  // 覆盖式重提：先回滚今天已提交条目的背包影响，再删旧流水写新流水，避免同一笔卖出重复扣减/买入重复入库
  const stockLeft = new Map(backpack.value.map(b => [b.price_param_id, b.quantity]))
  const stmts: Array<{ sql: string; params?: unknown[] }> = [
    ...todayRecs.value.flatMap(r => reverseRecordBackpackStmts(sid, r)),
    { sql: "DELETE FROM asset_records WHERE server_id=? AND record_date=? AND source IN ('active','item','manual')", params: [sid, today] },
  ]
  // 活跃区：有档位收入就记真实金额；若整单为空（0 收入 0 支出），也落一条 amount=0 的 active
  // 记录作为「今日已确账」标记，保证刷新后仍显示已提交态，而非退回「提交今日账单」。
  const picked = chars.value
    .map((c, i) => ({ name: c.name, band: c.band, tier: charTiers.value[i] }))
    .filter(x => x.tier > 0)
  const hasActivity = picked.length > 0
  const hasEntries = entries.value.length > 0
  if (hasActivity || !hasEntries) {
    stmts.push({
      sql: 'INSERT INTO asset_records (server_id, journey_id, record_date, type, source, amount, detail) VALUES (?,?,?,?,?,?,?)',
      params: [sid, jid, today, 'income', 'active', activeTotalYi.value, JSON.stringify({ chars: picked })],
    })
  }
  for (const e of entries.value) stmts.push(...entryStmts(sid, jid, today, e, stockLeft))
  await window.electronAPI.dbTransaction(stmts)
  // 只刷新流水与背包，保留条目与档位勾选（重提为覆盖式写入，不整页刷新）
  await Promise.all([refreshJourneyRecords(), loadBackpack()])
  showToast(wasSubmitted ? '今日账单已重新提交' : '今日账单已提交')
}

// 单独计入：只落这一条（含背包联动），不影响账单里其他内容
async function commitEntry(e: BillEntry) {
  const sid = app.currentServerId
  if (!sid || e.committed) return
  const stockLeft = new Map(backpack.value.map(b => [b.price_param_id, b.quantity]))
  await window.electronAPI.dbTransaction(entryStmts(sid, activeJourneyId.value, todayKey.value, e, stockLeft))
  e.committed = true
  await Promise.all([refreshJourneyRecords(), loadBackpack()])
  showToast('已计入今日账单')
}

// ── 流水展示 ──
function sourceLabel(s: string): string {
  return ({ active: '活跃', item: '道具', manual: '直录', gear: '装备', adjust: '调整' } as Record<string, string>)[s] || s
}
function recordDetailText(r: Rec): string {
  const d = parseJSON<any>(r.detail, {})
  if (r.source === 'active') {
    const chars = (d.chars || []) as Array<{ name: string; band: number; tier: number }>
    return chars.length
      ? chars.map(c => `${c.name || c.band + '级'}·${c.tier}档`).join(' ')
      : '活跃收入'
  }
  if (r.source === 'item') {
    const t = `${d.item_name || ''} ×${d.quantity ?? 1}`
    if (d.from_backpack !== undefined) return t + (d.from_backpack ? '（背包出库）' : '（产出即卖）')
    return t
  }
  if (r.source === 'gear') return `${slotLabel(d.slot || '')} · ${d.item || ''}`
  return d.note || ''
}
function amountClass(r: Rec): string {
  if (r.type === 'income') return 'rec-amount--in'
  if (r.type === 'adjust') return r.amount >= 0 ? 'rec-amount--in' : 'rec-amount--out'
  return r.source === 'gear' ? 'rec-amount--gear' : 'rec-amount--out'
}
function amountText(r: Rec): string {
  const sign = r.type === 'expense' || (r.type === 'adjust' && r.amount < 0) ? '−' : '+'
  return sign + fmtWanShort(Math.abs(r.amount))
}
async function deleteRecord(r: Rec) {
  if (r.source === 'gear') return
  const sid = app.currentServerId
  if (!sid) return
  // 删除道具流水时同步回滚其背包影响（卖出加回、买入移除），避免背包与流水不一致
  const stmts: Array<{ sql: string; params?: unknown[] }> = []
  if (r.source === 'item') stmts.push(...reverseRecordBackpackStmts(sid, r))
  stmts.push({ sql: 'DELETE FROM asset_records WHERE id=?', params: [r.id] })
  await window.electronAPI.dbTransaction(stmts)
  await Promise.all([refreshJourneyRecords(), loadBackpack()])
}

// ── 背包资产盘点 ──
const showBpModal = ref(false)
const bpQuery = ref('')
const bpParam = ref<PriceRow | null>(null)
const bpQty = ref('1')
const bpSearchFocused = ref(false)
const bpOpQty = ref<Record<number, string>>({})

const bpMatches = computed(() => searchPriceRows(bpQuery.value))
function bpPick(p: PriceRow) {
  bpParam.value = p
  bpQuery.value = p.item_name
}
// 背包按宝典独立：只读当前选中宝典的背包
async function loadBackpack() {
  const sid = app.currentServerId
  const jid = activeJourneyId.value
  if (!sid || !jid) { backpack.value = []; return }
  backpack.value = await window.electronAPI.dbQuery(
    'SELECT id, price_param_id, item_name, quantity FROM backpack_items WHERE server_id=? AND journey_id=? ORDER BY item_name',
    [sid, jid]
  ) as Array<BpItem>
}
function bpOpQtyOf(b: BpItem): string {
  return bpOpQty.value[b.id] ?? '1'
}
function setBpOpQty(b: BpItem, v: string) {
  bpOpQty.value[b.id] = v
}
async function bpAdd() {
  const sid = app.currentServerId
  const jid = activeJourneyId.value
  const p = bpParam.value
  if (!sid || !jid || !p) return
  const qty = parseInt(bpQty.value) || 1
  await window.electronAPI.dbQuery(
    `INSERT INTO backpack_items (server_id, journey_id, price_param_id, item_name, quantity) VALUES (?,?,?,?,?)
      ON CONFLICT(server_id, journey_id, price_param_id, item_name) DO UPDATE SET quantity = quantity + excluded.quantity, updated_at=datetime('now','localtime')`,
    [sid, jid, p.id, p.item_name, qty]
  )
  bpParam.value = null
  bpQuery.value = ''
  bpQty.value = '1'
  await loadBackpack()
}
async function bpOp(b: BpItem, delta: number) {
  const qty = parseInt(bpOpQtyOf(b)) || 1
  // 出库到数量归零时行一并删除（背包不保留 0 数量物品）
  await window.electronAPI.dbTransaction([
    {
      sql: "UPDATE backpack_items SET quantity = MAX(0, quantity + ?), updated_at=datetime('now','localtime') WHERE id=?",
      params: [delta * qty, b.id],
    },
    { sql: 'DELETE FROM backpack_items WHERE quantity <= 0' },
  ])
  await loadBackpack()
}
async function bpDel(b: BpItem) {
  if (!(await appConfirm({ title: '删除背包记录', message: `删除背包记录「${b.item_name}」？（仅纠错用，正常消耗用「出库」）`, confirmText: '删除', danger: true }))) return
  await window.electronAPI.dbQuery('DELETE FROM backpack_items WHERE id=?', [b.id])
  await loadBackpack()
}

// ── 背包售出：行内直接卖存货 = 记一笔「背包出库」收入流水（流动资金 +）并扣减背包数量 ──
// detail 口径与账单卖出条目完全一致（from_backpack/deducted），删除流水/重提今日账单时能精确回滚背包
const bpSellId = ref<number | null>(null)
const bpSellQty = ref('1')
const bpSellWan = ref('')

function bpSellStart(b: BpItem) {
  bpSellId.value = b.id
  // 数量默认取行内操作数量（上限为库存），单价默认按图鉴市场价（万）
  const q = Math.min(parseInt(bpOpQtyOf(b)) || 1, b.quantity)
  bpSellQty.value = String(Math.max(1, q))
  bpSellWan.value = String(Math.round(unitMarket(b) * 10000 * 100) / 100)
}
function bpSellCancel() {
  bpSellId.value = null
}
const bpSellPreview = computed(() => round7(wanToYi(bpSellWan.value) * (parseInt(bpSellQty.value) || 0)))
function bpSellValid(b: BpItem): boolean {
  const q = parseInt(bpSellQty.value) || 0
  return q >= 1 && q <= b.quantity && wanToYi(bpSellWan.value) > 0
}
async function bpSellConfirm(b: BpItem) {
  const sid = app.currentServerId
  const jid = activeJourneyId.value
  if (!sid || !jid || !bpSellValid(b)) return
  const qty = Math.min(parseInt(bpSellQty.value) || 0, b.quantity)
  const unitWan = Math.round((parseFloat(bpSellWan.value) || 0) * 100) / 100
  const amount = round7(wanToYi(String(unitWan)) * qty)
  if (qty < 1 || amount <= 0) return
  await window.electronAPI.dbTransaction([
    {
      sql: 'INSERT INTO asset_records (server_id, journey_id, record_date, type, source, amount, detail) VALUES (?,?,?,?,?,?,?)',
      params: [sid, jid, todayKey.value, 'income', 'item', amount,
        JSON.stringify({ price_param_id: b.price_param_id, item_name: b.item_name, quantity: qty, unit_price_wan: unitWan, from_backpack: true, deducted: qty })],
    },
    {
      sql: "UPDATE backpack_items SET quantity = MAX(0, quantity - ?), updated_at=datetime('now','localtime') WHERE id=?",
      params: [qty, b.id],
    },
    { sql: 'DELETE FROM backpack_items WHERE quantity <= 0' },
  ])
  bpSellId.value = null
  // 同步为今日账单的一条已计入条目：重提今日账单按 entries 重建流水，
  // 不补这条的话本次售出会在覆盖式重提时被当成「不在账单里」而误删
  entries.value.push({
    key: entryKey++,
    direction: 'income',
    kind: 'item',
    itemName: b.item_name,
    priceParamId: b.price_param_id,
    quantity: qty,
    unitWan: String(unitWan),
    fromBackpack: true,
    committed: true,
  })
  await Promise.all([refreshJourneyRecords(), loadBackpack()])
  showToast(`已售出 ${qty} 个「${b.item_name}」，+${fmtWan(amount)} 记入今日收入`)
}

// ── 收益日历（弹窗） ──
const showCalModal = ref(false)
// 配置对比弹窗的状态（showCurModal / cfgTab / 逐槽编辑草稿）见「调整目标配置」区块
const calBase = ref(new Date())
// 打开即定位今天，今日流水直接可见
function openCalModal() {
  calBase.value = new Date()
  selectedDay.value = new Date().getDate()
  showCalModal.value = true
}
const calY = computed(() => calBase.value.getFullYear())
const calM = computed(() => calBase.value.getMonth() + 1)
const selectedDay = ref<number | null>(null)

function shiftMonth(delta: number) {
  calBase.value = new Date(calY.value, calM.value - 1 + delta, 1)
  selectedDay.value = null
}
function toToday() {
  calBase.value = new Date()
  selectedDay.value = new Date().getDate()
}
function jumpMonth(m: number) {
  calBase.value = new Date(calY.value, m - 1, 1)
  selectedDay.value = null
}

const ymPrefix = computed(() => `${calY.value}-${pad2(calM.value)}`)
const monthRecs = computed(() => records.value.filter(r => r.record_date.startsWith(ymPrefix.value)))
function dayNet(recs: Rec[]): number {
  let net = 0
  for (const r of recs) {
    if (r.type === 'income') net += r.amount
    else if (r.type === 'expense' && r.source !== 'gear') net -= r.amount
  }
  return round7(net)
}
const calLead = computed(() => {
  const first = new Date(calY.value, calM.value - 1, 1).getDay()
  return Array.from({ length: (first + 6) % 7 }, (_, i) => i)
})
const calDays = computed(() => {
  const days = new Date(calY.value, calM.value, 0).getDate()
  const out: Array<{ d: number; net: number; hasGear: boolean }> = []
  for (let d = 1; d <= days; d++) {
    const key = `${ymPrefix.value}-${pad2(d)}`
    const recs = records.value.filter(r => r.record_date === key)
    out.push({ d, net: dayNet(recs), hasGear: recs.some(r => r.source === 'gear') })
  }
  return out
})
const dayRecs = computed(() =>
  selectedDay.value ? records.value.filter(r => r.record_date === `${ymPrefix.value}-${pad2(selectedDay.value!)}`) : [])
function isToday(d: number): boolean { return todayKey.value === `${ymPrefix.value}-${pad2(d)}` }

const monthSum = computed(() => {
  let income = 0, expense = 0, gear = 0
  for (const r of monthRecs.value) {
    if (r.type === 'income') income += r.amount
    else if (r.type === 'expense') {
      if (r.source === 'gear') gear += r.amount
      else expense += r.amount
    }
  }
  return { income: round7(income), expense: round7(expense), gear: round7(gear), net: round7(income - expense) }
})

const yearMonths = computed(() => {
  const out: Array<{ m: number; net: number }> = []
  const prefix = `${calY.value}-`
  for (let m = 1; m <= 12; m++) {
    const recs = records.value.filter(r => r.record_date.startsWith(prefix + pad2(m)))
    out.push({ m, net: dayNet(recs) })
  }
  return out
})
const yearMaxAbs = computed(() => Math.max(1, ...yearMonths.value.map(m => Math.abs(m.net))))
function yearBarWidth(net: number): number {
  return Math.round((Math.abs(net) / yearMaxAbs.value) * 100)
}
const yearSum = computed(() => {
  const prefix = `${calY.value}-`
  let income = 0, expense = 0, gear = 0
  for (const r of records.value) {
    if (!r.record_date.startsWith(prefix)) continue
    if (r.type === 'income') income += r.amount
    else if (r.type === 'expense') {
      if (r.source === 'gear') gear += r.amount
      else expense += r.amount
    }
  }
  return { income: round7(income), expense: round7(expense), gear: round7(gear), net: round7(income - expense) }
})
const bestDay = computed(() => {
  const prefix = `${calY.value}-`
  const byDay = new Map<string, Rec[]>()
  for (const r of records.value) {
    if (!r.record_date.startsWith(prefix)) continue
    const list = byDay.get(r.record_date) || []
    list.push(r)
    byDay.set(r.record_date, list)
  }
  let best: { date: string; net: number } | null = null
  for (const [date, recs] of byDay) {
    const net = dayNet(recs)
    if (!best || net > best.net) best = { date, net }
  }
  return best && best.net > 0 ? best : null
})

// ── 历史累计（全部流水的总账） ──
const totalSum = computed(() => {
  let income = 0, expense = 0, gear = 0
  let firstDate = ''
  const days = new Set<string>()
  for (const r of records.value) {
    if (r.type === 'income') income += r.amount
    else if (r.type === 'expense') {
      if (r.source === 'gear') gear += r.amount
      else expense += r.amount
    }
    days.add(r.record_date)
    if (!firstDate || r.record_date < firstDate) firstDate = r.record_date
  }
  const net = round7(income - expense)
  const dayCount = days.size
  return { income: round7(income), expense: round7(expense), gear: round7(gear), net, dayCount, firstDate, avgNet: dayCount ? round7(net / dayCount) : 0 }
})

// ── 生命周期 ──
// ESC 关闭弹窗：调整目标配置 / 当前配置 / 节点顺序 / 调整流动资金 / 收益日历（一次关一个，从最上层开始）
function onGlobalKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (showTargetModal.value) { showTargetModal.value = false; return }
  if (showCurModal.value) { showCurModal.value = false; return }
  if (showOrderModal.value) { showOrderModal.value = false; return }
  if (showLiquidModal.value) { showLiquidModal.value = false; return }
  if (showCalModal.value) { showCalModal.value = false }
}
// 切换大区：仅当前正在查看时才立即重载；keep-alive 隐藏期间挂起标记
// （去抖合并，避免快速连切大区时多轮 loadAll 并发叠加）
let reloadTimer: ReturnType<typeof setTimeout> | null = null
watch(() => app.currentServerId, (newId, oldId) => {
  if (!newId || newId === oldId) return
  if (!activeView) { pendingReload = true; return }
  if (reloadTimer) clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => {
    reloadTimer = null
    loadAll()
  }, 80)
})
watch(() => app.priceDataVersion, async () => {
  const sid = app.currentServerId
  if (!sid) return
  priceRows.value = await window.electronAPI.dbQuery(
    'SELECT id, item_name, category, quality, benchmark_price, market_price, TRIM(COALESCE(attrs,\'\') || \' \' || COALESCE(attr_notes,\'\') || \' \' || COALESCE(craft_level,\'\')) as notes, COALESCE(equip_job,\'\') as equip_job, COALESCE(equip_level,0) as equip_level, COALESCE(spirit_position,\'\') as spirit_position, COALESCE(slot,\'\') as slot FROM price_params WHERE server_id=? ORDER BY item_name, market_price ASC', [sid]
  ) as Array<PriceRow>
})
onMounted(async () => {
  activeView = true
  window.addEventListener('keydown', onGlobalKeydown)
  await app.loadServers()
  await loadAll()
  refreshImageSet()
  // 跨零点检测：20s 轮询保底；休眠/唤醒后定时器可能不准，回来时再兜一次
  dayTimer = window.setInterval(checkDayRollover, 20_000)
  window.addEventListener('focus', checkDayRollover)
  document.addEventListener('visibilitychange', onVisibilityChange)
})
// 从其他页面切回：仅当是「再次激活」（非首挂载）且隐藏期间切过大区时补一次重载
// （钱包/方案/背包等本大区数据）。首挂载数据加载已由 onMounted 完成。
onActivated(() => {
  activeView = true
  if (everDeactivated && (pendingReload || (app.currentServerId && loadedServerId !== app.currentServerId))) {
    pendingReload = false
    loadAll()
  }
})
onDeactivated(() => {
  activeView = false
  everDeactivated = true
})
onBeforeUnmount(() => {
  if (reloadTimer) clearTimeout(reloadTimer)
  window.removeEventListener('keydown', onGlobalKeydown)
  window.clearInterval(dayTimer)
  window.removeEventListener('focus', checkDayRollover)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
// 实时同步：配号中心增删改方案（bump 方案版本号）时立即刷新下拉列表
watch(() => app.schemeDataVersion, () => { loadSchemesAndPrices().catch(() => {}) })
</script>

<style scoped>
.page { height: 100%; overflow: hidden; display: flex; flex-direction: column; }
.page-head { margin-bottom: 8px; flex-shrink: 0; }
.page-head h2 { font-size: var(--text-lg); font-weight: 650; letter-spacing: -0.01em; }
.page-head p { color: var(--color-text-secondary); font-size: var(--text-sm); margin-top: 2px; }
.hint { color: var(--color-text-tertiary); text-align: center; padding: 48px 20px; font-size: var(--text-xs); }

/* ── 通用控件 ── */
.btn { border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: var(--text-xs); font-weight: 500; padding: 6px 14px; font-family: inherit; transition: all 0.12s; display: inline-flex; align-items: center; gap: 5px; }
.btn-accent { background: var(--color-accent); color: #fff; }
.btn-accent:hover:not(:disabled) { background: var(--color-accent-hover); }
.btn-danger { background: var(--color-danger-bg); color: var(--color-danger); }
.btn-danger:hover:not(:disabled) { background: var(--color-danger); color: #fff; }
.btn-ghost { background: var(--color-surface-2); color: var(--color-text-secondary); }
.btn-ghost:hover:not(:disabled) { color: var(--color-text); background: var(--color-hover); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-xs { padding: 3px 8px; font-size: var(--text-micro); }
.field-label { display: flex; flex-direction: column; gap: 4px; font-size: var(--text-micro); color: var(--color-text-tertiary); }
.field-input, .field-select {
  padding: 6px 10px; font-size: var(--text-xs); font-family: inherit;
  background: var(--color-surface-2); color: var(--color-text);
  border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  transition: border-color 0.12s; width: 100%; box-sizing: border-box;
}
.field-input:focus, .field-select:focus { outline: none; border-color: var(--color-accent-ring); }

/* ── 指标条（弱化） ── */
.metrics-bar {
  display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
  padding: 6px 14px; margin-bottom: 10px; flex-shrink: 0;
  background: var(--color-surface-1); border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md); box-shadow: var(--shadow-card);
}
.mx { display: inline-flex; align-items: baseline; gap: 5px; }
.mx-label { font-size: var(--text-micro); color: var(--color-text-tertiary); }
.mx-value { font-size: var(--text-sm); font-weight: 600; color: var(--color-text); font-variant-numeric: tabular-nums; }
.mx-value--up { color: var(--color-success); }
.mx-value--down { color: var(--color-danger); }
.mx-sep { width: 1px; height: 13px; background: var(--color-border-light); }

/* ── 分区 ── */
.journey-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; flex-shrink: 0; }
.journey-label { display: inline-flex; align-items: center; gap: 5px; font-size: var(--text-xs); color: var(--color-text-tertiary); }
.journey-chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-light); background: var(--color-surface-1); cursor: pointer;
  font-size: var(--text-xs); color: var(--color-text-secondary); font-family: inherit; transition: all 0.12s;
}
.journey-chip:hover { border-color: var(--color-accent-ring); color: var(--color-text); }
.journey-chip--on { background: var(--color-accent-bg); border-color: var(--color-accent); color: var(--color-accent); font-weight: 550; }
.journey-chip small { font-size: var(--text-micro); opacity: 0.75; font-variant-numeric: tabular-nums; }
.journey-chip--add { border-style: dashed; background: transparent; color: var(--color-text-tertiary); }
.journey-chip--add:hover { color: var(--color-accent); border-color: var(--color-accent); }
.journey-chip--del { color: var(--color-danger); border-color: var(--color-danger-bg); background: transparent; }
.journey-chip--del:hover { background: var(--color-danger); color: #fff; }
.sec { margin-bottom: 12px; flex-shrink: 0; min-height: 0; }
.sec--grow { flex: 1; display: flex; flex-direction: column; }
.sec-title { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-sm); font-weight: 650; color: var(--color-text); }
.book-head { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; flex-wrap: wrap; flex-shrink: 0; }
.book-progress { font-size: var(--text-xs); color: var(--color-text-secondary); }
.book-progress b { color: var(--color-accent); font-size: var(--text-sm); }
.book-remain { font-size: var(--text-xs); color: var(--color-text-tertiary); }
.book-remain b { color: var(--color-warning); }
.book-remain--done { display: inline-flex; align-items: center; gap: 8px; }
.hint--cta { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.tab-actions { display: inline-flex; gap: 6px; margin-left: auto; }

/* ── 开局引导 ── */
.setup-card {
  max-width: 560px; margin: 8vh auto 0; padding: 24px;
  background: var(--color-surface-1); border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-card);
  animation: fade-in 0.25s ease;
}
.setup-title { display: flex; align-items: center; gap: 7px; font-size: var(--text-md); font-weight: 650; color: var(--color-text); }
.setup-title svg { color: var(--color-accent); }
.setup-desc { font-size: var(--text-xs); color: var(--color-text-secondary); line-height: 1.7; margin: 10px 0 16px; }
.setup-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.setup-hint { display: flex; align-items: center; gap: 5px; font-size: var(--text-micro); color: var(--color-text-tertiary); margin-bottom: 14px; }
.setup-actions { display: flex; align-items: center; gap: 12px; }
.setup-warn { font-size: var(--text-micro); color: var(--color-warning); }

/* ── 节点轨道 ── */
.node-track { display: flex; gap: 10px; overflow-x: auto; padding: 13px 4px 6px; scrollbar-width: none; }
.node-track::-webkit-scrollbar { display: none; }
.node {
  position: relative; width: 140px; flex-shrink: 0; cursor: pointer;
  padding: 9px 11px 10px; border-radius: var(--radius-md);
  background: var(--color-surface-1); border: 1px solid var(--color-border-light);
  box-shadow: var(--shadow-card); transition: transform 0.12s, border-color 0.12s;
}
.node:hover { transform: translateY(-2px); border-color: var(--color-accent-ring); }
.node-dot {
  position: absolute; top: -13px; left: 12px; width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--color-surface-2); border: 2px solid var(--color-border);
  color: var(--color-text-tertiary);
}
.node--unlocked .node-dot { background: var(--color-accent-bg); border-color: var(--color-accent); color: var(--color-accent); animation: node-glow 1.6s ease-in-out infinite; }
.node--claimed .node-dot { background: var(--color-success-bg); border-color: var(--color-success); color: var(--color-success); }
.node--locked { opacity: 0.88; }
.node--claimed { border-color: var(--color-success); }
.node--dragging { opacity: 0.45; }
.node--dragover { border-color: var(--color-accent); border-style: dashed; box-shadow: 0 0 0 2px var(--color-accent-bg); }
.node-idx { font-size: var(--text-micro); color: var(--color-text-tertiary); margin: 4px 0 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.node-item { font-size: var(--text-xs); font-weight: 550; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.node-cost { font-size: var(--text-micro); color: var(--color-text-tertiary); margin-top: 3px; font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.node--unlocked .node-cost { color: var(--color-accent); font-weight: 550; }
.node--claimed .node-cost { color: var(--color-success); }
@keyframes node-glow {
  0%, 100% { box-shadow: 0 0 0 0 var(--color-accent-ring); }
  50% { box-shadow: 0 0 0 4px var(--color-accent-bg); }
}

/* ── 今日账单 ── */
.bill-submited { display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-micro); color: var(--color-success); }
.bill-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; flex: 1; min-height: 0; }
.ledger-card {
  padding: 10px 12px; background: var(--color-surface-1); border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md); box-shadow: var(--shadow-card); display: flex; flex-direction: column; gap: 6px;
  min-height: 0; overflow: hidden;
}
/* 卡片内滚动区：滚轮可滚，不显示滚动条 */
.list-area { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: none; }
.list-area::-webkit-scrollbar { display: none; }
.ledger-card-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.ledger-card-title { display: flex; align-items: center; gap: 6px; font-size: var(--text-xs); font-weight: 550; color: var(--color-text); }
.ledger-empty { font-size: var(--text-micro); color: var(--color-text-tertiary); padding: 6px 0; }
.ledger-total { font-size: var(--text-xs); color: var(--color-text-secondary); margin-top: auto; }
.ledger-total b { color: var(--color-text); font-size: var(--text-sm); font-variant-numeric: tabular-nums; }

.entry-input-row { display: flex; gap: 8px; align-items: flex-end; }
.entry-input-row .dir-flip { flex-shrink: 0; padding: 5px 12px; }
.entry-input-row .item-search { flex: 1; min-width: 0; }
/* 选中道具后的名称区：占满剩余宽度，名称完整展示 */
.entry-item-name {
  flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 4px;
  padding: 0 10px; height: 32px; box-sizing: border-box;
  background: var(--color-surface-2); border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
.entry-item-name-text {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: var(--text-xs); color: var(--color-text);
}
.entry-item-clear {
  width: 18px; height: 18px; border: none; border-radius: 4px; background: transparent;
  color: var(--color-text-tertiary); cursor: pointer; display: inline-flex; align-items: center;
  justify-content: center; flex-shrink: 0; transition: all 0.12s;
}
.entry-item-clear:hover { background: var(--color-danger); color: #fff; }
.entry-mini-field { display: flex; flex-direction: column; gap: 3px; }
.entry-mini-field span { font-size: var(--text-micro); color: var(--color-text-tertiary); white-space: nowrap; }
.entry-mini-field--qty { flex: 0 0 58px; }
.entry-mini-field--amt { flex: 0 0 84px; }
.entry-mini-field--bp { flex: 0 0 108px; }
.bp-toggle {
  /* 与数量/单价输入框同尺寸：同 padding、字号、边框、圆角，仅保留开关语义色 */
  border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  background: var(--color-surface-2); color: var(--color-text);
  font-size: var(--text-xs); font-weight: 500; padding: 6px 10px; cursor: pointer;
  font-family: inherit; display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  width: 100%; box-sizing: border-box; transition: all 0.12s;
}
.bp-toggle:hover { border-color: var(--color-accent-ring); color: var(--color-text); }
.bp-toggle--on { background: var(--color-accent-bg); border-color: var(--color-accent); color: var(--color-accent); }
.bp-chip {
  display: inline-flex; align-items: center; gap: 3px; font-size: var(--text-micro); padding: 1px 7px;
  border-radius: 8px; border: none; cursor: pointer; font-family: inherit; flex-shrink: 0; transition: all 0.12s;
}
.bp-chip--on { background: var(--color-accent-bg); color: var(--color-accent); }
.bp-chip--off { background: var(--color-surface-2); color: var(--color-text-tertiary); }
.bp-chip:hover:not(:disabled) { filter: brightness(1.15); }
.bp-chip:disabled { opacity: 0.6; cursor: not-allowed; }
.dir-flip {
  border: 1px solid var(--color-border-light); border-radius: var(--radius-sm);
  font-size: var(--text-xs); font-weight: 550; padding: 4px 12px; cursor: pointer;
  font-family: inherit; display: inline-flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.12s;
}
.dir-flip--in { background: var(--color-success-bg); border-color: var(--color-success); color: var(--color-success); }
.dir-flip--out { background: var(--color-danger-bg); border-color: var(--color-danger); color: var(--color-danger); }
.dir-flip:hover { filter: brightness(1.12); }

.char-row { display: flex; align-items: center; gap: 6px; }
.char-name { width: 70px; font-size: var(--text-xs); font-weight: 550; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; }
.char-band { font-size: var(--text-micro); color: var(--color-text-tertiary); width: 34px; flex-shrink: 0; }
.tier-btn {
  flex: 1; border: 1px solid var(--color-border-light); background: var(--color-surface-2);
  border-radius: var(--radius-sm); font-size: var(--text-micro); padding: 4px 4px; cursor: pointer;
  color: var(--color-text-tertiary); font-family: inherit; transition: all 0.12s;
  display: inline-flex; justify-content: center; align-items: baseline; gap: 4px;
}
.tier-btn small { opacity: 0.72; font-size: var(--text-micro); }
.tier-btn:hover { border-color: var(--color-accent-ring); color: var(--color-text); }
.tier-btn--on { background: var(--color-accent-bg); border-color: var(--color-accent); color: var(--color-accent); font-weight: 550; }
.tier-btn--on small { opacity: 1; }
.char-amt { width: 52px; text-align: right; font-size: var(--text-micro); color: var(--color-success); font-variant-numeric: tabular-nums; flex-shrink: 0; }

.item-search { position: relative; }
.item-drop {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 20; margin-top: 4px;
  background: var(--color-surface-1); border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); box-shadow: var(--shadow-pop); overflow: hidden; max-height: 220px; overflow-y: auto;
}
.item-drop-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; width: 100%; padding: 6px 10px; border: none; background: transparent; cursor: pointer; font-family: inherit; font-size: var(--text-xs); color: var(--color-text); text-align: left; }
.item-drop-row:hover { background: var(--color-accent-bg); }
.item-drop-head { font-size: var(--text-micro); color: var(--color-text-tertiary); padding: 5px 10px 3px; border-bottom: 1px solid var(--color-border-light); }
.item-drop-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-drop-meta { font-size: var(--text-micro); color: var(--color-text-tertiary); flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 62%; }
.sdi-img { font-size: var(--text-sm); flex-shrink: 0; cursor: pointer; opacity: 0.7; display: inline-flex; align-items: center; padding: 0 2px; }
.sdi-img:hover { opacity: 1; color: var(--color-accent); }

.entry-add { justify-content: center; }
.entry-row { display: flex; align-items: center; gap: 8px; font-size: var(--text-xs); padding: 4px 0; border-bottom: 1px dashed var(--color-border-light); }
.entry-row:last-of-type { border-bottom: none; }
.entry-detail { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-text-secondary); }

.bill-footer { display: flex; justify-content: flex-end; align-items: center; gap: 14px; margin-top: 8px; flex-shrink: 0; }
.bill-net { font-size: var(--text-xs); color: var(--color-text-secondary); }
.bill-net b { font-size: var(--text-md); font-variant-numeric: tabular-nums; margin-left: 4px; }
.tier-hint { font-size: var(--text-micro); color: var(--color-text-tertiary); margin-top: -4px; }
.entry-dir { cursor: pointer; border: none; font-family: inherit; transition: all 0.12s; }
.entry-dir:hover:not(:disabled) { filter: brightness(1.15); }
.entry-dir:disabled { opacity: 0.6; cursor: not-allowed; }

/* 流水行 */
.rec-row { display: flex; align-items: center; gap: 8px; padding: 5px 2px; font-size: var(--text-xs); border-bottom: 1px solid var(--color-border-light); }
.rec-row:last-child { border-bottom: none; }
.rec-time { color: var(--color-text-tertiary); font-size: var(--text-micro); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.rec-badge { font-size: var(--text-micro); padding: 1px 7px; border-radius: 8px; flex-shrink: 0; font-weight: 500; }
.rec-badge--active { background: var(--color-accent-bg); color: var(--color-accent); }
.rec-badge--item { background: var(--color-surface-2); color: var(--color-text-secondary); }
.rec-badge--manual { background: var(--color-surface-2); color: var(--color-text-tertiary); }
.rec-badge--gear { background: var(--color-warning-bg); color: var(--color-warning); }
.rec-badge--adjust { background: var(--color-surface-2); color: var(--color-text-secondary); }
.rec-badge--in { background: var(--color-success-bg); color: var(--color-success); }
.rec-badge--out { background: var(--color-danger-bg); color: var(--color-danger); }
.rec-detail { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-text-secondary); }
.rec-amount { font-weight: 550; font-variant-numeric: tabular-nums; flex-shrink: 0; }
.rec-amount--in { color: var(--color-success); }
.rec-amount--out { color: var(--color-danger); }
.rec-amount--gear { color: var(--color-warning); }
.rec-lock { color: var(--color-text-tertiary); display: inline-flex; width: 20px; justify-content: center; flex-shrink: 0; }
.band-del { width: 20px; height: 20px; border: none; border-radius: 4px; background: transparent; color: var(--color-text-tertiary); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.12s; }
.band-del:hover { background: var(--color-danger); color: #fff; }

/* 流动资金校正 */
.mx-edit { color: var(--color-text-tertiary); opacity: 0; transition: opacity 0.12s; margin-left: 2px; }
.mx--click:hover .mx-edit { opacity: 1; color: var(--color-accent); }
.liquid-now { display: flex; align-items: baseline; justify-content: space-between; padding: 8px 10px; border-radius: var(--radius-sm); background: var(--color-surface-2); font-size: var(--text-xs); color: var(--color-text-secondary); }
.liquid-now b { font-size: var(--text-md); color: var(--color-text); font-variant-numeric: tabular-nums; }
.liquid-mode { display: flex; gap: 6px; }
.liquid-mode-btn { flex: 1; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface-2); color: var(--color-text-secondary); font-family: inherit; font-size: var(--text-xs); padding: 6px 8px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px; transition: all 0.12s; }
.liquid-mode-btn:hover { color: var(--color-text); background: var(--color-hover); }
.liquid-mode-btn--on { border-color: var(--color-accent-ring); background: var(--color-accent-bg); color: var(--color-accent); font-weight: 550; }
.liquid-delta { font-size: var(--text-xs); padding: 6px 10px; border-radius: var(--radius-sm); background: var(--color-surface-2); text-align: center; }
.liquid-delta b { font-variant-numeric: tabular-nums; }
.liquid-history { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; padding-top: 8px; border-top: 1px solid var(--color-border-light); }
.liquid-history .rec-detail { color: var(--color-text-secondary); }

/* ── 日历 ── */
.cal-card {
  padding: 10px 12px; background: var(--color-surface-1); border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md); box-shadow: var(--shadow-card);
}
.cal-nav { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.cal-nav-btn { width: 24px; height: 24px; border: none; border-radius: var(--radius-sm); background: var(--color-surface-2); color: var(--color-text-secondary); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.12s; }
.cal-nav-btn:hover { background: var(--color-hover); color: var(--color-text); }
.cal-title { font-size: var(--text-sm); font-weight: 650; color: var(--color-text); }
.cal-sums { display: flex; gap: 8px; margin-left: auto; flex-wrap: wrap; }
.cal-sum { font-size: var(--text-micro); padding: 2px 9px; border-radius: 10px; background: var(--color-surface-2); color: var(--color-text-secondary); font-variant-numeric: tabular-nums; }
.cal-sum--in { color: var(--color-success); background: var(--color-success-bg); }
.cal-sum--out { color: var(--color-danger); background: var(--color-danger-bg); }
.cal-sum--gear { color: var(--color-warning); background: var(--color-warning-bg); }

.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.cal-weekday { text-align: center; font-size: var(--text-micro); color: var(--color-text-tertiary); padding: 3px 0; }
.cal-cell {
  position: relative; min-height: 38px; border-radius: var(--radius-sm);
  border: 1px solid transparent; background: var(--color-surface-2);
  padding: 5px 6px; text-align: left; cursor: pointer; font-family: inherit; transition: all 0.12s;
  display: flex; flex-direction: column; gap: 2px; align-items: flex-start;
}
.cal-cell--blank { background: transparent; cursor: default; }
.cal-cell:hover { border-color: var(--color-accent-ring); }
.cal-cell--today { border-color: var(--color-accent); }
.cal-cell--sel { background: var(--color-accent-bg); border-color: var(--color-accent); }
.cal-day { font-size: var(--text-xs); color: var(--color-text-secondary); font-variant-numeric: tabular-nums; }
.cal-cell--today .cal-day { color: var(--color-accent); font-weight: 650; }
.cal-net { font-size: var(--text-micro); font-weight: 550; font-variant-numeric: tabular-nums; }
.cal-net--in { color: var(--color-success); }
.cal-net--out { color: var(--color-danger); }
.cal-gear-dot { position: absolute; top: 7px; right: 7px; width: 6px; height: 6px; border-radius: 50%; background: var(--color-warning); }
.day-detail { margin-top: 8px; border-top: 1px solid var(--color-border-light); padding-top: 6px; max-height: 15vh; overflow-y: auto; }

/* 年度统计（紧凑版，右列要与左列同屏放下） */
.year-rows { display: flex; flex-direction: column; gap: 1px; }
.year-row { display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 1px 4px; border-radius: 4px; }
.year-row:hover { background: var(--color-surface-2); }
.year-label { width: 34px; font-size: var(--text-xs); color: var(--color-text-secondary); flex-shrink: 0; }
.year-bar-wrap { flex: 1; height: 6px; background: var(--color-surface-2); border-radius: 3px; overflow: hidden; }
.year-bar { height: 100%; border-radius: 3px; min-width: 2px; }
.year-bar--in { background: linear-gradient(90deg, #3D9A6C, #5BC48E); }
.year-bar--out { background: linear-gradient(90deg, #C25B5B, #E07A7A); }
.year-net { width: 78px; text-align: right; font-size: var(--text-micro); font-variant-numeric: tabular-nums; color: var(--color-text-tertiary); flex-shrink: 0; }
.year-best { display: flex; align-items: center; gap: 6px; margin-top: 6px; font-size: var(--text-xs); color: var(--color-warning); }

/* ── 弹窗 ── */
.overlay {
  position: fixed; inset: 0; z-index: 100; background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: center; justify-content: center; animation: overlay-in 0.18s ease;
}
.modal {
  width: 480px; max-width: 92vw; max-height: 84vh; overflow-y: auto;
  background: var(--glass-bg); backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border); border-radius: 16px;
  box-shadow: var(--shadow-pop); padding: 20px; animation: modal-in 0.22s ease;
  display: flex; flex-direction: column; gap: 12px;
}
@supports not (backdrop-filter: blur(1px)) {
  .modal { background: var(--color-surface-1); }
}
.modal--wide { width: 560px; }
.modal--cal { width: min(700px, 92vw); }
/* 收益日历：左右两栏（月历+当日流水 | 年度统计+历史累计），整屏不滚动 */
.modal--ledger {
  width: min(1000px, 94vw);
  max-height: 90vh; padding: 16px 18px; gap: 10px;
}
.cal-cols { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 10px; align-items: stretch; }
/* 左卡拉伸占满整列高度，剩余空间归当日流水明细 */
.cal-card--main { display: flex; flex-direction: column; }
.cal-card--main .day-detail { flex: 1; min-height: 0; max-height: none; }
.cal-side { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.total-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.total-cell {
  display: flex; flex-direction: column; gap: 0; padding: 4px 8px;
  border-radius: var(--radius-sm); background: var(--color-surface-2); min-width: 0;
}
.total-cell span { font-size: var(--text-micro); color: var(--color-text-tertiary); }
.total-cell b { font-size: var(--text-xs); font-variant-numeric: tabular-nums; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.total-warn { color: var(--color-warning); }
/* 配置对比：内部仅 cfg-sheet 滚动，nav/保存固定，形成三段式工具面板 */
.modal--cfg {
  width: min(920px, 94vw);
  max-height: 86vh;
  padding-bottom: 14px;
  gap: 0;
  overflow: hidden; /* 滚动只发生在 cfg-sheet 内，内容不越过弹窗圆角 */
  border-radius: var(--radius-lg);
  /* 背景：比默认玻璃更实一档（surface-1 为主、保留少量玻璃通透），大面积行列表更易读 */
  background: color-mix(in srgb, var(--color-surface-1) 78%, var(--glass-bg));
  backdrop-filter: blur(var(--glass-blur)) saturate(1.4);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(1.4);
}
.modal-title {
  display: flex; align-items: center; gap: 8px;
  font-size: var(--text-md); font-weight: 700; color: var(--color-text);
  letter-spacing: -0.01em;
}
.modal-title svg { flex-shrink: 0; }
.modal-sub {
  font-size: var(--text-xs); color: var(--color-text-secondary);
  line-height: 1.65;
}
.modal-btn { justify-content: center; }
.modal-divider { border-top: 1px dashed var(--color-border-light); margin: 2px 0; }

/* 提交提醒 toast */
.toast {
  position: fixed; left: 50%; bottom: 36px; transform: translateX(-50%);
  z-index: 300; display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 18px; border-radius: var(--radius-md); font-size: var(--text-xs);
  color: var(--color-success); background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border); box-shadow: var(--shadow-pop);
  pointer-events: none;
}
.toast-pop-enter-active, .toast-pop-leave-active { transition: all 0.22s ease; }
.toast-pop-enter-from, .toast-pop-leave-to { opacity: 0; transform: translateX(-50%) translateY(10px); }

/* 号设置 */
.cfg-row { display: grid; grid-template-columns: 1fr 110px 24px; gap: 8px; align-items: center; }

/* ── 配置对比（极简工具面板：页签 + 槽位编辑） ── */

/* 页签导航：一条细线下方的 underline 页签，右侧放关闭钮 */
.cfg-nav {
  flex-shrink: 0; display: flex; align-items: center; gap: 4px;
  border-bottom: 1px solid var(--color-border-light);
  padding: 0 4px; margin: -4px 0 12px;
  overflow-x: auto; scrollbar-width: none;
}
.cfg-nav::-webkit-scrollbar { display: none; }
.cfg-tab {
  position: relative; display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px 10px; font-family: inherit; font-size: var(--text-sm);
  color: var(--color-text-secondary); background: transparent; border: none;
  border-radius: 9px 9px 0 0;
  cursor: pointer; white-space: nowrap;
  transition: color 0.14s ease, background 0.14s ease;
}
.cfg-tab:hover { color: var(--color-text); background: var(--color-hover); }
.cfg-tab--on { color: var(--color-accent); font-weight: 600; }
.cfg-tab--on:hover { background: transparent; }
.cfg-tab--on::after {
  content: ''; position: absolute; left: 10px; right: 10px; bottom: -1px; height: 2.5px;
  border-radius: 3px; background: var(--color-accent);
}
.cfg-tab-icon { display: inline-flex; align-items: center; }
.cfg-tab-cnt {
  min-width: 16px; height: 16px; padding: 0 5px; box-sizing: border-box;
  line-height: 16px; text-align: center; border-radius: 999px;
  background: var(--color-surface-3); color: var(--color-text-tertiary);
  font-size: var(--text-micro); transition: background 0.14s ease, color 0.14s ease;
}
.cfg-tab--on .cfg-tab-cnt { background: var(--color-accent-bg); color: var(--color-accent); }
/* 右上角关闭（nav 里右侧游离） */
.cfg-close {
  margin-left: auto; flex-shrink: 0; display: inline-flex; align-items: center;
  justify-content: center; width: 28px; height: 28px; align-self: center;
  border: none; border-radius: 8px; background: transparent; color: var(--color-text-tertiary);
  cursor: pointer; transition: all 0.12s;
}
.cfg-close:hover { color: var(--color-text); background: var(--color-hover); }

/* 槽位列表：唯一可滚动区，直接悬浮在玻璃上，靠行分隔保持可读 */
.cfg-sheet { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; min-width: 0; padding-right: 2px; }

/* 灵兽分类二级页签（小胶囊，固定在槽位列表上方不随滚动） */
.cfg-sub { flex-shrink: 0; display: flex; gap: 6px; flex-wrap: wrap; padding: 0 2px 10px; }
.cfg-tab--sub {
  padding: 4px 12px; font-size: var(--text-xs); color: var(--color-text-secondary);
  background: var(--color-surface-2); border: 1px solid var(--color-border);
  border-radius: 999px;
  transition: all 0.12s ease;
}
.cfg-tab--sub:hover { color: var(--color-text); background: var(--color-hover); }
.cfg-tab--sub.cfg-tab--on {
  color: var(--color-accent); background: var(--color-accent-bg);
  border-color: var(--color-accent-ring); font-weight: 600;
  box-shadow: 0 0 0 2px var(--color-accent-bg);
}
.cfg-tab--sub.cfg-tab--on::after { display: none; }
.cfg-tab--sub small { color: inherit; opacity: 0.7; font-size: var(--text-micro); margin-left: 3px; }

.tg-custom { display: flex; flex-direction: column; gap: 6px; padding-top: 2px; }
.tg-cs-group { display: flex; flex-direction: column; }
.tg-cs-group-label {
  font-size: var(--text-micro); font-weight: 600; letter-spacing: 0.02em;
  color: var(--color-text-tertiary); padding: 8px 6px 4px;
}
.tg-cs-head, .tg-cs-row { display: grid; grid-template-columns: 96px minmax(0, 1fr) minmax(0, 1fr) 64px; gap: 10px; align-items: center; }
.tg-cs-head {
  font-size: var(--text-micro); color: var(--color-text-tertiary);
  padding: 4px 10px;
}
/* 行：极简、悬停微高亮、编辑/差异有状态色 */
.tg-cs-row { padding: 5px 10px; border-radius: 10px; transition: background 0.13s ease; }
.tg-cs-row:hover { background: var(--color-hover); }
.tg-cs-row--chg { background: var(--color-accent-bg); }
.tg-cs-row--chg:hover { background: var(--color-accent-bg); }
.tg-cs-row--chg .tg-cs-slot { color: var(--color-accent); }
.tg-cs-row--diff { box-shadow: inset 3px 0 0 var(--color-warning); }
.tg-cs-row--diff .tg-cs-slot { color: var(--color-warning); }
.tg-cs-slot { font-size: var(--text-xs); font-weight: 600; color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tg-cs-cell { display: flex; align-items: center; gap: 6px; min-width: 0; position: relative; }
.tg-cs-cell .item-search { flex: 1; min-width: 0; }
/* 行内市场价：恒渲染在输入框右侧（无价显示 —），保证空/非空槽位对齐 */
.tg-cs-price {
  font-size: var(--text-micro); color: var(--color-text-tertiary);
  min-width: 56px; text-align: right; flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tg-cs-input {
  width: 100%; padding: 6px 10px; background: var(--color-surface-2);
  border: 1px solid var(--color-border); border-radius: 9px;
  transition: border-color 0.14s ease, box-shadow 0.14s ease;
}
.tg-cs-input:focus { outline: none; border-color: var(--color-accent-ring); box-shadow: 0 0 0 2px var(--color-accent-bg); }
.tg-cs-input--ro { color: var(--color-text-secondary); cursor: default; }
.tg-cs-input--ro:focus { border-color: var(--color-border); box-shadow: none; }
.tg-cs-cleared { font-size: var(--text-xs); color: var(--color-danger); flex-shrink: 0; padding: 0 2px; }
.tg-cs-act { display: flex; justify-content: center; }

/* 底部操作栏：通栏玻璃条常驻固定，左侧改动小结 + 右侧独立保存按钮 */
.cfg-foot {
  flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px;
  margin: 12px -20px -14px; padding: 10px 20px 12px;
  border-top: 1px solid var(--color-border-light);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  background: color-mix(in srgb, var(--color-surface-2) 55%, transparent);
}
.cfg-foot-note { font-size: var(--text-xs); color: var(--color-text-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cfg-foot-note--dirty {
  color: var(--color-accent); font-weight: 600;
  background: var(--color-accent-bg); padding: 3px 10px; border-radius: 999px;
}
.cfg-save {
  flex-shrink: 0; border-radius: var(--radius-sm); box-shadow: var(--shadow-card);
}
.cfg-save:disabled { box-shadow: none; }

/* 背包资产 */
.mx--click { cursor: pointer; border-radius: var(--radius-sm); padding: 2px 4px; margin: -2px -4px; transition: background 0.12s; }
.mx--click:hover { background: var(--color-accent-bg); }
.mx--click:hover .mx-value { color: var(--color-accent); }
.bp-add { display: flex; gap: 8px; align-items: flex-end; }
.bp-add .item-search { flex: 1; }
.bp-list {
  border: 1px solid var(--color-border-light); border-radius: var(--radius-sm);
  padding: 4px 8px; max-height: 320px;
}
.bp-row { display: flex; align-items: center; gap: 10px; padding: 4px 2px; font-size: var(--text-xs); border-bottom: 1px dashed var(--color-border-light); }
.bp-row:last-child { border-bottom: none; }
.bp-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-text); }
.bp-qty { color: var(--color-accent); font-weight: 550; flex-shrink: 0; }
.bp-price { color: var(--color-text-tertiary); flex-shrink: 0; font-variant-numeric: tabular-nums; }
.bp-sum { color: var(--color-warning); flex-shrink: 0; width: 90px; text-align: right; font-variant-numeric: tabular-nums; }
.bp-op-qty { width: 52px; padding: 3px 6px; text-align: center; flex-shrink: 0; }
.bp-sell-btn { color: var(--color-success); }
.bp-row--sell { background: var(--color-success-bg); border-radius: var(--radius-sm); padding: 6px 4px; gap: 8px; }
.bp-sell-field { display: inline-flex; align-items: center; gap: 4px; color: var(--color-text-tertiary); flex-shrink: 0; white-space: nowrap; }
.bp-sell-qty { width: 52px; padding: 3px 6px; text-align: center; }
.bp-sell-wan { width: 76px; padding: 3px 6px; text-align: right; }
.bp-sell-sum { color: var(--color-success); font-weight: 600; flex-shrink: 0; min-width: 72px; text-align: right; font-variant-numeric: tabular-nums; }
.bp-sell-sum--off { color: var(--color-text-tertiary); font-weight: 400; }

/* 档位工资表 */
.tier-table { display: flex; flex-direction: column; gap: 6px; }
.tier-row { display: grid; grid-template-columns: 56px 1fr 1fr 1fr; gap: 8px; align-items: center; }
.tier-row--head { font-size: var(--text-micro); color: var(--color-text-tertiary); }
.band-lv { font-size: var(--text-xs); font-weight: 550; color: var(--color-text-secondary); }

/* 节点顺序弹窗 */
.order-list { display: flex; flex-direction: column; gap: 4px; max-height: 40vh; overflow-y: auto; scrollbar-width: none; }
.order-list::-webkit-scrollbar { display: none; }
.order-row { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: var(--radius-sm); background: var(--color-surface-2); font-size: var(--text-xs); }
.order-row--hot { background: var(--color-accent-bg); }
.order-idx { width: 20px; color: var(--color-text-tertiary); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.order-slot { width: 110px; color: var(--color-text-secondary); font-weight: 550; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; }
.order-item { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-text); }
.order-cost { color: var(--color-text-tertiary); font-variant-numeric: tabular-nums; flex-shrink: 0; }

/* 调整目标配置弹窗 */
.tg-now { display: flex; gap: 12px; flex-wrap: wrap; font-size: var(--text-xs); color: var(--color-text-secondary); padding: 8px 10px; border-radius: var(--radius-sm); background: var(--color-surface-2); }
.tg-now b { color: var(--color-text); font-variant-numeric: tabular-nums; }
.tg-preview { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; padding: 8px 10px; border-radius: var(--radius-sm); background: var(--color-surface-2); font-size: var(--text-xs); color: var(--color-text-secondary); }
.tg-preview--empty { text-align: center; color: var(--color-text-tertiary); }
.tg-preview-row { display: flex; align-items: center; justify-content: space-between; }
.tg-preview-row b { font-variant-numeric: tabular-nums; color: var(--color-text); }
.tg-preview-row--total { border-top: 1px dashed var(--color-border-light); padding-top: 5px; margin-top: 2px; }
.tg-num--add { color: var(--color-success); }
.tg-num--chg { color: var(--color-warning); }
.tg-num--del { color: var(--color-danger); }

/* 弹窗内节点对照 */
.diff-row { display: grid; grid-template-columns: 64px 1fr 22px 1fr; gap: 8px; align-items: center; font-size: var(--text-xs); }.diff-row--modal { background: var(--color-surface-2); padding: 8px; border-radius: var(--radius-sm); }
.diff-slot { font-weight: 550; color: var(--color-text-secondary); }
.diff-item { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-text); }
.diff-arrow { color: var(--color-text-tertiary); display: inline-flex; justify-content: center; }

/* 滚动条：弹窗与下拉同样隐藏（滚轮仍可滚动） */
.modal { scrollbar-width: none; }
.modal::-webkit-scrollbar { display: none; }
.item-drop { scrollbar-width: none; }
.item-drop::-webkit-scrollbar { display: none; }
.node-track::-webkit-scrollbar-thumb, .modal::-webkit-scrollbar-thumb, .item-drop::-webkit-scrollbar-thumb { background: transparent; }
</style>
