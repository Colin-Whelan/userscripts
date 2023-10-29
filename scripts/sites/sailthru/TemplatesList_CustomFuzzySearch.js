// ==UserScript==
// @name        Templates List - Custom Fuzzy Search
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/templates-list*
// @version     1.7
// @author      Colin Whelan
// @grant       GM_xmlhttpRequest
// @description Adds an improved fuzzy search filter for templates + shows more template info + allows for searching of all text fields + show template usage for all templates.
// @require     https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.4/moment.min.js
// ==/UserScript==

let usageDataStore = {};

function getTemplateUsageData(item, callback) {
    const usageURL = `https://my.sailthru.com/uiapi/lifecycle/?template_id=${item._id}`;

    if (usageDataStore[item._id]) {
        callback(usageDataStore[item._id]);
    } else {
        GM_xmlhttpRequest({
            method: "GET",
            url: usageURL,
            onload: function(response) {
                const data = JSON.parse(response.responseText);
                usageDataStore[item._id] = data;
                callback(data);
            }
        });
    }
}

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

        button.onclick = function () {
            const status = window.location.hash.replace('#/', '').toLowerCase();
            populateModal()
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
        <div class="search-container">
          <span style="font-size: 16px; margin-left: 10px;">Search Field: </span>
          <div class="select-wrapper">
              <select id="searchField">
                    <option value="name">Name</option>
                    <!-- Add other fields as options -->
                    <option value="labels_string">Labels</option>
                    <option value="modify_user">Modified By</option>
                    <option value="create_user">Created By</option>
                    <option value="subject">Subject Line</option>
                    <option value="preheader">Preheader</option>
                    <option value="from_name">From Name</option>
                    <option value="from_email">From Email</option>
                    <option value="replyto_email">Reply-to</option>
                </select>
          </div>
          <input type="text" id="searchInput" placeholder="Search..."/>
          <span class="close">&times;</span>
        </div>
        <div id="searchResults"></div>
    </div>`;

    const searchInput = modal.querySelector('#searchInput');
    searchInput.style.width = '80%';
    searchInput.style.fontSize = '18px';
    searchInput.style.lineHeight = '24px';
    searchInput.style.padding = '9px 15px';
    searchInput.style.margin = '8px 0';
    searchInput.style.boxSizing = 'border-box';
    searchInput.style.border = '2px solid #ccc';
    searchInput.style.borderRadius = '4px';

    // Style the modal content
    const modalContent = modal.querySelector('.modal-content');
    modalContent.style.backgroundColor = '#fff';
    modalContent.style.borderRadius = '20px';
    modalContent.style.margin = '5% auto auto auto';
    modalContent.style.padding = '0px 20px 20px 20px';
    modalContent.style.width = '95%';
    modalContent.style.height = '90%';
    modalContent.style.overflowY = 'auto'; // Add scroll for overflow

    // Style the close button
    const closeButton = modal.querySelector('.close');
    closeButton.style.color = '#aaa';
    closeButton.style.float = 'right';
    closeButton.style.fontSize = '36px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.marginLeft = '10px';
    closeButton.style.backgroundColor = '#fff';

    // Add the modal to the body
    document.body.appendChild(modal);

    // Close button functionality
    closeButton.onclick = function () {
        closeModal()
    };

    document.addEventListener('click', function (event) {
        const modal = document.getElementsByClassName('modal-content')[0];
        if (modal && modal.parentNode.style.display === 'block' && event.srcElement.id != 'advancedSearchButton' && !modal.contains(event.target)) {
            closeModal();
        }
    });

    // Attach the event listener for future input changes
    document.getElementById('searchInput').addEventListener('input', () => populateModal(status));
    document.getElementById('searchField').addEventListener('change', () => populateModal(status));
}

function populateModal(status, initial = false) {
    document.querySelector('.src__TableHead-sc-1epr26z-1').style.display = 'none'

    if (!document.getElementById('customTableStyles')) {
        const style = document.createElement('style');
        style.id = 'customTableStyles';
        style.innerHTML += `
.card-container {
    display: flex;
    flex-wrap: wrap;
}
.card {
    flex: 1 1 360px;
    min-width: 360px;
    max-width: 100%;
    box-sizing: border-box;
    border: 1px solid #ccc;
    border-radius: 5px;
    margin: 10px;
    padding: 15px 15px 5px 15px;
    box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2);
    transition: box-shadow 0.3s;
}
.card:hover {
    box-shadow: 0 8px 16px 0 rgba(0, 0, 0, 0.2);
}
.card-header {
    font-size: 18px;
    background-color: #f9f9f9;
    border-radius: 5px 5px 0 0;
}
.card-header a {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    word-wrap: break-word;
}
.card-section.header a:hover {
    text-decoration: underline;
}
.envelope-details,
.modify-create {
    padding: 10px 0;
}
.envelope-details b,
.modify-create b {
    font-size: 15px;
}
.card-section {
    padding: 10px;
    border-bottom: 1px solid #f1f1f1;
}

