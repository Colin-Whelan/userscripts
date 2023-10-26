// ==UserScript==
// @name        Templates List - Show Template Usage in LOs
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/templates-list*
// @grant       none
// @version     1.0
// @author      Colin Whelan
// @grant       GM_xmlhttpRequest
// @description Adds a flag to indicate if a template is used in any LOs on Sailthru.
// ==/UserScript==

(function() {
    'use strict';

    // Function to fetch usage data and update the table row
    const checkUsageAndUpdateRow = async (row) => {
        const id = row.querySelector('.fa-info-circle').id;
        const usageURL = `https://my.sailthru.com/uiapi/lifecycle/?template_id=${id}`;
        const hrefURL = `https://my.sailthru.com/email-composer/${id}/usage`;

        // if the flag was already added, don't run
        if (row.querySelector('usageFlag')) return

        GM_xmlhttpRequest({
            method: "GET",
            url: usageURL,
            onload: function(response) {
                const data = JSON.parse(response.responseText);
                const count = data.length;

                const flagElement = document.createElement('a');
                flagElement.href = hrefURL;
                flagElement.textContent = `Used in ${count} LO${count == 1 ?  '' : 's'}`;
                flagElement.classList = ['usageFlag'];
                flagElement.style.color = count > 0 ?  'red' : 'green';
                flagElement.style.marginLeft = '10px';
                row.querySelector('.gisiQO').appendChild(flagElement);
            }
        });
    };

    // MutationObserver to watch for changes in the table
    const observer = new MutationObserver((mutationsList, observer) => {
        const tableRows = document.querySelectorAll('.src__BodyRow-sc-1epr26z-5');

        if (!tableRows || tableRows.length == 0) return

        tableRows.forEach(row => {
            // if the flag was already added, don't run
            if (row.querySelector('usageFlag')) return

            checkUsageAndUpdateRow(row);
        });
        observer.disconnect()
    });

    // Start observing the document for mutations
    observer.observe(document, {
        childList: true,
        subtree: true
    });
})();
