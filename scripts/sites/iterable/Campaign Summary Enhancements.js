// ==UserScript==
// @name         Campaign Preview Enhancements
// @namespace    http://tampermonkey.net/
// @version      1.3
// @author       Colin Whelan
// @match        https://app.iterable.com/campaigns/*
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @description  Preview & prepare schedule times before launching, improved page layout with tighter spacing, and streamlined workflow for campaign scheduling
// ==/UserScript==

(function() {
    'use strict';

    // Debug flag - set to true to enable console logging
    const _DEBUG = false;

    let scheduledDateTime = null;
    let schedulePreviewUI = null;
    let customSettingsAdded = false;

    // Global variable to track the relative time update interval
    let relativeTimeInterval = null;

    // Configuration with defaults
    let config = {
        seedListCheck: false,
        seedListKeyword: "Seed", // Customizable seed list keyword
        suppressListCheck: false,
        campaignRules: [
            {
                keywords: ["mother", "mom"],
                requiredSuppressionLists: ["Mothers Days"],
                isGlobal: false
            },
            {
                keywords: ["father", "dad"],
                requiredSuppressionLists: ["Fathers Days"],
                isGlobal: false
            },
            {
                keywords: ["survey", "research"],
                requiredSuppressionLists: ["explicitOptOut_Surveys"],
                isGlobal: false
            },
            {
                keywords: [],
                requiredSuppressionLists: ["Daily Exclusions"],
                isGlobal: true
            }
        ],
        customRateLimit: 4000
    };


    let customRateLimit = GM_getValue(config.customRateLimit, 4000);




    // Load configuration
    function loadConfig() {
        try {
            const savedConfig = GM_getValue('campaignConfig', JSON.stringify(config));
            const loadedConfig = JSON.parse(savedConfig);

            // Ensure seedListKeyword exists in loaded config
            if (!loadedConfig.seedListKeyword) {
                loadedConfig.seedListKeyword = "Seed";
            }

            config = loadedConfig;
            log('Configuration loaded', config);
        } catch (e) {
            log('Error loading config, using defaults', e);
            // Ensure seedListKeyword is set
            config.seedListKeyword = config.seedListKeyword || "Seed";
        }
    }

    // Save configuration
    function saveConfig() {
        try {
            GM_setValue('campaignConfig', JSON.stringify(config));
            log('Configuration saved', config);
        } catch (e) {
            log('Error saving config', e);
        }
    }

    // Logging helper
    function log(message, data = null) {
        if (!_DEBUG) return;
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[Iterable Schedule Preview ${timestamp}] ${message}`, data || '');
    }

    // Add CSS overrides to improve page layout
    function addCSSOverrides() {
        log('Adding CSS overrides for better page layout');

        const style = document.createElement('style');
        style.type = 'text/css';
        style.id = 'iterable-schedule-preview-css';

        const css = `
            /* Reduce spacing between form fields */
            .kJkNtP {
            margin-bottom: 1rem !important;
            }
.eMLerN {
  margin-bottom: 0.1rem !important;
}
.bfQKvs {
  margin-bottom: 0.1rem !important;
}

.cmAsxg {
  font-size: 0.9rem;
  line-height: 1rem;
  margin: 1rem 0px 1rem;
}

[data-test="form-field"] {
  font-size: 0.9rem;
  line-height: 1rem;
  margin-top: 0.1rem !important;
}

            .sc-Nxspf + .sc-Nxspf {
                margin-top: 0.3rem !important;
            }

            /* Adjust section headers */
            .dlLwSQ {
                font-size: 0.8rem !important;
                margin: 1rem 0px 0.3rem !important;
            }

            /* Reduce bottom margin on containers */
            .cRjXNc {
                margin-bottom: 0.3rem !important;
            }

            /* Settings modal styles */
            .config-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .config-modal-content {
                background: white;
                border-radius: 8px;
                padding: 24px;
                max-width: 600px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            }

            .config-section {
                margin-bottom: 24px;
                padding-bottom: 20px;
                border-bottom: 1px solid #e0e0e0;
            }

            .config-section:last-child {
                border-bottom: none;
            }

            .config-toggle {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 16px;
            }

            .config-rule {
                background: #f5f5f5;
                padding: 12px;
                border-radius: 4px;
                margin-bottom: 8px;
            }

            .rules-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 12px;
            }

            .rules-table th {
                background: #f5f5f5;
                padding: 8px;
                text-align: left;
                border: 1px solid #ddd;
                font-weight: 600;
                color: #333;
            }

            .rules-table td {
                padding: 8px;
                border: 1px solid #ddd;
                vertical-align: middle;
            }

            .rules-table input[type="text"] {
                width: 100%;
                padding: 4px;
                border: 1px solid #ccc;
                border-radius: 2px;
            }

            .rules-table input[type="text"]:disabled {
                background: #f5f5f5;
                color: #999;
            }

            .icon-button {
                background: none;
                border: none;
                cursor: pointer;
                padding: 4px;
                border-radius: 2px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }

            .icon-button:hover {
                background: #f0f0f0;
            }

            .icon-button.add {
                color: #4CAF50;
            }

            .icon-button.remove {
                color: #f44336;
            }

            .validation-warning {
                display: inline-flex;
                align-items: center;
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                color: #856404;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                gap: 6px;
            }

            .validation-success {
                display: inline-flex;
                align-items: center;
                background: #d4edda;
                border: 1px solid #c3e6cb;
                color: #155724;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                gap: 6px;
            }


            /* Custom Send Rate */
            .custom-rate-settings {
            border-top: 1px solid #e5e5e5;
            padding-top: 16px;
            margin-top: 16px;
        }
        .custom-rate-header {
            font-weight: 600;
            font-size: 14px;
            color: #1f1d1e;
            margin-bottom: 12px;
        }
        .custom-rate-field {
            margin-bottom: 16px;
        }
        .custom-rate-label {
            display: flex;
            align-items: center;
            font-size: 14px;
            color: #1f1d1e;
            margin-bottom: 8px;
        }
        .custom-toggle {
            width: 44px;
            height: 24px;
            background: #e5e5e5;
            border-radius: 12px;
            position: relative;
            cursor: pointer;
            margin-right: 12px;
            transition: background-color 0.2s;
        }
        .custom-toggle.enabled {
            background: #5A67D8;
        }
        .custom-toggle-handle {
            width: 20px;
            height: 20px;
            background: white;
            border-radius: 10px;
            position: absolute;
            top: 2px;
            left: 2px;
            transition: transform 0.2s;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .custom-toggle.enabled .custom-toggle-handle {
            transform: translateX(20px);
        }
        .custom-input-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .custom-input {
            border: 1px solid #d1d5db;
            border-radius: 6px;
            padding: 8px 12px;
            font-size: 14px;
            width: 120px;
        }
        .custom-rate-apply {
            margin-top: 15px;
        }
        .custom-input:disabled {
            background: #f9fafb;
            color: #6b7280;
        }
        .rate-math {
            font-size: 12px;
            color: #6b7280;
        }
        .description-text {
            font-size: 14px;
            color: #6b7280;
            margin-top: 4px;
        }
        .status-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 8px;
        }
        .status-active {
            background-color: #10b981;
        }
        .status-inactive {
            background-color: #ef4444;
        }
        .direct-api-badge {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            margin-left: 8px;
        }
        .apply-button {
            background: #5A67D8;
            color: white;
            border: none;
            border-radius: 6px;
            padding: 8px 16px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .apply-button:hover {
            background: #4c51bf;
        }
        .apply-button:disabled {
            background: #9ca3af;
            cursor: not-allowed;
        }
        .sc-bDumWk.jXzEMT {
  display: flex !important;
  flex: 1 1 auto!important;
  align-items: center!important; /* Optional: vertically center the items */
  gap: 8px!important; /* Optional: add some space between the divs */
}
.validation-success {
  flex-shrink: 0; /* Prevents the validation message from shrinking */
}

.sc-eyWdaR.kmwTOY {
width: 100% !important;
}

        `;

        style.innerHTML = css;

        // Check if styles already exist to avoid duplicates
        const existingStyle = document.getElementById('iterable-schedule-preview-css');
        if (existingStyle) {
            existingStyle.remove();
        }

        document.head.appendChild(style);
        log('CSS overrides applied successfully');
    }

    log('Userscript loaded and initialized');

    // Create settings modal
    function createSettingsModal() {
    const modal = document.createElement('div');
    modal.className = 'config-modal';
    modal.innerHTML = `
        <div class="config-modal-content">
            <h2 style="margin-top: 0; color: #333;">Campaign Enhancement Settings</h2>

            <div class="config-section">
                <h3 style="color: #555;">Seed List Check</h3>
                <div class="config-toggle">
                    <input type="checkbox" id="seedListCheck" ${config.seedListCheck ? 'checked' : ''}>
                    <label for="seedListCheck">Enable seed list validation</label>
                </div>
                <div style="margin-top: 12px;">
                    <label for="seedListKeyword" style="font-weight: 600;">Check for keyword in send list names:</label>
                    <input type="text" id="seedListKeyword" value="${config.seedListKeyword || 'Seed'}"
                           style="width: 200px; padding: 4px; margin-left: 8px; border: 1px solid #ccc; border-radius: 2px;">
                </div>
                <p style="color: #666; font-size: 12px; margin: 8px 0 0 0;">When enabled, warns if no send lists contain this keyword.</p>
            </div>

            <div class="config-section">
                <h3 style="color: #555;">Suppress List Check</h3>
                <div class="config-toggle">
                    <input type="checkbox" id="suppressListCheck" ${config.suppressListCheck ? 'checked' : ''}>
                    <label for="suppressListCheck">Enable suppression list validation</label>
                </div>
                <p style="color: #666; font-size: 12px; margin-bottom: 16px;">Validates required suppression lists based on campaign keywords.</p>

                <h4 style="color: #555; margin-bottom: 12px;">Campaign Rules:</h4>
                <table class="rules-table">
                    <thead>
                        <tr>
                            <th>Global</th>
                            <th>Keywords</th>
                            <th>Required Suppression Lists</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="rulesTableBody">
                        ${config.campaignRules.map((rule, index) => `
                            <tr data-index="${index}">
                                <td>
                                    <input type="checkbox" class="global-checkbox" ${rule.isGlobal ? 'checked' : ''}>
                                </td>
                                <td>
                                    <input type="text" class="keywords-input"
                                           value="${rule.isGlobal ? '' : rule.keywords.join(', ')}"
                                           ${rule.isGlobal ? 'disabled' : ''}
                                           placeholder="mother, mom">
                                </td>
                                <td>
                                    <input type="text" class="lists-input"
                                           value="${rule.requiredSuppressionLists.join(', ')}"
                                           placeholder="Mothers Days">
                                </td>
                                <td>
                                    <button class="icon-button remove" title="Remove Rule">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                        </svg>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <button class="icon-button add" id="addTableRule" style="margin-top: 12px; padding: 8px 12px; background: #4CAF50; color: white; border-radius: 4px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 4px;">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                    Add New Rule
                </button>
            </div>

            <div class="config-section">

                <h3 style="color: #555;">Custom Send Rate</h3>
                <div class="config-toggle">
                    <input type="number" id="customRateLimit" value="${config.customRateLimit ? config.customRateLimit : 2000}">
                    <label for="customRateLimit">Max number of sends <b>per minute</b></label>
                </div>
            </div>

            <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
                <button id="saveSettings" style="background: #2196F3; color: white; border: none; padding: 10px 16px; border-radius: 4px; cursor: pointer;">Save Settings</button>
                <button id="cancelSettings" style="background: #666; color: white; border: none; padding: 10px 16px; border-radius: 4px; cursor: pointer;">Cancel</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Function to apply global toggle behavior to a checkbox
    function applyGlobalToggle(checkbox) {
        const row = checkbox.closest('tr');
        const keywordsInput = row.querySelector('.keywords-input');

        function updateKeywordsField() {
            if (checkbox.checked) {
                keywordsInput.disabled = true;
                keywordsInput.value = '';
                keywordsInput.style.background = '#f5f5f5';
                keywordsInput.style.color = '#999';
            } else {
                keywordsInput.disabled = false;
                keywordsInput.style.background = 'white';
                keywordsInput.style.color = '#333';
            }
        }

        // Apply initial state
        updateKeywordsField();

        // Add change listener
        checkbox.addEventListener('change', updateKeywordsField);
    }

    // Function to add remove functionality to a button
    function applyRemoveButton(button) {
        button.addEventListener('click', () => {
            const row = button.closest('tr');
            if (row) {
                log('Removing table row');
                row.remove();
            }
        });
    }

    // Apply functionality to existing rows
    modal.querySelectorAll('.global-checkbox').forEach(applyGlobalToggle);
    modal.querySelectorAll('.remove').forEach(applyRemoveButton);

    // Add new rule functionality
    modal.querySelector('#addTableRule').addEventListener('click', () => {
        const tbody = modal.querySelector('#rulesTableBody');
        const newIndex = tbody.children.length;
        const newRow = document.createElement('tr');
        newRow.setAttribute('data-index', newIndex);
        newRow.innerHTML = `
            <td>
                <input type="checkbox" class="global-checkbox">
            </td>
            <td>
                <input type="text" class="keywords-input" placeholder="mother, mom">
            </td>
            <td>
                <input type="text" class="lists-input" placeholder="Mothers Days">
            </td>
            <td>
                <button class="icon-button remove" title="Remove Rule">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
            </td>
        `;
        tbody.appendChild(newRow);

        // Apply functionality to the new row
        const newCheckbox = newRow.querySelector('.global-checkbox');
        const newRemoveButton = newRow.querySelector('.remove');

        applyGlobalToggle(newCheckbox);
        applyRemoveButton(newRemoveButton);
    });

    // Save settings
    modal.querySelector('#saveSettings').addEventListener('click', () => {
        // Save settings
        config.seedListCheck = modal.querySelector('#seedListCheck').checked;
        config.seedListKeyword = modal.querySelector('#seedListKeyword').value.trim() || 'Seed';
        config.suppressListCheck = modal.querySelector('#suppressListCheck').checked;
        config.customRateLimit = modal.querySelector('#customRateLimit').value.trim() || 3000;

        // Update rules from table
        config.campaignRules = [];
        modal.querySelectorAll('#rulesTableBody tr').forEach(row => {
            const isGlobal = row.querySelector('.global-checkbox').checked;
            const keywordsValue = row.querySelector('.keywords-input').value.trim();
            const listsValue = row.querySelector('.lists-input').value.trim();

            const keywords = isGlobal ? [] : keywordsValue.split(',').map(k => k.trim()).filter(k => k);
            const lists = listsValue.split(',').map(l => l.trim()).filter(l => l);

            if ((isGlobal || keywords.length > 0) && lists.length > 0) {
                config.campaignRules.push({
                    keywords: keywords,
                    requiredSuppressionLists: lists,
                    isGlobal: isGlobal
                });
            }
        });

        saveConfig();
        modal.remove();
        log('Settings saved');

        // Re-run validations if on summary page
        if (isOnSummaryView()) {
            setTimeout(runValidations, 100);
        }
    });

    // Cancel settings
    modal.querySelector('#cancelSettings').addEventListener('click', () => {
        modal.remove();
    });

    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

    // Display warning/success message to the right of an element
    function displayValidationMessage(targetElement, message, isSuccess = false) {
        // Remove existing validation messages for this element
        const parent = targetElement.closest('[data-test="form-field"]');
        if (!parent) return;

        const existing = parent.querySelector('.validation-warning, .validation-success');
        if (existing) {
            existing.remove();
        }

        // If message is null/empty, just clear existing messages and return
        if (!message) return;

        const messageEl = document.createElement('div');
        messageEl.className = isSuccess ? 'validation-success' : 'validation-warning';
        messageEl.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                ${isSuccess ?
                    '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>' :
                    '<path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>'
                }
            </svg>
            ${message}
        `;

        targetElement.parentElement.appendChild(messageEl);
    }

    // Validate seed lists
    function validateSeedLists() {
        const sendListContainer = document.querySelector('[data-test="form-readonly-field-sendLists"]');
        if (!sendListContainer) return;

        // If setting is disabled, remove any existing warnings and return
        if (!config.seedListCheck) {
            displayValidationMessage(sendListContainer, null); // Clear existing messages
            return;
        }

        log('Running seed list validation');

        const sendListLinks = sendListContainer.querySelectorAll('a');
        const sendListNames = Array.from(sendListLinks).map(link => link.textContent.trim());

        log('Send lists found:', sendListNames);
        log('Checking for keyword:', config.seedListKeyword);

        const hasSeedList = sendListNames.some(name =>
            name.toLowerCase().includes(config.seedListKeyword.toLowerCase())
        );

        if (hasSeedList) {
            displayValidationMessage(sendListContainer, `"${config.seedListKeyword}" list detected`, true);
        } else {
            displayValidationMessage(sendListContainer, `Warning: No "${config.seedListKeyword}" list found in send lists`);
        }
    }

    // Validate suppression lists
    function validateSuppressionLists() {
        const suppressListContainer = document.querySelector('[data-test="form-readonly-field-suppressionLists"]');
        if (!suppressListContainer) return;

        // If setting is disabled, remove any existing warnings and return
        if (!config.suppressListCheck) {
            displayValidationMessage(suppressListContainer, null); // Clear existing messages
            return;
        }

        log('Running suppression list validation');

        // Get campaign name from page title or URL
        const campaignName = document.title || window.location.pathname;
        log('Campaign name:', campaignName);

        const suppressListLinks = suppressListContainer.querySelectorAll('a');
        const suppressionLists = Array.from(suppressListLinks).map(link => link.textContent.trim());

        log('Suppression lists found:', suppressionLists);

        let allMissingLists = new Set();
        let validationFailed = false;

        config.campaignRules.forEach(rule => {
            const shouldApplyRule = rule.isGlobal ||
                rule.keywords.some(keyword =>
                    campaignName && campaignName.toLowerCase().includes(keyword.toLowerCase())
                );

            if (shouldApplyRule) {
                const requiredLists = rule.requiredSuppressionLists;
                const missingLists = requiredLists.filter(requiredList =>
                    !suppressionLists.some(existingList =>
                        existingList.toLowerCase().includes(requiredList.toLowerCase())
                    )
                );

                if (missingLists.length > 0) {
                    validationFailed = true;
                    missingLists.forEach(list => allMissingLists.add(list));
                }
            }
        });

        const missingListsArray = Array.from(allMissingLists);

        if (validationFailed) {
            const boldedMissingLists = missingListsArray.map(list => `<strong>${list}</strong>`);
            const message = `Missing suppression lists: ${boldedMissingLists.join(', ')}`;
            displayValidationMessage(suppressListContainer, message);
        } else {
            displayValidationMessage(suppressListContainer, 'Suppressions are valid', true);
        }
    }


    // Validat Subject Line
    function validateSubjectLine() {
        const SlContainer = document.querySelector('[data-test="form-readonly-field-subject"]');
        log('Validating Subject Line');

        console.log(SlContainer);
        console.log(SlContainer.innerHTML);

        const invalidChars = [
            { char: '\u2028', name: 'Line Separator' },
            { char: '\u2029', name: 'Paragraph Separator' },
            { char: '\n', name: 'Newline' },
            { char: '\r', name: 'Carriage Return' },
            { char: '\t', name: 'Tab' }
        ];

        const foundInvalidChars = invalidChars.filter(item =>
                                                      SlContainer.innerHTML.includes(item.char)
                                                     );

        if (foundInvalidChars.length === 0) {
            displayValidationMessage(SlContainer, `Subject Line is valid`, true);
        } else {
            const charList = foundInvalidChars.map(item => item.name).join(', ');
            displayValidationMessage(
                SlContainer,
                `Warning: Subject Line contains invalid chars: ${charList}`
            );
        }
    }

    // Run all validations
    function runValidations() {
        log('Running all validations');
        setTimeout(() => {
            // Always run validations so they can clean up warnings when disabled
            validateSeedLists();
            validateSuppressionLists();
            validateSubjectLine()
        }, 1000);
    }

       // Update the default rate limit description
    function updateDefaultDescription() {
        const rateLimitField = document.querySelector('[data-test="form-readonly-field-sendRateLimit"]');
        if (rateLimitField) {
            const span = rateLimitField.querySelector('span');
            if (span && span.textContent.includes('Default (1,000 messages per minute)')) {
                span.textContent = 'Off – Sending as fast as server allows (~800k/hour)';
            }
        }
    }

        // Check if page is ready for custom settings
    function isPageReady() {
        const optimizeSection = document.querySelector('[data-test="optimize-section"]');
        return !!optimizeSection;
    }

    // Create custom rate limit settings
    function createCustomSettings() {
        const campaignId = getCampaignId();

        const container = document.createElement('div');
        container.className = 'custom-rate-settings';
        container.innerHTML = `
            <div class="custom-rate-header">
                Custom Rate Limit
                <span class="direct-api-badge">DIRECT API</span>
            </div>

            <div class="custom-rate-field">
                <div class="custom-rate-label">Custom rate limit</div>
                <div class="custom-input-group">
                    <input type="number" class="custom-input" id="custom-rate-input"
                           value="${customRateLimit}" min="1" max="100000">
                    <span>messages/min</span>
                    <div class="rate-math" id="rate-math">≈ ${(customRateLimit * 60).toLocaleString()} messages/hour</div>
                </div>
                <div class="custom-rate-apply">
                    <button class="apply-button" id="apply-rate-button" ${!campaignId ? 'disabled' : ''}>
                        Apply Now
                    </button>
                </div>
                ${!campaignId ? '<div class="description-text" style="color: #ef4444;">Campaign ID not found in URL</div>' : ''}
            </div>
        `;

        return container;
    }

        // Extract campaign ID from current URL
    function getCampaignId() {
        const match = window.location.pathname.match(/\/campaigns\/(\d+)/);
        return match ? match[1] : null;
    }

    // Extract list IDs from page elements
    function extractListIds() {
        const listIds = [];
        const suppressionListIds = [];

        try {
            // Extract send list IDs
            const sendListElement = document.querySelector('[data-test="form-readonly-field-sendLists"]');
            if (sendListElement) {
                const sendListLinks = sendListElement.querySelectorAll('a[href*="emailListId="]');
                sendListLinks.forEach(link => {
                    const match = link.href.match(/emailListId=(\d+)/);
                    if (match) {
                        listIds.push(parseInt(match[1]));
                    }
                });
            }

            // Extract suppression list IDs
            const suppressionListElement = document.querySelector('[data-test="form-readonly-field-suppressionLists"]');
            if (suppressionListElement) {
                const suppressionListLinks = suppressionListElement.querySelectorAll('a[href*="emailListId="]');
                suppressionListLinks.forEach(link => {
                    const match = link.href.match(/emailListId=(\d+)/);
                    if (match) {
                        suppressionListIds.push(parseInt(match[1]));
                    }
                });
            }

        } catch (error) {
            log(`Error extracting list IDs: ${error.message}`, 'error');
        }

        return { listIds, suppressionListIds };
    }

    // Get campaign name from page header
    function getCampaignName() {
        try {
            const nameElement = document.querySelector('[data-input-type="pageHeader"]');
            if (nameElement) {
                const name = nameElement.textContent.trim();
                return name;
            }
        } catch (error) {
            log(`Error extracting campaign name: ${error.message}`, 'error');
        }
        return 'Updated Campaign';
    }

        // Handle input change
    function handleInputChange(event) {
        const newValue = parseInt(event.target.value) || 2000;
        customRateLimit = newValue;
        const rateMath = document.getElementById('rate-math');
        if (rateMath) {
            rateMath.textContent = `≈ ${(customRateLimit * 60).toLocaleString()}/hour`;
        }
    }

        // Apply rate limit to current campaign
    async function applyRateLimit() {
        const campaignId = getCampaignId();
        if (!campaignId) {
            showNotification('Could not find campaign ID in URL', 'error');
            return;
        }

        try {
            const result = await updateCampaignRateLimit(campaignId, customRateLimit);

            // Show success message
            showNotification(`Rate limit set to ${customRateLimit}/min`, 'success');

            // Refresh the page to show updated settings
            setTimeout(() => {
                window.location.reload();
            }, 2000);

        } catch (error) {
            log(`Failed to apply rate limit: ${error.message}`, 'error');
            showNotification(`Failed to set rate limit: ${error.message}`, 'error');
        }
    }

    // Show notification to user
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            max-width: 400px;
            word-wrap: break-word;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    // Get XSRF token from cookies or meta tags
    function getXSRFToken() {
        // Try to get from cookies first
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'XSRF-TOKEN' || name === '_csrf') {
                return decodeURIComponent(value);
            }
        }

        // Try to get from meta tag
        const metaToken = document.querySelector('meta[name="csrf-token"]');
        if (metaToken) {
            return metaToken.getAttribute('content');
        }

        return null;
    }

        // Check if required page elements are present
    function areRequiredElementsPresent() {
        const sendListElement = document.querySelector('[data-test="form-readonly-field-sendLists"]');
        const suppressionListElement = document.querySelector('[data-test="form-readonly-field-suppressionLists"]');
        const nameElement = document.querySelector('[data-input-type="pageHeader"]');

        return !!(sendListElement && suppressionListElement && nameElement);
    }

    // Wait for required elements to be present
    function waitForRequiredElements(timeout = 1000) {
        return new Promise((resolve, reject) => {
            if (areRequiredElementsPresent()) {
                resolve();
                return;
            }

            const startTime = Date.now();
            const checkInterval = setInterval(() => {
                if (areRequiredElementsPresent()) {
                    clearInterval(checkInterval);
                    resolve();
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    reject(new Error('Timeout waiting for required page elements'));
                }
            }, 100);
        });
    }

    // Make API call to update campaign rate limit
    async function updateCampaignRateLimit(campaignId, rateLimit) {
        // Wait for required elements
        try {
            await waitForRequiredElements();
        } catch (error) {
            throw new Error('Required page elements not found. Please wait for page to fully load.');
        }

        const xsrfToken = getXSRFToken();
        if (!xsrfToken) {
            log('Could not find XSRF token - API call may fail', 'error');
        }

        const campaignName = getCampaignName();
        const { listIds, suppressionListIds } = extractListIds();

        // Validate required data
        if (!listIds || listIds.length === 0) {
            throw new Error('No send lists found on page. Please ensure the campaign has send lists configured.');
        }

        // Build complete payload
        const payload = {
            customRateLimit: {
                useRateLimit: true,
                rateLimitPerMin: rateLimit,
            },
            messageMedium: "Email",
            labels: [],
            listIds: listIds,
            suppressionListIds: suppressionListIds,
            ignoreFrequencyCap: false,
            mobileAppIds: [],
            dataScienceOptimizations: [],
            priorityLevel: null,
            aiCreation: null,
            customConversions: [],
            schedulerMsgParams: null,
            campaignType: "Blast",
            name: campaignName,
            campaignIdOpt: parseInt(campaignId)
        };

        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.5',
            'Content-Type': 'application/json',
            'User-Agent': navigator.userAgent,
            'Sec-GPC': '1',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'Priority': 'u=0'
        };

        // Add XSRF token if available
        if (xsrfToken) {
            headers['X-XSRF-TOKEN'] = xsrfToken;
        }

        try {
            const response = await fetch('https://app.iterable.com/campaigns/createSubmit', {
                method: 'POST',
                credentials: 'include',
                headers: headers,
                referrer: window.location.href,
                body: JSON.stringify(payload),
                mode: 'cors'
            });

            if (!response.ok) {
                const errorText = await response.text();
                log(`API error response: ${errorText}`, 'error');
                throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorText}`);
            }

            const result = await response.json();
            return result;

        } catch (error) {
            log(`API call failed: ${error.message}`, 'error');
            throw error;
        }
    }

 function setupSmartRateLimitMonitor() {
    const targetSelector = '[data-test="form-readonly-field-sendRateLimit"]';
    const defaultText = 'Default (1,000 messages per minute)';
    const customText = 'Off – Sending as fast as server allows (~800k/hour)';

    function updateText() {
        const rateLimitField = document.querySelector(targetSelector);
        if (rateLimitField) {
            const span = rateLimitField.querySelector('span');
            if (span && span.textContent.includes(defaultText)) {
                span.textContent = customText;
                console.log('Rate limit text updated to custom text');
                return true;
            }
        }
        return false;
    }

    // Initial update
    updateText();

    // Observer specifically watching the parent container
    const observer = new MutationObserver((mutations) => {
        let shouldCheck = false;

        mutations.forEach((mutation) => {
            // Check if any added nodes contain our target or if text changed
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches && node.matches(targetSelector)) {
                            shouldCheck = true;
                        } else if (node.querySelector && node.querySelector(targetSelector)) {
                            shouldCheck = true;
                        }
                    }
                });
            } else if (mutation.type === 'characterData') {
                // Check if the text change was in our target area
                const target = mutation.target.parentElement;
                if (target && target.closest(targetSelector)) {
                    shouldCheck = true;
                }
            }
        });

        if (shouldCheck) {
            // Small delay to ensure DOM is fully updated
            setTimeout(updateText, 100);
        }
    });

    // Observe with more specific options
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });

    // Also set up a fallback periodic check (less frequent)
    const fallbackInterval = setInterval(() => {
        updateText();
    }, 10000); // Every 10 seconds as fallback

    // Return cleanup function
    return () => {
        observer.disconnect();
        clearInterval(fallbackInterval);
    };
}

        // Add custom settings to the optimize section
    function addCustomSettingsToPage() {
        if (customSettingsAdded || !isPageReady()) {0
            return;
        }

        const optimizeSection = document.querySelector('[data-test="optimize-section"]');

        const customSettings = createCustomSettings();0
        optimizeSection.appendChild(customSettings);

        // Add event listeners
        const input = document.getElementById('custom-rate-input');
        const applyButton = document.getElementById('apply-rate-button');

        input.addEventListener('input', handleInputChange);
        applyButton.addEventListener('click', () => applyRateLimit());

        customSettingsAdded = true;
    }

        // Main observer to watch for page changes
    function observePageChanges() {
        const observer = new MutationObserver(() => {
            updateDefaultDescription();
            if (!customSettingsAdded) {
                addCustomSettingsToPage();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

    }


    // More robust element waiting with periodic checksaddPrepareScheduleButton
    function waitForElement(selector, callback, maxWaitTime = 30000) {
        log(`Starting robust wait for element: ${selector}`);
        const startTime = Date.now();
        let attempts = 0;

        const checkForElement = () => {
            attempts++;
            const element = document.querySelector(selector);
            const elapsed = Date.now() - startTime;

            log(`Attempt ${attempts}: Looking for ${selector} (${elapsed}ms elapsed)`);

            if (element) {
                log(`Element found after ${attempts} attempts (${elapsed}ms): ${selector}`);
                callback(element);
                return true;
            } else if (elapsed < maxWaitTime) {
                // Continue checking every 250ms
                setTimeout(checkForElement, 250);
                return false;
            } else {
                log(`Timeout after ${attempts} attempts (${elapsed}ms): ${selector}`);
                return false;
            }
        };

        checkForElement();
    }

    // Wait for page to be in a more stable state
    function waitForPageStability(callback, timeout = 10000) {
        log('Waiting for page stability...');

        let stabilityChecks = 0;
        const maxChecks = timeout / 500; // Check every 500ms

        const checkStability = () => {
            stabilityChecks++;
            const isStable = document.readyState === 'complete' ||
                           document.querySelector('[data-test="form-readonly-field-scheduleStartTime"]') ||
                           stabilityChecks >= maxChecks;

            log(`Stability check ${stabilityChecks}/${maxChecks}: readyState=${document.readyState}, hasScheduleElement=${!!document.querySelector('[data-test="form-readonly-field-scheduleStartTime"]')}`);

            if (isStable) {
                log('Page appears stable, proceeding...');
                callback();
            } else {
                setTimeout(checkStability, 500);
            }
        };

        checkStability();
    }

    // Check if we're on the summary view
    function isOnSummaryView() {
        const isSummary = window.location.href.includes('view=Summary') ||
               window.location.search.includes('view=Summary') ||
               !window.location.search.includes('view=');
        log(`Is on summary view: ${isSummary}`, window.location.href);
        return isSummary;
    }

    // Updated relative time calculation function
    function calculateRelativeTime(dateString, timeString) {
        // Convert our input format (2024-12-15, 14:30) to the target date
        const dateStr = `${dateString}T${timeString}:00`;
        const scheduledDate = new Date(dateStr);
        const now = new Date();
        const diffMs = scheduledDate - now;

        if (diffMs <= 0) {
            return { text: "(time has passed)", color: "#f44336" };
        }

        const diffMins = Math.round(diffMs / 60000);
        const diffHours = Math.round(diffMs / 3600000);
        const diffDays = Math.round(diffMs / 86400000);

        let text, color;

        if (diffMins < 60) {
            text = `(in ${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'})`;
            color = "#f44336"; // Red - next hour
        } else if (diffHours < 24) {
            text = `(in ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'})`;
            color = "#ff9800"; // Orange - between 1-24 hours
        } else {
            text = `(in ${diffDays} ${diffDays === 1 ? 'day' : 'days'})`;
            color = "#4CAF50"; // Green - more than 24 hours
        }

        return { text, color };
    }

    // Function to create and update the relative time display next to time input
    function createRelativeTimeDisplay(timeInput, dateInput) {
        // Remove existing relative time display
        const existing = timeInput.parentElement.querySelector('.relative-time-display');
        if (existing) {
            existing.remove();
        }

        // Clear any existing interval
        if (relativeTimeInterval) {
            clearInterval(relativeTimeInterval);
            relativeTimeInterval = null;
        }

        // Create the relative time display element
        const relativeTimeEl = document.createElement('span');
        relativeTimeEl.className = 'relative-time-display';
        relativeTimeEl.style.cssText = `
        font-size: 12px;
        font-weight: 600;
        padding: 4px 8px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.8);
        border: 1px solid;
        white-space: nowrap;
    `;

        // Function to update the relative time display
        const updateRelativeTime = () => {
            const dateValue = dateInput.value;
            const timeValue = timeInput.value;

            if (dateValue && timeValue) {
                const { text, color } = calculateRelativeTime(dateValue, timeValue);
                relativeTimeEl.textContent = text;
                relativeTimeEl.style.color = color;
                relativeTimeEl.style.borderColor = color;
                relativeTimeEl.style.display = 'inline-block';
            } else {
                relativeTimeEl.style.display = 'none';
            }
        };

        // Initial update
        updateRelativeTime();

        // Update every minute
        relativeTimeInterval = setInterval(updateRelativeTime, 60000);

        // Add to the page (next to time input)
        timeInput.parentElement.appendChild(relativeTimeEl);

        return { element: relativeTimeEl, update: updateRelativeTime };
    }

    // Updated function to create the schedule preview UI
    function createSchedulePreviewUI(notLaunchedElement) {

        log('Hiding prepare button');

        log('Creating schedule preview UI');
        // Find the parent container for the launch time field
        const launchTimeField = notLaunchedElement.closest('[data-test="form-field"]');
        if (!launchTimeField) {
            log('ERROR: Could not find launch time field container');
            return;
        }
        log('Found launch time field container');

        // Create container for our UI
        const container = document.createElement('div');
        container.style.cssText = `
        padding: 16px;
        border: 2px dashed #e0e0e0;
        border-radius: 8px;
        background-color: #f9f9f9;
        font-family: inherit;
    `;

        // Create header with NOT LAUNCHED flag
        const header = document.createElement('div');
        header.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
    `;

        const notLaunchedFlag = document.createElement('span');
        notLaunchedFlag.textContent = 'NOT LAUNCHED';
        notLaunchedFlag.style.cssText = `
        background-color: #ff9800;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
    `;

        const title = document.createElement('span');
        title.textContent = 'Schedule Preview';
        title.style.cssText = `
        font-weight: 600;
        color: #333;
    `;

        header.appendChild(notLaunchedFlag);
        header.appendChild(title);

        // Create date input
        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.style.cssText = `
        margin-right: 12px;
        padding: 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-family: inherit;
    `;

        // Create time input
        const timeInput = document.createElement('input');
        timeInput.type = 'time';
        timeInput.style.cssText = `
        margin-right: 12px;
        padding: 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-family: inherit;
    `;

        // Set default values (current date, current time + 1 hour)
        const now = new Date();
        const defaultDate = now.toISOString().split('T')[0];
        const defaultTime = new Date(now.getTime() + 61 * 60 * 1000).toTimeString().slice(0, 5);

        dateInput.value = defaultDate;
        timeInput.value = defaultTime;

        // Create input container
        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = `
        display: flex;
        align-items: center;
        margin-bottom: 12px;
        flex-wrap: wrap;
        gap: 8px;
    `;

        inputContainer.appendChild(dateInput);
        inputContainer.appendChild(timeInput);

        // Create and setup relative time display
        const relativeTimeDisplay = createRelativeTimeDisplay(timeInput, dateInput);

        // Add event listeners to update relative time when date/time changes
        dateInput.addEventListener('change', relativeTimeDisplay.update);
        timeInput.addEventListener('change', relativeTimeDisplay.update);

        // Create button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
        display: flex;
        gap: 12px;
    `;

        // Create Confirm Schedule Time button
        const confirmButton = document.createElement('button');
        confirmButton.textContent = 'Confirm Schedule Time';
        confirmButton.style.cssText = `
        background-color: #4CAF50;
        color: white;
        border: none;
        padding: 10px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-family: inherit;
        font-weight: 600;
    `;

        confirmButton.addEventListener('click', () => {
            const dateValue = dateInput.value;
            const timeValue = timeInput.value;

            log('Confirm Schedule Time clicked', { date: dateValue, time: timeValue });

            if (!dateValue || !timeValue) {
                log('ERROR: Date or time not selected');
                alert('Please select both date and time');
                return;
            }

            scheduledDateTime = {
                date: dateValue,
                time: timeValue
            };

            log('Scheduled date/time set', scheduledDateTime);

            // Click the schedule button to open modal
            openScheduleModal();
        });

        // Create Clear button (which also hides the panel)
        const clearButton = document.createElement('button');
        clearButton.textContent = 'Clear & Hide';
        clearButton.style.cssText = `
        background-color: #f44336;
        color: white;
        border: none;
        padding: 10px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-family: inherit;
        font-weight: 600;
    `;

        clearButton.addEventListener('click', () => {
            log('Clear & Hide button clicked - resetting and hiding panel');

            // Clear the relative time interval
            if (relativeTimeInterval) {
                clearInterval(relativeTimeInterval);
                relativeTimeInterval = null;
            }

            // Reset values
            dateInput.value = defaultDate;
            timeInput.value = defaultTime;
            scheduledDateTime = null;

            // Hide the panel
            container.remove();
            schedulePreviewUI = null;

            // show the 'prepare' button again
            let button = document.querySelector('.prepare-schedule-btn')
            button.style.display = 'block'

            log('Schedule preview cleared and hidden');
        });

        buttonContainer.appendChild(confirmButton);
        buttonContainer.appendChild(clearButton);

        // Assemble the UI
        container.appendChild(header);
        container.appendChild(inputContainer);
        container.appendChild(buttonContainer);

        // Insert after the launch time field
        launchTimeField.insertAdjacentElement('afterend', container);
        log('Schedule preview UI created and inserted into page');

        return container;
    }

    // Open the schedule modal and populate it
    function openScheduleModal() {
        log('Attempting to open schedule modal');
        const scheduleButton = document.querySelector('[data-test="schedule-button"]');
        if (!scheduleButton) {
            log('ERROR: Schedule button not found');
            alert('Schedule button not found. Please make sure you are on the campaign summary page.');
            return;
        }

        log('Schedule button found, clicking it');
        // Click the schedule button
        scheduleButton.click();

        // Wait for modal to appear and populate it
        log('Waiting 500ms for modal to appear');
        setTimeout(() => {
            populateScheduleModal();
        }, 500);
    }

    // Populate the schedule modal with our pre-selected date/time
    function populateScheduleModal() {
        if (!scheduledDateTime) {
            log('ERROR: No scheduled date/time set');
            return;
        }

        log('Starting to populate schedule modal', scheduledDateTime);

        // Wait for modal elements to be available
        const checkAndPopulate = (attempts = 0) => {
            log(`Attempting to find modal inputs (attempt ${attempts + 1}/30)`);
            const dateInput = document.querySelector('#scheduleCampaignStartDateAndTime');
            const timeInput = document.querySelector('#typeahead-input');

            log('Modal input elements found:', {
                dateInput: !!dateInput,
                timeInput: !!timeInput
            });

            if (dateInput && timeInput && attempts < 30) {
                // Format date for the modal (MM/DD/YYYY)
                const [year, month, day] = scheduledDateTime.date.split('-');
                const formattedDate = `${month}/${day}/${year}`;

                // Format time for the modal (convert 24h to 12h format)
                const [hours, minutes] = scheduledDateTime.time.split(':');
                const hour12 = parseInt(hours) % 12 || 12;
                const ampm = parseInt(hours) >= 12 ? 'PM' : 'AM';
                const formattedTime = `${hour12.toString().padStart(2, '0')}:${minutes} ${ampm}`;

                log('Formatted values for modal:', {
                    originalDate: scheduledDateTime.date,
                    formattedDate: formattedDate,
                    originalTime: scheduledDateTime.time,
                    formattedTime: formattedTime
                });

                // More aggressive approach to setting values
                setTimeout(() => {
                    setModalValues(dateInput, timeInput, formattedDate, formattedTime);
                }, 100);

            } else if (attempts < 30) {
                log(`Modal inputs not ready, retrying in 200ms...`);
                setTimeout(() => checkAndPopulate(attempts + 1), 200);
            } else {
                log('ERROR: Could not find modal inputs after 30 attempts');
            }
        };

        checkAndPopulate();
    }
// Replace the setModalValues function with this corrected version
function setModalValues(dateInput, timeInput, formattedDate, formattedTime) {
    log('Setting modal values with React Calendar approach');

    // Parse the target date
    const [month, day, year] = formattedDate.split('/');
    const targetDate = new Date(year, month - 1, day); // month is 0-indexed
    const targetDay = parseInt(day);

    log('Target date info:', {
        formattedDate,
        targetDay,
        targetDate: targetDate.toDateString()
    });

    // First, we need to click the date input to open the calendar
    log('Clicking date input to open calendar...');

    // Focus and click the date input field to open the calendar
    dateInput.focus();
    dateInput.click();

    // Trigger additional events that might be needed
    dateInput.dispatchEvent(new Event('mousedown', { bubbles: true }));
    dateInput.dispatchEvent(new Event('mouseup', { bubbles: true }));
    dateInput.dispatchEvent(new Event('click', { bubbles: true }));

    // Wait for the calendar to appear, then find and click the date
    setTimeout(() => {
        selectDateFromCalendar(dateInput, targetDay, formattedDate, () => {
            // After date is selected, handle time input
            setTimeout(() => {
                // Focus on time input
            timeInput.focus();
            timeInput.click();

            // Clear and set value
            timeInput.value = '';
            timeInput.value = formattedTime;

            // Trigger multiple events
            ['input', 'change', 'blur', 'keyup', 'keydown', 'paste'].forEach(eventType => {
                timeInput.dispatchEvent(new Event(eventType, { bubbles: true }));
            });

            // For React components, also try setting the React props
            if (timeInput._valueTracker) {
                timeInput._valueTracker.setValue('');
            }

            // Double-check values after setting
            setTimeout(() => {
                log('Final values check:', {
                    dateValue: dateInput.value,
                    timeValue: timeInput.value,
                    expectedDate: formattedDate,
                    expectedTime: formattedTime
                });

                // If values don't match, try one more time
                if (dateInput.value !== formattedDate || timeInput.value !== formattedTime) {
                    log('Values did not stick, trying one more time...');

                    if (dateInput.value !== formattedDate) {
                        dateInput.focus();
                        dateInput.select();
                        document.execCommand('insertText', false, formattedDate);
                        dateInput.dispatchEvent(new Event('input', { bubbles: true }));
                        dateInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }

                    if (timeInput.value !== formattedTime) {
                        timeInput.focus();
                        timeInput.select();
                        document.execCommand('insertText', false, formattedTime);
                        timeInput.dispatchEvent(new Event('input', { bubbles: true }));
                        timeInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            }, 300);
            }, 300);
        });
    }, 500);
}

// New function to handle date selection from the calendar popup
function selectDateFromCalendar(dateInput, targetDay, formattedDate, callback) {
    log('Looking for React Calendar popup...');

    // Wait for calendar to appear with multiple attempts
    let attempts = 0;
    const maxAttempts = 10;

    const findAndClickDate = () => {
        attempts++;
        log(`Attempt ${attempts}/${maxAttempts} to find calendar`);

        // Find the calendar container
        const calendar = document.querySelector('.react-calendar');
        if (!calendar) {
            if (attempts < maxAttempts) {
                log('Calendar not found yet, retrying...');
                setTimeout(findAndClickDate, 200);
                return;
            } else {
                log('ERROR: React Calendar popup never appeared');
                return;
            }
        }

        log('React Calendar popup found, looking for date buttons...');

        // Look for the specific date button
        const dateButtons = calendar.querySelectorAll('.react-calendar__tile');
        let targetButton = null;

        for (const button of dateButtons) {
            const abbr = button.querySelector('abbr');
            if (abbr) {
                const buttonDay = parseInt(abbr.textContent.trim());
                const ariaLabel = abbr.getAttribute('aria-label') || '';

                // Check if this button represents our target day
                if (buttonDay === targetDay) {
                    // Check if it matches our target date or is available for selection
                    if (ariaLabel.includes(formattedDate) || (!button.disabled && !button.hasAttribute('disabled'))) {
                        targetButton = button;
                        log('Found matching date button:', {
                            buttonDay,
                            ariaLabel,
                            buttonText: abbr.textContent,
                            disabled: button.disabled
                        });
                        break;
                    }
                }
            }
        }

        if (targetButton) {
            log('Clicking target date button...');

            // Scroll the button into view if needed
            targetButton.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Click the button to select the date
            setTimeout(() => {
                targetButton.focus();
                targetButton.click();

                // Trigger additional events that React might be listening for
                targetButton.dispatchEvent(new Event('mousedown', { bubbles: true }));
                targetButton.dispatchEvent(new Event('mouseup', { bubbles: true }));
                targetButton.dispatchEvent(new Event('click', { bubbles: true }));

                log('Date button clicked successfully');

                // Verify the date was set in the input field
                setTimeout(() => {
                    if (dateInput) {
                        log('Date input value after selection:', dateInput.value);
                        log('Expected date value:', formattedDate);

                        // If the visual field didn't update, try to force it
                        if (dateInput.value !== formattedDate) {
                            log('Date input value mismatch, trying to force update...');

                            // Try to set the input value directly
                            dateInput.value = formattedDate;

                            // Trigger events on the input field
                            ['input', 'change', 'blur', 'focus'].forEach(eventType => {
                                dateInput.dispatchEvent(new Event(eventType, { bubbles: true }));
                            });

                            // Check again
                            setTimeout(() => {
                                log('Date input value after force update:', dateInput.value);
                            }, 100);
                        } else {
                            log('Date selection verified successfully!');
                        }
                    }

                    // Call the callback after verification
                    if (callback) {
                        callback();
                    }
                }, 200);

            }, 100);

        } else {
            log('ERROR: Could not find target date button for day:', targetDay);

            // Try to navigate to the correct month first
            const [month, day, year] = formattedDate.split('/');
            const targetDate = new Date(year, month - 1, day);

            navigateToCorrectMonth(calendar, targetDate, () => {
                // Retry finding the button after navigation
                setTimeout(() => {
                    selectDateFromCalendar(dateInput, targetDay, formattedDate, callback);
                }, 500);
            });
        }
    };

    findAndClickDate();
}

// Helper function to set time value (original working method)
function setTimeValue(timeInput, formattedTime) {
    log('Setting time input value:', formattedTime);

    // Focus on time input
    timeInput.focus();
    timeInput.click();

    // Clear and set value
    timeInput.value = '';
    timeInput.value = formattedTime;

    // Trigger multiple events
    ['input', 'change', 'blur', 'keyup', 'keydown', 'paste'].forEach(eventType => {
        timeInput.dispatchEvent(new Event(eventType, { bubbles: true }));
    });

    // For React components, also try setting the React props
    if (timeInput._valueTracker) {
        timeInput._valueTracker.setValue('');
    }

    log('Time value set successfully');
}

// Helper function to navigate to the correct month if needed
function navigateToCorrectMonth(calendar, targetDate, callback) {
    log('Attempting to navigate to correct month...');

    // Get current displayed month from the calendar
    const monthLabel = calendar.querySelector('.react-calendar__navigation__label__labelText, .react-calendar__navigation__label');
    if (!monthLabel) {
        log('ERROR: Could not find month label');
        callback(); // Proceed anyway
        return;
    }

    const currentMonthText = monthLabel.textContent.trim(); // e.g., "June 2025"
    log('Current calendar month:', currentMonthText);

    const targetMonthText = targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    log('Target month:', targetMonthText);

    if (currentMonthText === targetMonthText) {
        log('Already on correct month');
        callback();
        return;
    }

    // Determine if we need to go forward or backward
    const currentDate = new Date(currentMonthText + ' 1');
    const needsForward = targetDate > currentDate;

    // Find the appropriate navigation button
    const navButton = needsForward
        ? calendar.querySelector('.react-calendar__navigation__next-button')
        : calendar.querySelector('.react-calendar__navigation__prev-button');

    if (!navButton || navButton.disabled) {
        log('Navigation button not available or disabled');
        callback(); // Proceed anyway
        return;
    }

    log(`Clicking ${needsForward ? 'next' : 'previous'} month button`);
    navButton.click();

    // Wait for navigation to complete, then check again
    setTimeout(() => {
        // Limit recursion to prevent infinite loops
        const maxNavigationAttempts = 12; // Maximum months to navigate
        if (!calendar._navigationAttempts) {
            calendar._navigationAttempts = 0;
        }
        calendar._navigationAttempts++;

        if (calendar._navigationAttempts > maxNavigationAttempts) {
            log('Max navigation attempts reached, proceeding anyway');
            callback();
            return;
        }

        navigateToCorrectMonth(calendar, targetDate, callback);
    }, 300);
}
    // Add the "Prepare Schedule Time" button
    function addPrepareScheduleButton(notLaunchedElement) {
        log('Adding Prepare Schedule Time button');
        // Check if button already exists
        if (notLaunchedElement.parentElement.querySelector('.prepare-schedule-btn')) {
            log('Button already exists, skipping');
            return;
        }

        const button = document.createElement('button');
        button.textContent = 'Prepare Schedule Time';
        button.className = 'prepare-schedule-btn';
        button.style.cssText = `
        background-color: #2196F3;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-family: inherit;
    `;

        button.addEventListener('click', () => {
            log('Prepare Schedule Time button clicked');
            if (schedulePreviewUI) {
                log('Schedule preview UI already exists, ignoring click');
                return;
            } else {
                log('Creating new schedule preview UI');
                schedulePreviewUI = createSchedulePreviewUI(notLaunchedElement);
                button.style.display = 'none'
                // Note: Button text stays the same - status is shown in the right column
            }
        });

        // Add button next to the "Not launched" text
        notLaunchedElement.parentElement.appendChild(button);
        log('Prepare Schedule Time button added successfully');
    }

    // Initialize the script
    function initialize() {
        log('Initializing script');

        // Add CSS overrides first
        addCSSOverrides();

        if (!isOnSummaryView()) {
            log('Not on summary view, skipping initialization');
            return;
        }

        log('On summary view, looking for "Not launched" element');

        // Try multiple selectors to find the "Not launched" text
        const selectors = [
            '[data-test="form-readonly-field-scheduleStartTime"] span',
            '[data-test="form-readonly-field-scheduleStartTime"] .sc-eIECrE',
            '[data-test="form-readonly-field-scheduleStartTime"] .sc-fLdDTP',
            '[data-test="form-readonly-field-scheduleStartTime"]'
        ];

        let elementFound = false;

        const trySelector = (index = 0) => {
            if (index >= selectors.length) {
                log('ERROR: None of the selectors found the launch time element');
                return;
            }

            const selector = selectors[index];
            log(`Trying selector ${index + 1}/${selectors.length}: ${selector}`);

            waitForElement(selector, (element) => {
                if (elementFound) return; // Prevent multiple matches

                log('Found element with selector:', selector);
                log('Element content:', element.textContent.trim());
                log('Element HTML:', element.outerHTML.substring(0, 200) + '...');

                // Check if this element or its children contain "Not launched"
                const textContent = element.textContent.trim();
                if (textContent === 'Not launched' || textContent.includes('Not launched')) {
                    log('Campaign is not launched, adding prepare schedule button');
                    elementFound = true;

                    // Find the span with "Not launched" text specifically
                    let targetElement = element;
                    if (element.tagName !== 'SPAN') {
                        const spanElement = element.querySelector('span');
                        if (spanElement && spanElement.textContent.trim().includes('Not launched')) {
                            targetElement = spanElement;
                        }
                    }

                    // Hide the original "Not launched" text since we'll show our own
                    targetElement.style.display = 'none';
                    log('Hidden original "Not launched" text');


                    addPrepareScheduleButton(targetElement);

                    // Run validations
                    runValidations();
                } else {
                    log('Campaign already launched or different status, not adding button');
                }
            }, 2000); // Shorter timeout per selector

            // Try next selector after a delay if this one doesn't work
            setTimeout(() => {
                if (!elementFound) {
                    trySelector(index + 1);
                }
            }, 2500);
        };

        trySelector();
    }

    // Run on page load and navigation changes
    log('Running initial initialization');

    // Load configuration
    loadConfig();

    const cleanup = setupSmartRateLimitMonitor();

    // Start observing for UI changes
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', observePageChanges);
    } else {
        observePageChanges();
    }

    // Register menu command
    GM_registerMenuCommand('Campaign Enhancement Settings', createSettingsModal);

    initialize();

    // Handle SPA navigation
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            log('URL changed, re-initializing', { from: lastUrl, to: url });
            lastUrl = url;
            // Give the page more time to load after navigation
            setTimeout(() => {
                initialize();
            }, 2000);
        }
    }).observe(document, { subtree: true, childList: true });

    log('Script setup complete - mutation observer active');

})();
