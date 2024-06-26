// ==UserScript==
// @name        Lifecycle Optimizer - Extract Templates
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/lifecycle_optimizer*
// @grant       GM_xmlhttpRequest
// @grant       GM_addStyle
// @version     1.9.5
// @description Extract the templates from the LO steps and add a link to the template. Create mermaid flowcharts for each LO.
//
// v1.9.5:
// Completely refactored - much smaller functions
//
// v1.9.4:
// Added more step details
// Added search functionality
// Added Print button
//
// v1.9.3:
// Added more step details
// fixed download options
//
// v1.9.2:
// Added more step details
//
// v1.9.1:
// Adds option to print LOs in a better view than native.
//
// Todo:
// Add per chart export
// Account for if template is visual or HTML. Assumes visual for now.
//
//
// ==/UserScript==

// Global variables
let templatesList = {};
let loDetails = {};
let LOs = {};

// Styles
const styles = `
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
    padding: 20px 20px 20px 20px;
    margin: 10% auto;
    width: 80%;
    max-height: 80%;
    overflow-y: auto;
    position: relative;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}
.close-button {
    position: sticky;
    top: 0px;
    cursor: pointer;
    z-index: 1001;
    background: #ff5c5c;
    color: white;
    border: none;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
}
.close-button:hover {
    background: #ff3b3b;
}
.search-container{
  position: sticky;
}
.search-bar {
    position: sticky;
    top: 0px;
    width: calc(100% - 80px);
    z-index: 1001;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 20px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    font-size: 14px;
    outline: none;
    margin: 0px 0 20px 0;
}
.search-bar::placeholder {
    color: #888;
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
.print-button {
    position: sticky;
    top: 53px;
    right: 50px;
    z-index: 1001;
    padding: 8px 12px;
    border: none;
    background-color: #28a745;
    color: white;
    cursor: pointer;
    border-radius: 4px;
    margin: 0 0 1em 0;
}
.print-button:hover {
    background-color: #218838;
}
`;

// API Functions
function fetchTemplates() {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: "https://my.sailthru.com/uiapi/templates",
            onload: function(response) {
                templatesList = JSON.parse(response.responseText);
                resolve();
            },
            onerror: reject
        });
    });
}

function fetchLOData() {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: "https://my.sailthru.com/uiapi/lifecycle",
            onload: function(response) {
                const data = JSON.parse(response.responseText);
                resolve(data);
            },
            onerror: reject
        });
    });
}

// Button Functions
function createViewTemplatesButton() {
    const button = createButton('View Templates', 'extractTemplates');
    button.addEventListener('click', handleViewTemplatesClick);
    injectButton(button);
}

function createDownloadButton() {
    const button = createButton('Download LO + Template Links', 'downloadTemplates');
    button.addEventListener('click', handleDownloadClick);
    injectButton(button);
}

function createPrintLOsButton() {
    const button = createButton('Print LOs', 'printLOs');
    button.addEventListener('click', handlePrintLOsClick);
    injectButton(button);
}

function createButton(text, id) {
    const button = document.createElement('button');
    button.className = 'view-button';
    button.id = id;
    button.textContent = text;
    return button;
}

function injectButton(button) {
    const targetElement = document.querySelector('.sc-pIUfD > div:last-child');
    if (targetElement) {
        targetElement.insertBefore(button, targetElement.firstChild);
    }
}

// Button Click Handlers
function handleViewTemplatesClick() {
    if (!document.querySelector('.template-header')) {
        addTemplateHeader();
    }
    addTemplateCells();
}

function handleDownloadClick() {
    const csvData = convertToCSV(loDetails);
    downloadCSV(csvData, 'LO and Template Links.csv');
}

function handlePrintLOsClick() {
    const modal = createModal();
    document.body.appendChild(modal);
    renderMermaidDiagrams();
}

// UI Creation Functions
function createModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-background';
    modal.style.display = 'block';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';
    modalContent.appendChild(searchContainer);

    modal.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };

    const searchBar = createSearchBar();
    modalContent.appendChild(searchBar);

    const printButton = createPrintButton();
    modalContent.appendChild(printButton);

    for (const loName in loDetails) {
        const lo = loDetails[loName][0];
        const diagramContainer = createDiagramContainer(lo);
        modalContent.appendChild(diagramContainer);
    }

    modal.appendChild(modalContent);
    return modal;
}

