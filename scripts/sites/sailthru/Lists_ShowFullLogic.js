// ==UserScript==
// @name        Lists - Show Full Logic
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/lists*
// @grant       none
// @version     1.0
// @author      Colin Whelan
// @description Adds a checkbox to show the full list logic for all rows at once. Checkbox states saves to browser.
// ==/UserScript==

(function() {
    'use strict';

    // Function to toggle the display of list descriptions
    const toggleListDescriptions = (showFull) => {
        const descriptions = document.querySelectorAll('.list_description');

        descriptions.forEach(desc => {
            let croppedTextSpan = desc.querySelector('.cropped_text');
            let fullTextSpan = desc.querySelector('.full_text_custom');
            const croppedTextContent = extractDirectTextContent(desc);

            if (!croppedTextSpan || !fullTextSpan) {
                // Store the full text content and remove the original text nodes
                const fullTextContent = desc.querySelector('.full_text').textContent.trim();

                // Clear all direct text nodes in 'list_description'
                Array.from(desc.childNodes).forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        node.nodeValue = '';
                    }
                });

                // Create a span for the cropped text (hidden by default)
                croppedTextSpan = document.createElement('span');
                croppedTextSpan.className = 'cropped_text';
                // Use a placeholder or an ellipsis if you need initial cropped text content
                croppedTextSpan.textContent = croppedTextContent + '...'; // Placeholder text
                croppedTextSpan.style.display = 'none';

                // Create a span for the full text
                fullTextSpan = document.createElement('span');
                fullTextSpan.className = 'full_text_custom';
                fullTextSpan.textContent = fullTextContent;

                // Insert custom spans into the description element
                desc.appendChild(croppedTextSpan);
                desc.appendChild(fullTextSpan);

                // Hide the original full text container
                desc.querySelector('.full_text').style.display = 'none';
            }

            // Toggle visibility based on the 'showFull' flag
            croppedTextSpan.style.display = showFull ? 'none' : 'block';
            fullTextSpan.style.display = showFull ? 'block' : 'none';
        });
    };

    function extractDirectTextContent(parentElement) {
        let textContent = '';
        Array.from(parentElement.childNodes).forEach(node => {
            // Check if the node is a text node
            if (node.nodeType === Node.TEXT_NODE) {
                textContent += node.nodeValue.trim();
            }
        });
        return textContent;
    }


    const observer = new MutationObserver((mutations, obs) => {
        const table = document.querySelector('table.standard.start-0');
        if (table) {
            console.log('Table is now available.');
            const savedStatus = localStorage.getItem('showFullLogicStatus') === 'true';
            toggleListDescriptions(savedStatus);
            obs.disconnect(); // Stop observing once the desired element is found and action is taken
        }
    });

    // Start observing for the table
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });


    // Function to add the checkbox
    const addCheckbox = (sidebar) => {
        if (!sidebar) return;

        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'showFullLogicCheckbox';
        checkbox.style.marginRight = '8px';
        const label = document.createElement('label');
        label.htmlFor = 'showFullLogicCheckbox';
        label.textContent = 'Show Full List Logic';
        formGroup.appendChild(checkbox);
        formGroup.appendChild(label);

        // Append the formGroup to the end of the sidebar
        sidebar.appendChild(formGroup); // This line is changed

        // Load and apply the saved checkbox status
        const savedStatus = localStorage.getItem('showFullLogicStatus') === 'true';
        checkbox.checked = savedStatus;

        // Apply the initial toggle state based on the saved checkbox value
        console.log('Applying initial list description toggle state.');
        toggleListDescriptions(savedStatus);

        // Event listener for checkbox changes
        checkbox.addEventListener('change', () => {
            const isChecked = checkbox.checked;
            localStorage.setItem('showFullLogicStatus', isChecked);
            toggleListDescriptions(isChecked);
        });
    };

    // MutationObserver to wait for the sidebar to be available
    const sidebarObserver = new MutationObserver((mutations, obs) => {
        const sidebar = document.querySelector('.stui-layout__sidebar');
        if (sidebar) {
            addCheckbox(sidebar);
            obs.disconnect(); // Stop observing once the checkbox is added
        }
    });

    // Start observing
    sidebarObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
