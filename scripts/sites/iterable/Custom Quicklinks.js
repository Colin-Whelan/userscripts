// ==UserScript==
// @name         Custom Quicklinks
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds custom quicklinks to Iterable's navbar
// @author       Colin Whelan
// @match        https://app.iterable.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // Add styles for the configuration UI
    GM_addStyle(`
        .quicklink-config-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .quicklink-config-panel {
            background: white;
            padding: 20px;
            border-radius: 8px;
            width: 500px;
            max-width: 90%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .quicklink-row {
            display: flex;
            margin-bottom: 10px;
            gap: 10px;
        }
        .quicklink-row input {
            flex: 1;
            padding: 6px 10px;
            border: 1px solid #ccc;
            border-radius: 4px;
        }
        .quicklink-buttons {
            display: flex;
            justify-content: space-between;
            margin-top: 15px;
        }
        .quicklink-button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        .quicklink-save {
            background: #1976d2;
            color: white;
        }
        .quicklink-cancel {
            background: #f5f5f5;
        }
        .quicklink-add {
            background: #4caf50;
            color: white;
        }
        .quicklink-remove {
            background: #f44336;
            color: white;
            padding: 6px 10px;
        }
        .first-custom-quicklink {
            border-left: 1px solid #e0e0e0;
            margin-left: 8px;
            padding-left: 8px;
        }
    `);

    // Configuration - Edit these quicklinks or use the Tampermonkey menu to configure
    let defaultQuicklinks = [
        { urlName: "Lists", url: "/lists" },
        { urlName: "User Lookup", url: "/users/lookup" },
        // Add more default quicklinks as needed
    ];

    // Get saved quicklinks or use defaults
    let quicklinks = GM_getValue('iterableQuicklinks', defaultQuicklinks);

    // Function to save quicklinks configuration
    function saveQuicklinks(links) {
        GM_setValue('iterableQuicklinks', links);
        quicklinks = links;
        // Refresh the quicklinks if they exist
        const existingLinks = document.querySelectorAll('.custom-quicklink-item');
        existingLinks.forEach(link => link.remove());
        addQuicklinks();
    }

    // Function to create and show configuration UI
    function showConfigUI() {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'quicklink-config-overlay';

        // Create configuration panel
        const panel = document.createElement('div');
        panel.className = 'quicklink-config-panel';

        // Add header
        const header = document.createElement('h2');
        header.textContent = 'Configure Quicklinks';
        header.style.marginTop = '0';
        panel.appendChild(header);

        // Add description
        const description = document.createElement('p');
        description.textContent = 'Add or edit your custom quicklinks. URLs should be relative (e.g., "/lists").';
        panel.appendChild(description);

        // Create container for link rows
        const linksContainer = document.createElement('div');
        linksContainer.id = 'quicklinks-container';
        panel.appendChild(linksContainer);

        // Function to add a new link row
        function addLinkRow(link = { urlName: '', url: '' }) {
            const row = document.createElement('div');
            row.className = 'quicklink-row';

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.placeholder = 'Display Name';
            nameInput.value = link.urlName;
            nameInput.className = 'quicklink-name';

            const urlInput = document.createElement('input');
            urlInput.type = 'text';
            urlInput.placeholder = 'URL (e.g., /lists)';
            urlInput.value = link.url;
            urlInput.className = 'quicklink-url';

            const removeBtn = document.createElement('button');
            removeBtn.textContent = '✕';
            removeBtn.className = 'quicklink-button quicklink-remove';
            removeBtn.title = 'Remove this quicklink';
            removeBtn.onclick = () => row.remove();

            row.appendChild(nameInput);
            row.appendChild(urlInput);
            row.appendChild(removeBtn);
            linksContainer.appendChild(row);
        }

        // Add existing links
        quicklinks.forEach(link => addLinkRow(link));



        // Add button for new link
        const addBtn = document.createElement('button');
        addBtn.textContent = '+ Add New Quicklink';
        addBtn.className = 'quicklink-button quicklink-add';
        addBtn.style.marginTop = '10px';
        addBtn.onclick = () => addLinkRow();
        panel.appendChild(addBtn);

        // Add buttons container
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'quicklink-buttons';

        // Add save button
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save Changes';
        saveBtn.className = 'quicklink-button quicklink-save';
        saveBtn.onclick = () => {
            // Collect all link data
            const newLinks = [];
            const rows = linksContainer.querySelectorAll('.quicklink-row');

            rows.forEach(row => {
                const nameInput = row.querySelector('.quicklink-name');
                const urlInput = row.querySelector('.quicklink-url');

                if (nameInput.value.trim() && urlInput.value.trim()) {
                    newLinks.push({
                        urlName: nameInput.value.trim(),
                        url: urlInput.value.trim()
                    });
                }
            });

            // Save and close
            saveQuicklinks(newLinks);
            overlay.remove();
        };

        // Add cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'quicklink-button quicklink-cancel';
        cancelBtn.onclick = () => overlay.remove();

        buttonsDiv.appendChild(cancelBtn);
        buttonsDiv.appendChild(saveBtn);
        panel.appendChild(buttonsDiv);

        // Add panel to overlay and overlay to body
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
    }

    // Register menu command to open configuration UI
    GM_registerMenuCommand("Configure Quicklinks", showConfigUI);

    // Function to add quicklinks to the navbar
    function addQuicklinks() {
        // Find the navbar links list
        const navbarLinksList = document.querySelector('ul[id="navbar-links-list"]');
        if (!navbarLinksList) return;

        // Flag to track the first custom quicklink
        let isFirstQuicklink = true;

        // Add each quicklink as a list item
        quicklinks.forEach(link => {
            // Create list item element
            const listItem = document.createElement('li');
            listItem.className = 'sc-biiitB hPshds custom-quicklink-item';

            // Add special class to the first custom quicklink
            if (isFirstQuicklink) {
                listItem.classList.add('first-custom-quicklink');
                isFirstQuicklink = false;
            }

            listItem.setAttribute('data-test', `quicklink-${link.urlName.toLowerCase().replace(/\s+/g, '-')}-item`);

            // Create link element (instead of button)
            const linkElement = document.createElement('a');
            linkElement.href = link.url;
            linkElement.textContent = link.urlName;

            // Match the styling of the existing buttons
            linkElement.className = 'sc-fIfBtk heNcAl';
            linkElement.style.display = 'inline-flex';
            linkElement.style.alignItems = 'center';
            linkElement.style.justifyContent = 'center';
            linkElement.style.height = '100%';
            linkElement.style.padding = '0 12px';
            linkElement.style.fontSize = '14px';
            linkElement.style.fontWeight = '500';
            linkElement.style.color = 'inherit';
            linkElement.style.textDecoration = 'none';
            linkElement.style.cursor = 'pointer';

            // Add active state styling on hover
            linkElement.addEventListener('mouseenter', () => {
                linkElement.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
            });

            linkElement.addEventListener('mouseleave', () => {
                linkElement.style.backgroundColor = 'transparent';
            });

            // Append the link to the list item
            listItem.appendChild(linkElement);

            // Append the list item to the navbar links list
            navbarLinksList.appendChild(listItem);
        });
    }

    // Rest of the script remains the same as before
    // Function to initialize the script
    function init() {
        // Check if we're on the right page
        if (!document.querySelector('ul[id="navbar-links-list"]')) {
            // If the navbar isn't loaded yet, wait and try again
            setTimeout(init, 500);
            return;
        }

        // Remove any existing custom quicklinks (in case of re-init)
        const existingLinks = document.querySelectorAll('.custom-quicklink-item');
        existingLinks.forEach(link => link.remove());

        // Add the quicklinks
        addQuicklinks();
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
                (document.querySelector('ul[id="navbar-links-list"]') &&
                 !document.querySelector('.custom-quicklink-item'))) {
                init();
                break;
            }
        }
    }).observe(document.body, {childList: true, subtree: true});

    // Initial run in case the page is already loaded
    init();
})();
