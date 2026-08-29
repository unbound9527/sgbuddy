# SG Buddy — QQ三国助手

配号、养成、倒卖一体化的 QQ三国 桌面工具。

作者：QQ三国烟尘

## 功能

- **物价图鉴**：装备/材料价格录入与管理、价格走势、装备截图 OCR 识别（自动填充名称、部位、属性）
- **配号中心**：配装方案、成本核算、资产/目标配置
- **升级计算器**：日常活跃计划、经验加成（封印加速、师徒、青梅等）、等级段刷怪策略、升级时间预估
- **经验表**：怪物基础经验（A 表）、每级最优打怪组合（B 表）、等级经验（C 表），支持导出 Excel
- **游戏攻略**：韧性加点消耗表、Boss 图鉴、副本减伤标准表、每日活动、答题题库（拼音搜索）、四象搭配
- **交易线索**：贴吧捡漏情报收集、币价（淘宝）监控与波动曲线
- **窗口管理**：多开窗口枚举/切换、预设排序、全局快捷键 Ctrl+1~5（密码保护）、定时关机
- **数据导出**：配装方案、经验表导出为 Excel

## 运行环境

- Windows 10/11 x64（Windows 7 不支持）
- 开发构建需要 Node.js 18+ 与 npm

## 开发与构建

```bash
npm install          # 国内网络可加 --registry=https://registry.npmmirror.com
npm run dev          # 开发模式
npm run typecheck    # 类型检查
npm test             # 单元测试
npm run build        # 构建产物到 dist/
npm run dist         # 打包 Windows 安装包（electron-builder，输出到 release/）
```

注意：`better-sqlite3` 为原生模块，打包时会自动重新编译；国内网络打包时 electron-builder 需要下载 Electron 发行包，请设置镜像后重试：

```bash
# Windows PowerShell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
npm run dist
```

## OCR 引擎

装备截图识别（物价图鉴）默认内置 **Tesseract** 中文语言包（约 2.4MB，离线可用，识别率一般）。

高精度识别需要 **PaddleOCR-json** 引擎（约 240MB，裁剪版），首次使用按以下流程安装：

