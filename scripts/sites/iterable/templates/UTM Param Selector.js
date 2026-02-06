// ==UserScript==
// @name         Iterable - Link Param Helper
// @namespace    https://github.com/Colin-Whelan
// @version      1.0
// @description  Adds UTM parameter selection to the Action panel in Iterable's BEE editor
// @author       Colin Whelan
// @match        https://app.iterable.com/templates/editor?*
// @match        https://app.getbee.io/*
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
    'use strict';

    const LOG_PREFIX = '[Link Param Helper]';

    // =====================
    // DEFAULT CONFIG
    // =====================
    const DEFAULT_PARAM_TYPES = {
        utm_term: {
            label: 'utm_term',
            categories: [
                { name: 'General', color: '#2d6a4f', terms: ['promo', 'contest', 'awards', 'gm'] },
                { name: 'Books', color: '#9b2226', terms: ['books', 'books-kids-books'] },
                { name: 'Kids', color: '#e76f51', terms: ['kids-promo', 'kids-gifts', 'kids-books', 'kids-events', 'kids-trade'] },
                { name: 'Gifts', color: '#7b2d8b', terms: ['gifts'] },
                { name: 'Events', color: '#0077b6', terms: ['events'] },
                { name: 'Features', color: '#b08d19', terms: ['heathers-picks', 'recos'] }
            ]
        },
        utm_id: {
            label: 'utm_id',
            categories: [
                { name: 'Campaigns', color: '#1d3557', terms: ['spring-2025', 'summer-2025', 'fall-2025', 'holiday-2025'] },
                { name: 'Channels', color: '#457b9d', terms: ['email-promo', 'email-trigger', 'email-lifecycle'] }
            ]
        }
    };

    // =====================
    // CONFIG
    // =====================
    const CONFIG = {
        selectors: {
            actionPanel: 'div[data-qa="sidebar-section-action"]',
            buttonContainer: '.href-container.BeeLink_hrefContainer__Nfygl',
            urlInput: '.href-container--cs input[type="text"]',
            customButton: '.link-param-helper-btn',
            dropdown: '.link-param-dropdown',
            textLinkDialog: '.tox-dialog[id^="tox_dialog_CustomDialogForLink"]'
        },
        buttonText: 'Add Param',
        maxRecents: 5,
        paramTypes: {}
    };

    // =====================
    // PERSISTENT CONFIG
    // =====================
    const PersistentConfig = {
        load() {
            try {
                const saved = GM_getValue('paramTypes', null);
                if (saved) {
                    CONFIG.paramTypes = JSON.parse(saved);
                } else {
                    CONFIG.paramTypes = JSON.parse(JSON.stringify(DEFAULT_PARAM_TYPES));
                }
            } catch (e) {
                Logger.warn('Failed to load config, using defaults:', e);
                CONFIG.paramTypes = JSON.parse(JSON.stringify(DEFAULT_PARAM_TYPES));
            }
        },

        save() {
            try {
                GM_setValue('paramTypes', JSON.stringify(CONFIG.paramTypes));
            } catch (e) {
                Logger.error('Failed to save config:', e);
            }
        },

        reset() {
            CONFIG.paramTypes = JSON.parse(JSON.stringify(DEFAULT_PARAM_TYPES));
            this.save();
        }
    };

    // =====================
    // STATE
    // =====================
    const State = {
        activeParamType: null,

        init() {
            const keys = Object.keys(CONFIG.paramTypes);
            if (keys.length > 0) this.activeParamType = keys[0];
        },

        getActiveConfig() {
            return CONFIG.paramTypes[this.activeParamType];
        },

        getParamTypeKeys() {
            return Object.keys(CONFIG.paramTypes);
        }
    };

    // =====================
    // LOGGER
    // =====================
    const Logger = {
        log(...args) { console.log(LOG_PREFIX, ...args); },
        warn(...args) { console.warn(LOG_PREFIX, ...args); },
        error(...args) { console.error(LOG_PREFIX, ...args); }
    };

    // =====================
    // STORAGE (Session recents, per param type)
    // =====================
    const Storage = {
        recents: {},

        addRecent(paramType, term) {
            if (!this.recents[paramType]) this.recents[paramType] = [];
            this.recents[paramType] = this.recents[paramType].filter(t => t !== term);
            this.recents[paramType].unshift(term);
            if (this.recents[paramType].length > CONFIG.maxRecents) {
                this.recents[paramType] = this.recents[paramType].slice(0, CONFIG.maxRecents);
            }
        },

        getRecents(paramType) {
            return this.recents[paramType] || [];
        }
    };

    // =====================
    // URL UTILS
    // =====================
    const URLUtils = {
        addOrReplaceParam(url, paramName, paramValue) {
            if (!url) return url;
            try {
                const hasProtocol = url.includes('://');
                const workingUrl = hasProtocol ? url : `https://${url}`;
                const urlObj = new URL(workingUrl);
                urlObj.searchParams.set(paramName, paramValue);
                let result = urlObj.toString();
                if (!hasProtocol) result = result.replace(/^https?:\/\//, '');
                return result;
            } catch (e) {
                Logger.warn('Could not parse URL, appending manually:', e.message);
                const separator = url.includes('?') ? '&' : '?';
                const paramRegex = new RegExp(`([?&])${paramName}=[^&]*`, 'g');
                if (paramRegex.test(url)) {
                    return url.replace(paramRegex, `$1${paramName}=${paramValue}`);
                } else {
                    return `${url}${separator}${paramName}=${paramValue}`;
                }
            }
        }
    };

    // =====================
    // COLOR UTILS
    // =====================
    const ColorUtils = {
        bubbleColors(hex) {
            return {
                bg: hex + '33',
                border: hex + '88',
                text: this.lighten(hex, 0.65)
            };
        },

        recentBubbleColors() {
            return { bg: '#ffffff0d', border: '#ffffff44', text: '#aac8ff' };
        },

        lighten(hex, factor) {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgb(${Math.round(r + (255 - r) * factor)},${Math.round(g + (255 - g) * factor)},${Math.round(b + (255 - b) * factor)})`;
        }
    };

    // =====================
    // STYLES
    // =====================
    const Styles = {
        inject() {
            if (document.getElementById('link-param-helper-styles')) return;

            const css = `
                /* ===== DROPDOWN ===== */
                .link-param-dropdown {
                    position: absolute;
                    bottom: 100%;
                    left: -115px;
                    width: 355px;
                    max-height: 520px;
                    overflow-y: auto;
                    background: #1e1e1e;
                    border: 1px solid #444;
                    border-radius: 8px;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
                    z-index: 10000;
                    margin-bottom: 4px;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                }

                .lph-type-tabs {
                    display: flex;
                    border-top: 1px solid #333;
                    background: #252525;
                    border-radius: 0 0 8px 8px;
                    overflow: hidden;
                    flex-shrink: 0;
                }

                .lph-type-tab {
                    flex: 1;
                    padding: 7px 8px;
                    background: none;
                    border: none !important;
                    color: #888;
                    font-size: 11px;
                    font-weight: 600;
                    font-family: monospace;
                    cursor: pointer;
                    text-align: center;
                    transition: all 0.15s;
                    letter-spacing: 0.3px;
                }

                .lph-type-tab:hover { color: #bbb; background: #2a2a2a; }

                .lph-type-tab--active {
                    color: #fff;
                    background: #333;
                    box-shadow: inset 0 -2px 0 #6ea8fe;
                }

                .lph-body {
                    padding: 10px;
                    overflow-y: auto;
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }

                .lph-group { margin-bottom: 10px; }
                .lph-group:last-child { margin-bottom: 0; }

                .lph-group__label {
                    font-size: 10px;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: #777;
                    padding: 0 2px 4px;
                    letter-spacing: 0.5px;
                }

                .lph-group__bubbles {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                }

                .lph-bubble {
                    display: inline-block;
                    padding: 4px 10px !important;
                    font-size: 12px;
                    font-weight: 500;
                    border-radius: 14px !important;
                    cursor: pointer;
                    transition: all 0.15s;
                    border: 1px solid transparent !important;
                    white-space: nowrap;
                    line-height: 1.4;
                }

                .lph-bubble:hover { filter: brightness(1.3); transform: scale(1.04); }
                .lph-bubble--recent { border-style: dashed !important; }

                .lph-divider { height: 1px; background: #333; margin: 8px 0; }

                .lph-custom { display: flex; gap: 6px; margin-top: 4px; }

                .lph-custom__input {
                    flex: 1;
                    padding: 5px 8px;
                    background: #111;
                    border: 1px solid #444;
                    border-radius: 14px;
                    color: #ddd;
                    font-size: 12px;
                    outline: none;
                }

                .lph-custom__input:focus { border-color: #666; }

                .lph-custom__btn {
                    padding: 5px 12px;
                    background: #0066cc;
                    border: none !important;
                    border-radius: 14px;
                    color: #fff;
                    font-size: 12px;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: background 0.15s;
                }

                .lph-custom__btn:hover { background: #0077ee; }
                .lph-custom__btn:disabled { background: #333; color: #666; cursor: not-allowed; }

                .link-param-helper-btn-wrapper { position: relative; display: inline-block; }

                .link-param-dropdown--fixed { z-index: 100000; }

                .tox-form__group > .link-param-helper-btn-wrapper { margin-top: 6px; }

                /* ===== CONFIG MODAL ===== */
                .lph-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.6);
                    z-index: 99999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    backdrop-filter: blur(2px);
                }

                .lph-modal {
                    background: #1e1e1e;
                    border: 1px solid #444;
                    border-radius: 12px;
                    width: 580px;
                    max-height: 85vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                    color: #ddd;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 13px;
                }

                .lph-modal__header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 20px;
                    border-bottom: 1px solid #333;
                    flex-shrink: 0;
                }

                .lph-modal__title { font-size: 16px; font-weight: 600; color: #fff; }

                .lph-modal__close {
                    background: none;
                    border: none !important;
                    color: #888;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 6px;
                    line-height: 1;
                    transition: all 0.15s;
                }

                .lph-modal__close:hover { background: #333; color: #fff; }

                .lph-modal__body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px 20px;
                }

                .lph-modal__footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 20px;
                    border-top: 1px solid #333;
                    flex-shrink: 0;
                }

                .lph-modal__footer-left { display: flex; gap: 8px; }
                .lph-modal__footer-right { display: flex; gap: 8px; }

                /* Param type accordion */
                .lph-cfg-ptype {
                    border: 1px solid #333;
                    border-radius: 8px;
                    margin-bottom: 10px;
                    overflow: hidden;
                }

                .lph-cfg-ptype__header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 14px;
                    background: #252525;
                    cursor: pointer;
                    user-select: none;
                    transition: background 0.15s;
                }

                .lph-cfg-ptype__header:hover { background: #2a2a2a; }

                .lph-cfg-ptype__arrow {
                    font-size: 10px;
                    color: #888;
                    transition: transform 0.2s;
                    flex-shrink: 0;
                }

                .lph-cfg-ptype__arrow--open { transform: rotate(90deg); }

                .lph-cfg-ptype__name {
                    flex: 1;
                    font-weight: 600;
                    font-family: monospace;
                    font-size: 13px;
                }

                .lph-cfg-ptype__delete {
                    background: none;
                    border: none !important;
                    color: #666;
                    font-size: 14px;
                    cursor: pointer;
                    padding: 2px 6px;
                    border-radius: 4px;
                    transition: all 0.15s;
                }

                .lph-cfg-ptype__delete:hover { color: #ff6b6b; background: #ff6b6b22; }

                .lph-cfg-ptype__body {
                    padding: 12px 14px;
                    border-top: 1px solid #333;
                }

                .lph-cfg-ptype__body--hidden { display: none; }

                /* Category rows */
                .lph-cfg-cat {
                    background: #252525;
                    border-radius: 8px;
                    padding: 10px 12px;
                    margin-bottom: 8px;
                }

                .lph-cfg-cat__row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 8px;
                }

                .lph-cfg-cat__color {
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    border: 1px solid #555;
                    cursor: pointer;
                    padding: 0;
                    flex-shrink: 0;
                    background: none;
                }

                .lph-cfg-cat__color::-webkit-color-swatch-wrapper { padding: 0; }
                .lph-cfg-cat__color::-webkit-color-swatch { border: none; border-radius: 5px; }

                .lph-cfg-input {
                    flex: 1;
                    padding: 6px 10px;
                    background: #111;
                    border: 1px solid #444;
                    border-radius: 6px;
                    color: #ddd;
                    font-size: 13px;
                    outline: none;
                }

                .lph-cfg-input:focus { border-color: #666; }
                .lph-cfg-input--mono { font-family: monospace; }

                .lph-cfg-cat__delete {
                    background: none;
                    border: none !important;
                    color: #666;
                    font-size: 13px;
                    cursor: pointer;
                    padding: 4px 6px;
                    border-radius: 4px;
                    transition: all 0.15s;
                    flex-shrink: 0;
                }

                .lph-cfg-cat__delete:hover { color: #ff6b6b; background: #ff6b6b22; }

                .lph-cfg-cat__terms-label {
                    font-size: 10px;
                    color: #777;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                    margin-bottom: 4px;
                }

                .lph-cfg-cat__terms-area {
                    width: 100%;
                    padding: 6px 10px;
                    background: #111;
                    border: 1px solid #444;
                    border-radius: 6px;
                    color: #ddd;
                    font-size: 12px;
                    font-family: monospace;
                    resize: vertical;
                    min-height: 32px;
                    outline: none;
                    line-height: 1.5;
                    box-sizing: border-box;
                }

                .lph-cfg-cat__terms-area:focus { border-color: #666; }

                .lph-cfg-add-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 5px 12px;
                    background: #ffffff0a;
                    border: 1px dashed #555 !important;
                    border-radius: 6px;
                    color: #999;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .lph-cfg-add-btn:hover { background: #ffffff15; color: #ccc; border-color: #777 !important; }

                .lph-btn {
                    padding: 7px 16px;
                    border: none !important;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .lph-btn--primary { background: #0066cc; color: #fff; }
                .lph-btn--primary:hover { background: #0077ee; }
                .lph-btn--ghost { background: none; color: #999; }
                .lph-btn--ghost:hover { color: #ccc; background: #ffffff0a; }
                .lph-btn--danger { background: none; color: #ff6b6b; }
                .lph-btn--danger:hover { background: #ff6b6b22; }
            `;

            const style = document.createElement('style');
            style.id = 'link-param-helper-styles';
            style.textContent = css;
            document.head.appendChild(style);
        }
    };

    // =====================
    // UI MODULE (Dropdown)
    // =====================
    const UI = {
        dropdownVisible: false,

        createButton() {
            const wrapper = document.createElement('div');
            wrapper.className = 'link-param-helper-btn-wrapper';

            const button = document.createElement('button');
            button.className = 'Button_button__IQK4r Button_text__IQK4r Button_small__IQK4r Button_primary__IQK4r button-text--cs button-small--cs button-primary--cs button--cs link-param-helper-btn';
            button.type = 'button';
            button.textContent = CONFIG.buttonText;
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown(wrapper);
            });

            wrapper.appendChild(button);
            return wrapper;
        },

        toggleDropdown(wrapper) {
            // Check for existing dropdown (could be child of wrapper OR body)
            const existingChild = wrapper.querySelector(CONFIG.selectors.dropdown);
            const existingBody = document.querySelector('.link-param-dropdown--fixed');
            if (existingChild || existingBody) {
                if (existingChild) existingChild.remove();
                if (existingBody) existingBody.remove();
                this.dropdownVisible = false;
                this.activeWrapper = null;
            } else {
                // Reload config from storage in case it was updated via the config modal on the main page
                PersistentConfig.load();
                if (!CONFIG.paramTypes[State.activeParamType]) {
                    State.activeParamType = Object.keys(CONFIG.paramTypes)[0] || null;
                }

                const dropdown = this.createDropdown();
                const isInToxDialog = !!wrapper.closest('.tox-dialog');

                if (isInToxDialog) {
                    // Render on body with fixed positioning to escape tox dialog clipping
                    dropdown.classList.add('link-param-dropdown--fixed');
                    const rect = wrapper.getBoundingClientRect();
                    dropdown.style.position = 'fixed';
                    dropdown.style.bottom = 'auto';
                    dropdown.style.left = (rect.left - 400) + 'px';
                    dropdown.style.top = (rect.top + 300) + 'px';
                    dropdown.style.transform = 'translateY(-100%)';
                    document.body.appendChild(dropdown);
                } else {
                    wrapper.appendChild(dropdown);
                }

                this.dropdownVisible = true;
                this.activeWrapper = wrapper;

                // Auto-scroll body to bottom if recents exist (keeps recents visible near the button)
                this.scrollToRecents(dropdown);

                setTimeout(() => {
                    document.addEventListener('click', this.handleOutsideClick);
                }, 0);
            }
        },

        scrollToRecents(dropdown) {
            const body = dropdown.querySelector('.lph-body');
            const recents = Storage.getRecents(State.activeParamType);
            if (body && recents.length > 0) {
                requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
            }
        },

        handleOutsideClick(e) {
            const dropdown = document.querySelector(CONFIG.selectors.dropdown) || document.querySelector('.link-param-dropdown--fixed');
            const isButton = e.target.closest('.link-param-helper-btn-wrapper');
            if (dropdown && !dropdown.contains(e.target) && !isButton) {
                dropdown.remove();
                UI.dropdownVisible = false;
                UI.activeWrapper = null;
                document.removeEventListener('click', UI.handleOutsideClick);
            }
        },

        createDropdown() {
            const dropdown = document.createElement('div');
            dropdown.className = 'link-param-dropdown';

            const body = document.createElement('div');
            body.className = 'lph-body';
            this.renderBody(body);
            dropdown.appendChild(body);

            const keys = State.getParamTypeKeys();
            if (keys.length > 1) {
                const tabs = document.createElement('div');
                tabs.className = 'lph-type-tabs';

                keys.forEach(key => {
                    const tab = document.createElement('button');
                    tab.className = 'lph-type-tab' + (key === State.activeParamType ? ' lph-type-tab--active' : '');
                    tab.textContent = CONFIG.paramTypes[key].label;
                    tab.addEventListener('click', (e) => {
                        e.stopPropagation();
                        State.activeParamType = key;
                        body.innerHTML = '';
                        this.renderBody(body);
                        tabs.querySelectorAll('.lph-type-tab').forEach(t => t.classList.remove('lph-type-tab--active'));
                        tab.classList.add('lph-type-tab--active');

                        // Auto-scroll after switching tabs
                        const recents = Storage.getRecents(key);
                        if (recents.length > 0) {
                            requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
                        }
                    });
                    tabs.appendChild(tab);
                });

                dropdown.appendChild(tabs);
            }

            return dropdown;
        },

        renderBody(body) {
            const activeConfig = State.getActiveConfig();
            if (!activeConfig) return;

            const recents = Storage.getRecents(State.activeParamType);

            // Categories (top = farthest from mouse)
            activeConfig.categories.forEach(cat => {
                body.appendChild(this.createGroup(cat.name, cat.terms, cat.color));
            });

            // Custom input
            body.appendChild(this.createDivider());
            body.appendChild(this.createCustomRow());

            // Recents (bottom = nearest to mouse/button)
            if (recents.length > 0) {
                body.appendChild(this.createDivider());
                body.appendChild(this.createRecentGroup(recents));
            }
        },

        createGroup(name, terms, color) {
            const group = document.createElement('div');
            group.className = 'lph-group';

            const label = document.createElement('div');
            label.className = 'lph-group__label';
            label.textContent = name;
            group.appendChild(label);

            const bubblesRow = document.createElement('div');
            bubblesRow.className = 'lph-group__bubbles';

            const colors = ColorUtils.bubbleColors(color);
            terms.forEach(term => {
                const bubble = document.createElement('button');
                bubble.className = 'lph-bubble';
                bubble.textContent = term;
                bubble.style.background = colors.bg;
                bubble.style.borderColor = colors.border;
                bubble.style.color = colors.text;
                bubble.addEventListener('click', () => Actions.selectTerm(term));
                bubblesRow.appendChild(bubble);
            });

            group.appendChild(bubblesRow);
            return group;
        },

        createRecentGroup(recents) {
            const group = document.createElement('div');
            group.className = 'lph-group';

            const label = document.createElement('div');
            label.className = 'lph-group__label';
            label.textContent = 'Recent';
            group.appendChild(label);

            const bubblesRow = document.createElement('div');
            bubblesRow.className = 'lph-group__bubbles';

            const colors = ColorUtils.recentBubbleColors();
            recents.forEach(term => {
                const bubble = document.createElement('button');
                bubble.className = 'lph-bubble lph-bubble--recent';
                bubble.textContent = term;
                bubble.style.background = colors.bg;
                bubble.style.borderColor = colors.border;
                bubble.style.color = colors.text;
                bubble.addEventListener('click', () => Actions.selectTerm(term));
                bubblesRow.appendChild(bubble);
            });

            group.appendChild(bubblesRow);
            return group;
        },

        createDivider() {
            const d = document.createElement('div');
            d.className = 'lph-divider';
            return d;
        },

        createCustomRow() {
            const row = document.createElement('div');
            row.className = 'lph-custom';

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'lph-custom__input';
            input.placeholder = `Custom ${State.getActiveConfig()?.label || 'param'}…`;

            const btn = document.createElement('button');
            btn.className = 'lph-custom__btn';
            btn.textContent = 'Apply';
            btn.disabled = true;

            input.addEventListener('input', () => { btn.disabled = !input.value.trim(); });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && input.value.trim()) Actions.selectTerm(input.value.trim());
            });
            btn.addEventListener('click', () => {
                if (input.value.trim()) Actions.selectTerm(input.value.trim());
            });

            row.appendChild(input);
            row.appendChild(btn);
            return row;
        },

        closeDropdown() {
            const dropdown = document.querySelector(CONFIG.selectors.dropdown) || document.querySelector('.link-param-dropdown--fixed');
            if (dropdown) {
                dropdown.remove();
                this.dropdownVisible = false;
                this.activeWrapper = null;
                document.removeEventListener('click', this.handleOutsideClick);
            }
        },

        injectButton(container, inputFinder) {
            const existing = container.querySelector('.link-param-helper-btn-wrapper');
            if (existing) existing.remove();
            const wrapper = this.createButton();
            wrapper._findUrlInput = inputFinder;
            container.appendChild(wrapper);
            Logger.log('Button injected');
        }
    };

    // =====================
    // CONFIG MODAL
    // =====================
    const ConfigModal = {
        overlay: null,
        draft: null,

        open() {
            if (this.overlay) return;

            // Deep clone current config as working draft
            this.draft = JSON.parse(JSON.stringify(CONFIG.paramTypes));

            this.overlay = document.createElement('div');
            this.overlay.className = 'lph-modal-overlay';
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) this.close();
            });

            const modal = document.createElement('div');
            modal.className = 'lph-modal';

            // Header
            const header = document.createElement('div');
            header.className = 'lph-modal__header';

            const title = document.createElement('div');
            title.className = 'lph-modal__title';
            title.textContent = 'Link Param Helper — Config';

            const closeBtn = document.createElement('button');
            closeBtn.className = 'lph-modal__close';
            closeBtn.textContent = '×';
            closeBtn.addEventListener('click', () => this.close());

            header.appendChild(title);
            header.appendChild(closeBtn);

            // Body
            const body = document.createElement('div');
            body.className = 'lph-modal__body';
            body.id = 'lph-cfg-body';
            this.renderBody(body);

            // Footer
            const footer = document.createElement('div');
            footer.className = 'lph-modal__footer';

            const footerLeft = document.createElement('div');
            footerLeft.className = 'lph-modal__footer-left';

            const resetBtn = document.createElement('button');
            resetBtn.className = 'lph-btn lph-btn--danger';
            resetBtn.textContent = 'Reset Defaults';
            resetBtn.addEventListener('click', () => {
                if (confirm('Reset all param config to defaults? This cannot be undone.')) {
                    this.draft = JSON.parse(JSON.stringify(DEFAULT_PARAM_TYPES));
                    body.innerHTML = '';
                    this.renderBody(body);
                }
            });

            const exportBtn = document.createElement('button');
            exportBtn.className = 'lph-btn lph-btn--ghost';
            exportBtn.textContent = 'Export';
            exportBtn.addEventListener('click', () => {
                const blob = new Blob([JSON.stringify(this.draft, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'link-param-helper-config.json';
                a.click();
                URL.revokeObjectURL(url);
            });

            const importBtn = document.createElement('button');
            importBtn.className = 'lph-btn lph-btn--ghost';
            importBtn.textContent = 'Import';
            importBtn.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.addEventListener('change', () => {
                    const file = input.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                        try {
                            const imported = JSON.parse(reader.result);
                            if (typeof imported !== 'object' || Object.keys(imported).length === 0) {
                                alert('Invalid config file.');
                                return;
                            }
                            this.draft = imported;
                            body.innerHTML = '';
                            this.renderBody(body);
                        } catch (e) {
                            alert('Failed to parse config file: ' + e.message);
                        }
                    };
                    reader.readAsText(file);
                });
                input.click();
            });

            footerLeft.appendChild(resetBtn);
            footerLeft.appendChild(exportBtn);
            footerLeft.appendChild(importBtn);

            const footerRight = document.createElement('div');
            footerRight.className = 'lph-modal__footer-right';

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'lph-btn lph-btn--ghost';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.addEventListener('click', () => this.close());

            const saveBtn = document.createElement('button');
            saveBtn.className = 'lph-btn lph-btn--primary';
            saveBtn.textContent = 'Save';
            saveBtn.addEventListener('click', () => this.save(body));

            footerRight.appendChild(cancelBtn);
            footerRight.appendChild(saveBtn);

            footer.appendChild(footerLeft);
            footer.appendChild(footerRight);

            modal.appendChild(header);
            modal.appendChild(body);
            modal.appendChild(footer);
            this.overlay.appendChild(modal);
            document.body.appendChild(this.overlay);

            // Close on Escape
            this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
            document.addEventListener('keydown', this._escHandler);
        },

        close() {
            if (this.overlay) {
                this.overlay.remove();
                this.overlay = null;
                this.draft = null;
            }
            if (this._escHandler) {
                document.removeEventListener('keydown', this._escHandler);
                this._escHandler = null;
            }
        },

        renderBody(body) {
            body.innerHTML = '';

            Object.keys(this.draft).forEach(key => {
                body.appendChild(this.createParamTypeSection(key));
            });

            // Add param type button
            const addBtn = document.createElement('button');
            addBtn.className = 'lph-cfg-add-btn';
            addBtn.innerHTML = '+ Add param type';
            addBtn.style.marginTop = '4px';
            addBtn.addEventListener('click', () => {
                const name = prompt('Param name (e.g. utm_campaign):');
                if (!name || !name.trim()) return;
                const key = name.trim().toLowerCase().replace(/\s+/g, '_');
                if (this.draft[key]) {
                    alert('Param type already exists.');
                    return;
                }
                this.draft[key] = {
                    label: key,
                    categories: [{ name: 'Default', color: '#666666', terms: ['example'] }]
                };
                body.innerHTML = '';
                this.renderBody(body);
            });
            body.appendChild(addBtn);
        },

        createParamTypeSection(key) {
            const ptype = this.draft[key];
            const section = document.createElement('div');
            section.className = 'lph-cfg-ptype';
            section.dataset.ptypeKey = key;

            // Header
            const header = document.createElement('div');
            header.className = 'lph-cfg-ptype__header';

            const arrow = document.createElement('span');
            arrow.className = 'lph-cfg-ptype__arrow lph-cfg-ptype__arrow--open';
            arrow.textContent = '▶';

            const nameEl = document.createElement('span');
            nameEl.className = 'lph-cfg-ptype__name';
            nameEl.textContent = ptype.label;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'lph-cfg-ptype__delete';
            deleteBtn.textContent = '✕';
            deleteBtn.title = 'Delete param type';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (Object.keys(this.draft).length <= 1) {
                    alert('Must have at least one param type.');
                    return;
                }
                if (confirm(`Delete "${ptype.label}" and all its categories?`)) {
                    delete this.draft[key];
                    section.remove();
                }
            });

            header.appendChild(arrow);
            header.appendChild(nameEl);
            header.appendChild(deleteBtn);

            // Body
            const bodyEl = document.createElement('div');
            bodyEl.className = 'lph-cfg-ptype__body';

            header.addEventListener('click', () => {
                const isOpen = arrow.classList.toggle('lph-cfg-ptype__arrow--open');
                bodyEl.classList.toggle('lph-cfg-ptype__body--hidden', !isOpen);
            });

            this.renderCategories(bodyEl, key);

            section.appendChild(header);
            section.appendChild(bodyEl);
            return section;
        },

        renderCategories(container, ptypeKey) {
            container.innerHTML = '';
            const ptype = this.draft[ptypeKey];

            ptype.categories.forEach((cat, idx) => {
                container.appendChild(this.createCategoryRow(ptypeKey, idx));
            });

            const addBtn = document.createElement('button');
            addBtn.className = 'lph-cfg-add-btn';
            addBtn.innerHTML = '+ Add category';
            addBtn.addEventListener('click', () => {
                ptype.categories.push({ name: 'New Category', color: '#666666', terms: [] });
                this.renderCategories(container, ptypeKey);
            });
            container.appendChild(addBtn);
        },

        createCategoryRow(ptypeKey, catIdx) {
            const cat = this.draft[ptypeKey].categories[catIdx];
            const row = document.createElement('div');
            row.className = 'lph-cfg-cat';
            row.dataset.catIdx = catIdx;

            // Top row: color + name + delete
            const topRow = document.createElement('div');
            topRow.className = 'lph-cfg-cat__row';

            const colorPicker = document.createElement('input');
            colorPicker.type = 'color';
            colorPicker.className = 'lph-cfg-cat__color';
            colorPicker.value = cat.color;
            colorPicker.addEventListener('input', () => { cat.color = colorPicker.value; });

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'lph-cfg-input';
            nameInput.value = cat.name;
            nameInput.placeholder = 'Category name';
            nameInput.addEventListener('input', () => { cat.name = nameInput.value; });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'lph-cfg-cat__delete';
            deleteBtn.textContent = '✕';
            deleteBtn.title = 'Delete category';
            deleteBtn.addEventListener('click', () => {
                this.draft[ptypeKey].categories.splice(catIdx, 1);
                const container = row.parentElement;
                this.renderCategories(container, ptypeKey);
            });

            topRow.appendChild(colorPicker);
            topRow.appendChild(nameInput);
            topRow.appendChild(deleteBtn);

            // Terms
            const termsLabel = document.createElement('div');
            termsLabel.className = 'lph-cfg-cat__terms-label';
            termsLabel.textContent = 'Terms (comma-separated)';

            const termsArea = document.createElement('textarea');
            termsArea.className = 'lph-cfg-cat__terms-area';
            termsArea.value = cat.terms.join(', ');
            termsArea.placeholder = 'term1, term2, term3';
            termsArea.rows = 1;
            termsArea.addEventListener('input', () => {
                cat.terms = termsArea.value.split(',').map(s => s.trim()).filter(Boolean);
            });

            row.appendChild(topRow);
            row.appendChild(termsLabel);
            row.appendChild(termsArea);
            return row;
        },

        save(body) {
            // Validate labels
            for (const [key, pt] of Object.entries(this.draft)) {
                if (!pt.label) pt.label = key;
            }

            CONFIG.paramTypes = this.draft;
            PersistentConfig.save();

            // Reset active type if it was removed
            if (!CONFIG.paramTypes[State.activeParamType]) {
                State.activeParamType = Object.keys(CONFIG.paramTypes)[0] || null;
            }

            // Notify the BEE iframe to close any open param dropdown
            document.querySelectorAll('iframe').forEach(f => {
                try { f.contentWindow.postMessage({ type: 'lph-config-updated' }, '*'); } catch (e) {}
            });

            Logger.log('Config saved');
            this.close();
        }
    };

    // =====================
    // ACTIONS
    // =====================
    const Actions = {
        selectTerm(term) {
            const paramName = State.activeParamType;
            Logger.log(`${paramName} selected:`, term);

            const wrapper = UI.activeWrapper;
            const urlInput = wrapper?._findUrlInput?.();
            if (!urlInput) {
                Logger.error('URL input not found');
                return;
            }

            const currentUrl = urlInput.value;
            const newUrl = URLUtils.addOrReplaceParam(currentUrl, paramName, term);

            // Use native setter to ensure React/TinyMCE picks up the change
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (nativeSetter) {
                nativeSetter.call(urlInput, newUrl);
            } else {
                urlInput.value = newUrl;
            }
            urlInput.dispatchEvent(new Event('input', { bubbles: true }));
            urlInput.dispatchEvent(new Event('change', { bubbles: true }));

            Logger.log('URL updated:', currentUrl, '->', newUrl);
            Storage.addRecent(paramName, term);
            UI.closeDropdown();
        }
    };

    // =====================
    // OBSERVER
    // =====================
    const Observer = {
        instance: null,

        init() {
            Logger.log('Initializing observer...');
            this.instance = new MutationObserver(this.handleMutations.bind(this));
            this.instance.observe(document.body, { childList: true, subtree: true });
            this.checkForActionPanel();
            this.checkForTextLinkDialog();
        },

        handleMutations(mutations) {
            for (const mutation of mutations) {
                if (mutation.addedNodes.length) {
                    this.checkForActionPanel();
                    this.checkForTextLinkDialog();
                }
            }
        },

        checkForActionPanel() {
            const actionPanel = document.querySelector(CONFIG.selectors.actionPanel);
            if (!actionPanel) return;
            const buttonContainer = actionPanel.querySelector(CONFIG.selectors.buttonContainer);
            if (!buttonContainer) return;
            if (!buttonContainer.querySelector('.link-param-helper-btn-wrapper')) {
                UI.injectButton(buttonContainer, () => {
                    const panel = document.querySelector(CONFIG.selectors.actionPanel);
                    return panel?.querySelector(CONFIG.selectors.urlInput);
                });
            }
        },

        checkForTextLinkDialog() {
            const dialog = document.querySelector(CONFIG.selectors.textLinkDialog);
            if (!dialog) return;

            // Find the URL form group by its label text
            const labels = dialog.querySelectorAll('.tox-label');
            let urlGroup = null;
            for (const label of labels) {
                if (label.textContent.trim() === 'Url') {
                    urlGroup = label.closest('.tox-form__group');
                    break;
                }
            }
            if (!urlGroup) return;

            if (!urlGroup.querySelector('.link-param-helper-btn-wrapper')) {
                UI.injectButton(urlGroup, () => urlGroup.querySelector('input.tox-textfield'));
            }
        }
    };

    // =====================
    // INIT
    // =====================
    function init() {
        const isInBeeIframe = window.location.hostname === 'app.getbee.io';

        Logger.log('=== Script starting ===');
        Logger.log('Is BEE iframe:', isInBeeIframe);

        // Load persisted config
        PersistentConfig.load();
        State.init();

        if (!isInBeeIframe) {
            // Register menu command only on the main Iterable page
            try {
                GM_registerMenuCommand('⚙️ Configure Link Params', () => {
                    Styles.inject();
                    ConfigModal.open();
                });
            } catch (e) {
                Logger.warn('GM_registerMenuCommand not available:', e.message);
            }
        }

        if (isInBeeIframe) {
            Logger.log('Running inside BEE iframe - initializing');
            Styles.inject();
            Observer.init();

            // Close dropdown when iframe loses focus (clicks on parent page, Tampermonkey menu, etc.)
            window.addEventListener('blur', () => { UI.closeDropdown(); });

            // Listen for config updates from the main page
            window.addEventListener('message', (e) => {
                if (e.data?.type === 'lph-config-updated') {
                    UI.closeDropdown();
                    PersistentConfig.load();
                    if (!CONFIG.paramTypes[State.activeParamType]) {
                        State.activeParamType = Object.keys(CONFIG.paramTypes)[0] || null;
                    }
                    Logger.log('Config reloaded via postMessage');
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
