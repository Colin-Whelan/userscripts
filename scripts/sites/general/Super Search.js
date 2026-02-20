// ==UserScript==
// @name         Super Search
// @namespace    https://github.com/Colin-Whelan/userscripts/
// @author       Colin Whelan
// @version      1.1.0
// @description  Persistent page search with live highlighting that updates as content changes
// @match        *://*/*
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @require      https://cdn.jsdelivr.net/npm/fuse.js@7.0.0
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const LOG_PREFIX = '[SuperSearch]';
  const log = (...args) => console.log(LOG_PREFIX, ...args);
  const warn = (...args) => console.warn(LOG_PREFIX, ...args);

  // ── State ──────────────────────────────────────────────────────────────────
  const state = {
    active: false,
    query: '',
    caseSensitive: false,
    wholeWord: false,
    useRegex: false,
    fuzzy: false,
    fuzzyThreshold: 0.4,
    matchCount: 0,
    currentMatch: -1,
    highlightNodes: [],
    observer: null,
    debounceTimer: null,
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  GM_addStyle(`
    #ss-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 2147483647;
      display: flex;
      justify-content: center;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
    }

    #ss-bar {
      pointer-events: auto;
      margin-top: 8px;
      background: #1e1e2e;
      border: 1px solid #45475a;
      border-radius: 12px;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255,255,255,0.05);
      min-width: 420px;
      max-width: 560px;
      width: auto;
      animation: ss-slide-in 0.15s ease-out;
    }

    @keyframes ss-slide-in {
      from { opacity: 0; transform: translateY(-12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    #ss-bar.ss-closing {
      animation: ss-slide-out 0.12s ease-in forwards;
    }

    @keyframes ss-slide-out {
      from { opacity: 1; transform: translateY(0); }
      to   { opacity: 0; transform: translateY(-12px); }
    }

    #ss-row-main {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    #ss-input {
      flex: 1;
      background: #181825;
      border: 1px solid #585b70;
      border-radius: 8px;
      padding: 7px 10px;
      color: #cdd6f4;
      font-size: 14px;
      outline: none;
      transition: border-color 0.15s;
    }

    #ss-input:focus {
      border-color: #89b4fa;
    }

    #ss-input::placeholder {
      color: #6c7086;
    }

    #ss-count {
      color: #a6adc8;
      font-size: 12px;
      min-width: 60px;
      text-align: center;
      white-space: nowrap;
      user-select: none;
    }

    #ss-count.ss-no-match {
      color: #f38ba8;
    }

    .ss-nav-btn, .ss-close-btn {
      background: #313244;
      border: 1px solid #45475a;
      border-radius: 6px;
      color: #cdd6f4;
      cursor: pointer;
      padding: 5px 8px;
      font-size: 13px;
      line-height: 1;
      transition: background 0.12s, border-color 0.12s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .ss-nav-btn:hover, .ss-close-btn:hover {
      background: #585b70;
      border-color: #6c7086;
      color: #f5f5f5;
    }

    .ss-close-btn {
      padding: 5px 7px;
      font-size: 15px;
    }

    #ss-row-options {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }

    .ss-toggle {
      background: #313244;
      border: 1px solid #45475a;
      border-radius: 6px;
      color: #bac2de;
      cursor: pointer;
      padding: 3px 9px;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.15s;
      user-select: none;
      white-space: nowrap;
    }

    .ss-toggle:hover {
      background: #585b70;
      color: #cdd6f4;
    }

    .ss-toggle.ss-on {
      background: #89b4fa;
      border-color: #89b4fa;
      color: #1e1e2e;
    }

    .ss-toggle.ss-on:hover {
      background: #74c7ec;
      border-color: #74c7ec;
    }

    #ss-fuzzy-threshold-wrap {
      display: none;
      align-items: center;
      gap: 5px;
      margin-left: 4px;
    }

    #ss-fuzzy-threshold-wrap.ss-visible {
      display: flex;
    }

    #ss-fuzzy-threshold {
      width: 64px;
      accent-color: #89b4fa;
      cursor: pointer;
    }

    #ss-fuzzy-value {
      color: #a6adc8;
      font-size: 11px;
      min-width: 24px;
    }

    /* ── Highlights ─────────────────────────────────────────────────────────── */
    @property --ss-angle {
      syntax: '<angle>';
      initial-value: 0deg;
      inherits: false;
    }

    @keyframes ss-rainbow-spin {
      to { --ss-angle: 360deg; }
    }

    ss-hl {
      position: relative !important;
      display: inline !important;
      padding: 1px 2px !important;
      margin: 0 !important;
      color: inherit !important;
      background: rgba(250, 179, 135, 0.12) !important;
      border-radius: 3px !important;
      /* Animated rainbow border via outline + box-shadow combo */
      border: 2px solid transparent !important;
      background-clip: padding-box !important;
      background-origin: padding-box !important;
      box-shadow:
        0 0 0 0.5px rgba(0,0,0,0.15),
        inset 0 0 0 0px transparent !important;
      outline: none !important;
      /* The rainbow border is done via a pseudo-element */
    }

    ss-hl::before {
      content: '' !important;
      position: absolute !important;
      inset: -2px !important;
      border-radius: 4px !important;
      padding: 2px !important;
      background: conic-gradient(
        from var(--ss-angle),
        #f38ba8, #fab387, #f9e2af, #a6e3a1, #89b4fa, #cba6f7, #f38ba8
      ) !important;
      -webkit-mask:
        linear-gradient(#fff 0 0) content-box,
        linear-gradient(#fff 0 0) !important;
      mask:
        linear-gradient(#fff 0 0) content-box,
        linear-gradient(#fff 0 0) !important;
      -webkit-mask-composite: xor !important;
      mask-composite: exclude !important;
      animation: ss-rainbow-spin 3s linear infinite !important;
      pointer-events: none !important;
    }

    ss-hl.ss-current {
      background: rgba(137, 180, 250, 0.2) !important;
    }

    ss-hl.ss-current::before {
      inset: -3px !important;
      border-radius: 5px !important;
      padding: 3px !important;
      filter: brightness(1.3) saturate(1.3) !important;
      animation: ss-rainbow-spin 1.5s linear infinite !important;
    }
  `);

  // ── Build UI ───────────────────────────────────────────────────────────────
  function buildUI() {
    if (document.getElementById('ss-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'ss-overlay';
    overlay.innerHTML = `
      <div id="ss-bar">
        <div id="ss-row-main">
          <input id="ss-input" type="text" placeholder="Search page…" spellcheck="false" autocomplete="off" />
          <span id="ss-count">0 matches</span>
          <button class="ss-nav-btn" id="ss-prev" title="Previous (Shift+Enter)">▲</button>
          <button class="ss-nav-btn" id="ss-next" title="Next (Enter)">▼</button>
          <button class="ss-close-btn" id="ss-close" title="Close (Esc)">✕</button>
        </div>
        <div id="ss-row-options">
          <button class="ss-toggle" data-opt="caseSensitive" title="Case Sensitive">Aa</button>
          <button class="ss-toggle" data-opt="wholeWord" title="Whole Word">W</button>
          <button class="ss-toggle" data-opt="useRegex" title="Regular Expression">.*</button>
          <button class="ss-toggle" data-opt="fuzzy" title="Fuzzy Search">~Fuzzy</button>
          <div id="ss-fuzzy-threshold-wrap">
            <input type="range" id="ss-fuzzy-threshold" min="0" max="100" value="60" />
            <span id="ss-fuzzy-value">0.4</span>
          </div>
        </div>
      </div>
    `;

    document.documentElement.appendChild(overlay);
    bindUIEvents();
    log('UI built');
  }

  function bindUIEvents() {
    const input = document.getElementById('ss-input');
    const close = document.getElementById('ss-close');
    const prev = document.getElementById('ss-prev');
    const next = document.getElementById('ss-next');
    const thresholdSlider = document.getElementById('ss-fuzzy-threshold');

    input.addEventListener('input', () => {
      state.query = input.value;
      debouncedSearch();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        navigateMatch(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        navigateMatch(1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        deactivate();
      }
    });

    close.addEventListener('click', deactivate);
    prev.addEventListener('click', () => navigateMatch(-1));
    next.addEventListener('click', () => navigateMatch(1));

    document.querySelectorAll('#ss-row-options .ss-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const opt = btn.dataset.opt;
        state[opt] = !state[opt];
        btn.classList.toggle('ss-on', state[opt]);

        // Fuzzy is mutually exclusive with regex
        if (opt === 'fuzzy' && state.fuzzy) {
          state.useRegex = false;
          document.querySelector('[data-opt="useRegex"]').classList.remove('ss-on');
        }
        if (opt === 'useRegex' && state.useRegex) {
          state.fuzzy = false;
          document.querySelector('[data-opt="fuzzy"]').classList.remove('ss-on');
        }

        document.getElementById('ss-fuzzy-threshold-wrap')
          .classList.toggle('ss-visible', state.fuzzy);

        debouncedSearch();
      });
    });

    thresholdSlider.addEventListener('input', () => {
      state.fuzzyThreshold = 1 - (thresholdSlider.value / 100);
      document.getElementById('ss-fuzzy-value').textContent =
        state.fuzzyThreshold.toFixed(2);
      debouncedSearch();
    });
  }

  // ── Activate / Deactivate ──────────────────────────────────────────────────
  function activate() {
    if (state.active) {
      document.getElementById('ss-input')?.focus();
      document.getElementById('ss-input')?.select();
      return;
    }
    log('Activating');
    state.active = true;
    buildUI();
    startObserver();
    const input = document.getElementById('ss-input');
    if (input) {
      input.value = state.query;
      input.focus();
      input.select();
    }
  }

  function deactivate() {
    if (!state.active) return;
    log('Deactivating');

    const bar = document.getElementById('ss-bar');
    if (bar) {
      bar.classList.add('ss-closing');
      bar.addEventListener('animationend', () => {
        document.getElementById('ss-overlay')?.remove();
      }, { once: true });
    }

    clearHighlights();
    stopObserver();
    state.active = false;
    state.currentMatch = -1;
  }

  // ── MutationObserver ───────────────────────────────────────────────────────
  function startObserver() {
    if (state.observer) return;
    state.observer = new MutationObserver((mutations) => {
      // Ignore our own highlight mutations
      const dominated = mutations.every((m) => {
        if (m.type === 'childList') {
          for (const n of [...m.addedNodes, ...m.removedNodes]) {
            if (isHighlightNode(n)) continue;
            return false;
          }
          return true;
        }
        return m.target?.closest?.('ss-hl') || m.target?.closest?.('#ss-overlay');
      });
      if (dominated) return;

      debouncedSearch();
    });

    state.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    log('Observer started');
  }

  function stopObserver() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
      log('Observer stopped');
    }
  }

  function isHighlightNode(node) {
    if (!node) return false;
    if (node.nodeName === 'SS-HL') return true;
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SS-HL') return true;
    if (node.parentElement?.closest?.('ss-hl')) return true;
    return false;
  }

  // ── Visibility Check ────────────────────────────────────────────────────
  function isNodeVisible(node) {
    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!el) return false;

    // Fast path: hidden attribute or aria-hidden
    if (el.hidden || el.getAttribute('aria-hidden') === 'true') return false;

    // Walk up ancestors checking computed styles (cached per search via offsetParent shortcut)
    let current = el;
    while (current && current !== document.body) {
      // offsetParent is null for display:none (except on body/html/fixed)
      // But fixed elements also have null offsetParent, so we can't rely on it alone
      const style = getComputedStyle(current);
      if (style.display === 'none') return false;
      if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
      if (parseFloat(style.opacity) === 0) return false;

      // Check for off-screen / clipped-away content (common modal/drawer hiding pattern)
      if (current.offsetWidth === 0 && current.offsetHeight === 0) {
        // Could be legitimately inline/empty, only reject if overflow is hidden on parent
        const parentStyle = current.parentElement ? getComputedStyle(current.parentElement) : null;
        if (parentStyle && (parentStyle.overflow === 'hidden' || parentStyle.overflow === 'clip')) {
          return false;
        }
      }

      current = current.parentElement;
    }
    return true;
  }

  // ── Search Orchestration ───────────────────────────────────────────────────
  function debouncedSearch() {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(runSearch, 120);
  }

  function runSearch() {
    clearHighlights();

    const q = state.query.trim();
    if (!q) {
      updateCount(0);
      return;
    }

    if (state.fuzzy) {
      runFuzzySearch(q);
    } else {
      runStandardSearch(q);
    }
  }

  // ── Standard Search (plain text / regex / whole word) ──────────────────────
  function runStandardSearch(query) {
    let regex;
    try {
      if (state.useRegex) {
        const flags = state.caseSensitive ? 'g' : 'gi';
        regex = new RegExp(query, flags);
      } else {
        let escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (state.wholeWord) escaped = `\\b${escaped}\\b`;
        const flags = state.caseSensitive ? 'g' : 'gi';
        regex = new RegExp(escaped, flags);
      }
    } catch (e) {
      warn('Invalid regex:', e.message);
      updateCount(0);
      return;
    }

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (node.parentElement?.closest('#ss-overlay')) return NodeFilter.FILTER_REJECT;
          if (isHighlightNode(node)) return NodeFilter.FILTER_REJECT;
          const tag = node.parentElement?.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT')
            return NodeFilter.FILTER_REJECT;
          if (node.textContent.trim().length === 0) return NodeFilter.FILTER_REJECT;
          if (!isNodeVisible(node)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    // Pause observer while we mutate
    stopObserver();

    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    let totalMatches = 0;

    for (const textNode of textNodes) {
      const text = textNode.textContent;
      regex.lastIndex = 0;
      const matches = [];
      let m;
      while ((m = regex.exec(text)) !== null) {
        matches.push({ index: m.index, length: m[0].length });
        if (m[0].length === 0) { regex.lastIndex++; }
      }
      if (matches.length === 0) continue;

      const parent = textNode.parentNode;
      const frag = document.createDocumentFragment();
      let cursor = 0;

      for (const match of matches) {
        if (match.index > cursor) {
          frag.appendChild(document.createTextNode(text.slice(cursor, match.index)));
        }
        const hl = document.createElement('ss-hl');
        hl.textContent = text.slice(match.index, match.index + match.length);
        hl.dataset.ssIdx = totalMatches;
        state.highlightNodes.push(hl);
        frag.appendChild(hl);
        totalMatches++;
        cursor = match.index + match.length;
      }

      if (cursor < text.length) {
        frag.appendChild(document.createTextNode(text.slice(cursor)));
      }

      parent.replaceChild(frag, textNode);
    }

    updateCount(totalMatches);
    startObserver();
    log(`Standard search: ${totalMatches} matches`);
  }

  // ── Fuzzy Search (Fuse.js) ─────────────────────────────────────────────────
  function runFuzzySearch(query) {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (node.parentElement?.closest('#ss-overlay')) return NodeFilter.FILTER_REJECT;
          if (isHighlightNode(node)) return NodeFilter.FILTER_REJECT;
          const tag = node.parentElement?.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT')
            return NodeFilter.FILTER_REJECT;
          if (node.textContent.trim().length === 0) return NodeFilter.FILTER_REJECT;
          if (!isNodeVisible(node)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    // Build word-level index with references back to text nodes
    const wordEntries = [];
    for (let i = 0; i < textNodes.length; i++) {
      const text = textNodes[i].textContent;
      const wordRegex = /\S+/g;
      let wm;
      while ((wm = wordRegex.exec(text)) !== null) {
        wordEntries.push({
          word: wm[0],
          nodeIndex: i,
          charIndex: wm.index,
          length: wm[0].length,
        });
      }
    }

    // Use Fuse.js for fuzzy matching
    const fuse = new Fuse(wordEntries, {
      keys: ['word'],
      includeMatches: true,
      threshold: state.fuzzyThreshold,
      isCaseSensitive: state.caseSensitive,
      ignoreLocation: true,
    });

    const results = fuse.search(query);

    // Group results by text node
    const nodeHits = new Map();
    for (const result of results) {
      const entry = result.item;
      if (!nodeHits.has(entry.nodeIndex)) nodeHits.set(entry.nodeIndex, []);
      nodeHits.get(entry.nodeIndex).push(entry);
    }

    stopObserver();

    let totalMatches = 0;

    // Sort node indices descending so replacements don't shift earlier indices
    const sortedNodeIndices = [...nodeHits.keys()].sort((a, b) => b - a);

    for (const ni of sortedNodeIndices) {
      const textNode = textNodes[ni];
      if (!textNode.parentNode) continue;

      const hits = nodeHits.get(ni).sort((a, b) => a.charIndex - b.charIndex);
      const text = textNode.textContent;
      const parent = textNode.parentNode;
      const frag = document.createDocumentFragment();
      let cursor = 0;

      // Deduplicate overlapping hits
      const merged = [];
      for (const hit of hits) {
        const last = merged[merged.length - 1];
        if (last && hit.charIndex < last.charIndex + last.length) continue;
        merged.push(hit);
      }

      for (const hit of merged) {
        if (hit.charIndex > cursor) {
          frag.appendChild(document.createTextNode(text.slice(cursor, hit.charIndex)));
        }
        const hl = document.createElement('ss-hl');
        hl.textContent = text.slice(hit.charIndex, hit.charIndex + hit.length);
        hl.dataset.ssIdx = totalMatches;
        state.highlightNodes.push(hl);
        frag.appendChild(hl);
        totalMatches++;
        cursor = hit.charIndex + hit.length;
      }

      if (cursor < text.length) {
        frag.appendChild(document.createTextNode(text.slice(cursor)));
      }

      parent.replaceChild(frag, textNode);
    }

    updateCount(totalMatches);

    // Re-sort highlights into document order (they were built in reverse due to safe DOM replacement)
    state.highlightNodes.sort((a, b) => {
      const pos = a.compareDocumentPosition(b);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
    state.highlightNodes.forEach((hl, i) => hl.dataset.ssIdx = i);

    startObserver();
    log(`Fuzzy search: ${totalMatches} matches (threshold: ${state.fuzzyThreshold})`);
  }

  // ── Clear Highlights ───────────────────────────────────────────────────────
  function clearHighlights() {
    stopObserver();

    const highlights = document.querySelectorAll('ss-hl');
    for (const hl of highlights) {
      const parent = hl.parentNode;
      if (!parent) continue;
      const text = document.createTextNode(hl.textContent);
      parent.replaceChild(text, hl);
      parent.normalize();
    }

    state.highlightNodes = [];
    state.currentMatch = -1;
    startObserver();
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  function navigateMatch(direction) {
    if (state.highlightNodes.length === 0) return;

    // Remove current marker
    if (state.currentMatch >= 0 && state.highlightNodes[state.currentMatch]) {
      state.highlightNodes[state.currentMatch].classList.remove('ss-current');
    }

    state.currentMatch += direction;
    if (state.currentMatch >= state.highlightNodes.length) state.currentMatch = 0;
    if (state.currentMatch < 0) state.currentMatch = state.highlightNodes.length - 1;

    const el = state.highlightNodes[state.currentMatch];
    if (el) {
      el.classList.add('ss-current');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    updateCount(state.highlightNodes.length);
  }

  // ── UI Updates ─────────────────────────────────────────────────────────────
  function updateCount(total) {
    state.matchCount = total;
    const el = document.getElementById('ss-count');
    if (!el) return;

    if (state.query.trim() === '') {
      el.textContent = '';
      el.classList.remove('ss-no-match');
    } else if (total === 0) {
      el.textContent = 'No matches';
      el.classList.add('ss-no-match');
    } else if (state.currentMatch >= 0) {
      el.textContent = `${state.currentMatch + 1} / ${total}`;
      el.classList.remove('ss-no-match');
    } else {
      el.textContent = `${total} match${total === 1 ? '' : 'es'}`;
      el.classList.remove('ss-no-match');
    }
  }

  // ── Keyboard Shortcut ──────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.altKey && e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      e.stopPropagation();
      if (state.active) {
        deactivate();
      } else {
        activate();
      }
    }
  }, true);

  // ── Userscript Menu ────────────────────────────────────────────────────────
  GM_registerMenuCommand('Super Search - Ctrl+Alt+Shift+F', () => {
    if (state.active) {
      deactivate();
    } else {
      activate();
    }
  });

  log('Loaded — Ctrl+Alt+Shift+F or use the userscript menu to activate');
})();
