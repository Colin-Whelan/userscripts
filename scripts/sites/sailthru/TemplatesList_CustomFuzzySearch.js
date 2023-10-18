// ==UserScript==
// @name        Templates List - Custom Fuzzy Search
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/templates-list*
// @grant       GM_xmlhttpRequest
// @version     1.0
// @author      Colin Whelan
// @description Adds a fuzzy search filter for templates, makes searching templates much easier by removing extra results.
// ==/UserScript==

// Existing part of your userscript
let allTemplateInfo = {}

function fetchSailthruTemplateInfo(status) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: "https://my.sailthru.com/uiapi/templates",
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
    const topPanel = document.querySelector('.src__MainPanel-sc-13rfh6b-0');
    if (topPanel) {
        const buttonContainer = document.createElement('div')
        buttonContainer.classList = ['src__ChildrenWrapper-sc-13rfh6b-2 iFSBgR']

        const button = document.createElement('button');
        button.innerHTML = 'Advanced Search';
        button.id = 'advancedSearchButton';
        button.classList = ['src__MainButton-sc-1u0np1z-2 hEgrCw src__Button-sc-3n0kbo-0 crKsVi']

        // Add some inline styles for better appearance
        button.style.backgroundColor = '#00A2BE';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.padding = '10px 20px';
        button.style.marginLeft = '10px';
        button.style.cursor = 'pointer';

        button.onclick = function() {
            const status = window.location.hash.replace('#/', '').toLowerCase();

            fetchSailthruTemplateInfo(status).then(() => {
                populateModal(status); // populate the modal with all templates
            });

            document.getElementById('searchModal').style.display = 'block';
        }

        // Append the button to the top panel
        topPanel.appendChild(buttonContainer);
        buttonContainer.appendChild(button);
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

        // Reset the table header row
        document.querySelector('.src__TableHead-sc-1epr26z-1').style.display = 'table-header-group'
    };

    // Attach the event listener for future input changes
    document.getElementById('searchInput').addEventListener('input', () => populateModal(status));




}


function populateModal(status, initial = false) {
    document.querySelector('.src__TableHead-sc-1epr26z-1').style.display = 'none'

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
    const results = fuzzyFilter(query, allTemplateInfo, 'name');

    // console.log('searchInput', query)
    // console.log('results', results)

    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = `
        <table id="resultsTable">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Subject</th>
                    <th width="160px">Last Updated</th>
                    <th>Lables</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        </table>`;

    const tbody = resultsDiv.querySelector('tbody');

    results.forEach(item => {
        const row = document.createElement('tr');

        // console.log('item', item)

        row.innerHTML = `
            <td><b><a href="https://my.sailthru.com/email-composer/${item.template_id}" target="_blank">${item.name}</a></b></td>
            <td>${item.subject}</td>
            <td>${item.modify_time}</td>
            <td>${item.labels ? item.labels.join(', ') : ''}</td>
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
    const words = query.split(/[\s-_]+/);

    return list.filter(item => {
        return words.every(word => {
            const reg = new RegExp(word.split('').join('.*?'), 'i');
            return item[key].split(/[\s-_]+/).some(part => reg.test(part));
        });
    });
}



function initializeAdvancedSearch() {
    // const statusFromURL = window.location.hash.replace('#/', '').toLowerCase();


    createSearchButton();
    createModal();

}

// Mutation Observer
const templateListObserver = new MutationObserver((mutations, templateListObserver) => {
    for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.querySelector('.ais-InstantSearch__root') || node.classList.contains('ais-InstantSearch__root')) {
                      console.log('starting initializeAdvancedSearch')
                        initializeAdvancedSearch();
                        templateListObserver.disconnect(); // Stop observing once the target is found
                        return;
                    }
                }
            }
        }
    }
});

// Start observing
templateListObserver.observe(document.body, {
    childList: true,
    subtree: true
});
