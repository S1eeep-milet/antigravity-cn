'use strict';
/**
 * Antigravity Restore Script
 *
 * Restores the original official app.asar from app.asar.bak.
 * Usage:
 *   node scripts/restore.js [--path <install dir>|--asar <app.asar file>]
 */

const fs = require('fs');
const path = require('path');
const common = require('./lib/common');

function restoreOriginal(options = {}) {
  const appDir = common.findInstallDir(options);
  const resourcesDir = path.join(appDir, 'resources');
  const asarPath = path.join(resourcesDir, 'app.asar');
  const backupPath = path.join(resourcesDir, 'app.asar.bak');

  console.log('=== Antigravity 官方原版还原工具 ===');
  console.log(`目标路径: ${appDir}`);

  if (!fs.existsSync(backupPath)) {
    console.error('未找到备份文件 app.asar.bak，无法还原！');
    process.exit(1);
  }

  if (common.isAntigravityRunning()) {
    console.log('正在关闭正在运行的 Antigravity 客户端...');
    common.killAntigravity();
    console.log('Antigravity 进程已退出。');
  }

  console.log('正在从备份还原 app.asar...');
  fs.copyFileSync(backupPath, asarPath);

  console.log('============================================');
  console.log(' Antigravity 已成功还原为官方英文原版！');
  console.log('============================================');
}

module.exports = { restoreOriginal };

if (require.main === module) {
  try {
    restoreOriginal(common.parseCommonArgs(process.argv.slice(2)));
  } catch (err) {
    console.error('还原失败:', err);
    process.exit(1);
  }
}
