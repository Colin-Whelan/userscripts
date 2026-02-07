// ==UserScript==
// @name         Sailthru Snippet Code Editor
// @namespace    https://my.sailthru.com
// @version      1.1.0
// @description  Replaces the plain textarea in Sailthru code snippets with a full CodeMirror editor (dark/light mode, HTML mixed-mode, customizable fonts/size)
// @match        https://my.sailthru.com/code_snippets/*
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ── Settings with defaults ──────────────────────────────────────────
  const DEFAULTS = {
    theme: 'dark',
    fontFamily: "'Fira Code', 'Source Code Pro', 'Consolas', monospace",
    fontSize: 14,
    lineHeight: 1.5,
    tabSize: 2,
    wordWrap: true,
    lineNumbers: true,
  };

  function getSetting(key) {
    return GM_getValue(key, DEFAULTS[key]);
  }
  function setSetting(key, val) {
    GM_setValue(key, val);
  }

  // ── CDN assets ──────────────────────────────────────────────────────
  const CM_VERSION = '5.65.18';
  const CDN = `https://cdnjs.cloudflare.com/ajax/libs/codemirror/${CM_VERSION}`;

  const CSS_FILES = [
    `${CDN}/codemirror.min.css`,
    `${CDN}/theme/material-darker.min.css`,
    `${CDN}/theme/eclipse.min.css`,
    `${CDN}/addon/fold/foldgutter.min.css`,
    `${CDN}/addon/hint/show-hint.min.css`,
    `${CDN}/addon/dialog/dialog.min.css`,
    `${CDN}/addon/search/matchesonscrollbar.min.css`,
  ];

  const JS_FILES = [
    `${CDN}/codemirror.min.js`,
    `${CDN}/mode/xml/xml.min.js`,
    `${CDN}/mode/javascript/javascript.min.js`,
    `${CDN}/mode/css/css.min.js`,
    `${CDN}/mode/htmlmixed/htmlmixed.min.js`,
    `${CDN}/addon/edit/closetag.min.js`,
    `${CDN}/addon/edit/closebrackets.min.js`,
    `${CDN}/addon/edit/matchtags.min.js`,
    `${CDN}/addon/edit/matchbrackets.min.js`,
    `${CDN}/addon/fold/foldcode.min.js`,
    `${CDN}/addon/fold/foldgutter.min.js`,
    `${CDN}/addon/fold/xml-fold.min.js`,
    `${CDN}/addon/fold/brace-fold.min.js`,
    `${CDN}/addon/search/search.min.js`,
    `${CDN}/addon/search/searchcursor.min.js`,
    `${CDN}/addon/search/match-highlighter.min.js`,
    `${CDN}/addon/search/jump-to-line.min.js`,
    `${CDN}/addon/dialog/dialog.min.js`,
    `${CDN}/addon/scroll/annotatescrollbar.min.js`,
    `${CDN}/addon/search/matchesonscrollbar.min.js`,
    `${CDN}/addon/selection/active-line.min.js`,
    `${CDN}/addon/hint/show-hint.min.js`,
    `${CDN}/addon/hint/html-hint.min.js`,
    `${CDN}/addon/hint/css-hint.min.js`,
    `${CDN}/addon/comment/comment.min.js`,
    `${CDN}/addon/selection/mark-selection.min.js`,
  ];

  // ── Loader helpers ──────────────────────────────────────────────────
  function loadCSS(href) {
    return new Promise((resolve) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = resolve;
      link.onerror = resolve;
      document.head.appendChild(link);
    });
  }

  function loadJS(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });
  }

  async function loadAssets() {
    await Promise.all(CSS_FILES.map(loadCSS));
    for (const src of JS_FILES) {
      await loadJS(src);
    }
  }

  // ── Detect OS for keybind display ───────────────────────────────────
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const MOD = isMac ? '⌘' : 'Ctrl';
  const ALT = isMac ? '⌥' : 'Alt';
  const SHIFT = isMac ? '⇧' : 'Shift';

  // ── Custom styles ───────────────────────────────────────────────────
  function injectCustomStyles() {
    GM_addStyle(`
      /* ── Editor wrapper ─────────────────────────────────── */
      .stru-cm-wrap {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        height: 100%;
        position: relative;
      }
      .stru-cm-wrap .CodeMirror {
        flex: 1 1 auto;
        height: auto;
      }
      /* Override Sailthru's @layer app { #app * { font-family: Figtree } } */
      .stru-cm-wrap .CodeMirror,
      .stru-cm-wrap .CodeMirror pre,
      .stru-cm-wrap .CodeMirror textarea,
      .stru-cm-wrap .CodeMirror-line,
      .stru-cm-wrap .CodeMirror-line *,
      #app * {
        font-family: unset !important;
      }
      .stru-cm-wrap .CodeMirror-scroll {
        scrollbar-color: #555 #1e1e1e;
      }

      /* ── Status / toolbar bar ───────────────────────────── */
      .stru-cm-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 3px 10px;
        font-size: 12px;
        font-family: system-ui, -apple-system, sans-serif;
        user-select: none;
        gap: 4px;
      }
      .stru-cm-bar.dark  { background: #1a1a2e; color: #8a8a9a; border-top: 1px solid #333; }
      .stru-cm-bar.light { background: #f0f0f0; color: #555; border-top: 1px solid #ccc; }
      .stru-cm-bar span { margin: 0 6px; white-space: nowrap; }
      .stru-cm-bar-left, .stru-cm-bar-right { display: flex; align-items: center; gap: 4px; }

      .stru-cm-bar button {
        background: none;
        border: 1px solid transparent;
        color: inherit;
        font: inherit;
        cursor: pointer;
        padding: 2px 8px;
        border-radius: 3px;
        opacity: 0.7;
        transition: opacity .15s, border-color .15s;
      }
      .stru-cm-bar button:hover { opacity: 1; border-color: currentColor; }

      /* ── Hidden original textarea ───────────────────────── */
      .stru-cm-hidden-ta {
        position: absolute !important;
        width: 0 !important; height: 0 !important;
        overflow: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* ── Overlay backdrop (shared by settings & keybinds) ─ */
      .stru-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,.55);
        display: flex; align-items: center; justify-content: center;
        z-index: 99999;
        animation: stru-fadeIn .15s ease;
      }
      @keyframes stru-fadeIn { from { opacity: 0 } to { opacity: 1 } }

      /* ── Panel (shared base) ────────────────────────────── */
      .stru-panel {
        border-radius: 10px;
        max-height: 85vh;
        overflow-y: auto;
        font-family: system-ui, -apple-system, sans-serif;
        box-shadow: 0 20px 60px rgba(0,0,0,.4);
        animation: stru-slideUp .2s ease;
      }
      @keyframes stru-slideUp {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .stru-panel.dark  { background: #1e1e2e; color: #cdd6f4; }
      .stru-panel.light { background: #fff;    color: #333; }

      /* Scrollbar for panels */
      .stru-panel::-webkit-scrollbar { width: 6px; }
      .stru-panel.dark::-webkit-scrollbar-thumb  { background: #45475a; border-radius: 3px; }
      .stru-panel.light::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }

      /* ── Settings modal ─────────────────────────────────── */
      .stru-settings { width: 420px; padding: 0; }
      .stru-settings-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 18px 22px 14px;
        font-size: 16px; font-weight: 600;
      }
      .stru-settings-close {
        background: none; border: none; color: inherit; font-size: 20px;
        cursor: pointer; opacity: .6; padding: 0 4px; line-height: 1;
      }
      .stru-settings-close:hover { opacity: 1; }
      .stru-settings-body { padding: 0 22px 20px; }

      .stru-field { margin-bottom: 16px; }
      .stru-field label {
        display: block; font-size: 12px; font-weight: 500;
        margin-bottom: 6px; text-transform: uppercase; letter-spacing: .5px;
        opacity: .7;
      }
      .stru-field select,
      .stru-field input[type="text"],
      .stru-field input[type="number"] {
        width: 100%; padding: 8px 10px;
        border-radius: 6px; border: 1px solid;
        font-size: 14px; font-family: inherit;
        box-sizing: border-box;
      }
      .stru-panel.dark .stru-field select,
      .stru-panel.dark .stru-field input {
        background: #181825; color: #cdd6f4; border-color: #45475a;
      }
      .stru-panel.light .stru-field select,
      .stru-panel.light .stru-field input {
        background: #f8f8f8; color: #333; border-color: #ccc;
      }

      .stru-toggle-row {
        display: flex; align-items: center; justify-content: space-between;
        padding: 8px 0;
      }
      .stru-toggle-row + .stru-toggle-row {
        border-top: 1px solid rgba(128,128,128,.15);
      }
      .stru-toggle-label { font-size: 14px; }

      /* Toggle switch */
      .stru-toggle {
        position: relative; width: 40px; height: 22px; cursor: pointer;
      }
      .stru-toggle input { opacity: 0; width: 0; height: 0; }
      .stru-toggle .stru-slider {
        position: absolute; inset: 0; border-radius: 22px;
        background: #555; transition: background .2s;
      }
      .stru-toggle .stru-slider::after {
        content: ''; position: absolute; left: 3px; top: 3px;
        width: 16px; height: 16px; border-radius: 50%;
        background: #fff; transition: transform .2s;
      }
      .stru-toggle input:checked + .stru-slider { background: #89b4fa; }
      .stru-toggle input:checked + .stru-slider::after { transform: translateX(18px); }

      /* Inline number fields */
      .stru-field-inline {
        display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
      }
      .stru-field-inline label {
        margin: 0; white-space: nowrap; min-width: 90px;
        font-size: 12px; font-weight: 500; text-transform: uppercase;
        letter-spacing: .5px; opacity: .7;
      }
      .stru-field-inline input { width: 80px; text-align: center; }
      .stru-field-inline select { width: 80px; text-align: center; }

      /* Font presets */
      .stru-font-presets {
        display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;
      }
      .stru-font-chip {
        font-size: 11px; padding: 3px 8px; border-radius: 4px;
        cursor: pointer; border: 1px solid; transition: all .15s;
      }
      .stru-panel.dark .stru-font-chip  { border-color: #45475a; color: #bac2de; }
      .stru-panel.dark .stru-font-chip:hover { background: #313244; }
      .stru-panel.light .stru-font-chip { border-color: #ccc; color: #555; }
      .stru-panel.light .stru-font-chip:hover { background: #e8e8e8; }

      /* ── Keybinds panel ─────────────────────────────────── */
      .stru-keybinds { width: 480px; padding: 0; }
      .stru-keybinds-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 18px 22px 10px;
        font-size: 16px; font-weight: 600;
      }
      .stru-keybinds-body { padding: 0 22px 20px; }
      .stru-kb-section { margin-bottom: 14px; }
      .stru-kb-section h3 {
        font-size: 11px; font-weight: 600; text-transform: uppercase;
        letter-spacing: .8px; opacity: .5; margin: 0 0 8px;
      }
      .stru-kb-row {
        display: flex; align-items: center; justify-content: space-between;
        padding: 5px 0; font-size: 13px;
      }
      .stru-kb-row + .stru-kb-row {
        border-top: 1px solid rgba(128,128,128,.1);
      }
      .stru-kb-keys { display: flex; gap: 4px; }
      .stru-kb-key {
        display: inline-block; padding: 2px 7px;
        border-radius: 4px; font-size: 12px; font-family: inherit;
        min-width: 22px; text-align: center;
      }
      .stru-panel.dark .stru-kb-key  { background: #313244; color: #cdd6f4; }
      .stru-panel.light .stru-kb-key { background: #e8e8e8; color: #333; }
    `);
  }

  // ── Settings Modal ──────────────────────────────────────────────────
  const FONT_PRESETS = [
    { label: 'Fira Code',       value: "'Fira Code', monospace" },
    { label: 'JetBrains Mono',  value: "'JetBrains Mono', monospace" },
    { label: 'Cascadia Code',   value: "'Cascadia Code', monospace" },
    { label: 'Source Code Pro', value: "'Source Code Pro', monospace" },
    { label: 'IBM Plex Mono',   value: "'IBM Plex Mono', monospace" },
    { label: 'Consolas',        value: "Consolas, monospace" },
    { label: 'Monaco',          value: "Monaco, monospace" },
  ];

  function closeOverlay() {
    const el = document.querySelector('.stru-overlay');
    if (el) el.remove();
  }

  function openSettingsModal() {
    if (document.querySelector('.stru-overlay')) return;
    const theme = getSetting('theme');

    const overlay = document.createElement('div');
    overlay.className = 'stru-overlay';
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    const panel = document.createElement('div');
    panel.className = `stru-panel stru-settings ${theme}`;
    panel.innerHTML = `
      <div class="stru-settings-header">
        <span>⚙️ Editor Settings</span>
        <button class="stru-settings-close" title="Close">&times;</button>
      </div>
      <div class="stru-settings-body">
        <div class="stru-field">
          <label>Theme</label>
          <select data-key="theme">
            <option value="dark" ${theme === 'dark' ? 'selected' : ''}>Dark (Material Darker)</option>
            <option value="light" ${theme === 'light' ? 'selected' : ''}>Light (Eclipse)</option>
          </select>
        </div>

        <div class="stru-field">
          <label>Font Family</label>
          <input type="text" data-key="fontFamily" value="${getSetting('fontFamily').replace(/"/g, '&quot;')}" />
          <div class="stru-font-presets">
            ${FONT_PRESETS.map(
              (p) => `<span class="stru-font-chip" data-font="${p.value}">${p.label}</span>`
            ).join('')}
          </div>
        </div>

        <div class="stru-field-inline">
          <label>Font Size (px)</label>
          <input type="number" data-key="fontSize" value="${getSetting('fontSize')}" min="10" max="30" />
        </div>
        <div class="stru-field-inline">
          <label>Line Height</label>
          <input type="number" data-key="lineHeight" value="${getSetting('lineHeight')}" min="1" max="2.5" step="0.1" />
        </div>
        <div class="stru-field-inline">
          <label>Tab Size</label>
          <select data-key="tabSize" style="width:80px;text-align:center;">
            <option value="2" ${getSetting('tabSize') === 2 ? 'selected' : ''}>2</option>
            <option value="4" ${getSetting('tabSize') === 4 ? 'selected' : ''}>4</option>
          </select>
        </div>

        <div class="stru-toggle-row">
          <span class="stru-toggle-label">Word Wrap</span>
          <label class="stru-toggle">
            <input type="checkbox" data-key="wordWrap" ${getSetting('wordWrap') ? 'checked' : ''} />
            <span class="stru-slider"></span>
          </label>
        </div>
        <div class="stru-toggle-row">
          <span class="stru-toggle-label">Line Numbers</span>
          <label class="stru-toggle">
            <input type="checkbox" data-key="lineNumbers" ${getSetting('lineNumbers') ? 'checked' : ''} />
            <span class="stru-slider"></span>
          </label>
        </div>
      </div>
    `;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    panel.querySelector('.stru-settings-close').addEventListener('click', closeOverlay);
    overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlay(); });

    // Font chip clicks
    panel.querySelectorAll('.stru-font-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const fontInput = panel.querySelector('input[data-key="fontFamily"]');
        fontInput.value = chip.dataset.font;
        fontInput.dispatchEvent(new Event('change'));
      });
    });

    // Live-apply on change
    panel.querySelectorAll('[data-key]').forEach((el) => {
      const handler = () => {
        const key = el.dataset.key;
        let val;
        if (el.type === 'checkbox') val = el.checked;
        else if (el.type === 'number') val = parseFloat(el.value);
        else if (key === 'tabSize') val = parseInt(el.value, 10);
        else val = el.value;
        setSetting(key, val);
        applyAllSettings();
        if (key === 'theme') {
          panel.className = `stru-panel stru-settings ${val}`;
        }
      };
      el.addEventListener('change', handler);
      if (el.type === 'number' || el.type === 'text') el.addEventListener('input', handler);
    });
  }

  // ── Keybinds Panel ──────────────────────────────────────────────────
  function openKeybindsPanel() {
    if (document.querySelector('.stru-overlay')) return;
    const theme = getSetting('theme');

    const sections = [
      {
        title: 'Search & Navigation',
        binds: [
          { keys: [MOD, 'F'],          desc: 'Find' },
          { keys: [MOD, 'H'],          desc: 'Find & Replace' },
          { keys: [MOD, 'G'],          desc: 'Go to Line' },
          { keys: [MOD, SHIFT, 'F'],   desc: 'Find Previous' },
        ],
      },
      {
        title: 'Editing',
        binds: [
          { keys: [MOD, '/'],          desc: 'Toggle Comment' },
          { keys: [MOD, 'Space'],      desc: 'Autocomplete (HTML / CSS)' },
          { keys: [MOD, 'J'],          desc: 'Jump to Matching Tag' },
          { keys: [MOD, 'D'],          desc: 'Delete Line' },
          { keys: [MOD, 'Z'],          desc: 'Undo' },
          { keys: [MOD, SHIFT, 'Z'],   desc: 'Redo' },
          { keys: ['Tab'],             desc: 'Indent Selection' },
          { keys: [SHIFT, 'Tab'],      desc: 'Dedent Selection' },
        ],
      },
      {
        title: 'Selection & Multi-Cursor',
        binds: [
          { keys: [MOD, 'A'],                desc: 'Select All' },
          { keys: [ALT, '+', 'Drag'],        desc: 'Column / Block Select' },
          { keys: ['Middle-click', '+', 'Drag'], desc: 'Column / Block Select' },
          { keys: [SHIFT, '↑ ↓ ← →'],       desc: 'Extend Selection' },
        ],
      },
      {
        title: 'Code Folding',
        binds: [
          { keys: [MOD, SHIFT, '['],   desc: 'Fold Block' },
          { keys: [MOD, SHIFT, ']'],   desc: 'Unfold Block' },
        ],
      },
    ];

    const overlay = document.createElement('div');
    overlay.className = 'stru-overlay';
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    const panel = document.createElement('div');
    panel.className = `stru-panel stru-keybinds ${theme}`;
    panel.innerHTML = `
      <div class="stru-keybinds-header">
        <span>⌨️ Keyboard Shortcuts</span>
        <button class="stru-settings-close" title="Close">&times;</button>
      </div>
      <div class="stru-keybinds-body">
        ${sections.map((s) => `
          <div class="stru-kb-section">
            <h3>${s.title}</h3>
            ${s.binds.map((b) => `
              <div class="stru-kb-row">
                <span>${b.desc}</span>
                <span class="stru-kb-keys">${b.keys.map((k) => `<span class="stru-kb-key">${k}</span>`).join('')}</span>
              </div>`).join('')}
          </div>`).join('')}
      </div>
    `;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    panel.querySelector('.stru-settings-close').addEventListener('click', closeOverlay);
    overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlay(); });
  }

  // ── Editor instance ─────────────────────────────────────────────────
  let cmInstance = null;
  let statusBar = null;

  function getThemeName() {
    return getSetting('theme') === 'dark' ? 'material-darker' : 'eclipse';
  }

  // ── Rectangular / block selection via middle-click drag ─────────────
  function enableRectangularSelection(cm) {
    const wrapper = cm.getWrapperElement();

    wrapper.addEventListener('mousedown', (e) => {
      const isMiddle = e.button === 1;
      const isAlt = e.altKey && e.button === 0;
      if (!isMiddle && !isAlt) return;

      e.preventDefault();
      e.stopPropagation();

      const startPos = cm.coordsChar({ left: e.clientX, top: e.clientY }, 'window');
      cm.setCursor(startPos);

      const onMove = (ev) => {
        const endPos = cm.coordsChar({ left: ev.clientX, top: ev.clientY }, 'window');
        const startLine = Math.min(startPos.line, endPos.line);
        const endLine = Math.max(startPos.line, endPos.line);
        const startCh = Math.min(startPos.ch, endPos.ch);
        const endCh = Math.max(startPos.ch, endPos.ch);

        const selections = [];
        for (let line = startLine; line <= endLine; line++) {
          const lineLen = cm.getLine(line).length;
          selections.push({
            anchor: { line, ch: Math.min(startCh, lineLen) },
            head:   { line, ch: Math.min(endCh, lineLen) },
          });
        }
        if (selections.length) cm.setSelections(selections);
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    // Prevent default middle-click paste/auto-scroll
    wrapper.addEventListener('auxclick', (e) => {
      if (e.button === 1) e.preventDefault();
    });
  }

  // ── Build editor ────────────────────────────────────────────────────
  function buildEditor(textarea) {
    const parentFlex = textarea.parentElement;

    const wrap = document.createElement('div');
    wrap.className = 'stru-cm-wrap';
    parentFlex.parentElement.insertBefore(wrap, parentFlex);

    textarea.classList.add('stru-cm-hidden-ta');

    cmInstance = CodeMirror(wrap, {
      value: textarea.value || '',
      mode: 'htmlmixed',
      theme: getThemeName(),
      lineNumbers: getSetting('lineNumbers'),
      tabSize: getSetting('tabSize'),
      indentUnit: getSetting('tabSize'),
      indentWithTabs: false,
      lineWrapping: getSetting('wordWrap'),
      styleActiveLine: true,
      matchBrackets: true,
      matchTags: { bothTags: true },
      autoCloseTags: true,
      autoCloseBrackets: true,
      foldGutter: true,
      gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
      highlightSelectionMatches: { showToken: true, annotateScrollbar: true },
      extraKeys: {
        'Ctrl-Space': 'autocomplete',
        'Cmd-/': 'toggleComment',
        'Ctrl-/': 'toggleComment',
        'Ctrl-J': 'toMatchingTag',
      },
    });

    applyFontToEditor();
    enableRectangularSelection(cmInstance);

    // ── Status bar ───────────────────────────────────────
    statusBar = document.createElement('div');
    statusBar.className = `stru-cm-bar ${getSetting('theme')}`;
    statusBar.innerHTML = `
      <div class="stru-cm-bar-left">
        <span class="stru-pos">Ln 1, Col 1</span>
        <span class="stru-mode">HTML</span>
        <span class="stru-info">${getSetting('fontSize')}px · ${getSetting('theme')}</span>
      </div>
      <div class="stru-cm-bar-right">
        <button class="stru-btn-keybinds" title="Keyboard Shortcuts">⌨️ Shortcuts</button>
      </div>
    `;
    wrap.appendChild(statusBar);
    statusBar.querySelector('.stru-btn-keybinds').addEventListener('click', openKeybindsPanel);

    // ── Sync editor → hidden textarea (for Save button) ─
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype, 'value'
    ).set;

    function syncToTextarea() {
      const val = cmInstance.getValue();
      nativeSetter.call(textarea, val);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    }

    cmInstance.on('change', () => { syncToTextarea(); updateStatus(); });
    cmInstance.on('cursorActivity', updateStatus);

    // Poll for external value changes (React state pushes)
    let lastKnownVal = textarea.value;
    setInterval(() => {
      if (textarea.value !== lastKnownVal && textarea.value !== cmInstance.getValue()) {
        lastKnownVal = textarea.value;
        cmInstance.setValue(textarea.value);
      }
      lastKnownVal = textarea.value;
    }, 500);

    syncToTextarea();

    // ── FIX #1: Force content visible on initial load ────
    // CodeMirror must be refreshed once it has real dimensions.
    // We use a multi-pronged approach: rAF cascade, timeouts,
    // ResizeObserver, and IntersectionObserver to cover all
    // the ways Sailthru's SPA might delay layout.
    function forceRefresh() {
      if (!cmInstance) return;
      cmInstance.refresh();
    }

    // Immediate cascade
    forceRefresh();
    requestAnimationFrame(forceRefresh);
    requestAnimationFrame(() => requestAnimationFrame(forceRefresh));
    setTimeout(forceRefresh, 0);
    setTimeout(forceRefresh, 50);
    setTimeout(forceRefresh, 150);
    setTimeout(forceRefresh, 400);
    setTimeout(forceRefresh, 800);

    // ResizeObserver — catches container finally getting dimensions
    if (typeof ResizeObserver !== 'undefined') {
      let count = 0;
      const ro = new ResizeObserver(() => {
        forceRefresh();
        if (++count > 20) ro.disconnect();
      });
      ro.observe(wrap);
      const tabPanel = textarea.closest('[role="tabpanel"]');
      if (tabPanel) ro.observe(tabPanel);
    }

    // IntersectionObserver — refresh when scrolled/tabbed into view
    if (typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              forceRefresh();
              io.disconnect();
            }
          });
        },
        { threshold: 0.1 }
      );
      io.observe(wrap);
    }

    return { wrap };
  }

  function updateStatus() {
    if (!cmInstance || !statusBar) return;
    const pos = cmInstance.getCursor();
    const sels = cmInstance.listSelections();
    let posText = `Ln ${pos.line + 1}, Col ${pos.ch + 1}`;
    if (sels.length > 1) posText += `  (${sels.length} cursors)`;
    statusBar.querySelector('.stru-pos').textContent = posText;
    statusBar.querySelector('.stru-info').textContent =
      `${getSetting('fontSize')}px · ${getSetting('theme')}`;
  }

  // ── Apply settings ──────────────────────────────────────────────────
  function applyFontToEditor() {
    if (!cmInstance) return;
    const el = cmInstance.getWrapperElement();
    // Use setProperty with !important to override Sailthru's @layer app { #app * { font-family } }
    el.style.setProperty('font-family', getSetting('fontFamily'), 'important');
    el.style.setProperty('font-size', getSetting('fontSize') + 'px', 'important');
    el.style.lineHeight = String(getSetting('lineHeight'));
  }

  function applyAllSettings() {
    if (!cmInstance) return;
    cmInstance.setOption('theme', getThemeName());
    cmInstance.setOption('lineNumbers', getSetting('lineNumbers'));
    cmInstance.setOption('lineWrapping', getSetting('wordWrap'));
    cmInstance.setOption('tabSize', getSetting('tabSize'));
    cmInstance.setOption('indentUnit', getSetting('tabSize'));
    applyFontToEditor();
    cmInstance.refresh();
    updateStatus();
    if (statusBar) {
      statusBar.className = `stru-cm-bar ${getSetting('theme')}`;
    }
  }

  // ── Greasemonkey menu (single entry) ────────────────────────────────
  GM_registerMenuCommand('⚙️ Editor Settings', openSettingsModal);

  // ── SPA observer ────────────────────────────────────────────────────
  let initialized = false;

  function tryInit() {
    if (initialized) return;
    const ta = document.querySelector('textarea[data-testid="include-snippet-code"]');
    if (!ta || typeof CodeMirror === 'undefined') return;
    initialized = true;
    buildEditor(ta);
  }

  function watchForRemoval() {
    new MutationObserver(() => {
      if (initialized) {
        const existing = document.querySelector('.stru-cm-wrap');
        if (!existing || !document.contains(existing)) {
          initialized = false;
          cmInstance = null;
          statusBar = null;
          tryInit();
        }
      } else {
        tryInit();
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  // ── Bootstrap ───────────────────────────────────────────────────────
  async function main() {
    injectCustomStyles();
    await loadAssets();
    tryInit();
    watchForRemoval();
  }

  main().catch((err) => console.error('[Sailthru Snippet Code Editor]', err));
})();
