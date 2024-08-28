// ==UserScript==
// @name         Email Composer - 'Includes' Selection Box
// @namespace    Violentmonkey Scripts
// @match        https://my.sailthru.com/template/*
// @match        https://my.sailthru.com/email-composer/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @version      1.3
// @author       Colin Whelan
// @description  Adds a selection box for Sailthru 'includes' with a preview option to HTML + Drag & Drop editors. Click a name to copy the Zephyr code needed.
// ==/UserScript==

(function() {
    'use strict';

    let includes = {};
    let selectionBox;
    let isCollapsed = true;

function createSelectionBox() {
    selectionBox = document.createElement('div');
    selectionBox.id = 'sailthru-includes-box';
    selectionBox.style.cssText = `
        position: fixed;
        top: 250px;
        left: 20px;
        width: 250px;
        height: 600px;
        background-color: white;
        border: 1px solid #ccc;
        border-radius: 10px;
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
        z-index: 9999;
        overflow-y: auto;
        display: none;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
        padding: 10px 5px 10px 10px;
        background-color: #f0f0f0;
        cursor: move;
        user-select: none;
        border-bottom: 1px solid #ccc;
        position: sticky;
        top: 0;
        z-index: 1;
        justify-content: space-between;
    `;

    const titleSpan = document.createElement('span');
    titleSpan.textContent = 'Includes - Click to copy';
    titleSpan.style.flexGrow = '1';

    const refreshButton = document.createElement('button');
    refreshButton.innerHTML = '&#x21BB;'; // Refresh symbol
    refreshButton.style.cssText = `
        float: center;
        background: none;
        border: none;
        cursor: pointer;
        font-size: 18px;
        padding: 0 3px;
        margin: 0 5px;
        position: relative;
        border: 1px solid #ccc;
        border-radius: 3px;
        top: 0;
    `;
    refreshButton.onclick = (e) => {
        hidePreview()
        e.stopPropagation(); // Prevent dragging when clicking refresh
        fetchIncludes(() => {
            showNotification('Includes list refreshed!');
        });
    };

    const closeButton = document.createElement('button');
    closeButton.textContent = 'X';
    closeButton.style.cssText = `
        float: right;
        background: none;
        border: none;
        cursor: pointer;
        position: relative;
        position: relative;
        border: 1px solid #ccc;
        border-radius: 3px;
        top: 1px;
        font-size: 14px;
    `;
    closeButton.onclick = toggleSelectionBox;

    header.appendChild(titleSpan);
    header.appendChild(refreshButton);
    header.appendChild(closeButton);
    selectionBox.appendChild(header);

    const content = document.createElement('div');
    content.id = 'sailthru-includes-content';
    content.style.cssText = `
        overflow-y: auto;
        flex-grow: 1;
    `;
    selectionBox.appendChild(content);

    document.body.appendChild(selectionBox);

    // Make the selection box draggable
    let isDragging = false;
    let dragOffsetX, dragOffsetY;

    header.onmousedown = startDragging;
    document.onmousemove = drag;
    document.onmouseup = stopDragging;

    function startDragging(e) {
        if (e.target === header) {
            isDragging = true;
            dragOffsetX = e.clientX - selectionBox.offsetLeft;
            dragOffsetY = e.clientY - selectionBox.offsetTop;
        }
    }

    function drag(e) {
        if (isDragging) {
            selectionBox.style.left = (e.clientX - dragOffsetX) + 'px';
            selectionBox.style.top = (e.clientY - dragOffsetY) + 'px';
        }
    }

    function stopDragging() {
        isDragging = false;
    }
}

    function resetAllIcons() {
        const allIcons = document.querySelectorAll('#sailthru-includes-content span[style*="cursor: pointer"]');
        allIcons.forEach(icon => {
            icon.style.color = '#888';
            icon.style.backgroundColor = '#f0f0f0';
        });
    }

    function createToggleButton() {
        const button = document.createElement('button');
        button.textContent = 'Select Includes';
        button.style.cssText = `  margin-left: 5px;
      margin-top: 15px;
      margin-bottom: 15px;
      background-color: #eee;
      background-image: none;
      border: 1px solid #ccc;
      border-radius: 4px;
      color: black;
      padding: 5px 10px;
      cursor: pointer;
      outline: none;
      transition: opacity 0.2s;
      width: 120px;
    }
    }
    `;
        button.onclick = handleButtonClick;

        function addButtonToTemplateEditor() {
            const standardControls = document.getElementById('standard-controls');
            if (standardControls) {
                standardControls.appendChild(button);
            } else {
                console.warn('standard-controls div not found in template editor');
            }
        }

        function addButtonToEmailComposer() {
            const headerNavLinks = document.getElementById('header_nav_links');
            if (headerNavLinks) {
                const newListItem = document.createElement('li');
                newListItem.className = 'NavLinksComponent__NavBarItems-sc-1456pt8-1 hBHGeq';
                newListItem.appendChild(button);
                headerNavLinks.appendChild(newListItem);
            } else {
                console.warn('header_nav_links ul not found in email composer');
            }
        }

        function addButton() {
            if (window.location.href.includes('/template/')) {
                addButtonToTemplateEditor();
            } else if (window.location.href.includes('/email-composer/')) {
                addButtonToEmailComposer();
            }
        }

        // Initial button placement
        addButton();

        // Add event listener for URL changes (for single-page applications)
        let lastUrl = location.href;
        new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                addButton();
            }
        }).observe(document, {
            subtree: true,
            childList: true
        });
    }

    function handleButtonClick() {
        if (isCollapsed) {
            // If the selection box is currently collapsed, fetch includes and show the box
            fetchIncludes(() => {
                toggleSelectionBox();
            });
        } else {
            // If the selection box is already open, just toggle it closed
            toggleSelectionBox();
        }
    }

