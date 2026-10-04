/**
 * Antigravity Restore Script
 * 
 * Restores the original official app.asar from app.asar.bak.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function findAntigravityDir() {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    throw new Error('LOCALAPPDATA environment variable not found.');
  }
  return path.join(localAppData, 'Programs', 'antigravity');
}

function closeRunningAntigravity() {
  try {
    const list = execSync('tasklist /FI "IMAGENAME eq Antigravity.exe" /NH', { encoding: 'utf-8' });
    if (list.includes('Antigravity.exe')) {
      console.log('正在关闭正在运行的 Antigravity 客户端...');
      execSync('taskkill /F /IM Antigravity.exe', { stdio: 'ignore' });
      try {
        execSync('taskkill /F /IM language_server.exe', { stdio: 'ignore' });
      } catch (e) {}
      const start = Date.now();
      while (Date.now() - start < 2000) {}
      console.log('Antigravity 进程已退出。');
    }
  } catch (e) {}
}

function restoreOriginal() {
  const appDir = findAntigravityDir();
  const resourcesDir = path.join(appDir, 'resources');
  const asarPath = path.join(resourcesDir, 'app.asar');
  const backupPath = path.join(resourcesDir, 'app.asar.bak');

  console.log('=== Antigravity 官方原版还原工具 ===');
  console.log(`目标路径: ${appDir}`);

  if (!fs.existsSync(backupPath)) {
    console.error('未找到备份文件 app.asar.bak，无法还原！');
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
  restoreOriginal();
} catch (err) {
  console.error('还原失败:', err);
  process.exit(1);
}
