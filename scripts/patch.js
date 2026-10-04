/**
 * Antigravity 界面中文化补丁 v2
 *
 * 核心特性：
 * - 幂等安全：始终从原始备份（app.asar.bak）解包后再打补丁，
 *   无论执行多少次，结果完全一致；所有替换均带
 *   「已打补丁检测（already）」与「目标缺失即抛错」双重保护，杜绝静默失败。
 * - 覆盖范围：
 *   1. 渲染层 i18n 引擎（preload.js webFrame 通道 + utils.js dom-ready 双通道注入）
 *   2. 原生应用菜单（menu.js，含 macOS 更新菜单项查找缺陷修复）
 *   3. 系统托盘（tray.js 计数 + main.js 标签）
 *   4. Dock 菜单（main.js）
 *   5. 主进程对话框：退出确认（main.js）、二进制缺失/启动失败（main.js）、
 *      打开工作区（ipcHandlers.js）、更新检查（updater.js）
 *   6. 更新器菜单状态标签（updater.js updateMenuState 枚举 → 中文映射）
 *   7. 安装向导页（ideInstall/wizardHtml.js，data: URL 页面直接替换 HTML）
 *   8. WSL 集成（wsl.js 路径转换错误/警告/状态、menu.js WSL 菜单项、provisionSplash.js 启动画面）
 *
 * 说明：v2.19.1 起 loadingOverlay.js 启动过渡层已移除文字（仅保留 SVG 动画），
 *       故不再包含加载文案补丁。
 *
 * 用法：
 *   node scripts/patch.js                          # 应用汉化补丁（多路径自动检测）
 *   node scripts/patch.js --path <安装目录>         # 手动指定安装目录
 *   node scripts/patch.js --asar <app.asar 文件>    # 直接指定 app.asar
 *   node scripts/patch.js --emit-bundle            # 仅重新生成 scripts/i18n-bundle.js
 *   node scripts/patch.js --clean-cache [--force]  # 清理客户端缓存（不动配置与登录）
 *   node scripts/patch.js --launch                 # 汉化完成后直接启动客户端
 *   node scripts/patch.js --help                   # 显示全部参数
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const common = require('./lib/common');

// ============================== 基础工具 ==============================

function findAntigravityDir(options = {}) {
  return common.findInstallDir(options);
}

function isFileLocked(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r+');
    fs.closeSync(fd);
    return false;
  } catch (e) {
    return true;
  }
}

function ensureAsarWritable(asarPath) {
  if (!isFileLocked(asarPath)) {
    console.log('app.asar 未被独占锁定，可直接进行无缝注入。');
    return;
  }
  console.log('app.asar 当前被进程锁定，正在关闭运行中的 Antigravity 客户端...');
  try {
    execSync('taskkill /F /IM Antigravity.exe', { stdio: 'ignore' });
    const start = Date.now();
    while (Date.now() - start < 2000) { /* 等待文件句柄释放 */ }
  } catch (e) { /* 进程可能已退出 */ }
}

// 补丁统计
const patchStats = { applied: 0, skipped: 0 };

/**
 * 幂等替换单元：
 * - 命中 already → 判定已打过补丁，跳过
 * - 命中 search  → 执行替换
 * - 两者皆无     → 抛错（目标缺失绝不静默放过）
 * 自动适配 CRLF / LF 行尾差异。
 */
function replaceOnce(code, label, already, search, replace) {
  if (code.includes(already)) {
    patchStats.skipped++;
    console.log(`  [跳过] ${label}（已是中文）`);
    return code;
  }
  let s = search;
  if (!code.includes(s) && s.includes('\n')) {
    const crlf = s.replace(/\n/g, '\r\n');
    if (code.includes(crlf)) s = crlf;
  }
  if (!code.includes(s)) {
    throw new Error(`补丁目标未找到：${label}`);
  }
  patchStats.applied++;
  console.log(`  [完成] ${label}`);
  return code.replace(s, replace);
}

function applyPatches(code, patches) {
  for (const p of patches) {
    code = replaceOnce(code, p.label, p.already, p.search, p.replace);
  }
  return code;
}

// ============================== i18n 引擎（自包含渲染层脚本） ==============================