function fetchIncludes(callback) {
    const content = document.getElementById('sailthru-includes-content');
    content.innerHTML = '<div style="text-align: center; padding: 20px;">Loading...</div>';

    GM_xmlhttpRequest({
        method: 'GET',
        url: 'https://my.sailthru.com/ajax/include',
        onload: function(response) {
            includes = JSON.parse(response.responseText).options;
            populateSelectionBox();
            if (callback) callback();
        }
    });
}

    function toggleSelectionBox() {
        isCollapsed = !isCollapsed;
        selectionBox.style.display = isCollapsed ? 'none' : 'block';

        if (isCollapsed) {
            const existingPreview = document.getElementById('sailthru-include-preview');
            if (existingPreview) {
                existingPreview.remove();
            }
        } else {
            resetAllIcons();
        }
    }

    function populateSelectionBox() {
        const content = document.getElementById('sailthru-includes-content');
        content.innerHTML = '';

        for (const [name, id] of Object.entries(includes)) {
            const item = document.createElement('div');
            item.style.cssText = `
            padding: 5px 10px;
            cursor: pointer;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;

            const nameSpan = document.createElement('span');
            nameSpan.textContent = name;
            nameSpan.style.flexGrow = '1';
            nameSpan.onclick = () => copyInclude(name);

            const previewIcon = document.createElement('span');
            previewIcon.innerHTML = '&#128065;'; // Eye icon
            previewIcon.style.cssText = `
            cursor: pointer;
            padding: 0px 4px 2px 4px;
            margin-left: 10px;
            border: 1px solid #ccc;
            border-radius: 4px;
            background-color: #f0f0f0;
            color: #888;
            transition: all 0.3s ease;
        `;
            previewIcon.onclick = (event) => {
                event.stopPropagation();
                togglePreview(id, previewIcon);
            };

            item.appendChild(nameSpan);
            item.appendChild(previewIcon);
            content.appendChild(item);
        }

        // Ensure all icons are greyed out when populating
        resetAllIcons();
    }

    function togglePreview(id, iconElement) {
        const existingPreview = document.getElementById('sailthru-include-preview');
        const allIcons = document.querySelectorAll('#sailthru-includes-content span[style*="cursor: pointer"]');

        // Deactivate all icons first
        allIcons.forEach(icon => {
            icon.style.color = '#888';
            icon.style.backgroundColor = '#f0f0f0';
        });

        if (existingPreview && existingPreview.dataset.currentId === id) {
            existingPreview.remove();
            iconElement.style.color = '#888';
            iconElement.style.backgroundColor = '#f0f0f0';
        } else {
            if (existingPreview) {
                existingPreview.remove();
                const previousIcon = document.querySelector('#sailthru-includes-content span[style*="color: #000"]');
                if (previousIcon) {
                    previousIcon.style.color = '#888';
                    previousIcon.style.backgroundColor = '#f0f0f0';
                }
            }
            showPreview(id);
            iconElement.style.color = '#000';
            iconElement.style.backgroundColor = '#e0e0e0';
        }
    }

    function showPreview(id) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://my.sailthru.com/ajax/include?id=${id}`,
            onload: function(response) {
                const data = JSON.parse(response.responseText);
                const previewContent = data.form.content_html;

                const preview = document.createElement('div');
                preview.id = 'sailthru-include-preview';
                preview.dataset.currentId = id;
                preview.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: auto;
                max-width: 70%;
                max-height: 80%;
                background-color: white;
                border: 1px solid #ccc;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
                z-index: 10000;
                padding: 20px;
                overflow-y: auto;
            `;
                preview.innerHTML = `<h3>Preview</h3><pre>${previewContent}</pre>`;
                document.body.appendChild(preview);
            }
        });
    }

    function toggleSelectionBox() {
        isCollapsed = !isCollapsed;
        selectionBox.style.display = isCollapsed ? 'none' : 'block';

        if (isCollapsed) {
            const existingPreview = document.getElementById('sailthru-include-preview');
            if (existingPreview) {
                existingPreview.remove();
            }
            const activeIcon = document.querySelector('#sailthru-includes-content span[style*="color: #000"]');
            if (activeIcon) {
                activeIcon.style.color = '#888';
                activeIcon.style.backgroundColor = '#f0f0f0';
            }
        }
    }

    function hidePreview() {
        clearTimeout(document.body.dataset.previewHideTimer);
        document.body.dataset.previewHideTimer = setTimeout(() => {
            const preview = document.getElementById('sailthru-include-preview');
            if (preview) {
                preview.style.display = 'none';
            }
        }, 150);
    }

    function showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #4CAF50;
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 10001;
        font-size: 14px;
        text-align: center;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        transition: opacity 0.3s ease-in-out;
    `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Fade in
        notification.style.opacity = '0';
        setTimeout(() => {
            notification.style.opacity = '1';
        }, 10);

        // Fade out and remove
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    function copyInclude(name) {
        const includeText = `{include "${name}"}`;
        GM_setClipboard(includeText);
        showNotification(`Include "${name}" copied to clipboard!`);
    }

    // Wait for the page to fully load before initializing
    window.addEventListener('load', function() {
        createSelectionBox();
        createToggleButton();
    });
})();
