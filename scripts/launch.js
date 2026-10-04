/**
 * Antigravity 一键启动工具
 *
 * 自动定位安装目录（支持多路径探测与自定义路径）并启动客户端。
 *
 * 用法：
 *   node scripts/launch.js
 *   node scripts/launch.js --path "D:\\你的\\Antigravity"
 *   node scripts/launch.js --list          # 仅列出探测到的安装目录
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const { resolveAppDir, findAllInstalls, parsePathArg, hasFlag } = require('./lib/app-path');

function isRunning() {
  try {
    const out = execSync('tasklist /FI "IMAGENAME eq Antigravity.exe" /NH', { encoding: 'utf-8' });
    return out.includes('Antigravity.exe');
  } catch (_) {
    return false;
  }
}

function listInstalls() {
  const all = findAllInstalls();
  if (all.length === 0) {
    console.log('未探测到任何 Antigravity 安装目录。');
    return;
  }
  console.log('探测到的 Antigravity 安装目录:');
  all.forEach((dir, i) => console.log(`  ${i + 1}. ${dir}`));
}

function launch() {
  if (hasFlag('--list')) {
    listInstalls();
    return;
  }

  const appDir = resolveAppDir(parsePathArg());
  const exe = path.join(appDir, 'Antigravity.exe');
  if (!fs.existsSync(exe)) {
    throw new Error(`未找到可执行文件：${exe}`);
  }

  if (isRunning()) {
    console.log('Antigravity 已在运行，无需重复启动。');
    return;
  }

  console.log('=== Antigravity 一键启动 ===');
  console.log(`启动路径: ${exe}`);
  const child = spawn(exe, [], { detached: true, stdio: 'ignore' });
  child.unref();
  console.log('已发出启动指令，客户端正在启动…');
}

try {
  launch();
} catch (err) {
  console.error('启动失败:', err.message);
  process.exit(1);
}