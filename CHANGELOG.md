# 更新日志

## 实用增强版 · 工具链 + 词典扩充 + 轻量化（2026-10-04）

### 变更内容

在保持既有「非侵入式注入 + 幂等补丁」脚本架构不变的前提下，新增一整套实用工具链，扩充词典并实现轻量化重打包。

#### 1. 词典扩充（1414 → 2999 条，+1585）

新增 `scripts/import-dict.js`，可从外部词典（如 AntigravityCN）合并词条并自动重建双语词库与翻译引擎：

- 仅接受有效条目，不覆盖已存在键（含大小写差异去重）
- 写入后按键排序，保证 `en.json` / `zh-CN.json` 100% 键对齐
- 自动重新生成自包含 `scripts/i18n-bundle.js`
- 支持 `--dry-run` 预览合并结果

#### 2. 新增词典审计工具（`scripts/audit-dict.js`）

一键体检词典质量，覆盖 7 类检查：

| 检查项 | 说明 |
|---|---|
| 键对齐 | `en` / `zh` 双侧键是否一一对应 |
| 大小写重复键 | 检测仅大小写差异的冗余键 |
| 空值 | 检测空字符串译文 |
| 非法键 | 检测键中含中文等异常 |
| 未翻译 | 中文与英文完全相同 / 中文值不含汉字 |
| 占位符一致性 | 校验 `${x}`、`{0}`、`%s`、`$1` 等占位符对齐 |
| 基准完整性 | `en.json` 值是否恒等于键（纯英文基准） |

#### 3. 新增缓存清理工具（`scripts/clean-cache.js`）

- 仅清理 Chromium 缓存类目录（`Cache`、`GPUCache`、`Code Cache`、`ShaderCache`、`Crashpad` 等），**保留登录态、Cookies、Local Storage 与个人设置**
- 客户端运行中默认拒绝清理，支持 `--force` 强制、`--dry-run` 预览
- 输出可释放空间明细

#### 4. 新增一键启动工具（`scripts/launch.js`）

- 自动定位安装目录并启动客户端，已运行则跳过
- 支持 `--path` 指定路径、`--list` 列出探测结果

#### 5. 多路径 / 自定义路径支持（`scripts/lib/app-path.js`）

新增统一路径解析模块，供 `patch.js` / `restore.js` / `launch.js` 复用，四级优先级定位安装目录：

1. 命令行 `--path`
2. 环境变量 `ANTIGRAVITY_DIR`
3. 项目根目录 `antigravity-path.txt`
4. 自动扫描常见安装位置

Windows 下按小写归一化去重，避免大小写差异导致的重复探测。

#### 6. 轻量化重打包

- 重打包时通过 `--unpack-dir "node_modules/chrome-devtools-mcp"` 保留外部模块为 `unpacked` 形式
- `app.asar` 由全量内联的约 21.7 MB 降至 **约 5 MB**，与官方结构一致
- 同步刷新 `app.asar.unpacked` 目录，保证 MCP 功能不受影响
- 保留 junction 关联机制，从 `app.asar.bak` 解包时自动关联真实外部文件目录，防止 ENOENT 与文件缺失

#### 7. 其他

- `patch.js` 新增 `--list` / `--launch` 参数
- 新增 Windows 一键入口：`clean-cache.bat`、`launch.bat`、`audit-dict.bat`、`import-dict.bat`
- 移除冗余死代码 `scripts/i18n-loader.js`
- `.gitignore` 补充临时产物与本地路径配置

### 验证结果

- 补丁应用：40/40 处全部命中，0 跳过（幂等重跑结果一致）
- 词典一致性：`en.json` / `zh-CN.json` 各 2999 条，键 100% 对齐，JSON 语法校验通过
- 审计结果：结构检查通过（无空值、无非法键、占位符一致、基准完整）
- 轻量化：安装后 `app.asar` 约 5 MB，`unpacked` 外部文件约 16 MB 完整保留
- 还原验证：`restore.js` 还原后 `app.asar` 与官方备份字节级一致（4.42 MB）
- 缓存清理：`--dry-run` 预览正常，用户数据未被改动

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
