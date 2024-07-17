// ==UserScript==
// @name        Recommendation Manager - Template Search
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/rm*
// @grant       none
// @version     1.3
// @author      -
// @description Adds a search bar to the recommendation manager. The dropdown will be limited to the search bar term. Uses fuzzy search and sorts templates alphabetically.
// ==/UserScript==

(function() {
    'use strict';

    // Function to perform fuzzy search
    function fuzzySearch(str, pattern) {
        pattern = pattern.toLowerCase();
        str = str.toLowerCase();
        let patternIdx = 0;
        let strIdx = 0;
        while (strIdx < str.length && patternIdx < pattern.length) {
            if (str[strIdx] === pattern[patternIdx]) {
                patternIdx++;
            }
            strIdx++;
        }
        return patternIdx === pattern.length;
    }

    // Function to sort options alphabetically
    function sortOptions(optgroup) {
        const options = Array.from(optgroup.querySelectorAll('option'));
        options.sort((a, b) => a.textContent.localeCompare(b.textContent));
        options.forEach(option => optgroup.appendChild(option));
    }

    // Function to filter and sort options based on search
    function filterAndSortOptions() {
        const searchTerm = searchInput.value;
        const optgroups = select.querySelectorAll('optgroup');

        optgroups.forEach(optgroup => {
            const options = Array.from(optgroup.querySelectorAll('option'));

            // Sort options alphabetically
            options.sort((a, b) => a.textContent.localeCompare(b.textContent));

            // Filter and reorder options
            options.forEach(option => {
                if (fuzzySearch(option.textContent, searchTerm)) {
                    option.style.display = '';
                    optgroup.appendChild(option); // Move matching options to the end
                } else {
                    option.style.display = 'none';
                }
            });
        });
    }

    // Create search input
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search templates...';
    searchInput.style.padding = '5px 10px';
    searchInput.style.width = '200px';
    searchInput.style.height = '30px';
    searchInput.style.border = '1px solid #ccc';
    searchInput.style.borderRadius = '3px';
    searchInput.style.fontSize = '14px';
    searchInput.style.boxSizing = 'border-box';

    // Get the filter bar and select element
    const filterBar = document.querySelector('#feed-preview > .filter-bar');
    const select = filterBar.querySelector('select');

    // Sort options initially
    select.querySelectorAll('optgroup').forEach(sortOptions);

    // Get the refresh button
    const refreshButton = document.getElementById('refresh-preview-button');

    // Create a wrapper div for the search input
    const searchWrapper = document.createElement('div');
    searchWrapper.style.display = 'flex';
    searchWrapper.style.alignSelf = 'center';
    searchWrapper.appendChild(searchInput);

    // Insert the search wrapper after the refresh button
    refreshButton.parentNode.insertBefore(searchWrapper, refreshButton.nextSibling);

    // Add event listener to search input
    searchInput.addEventListener('input', filterAndSortOptions);

    // Modify the existing onchange function to work with filtered options
    const originalOnChange = select.getAttribute('onchange');
    select.setAttribute('onchange', `
        const visibleOptions = Array.from(this.options).filter(opt => opt.style.display !== 'none');
        if (visibleOptions.length > 0) {
            ${originalOnChange}
        }
    `);

    // Initial sort and filter
    filterAndSortOptions();
})();
