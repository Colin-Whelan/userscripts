// ==UserScript==
// @name        Templates List - Show Template Usage in LOs
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/templates-list*
// @grant       none
// @version     1.3
// @author      Colin Whelan
// @grant       GM_xmlhttpRequest
// @description Adds a flag to indicate if a template is used in any LOs on Sailthru. Green = 0 LOs, Orange = Only Inactive LOs, Red = Active LOs.
// 1.3 - Update for the May 2024 UI update. Clicking bubble will open in new tab now.
// ==/UserScript==

(function() {
    'use strict';

    const checkUsageAndUpdateRow = async (row) => {

      const url = row.querySelector(':nth-child(4) a').href // Extract the ID from the 4th child element

        // HTML Email
        let id = url.split('#')[1];

        // Visual Email
        if(!id) {
          id = url.split('/email-composer/')[1]
        }

        const usageURL = `https://my.sailthru.com/uiapi/lifecycle/?template_id=${id}`;
        const hrefURL = `https://my.sailthru.com/email-composer/${id}/usage`;

        // if the flag was already added, don't run
        if (row.getElementsByClassName('usageFlag').length > 0) return;

        GM_xmlhttpRequest({
            method: "GET",
            url: usageURL,
            onload: function(response) {
              const data = JSON.parse(response.responseText);

              const activeItems = data.filter(item => item.status === 'active');
              const inactiveItems = data.filter(item => item.status === 'inactive');

              const count = data.length;

              const colors = {};

              if(activeItems.length > 0) {
                colors.background = '#e8253b'
                colors.hover = '#BA1E2F'
              } else if(activeItems.length == 0 && inactiveItems.length > 0) {
                colors.background = '#FF8C00'
                colors.hover = '#F5761A'
              } else {
                colors.background = '#34c132'
                colors.hover = '#2C9A28'
              }

              const flagElement = document.createElement('a');
              flagElement.href = hrefURL;
              flagElement.target = '_blank';
              flagElement.addEventListener('click', (event) => {
                  event.stopPropagation(); // Prevent other click events from triggering
              });
              flagElement.textContent = `${activeItems.length}${inactiveItems.length ? '(' + inactiveItems.length + ')' : ''} LO${count == 1 ?  '' : 's'}`;
              flagElement.classList.add('usageFlag');
              flagElement.style.backgroundColor = colors.background; // red - green

              flagElement.onmouseover = () => flagElement.style.backgroundColor = colors.hover // Darker on hover
              flagElement.onmouseout = () => flagElement.style.backgroundColor = colors.background // Original on mouse out

              flagElement.style.color = 'white';
              flagElement.style.borderRadius = '10px';
              flagElement.style.padding = '0px 5px';
              flagElement.style.marginLeft = '10px';
              row.querySelector(':nth-child(7)').appendChild(flagElement);
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
            const tableRows = Array.from(document.getElementsByClassName('sc-eMkmGk')).slice(1); // Convert to array and remove the first row
            console.log(tableRows)
            tableRows.forEach(row => {
                checkUsageAndUpdateRow(row);
            });
        };
        document.querySelector('.sc-brSamD').appendChild(btn);
    };

    // Inject the button to the page
    addButton();

})();
