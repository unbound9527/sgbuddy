# 第三方组件与素材声明（Third-Party Notices）

本软件及其分发包使用了以下第三方组件与素材，在此致谢。各 npm 依赖的许可证以 `node_modules` 内对应包的声明为准（可用 `npx license-checker` 导出）。

## 随安装包分发的组件

| 组件 | 用途 | 许可证 | 来源 |
|------|------|--------|------|
| Tesseract.js | 装备截图 OCR（默认离线引擎） | Apache-2.0 | https://github.com/naptha/tesseract.js |
| chi_sim.traineddata | Tesseract 中文简体语言包（tessdata_fast） | Apache-2.0 | https://github.com/tesseract-ocr/tessdata_fast |
| 7za.exe（7-Zip 命令行版） | 运行时解压 OCR 引擎分卷 | LGPL-2.1（含 unRAR 限制） | https://www.7-zip.org |
| Electron（含 Chromium、Node.js） | 桌面运行时框架 | MIT 等多重许可 | https://www.electronjs.org |

## 按需下载的组件（不随安装包分发，用户首次使用高精度 OCR 时下载）

| 组件 | 用途 | 许可证 | 来源 |
|------|------|--------|------|
| PaddleOCR-json | 高精度 OCR 引擎（裁剪版） | Apache-2.0 | https://github.com/hiroi-sora/PaddleOCR-json |
| Umi-OCR | 引擎载体（内嵌 PaddleOCR-json，本仓库裁剪打包脚本即基于其引擎目录） | MIT | https://github.com/hiroi-sora/Umi-OCR |

## 数据与素材来源

- 等级经验、怪物经验、副本减伤等数值数据：[wanderingquantum/qqsganalysis](https://wanderingquantum.github.io/qqsganalysis/)
- 答题题库：QQ三国题库（qqsgtk.cn）、[buchijiang/QQSGS](https://github.com/buchijiang/QQSGS)
- 部分攻略数据整理自百度贴吧玩家帖子（数据文件内附原文链接）
- 游戏截图与名称等素材版权归腾讯《QQ三国》所有，本项目仅作非商业的社区工具用途引用