- 侧边栏出现「下载引擎」按钮（安装前识别精度受限提示），点击后弹窗显示完整进度：下载百分比、已下载/总大小（约 55MB）、实时速度；下载完成后自动进入解压阶段（约 1 分钟，界面有明确提示），安装完成自动生效
- 下载源为 Gitee Release（国内网络可用），一次安装永久使用，无需再次下载
- 若下载失败，弹窗展示具体错误原因（网络/源未配置等），可直接重试
- 也可以手动安装：下载 [Umi-OCR](https://gitee.com/mirrors/Umi-OCR) 并安装后，应用会自动检测其内置引擎
- 引擎来源：Umi-OCR 项目（MIT）内嵌的 PaddleOCR-json（Apache-2.0），本仓库提供裁剪与打包脚本 `scripts/build-ocr-engine.mjs`

## 数据来源与致谢

- 等级经验、怪物经验、副本减伤等数值数据：[wanderingquantum.github.io/qqsganalysis](https://wanderingquantum.github.io/qqsganalysis/)（作者 wanderingquantum 的 QQ三国数据站）
- 答题题库：QQ三国题库（qqsgtk.cn）、github.com/buchijiang/QQSGS
- 部分攻略数据整理自百度贴吧玩家帖子（帖内均有原文链接）
- OCR：Tesseract（Apache-2.0）、Umi-OCR（MIT）、PaddleOCR（Apache-2.0）
- 游戏中截图素材版权归腾讯 QQ三国 所有

## 合规声明与免责

1. **窗口管理**：本软件仅通过 Win32 API 在本地枚举与切换游戏窗口，**不修改游戏内存、不注入、不修改客户端文件、不自动操作游戏角色**。多开窗口属于游戏规则敏感行为，请自行评估腾讯《QQ三国》用户协议；因使用本软件产生的任何账号风险由使用者自行承担。
   - 窗口管理启用彩蛋密码保护：**密码为 2027 开头的 8 位数字**，猜中即解锁。此保护仅用于筛选小白，源码公开、哈希可离线爆破，**不构成任何安全保证**。解锁状态持久化保存，一次解锁永久生效。
2. **定时关机**：仅在你主动设置时调用 Windows 系统 `shutdown` 命令，应用退出后计划仍然生效，可随时取消。
3. **价格与交易线索抓取**：访问淘宝搜索页、百度贴吧公开页面，仅供本地个人参考，请勿高频访问、勿用于商业用途。
4. 本软件仅供学习交流，请遵守游戏官方规则；因使用本软件产生的任何后果由使用者自行承担。

## 更新机制与发布

- 应用启动时自动检查更新：从 **Gitee Releases** 获取最新版本（国内网络可用），发现新版本后提示下载并静默安装；更新源配置在 `electron/services/updater.ts` 顶部（`GITEE_OWNER` / `GITEE_REPO`，默认 `rookieee/sgbuddy`）
- **发版完整 SOP 见 [RELEASE.md](RELEASE.md)**：本地直传（推荐，约 10 分钟）/ CI 全自动 / Gitee Go 中转 / OCR 引擎发布与常见问题

**发布正式版（推荐：本地构建 + 直传 Gitee，国内速度几分钟）**

1. 修改 `package.json` 的 `version`，本地构建：`npm run dist`（产物 `release/SG-Buddy-Setup-vX.Y.Z.exe`；若打包报 EPERM（杀软锁文件），改用 `npm run build && npx electron-builder --win --publish never -c.electronDist=node_modules/electron/dist`）
2. 推送代码与 tag：`git push gitee main --tags && git push github main --tags`
3. 上传到 Gitee Release：`node scripts/publish-gitee.mjs --tag vX.Y.Z --file release/SG-Buddy-Setup-vX.Y.Z.exe --notes "发布说明"`
   - 令牌：环境变量 `GITEE_TOKEN`，或仓库根目录创建 `.gitee-token` 文件（已 gitignore，勿提交；Gitee → 设置 → 私人令牌，勾选 projects 权限）
   - 脚本幂等可重跑：Release 不存在会自动创建，同名附件先删后传

**发布正式版（备选：CI 全自动，跨境上传较慢约 30-90 分钟）**

推送 `vX.Y.Z` tag 到 GitHub 会触发 Actions 自动构建：直传 Gitee Release 并同时创建 GitHub Release（`.github/workflows/release.yml`，需在仓库 Secrets 配置 `GITEE_OWNER` / `GITEE_REPO` / `GITEE_TOKEN`）；也可在 Gitee Go 流水线中运行 `node scripts/sync-release-to-gitee.mjs --tag vX.Y.Z`（配置同名环境变量）从 GitHub Release 中转同步，国内速度更快。

**OCR 引擎发布（一次性手动）**

引擎不含在安装包里（体积原因）。本地运行 `node scripts/build-ocr-engine.mjs` 生成 `release/ocr-engine/ocr-engine.7z.001`（约 52MB），然后 `node scripts/publish-gitee.mjs --tag ocr-engine --file release/ocr-engine/ocr-engine.7z.001 --notes "PaddleOCR-json 高精度引擎（裁剪版）"` 发布到 tag 为 `ocr-engine` 的 Release。应用首次使用高精度 OCR 时会自动从该 Release 下载安装。

## License

[MIT + 附加条款](LICENSE) — 本软件以 MIT 协议开源，可自由使用、修改、分发（须保留版权声明）。附加条款禁止将本软件或其修改版本用于游戏外挂、自动脚本、作弊程序及违法牟利。

> 说明：附加条款使其不属于 OSI 标准开源协议（属「源码公开」许可），MIT 授予的复制、修改、分发等权利不受影响。
