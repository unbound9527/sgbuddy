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

### UI 风格统一走 global.css 与 AppIcon

- 设计 token（颜色/玻璃/阴影/圆角）、6 档字号阶梯（`--text-*`）、动效 keyframes 全部在 `src/styles/global.css`，执行规范见 `docs/UI-STYLE.md`；新增样式一律引用变量，不得写死 px 字号。
- 图标一律用 `src/components/ui/AppIcon.vue`（lucide 封装，只允许用其 MAP 内已注册的名称），**禁止再引入 emoji 图标**。
- 卡片材质 = `--shadow-card` + `--color-border-light`；弹窗 = 玻璃配方（`--glass-bg` + blur + `modal-in` 入场），参照各视图既有写法。

### 游戏交互红线：只做进程外观察，禁止注入/内存读取/模拟输入

- 与 QQ三国 游戏进程的交互只允许两类：**进程外被动观察**（`EnumWindows`、`GetWindowTextW`、`PROCESS_QUERY_LIMITED_INFORMATION` 查进程名等公开窗口/进程元数据，见 `electron/services/window-manager.ts`）和**标准窗口激活**（`ShowWindow`/`SetForegroundWindow` 等，与点击任务栏/Alt+Tab 同级）。
- **禁止引入**：模拟输入（`SendInput`/`keybd_event` 等向游戏发按键鼠标，如自动打怪/自动答题）、游戏内存读取（`PROCESS_VM_READ` 等）、DLL 注入 / 全局钩子（`SetWindowsHookEx`）、封包拦截篡改。这些会进入反外挂检测范畴，直接构成用户账号封禁风险。
- 屏幕截图 + OCR 属像素级被动读取，允许（现有 umi-ocr/tesseract 链路即此性质）。
- 新增任何涉及游戏交互的功能前，先对照本条确认不越界。

## 技术栈速览

- 渲染进程通过 `window.electronAPI`（preload 暴露）与主进程通信；数据库操作走 `dbQuery` / `dbTransaction`。
- 全局大区选择在 `useAppStore().currentServerId`（pinia），按大区隔离的数据（如物价）读取时要带 `server_id` 过滤。
- 攻略页 `src/views/GameGuide.vue` 的韧性表：消耗数据在 `src/data/toughness-table.json`（每行 = 升到该等级的花费），精华单价实时读取 `price_params`，编辑失焦即保存并记录 `price_history`。
