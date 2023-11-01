// ==UserScript==
// @name        Lifecycle Optimizer - Extract Templates
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/lifecycle_optimizer#/
// @grant       GM_xmlhttpRequest
// @grant       GM_addStyle
// @version     1.4
// @author      Colin Whelan
// @description Extract the templates from the LO steps and add a link to the template.
// ==/UserScript==

// Prevents from attempting to run on individual LO pages.
if (window.location.href !== "https://my.sailthru.com/lifecycle_optimizer#/") {
    return;
}

let templatesList = {};
let templateDetails = {};

GM_addStyle(`
.modal-background {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 1000;
    display: none;
}
.modal-content {
    background: #fff;
    padding: 20px;
    margin: 10% auto;
    width: 80%;
    max-height: 80%;
    overflow-y: auto;
    position: relative;
}
.close-button {
    position: absolute;
    right: 10px;
    top: 5px;
    cursor: pointer;
}
.view-button {
    float: left;
    margin-right: 10px;
    padding: 8px 12px;
    border: none;
    background-color: #007bff;
    color: white;
    cursor: pointer;
    border-radius: 4px;
}
.view-button:hover {
    background-color: #0056b3;
}
`);

const injectButton = () => {
    const targetElement = document.querySelector('.sc-pIUfD.qlYhQ');
    if (targetElement) {
        const button = document.createElement('button');
        button.className = 'view-button';
        button.id = 'extractTemplates';
        button.textContent = 'View Extracted Templates';
        targetElement.insertBefore(button, targetElement.firstChild);

        button.addEventListener('click', function() {
            if (!document.querySelector('.template-header')) {
                const header = document.createElement('div');
                header.setAttribute('colspan', '1');
                header.setAttribute('role', 'columnheader');
                header.setAttribute('style', 'box-sizing: border-box; flex: 1 0 auto; min-width: 0px; width: 1px;');
                header.className = 'sc-qYSYK sc-pBolk dCndrf';
                header.style.width = '20%';

                // Add a custom class to identify this header
                header.classList.add('template-header');

                const headerSpan = document.createElement('span');
                headerSpan.setAttribute('title', 'Toggle SortBy');
                headerSpan.style.cursor = 'pointer';
                headerSpan.innerHTML = 'Templates <i class=""></i>';

                header.appendChild(headerSpan);

                // Insert the new header before the last header
                const headerRow = document.querySelector('.sc-pkhIR.klvzgX');
                headerRow.insertBefore(header, headerRow.lastChild);
            }

            // 2. Add a new cell in each data row
            const dataRows = Array.from(document.querySelectorAll('[role="row"]')).slice(1);

            dataRows.forEach(row => {
                const cell = document.createElement('div');
                cell.setAttribute('role', 'cell');
                cell.setAttribute('style', 'box-sizing: border-box; flex: 1 0 auto; min-width: 0px; width: 1px;');
                cell.style.width = '20%';

                const loName = row.querySelector('div[role="cell"]').textContent.trim();
                if (templateDetails[loName]) {
                    templateDetails[loName].forEach(template => {
                        const templateLink = document.createElement('a');
                        templateLink.href = `https://my.sailthru.com/email-composer/${template.templateId}`;
                        templateLink.textContent = template.templateName;
                        templateLink.target = '_blank';
                        cell.appendChild(templateLink);

                        // Add a line break after each template link
                        cell.appendChild(document.createElement('br'));
                    });
                } else {
                    cell.innerHTML = 'No linked template';
                }

                // Insert the new cell before the last cell of each data row
                row.insertBefore(cell, row.lastChild);
            });

        });
    }
};

// Get all template data
GM_xmlhttpRequest({
    method: "GET",
    url: "https://my.sailthru.com/uiapi/templates",
    onload: function(response) {
        templatesList = JSON.parse(response.responseText);
        fetchLOData();
    }
});

function fetchLOData() {
    GM_xmlhttpRequest({
        method: "GET",
        url: "https://my.sailthru.com/uiapi/lifecycle",
        onload: function(response) {
            const data = JSON.parse(response.responseText);
            const uniqueTemplates = new Set();

            for (const lo of Object.values(data)) {
                for (const step of Object.values(lo.steps)) {
                    if (step.subtype === "sendEmail") {
                        const templateId = step.taskAttributes.templateId;

                        if (uniqueTemplates.has(templateId)) {
                            continue;
                        }
                        uniqueTemplates.add(templateId);

                        const matchingTemplate = templatesList.find(template => template.template_id === templateId);
                        const templateName = matchingTemplate ? matchingTemplate.name : "Unknown";

                        if (!templateDetails[lo.name]) {
                            templateDetails[lo.name] = [];
                        }
                        templateDetails[lo.name].push({templateId: templateId, templateName: templateName});
                    }
                }
            }

            injectButton();
        }
    });
}