function generateBundleScript(dict) {
  return `(function() {
  'use strict';
  if (window.__AGY_CN_ACTIVE__) return;
  window.__AGY_CN_ACTIVE__ = true;

  console.log('[i18n] Localization engine starting...');

  const DICT = ${JSON.stringify(dict)};
  const LOWER_DICT = {};
  for (const k in DICT) {
    LOWER_DICT[k.toLowerCase()] = DICT[k];
  }

  const REGEX_RULES = [
    { pattern: /^(\\d+)\\s+agents?\\s+running$/i, replacement: '$1 个智能体运行中' },
    { pattern: /^(\\d+)\\s+subagents?$/i, replacement: '$1 个子智能体' },
    { pattern: /^\\/\\s*(\\d+(?:\\.\\d+)?[KMGT]?)\\s+tokens?$/i, replacement: '/ $1 个 Token' },
    { pattern: /^Version\\s+([\\d\\.]+)$/i, replacement: '版本 $1' },
    { pattern: /^Delete\\s+"([^"]+)"$/i, replacement: '删除 "$1"' },
    { pattern: /^Rename\\s+"([^"]+)"$/i, replacement: '重命名 "$1"' },
    { pattern: /^(\\d+)\\s+selected$/i, replacement: '已选择 $1 项' },
    { pattern: /^(\\d+)\\s+total$/i, replacement: '共 $1 项' }
  ];

  function translate(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const str = raw.replace(/\\u00A0/g, ' ');
    const trimmed = str.trim();
    if (!trimmed || trimmed.length < 2) return null;

    const leading = str.match(/^\\s*/)[0];
    const trailing = str.match(/\\s*$/)[0];

    // 1. Direct match
    if (DICT[trimmed]) {
      return leading + DICT[trimmed] + trailing;
    }

    // 2. Case-insensitive match
    const lower = trimmed.toLowerCase();
    if (LOWER_DICT[lower]) {
      return leading + LOWER_DICT[lower] + trailing;
    }

    // 3. Trailing colon (e.g. "Security Preset:")
    if (trimmed.endsWith(':')) {
      const base = trimmed.slice(0, -1).trim();
      if (DICT[base] || LOWER_DICT[base.toLowerCase()]) {
        const trans = DICT[base] || LOWER_DICT[base.toLowerCase()];
        return leading + trans + '：' + trailing;
      }
    }

    // 4. Trailing ellipsis (e.g. "Loading...")
    if (trimmed.endsWith('...')) {
      const base = trimmed.slice(0, -3).trim();
      if (DICT[base] || LOWER_DICT[base.toLowerCase()]) {
        const trans = DICT[base] || LOWER_DICT[base.toLowerCase()];
        return leading + trans + '...' + trailing;
      }
    }

    // 5. Parentheses (e.g. "(detected)")
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      const base = trimmed.slice(1, -1).trim();
      if (DICT[base] || LOWER_DICT[base.toLowerCase()]) {
        const trans = DICT[base] || LOWER_DICT[base.toLowerCase()];
        return leading + '（' + trans + '）' + trailing;
      }
    }

    // 6. Regex rules
    for (let i = 0; i < REGEX_RULES.length; i++) {
      if (REGEX_RULES[i].pattern.test(trimmed)) {
        const res = trimmed.replace(REGEX_RULES[i].pattern, REGEX_RULES[i].replacement);
        return leading + res + trailing;
      }
    }

    return null;
  }

  function isCodeOrEditor(node) {
    if (!node) return false;
    let curr = node.nodeType === 1 ? node : node.parentElement;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      const tag = (curr.tagName || '').toLowerCase();
      if (tag === 'pre' || tag === 'code' || tag === 'textarea') return true;
      if (curr.isContentEditable) return true;
      const cls = typeof curr.className === 'string' ? curr.className : (curr.getAttribute ? curr.getAttribute('class') || '' : '');
      if (
        cls.includes('monaco-editor') ||
        cls.includes('cm-editor') ||
        cls.includes('xterm') ||
        cls.includes('font-mono') && !cls.includes('badge') ||
        cls.includes('code-block') ||
        cls.includes('prism') ||
        cls.includes('hljs')
      ) {
        return true;
      }
      curr = curr.parentElement;
    }
    return false;
  }

  // Hook Document.prototype.createTextNode
  try {
    const origCreateTextNode = Document.prototype.createTextNode;
    Document.prototype.createTextNode = function(text) {
      if (typeof text === 'string') {
        const t = translate(text);
        if (t) text = t;
      }
      return origCreateTextNode.call(this, text);
    };
  } catch (e) {}

  // Hook Node.prototype.nodeValue
  try {
    const nodeProto = Node.prototype;
    const origNodeValueDesc = Object.getOwnPropertyDescriptor(nodeProto, 'nodeValue');
    if (origNodeValueDesc && origNodeValueDesc.set) {
      const origSet = origNodeValueDesc.set;
      Object.defineProperty(nodeProto, 'nodeValue', {
        get: origNodeValueDesc.get,
        set: function(val) {
          if (typeof val === 'string' && !isCodeOrEditor(this)) {
            const t = translate(val);
            if (t) val = t;
          }
          return origSet.call(this, val);
        }
      });
    }
  } catch (e) {}

  // Hook Element.prototype.setAttribute
  try {
    const origSetAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, val) {
      if (typeof val === 'string' && (name === 'placeholder' || name === 'title' || name === 'aria-label')) {
        const t = translate(val);
        if (t) val = t;
      }
      return origSetAttribute.call(this, name, val);
    };
  } catch (e) {}

  function translateNode(node) {
    if (!node) return;
    if (node.nodeType === 3) { // Text node
      if (isCodeOrEditor(node)) return;
      const t = translate(node.nodeValue);
      if (t && t !== node.nodeValue) {
        node.nodeValue = t;
      }
      return;
    }
    if (node.nodeType === 1) { // Element node
      if (isCodeOrEditor(node)) return;
      const tag = (node.tagName || '').toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'svg' || tag === 'path') return;

      const attrs = ['placeholder', 'title', 'aria-label'];
      for (let i = 0; i < attrs.length; i++) {
        const a = attrs[i];
        const val = node.getAttribute(a);
        if (val) {
          const t = translate(val);
          if (t && t !== val) {
            node.setAttribute(a, t);
          }
        }
      }

      let child = node.firstChild;
      while (child) {
        translateNode(child);
        child = child.nextSibling;
      }
    }
  }

  let isMutating = false;
  const observer = new MutationObserver(mutations => {
    if (isMutating) return;
    isMutating = true;
    try {
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        if (m.type === 'childList') {
          for (let j = 0; j < m.addedNodes.length; j++) {
            translateNode(m.addedNodes[j]);
          }
        } else if (m.type === 'characterData') {
          translateNode(m.target);
        } else if (m.type === 'attributes') {
          if (!isCodeOrEditor(m.target)) {
            const val = m.target.getAttribute(m.attributeName);
            if (val) {
              const t = translate(val);
              if (t && t !== val) {
                m.target.setAttribute(m.attributeName, t);
              }
            }
          }
        }
      }
    } finally {
      isMutating = false;
    }
  });

  function start() {
    const root = document.documentElement || document.body;
    if (!root) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
      }
      return;
    }
    translateNode(root);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label']
    });

    window.addEventListener('click', () => {
      setTimeout(() => translateNode(document.body), 50);
      setTimeout(() => translateNode(document.body), 200);
    }, true);

    setInterval(() => {
      if (document.body) translateNode(document.body);
    }, 1500);

    console.log('[i18n] Antigravity Chinese Localization fully running.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();`;
}

