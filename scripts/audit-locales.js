'use strict';
/**
 * Locale dictionary audit tool.
 *
 * Checks locales/en.json and locales/zh-CN.json for:
 *  - JSON syntax and duplicate keys (detected from the raw text,
 *    since JSON.parse silently drops earlier duplicates)
 *  - key alignment between en and zh (must be 100%)
 *  - untranslated entries (zh value identical to the English key,
 *    excluding terms that are intentionally kept in English)
 *  - empty values and stray leading/trailing whitespace
 *  - placeholder parity ({name}, %s, $1 style tokens)
 *  - alphabetical ordering
 *
 * Usage:
 *   node scripts/audit-locales.js           # report only, exit 1 on errors
 *   node scripts/audit-locales.js --sort    # rewrite both files sorted by key
 */
const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'locales');

// Terms intentionally kept in English (abbreviations, brand names, shortcuts).
const KEEP_ENGLISH = new Set([
  'API', 'JSON', 'IDE', 'Git', 'CLI', 'HTTP', 'MCP', 'Token',
  'Antigravity', 'Google', 'Monaco', 'Chrome', 'Top P',
  'Best of N', 'Cascade ID',
]);

function findDuplicateKeys(raw) {
  const keys = [];
  const re = /^\s*"((?:[^"\\]|\\.)*)"\s*:/gm;
  let m;
  while ((m = re.exec(raw)) !== null) keys.push(JSON.parse('"' + m[1] + '"'));
  const seen = new Set();
  const dup = new Set();
  for (const k of keys) {
    if (seen.has(k)) dup.add(k);
    seen.add(k);
  }
  return [...dup];
}

function placeholders(s) {
  const found = [];
  const re = /\{[^}]+\}|%[sd]|\\$\d+/g;
  let m;
  while ((m = re.exec(s)) !== null) found.push(m[0]);
  return found.sort();
}

function loadPair() {
  const enRaw = fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf-8');
  const zhRaw = fs.readFileSync(path.join(LOCALES_DIR, 'zh-CN.json'), 'utf-8');
  return {
    enRaw, zhRaw,
    en: JSON.parse(enRaw),
    zh: JSON.parse(zhRaw),
  };
}

function audit() {
  const { enRaw, zhRaw, en, zh } = loadPair();
  const errors = [];
  const warnings = [];

  for (const [name, raw] of [['en.json', enRaw], ['zh-CN.json', zhRaw]]) {
    const dup = findDuplicateKeys(raw);
    if (dup.length) errors.push(name + ' 存在重复键：' + dup.slice(0, 5).join(' | ') + (dup.length > 5 ? ' …共 ' + dup.length + ' 个' : ''));
  }

  const enKeys = Object.keys(en);
  const zhKeys = Object.keys(zh);
  const missingZh = enKeys.filter(k => !(k in zh));
  const missingEn = zhKeys.filter(k => !(k in en));
  if (missingZh.length) errors.push('zh-CN.json 缺少 ' + missingZh.length + ' 个键，例如：' + missingZh[0]);
  if (missingEn.length) errors.push('en.json 缺少 ' + missingEn.length + ' 个键，例如：' + missingEn[0]);

  let untranslated = 0;
  for (const k of enKeys) {
    const v = zh[k];
    if (v === undefined) continue;
    if (typeof v !== 'string' || v.trim() === '') { errors.push('空译文：' + k); continue; }
    if (v !== v.trim() && k === k.trim()) warnings.push('译文首尾有空白：' + k);
    if (v === k && !KEEP_ENGLISH.has(k) && /[A-Za-z]{3,}/.test(k)) untranslated++;
    const pk = placeholders(k).join(',');
    const pv = placeholders(v).join(',');
    if (pk !== pv) warnings.push('占位符不一致：' + k + '  [' + pk + '] vs [' + pv + ']');
  }
  if (untranslated) warnings.push('疑似未翻译（译文与英文相同）共 ' + untranslated + ' 条');

  for (const [name, keys] of [['en.json', enKeys], ['zh-CN.json', zhKeys]]) {
    const sorted = [...keys].sort();
    if (keys.some((k, i) => k !== sorted[i])) warnings.push(name + ' 未按字母序排列（可用 --sort 修复）');
  }

  console.log('词典审计：en ' + enKeys.length + ' 条 / zh ' + zhKeys.length + ' 条');
  for (const e of errors) console.log('  [错误] ' + e);
  for (const w of warnings.slice(0, 20)) console.log('  [警告] ' + w);
  if (warnings.length > 20) console.log('  [警告] …另有 ' + (warnings.length - 20) + ' 条警告未显示');
  if (!errors.length && !warnings.length) console.log('  全部检查通过。');
  return errors.length === 0;
}

function sortFiles() {
  const { en, zh } = loadPair();
  for (const [file, obj] of [['en.json', en], ['zh-CN.json', zh]]) {
    const sorted = {};
    for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
    fs.writeFileSync(path.join(LOCALES_DIR, file), JSON.stringify(sorted, null, 2) + '\n', 'utf-8');
    console.log(file + ' 已按字母序重写（' + Object.keys(sorted).length + ' 条）');
  }
}

if (require.main === module) {
  try {
    if (process.argv.includes('--sort')) sortFiles();
    const ok = audit();
    process.exit(ok ? 0 : 1);
  } catch (err) {
    console.error('审计失败:', err.message || err);
    process.exit(1);
  }
}

module.exports = { audit };
