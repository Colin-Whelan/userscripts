// ==UserScript==
// @name         Profile Editor
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Add editing capabilities to Iterable user profile fields with multi-space support
// @author       Colin Whelan
// @match        https://app.iterable.com/users/profiles/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // Constants
    const CONFIG_KEYS = {
        SPACES: 'iterable_spaces', // Store array of {name, apiKey} objects
        MERGE_NESTED: 'iterable_merge_nested',
        SHOW_NOTIFICATIONS: 'iterable_show_notifications'
    };

    const CSS_CLASSES = {
        EDIT_BUTTON: 'iterable-edit-btn',
        EDIT_MODAL: 'iterable-edit-modal',
        EDIT_OVERLAY: 'iterable-edit-overlay',
        NOTIFICATION: 'iterable-notification'
    };

    const API_ENDPOINT = 'https://api.iterable.com/api/users/update';
    const FIELD_MAPPINGS_ENDPOINT = 'https://app.iterable.com/mappings?dataType=user&fetchLatest=true&filterOutHiddenFields=false';
    const USER_CONTEXT_ENDPOINT = 'https://app.iterable.com/i/user/context';

    let currentSpaceName = null;

    // Space Manager
    class SpaceManager {
        static async getCurrentSpaceContext() {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: USER_CONTEXT_ENDPOINT,
                    onload: (response) => {
                        if (response.status >= 200 && response.status < 300) {
                            try {
                                const context = JSON.parse(response.responseText);
                                resolve(context);
                            } catch (error) {
                                reject(new Error('Failed to parse user context response'));
                            }
                        } else {
                            reject(new Error(`Failed to fetch user context: ${response.status}`));
                        }
                    },
                    onerror: () => {
                        reject(new Error('Network error fetching user context'));
                    }
                });
            });
        }

        static async initializeCurrentSpace() {
            try {
                const context = await this.getCurrentSpaceContext();
                currentSpaceName = context.project?.name;

                if (currentSpaceName) {
                    NotificationManager.showInfo(`Current space: ${currentSpaceName}`);
                } else {
                    NotificationManager.showError('Could not determine current space name');
                }

                return context;
            } catch (error) {
                NotificationManager.showError(`Failed to initialize space: ${error.message}`);
                throw error;
            }
        }

        static getCurrentSpaceName() {
            return currentSpaceName;
        }
    }

    // Configuration Manager
    class ConfigManager {
        static getSpaces() {
            const spaces = GM_getValue(CONFIG_KEYS.SPACES, '[]');
            try {
                return JSON.parse(spaces);
            } catch {
                return [];
            }
        }

        static setSpaces(spaces) {
            GM_setValue(CONFIG_KEYS.SPACES, JSON.stringify(spaces));
        }

        static addOrUpdateSpace(name, apiKey) {
            const spaces = this.getSpaces();
            const existingIndex = spaces.findIndex(space => space.name === name);

            if (existingIndex >= 0) {
                spaces[existingIndex].apiKey = apiKey;
            } else {
                spaces.push({ name, apiKey });
            }

            this.setSpaces(spaces);
        }

        static removeSpace(name) {
            const spaces = this.getSpaces();
            const filtered = spaces.filter(space => space.name !== name);
            this.setSpaces(filtered);
        }

        static getApiKeyForSpace(spaceName) {
            const spaces = this.getSpaces();
            const space = spaces.find(space => space.name === spaceName);
            return space ? space.apiKey : '';
        }

        static getCurrentApiKey() {
            const currentSpace = SpaceManager.getCurrentSpaceName();
            if (!currentSpace) {
                throw new Error('Current space not determined. Please refresh the page.');
            }

            const apiKey = this.getApiKeyForSpace(currentSpace);
            if (!apiKey) {
                throw new Error(`API key not configured for space "${currentSpace}". Use the userscript menu to set it.`);
            }

            return apiKey;
        }

        // Legacy method - kept for backward compatibility but now gets current space key
        static getApiKey() {
            return this.getCurrentApiKey();
        }

        static getMergeNestedObjects() {
            return GM_getValue(CONFIG_KEYS.MERGE_NESTED, true);
        }

        static setMergeNestedObjects(value) {
            GM_setValue(CONFIG_KEYS.MERGE_NESTED, value);
        }

        static getShowNotifications() {
            return GM_getValue(CONFIG_KEYS.SHOW_NOTIFICATIONS, true);
        }

        static setShowNotifications(value) {
            GM_setValue(CONFIG_KEYS.SHOW_NOTIFICATIONS, value);
        }
    }

    // Space Configuration Modal
    class SpaceConfigModal {
        static async create() {
            const overlay = document.createElement('div');
            overlay.className = CSS_CLASSES.EDIT_OVERLAY;

            const modal = document.createElement('div');
            modal.className = CSS_CLASSES.EDIT_MODAL;

            // Show loading state while fetching context
            modal.innerHTML = `
                <div class="modal-header">
                    <h3>Manage Iterable Spaces</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="loading-message">Loading available spaces...</div>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            try {
                const context = await SpaceManager.getCurrentSpaceContext();
                const availableSpaces = context.projects || [];
                const currentProject = context.project?.name || 'Unknown';
                const configuredSpaces = ConfigManager.getSpaces();

                modal.innerHTML = `
                    <div class="modal-header">
                        <h3>Manage Iterable Spaces</h3>
                        <button class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="current-space-info">
                            <strong>Current Space:</strong> ${currentProject}
                        </div>

                        <div class="space-list">
                            <h4>Available Spaces:</h4>
                            ${availableSpaces.map(space => this.createSpaceConfigHTML(space.name, configuredSpaces)).join('')}
                        </div>

                        <div class="configured-spaces">
                            <h4>Configured Spaces:</h4>
                            <div class="configured-list">
                                ${configuredSpaces.length === 0 ?
                                    '<div class="no-spaces">No spaces configured yet</div>' :
                                    configuredSpaces.map(space => this.createConfiguredSpaceHTML(space)).join('')
                                }
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="cancel-btn">Close</button>
                    </div>
                `;

                this.attachEventHandlers(overlay, modal, availableSpaces);

            } catch (error) {
                modal.innerHTML = `
                    <div class="modal-header">
                        <h3>Manage Iterable Spaces</h3>
                        <button class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="error-message">Failed to load spaces: ${error.message}</div>
                        <div class="manual-config">
                            <h4>Manual Configuration:</h4>
                            <div class="form-group">
                                <label for="manual-space-name">Space Name:</label>
                                <input type="text" id="manual-space-name" placeholder="Enter space name" />
                            </div>
                            <div class="form-group">
                                <label for="manual-api-key">API Key:</label>
                                <input type="password" id="manual-api-key" placeholder="Enter API key" />
                            </div>
                            <button class="save-manual-btn">Add Space</button>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="cancel-btn">Close</button>
                    </div>
                `;

                this.attachManualEventHandlers(overlay, modal);
            }
        }

        static createSpaceConfigHTML(spaceName, configuredSpaces) {
            const existingSpace = configuredSpaces.find(space => space.name === spaceName);
            const hasKey = existingSpace && existingSpace.apiKey;

            return `
                <div class="space-config-item" data-space-name="${spaceName}">
                    <div class="space-info">
                        <strong>${spaceName}</strong>
                        <span class="space-status ${hasKey ? 'configured' : 'not-configured'}">
                            ${hasKey ? '✓ Configured' : '⚠ Not Configured'}
                        </span>
                    </div>
                    <div class="space-controls">
                        <input type="password" class="api-key-input" placeholder="API Key"
                               value="${existingSpace ? existingSpace.apiKey : ''}" />
                        <button class="save-space-btn">Save</button>
                        ${hasKey ? '<button class="remove-space-btn">Remove</button>' : ''}
                    </div>
                </div>
            `;
        }

        static createConfiguredSpaceHTML(space) {
            const maskedKey = space.apiKey ? space.apiKey.substring(0, 8) + '...' : 'No key';
            return `
                <div class="configured-space-item" data-space-name="${space.name}">
                    <div class="space-details">
                        <strong>${space.name}</strong>
                        <span class="masked-key">${maskedKey}</span>
                    </div>
                    <button class="remove-configured-btn">Remove</button>
                </div>
            `;
        }

        static attachEventHandlers(overlay, modal, availableSpaces) {
            const closeModal = () => overlay.remove();

            // Close button
            modal.querySelector('.close-btn').addEventListener('click', closeModal);
            modal.querySelector('.cancel-btn').addEventListener('click', closeModal);

            // Click outside modal
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeModal();
            });

            // Save space buttons
            modal.querySelectorAll('.save-space-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const spaceItem = e.target.closest('.space-config-item');
                    const spaceName = spaceItem.dataset.spaceName;
                    const apiKeyInput = spaceItem.querySelector('.api-key-input');
                    const apiKey = apiKeyInput.value.trim();

                    if (!apiKey) {
                        NotificationManager.showError('API key is required');
                        return;
                    }

                    ConfigManager.addOrUpdateSpace(spaceName, apiKey);
                    NotificationManager.showSuccess(`API key saved for ${spaceName}`);

                    // Update the UI
                    const statusSpan = spaceItem.querySelector('.space-status');
                    statusSpan.textContent = '✓ Configured';
                    statusSpan.className = 'space-status configured';

                    // Add remove button if it doesn't exist
                    if (!spaceItem.querySelector('.remove-space-btn')) {
                        const removeBtn = document.createElement('button');
                        removeBtn.className = 'remove-space-btn';
                        removeBtn.textContent = 'Remove';
                        spaceItem.querySelector('.space-controls').appendChild(removeBtn);

                        removeBtn.addEventListener('click', () => {
                            this.handleRemoveSpace(spaceName, spaceItem);
                        });
                    }
                });
            });

            // Remove space buttons
            modal.querySelectorAll('.remove-space-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const spaceItem = e.target.closest('.space-config-item');
                    const spaceName = spaceItem.dataset.spaceName;
                    this.handleRemoveSpace(spaceName, spaceItem);
                });
            });

            // Remove configured space buttons
            modal.querySelectorAll('.remove-configured-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const spaceItem = e.target.closest('.configured-space-item');
                    const spaceName = spaceItem.dataset.spaceName;

                    ConfigManager.removeSpace(spaceName);
                    NotificationManager.showSuccess(`Removed configuration for ${spaceName}`);
                    spaceItem.remove();
                });
            });
        }

        static attachManualEventHandlers(overlay, modal) {
            const closeModal = () => overlay.remove();

            // Close button
            modal.querySelector('.close-btn').addEventListener('click', closeModal);
            modal.querySelector('.cancel-btn').addEventListener('click', closeModal);

            // Save manual button
            modal.querySelector('.save-manual-btn').addEventListener('click', () => {
                const spaceName = modal.querySelector('#manual-space-name').value.trim();
                const apiKey = modal.querySelector('#manual-api-key').value.trim();

                if (!spaceName || !apiKey) {
                    NotificationManager.showError('Both space name and API key are required');
                    return;
                }

                ConfigManager.addOrUpdateSpace(spaceName, apiKey);
                NotificationManager.showSuccess(`API key saved for ${spaceName}`);
                closeModal();
            });
        }

        static handleRemoveSpace(spaceName, spaceItem) {
            if (confirm(`Remove API key configuration for "${spaceName}"?`)) {
                ConfigManager.removeSpace(spaceName);
                NotificationManager.showSuccess(`Removed configuration for ${spaceName}`);

                // Update UI
                const statusSpan = spaceItem.querySelector('.space-status');
                statusSpan.textContent = '⚠ Not Configured';
                statusSpan.className = 'space-status not-configured';

                const apiKeyInput = spaceItem.querySelector('.api-key-input');
                apiKeyInput.value = '';

                const removeBtn = spaceItem.querySelector('.remove-space-btn');
                if (removeBtn) removeBtn.remove();
            }
        }
    }

    // Email Extractor
    class EmailExtractor {
        static extractFromPage() {
            // Try multiple selectors to find email
            const selectors = [
                '[title*="@"]',
                'span:contains("@")',
                '.json-property-value:contains("@")'
            ];

            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element) {
                    const text = element.textContent || element.title;
                    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                    if (emailMatch) {
                        return emailMatch[0];
                    }
                }
            }

            // Fallback: search all text content
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            const pageText = document.body.textContent;
            const matches = pageText.match(emailRegex);
            return matches ? matches[0] : '';
        }
    }

    // Data Type Utilities
    class DataTypeUtils {
        static preserveType(originalValue, newValue) {
            if (originalValue === null || originalValue === undefined) {
                return newValue;
            }

            // Handle arrays separately from objects
            if (Array.isArray(originalValue)) {
                if (typeof newValue === 'string') {
                    try {
                        const parsed = JSON.parse(newValue);
                        if (!Array.isArray(parsed)) {
                            throw new Error('Expected array but got object');
                        }
                        return parsed;
                    } catch {
                        return originalValue;
                    }
                }
                return Array.isArray(newValue) ? newValue : originalValue;
            }

            const originalType = typeof originalValue;

            const num = Number(newValue);
            switch (originalType) {
                case 'boolean':
                    if (typeof newValue === 'string') {
                        return newValue.toLowerCase() === 'true';
                    }
                    return Boolean(newValue);

                case 'number':
                    return isNaN(num) ? originalValue : num;

                case 'object':
                    // Handle objects (but not arrays, which we handled above)
                    if (typeof newValue === 'string') {
                        try {
                            const parsed = JSON.parse(newValue);
                            if (Array.isArray(parsed)) {
                                throw new Error('Expected object but got array');
                            }
                            return parsed;
                        } catch {
                            return originalValue;
                        }
                    }
                    return (typeof newValue === 'object' && !Array.isArray(newValue)) ? newValue : originalValue;

                default: // string
                    return String(newValue);
            }
        }

        static formatForEditing(value) {
            if (typeof value === 'object') {
                return JSON.stringify(value, null, 2);
            }
            return String(value);
        }
    }

    // Notification Manager
    class NotificationManager {
        static show(message, type = 'info', duration = 5000) {
            if (!ConfigManager.getShowNotifications()) return;

            const notification = document.createElement('div');
            notification.className = `${CSS_CLASSES.NOTIFICATION} ${CSS_CLASSES.NOTIFICATION}-${type}`;
            notification.textContent = message;

            document.body.appendChild(notification);

            setTimeout(() => {
                notification.remove();
            }, duration);
        }

        static showSuccess(message) {
            this.show(message, 'success');
        }

        static showError(message) {
            this.show(message, 'error', 8000);
        }

        static showInfo(message) {
            this.show(message, 'info');
        }
    }

    // Field Type Manager
    class FieldTypeManager {
        static fieldTypes = null;
        static existingFields = new Map(); // Store field name -> type mapping
        static currentProfileFields = new Set();

        static async fetchFieldTypes() {
            if (this.fieldTypes) {
                return this.fieldTypes;
            }

            const apiKey = ConfigManager.getCurrentApiKey();

            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: FIELD_MAPPINGS_ENDPOINT,
                    headers: {
                        'Api-Key': apiKey
                    },
                    onload: (response) => {
                        if (response.status >= 200 && response.status < 300) {
                            try {
                                const mappings = JSON.parse(response.responseText);
                                this.processFieldMappings(mappings);
                                resolve(this.fieldTypes);
                            } catch (error) {
                                reject(new Error('Failed to parse field mappings response'));
                            }
                        } else {
                            reject(new Error(`Failed to fetch field mappings: ${response.status}`));
                        }
                    },
                    onerror: () => {
                        reject(new Error('Network error fetching field mappings'));
                    }
                });
            });
        }

        static processFieldMappings(mappings) {
            const uniqueTypes = new Set();

            mappings.forEach(mapping => {
                uniqueTypes.add(mapping.fieldType);
                this.existingFields.set(mapping.fieldName, mapping.fieldType);
            });

            this.fieldTypes = Array.from(uniqueTypes).sort();
        }

        static extractCurrentProfileFields() {
            this.currentProfileFields.clear();

            // Extract field names from the current profile JSON display
            const propertyKeys = document.querySelectorAll('.json-property-key');
            propertyKeys.forEach(keyElement => {
                const fieldPath = UIManager.extractFieldPath(keyElement);
                // Only add top-level fields (no dots in path)
                if (!fieldPath.includes('.')) {
                    this.currentProfileFields.add(fieldPath);
                }
            });
        }

        static getAvailableTypes() {
            return this.fieldTypes || ['string', 'number', 'boolean', 'object', 'nested (array)'];
        }

        static isKnownField(fieldName) {
            return this.existingFields.has(fieldName);
        }

        static isFieldOnCurrentProfile(fieldName) {
            return this.currentProfileFields.has(fieldName);
        }

        static getFieldType(fieldName) {
            return this.existingFields.get(fieldName);
        }

        static getDefaultValueForType(type) {
            switch (type) {
                case 'string':
                    return '';
                case 'number':
                    return 0;
                case 'boolean':
                    return false;
                case 'object':
                    return '{}';
                case 'nested':
                    return '[]';
                default:
                    return '';
            }
        }

        static parseValueForType(value, type) {
            const num = Number(value);
            switch (type) {
                case 'string':
                    return String(value);
                case 'number':
                    if (isNaN(num)) {
                        throw new Error('Invalid number format');
                    }
                    return num;
                case 'boolean':
                    if (typeof value === 'string') {
                        const lower = value.toLowerCase();
                        if (lower === 'true') return true;
                        if (lower === 'false') return false;
                        throw new Error('Boolean must be "true" or "false"');
                    }
                    return Boolean(value);
                case 'object':
                case 'nested':
                    try {
                        return JSON.parse(value);
                    } catch (error) {
                        throw new Error(`Invalid JSON format: ${error.message}`);
                    }
                default:
                    return value;
            }
        }
    }

    // Rollback Manager
    class RollbackManager {
        static originalData = {};

        static saveOriginalState(fieldPath, value) {
            this.originalData[fieldPath] = JSON.parse(JSON.stringify(value));
        }

        static hasRollbackData(fieldPath) {
            return fieldPath in this.originalData;
        }

        static getRollbackData(fieldPath) {
            return this.originalData[fieldPath];
        }

        static clearRollbackData(fieldPath) {
            delete this.originalData[fieldPath];
        }
    }

    // Modal Manager
    class ModalManager {
        static createEditModal(fieldPath, currentValue, originalValue) {
            const overlay = document.createElement('div');
            overlay.className = CSS_CLASSES.EDIT_OVERLAY;

            const modal = document.createElement('div');
            modal.className = CSS_CLASSES.EDIT_MODAL;

            // Determine the actual data type
            let dataType;
            if (Array.isArray(currentValue)) {
                dataType = 'nested (array)';
            } else if (currentValue === null) {
                dataType = 'null';
            } else {
                dataType = typeof currentValue;
            }

            const isComplex = (typeof currentValue === 'object');
            const formattedValue = DataTypeUtils.formatForEditing(currentValue);

            modal.innerHTML = `
                <div class="modal-header">
                    <h3>Edit Field: ${fieldPath}</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="field-info">
                        <strong>Data Type:</strong> ${dataType}
                        ${currentValue === null ? ' (null value)' : ''}
                    </div>
                    <label for="field-value">Value:</label>
                    <textarea id="field-value" rows="${isComplex ? 10 : 3}">${formattedValue}</textarea>

                    <div class="options">
                        <label>
                            <input type="checkbox" id="merge-nested" ${ConfigManager.getMergeNestedObjects() ? 'checked' : ''}>
                            Merge nested objects (safer)
                        </label>
                    </div>

                    <div class="validation-message" id="validation-message"></div>
                </div>
                <div class="modal-footer">
                    ${RollbackManager.hasRollbackData(fieldPath) ?
                        '<button class="rollback-btn">Rollback to Original</button>' : ''
                    }
                    <button class="delete-btn">Delete Field</button>
                    <button class="cancel-btn">Cancel</button>
                    <button class="save-btn">Save Changes</button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            this.attachModalEventHandlers(overlay, modal, fieldPath, currentValue, originalValue);

            // Focus on textarea
            const textarea = modal.querySelector('#field-value');
            textarea.focus();
            textarea.select();
        }

        static async createAddFieldModal() {
            const overlay = document.createElement('div');
            overlay.className = CSS_CLASSES.EDIT_OVERLAY;

            const modal = document.createElement('div');
            modal.className = CSS_CLASSES.EDIT_MODAL;

            // Show loading state while fetching field types
            modal.innerHTML = `
                <div class="modal-header">
                    <h3>Add New Field</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="loading-message">Loading field types...</div>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            try {
                await FieldTypeManager.fetchFieldTypes();
                FieldTypeManager.extractCurrentProfileFields(); // Extract current profile fields
                const fieldTypes = FieldTypeManager.getAvailableTypes();

                modal.innerHTML = `
                    <div class="modal-header">
                        <h3>Add New Field</h3>
                        <button class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="field-name">Field Name:</label>
                            <input type="text" id="field-name" placeholder="e.g., custom_field_name" />
                            <div class="field-hint">Use lowercase, underscores for spaces. No special characters.</div>
                            <div class="field-status" id="field-status"></div>
                        </div>

                        <div class="form-group">
                            <label for="field-type">Data Type:</label>
<select id="field-type">
    <option value="string">string</option>
    <option value="number">number</option>
    <option value="boolean">boolean</option>
    <option value="object">object</option>
    <option value="nested">nested (array)</option>
</select>
                            <div class="field-hint" id="type-status"></div>
                        </div>

                        <div class="form-group">
                            <label for="field-value">Value:</label>
                            <textarea id="field-value" rows="3" placeholder="Enter initial value"></textarea>
                            <div class="field-hint" id="type-hint">Enter a string value</div>
                        </div>

                        <div class="options">
                            <label>
                                <input type="checkbox" id="merge-nested" ${ConfigManager.getMergeNestedObjects() ? 'checked' : ''}>
                                Merge nested objects (safer)
                            </label>
                        </div>

                        <div class="validation-message" id="validation-message"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="cancel-btn">Cancel</button>
                        <button class="save-btn">Add Field</button>
                    </div>
                `;

                this.attachAddFieldEventHandlers(overlay, modal);

                // Focus on field name input
                const fieldNameInput = modal.querySelector('#field-name');
                fieldNameInput.focus();

            } catch (error) {
                modal.innerHTML = `
                    <div class="modal-header">
                        <h3>Add New Field</h3>
                        <button class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="error-message">Failed to load field types: ${error.message}</div>
                        <p>You can still add fields with these basic types:</p>
                        <div class="form-group">
                            <label for="field-name">Field Name:</label>
                            <input type="text" id="field-name" placeholder="e.g., custom_field_name" />
                        </div>

                        <div class="form-group">
                            <label for="field-type">Data Type:</label>
                            <select id="field-type">
                                <option value="string">string</option>
                                <option value="number">number</option>
                                <option value="boolean">boolean</option>
                                <option value="object">object</option>
                                <option value="nested">nested (array)</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="field-value">Value:</label>
                            <textarea id="field-value" rows="3"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="cancel-btn">Cancel</button>
                        <button class="save-btn">Add Field</button>
                    </div>
                `;

                this.attachAddFieldEventHandlers(overlay, modal);
            }
        }

        static attachModalEventHandlers(overlay, modal, fieldPath, currentValue, originalValue) {
            const closeModal = () => overlay.remove();

            // Close button
            modal.querySelector('.close-btn').addEventListener('click', closeModal);

            // Click outside modal
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeModal();
            });

            // Cancel button
            modal.querySelector('.cancel-btn').addEventListener('click', closeModal);

            // Save button
            modal.querySelector('.save-btn').addEventListener('click', () => {
                this.handleSave(modal, fieldPath, currentValue, originalValue, closeModal);
            });

            // Delete button
            modal.querySelector('.delete-btn').addEventListener('click', () => {
                this.handleDelete(modal, fieldPath, closeModal);
            });

            // Rollback button (if exists)
            const rollbackBtn = modal.querySelector('.rollback-btn');
            if (rollbackBtn) {
                rollbackBtn.addEventListener('click', () => {
                    this.handleRollback(modal, fieldPath, closeModal);
                });
            }

            // Real-time validation
            const textarea = modal.querySelector('#field-value');
            textarea.addEventListener('input', () => {
                this.validateInput(modal, currentValue);
            });
        }

        static attachAddFieldEventHandlers(overlay, modal) {
            const closeModal = () => overlay.remove();

            // Close button
            modal.querySelector('.close-btn').addEventListener('click', closeModal);

            // Click outside modal
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeModal();
            });

            // Cancel button
            modal.querySelector('.cancel-btn').addEventListener('click', closeModal);

            // Save button
            modal.querySelector('.save-btn').addEventListener('click', () => {
                this.handleAddField(modal, closeModal);
            });

            // Type change handler
            const typeSelect = modal.querySelector('#field-type');
            const valueTextarea = modal.querySelector('#field-value');
            const typeHint = modal.querySelector('#type-hint');

            if (typeSelect && valueTextarea) {
                typeSelect.addEventListener('change', () => {
                    const selectedType = typeSelect.value;
                    const defaultValue = FieldTypeManager.getDefaultValueForType(selectedType);
                    valueTextarea.value = defaultValue;

                    // Update hint
                    if (typeHint) {
                        switch (selectedType) {
                            case 'string':
                                typeHint.textContent = 'Enter a text value (e.g., "hello world")';
                                break;
                            case 'number':
                                typeHint.textContent = 'Enter a numeric value (e.g., 42, 3.14)';
                                break;
                            case 'boolean':
                                typeHint.textContent = 'Enter "true" or "false"';
                                break;
                            case 'object':
                                typeHint.textContent = 'Enter valid JSON object (e.g., {"name": "value", "count": 42})';
                                break;
                            case 'nested':
                                typeHint.textContent = 'Enter valid JSON array or complex structure (e.g., [1, 2, 3] or [{"id": 1}])';
                                break;
                            default:
                                typeHint.textContent = 'Enter the appropriate value for this type';
                        }
                    }
                });

                // Trigger initial hint update
                typeSelect.dispatchEvent(new Event('change'));
            }

            // Real-time validation
            const fieldNameInput = modal.querySelector('#field-name');
            if (fieldNameInput && valueTextarea && typeSelect) {
                const validateAddField = () => {
                    this.validateAddField(modal);
                };

                fieldNameInput.addEventListener('input', () => {
                    this.handleFieldNameChange(modal);
                    validateAddField();
                });
                valueTextarea.addEventListener('input', validateAddField);
                typeSelect.addEventListener('change', validateAddField);
            }
        }

        static handleFieldNameChange(modal) {
            const fieldNameInput = modal.querySelector('#field-name');
            const typeSelect = modal.querySelector('#field-type');
            const fieldStatus = modal.querySelector('#field-status');
            const typeStatus = modal.querySelector('#type-status');

            const fieldName = fieldNameInput.value.trim();

            if (!fieldName) {
                fieldStatus.textContent = '';
                fieldStatus.className = 'field-status';
                typeSelect.disabled = false;
                typeStatus.textContent = '';
                return;
            }

            if (FieldTypeManager.isFieldOnCurrentProfile(fieldName)) {
                // Field already exists on this profile
                fieldStatus.textContent = '⚠️ Field already exists on this profile - use edit instead';
                fieldStatus.className = 'field-status error';
                typeSelect.disabled = false;
            } else if (FieldTypeManager.isKnownField(fieldName)) {
                // Field exists in system but not on this profile
                const systemType = FieldTypeManager.getFieldType(fieldName);
                fieldStatus.textContent = '✓ Known field - adding to this profile';
                fieldStatus.className = 'field-status success';

                // Pre-select the system type and disable dropdown
                typeSelect.value = systemType;
                typeSelect.disabled = true;
                typeStatus.textContent = `Type locked to "${systemType}" (system defined)`;
                typeStatus.className = 'field-hint locked';

                // Update the default value for this type
                const valueTextarea = modal.querySelector('#field-value');
                if (valueTextarea.value === '' || valueTextarea.value === FieldTypeManager.getDefaultValueForType(typeSelect.value)) {
                    valueTextarea.value = FieldTypeManager.getDefaultValueForType(systemType);
                }
            } else {
                // New field not in system
                fieldStatus.textContent = '✨ New field - will be created in system';
                fieldStatus.className = 'field-status new';
                typeSelect.disabled = false;
                typeStatus.textContent = 'Choose the data type for this new field';
                typeStatus.className = 'field-hint';
            }
        }

        static validateAddField(modal) {
            const fieldNameInput = modal.querySelector('#field-name');
            const typeSelect = modal.querySelector('#field-type');
            const valueTextarea = modal.querySelector('#field-value');
            const validationMessage = modal.querySelector('#validation-message');
            const saveBtn = modal.querySelector('.save-btn');

            let isValid = true;
            let errorMessage = '';

            // Validate field name
            const fieldName = fieldNameInput.value.trim();
            if (!fieldName) {
                isValid = false;
                errorMessage = 'Field name is required';
            } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fieldName)) {
                isValid = false;
                errorMessage = 'Field name must start with letter or underscore, contain only letters, numbers, and underscores';
            } else if (FieldTypeManager.isFieldOnCurrentProfile(fieldName)) {
                // Only block if field exists on THIS profile
                isValid = false;
                errorMessage = 'Field already exists on this profile - use edit instead';
            }

            // Validate value for selected type
            if (isValid) {
                try {
                    const selectedType = typeSelect.value;
                    const value = valueTextarea.value.trim();
                    FieldTypeManager.parseValueForType(value, selectedType);
                } catch (error) {
                    isValid = false;
                    errorMessage = error.message;
                }
            }

            // Update UI
            if (isValid) {
                validationMessage.textContent = '';
                validationMessage.className = 'validation-message';
                saveBtn.disabled = false;
            } else {
                validationMessage.textContent = errorMessage;
                validationMessage.className = 'validation-message error';
                saveBtn.disabled = true;
            }
        }

        static async handleAddField(modal, closeModal) {
            const fieldNameInput = modal.querySelector('#field-name');
            const typeSelect = modal.querySelector('#field-type');
            const valueTextarea = modal.querySelector('#field-value');
            const mergeNested = modal.querySelector('#merge-nested').checked;

            try {
                const fieldName = fieldNameInput.value.trim();
                const selectedType = typeSelect.value;
                const rawValue = valueTextarea.value.trim();

                const parsedValue = FieldTypeManager.parseValueForType(rawValue, selectedType);

                await APIManager.updateUserField(fieldName, parsedValue, mergeNested);
                NotificationManager.showSuccess(`Successfully added field: ${fieldName}`);
                closeModal();

                // Suggest page refresh to see the new field
                NotificationManager.showInfo('Refresh the page to see the new field in the JSON view');

            } catch (error) {
                NotificationManager.showError(`Failed to add field: ${error.message}`);
            }
        }

        static validateInput(modal, originalValue) {
            const textarea = modal.querySelector('#field-value');
            const validationMessage = modal.querySelector('#validation-message');
            const saveBtn = modal.querySelector('.save-btn');

            try {
                const newValue = textarea.value.trim();

                // Determine original data type
                let originalType;
                if (Array.isArray(originalValue)) {
                    originalType = 'nested';
                } else if (originalValue === null) {
                    originalType = 'null';
                } else {
                    originalType = typeof originalValue;
                }

                // Validate based on original type
                if (originalType === 'object' || originalType === 'nested') {
                    const parsed = JSON.parse(newValue);

                    // Check if array/object type matches for nested
                    if (originalType === 'nested' && Array.isArray(originalValue) && !Array.isArray(parsed)) {
                        throw new Error('Value must be a valid JSON array (e.g., [1, 2, 3])');
                    } else if (originalType === 'object' && Array.isArray(parsed)) {
                        throw new Error('Value must be a valid JSON object (e.g., {"key": "value"})');
                    }
                }

                validationMessage.textContent = '';
                validationMessage.className = 'validation-message';
                saveBtn.disabled = false;
            } catch (error) {
                validationMessage.textContent = `Validation error: ${error.message}`;
                validationMessage.className = 'validation-message error';
                saveBtn.disabled = true;
            }
        }

        static async handleSave(modal, fieldPath, currentValue, originalValue, closeModal) {
            const textarea = modal.querySelector('#field-value');
            const mergeNested = modal.querySelector('#merge-nested').checked;

            try {
                const newValue = DataTypeUtils.preserveType(currentValue, textarea.value.trim());

                // Save original state for rollback if this is the first edit
                if (!RollbackManager.hasRollbackData(fieldPath)) {
                    RollbackManager.saveOriginalState(fieldPath, originalValue);
                }

                await APIManager.updateUserField(fieldPath, newValue, mergeNested);
                NotificationManager.showSuccess(`Successfully updated ${fieldPath}`);
                closeModal();

                // Update the UI
                UIManager.updateFieldDisplay(fieldPath, newValue);

            } catch (error) {
                NotificationManager.showError(`Failed to update ${fieldPath}: ${error.message}`);
            }
        }

        static async handleDelete(modal, fieldPath, closeModal) {
            // Show confirmation dialog
            const confirmed = confirm(`Are you sure you want to delete the field "${fieldPath}"?\n\nThis will set the field value to null and remove it from this profile.`);

            if (!confirmed) {
                return;
            }

            try {
                // Save original state for rollback before deleting
                const currentValue = modal.querySelector('#field-value').value;
                if (!RollbackManager.hasRollbackData(fieldPath)) {
                    try {
                        const parsedCurrentValue = JSON.parse(currentValue);
                        RollbackManager.saveOriginalState(fieldPath, parsedCurrentValue);
                    } catch {
                        RollbackManager.saveOriginalState(fieldPath, currentValue);
                    }
                }

                // Set field to null
                await APIManager.updateUserField(fieldPath, null, false);
                NotificationManager.showSuccess(`Successfully deleted field: ${fieldPath}`);
                closeModal();

                // Update the UI
                UIManager.updateFieldDisplay(fieldPath, null);

            } catch (error) {
                NotificationManager.showError(`Failed to delete ${fieldPath}: ${error.message}`);
            }
        }

        static async handleRollback(modal, fieldPath, closeModal) {
            try {
                const originalValue = RollbackManager.getRollbackData(fieldPath);
                await APIManager.updateUserField(fieldPath, originalValue, true);

                NotificationManager.showSuccess(`Successfully rolled back ${fieldPath}`);
                RollbackManager.clearRollbackData(fieldPath);
                closeModal();

                // Update the UI
                UIManager.updateFieldDisplay(fieldPath, originalValue);

            } catch (error) {
                NotificationManager.showError(`Failed to rollback ${fieldPath}: ${error.message}`);
            }
        }
    }

    // API Manager
    class APIManager {
        static async updateUserField(fieldPath, value, mergeNestedObjects = true) {
            const apiKey = ConfigManager.getCurrentApiKey(); // This will throw if no key found

            const email = EmailExtractor.extractFromPage();
            if (!email) {
                throw new Error('Could not extract email from page');
            }

            const dataFields = {};
            this.setNestedProperty(dataFields, fieldPath, value);

            const requestBody = {
                createNewFields: true,
                dataFields: dataFields,
                email: email,
                mergeNestedObjects: mergeNestedObjects
            };

            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: API_ENDPOINT,
                    headers: {
                        'Content-Type': 'application/json',
                        'Api-Key': apiKey
                    },
                    data: JSON.stringify(requestBody),
                    onload: (response) => {
                        if (response.status >= 200 && response.status < 300) {
                            resolve(response);
                        } else {
                            reject(new Error(`API request failed: ${response.status} ${response.statusText}`));
                        }
                    },
                    onerror: (error) => {
                        reject(new Error('Network error during API request'));
                    }
                });
            });
        }

        static setNestedProperty(obj, path, value) {
            const keys = path.split('.');
            let current = obj;

            for (let i = 0; i < keys.length - 1; i++) {
                if (!(keys[i] in current)) {
                    current[keys[i]] = {};
                }
                current = current[keys[i]];
            }

            current[keys[keys.length - 1]] = value;
        }
    }

    // UI Manager
    class UIManager {
        static initializeEditButtons() {
            // Add the "Add New Field" button first
            this.addNewFieldButton();

            // Find all JSON property keys
            const propertyKeys = document.querySelectorAll('.json-property-key');

            propertyKeys.forEach(keyElement => {
                this.addEditButton(keyElement);
            });
        }

        static addNewFieldButton() {
            // Check if button already exists
            if (document.querySelector('.iterable-add-field-btn')) {
                return;
            }

            // Find a good place to insert the button - near the JSON toggle or page header
            const targetSelectors = [
                '[data-test="page-header-page-actions"]',
                '.sc-cPYVkA', // based on the class in your HTML
                '.sc-bPEbuy', // container with JSON toggle
                '.json-root'
            ];

            let targetElement = null;
            for (const selector of targetSelectors) {
                targetElement = document.querySelector(selector);
                if (targetElement) break;
            }

            if (!targetElement) {
                // Fallback - add to the JSON container
                targetElement = document.querySelector('.sc-bPEbuy');
                if (!targetElement) return;
            }

            const addFieldContainer = document.createElement('div');
            addFieldContainer.className = 'iterable-add-field-container';

            const addFieldButton = document.createElement('button');
            addFieldButton.className = 'iterable-add-field-btn';
            addFieldButton.innerHTML = '➕ Add New Field';
            addFieldButton.title = 'Add a new user profile field';

            addFieldButton.addEventListener('click', () => {
                ModalManager.createAddFieldModal();
            });

            addFieldContainer.appendChild(addFieldButton);

            // Insert the button at the top of the target element
            targetElement.insertBefore(addFieldContainer, targetElement.firstChild);
        }

        static addEditButton(keyElement) {
            // Skip if button already exists
            if (keyElement.querySelector(`.${CSS_CLASSES.EDIT_BUTTON}`)) {
                return;
            }

            // Extract field info BEFORE adding the button
            const fieldPath = this.extractFieldPath(keyElement);
            const currentValue = this.extractFieldValue(keyElement);

            const editButton = document.createElement('button');
            editButton.className = CSS_CLASSES.EDIT_BUTTON;
            editButton.innerHTML = '✏️';
            editButton.title = `Edit ${fieldPath}`;

            // Store the original field path as data attribute for reference
            editButton.setAttribute('data-field-path', fieldPath);

            editButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Use the stored field path instead of extracting again
                const originalFieldPath = e.target.getAttribute('data-field-path');
                ModalManager.createEditModal(originalFieldPath, currentValue, currentValue);
            });

            keyElement.appendChild(editButton);
        }

        static extractFieldPath(keyElement) {
            // Extract the field name from the key element, excluding any edit buttons
            const keyElementClone = keyElement.cloneNode(true);
            // Remove any edit buttons from the clone
            const editButtons = keyElementClone.querySelectorAll(`.${CSS_CLASSES.EDIT_BUTTON}`);
            editButtons.forEach(btn => btn.remove());

            const keyText = keyElementClone.textContent;
            const fieldName = keyText.replace(/[":]/g, '').trim();

            // Check if this is a nested field by traversing up the DOM
            const path = [fieldName];
            let current = keyElement.closest('.json-branch');

            while (current) {
                const parentKey = current.querySelector('.json-property-key');
                if (parentKey && parentKey !== keyElement) {
                    // Clone and clean parent key as well
                    const parentKeyClone = parentKey.cloneNode(true);
                    const parentEditButtons = parentKeyClone.querySelectorAll(`.${CSS_CLASSES.EDIT_BUTTON}`);
                    parentEditButtons.forEach(btn => btn.remove());

                    const parentFieldName = parentKeyClone.textContent.replace(/[":]/g, '').trim();
                    path.unshift(parentFieldName);
                }
                current = current.parentElement.closest('.json-branch');
            }

            return path.join('.');
        }

        static extractFieldValue(keyElement) {
            // Find the corresponding value element
            const leaf = keyElement.closest('.json-leaf');
            if (!leaf) return null;

            const valueElement = leaf.querySelector('.json-property-value');
            if (!valueElement) return null;

            const valueText = valueElement.textContent.trim();

            // Determine the type and parse accordingly
            if (valueElement.classList.contains('json-property-string')) {
                return valueText.replace(/^"|"$/g, ''); // Remove quotes
            } else if (valueElement.classList.contains('json-property-number')) {
                return Number(valueText);
            } else if (valueElement.classList.contains('json-property-boolean')) {
                return valueText === 'true';
            } else if (valueElement.classList.contains('json-property-object')) {
                // For objects, we need to parse the entire object
                return this.parseObjectValue(keyElement);
            } else if (valueElement.classList.contains('json-property-array')) {
                return this.parseArrayValue(keyElement);
            }

            return valueText;
        }

        static parseObjectValue(keyElement) {
            // Try to parse the object structure from the DOM
            const branch = keyElement.closest('.json-branch');
            if (!branch) return {};

            const branchValue = branch.querySelector('[data-test="json-branch-value"]');
            if (!branchValue) return {};

            // This is complex - for now, return empty object
            // In a future version, we could traverse the DOM to reconstruct the object
            return {};
        }

        static parseArrayValue(keyElement) {
            // Try to parse the array structure from the DOM
            const branch = keyElement.closest('.json-branch');
            if (!branch) return [];

            const branchValue = branch.querySelector('[data-test="json-branch-value"]');
            if (!branchValue) return [];

            // Look for array indices in the DOM
            const arrayItems = branchValue.querySelectorAll('[data-array-index]');
            if (arrayItems.length > 0) {
                const result = [];
                arrayItems.forEach(item => {
                    const valueElement = item.nextElementSibling;
                    if (valueElement) {
                        const value = valueElement.textContent.trim();
                        // Try to parse as number first, then string
                        const numValue = Number(value);
                        result.push(isNaN(numValue) ? value.replace(/^"|"$/g, '') : numValue);
                    }
                });
                return result;
            }

            return [];
        }

        static updateFieldDisplay(fieldPath, newValue) {
            // Find and update the field display in the UI
            // This would involve finding the right element and updating its content
            // For now, we could show a notification that page refresh might be needed
            if (newValue === null) {
                NotificationManager.showInfo('Field deleted. Refresh page to see changes.');
            } else {
                NotificationManager.showInfo('Field updated. Refresh page to see changes.');
            }
        }
    }

    // CSS Injection
    function injectCSS() {
        const style = document.createElement('style');
        style.textContent = `
            /* Edit Button Styles */
            .${CSS_CLASSES.EDIT_BUTTON} {
                background: none;
                border: none;
                cursor: pointer;
                margin-left: 8px;
                padding: 2px 4px;
                border-radius: 3px;
                opacity: 0.3;
                transition: opacity 0.2s, background-color 0.2s;
                font-size: 12px;
            }

            .${CSS_CLASSES.EDIT_BUTTON}:hover {
                opacity: 1;
                background-color: rgba(181, 109, 198, 0.1);
            }

            .json-property-key:hover .${CSS_CLASSES.EDIT_BUTTON} {
                opacity: 0.7;
            }

            /* Add New Field Button */
            .iterable-add-field-container {
                background: #f8f9fa;
                border-radius: 8px;
            }

            .iterable-add-field-btn {
                background: #28a745;
                color: white;
                border: none;
                padding: 10px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: background-color 0.2s;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .iterable-add-field-btn:hover {
                background: #218838;
            }

            /* Modal Styles */
            .${CSS_CLASSES.EDIT_OVERLAY} {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            }

            .${CSS_CLASSES.EDIT_MODAL} {
                background: white;
                border-radius: 8px;
                width: 90%;
                max-width: 600px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            }

            .modal-header {
                padding: 16px 20px;
                border-bottom: 1px solid #eee;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .modal-header h3 {
                margin: 0;
                color: #333;
            }

            .close-btn {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .modal-body {
                padding: 20px;
            }

            .field-info {
                margin-bottom: 12px;
                padding: 8px 12px;
                background: #f5f5f5;
                border-radius: 4px;
                font-size: 14px;
                color: #666;
            }

            .modal-body label {
                display: block;
                margin-bottom: 8px;
                font-weight: bold;
                color: #333;
            }

            .modal-body textarea {
                width: 100%;
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 12px;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 14px;
                resize: vertical;
                box-sizing: border-box;
            }

            /* Space Configuration Styles */
            .current-space-info {
                margin-bottom: 20px;
                padding: 12px;
                background: #e3f2fd;
                border-radius: 6px;
                border-left: 4px solid #2196f3;
            }

            .space-list, .configured-spaces {
                margin-bottom: 20px;
            }

            .space-list h4, .configured-spaces h4 {
                margin: 0 0 12px 0;
                color: #333;
                font-size: 16px;
            }

            .space-config-item {
                border: 1px solid #ddd;
                border-radius: 6px;
                padding: 12px;
                margin-bottom: 12px;
                background: #fafafa;
            }

            .space-info {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }

            .space-status {
                font-size: 12px;
                padding: 4px 8px;
                border-radius: 12px;
                font-weight: 500;
            }

            .space-status.configured {
                background: #d4edda;
                color: #155724;
            }

            .space-status.not-configured {
                background: #f8d7da;
                color: #721c24;
            }

            .space-controls {
                display: flex;
                gap: 8px;
                align-items: center;
            }

            .api-key-input {
                flex: 1;
                padding: 6px 10px;
                border: 1px solid #ccc;
                border-radius: 4px;
                font-size: 14px;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            }

            .save-space-btn {
                background: #007bff;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            }

            .save-space-btn:hover {
                background: #0056b3;
            }

            .remove-space-btn {
                background: #dc3545;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            }

            .remove-space-btn:hover {
                background: #c82333;
            }

            .configured-space-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 12px;
                background: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 4px;
                margin-bottom: 8px;
            }

            .space-details {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .masked-key {
                font-size: 12px;
                color: #666;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            }

            .remove-configured-btn {
                background: #6c757d;
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            }

            .remove-configured-btn:hover {
                background: #545b62;
            }

            .no-spaces {
                text-align: center;
                color: #666;
                font-style: italic;
                padding: 20px;
            }

            .manual-config {
                margin-top: 20px;
                padding: 16px;
                background: #fff3cd;
                border: 1px solid #ffeeba;
                border-radius: 6px;
            }

            .manual-config h4 {
                margin-top: 0;
                color: #856404;
            }

            .save-manual-btn {
                background: #ffc107;
                color: #212529;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 500;
            }

            .save-manual-btn:hover {
                background: #e0a800;
            }

            /* Form Elements */
            .form-group {
                margin-bottom: 16px;
            }

            .form-group label {
                display: block;
                margin-bottom: 6px;
                font-weight: bold;
                color: #333;
            }

            .form-group input[type="text"],
            .form-group input[type="password"],
            .form-group select {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
                box-sizing: border-box;
            }

            .form-group select {
                cursor: pointer;
            }

            .form-group select:disabled {
                background-color: #f8f9fa;
                color: #6c757d;
                cursor: not-allowed;
                border-color: #dee2e6;
            }

            .field-hint {
                margin-top: 4px;
                font-size: 12px;
                color: #666;
                font-style: italic;
            }

            .field-hint.locked {
                color: #e67e22;
                font-weight: 500;
            }

            .field-status {
                margin-top: 6px;
                padding: 6px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 500;
            }

            .field-status.success {
                background: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
            }

            .field-status.error {
                background: #f8d7da;
                color: #721c24;
                border: 1px solid #f5c6cb;
            }

            .field-status.new {
                background: #d1ecf1;
                color: #0c5460;
                border: 1px solid #bee5eb;
            }

            .loading-message {
                text-align: center;
                padding: 20px;
                color: #666;
            }

            .error-message {
                background: #fee;
                color: #c00;
                padding: 12px;
                border-radius: 4px;
                border: 1px solid #fcc;
                margin-bottom: 16px;
            }

            .options {
                margin: 16px 0;
                padding: 12px;
                background: #f9f9f9;
                border-radius: 4px;
            }

            .options label {
                font-weight: normal;
                display: flex;
                align-items: center;
                margin: 0;
            }

            .options input[type="checkbox"] {
                margin-right: 8px;
            }

            .validation-message {
                margin-top: 8px;
                padding: 8px;
                border-radius: 4px;
                font-size: 14px;
            }

            .validation-message.error {
                background: #fee;
                color: #c00;
                border: 1px solid #fcc;
            }

            .modal-footer {
                padding: 16px 20px;
                border-top: 1px solid #eee;
                display: flex;
                justify-content: flex-end;
                gap: 12px;
            }

            .modal-footer button {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                transition: background-color 0.2s;
            }

            .cancel-btn {
                background: #f5f5f5;
                color: #666;
            }

            .cancel-btn:hover {
                background: #e5e5e5;
            }

            .save-btn {
                background: #b56dc6;
                color: white;
            }

            .save-btn:hover:not(:disabled) {
                background: #a355b8;
            }

            .save-btn:disabled {
                background: #ccc;
                cursor: not-allowed;
            }

            .delete-btn {
                background: #dc3545;
                color: white;
                margin-right: auto;
            }

            .delete-btn:hover {
                background: #c82333;
            }

            .rollback-btn {
                background: #ff6b6b;
                color: white;
            }

            .rollback-btn:hover {
                background: #ff5252;
            }

            /* Notification Styles */
.${CSS_CLASSES.NOTIFICATION} {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 16px;
    border-radius: 4px;
    color: white;
    font-size: 14px;
    z-index: 10001;
    max-width: 400px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    animation: slideIn 0.3s ease-out;
}

            .${CSS_CLASSES.NOTIFICATION}-success {
                background: #4caf50;
            }

            .${CSS_CLASSES.NOTIFICATION}-error {
                background: #f44336;
            }

            .${CSS_CLASSES.NOTIFICATION}-info {
                background: #2196f3;
            }

            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Configuration Menu
    function setupConfigMenu() {
        GM_registerMenuCommand('Manage Spaces & API Keys', () => {
            SpaceConfigModal.create();
        });
    }

    // Initialize the userscript
    async function initialize() {
        // Wait for the page to load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialize);
            return;
        }

        injectCSS();
        setupConfigMenu();

        try {
            // Initialize current space context
            await SpaceManager.initializeCurrentSpace();
        } catch (error) {
            console.warn('Failed to initialize space context:', error);
            NotificationManager.showError('Could not determine current Iterable space. Some features may not work properly.');
        }

        // Wait a bit for dynamic content to load
        setTimeout(() => {
            UIManager.initializeEditButtons();

            // Set up observer for dynamically added content
            const observer = new MutationObserver((mutations) => {
                let shouldUpdate = false;
                mutations.forEach((mutation) => {
                    if (mutation.addedNodes.length > 0) {
                        shouldUpdate = true;
                    }
                });

                if (shouldUpdate) {
                    setTimeout(() => UIManager.initializeEditButtons(), 100);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

        }, 1000);
    }

    // Start the userscript
    initialize();

})();
