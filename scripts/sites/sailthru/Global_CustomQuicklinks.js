// ==UserScript==
// @name        Sailthru Global - Custom Quicklinks
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/*
// @grant       GM_addStyle
// @version     1.3
// @author      Colin Whelan
// @description Add quick links to the navbar. Add/remove as needed.
//
// v1.3
// Updated to use CSS constants for easier maintenance.
//
// v1.2
// Updated to be a bit smaller.
//
// v1.1
// -- patched for the May 2024 UI update
// ==/UserScript==

// CSS Constants
const TEXT_TRANSFORM = 'none'; // Options: none, uppercase, lowercase
const LINK_MARGIN = 'auto 5px auto 5px';
const FONT_SIZE = '10px';
const FONT_WEIGHT = '500';

// Your quicklinks in JSON format
const quicklinksJSON = `
[
  {"text": "Triggered Send Log", "url": "/reports/transactional_log"},
  {"text": "Templates", "url": "/templates-list"},
  {"text": "LOs", "url": "/lifecycle_optimizer#/"}
]`;

let quicklinksAdded = false;

(function() {
    GM_addStyle(`
        .iIkGvM {
          text-transform: ${TEXT_TRANSFORM} !important;
          margin: ${LINK_MARGIN} !important;
        }
        .iIkGvM span {
          font-size: ${FONT_SIZE} !important;
          font-weight: ${FONT_WEIGHT} !important;
        }
#header_logo {
  margin-top: 8px !important;
      width: 165px !important;
    height: 30px !important;
  background-size: auto 25px !important;
  margin-right: 0px !important;
}
#header_first_row{
  height: 50px  !important;
}
        .fkevmP {
          padding: 6px 30px 6px 9px !important;
        }
        .bQxlQZ {
          width: 45px !important;
          height: 45px !important;
        }
    `);

    'use strict';
    const quicklinks = JSON.parse(quicklinksJSON);

    // Set an interval to repeatedly check for the element
    var checkExportButtonInterval = setInterval(function() {
        let target = document.getElementById('header_nav_links');
        if (target) {
            clearInterval(checkExportButtonInterval); // Clear the interval once the function is called
            addQuicklinks(target, quicklinks);
        }
    }, 100);

    // Function to add quicklinks
    function addQuicklinks(ulElement, quicklinks) {
        const dividerElement = document.createElement('li');
        dividerElement.style.borderLeft = `1px solid rgb(223, 230, 231)`;
        dividerElement.style.height = '100%';
        dividerElement.style.margin = '0 8px';
        ulElement.appendChild(dividerElement);

        quicklinks.forEach(link => {
            const liElement = document.createElement('li');
            liElement.className = 'NavLinksComponent__NavBarItems-sc-1456pt8-1 hBHGeq';

            const aElement = document.createElement('a');
            aElement.href = link.url;
            aElement.className = 'NavLinksComponent__NavListElement-sc-1456pt8-0 iIkGvM';
            if(link.text.length > 10) aElement.classList.add('long-text');

            const spanElement = document.createElement('span');
            spanElement.innerText = link.text;
            aElement.appendChild(spanElement);

            liElement.appendChild(aElement);
            ulElement.appendChild(liElement);
        });

        quicklinksAdded = true;
    }
})();
