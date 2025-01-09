// ==UserScript==
// @name        Minesweeper Online Custom Board Presets
// @namespace   Violentmonkey Scripts
// @match       https://minesweeper.online/game/*
// @grant       none
// @version     1.1
// @author      Colin Whelan
// @description Adds preset board sizes to custom game options
// ==/UserScript==

(function() {
    'use strict';

    // Define preset board configurations
    const presets = [
        { name: '16x16 (40)', width: 16, height: 16, mines: 40 },
        { name: '30x16 (99)', width: 30, height: 16, mines: 99 },
        { name: '30x30 (180)', width: 30, height: 30, mines: 180 },
        { name: '50x50 (500)', width: 50, height: 50, mines: 500 },
        { name: '70x70 (1163) - 100k', width: 70, height: 70, mines: 1163 }
    ];

    function createPresetButton(preset) {
        const button = document.createElement('button');
        button.textContent = preset.name;
        button.className = 'btn btn-default btn-sm preset-button';
        button.style.marginRight = '5px';
        button.style.marginBottom = '5px';

        button.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('custom_width').value = preset.width;
            document.getElementById('custom_height').value = preset.height;
            document.getElementById('custom_mines').value = preset.mines;

            // Trigger the update button click
            const updateBtn = document.querySelector('.btn-custom-update');
            if (updateBtn) {
                updateBtn.click();
            }
        });

        return button;
    }

    function addPresetButtons() {
        // Check if buttons already exist
        if (document.getElementById('preset-container')) return;

        // Find the custom level block
        const customLevelBlock = document.getElementById('CustomLevelBlock');
        if (!customLevelBlock) return;

        // Create container for preset buttons
        const presetContainer = document.createElement('div');
        presetContainer.id = 'preset-container';
        presetContainer.style.marginTop = '10px';
        presetContainer.style.marginBottom = '10px';

        // Add a label
        const label = document.createElement('label');
        label.textContent = 'Presets: ';
        label.style.marginRight = '10px';
        presetContainer.appendChild(label);

        // Add preset buttons
        presets.forEach(preset => {
            presetContainer.appendChild(createPresetButton(preset));
        });

        // Insert the preset container after the form
        const form = customLevelBlock.querySelector('form');
        if (form) {
            form.parentNode.insertBefore(presetContainer, form.nextSibling);
        }
    }

    // Watch for changes to the game content
    function initObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' || mutation.type === 'subtree') {
                    const customLevelBlock = document.getElementById('CustomLevelBlock');
                    if (customLevelBlock && customLevelBlock.offsetParent !== null) {
                        addPresetButtons();
                    }
                }
            });
        });

        // Observe the entire document for changes
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Initial setup
    function init() {
        // Add buttons immediately if custom level block exists
        const customLevelBlock = document.getElementById('CustomLevelBlock');
        if (customLevelBlock && customLevelBlock.offsetParent !== null) {
            addPresetButtons();
        }

        // Start watching for changes
        initObserver();
    }

    // Start initialization
    init();
})();
