// ==UserScript==
// @name        Templates List - Custom Fuzzy Search
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/templates-list*
// @version     2.2
// @author      Colin Whelan
// @grant       GM_xmlhttpRequest
// @description Adds an improved fuzzy search filter for templates + shows more template info + allows for searching of all text fields + show template usage for all templates.
// Added option for including archive(excluded by default), pagination, and user-activated template usage checking.
// @require     https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.4/moment.min.js
// ==/UserScript==

let usageDataStore = {};
let currentPage = 1;
let itemsPerPage = 100;
let filteredResults = [];
let usageLoadingInProgress = false;
let accountId = null; // Will be detected dynamically

const FALLBACK_IMAGE_ACCOUNT_ID = 999;

// Configurable image sizes
const imageConfig = {
    thumbnailSize: { width: 75, height: 50 },
    hoverSize: { width: 200, height: 'auto' }
};

// Function to detect account ID from existing template images
function detectAccountId() {
    if (accountId) {
        return accountId; // Already detected
    }

    const existingImages = document.querySelectorAll('img[src*="sailthru-html-thumbnail-generator"]');
    const accountIds = [];

    // console.log(`🔍 Checking ${existingImages.length} existing images for account ID...`);

    existingImages.forEach((img, index) => {
        if (index < 5) { // Only check first 5 as requested
            console.log(`📋 Image ${index + 1}: ${img.src}`);
            // Updated regex to capture alphanumeric account IDs (not just digits)
            const match = img.src.match(/sailthru-html-thumbnail-generator[^\/]*\.s3\.amazonaws\.com\/([^\/]+)\//);
            if (match) {
                const detectedId = match[1];
                accountIds.push(detectedId);
                console.log(`✅ Account ID detected: ${detectedId}`);
            } else {
                console.log(`❌ No account ID found in URL`);
            }
        }
    });

    if (accountIds.length > 0) {
        // Find the most common account ID
        const idCounts = {};
        accountIds.forEach(id => {
            idCounts[id] = (idCounts[id] || 0) + 1;
        });

        // Get the most frequent account ID
        accountId = Object.keys(idCounts).reduce((a, b) => idCounts[a] > idCounts[b] ? a : b);

        // console.log(`✅ Final detected account ID: ${accountId} (appeared ${idCounts[accountId]}/${accountIds.length} times)`);
        // console.log(`📊 All detected IDs:`, idCounts);
    } else {
        // console.warn('⚠️ Could not detect account ID from existing images, falling back to FALLBACK_IMAGE_ACCOUNT_ID');
        accountId = FALLBACK_IMAGE_ACCOUNT_ID;
    }

    return accountId;
}

function getTemplateUsageData(item, callback) {
    const usageURL = `https://my.sailthru.com/uiapi/lifecycle/?template_id=${item._id}`;

    if (usageDataStore[item._id]) {
        callback(usageDataStore[item._id]);
    } else {
        GM_xmlhttpRequest({
            method: "GET",
            url: usageURL,
            onload: function(response) {
                const data = JSON.parse(response.responseText);
                usageDataStore[item._id] = data;
                callback(data);
            },
            onerror: function(error) {
                console.error('Failed to fetch usage data for template:', item._id, error);
                callback([]);
            }
        });
    }
}

function createSearchButton() {
    // Multiple selectors to find the button container, from most specific to most general
    const buttonContainerSelectors = [
        '#tabs-3',
        'div[id^="tabs-"][class*="sc-"]',
        'div[role="tablist"]',
        'div[class*="MainPanel"]'
    ];

    let buttonContainer = null;

    // Try each selector until we find a match
    for (const selector of buttonContainerSelectors) {
        try {
            buttonContainer = document.querySelector(selector);
            if (buttonContainer) {
                // console.log(`Found button container using selector: ${selector}`);
                break;
            }
        } catch (e) {
            // console.log(`Selector ${selector} not supported, trying next...`);
            continue;
        }
    }

    // Final fallback: look for any existing button and use its parent
    if (!buttonContainer) {
        const existingButtons = document.querySelectorAll('button');
        for (const btn of existingButtons) {
            if (btn.textContent.includes('Check Template Usage') ||
                btn.style.zIndex === '9999' ||
                btn.style.position === 'absolute') {
                buttonContainer = btn.parentElement;
                // console.log('Found button container using existing button parent fallback');
                break;
            }
        }
    }

    if (buttonContainer) {
        // Check if our button already exists
        if (document.getElementById('advancedSearchButton')) {
            // console.log('Advanced Search button already exists');
            return;
        }

        // console.log('Found button container, adding Advanced Search button');

        const button = document.createElement('button');
        button.innerHTML = 'Advanced Search';
        button.id = 'advancedSearchButton';

        // Look for existing button to copy styling from
        let existingButton = null;
        const buttons = buttonContainer.querySelectorAll('button');
        for (const btn of buttons) {
            if (btn.textContent.includes('Check Template Usage') ||
                btn.style.zIndex === '9999' ||
                btn.style.position === 'absolute') {
                existingButton = btn;
                break;
            }
        }

        if (existingButton) {
            button.style.cssText = existingButton.style.cssText;
            button.style.backgroundColor = '#00A2BE';
            button.style.color = 'white';
            button.style.right = '160px';
        } else {
            // Fallback styling
            button.style.position = 'absolute';
            button.style.top = '20px';
            button.style.right = '160px';
            button.style.zIndex = '9999';
            button.style.padding = '8px 20px';
            button.style.margin = '6px';
            button.style.borderRadius = '5px';
            button.style.backgroundColor = '#00A2BE';
            button.style.color = 'white';
            button.style.border = 'medium';
            button.style.cursor = 'pointer';
            button.style.fontSize = '14px';
            button.style.fontWeight = 'bold';
            button.style.transition = 'background-color 0.3s';
        }

        button.onclick = function () {
            populateModal();
            document.getElementById('searchModal').style.display = 'block';
        }

        buttonContainer.appendChild(button);
    } else {
        // console.log('Could not find suitable button container');
    }
}

function createModal() {
    const modal = document.createElement('div');
    modal.id = 'searchModal';

    modal.style.display = 'none';
    modal.style.position = 'fixed';
    modal.style.left = '0';
    modal.style.top = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.4)';

    modal.innerHTML = `
    <div class="modal-content">
      <div class="search-container">
          <span style="font-size: 16px; margin-left: 10px;">Search Field: </span>
          <div class="select-wrapper">
              <select id="searchField">
                    <option value="name">Name</option>
                    <option value="labels_string">Labels</option>
                    <option value="modify_user">Modified By</option>
                    <option value="create_user">Created By</option>
                    <option value="subject">Subject Line</option>
                    <option value="preheader">Preheader</option>
                    <option value="from_name">From Name</option>
                    <option value="from_email">From Email</option>
                    <option value="replyto_email">Reply-to</option>
                </select>
          </div>
          <input type="text" id="searchInput" placeholder="Search..."/>
          <div id="includeArchive">
              <label for="archiveCheckbox">Include Archive?</label>
              <input id="archiveCheckbox" type="checkbox">
          </div>
          <button id="loadUsageButton" style="margin-left: 10px; padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">Load Template Usage</button>
          <span class="close">&times;</span>
      </div>
      <div id="searchDiv">
          <div id="paginationControls" style="margin-bottom: 10px;">
              <button id="prevPage" style="margin-right: 10px; padding: 5px 10px;">Previous</button>
              <span id="pageInfo">Page 1</span>
              <button id="nextPage" style="margin-left: 10px; padding: 5px 10px;">Next</button>
              <span id="resultsCount" style="margin-left: 20px; font-weight: bold;"></span>
          </div>
          <div id="searchResults"></div>
      </div>
    </div>`;

    const searchInput = modal.querySelector('#searchInput');
    searchInput.style.width = 'auto';
    searchInput.style.fontSize = '18px';
    searchInput.style.lineHeight = '24px';
    searchInput.style.padding = '9px 15px';
    searchInput.style.margin = '8px 0';
    searchInput.style.boxSizing = 'border-box';
    searchInput.style.border = '2px solid #ccc';
    searchInput.style.borderRadius = '4px';

    const closeButton = modal.querySelector('.close');
    closeButton.style.color = '#aaa';
    closeButton.style.float = 'right';
    closeButton.style.fontSize = '36px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.marginLeft = '10px';
    closeButton.style.backgroundColor = '#fff';

    document.body.appendChild(modal);

    // Event listeners
    closeButton.onclick = function () {
        closeModal();
    };

    document.addEventListener('click', function (event) {
        const modal = document.getElementsByClassName('modal-content')[0];
        if (modal && modal.parentNode.style.display === 'block' &&
            event.srcElement.id != 'advancedSearchButton' &&
            !modal.contains(event.target)) {
            closeModal();
        }
    });

    document.getElementById('searchInput').addEventListener('input', () => {
        currentPage = 1;
        populateModal();
    });
    document.getElementById('searchField').addEventListener('change', () => {
        currentPage = 1;
        populateModal();
    });
    document.getElementById('archiveCheckbox').addEventListener('change', () => {
        currentPage = 1;
        populateModal();
    });

    // Pagination event listeners with better debouncing
    let paginationInProgress = false;

    document.getElementById('prevPage').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (paginationInProgress) {
            // console.log('Pagination already in progress, ignoring click');
            return;
        }

        // console.log(`Previous clicked: currentPage was ${currentPage}`);
        if (currentPage > 1) {
            paginationInProgress = true;
            currentPage--;
            // console.log(`Moving to page ${currentPage}`);
            populateModal();

            setTimeout(() => {
                paginationInProgress = false;
            }, 500);
        }
    });

    document.getElementById('nextPage').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (paginationInProgress) {
            console.log('Pagination already in progress, ignoring click');
            return;
        }

        // console.log(`Next clicked: currentPage was ${currentPage}, filteredResults length: ${filteredResults.length}`);
        const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
        // console.log(`Total pages: ${totalPages}`);
        if (currentPage < totalPages && totalPages > 0) {
            paginationInProgress = true;
            currentPage++;
            // console.log(`Moving to page ${currentPage}`);
            populateModal();

            setTimeout(() => {
                paginationInProgress = false;
            }, 500);
        } else {
            // console.log(`Cannot move to next page: currentPage=${currentPage}, totalPages=${totalPages}`);
        }
    });

    // Template usage loading button
    document.getElementById('loadUsageButton').addEventListener('click', () => {
        loadTemplateUsageForCurrentPage();
    });
}

