// ==UserScript==
// @name         Enhanced User Lookup Bar
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Adds a persistent user lookup bar with auto-detection and enhanced preview
// @author       Colin Whelan
// @match        https://app.iterable.com/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';
    console.log('[Enhanced User Lookup Bar] STARTING');

    // ── Constants ───────────────────────────────────────────
    const SELECTORS = {
        navbar: '#navbar',
        logo: '#navbar-logo',
        container: '#iterable-user-lookup'
    };

    // Add styles for the lookup bar, preview, and messages
    GM_addStyle(`
        .user-lookup-container {
            display: flex;
            align-items: center;
            grid-area: links;
            margin-left: 16px;
            position: relative;
            border-left: 1px solid #e0e0e0;
            padding-left: 16px;
        }
        .user-lookup-input {
            height: 32px;
            width: 300px;
            border-radius: 4px;
            border: 1px solid #ccc;
            padding: 0 12px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
        }
        .user-lookup-input:focus {
            border-color: #1976d2;
        }
        .user-lookup-button {
            height: 32px;
            margin-left: 8px;
            padding: 0 12px;
            border: none;
            border-radius: 4px;
            background-color: #1976d2;
            color: white;
            font-size: 14px;
            cursor: pointer;
            transition: background-color 0.2s;
            min-width: 70px;
        }
        .user-lookup-button:hover:not(:disabled) {
            background-color: #1565c0;
        }
        .user-lookup-button:disabled {
            background-color: #ccc;
            cursor: not-allowed;
        }
        .lookup-type-indicator {
            font-size: 12px;
            color: #666;
            margin-left: 4px;
            font-style: italic;
        }
        .lookup-message {
            position: absolute;
            top: 100%;
            left: 16px;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 14px;
            z-index: 1000;
            margin-top: 4px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            max-width: 300px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .lookup-error {
            background-color: #ffebee;
            color: #c62828;
            border: 1px solid #ef9a9a;
        }
        .user-preview {
            position: absolute;
            top: 100%;
            left: 16px;
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            margin-top: 4px;
            min-width: 350px;
            max-width: 500px;
        }
        .user-preview-header {
            background: #f5f5f5;
            padding: 12px 16px;
            border-bottom: 1px solid #ddd;
            border-radius: 8px 8px 0 0;
            font-weight: 600;
            color: #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .user-preview-close {
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            color: #666;
            padding: 0;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .user-preview-close:hover {
            background: #e0e0e0;
            color: #333;
        }
        .user-preview-content {
            padding: 16px;
        }
        .user-preview-field {
            margin-bottom: 12px;
            display: flex;
            align-items: flex-start;
        }
        .user-preview-field:last-child {
            margin-bottom: 0;
        }
        .user-preview-label {
            font-weight: 600;
            color: #555;
            min-width: 80px;
            margin-right: 12px;
            font-size: 14px;
        }
        .user-preview-value {
            color: #333;
            font-size: 14px;
            word-break: break-all;
            flex: 1;
        }
        .user-preview-actions {
            padding: 12px 16px;
            border-top: 1px solid #ddd;
            background: #fafafa;
            border-radius: 0 0 8px 8px;
            display: flex;
            gap: 8px;
        }
        .user-preview-button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .user-preview-button.primary {
            background-color: #1976d2;
            color: white;
        }
        .user-preview-button.primary:hover {
            background-color: #1565c0;
        }
        .user-preview-button.secondary {
            background-color: white;
            color: #333;
            border: 1px solid #ddd;
        }
        .user-preview-button.secondary:hover {
            background-color: #f5f5f5;
        }
    `);

    // Function to create and add the lookup bar
    function addLookupBar() {
        const navbar = document.querySelector(SELECTORS.navbar);
        if (!navbar || !navbar.querySelector(SELECTORS.logo)) return;
        if (navbar.querySelector(SELECTORS.container)) return;

        // Create lookup container
        const lookupContainer = document.createElement('div');
        lookupContainer.className = 'user-lookup-container';
        lookupContainer.id = 'iterable-user-lookup';

        // Create search input
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'user-lookup-input';
        searchInput.id = 'user-lookup-input';
        searchInput.placeholder = 'Enter email or user ID...';
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                performLookup();
            }
        });

        // Add input event listener to show lookup type
        searchInput.addEventListener('input', updateLookupType);

        lookupContainer.appendChild(searchInput);

        // Create type indicator
        const typeIndicator = document.createElement('span');
        typeIndicator.className = 'lookup-type-indicator';
        typeIndicator.id = 'lookup-type-indicator';
        lookupContainer.appendChild(typeIndicator);

        // Create search button
        const searchButton = document.createElement('button');
        searchButton.className = 'user-lookup-button';
        searchButton.textContent = 'Lookup';
        searchButton.addEventListener('click', performLookup);
        lookupContainer.appendChild(searchButton);

        // Insert directly after the logo (same spot as quicklinks)
        const logo = navbar.querySelector(SELECTORS.logo);
        logo.insertAdjacentElement('afterend', lookupContainer);
    }

    // Function to update lookup type indicator
    function updateLookupType() {
        const inputValue = document.getElementById('user-lookup-input').value.trim();
        const typeIndicator = document.getElementById('lookup-type-indicator');

        if (inputValue) {
            const isEmail = inputValue.includes('@');
            typeIndicator.textContent = isEmail ? '(email)' : '(user ID)';
        } else {
            typeIndicator.textContent = '';
        }
    }

    // Function to perform the user lookup
    function performLookup() {
        // Get input value
        const inputValue = document.getElementById('user-lookup-input').value.trim();

        if (!inputValue) {
            showMessage('Please enter an email address or user ID', 'error');
            return;
        }

        // Auto-detect if it's an email or user ID
        const isEmail = inputValue.includes('@');

        // Show loading state
        const searchButton = document.querySelector('.user-lookup-button');
        const originalText = searchButton.textContent;
        searchButton.textContent = 'Loading...';
        searchButton.disabled = true;

        // Hide any existing preview
        hideUserPreview();

        // Build the URL
        const url = isEmail
            ? `https://app.iterable.com/users/profiles/getUserData?email=${encodeURIComponent(inputValue)}`
            : `https://app.iterable.com/users/profiles/getUserData?userId=${encodeURIComponent(inputValue)}`;

        // Make the request
        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            headers: {
                'Accept': 'application/json',
            },
            onload: function(response) {
                searchButton.textContent = originalText;
                searchButton.disabled = false;

                try {
                    const data = JSON.parse(response.responseText);

                    if (data.error) {
                        // User not found
                        showMessage(`User not found: ${data.message || 'Not found'}`, 'error');
                    } else if (data.itblUserId || data.email) {
                        // User found, show preview
                        showUserPreview(data);
                    } else {
                        // Unexpected response
                        showMessage('Unexpected response format', 'error');
                        console.error('Unexpected API response:', data);
                    }
                } catch (e) {
                    // Error parsing response
                    showMessage('Error processing response', 'error');
                    console.error('Error parsing API response:', e, response.responseText);
                }
            },
            onerror: function(error) {
                searchButton.textContent = originalText;
                searchButton.disabled = false;
                showMessage('Error connecting to the server', 'error');
                console.error('API request error:', error);
            }
        });
    }

    // Function to show user preview
    function showUserPreview(userData) {
        // Remove any existing preview or message
        hideUserPreview();
        const existingMessage = document.querySelector('.lookup-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Create preview element
        const previewElement = document.createElement('div');
        previewElement.className = 'user-preview';
        previewElement.id = 'user-preview';

        // Create header
        const header = document.createElement('div');
        header.className = 'user-preview-header';
        header.innerHTML = `
            <span>User Found</span>
            <button class="user-preview-close" onclick="document.getElementById('user-preview').remove()">×</button>
        `;
        previewElement.appendChild(header);

        // Create content
        const content = document.createElement('div');
        content.className = 'user-preview-content';

        // Add fields that exist
        const userId = userData.userId || userData.itblUserId
        if (userId) {
            const userIdField = document.createElement('div');
            userIdField.className = 'user-preview-field';
            userIdField.innerHTML = `
                <span class="user-preview-label">User ID:</span>
                <span class="user-preview-value">${userId}</span>
            `;
            content.appendChild(userIdField);
        }

        if (userData.email) {
            const emailField = document.createElement('div');
            emailField.className = 'user-preview-field';
            emailField.innerHTML = `
                <span class="user-preview-label">Email:</span>
                <span class="user-preview-value">${userData.email}</span>
            `;
            content.appendChild(emailField);
        }

        // Add other useful fields if they exist
        const additionalFields = [
            { key: 'firstName', label: 'First Name' },
            { key: 'lastName', label: 'Last Name' },
            { key: 'signupDate', label: 'Signup Date' },
            { key: 'lastSeenDate', label: 'Last Seen' }
        ];

        additionalFields.forEach(field => {
            if (userData[field.key]) {
                const fieldElement = document.createElement('div');
                fieldElement.className = 'user-preview-field';
                let value = userData[field.key];

                // Format dates
                if (field.key.includes('Date') && value) {
                    try {
                        value = new Date(value).toLocaleDateString();
                    } catch (e) {
                        // Keep original value if date parsing fails
                    }
                }

                fieldElement.innerHTML = `
                    <span class="user-preview-label">${field.label}:</span>
                    <span class="user-preview-value">${value}</span>
                `;
                content.appendChild(fieldElement);
            }
        });

        previewElement.appendChild(content);

        // Create actions
        if (userData.itblUserId) {
            const actions = document.createElement('div');
            actions.className = 'user-preview-actions';

            const goToProfileBtn = document.createElement('button');
            goToProfileBtn.className = 'user-preview-button primary';
            goToProfileBtn.textContent = 'Go to Profile';
            goToProfileBtn.addEventListener('click', () => {
                window.location.href = `https://app.iterable.com/users/profiles/${userData.itblUserId}`;
            });
            actions.appendChild(goToProfileBtn);

            const closeBtn = document.createElement('button');
            closeBtn.className = 'user-preview-button secondary';
            closeBtn.textContent = 'Close';
            closeBtn.addEventListener('click', () => {
                previewElement.remove();
            });
            actions.appendChild(closeBtn);

            previewElement.appendChild(actions);
        }

        // Add to container
        const container = document.getElementById('iterable-user-lookup');
        container.appendChild(previewElement);

        // Auto-hide after 15 seconds
        setTimeout(() => {
            if (previewElement.parentNode) {
                previewElement.remove();
            }
        }, 15000);
    }

    // Function to hide user preview
    function hideUserPreview() {
        const existingPreview = document.getElementById('user-preview');
        if (existingPreview) {
            existingPreview.remove();
        }
    }

    // Function to show message
    function showMessage(message, type) {
        // Remove any existing message or preview
        const existingMessage = document.querySelector('.lookup-message');
        if (existingMessage) {
            existingMessage.remove();
        }
        hideUserPreview();

        // Create message element
        const messageElement = document.createElement('div');
        messageElement.className = `lookup-message lookup-${type}`;
        messageElement.textContent = message;

        // Add to container
        const container = document.getElementById('iterable-user-lookup');
        container.appendChild(messageElement);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.remove();
            }
        }, 5000);
    }

    // Function to initialize the script
    function init() {
        const navbar = document.querySelector(SELECTORS.navbar);
        if (!navbar || !navbar.querySelector(SELECTORS.logo)) {
            // If the navbar isn't loaded yet, wait and try again
            setTimeout(init, 500);
            return;
        }

        // Check if lookup bar already exists
        if (navbar.querySelector(SELECTORS.container)) {
            return;
        }

        // Add the lookup bar
        addLookupBar();
    }

    // Hide preview when clicking outside
    document.addEventListener('click', (e) => {
        const preview = document.getElementById('user-preview');
        const container = document.getElementById('iterable-user-lookup');

        if (preview && container && !container.contains(e.target)) {
            preview.remove();
        }
    });

    // Wait for the page to load
    window.addEventListener('load', init);

    // Also run on page changes for single-page apps
    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            setTimeout(init, 500);
        }
    }).observe(document, {subtree: true, childList: true});

    // Also try to handle dynamic UI updates
    new MutationObserver(() => {
        const navbar = document.querySelector(SELECTORS.navbar);
        if (navbar && navbar.querySelector(SELECTORS.logo) &&
            !navbar.querySelector(SELECTORS.container)) {
            init();
        }
    }).observe(document.body, {childList: true, subtree: true});

    // Initial run in case the page is already loaded
    init();
})();