// ============================== 各文件补丁定义 ==============================

// ---- main.js：主进程对话框 / Dock 菜单 / 托盘标签 ----
const MAIN_PATCHES = [
  {
    label: 'main.js · language_server 缺失提示内容',
    already: '未找到 language_server 二进制文件',
    search: 'language_server binary not found at:\\n${languageServer_1.LS_BINARY}\\n\\nPlease build set a valid location.',
    replace: '未找到 language_server 二进制文件，路径：\\n${languageServer_1.LS_BINARY}\\n\\n请构建或设置有效的文件路径。',
  },
  {
    label: 'main.js · 二进制缺失错误框标题',
    already: "showErrorBox('未找到二进制文件'",
    search: "electron_1.dialog.showErrorBox('Binary not found', msg)",
    replace: "electron_1.dialog.showErrorBox('未找到二进制文件', msg)",
  },
  {
    label: 'main.js · 启动失败错误框标题',
    already: "showErrorBox('启动失败'",
    search: "electron_1.dialog.showErrorBox('Startup failed', msg)",
    replace: "electron_1.dialog.showErrorBox('启动失败', msg)",
  },
  {
    label: 'main.js · Dock 菜单「新建窗口」',
    already: "label: '新建窗口'",
    search: "label: 'New Window',",
    replace: "label: '新建窗口',",
  },
  {
    label: 'main.js · 托盘「无运行中的智能体」',
    already: "label: '无运行中的智能体'",
    search: "label: 'No agents running'",
    replace: "label: '无运行中的智能体'",
  },
  {
    label: 'main.js · 托盘「打开 Antigravity」',
    already: "label: '打开 Antigravity'",
    search: 'label: `Open ${electron_1.app.getName()}`',
    replace: "label: '打开 Antigravity'",
  },
  {
    label: 'main.js · 托盘「退出」',
    already: "label: '退出'",
    search: "label: 'Quit'",
    replace: "label: '退出'",
  },
  {
    label: 'main.js · 退出确认对话框按钮',
    already: "buttons: ['取消', '退出'],",
    search: "buttons: ['Cancel', 'Quit'],",
    replace: "buttons: ['取消', '退出'],",
  },
  {
    label: 'main.js · 退出确认标题',
    already: "title: '确认退出',",
    search: "title: 'Confirm Quit',",
    replace: "title: '确认退出',",
  },
  {
    label: 'main.js · 退出确认正文',
    already: "message: '确定要退出吗？',",
    search: "message: 'Are you sure you want to quit?',",
    replace: "message: '确定要退出吗？',",
  },
  {
    label: 'main.js · 退出确认补充说明',
    already: "detail: '当前可能仍有智能体或后台任务正在运行。',",
    search: "detail: 'There may be agents or background tasks running.',",
    replace: "detail: '当前可能仍有智能体或后台任务正在运行。',",
  },
  {
    label: 'main.js · WSL 分发版未找到（标题）',
    already: "title: 'WSL 分发版未找到',",
    search: "title: 'WSL distro not found',",
    replace: "title: 'WSL 分发版未找到',",
  },
  {
    label: 'main.js · WSL 分发版未找到（正文）',
    already: 'WSL 分发版 "${WSL_DISTRO}" 已不再安装。',
    search: 'message: `The WSL distro "${WSL_DISTRO}" is no longer installed.`,',
    replace: 'message: `WSL 分发版 "${WSL_DISTRO}" 已不再安装。`,',
  },
  {
    label: 'main.js · WSL 分发版未找到（补充说明）',
    already: "detail: 'Antigravity 已在 Windows 上打开。',",
    search: "detail: 'Antigravity opened on Windows instead.',",
    replace: "detail: 'Antigravity 已在 Windows 上打开。',",
  },
  {
    label: 'main.js · WSL 服务器安装失败（正文）',
    already: '无法将服务器安装到 WSL 分发版 "${WSL_DISTRO}" 中：',
    search: 'const msg = `Failed to install the server into WSL distro "${WSL_DISTRO}":\\n${err.message}`;',
    replace: 'const msg = `无法将服务器安装到 WSL 分发版 "${WSL_DISTRO}" 中：\\n${err.message}`;',
  },
  {
    label: 'main.js · WSL 设置失败（错误框标题）',
    already: "showErrorBox('WSL 设置失败'",
    search: "electron_1.dialog.showErrorBox('WSL setup failed', msg)",
    replace: "electron_1.dialog.showErrorBox('WSL 设置失败', msg)",
  },
];

