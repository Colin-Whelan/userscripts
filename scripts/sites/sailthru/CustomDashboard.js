// ==UserScript==
// @name        Custom Dashboard
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/dashboard*
// @grant       GM_addStyle
// @grant       GM_xmlhttpRequest
// @version     1.8.3
// @author      Colin Whelan
// @description Custom dashboard for Sailthru. This board brings together all the pieces I use on a daily basis for technical support and LO work, and offers some handy features like:
// - A complete view of all LO structures
// - A functioning fuzzy search for all data types - Templates, Campaigns, Lists, Promotions, LOs
// - Adds ability to search other template properties like Subject, Mode(type), Modify Date
//
//
// Todo:
// - Add support for full HTML search - Slows down page, it's a lot of data.
// - Mermaid charts to link to lists.
// - Add toggle for active LOs
//
// Updates://
// v1.8.3 - Aug 25, 2024
// Fixes datetime format, formatted numbers
//
// v1.8.2 - Aug 25, 2024
// Link LO names to the LO
// Add flag for template usage
//
//
// v1.8.1 - Aug 25, 2024
// Added 'Lists' section
// - description clips at 400 chars with toggle to expand
// Updated search display for templates
//
//
// v1.7.1 - Aug 24, 2024 (Summary up to this version)//
// Templates in LO flowcharts are linked
// CSS for when boxes are linked
// Improved fuzzy search using Fuse.io
// Fix CSS of Nav bar so default dropdowns can show overtop.
// General CSS fix
//
// ==/UserScript==

(function() {
'use strict';

let templatesList = {};
let loDetails = {};

    function setupDashboard() {
    document.title = "Custom Dashboard"
    const mainDiv = document.getElementById('main');
    if (mainDiv) {
        mainDiv.innerHTML = '';

        const dashboardContainer = document.createElement('div');
        dashboardContainer.id = 'custom-dashboard';
        dashboardContainer.innerHTML = `
            <div id="sticky-nav">
                <a href="#templates-section">Templates</a>
                <a href="#campaigns-section">Campaigns</a>
                <a href="#lists-section">Lists</a>
                <a href="#journeys-section">Journeys</a>
                <a href="#promotions-section">Promotions</a>
                <button class="print-button" onclick="window.print()">Print Dashboard</button>
            </div>
            <h1>Custom Sailthru Dashboard</h1>
            <div id="dashboard-content">
                <div id="templates-section" class="dashboard-section">
                    <h2>Email Templates</h2>
                    <div id="templates-list"></div>
                </div>
                <div id="campaigns-section" class="dashboard-section">
                    <h2>Email Campaigns</h2>
                    <div id="campaigns-list"></div>
                </div>
                <div id="lists-section" class="dashboard-section">
                    <h2>Lists</h2>
                    <div id="lists-list"></div>
                </div>
                <div id="journeys-section" class="dashboard-section">
                    <h2>Lifecycle Optimizer Journeys</h2>
                    <input type="text" class="search-bar" id="journeys-search" placeholder="Search journeys...">
                    <div id="journeys-list"></div>
                </div>
                <div id="promotions-section" class="dashboard-section">
                    <h2>Promotions</h2>
                    <input type="text" class="search-bar" id="promotions-search" placeholder="Search promotions...">
                    <div id="promotions-list"></div>
                </div>
            </div>
        `;
        mainDiv.appendChild(dashboardContainer);
    }
}

async function makeUIAPIRequest(endpoint) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: `https://my.sailthru.com${endpoint}`,
            headers: {
                "Accept": "application/json, text/html",
                "X-Requested-With": "XMLHttpRequest"
            },
            onload: function(response) {
                const contentType = response.responseHeaders.match(/content-type:\s*(.*)/i)[1];
                if (contentType.includes('application/json')) {
                    try {
                        resolve(JSON.parse(response.responseText));
                    } catch (error) {
                        reject(new Error('Failed to parse JSON response'));
                    }
                } else if (contentType.includes('text/html')) {
                    resolve(response.responseText);
                } else {
                    reject(new Error('Unexpected content type'));
                }
            },
            onerror: reject
        });
    });
}

