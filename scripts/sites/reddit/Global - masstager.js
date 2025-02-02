// ==UserScript==
// @name        MassTagger
// @namespace   Violentmonkey Scripts
// @match       https://www.reddit.com/*
// @version     1.3
// @author      Colin Whelan
// @description Mass tag Reddit users using RES - Adds button in top right to 'mass tag' everyone on the page.
// Add the text and the RES color to use, then click 'Start Tagging' to tag every intagged user with this tag.
// Tick the checkbox to force update already tagged users.
// Press 'Esc' to cancel tagging at any time.
// After each set of updates, a quick sumamry shows in the bottom right.
// ==/UserScript==

(function() {
    'use strict';

    const RES_COLORS = [
        'none',
        'aqua',
        'black',
        'blue',
        'cornflowerblue',
        'fuchsia',
        'gray',
        'green',
        'lime',
        'maroon',
        'navy',
        'olive',
        'orange',
        'orangered',
        'pink',
        'purple',
        'red',
        'silver',
        'teal',
        'white',
        'yellow'
    ];

    // Add a flag to track if tagging is in progress
    let isTaggingInProgress = false;

    function addMassTaggerButton() {
        const headerRight = document.getElementById('header-bottom-right');
        if (!headerRight) return;

        const separator = document.createElement('span');
        separator.className = 'separator';
        separator.textContent = '|';

        const button = document.createElement('a');
        button.href = 'javascript:void(0)';
        button.textContent = 'mass tag';
        button.style.cursor = 'pointer';
        button.addEventListener('click', startMassTagging);

        headerRight.insertBefore(button, headerRight.lastElementChild);
        headerRight.insertBefore(separator, headerRight.lastElementChild);
    }

    // Add event listener for ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isTaggingInProgress) {
            isTaggingInProgress = false;
            showStatus('Tagging cancelled', 'warning');
        }
    });

    function showStatus(message, type = 'success') {
        const status = document.createElement('div');
        const isDark = document.body.classList.contains('res-nightmode');

        let color;
        switch(type) {
            case 'success':
                color = '#4CAF50';
                break;
            case 'warning':
                color = '#ff9800';
                break;
            case 'error':
                color = '#f44336';
                break;
            default:
                color = isDark ? '#d7dadc' : 'black';
        }

        status.innerHTML = `<div style="color: ${color}">${message}</div>`;
        status.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${isDark ? '#1a1a1b' : 'white'};
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 10000;
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
            font-weight: bold;
            border: 1px solid gray;
        `;
        document.body.appendChild(status);
        setTimeout(() => status.remove(), 3000);
    }

    async function getUserInput() {
        // Enable force tag checkbox when text is entered
        function toggleForceTag() {
            const tagText = document.getElementById('tagText').value;
            document.getElementById('forceTag').disabled = !tagText;
        }
        const modal = document.createElement('div');
        const isDark = document.body.classList.contains('res-nightmode');

        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: ${isDark ? '#1a1a1b' : 'white'};
            color: ${isDark ? '#d7dadc' : 'black'};
            padding: 20px;
            border-radius: 5px;
            z-index: 10000;
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
            border: 1px solid gray;
        `;

        const form = document.createElement('form');
        form.innerHTML = `
            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                <div>
                    <label>Tag Text: <input type="text" id="tagText" style="width: 150px; background: ${isDark ? '#1a1a1b' : 'white'}; color: ${isDark ? '#d7dadc' : 'black'}; border: 1px solid ${isDark ? '#343536' : '#edeff1'};"></label>
                </div>
                <div>
                    <label>Color: <select id="tagColor" style="width: 150px; background: ${isDark ? '#1a1a1b' : 'white'}; border: 1px solid ${isDark ? '#343536' : '#edeff1'}; color: ${isDark ? '#d7dadc' : 'black'};">
                        ${RES_COLORS.map(color => `<option value="${color}" style="background-color: ${color === 'none' ? 'transparent' : color}; color: ${['white', 'yellow', 'lime', 'aqua'].includes(color) ? 'black' : 'white'}">${color}</option>`).join('')}
                    </select></label>
                </div>
            </div>
            <div style="margin-bottom: 10px;">
                <label><input type="checkbox" id="forceTag" disabled> Force tag (override existing tags)</label>
            </div>
            <div style="margin-bottom: 10px; color: ${isDark ? '#888' : '#666'};">
                Press ESC at any time to cancel the tagging process
            </div>
            <button type="submit" style="margin-right: 10px; background: ${isDark ? '#343536' : '#edeff1'}; color: ${isDark ? '#d7dadc' : 'black'}; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Start Tagging</button>
            <button type="button" id="cancelBtn" style="background: ${isDark ? '#343536' : '#edeff1'}; color: ${isDark ? '#d7dadc' : 'black'}; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Cancel</button>
        `;

        modal.appendChild(form);
        document.body.appendChild(modal);

        // Add event listener to enable/disable force tag checkbox
        document.getElementById('tagText').addEventListener('input', toggleForceTag);

        return new Promise((resolve) => {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const result = {
                    text: document.getElementById('tagText').value,
                    color: document.getElementById('tagColor').value,
                    forceTag: document.getElementById('forceTag').checked
                };
                modal.remove();
                resolve(result);
            });

            document.getElementById('cancelBtn').addEventListener('click', () => {
                modal.remove();
                resolve(null);
            });
        });
    }

    async function tagAllUsers(tagInfo) {
        // Get all user elements and their associated tag buttons
        const userElements = Array.from(document.querySelectorAll('.author.may-blank'));
        const processedUsernames = new Set();
        let taggedCount = 0;
        let skippedCount = 0;

        isTaggingInProgress = true;
        const forceTag = tagInfo.forceTag;

        for (const userElement of userElements) {
            if (!isTaggingInProgress) {
                return { taggedCount, skippedCount, cancelled: true };
            }

            const username = userElement.textContent;

            // Skip if we've already processed this username
            if (processedUsernames.has(username)) {
                continue;
            }

            processedUsernames.add(username);

            try {
                const tagContainer = userElement.parentElement.querySelector('.RESUserTag');
                if (!tagContainer) continue;

                const tagButton = tagContainer.querySelector('a.userTagLink');
                if (!tagButton) continue;

                const existingTag = (tagButton.title.trim() != 'set a tag' && tagButton.title.trim() != '') || tagButton.textContent.trim();
                if (existingTag && !forceTag) {
                    skippedCount++;
                    continue;
                }

                tagButton.click();
                await waitForElement('#userTaggerText');
                await sleep(10);

                const tagInput = document.querySelector('#userTaggerText');
                tagInput.value = tagInfo.text;
                tagInput.dispatchEvent(new Event('change'));

                const colorDropdown = document.querySelector('select#userTaggerColor');
                const colorIndex = RES_COLORS.indexOf(tagInfo.color);
                colorDropdown.selectedIndex = colorIndex;
                colorDropdown.dispatchEvent(new Event('change'));

                const saveButton = document.querySelector('input#userTaggerSave');
                saveButton.click();
                taggedCount++;

                await sleep(10);
            } catch (error) {
                console.error('Error tagging user:', error);
            }
        }

        isTaggingInProgress = false;
        return { taggedCount, skippedCount, cancelled: false };
    }

    function waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            const checkElement = () => {
                const element = document.querySelector(selector);
                if (element) {
                    resolve(element);
                    return;
                }

                if (Date.now() - startTime > timeout) {
                    reject(new Error(`Timeout waiting for element: ${selector}`));
                    return;
                }

                requestAnimationFrame(checkElement);
            };

            checkElement();
        });
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function startMassTagging() {
        const tagInfo = await getUserInput();
        if (!tagInfo) return;

        try {
            const result = await tagAllUsers(tagInfo);

            let statusMessage = '';
            if (result.cancelled) {
                statusMessage = 'Process cancelled';
            } else {
                if (result.taggedCount) {
                    statusMessage += `Tagged: ${result.taggedCount} `;
                }
                if (result.skippedCount) {
                    statusMessage += `Skipped: ${result.skippedCount}`;
                }
            }

            showStatus(statusMessage, result.cancelled ? 'warning' : 'success');
        } catch (error) {
            console.error('Mass tagging failed:', error);
            showStatus('An error occurred while mass tagging users', 'error');
        }
    }

    addMassTaggerButton();
})();