// ---- ipcHandlers.js：文件选择对话框标题 ----
const IPC_PATCHES = [
  {
    label: 'ipcHandlers.js · 「打开工作区」标题',
    already: "title: '打开工作区',",
    search: "title: 'Open workspace',",
    replace: "title: '打开工作区',",
  },
  {
    label: 'ipcHandlers.js · 「打开多个工作区」标题',
    already: "title: '打开多个工作区',",
    search: "title: 'Open workspaces',",
    replace: "title: '打开多个工作区',",
  },
  {
    label: 'ipcHandlers.js · 「无法打开文件夹」标题',
    already: "showErrorBox('无法打开文件夹'",
    search: "electron_1.dialog.showErrorBox('Cannot open folder', t.error);",
    replace: "electron_1.dialog.showErrorBox('无法打开文件夹', t.error);",
  },
  {
    label: 'ipcHandlers.js · 「文件夹位于 Windows 文件系统」提示',
    already: "message: '文件夹位于 Windows 文件系统上',",
    search: "message: 'Folder is on the Windows filesystem',",
    replace: "message: '文件夹位于 Windows 文件系统上',",
  },
];

// ---- updater.js：更新检查对话框 + 菜单状态标签映射 ----
const UPDATER_PATCHES = [
  {
    label: 'updater.js · 更新检查对话框标题',
    already: "title: '检查更新',",
    search: "title: 'Check for Updates',",
    replace: "title: '检查更新',",
  },
  {
    label: 'updater.js · 「当前已是最新版本」提示',
    already: "message: '当前已是最新版本',",
    search: "message: 'No updates available',",
    replace: "message: '当前已是最新版本',",
  },
  {
    label: 'updater.js · 对话框「确定」按钮',
    already: "buttons: ['确定'],",
    search: "buttons: ['OK'],",
    replace: "buttons: ['确定'],",
  },
  {
    // 原生缺陷修复：updateMenuState 会用英文枚举覆盖菜单标签，
    // 此处改为「枚举 → 中文」映射，避免中文菜单被回写为英文。
    label: 'updater.js · 菜单状态标签中文映射',
    already: '})[step] || step;',
    search: 'item.label = step;',
    replace: "item.label = ({ 'Check for Updates': '检查更新', 'Checking for Updates...': '正在检查更新...', 'Downloading Update...': '正在下载更新...', 'Restart to Update': '重启并更新' })[step] || step;",
  },
];

// ---- menu.js：macOS 更新动作查找修复（单独处理） ----
const MENU_LOOKUP_FIX = {
  label: 'menu.js · 更新动作中文标签反查修复',
  already: "'检查更新': 'Check for Updates'",
  search: 'const action = updater_1.updateActions[menuItem.label];',
  replace:
    "const action = updater_1.updateActions[({ '检查更新': 'Check for Updates', '正在检查更新...': 'Checking for Updates...', '正在下载更新...': 'Downloading Update...', '重启并更新': 'Restart to Update' })[menuItem.label] || menuItem.label];",
};

// ---- menu.js：原生菜单汉化注入块（插到 setApplicationMenu 之前） ----
const MENU_LOCALIZE_BLOCK = `    // __AGY_CN_MENU__ 原生应用菜单汉化
    const __agyMenuDict = {
      'File': '文件',
      'Edit': '编辑',
      'View': '查看',
      'Go': '跳转',
      'Window': '窗口',
      'Help': '帮助',
      'New Window': '新建窗口',
      'Close Window': '关闭窗口',
      'Undo': '撤销',
      'Redo': '重做',
      'Cut': '剪切',
      'Copy': '复制',
      'Paste': '粘贴',
      'Paste and Match Style': '粘贴并匹配样式',
      'Delete': '删除',
      'Select All': '全选',
      'Reload': '重新加载',
      'Force Reload': '强制重新加载',
      'Toggle Developer Tools': '切换开发者工具',
      'Actual Size': '实际大小',
      'Reset Zoom': '重置缩放',
      'Zoom In': '放大',
      'Zoom Out': '缩小',
      'Toggle Full Screen': '切换全屏',
      'Minimize': '最小化',
      'Zoom': '缩放',
      'Bring All to Front': '全部置前',
      'Close': '关闭',
      'Quit': '退出',
      'Exit': '退出',
      'Services': '服务',
      'Hide': '隐藏',
      'Hide Others': '隐藏其他',
      'Show All': '显示全部',
      'Docs': '文档',
      'Documentation': '官方文档',
      'Check for Updates': '检查更新',
      'Checking for Updates...': '正在检查更新...',
      'Checking for Updates': '正在检查更新',
      'Downloading Update...': '正在下载更新...',
      'Downloading Update': '正在下载更新',
      'Restart to Update': '重启并更新',
      'Up to Date': '已是最新版本',
      'About Antigravity': '关于 Antigravity',
      'Connect to WSL': '连接到 WSL',
      'Reopen Locally': '在本机重新打开'
    };
    function __agyLocalizeMenu(m) {
      if (!m || !m.items) return;
      m.items.forEach(function (it) {
        if (it.label && __agyMenuDict[it.label]) {
          it.label = __agyMenuDict[it.label];
        }
        if (it.submenu) {
          __agyLocalizeMenu(it.submenu);
        }
      });
    }
    __agyLocalizeMenu(menu);
    // __AGY_CN_MENU_END__
`;

// ---- tray.js：托盘智能体计数文案（多行精确匹配） ----
const TRAY_PATCH = {
  label: 'tray.js · 托盘智能体计数文案',
  already: '个智能体运行中',
  search:
    "            countItem.label =\n" +
    "                (count > 0 ? `${count}` : 'No') +\n" +
    "                    ' agent' +\n" +
    "                    (count === 1 ? '' : 's') +\n" +
    "                    ' running';",
  replace: "            countItem.label = count > 0 ? `${count} 个智能体运行中` : '无运行中的智能体';",
};