let templatesWithHtml = new Set();

async function checkTemplateUsage(templateId) {
    const usageURL = `/uiapi/lifecycle/?template_id=${templateId}`;
    const data = await makeUIAPIRequest(usageURL);
    const activeItems = data.filter(item => item.status === 'active');
    const inactiveItems = data.filter(item => item.status === 'inactive');
    return { activeItems, inactiveItems };
}

async function displayTemplates(data) {
    const templatesListDiv = document.getElementById('templates-list');
    if (templatesListDiv && data && data.length > 0) {
        // Add advanced search controls
        const searchControls = `
            <div id="advanced-template-search">
                <select id="template-search-property">
                    <option value="name">Name</option>
                    <option value="subject">Subject</option>
                    <option value="mode">Mode</option>
                    <option value="modify_time">Last Modified</option>
                    <option value="is_disabled">Status</option>
                </select>
                <input type="text" id="template-search-input" placeholder="Search templates...">
            </div>
            <div>
                <label class="inactive-template-checkbox">
                    <input type="checkbox" id="include-inactive-templates"> Include Inactive Templates
                </label>
                <button id="check-template-usage">Check Template Usage in LOs</button>
            </div>
        `;
        templatesListDiv.innerHTML = searchControls;

        let tableHtml = `<table id="templates-table">
            <tr>
              <th>Name</th>
              <th>Subject</th>
              <th>Mode</th>
              <th style="min-width: 180px;">Last Modified</th>
              <th>Status</th>
              <th style="min-width: 70px;">Usage</th>
            </tr>`;

        data.forEach(template => {
            let templateURL = template.mode == 'email'
                ? `https://my.sailthru.com/template/#${template.template_id}`
                : `https://my.sailthru.com/email-composer/${template.template_id}`;

            tableHtml += `<tr class="template-row ${template.is_disabled ? 'inactive' : ''}" data-template-id="${template.template_id}">
                <td><a href="${templateURL}" target="_blank">${template.name}</a></td>
                <td>${template.subject}</td>
                <td>${template.mode}</td>
                <td>${template.modify_time}</td>
                <td>${template.is_disabled ? 'Inactive' : 'Active'}</td>
                <td class="usage-cell"></td>
            </tr>`;
        });
        tableHtml += '</table>';
        templatesListDiv.innerHTML += tableHtml;

        const fuse = initializeFuse(data, ['name', 'subject', 'mode', 'modify_time', 'is_disabled']);

        // Add event listeners
        document.getElementById('template-search-input').addEventListener('input', function() {
            const property = document.getElementById('template-search-property').value;
            const searchTerm = this.value;
            filterTemplatesFuzzy(fuse, searchTerm, property);
        });

        // document.getElementById('include-inactive-templates').addEventListener('change', function() {
        //     toggleInactiveTemplates(this.checked);
        // });

        document.getElementById('check-template-usage').addEventListener('click', async function() {
            const visibleRows = document.querySelectorAll('#templates-table tr:not([style*="display: none"])');
            for (let i = 1; i < visibleRows.length; i++) { // Start from index 1 to skip the header row
                const row = visibleRows[i];
                const templateId = row.getAttribute('data-template-id');
                const usageCell = row.querySelector('.usage-cell');
                usageCell.textContent = 'Checking...';
                const { activeItems, inactiveItems } = await checkTemplateUsage(templateId);
                const count = activeItems.length + inactiveItems.length;
                let color = '#34c132'; // Green
                if (activeItems.length > 0) {
                    color = '#e8253b'; // Red
                } else if (inactiveItems.length > 0) {
                    color = '#FF8C00'; // Orange
                }
                const usageUrl = `https://my.sailthru.com/email-composer/${templateId}/usage`;
                usageCell.innerHTML = `
                    <a href="${usageUrl}" target="_blank" style="text-decoration: none;">
                        <span style="background-color: ${color}; color: white; border-radius: 10px; padding: 0px 5px; display: inline-block;">
                            ${activeItems.length}${inactiveItems.length ? '(' + inactiveItems.length + ')' : ''} LO${count == 1 ? '' : 's'}
                        </span>
                    </a>
                `;
            }
        });
        toggleInactiveTemplates(false); // Initially hide inactive templates
    } else {
        templatesListDiv.innerHTML = 'No templates found.';
    }
}

