// ==UserScript==
// @name        Lists - Show Full Logic
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/lists*
// @grant       GM_addStyle
// @grant       GM_xmlhttpRequest
// @version     1.2
// @author      Colin Whelan
// @description Adds a checkbox to show the full list logic for all rows at once. Checkbox states saves to browser.
//
// Sept 2024:
// v1.2
// Fixed for the new UI update
// Adds Total List count
//
// ==/UserScript==

(function() {
    'use strict';

    const defaultListsPerPage = 20

    // Function to toggle the display of list descriptions
    const toggleListDescriptions = (showFull) => {
        const style = showFull
            ? `.fkOUpx {
                 overflow: visible;
                 white-space: normal;
                 text-overflow: clip;
               }`
            : `.fkOUpx {
                 overflow: hidden;
                 white-space: nowrap;
                 text-overflow: ellipsis;
               }`;

        GM_addStyle(style);
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


    // Function to fetch and display the total list count
    const fetchAndDisplayTotalCount = () => {
        GM_xmlhttpRequest({
            method: "GET",
            url: "https://my.sailthru.com/uiapi/lists/",
            onload: function(response) {
                if (response.status === 200) {
                    const data = JSON.parse(response.responseText);
                    const totalCount = data.length;
                  console.log(totalCount)
                    displayTotalCount(totalCount);
                } else {
                    console.error("Failed to fetch list data");
                }
            },
            onerror: function(error) {
                console.error("Error fetching list data:", error);
            }
        });
    };

    // Function to display the total count
    const displayTotalCount = (count) => {
        const container = document.querySelector('div[orientation="horizontal"].sc-gueYoa.bLtTHE');
        if (container) {
            const countElement = document.createElement('div');
            countElement.textContent = `Total Lists: ${count}`;
            countElement.style.margin = 'auto 0';
            countElement.style.fontWeight = 'bold';
            container.appendChild(countElement);
        }
    };

    // Modify the existing observer to also set up page size functionality
    const observer = new MutationObserver((mutations, obs) => {
        const table = document.querySelector('table.sc-eKYjST.ekXNtx');
        if (table) {
            console.log('Table is now available.');
            const savedStatus = localStorage.getItem('showFullLogicStatus') === 'true';
            toggleListDescriptions(savedStatus);
            fetchAndDisplayTotalCount();
            obs.disconnect();
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
        formGroup.style.margin = 'auto 0';
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
        const sidebar = document.querySelector('.sc-gueYoa.fKQZAI');
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