// ---- ideInstall/wizardHtml.js：安装向导页（data: URL 页面，直接替换 HTML） ----
const WIZARD_PATCHES = [
  {
    label: 'wizardHtml.js · 页面标题',
    already: '<title>欢迎使用 Antigravity</title>',
    search: '<title>Welcome to Antigravity</title>',
    replace: '<title>欢迎使用 Antigravity</title>',
  },
  {
    label: 'wizardHtml.js · 「正在初始化」过渡文案',
    already: '>正在初始化…<',
    search: '>Setting up…<',
    replace: '>正在初始化…<',
  },
  {
    label: 'wizardHtml.js · 欢迎标题',
    already: '<h1>欢迎使用全新 Antigravity！</h1>',
    search: '<h1>Welcome to the new Antigravity!</h1>',
    replace: '<h1>欢迎使用全新 Antigravity！</h1>',
  },
  {
    label: 'wizardHtml.js · 改版说明段落',
    already: 'Antigravity 已全新改版，以智能体为核心',
    search:
      "Antigravity has been redesigned to put agents first with new capabilities. If you'd still like a code editor, you can download it as a separate app named <b>Antigravity IDE</b>.",
    replace: 'Antigravity 已全新改版，以智能体为核心并带来全新能力。如果你仍需要代码编辑器，可以下载独立应用 <b>Antigravity IDE</b>。',
  },
  {
    label: 'wizardHtml.js · IDE 下载复选框',
    already: '<span>下载 Antigravity IDE</span>',
    search: '<span>Download the Antigravity IDE</span>',
    replace: '<span>下载 Antigravity IDE</span>',
  },
  {
    label: 'wizardHtml.js · 「探索全新 Antigravity」按钮',
    already: '>探索全新 Antigravity</button>',
    search: '>Explore the new Antigravity</button>',
    replace: '>探索全新 Antigravity</button>',
  },
];

// ---- menu.js：WSL 菜单项（异步添加，绕过本地化函数，需直接替换源码） ----
const MENU_WSL_PATCHES = [
  {
    label: 'menu.js · 「连接到 WSL」菜单项',
    already: "label: '连接到 WSL'",
    search: "return { label: 'Connect to WSL', submenu };",
    replace: "return { label: '连接到 WSL', submenu };",
  },
  {
    label: 'menu.js · 「在本机重新打开」菜单项',
    already: "label: '在本机重新打开'",
    search: "return { label: 'Reopen Locally', click: () => relaunchWithWslDistro('') };",
    replace: "return { label: '在本机重新打开', click: () => relaunchWithWslDistro('') };",
  },
];

// ---- wsl.js：路径转换错误 / 警告 / 启动画面状态文案 ----
const WSL_PATCHES = [
  {
    label: 'wsl.js · 路径属于其他分发版（错误）',
    already: '此文件夹属于 WSL 分发版',
    search: 'error: `This folder belongs to the WSL distro "${unc[1]}", but this window is connected to "${distro}".`,',
    replace: 'error: `此文件夹属于 WSL 分发版 "${unc[1]}"，但当前窗口连接的是 "${distro}"。`,',
  },
  {
    label: 'wsl.js · 无法在 WSL 中打开的位置（错误）',
    already: '无法在 WSL 中打开此位置',
    search: 'return { error: `This location cannot be opened in WSL: ${winPath}` };',
    replace: 'return { error: `无法在 WSL 中打开此位置：${winPath}` };',
  },
  {
    label: 'wsl.js · Windows 文件系统访问警告',
    already: '此文件夹位于 Windows 文件系统上。',
    search:
      "warning: 'This folder is on the Windows filesystem. Accessing it from WSL (via /mnt) can be slow — for best performance keep projects inside the WSL filesystem.',",
    replace:
      "warning: '此文件夹位于 Windows 文件系统上。从 WSL（通过 /mnt）访问它可能会较慢 — 为获得最佳性能，请将项目放在 WSL 文件系统内。',",
  },
  {
    label: 'wsl.js · 下载服务器二进制状态',
    already: '正在下载 Antigravity 二进制文件',
    search: "onStatus?.('Downloading the Antigravity binary\\u2026');",
    replace: "onStatus?.('正在下载 Antigravity 二进制文件…');",
  },
  {
    label: 'wsl.js · 安装服务器状态',
    already: '正在安装到',
    search: 'onStatus?.(`Installing into ${distro}\\u2026`);',
    replace: 'onStatus?.(`正在安装到 ${distro}…`);',
  },
];

// ---- provisionSplash.js：WSL 启动画面（data: URL 页面，直接替换 HTML） ----
const PROVISION_PATCH = {
  label: 'provisionSplash.js · 「正在设置 WSL」文案',
  already: '正在设置 WSL：',
  search: '<div>Setting up WSL: ${escapeHtml(distro)}</div>',
  replace: '<div>正在设置 WSL：${escapeHtml(distro)}</div>',
};

// ============================== 补丁执行 ==============================

