'use strict';
/**
 * Launch the Antigravity desktop client.
 * Usage:
 *   node scripts/launch.js [--path <install dir>|--asar <app.asar file>]
 */
const { spawn } = require('child_process');
const { findInstallDir, getExecutablePath, parseCommonArgs } = require('./lib/common');

function launchAntigravity(options = {}) {
  const installDir = findInstallDir(options);
  const exe = getExecutablePath(installDir);
  if (!exe) {
    throw new Error('在安装目录中未找到 Antigravity.exe：' + installDir);
  }
  const child = spawn(exe, [], { detached: true, stdio: 'ignore' });
  child.unref();
  console.log('已启动 Antigravity：' + exe);
  return exe;
}

module.exports = { launchAntigravity };

if (require.main === module) {
  try {
    launchAntigravity(parseCommonArgs(process.argv.slice(2)));
  } catch (err) {
    console.error('启动失败:', err.message || err);
    process.exit(1);
  }
}
