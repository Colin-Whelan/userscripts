// ==UserScript==
// @name        Bynder - Bulk Copy URLs
// @namespace   Violentmonkey Scripts
// @match       https://assets.indigoimages.ca/media/*
// @grant       GM_xmlhttpRequest
// @version     1.6
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
        let uploadContainer = document.getElementById('uploadContainer');

        if (!document.getElementById('exportURLs') && uploadContainer) {
            clearInterval(checkExportButtonInterval); // Clear the interval once the function is called

            addExportButton(); // Call addExportButton if the button doesn't exist
        }
    }, 400); // Check every 200 milliseconds

    function showNotification(message, bgColor = '#D7C756', delay = 3000) {
      const target = document.querySelector('body').children[0];

      const div = document.createElement('div');
      div.innerText = message;
      div.id = 'notification';
      div.style.backgroundColor = bgColor;

      target.appendChild(div);

      setTimeout(function() {
        div.parentNode.removeChild(div)
      }, delay); // small delay then remove notification
    }

    function addExportButton() {
        console.log('target', document.querySelector('#uploadContainer'))
        const target = document.querySelector('#uploadContainer')
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
        section#rootHeaderNavigation button#exportURLs {
          background-color: rgb(9, 38, 187);
          color: white;
          font-size: 16px;
          border: none;
          padding: 10px;
          border-radius: 2px;
          float: right;
          position: relative;
          margin: 10px 20px 0 20px;
          letter-spacing: 0.5px;

        }
        section#rootHeaderNavigation button#exportURLs:hover {
          background-color: #2545D7;
        }
        #notification {
          color: white;
          position: fixed;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1000;
          text-align: center;
          width: auto;
          margin-top: 30px;
          font-size: 16px;
          border: none;
          padding: 10px;
          border-radius: 5px;
        }
        `

        document.head.appendChild(style);
        const button = document.createElement('button');
        button.innerText = "Copy Public URLs";
        button.id = 'exportURLs';
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
                  let numWithoutUrls = results.length - urls.length
                  if(urls.length > 0){
                    copyToClipboard(urls.join("\n"));
                    if(numWithoutUrls){
                      showNotification(`Copied ${urls.length} URL${urls.length == 1 ? '' : 's'}. (${numWithoutUrls} ${numWithoutUrls == 1 ? 'URL' : 'URLs'} not public.)`, '#D7C756', 5000)
                    } else {
                      showNotification(`Copied ${urls.length} URL${urls.length == 1 ? '' : 's'}!`, '#0f9d58')
                    }
                  } else {
                    showNotification(`${numWithoutUrls == 1 ? 'URL' : 'URLs'} not public!`, '#e8253b')
                  }
              } catch (error) {
                  console.error('An error occurred:', error);
              }

            } else {
              showNotification("No assets selected")
            }
        };

        // Get the parent element of 'target'
        const parent = target.parentNode;

        // Insert 'button' before 'target' within the 'parent'
        parent.insertBefore(button, target);


        document.addEventListener('click', function() {
          let activeDivs
          // not sure why a delay of 0 works, but it does
          setTimeout(() => {
            activeDivs = document.getElementById('results-thumbs').querySelectorAll('div.active');
            if(activeDivs.length){
              button.innerText = `Copy Public URLs (${activeDivs.length})`
            } else {
              button.innerText = `Copy Public URLs`
            }
          }, 0);
        }, true);
    }

})();