function patchPreload(preloadPath, bundleContent) {
  let code = fs.readFileSync(preloadPath, 'utf-8');
  if (code.includes('__AGY_CN_PRELOAD__')) {
    console.log('  [跳过] preload.js 渲染层注入（已存在）');
    return;
  }
  console.log('  [完成] preload.js 渲染层注入（webFrame 通道，覆盖全部 iframe）');
  const injectSnippet = `
// --- __AGY_CN_PRELOAD__ [Antigravity i18n Chinese Localization Injection] ---
try {
  const { webFrame } = electron_1;
  const __AGY_CN_SCRIPT__ = ${JSON.stringify(bundleContent)};
  if (webFrame && webFrame.executeJavaScript) {
    webFrame.executeJavaScript(__AGY_CN_SCRIPT__);
  }
} catch (err) {
  console.error('[i18n] Preload injection error:', err);
}
// --- __AGY_CN_PRELOAD__ End ---
`;
  code = code + '\n' + injectSnippet;
  fs.writeFileSync(preloadPath, code, 'utf-8');
}

function patchUtils(utilsPath) {
  let code = fs.readFileSync(utilsPath, 'utf-8');
  if (code.includes('__AGY_UTILS_INJECT__')) {
    console.log('  [跳过] utils.js 主进程注入（已存在）');
    return;
  }
  const targetHook = 'win.webContents.setWindowOpenHandler';
  if (!code.includes(targetHook)) {
    throw new Error('补丁目标未找到：utils.js setWindowOpenHandler 锚点');
  }
  console.log('  [完成] utils.js 主进程注入通道（dom-ready / did-finish-load）');
  const utilsInjection = `
    // __AGY_UTILS_INJECT__
    win.webContents.on('console-message', (_event, _level, message) => {
      console.log('[Renderer]', message);
    });
    try {
      const _i18nPath = path_1.default.join(__dirname, 'i18n-bundle.js');
      if (fs.existsSync(_i18nPath)) {
        const _i18nScript = fs.readFileSync(_i18nPath, 'utf-8');
        win.webContents.on('dom-ready', () => {
          void win.webContents.executeJavaScript(_i18nScript);
        });
        win.webContents.on('did-finish-load', () => {
          void win.webContents.executeJavaScript(_i18nScript);
        });
      }
    } catch (_err) {
      console.error('[i18n] utils injection failed:', _err);
    }
    // __AGY_UTILS_INJECT_END__
    win.webContents.setWindowOpenHandler`;
  code = code.replace(targetHook, utilsInjection);
  if (!code.includes('__AGY_UTILS_INJECT__')) {
    throw new Error('utils.js 注入后校验失败');
  }
  fs.writeFileSync(utilsPath, code, 'utf-8');
}

function patchMenu(menuPath) {
  let code = fs.readFileSync(menuPath, 'utf-8');
  console.log('正在汉化应用主菜单 (menu.js)...');

  // 1) 修复 macOS 更新动作按标签查找的缺陷（标签汉化后反查英文枚举）
  code = replaceOnce(code, MENU_LOOKUP_FIX.label, MENU_LOOKUP_FIX.already, MENU_LOOKUP_FIX.search, MENU_LOOKUP_FIX.replace);

  // 2) 注入菜单标签汉化块（带标记防重复）
  if (code.includes('__AGY_CN_MENU__')) {
    console.log('  [跳过] menu.js 菜单汉化注入（已存在）');
  } else {
    const anchor = 'electron_1.Menu.setApplicationMenu(menu);';
    if (!code.includes(anchor)) {
      throw new Error('补丁目标未找到：menu.js setApplicationMenu 锚点');
    }
    code = code.replace(anchor, MENU_LOCALIZE_BLOCK + '    ' + anchor);
    if (!code.includes('__AGY_CN_MENU__')) {
      throw new Error('menu.js 菜单汉化注入后校验失败');
    }
    console.log('  [完成] menu.js 菜单汉化注入（一级 + 全量二级菜单）');
  }

  // 3) WSL 菜单项异步添加，绕过本地化函数，需直接替换源码
  code = applyPatches(code, MENU_WSL_PATCHES);

  fs.writeFileSync(menuPath, code, 'utf-8');
}

// ============================== 主流程 ==============================