.card-section:last-child {
    border-bottom: none;
}

.labels-container {
    padding: 8px 16px; /* 8px top/bottom, 16px left/right. Adjust as needed */
}
.customLabel {
    display: inline-block;
    white-space: nowrap;
    color: white;
    padding: 5px;
    margin: 2px; /* This will add space to the right, left, top, and bottom of each label */
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 150px;
    border-radius: 5px;
}
modal-content div {
    display: flex;
    align-items: center;
}
.search-container {
    display: flex;
    align-items: center;
    position: -webkit-sticky; /* For Safari */
    position: sticky;
    top: 0;
    z-index: 1000; /* This ensures the container stays on top of other content */
    background-color: white; /* To make sure it doesn't become transparent against other content */
    padding: 15px 0;
    border-bottom: 3px solid #ccc;
    margin-bottom: 10px;
}
#searchInput {
    flex-grow: 1;
    padding: 10px;
    border-radius: 4px;
    border: 1px solid #ccc;
    margin-right: 10px;
}
.select-wrapper {
    position: relative;
    display: inline-block;
}
#searchField {
    appearance: none; /* Removes default OS styling */
    padding: 12px 10px;
    border-radius: 4px;
    border: 1px solid #ccc;
    background-color: #fff;
    cursor: pointer;
    outline: none;
    margin: 0 10px;
    min-width: 130px;
    font-size: 15px;
}
#searchField:focus {
    border-color: #007bff;
}
.select-wrapper::after {
    content: "🞃";
    position: absolute;
    right: 25px;
    top: 40%;
    transform: translateY(-50%);
    pointer-events: none;
    font-size: 18px;
}
.hover-details {
    display: none;
    position: fixed;
    background: #f9f9f9;
    border: 1px solid #ccc;
    padding: 10px;
    box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2);
    z-index: 1000;
    max-width: 300px;
    pointer-events: auto;
}
.details-preview:hover + .hover-details,
.hover-details:hover {
    display: block;
}
.details-preview:hover + .hover-details {
    top: calc(50% - 150px);
    left: 50%;
    transform: translateX(-50%);
}
a.tooltip {
    border-bottom: 1px dashed;
    text-decoration: none;
    color: #333;
}
a.tooltip:hover {
    cursor: help;
    color: #333;
    position: relative;
}
a.tooltip span {
    display: none;
}
a.tooltip:hover span {
    border: #666 2px dotted;
    padding: 5px 20px 5px 5px;
    display: block;
    z-index: 100;
    background: #f9f9f9;
    border: 1px solid #ccc;
    padding: 10px;
    box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2);
    left: 0px;
    margin: 15px;
    width: 300px;
    position: absolute;
    top: 15px;
    text-decoration: none;
}
        `;

        document.head.appendChild(style);
    }

    const input = document.getElementById('searchInput');
    const query = initial ? '' : input.value.toLowerCase(); // if initial load, set query to empty

    const searchField = document.getElementById('searchField').value;

    const results = fuzzyFilter(query, sailthruTemplates.templates);

    const resultsDiv = document.getElementById('searchResults');

    resultsDiv.innerHTML = ''; // Clearing the div

    const cardContainer = document.createElement('div');
    cardContainer.className = 'card-container';
    resultsDiv.appendChild(cardContainer);

    results.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';
        const labelsHTML = generateLabelHTML(item.labels_string); // Assuming labels_string is a property of item

        card.innerHTML = `
            <div class="card-section card-header">
                <a href="https://my.sailthru.com/email-composer/${item._id}" target="_blank" title="${item.name}"><b>${item.name}</b></a>
            </div>
            <div class="card-section">
                <a href="#" class="tooltip">Hover for Envelope details
                  <span class="hover-details">
                    <div><b>SL:</b> ${item.subject}</div>
                    <div><b>PH:</b> ${item.preheader}</div>
                    <div><b>From:</b> ${item.from_name} - ${item.from_email}</div>
                    <div><b>Reply to:</b> ${item.replyto_email}</div>
                  </span>
                </a>
            </div>
            <div class="card-section modify-create">
                <div><b>Last Modified:</b> ${moment(item.modify_time).format('MMMM Do YYYY, h:mm:ss a')}</div>
                <div><b>Last Modified By:</b> ${item.modify_user}</div>
                <div><b>Created:</b> ${moment(item.create_time.sec * 1000).format('MMMM Do YYYY, h:mm:ss a')}</div>
                <div><b>Created By:</b> ${item.create_user ? item.create_user : "null (Copy/API)"}</div>
            </div>
            <div class="card-section labels">
                <div style="margin-bottom: 5px;">
                  <b>${item.labels_string.length > 0 ? 'Labels' : 'No labels'}</b>
                </div>
                <div>
                    ${item.labels_string.length > 0 ? labelsHTML : ''}
                </div>
            </div>
            <div class="card-section">
                <div style="margin-bottom: 15px;">
                    <b>Template Usage</b>
                </div>
                <div id="usageFlag">

                </div>
            </div>
        `;
        cardContainer.appendChild(card);

        getTemplateUsageData(item, function(data) {
            const count = data.length;
            const hrefURL = `https://my.sailthru.com/email-composer/${item._id}/usage`;

            const flagElement = document.createElement('a');
            flagElement.href = hrefURL;
            flagElement.textContent = `${count} LO${count == 1 ?  '' : 's'}`;
            flagElement.classList.add('usageFlag');
            flagElement.style.backgroundColor = count > 0 ?  '#e8253b' : '#34c132'; // red - green

            flagElement.onmouseover = () => flagElement.style.backgroundColor = count > 0 ?  '#BA1E2F' : '#2C9A28'; // Darker on hover
            flagElement.onmouseout = () => flagElement.style.backgroundColor = count > 0 ?  '#e8253b' : '#34c132'; // Original on mouse out

            flagElement.style.color = 'white';
            flagElement.style.fontSize = '16px';
            flagElement.style.borderRadius = '10px';
            flagElement.style.padding = '5px 10px';
            flagElement.style.marginRight = '10px';

            card.querySelector('#usageFlag').appendChild(flagElement);
        });


        // Get all the details preview and envelope details elements
        const detailsPreviews = document.querySelectorAll('.details-preview');
        const hoverDetails = document.querySelectorAll('.hover-details');

        detailsPreviews.forEach((preview, index) => {
            // Show envelope details on hover
            preview.addEventListener('mouseover', () => {
                hoverDetails[index].style.display = 'block';
            });

            // Hide envelope details when mouse leaves
            preview.addEventListener('mouseout', () => {
                hoverDetails[index].style.display = 'none';
            });
        });

        // Ensure that envelope details remain visible even when hovering over them
        hoverDetails.forEach((details, index) => {
            details.addEventListener('mouseover', () => {
                details.style.display = 'block';
            });

            details.addEventListener('mouseout', () => {
                details.style.display = 'none';
            });
        });

        $('.details-preview').on('mouseenter', function () {
            var id = $(this).data('id'); // Get the id
            var offset = $(this).offset(); // Get the offset of the current .details-preview
            var hoverDetail = $('.hover-details[data-id="' + id + '"]');

            // Set the position of the .hover-details
            hoverDetail.css({
                'top': offset.top - $(window).scrollTop() + 'px',
                'left': offset.left + 'px'
            });
        });

    });
}

