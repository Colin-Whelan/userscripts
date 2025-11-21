// ==UserScript==
// @name         Indigo Navigation Link Finder
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Search and find nested navigation links on Indigo.ca
// @author       You
// @match        https://www.indigo.ca/*
// @grant        GM_addStyle
// @require      https://cdn.jsdelivr.net/npm/fuse.js@7.0.0
// ==/UserScript==

(function() {
    'use strict';

    // Logging toggle
    const logging = false;
    const log = (...args) => logging && console.log(...args);
    const logError = (...args) => logging && console.error(...args);


    log('[Indigo Nav Finder] Script initialized');

    // Add modern styles
    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        #indigo-nav-finder {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 800px;
            max-height: 85vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            z-index: 999999;
            display: none;
            flex-direction: column;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            overflow: hidden;
        }

        #indigo-nav-finder.active {
            display: flex;
            animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translate(-50%, -45%);
            }
            to {
                opacity: 1;
                transform: translate(-50%, -50%);
            }
        }

        .nav-finder-header {
            padding: 24px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .nav-finder-header h3 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .nav-finder-header h3::before {
            content: '🔍';
            font-size: 28px;
        }

        .nav-finder-controls {
            display: flex;
            gap: 12px;
            align-items: center;
        }

        .nav-finder-close {
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: none;
            width: 36px;
            height: 36px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 20px;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .nav-finder-close:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: rotate(90deg);
        }

        .nav-finder-search {
            padding: 20px 24px;
            background: white;
        }

        .nav-finder-search input {
            width: 100%;
            padding: 14px 20px;
            font-size: 15px;
            border: 2px solid #e0e7ff;
            border-radius: 12px;
            box-sizing: border-box;
            font-family: 'Inter', sans-serif;
            transition: all 0.2s;
        }

        .nav-finder-search input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
        }

        .nav-finder-tabs {
            display: flex;
            background: white;
            padding: 0 24px;
            gap: 8px;
        }

        .nav-finder-tab {
            flex: 1;
            padding: 14px 20px;
            background: none;
            border: none;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            color: #6b7280;
            border-bottom: 3px solid transparent;
            transition: all 0.2s;
        }

        .nav-finder-tab:hover {
            color: #667eea;
            background: #f3f4f6;
        }

        .nav-finder-tab.active {
            color: #667eea;
            border-bottom-color: #667eea;
        }

        .nav-finder-results {
            flex: 1;
            overflow-y: auto;
            padding: 24px;
            background: white;
        }

        .nav-finder-results::-webkit-scrollbar {
            width: 8px;
        }

        .nav-finder-results::-webkit-scrollbar-track {
            background: #f1f1f1;
        }

        .nav-finder-results::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
        }

        .nav-finder-results::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
        }

        .nav-finder-item {
            padding: 16px 20px;
            margin-bottom: 12px;
            background: #f9fafb;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.2s;
        }

        .nav-finder-item:hover {
            border-color: #667eea;
            transform: translateX(4px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
        }

        .nav-finder-item.pinned {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border-color: #fbbf24;
        }

        .nav-finder-item.pinned::before {
            content: '📌';
            margin-right: 12px;
            font-size: 16px;
        }

        .nav-finder-item-info {
            flex: 1;
            min-width: 0;
        }

        .nav-finder-item-path {
            font-size: 12px;
            color: #6b7280;
            margin-bottom: 6px;
            font-weight: 500;
        }

        .nav-finder-item-text {
            font-weight: 600;
            margin-bottom: 6px;
            color: #111827;
            font-size: 15px;
        }

        .nav-finder-item-url {
            font-size: 12px;
            color: #667eea;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-family: 'Monaco', 'Courier New', monospace;
        }

        .nav-finder-item-actions {
            display: flex;
            gap: 8px;
            margin-left: 16px;
        }

        .nav-finder-btn {
            padding: 8px 16px;
            font-size: 13px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            white-space: nowrap;
            font-weight: 600;
            transition: all 0.2s;
        }

        .nav-finder-btn-copy {
            background: #667eea;
            color: white;
        }

        .nav-finder-btn-copy:hover {
            background: #5568d3;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .nav-finder-btn-pin {
            background: #fbbf24;
            color: #78350f;
        }

        .nav-finder-btn-pin:hover {
            background: #f59e0b;
            transform: translateY(-2px);
        }

        .nav-finder-btn-unpin {
            background: #f37373;
            color: white;
        }

        .nav-finder-btn-unpin:hover {
            background: #f15c5c;
            transform: translateY(-2px);
        }

        .nav-finder-trigger {
            position: fixed;
            bottom: 24px;
            left: 24px;
            width: 64px;
            height: 64px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 50%;
            font-size: 28px;
            cursor: pointer;
            box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
            z-index: 999998;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s;
        }

        .nav-finder-trigger:hover {
            transform: scale(1.1) rotate(10deg);
            box-shadow: 0 12px 32px rgba(102, 126, 234, 0.5);
        }

        .nav-finder-empty {
            text-align: center;
            color: #9ca3af;
            padding: 60px 40px;
        }

        .nav-finder-empty::before {
            content: '🔍';
            display: block;
            font-size: 48px;
            margin-bottom: 16px;
        }

        .nav-finder-stats {
            padding: 12px 24px;
            background: rgba(255, 255, 255, 0.95);
            color: #6b7280;
            font-size: 13px;
            font-weight: 500;
            border-top: 1px solid #e5e7eb;
        }
    `);

    // Extract navigation links with detailed logging
    function extractLinks(container) {
        log('[Indigo Nav Finder] Extracting links...');
        log('[Indigo Nav Finder] Container:', container);

        const links = [];
        let processedCount = 0;

        function traverse(element, path = [], depth = 0) {
            log(`[Indigo Nav Finder] Traversing at depth ${depth}, path:`, path);

            // Look for both nav-item and dropdown-item
            const items = element.querySelectorAll(':scope > li');
            log(`[Indigo Nav Finder] Found ${items.length} list items at depth ${depth}`);

            items.forEach((item, index) => {
                // Find the primary link in this item
                const link = item.querySelector(':scope > a');

                if (!link) {
                    log(`[Indigo Nav Finder] No link found in item ${index}`);
                    return;
                }

                const text = (link.querySelector('span')?.textContent || link.textContent).trim();
                const href = link.getAttribute('href');

                log(`[Indigo Nav Finder] Processing link ${processedCount++}:`, {
                    text,
                    href,
                    path: path.join(' > ')
                });

                // Skip javascript:void(0) and empty hrefs, but still traverse children
                if (!href || href === '#' || href.startsWith('javascript:')) {
                    log('[Indigo Nav Finder] Skipping link (invalid href), checking for submenu...');

                    // Check for submenus
                    const submenu = item.querySelector('ul.dropdown-menu, ul.level-2, ul.level-3');
                    if (submenu) {
                        log('[Indigo Nav Finder] Found submenu, traversing...');
                        traverse(submenu, [...path, text], depth + 1);
                    }
                    return;
                }

                // Clean up the text
                const cleanText = text.replace(/\s+/g, ' ').replace(/\t/g, '').trim();

                // Clean up href - remove tabs, newlines, and extra whitespace
                const cleanHref = href.replace(/[\t\n\r]/g, '').replace(/\s+/g, '').trim();

                // Build full URL
                let fullUrl = cleanHref;
                if (!cleanHref.startsWith('http')) {
                    fullUrl = cleanHref.startsWith('/')
                        ? `https://www.indigo.ca${cleanHref}`
                        : `https://www.indigo.ca/${cleanHref}`;
                }

                const linkData = {
                    path: path.join(' > '),
                    text: cleanText,
                    url: fullUrl
                };

                links.push(linkData);
                log('[Indigo Nav Finder] Added link:', linkData);

                // Check for nested dropdowns
                const submenu = item.querySelector('ul.dropdown-menu, ul.level-2, ul.level-3');
                if (submenu) {
                    log('[Indigo Nav Finder] Found submenu after link, traversing...');
                    traverse(submenu, [...path, cleanText], depth + 1);
                }
            });
        }

        // Try multiple selectors to find the navigation
        const selectors = [
            '.navbar-nav.level-1',
            'ul.level-1[role="menu"]',
            '[data-a8n="header_l1-categories-menu__panel"] ul.level-1',
            '.menu-group ul.level-1'
        ];

        let navList = null;
        for (const selector of selectors) {
            navList = container.querySelector(selector);
            if (navList) {
                log(`[Indigo Nav Finder] Found navigation with selector: ${selector}`);
                break;
            }
        }

        if (navList) {
            traverse(navList);
            log(`[Indigo Nav Finder] Extraction complete. Found ${links.length} links`);
        } else {
            logError('[Indigo Nav Finder] Could not find navigation list!');
            log('[Indigo Nav Finder] Available elements:', container.innerHTML.substring(0, 500));
        }

        return links;
    }

    // Improved fuzzy search - matches characters in order anywhere in the string
    function fuzzyMatch(str, pattern) {
        // Normalize both strings
        pattern = pattern.toLowerCase().replace(/[^a-z0-9]/g, '');
        str = str.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (pattern.length === 0) return 0;
        if (str.length === 0) return 0;

        let patternIdx = 0;
        let strIdx = 0;
        let consecutiveMatches = 0;
        let score = 0;

        // Track positions where pattern characters are found
        const matchPositions = [];

        while (strIdx < str.length && patternIdx < pattern.length) {
            if (str[strIdx] === pattern[patternIdx]) {
                matchPositions.push(strIdx);

                // Bonus for consecutive matches
                if (matchPositions.length > 1 &&
                    matchPositions[matchPositions.length - 1] === matchPositions[matchPositions.length - 2] + 1) {
                    consecutiveMatches++;
                    score += 5; // Bonus for consecutive matches
                } else {
                    consecutiveMatches = 0;
                }

                score += 10; // Base score for each match
                patternIdx++;
            }
            strIdx++;
        }

        // If we didn't match all pattern characters, return 0
        if (patternIdx !== pattern.length) {
            return 0;
        }

        // Bonus for matching closer to the start
        if (matchPositions.length > 0) {
            const avgPosition = matchPositions.reduce((a, b) => a + b, 0) / matchPositions.length;
            const positionBonus = Math.max(0, 100 - avgPosition);
            score += positionBonus;
        }

        // Bonus for shorter strings (more precise matches)
        const lengthRatio = pattern.length / str.length;
        score += lengthRatio * 50;

        // Bonus for matching entire words
        const patternWords = pattern.split(/\s+/);
        const strWords = str.split(/\s+/);
        patternWords.forEach(pw => {
            if (strWords.some(sw => sw.includes(pw) || pw.includes(sw))) {
                score += 20;
            }
        });

        return score;
    }

    function searchLinks(links, query) {
        if (!query) return links;

        const fuse = new Fuse(links, {
            keys: [
                { name: 'text', weight: 0.5 },      // Prioritize link text
                { name: 'path', weight: 0.3 },      // Then navigation path
                { name: 'url', weight: 0.2 }        // Finally URL
            ],
            threshold: 0.3,                         // 0 = perfect match, 1 = match anything
            includeScore: true,
            ignoreLocation: true,                   // Match anywhere in string
            minMatchCharLength: 2,                  // Require at least N characters
            distance: 50,                           // How far to search for pattern
            ignoreDiacritics: true,                 // Ignore accents
            useExtendedSearch: false
        });


        const results = fuse.search(query);
        // console.log('fuse search: ', query, ' -- Results: ', results)

        log(`[Indigo Nav Finder] Fuse.js search for "${query}" returned ${results.length} results`);
        if (results.length > 0) {
            log('[Indigo Nav Finder] Top result:', results[0]);
        }

        // Return just the items (Fuse wraps results in {item, score})
        return results.map(result => result.item);
    }

    // Storage for pins
    function getPins() {
        try {
            return JSON.parse(localStorage.getItem('indigo-nav-pins') || '[]');
        } catch {
            return [];
        }
    }

    function savePins(pins) {
        localStorage.setItem('indigo-nav-pins', JSON.stringify(pins));
    }

    function togglePin(link) {
        const pins = getPins();
        const index = pins.findIndex(p => p.url === link.url);

        if (index >= 0) {
            pins.splice(index, 1);
        } else {
            pins.push(link);
        }

        savePins(pins);
        return index < 0;
    }

    function isPinned(link) {
        const pins = getPins();
        return pins.some(p => p.url === link.url);
    }

    // Create UI
    function createUI() {
        log('[Indigo Nav Finder] Creating UI...');

        // Wait a bit for the page to fully load
        setTimeout(() => {
            // Look for navigation menu - try multiple selectors
            const selectors = [
                '.menu-group[role="navigation"]',
                '[data-a8n="header_l1-categories-menu__panel"]',
                'nav.navbar',
                '.header .navbar-nav'
            ];

            let menuContainer = null;
            for (const selector of selectors) {
                menuContainer = document.querySelector(selector);
                if (menuContainer) {
                    log(`[Indigo Nav Finder] Found menu container with selector: ${selector}`);
                    break;
                }
            }

            if (!menuContainer) {
                logError('[Indigo Nav Finder] Could not find menu container!');
                log('[Indigo Nav Finder] Available navigation elements:',
                    document.querySelectorAll('nav, [role="navigation"]'));
                return;
            }

            // Extract links
            const allLinks = extractLinks(menuContainer);

            log('[Indigo Nav Finder] Total links extracted:', allLinks.length);

            let activeTab = 'all';
            let searchQuery = '';

            // Create trigger button
            const trigger = document.createElement('button');
            trigger.className = 'nav-finder-trigger';
            trigger.innerHTML = '🔍';
            trigger.title = 'Search Navigation Links (Click or press Ctrl+K)';
            document.body.appendChild(trigger);

            // Create main container
            const container = document.createElement('div');
            container.id = 'indigo-nav-finder';
            container.innerHTML = `
                <div class="nav-finder-header">
                    <h3>Navigation Finder</h3>
                    <div class="nav-finder-controls">
                        <button class="nav-finder-close">×</button>
                    </div>
                </div>
                <div class="nav-finder-search">
                    <input type="text" placeholder="Type to search... (e.g., 'gift baby' matches 'gifts-for-baby')" />
                </div>
                <div class="nav-finder-tabs">
                    <button class="nav-finder-tab active" data-tab="all">All Links</button>
                    <button class="nav-finder-tab" data-tab="pinned">Pinned</button>
                </div>
                <div class="nav-finder-results"></div>
                <div class="nav-finder-stats"></div>
            `;
            document.body.appendChild(container);

            const searchInput = container.querySelector('.nav-finder-search input');
            const resultsContainer = container.querySelector('.nav-finder-results');
            const statsContainer = container.querySelector('.nav-finder-stats');
            const tabs = container.querySelectorAll('.nav-finder-tab');

            function updateStats(filtered, total) {
                statsContainer.textContent = `Showing ${filtered} of ${total} links`;
            }

            function renderResults() {
                log(`[Indigo Nav Finder] Rendering results, tab: ${activeTab}`);

                const links = activeTab === 'pinned'
                    ? getPins()
                    : allLinks;

                log(`[Indigo Nav Finder] Base links count: ${links.length}`);

                const filtered = searchLinks(links, searchQuery);
                log(`[Indigo Nav Finder] Filtered links count: ${filtered.length}`);

                updateStats(filtered.length, links.length);

                if (filtered.length === 0) {
                    resultsContainer.innerHTML = `
                        <div class="nav-finder-empty">
                            <div>No links found</div>
                            <div style="margin-top: 8px; font-size: 12px;">
                                ${links.length === 0 ? 'Try reloading the page or switching languages' : 'Try a different search term'}
                            </div>
                        </div>
                    `;
                    return;
                }

                resultsContainer.innerHTML = filtered.map(link => {
                    const pinned = isPinned(link);
                    return `
                        <div class="nav-finder-item ${pinned ? 'pinned' : ''}">
                            <div class="nav-finder-item-info">
                                ${link.path ? `<div class="nav-finder-item-path">${link.path}</div>` : ''}
                                <div class="nav-finder-item-text">${link.text}</div>
                                <div class="nav-finder-item-url">${link.url}</div>
                            </div>
                            <div class="nav-finder-item-actions">
                                <button class="nav-finder-btn nav-finder-btn-copy" data-url="${link.url}">📋</button>
                                <button class="nav-finder-btn ${pinned ? 'nav-finder-btn-unpin' : 'nav-finder-btn-pin'}" data-link='${JSON.stringify(link).replace(/'/g, '&apos;')}'>${pinned ? '📍' : '📌'}</button>
                            </div>
                        </div>
                    `;
                }).join('');

                // Attach event listeners
                resultsContainer.querySelectorAll('.nav-finder-btn-copy').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const url = btn.dataset.url;
                        navigator.clipboard.writeText(url).then(() => {
                            const originalText = btn.innerHTML;
                            btn.innerHTML = '✅ Copied!';
                            btn.style.background = '#10b981';
                            setTimeout(() => {
                                btn.innerHTML = originalText;
                                btn.style.background = '';
                            }, 1500);
                        });
                    });
                });

                resultsContainer.querySelectorAll('.nav-finder-btn-pin, .nav-finder-btn-unpin').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const link = JSON.parse(btn.dataset.link);
                        togglePin(link);
                        renderResults();
                    });
                });
            }

            // Event listeners
            trigger.addEventListener('click', () => {
                container.classList.toggle('active');
                if (container.classList.contains('active')) {
                    searchInput.focus();
                    renderResults();
                }
            });

            container.querySelector('.nav-finder-close').addEventListener('click', () => {
                container.classList.remove('active');
            });

            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value;
                renderResults();
            });

            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    activeTab = tab.dataset.tab;
                    renderResults();
                });
            });

            // Keyboard shortcuts
            document.addEventListener('keydown', (e) => {
                // Ctrl+K or Cmd+K to open
                if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                    e.preventDefault();
                    container.classList.add('active');
                    searchInput.focus();
                    renderResults();
                }

                // Escape to close
                if (e.key === 'Escape' && container.classList.contains('active')) {
                    container.classList.remove('active');
                }
            });

            log('[Indigo Nav Finder] UI created successfully');
        }, 2000); // Wait 2 seconds for page to fully load
    }

    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createUI);
    } else {
        createUI();
    }
})();
