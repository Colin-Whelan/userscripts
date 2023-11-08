// ==UserScript==
// @name        Bynder - Quick Copy URLs
// @namespace   Violentmonkey Scripts
// @match       https://YOUR-BYNDER-DOMAIN/media/*
// @grant        GM_xmlhttpRequest
// @version     1.0
// @author      Colin Whelan
// @description Add a button to copy image URLs in the media library
// ==/UserScript==

const assetDomain = "YOUR-BYNDER-DOMAIN";

(function() {
    'use strict';

    // Function to handle the copying to clipboard
    function copyToClipboard(url) {
        const el = document.createElement('textarea');
        el.value = url;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
    }

// Function to show a floating notification
function showNotification(container, message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.position = 'absolute';
    notification.style.bottom = '20px';
    notification.style.left = '25%';
    notification.style.fontSize = '12px';
    notification.style.transform = 'translateX(-50%)';
    notification.style.backgroundColor = '#0f9d58'; // Example color: Google Green
    notification.style.color = 'white';
    notification.style.padding = '5px 10px';
    notification.style.borderRadius = '4px';
    notification.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    notification.style.whiteSpace = 'nowrap';
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s, bottom 0.3s';
    notification.style.pointerEvents = 'none'; // Prevents the notification from interfering with clicks
    container.style.position = 'relative'; // This is necessary to position the notification absolutely relative to the button
    container.appendChild(notification);

    // Make notification visible and start floating
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.bottom = '40px'; // How far the notification moves up
    }, 1); // Execute as soon as possible

    // After 2 seconds, hide and remove the notification
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.bottom = '20px'; // Moves back to the original position
        setTimeout(() => notification.remove(), 300); // Wait for the transition before removing
    }, 2000);
}

// Function to add the Copy URL button
function addCopyButton(container, url) {
   if (!container.querySelector('button')) {
          const button = document.createElement('button');
          button.innerText = 'Copy URL';
          button.style.backgroundColor = 'rgb(7, 30, 150)';
          button.style.color = 'white';
          button.style.marginTop = '10px';
          button.style.fontSize = '16px'
          button.style.border = 'none'
          button.style.padding = '8px 10px'
          button.style.borderRadius = '3px'
          button.onclick = function(event) {
              event.preventDefault();
              event.stopPropagation();
              copyToClipboard(url);
              showNotification(container, 'Copied to clipboard!');
          };
          container.querySelector('dl').appendChild(button);
       }
    }

    // Function to parse the response and get the URL
    function parseResponse(responseText) {
        const parser = new DOMParser();
        const htmlDocument = parser.parseFromString(responseText, 'text/html');
        let inputElement = htmlDocument.getElementById('publicFiles');

        inputElement = inputElement ? inputElement.children[0] : ''

        // console.log(inputElement)
        return inputElement ? inputElement.value : null;
    }

    // Function to handle the request and add the button
    function handleRequest(dataDragSelectId, container) {

    if (container.querySelector('button')) {
        // Request already made, do nothing
        return;
    }

    const currentTimestamp = Date.now();
    // console.log(dataDragSelectId, container, currentTimestamp)
    GM_xmlhttpRequest({
        method: 'GET',
        url: `https://${assetDomain}/media/detail/?id=${dataDragSelectId}&keyId=&_=${currentTimestamp}`,
        onload: function(response) {
            const url = parseResponse(response.responseText);
            if(url) {
                addCopyButton(container, url);
                // console.log(url); // Log the URL to the console
            }
        }
    });
}

    // MutationObserver callback function to detect when resultsThumbs is added
    function onMutation(mutations, observer) {
        const targetNode = document.getElementById('results-thumbs')
        for (const mutation of mutations) {
            if (mutation.addedNodes) {
                for (const node of mutation.addedNodes) {
                    if (targetNode && targetNode.childNodes) {
                        // console.log('something happened and targetNode is available.')
                        observer.disconnect(); // Stop observing once we've found resultsThumbs
                        setTimeout(function() {
                            main(targetNode); // Call main with the target node after a delay
                        }, 200);
                        observer.observe(document.body, { childList: true, subtree: true });
                        return;
                    }
                }
            }
        }
    }

// Main function to find the images and initiate the process
function main(resultsThumbs) {
    if (resultsThumbs) {
        const assetContainers = resultsThumbs.childNodes;
        for (const container of assetContainers) {
            // console.log(container)
            // Make sure the node is an element and the 'data-drag-select-id' attribute is not null
            if (container.nodeType === Node.ELEMENT_NODE && container.getAttribute('data-drag-select-id') != null) {
                  if (!container.querySelector('button')) {
                    // console.log(container)
                    const dataDragSelectId = container.getAttribute('data-drag-select-id');
                    handleRequest(dataDragSelectId, container);
                  }
            }
        }
    }
}


    // Set up the MutationObserver to watch for changes in the DOM
    const observer = new MutationObserver(onMutation);
    observer.observe(document.body, { childList: true, subtree: true });

})();
