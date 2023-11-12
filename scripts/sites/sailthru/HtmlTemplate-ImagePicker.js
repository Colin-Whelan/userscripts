// ==UserScript==
// @name        HTML Template - Image Picker
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/template/*
// @grant       none
// @version     1.1
// @author      Colin Whelan
// @description Adds the BEE editor image picker to the HTML builder. Click an image to copy the path. Click a folder to enter it, and back with the 'back' button.
// How it works:
// First we fetch the BEE plugin resource then we use that + the existing Sailthru cookie to authenticate with the Sailthru UI API. With that, we can fetch different folders of the BEE cloud storage.
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
            overflow-y: scroll;
        }
        #modalContent {
            display: flex;
            flex-wrap: wrap;
            justify-content: start;
            background-color: #fff;
            margin: 5% auto;
            padding: 60px 20px 20px 20px;
            border: 1px solid #888;
            width: 70%;
            position: relative;
            border-radius: 20px;
        }
        #closeButton {
            position: absolute;
            top: 20px;
            right: 25px;
            font-size: 36px;
            font-weight: bold;
            cursor: pointer;
        }
        .itemFrame {
            margin: 10px;
            padding: 10px;
            flex-basis: calc(15% - 20px);
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
            margin-top: 5px;
            word-wrap: anywhere;
        }
        #backButton {
            background-color: #4CAF50; /* Green background */
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
            top: 20px;
            left: 20px;
        }
        #copyNotification {
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
    `;

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = css;
    document.head.appendChild(styleSheet);

    function authenticate() {
        const tokenInfo = JSON.parse(localStorage.getItem('authTokenInfo'));

        // console.log('Authenticating');
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
                accessToken = data.access_token
                // useToken(accessToken);
            }
        });
    }

    function useToken(accessToken, hasAttemptedReauth = false) {
      folderHistory = [];
      // console.log('Trying to fetch images...', accessToken);
      if(!accessToken) authenticate();

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
      .catch(error => {
          console.error('Error:', error);
          // If the token failed to load, and no re-auth attempt has been made, try re-authenticating once
          if (!hasAttemptedReauth) {
              console.log('Re-authenticating...');
              useToken(null, true); // Pass null to force a re-authentication + pass true to indicate re-auth attempt has been made
          } else {
              // Handle the error or exit if re-authentication has already been attempted
              console.error('Re-authentication failed, not retrying.');
              showNotification('Failed to Authenticate. Reload.', 'red');
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

        let modalContent = document.createElement('div');
        modalContent.id = 'modalContent';

        let closeButton = createCloseButton(modal);
        modal.appendChild(modalContent);
        modalContent.appendChild(closeButton);

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

    // Function to update the modal with image data
    function updateModal(modal, images, currentPath) {
        if(!currentPath) currentPath = 'home'

        // console.log('Current Folder:', currentPath)

        // Add current path to folder history, but avoid duplicates
        if (folderHistory[folderHistory.length - 1] !== currentPath) {
            folderHistory.push(currentPath);
        }

        let modalContent = modal.querySelector('div');
        modalContent.innerHTML = ''; // Clear existing content

        // Add Back button if not in root
        if (folderHistory.length > 1) {
            let backButton = createBackButton();
            modalContent.appendChild(backButton);
        }

        modalContent.appendChild(createCloseButton(modal));

        // Add image data
        images.forEach(image => {
            let frameDiv = document.createElement('div');
            frameDiv.classList = ['itemFrame'];

            let itemDiv = document.createElement('div');

            if (image['mime-type'] === 'application/directory') {
                // Handle folders
                itemDiv.innerHTML = `<strong>Folder:</strong><br> ${image.name} (${image['item-count']})`;
                itemDiv.style.cursor = 'pointer';
                itemDiv.onclick = function() {
                    // Fetch contents of the clicked folder
                    fetchFolderContents(image.name);
                };
            } else {
                // Handle images
                let imgElement = document.createElement('img');
                imgElement.src = image.thumbnail;
                imgElement.alt = image.name;
                imgElement.className = 'image-thumbnail'; // Assign a class for styling

                frameDiv.style.cursor = 'pointer';
                frameDiv.onclick = function() {
                    copyToClipboard(image['public-url']);
                };

                let imgName = document.createElement('p');
                imgName.textContent = image.name;
                imgName.className = 'image-name'; // Assign a class for styling

                itemDiv.appendChild(imgElement);
                itemDiv.appendChild(imgName); // Append the image name element
            }

            frameDiv.appendChild(itemDiv);
            modalContent.appendChild(frameDiv);
        });

        modal.style.display = 'block'; // Show the modal
    }

    function showNotification(message, bgColor = 'green', delay = 3000) {
        const top = document.getElementById('modalContent');

        const div = document.createElement('div');
        div.innerText = message;
        div.id = 'copyNotification';
        div.style.backgroundColor = bgColor;

        top.appendChild(div);

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
    authenticate();

    function addImagePickerButton() {
        const button = document.createElement('button');
        button.id = 'customImagePicker'
        button.innerText = 'Open Image Picker';
        button.addEventListener('click', () => useToken(accessToken));
        document.getElementById('standard-controls').appendChild(button);
    }

    // Set an interval to repeatedly check for the element
    var checkExportButtonInterval = setInterval(function() {
        const target = document.getElementById('tab-details');
        if (target) {
            clearInterval(checkExportButtonInterval); // Clear the interval once the function is called
            addImagePickerButton();
        }
    }, 400);
})();