async function toggleHtmlSearch(data) {
    const button = document.getElementById('toggle-html-search');
    const searchProperty = document.getElementById('template-search-property');

    if (button.textContent === 'Enable HTML Search') {
        button.textContent = 'Disable HTML Search';
        button.disabled = true;
        searchProperty.innerHTML += '<option value="html">HTML Content</option>';

        // Fetch HTML content for all templates
        for (let template of data) {
            if (!templatesWithHtml.has(template.template_id)) {
                const details = await fetchTemplateDetails(template.template_id);
                const row = document.querySelector(`tr[data-template-id="${template.template_id}"]`);
                row.setAttribute('data-html', encodeURIComponent(details.content_html || ''));
                templatesWithHtml.add(template.template_id);
            }
        }

        button.disabled = false;
    } else {
        button.textContent = 'Enable HTML Search';
        searchProperty.querySelector('option[value="html"]').remove();
        if (searchProperty.value === 'html') {
            searchProperty.value = 'name';
        }
        const fuse = initializeFuse(data, ['name', 'subject', 'mode', 'modify_time', 'is_disabled']);

        document.getElementById('template-search-input').addEventListener('input', function() {
            const property = document.getElementById('template-search-property').value;
            const searchTerm = this.value;
            filterTemplatesFuzzy(fuse, searchTerm, property);
        });
    }
}

async function fetchTemplateDetails(templateId) {
    return await makeUIAPIRequest(`/uiapi/campaign/${templateId}`);
}

// New function for fuzzy filtering templates
function filterTemplatesFuzzy(fuse, searchTerm, property) {
    if (searchTerm === '') {
        document.querySelectorAll('#templates-table tr').forEach((row, index) => {
            if (index !== 0) row.style.display = '';
        });
        return;
    }

    // Adjust the search based on the selected property
    let searchOptions = {};
    if (property !== 'name') {
        searchOptions = {
            keys: [property],
            threshold: 0.2
        };
    }

    const results = fuse.search(searchTerm, searchOptions);
    console.log('results', results);

    const table = document.getElementById('templates-table');
    const rows = table.querySelectorAll('tr');

    rows.forEach((row, index) => {
        if (index === 0) return; // Skip header row
        const templateId = row.getAttribute('data-template-id');

        const found = results.some(result => {
            if (property === 'name') {
                // For 'name' property, check if the templateId matches
                return result.item.template_id.toString() === templateId;
            } else {
                // For other properties, check if the property value matches
                return result.item.template_id.toString() === templateId &&
                       result.item[property] &&
                       result.item[property].toString().toLowerCase().includes(searchTerm.toLowerCase());
            }
        });

        row.style.display = found ? '' : 'none';
    });
}

function getColumnIndex(property) {
    switch(property) {
        case 'name': return 1;
        case 'subject': return 2;
        case 'mode': return 3;
        case 'modify_time': return 4;
        case 'is_disabled': return 5;
        case 'html': return 6;
        default: return 1;
    }
}


function toggleInactiveTemplates(show) {
    const inactiveRows = document.querySelectorAll('#templates-list .inactive');
    inactiveRows.forEach(row => {
        row.style.display = show ? '' : 'none';
    });
}

async function fetchCampaignsData() {
    const statuses = ['drafts', 'scheduled', 'sending', 'sent', 'recurring'];
    const campaignsData = {};
    const countsData = await makeUIAPIRequest('/uiapi/campaigns');

    for (const status of statuses) {
        const data = await makeUIAPIRequest(`/uiapi/campaigns?sort=-modify_time&status=${status}`);
        campaignsData[status] = data.items;
    }

    return { campaignsData, counts: countsData.counts };
}