function populateModal(initial = false) {
    // Hide original table head with null check
    const tableHead = document.querySelector('.src__TableHead-sc-1epr26z-1');
    if (tableHead) {
        tableHead.style.display = 'none';
    }

    if (!document.getElementById('customTableStyles')) {
        const style = document.createElement('style');
        style.id = 'customTableStyles';
        style.innerHTML = `
        .modal-content {
            background-color: #fff;
            margin: 2% auto auto auto;
            padding: 0px 20px 20px 20px;
            width: 95%;
            height: 90%;
            overflow-y: auto;
            border-radius: 5px;
            scrollbar-gutter: stable;
        }
        .customLabel {
            display: inline-block;
            white-space: nowrap;
            color: white;
            padding: 5px;
            margin: 0 2px;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 150px;
            border-radius: 5px;
        }
        .search-container {
            display: flex;
            align-items: center;
            position: sticky;
            top: 0;
            z-index: 1000;
            background-color: white;
            padding: 15px 0;
            border-bottom: 3px solid #ccc;
            margin-bottom: 10px;
        }
        #searchInput {
            flex-grow: 1;
            padding: 10px;
            border-radius: 4px;
            border: 1px solid #ccc;
            margin-right: 10px;
        }
        .select-wrapper {
            position: relative;
            display: inline-block;
        }
        #searchField {
            appearance: none;
            padding: 12px 10px;
            border-radius: 4px;
            border: 1px solid #ccc;
            background-color: #fff;
            cursor: pointer;
            outline: none;
            margin: 0 10px;
            min-width: 130px;
            font-size: 15px;
        }
        .select-wrapper::after {
            content: "🞃";
            position: absolute;
            right: 25px;
            top: 40%;
            transform: translateY(-50%);
            pointer-events: none;
            font-size: 18px;
        }
        .template-preview {
            max-width: ${imageConfig.thumbnailSize.width}px;
            max-height: ${imageConfig.thumbnailSize.height}px;
            width:${imageConfig.thumbnailSize.width}px;
            height: auto;
            border-radius: 4px;
            cursor: pointer;
            transition: transform 0.2s ease;
            position: relative;
        }
        .template-preview:hover {
            transform: scale(1.05);
        }
        a.image-tooltip {
            border-bottom: none;
            text-decoration: none;
            color: #333;
            position: relative;
            display: inline-block;
        }
        a.image-tooltip span.hover-preview {
            display: none;
        }
        a.image-tooltip:hover {
            cursor: pointer;
            position: relative;
        }
        a.image-tooltip:hover span.hover-preview {
            display: block;
            z-index: 99999;
            background: #fff;
            border: 3px solid #333;
            padding: 8px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
            left: 60px;
            width: ${imageConfig.hoverSize.width}px;
            position: absolute;
            top: -50px;
            text-decoration: none;
            border-radius: 8px;
        }
        a.tooltip {
            border-bottom: 1px dashed;
            text-decoration: none;
            color: #333;
        }
        a.tooltip span {
            display: none;
        }
        a.tooltip:hover {
            cursor: help;
            color: #333;
            position: relative;
        }
        a.tooltip:hover span {
            border: #666 2px dotted;
            padding: 5px 20px 5px 5px;
            display: block;
            z-index: 10000;
            background: #f9f9f9;
            border: 1px solid #ccc;
            padding: 10px;
            box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2);
            left: 15px;
            width: 300px;
            position: absolute;
            top: 15px;
            text-decoration: none;
        }
        #resultsTable {
            width: 100%;
            border-collapse: collapse;
            font-family: Arial, sans-serif;
        }
        #resultsTable th, #resultsTable td {
            border: 1px solid #dddddd;
            padding: 12px;
            text-align: left;
            vertical-align: top;
        }
        #resultsTable th {
            border-bottom: 3px solid #bbb;
        }
        #resultsTable tr:nth-child(even) {
            background-color: #f2f2f2;
        }
        #includeArchive {
            margin: 10px;
        }
        #includeArchive label {
            position: relative;
            top: -3px;
        }
        #archiveCheckbox {
            margin-top: 5px;
            height: 20px;
            width: 20px;
            background-color: #eee;
            border-radius: 4px;
            transition: all 0.3s ease;
        }
        #paginationControls {
            display: flex;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #ccc;
        }
        #paginationControls button {
            padding: 8px 16px;
            border: 1px solid #ccc;
            background: white;
            cursor: pointer;
            border-radius: 4px;
        }
        #paginationControls button:hover {
            background: #f0f0f0;
        }
        #paginationControls button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        `;
        document.head.appendChild(style);
    }

    // Get form values with null checks
    const input = document.getElementById('searchInput');
    const searchField = document.getElementById('searchField');
    const archiveCheckbox = document.getElementById('archiveCheckbox');

    if (!input || !searchField || !archiveCheckbox) {
        console.error('Required form elements not found');
        return;
    }

    const query = initial ? '' : input.value.toLowerCase();
    const searchFieldValue = searchField.value;

    // Check if sailthruTemplates exists
    if (typeof sailthruTemplates === 'undefined' || !sailthruTemplates.templates) {
        console.error('sailthruTemplates not found or has no templates');
        return;
    }

    let templates = sailthruTemplates.templates;

    // Filter archived templates
    if (!archiveCheckbox.checked) {
        templates = templates.filter(template => template.is_archived === false);
    }

    // Apply search filter
    filteredResults = fuzzyFilter(query, templates);

    // Calculate pagination
    const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentPageResults = filteredResults.slice(startIndex, endIndex);

    // console.log(`Pagination: Page ${currentPage} of ${totalPages}, showing items ${startIndex}-${Math.min(endIndex - 1, filteredResults.length - 1)} of ${filteredResults.length}`);

    // Update pagination controls
    const prevButton = document.getElementById('prevPage');
    const nextButton = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');
    const resultsCount = document.getElementById('resultsCount');

    if (prevButton && nextButton && pageInfo && resultsCount) {
        prevButton.disabled = currentPage === 1;
        nextButton.disabled = currentPage >= totalPages || totalPages === 0;
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        resultsCount.textContent = `Showing ${startIndex + 1}-${Math.min(endIndex, filteredResults.length)} of ${filteredResults.length} results`;
    }

    const resultsDiv = document.getElementById('searchResults');
    if (!resultsDiv) {
        console.error('searchResults div not found');
        return;
    }

    resultsDiv.innerHTML = `
        <table id="resultsTable">
            <thead>
                <tr>
                    <th>Preview</th>
                    <th>Name</th>
                    <th width="140px">Envelope Details</th>
                    <th width="250px">Last Modified</th>
                    <th>Modified By</th>
                    <th width="250px">Last Created</th>
                    <th>Created By</th>
                    <th>Labels</th>
                    <th width="120px">Template Usage</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        </table>`;

    const tbody = resultsDiv.querySelector('tbody');

    currentPageResults.forEach((item, index) => {
        const row = document.createElement('tr');
        const labelsHTML = generateLabelHTML(item.labels_string);

        // Generate preview image URL using base 36 conversion and detected account ID
        const templateCode = parseInt(item._id).toString(36);
        const detectedAccountId = detectAccountId();
        const previewUrl = `https://sailthru-html-thumbnail-generator-prod-new.s3.amazonaws.com/${detectedAccountId}/template_${templateCode}.jpg`;

        row.innerHTML = `
            <td>
                <div style="position: relative; display: inline-block;">
                    <a href="#" class="image-tooltip" onclick="event.preventDefault(); window.open('https://my.sailthru.com/email-composer/${item._id}', '_blank');">
                        <img src="${previewUrl}"
                             class="template-preview"
                             onerror="this.style.display='none'; this.parentElement.parentElement.querySelector('.no-preview').style.display='inline';"
                             style="opacity: 1;" />
                        <span class="hover-preview">
                            <img src="${previewUrl}" style="max-width: ${imageConfig.hoverSize.width}px; height: auto; border-radius: 4px;" />
                        </span>
                    </a>
                    <span class="no-preview" style="display: none; color: #999; font-size: 12px;">No preview</span>
                </div>
            </td>
            <td><b><a href="https://my.sailthru.com/email-composer/${item._id}" target="_blank">${item.name}</a></b></td>
            <td>
              <a href="#" class="tooltip">Hover for details
               <span>
                 <div><b>SL:</b> ${item.subject || 'N/A'}</div>
                 <div><b>PH:</b> ${item.preheader || 'N/A'}</div>
                 <div><b>From:</b> ${item.from_name || 'N/A'} - ${item.from_email || 'N/A'}</div>
                 <div><b>Reply to:</b> ${item.replyto_email || 'N/A'}</div>
               </span>
             </a>
            </td>
            <td>${moment(item.modify_time).format('MMMM Do YYYY, h:mm:ss a')}</td>
            <td>${item.modify_user || "No Changes"}</td>
            <td>${moment(item.create_time.sec * 1000).format('MMMM Do YYYY, h:mm:ss a')}</td>
            <td>${item.create_user || "null (Copy/API)"}</td>
            <td>${item.labels_string && item.labels_string.length > 0 ? labelsHTML : ''}</td>
            <td><div class="usageFlag" data-template-id="${item._id}">Click "Load Template Usage" button</div></td>
        `;
        tbody.appendChild(row);

        // Only apply sequential loading animation on the first page load of the modal
        if (!document.body.hasAttribute('data-modal-loaded-once')) {
            // Load images sequentially from top to bottom with small delay
            setTimeout(() => {
                const img = row.querySelector('.template-preview');
                if (img && img.style.display !== 'none') {
                    img.style.opacity = '0';
                    img.style.transition = 'opacity 0.3s ease';

                    img.onload = function() {
                        this.style.opacity = '1';
                    };

                    // Force reload to trigger onload event
                    const src = img.src;
                    img.src = '';
                    img.src = src;
                }
            }, index * 50); // 50ms delay between each image
        }
    });

    // Mark that the modal has been loaded at least once
    if (!document.body.hasAttribute('data-modal-loaded-once')) {
        document.body.setAttribute('data-modal-loaded-once', 'true');
    }

    // Style the table
    const resultsTable = document.getElementById('resultsTable');
    if (resultsTable) {
        resultsTable.style.width = '100%';
        resultsTable.style.borderCollapse = 'collapse';

        const ths = resultsTable.querySelectorAll('th');
        ths.forEach(th => {
            th.style.color = 'black';
            th.style.padding = '14px';
            th.style.textAlign = 'left';
        });

        const tds = resultsTable.querySelectorAll('td');
        tds.forEach(td => {
            td.style.padding = '14px';
        });
    }
}

