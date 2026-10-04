# 更新日志

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