function displayCampaigns(campaignsData, counts) {
    const campaignsListDiv = document.getElementById('campaigns-list');
    if (campaignsListDiv) {
        let tabsHtml = '<div class="campaign-tabs">';
        let contentHtml = '<div class="campaign-content">';

        const statuses = ['drafts', 'scheduled', 'sending', 'sent', 'recurring'];

        statuses.forEach((status, index) => {
            const isActive = index === 0 ? 'active' : '';
            tabsHtml += `<button class="campaign-tab ${isActive}" data-status="${status}">${status.charAt(0).toUpperCase() + status.slice(1)} (${counts[status]})</button>`;
            contentHtml += `
                <div class="campaign-tab-content ${isActive}" id="${status}-campaigns">
                    <input type="text" class="campaign-search" data-status="${status}" placeholder="Search ${status} campaigns...">
                    <table>
                        <tr><th>Name</th><th>Status</th><th>Send Time</th></tr>
                        ${generateCampaignTableRows(campaignsData[status])}
                    </table>
                </div>
            `;
        });

        tabsHtml += '</div>';
        contentHtml += '</div>';

        campaignsListDiv.innerHTML = tabsHtml + contentHtml;

        // Add event listeners for tabs
        document.querySelectorAll('.campaign-tab').forEach(tab => {
            tab.addEventListener('click', () => switchCampaignTab(tab.dataset.status));
        });

        // Add event listeners for search inputs
        document.querySelectorAll('.campaign-search').forEach(input => {
            input.addEventListener('input', (e) => searchCampaigns(e.target.value, e.target.dataset.status));
        });
    }
}

function generateCampaignTableRows(campaigns) {
    console.log(campaigns)
    return campaigns.map(campaign => `
        <tr>
            <td>${campaign.name}</td>
            <td>${campaign.status}</td>
            <td>${campaign.schedule_time ? campaign.schedule_time.str : (campaign.send_time ? campaign.send_time.str : 'N/A')}</td>
        </tr>
    `).join('');
}

function switchCampaignTab(status) {
    document.querySelectorAll('.campaign-tab, .campaign-tab-content').forEach(el => el.classList.remove('active'));
    document.querySelector(`.campaign-tab[data-status="${status}"]`).classList.add('active');
    document.getElementById(`${status}-campaigns`).classList.add('active');
}

function searchCampaigns(query, status) {
    const rows = document.querySelectorAll(`#${status}-campaigns table tr:not(:first-child)`);
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query.toLowerCase()) ? '' : 'none';
    });
}

  // New function for fuzzy filtering tables
function filterTableFuzzy(fuse, searchTerm, tableId) {
    const table = document.querySelector(`#${tableId} table`);
    const rows = table.querySelectorAll('tr');

    if (searchTerm === '') {
        rows.forEach((row, index) => {
            if (index !== 0) row.style.display = '';
        });
        return;
    }

    const results = fuse.search(searchTerm);
    rows.forEach((row, index) => {
        if (index === 0) return; // Skip header row
        const found = results.some(result => row.textContent.includes(result.item.name));
        row.style.display = found ? '' : 'none';
    });
}

