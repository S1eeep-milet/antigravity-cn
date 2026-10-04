# 更新日志

## 实用增强 · 词典扩充至 3340 条 + 清缓存/一键启动/多路径/审计工具（2026-10-04）

在保持既有非侵入式脚本架构与 40 处补丁逻辑不变的前提下，吸收同类工具的实用功能，并大幅扩充词典。

### 1. 词典扩充（1414 → 3340 条，+1926）

- 新增词条筛选自社区同类项目 AntigravityCN 的公开词典（其 README 标注 MIT），与现有词典去重后合并；重合的 579 条保留本项目原译文，术语口径不被覆盖。
- 筛选规则：剔除超长条目（>300 字符）、无中文译文条目、代码/链接类条目，以及英文键中混有中文的中间态条目（共 60 条，该类条目属于对方多段翻译管线的中间产物，不属于官方英文源文本，不应进入 en.json 基准）。
- 合并后 `en.json` 与 `zh-CN.json` 各 3340 条，100% 键对齐，并已按字母序重排；翻译引擎 `i18n-bundle.js` 已同步重新生成。

### 2. 新增功能

- **多路径检测与自定义路径**（`scripts/lib/common.js`）：安装目录探测扩展到 `%LOCALAPPDATA%\Programs\antigravity`、`%ProgramFiles%\Antigravity` 等多个常见位置；`patch.js` / `restore.js` / `launch.js` 均支持 `--path <安装目录>`、`--asar <app.asar>`，以及环境变量 `ANTIGRAVITY_PATH`。补丁运行前会明确提示检测到的客户端进程状态。
- **缓存清理**（`scripts/clean-cache.js` + `clean-cache.bat`）：只删除用户数据目录下的 Cache、Code Cache、GPUCache、DawnGraphiteCache、DawnWebGPUCache、blob_storage 临时目录，不动配置与登录；`patch.js --clean-cache [--force]` 亦可调用。
- **一键启动**（`scripts/launch.js` + `launch.bat`）：直接启动客户端；`patch.js --launch` 支持汉化完成后自动启动。
- **词典审计工具**（`scripts/audit-locales.js`）：检查键对齐、重复键（从原始文本检测）、空译文、占位符一致性与字母序，`--sort` 一键重排。
- `patch.js --help` 输出全部参数说明；`.gitignore` 补上 `.tmp_extracted_asar/` 运行时目录。

### 验证结果

- 全部脚本通过 `node --check` 语法校验；`patch.js --help` 输出正确。
- 词典审计：en/zh 各 3340 条，键 100% 对齐，无重复键、无占位符不一致错误。
- 缓存清理与路径探测已在模拟目录环境下实测：缓存目录被正确清除、配置目录未受影响；`--path` 指定目录与直接指定 `app.asar` 均能正确解析，路径错误时报错信息包含全部已探测位置。
- 原有 40 处补丁逻辑与锚点未做任何修改，v2.19.1 的补丁命中验证结论不变；扩充词条仅为运行时词典，不影响补丁。

---

## v2.19.1 适配 · Web 界面词条全量补全（2026-10-02）

### 变更内容

Antigravity 更新至 v2.19.1 后，本次适配在保持既有非侵入式架构不变的前提下，重点补全 Web 界面的界面文案覆盖，并移除已失效的补丁。

#### 1. 词典全量补全（746 → 1414 条，+668）

从 v2.19.1 Web UI 打包产物中提取全部界面文案，与现有词典比对后新增 668 条，`en.json` 与 `zh-CN.json` 保持 100% 键对齐。新增词条覆盖：

- **轨迹调试**：Trajectory Debug View、Trajectory Metrics、Execution Metadata、Step Details、Segment Metrics 等
- **工作树与 Git**：Worktree、Staged Changes、Amend、Push、Merge Conflict、Branch Changes 等
- **技能与插件**：Skills & Rules、Installed Skills、Marketplace、UI Plugins、Plugin details 等
- **权限与沙箱**：Permission Preset、Browser Actuation Rules、Network Permissions、File Access Rules 等
- **模型与配额**：Model Credits、AI Credits、Baseline model quota reached、Purchase Credits 等
- **Best-of-N / 自主模式**：Best-of-N Started、Autonomous mode active、Variant Name 等
- **其余**：布局控制、通知偏好、分组排序、反馈表单等大量二级界面文案

