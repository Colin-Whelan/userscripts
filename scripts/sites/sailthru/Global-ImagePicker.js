// ==UserScript==
// @name        Global - Image Picker
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/*
// @grant       none
// @version     1.4
// @run-at      document-end
// @author      Colin Whelan
// @description Adds the BEE editor image picker to the main Sailthru toolbar. Click an image to copy the path. Click a folder to enter it, back with the 'back' button, and the 'X'/outside the box to close it.
// How it works:
// First we fetch the BEE plugin resource, then we use that + the existing Sailthru cookie to authenticate with the Sailthru UI API. With that, we can fetch different folders of the BEE cloud storage.
// TODO:
// Show image dimensions - may need to call each image is slow/resource intensive.
// Add Upload/delete function
// Make it smaller, draggable, and add 'insert' button. - To mimic default HTML image behavior.
// ==/UserScript==

(function() {
    'use strict';
    // Global variable to keep track of folder history
    let folderHistory = [];

    let accessToken = '';

    // Add CSS Styles
    const css = `
        #imagePickerModal {
            display: none;
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
            z-index: 1000;
        }
        #modalContainer {
            display: block;
            background-color: #fff;
            margin: 2% auto;
            padding: 0px 20px 20px 20px;
            border: 1px solid #888;
            width: 70%;
            position: relative;
            border-radius: 20px;
            overflow-y: auto;
            max-height: 90%;
        }
        #modalContent {
            display: flex;
            flex-wrap: wrap;
            justify-content: start;
            background-color: #fff;
            padding: 20px 20px 20px 20px;
            width: 100%;
            position: relative;
        }
        #modalHeader {
            position: sticky;
            top: 0;
            background-color: #fff;
            z-index: 1001;
            display: flex;
            justify-content: space-between;
            padding: 35px;
            border-bottom: 1px solid #888;
        }
        #searchBar {
            padding: 5px 10px;
            font-size: 16px;
            margin: 0 5px;
            width: 87%;
            position: absolute;
            top: 21px;
            border-radius: 10px;
            border: 1px solid #333;
            right: 5%;
        }
        #closeButton {
            position: absolute;
            top: 15px;
            right: 25px;
            font-size: 36px;
            font-weight: bold;
            cursor: pointer;
        }
        .itemFrame {
            margin: 10px;
            padding: 10px;
            flex-basis: calc(15% + 5px);
            border: 1px solid #aaa;
            border-radius: 10px;
            text-align: center;
            background-color: #f5f5f5;
        }
        .image-thumbnail {
            max-width: 100%;
        }

        .image-name {
            text-align: center;
            font-size: 15px;
            font-weight: bold;
            margin-top: 5px;
            margin-bottom: 0;
            word-wrap: anywhere;
        }
        .image-lastModifyDate {
            text-align: center;
            font-size: 13px;
            margin: 3px 0 0 0;
        }
        #backButton {
            background-color: #EEE;
            padding: 10px 20px;
            text-align: center;
            text-decoration: none;
            display: inline-block;
            font-size: 16px;
            margin: 4px 2px;
            cursor: pointer;
            border-radius: 8px;
            border: none;

            /* Position towards the corner */
            position: absolute;
            top: 13px;
            left: 20px;
        }
        #copyNotification {
            color: white;
            position: fixed;
            top: 0;
            left: 50%;
            transform: translateX(-50%);
            z-index: 1002;
            text-align: center;
            width: auto;
            margin-top: 30px;
            font-size: 16px;
            border: none;
            padding: 10px;
            border-radius: 5px;
        }

    `;

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = css;
    document.head.appendChild(styleSheet);

    function authenticate() {
        return new Promise((resolve, reject) => {
            fetch('https://my.sailthru.com/uiapi/bee/auth', {
                method: 'POST',
                headers: {
                    'Cookie': document.cookie
                },
                body: JSON.stringify({"feature":"email"})
            })
            .then(response => response.json())
            .then(data => {
                if (data && data.access_token) {
                    accessToken = data.access_token;
                    resolve(accessToken);
                } else {
                    reject('No access token in response');
                }
            }).catch(reject);
        });
    }

    async function useToken(accessToken, hasAttemptedReauth = 0) {
      folderHistory = [];
      // console.log('Trying to fetch images...', accessToken);
      if (!accessToken) {
          try {
              accessToken = await authenticate();
          } catch (error) {
              console.error('Authentication failed:', error);
              // Optionally, show a notification to the user about the failure
              return; // Exit the function as there's no token to use
          }
      }

      fetch('https://bee-cloudstorage.getbee.io/cs/cloudstorage/', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + accessToken
        }
      })
      .then(imageResponse => {
          // Check if the Storage request was successful
          if (imageResponse.ok) {
              const body = imageResponse.json()
              return body
              // Now perform the GET request
          } else {
              throw new Error('image request failed');
          }
      })
      .then(imageData => {
          if (imageData) {
              let images = imageData.data.items;
              updateModal(imageModal, images);
          } else {
              throw new Error('image data is empty');
          }
      })
      .catch(async error => {
          console.error('Error:', error);
          // If the token failed to load, and no re-auth attempt has been made, try re-authenticating once
          if (hasAttemptedReauth < 3) {
              hasAttemptedReauth++
              try {
                  accessToken = await authenticate();
              } catch (error) {
                  console.error('Authentication failed:', error);
                  // Optionally, show a notification to the user about the failure
                  return; // Exit the function as there's no token to use
              }
              console.log('Re-authenticating...', hasAttemptedReauth, accessToken);
              useToken(accessToken, hasAttemptedReauth); // Pass null to force a re-authentication + pass true to indicate re-auth attempt has been made
          } else {
              // Handle the error or exit if re-authentication has already been attempted
              console.error('Re-authentication failed, not retrying.');
              showNotification('Failed to Authenticate. Reload and try again.', 'red', 4000, document.body);
          }
      });
    }

    // Function to create and return a modal element
    function createModal() {
        let modal = document.createElement('div');
        modal.id = 'imagePickerModal';

        // Close modal when clicking outside of modal content
        modal.addEventListener('click', function(event) {
            let modalContent = document.querySelector('.modal-content');
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });

        let modalContainer = document.createElement('div');
        modalContainer.id = 'modalContainer';

        let modalHeader = document.createElement('div');
        modalHeader.id = 'modalHeader';

        let modalContent = document.createElement('div');
        modalContent.id = 'modalContent';

        let searchInput = document.createElement('input');
        searchInput.id = 'searchBar';
        searchInput.type = 'text';
        searchInput.placeholder = 'Search images...';
        searchInput.oninput = function() {
            filterImages(searchInput.value); // Implement this function to filter images
        };

        modal.appendChild(modalContainer);

        modalContainer.appendChild(modalHeader);
        modalHeader.appendChild(createCloseButton(modal));
        modalHeader.appendChild(searchInput);

        modalContainer.appendChild(modalContent);

        document.body.appendChild(modal);
        return modal;
    }

    // Function to create a close button
    function createCloseButton(modal) {
        let closeButton = document.createElement('span');
        closeButton.innerHTML = '&times;';
        closeButton.id = 'closeButton';
        closeButton.onclick = function() {
            modal.style.display = 'none';
        };
        return closeButton;
    }

    function filterImages(query) {
        // Retrieve all image name elements
        let imageNames = document.querySelectorAll('.image-name');
        imageNames.forEach(el => {
            // Check if the image name includes the query
            if (el.textContent.toLowerCase().includes(query.toLowerCase())) {
                el.closest('.itemFrame').style.display = 'block'; // Show the image frame
            } else {
                el.closest('.itemFrame').style.display = 'none'; // Hide the image frame
            }
        });
    }

    // Function to update the modal with image data
    function updateModal(modal, images, currentPath) {
        if(!currentPath) currentPath = 'home'

        // console.log('Current Folder:', currentPath)

        // Add current path to folder history, but avoid duplicates
        if (folderHistory[folderHistory.length - 1] !== currentPath) {
            folderHistory.push(currentPath);
        }

        console.log(document.getElementById('modalContent'))

        let modalHeader = document.getElementById('modalHeader');
        let modalContent = document.getElementById('modalContent');
        modalContent.innerHTML = ''; // Clear existing content

        // Add Back button if not in root
        if (folderHistory.length > 1) {
            let backButton = createBackButton();
            modalHeader.appendChild(backButton);
        }

        // modalContent.appendChild(createCloseButton(modal));

        // Add image data
        images.forEach(image => {
            let frameDiv = document.createElement('div');
            frameDiv.classList = ['itemFrame'];

            let itemDiv = document.createElement('div');
            let imageName = image.name

            let timestamp = image['last-modified']
            let lastModifiedDate = new Date(Number(timestamp)).toUTCString();

            if (image['mime-type'] === 'application/directory') {
                // Handle folders
                itemDiv.innerHTML = `<strong>Folder:</strong><br> ${imageName} (${image['item-count']}) <br> Last Modified: ${lastModifiedDate}`;
                itemDiv.style.cursor = 'pointer';
                itemDiv.onclick = function() {
                    // Fetch contents of the clicked folder
                    fetchFolderContents(imageName);
                };
            } else {
                // Handle images
                let imgElement = document.createElement('img');
                imgElement.src = image.thumbnail;
                imgElement.alt = imageName;
                imgElement.className = 'image-thumbnail'; // Assign a class for styling

                frameDiv.style.cursor = 'pointer';
                frameDiv.onclick = function() {
                    copyToClipboard(image['public-url']);
                };

                let imgName = document.createElement('p');
                imgName.textContent = imageName;
                imgName.className = 'image-name'; // Assign a class for styling

                let lastModifyDate = document.createElement('p');
                lastModifyDate.textContent = `Last Modified: ${lastModifiedDate}`;
                lastModifyDate.className = 'image-lastModifyDate'; // Assign a class for styling

                itemDiv.appendChild(imgElement);
                itemDiv.appendChild(imgName); // Append the image name element
                itemDiv.appendChild(lastModifyDate); // Append the image name element
            }

            frameDiv.appendChild(itemDiv);
            modalContent.appendChild(frameDiv);
        });

        modal.style.display = 'block'; // Show the modal
    }

    function showNotification(message, bgColor = 'green', delay = 3000, target) {
        if (!target) {
          target = document.getElementById('modalContent')
        }

        const div = document.createElement('div');
        div.innerText = message;
        div.id = 'copyNotification';
        div.style.backgroundColor = bgColor;

        target.appendChild(div);

        setTimeout(function() {
          div.parentNode.removeChild(div)
        }, delay); // small delay then remove notification
    }

    // Function to fetch contents of a folder
    function fetchFolderContents(folderName) {

        let folderUrl = `https://bee-cloudstorage.getbee.io/cs/cloudstorage/${encodeURIComponent(folderName)}/`;

        if(folderName == 'home') {
          folderUrl = `https://bee-cloudstorage.getbee.io/cs/cloudstorage/`;
        }

        fetch(folderUrl, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + accessToken
            }
        })
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('Folder request failed');
            }
        })
        .then(folderData => {
            if (folderData) {
                updateModal(imageModal, folderData.data.items, folderName);
            } else {
                throw new Error('Folder data is empty');
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
    }

    // Function to create a Back button
    function createBackButton() {
        let backButton = document.createElement('button');
        backButton.innerText = 'Back';
        backButton.id = 'backButton';
        backButton.onclick = function() {
            // Go back to the previous folder
            folderHistory.pop(); // Remove current location
            let previousFolder = folderHistory.pop(); // Get previous location
            if (previousFolder) {
                fetchFolderContents(previousFolder);
            }
        };
        return backButton;
    }


    // Function to copy text to clipboard and show notification
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('URL copied to clipboard!');
        }).catch(err => {
            showNotification('Failed to copy', 'red');
            console.error('Failed to copy: ', err);
        });
    }

    // Create modal once and reuse it
    let imageModal = createModal();
    accessToken = authenticate();

    function addImagePickerButton() {
        const ulElement = document.getElementById('header_nav_links')

        const liElement = document.createElement('li');
        liElement.className = 'NavLinksComponent__NavBarItems-sc-1456pt8-1 hBHGeq';

        const div = document.createElement('div');
        div.className = 'NavLinksComponent__NavListElement-sc-1456pt8-0 iIkGvM';
        div.style.marginTop = '10px'
        div.style.cursor = 'pointer'
        div.addEventListener('click', () => useToken(accessToken));

        const spanElement = document.createElement('span');
        spanElement.innerText = 'Image Picker';
        spanElement.style.fontSize = '0.8em'

        div.appendChild(spanElement);
        liElement.appendChild(div);
        ulElement.appendChild(liElement);


    }

    // Set an interval to repeatedly check for the element
    var checkExportButtonInterval = setInterval(function() {
        let target = document.getElementById('header_nav_links');
        if (target) {
            clearInterval(checkExportButtonInterval); // Clear the interval once the function is called
            addImagePickerButton();
        }
    }, 400);
})();