function loadTemplateUsageForCurrentPage() {
    if (usageLoadingInProgress) {
        console.log('Usage loading already in progress, skipping...');
        return;
    }

    const loadButton = document.getElementById('loadUsageButton');
    if (!loadButton) {
        console.error('Load usage button not found');
        return;
    }

    const originalText = loadButton.textContent;
    console.log('Starting template usage loading...');

    loadButton.textContent = 'Loading...';
    loadButton.disabled = true;
    loadButton.style.backgroundColor = '#6c757d';
    usageLoadingInProgress = true;

    const usageFlags = document.querySelectorAll('.usageFlag[data-template-id]');
    // console.log(`Found ${usageFlags.length} usage flags to update`);

    let completed = 0;
    const total = usageFlags.length;

    if (total === 0) {
        console.log('No usage flags found, resetting button');
        loadButton.textContent = originalText;
        loadButton.disabled = false;
        loadButton.style.backgroundColor = '#28a745';
        usageLoadingInProgress = false;
        return;
    }

    // Use the working approach from your legacy script
    usageFlags.forEach((flagDiv, index) => {
        const templateId = flagDiv.getAttribute('data-template-id');
        // console.log(`Processing template ${index + 1}/${total}: ${templateId}`);

        const usageURL = `https://my.sailthru.com/uiapi/lifecycle/?template_id=${templateId}`;
        const hrefURL = `https://my.sailthru.com/email-composer/${templateId}/usage`;

        // Skip if already processed
        if (flagDiv.querySelector('.usageFlag')) {
            completed++;
            loadButton.textContent = `Loading... (${completed}/${total})`;
            if (completed === total) {
                loadButton.textContent = originalText;
                loadButton.disabled = false;
                loadButton.style.backgroundColor = '#28a745';
                usageLoadingInProgress = false;
            }
            return;
        }

        GM_xmlhttpRequest({
            method: "GET",
            url: usageURL,
            onload: function(response) {
                // console.log(`Received response for template ${templateId}`);
                try {
                    const data = JSON.parse(response.responseText);
                    // console.log(`Parsed data for ${templateId}:`, data);

                    const activeItems = data.filter(item => item.status === 'active');
                    const inactiveItems = data.filter(item => item.status === 'inactive');
                    const count = data.length;

                    const colors = {};
                    if(activeItems.length > 0) {
                        colors.background = '#e8253b';
                        colors.hover = '#BA1E2F';
                    } else if(activeItems.length == 0 && inactiveItems.length > 0) {
                        colors.background = '#FF8C00';
                        colors.hover = '#F5761A';
                    } else {
                        colors.background = '#34c132';
                        colors.hover = '#2C9A28';
                    }

                    const flagElement = document.createElement('a');
                    flagElement.href = hrefURL;
                    flagElement.target = '_blank';
                    flagElement.addEventListener('click', (event) => {
                        event.stopPropagation();
                    });
                    flagElement.textContent = `${activeItems.length}${inactiveItems.length ? '(' + inactiveItems.length + ')' : ''} LO${count == 1 ? '' : 's'}`;
                    flagElement.classList.add('usageFlag');
                    flagElement.style.backgroundColor = colors.background;
                    flagElement.style.color = 'white';
                    flagElement.style.borderRadius = '10px';
                    flagElement.style.padding = '5px 10px';
                    flagElement.style.textDecoration = 'none';
                    flagElement.style.display = 'inline-block';

                    flagElement.onmouseover = () => flagElement.style.backgroundColor = colors.hover;
                    flagElement.onmouseout = () => flagElement.style.backgroundColor = colors.background;

                    // Clear and update the flag div
                    flagDiv.innerHTML = '';
                    flagDiv.appendChild(flagElement);

                } catch (error) {
                    // console.error(`Error parsing response for template ${templateId}:`, error);
                    flagDiv.innerHTML = 'Error loading';
                }

                completed++;
                // console.log(`Completed ${completed}/${total} template usage lookups`);
                loadButton.textContent = `Loading... (${completed}/${total})`;

                if (completed === total) {
                    console.log('All template usage data loaded, resetting button');
                    loadButton.textContent = originalText;
                    loadButton.disabled = false;
                    loadButton.style.backgroundColor = '#28a745';
                    usageLoadingInProgress = false;
                }
            },
            onerror: function(error) {
                // console.error(`Error fetching usage data for template ${templateId}:`, error);
                flagDiv.innerHTML = 'Error loading';

                completed++;
                loadButton.textContent = `Loading... (${completed}/${total})`;

                if (completed === total) {
                    console.log('All template usage processing complete (with errors), resetting button');
                    loadButton.textContent = originalText;
                    loadButton.disabled = false;
                    loadButton.style.backgroundColor = '#28a745';
                    usageLoadingInProgress = false;
                }
            }
        });
    });
}