> 大小写仅差异的重复项（如 `Zoom In` / `Zoom in`）由翻译引擎的大小写回退机制覆盖，不重复收录。

#### 2. 补丁校准（41 → 40 处）

- **移除** `loadingOverlay.js · 启动加载文案` 补丁：v2.19.1 起启动过渡层已移除文字，仅保留 SVG 动画，原 `Loading Antigravity` 目标不复存在。
- 其余 40 处补丁目标在 v2.19.1 源码中全部命中，`preload.js` / `utils.js` / `menu.js` 注入锚点校验通过。
- 主流程步骤重新编号（Step 11 wizardHtml → Step 14 重打包）。

#### 3. 文档同步

- README.md：版本徽标更新至 v2.19.1，词条数 1414，补丁数 40，目录结构同步
- 汉化使用说明.md：适用版本、词条数与补丁数同步更新
- 移除目录结构中指向已删除文件的死链

### 验证结果

- 补丁应用：40/40 处全部命中 v2.19.1 源码，0 未命中
- 词典一致性：`en.json` / `zh-CN.json` 各 1414 条，JSON 语法校验通过，无单侧键差异
- 引擎产物：`i18n-bundle.js` 语法校验通过，内嵌 1414 词条，抽样译文校验正确

---

## v2.17.0 适配 · WSL 集成界面汉化（2026-09-28）

### 推送信息

- 提交：`1a7ed0e`
- 分支：`main`（已同步至 GitHub `origin/main`）
- 变更文件：6 个（+168 / -19）

### 变更内容

Antigravity 更新至 v2.17.0 后新增 WSL 集成功能，本次适配完成全部新增界面文案的汉化：

#### 1. 词典扩充（734 → 746 条，+12）

`locales/en.json` 与 `locales/zh-CN.json` 同步新增 12 条 WSL 词条，保持 100% 键对齐：

- `Connect to WSL` → 连接到 WSL
- `Reopen Locally` → 在本机重新打开
- `Cannot open folder` → 无法打开文件夹
- `Folder is on the Windows filesystem` → 文件夹位于 Windows 文件系统上
- `WSL distro not found` → WSL 分发版未找到
- `Antigravity opened on Windows instead.` → Antigravity 已在 Windows 上打开。
- `WSL setup failed` → WSL 设置失败
- 以及 wsl.js 路径转换错误/警告与下载、安装状态文案

#### 2. 补丁扩充（26 → 41 处，+15）

`scripts/patch.js` 新增 5 个补丁组：

| 文件 | 补丁数 | 覆盖内容 |
|---|---|---|
| main.js | +5 | WSL 分发版未找到对话框（标题/正文/补充）、服务器安装失败正文、WSL 设置失败错误框 |
| ipcHandlers.js | +2 | 无法打开文件夹错误框、文件夹位于 Windows 文件系统提示 |
| menu.js | +2 | 「连接到 WSL」「在本机重新打开」菜单项（异步添加，直接替换源码） |
| wsl.js | +5 | 路径属于其他分发版、无法在 WSL 中打开的位置、Windows 文件系统访问警告、下载/安装状态文案 |
| provisionSplash.js | +1 | 启动画面「正在设置 WSL：…」文案 |

主流程同步新增 Step 13（wsl.js）与 Step 14（provisionSplash.js）。

#### 3. 其他修复

- README.md：版本徽标与适配说明更新至 v2.17.0、词条数 746、补丁数 41
- 汉化使用说明.md：版本与补丁说明同步更新
- 修复两处指向已删除「Antigravity 汉化专用提示词.md」的死链，改指 README 术语规范章节
- 补丁运行时检测到安装目录备份缺失，已基于官方 v2.17.0 原版重建 `app.asar.bak`，一键还原功能保持可用

### 验证结果

- 补丁应用：41/41 处全部命中 v2.17.0 源码，0 跳过
- 安装后校验：16 项逐条检查全部通过（词典注入、WSL 对话框、菜单、启动画面）
- 词典一致性：en/zh 各 746 条，无单侧键差异

---

## v2.15.1 基准版（2026-09-25 前）

- 词典 734 条，补丁 26 处
- 覆盖 Web 界面、设置项、原生菜单、系统托盘、启动过渡页、安装向导与各类对话框
