// ==UserScript==
// @name         Iterable Dynamic Lists Checker
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  Show dynamic lists that users belong
// @author       Colin Whelan
// @match        https://app.iterable.com/users/profiles/*/*
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    // Configuration constants
    const CONFIG = {
        API_ENDPOINTS: {
            PROFILE_DETAILS: 'https://app.iterable.com/users/profiles/{userId}/getProfileDetails',
            SEGMENT_QUERY: 'https://app.iterable.com/lists/segmentUsersQuery'
        },
        REQUEST_DELAY: 200, // ms between API calls
        PAGE_SIZE: 10,
        DEFAULT_BATCH_SIZE: 5,
        CACHE_DURATION: 30 * 60 * 1000, // 30 minutes in milliseconds
    };

    // User configuration
    let userConfig = {
        batchSize: GM_getValue('batchSize', CONFIG.DEFAULT_BATCH_SIZE),
        showProgressBar: GM_getValue('showProgressBar', true),
        autoStart: GM_getValue('autoStart', true)
    };

    // Register menu commands for configuration
    GM_registerMenuCommand('Configure Batch Size', configureBatchSize);
    GM_registerMenuCommand('Toggle Auto Start', toggleAutoStart);
    GM_registerMenuCommand('Clear Cache', clearCache);

    // Utility functions
    const Utils = {
        sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

        formatTimestamp: (timestamp) => {
            return new Date(timestamp).toLocaleString();
        },

        sanitizeKey: (str) => {
            return str.replace(/[^a-zA-Z0-9_-]/g, '_');
        },

        getDateColor: (timestamp) => {
            const now = Date.now();
            const age = now - timestamp;
            const oneHour = 60 * 60 * 1000;
            const oneDay = 24 * oneHour;
            const oneWeek = 7 * oneDay;

            if (age < oneHour) return '#28a745'; // Green - less than 1 hour
            if (age < oneDay) return '#6cb04a'; // Light green - less than 1 day
            if (age < 3 * oneDay) return '#ffc107'; // Yellow - less than 3 days
            if (age < oneWeek) return '#fd7e14'; // Orange - less than 1 week
            return '#dc3545'; // Red - 1 week or older
        }
    };

    // Cache management for dynamic lists results
    const CacheManager = {
        getCacheKey: (userId) => `dynamicLists_${Utils.sanitizeKey(userId)}`,

        get: (userId) => {
            const cacheKey = CacheManager.getCacheKey(userId);
            const cached = GM_getValue(cacheKey, null);

            if (!cached) return null;

            try {
                const data = JSON.parse(cached);
                if (Date.now() - data.timestamp > CONFIG.CACHE_DURATION) {
                    GM_setValue(cacheKey, null);
                    return null;
                }
                return {
                    lists: data.lists,
                    checkTimestamp: data.checkTimestamp || data.timestamp
                };
            } catch (e) {
                console.error('Cache parse error:', e);
                return null;
            }
        },

        set: (userId, lists) => {
            const cacheKey = CacheManager.getCacheKey(userId);
            const cacheData = {
                timestamp: Date.now(),
                checkTimestamp: Date.now(), // When the check was performed
                lists: lists
            };
            GM_setValue(cacheKey, JSON.stringify(cacheData));
        },

        clear: (userId) => {
            const cacheKey = CacheManager.getCacheKey(userId);
            GM_setValue(cacheKey, null);
        }
    };

    // Simplified API handler using plain fetch
    class ApiHandler {
        constructor() {
            // No cf_clearance needed with plain fetch
        }

        async fetchUserLists(userId) {
            const url = CONFIG.API_ENDPOINTS.PROFILE_DETAILS.replace('{userId}', userId);
            console.log('[fetchUserLists] Fetching from URL:', url);

            try {
                const response = await fetch(url, {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/json, text/plain, */*',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0',
                        'Sec-GPC': '1',
                        'Sec-Fetch-Dest': 'empty',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Site': 'same-origin'
                    }
                });

                console.log('[fetchUserLists] Response status:', response.status);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                console.log('[fetchUserLists] Successfully fetched data:', data);

                return data.userLists || [];
            } catch (error) {
                console.error('[fetchUserLists] Error:', error);
                throw error;
            }
        }

        async checkUserInList(listId, userEmail) {
            const requestData = {
                emailListId: listId,
                page: 1,
                pageSize: CONFIG.PAGE_SIZE,
                searchQuery: {
                    combinator: "And",
                    searchQueries: [{
                        combinator: "And",
                        searchQueries: [{
                            dataType: "user",
                            searchCombo: {
                                combinator: "And",
                                searchQueries: [{
                                    value: listId.toString(),
                                    dataType: "user",
                                    field: "userListIds",
                                    comparatorType: "Equals",
                                    fieldType: "long"
                                }]
                            }
                        }, {
                            dataType: "user",
                            searchCombo: {
                                combinator: "And",
                                searchQueries: [{
                                    value: userEmail,
                                    dataType: "user",
                                    field: "email",
                                    comparatorType: "Equals",
                                    fieldType: "string"
                                }]
                            }
                        }]
                    }]
                },
                sorting: "desc"
            };

            try {
                // Get XSRF token from cookies
                const xsrfToken = document.cookie
                    .split('; ')
                    .find(cookie => cookie.startsWith('XSRF-TOKEN='))
                    ?.split('=')[1];

                const response = await fetch(CONFIG.API_ENDPOINTS.SEGMENT_QUERY, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json, text/plain, */*',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'X-XSRF-TOKEN': xsrfToken || '',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0',
                        'Sec-GPC': '1',
                        'Sec-Fetch-Dest': 'empty',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Site': 'same-origin'
                    },
                    body: JSON.stringify(requestData)
                });

                if (!response.ok) {
                    console.warn(`[checkUserInList] HTTP ${response.status} for list ${listId}`);
                    return false;
                }

                const data = await response.json();
                console.log('Response data:', data);
                return data.count && data.count > 0;
            } catch (error) {
                console.warn(`[checkUserInList] Error checking list ${listId}:`, error);
                return false;
            }
        }
    }

    // Progress bar component
    class ProgressBar {
        constructor(container) {
            this.container = container;
            this.element = null;
            this.create();
        }

        create() {
            this.element = document.createElement('div');
            this.element.style.cssText = `
                width: 100%;
                height: 4px;
                background-color: #e0e0e0;
                border-radius: 2px;
                margin: 10px 0;
                overflow: hidden;
                display: none;
            `;

            this.bar = document.createElement('div');
            this.bar.style.cssText = `
                height: 100%;
                background-color: #007bff;
                border-radius: 2px;
                width: 0%;
                transition: width 0.3s ease;
            `;

            this.element.appendChild(this.bar);
            this.container.appendChild(this.element);
        }

        show() {
            this.element.style.display = 'block';
        }

        hide() {
            this.element.style.display = 'none';
        }

        update(progress) {
            this.bar.style.width = `${progress}%`;
        }
    }

    // Main application class
    class DynamicListsChecker {
        constructor() {
            this.userId = this.extractUserIdFromUrl();
            this.userEmail = null;
            this.dynamicLists = [];
            this.userBelongsToLists = [];
            this.isRunning = false;
            this.apiHandler = new ApiHandler();
            this.uiContainer = null;
            this.progressBar = null;
            this.button = null;
            this.resultsContainer = null;
        }

        isOnListsPage() {
            return window.location.pathname.includes('/lists');
        }

        startUrlWatcher() {
            // Watch for URL changes
            this.urlWatcher = setInterval(() => {
                if (window.location.href !== this.currentUrl) {
                    this.previousUrl = this.currentUrl;
                    this.currentUrl = window.location.href;
                    this.handleUrlChange();
                }
            }, 500);
        }

        stopUrlWatcher() {
            if (this.urlWatcher) {
                clearInterval(this.urlWatcher);
                this.urlWatcher = null;
            }
        }

        handleUrlChange() {
            console.log('[handleUrlChange] URL changed from:', this.previousUrl, 'to:', this.currentUrl);

            const wasOnListsPage = this.previousUrl.includes('/lists');
            const isOnListsPage = this.currentUrl.includes('/lists');

            console.log('[handleUrlChange] Was on lists page:', wasOnListsPage, 'Is on lists page:', isOnListsPage);

            if (isOnListsPage && !wasOnListsPage) {
                // Navigated TO lists page - show UI
                console.log('[handleUrlChange] Navigated to lists page - showing UI');
                this.showUI();
            } else if (wasOnListsPage && !isOnListsPage) {
                // Navigated FROM lists page - refresh to prevent DOM conflicts
                console.log('[handleUrlChange] Navigated away from lists page - forcing refresh');
                this.stopUrlWatcher(); // Stop watcher before refresh
                window.location.reload();
            }
            // If neither condition is met, do nothing (staying on same type of page)
        }

        showUI() {
            if (this.sidePanel) {
                this.sidePanel.style.display = 'flex';
                return;
            }

            // Wait for list table to be available
            this.waitForListTable(() => {
                if (!this.sidePanel) {
                    this.createUI();
                }
            });
        }

        hideUI() {
            if (this.sidePanel) {
                this.sidePanel.style.display = 'none';
            }
        }

        waitForListTable(callback, attempts = 0, maxAttempts = 20) {
            const listTable = document.querySelector('[data-test="list-table"]');

            if (listTable) {
                callback();
            } else if (attempts < maxAttempts) {
                setTimeout(() => {
                    this.waitForListTable(callback, attempts + 1, maxAttempts);
                }, 250);
            } else {
                console.log('[waitForListTable] Max attempts reached, list table not found');
            }
        }

        extractUserIdFromUrl() {
            const match = window.location.pathname.match(/\/users\/profiles\/([^\/]+)/);
            return match ? match[1] : null;
        }

        extractUserEmailFromPage() {
            const emailSpan = document.querySelector('span[title*="@"]');
            return emailSpan ? emailSpan.getAttribute('title') : null;
        }

        createUI() {
            // Only create UI if we're on the lists page
            if (!this.isOnListsPage()) {
                console.log('[createUI] Not on lists page, skipping UI creation');
                return;
            }

            // Find the list table container to add our panel alongside
            const listTable = document.querySelector('[data-test="list-table"]');
            if (!listTable) {
                console.error('List table not found');
                return;
            }

            // Check if UI already exists
            if (this.sidePanel && this.sidePanel.parentNode) {
                console.log('[createUI] UI already exists');
                return;
            }

            console.log('[createUI] Creating UI elements');

            // Create a wrapper for the entire layout
            const layoutWrapper = document.createElement('div');
            layoutWrapper.id = 'dynamic-lists-layout-wrapper';
            layoutWrapper.style.cssText = `
                display: flex;
                gap: 20px;
                flex-wrap: wrap;
            `;

            // Wrap the existing list table
            const tableWrapper = document.createElement('div');
            tableWrapper.style.cssText = `
                flex: 1;
                min-width: 600px;
            `;

            // Move the list table into the wrapper
            listTable.parentNode.insertBefore(layoutWrapper, listTable);
            tableWrapper.appendChild(listTable);
            layoutWrapper.appendChild(tableWrapper);

            // Create the dynamic lists panel
            this.createDynamicListsPanel(layoutWrapper);

            // Check if we have cached data and show it
            const cachedData = CacheManager.get(this.userId);
            if (cachedData) {
                this.displayResults(cachedData.lists, cachedData.checkTimestamp);
            }

            // Also add the original button to the sub-header for manual refresh
            this.createHeaderButton();

            // Auto-start if configured and no cached data
            if (userConfig.autoStart && !cachedData) {
                setTimeout(() => this.checkAllLists(), 1000);
            }
        }

        createHeaderButton() {
            const targetContainer = document.querySelector('[data-test="sub-header-actions"]');
            if (!targetContainer) return;

            // Create header button container
            const headerButtonContainer = document.createElement('div');
            headerButtonContainer.style.cssText = `
                margin-right: 12px;
                display: flex;
                align-items: center;
            `;

            // Create header button
            const headerButton = document.createElement('button');
            headerButton.className = 'sc-iHbSHJ bUWAQk';
            headerButton.setAttribute('aria-disabled', 'false');
            headerButton.style.cssText = `
                background-color: #28a745;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 8px;
            `;

            headerButton.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-4"></path>
                    <polyline points="9,11 12,14 15,11"></polyline>
                    <line x1="12" y1="14" x2="12" y2="3"></line>
                </svg>
                Check Dynamic Lists
            `;

            headerButton.addEventListener('click', () => this.handleButtonClick());

            this.button = headerButton;
            headerButtonContainer.appendChild(headerButton);
            targetContainer.insertBefore(headerButtonContainer, targetContainer.firstChild);
        }

        createDynamicListsPanel(layoutWrapper) {
            // Create the side panel
            this.sidePanel = document.createElement('div');
            this.sidePanel.style.cssText = `
                flex: 0 0 500px;
                min-height: 400px;
                background: white;
                border: 1px solid #dee2e6;
                border-radius: 8px;
                display: flex;
                flex-direction: column;

                @media (max-width: 1440px) {
                    flex: 1;
                    min-width: 100%;
                }
            `;

            // Header
            const header = document.createElement('div');
            header.style.cssText = `
                padding: 16px;
                background-color: #f8f9fa;
                border-bottom: 1px solid #dee2e6;
                border-radius: 8px 8px 0 0;
                font-weight: 600;
                font-size: 16px;
                color: #495057;
            `;
            header.textContent = 'Dynamic Lists Membership';

            // Content area
            this.resultsContainer = document.createElement('div');
            this.resultsContainer.style.cssText = `
                flex: 1;
                padding: 0;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            `;

            // Progress bar container
            this.progressContainer = document.createElement('div');
            this.progressContainer.style.cssText = `
                padding: 16px;
                border-top: 1px solid #dee2e6;
                display: none;
            `;

            if (userConfig.showProgressBar) {
                this.progressBar = new ProgressBar(this.progressContainer);
            }

            this.sidePanel.appendChild(header);
            this.sidePanel.appendChild(this.resultsContainer);
            this.sidePanel.appendChild(this.progressContainer);

            layoutWrapper.appendChild(this.sidePanel);

            // Show initial state
            this.showInitialState();
        }

        showInitialState() {
            const cachedData = CacheManager.get(this.userId);

            if (!cachedData) {
                // No cached data - show refresh button
                this.resultsContainer.innerHTML = `
                    <div style="text-align: center; color: #6c757d; padding: 40px 20px;">
                        <div style="margin-bottom: 16px;">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: #dee2e6;">
                                <path d="M9 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-4"></path>
                                <polyline points="9,11 12,14 15,11"></polyline>
                                <line x1="12" y1="14" x2="12" y2="3"></line>
                            </svg>
                        </div>
                        <div style="margin-bottom: 20px; font-size: 16px;">No dynamic lists data cached</div>
                        <button id="refresh-lists-btn" style="
                            background-color: #007bff;
                            color: white;
                            border: none;
                            padding: 10px 20px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            margin: 0 auto;
                        ">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="23,4 23,10 17,10"></polyline>
                                <path d="M20.49,15a9,9,0,1,1-2.12-9.36L23,10"></path>
                            </svg>
                            Check Dynamic Lists
                        </button>
                    </div>
                `;

                const refreshBtn = document.getElementById('refresh-lists-btn');
                if (refreshBtn) {
                    refreshBtn.addEventListener('click', () => this.checkAllLists());
                }
            }
        }

        async handleButtonClick() {
            if (this.isRunning) return;

            // Clear cache for this user to force refresh
            CacheManager.clear(this.userId);

            await this.checkAllLists();
        }

        updateButtonState(isRunning, text = null) {
            if (!this.button) return;

            this.isRunning = isRunning;
            this.button.disabled = isRunning;

            if (text) {
                const svgElement = this.button.querySelector('svg');
                if (svgElement) {
                    this.button.innerHTML = svgElement.outerHTML + text;
                } else {
                    this.button.textContent = text;
                }
            }

            this.button.style.opacity = isRunning ? '0.6' : '1';
            this.button.style.cursor = isRunning ? 'not-allowed' : 'pointer';
        }

        async checkAllLists() {
            if (this.isRunning) {
                console.log('[checkAllLists] Already running, skipping');
                return;
            }

            console.log('[checkAllLists] Starting check for userId:', this.userId);

            try {
                this.updateButtonState(true, 'Loading...');

                // Hide previous results
                this.resultsContainer.style.display = 'none';

                // Extract user email
                this.userEmail = this.extractUserEmailFromPage();
                console.log('[checkAllLists] Extracted email:', this.userEmail);

                if (!this.userEmail) {
                    throw new Error('Could not extract user email from page');
                }

                // Show progress bar
                if (this.progressBar && this.progressContainer) {
                    this.progressContainer.style.display = 'block';
                    this.progressBar.show();
                    this.progressBar.update(0);
                }

                // Fetch all dynamic lists using plain fetch
                this.updateButtonState(true, 'Fetching Lists...');
                console.log('[checkAllLists] Fetching user lists...');

                const allLists = await this.apiHandler.fetchUserLists(this.userId);
                console.log('[checkAllLists] Fetched all lists:', allLists);

                this.dynamicLists = allLists.filter(list => list.emailListType === 'Dynamic');
                console.log('[checkAllLists] Filtered dynamic lists:', this.dynamicLists.length, 'lists');

                if (this.dynamicLists.length === 0) {
                    console.log('[checkAllLists] No dynamic lists found');
                    this.displayNoResults('No dynamic lists found');
                    return;
                }

                this.updateButtonState(true, 'Checking Membership...');
                this.userBelongsToLists = [];

                // Process lists in batches
                const totalLists = this.dynamicLists.length;
                let processedCount = 0;
                console.log('[checkAllLists] Processing', totalLists, 'lists in batches of', userConfig.batchSize);

                for (let i = 0; i < totalLists; i += userConfig.batchSize) {
                    const batch = this.dynamicLists.slice(i, i + userConfig.batchSize);
                    console.log('[checkAllLists] Processing batch', Math.floor(i / userConfig.batchSize) + 1, '- Lists:', batch.map(l => l.name));

                    const batchPromises = batch.map(list =>
                        this.apiHandler.checkUserInList(list.id, this.userEmail)
                            .then(belongsTo => {
                                console.log('[checkAllLists] List', list.name, 'membership:', belongsTo);
                                return { list, belongsTo };
                            })
                    );

                    const batchResults = await Promise.all(batchPromises);

                    // Add lists user belongs to
                    batchResults.forEach(({ list, belongsTo }) => {
                        if (belongsTo) {
                            this.userBelongsToLists.push(list);
                            console.log('[checkAllLists] User belongs to:', list.name);
                        }
                    });

                    processedCount += batch.length;

                    // Update progress
                    if (this.progressBar) {
                        const progress = (processedCount / totalLists) * 100;
                        this.progressBar.update(progress);
                    }

                    this.updateButtonState(true, `Checked ${processedCount}/${totalLists} lists`);

                    // Add delay between batches
                    if (i + userConfig.batchSize < totalLists) {
                        await Utils.sleep(CONFIG.REQUEST_DELAY);
                    }
                }

                console.log('[checkAllLists] Final results - User belongs to', this.userBelongsToLists.length, 'dynamic lists');

                // Cache the results
                CacheManager.set(this.userId, this.userBelongsToLists);
                console.log('[checkAllLists] Results cached');

                // Display results
                console.log('[checkAllLists] Displaying results for', this.userBelongsToLists.length, 'lists');
                this.displayResults(this.userBelongsToLists, Date.now());

            } catch (error) {
                console.error('[checkAllLists] Error in checkAllLists:', error);
                console.error('[checkAllLists] Error stack:', error.stack);
                this.displayError(`Error: ${error.message}`);
            } finally {
                this.updateButtonState(false, 'Check Dynamic Lists');
                if (this.progressBar && this.progressContainer) {
                    this.progressBar.hide();
                    this.progressContainer.style.display = 'none';
                }
                console.log('[checkAllLists] Check complete');
            }
        }

        displayResults(lists, checkTimestamp = Date.now()) {
            if (!this.resultsContainer) {
                console.error('[displayResults] Results container not found');
                return;
            }

            console.log('[displayResults] Displaying', lists.length, 'lists at', new Date(checkTimestamp));

            // Make sure the container is visible
            this.resultsContainer.style.display = 'block';

            if (lists.length === 0) {
                this.resultsContainer.innerHTML = `
                    <div style="
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        padding: 40px 20px;
                        color: #6c757d;
                        text-align: center;
                        height: 100%;
                    ">
                        <div style="margin-bottom: 16px;">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: #dee2e6;">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                        </div>
                        <div style="font-size: 16px; margin-bottom: 8px;">No dynamic lists found</div>
                        <div style="font-size: 14px;">User is not in any dynamic lists</div>
                        <div style="font-size: 12px; margin-top: 16px; color: ${Utils.getDateColor(checkTimestamp)};">
                            Last checked: ${Utils.formatTimestamp(checkTimestamp)}
                        </div>
                    </div>
                `;
                console.log('[displayResults] Displayed no results message');
                return;
            }

            // Create table header
            const tableHeader = `
                <div style="
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 16px;
                    padding: 12px 20px;
                    background-color: #f8f9fa;
                    border-bottom: 1px solid #dee2e6;
                    font-weight: bold;
                    font-size: 12px;
                    color: #6c757d;
                    text-transform: uppercase;
                    width: 100%;
                    box-sizing: border-box;
                ">
                    <div>List Name</div>
                    <div>Last Checked</div>
                </div>
            `;

            const listItems = lists.map((list, index) => `
                <div style="
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 16px;
                    padding: 12px 20px;
                    border-bottom: 1px solid #eee;
                    align-items: center;
                    width: 100%;
                    box-sizing: border-box;
                ">
                    <div>
                        <div style="margin-bottom: 4px;">
                            <a href="https://app.iterable.com/segmentation?emailListId=${list.id}"
                               target="_blank"
                               class="dynamic-list-link"
                               data-list-id="${list.id}"
                               style="
                                   color: #007bff;
                                   text-decoration: none;
                                   font-weight: 500;
                                   font-size: 14px;
                               ">
                               ${list.name}
                            </a>
                        </div>
                        <div style="font-size: 11px; color: #6c757d;">ID: ${list.id}</div>
                    </div>
                    <div style="
                        font-size: 12px;
                        color: ${Utils.getDateColor(checkTimestamp)};
                        font-weight: 500;
                    ">
                        ${Utils.formatTimestamp(checkTimestamp)}
                    </div>
                </div>
            `).join('');

            const finalHTML = tableHeader + listItems;
            console.log('[displayResults] Setting innerHTML with', finalHTML.length, 'characters');
            this.resultsContainer.innerHTML = finalHTML;

            console.log('[displayResults] Container display style:', this.resultsContainer.style.display);

            // Add proper event listeners for hover effects
            setTimeout(() => {
                const links = this.resultsContainer.querySelectorAll('.dynamic-list-link');
                console.log('[displayResults] Adding event listeners to', links.length, 'links');
                links.forEach(link => {
                    link.addEventListener('mouseenter', function() {
                        this.style.textDecoration = 'underline';
                    });
                    link.addEventListener('mouseleave', function() {
                        this.style.textDecoration = 'none';
                    });
                });
            }, 100);
        }

        displayNoResults(message) {
            this.displayResults([]);
        }

        displayError(message) {
            if (!this.resultsContainer) return;

            this.resultsContainer.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #dc3545;">
                    ${message}
                </div>
            `;
            this.resultsContainer.style.display = 'block';
        }
    }

    // Configuration functions
    function configureBatchSize() {
        const newSize = prompt(`Enter batch size (1-20):\nCurrent: ${userConfig.batchSize}`, userConfig.batchSize);
        if (newSize && !isNaN(newSize)) {
            const size = Math.max(1, Math.min(20, parseInt(newSize)));
            userConfig.batchSize = size;
            GM_setValue('batchSize', size);
            alert(`Batch size set to ${size}`);
        }
    }

    function toggleAutoStart() {
        userConfig.autoStart = !userConfig.autoStart;
        GM_setValue('autoStart', userConfig.autoStart);
        alert(`Auto start ${userConfig.autoStart ? 'enabled' : 'disabled'}`);
    }

    function clearCache() {
        // Clear all dynamic lists cache
        for (let i = 0; i < 1000; i++) {
            const key = `dynamicLists_${i}`;
            if (GM_getValue(key, null)) {
                GM_setValue(key, null);
            }
        }
        alert(`Cache cleared`);
    }

    // Initialize when page loads
    function init() {
        console.log('[init] Initializing Dynamic Lists Checker');

        const checker = new DynamicListsChecker();

        // Start watching for URL changes
        checker.startUrlWatcher();

        // Initial check based on current URL
        if (checker.isOnListsPage()) {
            console.log('[init] On lists page - setting up UI');
            checker.showUI();
        } else {
            console.log('[init] Not on lists page - waiting for navigation');
        }
    }

    // Start the application
    init();
})();
