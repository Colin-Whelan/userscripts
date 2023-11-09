// ==UserScript==
// @name        Bynder - Bulk Copy URLs
// @namespace   Violentmonkey Scripts
// @match       https://YOUR_BYNDER_DOMAIN/media/*
// @grant        GM_xmlhttpRequest
// @version     1.0
// @author      Colin Whelan
// @description Add a button to copy public URL of each selected asset.
// ==/UserScript==

const assetDomain = "YOUR_BYNDER_DOMAIN";

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
    function showNotification(container, message, color = '#0f9d58') {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.position = 'absolute';
        notification.style.bottom = '20px';
        switch (message) {
            case 'Copied URLs to clipboard!':
            case 'Nothing to copy!':
                notification.style.left = '50%';
                break
            case 'Copied URL to clipboard!':
            default:
                notification.style.left = '25%';
                break
        }
        notification.style.fontSize = '12px';
        notification.style.transform = 'translateX(-50%)';
        notification.style.backgroundColor = color; // default: Google Green
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

    // Function to parse the response and get the URL
    function parseResponse(responseText) {
        const parser = new DOMParser();
        const htmlDocument = parser.parseFromString(responseText, 'text/html');
        let inputElement = htmlDocument.getElementById('publicFiles');

        inputElement = inputElement ? inputElement.children[0] : ''

        // console.log(inputElement)
        return inputElement ? inputElement.value : null;
    }

    // Set an interval to repeatedly check for the element
    var checkExportButtonInterval = setInterval(function() {
        if (!document.getElementById('exportURLs')) {
            addExportButton(); // Call addExportButton if the button doesn't exist
            clearInterval(checkExportButtonInterval); // Clear the interval once the function is called
        }
    }, 200); // Check every 200 milliseconds

    function addExportButton() {
        const filterBar = document.querySelector('.media-tools.clearfix')
        const button = document.createElement('button');
        button.innerText = "Get Public URL of selected assets";
        button.id = 'exportURLs';
        button.style.backgroundColor = 'rgb(7, 30, 150)';
        button.style.color = 'white';
        button.style.marginTop = '10px';
        button.style.fontSize = '18px'
        button.style.border = 'none'
        button.style.padding = '10px 15px'
        button.style.borderRadius = '5px'
        button.onclick = async function(event) {
            const urls = []
            event.preventDefault();
            event.stopPropagation();
            const allSelectedAssets = document.getElementById('results-thumbs').querySelectorAll('div.active');

            // Wrap the GM_xmlhttpRequest call in a Promise
            const fetchUrl = (dataDragSelectId) => {
                return new Promise((resolve, reject) => {
                    const currentTimestamp = Date.now();

                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: `https://${assetDomain}/media/detail/?id=${dataDragSelectId}&keyId=&_=${currentTimestamp}`,
                        onload: function(response) {
                            const url = parseResponse(response.responseText);
                            if (url) {
                                resolve(url);
                            } else {
                                reject('No URL found');
                            }
                        },
                        onerror: function(response) {
                            reject('Error fetching URL');
                        }
                    });
                });
            };

            // Use map to create an array of promises
            const promises = Array.from(allSelectedAssets).map(container => {
                const dataDragSelectId = container.getAttribute('data-drag-select-id');
                return fetchUrl(dataDragSelectId);
            });

            // Wait for all promises to resolve
            try {
                const results = await Promise.all(promises);
                results.forEach(url => urls.push(url));

                // Now that all URLs are fetched, copy to clipboard and log
                if(urls.length > 0){
                  copyToClipboard(urls.join("\n"));
                  showNotification(button, 'Copied URLs to clipboard!');
                } else {
                  showNotification(button, 'Nothing to copy!', '#e8253b');
                }
                console.log(urls);
            } catch (error) {
                console.error('An error occurred:', error);
            }
        };

        filterBar.appendChild(button);

    }

})();
