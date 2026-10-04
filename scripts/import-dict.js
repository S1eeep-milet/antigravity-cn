/**
 * 词典扩充 / 合并工具
 *
 * 将外部英文→中文词典（单个 JSON 文件或目录下的全部 .json）合并进本项目词库。
 * 合并策略（安全优先）：
 *   - 仅接受「纯英文键 + 含汉字的非空译文 + 与键不同」的有效条目；
 *   - 已存在的键（含仅大小写差异）一律保留本项目现有译文，不覆盖；
 *   - en.json 与 zh-CN.json 同步写入并按键排序，保持 100% 键对齐。
 *
 * 用法：
 *   node scripts/import-dict.js <文件或目录>            # 合并
 *   node scripts/import-dict.js <文件或目录> --dry-run  # 仅预览
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { hasFlag } = require('./lib/app-path');

const LOCALES_DIR = path.join(__dirname, '..', 'locales');
const EN_PATH = path.join(LOCALES_DIR, 'en.json');
const ZH_PATH = path.join(LOCALES_DIR, 'zh-CN.json');
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

function collectFiles(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  if (stat.isDirectory()) {
    return fs.readdirSync(target)
      .filter((f) => f.toLowerCase().endsWith('.json'))
      .map((f) => path.join(target, f));
  }
  throw new Error(`不支持的路径类型：${target}`);
}

function loadExternal(files) {
  const entries = {};
  let raw = 0;
  for (const f of files) {
    let obj;
    try {
      obj = JSON.parse(fs.readFileSync(f, 'utf-8'));
    } catch (e) {
      console.warn(`  [跳过] ${path.basename(f)} 解析失败：${e.message}`);
      continue;
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) continue;
    for (const [k, v] of Object.entries(obj)) {
      raw++;
      if (typeof k !== 'string' || !k.trim()) continue;
      if (typeof v !== 'string' || !v.trim()) continue;
      if (k !== k.trim()) continue;
      if (CJK.test(k)) continue;            // 键必须是纯英文源文本
      if (v === k) continue;                // 未翻译
      if (!CJK.test(v)) continue;           // 译文应含汉字
      entries[k] = v;
    }
  }
  return { entries, raw };
}

function main() {
  const target = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
  if (!target) {
    console.error('用法：node scripts/import-dict.js <词典文件或目录> [--dry-run]');
    process.exit(1);
  }
  const dryRun = hasFlag('--dry-run');

  const files = collectFiles(path.resolve(target));
  if (files.length === 0) throw new Error('未找到任何 .json 词典文件。');

  const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf-8'));
  const zh = JSON.parse(fs.readFileSync(ZH_PATH, 'utf-8'));
  const existingLower = new Set(Object.keys(zh).map((k) => k.toLowerCase()));

  const { entries, raw } = loadExternal(files);

  const added = [];
  let skippedExisting = 0;
  for (const [k, v] of Object.entries(entries)) {
    if (existingLower.has(k.toLowerCase())) {
      skippedExisting++;
      continue;
    }
    added.push([k, v]);
    existingLower.add(k.toLowerCase());
  }

  console.log('=== 词典扩充工具 ===');
  console.log(`来源：${path.resolve(target)}（${files.length} 个文件）`);
  console.log(`读取条目：${raw}，有效条目：${Object.keys(entries).length}`);
  console.log(`新增：${added.length}，已存在跳过：${skippedExisting}`);
  console.log(`现有词库：en ${Object.keys(en).length} / zh ${Object.keys(zh).length}`);

  if (added.length === 0) {
    console.log('无新增词条，词库保持不变。');
    return;
  }

  added.slice(0, 8).forEach(([k, v]) => console.log(`  + ${k}  =>  ${v}`));
  if (added.length > 8) console.log(`  … 其余 ${added.length - 8} 条`);

  if (dryRun) {
    console.log('\n[预览模式] 未写入文件。');
    return;
  }

  for (const [k, v] of added) {
    en[k] = k;
    zh[k] = v;
  }

  const sortKeys = (obj) => {
    const out = {};
    for (const k of Object.keys(obj).sort()) out[k] = obj[k];
    return out;
  };
  fs.writeFileSync(EN_PATH, JSON.stringify(sortKeys(en), null, 2) + '\n', 'utf-8');
  fs.writeFileSync(ZH_PATH, JSON.stringify(sortKeys(zh), null, 2) + '\n', 'utf-8');
  console.log(`\n已写入 locales/en.json（${Object.keys(en).length} 条）与 locales/zh-CN.json（${Object.keys(zh).length} 条）。`);

  try {
    execSync(`node "${path.join(__dirname, 'patch.js')}" --emit-bundle`, { stdio: 'inherit' });
  } catch (_) {
    console.warn('提示：i18n-bundle.js 重新生成失败，请手动运行 node scripts/patch.js --emit-bundle');
  }
}

try {
  main();
} catch (err) {
  console.error('词典扩充失败:', err.message);
  process.exit(1);
}