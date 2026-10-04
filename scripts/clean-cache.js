/**
 * Antigravity 缓存清理工具
 *
 * 仅清理 Electron / Chromium 的缓存类目录，绝不触碰登录态与用户数据
 * （Local Storage、IndexedDB、Cookies、Preferences、Network 等一律保留）。
 *
 * 用法：
 *   node scripts/clean-cache.js            # 清理缓存
 *   node scripts/clean-cache.js --dry-run  # 仅预览，不删除
 *   node scripts/clean-cache.js --force    # 客户端运行中也强制清理
 *   node scripts/clean-cache.js --user-data "D:\\自定义\\Antigravity"
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { hasFlag } = require('./lib/app-path');

// 仅清理以下缓存类目录（相对 userData 根）
const CACHE_DIRS = [
  'Cache',
  'Code Cache',
  'GPUCache',
  'DawnCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'ShaderCache',
  'GrShaderCache',
  'GraphiteDawnCache',
  'CacheStorage',
  'blob_storage',
  'logs',
  'Crashpad',
  'component_crx_cache',
  'extensions_crx_cache',
  path.join('Service Worker', 'CacheStorage'),
  path.join('Service Worker', 'ScriptCache'),
];

function parseUserDataArg(argv) {
  const args = argv || process.argv.slice(2);
  const i = args.indexOf('--user-data');
  if (i !== -1 && args[i + 1]) return args[i + 1];
  const eq = args.find((a) => a.startsWith('--user-data='));
  if (eq) return eq.slice('--user-data='.length);
  return null;
}

function findUserDataDir() {
  const cli = parseUserDataArg();
  if (cli) return path.resolve(cli);
  const appData = process.env.APPDATA;
  if (!appData) throw new Error('未找到 APPDATA 环境变量。');
  const candidates = ['Antigravity', 'antigravity'];
  for (const name of candidates) {
    const dir = path.join(appData, name);
    if (fs.existsSync(dir)) return dir;
  }
  return path.join(appData, 'Antigravity');
}

function isAntigravityRunning() {
  try {
    const out = execSync('tasklist /FI "IMAGENAME eq Antigravity.exe" /NH', { encoding: 'utf-8' });
    return out.includes('Antigravity.exe');
  } catch (_) {
    return false;
  }
}

function dirSize(dir) {
  let total = 0;
  let stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        stack.push(full);
      } else {
        try { total += fs.statSync(full).size; } catch (_) { /* 忽略单个文件异常 */ }
      }
    }
  }
  return total;
}

function human(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

function cleanCache() {
  const dryRun = hasFlag('--dry-run');
  const force = hasFlag('--force');
  const userData = findUserDataDir();

  console.log('=== Antigravity 缓存清理工具 ===');
  console.log(`用户数据目录: ${userData}`);
  console.log(dryRun ? '模式: 预览（不删除）' : '模式: 清理');

  if (!fs.existsSync(userData)) {
    console.error(`未找到用户数据目录：${userData}`);
    process.exit(1);
  }

  if (isAntigravityRunning() && !force && !dryRun) {
    console.error('\n检测到 Antigravity 正在运行，缓存文件可能被占用。');
    console.error('请先关闭客户端，或使用 --force 强制清理。');
    process.exit(1);
  }

  let freed = 0;
  let cleaned = 0;
  const skipped = [];

  console.log('\n清理项:');
  for (const rel of CACHE_DIRS) {
    const target = path.join(userData, rel);
    if (!fs.existsSync(target)) continue;
    const size = dirSize(target);
    if (dryRun) {
      console.log(`  [预览] ${rel}  ${human(size)}`);
      freed += size;
      cleaned++;
      continue;
    }
    try {
      fs.rmSync(target, { recursive: true, force: true });
      console.log(`  [已清理] ${rel}  ${human(size)}`);
      freed += size;
      cleaned++;
    } catch (e) {
      console.log(`  [跳过] ${rel}（被占用或权限不足）`);
      skipped.push(rel);
    }
  }

  console.log('\n--------------------------------------------');
  if (cleaned === 0) {
    console.log('未发现可清理的缓存目录，环境已很干净。');
  } else {
    console.log(`${dryRun ? '可释放' : '已释放'}空间：${human(freed)}（${cleaned} 项）`);
  }
  if (skipped.length) {
    console.log(`跳过 ${skipped.length} 项（建议关闭客户端后重试）：${skipped.join('、')}`);
  }
  console.log('用户登录态与个人设置未被改动。');
}

try {
  cleanCache();
} catch (err) {
  console.error('缓存清理失败:', err.message);
  process.exit(1);
}