function createSearchBar() {
    const searchBar = document.createElement('input');
    searchBar.className = 'search-bar';
    searchBar.type = 'text';
    searchBar.placeholder = 'Search...';
    searchBar.style.marginBottom = '1em';
    searchBar.oninput = handleSearch;
    return searchBar;
}

function createPrintButton() {
    const printButton = document.createElement('button');
    printButton.className = 'print-button';
    printButton.textContent = 'Print Visible';
    printButton.onclick = handlePrint;
    return printButton;
}

function createDiagramContainer(lo) {
    const diagramContainer = document.createElement('div');
    diagramContainer.className = 'diagram-container';

    const loTitle = createLOTitle(lo.name);
    diagramContainer.appendChild(loTitle);

    const loSubTitle = createLOSubTitle(lo);
    diagramContainer.appendChild(loSubTitle);

    const loDates = createLODates(lo);
    diagramContainer.appendChild(loDates);

    const mermaidDiagram = generateMermaidDiagram(lo);
    const mermaidContainer = document.createElement('div');
    mermaidContainer.innerHTML = `<pre class="mermaid">${mermaidDiagram}</pre>`;
    diagramContainer.appendChild(mermaidContainer);

    return diagramContainer;
}

function createLOTitle(name) {
    const loTitle = document.createElement('h3');
    loTitle.style.margin = '5px 0px';
    loTitle.textContent = name;
    return loTitle;
}

function createLOSubTitle(lo) {
    const loSubTitle = document.createElement('h4');
    loSubTitle.style.margin = '5px 0px';
    loSubTitle.textContent = `Re-entry allowed: ${lo.reentry.isAllowed} | Block while in flow: ${lo.reentry.ifPresent}`;
    if (lo.reentry.afterDelay) {
        loSubTitle.textContent += ` | Restrict to once every: ${lo.reentry.afterDelay.amount} ${lo.reentry.afterDelay.unit}`;
    }
    return loSubTitle;
}

function createLODates(lo) {
    const loDates = document.createElement('h5');
    loDates.style.margin = '5px 0px';
    const createDate = new Date(lo.createTime);
    const modifyDate = new Date(lo.lastEditedTime);
    loDates.textContent = `Created: ${createDate.toLocaleString()} | Last Modified: ${modifyDate.toLocaleString()}`;
    return loDates;
}

// Mermaid Diagram Functions
function generateMermaidDiagram(lo) {
    let diagram = 'flowchart TD;\n';
    for (const stepId in lo.steps) {
        const step = lo.steps[stepId];
        diagram += generateStepNode(stepId, step);
        diagram += generateStepConnections(stepId, step);
    }
    return diagram;
}

function generateStepNode(stepId, step) {
    const stepLabel = getStepLabel(step);
    return `${stepId}["${stepLabel}"];\n`;
}

function generateStepConnections(stepId, step) {
    let connections = '';
    if (step.children) {
        step.children.forEach(child => {
            const matchLabel = getMatchLabel(step, child);
            connections += `${stepId} -->|${matchLabel}| ${child.nextId ? child.nextId : "END"};\n`;
        });
    }
    return connections;
}

function getStepLabel(step) {
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
        case 'multiEventVarEq':
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
        case 'abTest':
            break;
        default:
            break;
    }
    return stepLabel;
}

function getMatchLabel(step, child) {
    switch (step.subtype) {
        case 'abTest':
            return child.match.allocation + "%";
        default:
            return child.match !== undefined ? child.match.toString().replaceAll('"','').replaceAll('|', '/') : ' ';
    }
}

// Data Processing Functions
function processLOData(data) {
    for (const lo of Object.values(data)) {
        const uniqueTemplates = new Set();

        if (!loDetails[lo.name]) {
            loDetails[lo.name] = [];
        }

        loDetails[lo.name].push(lo);

        for (const step of Object.values(lo.steps)) {
            if (step.subtype === "sendEmail") {
                const templateId = step.taskAttributes.templateId;

                if (uniqueTemplates.has(templateId)) {
                    continue;
                }
                uniqueTemplates.add(templateId);

                const matchingTemplate = templatesList.find(template => template.template_id === templateId);
                const templateName = matchingTemplate ? matchingTemplate.name : "Unknown";

                loDetails[lo.name].push({templateId: templateId, templateName: templateName, LoId: lo.id});
            }
        }
    }
}