function displayJourneys(data) {
    const journeysListDiv = document.getElementById('journeys-list');
    if (journeysListDiv && data && data.length > 0) {
        let journeysHtml = '';
        data.forEach((journey, index) => {
            const mermaidDiagram = generateMermaidDiagram(journey);
          // console.log('diagram',mermaidDiagram)
            journeysHtml += `
                <div class="journey">
                    <h3><a href="https://my.sailthru.com/lifecycle_optimizer#/flows/${journey.id}" target="_blank" style="text-decoration:underline; color:black;">${journey.name}</a></h3>
                    <p>Status: ${journey.status}</p>
                    <p>Last Edited: ${new Date(journey.lastEditedTime * 1000).toLocaleString()}</p>
                    <p>Re-entry: ${journey.reentry.isAllowed ? 'Allowed' : 'Not Allowed'}</p>
                    <p>Block while in flow: ${journey.reentry.ifPresent ? 'Yes' : 'No'}</p>
                    ${journey.reentry.afterDelay ? `<p>Re-entry delay: ${journey.reentry.afterDelay.amount} ${journey.reentry.afterDelay.unit}</p>` : ''}
                    <div class="mermaid" id="mermaid-${index}">
                        ${mermaidDiagram}
                    </div>
                </div>
            `;
        });
        journeysListDiv.innerHTML = journeysHtml;

        const fuse = initializeFuse(data, ['name', 'status']);

        document.getElementById('journeys-search').addEventListener('input', function() {
            filterJourneysFuzzy(fuse, this.value);
        });

        // We'll initialize Mermaid after a short delay to ensure DOM is updated
        setTimeout(() => {
            initializeMermaid();
        }, 100);
    } else {
        journeysListDiv.innerHTML = 'No journeys found.';
    }
}

// New function for fuzzy filtering journeys
function filterJourneysFuzzy(fuse, searchTerm) {
    const journeys = document.querySelectorAll('#journeys-list .journey');
    if (searchTerm === '') {
        journeys.forEach(journey => journey.style.display = '');
        return;
    }

    const results = fuse.search(searchTerm);
    journeys.forEach(journey => {
        const journeyName = journey.querySelector('h3').textContent;
        const found = results.some(result => result.item.name === journeyName);
        journey.style.display = found ? '' : 'none';
    });
}

