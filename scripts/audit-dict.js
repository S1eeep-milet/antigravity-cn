/**
 * 词典审计工具
 *
 * 对 locales/en.json 与 locales/zh-CN.json 做一致性体检，输出问题清单：
 *   1. 键对齐      —— en / zh 两侧缺失的键
 *   2. 大小写重复  —— 仅大小写不同的重复键（翻译引擎已做降级，属冗余）
 *   3. 空值        —— 空字符串或纯空白译文
 *   4. 非法键      —— 键中含中文（应为纯英文源文本）
 *   5. 未翻译      —— 中文值与英文键完全相同 / 中文值不含汉字
 *   6. 占位符不一致 —— 键值中的 ${x} / {0} / %s / $1 等占位符数量不匹配
 *
 * 用法：
 *   node scripts/audit-dict.js            # 文本报告
 *   node scripts/audit-dict.js --json     # JSON 报告
 *   node scripts/audit-dict.js --strict   # 警告也视为失败（退出码 1）
 */

const fs = require('fs');
const path = require('path');
const { hasFlag } = require('./lib/app-path');

const LOCALES_DIR = path.join(__dirname, '..', 'locales');
const EN_PATH = path.join(LOCALES_DIR, 'en.json');
const ZH_PATH = path.join(LOCALES_DIR, 'zh-CN.json');

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const PLACEHOLDER = /\$\{[^}]+\}|\{[0-9]+\}|%[0-9]*\$?[sdif]|\$\d+/g;

function loadJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (e) {
    throw new Error(`${path.basename(p)} 解析失败：${e.message}`);
  }
}

function findCaseDuplicates(keys) {
  const seen = new Map();
  const dups = [];
  for (const k of keys) {
    const lower = k.toLowerCase();
    if (seen.has(lower)) {
      dups.push({ key: k, conflict: seen.get(lower) });
    } else {
      seen.set(lower, k);
    }
  }
  return dups;
}

function placeholders(str) {
  const m = String(str).match(PLACEHOLDER);
  return m ? m.slice().sort() : [];
}

function samePlaceholders(a, b) {
  const pa = placeholders(a);
  const pb = placeholders(b);
  if (pa.length !== pb.length) return false;
  for (let i = 0; i < pa.length; i++) {
    if (pa[i] !== pb[i]) return false;
  }
  return true;
}

function audit() {
  const en = loadJson(EN_PATH);
  const zh = loadJson(ZH_PATH);
  const enKeys = Object.keys(en);
  const zhKeys = Object.keys(zh);

  const report = {
    counts: { en: enKeys.length, zh: zhKeys.length },
    missingInZh: [],
    missingInEn: [],
    caseDuplicates: { en: [], zh: [] },
    emptyValues: [],
    invalidKeys: [],
    untranslated: [],
    noChinese: [],
    placeholderMismatch: [],
    enBaselineBroken: [],
  };

  const zhSet = new Set(zhKeys);
  const enSet = new Set(enKeys);

  for (const k of enKeys) if (!zhSet.has(k)) report.missingInZh.push(k);
  for (const k of zhKeys) if (!enSet.has(k)) report.missingInEn.push(k);

  report.caseDuplicates.en = findCaseDuplicates(enKeys);
  report.caseDuplicates.zh = findCaseDuplicates(zhKeys);

  for (const k of enKeys) {
    if (!en[k] || !String(en[k]).trim()) report.emptyValues.push({ file: 'en', key: k });
  }
  for (const k of zhKeys) {
    if (!zh[k] || !String(zh[k]).trim()) report.emptyValues.push({ file: 'zh', key: k });
  }

  for (const k of enKeys) {
    if (CJK.test(k)) report.invalidKeys.push({ file: 'en', key: k });
  }
  for (const k of zhKeys) {
    if (CJK.test(k)) report.invalidKeys.push({ file: 'zh', key: k });
  }

  for (const k of zhKeys) {
    if (CJK.test(k)) continue;
    const v = zh[k];
    if (typeof v !== 'string' || !v.trim()) continue;
    if (v === k) report.untranslated.push(k);
    else if (!CJK.test(v)) report.noChinese.push({ key: k, value: v });
  }

  for (const k of zhKeys) {
    const v = zh[k];
    if (typeof v !== 'string' || !v.trim()) continue;
    if (!samePlaceholders(k, v)) {
      report.placeholderMismatch.push({ key: k, value: v });
    }
  }

  for (const k of enKeys) {
    if (en[k] !== k) report.enBaselineBroken.push(k);
  }

  return report;
}

