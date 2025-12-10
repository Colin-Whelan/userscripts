// ==UserScript==
// @name         Template Quick Search
// @namespace    http://tampermonkey.net/
// @version      2.2.0
// @description  Add quick search tags for Iterable template search with modern tag cloud UI and drag-to-reorder
// @author       Colin Whelan
// @match        https://app.iterable.com/templates*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @require      https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ============================================================================
    // CONFIGURATION
    // ============================================================================

    const CONFIG = {
        STORAGE_KEY: 'iterableQuickSearchTags',
        SETTINGS_KEY: 'iterableQuickSearchSettings',
        COLLAPSED_KEY: 'iterableQuickSearchCollapsed',
        DEFAULT_COLORS: [
            { start: '#10b981', end: '#047857' },  // Green: more dramatic
            { start: '#84cc16', end: '#4d7c0f' },  // Lime: deeper contrast
            { start: '#06b6d4', end: '#0e7490' },  // Cyan: more teal
            { start: '#6366f1', end: '#4338ca' },  // Indigo: deeper royal
            { start: '#8b5cf6', end: '#6d28d9' },  // Purple: richer
            { start: '#ec4899', end: '#be185d' },  // Pink: more intense
            { start: '#f59e0b', end: '#b45309' },  // Orange: warmer depth
            { start: '#f97316', end: '#c2410c' },  // Bright orange: more vibrant
            { start: '#ef4444', end: '#b91c1c' }  // Red: deeper crimson
        ],
        SORT_ORDERS: {
            ALPHA: 'alpha',
            RECENT: 'recent',
            CUSTOM: 'custom'
        },
        DEBOUNCE_DELAY: 100,
        ANIMATION_DURATION: 80
    };

    const STYLES = {
        CONTAINER: `
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            padding: 10px;
            margin: 16px 0;
            transition: all ${CONFIG.ANIMATION_DURATION}ms ease;
            background: #fafafa;
        `,
        HEADER: `
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            user-select: none;
        `,
        TITLE: `
            font-size: 14px;
            font-weight: 600;
            color: #374151;
            display: flex;
            align-items: center;
            gap: 8px;
        `,
        TOGGLE_ICON: `
            font-size: 12px;
            transition: transform ${CONFIG.ANIMATION_DURATION}ms ease;
            color: #6b7280;
        `,
        SETTINGS_BTN: `
            background: #374151;
            color: white;
            border: none;
            padding: 6px 14px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s ease;
        `,
        TAGS_CONTAINER: `
            display: flex;
            flex-wrap: wrap;
            gap: 2px;
            overflow: hidden;
            transition: max-height ${CONFIG.ANIMATION_DURATION}ms ease, opacity ${CONFIG.ANIMATION_DURATION}ms ease;
        `,
        TAG: `
            padding: 8px 16px;
            border-radius: 20px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            border: none;
            color: white;
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
        `,
        MODAL_OVERLAY: `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            backdrop-filter: blur(3px);
        `,
        MODAL: `
            background: white;
            border-radius: 16px;
            padding: 32px;
            max-width: 700px;
            width: 90%;
            max-height: 85vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        `,
        MODAL_HEADER: `
            font-size: 22px;
            font-weight: 600;
            margin-bottom: 24px;
            color: #1f2937;
            display: flex;
            align-items: center;
            gap: 12px;
        `,
        SECTION: `
            margin-bottom: 28px;
        `,
        SECTION_TITLE: `
            font-size: 13px;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 12px;
        `,
        INPUT_GROUP: `
            margin-bottom: 16px;
        `,
        LABEL: `
            display: block;
            font-size: 13px;
            font-weight: 500;
            color: #374151;
            margin-bottom: 8px;
        `,
        INPUT: `
            width: 100%;
            padding: 10px 14px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 14px;
            box-sizing: border-box;
            transition: all 0.2s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        `,
        SELECT: `
            width: 100%;
            padding: 10px 14px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 14px;
            box-sizing: border-box;
            background: white;
            cursor: pointer;
            transition: all 0.2s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        `,
        COLOR_PICKER_CONTAINER: `
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 8px;
        `,
        COLOR_OPTION: `
            width: 50px;
            height: 40px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            border: 3px solid transparent;
            position: relative;
        `,
        BUTTON: `
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        `,
        TAG_CLOUD_CONTAINER: `
            background: #f9fafb;
            border-radius: 12px;
            padding: 20px;
            min-height: 100px;
        `,
        TAG_CLOUD_ITEM: `
            display: inline-flex;
            align-items: center;
            padding: 8px 16px;
            margin: 5px;
            border-radius: 20px;
            cursor: move;
            font-size: 13px;
            font-weight: 500;
            color: white;
            transition: all 0.2s ease;
            position: relative;
        `,
        DELETE_BTN: `
            background: none;
            border: none;
            color: white;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            padding: 0 0 0 8px;
            opacity: 0.8;
            transition: opacity 0.2s ease;
        `,
        DRAG_HANDLE: `
            cursor: move;
            opacity: 0.6;
            margin-right: 6px;
            font-size: 14px;
        `,
        SORTABLE_GHOST: `
            opacity: 0.4;
        `,
        SORTABLE_DRAG: `
            opacity: 1;
            transform: rotate(3deg) scale(1.05);
            box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important;
        `
    };

    // ============================================================================
    // STATE MANAGEMENT
    // ============================================================================

    class StateManager {
        constructor() {
            this.tags = this.loadTags();
            this.settings = this.loadSettings();
            this.isCollapsed = this.loadCollapsedState();
        }

        loadTags() {
            const stored = GM_getValue(CONFIG.STORAGE_KEY, '[]');
            return JSON.parse(stored);
        }

        saveTags() {
            GM_setValue(CONFIG.STORAGE_KEY, JSON.stringify(this.tags));
        }

        loadSettings() {
            const stored = GM_getValue(CONFIG.SETTINGS_KEY, '{}');
            const settings = JSON.parse(stored);
            return {
                sortOrder: settings.sortOrder || CONFIG.SORT_ORDERS.CUSTOM
            };
        }

        saveSettings() {
            GM_setValue(CONFIG.SETTINGS_KEY, JSON.stringify(this.settings));
        }

        loadCollapsedState() {
            return GM_getValue(CONFIG.COLLAPSED_KEY, false);
        }

        saveCollapsedState() {
            GM_setValue(CONFIG.COLLAPSED_KEY, this.isCollapsed);
        }

        addTag(label, colorGradient) {
            const tag = {
                id: Date.now().toString(),
                label,
                colorGradient,
                timestamp: Date.now()
            };
            this.tags.push(tag);
            this.saveTags();
            return tag;
        }

        removeTag(id) {
            this.tags = this.tags.filter(tag => tag.id !== id);
            this.saveTags();
        }

        updateTag(id, updates) {
            const index = this.tags.findIndex(tag => tag.id === id);
            if (index !== -1) {
                this.tags[index] = { ...this.tags[index], ...updates };
                this.saveTags();
            }
        }

        reorderTags(newOrder) {
            // newOrder is an array of tag IDs in the new order
            const orderedTags = newOrder.map(id =>
                this.tags.find(tag => tag.id === id)
            ).filter(tag => tag !== undefined);

            this.tags = orderedTags;
            this.saveTags();
        }

        getSortedTags() {
            const tags = [...this.tags];

            switch (this.settings.sortOrder) {
                case CONFIG.SORT_ORDERS.ALPHA:
                    return tags.sort((a, b) => a.label.localeCompare(b.label));
                case CONFIG.SORT_ORDERS.RECENT:
                    return tags.sort((a, b) => b.timestamp - a.timestamp);
                case CONFIG.SORT_ORDERS.CUSTOM:
                default:
                    return tags;
            }
        }

        updateSortOrder(sortOrder) {
            this.settings.sortOrder = sortOrder;
            this.saveSettings();
        }

        toggleCollapsed() {
            this.isCollapsed = !this.isCollapsed;
            this.saveCollapsedState();
            return this.isCollapsed;
        }
    }

    // ============================================================================
    // DOM UTILITIES
    // ============================================================================

    class DOMHelper {
        static waitForElement(selector, timeout = 5000) {
            return new Promise((resolve, reject) => {
                if (document.querySelector(selector)) {
                    return resolve(document.querySelector(selector));
                }

                const observer = new MutationObserver(() => {
                    if (document.querySelector(selector)) {
                        observer.disconnect();
                        resolve(document.querySelector(selector));
                    }
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });

                setTimeout(() => {
                    observer.disconnect();
                    reject(new Error(`Timeout waiting for ${selector}`));
                }, timeout);
            });
        }

        static createElement(tag, styles = '', attributes = {}) {
            const element = document.createElement(tag);
            if (styles) element.style.cssText = styles;
            Object.entries(attributes).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
            return element;
        }
    }

    // ============================================================================
    // SEARCH INTEGRATION
    // ============================================================================

    class SearchIntegration {
        constructor() {
            this.searchInput = null;
        }

        async initialize() {
            try {
                this.searchInput = await DOMHelper.waitForElement('#template-search-input');
                console.log('[Iterable Quick Search] Search input found');
            } catch (error) {
                console.error('[Iterable Quick Search] Failed to find search input:', error);
            }
        }

        setSearchTerm(term) {
            if (!this.searchInput) return;

            // Get the native setter for the input value
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                'value'
            ).set;

            // Set the value using the native setter
            nativeInputValueSetter.call(this.searchInput, term);

            // Trigger both input and change events for React
            const inputEvent = new Event('input', { bubbles: true });
            const changeEvent = new Event('change', { bubbles: true });

            this.searchInput.dispatchEvent(inputEvent);
            this.searchInput.dispatchEvent(changeEvent);

            // Focus the input
            this.searchInput.focus();

            console.log('[Iterable Quick Search] Search term set to:', term);
        }
    }

    // ============================================================================
    // UI COMPONENTS
    // ============================================================================

    class QuickSearchUI {
        constructor(stateManager, searchIntegration) {
            this.state = stateManager;
            this.search = searchIntegration;
            this.container = null;
            this.tagsContainer = null;
            this.toggleIcon = null;
        }

        async initialize() {
            try {
                // Wait for the parent container
                const parentContainer = await DOMHelper.waitForElement('[data-test="template-folder-page"] > div:nth-child(2)');
                this.createContainer();
                // Insert after the entire parent div
                parentContainer.parentNode.insertBefore(this.container, parentContainer.nextSibling);
                this.updateCollapsedState();
                console.log('[Iterable Quick Search] UI initialized');
            } catch (error) {
                console.error('[Iterable Quick Search] Failed to initialize UI:', error);
            }
        }

        createContainer() {
            this.container = DOMHelper.createElement('div', STYLES.CONTAINER);

            // Header
            const header = DOMHelper.createElement('div', STYLES.HEADER);
            header.onclick = () => this.toggleCollapse();

            // LEFT SIDE: Title and Clear button together
            const leftSection = DOMHelper.createElement('div', 'display: flex; align-items: center; gap: 8px;');

            const title = DOMHelper.createElement('div', STYLES.TITLE);
            this.toggleIcon = DOMHelper.createElement('span', STYLES.TOGGLE_ICON);
            this.toggleIcon.textContent = '▼';
            title.appendChild(this.toggleIcon);
            title.appendChild(document.createTextNode('Quick Search'));

            const clearBtn = DOMHelper.createElement('button', STYLES.SETTINGS_BTN);
            clearBtn.textContent = 'Clear';
            clearBtn.onclick = (e) => {
                e.stopPropagation();
                this.clearSearch();
            };
            clearBtn.onmouseover = () => {
                clearBtn.style.background = '#1f2937';
                clearBtn.style.transform = 'translateY(-1px)';
            };
            clearBtn.onmouseout = () => {
                clearBtn.style.background = '#374151';
                clearBtn.style.transform = 'translateY(0)';
            };

            leftSection.appendChild(title);
            leftSection.appendChild(clearBtn);

            // RIGHT SIDE: Settings button
            const settingsBtn = DOMHelper.createElement('button', STYLES.SETTINGS_BTN);
            settingsBtn.textContent = 'Settings';
            settingsBtn.onclick = (e) => {
                e.stopPropagation();
                this.openSettingsModal();
            };
            settingsBtn.onmouseover = () => {
                settingsBtn.style.background = '#1f2937';
                settingsBtn.style.transform = 'translateY(-1px)';
            };
            settingsBtn.onmouseout = () => {
                settingsBtn.style.background = '#374151';
                settingsBtn.style.transform = 'translateY(0)';
            };

            header.appendChild(leftSection);
            header.appendChild(settingsBtn);

            // Tags container
            this.tagsContainer = DOMHelper.createElement('div', STYLES.TAGS_CONTAINER);

            this.container.appendChild(header);
            this.container.appendChild(this.tagsContainer);

            this.renderTags();
        }

        toggleCollapse() {
            const isCollapsed = this.state.toggleCollapsed();
            this.updateCollapsedState();
        }

        updateCollapsedState() {
            if (this.state.isCollapsed) {
                this.tagsContainer.style.maxHeight = '0';
                this.tagsContainer.style.opacity = '0';
                this.tagsContainer.style.marginTop = '0';
                this.toggleIcon.style.transform = 'rotate(-90deg)';
            } else {
                this.tagsContainer.style.maxHeight = '1000px';
                this.tagsContainer.style.opacity = '1';
                this.tagsContainer.style.marginTop = '8px';
                this.toggleIcon.style.transform = 'rotate(0deg)';
            }
        }

        renderTags() {
            this.tagsContainer.innerHTML = '';
            const tags = this.state.getSortedTags();

            if (tags.length === 0) {
                const emptyMessage = DOMHelper.createElement('span', 'color: #6b7280; font-size: 13px; font-weight: 400;');
                emptyMessage.textContent = '✨ No quick search tags yet. Click Settings to add some!';
                this.tagsContainer.appendChild(emptyMessage);
                return;
            }

            tags.forEach(tag => {
                const tagButton = this.createTagButton(tag);
                this.tagsContainer.appendChild(tagButton);
            });
        }

        createTagButton(tag) {
            const button = DOMHelper.createElement('button', STYLES.TAG);
            button.textContent = tag.label;

            // Apply gradient background
            const gradient = tag.colorGradient || CONFIG.DEFAULT_COLORS[0];
            button.style.background = `linear-gradient(135deg, ${gradient.start} 0%, ${gradient.end} 100%)`;
            button.style.margin = `5px`;

            button.onclick = () => this.handleTagClick(tag);

            // Hover effect
            button.onmouseover = () => {
                button.style.transform = 'translateY(-2px) scale(1.03)';
            };
            button.onmouseout = () => {
                button.style.transform = 'translateY(0) scale(1)';
            };

            return button;
        }

        clearSearch() {
            this.search.setSearchTerm('');
        }

        handleTagClick(tag) {
            this.search.setSearchTerm(tag.label);
        }

        openSettingsModal() {
            const modal = new SettingsModal(this.state, () => this.renderTags());
            modal.open();
        }
    }

    // ============================================================================
    // SETTINGS MODAL
    // ============================================================================

    class SettingsModal {
        constructor(stateManager, onUpdate) {
            this.state = stateManager;
            this.onUpdate = onUpdate;
            this.overlay = null;
            this.selectedColorGradient = CONFIG.DEFAULT_COLORS[0];
            this.sortableInstance = null;
        }

        open() {
            this.overlay = DOMHelper.createElement('div', STYLES.MODAL_OVERLAY);
            this.overlay.onclick = (e) => {
                if (e.target === this.overlay) this.close();
            };

            const modal = DOMHelper.createElement('div', STYLES.MODAL);
            modal.onclick = (e) => e.stopPropagation();

            modal.appendChild(this.createHeader());
            modal.appendChild(this.createSortOrderSection());
            modal.appendChild(this.createAddTagSection());
            modal.appendChild(this.createTagCloudSection());
            modal.appendChild(this.createCloseButton());

            this.overlay.appendChild(modal);
            document.body.appendChild(this.overlay);
        }

        close() {
            if (this.sortableInstance) {
                this.sortableInstance.destroy();
            }
            if (this.overlay) {
                this.overlay.remove();
                this.onUpdate();
            }
        }

        createHeader() {
            const header = DOMHelper.createElement('div', STYLES.MODAL_HEADER);
            header.innerHTML = '⚙️ Quick Search Settings';
            return header;
        }

        createSortOrderSection() {
            const section = DOMHelper.createElement('div', STYLES.SECTION);

            const title = DOMHelper.createElement('div', STYLES.SECTION_TITLE);
            title.textContent = 'Display Order';

            const inputGroup = DOMHelper.createElement('div', STYLES.INPUT_GROUP);
            const select = DOMHelper.createElement('select', STYLES.SELECT);
            select.innerHTML = `
                <option value="${CONFIG.SORT_ORDERS.CUSTOM}" ${this.state.settings.sortOrder === CONFIG.SORT_ORDERS.CUSTOM ? 'selected' : ''}>Custom Order (Drag to Reorder)</option>
                <option value="${CONFIG.SORT_ORDERS.ALPHA}" ${this.state.settings.sortOrder === CONFIG.SORT_ORDERS.ALPHA ? 'selected' : ''}>Alphabetical (A-Z)</option>
                <option value="${CONFIG.SORT_ORDERS.RECENT}" ${this.state.settings.sortOrder === CONFIG.SORT_ORDERS.RECENT ? 'selected' : ''}>Most Recent First</option>
            `;
            select.onchange = () => {
                this.state.updateSortOrder(select.value);
                this.refreshTagCloud();
            };
            select.onfocus = () => select.style.borderColor = '#3b82f6';
            select.onblur = () => select.style.borderColor = '#e5e7eb';

            inputGroup.appendChild(select);
            section.appendChild(title);
            section.appendChild(inputGroup);
            return section;
        }

        createAddTagSection() {
            const section = DOMHelper.createElement('div', STYLES.SECTION);

            const title = DOMHelper.createElement('div', STYLES.SECTION_TITLE);
            title.textContent = 'Add New Tag';

            const card = DOMHelper.createElement('div', 'border: 2px solid #e5e7eb; border-radius: 12px; padding: 20px; background: #fafafa;');

            // Label input
            const inputGroup = DOMHelper.createElement('div', STYLES.INPUT_GROUP);
            const label = DOMHelper.createElement('label', STYLES.LABEL);
            label.textContent = 'Tag Label';
            const input = DOMHelper.createElement('input', STYLES.INPUT);
            input.placeholder = 'e.g., Newsletter, Promo, Welcome...';
            input.onfocus = () => input.style.borderColor = '#222';
            input.onblur = () => input.style.borderColor = '#e5e7eb';
            inputGroup.appendChild(label);
            inputGroup.appendChild(input);

            // Color picker
            const colorGroup = DOMHelper.createElement('div', STYLES.INPUT_GROUP);
            const colorLabel = DOMHelper.createElement('label', STYLES.LABEL);
            colorLabel.textContent = 'Choose Color';
            const colorPicker = DOMHelper.createElement('div', STYLES.COLOR_PICKER_CONTAINER);

            CONFIG.DEFAULT_COLORS.forEach((gradient, index) => {
                const colorOption = DOMHelper.createElement('div', STYLES.COLOR_OPTION);
                colorOption.style.background = `linear-gradient(135deg, ${gradient.start} 0%, ${gradient.end} 100%)`;

                if (index === 0) {
                    colorOption.style.borderColor = '#222';
                    colorOption.style.transform = 'scale(1.05)';
                }

                colorOption.onclick = () => {
                    this.selectedColorGradient = gradient;
                    // Update all color options
                    colorPicker.querySelectorAll('div').forEach(opt => {
                        opt.style.borderColor = 'transparent';
                        opt.style.transform = 'scale(1)';
                    });
                    colorOption.style.borderColor = '#222';
                    colorOption.style.transform = 'scale(1.05)';
                };

                colorOption.onmouseover = () => {
                    if (colorOption.style.borderColor !== 'rgb(0,0,0)') {
                        colorOption.style.transform = 'scale(1.1)';
                    }
                };
                colorOption.onmouseout = () => {
                    if (colorOption.style.borderColor !== 'rgb(59, 130, 246)') {
                        colorOption.style.transform = 'scale(1)';
                    }
                };

                colorPicker.appendChild(colorOption);
            });

            colorGroup.appendChild(colorLabel);
            colorGroup.appendChild(colorPicker);

            // Add button
            const addButton = DOMHelper.createElement('button', STYLES.BUTTON + 'background: #3b82f6; color: white; width: 100%;');
            addButton.textContent = '+ Add Tag';
            addButton.onclick = () => {
                const labelValue = input.value.trim();

                if (!labelValue) {
                    alert('Please enter a tag label');
                    return;
                }

                this.state.addTag(labelValue, this.selectedColorGradient);
                input.value = '';
                this.refreshTagCloud();
            };
            addButton.onmouseover = () => {
                addButton.style.background = '#2563eb';
                addButton.style.transform = 'translateY(-1px)';
                addButton.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
            };
            addButton.onmouseout = () => {
                addButton.style.background = '#3b82f6';
                addButton.style.transform = 'translateY(0)';
                addButton.style.boxShadow = 'none';
            };

            card.appendChild(inputGroup);
            card.appendChild(colorGroup);
            card.appendChild(addButton);

            section.appendChild(title);
            section.appendChild(card);
            return section;
        }

        createTagCloudSection() {
            const section = DOMHelper.createElement('div', STYLES.SECTION);

            const titleRow = DOMHelper.createElement('div', 'display: flex; justify-content: space-between; align-items: center;');
            const title = DOMHelper.createElement('div', STYLES.SECTION_TITLE);
            title.textContent = `Your Tags (${this.state.tags.length})`;

            // Add hint for drag-and-drop if in custom order mode
            if (this.state.settings.sortOrder === CONFIG.SORT_ORDERS.CUSTOM) {
                const hint = DOMHelper.createElement('span', 'font-size: 11px; color: #9ca3af; font-weight: normal; text-transform: none; margin-left: 8px;');
                hint.textContent = '(Drag to reorder)';
                title.appendChild(hint);
            }

            titleRow.appendChild(title);

            this.tagCloudContainer = DOMHelper.createElement('div', STYLES.TAG_CLOUD_CONTAINER);
            this.refreshTagCloud();

            section.appendChild(titleRow);
            section.appendChild(this.tagCloudContainer);
            return section;
        }

        refreshTagCloud() {
            if (!this.tagCloudContainer) return;

            // Destroy existing sortable instance
            if (this.sortableInstance) {
                this.sortableInstance.destroy();
                this.sortableInstance = null;
            }

            this.tagCloudContainer.innerHTML = '';
            const tags = this.state.getSortedTags();

            if (tags.length === 0) {
                const empty = DOMHelper.createElement('div', 'color: #9ca3af; text-align: center; padding: 40px; font-size: 14px;');
                empty.textContent = '✨ No tags yet. Add your first tag above!';
                this.tagCloudContainer.appendChild(empty);
                return;
            }

            tags.forEach(tag => {
                const tagItem = this.createTagCloudItem(tag);
                this.tagCloudContainer.appendChild(tagItem);
            });

            // Initialize drag-and-drop only for custom order
            if (this.state.settings.sortOrder === CONFIG.SORT_ORDERS.CUSTOM && window.Sortable) {
                this.sortableInstance = Sortable.create(this.tagCloudContainer, {
                    animation: 150,
                    ghostClass: 'sortable-ghost',
                    dragClass: 'sortable-drag',
                    handle: '.drag-handle',
                    onEnd: (evt) => {
                        // Get the new order of tag IDs
                        const newOrder = Array.from(this.tagCloudContainer.children)
                            .map(el => el.getAttribute('data-tag-id'));

                        // Update state with new order
                        this.state.reorderTags(newOrder);
                    }
                });

                // Add custom styles for sortable states
                const style = document.createElement('style');
                style.textContent = `
                    .sortable-ghost {
                        opacity: 0.4;
                    }
                    .sortable-drag {
                        opacity: 1;
                        transform: rotate(3deg) scale(1.05);
                        box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important;
                    }
                `;
                document.head.appendChild(style);
            }
        }

        createTagCloudItem(tag) {
            const item = DOMHelper.createElement('span', STYLES.TAG_CLOUD_ITEM);
            item.setAttribute('data-tag-id', tag.id);

            const gradient = tag.colorGradient || CONFIG.DEFAULT_COLORS[0];
            item.style.background = `linear-gradient(135deg, ${gradient.start} 0%, ${gradient.end} 100%)`;

            // Only show drag handle in custom order mode
            if (this.state.settings.sortOrder === CONFIG.SORT_ORDERS.CUSTOM) {
                const dragHandle = DOMHelper.createElement('span', STYLES.DRAG_HANDLE);
                dragHandle.textContent = '⋮⋮';
                dragHandle.classList.add('drag-handle');
                item.appendChild(dragHandle);
            }

            const labelSpan = DOMHelper.createElement('span');
            labelSpan.textContent = tag.label;

            const deleteBtn = DOMHelper.createElement('button', STYLES.DELETE_BTN);
            deleteBtn.textContent = '×';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm(`Delete tag "${tag.label}"?`)) {
                    this.state.removeTag(tag.id);
                    this.refreshTagCloud();
                }
            };
            deleteBtn.onmouseover = () => deleteBtn.style.opacity = '1';
            deleteBtn.onmouseout = () => deleteBtn.style.opacity = '0.8';

            item.appendChild(labelSpan);
            item.appendChild(deleteBtn);

            // Hover effect (only if not in custom order to avoid conflict with drag)
            if (this.state.settings.sortOrder !== CONFIG.SORT_ORDERS.CUSTOM) {
                item.onmouseover = () => {
                    item.style.transform = 'translateY(-2px) scale(1.03)';
                    item.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
                };
                item.onmouseout = () => {
                    item.style.transform = 'translateY(0) scale(1)';
                    item.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.12)';
                };
            }

            return item;
        }

        createCloseButton() {
            const button = DOMHelper.createElement('button', STYLES.BUTTON + 'background: #f3f4f6; color: #374151; width: 100%;');
            button.textContent = 'Close';
            button.onclick = () => this.close();
            button.onmouseover = () => {
                button.style.background = '#e5e7eb';
                button.style.transform = 'translateY(-1px)';
            };
            button.onmouseout = () => {
                button.style.background = '#f3f4f6';
                button.style.transform = 'translateY(0)';
            };
            return button;
        }
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    class IterableQuickSearch {
        constructor() {
            this.state = new StateManager();
            this.search = new SearchIntegration();
            this.ui = null;
        }

        async initialize() {
            console.log('[Iterable Quick Search] Initializing...');

            await this.search.initialize();
            this.ui = new QuickSearchUI(this.state, this.search);
            await this.ui.initialize();

            this.registerMenuCommands();

            console.log('[Iterable Quick Search] Initialization complete');
        }

        registerMenuCommands() {
            GM_registerMenuCommand('Quick Search Settings', () => {
                if (this.ui) {
                    this.ui.openSettingsModal();
                }
            });
        }
    }

    // Start the script
    const quickSearch = new IterableQuickSearch();
    quickSearch.initialize();

})();