function closeModal() {
    const modal = document.getElementById('searchModal');
    modal.style.display = 'none';

    // Reset the table header row
    document.querySelector('.src__TableHead-sc-1epr26z-1').style.display = 'table-header-group'
}

function generateLabelHTML(labels_string) {
    const labelsArray = labels_string.split(',').map(label => label.trim());

    function stringToColor(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        let color = '#';
        for (let i = 0; i < 3; i++) {
            let value = (hash >> (i * 8)) & 0xFF;
            color += ('00' + value.toString(16)).substr(-2);
        }
        return color;
    }

    return labelsArray.map(label => `<span class="customLabel" style="background-color: ${stringToColor(label)};">${label}</span>`).join('');
}


// Fuzzy filtering function
function fuzzyFilter(query, list) {
    const searchField = document.getElementById('searchField').value;
    return list.filter(item => {
        if (!item.hasOwnProperty(searchField)) {
            return false; // Skip items that don't have the desired field
        }
        const value = item[searchField] ? item[searchField].toString() : ''; // Convert the item's field value to string
        let regex

        if (searchField == 'subject' || searchField == 'preheader') {
            // subject and preheader use whole word search
            regex = new RegExp(query.split(' ').join('.*'), 'i');
        } else if (searchField == 'modify_user' || searchField == 'create_user') {
            // modify_user and create_user split on the @ so they are treated separately
            regex = new RegExp(query.split('@').join('.*'), 'i');
        } else {
            // default is the very fuzzy search
            regex = new RegExp(query.split('').join('.*'), 'i');
        }

        return value.match(regex);
    });
}


function initializeAdvancedSearch() {
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
