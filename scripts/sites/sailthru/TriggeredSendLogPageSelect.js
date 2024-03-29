// ==UserScript==
// @name        Triggered Send Log - Page Select
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/reports/transactional_log
// @grant       none
// @version     1.1
// @author      -
// @description Add a Page Select dropdown list to make it easier to jump around large groups of send data. There's no way to know when the last page is, so this will not work all the time, but helps.
// ==/UserScript==

// Set the max pages to add to the dropdown.
const maxPages = 200

function addPageSelector() {
  // Decode the URL to get the new 'start' value
  const decodedURL = decodeURIComponent(decodeURIComponent(window.location.href));
  const urlParams = new URLSearchParams(decodedURL.split('#')[1]);
  let start = parseInt(urlParams.get('start') || '0', 10);
  const pageNumber = Math.floor(start / 20) + 1;

  // Check if the page selector already exists
  const existingSelector = document.querySelector('.page-selector');
  if (existingSelector) {
    // Update the selected option in the existing selector
    existingSelector.value = start;
    return;
  }

  // Create a page selector
  const selector = document.createElement('select');
  selector.className = 'page-selector';
  selector.style.fontFamily = 'Arial, sans-serif';
  selector.style.fontSize = '14px';
  selector.style.padding = '3px 10px';
  selector.style.margin = '0px 10px 0px 5px';
  selector.style.border = '1px solid #ccc';

  // Populate the selector with some page numbers for demonstration
  for (let i = 1; i <= maxPages; i++) {
    const option = document.createElement('option');
    option.value = (i - 1) * 20;
    option.text = `Page ${i}`;
    if (i === pageNumber) {
      option.selected = true;
    }
    selector.appendChild(option);
  }

  // Add a change listener to update the URL and reload the content
  selector.addEventListener('change', function () {
    const newStart = this.value;
    urlParams.set('start', newStart);

    ajax.refresh(this, { start: newStart })
  });

  // Add the selector to the page
  const paginationDiv = document.querySelector('.pagination');
  if (paginationDiv) {
    // Style paginationDiv
    paginationDiv.style.display = 'flex';
    paginationDiv.style.justifyContent = 'left';
    paginationDiv.style.alignItems = 'center';
    paginationDiv.style.padding = '0px 10px 10px 10px';

    paginationDiv.appendChild(selector);
  }
}

// Initialize MutationObserver
const observer = new MutationObserver(() => {
  addPageSelector();
});

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true
});
