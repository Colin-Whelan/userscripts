// ==UserScript==
// @name        Event Tester - Many to Many with Retry
// @namespace   Violentmonkey Scripts
// @match       https://app.segment.com/*/destinations/*/sources/*/instances/*/event-tester*
// @grant       none
// @version     2.0
// @author      Colin Whelan
// @description Many-to-many event testing with retry logic. Upload multiple JSON templates and send to multiple emails with automatic retry on failures.
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const DELAY_BETWEEN_REQUESTS = 150; // ms
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [2000, 4000, 8000]; // ms - increasing delays

    const css = `
    #manyToManyModal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: none;
        overflow-y: auto;
    }

    #modalContent {
        position: relative;
        background: #ffffff;
        margin: 20px auto;
        max-width: 900px;
        border-radius: 12px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        overflow: hidden;
    }

    #modalHeader {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 24px;
        position: relative;
    }

    #modalTitle {
        font-size: 24px;
        font-weight: 600;
        margin: 0;
    }

    #closeButton {
        position: absolute;
        top: 24px;
        right: 24px;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    }

    #closeButton:hover {
        background: rgba(255, 255, 255, 0.3);
    }

    #modalBody {
        padding: 32px;
    }

    .input-section {
        margin-bottom: 32px;
    }

    .input-section h3 {
        color: #374151;
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
    }

    .input-section h3::before {
        content: '';
        width: 4px;
        height: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 2px;
        margin-right: 12px;
    }

    #fileInput {
        width: 100%;
        padding: 16px;
        border: 2px dashed #d1d5db;
        border-radius: 8px;
        background: #f9fafb;
        cursor: pointer;
        transition: all 0.2s;
        text-align: center;
        color: #6b7280;
    }

    #fileInput:hover {
        border-color: #667eea;
        background: #f0f4ff;
    }

    #emailTextarea {
        width: 100%;
        min-height: 120px;
        padding: 16px;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        resize: vertical;
        transition: border-color 0.2s;
    }

    #emailTextarea:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    #sendAllButton {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        border: none;
        padding: 16px 32px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        width: 100%;
        margin-top: 16px;
    }

    #sendAllButton:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    }

    #sendAllButton:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
    }

    #resultsSection {
        display: none;
        margin-top: 32px;
    }

    .results-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
    }

    .results-stats {
        display: flex;
        gap: 16px;
    }

    .stat-item {
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
    }

    .stat-success {
        background: #d1fae5;
        color: #065f46;
    }

    .stat-error {
        background: #fee2e2;
        color: #991b1b;
    }

    .stat-pending {
        background: #fef3c7;
        color: #92400e;
    }

    #warningBanner {
        background: #fef3c7;
        border: 1px solid #f59e0b;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 24px;
        color: #92400e;
        font-weight: 500;
        display: none;
    }

    .result-group {
        margin-bottom: 16px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
    }

    .result-group.error {
        border-color: #fca5a5;
    }

    .result-group.success {
        border-color: #86efac;
    }

    .result-header {
        padding: 16px;
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: background 0.2s;
    }

    .result-header:hover {
        background: #f3f4f6;
    }

    .result-title {
        font-weight: 600;
        color: #374151;
    }

    .result-status {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
    }

    .status-badge {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
    }

    .status-success {
        background: #d1fae5;
        color: #065f46;
    }

    .status-error {
        background: #fee2e2;
        color: #991b1b;
    }

    .status-retrying {
        background: #fef3c7;
        color: #92400e;
    }

    .retry-info {
        font-size: 12px;
        color: #6b7280;
        margin-left: 8px;
    }

    .result-details {
        display: none;
        padding: 16px;
        background: white;
    }

    .result-details.expanded {
        display: block;
    }

    .result-item {
        padding: 12px;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        margin-bottom: 8px;
    }

    .result-item:last-child {
        margin-bottom: 0;
    }

    .result-item.success {
        border-color: #86efac;
        background: #f0fdf4;
    }

    .result-item.error {
        border-color: #fca5a5;
        background: #fef2f2;
    }

    .result-item-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }

    .result-email {
        font-weight: 500;
        color: #374151;
    }

    .retry-button {
        background: #667eea;
        color: white;
        border: none;
        padding: 4px 12px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        transition: background 0.2s;
    }

    .retry-button:hover {
        background: #5a67d8;
    }

    .retry-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .response-preview {
        font-family: monospace;
        font-size: 12px;
        background: #f9fafb;
        padding: 8px;
        border-radius: 4px;
        color: #6b7280;
        max-height: 200px;
        overflow-y: auto;
    }

    .expand-arrow {
        transition: transform 0.2s;
    }

    .expand-arrow.expanded {
        transform: rotate(180deg);
    }

    #manyToManyButton {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        margin-top: 2em;
    }

    #manyToManyButton:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
    }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = css;
    document.head.appendChild(styleSheet);

    let processingQueue = [];
    let currentStats = { success: 0, error: 0, pending: 0 };

    function createModal() {
        const modal = document.createElement('div');
        modal.id = 'manyToManyModal';

        modal.innerHTML = `
            <div id="modalContent">
                <div id="modalHeader">
                    <h2 id="modalTitle">Many-to-Many Event Testing</h2>
                    <button id="closeButton">×</button>
                </div>
                <div id="modalBody">
                    <div id="warningBanner">
                        ⚠️ Processing events - please don't leave this page until complete!
                    </div>

                    <div id="inputSection">
                        <div class="input-section">
                            <h3>📁 JSON Template Files</h3>
                            <input type="file" id="fileInput" multiple accept=".json" style="display: none;">
                            <div id="fileInputDisplay">
                                <p>Click to select JSON template files (with {{EMAIL}} placeholders)</p>
                                <small>Multiple files supported • .json format</small>
                            </div>
                        </div>

                        <div class="input-section">
                            <h3>📧 Email Recipients</h3>
                            <textarea id="emailTextarea" placeholder="Enter email addresses (one per line or comma separated):&#10;user1@example.com&#10;user2@example.com&#10;user3@example.com"></textarea>
                        </div>

                        <button id="sendAllButton">🚀 Send All Events</button>

                        <div id="requestPreview" style="display: none; margin-top: 16px; padding: 16px; background: #f0f4ff; border: 1px solid #c7d2fe; border-radius: 8px;">
                            <div style="font-weight: 600; color: #3730a3; margin-bottom: 8px;">📊 Request Summary</div>
                            <div id="requestMath" style="color: #4338ca;"></div>
                        </div>
                    </div>

                    <div id="resultsSection">
                        <div class="results-header">
                            <h3>📊 Results</h3>
                            <div class="results-stats">
                                <div class="stat-item stat-success">
                                    ✅ <span id="successCount">0</span> Success
                                </div>
                                <div class="stat-item stat-error">
                                    ❌ <span id="errorCount">0</span> Errors
                                </div>
                                <div class="stat-item stat-pending">
                                    ⏳ <span id="pendingCount">0</span> Pending
                                </div>
                            </div>
                        </div>
                        <div id="resultsContainer"></div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        document.getElementById('closeButton').onclick = () => {
            if (currentStats.pending > 0 || currentStats.error > 0) {
                if (!confirm('There are still pending requests or errors. Are you sure you want to close?')) {
                    return;
                }
            }
            resetModal();
            modal.style.display = 'none';
        };

        const fileInput = document.getElementById('fileInput');
        const fileInputDisplay = document.getElementById('fileInputDisplay');

        fileInputDisplay.onclick = () => fileInput.click();

        fileInput.onchange = handleFileSelection;
        document.getElementById('emailTextarea').oninput = updateRequestPreview;
        document.getElementById('sendAllButton').onclick = handleSendAll;

        modal.onclick = (e) => {
            if (e.target === modal) {
                if (currentStats.pending > 0 || currentStats.error > 0) {
                    if (!confirm('There are still pending requests or errors. Are you sure you want to close?')) {
                        return;
                    }
                }
                resetModal();
                modal.style.display = 'none';
            }
        };

        return modal;
    }

    function handleFileSelection(event) {
        const files = Array.from(event.target.files);
        const display = document.getElementById('fileInputDisplay');

        if (files.length > 0) {
            display.innerHTML = `
                <p>📁 ${files.length} file${files.length > 1 ? 's' : ''} selected</p>
                <small>${files.map(f => f.name).join(', ')}</small>
            `;
            updateRequestPreview();
        } else {
            display.innerHTML = `
                <p>Click to select JSON template files (with {{EMAIL}} placeholders)</p>
                <small>Multiple files supported • .json format</small>
            `;
            document.getElementById('requestPreview').style.display = 'none';
        }
    }

    function updateRequestPreview() {
        const fileInput = document.getElementById('fileInput');
        const emailTextarea = document.getElementById('emailTextarea');
        const files = Array.from(fileInput.files);
        const emailText = emailTextarea.value.trim();

        if (files.length > 0 && emailText) {
            const emails = emailText
                .split(/[,\n]/)
                .map(email => email.trim())
                .filter(email => email && email.includes('@'));

            if (emails.length > 0) {
                const segmentResponseTime = 500;
                const totalRequests = files.length * emails.length;
                const estimatedTimeMs = totalRequests * (DELAY_BETWEEN_REQUESTS + segmentResponseTime);
                const estimatedTimeSec = Math.ceil(estimatedTimeMs / 1000);
                const estimatedTimeMin = Math.ceil(estimatedTimeSec / 60);

                const timeDisplay = estimatedTimeMin > 1 ?
                    `~${estimatedTimeMin} minute${estimatedTimeMin > 1 ? 's' : ''}` :
                    `~${estimatedTimeSec} second${estimatedTimeSec > 1 ? 's' : ''}`;

                document.getElementById('requestMath').innerHTML = `
                    <strong>${files.length} template${files.length > 1 ? 's' : ''} × ${emails.length} email${emails.length > 1 ? 's' : ''} = ${totalRequests} total requests</strong><br>
                    <span style="font-size: 14px;">Estimated processing time: ${timeDisplay} = (${DELAY_BETWEEN_REQUESTS}ms delay between requests, and ${segmentResponseTime}ms delay from Segment) per request</span>
                `;
                document.getElementById('requestPreview').style.display = 'block';
                return;
            }
        }

        document.getElementById('requestPreview').style.display = 'none';
    }

    function resetModal() {
        // Reset all inputs and displays
        document.getElementById('fileInput').value = '';
        document.getElementById('emailTextarea').value = '';
        document.getElementById('fileInputDisplay').innerHTML = `
            <p>Click to select JSON template files (with {{EMAIL}} placeholders)</p>
            <small>Multiple files supported • .json format</small>
        `;
        document.getElementById('requestPreview').style.display = 'none';
        document.getElementById('sendAllButton').disabled = false;

        // Reset sections
        document.getElementById('inputSection').style.display = 'block';
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('warningBanner').style.display = 'none';
        document.getElementById('modalTitle').textContent = 'Many-to-Many Event Testing';

        // Clear results
        document.getElementById('resultsContainer').innerHTML = '';

        // Reset stats
        currentStats = { success: 0, error: 0, pending: 0 };
        processingQueue = [];
        updateStats();
    }

    async function handleSendAll() {
        const fileInput = document.getElementById('fileInput');
        const emailTextarea = document.getElementById('emailTextarea');
        const sendButton = document.getElementById('sendAllButton');

        const files = Array.from(fileInput.files);
        const emailText = emailTextarea.value.trim();

        if (files.length === 0) {
            alert('Please select at least one JSON template file.');
            return;
        }

        if (!emailText) {
            alert('Please enter at least one email address.');
            return;
        }

        // Parse emails
        const emails = emailText
            .split(/[,\n]/)
            .map(email => email.trim())
            .filter(email => email && email.includes('@'));

        if (emails.length === 0) {
            alert('Please enter valid email addresses.');
            return;
        }

        // Read and validate files
        const templates = [];
        try {
            for (const file of files) {
                const content = await readFile(file);
                const template = JSON.parse(content);
                templates.push({ name: file.name, content, template });
            }
        } catch (error) {
            alert('Error reading or parsing JSON files: ' + error.message);
            return;
        }

        // Generate all combinations
        processingQueue = [];
        for (const template of templates) {
            for (const email of emails) {
                processingQueue.push({
                    templateName: template.name,
                    email,
                    template: template.content,
                    attempts: 0,
                    status: 'pending'
                });
            }
        }

        // Update UI
        sendButton.disabled = true;
        document.getElementById('inputSection').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'block';
        document.getElementById('warningBanner').style.display = 'block';
        document.getElementById('modalTitle').textContent = 'Processing Events...';

        currentStats = { success: 0, error: 0, pending: processingQueue.length };
        updateStats();
        createResultGroups();

        // Start processing
        processQueue();
    }

    function readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    function createResultGroups() {
        const container = document.getElementById('resultsContainer');
        container.innerHTML = '';

        // Group by template
        const groups = {};
        processingQueue.forEach(item => {
            if (!groups[item.templateName]) {
                groups[item.templateName] = [];
            }
            groups[item.templateName].push(item);
        });

        Object.entries(groups).forEach(([templateName, items]) => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'result-group';
            groupDiv.id = `group-${templateName}`;

            const header = document.createElement('div');
            header.className = 'result-header';
            header.onclick = () => toggleGroup(templateName);

            const title = document.createElement('div');
            title.className = 'result-title';
            title.textContent = templateName;

            const status = document.createElement('div');
            status.className = 'result-status';
            status.innerHTML = `
                <span class="expand-arrow">▼</span>
                <span class="status-badge status-pending" id="badge-${templateName}">⏳ ${items.length} Pending</span>
            `;

            header.appendChild(title);
            header.appendChild(status);

            const details = document.createElement('div');
            details.className = 'result-details';
            details.id = `details-${templateName}`;

            items.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'result-item';
                itemDiv.id = `item-${templateName}-${item.email}`;
                itemDiv.innerHTML = `
                    <div class="result-item-header">
                        <span class="result-email">${item.email}</span>
                        <button class="retry-button" onclick="retryItem('${templateName}', '${item.email}')" style="display: none;">Retry</button>
                    </div>
                    <div class="response-preview" id="response-${templateName}-${item.email}">Pending...</div>
                `;
                details.appendChild(itemDiv);
            });

            groupDiv.appendChild(header);
            groupDiv.appendChild(details);
            container.appendChild(groupDiv);
        });
    }

    function toggleGroup(templateName) {
        const details = document.getElementById(`details-${templateName}`);
        const arrow = document.querySelector(`#group-${templateName} .expand-arrow`);

        if (details.classList.contains('expanded')) {
            details.classList.remove('expanded');
            arrow.classList.remove('expanded');
        } else {
            details.classList.add('expanded');
            arrow.classList.add('expanded');
        }
    }

    async function processQueue() {
        for (let i = 0; i < processingQueue.length; i++) {
            const item = processingQueue[i];
            await processItem(item, i * DELAY_BETWEEN_REQUESTS);
        }
    }

    async function processItem(item, delay) {
        if (delay > 0) {
            await sleep(delay);
        }

        const personalizedJson = item.template.replace(/\{\{EMAIL\}\}/g, item.email);
        let jsonData;

        try {
            jsonData = JSON.parse(personalizedJson);
        } catch (error) {
            updateItemResult(item, {
                statusCode: 'JSON Parse Error',
                error: error.message
            }, false);
            return;
        }

        await sendEventWithRetry(item, jsonData);
    }

    async function sendEventWithRetry(item, jsonData) {
        item.attempts++;

        updateItemStatus(item, 'retrying');

        try {
            const response = await sendEventData(jsonData);
            updateItemResult(item, response, true);
        } catch (error) {
            const shouldRetry = item.attempts < MAX_RETRIES && isRetryableError(error);

            if (shouldRetry) {
                const retryDelay = RETRY_DELAYS[item.attempts - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
                updateItemStatus(item, 'retrying', `Attempt ${item.attempts}/${MAX_RETRIES}, retrying in ${retryDelay/1000}s...`);

                setTimeout(() => {
                    sendEventWithRetry(item, jsonData);
                }, retryDelay);
            } else {
                updateItemResult(item, error, false);
            }
        }
    }

    function isRetryableError(error) {
        if (error.data && error.data.errors) {
            return error.data.errors.some(err =>
                err.message && err.message.includes('429') ||
                err.message && err.message.includes('Too Many Requests')
            );
        }
        return false;
    }

    function updateItemStatus(item, status, message = '') {
        item.status = status;
        const responseDiv = document.getElementById(`response-${item.templateName}-${item.email}`);
        if (responseDiv) {
            if (status === 'retrying') {
                responseDiv.textContent = `🔄 Retrying... ${message}`;
            } else {
                responseDiv.textContent = 'Processing...';
            }
        }
    }

    function updateItemResult(item, response, success) {
        item.status = success ? 'success' : 'error';
        item.response = response;

        const itemDiv = document.getElementById(`item-${item.templateName}-${item.email}`);
        const responseDiv = document.getElementById(`response-${item.templateName}-${item.email}`);
        const retryButton = itemDiv.querySelector('.retry-button');

        itemDiv.className = `result-item ${success ? 'success' : 'error'}`;

        let statusText = success ?
            `✅ Success (${response.statusCode}) - ${item.attempts} attempt${item.attempts > 1 ? 's' : ''}` :
            `❌ Error - ${item.attempts} attempt${item.attempts > 1 ? 's' : ''}`;

        responseDiv.innerHTML = `
            <div style="margin-bottom: 8px; font-weight: 500;">${statusText}</div>
            <pre style="margin: 0; white-space: pre-wrap;">${JSON.stringify(response, null, 2)}</pre>
        `;

        if (!success) {
            retryButton.style.display = 'inline-block';
        }

        // Update stats
        currentStats.pending--;
        if (success) {
            currentStats.success++;
        } else {
            currentStats.error++;
        }
        updateStats();
        updateGroupStatus(item.templateName);

        // Check if all done
        if (currentStats.pending === 0) {
            document.getElementById('warningBanner').style.display = 'none';
            document.getElementById('modalTitle').textContent = 'Results Complete';
        }
    }

    function updateGroupStatus(templateName) {
        const groupItems = processingQueue.filter(item => item.templateName === templateName);
        const successCount = groupItems.filter(item => item.status === 'success').length;
        const errorCount = groupItems.filter(item => item.status === 'error').length;
        const pendingCount = groupItems.filter(item => item.status === 'pending' || item.status === 'retrying').length;

        const badge = document.getElementById(`badge-${templateName}`);
        const group = document.getElementById(`group-${templateName}`);

        if (pendingCount > 0) {
            badge.className = 'status-badge status-retrying';
            badge.textContent = `⏳ ${pendingCount} Pending`;
            group.className = 'result-group';
        } else if (errorCount > 0) {
            badge.className = 'status-badge status-error';
            badge.textContent = `❌ ${errorCount} Error${errorCount > 1 ? 's' : ''}, ✅ ${successCount} Success${successCount > 1 ? 'es' : ''}`;
            group.className = 'result-group error';
        } else {
            badge.className = 'status-badge status-success';
            badge.textContent = `✅ ${successCount} Success${successCount > 1 ? 'es' : ''}`;
            group.className = 'result-group success';
        }
    }

    function updateStats() {
        document.getElementById('successCount').textContent = currentStats.success;
        document.getElementById('errorCount').textContent = currentStats.error;
        document.getElementById('pendingCount').textContent = currentStats.pending;
    }

    // Make retryItem globally accessible
    window.retryItem = async function(templateName, email) {
        const item = processingQueue.find(i => i.templateName === templateName && i.email === email);
        if (item) {
            item.attempts = 0; // Reset attempts for manual retry
            const personalizedJson = item.template.replace(/\{\{EMAIL\}\}/g, item.email);
            try {
                const jsonData = JSON.parse(personalizedJson);
                currentStats.error--;
                currentStats.pending++;
                updateStats();
                await sendEventWithRetry(item, jsonData);
            } catch (error) {
                updateItemResult(item, {
                    statusCode: 'JSON Parse Error',
                    error: error.message
                }, false);
            }
        }
    };

    function extractUrlParameters() {
        const urlSegments = window.location.pathname.split('/');
        return {
            workspaceSlug: urlSegments[1],
            integrationSlug: urlSegments[3],
            sourceSlug: urlSegments[5],
            integrationConfigId: urlSegments[7]
        };
    }

    async function sendEventData(jsonData) {
        const { workspaceSlug, integrationSlug, sourceSlug, integrationConfigId } = extractUrlParameters();
        const url = 'https://app.segment.com/gateway-api/graphql?operation=sendEventToIntegration';

        const payload = {
            "operationName": "sendEventToIntegration",
            "variables": {
                "input": {
                    workspaceSlug,
                    integrationSlug,
                    sourceSlug,
                    "eventPayload": JSON.stringify(jsonData),
                    integrationConfigId
                }
            },
            "query": "mutation sendEventToIntegration($input: SendEventToIntegrationInput!) {\n  sendEventToIntegration(input: $input) {\n    eventResponses {\n      request\n      response\n      __typename\n    }\n    eventError {\n      code\n      message\n      __typename\n    }\n    __typename\n  }\n}\n"
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-requested-with': 'fetch',
                'x-timezone': 'America/Toronto'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data && data.data && data.data.sendEventToIntegration && data.data.sendEventToIntegration.eventResponses) {
            return data.data.sendEventToIntegration.eventResponses[0].response;
        } else {
            throw {
                statusCode: "API Error",
                error: "Unexpected response structure",
                data: data
            };
        }
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function addManyToManyButton(target) {
        if (document.getElementById('manyToManyButton')) return;

        const button = document.createElement('button');
        button.id = 'manyToManyButton';
        button.textContent = '🚀 Many-to-Many Testing';
        button.onclick = () => {
            resetModal(); // Reset modal state when opening
            document.getElementById('manyToManyModal').style.display = 'block';
        };

        target.appendChild(button);
    }

    // Create modal on load
    const modal = createModal();

    // Check for target element and add button
    const checkInterval = setInterval(() => {
        const target = document.querySelector('div.css-t7pc0c');
        if (target && !document.getElementById('manyToManyButton')) {
            clearInterval(checkInterval);
            addManyToManyButton(target);
        }
    }, 100);
})();
