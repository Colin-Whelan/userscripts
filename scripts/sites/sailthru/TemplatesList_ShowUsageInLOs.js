// ==UserScript==
// @name        Templates List - Show Template Usage in LOs
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/templates-list*
// @grant       none
// @version     1.1
// @author      Colin Whelan
// @grant       GM_xmlhttpRequest
// @description Adds a flag to indicate if a template is used in any LOs on Sailthru.
// ==/UserScript==

(function() {
    'use strict';

    const checkUsageAndUpdateRow = async (row) => {
        const id = row.querySelector('.fa-info-circle').id;
        const usageURL = `https://my.sailthru.com/uiapi/lifecycle/?template_id=${id}`;
        const hrefURL = `https://my.sailthru.com/email-composer/${id}/usage`;

        // if the flag was already added, don't run
        if (row.getElementsByClassName('usageFlag').length > 0) return;

        GM_xmlhttpRequest({
            method: "GET",
            url: usageURL,
            onload: function(response) {
                const data = JSON.parse(response.responseText);
                const count = data.length;

                const flagElement = document.createElement('a');
                flagElement.href = hrefURL;
                flagElement.textContent = `${count} LO${count == 1 ?  '' : 's'}`;
                flagElement.classList.add('usageFlag');
                flagElement.style.backgroundColor = count > 0 ?  '#e8253b' : '#34c132'; // red - green

                flagElement.onmouseover = () => flagElement.style.backgroundColor = count > 0 ?  '#BA1E2F' : '#2C9A28'; // Darker on hover
                flagElement.onmouseout = () => flagElement.style.backgroundColor = count > 0 ?  '#e8253b' : '#34c132'; // Original on mouse out

                flagElement.style.color = 'white';
                flagElement.style.borderRadius = '10px';
                flagElement.style.padding = '0px 5px';
                flagElement.style.marginLeft = '10px';
                row.querySelector('.gisiQO').appendChild(flagElement);
            }
        });
    };

    const addButton = () => {
        const btn = document.createElement("button");
        btn.textContent = "Check Template Usage in LOs";
        btn.style.top = "20px";
        btn.style.right = "20px";
        btn.style.zIndex = "9999";
        btn.style.padding = "8px 20px";
        btn.style.margin = "6px";
        btn.style.borderRadius = "5px";
        btn.style.backgroundColor = "#3a7af0"; // Blue color
        btn.style.color = "white";
        btn.style.border = "none";
        btn.style.cursor = "pointer";
        btn.style.fontSize = "14px";
        btn.style.fontWeight = "bold";
        btn.style.transition = "background-color 0.3s";
        btn.onmouseover = () => btn.style.backgroundColor = "#2E62C0"; // Darker blue on hover
        btn.onmouseout = () => btn.style.backgroundColor = "#3a7af0"; // Original blue on mouse out
        btn.onclick = () => {
            const tableRows = document.querySelectorAll('.src__BodyRow-sc-1epr26z-5');
            tableRows.forEach(row => {
                checkUsageAndUpdateRow(row);
            });
        };
        document.querySelector('.sc-bwzfXH').appendChild(btn);
    };

    // Inject the button to the page
    addButton();

})();