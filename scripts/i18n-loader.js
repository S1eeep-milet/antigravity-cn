/**
 * Antigravity i18n Injected Translation Loader
 * 
 * Non-invasive, high-performance DOM & UI localization engine.
 * Automatically translates UI strings while strictly protecting user code,
 * terminal outputs, and editor contents.
 */

(function () {
  'use strict';

  // Prevent multiple injections
  if (window.__ANTIGRAVITY_I18N_LOADED__) return;
  window.__ANTIGRAVITY_I18N_LOADED__ = true;

  // The dictionary is loaded from zh-CN.json
  let dict = {};
  let regexRules = [
    { pattern: /^(\d+)\s+agents?\s+running$/i, replacement: '$1 个智能体运行中' },
    { pattern: /^(\d+)\s+subagents?$/i, replacement: '$1 个子智能体' },
    { pattern: /^\/\s*(\d+(?:\.\d+)?[KMGT]?)\s+tokens?$/i, replacement: '/ $1 个 Token' },
    { pattern: /^Version\s+([\d\.]+)$/i, replacement: '版本 $1' },
    { pattern: /^Delete\s+"([^"]+)"$/i, replacement: '删除 "$1"' },
    { pattern: /^Rename\s+"([^"]+)"$/i, replacement: '重命名 "$1"' }
  ];

  // Elements that must NEVER have their text translated (code, editors, user input)
  function isCodeOrEditor(node) {
    let curr = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      const tag = curr.tagName.toLowerCase();
      if (tag === 'pre' || tag === 'code' || tag === 'textarea') return true;
      if (curr.isContentEditable) return true;
      const className = typeof curr.className === 'string' ? curr.className : '';
      if (
        className.includes('monaco-editor') ||
        className.includes('cm-editor') ||
        className.includes('xterm') ||
        className.includes('terminal') && tag !== 'button' ||
        className.includes('font-mono') && !className.includes('badge') ||
        className.includes('code-block') ||
        className.includes('prism') ||
        className.includes('hljs')
      ) {
        return true;
      }
      curr = curr.parentElement;
    }
    return false;
  }

  function translateString(str) {
    if (!str) return null;
    const trimmed = str.trim();
    if (!trimmed) return null;

    // 1. Exact match
    if (dict[trimmed]) {
      return dict[trimmed];
    }

    // 2. Regex pattern match
    for (const rule of regexRules) {
      if (rule.pattern.test(trimmed)) {
        return trimmed.replace(rule.pattern, rule.replacement);
      }
    }

    return null;
  }

  function translateTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    if (isCodeOrEditor(node)) return;

    const original = node.nodeValue;
    if (!original) return;
    const trimmed = original.trim();
    if (!trimmed || trimmed.length < 2) return;

    const translated = translateString(trimmed);
    if (translated && translated !== trimmed) {
      const leadingSpace = original.match(/^\s*/)[0];
      const trailingSpace = original.match(/\s*$/)[0];
      const result = leadingSpace + translated + trailingSpace;
      if (node.nodeValue !== result) {
        node.nodeValue = result;
      }
    }
  }

  function translateAttributes(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'svg' || tag === 'path') return;

    const attrs = ['placeholder', 'title', 'aria-label'];
    for (const attr of attrs) {
      const val = el.getAttribute(attr);
      if (val) {
        const translated = translateString(val);
        if (translated && translated !== val) {
          el.setAttribute(attr, translated);
        }
      }
    }
  }

  function walkAndTranslate(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root);
      return;
    }
    if (root.nodeType === Node.ELEMENT_NODE) {
      if (isCodeOrEditor(root)) return;
      translateAttributes(root);
      let child = root.firstChild;
      while (child) {
        walkAndTranslate(child);
        child = child.nextSibling;
      }
    }
  }

  // High performance MutationObserver
  let isTranslating = false;
  const observer = new MutationObserver(mutations => {
    if (isTranslating) return;
    isTranslating = true;
    try {
      for (const m of mutations) {
        if (m.type === 'childList') {
          for (let i = 0; i < m.addedNodes.length; i++) {
            walkAndTranslate(m.addedNodes[i]);
          }
        } else if (m.type === 'characterData') {
          translateTextNode(m.target);
        } else if (m.type === 'attributes') {
          translateAttributes(m.target);
        }
      }
    } finally {
      isTranslating = false;
    }
  });

  function init(translations) {
    dict = translations || {};

    const startObserving = () => {
      walkAndTranslate(document.body || document.documentElement);
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['placeholder', 'title', 'aria-label']
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startObserving, { once: true });
    } else {
      startObserving();
    }
  }

  const exportObj = { init, translateString };
  if (typeof window !== 'undefined') {
    window.AntigravityI18n = exportObj;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportObj;
  }
})();
