// ==UserScript==
// @name        Event Tester - Bulk Events
// @namespace   Violentmonkey Scripts
// @match       https://app.segment.com/*/destinations/*/sources/*/instances/*/event-tester*
// @grant       none
// @version     1.1
// @author      Colin Whelan
// @description Send tests using uploaded JSON files. Each is sent to the current destination. Allows for batch sending of tests and test cases. Events are sent as soon as they are uploaded. Shows the response of each in a modal - click to expand.
// ==/UserScript==

(function() {
    'use strict';

    const css = `
    #fileUploadStatus {
      padding: 20px;
      position: fixed;
      top: 20%;
      left: 30%;
      width: 40%;
      max-height: 60%;
      background-color: #f9f9f9;
      border: 1px solid #ccc;
      border-radius: 8px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      z-index: 1000;
      overflow-y: auto;
      display: none;
    }

    #closeModalButton {
      padding: 8px 15px;
      margin-bottom: 10px;
      border: none;
      border-radius: 4px;
      background-color: #4CAF50;
      color: white;
      cursor: pointer;
      position: absolute;
      top: 12px;
      right: 12px;
    }

    #batchJsonInput {
      padding: 10px;
      margin-top: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      width: 50%;
    }

    .responseText{
      word-break:
    }

    `;

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = css;
    document.head.appendChild(styleSheet);

    let numOfResponses = 0;

    // Function to create a modal
    function createModal() {
        let modal = document.createElement('div');
        modal.id = 'fileUploadStatus'

        let closeModalButton = document.createElement('button');
        closeModalButton.id = 'closeModalButton'
        closeModalButton.textContent = 'Close';
        // Add more button styles as needed
        closeModalButton.onclick = function() {
            modal.style.display = 'none';
        };

        modal.appendChild(closeModalButton);
        document.body.appendChild(modal);

        return modal;
    }

    // Create the modal
    let modal = createModal();

    // Function to add event response to modal
    function addToModal(filename, responseData) {
        let details = document.createElement('details');
        let summary = document.createElement('summary');
        summary.style.cursor = 'pointer';
        summary.style.display = 'flex';
        summary.style.alignItems = 'center';

        let arrow = document.createElement('span');
        arrow.innerHTML = '&#9660;'; // Down arrow, changes to up arrow when expanded
        arrow.style.marginRight = '10px';
        summary.appendChild(arrow);

        let filenameText = document.createTextNode(filename);
        summary.appendChild(filenameText);

        let statusCode = document.createElement('span');
        statusCode.textContent = ` (${responseData.statusCode})`;
        statusCode.style.color = responseData.statusCode === 200 ? 'green' : 'red';
        summary.appendChild(statusCode);

        details.appendChild(summary);

        let responseText = document.createElement('pre');
        responseText.classList = ['responseText']
        responseText.textContent = JSON.stringify(responseData, null, 2);
        details.appendChild(responseText);

        modal.appendChild(details);

        details.addEventListener('toggle', function() {
            arrow.innerHTML = details.open ? '&#9650;' : '&#9660;'; // Change arrow direction
        });
    }

    // Function to show modal
    function showModal() {
        modal.style.display = 'block';
    }

    // URL of the resource you want to fetch
    const url = 'https://app.segment.com/gateway-api/graphql?operation=sendEventToIntegration';

    function addFileInput(target) {
        // Create file input element
        let fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'batchJsonInput';
        fileInput.multiple = true;
        target.appendChild(fileInput);

        // Event listener for file selection
        fileInput.addEventListener('change', function () {
            clearModal(); // Clear the modal before adding new files
            let files = fileInput.files;
            let processedFiles = 0;  // Counter for processed files

            if (files.length > 0) {
                for (let i = 0; i < files.length; i++) {
                    let file = files[i];
                    let reader = new FileReader();

                    reader.onload = function (e) {
                        try {
                            let yourJsonData = JSON.parse(e.target.result);
                            sendEventData(files.length, file.name, yourJsonData);
                        } catch (error) {
                            console.error("Error parsing JSON:", error);
                            addToModal(file.name, {"statusCode": "Segment JSON error", "Error": error.message })
                        }

                        processedFiles++;  // Increment the processed files counter

                        // Check if all files have been processed
                        if (processedFiles === files.length) {
                            showModal();
                        }
                    };

                    reader.readAsText(file);
                }
            }
        });
    }

    // Function to clear the modal contents
    function clearModal() {
        // Remove only the event response elements (e.g., details elements)
        let detailsElements = modal.querySelectorAll('details');
        detailsElements.forEach(element => element.remove());

        // Reset numOfResponses to 0
        numOfResponses = 0;
    }
    // Set an interval to repeatedly check for the element
    var checkExportButtonInterval = setInterval(function() {
        const target = document.querySelector('div.📦pb_16px.📦pt_16px.ub-box-szg_border-box div.ub-box-szg_border-box')
        if (target && !document.getElementById('batchJsonInput')) {
            clearInterval(checkExportButtonInterval); // Clear the interval once the function is called
            addFileInput(target);
        } else {
          // console.log('still not ready',target, document.getElementById('batchJsonInput'))
        }
    }, 400);

    function extractUrlParameters() {
        const urlSegments = window.location.pathname.split('/');
        // Assuming the URL format is consistent and the required parameters are in specific positions
        return {
            workspaceSlug: urlSegments[1],
            integrationSlug: urlSegments[3],
            sourceSlug: urlSegments[5],
            integrationConfigId: urlSegments[7] // This assumes the integrationConfigId is part of the URL. Adjust if needed.
        };
    }

    // Function to send event data
    function sendEventData(numOfFiles, filename, yourJsonData) {
        numOfResponses = 0
        const { workspaceSlug, integrationSlug, sourceSlug, integrationConfigId } = extractUrlParameters();

        const payload = {
            "operationName":"sendEventToIntegration",
            "variables": {
                "input": {
                    workspaceSlug, // dynamically set from URL
                    integrationSlug, // dynamically set from URL
                    sourceSlug, // dynamically set from URL
                    "eventPayload": JSON.stringify(yourJsonData),
                    integrationConfigId // dynamically set from URL
                }
            },
            "query":"mutation sendEventToIntegration($input: SendEventToIntegrationInput!) {\n  sendEventToIntegration(input: $input) {\n    eventResponses {\n      request\n      response\n      __typename\n    }\n    eventError {\n      code\n      message\n      __typename\n    }\n    __typename\n  }\n}\n"
        };

        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-requested-with': 'fetch',
                'x-timezone': 'America/Toronto'
            },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(data => {
            let response = data.data.sendEventToIntegration.eventResponses[0].response
            numOfResponses++
            // console.log(response)
            addToModal(filename, response);
            if (numOfResponses === numOfFiles) {
                showModal();
            }
        })
        .catch((error) => {
            console.error('Error:', error);
        });
    }
})();
