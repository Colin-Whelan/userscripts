// ==UserScript==
// @name         Global - Partial Email Search
// @namespace    Violentmonkey Scripts
// @match        https://my.sailthru.com/*
// @version      0.3
// @description  Add partial email search functionality to Sailthru with modal results
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(`
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            overflow: auto;
            background-color: rgba(0,0,0,0.4);
        }
        .modal > p {
            margin: 10px 0;
        }
        div#searchResultContent > ul {
          margin: 10px 0;
          padding: 8px 0;
        }
        div#searchResultContent > h1 {
          margin-top: 0px;
        }
        div#searchResultContent > h3 {
          margin-bottom: 0px;
        }
        .modal-content {
            background-color: #fefefe;
            margin: 15% auto;
            padding: 20px;
            border: 1px solid #888;
            width: 80%;
            max-width: 450px;
            border-radius: 20px;
            font-size: 16px;
        }
        .close {
            color: #aaa;
            float: right;
            font-size: 28px;
            font-weight: bold;
        }
        .close:hover,
        .close:focus {
            color: black;
            text-decoration: none;
            cursor: pointer;
        }
        #partial_search_field {
          top: 14px;
          position: relative;
        }
    `);

    // Function to create and insert the new search bar
    function createPartialSearchBar() {
        const headerTopRight = document.getElementById('header_top_right');
        if (!headerTopRight) return;

        const searchContent = document.createElement('div');
        searchContent.className = 'header_top_right_item';
        searchContent.style.marginRight = '20px';

        const searchDiv = document.createElement('div');
        searchDiv.id = 'partial_search';
        searchDiv.title = 'Partial Email Search';
        searchDiv.style.width = '200px';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.id = 'partial_search_field';
        searchInput.placeholder = 'Partial Email Search';
        searchInput.style.width = '100%';
        searchInput.style.padding = '5px';

        searchDiv.appendChild(searchInput);
        searchContent.appendChild(searchDiv);
        headerTopRight.insertBefore(searchContent, headerTopRight.firstChild);

        // Add event listener for the search
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performPartialSearch(searchInput.value);
            }
        });

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'searchResultModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h1>Search Results</h1>
                <div id="searchResultContent"></div>
            </div>
        `;
        document.body.appendChild(modal);

        // Close modal when clicking on <span> (x)
        modal.querySelector('.close').onclick = function() {
            modal.style.display = "none";
        };

        // Close modal when clicking outside of it
        window.onclick = function(event) {
            if (event.target == modal) {
                modal.style.display = "none";
            }
        };
    }

    // Function to perform the partial search
    function performPartialSearch(searchString) {
        const url = `https://my.sailthru.com/uiapi/profilecounting`;
        const body = {
            sourceLists: {lists: [], mode: "all", editing: false, shouldSavePreference: false, valid: true},
            criteriaMap: {
                "05fe2be5-69ea-4d5f-8f1a-c14f6399d053": {
                    key: "address_domain",
                    criteria: "email_matches",
                    value: searchString,
                    errors: {}
                }
            },
            criteriaArrangement: ["05fe2be5-69ea-4d5f-8f1a-c14f6399d053"],
            focusedCriterion: "05fe2be5-69ea-4d5f-8f1a-c14f6399d053",
            mode: "and",
            isOver: false,
            isAllCollapsed: false,
            isAllExpanded: true,
            isSmartListEdit: false
        };

        function customStringify(obj) {
            return JSON.stringify(obj, null, 0).replace(/([{,])(\s*)([A-Za-z0-9_\-]+?)\s*:/g, '$1"$3":');
        }

        const bodyData = customStringify(body);

        GM_xmlhttpRequest({
            method: "POST",
            url: url,
            data: bodyData,
            headers: {
                "Content-Type": "application/json",
                "Accept": "*/*",
                "Accept-Language": "en-US,en;q=0.5",
                "Referer": "https://my.sailthru.com/audience_builder",
                "Origin": "https://my.sailthru.com",
                "DNT": "1",
                "Sec-GPC": "1",
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "no-cors",
                "Sec-Fetch-Site": "same-origin",
                "Pragma": "no-cache",
                "Cache-Control": "no-cache"
            },
            withCredentials: true,
            onload: function(response) {
                if (response.status === 200) {
                    displayResults(JSON.parse(response.responseText));
                } else {
                    alert("Error: " + response.status + ". Check the console for details.");
                    console.error("Error:", response);
                }
            },
            onerror: function(response) {
                console.error("Error:", response);
                alert("An error occurred. Check the console for details.");
            }
        });
    }

    // Function to display results in the modal
    function displayResults(data) {
        const modal = document.getElementById('searchResultModal');
        const content = document.getElementById('searchResultContent');

        let html = `<p>Total Count: ${data.totalCount}</p>
                    <p>Matching Emails: ${data.emailCount}</p>
                    <h3>Sample Results:</h3>
                    <ul>`;

        data.sample.forEach(item => {
            const emailLowerCase = item.email.toLowerCase();
            html += `<li><a href="https://my.sailthru.com/reports/user_profile?id=${emailLowerCase}" target="_blank">${item.email}</a></li>`;
        });

        html += '</ul>';

        content.innerHTML = html;
        modal.style.display = "block";
    }

    // Function to check for the header_first_row and add the search bar
    function checkAndAddSearchBar() {
        const headerFirstRow = document.querySelector('div#header_first_row');
        if (headerFirstRow) {
            console.log(headerFirstRow)
            createPartialSearchBar();
            observer.disconnect(); // Stop observing once we've added the search bar
        }
    }

    // Create a MutationObserver to watch for the header_first_row
    const observer = new MutationObserver(checkAndAddSearchBar);

    // Start observing the document with the configured parameters
    observer.observe(document.body, { childList: true, subtree: true });

    // Initial check in case the element is already there
    checkAndAddSearchBar();

})();
