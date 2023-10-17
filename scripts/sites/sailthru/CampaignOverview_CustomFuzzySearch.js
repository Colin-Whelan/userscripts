// ==UserScript==
// @name        Campaign Overview - Custom Fuzzy Search
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/campaigns/overview*
// @grant       GM_xmlhttpRequest
// @version     1.0
// @author      Colin Whelan
// @description Adds a fuzzy search filter for campaigns, makes searching past campaigns MUCH easier.
// ==/UserScript==

// Existing part of your userscript
let allTemplateInfo = {}

function fetchSailthruCampaignInfo(status) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: `https://my.sailthru.com/uiapi/campaigns?search=&skip=0&limit=100&sort=-modify_time&status=${status}`,
            onload: function(response) {
                allTemplateInfo = JSON.parse(response.responseText);
                resolve();
            },
            onerror: function(error) {
                console.error('Failed to fetch data:', error);
                reject(error);
            }
        });
    });
}


// New functions
function createSearchButton() {
    const topPanel = document.querySelector('.pn--TopPanel-topPanel--ACLkw');
    if (topPanel) {
        const button = document.createElement('button');
        button.innerHTML = 'Advanced Search';
        button.id = 'advancedSearchButton';

        // Add some inline styles for better appearance
        button.style.backgroundColor = '#00A2BE';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.padding = '10px 20px';
        button.style.marginLeft = '10px';
        button.style.cursor = 'pointer';

        button.onclick = function() {
            const status = window.location.hash.replace('#/', '').toLowerCase();

            fetchSailthruCampaignInfo(status).then(() => {
                populateModal(status); // populate the modal with all templates
            });

            document.getElementById('searchModal').style.display = 'block';
        }

        // Append the button to the top panel
        topPanel.appendChild(button);
    }
}


function createModal(status) {
    const modal = document.createElement('div');
    modal.id = 'searchModal';

    // Style the modal
    modal.style.display = 'none';
    modal.style.position = 'fixed';
    modal.style.left = '0';
    modal.style.top = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.4)';

    modal.innerHTML = `
    <div class="modal-content">
        <span class="close">&times;</span>
        <input type="text" id="searchInput" placeholder="Search..."/>
        <div id="searchResults"></div>
    </div>`;

    const searchInput = modal.querySelector('#searchInput');
    searchInput.style.width = '100%';
    searchInput.style.padding = '12px 20px';
    searchInput.style.margin = '8px 0';
    searchInput.style.boxSizing = 'border-box';
    searchInput.style.border = '2px solid #ccc';
    searchInput.style.borderRadius = '4px';

    // Style the modal content
    const modalContent = modal.querySelector('.modal-content');
    modalContent.style.backgroundColor = '#fff';
    modalContent.style.margin = '5% auto auto auto';
    modalContent.style.padding = '20px';
    modalContent.style.width = '90%';
    modalContent.style.height = '80%';
    modalContent.style.overflowY = 'auto'; // Add scroll for overflow

    // Style the close button
    const closeButton = modal.querySelector('.close');
    closeButton.style.color = '#aaa';
    closeButton.style.float = 'right';
    closeButton.style.fontSize = '28px';
    closeButton.style.cursor = 'pointer';

    // Add the modal to the body
    document.body.appendChild(modal);

    // Close button functionality
    closeButton.onclick = function() {
        modal.style.display = 'none';
    };

    // Attach the event listener for future input changes
    document.getElementById('searchInput').addEventListener('input', () => populateModal(status));


}


function populateModal(status, initial = false) {
    if (!document.getElementById('customTableStyles')) {
        const style = document.createElement('style');
        style.id = 'customTableStyles';
        style.innerHTML = `
        #resultsTable {
            width: 100%;
            border-collapse: collapse;
            font-family: Arial, sans-serif;
        }
        #resultsTable th, #resultsTable td {
            border: 1px solid #dddddd;
            padding: 12px;
            text-align: left;
        }
        #resultsTable th {
            border-bottom: 3px solid #bbb;
        }
        #resultsTable tr:nth-child(even) {
            background-color: #f2f2f2;
        }
    `;
        document.head.appendChild(style);
    }

    const input = document.getElementById('searchInput');
    const query = initial ? '' : input.value.toLowerCase(); // if initial load, set query to empty
    let filteredCampaigns = allTemplateInfo.items;
    // console.log(allTemplateInfo)
    const results = fuzzyFilter(query, filteredCampaigns, 'name');

    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = `
        <table id="resultsTable">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Subject</th>
                    <th>Audience</th>
                    <th>Suppression Lists</th>
                    <th>Reach Count</th>
                    <th>Scheduled Option</th>
                    <th>Number Sent</th>
                    <th>Open Rate</th>
                    <th>Click Rate</th>
                    <th>Time Sent</th>
                    <th>Last Modified User</th>
                    <th>Labels</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        </table>`;

    const tbody = resultsDiv.querySelector('tbody');

    results.forEach(item => {
        const row = document.createElement('tr');

        // Calculate Open and Click Rate
        const openRate = item.sent_count ? ((item.stats.total.open_total || 0) / item.sent_count * 100).toFixed(1) : '0.0';
        const clickRate = item.sent_count ? ((item.stats.total.clicks || 0) / item.sent_count * 100).toFixed(1) : '0.0';


        // console.log('item', item)

        row.innerHTML = `
            <td><b><a href="https://my.sailthru.com/blast?bid=${item.blast_id}#${item.blast_id}" target="_blank">${item.name}</a></b></td>
            <td>${item.subject}</td>
            <td>${item.list}</td>
            <td>${item.suppress_list ? item.suppress_list.join(', ') : ''}</td>
            <td>${item.est_count ? item.est_count : ''}</td>
            <td>${item.schedule_type ? item.schedule_type : ''}</td>
            <td>${item.sent_count ? item.sent_count : ''}</td>
            <td>${openRate ? openRate : ''}%</td>
            <td>${clickRate ? clickRate : ''}%</td>
            <td>${item.start_time ? item.start_time.str : ''}</td>
            <td>${item.modify_user}</td>
            <td>${item.labels.join(', ')}</td>
        `;
        tbody.appendChild(row);
    });

    // Style the table
    const resultsTable = document.getElementById('resultsTable');
    resultsTable.style.width = '100%';
    resultsTable.style.borderCollapse = 'collapse';
    // resultsTable.style.border = '2px solid #1a1a1a';

    const ths = resultsTable.querySelectorAll('th');
    ths.forEach(th => {
        // th.style.backgroundColor = '#00A2BE';
        th.style.color = 'black';
        th.style.padding = '14px';
        th.style.textAlign = 'left';
    });

    const tds = resultsTable.querySelectorAll('td');
    tds.forEach(td => {
        // td.style.border = '2px solid #1a1a1a';
        td.style.padding = '14px';
    });


}


// Fuzzy filtering function
function fuzzyFilter(query, list, key) {
    const reg = new RegExp(query.split('').join('.*'), 'i');
    return list.filter(item => reg.test(item[key]));
}


function initializeAdvancedSearch() {
    const statusFromURL = window.location.hash.replace('#/', '').toLowerCase();


    createSearchButton();
    createModal(statusFromURL);

}

// Mutation Observer
const observer = new MutationObserver((mutations, observer) => {
    for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.querySelector('.pn--Table-sailthru-table--aICHj') || node.classList.contains('pn--Table-sailthru-table--aICHj')) {
                        initializeAdvancedSearch();
                        observer.disconnect(); // Stop observing once the target is found
                        return;
                    }
                }
            }
        }
    }
});

// Start observing
observer.observe(document.body, {
    childList: true,
    subtree: true
});
