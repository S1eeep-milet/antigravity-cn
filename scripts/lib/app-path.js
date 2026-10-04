/**
 * Antigravity 安装路径解析（多路径探测 + 自定义路径）
 *
 * 解析优先级（由高到低）：
 *   1. 命令行参数  --path <目录>
 *   2. 环境变量    ANTIGRAVITY_DIR
 *   3. 配置文件    <项目根>/antigravity-path.txt（首行路径，支持 # 注释）
 *   4. 常见安装位置自动探测（多路径扫描）
 *
 * 被 patch.js / restore.js / launch.js 共用。
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const CONFIG_FILE = path.join(PROJECT_ROOT, 'antigravity-path.txt');

/** 目录是否为有效安装（含 resources/app.asar） */
function isValidInstall(dir) {
  return !!dir && fs.existsSync(path.join(dir, 'resources', 'app.asar'));
}

/** 常见安装位置候选列表 */
function candidateDirs() {
  const list = [];
  const push = (p) => { if (p) list.push(p); };
  const la = process.env.LOCALAPPDATA;
  const pf = process.env.ProgramFiles;
  const pf86 = process.env['ProgramFiles(x86)'];
  const pw = process.env.ProgramW6432;

  push(la && path.join(la, 'Programs', 'antigravity'));
  push(la && path.join(la, 'Programs', 'Antigravity'));
  push(la && path.join(la, 'Antigravity'));
  push(pf && path.join(pf, 'Antigravity'));
  push(pf86 && path.join(pf86, 'Antigravity'));
  push(pw && path.join(pw, 'Antigravity'));
  push(process.env.USERPROFILE && path.join(process.env.USERPROFILE, 'Antigravity'));
  push('C:\\Antigravity');
  return list;
}

/** 读取配置文件中的自定义路径（不存在则返回 null） */
function readConfigPath() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return null;
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (t && !t.startsWith('#')) return t;
    }
  } catch (_) { /* 忽略读取异常 */ }
  return null;
}

/** Windows 路径大小写不敏感，统一用小写做去重键 */
function normKey(dir) {
  const resolved = path.resolve(dir);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

/** 扫描全部有效安装目录（去重，自定义路径优先） */
function findAllInstalls() {
  const seen = new Set();
  const found = [];
  const add = (dir) => {
    const key = normKey(dir);
    if (seen.has(key) || !isValidInstall(dir)) return;
    seen.add(key);
    found.push(path.resolve(dir));
  };
  const cfg = readConfigPath();
  if (cfg) add(cfg);
  for (const dir of candidateDirs()) add(dir);
  return found;
}

/** 从 argv 中解析 --path / --path= 参数 */
function parsePathArg(argv) {
  const args = argv || process.argv.slice(2);
  const i = args.indexOf('--path');
  if (i !== -1 && args[i + 1]) return args[i + 1];
  const eq = args.find((a) => a.startsWith('--path='));
  if (eq) return eq.slice('--path='.length);
  return null;
}

/** argv 中是否包含某个开关 */
function hasFlag(name, argv) {
  const args = argv || process.argv.slice(2);
  return args.includes(name);
}

/**
 * 解析出唯一的 Antigravity 安装目录。
 * @param {string|null} cliPath 命令行 --path 传入的路径
 * @returns {string} 安装根目录
 */
function resolveAppDir(cliPath) {
  if (cliPath) {
    const p = path.resolve(cliPath);
    if (!isValidInstall(p)) {
      throw new Error(`--path 指定的目录无效（未找到 resources/app.asar）：${p}`);
    }
    return p;
  }

  const envDir = process.env.ANTIGRAVITY_DIR;
  if (envDir) {
    const p = path.resolve(envDir);
    if (!isValidInstall(p)) {
      throw new Error(`环境变量 ANTIGRAVITY_DIR 指向的目录无效：${p}`);
    }
    return p;
  }

  const cfg = readConfigPath();
  if (cfg) {
    const p = path.resolve(cfg);
    if (isValidInstall(p)) return p;
    console.warn(`[警告] 配置文件 antigravity-path.txt 中的路径无效，已忽略：${p}`);
  }

  const all = findAllInstalls();
  if (all.length === 0) {
    throw new Error(
      '未找到 Antigravity 安装目录。\n' +
      '  可用方式指定：\n' +
      '    1) node scripts/patch.js --path "D:\\你的\\Antigravity"\n' +
      '    2) 设置环境变量 ANTIGRAVITY_DIR\n' +
      '    3) 在项目根目录创建 antigravity-path.txt，首行写入安装目录'
    );
  }
  return all[0];
}

module.exports = {
  PROJECT_ROOT,
  CONFIG_FILE,
  isValidInstall,
  candidateDirs,
  readConfigPath,
  findAllInstalls,
  parsePathArg,
  hasFlag,
  resolveAppDir,
};