function applyPatch(options = {}) {
  const appDir = findAntigravityDir(options);
  const resourcesDir = path.join(appDir, 'resources');
  const asarPath = path.join(resourcesDir, 'app.asar');
  const backupPath = path.join(resourcesDir, 'app.asar.bak');

  console.log('=== Antigravity 界面中文化补丁 v2 ===');
  console.log(`目标路径: ${appDir}`);

  if (common.isAntigravityRunning()) {
    console.log('检测到 Antigravity 客户端正在运行。');
  }
  ensureAsarWritable(asarPath);

  // Step 1: 首次运行时创建原始备份
  if (!fs.existsSync(backupPath)) {
    console.log(`创建原始备份: ${backupPath}`);
    fs.copyFileSync(asarPath, backupPath);
    console.log('备份完成。');
  } else {
    console.log(`检测到已存在原始备份: ${backupPath}`);
  }

  // Step 2: 始终从原始备份解包 → 补丁永远作用于纯净源码，天然幂等
  const sourceAsar = fs.existsSync(backupPath) ? backupPath : asarPath;
  const tempExtractDir = path.join(__dirname, '..', '.tmp_extracted_asar');
  if (fs.existsSync(tempExtractDir)) {
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
  }
  // 关键修正：@electron/asar 对头部标记为 unpacked 的文件会从「包路径 + .unpacked」
  // 兄弟目录读取真实内容。原始安装约 293 个外部文件（chrome-devtools-mcp 等，
  // 约 16.8 MB）位于 resources/app.asar.unpacked；而源包名为 app.asar.bak 时，
  // 其兄弟目录 app.asar.bak.unpacked 并不存在，直接解包会 ENOENT 失败且文件缺失，
  // 重打包后将导致 MCP 功能损坏。
  // 因此：先将源包复制为暂存区内的 app.asar，并用 junction 关联真实 unpacked 目录。
  const stageDir = path.join(__dirname, '..', '.tmp_asar_stage');
  if (fs.existsSync(stageDir)) {
    fs.rmSync(stageDir, { recursive: true, force: true });
  }
  fs.mkdirSync(stageDir, { recursive: true });
  const stagedAsar = path.join(stageDir, 'app.asar');
  fs.copyFileSync(sourceAsar, stagedAsar);
  const realUnpackedDir = asarPath + '.unpacked'; // 原始外部文件目录（原始包与备份内容一致）
  if (fs.existsSync(realUnpackedDir)) {
    const stagedUnpacked = path.join(stageDir, 'app.asar.unpacked');
    try {
      fs.symlinkSync(realUnpackedDir, stagedUnpacked, 'junction');
    } catch (_) {
      // 无权限建立 junction 时退化为完整复制
      fs.cpSync(realUnpackedDir, stagedUnpacked, { recursive: true });
    }
  }
  console.log(`正在解包 ${path.basename(sourceAsar)}（已关联外部文件目录）...`);
  execSync(`npx --yes @electron/asar extract "${stagedAsar}" "${tempExtractDir}"`, {
    stdio: 'inherit'
  });
  // 完整性校验：外部文件（chrome-devtools-mcp 等）必须成功进入解包树
  const mcpManifest = path.join(tempExtractDir, 'node_modules', 'chrome-devtools-mcp', 'package.json');
  if (!fs.existsSync(mcpManifest)) {
    throw new Error('解包不完整：node_modules/chrome-devtools-mcp 缺失（外部文件目录关联失败），已中止以防止损坏安装。');
  }

  // Step 3: 注入语言包与自包含 i18n 引擎
  console.log('正在注入汉化资源文件...');
  const zhSource = path.join(__dirname, '..', 'locales', 'zh-CN.json');
  let zhData;
  try {
    zhData = JSON.parse(fs.readFileSync(zhSource, 'utf-8'));
  } catch (e) {
    throw new Error(`zh-CN.json 语法错误，请先修复后再打补丁：${e.message}`);
  }
  const localesTargetDir = path.join(tempExtractDir, 'locales');
  fs.mkdirSync(localesTargetDir, { recursive: true });
  fs.copyFileSync(zhSource, path.join(localesTargetDir, 'zh-CN.json'));

  const bundleContent = generateBundleScript(zhData);
  fs.writeFileSync(path.join(tempExtractDir, 'dist', 'i18n-bundle.js'), bundleContent, 'utf-8');
  console.log(`  i18n 词典已嵌入（${Object.keys(zhData).length} 条）。`);

  const distDir = path.join(tempExtractDir, 'dist');

  // Step 4: preload.js —— 渲染层 webFrame 注入（含全部 iframe）
  const preloadPath = path.join(distDir, 'preload.js');
  if (!fs.existsSync(preloadPath)) throw new Error('未找到 dist/preload.js');
  patchPreload(preloadPath, bundleContent);

  // Step 5: utils.js —— 主进程 dom-ready 注入通道
  const utilsPath = path.join(distDir, 'utils.js');
  if (!fs.existsSync(utilsPath)) throw new Error('未找到 dist/utils.js');
  patchUtils(utilsPath);

  // Step 6: menu.js —— 原生菜单
  const menuPath = path.join(distDir, 'menu.js');
  if (!fs.existsSync(menuPath)) throw new Error('未找到 dist/menu.js');
  patchMenu(menuPath);

  // Step 7: tray.js —— 托盘计数
  const trayPath = path.join(distDir, 'tray.js');
  if (fs.existsSync(trayPath)) {
    console.log('正在汉化系统托盘 (tray.js)...');
    let trayCode = fs.readFileSync(trayPath, 'utf-8');
    trayCode = replaceOnce(trayCode, TRAY_PATCH.label, TRAY_PATCH.already, TRAY_PATCH.search, TRAY_PATCH.replace);
    fs.writeFileSync(trayPath, trayCode, 'utf-8');
  }

  // Step 8: main.js —— 对话框 / Dock 菜单 / 托盘标签
  const mainPath = path.join(distDir, 'main.js');
  if (!fs.existsSync(mainPath)) throw new Error('未找到 dist/main.js');
  console.log('正在汉化主进程对话框与菜单标签 (main.js)...');
  let mainCode = fs.readFileSync(mainPath, 'utf-8');
  mainCode = applyPatches(mainCode, MAIN_PATCHES);
  fs.writeFileSync(mainPath, mainCode, 'utf-8');

  // Step 9: ipcHandlers.js —— 工作区选择对话框
  const ipcPath = path.join(distDir, 'ipcHandlers.js');
  if (!fs.existsSync(ipcPath)) throw new Error('未找到 dist/ipcHandlers.js');
  console.log('正在汉化工作区对话框 (ipcHandlers.js)...');
  let ipcCode = fs.readFileSync(ipcPath, 'utf-8');
  ipcCode = applyPatches(ipcCode, IPC_PATCHES);
  fs.writeFileSync(ipcPath, ipcCode, 'utf-8');

  // Step 10: updater.js —— 更新对话框 + 菜单状态标签
  const updaterPath = path.join(distDir, 'updater.js');
  if (!fs.existsSync(updaterPath)) throw new Error('未找到 dist/updater.js');
  console.log('正在汉化更新器 (updater.js)...');
  let updaterCode = fs.readFileSync(updaterPath, 'utf-8');
  updaterCode = applyPatches(updaterCode, UPDATER_PATCHES);
  fs.writeFileSync(updaterPath, updaterCode, 'utf-8');

  // Step 11: ideInstall/wizardHtml.js —— 安装向导页（data: URL 页面需直接替换 HTML）
  const wizardPath = path.join(distDir, 'ideInstall', 'wizardHtml.js');
  if (fs.existsSync(wizardPath)) {
    console.log('正在汉化安装向导页 (wizardHtml.js)...');
    let wizardCode = fs.readFileSync(wizardPath, 'utf-8');
    wizardCode = applyPatches(wizardCode, WIZARD_PATCHES);
    fs.writeFileSync(wizardPath, wizardCode, 'utf-8');
  }

  // Step 12: wsl.js —— WSL 路径转换错误 / 警告 / 启动画面状态
  const wslPath = path.join(distDir, 'wsl.js');
  if (fs.existsSync(wslPath)) {
    console.log('正在汉化 WSL 集成文案 (wsl.js)...');
    let wslCode = fs.readFileSync(wslPath, 'utf-8');
    wslCode = applyPatches(wslCode, WSL_PATCHES);
    fs.writeFileSync(wslPath, wslCode, 'utf-8');
  }

  // Step 13: provisionSplash.js —— WSL 启动画面（data: URL 页面，直接替换 HTML）
  const splashPath = path.join(distDir, 'provisionSplash.js');
  if (fs.existsSync(splashPath)) {
    console.log('正在汉化 WSL 启动画面 (provisionSplash.js)...');
    let splashCode = fs.readFileSync(splashPath, 'utf-8');
    splashCode = replaceOnce(splashCode, PROVISION_PATCH.label, PROVISION_PATCH.already, PROVISION_PATCH.search, PROVISION_PATCH.replace);
    fs.writeFileSync(splashPath, splashCode, 'utf-8');
  }

  console.log(`补丁统计：本次应用 ${patchStats.applied} 处，跳过（已是中文）${patchStats.skipped} 处。`);

  // Step 14: 重新打包并安装
  const patchedAsarTemp = path.join(__dirname, '..', 'app.asar.patched');
  if (fs.existsSync(patchedAsarTemp)) {
    fs.unlinkSync(patchedAsarTemp); // 清理上次失败的残留
  }
  console.log('正在重新打包 app.asar（外部文件全量内联，与官方运行结构等效）...');
  execSync(`npx --yes @electron/asar pack "${tempExtractDir}" "${patchedAsarTemp}"`, {
    stdio: 'inherit'
  });

  console.log('正在安装中文化补丁...');
  fs.copyFileSync(patchedAsarTemp, asarPath);
  fs.unlinkSync(patchedAsarTemp);

  // 清理临时解包目录与暂存区（junction 仅移除链接本身，不影响真实目录）
  fs.rmSync(tempExtractDir, { recursive: true, force: true });
  fs.rmSync(stageDir, { recursive: true, force: true });

  console.log('============================================');
  console.log(' Antigravity 界面中文化补丁安装成功！');
  console.log(' 如需恢复官方英文原版，请随时运行 restore.bat');
  console.log('============================================');
}

