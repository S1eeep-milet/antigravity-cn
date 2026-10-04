# Antigravity 界面中文本地化包（Antigravity-cn）

[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-blue)](https://github.com/S1eeep-milet/antigravity-cn)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Verified](https://img.shields.io/badge/verified-Antigravity%20v2.19.1-brightgreen)](https://github.com/S1eeep-milet/antigravity-cn)

Google Antigravity 桌面客户端（Electron 应用）的非侵入式中文汉化方案：**3340 条词条、专业术语统一、一键安装、一键无损还原，并内置缓存清理、一键启动与词典审计工具**。

## 核心特性

- **3340 条词条**：语言包 100% 键对齐，覆盖 Web 界面、设置项、原生菜单、系统托盘、安装向导、WSL 集成界面与各类对话框。其中 1414 条为 v2.19.1 全量提取验证词条，另有 1926 条扩充词条（筛选自社区公开词典并按本项目术语规范与占位符规则复核，见 CHANGELOG）。
- **专业术语统一**：严格执行标准术语对照（Agent → 智能体、Artifact → 产物、Turbo Mode → 极速模式、Sandbox → 沙箱、Security Preset → 安全预设等 22 组核心术语）。
- **非侵入式架构**：基于外部语言包 + 运行时注入实现，不修改任何业务逻辑、键名与标识符，不触碰后端二进制。
- **天然幂等**：补丁脚本始终从原始备份解包，采用三态校验替换，可重复运行、失败自动中止，杜绝半成品安装。
- **代码防篡改保护**：翻译引擎自动跳过代码块、终端输出与 Monaco 编辑器内容，绝不干扰写码与命令执行。
- **一键安装与还原**：`apply-cn.bat` 一键汉化，`restore.bat` 一键回滚官方英文原版。
- **多路径检测与自定义路径**：自动探测 `%LOCALAPPDATA%`、`%ProgramFiles%` 等多个常见安装位置，也可用 `--path <安装目录>` / `--asar <app.asar>` 或环境变量 `ANTIGRAVITY_PATH` 手动指定；运行前会明确提示检测到的客户端进程状态。
- **缓存清理**：`clean-cache.bat` 一键清理客户端的临时渲染/编译缓存（Cache、Code Cache、GPUCache 等），解决更新或汉化后界面残留旧文案的问题，不影响用户配置与登录状态。
- **一键启动**：`launch.bat` 直接启动客户端；或给补丁命令加 `--launch`，汉化完成后自动启动。
- **词典审计工具**：`node scripts/audit-locales.js` 自动检查词典的键对齐、重复键、占位符一致性与排序，`--sort` 可一键按字母序重排。

## 快速开始

### 环境要求

- Windows 10 / 11（x64）
- Node.js 18+（含 `npx`）
- Antigravity 桌面客户端（已在 v2.19.1 深度适配验证，兼容后续 2.x 版本）

### 应用汉化

1. 关闭正在运行的 Antigravity 客户端。
2. 双击运行 `apply-cn.bat`（或在项目目录执行 `node scripts/patch.js`）。
3. 脚本自动检测安装路径（依次探测 `%LOCALAPPDATA%\Programs\antigravity`、`%ProgramFiles%\Antigravity` 等常见位置）、备份原始 `app.asar`、注入语言包与翻译引擎、应用 40 处界面补丁并重新打包。
4. 重新启动 Antigravity，即可看到完整中文界面。

安装位置不在默认路径时，可以手动指定：

```powershell
node scripts/patch.js --path "D:\Tools\Antigravity"
node scripts/patch.js --asar "D:\Tools\Antigravity\resources\app.asar"
# 或设置环境变量 ANTIGRAVITY_PATH 后直接运行 apply-cn.bat
```

### 恢复原版

双击运行 `restore.bat`，脚本自动从 `app.asar.bak` 备份恢复官方英文原版（同样支持 `--path` / `--asar` 指定路径）。

### 常用命令一览

```powershell
node scripts/patch.js --launch        # 汉化完成后直接启动客户端
node scripts/patch.js --clean-cache   # 只清理缓存（客户端占用时加 --force 先关闭它）
node scripts/patch.js --help          # 查看全部参数
node scripts/clean-cache.js           # 单独清理缓存（或双击 clean-cache.bat）
node scripts/launch.js                # 单独启动客户端（或双击 launch.bat）
node scripts/audit-locales.js         # 审计词典（键对齐/重复键/占位符/排序）
```

> 汉化后界面仍显示旧文案，多半是客户端缓存未刷新：运行一次 `clean-cache.bat` 再重启即可。

## 工作原理

1. **解包**：`patch.js` 自动定位 Antigravity 安装目录，将官方 `app.asar` 备份为 `app.asar.bak`；随后在暂存区中通过目录联接（junction）关联 `app.asar.unpacked` 外部文件目录，确保 chrome-devtools-mcp 等外部模块在解包、重打包过程中完整保留。
2. **注入**：将 3340 条中英词典与自包含翻译引擎写入解包树；对 `preload.js`、`utils.js`、`menu.js`、`tray.js`、`main.js`、`ipcHandlers.js`、`updater.js`、`wizardHtml.js`、`wsl.js`、`provisionSplash.js` 执行 40 处精准补丁（三态校验：已是中文则跳过、命中英文则替换、均不命中则报错中止）。
3. **重打包**：将补丁后的文件树重新打包为 `app.asar` 并安装到原路径。
4. **运行时翻译**：翻译引擎通过 MutationObserver 与 DOM 原型钩子实时监听界面变化，动态替换英文文本，同时严格保护代码内容不被误翻译。

## 目录结构

```
Antigravity-cn/
├── locales/
│   ├── en.json                    # 英文官方源文本基准（3340 条键值对）
│   └── zh-CN.json                 # 中文语言包（术语统一，100% 键对齐）
├── scripts/
│   ├── lib/common.js              # 公共模块：安装路径探测、进程检测、缓存位置
│   ├── i18n-bundle.js             # 自包含 DOM 翻译引擎（3340 词条内嵌，由补丁注入）
│   ├── i18n-loader.js             # 非侵入式 DOM 注入引擎
│   ├── patch.js                   # 自动备份、解包、补丁与重打包安装脚本
│   ├── restore.js                 # 一键恢复官方原版脚本
│   ├── clean-cache.js             # 缓存清理脚本（不动配置与登录状态）
│   ├── launch.js                  # 一键启动客户端脚本
│   └── audit-locales.js           # 词典审计工具（键对齐/重复键/占位符/排序）
├── apply-cn.bat                   # Windows 一键汉化
├── restore.bat                    # Windows 一键还原
├── clean-cache.bat                # Windows 一键清缓存
├── launch.bat                     # Windows 一键启动
├── 汉化使用说明.md                 # 详细使用与维护说明
└── README.md
```

## 统一术语规范（节选）

| 英文原文 | 标准中文译法 | 英文原文 | 标准中文译法 |
|---|---|---|---|
| Agent | 智能体 | Security Preset | 安全预设 |
| Artifact | 产物 | Tool Permissions | 工具权限 |
| Turbo Mode | 极速模式 | Artifact Review Policy | 产物审查策略 |
| Sandbox | 沙箱 | Queued Messages | 消息队列 |
| MCP | MCP（保留缩写） | Scheduled Tasks | 定时任务 |
| Conversation History | 对话历史 | Customizations | 自定义设置 |

完整术语表与翻译规范见 [汉化使用说明.md](汉化使用说明.md)。API、JSON、IDE、Git 等通用技术缩写及品牌名、版本号、快捷键严格保留原文。

## 版本更新与增量维护

Antigravity 发布新版本后：

1. 直接重新运行 `apply-cn.bat`，外部语言包架构使绝大部分界面文案立即自动生效。
2. 若新版出现未翻译的新词条，在 [locales/en.json](locales/en.json) 与 [locales/zh-CN.json](locales/zh-CN.json) 末尾按键值对补充新增英文词条和中文译文（保持键名 100% 对齐，废弃旧键无需删除）。
3. 运行 `node scripts/audit-locales.js` 审计词典（键对齐、重复键、占位符一致性），确认无错误。
4. 运行 `node scripts/patch.js --emit-bundle` 重新生成翻译引擎，再执行 `apply-cn.bat` 完成增量更新。

## 安全与兼容性保障

- **不破坏业务逻辑**：不修改 Go 语言服务二进制（`language_server.exe`），不触碰网络请求、身份认证与业务接口。
- **代码防篡改**：翻译范围严格限定为 UI 展示文本，自动跳过 `<pre>`、`<code>`、Monaco 编辑器与终端命令行输出。
- **安全回滚**：首次安装自动创建 `app.asar.bak` 原始备份，随时一键还原。
- **完整性校验**：解包后自动校验外部模块（chrome-devtools-mcp）完整性，异常时中止安装而非写入损坏文件。

## 已验证

- 词条：`en.json` / `zh-CN.json` 各 3340 条，JSON 语法校验通过，100% 键对齐（`audit-locales.js` 审计无错误）
- 补丁：v2.19.1 下 40/40 处全部命中（含 WSL 集成界面），注入锚点校验通过（原有补丁逻辑未变更）
- 新增工具（清缓存 / 启动 / 路径探测 / 词典审计）：逻辑与语法校验通过；扩充词条为运行时词典，不影响补丁锚点
- 平台：Windows 11 x64

## 免责声明

本项目为个人学习与交流用途的社区汉化作品，与 Google 及 Antigravity 官方无任何关联；Antigravity 及相关商标归其权利人所有。本项目仅修改本地客户端的界面显示文本，不涉及任何后端服务或网络协议修改。使用本项目产生的任何后果由使用者自行承担，请遵守 Antigravity 官方服务条款。