function initializeMermaid() {
    mermaid.initialize({
        startOnLoad: true,
        theme: 'base',
        securityLevel: 'loose',
        flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'basis'
        },
        themeVariables: {
            background: '#FFFFFF',
            primaryColor: '#DADEDF',
            primaryTextColor: '#555F61',
            primaryBorderColor: '#DADEDF',
            lineColor: '#DADEDF',
            secondaryColor: '#FFF8E1',
            tertiaryColor: '#F3E5F5',
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

    // Render each Mermaid diagram individually
    document.querySelectorAll('.mermaid').forEach((element, index) => {
        try {
            const id = `mermaid-svg-${index}`;
            const graphDefinition = element.textContent.trim();
            mermaid.render(id, graphDefinition, (svgCode) => {
                element.innerHTML = svgCode;
            });
        } catch (error) {
            console.error(`Error rendering Mermaid diagram ${index}:`, error);
            console.log('Problematic Mermaid syntax:', element.textContent.trim());
            element.innerHTML = `<p>Error rendering diagram: ${error.message}</p>`;
        }
    });
}


// function to handle Mermaid diagram clicks
function mermaidClickCallback(url) {
    window.open(url, '_blank');
}

// Make sure to expose the mermaidClickCallback function globally
window.mermaidClickCallback = mermaidClickCallback;

function generateMermaidDiagram(lo) {
    let diagram = 'flowchart TD;\n';
    let clickEvents = '';
    for (const stepId in lo.steps) {
        const step = lo.steps[stepId];
        diagram += generateStepNode(stepId, step);
        diagram += generateStepConnections(stepId, step);
        clickEvents += generateClickEvent(stepId, step);
    }
    return diagram + clickEvents;
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

function getStepLabel(step, stepId) {
        let stepLabel = step.subtype || 'Unknown Step';

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
                    stepLabel += `\n${templateName}`;
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
        // console.log(stepLabel.replace(/"/g, "'"))
        return stepLabel.replace(/"/g, "'");
    }

function getMatchLabel(step, child) {
    switch (step.subtype) {
        case 'abTest':
            return child.match.allocation + "%";
        default:
            return child.match !== undefined ? child.match.toString().replaceAll('"','').replaceAll('|', '/') : ' ';
    }
}

function generateClickEvent(stepId, step) {
    if (step.subtype === 'sendEmail' && step.taskAttributes.templateId) {
        const template = templatesList.find(template => template.template_id === step.taskAttributes.templateId);
        const templateUrl = template && template.mode === 'email'
            ? `https://my.sailthru.com/template/#${template.template_id}`
            : `https://my.sailthru.com/email-composer/${step.taskAttributes.templateId}`;
        return `click ${stepId} "${templateUrl}" "Open template" _blank\n`;
    }
    return '';
}

function displayPromotions(data) {
    const promotionsListDiv = document.getElementById('promotions-list');
    if (promotionsListDiv && data && data.items && data.items.length > 0) {
        let tableHtml = `<table>
            <tr>
                <th>Name</th>
                <th>Unassigned Codes</th>
                <th>Created Date</th>
                <th>Modified Date</th>
                <th>Created By</th>
                <th>Modified By</th>
                <th>Refill Reminder</th>
                <th>Refill Reminder Sent</th>
                <th>Custom Fields</th>
            </tr>`;

        data.items.forEach(promo => {
            let customFieldsHtml = '';
            if (promo.vars) {
                for (const [key, value] of Object.entries(promo.vars)) {
                    if (value !== '') {
                        customFieldsHtml += `<p><strong>${key}:</strong> ${value}</p>`;
                    }
                }
            }
            if (customFieldsHtml === '') {
                customFieldsHtml = 'No custom fields';
            }
            tableHtml += `<tr>
                <td>${promo.name}</td>
                <td>${formatNumber(promo.unassigned)}</td>
                <td>${new Date(promo.create_date).toLocaleString()}</td>
                <td>${new Date(promo.modify_date).toLocaleString()}</td>
                <td>${promo.create_user}</td>
                <td>${promo.modify_user}</td>
                <td>${promo.refill_reminder}</td>
                <td>${promo.refill_reminder_sent ? 'Yes' : 'No'}</td>
                <td>${customFieldsHtml}</td>
            </tr>`;
        });
        tableHtml += '</table>';
        promotionsListDiv.innerHTML = tableHtml;

        const fuse = initializeFuse(data.items, ['name', 'create_user', 'modify_user']);

        document.getElementById('promotions-search').addEventListener('input', function() {
            filterTableFuzzy(fuse, this.value, 'promotions-list');
        });
    } else {
        promotionsListDiv.innerHTML = 'No promotions found.';
    }
}

    function loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

  // New function to initialize Fuse instances
function initializeFuse(data, keys) {
    const options = {
        keys: keys,
        threshold: 0.3,
        ignoreLocation: true
    };
    return new Fuse(data, options);
}

async function fetchListsData() {
    const lists = await makeUIAPIRequest('/uiapi/lists/');
    const smartLists = lists.filter(list => list.type === 'smart');

    for (let list of smartLists) {
        const details = await fetchListDetails(list.name);
        list.details = details;
    }

    return lists;
}

async function fetchListDetails(name) {
    return await makeUIAPIRequest(`/uiapi/proxy?api_endpoint=list&query=1&list=${encodeURIComponent(name)}`);
}

function clipText(text, maxLength) {
    text = text.trim().replace(/\s+/g, ' ');
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

function displayLists(listsData) {
    const listsListDiv = document.getElementById('lists-list');
    if (listsListDiv) {
        let html = `
            <input type="text" id="lists-search" placeholder="Search lists...">
            <div>
                <input type="checkbox" id="toggle-all-descriptions" class="description-toggle">
                <label for="toggle-all-descriptions" class="description-toggle-label">Show All Full Descriptions</label>
            </div>
            <table id="lists-table">
                <tr>
                    <th style="min-width:70px;">Is Primary</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Email Count</th>
                    <th>Valid Count</th>
                    <th style="min-width:180px;">Created</th>
                    <th>Description</th>
                </tr>
        `;
        listsData.forEach((list, index) => {
            const details = list.type === 'smart' ? list.details : null;
            const listUrl = list.type === 'smart'
                ? `https://my.sailthru.com/audience_builder#/list/${encodeURIComponent(list.name)}`
                : `https://my.sailthru.com/list?list=${encodeURIComponent(list.name)}`;
            const description = details && details.description ? details.description.trim() : 'N/A';
            const clippedDescription = clipText(description, 400);

            html += `
                <tr>
                    <td>${details ? details.primary : 'N/A'}</td>
                    <td><a href="${listUrl}" target="_blank">${list.name || 'Unnamed List'}</a></td>
                    <td>${list.type}</td>
                    <td>${formatNumber(list.email_count)}</td>
                    <td>${formatNumber(list.valid_count)}</td>
                    <td>${new Date(list.create_time).toLocaleString()}</td>
                    <td>
                        <div class="description-content">${clippedDescription}</div>
                        <div class="full-description">${description}</div>
                    </td>
                </tr>
            `;
        });
        html += '</table>';
        listsListDiv.innerHTML = html;

        // Add event listener for search
        document.getElementById('lists-search').addEventListener('input', function() {
            searchLists(this.value);
        });

        // Add event listener for global description toggle
        document.getElementById('toggle-all-descriptions').addEventListener('change', function() {
            const clippedDescriptions = document.querySelectorAll('.description-content');
            const fullDescriptions = document.querySelectorAll('.full-description');
            const label = document.querySelector('label[for="toggle-all-descriptions"]');

            clippedDescriptions.forEach(el => el.style.display = this.checked ? 'none' : 'block');
            fullDescriptions.forEach(el => el.style.display = this.checked ? 'block' : 'none');
            label.textContent = this.checked ? 'Show Clipped Descriptions' : 'Show All Full Descriptions';
        });
    }
}

function formatNumber(number) {
    return new Intl.NumberFormat('en-US').format(number);
}

function searchLists(query) {
    const rows = document.querySelectorAll('#lists-table tr:not(:first-child)');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query.toLowerCase()) ? '' : 'none';
    });
}

async function initDashboard() {
    setupDashboard();

    try {
        // Load Mermaid and Fuse.js
        await Promise.all([
            loadScript('https://cdn.jsdelivr.net/npm/mermaid@8.11.0/dist/mermaid.min.js'),
            loadScript('https://cdn.jsdelivr.net/npm/fuse.js@6.4.6')
        ]);

        templatesList = await makeUIAPIRequest('/uiapi/templates');
        displayTemplates(templatesList);

        const { campaignsData, counts } = await fetchCampaignsData();
        displayCampaigns(campaignsData, counts);

        const listsData = await fetchListsData();
        displayLists(listsData);

        const journeysData = await makeUIAPIRequest('/uiapi/lifecycle/');
        displayJourneys(journeysData);

        const promotionsData = await makeUIAPIRequest('/uiapi/promotions/');
        displayPromotions(promotionsData);

    } catch (error) {
        console.error('Error initializing dashboard:', error);
    }
}

// Call initDashboard when the script runs
initDashboard();
})();

