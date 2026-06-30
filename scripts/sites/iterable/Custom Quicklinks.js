// ==UserScript==
// @name         Custom Quicklinks
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Adds custom quicklinks to Iterable's navbar
// @author       Colin Whelan
// @match        https://app.iterable.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Register script with the loader system
    window.SiteEnhancer = window.SiteEnhancer || {};
    window.SiteEnhancer.scripts = window.SiteEnhancer.scripts || {};
    window.SiteEnhancer.scripts['Custom Quicklinks'] = {
        name: 'Custom Quicklinks',
        version: '1.1',
        author: 'Colin Whelan',
        type: 'feature',
        description: 'Adds customizable quick links to navigation',
        init: init,
        configUI: showConfigUI,
        settings: {
            get: () => GM_getValue('iterableQuicklinks', defaultQuicklinks),
            set: (links) => saveQuicklinks(links)
        }
    };

    // ── Constants ───────────────────────────────────────────
    const SELECTORS = {
        navbar: '#navbar',
        logo: '#navbar-logo',
        wrapper: '.custom-quicklinks-wrapper'
    };

    // Add styles for the configuration UI + injected links
    GM_addStyle(`
        .quicklink-config-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.5); z-index: 10000;
            display: flex; justify-content: center; align-items: center;
        }
        .quicklink-config-panel {
            background: white; padding: 20px; border-radius: 8px;
            width: 500px; max-width: 90%; max-height: 90vh; overflow-y: auto;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .quicklink-row { display: flex; margin-bottom: 10px; gap: 10px; }
        .quicklink-row input {
            flex: 1; padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px;
        }
        .quicklink-buttons {
            display: flex; justify-content: space-between; margin-top: 15px;
        }
        .quicklink-button { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; }
        .quicklink-save { background: #1976d2; color: white; }
        .quicklink-cancel { background: #f5f5f5; }
        .quicklink-add { background: #4caf50; color: white; }
        .quicklink-remove { background: #f44336; color: white; padding: 6px 10px; }

        /* Injected quicklinks — sits between logo and quick actions */
        .custom-quicklinks-wrapper {
            display: flex; align-items: center; gap: 2px;
            height: 100%; margin: 0 8px;
            border-left: 1px solid var(--borderPrimary, #e0e0e0);
            padding-left: 8px;
        }
        .custom-quicklink-item {
            display: inline-flex; align-items: center; height: 28px;
            padding: 0 10px; border-radius: 6px;
            font-size: 14px; font-weight: 500;
            color: var(--textPrimary, inherit); text-decoration: none;
            white-space: nowrap; cursor: pointer;
        }
        .custom-quicklink-item:hover { background: rgba(127, 127, 127, 0.12); }

        .crPoGu { grid-area: inherit !important; }
        .eqcKGU[data-nova-theme="true"] {grid-template-areas: "logo a b c qactions links menus" !important; }
    `);

    // Configuration - Edit these quicklinks or use the Tampermonkey menu to configure
    let defaultQuicklinks = [
        { urlName: "Lists", url: "/lists" },
        { urlName: "User Lookup", url: "/users/lookup" },
    ];

    let quicklinks = GM_getValue('iterableQuicklinks', defaultQuicklinks);

    function saveQuicklinks(links) {
        GM_setValue('iterableQuicklinks', links);
        quicklinks = links;
        addQuicklinks(); // rebuilds the wrapper
    }

    // ── Injection ───────────────────────────────────────────
    function addQuicklinks() {
        const navbar = document.querySelector(SELECTORS.navbar);
        const logo = navbar?.querySelector(SELECTORS.logo);
        if (!navbar || !logo) return;

        // Remove existing wrapper (rebuild on config change / re-init)
        navbar.querySelector(SELECTORS.wrapper)?.remove();

        const wrapper = document.createElement('div');
        wrapper.className = 'custom-quicklinks-wrapper';
        wrapper.setAttribute('data-test', 'custom-quicklinks');

        quicklinks.forEach(link => {
            const a = document.createElement('a');
            a.className = 'custom-quicklink-item';
            a.href = link.url;
            a.textContent = link.urlName;
            a.setAttribute('data-test',
                `quicklink-${link.urlName.toLowerCase().replace(/\s+/g, '-')}-item`);
            wrapper.appendChild(a);
        });

        // Insert directly after the logo (right of logo, left of quick actions)
        logo.insertAdjacentElement('afterend', wrapper);
    }

    // ── Configuration UI ────────────────────────────────────
    function showConfigUI() {
        const overlay = document.createElement('div');
        overlay.className = 'quicklink-config-overlay';

        const panel = document.createElement('div');
        panel.className = 'quicklink-config-panel';

        const header = document.createElement('h2');
        header.textContent = 'Configure Quicklinks';
        header.style.marginTop = '0';
        panel.appendChild(header);

        const description = document.createElement('p');
        description.textContent = 'Add or edit your custom quicklinks. URLs should be relative (e.g., "/lists").';
        panel.appendChild(description);

        const linksContainer = document.createElement('div');
        linksContainer.id = 'quicklinks-container';
        panel.appendChild(linksContainer);

        function addLinkRow(link = { urlName: '', url: '' }) {
            const row = document.createElement('div');
            row.className = 'quicklink-row';

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.placeholder = 'Display Name';
            nameInput.value = link.urlName;
            nameInput.className = 'quicklink-name';

            const urlInput = document.createElement('input');
            urlInput.type = 'text';
            urlInput.placeholder = 'URL (e.g., /lists)';
            urlInput.value = link.url;
            urlInput.className = 'quicklink-url';

            const removeBtn = document.createElement('button');
            removeBtn.textContent = '✕';
            removeBtn.className = 'quicklink-button quicklink-remove';
            removeBtn.title = 'Remove this quicklink';
            removeBtn.onclick = () => row.remove();

            row.appendChild(nameInput);
            row.appendChild(urlInput);
            row.appendChild(removeBtn);
            linksContainer.appendChild(row);
        }

        quicklinks.forEach(link => addLinkRow(link));

        const addBtn = document.createElement('button');
        addBtn.textContent = '+ Add New Quicklink';
        addBtn.className = 'quicklink-button quicklink-add';
        addBtn.style.marginTop = '10px';
        addBtn.onclick = () => addLinkRow();
        panel.appendChild(addBtn);

        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'quicklink-buttons';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save Changes';
        saveBtn.className = 'quicklink-button quicklink-save';
        saveBtn.onclick = () => {
            const newLinks = [];
            linksContainer.querySelectorAll('.quicklink-row').forEach(row => {
                const name = row.querySelector('.quicklink-name').value.trim();
                const url = row.querySelector('.quicklink-url').value.trim();
                if (name && url) newLinks.push({ urlName: name, url });
            });
            saveQuicklinks(newLinks);
            overlay.remove();
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'quicklink-button quicklink-cancel';
        cancelBtn.onclick = () => overlay.remove();

        buttonsDiv.appendChild(cancelBtn);
        buttonsDiv.appendChild(saveBtn);
        panel.appendChild(buttonsDiv);

        overlay.appendChild(panel);
        document.body.appendChild(overlay);
    }

    if (!window.SiteEnhancer || !window.SiteEnhancer.loader) {
        GM_registerMenuCommand("Configure Quicklinks", showConfigUI);
    }

    // ── Initialization ──────────────────────────────────────
    function init() {
        const navbar = document.querySelector(SELECTORS.navbar);
        if (!navbar || !navbar.querySelector(SELECTORS.logo)) {
            setTimeout(init, 500);
            return;
        }
        addQuicklinks();
    }

    window.addEventListener('load', init);

    // SPA navigation
    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            setTimeout(init, 500);
        }
    }).observe(document, { subtree: true, childList: true });

    // Re-inject if the navbar re-renders without our links
    new MutationObserver(() => {
        const navbar = document.querySelector(SELECTORS.navbar);
        if (navbar && navbar.querySelector(SELECTORS.logo) &&
            !navbar.querySelector(SELECTORS.wrapper)) {
            addQuicklinks();
        }
    }).observe(document.body, { childList: true, subtree: true });

    init();
})();
