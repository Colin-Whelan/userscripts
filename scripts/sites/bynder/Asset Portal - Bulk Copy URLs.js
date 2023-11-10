// ==UserScript==
// @name        Bynder - Bulk Copy URLs
// @namespace   Violentmonkey Scripts
// @match       https://YOUR_BYNDER_DOMAIN/media/*
// @grant        GM_xmlhttpRequest
// @version     1.3
// @author      Colin Whelan
// @description Add a button to copy public URL of each selected asset. Just update the @match URL to your domain and enjoy.
// ==/UserScript==

(function() {
    'use strict';

    const assetDomain = window.location.hostname;
    let badAssetDomain = false

    function extractHostname(url) {
      // Create a new URL object, which will throw an error if the URL is invalid.
      try {
        const parsedUrl = new URL(url);
        return parsedUrl.hostname; // Returns the domain part of the URL
      } catch (error) {
        badAssetDomain = true
        console.log('oops bad asset domain.')
        addWarning("Error - Script: Bad asset domain. Should be 'assets.domain.com'")
        return null; // or handle the error as per your needs
      }
    }

    function checkAssetDomain(){
      if(assetDomain.includes('http')) {
        badAssetDomain = true
        console.log('oops bad asset domain.', assetDomain)
        addWarning("Error - Script: Bad asset domain. Should be like 'assets.domain.com'")
      }
    }
    checkAssetDomain()

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
        notification.style.bottom = '10%';
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
        }, 1); // Execute as soon as possible

        // After 2 seconds, hide and remove the notification
        setTimeout(() => {
            notification.style.opacity = '0';
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
        if(badAssetDomain) {
            clearInterval(checkExportButtonInterval); // Clear the interval once the function is called
        }
        if (!document.getElementById('exportURLs') && !badAssetDomain) {
            clearInterval(checkExportButtonInterval); // Clear the interval once the function is called

            addExportButton(); // Call addExportButton if the button doesn't exist
        }
    }, 200); // Check every 200 milliseconds

    function addWarning(message, bgColor = '#D7C756') {
      const filterBar = document.querySelector('body').children[0];

      const div = document.createElement('div');
      div.innerText = message;
      div.id = 'copyUrlWarning';
      div.style.backgroundColor = bgColor;
      div.style.color = 'white';
      div.style.position = 'fixed'; // To position the div relative to the viewport
      div.style.top = '0'; // Align to the top of the screen
      div.style.left = '50%'; // Align to the horizontal center
      div.style.transform = 'translateX(-50%)'; // Ensure it is centered
      div.style.zIndex = '1000'; // Make sure it's on top of other elements
      div.style.textAlign = 'center'; // Center the text inside the div
      div.style.width = 'auto'; // Let it size according to the message length
      div.style.marginTop = '30px';
      div.style.fontSize = '16px';
      div.style.border = 'none';
      div.style.padding = '10px';
      div.style.borderRadius = '5px';

      filterBar.appendChild(div);



      setTimeout(function() {
        div.parentNode.removeChild(div)
      }, 5000); // Adjust the time as needed, 2000 is for 2 seconds
    }


    function addExportButton() {

        const filterBar = document.querySelector('.filters-holder').children[0]
        const style = document.createElement('style');
        style.innerHTML += `
        body header.base .filters .clearfix {
          max-height: 50px !important;
        }
        body header.base .filters-holder {
          max-height: 50px !important;
        }
        body header.base .tool-bar .clearfix {
          max-height: 50px !important;
        }
        `

        document.head.appendChild(style);
        const button = document.createElement('button');
        button.innerText = "Get Public URL of Selected Assets";
        button.id = 'exportURLs';
        button.style.backgroundColor = 'rgb(7, 30, 150)';
        button.style.color = 'white';
        button.style.marginBottom = '10px';
        button.style.fontSize = '16px'
        button.style.border = 'none'
        button.style.padding = '10px 10px'
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
                                resolve()
                                // reject('No URL found');
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
                results.forEach(url => url ? urls.push(url) : '');

                // Now that all URLs are fetched, copy to clipboard and log
                if(urls.length > 0){
                  copyToClipboard(urls.join("\n"));
                  showNotification(button, 'Copied URLs to clipboard!');
                } else {
                  showNotification(button, 'Nothing to copy!', '#e8253b');
                }
                // console.log(urls);
            } catch (error) {
                console.error('An error occurred:', error);
            }
        };

        filterBar.appendChild(button);



        document.addEventListener('click', function() {
          // console.log('clikc')
          var activeDivs
          // small delay
          setTimeout(() => {
            activeDivs = document.getElementById('results-thumbs').querySelectorAll('div.active');
            if(activeDivs.length){
              button.innerText = `Get Public URL of Selected Assets (${activeDivs.length})`
            } else {
              button.innerText = `Get Public URL of Selected Assets`
            }
            // console.log(activeDivs); // This will log the NodeList of active 'div' elements to the console
          }, 0);
        }, true);

    }

})();