function convertToCSV(objArray) {
    const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;
    let str = 'LO Name,LO Link,Template Name,Template Link\n';

    for (const loName in loDetails) {
        const templates = loDetails[loName];
        templates.forEach(template => {
            if (!template.templateId) return;
            str += `${loName},https://my.sailthru.com/lifecycle_optimizer/flows/${template.LoId},${template.templateName},https://my.sailthru.com/email-composer/${template.templateId}\n`;
        });
    }

    return str;
}

// Utility Functions
function downloadCSV(csvContent, fileName) {
    let encodedUri = encodeURI(`data:text/csv;charset=utf-8,${csvContent}`);
    encodedUri = encodedUri.replaceAll("/flows", "%23/flows");
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function loadMermaid(callback) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
    script.onload = callback;
    document.head.appendChild(script);
}

function handleSearch() {
    const filter = this.value.toLowerCase();
    const items = document.querySelectorAll('.diagram-container');
    items.forEach(item => {
        const title = item.querySelector('h3');
        const text = title.textContent || title.innerText;
        item.style.display = text.toLowerCase().indexOf(filter) > -1 ? '' : 'none';
    });
}

function handlePrint() {
    const printContents = Array.from(document.querySelectorAll('.diagram-container'))
        .filter(item => item.style.display !== 'none')
        .map(item => item.innerHTML)
        .join('');
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Print Diagrams</title>
            <style>
                body { font-family: Arial, sans-serif; }
                .diagram-container { margin-bottom: 20px; }
                h3, h4, h5 { margin: 5px 0; }
            </style>
        </head>
        <body>${printContents}</body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

function renderMermaidDiagrams() {
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
}

// Template Header and Cell Functions
function addTemplateHeader() {
    const header = document.createElement('div');
    header.setAttribute('colspan', '1');
    header.setAttribute('role', 'columnheader');
    header.setAttribute('style', 'box-sizing: border-box; flex: 1 0 auto; min-width: 0px; width: 1px;');
    header.className = 'sc-qYSYK sc-pBolk dCndrf template-header';
    header.style.width = '20%';

    const headerSpan = document.createElement('span');
    headerSpan.setAttribute('title', 'Toggle SortBy');
    headerSpan.style.cursor = 'pointer';
    headerSpan.innerHTML = 'Templates <i class=""></i>';

    header.appendChild(headerSpan);

    const headerRow = document.querySelector('.sc-pkhIR.klvzgX');
    headerRow.insertBefore(header, headerRow.lastChild);
}

function addTemplateCells() {
    const dataRows = Array.from(document.querySelectorAll('[role="row"]')).slice(1);

    dataRows.forEach(row => {
        if (!row.querySelector('.template-cell')) {
            const cell = createTemplateCell(row);
            row.insertBefore(cell, row.lastChild);
        }
    });
}

function createTemplateCell(row) {
    const cell = document.createElement('div');
    cell.setAttribute('role', 'cell');
    cell.setAttribute('style', 'box-sizing: border-box; flex: 1 0 auto; min-width: 0px; width: 1px;');
    cell.style.width = '20%';
    cell.className = 'template-cell';

    const loName = row.querySelector('div[role="cell"]').textContent.trim();
    if (loDetails[loName]) {
        loDetails[loName].forEach(template => {
            if (!template.templateId) return;
            const templateLink = document.createElement('a');
            templateLink.href = `https://my.sailthru.com/email-composer/${template.templateId}`;
            templateLink.textContent = template.templateName;
            templateLink.target = '_blank';
            cell.appendChild(templateLink);
            cell.appendChild(document.createElement('br'));
        });
    } else {
        cell.innerHTML = 'No linked template';
    }

    return cell;
}

// Main Initialization
function initializeScript() {
    GM_addStyle(styles);

    loadMermaid(() => {
        fetchTemplates()
            .then(() => fetchLOData())
            .then(data => processLOData(data))
            .then(() => {
                createViewTemplatesButton();
                createDownloadButton();
                createPrintLOsButton();
            })
            .catch(error => console.error('Error initializing script:', error));
    });
}

// Start the script
if (window.location.href === "https://my.sailthru.com/lifecycle_optimizer#/") {
    initializeScript();
}
