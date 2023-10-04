// ==UserScript==
// @name        Triggered Send Log - Search Bar
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/reports/transactional_log
// @grant       none
// @version     1.0
// @author      -
// @description Add a search bar to the triggered send log. The dropdown list will be filtered to matches of the search term.
// ==/UserScript==

// Function to run once the specific DOM element is available
function initBetterFilter() {
  const selectElement = document.querySelector('select[name="template"]');

  // Create search bar
  const searchBar = document.createElement('input');
  searchBar.type = 'text';
  searchBar.placeholder = 'Search templates...';

  // Style the search bar
  searchBar.style.width = '20%';
  searchBar.style.padding = '4px';
  searchBar.style.marginTop = '4px';
  searchBar.style.marginRight = '8px';
  searchBar.style.borderRadius = '4px';
  searchBar.style.border = '1px solid #ccc';

  // Insert the search bar before the select element
  selectElement.parentNode.insertBefore(searchBar, selectElement);

  // Store original options
  const originalOptions = Array.from(selectElement.options);

  // Event listener for the search bar
  searchBar.addEventListener('input', function() {
    const searchQuery = this.value.toLowerCase();

    // Clear current options
    selectElement.innerHTML = '';

    // Filter and append options based on search query
    originalOptions.forEach((option) => {
      if (option.text.toLowerCase().includes(searchQuery)) {
        selectElement.appendChild(option.cloneNode(true));
      }
    });
  });
}

// Initialize MutationObserver
const observer = new MutationObserver((mutations) => {
  if (document.querySelector('select[name="template"]')) {
    initBetterFilter();
    observer.disconnect();
  }
});

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true
});
