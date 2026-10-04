'use strict';
/**
 * Clean Antigravity's temporary rendering / bytecode caches.
 *
 * Why: after the client updates or a localization patch is applied,
 * Chromium may keep serving stale cached UI text. Deleting only the
 * cache subdirectories under the user-data roots forces a rebuild
 * without touching user config, accounts or workspaces.
 *
 * Usage:
 *   node scripts/clean-cache.js           # clean (asks to close client if running)
 *   node scripts/clean-cache.js --force   # kill a running client first, then clean
 */
const fs = require('fs');
const path = require('path');
const { cacheRoots, CACHE_SUBDIRS, isAntigravityRunning, killAntigravity } = require('./lib/common');

function cleanCache(options = {}) {
  if (isAntigravityRunning()) {
    if (options.force) {
      console.log('检测到 Antigravity 正在运行，正在关闭后清理缓存...');
      killAntigravity();
    } else {
      console.log('提示：Antigravity 正在运行，部分缓存可能被占用而跳过。建议关闭客户端后重试，或使用 --force。');
    }
  }
  let cleaned = 0;
  let skipped = 0;
  for (const root of cacheRoots()) {
    if (!fs.existsSync(root)) continue;
    for (const sub of CACHE_SUBDIRS) {
      const target = path.join(root, sub);
      if (!fs.existsSync(target)) continue;
      try {
        fs.rmSync(target, { recursive: true, force: true });
        console.log('  [已清理] ' + target);
        cleaned++;
      } catch (e) {
        console.log('  [跳过] ' + target + '（可能被占用）');
        skipped++;
      }
    }
  }
  console.log('缓存清理完成：共清理 ' + cleaned + ' 处' + (skipped ? '，跳过 ' + skipped + ' 处' : '') + '。用户配置与登录状态不受影响。');
  return cleaned;
}

module.exports = { cleanCache };

if (require.main === module) {
  try {
    cleanCache({ force: process.argv.includes('--force') });
  } catch (err) {
    console.error('缓存清理失败:', err);
    process.exit(1);
  }
}
