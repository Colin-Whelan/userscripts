// ==UserScript==
// @name        Triggered Send Log Page Select - sailthru.com
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/reports/transactional_log
// @grant       none
// @version     1.0
// @author      -
// @description 2023-09-18, 11:56:00 a.m.
// ==/UserScript==


function addPageSelector() {
  // Debug: Log the function call
  // console.log("addPageSelector called");

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

  // Populate the selector with some page numbers for demonstration
  for (let i = 1; i <= 200; i++) {
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
    const newURL = `${window.location.origin}${window.location.pathname}#${urlParams.toString()}`;
    window.location.href = newURL;
  });

  // Add the selector to the page (customize this based on where you want to insert it)
  const paginationDiv = document.querySelector('.pagination');
  if (paginationDiv) {
    paginationDiv.appendChild(selector);
    // console.log("Page selector added to .pagination div");
  } else {
    // console.log("No .pagination div found");
  }

  // console.log("Page selector added");
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