GM_addStyle(`
    #toggle-all-descriptions {
        margin-bottom: 10px;
    }
    .description-content {
        white-space: normal;
    }
    .full-description {
        display: none;
        white-space: pre-wrap;
        word-break: break-word;
    }
    .description-toggle {
        margin-right: 5px;
    }
    .description-toggle-label {
        color: inherit;
        cursor: pointer;
    }
    #lists-search {
        width: 100%;
        padding: 8px;
        margin-bottom: 10px;
        box-sizing: border-box;
    }
    #lists-table {
        margin-top: 10px;
        width: 100%;
        border-collapse: collapse;
    }
    #lists-table th, #lists-table td {
        border: 1px solid #ddd;
        padding: 8px;
        text-align: left;
    }
    #lists-table th {
        background-color: #f2f2f2;
    }
    #lists-table a {
        color: #0066cc;
        text-decoration: none;
    }
    #lists-table a:hover {
        text-decoration: underline;
    }
    .list-details {
        background-color: #f9f9f9;
        padding: 10px;
        border: 1px solid #ddd;
        margin-top: 10px;
    }
    .list-details pre {
        white-space: pre-wrap;
        word-wrap: break-word;
        max-height: 200px;
        overflow-y: auto;
    }
    .campaign-tabs {
        display: flex;
        border-bottom: 1px solid #ddd;
    }
    .campaign-tab {
        background-color: #f1f1f1;
        border: none;
        outline: none;
        cursor: pointer;
        padding: 10px 20px;
        transition: 0.3s;
        font-size: 17px;
    }
    .campaign-tab:hover {
        background-color: #ddd;
    }
    .campaign-tab.active {
        background-color: #ccc;
    }
    .campaign-tab-content {
        display: none;
        padding: 20px;
        border: 1px solid #ccc;
        border-top: none;
    }
    .campaign-tab-content.active {
        display: block;
    }
    .campaign-search {
        width: 100%;
        padding: 10px;
        margin-bottom: 10px;
        box-sizing: border-box;
    }
  #custom-dashboard {
      padding: 20px;
      font-family: Arial, sans-serif;
  }
  .dashboard-section {
      margin-bottom: 20px;
  }
  h1, h2 {
      color: #333;
  }
  table {
      width: 100%;
      border-collapse: collapse;
  }
  th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
  }
  th {
      background-color: #f2f2f2;
  }
  #sticky-nav {
      position: sticky;
      top: 0;
      background-color: #fff;
      padding: 10px;
      border-bottom: 1px solid #ddd;
      z-index: 9;
  }
  #sticky-nav a {
      margin-right: 15px;
      text-decoration: none;
      color: #007bff;
  }
  #sticky-nav a:hover {
      text-decoration: underline;
  }
  .print-button, #check-template-usage {
      float: right;
      padding: 5px 10px;
      background-color: #28a745;
      background-image: none !important;
      color: white;
      border: none;
      cursor: pointer;
      border-radius: 4px;
  }
  #check-template-usage {
      float: left !important;
      margin-bottom: 10px;

  }
  .print-button:hover {
      background-color: #218838;
  }
  .lo-steps {
      margin-top: 10px;
      padding: 10px;
      background-color: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 4px;
  }
  .lo-step {
      margin-bottom: 5px;
  }
  .journey p {
      margin: 5px 0;
  }
  .search-bar {
      width: 100%;
      padding: 5px;
      margin-bottom: 10px;
        box-sizing: border-box;
  }
  .inactive-template-checkbox {
      margin-left: 10px;
  }
  .mermaid .node.clickable > rect {
      stroke: #0288D1 !important;
      stroke-width: 2px !important;
      filter: drop-shadow(3px 3px 2px rgba(0, 0, 0, .3));
      transition: all 0.3s ease;
  }
  .mermaid .node.clickable:hover > rect {
      filter: drop-shadow(3px 3px 4px rgba(0, 0, 0, .5));
      transform: translateY(-1px);
  }
  .mermaid .node.clickable > .label {
      cursor: pointer;
  }
  .mermaid .node.clickable > .label text {
      fill: #01579B !important;
      font-weight: bold;
  }
    #advanced-template-search {
        display: flex;
        margin-bottom: 10px;
    }
    #template-search-property {
        padding: 8px;
        font-size: 14px;
        border: 1px solid #ddd;
        border-right: none;
        border-radius: 4px 0 0 4px;
        background-color: #f8f8f8;
    }
    #template-search-input {
        flex-grow: 1;
        padding: 8px;
        font-size: 14px;
        border: 1px solid #ddd;
        border-radius: 0 4px 4px 0;
    }
    .inactive-template-checkbox {
        display: block;
        margin-top: 5px;
        margin-bottom: 10px;
    }
    #check-template-usage {
        margin-left: 10px;
        padding: 5px 10px;
        background-color: #3a7af0;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }
    #check-template-usage:hover {
        background-color: #2E62C0;
    }
    .usage-cell a:hover span {
        filter: brightness(90%);
    }
    #promotions-list td p {
        margin: 0;
        padding: 2px 0;
    }
    #promotions-list td p strong {
        margin-right: 5px;
    }
`);
