// ==UserScript==
// @name        Lifecycle Optimizer - Extract Templates
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/lifecycle_optimizer*
// @grant       GM_xmlhttpRequest
// @grant       GM_addStyle
// @version     1.9.1
// @description Extract the templates from the LO steps and add a link to the template. Create mermaid flowcharts for each LO.
// v1.9.1:
// Adds option to print LOs in a better view than native.
//
// Todo:
// style it to be more like Sailthru's LOs
// Add mermaid export
// Add image export
// Add export all option
// Account for if template is visual or HTML. Assumes visual for now.
//
//
// ==/UserScript==

// Prevents from attempting to run on individual LO pages.
if (window.location.href !== "https://my.sailthru.com/lifecycle_optimizer#/") {
    return;
}

let templatesList = {};
let templateDetails = {};
let LOs = {};

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

// Function to dynamically load Mermaid.js
function loadMermaid(callback) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
    script.onload = callback;
    document.head.appendChild(script);
}

const injectButton = () => {
    const targetElement = document.querySelector('.sc-pIUfD > div:last-child');
    if (targetElement) {
        const button = document.createElement('button');
        button.className = 'view-button';
        button.id = 'extractTemplates';
        button.textContent = 'View Templates';
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
                if (!row.querySelector('.template-cell')) {
                    const cell = document.createElement('div');
                    cell.setAttribute('role', 'cell');
                    cell.setAttribute('style', 'box-sizing: border-box; flex: 1 0 auto; min-width: 0px; width: 1px;');
                    cell.style.width = '20%';

                    const loName = row.querySelector('div[role="cell"]').textContent.trim();
                    if (templateDetails[loName]) {
                        templateDetails[loName].forEach(template => {
                            if (!template.templateId) return
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

                    // Add a custom class to identify this cell
                    cell.classList.add('template-cell');

                    // Insert the new cell before the last cell of each data row
                    row.insertBefore(cell, row.lastChild);
                }
            });

        });
    }
};

// Function to convert data to CSV format
function convertToCSV(objArray) {
    const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;
    let str = 'LO Name,LO Link,Template Name,Template Link\n';

    for (const loName in templateDetails) {
        const templates = templateDetails[loName];
        templates.forEach(template => {
            if (!template.templateId) return
            str += `${loName},https://my.sailthru.com/lifecycle_optimizer/flows/${template.LoId},${template.templateName},https://my.sailthru.com/email-composer/${template.templateId}\n`;
        });
    }

    return str;
}

