'use strict';
/**
 * Shared helpers: Antigravity install detection, process control,
 * cache locations. Used by patch.js / restore.js / clean-cache.js /
 * launch.js so every entry point resolves paths the same way.
 */
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

/** Candidate install directories, most specific first. */
function candidateInstallDirs() {
  const dirs = [];
  const local = process.env.LOCALAPPDATA;
  const pf = process.env.ProgramFiles;
  const pf86 = process.env['ProgramFiles(x86)'];
  if (local) {
    dirs.push(path.join(local, 'Programs', 'antigravity'));
    dirs.push(path.join(local, 'Programs', 'Antigravity'));
  }
  if (pf) dirs.push(path.join(pf, 'Antigravity'));
  if (pf86) dirs.push(path.join(pf86, 'Antigravity'));
  if (local) dirs.push(path.join(local, 'antigravity'));
  return [...new Set(dirs)];
}

function hasAsar(dir) {
  return !!dir && fs.existsSync(path.join(dir, 'resources', 'app.asar'));
}

/**
 * Resolve the install directory.
 * options.path : explicit install dir (or a direct app.asar file path)
 * Falls back to ANTIGRAVITY_PATH env, then the candidate list.
 * Throws with the full searched list when nothing is found.
 */
function findInstallDir(options = {}) {
  const explicit = options.path || process.env.ANTIGRAVITY_PATH;
  if (explicit) {
    if (fs.existsSync(explicit) && fs.statSync(explicit).isFile() && explicit.endsWith('.asar')) {
      return path.dirname(path.dirname(explicit));
    }
    if (hasAsar(explicit)) return explicit;
    throw new Error('指定的路径下未找到 resources\\app.asar：' + explicit);
  }
  for (const dir of candidateInstallDirs()) {
    if (hasAsar(dir)) return dir;
  }
  throw new Error(
    '未在以下位置找到 Antigravity，请用 --path 指定安装目录：\n  ' +
    candidateInstallDirs().join('\n  ')
  );
}

function getAsarPath(installDir) {
  return path.join(installDir, 'resources', 'app.asar');
}

function getExecutablePath(installDir) {
  const exe = path.join(installDir, 'Antigravity.exe');
  return fs.existsSync(exe) ? exe : null;
}

/** True when Antigravity.exe is running (Windows only; false elsewhere). */
function isAntigravityRunning() {
  if (process.platform !== 'win32') return false;
  try {
    const out = execSync('tasklist /FI "IMAGENAME eq Antigravity.exe" /NH', { encoding: 'utf-8' });
    return out.includes('Antigravity.exe');
  } catch (e) {
    return false;
  }
}

function killAntigravity() {
  if (process.platform !== 'win32') return;
  try { execSync('taskkill /F /IM Antigravity.exe', { stdio: 'ignore' }); } catch (e) {}
  try { execSync('taskkill /F /IM language_server.exe', { stdio: 'ignore' }); } catch (e) {}
  const start = Date.now();
  while (Date.now() - start < 2000) { /* wait for handles to release */ }
}

/**
 * Electron/Chromium user-data roots whose cache subdirectories are safe
 * to delete. Only the listed cache subdirectories are ever removed;
 * user config, accounts and workspaces live elsewhere in the profile
 * and are never touched.
 */
function cacheRoots() {
  const roots = [];
  const appData = process.env.APPDATA;
  const local = process.env.LOCALAPPDATA;
  if (appData) {
    roots.push(path.join(appData, 'Antigravity'));
    roots.push(path.join(appData, 'antigravity'));
  }
  if (local) {
    roots.push(path.join(local, 'Antigravity'));
    roots.push(path.join(local, 'antigravity'));
  }
  return [...new Set(roots)];
}

const CACHE_SUBDIRS = [
  'Cache',
  'Code Cache',
  'GPUCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'blob_storage',
];

/** Parse --path <dir> / --asar <file> style args shared by all scripts. */
function parseCommonArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--path' && argv[i + 1]) opts.path = argv[++i];
    else if (argv[i] === '--asar' && argv[i + 1]) opts.path = argv[++i];
  }
  return opts;
}

module.exports = {
  candidateInstallDirs,
  findInstallDir,
  getAsarPath,
  getExecutablePath,
  isAntigravityRunning,
  killAntigravity,
  cacheRoots,
  CACHE_SUBDIRS,
  parseCommonArgs,
  spawn,
};
