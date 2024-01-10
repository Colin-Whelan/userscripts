// ==UserScript==
// @name        API Test - Request Manager
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/api/test*
// @grant       none
// @version     1.0
// @author      Colin Whelan
// @description Adds functionality to manage and autofill API requests on Sailthru's test API page.
// ==/UserScript==

(function() {
    'use strict';

    // JSON object with saved requests
    const savedRequests = {
        "none": { // Keep this one as is and don't remove.
            method: "GET",
            action: "user",
            params: `{

}`
        },
        "Account Merge": {
            method: "POST",
            action: "user",
            params:
`{
    "id":"old_email_address",
    "key": "email",
    "keys":
        {
            "email":"new_email_address"
        },
    "keysconflict":"merge"
}`
        },
        "Lookup extID": {
            method: "GET",
            action: "user",
            params:
`{
  "id":"extID_to_lookup",
  "key":"extid"
}`
        },
        "Event with Vars": {
            method: "POST",
            action: "event",
            params:
`{
  "id" : "email_address",
  "event"  : "event_name",
  "vars" : {
    "url" : "http://example.com/123",
    "name" : "Widget"
  }
}`
        },
        // Add more requests as needed. Remove leading white space on 'params' like the examples.
    };

    // Function to create and insert the dropdown
    function createDropdown() {
        const dropdownHTML = `<select id="savedRequestsDropdown">
                                ${Object.keys(savedRequests).map(requestName =>
                                    `<option value="${requestName}">${requestName}</option>`
                                ).join('')}
                              </select>`;
        // Add the dropdown to the page
        document.querySelector('.select_component.align_api_select').insertAdjacentHTML('afterend', dropdownHTML);
        document.getElementById('savedRequestsDropdown').addEventListener('change', fillFormWithRequest);

        // Add CSS styles for the dropdown
        addDropdownStyles();
    }

    function addDropdownStyles() {
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = `
            #savedRequestsDropdown {
                background-color: white;
                color: black;
                border: 1px solid #ccc;
                padding: 5px;
                height: 32px;
                vertical-align: 10px;
                margin-left: 15px;
            }
        `;
        document.head.appendChild(style);
    }

    // Function to autofill the form
    function fillFormWithRequest() {
        resizeTextarea();

        const selectedRequest = savedRequests[this.value];
        console.log(selectedRequest)
        if (selectedRequest) {
            document.getElementById('f_method').value = selectedRequest.method;
            document.querySelector('.f_method .align_api_select div a span').textContent = selectedRequest.method;

            document.getElementById('f_action').value = selectedRequest.action;
            document.querySelector('.f_action .align_api_select div a span').textContent = selectedRequest.action;

            document.getElementById('f_params').value = selectedRequest.params;

        }
    }

    // Function to resize the textarea
    function resizeTextarea() {
        const textarea = document.getElementById('f_params');
        const result = document.querySelector('div.api_test_code');
        let buffer = result ? 200 : 0;
        console.log(textarea.getBoundingClientRect().top);

        // Get the viewport height
        const viewportHeight = window.innerHeight;

        // Calculate the new height
        let newHeight = viewportHeight - (textarea.getBoundingClientRect().top + 300 + buffer);
        console.log(viewportHeight, textarea.getBoundingClientRect().top, buffer, newHeight)

        // Check if the new height is less than the minimum height
        if (newHeight < 200) {
            newHeight = 200; // Set to minimum height if below threshold
        }

        textarea.style.height = newHeight + 'px'; // Apply the height in pixels
        textarea.style.width = '60vw';
    }


    // Initialize the script
    createDropdown();
    resizeTextarea();
})();