function printText(r) {
  const line = '============================================================';
  console.log(line);
  console.log(' 词典审计报告');
  console.log(line);
  console.log(` en.json: ${r.counts.en} 条    zh-CN.json: ${r.counts.zh} 条`);

  const errors = [];
  const warnings = [];

  console.log('\n[1] 键对齐');
  if (r.missingInZh.length === 0 && r.missingInEn.length === 0) {
    console.log('  ✓ 两侧键 100% 对齐');
  } else {
    errors.push('键对齐');
    if (r.missingInZh.length) console.log(`  ✗ zh 缺少 ${r.missingInZh.length} 条：${r.missingInZh.slice(0, 5).join(' | ')}${r.missingInZh.length > 5 ? ' …' : ''}`);
    if (r.missingInEn.length) console.log(`  ✗ en 缺少 ${r.missingInEn.length} 条：${r.missingInEn.slice(0, 5).join(' | ')}${r.missingInEn.length > 5 ? ' …' : ''}`);
  }

  console.log('\n[2] 大小写重复键');
  const dupCount = r.caseDuplicates.en.length + r.caseDuplicates.zh.length;
  if (dupCount === 0) {
    console.log('  ✓ 无大小写重复');
  } else {
    warnings.push('大小写重复');
    console.log(`  ⚠ en ${r.caseDuplicates.en.length} 组，zh ${r.caseDuplicates.zh.length} 组`);
    r.caseDuplicates.zh.slice(0, 3).forEach((d) => console.log(`    - "${d.key}" 与 "${d.conflict}"`));
  }

  console.log('\n[3] 空值');
  if (r.emptyValues.length === 0) {
    console.log('  ✓ 无空值');
  } else {
    errors.push('空值');
    console.log(`  ✗ ${r.emptyValues.length} 条空值`);
    r.emptyValues.slice(0, 5).forEach((e) => console.log(`    - [${e.file}] ${e.key}`));
  }

  console.log('\n[4] 非法键（键中含中文）');
  if (r.invalidKeys.length === 0) {
    console.log('  ✓ 无非法键');
  } else {
    errors.push('非法键');
    console.log(`  ✗ ${r.invalidKeys.length} 条非法键`);
    r.invalidKeys.slice(0, 5).forEach((e) => console.log(`    - [${e.file}] ${e.key}`));
  }

  console.log('\n[5] 未翻译 / 缺汉字');
  if (r.untranslated.length === 0 && r.noChinese.length === 0) {
    console.log('  ✓ 全部词条均已汉化');
  } else {
    warnings.push('未翻译');
    if (r.untranslated.length) {
      console.log(`  ⚠ 中文与英文完全相同 ${r.untranslated.length} 条`);
      r.untranslated.slice(0, 5).forEach((k) => console.log(`    - ${k}`));
    }
    if (r.noChinese.length) {
      console.log(`  ⚠ 中文值不含汉字 ${r.noChinese.length} 条（可能为保留术语或漏翻）`);
      r.noChinese.slice(0, 5).forEach((e) => console.log(`    - ${e.key} => ${e.value}`));
    }
  }

  console.log('\n[6] 占位符一致性');
  if (r.placeholderMismatch.length === 0) {
    console.log('  ✓ 占位符一致');
  } else {
    warnings.push('占位符');
    console.log(`  ⚠ ${r.placeholderMismatch.length} 条占位符不匹配`);
    r.placeholderMismatch.slice(0, 5).forEach((e) => console.log(`    - ${e.key}  =>  ${e.value}`));
  }

  console.log('\n[7] en.json 基准完整性');
  if (r.enBaselineBroken.length === 0) {
    console.log('  ✓ en.json 值均等于键（纯英文基准）');
  } else {
    warnings.push('en基准');
    console.log(`  ⚠ ${r.enBaselineBroken.length} 条 en 值与键不一致`);
  }

  console.log('\n' + line);
  console.log(` 结论：${errors.length === 0 ? '结构检查通过' : '存在错误：' + errors.join('、')}` +
    `${warnings.length ? '；提示：' + warnings.join('、') : ''}`);
  console.log(line);

  return { errors: errors.length, warnings: warnings.length };
}

try {
  const report = audit();
  if (hasFlag('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const { errors, warnings } = printText(report);
    if (errors > 0 || (hasFlag('--strict') && warnings > 0)) {
      process.exit(1);
    }
  }
} catch (err) {
  console.error('词典审计失败:', err.message);
  process.exit(1);
}