// 仅重新生成 scripts/i18n-bundle.js（语言包更新后使用）
function emitBundle() {
  const zhSource = path.join(__dirname, '..', 'locales', 'zh-CN.json');
  const zhData = JSON.parse(fs.readFileSync(zhSource, 'utf-8'));
  const outPath = path.join(__dirname, 'i18n-bundle.js');
  fs.writeFileSync(outPath, generateBundleScript(zhData), 'utf-8');
  console.log(`已生成独立 i18n-bundle.js（${Object.keys(zhData).length} 条词典）: ${outPath}`);
}

// ============================== 入口 ==============================

const HELP_TEXT = [
  'Antigravity 界面中文化补丁',
  '',
  '用法：',
  '  node scripts/patch.js                          应用汉化（多路径自动检测）',
  '  node scripts/patch.js --path <安装目录>         指定安装目录',
  '  node scripts/patch.js --asar <app.asar 文件>    直接指定 app.asar',
  '  node scripts/patch.js --launch                 汉化成功后直接启动客户端',
  '  node scripts/patch.js --clean-cache [--force]  只清理缓存（--force 会先关闭客户端）',
  '  node scripts/patch.js --emit-bundle            仅重新生成 i18n-bundle.js',
  '  node scripts/patch.js --help                   显示本帮助',
  '',
  '也可设置环境变量 ANTIGRAVITY_PATH 指定安装目录。',
].join('\n');

function parseArgs(argv) {
  const opts = { launch: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--path' && argv[i + 1]) opts.path = argv[++i];
    else if (argv[i] === '--asar' && argv[i + 1]) opts.path = argv[++i];
    else if (argv[i] === '--launch') opts.launch = true;
  }
  return opts;
}

module.exports = { generateBundleScript, applyPatch, emitBundle };

if (require.main === module) {
  const argv = process.argv.slice(2);
  try {
    if (argv.includes('--help') || argv.includes('-h')) {
      console.log(HELP_TEXT);
    } else if (argv.includes('--emit-bundle')) {
      emitBundle();
    } else if (argv.includes('--clean-cache')) {
      require('./clean-cache').cleanCache({ force: argv.includes('--force') });
    } else {
      const opts = parseArgs(argv);
      applyPatch(opts);
      if (opts.launch) {
        require('./launch').launchAntigravity(opts);
      }
    }
  } catch (error) {
    console.error('汉化补丁执行失败:', error);
    process.exit(1);
  }
}