// Function to start file download
function downloadCSV(csvContent, fileName) {
    let encodedUri = encodeURI(`data:text/csv;charset=utf-8,${csvContent}`);
    encodedUri = encodedUri.replaceAll("/flows", "%23/flows")
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Function to generate mermaid flowchart
function generateMermaidDiagram(lo) {
    // console.log("Generating Mermaid diagram for LO:", lo.name);

    let diagram = 'flowchart TD;\n';
    for (const stepId in lo.steps) {
        const step = lo.steps[stepId];
        let stepLabel = step.subtype;
        switch (step.subtype) {
            case 'customEvent':
                if (step.taskAttributes) {
                    stepLabel += `\n${step.taskAttributes.event}`;
                }
                break;
            case 'sendEmail':
                if (step.taskAttributes.templateId) {
                    const template = templatesList.find(template => template.template_id === step.taskAttributes.templateId);
                    const templateName = template ? template.name : "Unknown Template";
                    stepLabel += `\n<a href="https://my.sailthru.com/email-composer/${step.taskAttributes.templateId}" target="_blank">${templateName}</a>`;
                }
                break;
            case 'relative':
                if (step.taskAttributes.time) {
                    const amount = step.taskAttributes.time.amount;
                    const unit = step.taskAttributes.time.unit.substring(0,step.taskAttributes.time.unit.length-1);
                    const unitLabel = amount > 1 ? `${unit}s` : unit;
                    stepLabel = `Wait: ${amount} ${unitLabel}`;
                }
                break;
            case 'multiVarEq':
                if (step.taskAttributes) {
                    stepLabel += `\nCheck if: '${step.taskAttributes.var}' == `;
                }
                break;
            case 'optout':
                if (step.taskAttributes) {
                    stepLabel += `\nCheck if: 'optout' == ${step.taskAttributes.optout}`;
                }
                break;
            case 'listMember':
                if (step.taskAttributes) {
                    stepLabel += `\nCheck if user in list: ${step.taskAttributes.listName}`;
                }
                break;
            case 'addToList':
            case 'removeFromList':
                if (step.taskAttributes) {
                    stepLabel += `\n${step.taskAttributes.listName}`;
                }
                break;
            case 'profileVar':
                if (step.taskAttributes.audienceBuilderQuery && step.taskAttributes.audienceBuilderQuery.criteriaMap) {
                    const criteria = Object.values(step.taskAttributes.audienceBuilderQuery.criteriaMap)[0];
                    let criteriaType = criteria.criteria
                    switch (criteriaType) {
                      case 'date':
                        stepLabel += `\nType: ${criteriaType} (${criteria.key}) \nCheck if: ${criteria.field} ${criteria.timerange} ${criteria.value}`;
                        break;
                      case 'lo_between':
                        stepLabel += `\nType: ${criteriaType} ${criteria.date_selector_type ? "(" + criteria.date_selector_type + ")" : ""} \nCheck if: '${criteria.field}' is between ${criteria.value[0]} and ${criteria.value[1]}`;
                        break;
                      case 'gt':
                        stepLabel += `\nType: greater than \nCheck if: '${criteria.field}' > ${criteria.value}`;
                        break;
                      case 'lt':
                        stepLabel += `\nType: less than \nCheck if: '${criteria.field}' < ${criteria.value}`;
                        break;
                      default:
                        break;
                    }

                }
                break;
            case 'setVar':
                if (step.taskAttributes) {
                    stepLabel += `\nSet '${step.taskAttributes.variables[0].key}' to ${step.taskAttributes.variables[0].value == "" ? "''" : step.taskAttributes.variables[0].value}`;
                }
                break;
            case null:
                stepLabel = `END`;
                break;
            default:
                break;
        }

        diagram += `${stepId}["${stepLabel}"];\n`;

        if (step.children) {
            step.children.forEach(child => {
                const matchLabel = child.match !== undefined ? child.match : ' ';
                // console.log(`Adding connection: ${stepId} -->|${matchLabel}| ${child.nextId}`);
                diagram += `${stepId} -->|${matchLabel}| ${child.nextId ? child.nextId : "END"};\n`;
            });
        } else {
            // console.log(`No children for step: ${stepId}`);
        }
    }
    // console.log("Generated diagram:\n", diagram);
    return diagram;
}



// Inject the Download Button
const injectDownloadButton = () => {
    const targetElement = document.querySelector('.sc-pIUfD > div:last-child');
    if (targetElement) {
        const button = document.createElement('button');
        button.className = 'view-button';
        button.id = 'downloadTemplates';
        button.textContent = 'Download LO + Template Links';
        targetElement.insertBefore(button, targetElement.firstChild);

        button.addEventListener('click', function() {
            const csvData = convertToCSV(templateDetails);
            downloadCSV(csvData, 'LO and Template Links.csv');
        });
    }
};

const injectPrintLOsButton = () => {
    const targetElement = document.querySelector('.sc-pIUfD > div:last-child');
    if (targetElement) {
        const button = document.createElement('button');
        button.className = 'view-button';
        button.id = 'printLOs';
        button.textContent = 'Print LOs';
        targetElement.insertBefore(button, targetElement.firstChild);

        button.addEventListener('click', function() {
            const modal = document.createElement('div');
            modal.className = 'modal-background';
            modal.style.display = 'block';

            const modalContent = document.createElement('div');
            modalContent.className = 'modal-content';

            const closeButton = document.createElement('span');
            closeButton.className = 'close-button';
            closeButton.textContent = 'X';
            closeButton.onclick = function() {
                modal.style.display = 'none';
            };

            modalContent.appendChild(closeButton);

            for (const loName in templateDetails) {
                const lo = templateDetails[loName][0];

                // Add a title for the LO
                const loTitle = document.createElement('h3');
                loTitle.style.margin = '5px 0px'
                loTitle.textContent = loName;
                modalContent.appendChild(loTitle);

                // Add a subtitle for the LO
                const loSubTitle = document.createElement('h4');
                loSubTitle.style.margin = '5px 0px'
                loSubTitle.textContent = ``;
                loSubTitle.textContent += `Re-entry allowed: ${lo.reentry.isAllowed}`
                loSubTitle.textContent += ` | Block while in flow: ${lo.reentry.ifPresent}`
                if(lo.reentry.afterDelay) {
                  loSubTitle.textContent += ` | Restrict to once every: ${lo.reentry.afterDelay.amount} ${lo.reentry.afterDelay.unit}`
                }
                modalContent.appendChild(loSubTitle);

                // Add update details
                const loDates = document.createElement('h5');
                loDates.style.margin = '5px 0px'
                const createDate = new Date(lo.createTime);
                const modifyDate = new Date(lo.lastEditedTime);
                loDates.textContent = ``;
                loDates.textContent += `Created: ${createDate.toLocaleString()} | Last Modified: ${modifyDate.toLocaleString()}`
                modalContent.appendChild(loDates);

                const mermaidDiagram = generateMermaidDiagram(lo);
                const diagramContainer = document.createElement('div');
                diagramContainer.innerHTML = `<pre class="mermaid">${mermaidDiagram}</pre>`;
                modalContent.appendChild(diagramContainer);

                // Only run for the first LO for testing
                // break;
            }

            modal.appendChild(modalContent);
            document.body.appendChild(modal);

            // Render mermaid diagrams
            mermaid.initialize({
                startOnLoad: true,
                theme: 'base',
                themeVariables: {
                    background: '#FFFFFF',
                    primaryColor: '#DADEDF',
                    primaryTextColor: '#555F61',
                    primaryBorderColor: '#DADEDF',
                    lineColor: '#DADEDF',
                    secondaryColor: '#E0E0E0',
                    tertiaryColor: '#F0F0F0',
                    nodeBorder: '#CCCCCC',
                    edgeLabelBackground: '#FFFFFF',
                    nodeTextColor: '#333333',
                    mainBkg: '#DADEDF',
                    textColor: '#333333',
                    labelBackground: '#FFFFFF',
                    fontFamily: 'Arial, sans-serif',
                    nodePadding: '10px',
                    clusterBkg: '#E0E0E0',
                    clusterBorder: '#CCCCCC',
                    defaultLinkColor: '#333333'
                }
            });
            mermaid.init(undefined, document.querySelectorAll('.mermaid'));
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

            for (const lo of Object.values(data)) {
                const uniqueTemplates = new Set();

                if (!templateDetails[lo.name]) {
                    templateDetails[lo.name] = [];
                }

                templateDetails[lo.name].push(lo);

                for (const step of Object.values(lo.steps)) {
                    if (step.subtype === "sendEmail") {
                        const templateId = step.taskAttributes.templateId;

                        if (uniqueTemplates.has(templateId)) {
                            continue;
                        }
                        uniqueTemplates.add(templateId);

                        const matchingTemplate = templatesList.find(template => template.template_id === templateId);
                        const templateName = matchingTemplate ? matchingTemplate.name : "Unknown";

                        templateDetails[lo.name].push({templateId: templateId, templateName: templateName, LoId: lo.id});
                    }
                }
            }

            injectButton();
        }
    });

  console.log(templateDetails)
}

// Load Mermaid.js and initialize the script with custom theme
loadMermaid(() => {
    injectDownloadButton();
    injectPrintLOsButton();
});


