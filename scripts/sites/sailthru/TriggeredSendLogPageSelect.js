// ==UserScript==
// @name        Triggered Send Log Page Select - sailthru.com
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/reports/transactional_log
// @grant       none
// @version     1.0
// @author      -
// @description 2023-09-18, 11:56:00 a.m.
// ==/UserScript==

if (window.top === window.self) {
  let low = 1;  // Minimum page number
  let high = 1000;  // A very high guess for the maximum page number
  let lastValidPage = 1;
let currentURL

  function checkPage(pageNumber) {
    // console.log('Running checkPage() with #: ', pageNumber)
    // Create hidden iframe if it doesn't exist
    let iframe = document.querySelector('#hiddenFrame');
    // console.log(iframe)
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.style.display = 'none';

      iframe.id = 'hiddenFrame';

      document.body.appendChild(iframe);
    }


    // Get the current URL and decode it
    if(!currentURL){
      currentURL = decodeURIComponent(decodeURIComponent(window.location.href))
    } else {
      currentURL = iframe.src
    }

    const urlParams = new URLSearchParams(currentURL.split('#')[1]);

    // console.log('currentURL: ', currentURL)

    // Update the 'start' parameter
    urlParams.set('start', (pageNumber - 1) * 20);

    // Reassemble the URL
    const newURL = `${window.location.origin}${window.location.pathname}#${urlParams.toString()}`;
    // console.log('newURL: ', newURL)
    iframe.src = '';
    iframe.src = newURL;

    iframe.onload = function() {
      // console.log(pageNumber, ' iframe loaded')
      const paginationDiv = iframe.contentDocument.querySelector('.pagination');
      if (paginationDiv) {
        lastValidPage = pageNumber;
        low = pageNumber;
        high = 2 * high;
      } else {
        high = pageNumber;
      }

      if (high - low <= 1) {
        updatePageSelector(lastValidPage);

        // console.log('found max: ', high)
        console.timeEnd("Runtime");
        return;
      }

      // console.log('didnt find max, checking this next: ', Math.floor((low + high) / 2))

      // Start the search
      checkPage(Math.floor((low + high) / 2));
    };
  }

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

  // Function to populate or update the page selector
  function updatePageSelector(lastValidPage) {
    // Locate the existing selector
    const existingSelector = document.querySelector('.page-selector');

    // Clear the existing options
    existingSelector.innerHTML = '';

    // Add new options based on the maxPage value
    for (let i = 1; i <= lastValidPage; i++) {
      const option = document.createElement('option');
      option.value = (i - 1) * 20;
      option.text = `Page ${i}`;
      existingSelector.appendChild(option);
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

  // Start the search
  console.time("Runtime")
  checkPage(Math.floor((low + high) / 2));
}
