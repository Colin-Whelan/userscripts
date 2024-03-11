// ==UserScript==
// @name        (Deprecated) Hosted Page - Correct Links
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/content/hosted_page_list*
// @grant       none
// @version     1.0
// @author      Colin Whelan
// @description (Deprecated) - Sailthru has fixed this issue :)
// ==/UserScript==
(function() {
  'use strict';

  function correctLinksInRows(contentObserver) {
    // Disconnect the observer to prevent triggering it while making changes
    contentObserver.disconnect();

    const rows = document.querySelectorAll('div[role="row"].Styles__Row-sc-10cygpm-3');
    rows.forEach(row => {
      const links = row.querySelectorAll('a[href^="/hosted_page_composer/"]');
      links.forEach(link => {
        link.href = link.href.replace('/hosted_page_composer/', '/content/hosted_page_composer/');
      });
    });

    // Reconnect the observer to watch for further changes
    contentObserver.observe(targetNode, {
      childList: true,
      subtree: true
    });
  }

  const targetNode = document.querySelector('div[role="rowgroup"].Styles__Body-sc-10cygpm-2.gvylAY');

  if (targetNode) {
    const contentObserver = new MutationObserver((mutations, observer) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          correctLinksInRows(contentObserver);
          break;
        }
      }
    });

    // Start observing immediately
    contentObserver.observe(targetNode, {
      childList: true,
      subtree: true
    });
  }

})();
