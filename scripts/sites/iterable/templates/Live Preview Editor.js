// ==UserScript==
// @name         Iterable - Live Preview Editor
// @namespace    https://github.com/ColinWhelan
// @version      3.2.0
// @description  Live preview sidebar with sync indicator, user data preview, inline profile data pusher, customizable Ace keybindings, custom fonts. All-in-one template dev tool.
// @author       Colin Whelan
// @match        https://app.iterable.com/templates/editor?templateId=*
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';

  // ── Constants & Config ──────────────────────────────────
  const SCRIPT_NAME = 'LivePreview';
  const LP = 'lp';

  const ACE_COMMAND_BANK = [
    { name: 'refreshPreview', desc: '↻ Refresh Preview', exec: () => triggerRefresh() },
    { name: 'selectNextOccurrence', desc: 'Select next occurrence', exec: (ed) => {
      if (!ed.getSelectedText()) { ed.selection.selectWord(); return; }
      const Search = ace.require('ace/search').Search;
      const s = new Search(); s.setOptions({ needle: ed.getSelectedText(), wrap: true, caseSensitive: true });
      s.$options.start = ed.selection.getRange().end;
      const r = s.find(ed.session); if (r) ed.selection.addRange(r);
    }},
    { name: 'deleteLine', desc: 'Delete line', exec: (ed) => ed.removeLines() },
    { name: 'duplicateLine', desc: 'Duplicate line/selection', exec: (ed) => ed.duplicateSelection() },
    { name: 'moveLineUp', desc: 'Move line up', exec: (ed) => ed.moveLinesUp() },
    { name: 'moveLineDown', desc: 'Move line down', exec: (ed) => ed.moveLinesDown() },
    { name: 'selectAll', desc: 'Select all', exec: (ed) => ed.selectAll() },
    { name: 'toggleComment', desc: 'Toggle comment', exec: (ed) => ed.toggleCommentLines() },
    { name: 'toUpperCase', desc: 'Transform to uppercase', exec: (ed) => ed.toUpperCase() },
    { name: 'toLowerCase', desc: 'Transform to lowercase', exec: (ed) => ed.toLowerCase() },
    { name: 'blockIndent', desc: 'Indent selection', exec: (ed) => ed.blockIndent() },
    { name: 'blockOutdent', desc: 'Outdent selection', exec: (ed) => ed.blockOutdent() },
    { name: 'joinLines', desc: 'Join lines', exec: (ed) => { const r = ed.selection.getRange(); ed.session.replace(r, ed.session.getTextRange(r).replace(/\n\s*/g, ' ')); }},
    { name: 'sortLinesAsc', desc: 'Sort lines (A→Z)', exec: (ed) => ed.sortLines() },
    { name: 'foldAll', desc: 'Fold all', exec: (ed) => ed.session.foldAll() },
    { name: 'unfoldAll', desc: 'Unfold all', exec: (ed) => ed.session.unfold() },
    { name: 'find', desc: 'Find', exec: (ed) => ed.execCommand('find') },
    { name: 'replace', desc: 'Find & Replace', exec: (ed) => ed.execCommand('replace') },
  ];

  const DEFAULT_KEYBINDINGS = [
    { name: 'selectNextOccurrence', keys: 'Ctrl+D' },
    { name: 'deleteLine',           keys: 'Ctrl+Shift+K' },
    { name: 'duplicateLine',         keys: 'Ctrl+Shift+D' },
    { name: 'moveLineUp',           keys: 'Alt+Up' },
    { name: 'moveLineDown',         keys: 'Alt+Down' },
  ];

  const DEFAULT_SNIPPETS = [
    { name: '{{#assign}}', body: '{{#assign "${1:varName}" }}VALUE{{/assign}}$0' },
    { name: '{{#if}}', body: '{{#if ${1:condition}}}\nOUTPUT\n{{/if}}$0' },
    { name: '{{#each}}', body: '{{#each ${1:array}}}\nOUTPUT\n{{/each}}$0' },
    { name: '{{#unless}}', body: '{{#unless ${1:condition}}}\nOUTPUT\n{{/unless}}$0' },
    { name: '{{{snippet}}}', body: '{{{ snippet "${1:name}" }}}$0' },
  ];

  const DEFAULT_CONFIG = {
    previewWidth: 50,
    shortcut: 'Ctrl+S',
    fontFamily: 'Fira Code',
    fontSize: 13,
    userDataEmail: '',
    customTestData: '{}',
    savedPayloads: [],
    apiKeys: [],
    activeApiKeyId: '',
    keybindings: null,
    snippets: null,
    recentFields: [],
    maxRecent: 10,
  };

  const FONT_OPTIONS = [
    { label: 'Default (System)', value: '' },
    { label: 'Fira Code', value: 'Fira Code' },
    { label: 'JetBrains Mono', value: 'JetBrains Mono' },
  ];

  // ── Utilities ───────────────────────────────────────────
  const log = (msg, ...args) => console.log(`[${SCRIPT_NAME}]`, msg, ...args);
  const warn = (msg, ...args) => console.warn(`[${SCRIPT_NAME}]`, msg, ...args);

  function waitForElement(selector, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const observer = new MutationObserver((_, obs) => {
        const el = document.querySelector(selector);
        if (el) { obs.disconnect(); resolve(el); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); reject(new Error(`Timeout: ${selector}`)); }, timeout);
    });
  }

  function getActiveKeybindings() { return config.keybindings || DEFAULT_KEYBINDINGS; }
  function getActiveSnippets() { return config.snippets || DEFAULT_SNIPPETS; }

  // ── Snippet Engine (simplified — from your latest) ──────
  function insertSnippet(editor, snippetBody) {
    if (!editor) return;
    const Range = ace.require('ace/range').Range;
    const session = editor.session;
    let cleanBody = '', remaining = snippetBody, firstStops = [], finalCursorOffset = null;
    while (remaining.length > 0) {
      const namedMatch = remaining.match(/^\$\{(\d+):([^}]*)\}/);
      if (namedMatch) {
        const num = parseInt(namedMatch[1], 10), placeholder = namedMatch[2];
        if (num === 1) firstStops.push({ start: cleanBody.length, end: cleanBody.length + placeholder.length });
        if (num === 0) finalCursorOffset = cleanBody.length;
        cleanBody += placeholder; remaining = remaining.slice(namedMatch[0].length); continue;
      }
      const bareMatch = remaining.match(/^\$(\d+)/);
      if (bareMatch) {
        const num = parseInt(bareMatch[1], 10);
        if (num === 1) firstStops.push({ start: cleanBody.length, end: cleanBody.length });
        if (num === 0) finalCursorOffset = cleanBody.length;
        remaining = remaining.slice(bareMatch[0].length); continue;
      }
      cleanBody += remaining[0]; remaining = remaining.slice(1);
    }
    const sel = editor.getSelection(), range = sel.getRange(), hasSelection = !range.isEmpty();
    const insertRow = hasSelection ? range.start.row : editor.getCursorPosition().row;
    const insertCol = hasSelection ? range.start.column : editor.getCursorPosition().column;
    if (hasSelection) session.replace(range, cleanBody); else session.insert({ row: insertRow, column: insertCol }, cleanBody);
    function offsetToPos(offset) {
      const before = cleanBody.slice(0, offset), lines = before.split('\n');
      return { row: insertRow + lines.length - 1, column: lines.length === 1 ? insertCol + lines[0].length : lines[lines.length - 1].length };
    }
    const endPos = offsetToPos(finalCursorOffset !== null ? finalCursorOffset : cleanBody.length);
    if (firstStops.length) {
      editor.selection.clearSelection();
      editor.selection.setSelectionRange(new Range(offsetToPos(firstStops[0].start).row, offsetToPos(firstStops[0].start).column, offsetToPos(firstStops[0].end).row, offsetToPos(firstStops[0].end).column));
      for (let i = 1; i < firstStops.length; i++) {
        const s = firstStops[i], start = offsetToPos(s.start), end = offsetToPos(s.end);
        editor.selection.addRange(new Range(start.row, start.column, end.row, end.column));
      }
    } else { editor.moveCursorToPosition(endPos); editor.clearSelection(); }
    const cmdName = 'snippetSingleTabExit';
    editor.commands.addCommand({ name: cmdName, bindKey: { win: 'Tab', mac: 'Tab' }, exec: () => {
      editor.moveCursorToPosition(endPos); editor.clearSelection(); editor.commands.removeCommand(cmdName);
    }, readOnly: false });
    editor.focus();
  }

  // ── State ───────────────────────────────────────────────
  let config = getConfig();
  let isInitialized = false;
  let previewIframe = null, refreshBtn = null;
  let isSynced = true, isRefreshing = false, needsRefreshAfter = false;
  let aceEditorInstance = null, staticIframe = null, resizerEl = null, activeView = 'live';
  let emailInput = null, overridesIndicator = null;
  let customJsonTextarea = null;
  let cachedFieldSchema = null, cachedFieldSchemaTime = 0;
  const FIELD_CACHE_TTL = 5 * 60 * 1000;
  const testDataOverrides = new Map();

  // ── Config Persistence ──────────────────────────────────
  function getConfig() {
    try { const saved = GM_getValue('config', '{}'); return { ...DEFAULT_CONFIG, ...JSON.parse(saved) }; }
    catch (e) { return { ...DEFAULT_CONFIG }; }
  }
  function saveConfigToStorage(newConfig) { GM_setValue('config', JSON.stringify(newConfig)); config = newConfig; }

  // ── Sync State ──────────────────────────────────────────
  function setSyncState(state) {
    if (!refreshBtn) return;
    switch (state) {
      case 'synced': isSynced = true; isRefreshing = false;
        refreshBtn.classList.remove(`${LP}-btn-dirty`); refreshBtn.textContent = '↻ Refresh Preview'; break;
      case 'dirty': isSynced = false;
        refreshBtn.classList.add(`${LP}-btn-dirty`); refreshBtn.textContent = '↻ Refresh Preview'; break;
      case 'loading': isRefreshing = true;
        refreshBtn.classList.remove(`${LP}-btn-dirty`); refreshBtn.textContent = '↻ Refreshing…'; break;
    }
  }

  // ── Core: Save & Refresh ────────────────────────────────
  async function triggerRefresh() {
    if (isRefreshing) { needsRefreshAfter = true; return; }
    const templateId = new URLSearchParams(window.location.search).get('templateId');
    if (!templateId) { warn('No templateId in URL'); return; }
    setSyncState('loading');
    const unsavedEl = document.querySelector('[data-test="last-saved-indicator"] span');
    const hasUnsaved = unsavedEl?.textContent === 'There are unsaved changes';
    if (hasUnsaved) { document.querySelector('[data-test="btn-save-design"]')?.click(); await new Promise(r => setTimeout(r, 1500)); }
    try { await setTestUserData(templateId); } catch (e) { warn('Failed to set test user data', e); }
    await new Promise(r => setTimeout(r, 200));
    loadPreviewFromServer(templateId);
  }

  // ── XSRF + Internal API ─────────────────────────────────
  function getXsrfToken() { const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/); return m ? decodeURIComponent(m[1]) : null; }

  async function fetchUserData(email) {
    const r = await fetch(`https://app.iterable.com/users/profiles/getUserData?email=${encodeURIComponent(email)}`, { credentials: 'include' });
    if (!r.ok) throw new Error(`getUserData: ${r.status}`); return r.json();
  }

  async function setTestUserData(templateId) {
    let userJson = {};

    // Always use the JSON editor content as test data
    const getJson = window[`${LP}_getJson`];
    const raw = getJson ? getJson() : (config.customTestData || '{}');
    try { userJson = JSON.parse(raw); } catch (e) { warn('Invalid test JSON, using {}'); userJson = {}; }

    // Merge overrides from Push Data on top
    if (testDataOverrides.size > 0) {
      for (const [field, value] of testDataOverrides) userJson[field] = value;
      log('Applied', testDataOverrides.size, 'field override(s) to test data');
    }

    const xsrf = getXsrfToken();
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/plain, */*' };
    if (xsrf) headers['X-XSRF-TOKEN'] = xsrf;
    const r = await fetch('https://app.iterable.com/templates/saveJsonTestDataReturningRenderedData', {
      method: 'POST', credentials: 'include', headers,
      body: JSON.stringify({ jsonTestData: { dataFeedJson: {}, userJson }, payload: {}, templateId: parseInt(templateId, 10), subject: '', webBody: '', webTitle: '' }),
    });
    if (!r.ok) throw new Error(`saveJsonTestData: ${r.status}`);
    return r.json();
  }

  function loadPreviewFromServer(templateId) {
    if (!previewIframe) return;
    const url = `https://app.iterable.com/templates/showHtml?templateId=${templateId}&_t=${Date.now()}`;
    let scrollY = 0; try { scrollY = previewIframe.contentWindow?.scrollY || 0; } catch (e) {}
    previewIframe.onload = () => {
      try { previewIframe.contentWindow?.scrollTo(0, scrollY); } catch (e) {}
      setSyncState('synced');
      if (needsRefreshAfter) { needsRefreshAfter = false; setTimeout(triggerRefresh, 300); }
    };
    previewIframe.src = url;
  }

  // ── Iterable Public API ─────────────────────────────────
  function getActiveApiKey() {
    const keys = config.apiKeys || [];
    if (config.apiKey && keys.length === 0) { keys.push({ id: Date.now().toString(), label: 'Default', key: config.apiKey }); config.apiKeys = keys; config.activeApiKeyId = keys[0].id; delete config.apiKey; saveConfigToStorage(config); }
    if (keys.length === 0) return null;
    return keys.find(k => k.id === config.activeApiKeyId) || keys[0] || null;
  }
  function apiRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const activeKey = getActiveApiKey();
      if (!activeKey?.key) { reject(new Error('No API key. Add one in Settings.')); return; }
      const opts = { method, url: `https://api.iterable.com${path}`, headers: { 'Content-Type': 'application/json', 'Api-Key': activeKey.key },
        onload: (r) => { try { const d = JSON.parse(r.responseText); r.status >= 200 && r.status < 300 ? resolve(d) : reject(new Error(d.msg || `API ${r.status}`)); } catch (e) { reject(new Error(`Parse error`)); } },
        onerror: (e) => reject(new Error(`Network error`)),
      };
      if (body) opts.data = JSON.stringify(body);
      GM_xmlhttpRequest(opts);
    });
  }
  async function getFieldSchema() {
    if (cachedFieldSchema && (Date.now() - cachedFieldSchemaTime) < FIELD_CACHE_TTL) return cachedFieldSchema;
    const data = await apiRequest('GET', '/api/users/getFields'); cachedFieldSchema = data.fields || {}; cachedFieldSchemaTime = Date.now(); return cachedFieldSchema;
  }
  async function getUserByEmail(email) { return apiRequest('GET', `/api/users/${encodeURIComponent(email)}`); }
  async function updateUserProfile(email, dataFields) { return apiRequest('POST', '/api/users/update', { email, dataFields, mergeNestedObjects: false }); }

  // ── Value Parsing ───────────────────────────────────────
  function parseInputValue(raw) {
    const t = raw.trim(); if (t === '') return { value: '', type: 'string' };
    try { const p = JSON.parse(t); return { value: p, type: detectType(p) }; } catch (e) {}
    if (t.toLowerCase() === 'true') return { value: true, type: 'boolean' };
    if (t.toLowerCase() === 'false') return { value: false, type: 'boolean' };
    if (/^-?\d+$/.test(t)) return { value: parseInt(t, 10), type: 'long' };
    if (/^-?\d+\.\d+$/.test(t)) return { value: parseFloat(t), type: 'double' };
    return { value: t, type: 'string' };
  }
  function detectType(v) { if (v === null || v === undefined) return 'string'; if (typeof v === 'boolean') return 'boolean'; if (typeof v === 'number') return Number.isInteger(v) ? 'long' : 'double'; if (typeof v === 'string') return 'string'; if (Array.isArray(v)) return v.length ? `array(${detectType(v[0])})` : 'array'; if (typeof v === 'object') return 'object'; return 'string'; }
  function isTypeCompatible(existing, incoming) { if (!existing) return true; const e = existing.toLowerCase(), i = incoming.toLowerCase(); if (e === i) return true; if ((e === 'long' || e === 'double') && (i === 'long' || i === 'double')) return true; if (i.startsWith('array(')) { const elem = i.match(/array\((.+)\)/)?.[1]; if (elem && (elem === e || ((e === 'long' || e === 'double') && (elem === 'long' || elem === 'double')))) return true; } return false; }
  function validateJson(raw) { const t = raw.trim(); if (!t) return { valid: false, error: 'Value is empty' }; try { const parsed = JSON.parse(t); return { valid: true, minified: JSON.stringify(parsed), parsed }; } catch (e) { const { value } = parseInputValue(t); return { valid: true, minified: JSON.stringify(value), parsed: value }; } }
  function addRecentField(fieldName) { const recent = (config.recentFields || []).filter(f => f !== fieldName); recent.unshift(fieldName); config.recentFields = recent.slice(0, config.maxRecent || 10); saveConfigToStorage(config); }

  // ── Ace Editor ──────────────────────────────────────────
  function hookEditorChanges(editorContainer) {
    // Target Iterable's specific editor by ID — not generic .ace_editor which would match our JSON editor too
    const aceEl = document.getElementById('content-editor-ace') || editorContainer.querySelector('.ace_editor');
    if (!aceEl) { warn('No Ace editor found'); return; }
    try { aceEditorInstance = ace.edit(aceEl); } catch (e) { if (aceEl.id) try { aceEditorInstance = ace.edit(aceEl.id); } catch (e2) {} }
    if (!aceEditorInstance) { const ta = aceEl.querySelector('textarea.ace_text-input'); if (ta) ta.addEventListener('input', () => { if (isSynced) setSyncState('dirty'); }); return; }
    aceEditorInstance.session.on('change', () => { if (isSynced) setSyncState('dirty'); });
    aceEditorInstance.setOption('scrollPastEnd', 0.8);
    applyAceKeybindings(aceEditorInstance);
  }
  function applyAceKeybindings(editor) {
    getActiveKeybindings().forEach(binding => {
      const cmd = ACE_COMMAND_BANK.find(c => c.name === binding.name); if (!cmd) return;
      const aceKey = binding.keys.replace(/\+/g, '-');
      editor.commands.addCommand({ name: cmd.name, bindKey: { win: aceKey, mac: aceKey.replace(/Ctrl/g, 'Cmd') }, exec: cmd.exec, readOnly: false });
    });
    getActiveSnippets().forEach(snip => {
      if (!snip.shortcutKey) return;
      const aceKey = snip.shortcutKey.replace(/\+/g, '-');
      editor.commands.addCommand({ name: `snippet_${snip.name}`, bindKey: { win: aceKey, mac: aceKey.replace(/Ctrl/g, 'Cmd') }, exec: (ed) => insertSnippet(ed, snip.body), readOnly: false });
    });
    log('Ace keybindings applied');
  }

  // ── Keyboard Shortcut (Refresh) ─────────────────────────
  function parseShortcut(str) { const p = str.split('+').map(s => s.trim().toLowerCase()); return { ctrl: p.includes('ctrl'), shift: p.includes('shift'), alt: p.includes('alt'), meta: p.includes('meta') || p.includes('cmd'), key: p.filter(k => !['ctrl','shift','alt','meta','cmd'].includes(k))[0] || '' }; }
  function matchesShortcut(e, s) { if (s.ctrl !== e.ctrlKey || s.shift !== e.shiftKey || s.alt !== e.altKey || s.meta !== e.metaKey) return false; return (e.key.toLowerCase() === ' ' ? 'space' : e.key.toLowerCase()) === s.key; }
  function setupKeyboardShortcut() {
    // Collect all shortcuts that should trigger refresh:
    // 1. The global refresh shortcut from config
    // 2. Any keybindings mapped to 'refreshPreview'
    const refreshShortcuts = [parseShortcut(config.shortcut)];

    const bindings = getActiveKeybindings();
    bindings.forEach(b => {
      if (b.name === 'refreshPreview' && b.keys) {
        refreshShortcuts.push(parseShortcut(b.keys));
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.target.closest(`.${LP}-settings-overlay, .${LP}-pusher-overlay`)) return;
      for (const shortcut of refreshShortcuts) {
        if (matchesShortcut(e, shortcut)) {
          e.preventDefault(); e.stopPropagation();
          // If inside the JSON editor, save content first
          const getJson = window[`${LP}_getJson`];
          if (getJson) { config.customTestData = getJson(); saveConfigToStorage(config); }
          triggerRefresh();
          return;
        }
      }
    }, true);
  }

  // ── UI: Preview Sidebar ─────────────────────────────────
  function createPreviewSidebar(editorContainer) {
    staticIframe = editorContainer.querySelector('iframe[data-test="secure-iframe-full"]');
    resizerEl = editorContainer.querySelector('[data-test="sbs-resizer"]');
    if (staticIframe) staticIframe.style.display = 'none';
    if (resizerEl) resizerEl.style.display = 'none';
    const sidebar = document.createElement('div'); sidebar.id = `${LP}-sidebar`;
    const toggleBar = document.createElement('div'); toggleBar.className = `${LP}-toggle-bar`;
    ['Live Preview', 'Static Preview'].forEach((label, i) => {
      const btn = document.createElement('button'); btn.className = `${LP}-toggle-btn${i === 0 ? ` ${LP}-toggle-active` : ''}`;
      btn.textContent = label; btn.dataset.view = i === 0 ? 'live' : 'static'; toggleBar.appendChild(btn);
    });
    sidebar.appendChild(toggleBar);
    toggleBar.addEventListener('click', (e) => { const btn = e.target.closest(`.${LP}-toggle-btn`); if (!btn || btn.dataset.view === activeView) return; switchPreviewView(btn.dataset.view, sidebar); toggleBar.querySelectorAll(`.${LP}-toggle-btn`).forEach(b => b.classList.remove(`${LP}-toggle-active`)); btn.classList.add(`${LP}-toggle-active`); });
    previewIframe = document.createElement('iframe'); previewIframe.id = `${LP}-iframe`;
    const iframeWrap = document.createElement('div'); iframeWrap.className = `${LP}-iframe-wrap`; iframeWrap.appendChild(previewIframe);
    sidebar.appendChild(iframeWrap);
    const resizer = document.createElement('div'); resizer.className = `${LP}-resizer`;
    editorContainer.appendChild(resizer); editorContainer.appendChild(sidebar);
    setupResizer(resizer, editorContainer); applyPreviewWidth(editorContainer);
  }
  function switchPreviewView(view, sidebar) {
    activeView = view; const wrap = sidebar.querySelector(`.${LP}-iframe-wrap`);
    if (view === 'static') { if (wrap) wrap.style.display = 'none'; if (staticIframe) { staticIframe.style.display = ''; if (staticIframe.parentNode !== sidebar) sidebar.appendChild(staticIframe); Object.assign(staticIframe.style, { flex:'1', width:'100%', minHeight:'0', border:'none' }); } }
    else { if (staticIframe) staticIframe.style.display = 'none'; if (wrap) wrap.style.display = ''; }
  }

  // ── UI: Refresh Bar (single HTML template) ───────────────
  function createRefreshBar(editorContainer) {
    const editorPane = editorContainer.children[0];
    if (!editorPane || editorPane.id === `${LP}-sidebar`) return;

    const bar = document.createElement('div');
    bar.className = `${LP}-refresh-bar`;
    bar.id = `${LP}-bar`;

    // Payload bubbles HTML
    const payloadsHtml = (config.savedPayloads || []).map((p, i) =>
      `<span class="${LP}-payload-bubble" data-idx="${i}" title="Click to load. Right-click to delete.">${p.name}</span>`
    ).join('');

    bar.innerHTML = `
      <div class="${LP}-bar-row">
        <div class="${LP}-email-wrap">
          <input type="email" class="${LP}-email-input" id="${LP}-email" placeholder="user@example.com" value="${(config.userDataEmail || '').replace(/"/g, '&quot;')}">
          <button class="${LP}-bar-btn" id="${LP}-load-btn" title="Fetch profile data into JSON editor">⬇ Load Profile</button>
          <button class="${LP}-bar-btn" id="${LP}-push-btn" title="Push a field to this user's profile">⬆ Push New Value</button>
        </div>
        <div class="${LP}-payload-bubbles" id="${LP}-payload-bubbles">${payloadsHtml}</div>
        <div class="${LP}-overrides" id="${LP}-overrides" style="display:none"></div>
        <div class="${LP}-bar-right">
          <button class="${LP}-bar-btn" id="${LP}-save-json-btn" title="Save current JSON as a named payload">💾 Save JSON</button>
          <button class="${LP}-refresh-btn" id="${LP}-refresh-btn" title="Save & refresh preview (${config.shortcut})">↻ Refresh Preview</button>
        </div>
      </div>
      <div class="${LP}-bar-row ${LP}-json-row">
        <div class="${LP}-json-wrap" id="${LP}-json-wrap">
          <div class="${LP}-json-ace" id="${LP}-json-ace"></div>
          <button class="${LP}-json-popout" id="${LP}-json-popout" title="Edit JSON in larger window">⛶</button>
        </div>
      </div>
    `;

    editorPane.insertBefore(bar, editorPane.firstChild);

    // ── Grab refs ──
    refreshBtn = bar.querySelector(`#${LP}-refresh-btn`);
    emailInput = bar.querySelector(`#${LP}-email`);
    overridesIndicator = bar.querySelector(`#${LP}-overrides`);

    // ── JSON Ace Editor ──
    const jsonAceEl = bar.querySelector(`#${LP}-json-ace`);
    let jsonAceEditor = null;
    try {
      jsonAceEditor = ace.edit(jsonAceEl);
      jsonAceEditor.setOptions({
        mode: 'ace/mode/json',
        theme: 'ace/theme/monokai',
        fontSize: 12,
        showPrintMargin: false,
        showGutter: false,
        highlightActiveLine: false,
        wrap: true,
        minLines: 3,
        maxLines: 12,
        tabSize: 2,
        useSoftTabs: true,
        scrollPastEnd: 0,
      });
      // Set initial content
      let initJson = config.customTestData || '{}';
      try { initJson = JSON.stringify(JSON.parse(initJson), null, 2); } catch (e) {}
      jsonAceEditor.setValue(initJson, -1);
      jsonAceEditor.clearSelection();

      // Auto-save on change (debounced) + mark dirty
      let jsonSaveTimer;
      jsonAceEditor.session.on('change', () => {
        if (isSynced) setSyncState('dirty');
        clearTimeout(jsonSaveTimer);
        jsonSaveTimer = setTimeout(() => {
          config.customTestData = jsonAceEditor.getValue();
          saveConfigToStorage(config);
        }, 500);
      });

      // Refresh shortcut works inside JSON editor
      const shortcut = parseShortcut(config.shortcut);
      jsonAceEditor.commands.addCommand({
        name: 'refreshFromJson',
        bindKey: { win: config.shortcut.replace(/\+/g, '-'), mac: config.shortcut.replace(/\+/g, '-').replace(/Ctrl/g, 'Cmd') },
        exec: () => {
          config.customTestData = jsonAceEditor.getValue();
          saveConfigToStorage(config);
          triggerRefresh();
        },
        readOnly: false,
      });

      // Format on Ctrl+Shift+F inside JSON editor
      jsonAceEditor.commands.addCommand({
        name: 'formatJson',
        bindKey: { win: 'Ctrl-Shift-F', mac: 'Cmd-Shift-F' },
        exec: () => {
          try {
            const formatted = JSON.stringify(JSON.parse(jsonAceEditor.getValue()), null, 2);
            jsonAceEditor.setValue(formatted, -1);
            jsonAceEditor.clearSelection();
          } catch (e) {}
        },
        readOnly: false,
      });
    } catch (e) {
      warn('Could not create JSON Ace editor, falling back to textarea', e);
      // Fallback: plain textarea
      jsonAceEl.style.display = 'none';
      const ta = document.createElement('textarea');
      ta.className = `${LP}-custom-json-fallback`;
      ta.value = config.customTestData || '{}';
      ta.spellcheck = false;
      ta.addEventListener('input', () => { config.customTestData = ta.value; saveConfigToStorage(config); });
      jsonAceEl.parentNode.insertBefore(ta, jsonAceEl);
      // Wire up the customJsonTextarea ref to the fallback
      customJsonTextarea = ta;
    }

    // Expose a getter so other parts of the script can read the JSON content
    function getJsonEditorValue() {
      if (jsonAceEditor) return jsonAceEditor.getValue();
      if (customJsonTextarea) return customJsonTextarea.value;
      return config.customTestData || '{}';
    }
    function setJsonEditorValue(val) {
      if (jsonAceEditor) { jsonAceEditor.setValue(val, -1); jsonAceEditor.clearSelection(); }
      else if (customJsonTextarea) customJsonTextarea.value = val;
      config.customTestData = val;
      saveConfigToStorage(config);
    }
    // Store these on the window-scoped state so other functions can use them
    window[`${LP}_getJson`] = getJsonEditorValue;
    window[`${LP}_setJson`] = setJsonEditorValue;

    // ── Event handlers ──
    const saveEmail = () => { const v = emailInput.value.trim(); if (v !== config.userDataEmail) { config.userDataEmail = v; saveConfigToStorage(config); } };
    emailInput.addEventListener('blur', saveEmail);
    emailInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveEmail(); loadProfileIntoEditor(); } });

    bar.querySelector(`#${LP}-load-btn`).addEventListener('click', loadProfileIntoEditor);
    bar.querySelector(`#${LP}-push-btn`).addEventListener('click', () => showPusherModal());
    bar.querySelector(`#${LP}-save-json-btn`).addEventListener('click', () => saveCurrentPayload());
    refreshBtn.addEventListener('click', triggerRefresh);
    bar.querySelector(`#${LP}-json-popout`).addEventListener('click', showJsonPopout);
    bindPayloadBubbles();

    setSyncState('synced');
    renderSnippetBar(editorPane, bar);
  }

  // ── Payload Bubbles (event delegation) ──────────────────
  function bindPayloadBubbles() {
    const container = document.getElementById(`${LP}-payload-bubbles`);
    if (!container) return;
    container.addEventListener('click', (e) => {
      const bubble = e.target.closest(`.${LP}-payload-bubble`);
      if (!bubble) return;
      const idx = parseInt(bubble.dataset.idx);
      const payload = config.savedPayloads?.[idx];
      if (!payload) return;
      const setJson = window[`${LP}_setJson`];
      let formatted;
      try { formatted = JSON.stringify(JSON.parse(payload.data), null, 2); } catch (e) { formatted = payload.data; }
      if (setJson) setJson(formatted);
      triggerRefresh();
    });
    container.addEventListener('contextmenu', (e) => {
      const bubble = e.target.closest(`.${LP}-payload-bubble`);
      if (!bubble) return;
      e.preventDefault();
      const idx = parseInt(bubble.dataset.idx);
      const name = config.savedPayloads?.[idx]?.name;
      if (confirm(`Delete saved payload "${name}"?`)) {
        config.savedPayloads.splice(idx, 1);
        saveConfigToStorage(config);
        renderPayloadBubbles();
      }
    });
  }

  function renderPayloadBubbles() {
    const container = document.getElementById(`${LP}-payload-bubbles`);
    if (!container) return;
    const payloads = config.savedPayloads || [];
    container.innerHTML = payloads.map((p, i) =>
      `<span class="${LP}-payload-bubble" data-idx="${i}" title="Click to load + refresh. Right-click to delete.">${p.name}</span>`
    ).join('');
  }

  function saveCurrentPayload() {
    const getJson = window[`${LP}_getJson`];
    const raw = getJson ? getJson() : (config.customTestData || '{}');
    try { JSON.parse(raw); } catch (e) { alert('Fix JSON errors before saving.'); return; }
    const name = prompt('Name for this payload:');
    if (!name?.trim()) return;
    if (!config.savedPayloads) config.savedPayloads = [];
    const existing = config.savedPayloads.findIndex(p => p.name === name.trim());
    if (existing >= 0) config.savedPayloads[existing].data = raw;
    else config.savedPayloads.push({ name: name.trim(), data: raw });
    saveConfigToStorage(config);
    renderPayloadBubbles();
    log('Payload saved:', name.trim());
  }

  // ── JSON Popout Editor ──────────────────────────────────
  function showJsonPopout() {
    document.querySelector(`.${LP}-json-overlay`)?.remove();
    const getJson = window[`${LP}_getJson`];
    const setJson = window[`${LP}_setJson`];
    const currentJson = getJson ? getJson() : (config.customTestData || '{}');
    const overlay = document.createElement('div'); overlay.className = `${LP}-json-overlay`;
    overlay.innerHTML = `
      <div class="${LP}-json-modal">
        <div class="${LP}-modal-header"><h2>Test Data JSON</h2><button class="${LP}-modal-close" title="Close">&times;</button></div>
        <div class="${LP}-json-popout-ace" id="${LP}-json-popout-ace"></div>
        <div class="${LP}-modal-footer">
          <button class="${LP}-btn-secondary" id="${LP}-json-popout-format">Format</button>
          <div style="display:flex;gap:8px;">
            <button class="${LP}-btn-secondary ${LP}-json-popout-cancel">Cancel</button>
            <button class="${LP}-btn-primary" id="${LP}-json-popout-apply">Apply & Refresh</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Create Ace editor in the popout
    const popoutAceEl = overlay.querySelector(`#${LP}-json-popout-ace`);
    let popoutAce = null;
    try {
      popoutAce = ace.edit(popoutAceEl);
      popoutAce.setOptions({
        mode: 'ace/mode/json',
        theme: 'ace/theme/monokai',
        fontSize: 13,
        showPrintMargin: false,
        tabSize: 2,
        useSoftTabs: true,
        wrap: true,
      });
      let formatted;
      try { formatted = JSON.stringify(JSON.parse(currentJson), null, 2); } catch (e) { formatted = currentJson; }
      popoutAce.setValue(formatted, -1);
      popoutAce.clearSelection();
      popoutAce.focus();

      // Refresh shortcut in popout
      popoutAce.commands.addCommand({
        name: 'applyAndRefresh',
        bindKey: { win: config.shortcut.replace(/\+/g, '-'), mac: config.shortcut.replace(/\+/g, '-').replace(/Ctrl/g, 'Cmd') },
        exec: () => overlay.querySelector(`#${LP}-json-popout-apply`).click(),
        readOnly: false,
      });
    } catch (e) {
      // Fallback to textarea
      popoutAceEl.style.display = 'none';
      const ta = document.createElement('textarea');
      ta.className = `${LP}-json-popout-editor`;
      ta.value = currentJson;
      popoutAceEl.parentNode.insertBefore(ta, popoutAceEl.nextSibling);
    }

    const close = () => { if (popoutAce) popoutAce.destroy(); overlay.remove(); };
    overlay.querySelector(`.${LP}-modal-close`).addEventListener('click', close);
    overlay.querySelector(`.${LP}-json-popout-cancel`).addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector(`#${LP}-json-popout-format`).addEventListener('click', () => {
      if (!popoutAce) return;
      try { popoutAce.setValue(JSON.stringify(JSON.parse(popoutAce.getValue()), null, 2), -1); popoutAce.clearSelection(); } catch (e) {}
    });
    overlay.querySelector(`#${LP}-json-popout-apply`).addEventListener('click', () => {
      const val = popoutAce ? popoutAce.getValue() : overlay.querySelector('textarea')?.value;
      try { JSON.parse(val); } catch (e) { alert('Invalid JSON.'); return; }
      if (setJson) setJson(val);
      close();
      triggerRefresh();
    });
  }

  // ── Load Profile → JSON Editor ──────────────────────────
  async function loadProfileIntoEditor() {
    const email = emailInput?.value?.trim();
    if (!email) return;
    const loadBtn = document.querySelector(`#${LP}-load-btn`);
    if (loadBtn) { loadBtn.disabled = true; loadBtn.textContent = '⏳'; }
    try {
      const userData = await fetchUserData(email);
      const setJson = window[`${LP}_setJson`];
      if (setJson) setJson(JSON.stringify(userData, null, 2));
      config.userDataEmail = email;
      saveConfigToStorage(config);
      log('Profile loaded for:', email);
      triggerRefresh();
    } catch (e) {
      warn('Failed to load profile:', e);
    }
    if (loadBtn) { loadBtn.disabled = false; loadBtn.textContent = '⬇ Load'; }
  }

  function renderSnippetBar(editorPane, afterEl) {
    document.getElementById(`${LP}-snippet-bar`)?.remove();
    const snippets = getActiveSnippets(); if (snippets.length === 0) return;
    const snippetBar = document.createElement('div'); snippetBar.id = `${LP}-snippet-bar`; snippetBar.className = `${LP}-snippet-bar`;
    const label = document.createElement('span'); label.className = `${LP}-snippet-label`; label.textContent = 'Insert:'; snippetBar.appendChild(label);
    snippets.forEach(snip => {
      const btn = document.createElement('button'); btn.className = `${LP}-snippet-btn`; btn.textContent = snip.name;
      if (snip.shortcutKey) btn.title = `${snip.name} (${snip.shortcutKey})`;
      btn.addEventListener('click', () => { if (aceEditorInstance) insertSnippet(aceEditorInstance, snip.body); });
      snippetBar.appendChild(btn);
    });
    if (afterEl.nextSibling) editorPane.insertBefore(snippetBar, afterEl.nextSibling); else editorPane.appendChild(snippetBar);
  }

  function updateOverridesIndicator() {
    if (!overridesIndicator) return;
    if (testDataOverrides.size === 0) { overridesIndicator.style.display = 'none'; return; }
    const fields = [...testDataOverrides.keys()];
    const label = fields.length <= 3 ? fields.join(', ') : `${fields.slice(0, 2).join(', ')} +${fields.length - 2}`;
    overridesIndicator.style.display = 'flex';
    overridesIndicator.innerHTML = `<span class="${LP}-overrides-label" title="Overridden in test data:\n${fields.join('\n')}">⚡ ${label}</span><button class="${LP}-overrides-clear" title="Clear overrides">✕</button>`;
    overridesIndicator.querySelector(`.${LP}-overrides-clear`).addEventListener('click', () => { testDataOverrides.clear(); updateOverridesIndicator(); });
  }

  function applyPreviewWidth(ec) {
    const sb = document.getElementById(`${LP}-sidebar`); if (!sb) return; sb.style.width = `${config.previewWidth}%`;
    const c = ec || document.getElementById('content-editor-side-by-side'); if (!c) return;
    const p = c.children[0]; if (p && p.id !== `${LP}-sidebar`) { p.style.flex = 'none'; p.style.width = `${100 - config.previewWidth}%`; }
    if (aceEditorInstance) setTimeout(() => aceEditorInstance.resize(true), 50);
  }

  function setupResizer(rEl, ec) {
    let dragging = false, sX = 0, sW = 0;
    rEl.addEventListener('mousedown', (e) => { e.preventDefault(); dragging = true; sX = e.clientX; sW = ec.children[0].getBoundingClientRect().width; document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = 'none'); document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; document.addEventListener('mousemove', onM); document.addEventListener('mouseup', onU); });
    function onM(e) { if (!dragging) return; const cw = ec.getBoundingClientRect().width, nw = Math.max(cw*.25, Math.min(cw*.75, sW+(e.clientX-sX))), pct = (nw/cw)*100; const ep = ec.children[0], sb = document.getElementById(`${LP}-sidebar`); if (ep) { ep.style.width = `${pct}%`; ep.style.flex = 'none'; } if (sb) sb.style.width = `${100-pct}%`; }
    function onU() { if (!dragging) return; dragging = false; document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = ''); document.body.style.cursor = ''; document.body.style.userSelect = ''; document.removeEventListener('mousemove', onM); document.removeEventListener('mouseup', onU); const sb = document.getElementById(`${LP}-sidebar`), cw = ec.getBoundingClientRect().width; if (sb && cw) { config.previewWidth = Math.round((sb.getBoundingClientRect().width/cw)*100); saveConfigToStorage(config); } if (aceEditorInstance) setTimeout(() => aceEditorInstance.resize(true), 50); }
  }

  function applyEditorFont() {
    document.getElementById(`${LP}-font-override`)?.remove(); if (!config.fontFamily) return;
    const s = document.createElement('style'); s.id = `${LP}-font-override`;
    s.textContent = `.ace_editor,.ace_editor .ace_text-layer,.ace_editor .ace_gutter{font-family:'${config.fontFamily}','Cascadia Code','Consolas',monospace!important;font-size:${config.fontSize}px!important;font-variant-ligatures:common-ligatures!important;}`;
    document.head.appendChild(s); if (aceEditorInstance) setTimeout(() => aceEditorInstance.resize(true), 100);
  }

  // ── Profile Pusher Modal ────────────────────────────────
  function showPusherModal() {
    document.querySelector(`.${LP}-pusher-overlay`)?.remove();
    const email = emailInput?.value?.trim() || config.userDataEmail;
    if (!getActiveApiKey()?.key) { showSettingsModal(); return; }
    const overlay = document.createElement('div'); overlay.className = `${LP}-pusher-overlay`;
    const recentHtml = (config.recentFields || []).length > 0 ? `<div class="${LP}-recent-tags">${config.recentFields.map(f => `<span class="${LP}-recent-tag" data-field="${f}">${f}</span>`).join('')}</div>` : '';
    overlay.innerHTML = `<div class="${LP}-pusher-modal"><div class="${LP}-pusher-header"><h2>Push Profile Data</h2><button class="${LP}-modal-close" title="Close">&times;</button></div>
      <div class="${LP}-pusher-body">
        <div class="${LP}-pf-group"><label class="${LP}-pf-label">Email</label><input type="email" class="${LP}-pf-input" id="${LP}-pf-email" value="${email}" placeholder="user@example.com"></div>
        <div class="${LP}-pf-group"><label class="${LP}-pf-label">Field Name</label><input type="text" class="${LP}-pf-input" id="${LP}-pf-field" placeholder="my_custom_field">${recentHtml}</div>
        <div class="${LP}-pf-group"><label class="${LP}-pf-label">Value <span class="${LP}-pf-type-badge" id="${LP}-pf-type"></span></label>
          <textarea class="${LP}-pf-textarea" id="${LP}-pf-value" placeholder='[1, 2, 3]  or  {"key": "val"}  or  "hello"  or  42  or  true' rows="4"></textarea>
          <div class="${LP}-pf-hint">JSON auto-validated. Ctrl+Enter to push.</div></div>
        <div class="${LP}-pf-group" id="${LP}-pf-current-wrap" style="display:none;"><label class="${LP}-pf-label">Current Value on Profile</label><div class="${LP}-pf-current" id="${LP}-pf-current"></div></div>
        <div class="${LP}-pf-status" id="${LP}-pf-status"></div></div>
      <div class="${LP}-pusher-footer"><button class="${LP}-pf-btn ${LP}-pf-btn-secondary" id="${LP}-pf-check">Check Field</button>
        <div style="display:flex;gap:8px;"><button class="${LP}-pf-btn ${LP}-pf-btn-secondary ${LP}-pf-cancel">Cancel</button><button class="${LP}-pf-btn ${LP}-pf-btn-primary" id="${LP}-pf-push">Push & Refresh</button></div></div></div>`;
    document.body.appendChild(overlay);
    const pfEmail = overlay.querySelector(`#${LP}-pf-email`), pfField = overlay.querySelector(`#${LP}-pf-field`), pfValue = overlay.querySelector(`#${LP}-pf-value`);
    const pfType = overlay.querySelector(`#${LP}-pf-type`), pfStatus = overlay.querySelector(`#${LP}-pf-status`);
    const pfCheck = overlay.querySelector(`#${LP}-pf-check`), pfPush = overlay.querySelector(`#${LP}-pf-push`);
    const pfCurrentWrap = overlay.querySelector(`#${LP}-pf-current-wrap`), pfCurrent = overlay.querySelector(`#${LP}-pf-current`);
    const close = () => overlay.remove();
    overlay.querySelector(`.${LP}-modal-close`).addEventListener('click', close);
    overlay.querySelector(`.${LP}-pf-cancel`).addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
    overlay.querySelectorAll(`.${LP}-recent-tag`).forEach(tag => { tag.addEventListener('click', () => { pfField.value = tag.dataset.field; }); });
    let typeTimer; pfValue.addEventListener('input', () => { clearTimeout(typeTimer); typeTimer = setTimeout(() => { pfType.textContent = pfValue.value.trim() ? parseInputValue(pfValue.value.trim()).type : ''; }, 100); });
    function showPfStatus(msg, level) { pfStatus.textContent = msg; pfStatus.className = `${LP}-pf-status ${LP}-pf-status-${level}`; pfStatus.style.display = 'block'; }
    function setBtnLoading(btn, on) { if (on) { btn.disabled = true; btn._t = btn.textContent; btn.textContent = '⏳ Working…'; } else { btn.disabled = false; btn.textContent = btn._t || btn.textContent; } }
    pfCheck.addEventListener('click', async () => {
      const em = pfEmail.value.trim(), fld = pfField.value.trim();
      if (!em) { showPfStatus('Enter an email.', 'error'); return; } if (!fld) { showPfStatus('Enter a field name.', 'error'); return; }
      pfStatus.style.display = 'none'; setBtnLoading(pfCheck, true);
      try { const [schema, userData] = await Promise.all([getFieldSchema(), getUserByEmail(em).catch(() => null)]); if (!userData?.user) { showPfStatus(`User "${em}" not found.`, 'error'); setBtnLoading(pfCheck, false); return; } const ft = schema[fld]?.type, cv = userData.user[fld]; showPfStatus(ft ? `Field exists — type: ${ft}` : 'New field — will be created on push.', ft ? 'success' : 'info'); if (cv !== undefined && cv !== null) { pfCurrentWrap.style.display = 'block'; pfCurrent.textContent = JSON.stringify(cv, null, 2); } else pfCurrentWrap.style.display = 'none'; const raw = pfValue.value.trim(); if (raw && ft && !isTypeCompatible(ft, parseInputValue(raw).type)) showPfStatus(`Type mismatch! Field is ${ft}, value is ${parseInputValue(raw).type}.`, 'error'); } catch (e) { showPfStatus(e.message, 'error'); } setBtnLoading(pfCheck, false);
    });
    pfPush.addEventListener('click', async () => {
      const em = pfEmail.value.trim(), fld = pfField.value.trim(), raw = pfValue.value.trim();
      if (!em) { showPfStatus('Enter an email.', 'error'); return; } if (!fld) { showPfStatus('Enter a field name.', 'error'); return; } if (!raw) { showPfStatus('Enter a value.', 'error'); return; }
      const validation = validateJson(raw); if (!validation.valid) { showPfStatus(validation.error, 'error'); return; }
      const { type: newType } = parseInputValue(raw); pfStatus.style.display = 'none'; setBtnLoading(pfPush, true);
      try { const schema = await getFieldSchema(); const ft = schema[fld]?.type; if (ft && !isTypeCompatible(ft, newType)) { showPfStatus(`Type mismatch! Field is ${ft}, value is ${newType}. Aborting.`, 'error'); setBtnLoading(pfPush, false); return; }
        await updateUserProfile(em, { [fld]: validation.parsed }); addRecentField(fld); if (!ft) cachedFieldSchema = null;
        testDataOverrides.set(fld, validation.parsed); updateOverridesIndicator();
        if (emailInput && em !== emailInput.value) emailInput.value = em;
        config.userDataEmail = em; config.useUserData = true; saveConfigToStorage(config);
        if (userDataToggle) { userDataToggle.checked = true; emailInput.disabled = false; emailInput.style.opacity = '1'; }
        showPfStatus(`Pushed "${fld}" — override active, refreshing preview…`, 'success');
        setTimeout(() => { close(); triggerRefresh(); }, 800);
      } catch (e) { showPfStatus(e.message, 'error'); } setBtnLoading(pfPush, false);
    });
    pfValue.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); pfPush.click(); } });
    pfField.value ? pfValue.focus() : pfField.focus();
  }

  // ── Settings Modal ──────────────────────────────────────
  function showSettingsModal() {
    document.querySelector(`.${LP}-settings-overlay`)?.remove();
    const cc = getConfig(); const overlay = document.createElement('div'); overlay.className = `${LP}-settings-overlay`;
    overlay.innerHTML = `<div class="${LP}-settings-modal"><div class="${LP}-modal-header"><h2>Live Preview Settings</h2><button class="${LP}-modal-close" title="Close">&times;</button></div>
      <div class="${LP}-modal-body">
        <div class="${LP}-setting-group"><label class="${LP}-setting-label"><span>Preview Width (%)</span><div style="display:flex;align-items:center;gap:8px;"><input type="range" class="${LP}-range" data-key="previewWidth" min="25" max="75" step="5" value="${cc.previewWidth}"><span class="${LP}-range-value">${cc.previewWidth}%</span></div></label></div>
        <div class="${LP}-setting-group"><label class="${LP}-setting-label"><span>Refresh Shortcut</span><input type="text" class="${LP}-input ${LP}-shortcut-input" data-key="shortcut" value="${cc.shortcut}" readonly placeholder="Press keys…"></label><div class="${LP}-setting-hint">Click the field, then press your desired key combo</div></div>
        <div class="${LP}-setting-group"><label class="${LP}-setting-label"><span>Editor Font</span><select class="${LP}-select" data-key="fontFamily">${FONT_OPTIONS.map(f => `<option value="${f.value}" ${cc.fontFamily === f.value ? 'selected' : ''}>${f.label}</option>`).join('')}</select></label></div>
        <div class="${LP}-setting-group"><label class="${LP}-setting-label"><span>Font Size (px)</span><input type="number" class="${LP}-input" data-key="fontSize" value="${cc.fontSize}" min="10" max="24" step="1"></label></div>
        <div class="${LP}-setting-section"><h3 class="${LP}-section-title">API Keys</h3><div class="${LP}-setting-hint" style="margin-bottom:10px;">Server-side API keys for pushing profile data. One per project/space.</div>
          <div id="${LP}-apikeys-list"></div><button class="${LP}-btn-secondary" id="${LP}-apikey-add" style="margin-top:8px;padding:6px 12px;font-size:12px;">+ Add Key</button></div>
        <div class="${LP}-setting-section"><h3 class="${LP}-section-title">Editor Keybindings</h3><div class="${LP}-setting-hint" style="margin-bottom:10px;">Customizable shortcuts. Click a key field to re-bind.</div>
          <div id="${LP}-keybinds-list"></div><button class="${LP}-btn-secondary" id="${LP}-keybind-add" style="margin-top:8px;padding:6px 12px;font-size:12px;">+ Add Binding</button></div>
        <div class="${LP}-setting-section"><h3 class="${LP}-section-title">Quick Inserts</h3><div class="${LP}-setting-hint" style="margin-bottom:10px;">Buttons above the editor. Use \${1:placeholder} for auto-selected text, \$0 for final cursor.</div>
          <div id="${LP}-snippets-list"></div><button class="${LP}-btn-secondary" id="${LP}-snippet-add" style="margin-top:8px;padding:6px 12px;font-size:12px;">+ Add Insert</button></div>
      </div>
      <div class="${LP}-modal-footer"><button class="${LP}-btn-secondary ${LP}-modal-cancel">Cancel</button><button class="${LP}-btn-primary ${LP}-modal-save">Save</button></div></div>`;
    document.body.appendChild(overlay);

    // Range slider
    const rangeInput = overlay.querySelector('[data-key="previewWidth"]'), rangeValue = overlay.querySelector(`.${LP}-range-value`);
    rangeInput.addEventListener('input', () => { rangeValue.textContent = `${rangeInput.value}%`; });

    // Shortcut capture
    const shortcutInput = overlay.querySelector(`.${LP}-shortcut-input`);
    shortcutInput.addEventListener('keydown', (e) => { e.preventDefault(); e.stopPropagation(); const parts = []; if (e.ctrlKey) parts.push('Ctrl'); if (e.altKey) parts.push('Alt'); if (e.shiftKey) parts.push('Shift'); if (e.metaKey) parts.push('Meta'); if (['Control','Shift','Alt','Meta'].includes(e.key)) return; parts.push(e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key); shortcutInput.value = parts.join('+'); });

    // API Keys
    const apiKeysContainer = overlay.querySelector(`#${LP}-apikeys-list`);
    let workingKeys = JSON.parse(JSON.stringify(cc.apiKeys || [])), workingActiveId = cc.activeApiKeyId || '';
    if (cc.apiKey && workingKeys.length === 0) { workingKeys.push({ id: Date.now().toString(), label: 'Default', key: cc.apiKey }); workingActiveId = workingKeys[0].id; }
    function renderApiKeys() {
      apiKeysContainer.innerHTML = workingKeys.length === 0 ? `<div style="font-size:12px;color:var(--${LP}-subtext);padding:8px 0;">No API keys.</div>` :
        workingKeys.map((k, i) => `<div class="${LP}-apikey-row" data-idx="${i}"><input type="radio" name="${LP}-active-key" value="${k.id}" ${k.id === workingActiveId ? 'checked' : ''}><input type="text" class="${LP}-apikey-label" value="${k.label}" placeholder="Label" data-field="label"><input type="password" class="${LP}-apikey-value" value="${k.key}" placeholder="API key" data-field="key"><button class="${LP}-apikey-del">✕</button></div>`).join('');
      apiKeysContainer.querySelectorAll(`input[name="${LP}-active-key"]`).forEach(r => r.addEventListener('change', () => { workingActiveId = r.value; }));
      apiKeysContainer.querySelectorAll(`.${LP}-apikey-row`).forEach(row => { const idx = parseInt(row.dataset.idx); row.querySelectorAll('input[data-field]').forEach(inp => inp.addEventListener('input', () => { workingKeys[idx][inp.dataset.field] = inp.value; })); row.querySelector(`.${LP}-apikey-del`).addEventListener('click', () => { const rm = workingKeys.splice(idx, 1)[0]; if (rm.id === workingActiveId) workingActiveId = workingKeys[0]?.id || ''; renderApiKeys(); }); });
    }
    renderApiKeys();
    overlay.querySelector(`#${LP}-apikey-add`).addEventListener('click', () => { const nk = { id: Date.now().toString(), label: '', key: '' }; workingKeys.push(nk); if (!workingActiveId) workingActiveId = nk.id; renderApiKeys(); });

    // Keybindings
    const kbContainer = overlay.querySelector(`#${LP}-keybinds-list`);
    let workingKb = JSON.parse(JSON.stringify(cc.keybindings || DEFAULT_KEYBINDINGS));
    function renderKeybinds() {
      kbContainer.innerHTML = workingKb.map((kb, i) => `<div class="${LP}-keybind-row-edit" data-idx="${i}"><select class="${LP}-kb-cmd" data-idx="${i}">${ACE_COMMAND_BANK.map(c => `<option value="${c.name}" ${c.name === kb.name ? 'selected' : ''}>${c.desc}</option>`).join('')}</select><input type="text" class="${LP}-kb-key" data-idx="${i}" value="${kb.keys}" readonly placeholder="Click, press keys…"><button class="${LP}-kb-del" data-idx="${i}">✕</button></div>`).join('');
      kbContainer.querySelectorAll(`.${LP}-kb-cmd`).forEach(sel => sel.addEventListener('change', () => { workingKb[parseInt(sel.dataset.idx)].name = sel.value; }));
      kbContainer.querySelectorAll(`.${LP}-kb-key`).forEach(inp => inp.addEventListener('keydown', (e) => { e.preventDefault(); e.stopPropagation(); const parts = []; if (e.ctrlKey) parts.push('Ctrl'); if (e.altKey) parts.push('Alt'); if (e.shiftKey) parts.push('Shift'); if (e.metaKey) parts.push('Meta'); if (['Control','Shift','Alt','Meta'].includes(e.key)) return; parts.push(e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key); inp.value = parts.join('+'); workingKb[parseInt(inp.dataset.idx)].keys = inp.value; }));
      kbContainer.querySelectorAll(`.${LP}-kb-del`).forEach(btn => btn.addEventListener('click', () => { workingKb.splice(parseInt(btn.dataset.idx), 1); renderKeybinds(); }));
    }
    renderKeybinds();
    overlay.querySelector(`#${LP}-keybind-add`).addEventListener('click', () => { workingKb.push({ name: ACE_COMMAND_BANK[0].name, keys: '' }); renderKeybinds(); });

    // Snippets
    const snipContainer = overlay.querySelector(`#${LP}-snippets-list`);
    let workingSnippets = JSON.parse(JSON.stringify(cc.snippets || DEFAULT_SNIPPETS));
    function renderSnippets() {
      snipContainer.innerHTML = workingSnippets.length === 0 ? `<div style="font-size:12px;color:var(--${LP}-subtext);padding:8px 0;">No snippets.</div>` :
        workingSnippets.map((s, i) => `<div class="${LP}-snip-row" data-idx="${i}" draggable="true"><div class="${LP}-snip-top"><input type="text" class="${LP}-snip-name" value="${(s.name||'').replace(/"/g,'&quot;')}" placeholder="Label" data-field="name"><input type="text" class="${LP}-snip-key" value="${s.shortcutKey||''}" readonly placeholder="Key (opt.)" data-field="shortcutKey"><span class="${LP}-drag-handle">⋮⋮</span><button class="${LP}-snip-del">✕</button></div><textarea class="${LP}-snip-body" data-field="body" rows="3">${(s.body||'').replace(/</g,'&lt;')}</textarea></div>`).join('');
      let dragIdx = null;
      snipContainer.querySelectorAll(`.${LP}-snip-row`).forEach(row => {
        const idx = parseInt(row.dataset.idx);
        row.querySelectorAll('[data-field]').forEach(inp => {
          if (inp.tagName === 'TEXTAREA') inp.addEventListener('input', () => { workingSnippets[idx][inp.dataset.field] = inp.value; });
          else if (inp.dataset.field === 'shortcutKey') { inp.addEventListener('keydown', (e) => { e.preventDefault(); e.stopPropagation(); const p = []; if (e.ctrlKey) p.push('Ctrl'); if (e.altKey) p.push('Alt'); if (e.shiftKey) p.push('Shift'); if (e.metaKey) p.push('Meta'); if (['Control','Shift','Alt','Meta'].includes(e.key)) return; p.push(e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key); inp.value = p.join('+'); workingSnippets[idx].shortcutKey = inp.value; }); inp.addEventListener('dblclick', () => { inp.value = ''; workingSnippets[idx].shortcutKey = ''; }); }
          else inp.addEventListener('input', () => { workingSnippets[idx][inp.dataset.field] = inp.value; });
        });
        row.querySelector(`.${LP}-snip-del`).addEventListener('click', () => { workingSnippets.splice(idx, 1); renderSnippets(); });
        row.addEventListener('dragstart', () => { dragIdx = idx; row.classList.add(`${LP}-dragging`); });
        row.addEventListener('dragend', () => { dragIdx = null; snipContainer.querySelectorAll(`.${LP}-snip-row`).forEach(r => r.classList.remove(`${LP}-dragging`, `${LP}-drag-over`)); });
        row.addEventListener('drop', (e) => { e.preventDefault(); const tr = e.target.closest(`.${LP}-snip-row`); if (!tr) return; const di = parseInt(tr.dataset.idx); if (dragIdx === null || dragIdx === di) return; const moved = workingSnippets.splice(dragIdx, 1)[0]; workingSnippets.splice(di, 0, moved); renderSnippets(); });
      });
      snipContainer.addEventListener('dragover', (e) => { e.preventDefault(); const tr = e.target.closest(`.${LP}-snip-row`); snipContainer.querySelectorAll(`.${LP}-snip-row`).forEach(r => r.classList.remove(`${LP}-drag-over`)); if (tr && parseInt(tr.dataset.idx) !== dragIdx) tr.classList.add(`${LP}-drag-over`); });
    }
    renderSnippets();
    overlay.querySelector(`#${LP}-snippet-add`).addEventListener('click', () => { workingSnippets.push({ name: `Snippet ${workingSnippets.length+1}`, body: '', shortcutKey: '' }); renderSnippets(); });

    // Close / Save
    const tryClose = () => overlay.remove();
    overlay.querySelector(`.${LP}-modal-close`).addEventListener('click', tryClose);
    overlay.querySelector(`.${LP}-modal-cancel`).addEventListener('click', tryClose);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) tryClose(); });

    overlay.querySelector(`.${LP}-modal-save`).addEventListener('click', () => {
      const nc = { ...cc };
      overlay.querySelectorAll('[data-key]').forEach(input => { const k = input.dataset.key; if (input.type === 'checkbox') nc[k] = input.checked; else if (input.type === 'number' || input.type === 'range') nc[k] = parseInt(input.value, 10); else nc[k] = input.value; });
      nc.apiKeys = workingKeys.filter(k => k.key.trim()); nc.activeApiKeyId = workingActiveId; delete nc.apiKey;
      nc.keybindings = workingKb.filter(kb => kb.keys.trim());
      nc.snippets = workingSnippets.filter(s => s.name?.trim() && s.body?.trim());
      saveConfigToStorage(nc); overlay.remove();
      applyPreviewWidth(); applyEditorFont();
      if (refreshBtn) refreshBtn.title = `Save & refresh preview (${config.shortcut})`;
      cachedFieldSchema = null;
      if (aceEditorInstance) applyAceKeybindings(aceEditorInstance);
      const editorPane = document.getElementById('content-editor-side-by-side')?.children[0];
      const bar = document.querySelector(`.${LP}-refresh-bar`);
      if (editorPane && bar) renderSnippetBar(editorPane, bar);
    });
  }

  // ── Styles ──────────────────────────────────────────────
  function injectStyles() {
    GM_addStyle(`@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&display=swap');@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');`);
    GM_addStyle(`
      :root{--${LP}-bg:#1e1e2e;--${LP}-surface:#313244;--${LP}-text:#cdd6f4;--${LP}-accent:#89b4fa;--${LP}-border:#45475a;--${LP}-success:#a6e3a1;--${LP}-warning:#f9e2af;--${LP}-error:#f38ba8;--${LP}-subtext:#a6adc8;}
      .ahxVe{border-radius:0!important;} #content-editor-ace{width:auto!important;} .ace_content{width:auto!important;}
      .${LP}-refresh-bar{display:flex;flex-direction:column;gap:4px;padding:6px 12px;background:var(--${LP}-surface);border-bottom:1px solid var(--${LP}-border);z-index:10;flex-shrink:0;}
      .${LP}-bar-row{display:flex;align-items:center;gap:8px;}
      .${LP}-bar-right{display:flex;align-items:center;gap:6px;margin-left:auto;flex-shrink:0;}

      .${LP}-email-wrap{display:flex;align-items:center;gap:4px;background-color:#20529f;padding:4px 8px;border-radius:4px;flex-shrink:0;}
      .${LP}-email-input{background:var(--${LP}-bg);color:var(--${LP}-text);border:1px solid var(--${LP}-border);border-radius:4px;padding:3px 8px;font-size:12px;font-family:'Fira Code','Cascadia Code',monospace;width:180px;} .${LP}-email-input:focus{border-color:var(--${LP}-accent);outline:none;} .${LP}-email-input::placeholder{color:#585b70;}

      .${LP}-bar-btn{padding:3px 8px;font-size:11px;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--${LP}-surface);color:var(--${LP}-text);border:1px solid var(--${LP}-border);border-radius:4px;cursor:pointer;transition:opacity 0.15s;white-space:nowrap;} .${LP}-bar-btn:hover{opacity:0.8;} .${LP}-bar-btn:disabled{opacity:0.5;cursor:wait;}

      .${LP}-payload-bubbles{display:flex;flex-wrap:wrap;gap:3px;align-items:center;}
      .${LP}-payload-bubble{padding:2px 8px;font-size:11px;font-family:'Fira Code','Cascadia Code',monospace;background:var(--${LP}-surface);color:var(--${LP}-accent);border:1px solid var(--${LP}-border);border-radius:3px;cursor:pointer;white-space:nowrap;} .${LP}-payload-bubble:hover{background:#45475a;}

      .${LP}-refresh-btn{padding:5px 14px;font-size:13px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--${LP}-accent);color:#1e1e2e;border:none;border-radius:6px;cursor:pointer;transition:opacity 0.15s,background 0.15s;white-space:nowrap;flex-shrink:0;} .${LP}-refresh-btn:hover{opacity:0.85;} .${LP}-refresh-btn:active{opacity:0.7;} .${LP}-btn-dirty{background:var(--${LP}-warning);}

      .${LP}-overrides{display:flex;align-items:center;gap:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
      .${LP}-overrides-label{font-size:11px;color:var(--${LP}-warning);padding:2px 8px;background:rgba(249,226,175,0.12);border:1px solid rgba(249,226,175,0.25);border-radius:4px;white-space:nowrap;cursor:default;}
      .${LP}-overrides-clear{background:none;border:none;color:var(--${LP}-warning);cursor:pointer;font-size:13px;padding:0 2px;opacity:0.7;} .${LP}-overrides-clear:hover{opacity:1;}

      /* JSON Ace editor */
      .${LP}-json-row{align-items:stretch;}
      .${LP}-json-wrap{position:relative;flex:1;min-width:0;min-height:54px;max-height:400px;border-radius:4px;overflow:hidden;border:1px solid var(--${LP}-border);resize:vertical;}
      .${LP}-json-ace{width:100%;height:100%;min-height:54px;}
      .${LP}-json-ace .ace_editor{border-radius:4px;}
      .${LP}-json-popout{position:absolute;top:2px;right:2px;z-index:10;background:var(--${LP}-surface);color:var(--${LP}-subtext);border:1px solid var(--${LP}-border);border-radius:3px;padding:1px 5px;font-size:12px;cursor:pointer;opacity:0.4;transition:opacity 0.15s;} .${LP}-json-popout:hover{opacity:1;}

      /* JSON popout modal */
      .${LP}-json-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;}
      .${LP}-json-modal{background:var(--${LP}-bg);color:var(--${LP}-text);border:1px solid var(--${LP}-border);border-radius:12px;width:min(800px,90vw);height:min(600px,80vh);display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.4);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden;}
      .${LP}-json-popout-ace{flex:1;min-height:0;}
      .${LP}-json-popout-editor{flex:1;background:var(--${LP}-bg);color:var(--${LP}-text);border:none;padding:16px 20px;font-size:13px;font-family:'Fira Code','Cascadia Code',monospace;resize:none;outline:none;line-height:1.5;}
      .${LP}-custom-json-fallback{background:var(--${LP}-bg);color:var(--${LP}-text);border:1px solid var(--${LP}-border);border-radius:4px;padding:4px 8px;font-size:11px;font-family:'Fira Code','Cascadia Code',monospace;resize:vertical;min-height:36px;max-height:200px;width:100%;box-sizing:border-box;outline:none;}
      #${LP}-sidebar{width:50%;height:100%;position:relative;display:flex;flex-direction:column;border-left:1px solid var(--${LP}-border);flex-shrink:0;}
      .${LP}-iframe-wrap{flex:1;position:relative;min-height:0;} #${LP}-iframe{width:100%;height:100%;border:none;background:#fff;display:block;}
      .${LP}-resizer{width:6px;cursor:col-resize;background:var(--${LP}-border);flex-shrink:0;transition:background 0.15s;position:relative;z-index:5;} .${LP}-resizer:hover,.${LP}-resizer:active{background:var(--${LP}-accent);}
      .${LP}-toggle-bar{display:flex;border-bottom:1px solid var(--${LP}-border);flex-shrink:0;}
      .${LP}-toggle-btn{flex:1;padding:6px 0;font-size:12px;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--${LP}-surface);color:var(--${LP}-text);border:none;cursor:pointer;opacity:0.6;transition:opacity 0.15s;} .${LP}-toggle-btn:hover{opacity:0.8;} .${LP}-toggle-active{opacity:1;background:var(--${LP}-bg);border-bottom:2px solid var(--${LP}-accent);}
      .${LP}-settings-overlay,.${LP}-pusher-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;}
      .${LP}-settings-modal,.${LP}-pusher-modal{background:var(--${LP}-bg);color:var(--${LP}-text);border:1px solid var(--${LP}-border);border-radius:12px;max-height:85vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.4);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
      .${LP}-settings-modal{width:min(980px,92vw);} .${LP}-pusher-modal{width:520px;}
      .${LP}-modal-header,.${LP}-pusher-header{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--${LP}-border);}
      .${LP}-modal-header h2,.${LP}-pusher-header h2{margin:0;font-size:15px;font-weight:600;}
      .${LP}-modal-close{background:none;border:none;color:var(--${LP}-text);font-size:20px;cursor:pointer;padding:4px 8px;border-radius:4px;} .${LP}-modal-close:hover{background:var(--${LP}-surface);}
      .${LP}-modal-body,.${LP}-pusher-body{padding:16px 20px;}
      .${LP}-setting-group{margin-bottom:18px;} .${LP}-setting-label{display:flex;justify-content:space-between;align-items:center;font-size:14px;gap:12px;} .${LP}-setting-label>span:first-child{flex-shrink:0;}
      .${LP}-setting-hint{font-size:11px;color:#6c7086;margin-top:4px;}
      .${LP}-input,.${LP}-select{background:var(--${LP}-surface);color:var(--${LP}-text);border:1px solid var(--${LP}-border);border-radius:6px;padding:6px 10px;font-size:14px;width:140px;}
      .${LP}-shortcut-input{text-align:center;cursor:pointer;font-weight:500;} .${LP}-shortcut-input:focus{border-color:var(--${LP}-accent);outline:none;}
      .${LP}-range{width:120px;accent-color:var(--${LP}-accent);} .${LP}-range-value{font-size:13px;min-width:36px;text-align:right;font-variant-numeric:tabular-nums;}
      .${LP}-modal-footer,.${LP}-pusher-footer{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px 20px;border-top:1px solid var(--${LP}-border);}
      .${LP}-btn-primary,.${LP}-btn-secondary{padding:8px 16px;border-radius:6px;border:none;font-size:14px;cursor:pointer;font-weight:500;}
      .${LP}-btn-primary{background:var(--${LP}-accent);color:#1e1e2e;} .${LP}-btn-secondary{background:var(--${LP}-surface);color:var(--${LP}-text);} .${LP}-btn-primary:hover,.${LP}-btn-secondary:hover{opacity:0.9;}
      .${LP}-setting-section{margin-top:8px;padding-top:14px;border-top:1px solid var(--${LP}-border);}
      .${LP}-section-title{margin:0 0 4px 0;font-size:14px;font-weight:600;}
      .${LP}-pf-group{margin-bottom:14px;} .${LP}-pf-label{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:500;color:var(--${LP}-subtext);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;}
      .${LP}-pf-input{width:100%;background:var(--${LP}-surface);color:var(--${LP}-text);border:1px solid var(--${LP}-border);border-radius:6px;padding:8px 12px;font-size:14px;font-family:inherit;box-sizing:border-box;outline:none;} .${LP}-pf-input:focus{border-color:var(--${LP}-accent);} .${LP}-pf-input::placeholder{color:#585b70;}
      .${LP}-pf-textarea{width:100%;background:var(--${LP}-surface);color:var(--${LP}-text);border:1px solid var(--${LP}-border);border-radius:6px;padding:8px 12px;font-size:13px;font-family:'Fira Code','JetBrains Mono','Cascadia Code',monospace;box-sizing:border-box;outline:none;resize:vertical;min-height:80px;} .${LP}-pf-textarea:focus{border-color:var(--${LP}-accent);}
      .${LP}-pf-hint{font-size:11px;color:#6c7086;margin-top:4px;}
      .${LP}-pf-type-badge{font-size:11px;font-weight:600;padding:1px 6px;border-radius:3px;background:rgba(137,180,250,0.15);color:var(--${LP}-accent);text-transform:uppercase;}
      .${LP}-pf-current{background:var(--${LP}-surface);border:1px solid var(--${LP}-border);border-radius:6px;padding:8px 12px;font-size:12px;font-family:'Fira Code','JetBrains Mono',monospace;max-height:80px;overflow-y:auto;color:var(--${LP}-subtext);white-space:pre-wrap;word-break:break-all;}
      .${LP}-pf-status{padding:8px 12px;border-radius:6px;font-size:13px;margin-top:8px;display:none;}
      .${LP}-pf-status-success{display:block;background:rgba(166,227,161,0.12);color:var(--${LP}-success);border:1px solid rgba(166,227,161,0.25);}
      .${LP}-pf-status-error{display:block;background:rgba(243,139,168,0.12);color:var(--${LP}-error);border:1px solid rgba(243,139,168,0.25);}
      .${LP}-pf-status-info{display:block;background:rgba(137,180,250,0.12);color:var(--${LP}-accent);border:1px solid rgba(137,180,250,0.25);}
      .${LP}-pf-btn{padding:8px 16px;border-radius:6px;border:none;font-size:13px;cursor:pointer;font-weight:500;transition:opacity 0.15s;} .${LP}-pf-btn:disabled{opacity:0.5;cursor:not-allowed;}
      .${LP}-pf-btn-primary{background:var(--${LP}-accent);color:#1e1e2e;} .${LP}-pf-btn-secondary{background:var(--${LP}-surface);color:var(--${LP}-text);} .${LP}-pf-btn:hover:not(:disabled){opacity:0.85;}
      .${LP}-recent-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;}
      .${LP}-recent-tag{padding:2px 8px;border-radius:4px;font-size:11px;background:var(--${LP}-surface);color:var(--${LP}-subtext);cursor:pointer;border:1px solid var(--${LP}-border);transition:all 0.15s;} .${LP}-recent-tag:hover{background:#45475a;color:var(--${LP}-text);}
      .${LP}-apikey-row{display:flex;align-items:center;gap:6px;margin-bottom:6px;}
      .${LP}-apikey-row input[type="radio"]{accent-color:var(--${LP}-accent);cursor:pointer;flex-shrink:0;}
      .${LP}-apikey-label{flex:0 0 120px;background:var(--${LP}-surface);color:var(--${LP}-text);border:1px solid var(--${LP}-border);border-radius:4px;padding:5px 8px;font-size:13px;outline:none;} .${LP}-apikey-label:focus{border-color:var(--${LP}-accent);}
      .${LP}-apikey-value{flex:1;background:var(--${LP}-surface);color:var(--${LP}-text);border:1px solid var(--${LP}-border);border-radius:4px;padding:5px 8px;font-size:13px;font-family:'Fira Code','Cascadia Code',monospace;outline:none;min-width:0;} .${LP}-apikey-value:focus{border-color:var(--${LP}-accent);}
      .${LP}-apikey-del{background:none;border:none;color:var(--${LP}-error);cursor:pointer;font-size:14px;padding:2px 4px;opacity:0.6;} .${LP}-apikey-del:hover{opacity:1;}
      #${LP}-keybinds-list{display:flex;flex-wrap:wrap;}
      .${LP}-keybind-row-edit{display:flex;flex:1 0 50%;align-items:center;gap:6px;margin-bottom:6px;}
      .${LP}-kb-cmd{flex:1;background:var(--${LP}-surface);color:var(--${LP}-text);border:1px solid var(--${LP}-border);border-radius:4px;padding:5px 8px;font-size:13px;outline:none;min-width:0;} .${LP}-kb-cmd:focus{border-color:var(--${LP}-accent);}
      .${LP}-kb-key{width:140px;flex-shrink:0;background:var(--${LP}-surface);color:var(--${LP}-text);border:1px solid var(--${LP}-border);border-radius:4px;padding:5px 8px;font-size:12px;font-family:'Fira Code','Cascadia Code',monospace;text-align:center;cursor:pointer;outline:none;} .${LP}-kb-key:focus{border-color:var(--${LP}-accent);box-shadow:0 0 0 2px rgba(137,180,250,0.3);}
      .${LP}-kb-del{background:none;border:none;color:var(--${LP}-error);cursor:pointer;font-size:14px;padding:2px 4px;opacity:0.6;} .${LP}-kb-del:hover{opacity:1;}
      .${LP}-snippet-bar{display:flex;align-items:center;gap:4px;padding:4px 12px;background:var(--${LP}-bg);border-bottom:1px solid var(--${LP}-border);flex-shrink:0;flex-wrap:wrap;}
      .${LP}-snippet-label{font-size:11px;color:var(--${LP}-subtext);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin-right:2px;user-select:none;}
      .${LP}-snippet-btn{padding:2px 8px;font-size:11px;font-family:'Fira Code','Cascadia Code',monospace;background:var(--${LP}-surface);color:var(--${LP}-accent);border:1px solid var(--${LP}-border);border-radius:3px;cursor:pointer;transition:all 0.15s;white-space:nowrap;} .${LP}-snippet-btn:hover{background:#45475a;}
      .${LP}-snip-active{position:absolute;background:rgba(137,180,250,0.25);border:1px solid rgba(137,180,250,0.5);border-radius:2px;z-index:4;}
      .${LP}-snip-stop{position:absolute;background:rgba(166,227,161,0.1);border-bottom:1px dashed rgba(166,227,161,0.4);z-index:3;}
      .${LP}-snip-row{margin-bottom:12px;padding:10px;background:rgba(49,50,68,0.4);border:1px solid var(--${LP}-border);border-radius:6px;cursor:grab;} .${LP}-snip-row:active{cursor:grabbing;} .${LP}-snip-row.${LP}-dragging{opacity:.55;} .${LP}-snip-row.${LP}-drag-over{border-color:var(--${LP}-accent);box-shadow:0 0 0 2px rgba(137,180,250,.25);}
      .${LP}-snip-top{display:grid;grid-template-columns:minmax(220px,1fr) 140px auto auto;gap:8px;align-items:center;margin-bottom:8px;}
      .${LP}-snip-name{background:var(--${LP}-surface);color:var(--${LP}-text);border:1px solid var(--${LP}-border);border-radius:4px;padding:5px 8px;font-size:13px;outline:none;} .${LP}-snip-name:focus{border-color:var(--${LP}-accent);}
      .${LP}-snip-key{background:var(--${LP}-surface);color:var(--${LP}-text);border:1px solid var(--${LP}-border);border-radius:4px;padding:5px 8px;font-size:12px;font-family:'Fira Code','Cascadia Code',monospace;text-align:center;cursor:pointer;outline:none;} .${LP}-snip-key:focus{border-color:var(--${LP}-accent);}
      .${LP}-snip-del{background:none;border:none;color:var(--${LP}-error);cursor:pointer;font-size:14px;padding:2px 4px;opacity:0.6;} .${LP}-snip-del:hover{opacity:1;}
      .${LP}-drag-handle{cursor:grab;color:var(--${LP}-subtext);user-select:none;font-size:14px;}
      .${LP}-snip-body{width:100%;background:var(--${LP}-surface);color:var(--${LP}-text);border:1px solid var(--${LP}-border);border-radius:4px;padding:8px 10px;font-size:12px;font-family:'Fira Code','Cascadia Code',monospace;box-sizing:border-box;outline:none;resize:vertical;min-height:60px;} .${LP}-snip-body:focus{border-color:var(--${LP}-accent);}
    `);
  }

  // ── Initialization ──────────────────────────────────────
  async function init() {
    if (isInitialized) return; log('Initializing…'); injectStyles();
    let editorContainer;
    try { editorContainer = await waitForElement('#content-editor-side-by-side'); } catch (e) { warn('Editor container not found', e); return; }
    await new Promise(r => setTimeout(r, 1000));
    createPreviewSidebar(editorContainer); createRefreshBar(editorContainer); hookEditorChanges(editorContainer); setupKeyboardShortcut(); applyEditorFont();
    GM_registerMenuCommand('Live Preview Settings', showSettingsModal);
    isInitialized = true; log('Ready — refresh:', config.shortcut); triggerRefresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
