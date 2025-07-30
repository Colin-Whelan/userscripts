// ==UserScript==
// @name         Iterable Folder Auto-Loader
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Automatically show folders on Finished campaigns view (root level only - no subfolder support)
// @author       Colin Whelan
// @match        https://app.iterable.com/campaigns/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let isProcessing = false;
    let lastUrl = location.href;
    let observer = null;

    // Get XSRF token from page or cookies
    function getXSRFToken() {
        // Try to find it in meta tags first
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        if (metaTag) return metaTag.getAttribute('content');

        // Try to extract from cookies
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'XSRF-TOKEN' || name === 'csrf_token') {
                return decodeURIComponent(value);
            }
        }

        // Try to find in existing requests
        const scripts = document.getElementsByTagName('script');
        for (let script of scripts) {
            if (script.innerHTML.includes('xsrf') || script.innerHTML.includes('csrf')) {
                const match = script.innerHTML.match(/["\']([a-f0-9]{40,})["\'/]/);
                if (match) return match[1];
            }
        }

        return null;
    }

    // Check if we're on the finished campaigns view
    function isFinishedTabActive() {
        const finishedTab = document.querySelector('button[role="tab"][aria-controls*="Finished"]');
        return finishedTab && finishedTab.getAttribute('aria-selected') === 'true';
    }

    // Check if we're at root level (not in a subfolder)
    function isAtRootLevel() {
        const breadcrumbBar = document.querySelector('[data-test="folder-breadcrumb-bar"]');
        // If no breadcrumb bar exists, we're at root level
        // If breadcrumb bar exists, we're in a subfolder
        return !breadcrumbBar;
    }

    // Get project ID from URL
    function getProjectId() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('projectId');
    }

    // Fetch folder data from GraphQL API
    async function fetchFolderData() {
        const projectId = getProjectId();
        if (!projectId) {
            console.log('No project ID found in URL');
            return null;
        }

        const xsrfToken = getXSRFToken();

        const query = `
            query fetchFolderQuery($campaignFilterInfo: CampaignFilterInfoInput, $folderId: Long, $pagination: Pagination, $recursive: Boolean, $search: String, $sort: Sort) {
                campaignFolder(
                    campaignFilterInfo: $campaignFilterInfo
                    folderId: $folderId
                    pagination: $pagination
                    recursive: $recursive
                    search: $search
                    sort: $sort
                ) {
                    info {
                        count
                        offset
                        limit
                        page
                        __typename
                    }
                    content {
                        ... on CampaignSubfolder {
                            id
                            name
                            __typename
                        }
                        ... on Campaign {
                            id
                            __typename
                        }
                        __typename
                    }
                    __typename
                }
            }
        `;

        const variables = {
            campaignFilterInfo: {
                campaignState: ["Finished", "Aborted", "Recalled"],
                parentsOnly: true
            },
            folderId: null,
            recursive: false,
            pagination: {
                limit: 20,
                offset: 0
            },
            search: null,
            sort: {
                sortBy: "UpdatedAt",
                sortDirection: "Descending"
            }
        };

        const headers = {
            'Content-Type': 'application/json',
            'Accept': '*/*',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin'
        };

        if (xsrfToken) {
            headers['x-xsrf-token'] = xsrfToken;
        }

        try {
            const response = await fetch('https://app.iterable.com/graphql', {
                method: 'POST',
                headers: headers,
                credentials: 'include',
                body: JSON.stringify({
                    operationName: 'fetchFolderQuery',
                    query: query,
                    variables: variables
                })
            });

            if (!response.ok) {
                console.error('GraphQL request failed:', response.status, response.statusText);
                return null;
            }

            const data = await response.json();
            return data;

        } catch (error) {
            console.error('Error fetching folder data:', error);
            return null;
        }
    }

    // Create a folder row element
    function createFolderRow(folder, projectId) {
        const folderRow = document.createElement('div');
        folderRow.setAttribute('data-test', `folder-row-${folder.id}`);
        folderRow.setAttribute('data-injected', 'true'); // Mark as injected to avoid duplication
        folderRow.setAttribute('role', 'row'); // Add grid role for proper layout
        folderRow.className = 'sc-kypfzD fvloNI'; // Use grid row classes instead of folder classes

        // Create the URL with finished state parameters
        const folderUrl = `/campaigns/manage?projectId=${projectId}&folderId=${folder.id}&stateCategory=Finished&states=Finished%2CAborted%2CRecalled`;

        folderRow.innerHTML = `
            <div class="sc-khcxRi bMWpaq">
                <div data-test="checkbox-grid-cell" class="sc-cqKgCK kcymDC">
                    <div aria-checked="false" aria-disabled="false" data-test="checkbox-grid-cell-checkbox" role="checkbox" id="checkbox-${folder.id}" tabindex="0" class="sc-uVWWZ ecaSWc">
                        <span data-test="checkbox-icon-wrapper" class="sc-hknOHE dsScvk"></span>
                    </div>
                </div>
            </div>
            <svg fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" data-test="folder-icon" class="shape">
                <path d="M20.4375 8.0625C20.4375 7.76413 20.319 7.47798 20.108 7.267C19.897 7.05603 19.6109 6.9375 19.3125 6.9375H10.875L9.525 5.1375C9.42021 4.99778 9.28433 4.88438 9.12812 4.80627C8.9719 4.72816 8.79965 4.6875 8.625 4.6875H4.6875C4.38913 4.6875 4.10298 4.80603 3.892 5.017C3.68103 5.22798 3.5625 5.51413 3.5625 5.8125V18.1875C3.5625 18.4859 3.68103 18.772 3.892 18.983C4.10298 19.194 4.38913 19.3125 4.6875 19.3125H19.3125C19.6109 19.3125 19.897 19.194 20.108 18.983C20.319 18.772 20.4375 18.4859 20.4375 18.1875V8.0625Z" fill="#34c3f2" stroke="none" stroke-opacity="0"></path>
            </svg>
            <a data-test="search-param-link" href="${folderUrl}" class="sc-bAOQmL knwgSV">${folder.name}</a>
        `;

        return folderRow;
    }

    // Remove any previously injected folder rows
    function removePreviouslyInjectedFolders() {
        const injectedFolders = document.querySelectorAll('[data-injected="true"]');
        injectedFolders.forEach(folder => folder.remove());
        console.log(`Removed ${injectedFolders.length} injected folders`);
    }

    // Add folders to the campaign table
    function addFoldersToTable(folders, projectId) {
        const campaignTable = document.querySelector('[data-test="campaign-folder-table"]');
        if (!campaignTable) {
            console.log('Campaign table not found');
            return;
        }

        // Remove any previously injected folders to avoid duplication
        removePreviouslyInjectedFolders();

        // Find the header row
        const headerRow = campaignTable.querySelector('[data-test="header-grid-row"]');
        if (!headerRow) {
            console.log('Header row not found');
            return;
        }

        // Add each folder after the header row
        folders.forEach((folder, index) => {
            const folderRow = createFolderRow(folder, projectId);

            // Insert after header row (or after previous folder)
            if (index === 0) {
                headerRow.insertAdjacentElement('afterend', folderRow);
            } else {
                const previousFolder = campaignTable.querySelector(`[data-test="folder-row-${folders[index-1].id}"]`);
                if (previousFolder) {
                    previousFolder.insertAdjacentElement('afterend', folderRow);
                }
            }
        });

        console.log(`Added ${folders.length} folders to the campaign table`);
    }

    // Check if we should show folders
    function shouldShowFolders() {
        const isFinished = isFinishedTabActive();
        const isRoot = isAtRootLevel();

        console.log(`Tab check - Finished: ${isFinished}, Root level: ${isRoot}`);

        return isFinished && isRoot;
    }

    // Main function to process the page
    async function processPage() {
        if (isProcessing) return;

        // Only run on campaigns/manage pages
        if (!window.location.pathname.includes('/campaigns/manage') && !window.location.pathname.includes('/campaigns/')) {
            return;
        }

        isProcessing = true;

        try {
            if (!shouldShowFolders()) {
                // Remove folders if we shouldn't show them
                removePreviouslyInjectedFolders();
                console.log('Not showing folders - wrong tab or not at root level');
                return;
            }

            // Check if folders are already showing (don't duplicate if user navigated naturally)
            const existingFolders = document.querySelectorAll('[data-test^="folder-row-"]:not([data-injected="true"])');
            if (existingFolders.length > 0) {
                console.log('Folders already showing naturally, skipping injection');
                return;
            }

            console.log('Processing finished campaigns page at root level...');

            const data = await fetchFolderData();

            if (!data || !data.data || !data.data.campaignFolder) {
                console.log('No folder data received');
                return;
            }

            const folders = data.data.campaignFolder.content.filter(
                item => item.__typename === 'CampaignSubfolder'
            );

            if (folders.length === 0) {
                console.log('No folders found in response');
                return;
            }

            const projectId = getProjectId();
            addFoldersToTable(folders, projectId);

        } catch (error) {
            console.error('Error processing page:', error);
        } finally {
            isProcessing = false;
        }
    }

    // Setup observer to watch for DOM changes
    function setupObserver() {
        if (observer) {
            observer.disconnect();
        }

        observer = new MutationObserver((mutations) => {
            let shouldProcess = false;

            mutations.forEach((mutation) => {
                // Check if tabs changed
                if (mutation.target.matches && mutation.target.matches('button[role="tab"]')) {
                    shouldProcess = true;
                }

                // Check if breadcrumb appeared/disappeared (navigation to/from subfolder)
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        if (node.matches && (
                            node.matches('[data-test="folder-breadcrumb-bar"]') ||
                            node.matches('[data-test="campaign-folder-table"]') ||
                            node.querySelector && (
                                node.querySelector('[data-test="folder-breadcrumb-bar"]') ||
                                node.querySelector('[data-test="campaign-folder-table"]')
                            )
                        )) {
                            shouldProcess = true;
                        }
                    }
                });

                // Check if breadcrumb was removed (back to root)
                mutation.removedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        if (node.matches && node.matches('[data-test="folder-breadcrumb-bar"]')) {
                            shouldProcess = true;
                        }
                    }
                });
            });

            if (shouldProcess) {
                setTimeout(processPage, 200); // Small delay to let DOM settle
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['aria-selected', 'data-state']
        });
    }

    // Handle navigation changes (for SPA routing)
    function handleNavigation() {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            setTimeout(processPage, 500); // Delay for SPA navigation
        }
    }

    // Initialize the script
    function init() {
        console.log('Iterable Folder Auto-Loader initialized');

        // Initial page load
        setTimeout(processPage, 1000);

        // Setup observers
        setupObserver();

        // Handle navigation changes
        setInterval(handleNavigation, 1000);

        // Handle browser back/forward
        window.addEventListener('popstate', () => {
            setTimeout(processPage, 500);
        });
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
