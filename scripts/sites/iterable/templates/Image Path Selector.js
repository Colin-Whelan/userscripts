// ==UserScript==
// @name         Templates - Image Path Selector
// @namespace    https://github.com/ColinWhelan
// @version      1.0.0
// @description  Custom folder navigator and image selector for Iterable template editor
// @author       Colin Whelan
// @match        https://app.iterable.com/templates/editor*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
    'use strict';

    // ============================================
    // CONFIGURATION
    // ============================================
    const CONFIG = {
        // API Settings
        API_ENDPOINT: 'https://app.iterable.com/graphql',
        FETCH_LIMIT: 9999,

        // Pagination
        ITEMS_PER_PAGE: 30,

        // Modal Dimensions
        MODAL_WIDTH: '80vw',
        MODAL_HEIGHT: '90vh',

        // Storage Keys
        STORAGE_LAST_FOLDER: 'iterableImageSelector_lastFolderId',
        STORAGE_SORT_BY: 'iterableImageSelector_sortBy',
        STORAGE_SORT_DIR: 'iterableImageSelector_sortDirection',

        // Selectors
        TARGET_SELECTOR: '[data-test="basic-select-email-editor-view"]',

        // Timing
        INIT_RETRY_DELAY: 500,
        INIT_MAX_RETRIES: 20,
        TOAST_DURATION: 2500,
        DEBOUNCE_DELAY: 300,

        // Sort Options
        SORT_OPTIONS: [
            { value: 'UpdatedAt', label: 'Date Updated' },
            { value: 'CreatedAt', label: 'Date Created' },
            { value: 'Name', label: 'Name' },
            { value: 'Size', label: 'Size' }
        ],
        SORT_DIRECTIONS: [
            { value: 'Descending', label: 'Desc' },
            { value: 'Ascending', label: 'Asc' }
        ],

        // Image Filters (only show these types)
        IMAGE_MIME_TYPES: ['PNG', 'JPEG', 'GIF', 'WEBP', 'SVG']
    };

    // ============================================
    // COOKIE UTILITIES
    // ============================================
    const CookieUtils = {
        get(name) {
            const cookies = document.cookie.split(';');
            for (const cookie of cookies) {
                const [cookieName, cookieValue] = cookie.trim().split('=');
                if (cookieName === name) {
                    return decodeURIComponent(cookieValue);
                }
            }
            return null;
        },
        getXsrfToken() {
            return this.get('XSRF-TOKEN');
        }
    };

    // ============================================
    // STORAGE MANAGER
    // ============================================
    const StorageManager = {
        getLastFolderId() {
            return GM_getValue(CONFIG.STORAGE_LAST_FOLDER, null);
        },
        setLastFolderId(folderId) {
            GM_setValue(CONFIG.STORAGE_LAST_FOLDER, folderId);
        },
        getSortBy() {
            return GM_getValue(CONFIG.STORAGE_SORT_BY, 'UpdatedAt');
        },
        setSortBy(sortBy) {
            GM_setValue(CONFIG.STORAGE_SORT_BY, sortBy);
        },
        getSortDirection() {
            return GM_getValue(CONFIG.STORAGE_SORT_DIR, 'Descending');
        },
        setSortDirection(direction) {
            GM_setValue(CONFIG.STORAGE_SORT_DIR, direction);
        }
    };

    // ============================================
    // API SERVICE
    // ============================================
    const APIService = {
        async fetchFolderContents(folderId = null, sortBy = 'UpdatedAt', sortDirection = 'Descending') {
            const variables = {
                folderId: folderId,
                recursive: false,
                pagination: { offset: 0, limit: CONFIG.FETCH_LIMIT },
                search: '',
                assetFilterInfo: {
                    createdByUserId: null,
                    updatedByUserId: null,
                    mimeType: folderId !== null ? CONFIG.IMAGE_MIME_TYPES : null,
                    size: null
                },
                sort: { sortBy, sortDirection }
            };

            const query = `query FetchAssetFolderQuery($assetFilterInfo: ImageFilterInfoInput, $pagination: Pagination, $search: String, $folderId: Long, $recursive: Boolean, $sort: Sort) {
                assetFolder(
                    assetFilterInfo: $assetFilterInfo
                    pagination: $pagination
                    search: $search
                    folderId: $folderId
                    recursive: $recursive
                    sort: $sort
                ) {
                    info { count limit offset page __typename }
                    name
                    id
                    content {
                        ... on AssetSubfolder {
                            __typename
                            id
                            name
                        }
                        ... on ImageAsset {
                            __typename
                            id
                            projectId
                            assetName
                            altText
                            assetType
                            createdAt
                            updatedAt
                            url
                            size
                            height
                            width
                            mimeType
                        }
                        __typename
                    }
                    ancestors { id name __typename }
                    __typename
                }
            }`;

            const response = await fetch(CONFIG.API_ENDPOINT, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'x-xsrf-token': CookieUtils.getXsrfToken()
                },
                body: JSON.stringify({
                    operationName: 'FetchAssetFolderQuery',
                    variables,
                    query
                })
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();

            if (data.errors) {
                throw new Error(data.errors[0]?.message || 'GraphQL error');
            }

            return data.data.assetFolder;
        }
    };

    // ============================================
    // TOAST MANAGER
    // ============================================
    const ToastManager = {
        container: null,

        init() {
            if (this.container) return;

            this.container = document.createElement('div');
            this.container.id = 'image-selector-toast-container';
            this.container.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 100001;
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;
            document.body.appendChild(this.container);
        },

        show(message, type = 'success') {
            this.init();

            const toast = document.createElement('div');
            toast.className = `image-selector-toast image-selector-toast-${type}`;
            toast.textContent = message;

            this.container.appendChild(toast);

            // Trigger animation
            requestAnimationFrame(() => {
                toast.classList.add('image-selector-toast-visible');
            });

            setTimeout(() => {
                toast.classList.remove('image-selector-toast-visible');
                setTimeout(() => toast.remove(), 300);
            }, CONFIG.TOAST_DURATION);
        },

        success(message) {
            this.show(message, 'success');
        },

        error(message) {
            this.show(message, 'error');
        }
    };

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    const Utils = {
        formatFileSize(bytes) {
            if (bytes === 0) return '0 B';
            const units = ['B', 'KB', 'MB', 'GB'];
            const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
            const size = (bytes / Math.pow(1024, unitIndex)).toFixed(1);
            return `${size} ${units[unitIndex]}`;
        },

        formatDimensions(width, height) {
            return `${width} × ${height}`;
        },

        debounce(func, delay) {
            let timeoutId;
            return function(...args) {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => func.apply(this, args), delay);
            };
        },

        async copyToClipboard(text) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (err) {
                console.error('Failed to copy:', err);
                return false;
            }
        }
    };

    // ============================================
    // STYLES
    // ============================================
    const Styles = {
        inject() {
            const styleId = 'image-selector-styles';
            if (document.getElementById(styleId)) return;

            const css = `
                /* Button */
                .image-selector-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 12px;
                    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    margin-left: 12px;
                }
                .image-selector-btn:hover {
                    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
                }
                .image-selector-btn svg {
                    width: 16px;
                    height: 16px;
                }

                /* Modal Overlay */
                .image-selector-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(4px);
                    z-index: 99999;
                    display: none;
                }
                .image-selector-overlay.image-selector-active {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                /* Modal */
                .image-selector-modal {
                    width: ${CONFIG.MODAL_WIDTH};
                    height: ${CONFIG.MODAL_HEIGHT};
                    max-width: 1400px;
                    max-height: 900px;
                    background: #ffffff;
                    border-radius: 12px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    transform: scale(0.95);
                    transition: transform 0.2s ease;
                }
                .image-selector-overlay.show .image-selector-modal {
                    transform: scale(1);
                }

                /* Modal Header */
                .image-selector-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 20px;
                    border-bottom: 1px solid #e5e7eb;
                    background: #f9fafb;
                }
                .image-selector-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #111827;
                    margin: 0;
                }
                .image-selector-close {
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: transparent;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    color: #6b7280;
                    transition: all 0.15s ease;
                }
                .image-selector-close:hover {
                    background: #e5e7eb;
                    color: #111827;
                }

                /* Toolbar */
                .image-selector-toolbar {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 20px;
                    border-bottom: 1px solid #e5e7eb;
                    background: #ffffff;
                    flex-wrap: wrap;
                }

                /* Breadcrumbs */
                .image-selector-breadcrumbs {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 13px;
                    flex: 1;
                    min-width: 200px;
                    flex-wrap: wrap;
                }
                .image-selector-breadcrumb {
                    color: #6366f1;
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 4px;
                    transition: background 0.15s ease;
                }
                .image-selector-breadcrumb:hover {
                    background: #eef2ff;
                }
                .image-selector-breadcrumb.current {
                    color: #374151;
                    cursor: default;
                    font-weight: 500;
                }
                .image-selector-breadcrumb.current:hover {
                    background: transparent;
                }
                .image-selector-breadcrumb-sep {
                    color: #9ca3af;
                    user-select: none;
                }

                /* Search */
                .image-selector-search {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    padding: 6px 12px;
                    min-width: 200px;
                }
                .image-selector-search svg {
                    width: 16px;
                    height: 16px;
                    color: #9ca3af;
                    flex-shrink: 0;
                }
                .image-selector-search input {
                    border: none;
                    background: transparent;
                    outline: none;
                    font-size: 13px;
                    width: 100%;
                    color: #374151;
                }
                .image-selector-search input::placeholder {
                    color: #9ca3af;
                }

                /* Sort Controls */
                .image-selector-sort {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .image-selector-sort label {
                    font-size: 12px;
                    color: #6b7280;
                }
                .image-selector-sort select {
                    padding: 6px 10px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 13px;
                    background: white;
                    cursor: pointer;
                    color: #374151;
                }
                .image-selector-sort select:focus {
                    outline: none;
                    border-color: #6366f1;
                    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
                }

                /* Content Area */
                .image-selector-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    background: #f9fafb;
                }

                /* Loading State */
                .image-selector-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    gap: 16px;
                    color: #6b7280;
                }
                .image-selector-spinner {
                    width: 40px;
                    height: 40px;
                    border: 3px solid #e5e7eb;
                    border-top-color: #6366f1;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                /* Error State */
                .image-selector-error {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    gap: 16px;
                    color: #dc2626;
                    text-align: center;
                    padding: 20px;
                }
                .image-selector-retry-btn {
                    padding: 8px 16px;
                    background: #6366f1;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 13px;
                }
                .image-selector-retry-btn:hover {
                    background: #4f46e5;
                }

                /* Grid */
                .image-selector-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                    gap: 16px;
                }

                /* Folder Item */
                .image-selector-folder {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 14px 16px;
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .image-selector-folder:hover {
                    border-color: #6366f1;
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
                    transform: translateY(-2px);
                }
                .image-selector-folder-icon {
                    width: 36px;
                    height: 36px;
                    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .image-selector-folder-icon svg {
                    width: 20px;
                    height: 20px;
                    color: white;
                }
                .image-selector-folder-name {
                    font-size: 13px;
                    color: #374151;
                    font-weight: 500;
                    word-break: break-word;
                    line-height: 1.3;
                }

                /* Image Item */
                .image-selector-image {
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    overflow: hidden;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    display: flex;
                    flex-direction: column;
                }
                .image-selector-image:hover {
                    border-color: #6366f1;
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
                    transform: translateY(-2px);
                }
                .image-selector-image-preview {
                    width: 100%;
                    height: 120px;
                    background: #f3f4f6;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                }
                .image-selector-image-preview img {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                }
                .image-selector-image-info {
                    padding: 10px 12px;
                    border-top: 1px solid #e5e7eb;
                }
                .image-selector-image-name {
                    font-size: 12px;
                    color: #374151;
                    font-weight: 500;
                    word-break: break-word;
                    line-height: 1.3;
                    margin-bottom: 4px;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
                .image-selector-image-meta {
                    font-size: 11px;
                    color: #9ca3af;
                }

                /* Empty State */
                .image-selector-empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 200px;
                    color: #9ca3af;
                    text-align: center;
                }
                .image-selector-empty svg {
                    width: 48px;
                    height: 48px;
                    margin-bottom: 12px;
                    opacity: 0.5;
                }

                /* Pagination */
                .image-selector-pagination {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 16px 20px;
                    border-top: 1px solid #e5e7eb;
                    background: white;
                }
                .image-selector-page-btn {
                    min-width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid #d1d5db;
                    background: white;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 13px;
                    color: #374151;
                    transition: all 0.15s ease;
                }
                .image-selector-page-btn:hover:not(:disabled) {
                    border-color: #6366f1;
                    color: #6366f1;
                }
                .image-selector-page-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .image-selector-page-btn.active {
                    background: #6366f1;
                    border-color: #6366f1;
                    color: white;
                }
                .image-selector-page-info {
                    font-size: 13px;
                    color: #6b7280;
                    padding: 0 12px;
                }

                /* Toast */
                .image-selector-toast {
                    padding: 12px 20px;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 500;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
                    transform: translateX(100%);
                    opacity: 0;
                    transition: all 0.3s ease;
                }
                .image-selector-toast.image-selector-toast-visible {
                    transform: translateX(0);
                    opacity: 1;
                }
                .image-selector-toast-success {
                    background: #10b981;
                    color: white;
                }
                .image-selector-toast-error {
                    background: #ef4444;
                    color: white;
                }
            `;

            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = css;
            document.head.appendChild(style);
        }
    };

    // ============================================
    // ICONS
    // ============================================
    const Icons = {
        image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
        </svg>`,

        folder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>`,

        close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>`,

        search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>`,

        chevronLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
        </svg>`,

        chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
        </svg>`,

        empty: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
            <polyline points="13 2 13 9 20 9"/>
        </svg>`
    };

    // ============================================
    // MODAL UI
    // ============================================
    const ModalUI = {
        overlay: null,
        modal: null,
        contentArea: null,
        breadcrumbsEl: null,
        searchInput: null,
        sortBySelect: null,
        sortDirSelect: null,
        paginationEl: null,

        create() {
            // Overlay
            this.overlay = document.createElement('div');
            this.overlay.className = 'image-selector-overlay';
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) {
                    ImageSelector.close();
                }
            });

            // Modal
            this.modal = document.createElement('div');
            this.modal.className = 'image-selector-modal';
            this.modal.innerHTML = `
                <div class="image-selector-header">
                    <h2 class="image-selector-title">Select Image</h2>
                    <button class="image-selector-close" title="Close">${Icons.close}</button>
                </div>
                <div class="image-selector-toolbar">
                    <div class="image-selector-breadcrumbs"></div>
                    <div class="image-selector-search">
                        ${Icons.search}
                        <input type="text" placeholder="Filter items..." />
                    </div>
                    <div class="image-selector-sort">
                        <label>Sort:</label>
                        <select class="sort-by"></select>
                        <select class="sort-dir"></select>
                    </div>
                </div>
                <div class="image-selector-content"></div>
                <div class="image-selector-pagination"></div>
            `;

            this.overlay.appendChild(this.modal);

            // Cache elements
            this.contentArea = this.modal.querySelector('.image-selector-content');
            this.breadcrumbsEl = this.modal.querySelector('.image-selector-breadcrumbs');
            this.searchInput = this.modal.querySelector('.image-selector-search input');
            this.sortBySelect = this.modal.querySelector('.sort-by');
            this.sortDirSelect = this.modal.querySelector('.sort-dir');
            this.paginationEl = this.modal.querySelector('.image-selector-pagination');

            // Setup close button
            this.modal.querySelector('.image-selector-close').addEventListener('click', () => {
                ImageSelector.close();
            });

            // Setup search
            this.searchInput.addEventListener('input', Utils.debounce(() => {
                FolderNavigator.filterAndRender();
            }, CONFIG.DEBOUNCE_DELAY));

            // Setup sort controls
            this.populateSortOptions();
            this.sortBySelect.addEventListener('change', () => {
                StorageManager.setSortBy(this.sortBySelect.value);
                FolderNavigator.reload();
            });
            this.sortDirSelect.addEventListener('change', () => {
                StorageManager.setSortDirection(this.sortDirSelect.value);
                FolderNavigator.reload();
            });

            // Keyboard handling
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.overlay.classList.contains('image-selector-active')) {
                    ImageSelector.close();
                }
            });

            document.body.appendChild(this.overlay);
        },

        populateSortOptions() {
            const currentSortBy = StorageManager.getSortBy();
            const currentSortDir = StorageManager.getSortDirection();

            CONFIG.SORT_OPTIONS.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                option.selected = opt.value === currentSortBy;
                this.sortBySelect.appendChild(option);
            });

            CONFIG.SORT_DIRECTIONS.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                option.selected = opt.value === currentSortDir;
                this.sortDirSelect.appendChild(option);
            });
        },

        show() {
            if (!this.overlay) this.create();
            this.searchInput.value = '';
            this.overlay.classList.add('image-selector-active');
            this.searchInput.focus();
        },

        hide() {
            if (this.overlay) {
                this.overlay.classList.remove('image-selector-active');
            }
        },

        showLoading() {
            this.contentArea.innerHTML = `
                <div class="image-selector-loading">
                    <div class="image-selector-spinner"></div>
                    <span>Loading...</span>
                </div>
            `;
            this.paginationEl.innerHTML = '';
        },

        showError(message, onRetry) {
            this.contentArea.innerHTML = `
                <div class="image-selector-error">
                    <span>${message}</span>
                    <button class="image-selector-retry-btn">Retry</button>
                </div>
            `;
            this.contentArea.querySelector('.image-selector-retry-btn').addEventListener('click', onRetry);
            this.paginationEl.innerHTML = '';
        },

        showEmpty(message = 'No items found') {
            this.contentArea.innerHTML = `
                <div class="image-selector-empty">
                    ${Icons.empty}
                    <span>${message}</span>
                </div>
            `;
            this.paginationEl.innerHTML = '';
        },

        renderBreadcrumbs(ancestors, currentName, currentId) {
            this.breadcrumbsEl.innerHTML = '';

            // Root
            const rootEl = document.createElement('span');
            rootEl.className = 'image-selector-breadcrumb';
            rootEl.textContent = 'Root';
            if (currentId === null && ancestors.length === 0) {
                rootEl.classList.add('current');
            } else {
                rootEl.addEventListener('click', () => FolderNavigator.navigateTo(null));
            }
            this.breadcrumbsEl.appendChild(rootEl);

            // Ancestors
            ancestors.forEach((ancestor, index) => {
                // Skip root in ancestors
                if (ancestor.name === '__root__') return;

                const sep = document.createElement('span');
                sep.className = 'image-selector-breadcrumb-sep';
                sep.textContent = '›';
                this.breadcrumbsEl.appendChild(sep);

                const crumb = document.createElement('span');
                crumb.className = 'image-selector-breadcrumb';
                crumb.textContent = ancestor.name;
                crumb.addEventListener('click', () => FolderNavigator.navigateTo(ancestor.id));
                this.breadcrumbsEl.appendChild(crumb);
            });

            // Current folder (if not root)
            if (currentName && currentName !== '__root__') {
                const sep = document.createElement('span');
                sep.className = 'image-selector-breadcrumb-sep';
                sep.textContent = '›';
                this.breadcrumbsEl.appendChild(sep);

                const current = document.createElement('span');
                current.className = 'image-selector-breadcrumb current';
                current.textContent = currentName;
                this.breadcrumbsEl.appendChild(current);
            }
        },

        renderGrid(folders, images) {
            const grid = document.createElement('div');
            grid.className = 'image-selector-grid';

            // Render folders first
            folders.forEach(folder => {
                const folderEl = document.createElement('div');
                folderEl.className = 'image-selector-folder';
                folderEl.innerHTML = `
                    <div class="image-selector-folder-icon">${Icons.folder}</div>
                    <span class="image-selector-folder-name">${folder.name}</span>
                `;
                folderEl.addEventListener('click', () => FolderNavigator.navigateTo(folder.id));
                grid.appendChild(folderEl);
            });

            // Render images
            images.forEach(image => {
                const imageEl = document.createElement('div');
                imageEl.className = 'image-selector-image';
                imageEl.innerHTML = `
                    <div class="image-selector-image-preview">
                        <img src="${image.url}" alt="${image.assetName}" loading="lazy" />
                    </div>
                    <div class="image-selector-image-info">
                        <div class="image-selector-image-name" title="${image.assetName}">${image.assetName}</div>
                        <div class="image-selector-image-meta">
                            ${Utils.formatDimensions(image.width, image.height)} • ${Utils.formatFileSize(image.size)}
                        </div>
                    </div>
                `;
                imageEl.addEventListener('click', () => ImageSelector.selectImage(image.url));
                grid.appendChild(imageEl);
            });

            this.contentArea.innerHTML = '';
            this.contentArea.appendChild(grid);
        },

        renderPagination(currentPage, totalPages, onPageChange) {
            this.paginationEl.innerHTML = '';

            if (totalPages <= 1) return;

            // Previous button
            const prevBtn = document.createElement('button');
            prevBtn.className = 'image-selector-page-btn';
            prevBtn.innerHTML = Icons.chevronLeft;
            prevBtn.disabled = currentPage === 1;
            prevBtn.addEventListener('click', () => onPageChange(currentPage - 1));
            this.paginationEl.appendChild(prevBtn);

            // Page numbers
            const maxVisiblePages = 5;
            let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
            let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

            if (endPage - startPage < maxVisiblePages - 1) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
            }

            if (startPage > 1) {
                const firstBtn = this.createPageButton(1, currentPage, onPageChange);
                this.paginationEl.appendChild(firstBtn);
                if (startPage > 2) {
                    const ellipsis = document.createElement('span');
                    ellipsis.className = 'image-selector-page-info';
                    ellipsis.textContent = '...';
                    this.paginationEl.appendChild(ellipsis);
                }
            }

            for (let i = startPage; i <= endPage; i++) {
                const pageBtn = this.createPageButton(i, currentPage, onPageChange);
                this.paginationEl.appendChild(pageBtn);
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    const ellipsis = document.createElement('span');
                    ellipsis.className = 'image-selector-page-info';
                    ellipsis.textContent = '...';
                    this.paginationEl.appendChild(ellipsis);
                }
                const lastBtn = this.createPageButton(totalPages, currentPage, onPageChange);
                this.paginationEl.appendChild(lastBtn);
            }

            // Next button
            const nextBtn = document.createElement('button');
            nextBtn.className = 'image-selector-page-btn';
            nextBtn.innerHTML = Icons.chevronRight;
            nextBtn.disabled = currentPage === totalPages;
            nextBtn.addEventListener('click', () => onPageChange(currentPage + 1));
            this.paginationEl.appendChild(nextBtn);
        },

        createPageButton(pageNum, currentPage, onPageChange) {
            const btn = document.createElement('button');
            btn.className = 'image-selector-page-btn';
            if (pageNum === currentPage) btn.classList.add('active');
            btn.textContent = pageNum;
            btn.addEventListener('click', () => onPageChange(pageNum));
            return btn;
        }
    };

    // ============================================
    // FOLDER NAVIGATOR
    // ============================================
    const FolderNavigator = {
        currentFolderId: null,
        currentPage: 1,
        allContent: [],
        folderInfo: null,

        async navigateTo(folderId) {
            this.currentFolderId = folderId;
            this.currentPage = 1;
            StorageManager.setLastFolderId(folderId);
            await this.loadFolder();
        },

        async reload() {
            await this.loadFolder();
        },

        async loadFolder() {
            ModalUI.showLoading();

            try {
                const sortBy = StorageManager.getSortBy();
                const sortDir = StorageManager.getSortDirection();

                this.folderInfo = await APIService.fetchFolderContents(
                    this.currentFolderId,
                    sortBy,
                    sortDir
                );

                this.allContent = this.folderInfo.content || [];
                this.currentPage = 1;

                this.filterAndRender();
            } catch (error) {
                console.error('Failed to load folder:', error);
                ModalUI.showError(`Failed to load folder: ${error.message}`, () => this.loadFolder());
            }
        },

        filterAndRender() {
            const searchTerm = ModalUI.searchInput.value.toLowerCase().trim();

            // Filter content
            let filtered = this.allContent;
            if (searchTerm) {
                filtered = this.allContent.filter(item => {
                    const name = item.name || item.assetName || '';
                    return name.toLowerCase().includes(searchTerm);
                });
            }

            // Separate folders and images
            const folders = filtered.filter(item => item.__typename === 'AssetSubfolder');
            const images = filtered.filter(item => item.__typename === 'ImageAsset');

            // Update breadcrumbs
            ModalUI.renderBreadcrumbs(
                this.folderInfo?.ancestors || [],
                this.folderInfo?.name,
                this.currentFolderId
            );

            // Check if empty
            if (folders.length === 0 && images.length === 0) {
                const message = searchTerm ? 'No matching items found' : 'This folder is empty';
                ModalUI.showEmpty(message);
                return;
            }

            // Paginate
            const totalItems = folders.length + images.length;
            const totalPages = Math.ceil(totalItems / CONFIG.ITEMS_PER_PAGE);

            // Ensure current page is valid
            if (this.currentPage > totalPages) {
                this.currentPage = totalPages;
            }

            const startIndex = (this.currentPage - 1) * CONFIG.ITEMS_PER_PAGE;
            const endIndex = startIndex + CONFIG.ITEMS_PER_PAGE;

            // Combine and slice for current page
            const allItems = [...folders, ...images];
            const pageItems = allItems.slice(startIndex, endIndex);

            // Separate page items back into folders and images
            const pageFolders = pageItems.filter(item => item.__typename === 'AssetSubfolder');
            const pageImages = pageItems.filter(item => item.__typename === 'ImageAsset');

            // Render
            ModalUI.renderGrid(pageFolders, pageImages);
            ModalUI.renderPagination(this.currentPage, totalPages, (page) => {
                this.currentPage = page;
                this.filterAndRender();
            });
        }
    };

    // ============================================
    // IMAGE SELECTOR (Main Controller)
    // ============================================
    const ImageSelector = {
        buttonInserted: false,

        init() {
            Styles.inject();
            this.waitForTarget();
        },

        waitForTarget() {
            let retries = 0;

            const tryInsert = () => {
                if (this.buttonInserted) return;

                const target = document.querySelector(CONFIG.TARGET_SELECTOR);
                if (target) {
                    this.insertButton(target);
                    return;
                }

                retries++;
                if (retries < CONFIG.INIT_MAX_RETRIES) {
                    setTimeout(tryInsert, CONFIG.INIT_RETRY_DELAY);
                }
            };

            tryInsert();

            // Also observe for dynamic insertion
            const observer = new MutationObserver(() => {
                if (this.buttonInserted) return;
                const target = document.querySelector(CONFIG.TARGET_SELECTOR);
                if (target) {
                    this.insertButton(target);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });
        },

        insertButton(target) {
            if (this.buttonInserted) return;
            if (document.getElementById('image-selector-btn')) return;

            const button = document.createElement('button');
            button.id = 'image-selector-btn';
            button.className = 'image-selector-btn';
            button.innerHTML = `${Icons.image} Get Image Path`;
            button.addEventListener('click', () => this.open());

            // Insert as sibling after target
            target.parentNode.insertBefore(button, target.nextSibling);
            this.buttonInserted = true;

            console.log('[Image Selector] Button inserted');
        },

        async open() {
            ModalUI.show();

            // Navigate to last folder or root
            const lastFolderId = StorageManager.getLastFolderId();
            await FolderNavigator.navigateTo(lastFolderId);
        },

        close() {
            ModalUI.hide();
        },

        async selectImage(url) {
            const success = await Utils.copyToClipboard(url);

            if (success) {
                ToastManager.success('Image URL copied to clipboard!');
            } else {
                ToastManager.error('Failed to copy URL');
            }

            this.close();
        }
    };

    // ============================================
    // INITIALIZATION
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => ImageSelector.init());
    } else {
        ImageSelector.init();
    }

})();
