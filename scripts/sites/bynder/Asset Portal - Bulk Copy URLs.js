// ==UserScript==
// @name        Bynder - Bulk Copy URLs
// @namespace   Violentmonkey Scripts
// @match       https://YOUR_BYNDER_DOMAIN/media/*
// @grant       GM_xmlhttpRequest
// @version     1.5
// @author      Colin Whelan
// @description Add a button to copy public URL of each selected asset. Just update the @match URL to your domain and enjoy.
// Features:
// Shows in header bar - remains during scroll.
// Warns when nothing is selected/no public urls available.
// Shows # of assets selected. (useful for Native bulk features too)
// Shows # of URLs copied and # without public URLs
// Highlights which assets have no public URLs on copy. Not feasible to check ALL.
// ==/UserScript==

(function() {
    'use strict';

    const assetDomain = window.location.hostname;

    // Function to handle the copying to clipboard
    function copyToClipboard(url) {
        const el = document.createElement('textarea');
        el.value = url;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
    }

    // Function to parse the response and get the URL
    function parseResponse(responseText) {
        const parser = new DOMParser();
        const htmlDocument = parser.parseFromString(responseText, 'text/html');
        let inputElement = htmlDocument.getElementById('publicFiles');

        return inputElement && inputElement.children.length > 0 ? inputElement.children[0].value : null;
    }

    // Set an interval to repeatedly check for the element
    var checkExportButtonInterval = setInterval(function() {
        if (!document.getElementById('exportURLs')) {
            clearInterval(checkExportButtonInterval); // Clear the interval once the function is called

            addExportButton(); // Call addExportButton if the button doesn't exist
        }
    }, 200); // Check every 200 milliseconds

    function showNotification(message, bgColor = '#D7C756', delay = 3000) {
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
      }, delay); // small delay then remove notification
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
              return fetchUrl(dataDragSelectId)
                .then(url => {
                  if (!url) { // If the URL is null, undefined, or an empty string
                    container.style.border = '3px solid red'; // Add a red border to the container
                  }
                  return url; // Return the fetched URL regardless of its value
                });
            });

            if(allSelectedAssets.length > 0){

              // Wait for all promises to resolve
              try {
                  const results = await Promise.all(promises);
                  results.forEach(url => url ? urls.push(url) : '');

                  // Now that all URLs are fetched, copy to clipboard and log
                  if(urls.length > 0){
                    let numWithoutUrls = results.length - urls.length
                    copyToClipboard(urls.join("\n"));
                    if(numWithoutUrls){
                      showNotification(`Copied ${urls.length} URL${urls.length == 1 ? '' : 's'} to clipboard. (${numWithoutUrls} ${numWithoutUrls == 1 ? 'has' : 'have'} no public URL)`, '#D7C756', 5000)
                    } else {
                      showNotification(`Copied ${urls.length} URL${urls.length == 1 ? '' : 's'} to clipboard!`, '#0f9d58')
                    }
                  } else {
                    showNotification('No public URLs!', '#e8253b')
                  }
              } catch (error) {
                  console.error('An error occurred:', error);
              }

            } else {
              showNotification("No assets selected")
            }
        };

        filterBar.appendChild(button);

        document.addEventListener('click', function() {
          var activeDivs
          // not sure why a delay of 0 works, but it does
          setTimeout(() => {
            activeDivs = document.getElementById('results-thumbs').querySelectorAll('div.active');
            if(activeDivs.length){
              button.innerText = `Get Public URL of Selected Assets (${activeDivs.length})`
            } else {
              button.innerText = `Get Public URL of Selected Assets`
            }
          }, 0);
        }, true);
    }

})();
