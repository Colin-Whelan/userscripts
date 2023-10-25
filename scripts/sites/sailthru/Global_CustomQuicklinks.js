// ==UserScript==
// @name        Sailthru Global - Custom Quicklinks
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/*
// @grant       none
// @version     1.0
// @author      Colin Whelan
// @description Add quick links to the navbar. Add/remove as needed.
// ==/UserScript==

// Your quicklinks in JSON format
const quicklinksJSON = `
[
  {"text": "Triggered Send Log", "url": "/reports/transactional_log"},
  {"text": "Templates", "url": "/templates-list"},
  {"text": "LOs", "url": "/lifecycle_optimizer#/"}
]`;

let quicklinksAdded = false;

(function() {
    'use strict';
    const quicklinks = JSON.parse(quicklinksJSON);

    // Initialize MutationObserver
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                const ulElement = document.getElementById('header_nav_links');
                if (ulElement && !quicklinksAdded) {
                    observer.disconnect(); // Disconnect the observer if the element is found
                    addQuicklinks(ulElement, quicklinks);
                }
            }
        });
    });

    // Start observing
    observer.observe(document.body, { childList: true, subtree: true });

    // Function to add quicklinks
    function addQuicklinks(ulElement, quicklinks) {
        const dividerElement = document.createElement('li');
        dividerElement.style.borderLeft = '1px solid rgb(223, 230, 231)';
        dividerElement.style.height = '100%';
        dividerElement.style.margin = '0 12px';
        ulElement.appendChild(dividerElement);

        quicklinks.forEach(link => {
            const liElement = document.createElement('li');
            liElement.className = 'NavLinksComponent__NavBarItems-sc-1456pt8-1 hBHGeq';

            const aElement = document.createElement('a');
            aElement.href = link.url;
            aElement.className = 'NavLinksComponent__NavListElement-sc-1456pt8-0 iIkGvM';

            const spanElement = document.createElement('span');
            spanElement.innerText = link.text;
            spanElement.style.fontSize = '0.8em'
    
            if(link.text.length > 10) aElement.style.marginTop = '10px'

            aElement.appendChild(spanElement);
            liElement.appendChild(aElement);
            ulElement.appendChild(liElement);
        });

      quicklinksAdded = true
    }
})();
