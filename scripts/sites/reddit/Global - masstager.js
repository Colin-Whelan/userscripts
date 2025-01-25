// ==UserScript==
// @name        MassTagger
// @namespace   Violentmonkey Scripts
// @match       https://www.reddit.com/*
// @version     1.0
// @author      Colin Whelan
// @description Mass tag Reddit users using RES
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

    async function getUserInput() {
                    // Create modal
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
        `;

        const form = document.createElement('form');
        form.innerHTML = `
            <div style="margin-bottom: 10px;">
                <label>Tag Text: <input type="text" id="tagText" style="width: 200px; background: ${isDark ? '#1a1a1b' : 'white'}; color: ${isDark ? '#d7dadc' : 'black'}; border: 1px solid ${isDark ? '#343536' : '#edeff1'};"></label>
            </div>
            <div style="margin-bottom: 10px;">
                <label>Color: <select id="tagColor" style="width: 200px; background: ${isDark ? '#1a1a1b' : 'white'}; border: 1px solid ${isDark ? '#343536' : '#edeff1'}; color: ${isDark ? '#d7dadc' : 'black'};">
                    ${RES_COLORS.map(color => `<option value="${color}" style="background-color: ${color === 'none' ? 'transparent' : color}; color: ${['white', 'yellow', 'lime', 'aqua'].includes(color) ? 'black' : 'white'}">${color}</option>`).join('')}
                </select></label>
            </div>
            <button type="submit" style="margin-right: 10px; background: ${isDark ? '#343536' : '#edeff1'}; color: ${isDark ? '#d7dadc' : 'black'}; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Start Tagging</button>
            <button type="button" id="cancelBtn" style="background: ${isDark ? '#343536' : '#edeff1'}; color: ${isDark ? '#d7dadc' : 'black'}; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Cancel</button>
        `;

        modal.appendChild(form);
        document.body.appendChild(modal);

        return new Promise((resolve) => {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const result = {
                    text: document.getElementById('tagText').value,
                    color: document.getElementById('tagColor').value
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
        const tagButtons = Array.from(document.querySelectorAll('.RESUserTag'))
            .map(tag => tag.querySelector('a.userTagLink'))
            .filter(Boolean);
        let taggedCount = 0;

        for (const tagButton of tagButtons) {
            try {
                tagButton.click();
                await waitForElement('#userTaggerText');

                // Wait for dialog animation
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

        const status = document.createElement('div');
        status.textContent = `Tagged ${taggedCount} users successfully!`;
        status.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 10000;
        `;
        document.body.appendChild(status);
        setTimeout(() => status.remove(), 3000);
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
            await tagAllUsers(tagInfo);
        } catch (error) {
            console.error('Mass tagging failed:', error);
            const errorMsg = document.createElement('div');
            errorMsg.textContent = 'An error occurred while mass tagging users. Check console for details.';
            errorMsg.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #f44336;
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                z-index: 10000;
            `;
            document.body.appendChild(errorMsg);
            setTimeout(() => errorMsg.remove(), 3000);
        }
    }

    addMassTaggerButton();
})();
