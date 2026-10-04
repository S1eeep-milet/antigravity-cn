/**
 * Antigravity 官方原版还原工具
 *
 * 从 app.asar.bak 备份恢复官方英文原版（备份由 patch.js 首次运行时自动创建）。
 *
 * 用法：
 *   node scripts/restore.js                 # 自动探测安装路径并还原
 *   node scripts/restore.js --path <目录>    # 指定自定义安装路径
 *   node scripts/restore.js --list           # 列出探测到的安装目录
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { resolveAppDir, findAllInstalls, parsePathArg, hasFlag } = require('./lib/app-path');

function closeRunningAntigravity() {
  try {
    const list = execSync('tasklist /FI "IMAGENAME eq Antigravity.exe" /NH', { encoding: 'utf-8' });
    if (list.includes('Antigravity.exe')) {
      console.log('正在关闭正在运行的 Antigravity 客户端...');
      execSync('taskkill /F /IM Antigravity.exe', { stdio: 'ignore' });
      try {
        execSync('taskkill /F /IM language_server.exe', { stdio: 'ignore' });
      } catch (_) { /* 语言服务器可能未运行 */ }
      const start = Date.now();
      while (Date.now() - start < 2000) { /* 等待句柄释放 */ }
      console.log('Antigravity 进程已退出。');
    }
  } catch (_) { /* 进程可能已退出 */ }
}

function restoreOriginal() {
  const appDir = resolveAppDir(parsePathArg());
  const resourcesDir = path.join(appDir, 'resources');
  const asarPath = path.join(resourcesDir, 'app.asar');
  const backupPath = path.join(resourcesDir, 'app.asar.bak');

  console.log('=== Antigravity 官方原版还原工具 ===');
  console.log(`目标路径: ${appDir}`);

  if (!fs.existsSync(backupPath)) {
    console.error('未找到备份文件 app.asar.bak，无法还原！');
    console.error('备份仅在首次执行汉化补丁时自动创建。');
    process.exit(1);
  }

  closeRunningAntigravity();

  console.log('正在从备份还原 app.asar...');
  fs.copyFileSync(backupPath, asarPath);

  console.log('============================================');
  console.log(' Antigravity 已成功还原为官方英文原版！');
  console.log('============================================');
}

try {
  if (hasFlag('--list')) {
    const all = findAllInstalls();
    if (all.length === 0) {
      console.log('未探测到任何 Antigravity 安装目录。');
    } else {
      console.log('探测到的 Antigravity 安装目录:');
      all.forEach((d, i) => console.log(`  ${i + 1}. ${d}`));
    }
  } else {
    restoreOriginal();
  }
} catch (err) {
  console.error('还原失败:', err.message);
  process.exit(1);
}