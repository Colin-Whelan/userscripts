// ==UserScript==
// @name        Lifecycle Optimizer - Clickable LOs
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/lifecycle_optimizer*
// @grant       none
// @version     1.0
// @author      Colin Whelan
// @description Makes LOs clickable like normal, middle/right click to open in new tab/window
// @grant       GM_xmlhttpRequest
// ==/UserScript==
(function() {
  'use strict';

  let dataCache = [];

  function fetchIdsFromApi(callback) {
    GM_xmlhttpRequest({
      method: "GET",
      url: "https://my.sailthru.com/uiapi/lifecycle",
      onload: function(response) {
        dataCache = JSON.parse(response.responseText);
        if (typeof callback === "function") {
          callback();
        }
      }
    });
  }

  function linkRowNamesToUrls() {
    // Disconnect the observer
    contentObserver.disconnect();

    const rows = document.querySelectorAll('.sc-pbIaG.sc-psCJM.bhxIyA');
    rows.forEach(row => {
      const nameDiv = row.children[0];
      if (nameDiv) {
        const rowName = nameDiv.textContent;
        const matchingObject = dataCache.find(obj => obj.name === rowName);
        if (matchingObject) {
          const url = `https://my.sailthru.com/lifecycle_optimizer#/flows/${matchingObject.id}`;
          nameDiv.innerHTML = `<a href="${url}" target="_blank" style="color: #555; font-weight: bold;">${rowName}</a>`;
          nameDiv.style.lineHeight = '48px'
        }
      }
    });

    // Reconnect the observer
    if (targetNode) {
      contentObserver.observe(targetNode, {
        childList: true,
        subtree: true
      });
    }
  }

  // Watch for content updates
  const contentObserver = new MutationObserver((mutations, observer) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        setTimeout(linkRowNamesToUrls, 800)
        break; // Exit loop once we've handled the update
      }
    }
  });

  // Start the observer
  const targetNode = document.querySelector('div[role="rowgroup"].sc-oTmZL.kfNTWi');
  if (targetNode) {
    contentObserver.observe(targetNode, {
      childList: true,
      subtree: true
    });
  }

  // Fetch the IDs as soon as the script runs
  fetchIdsFromApi(linkRowNamesToUrls);

})();
