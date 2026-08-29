# 发版 SOP（Release 标准操作流程）

适用于 SG Buddy 的每次正式发布。分「本地直传（推荐）」和「CI 全自动（备选）」两条路径，日常用前者，几分钟出结果。

## 前置条件（一次性，已就绪则跳过）

| 项 | 说明 |
|----|------|
| 本地构建机 | Windows 10/11 + Node.js 18+；国内网络需设置 Electron 镜像（见下方命令） |
| Gitee 令牌 | 仓库根目录 `.gitee-token` 文件（已 gitignore），或环境变量 `GITEE_TOKEN`；权限勾选 projects |
| GitHub Secrets | 仓库 Settings → Secrets：`GITEE_OWNER` / `GITEE_REPO` / `GITEE_TOKEN`（仅 CI 全自动路径需要） |
| 两端仓库 | `github.com/unbound9527/sgbuddy` 与 `gitee.com/rookieee/sgbuddy`，remote 名分别为 `github` / `gitee` |

## 日常发版（本地直传，约 10 分钟）

```bash
# 1. 更新版本号（package.json 的 version 字段，与 tag 一致）
#    例：1.0.0 → 1.0.1

# 2. 提交并推送代码
git add -A && git commit -m "release: v1.0.1"
git push github main && git push gitee main

# 3. 本地构建安装包（国内网络需要镜像变量）
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ \
ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/ \
npm run dist
# 产物：release/SG-Buddy-Setup-v1.0.1.exe

# 4. 打 tag 并推送（触发 CI 构建留档；v* tag 会触发 release.yml）
git tag v1.0.1
git push github v1.0.1 && git push gitee v1.0.1

# 5. 上传 Gitee Release（幂等：Release 不存在会自动创建，同名附件先删后传，可重跑）
node scripts/publish-gitee.mjs --tag v1.0.1 \
  --file release/SG-Buddy-Setup-v1.0.1.exe \
  --notes "SG Buddy v1.0.1 发布"
```

发版后 CI 会在 GitHub 侧自动创建同名 GitHub Release 并上传安装包（作为 Gitee Go 中转的源，也是海外用户的下载点）。

### 构建报 EPERM 时

Windows 杀软可能锁住 `release/win-unpacked` 导致重命名失败。绕过方案（跳过 Electron 下载解压，直接用本地二进制）：

```bash
npm run build
npx electron-builder --win --publish never -c.electronDist=node_modules/electron/dist
```

## 发版后验证清单

- [ ] Gitee Release 页面附件存在且大小正确（约 85-90MB）：`https://gitee.com/rookieee/sgbuddy/releases/tag/vX.Y.Z`
- [ ] 下载链接可达（浏览器点击附件下载，出现下载进度即正常）
- [ ] 已安装的旧版本应用内「检查更新」能提示新版本（更新器读 Gitee `releases` 列表并过滤 `vX.Y.Z` tag）
- [ ] （走了 CI 时）GitHub Release 已创建且附件存在

## CI 全自动路径（备选，慢）

只推 tag 也会触发 `.github/workflows/release.yml`：自动构建 → 直传 Gitee Release → 创建 GitHub Release。全程约 40-90 分钟（瓶颈是 GitHub 美国服务器 → Gitee 的跨境上传，已放宽单次上传窗口到 90 分钟）。适合不急着让用户看到的版本；赶时间用本地直传。

### Gitee Go 中转（可选加速）

CI 构建完成后（GitHub Release 已有安装包），在 Gitee 仓库「流水线」中手动运行：

```bash
node scripts/sync-release-to-gitee.mjs --tag v1.0.1
```

从 GitHub Release 拉取安装包并上传 Gitee（国内服务器直连 Gitee，1-3 分钟）。流水线需配置环境变量：`GITEE_TOKEN` / `GITEE_OWNER` / `GITEE_REPO`，触发参数 `TAG`。

## OCR 引擎更新（引擎升级时）

引擎不随安装包分发（体积原因），单独发布到 tag 为 `ocr-engine` 的 Release（应用内「下载引擎」按此拉取）：

```bash
# 从本机 Umi-OCR 目录裁剪并压缩（需 resources/umi-ocr/UmiOCR-data/plugins/win7_x64_PaddleOCR-json）
node scripts/build-ocr-engine.mjs
# 产物：release/ocr-engine/ocr-engine.7z.001（约 52MB，单卷，<100MB 附件限制）

node scripts/publish-gitee.mjs --tag ocr-engine \
  --file release/ocr-engine/ocr-engine.7z.001 \
  --notes "PaddleOCR-json 高精度 OCR 引擎（裁剪版）"
```

注意：`ocr-engine` 不是 `vX.Y.Z` 格式，不会被更新器误认为应用新版本（`updater.ts` 已按 tag 前缀过滤）。

## 常见问题

| 现象 | 原因与处理 |
|------|-----------|
| 打包报 `EPERM ... rename win-unpacked` | 杀软锁文件，用上方 electronDist 方案绕过 |
| publish 脚本报 401「登录失效」 | `.gitee-token` 缺失/过期，重新生成私人令牌并更新文件 |
| publish 脚本报 400「target_commitish is missing」 | 已在脚本内默认 `main`；如改过默认分支，设置环境变量 `GITEE_BRANCH` |
| 上传 curl 报 22/404 | 确认用的是 `scripts/publish-gitee.mjs`（附件接口按 release 数字 ID 寻址，手工拼 tag 路径会 404） |
| CI 上传一直超时 | 跨境带宽限制，改走本地直传或 Gitee Go 中转 |
| 单文件超过 100MB | Gitee 附件上限，安装包需控制体积（electron-builder.yml 已裁剪） |
| 用户报「检查更新提示异常版本」 | 确认没有创建非 `vX.Y.Z` 格式的应用类 Release（引擎等特殊 Release 用独立 tag） |

## 相关文件

| 文件 | 作用 |
|------|------|
| `scripts/publish-gitee.mjs` | 上传任意文件到 Gitee Release（幂等） |
| `scripts/build-ocr-engine.mjs` | 从 Umi-OCR 裁剪引擎并 7z 分卷 |
| `scripts/sync-release-to-gitee.mjs` | GitHub Release → Gitee Release 中转（Gitee Go 用） |
| `.github/workflows/ci.yml` | 推送触发的类型检查/测试/构建验证 |
| `.github/workflows/release.yml` | tag 触发的构建 + Gitee 直传 + GitHub Release |
| `electron/services/updater.ts` | 应用内更新检测与 OCR 引擎下载（`GITEE_OWNER`/`GITEE_REPO` 配置在此） |
