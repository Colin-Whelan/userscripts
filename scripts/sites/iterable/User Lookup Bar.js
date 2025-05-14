// ==UserScript==
// @name         User Lookup Bar
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds a persistent user lookup bar to the Iterable navigation
// @author       Colin Whelan
// @match        https://app.iterable.com/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // Add styles for the lookup bar and messages
    GM_addStyle(`
        .user-lookup-container {
            display: flex;
            align-items: center;
            margin-left: 16px;
            position: relative;
            border-left: 1px solid #e0e0e0;
            padding-left: 16px;
        }
        .user-lookup-input {
            height: 32px;
            width: 250px;
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
        }
        .user-lookup-button:hover {
            background-color: #1565c0;
        }
        .lookup-toggle {
            display: flex;
            align-items: center;
            margin-right: 8px;
            user-select: none;
        }
        .lookup-toggle-label {
            font-size: 14px;
            margin-right: 4px;
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
        .lookup-success {
            background-color: #e8f5e9;
            color: #2e7d32;
            border: 1px solid #a5d6a7;
        }
        .toggle-switch {
            position: relative;
            display: inline-block;
            width: 40px;
            height: 20px;
            margin: 0 8px;
        }
        .toggle-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        .toggle-slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #ccc;
            transition: .3s;
            border-radius: 20px;
        }
        .toggle-slider:before {
            position: absolute;
            content: "";
            height: 16px;
            width: 16px;
            left: 2px;
            bottom: 2px;
            background-color: white;
            transition: .3s;
            border-radius: 50%;
        }
        input:checked + .toggle-slider {
            background-color: #1976d2;
        }
        input:checked + .toggle-slider:before {
            transform: translateX(20px);
        }
    `);

    // Function to create and add the lookup bar
    function addLookupBar() {
        // Find the navbar links list
        const navbarLinksList = document.querySelector('ul[id="navbar-links-list"]');
        if (!navbarLinksList) return;

        // Create lookup container
        const lookupContainer = document.createElement('div');
        lookupContainer.className = 'user-lookup-container';
        lookupContainer.id = 'iterable-user-lookup';

        // Create toggle switch container
        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'lookup-toggle';

        // Add Email label
        const emailLabel = document.createElement('span');
        emailLabel.className = 'lookup-toggle-label';
        emailLabel.textContent = 'Email';
        toggleContainer.appendChild(emailLabel);

        // Create toggle switch
        const toggleSwitch = document.createElement('label');
        toggleSwitch.className = 'toggle-switch';

        const toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.id = 'lookup-type-toggle';

        const toggleSlider = document.createElement('span');
        toggleSlider.className = 'toggle-slider';

        toggleSwitch.appendChild(toggleInput);
        toggleSwitch.appendChild(toggleSlider);
        toggleContainer.appendChild(toggleSwitch);

        // Add UserId label
        const userIdLabel = document.createElement('span');
        userIdLabel.className = 'lookup-toggle-label';
        userIdLabel.textContent = 'UserId';
        toggleContainer.appendChild(userIdLabel);

        // Add toggle container to lookup container
        lookupContainer.appendChild(toggleContainer);

        // Create search input
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'user-lookup-input';
        searchInput.id = 'user-lookup-input';
        searchInput.placeholder = 'Enter email address...';
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                performLookup();
            }
        });
        lookupContainer.appendChild(searchInput);

        // Create search button
        const searchButton = document.createElement('button');
        searchButton.className = 'user-lookup-button';
        searchButton.textContent = 'Lookup';
        searchButton.addEventListener('click', performLookup);
        lookupContainer.appendChild(searchButton);

        // Add the lookup container after the last list item
        navbarLinksList.parentNode.parentNode.appendChild(lookupContainer);

        // Update placeholder when toggle changes
        toggleInput.addEventListener('change', () => {
            searchInput.placeholder = toggleInput.checked
                ? 'Enter user ID...'
                : 'Enter email address...';
        });
    }

    // Function to perform the user lookup
    function performLookup() {
        // Get input value and toggle state
        const inputValue = document.getElementById('user-lookup-input').value.trim();
        const isUserIdLookup = document.getElementById('lookup-type-toggle').checked;

        if (!inputValue) {
            showMessage('Please enter a ' + (isUserIdLookup ? 'user ID' : 'email address'), 'error');
            return;
        }

        // Show loading state
        const searchButton = document.querySelector('.user-lookup-button');
        const originalText = searchButton.textContent;
        searchButton.textContent = 'Loading...';
        searchButton.disabled = true;

        // Build the URL
        const url = isUserIdLookup
            ? `https://app.iterable.com/users/profiles/getUserData?userId=${encodeURIComponent(inputValue)}`
            : `https://app.iterable.com/users/profiles/getUserData?email=${encodeURIComponent(inputValue)}`;

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
                    } else if (data.itblUserId) {
                        // User found, redirect to profile
                        showMessage(`Found user: ${data.email}`, 'success');
                        setTimeout(() => {
                            window.location.href = `https://app.iterable.com/users/profiles/${data.itblUserId}`;
                        }, 500); // Short delay to show the success message
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

    // Function to show message
    function showMessage(message, type) {
        // Remove any existing message
        const existingMessage = document.querySelector('.lookup-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Create message element
        const messageElement = document.createElement('div');
        messageElement.className = `lookup-message lookup-${type}`;
        messageElement.textContent = message;

        // Add to container
        const container = document.getElementById('iterable-user-lookup');
        container.appendChild(messageElement);

        // Auto remove after 5 seconds for errors, 2 seconds for success
        const timeout = type === 'error' ? 5000 : 2000;
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.remove();
            }
        }, timeout);
    }

    // Function to initialize the script
    function init() {
        // Check if we're on the right page
        if (!document.querySelector('ul[id="navbar-links-list"]')) {
            // If the navbar isn't loaded yet, wait and try again
            setTimeout(init, 500);
            return;
        }

        // Check if lookup bar already exists
        if (document.getElementById('iterable-user-lookup')) {
            return;
        }

        // Add the lookup bar
        addLookupBar();
    }

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
    new MutationObserver((mutations) => {
        // Check if any of the mutations added the navbar
        for (const mutation of mutations) {
            if (mutation.type === 'childList' &&
                document.querySelector('ul[id="navbar-links-list"]') &&
                !document.getElementById('iterable-user-lookup')) {
                init();
                break;
            }
        }
    }).observe(document.body, {childList: true, subtree: true});

    // Initial run in case the page is already loaded
    init();
})();
