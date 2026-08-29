# SG Buddy 项目约定

QQ三国桌面助手（Electron + Vue 3 + TypeScript + SQLite）。

## 避坑约定

### 物价价格单位：数据库存「亿三国币」，界面呈现「万三国币」

- `price_params.benchmark_price` / `market_price`、`price_history` 表的存储单位均为「亿三国币」。
- 所有界面（物价图鉴列表/表单/走势、韧性表精华成本等）统一按「万三国币」呈现。
- 换算：录入万 → 存亿 = `value / 10000`（图鉴 `fromWan`）；显示亿 → 万 = `value * 10000`。
- 示例：录入 165 万 → 库中存 `0.0165`（亿）。
- **不要改动存储单位**。若必须改，需同步迁移 `price_params`、`price_history` 两张表存量数据，并逐一核对全部换算点（DataCenter、GearCenter、ShopManager、TradeCenter、ShenyuanPanel、GameGuide、query-catalog 等 6+ 文件约 90 处引用），任何遗漏会导致价格显示错 1 万倍。
- 涉及价格字段的新代码，先确认读写单位再动手。

### 数字输入框用 v-num 指令

- 受控数字输入（`:value` + `@input`）会顶掉用户正在输入的内容，使用 `src/utils/numInput.ts` 导出的 `v-num` 指令绑定值。

## 技术栈速览

- 渲染进程通过 `window.electronAPI`（preload 暴露）与主进程通信；数据库操作走 `dbQuery` / `dbTransaction`。
- 全局大区选择在 `useAppStore().currentServerId`（pinia），按大区隔离的数据（如物价）读取时要带 `server_id` 过滤。
- 攻略页 `src/views/GameGuide.vue` 的韧性表：消耗数据在 `src/data/toughness-table.json`（每行 = 升到该等级的花费），精华单价实时读取 `price_params`，编辑失焦即保存并记录 `price_history`。