function closeModal() {
    const modal = document.getElementById('searchModal');
    if (modal) {
        modal.style.display = 'none';
    }

    // Reset the table header row with null check
    const tableHead = document.querySelector('.src__TableHead-sc-1epr26z-1');
    if (tableHead) {
        tableHead.style.display = 'table-header-group';
    }

    // Reset the modal loaded flag so animation runs again next time
    document.body.removeAttribute('data-modal-loaded-once');

    // Reset current page
    currentPage = 1;
}

function generateLabelHTML(labels_string) {
    if (!labels_string) return '';

    const labelsArray = labels_string.split(',').map(label => label.trim()).filter(label => label);

    function stringToColor(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        let color = '#';
        for (let i = 0; i < 3; i++) {
            let value = (hash >> (i * 8)) & 0xFF;
            color += ('00' + value.toString(16)).substr(-2);
        }
        return color;
    }

    return labelsArray.map(label =>
        `<span class="customLabel" style="background-color: ${stringToColor(label)};">${label}</span>`
    ).join('');
}

function fuzzyFilter(query, list) {
    const searchField = document.getElementById('searchField').value;
    return list.filter(item => {
        if (!item.hasOwnProperty(searchField)) {
            return false;
        }
        const value = item[searchField] ? item[searchField].toString() : '';
        let regex;

        if (searchField == 'subject' || searchField == 'preheader') {
            regex = new RegExp(query.split(' ').join('.*'), 'i');
        } else if (searchField == 'modify_user' || searchField == 'create_user') {
            regex = new RegExp(query.split('@').join('.*'), 'i');
        } else {
            regex = new RegExp(query.split('').join('.*'), 'i');
        }

        return value.match(regex);
    });
}

function initializeAdvancedSearch() {
    createSearchButton();
    createModal();
}

// Updated mutation observer with flexible detection
function waitForTemplateInterface() {
    const observer = new MutationObserver((mutations, observer) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                const indicators = [
                    'div[id^="tabs-"]',
                    'button[style*="Check Template Usage"]',
                    '.ais-InstantSearch__root',
                    'div[role="tablist"]'
                ];

                for (const indicator of indicators) {
                    if (document.querySelector(indicator)) {
                        setTimeout(() => {
                            initializeAdvancedSearch();
                            observer.disconnect();
                        }, 100);
                        return;
                    }
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Also try immediately
    const immediateCheck = [
        'div[id^="tabs-"]',
        'button[style*="Check Template Usage"]',
        '.ais-InstantSearch__root'
    ];

    for (const selector of immediateCheck) {
        if (document.querySelector(selector)) {
            setTimeout(() => {
                initializeAdvancedSearch();
            }, 100);
            break;
        }
    }
}

// Initialize
waitForTemplateInterface();
