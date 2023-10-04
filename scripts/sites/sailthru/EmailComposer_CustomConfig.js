// ==UserScript==
// @name        Email Composer - Custom Config
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/email-composer/*
// @grant       none
// @version     1.0
// @author      -
// @description 2023-10-03, 11:34:38 p.m.
// ==/UserScript==

// Getting your Uid is a little tricky. The only way I know how is by:
// 1. Hitting F12 to open the developer tools
// 2. Going to the 'Network' tab (Reload the page if nothing shows up)
// 3. Click on the 'authinfo' File, from the 'bee-auth.getbee.io' Domain
// 4. Click on the 'Response' tab
// 5. Find the 'Uid' value from there, and paste here.
// This only needs to be done once
const myUid = 'YourUidHere'

// The configuration settings for the BEE editor. Edit as needed.
let myBeeConfig = {
  uid: myUid,
  container: 'bee_plugin_container',
  autosave: 20,
  language: 'en-US',
  trackChanges: true,
  preventClose: true,
  editorFonts: {},
  contentDialog: {},
  defaultForm: {},
  roleHash: "",
  rowDisplayConditions: {},
  editSingleRow: false,
  commenting: true,
  commentingThreadPreview: true,
  commentingNotifications: true,
  disableLinkSanitize: true,
  advancedPermissions: {
    content: {
      image: {
        properties: {
          imageWidth: {
            show: false,
          },
          textAlign: {
            show: true,
            locked: true
          },
        }
      },
    },
  },
  contentDefaults: {
    title: {
      hideContentOnMobile: true,
      defaultHeadingLevel: 'h3',
      blockOptions: {
        align: 'center',
        paddingTop: '5px',
        paddingRight: '5px',
        paddingBottom: '5px',
        paddingLeft: '5px',
      },
      mobileStyles: {
        textAlign: "center",
        fontSize: "30px",
        paddingTop: "20px",
        paddingRight: "20px",
        paddingBottom: "20px",
        paddingLeft: "20px",
      },
    },
    button: {
      label: "My New Label",
      href: "http://www.google.com",
      width: "35%",
      styles: {
        color: "#ffffff",
        fontSize: '22px',
        fontFamily: "'Comic Sans MS', cursive, sans-serif",
        backgroundColor: "#FF819C",
        borderBottom: "0px solid transparent",
        borderLeft: "0px solid transparent",
        borderRadius: "25px",
        borderRight: "0px solid transparent",
        borderTop: "0px solid transparent",
        lineHeight: "200%",
        maxWidth: "100%",
        paddingBottom: "5px",
        paddingLeft: "20px",
        paddingRight: "20px",
        paddingTop: "5px"
      },
      blockOptions: {
        paddingBottom: "20px",
        paddingLeft: "20px",
        paddingRight: "20px",
        paddingTop: "20px",
        align: "center",
        hideContentOnMobile: true
      },
      mobileStyles: {
        paddingBottom: "10px",
        paddingLeft: "10px",
        paddingRight: "10px",
        paddingTop: "10px",
        textAlign: "center",
        fontSize: "40px",
      },
    },
    social: {
      icons: [
        {
          type: 'custom',
          name: 'Facebook',
          image: {
            prefix: 'https://www.facebook.com/',
            alt: 'Facebook',
            src: `https://img.icons8.com/dusk/64/000000/facebook-new--v2.png`,
            title: 'Facebook',
            href: 'https://www.facebook.com/'
          },
          text: ''
        }
      ],
      blockOptions: {
        align: "center",
        hideContentOnMobile: true,
        paddingBottom: "10px",
        paddingLeft: "10px",
        paddingRight: "10px",
        paddingTop: "10px",
      },
      mobileStyles: {
        paddingTop: "10px",
        paddingRight: "10px",
        paddingBottom: "10px",
        paddingLeft: "10px",
        textAlign: "right",
      },
    }
  }
}

// Script config options - do not modify
const CONFIG_LOAD_DELAY = 1000;

(function() {
    'use strict';

    function displayErrorModal(message) {
        // Create nad style the modal's main container
        let modalDiv = document.createElement('div');
        modalDiv.style.position = 'fixed';
        modalDiv.style.top = '0';
        modalDiv.style.left = '0';
        modalDiv.style.width = '100%';
        modalDiv.style.height = '100%';
        modalDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
        modalDiv.style.display = 'flex';
        modalDiv.style.alignItems = 'center';
        modalDiv.style.justifyContent = 'center';
        modalDiv.style.zIndex = '10000';

        // Create nad style the content container inside the modal
        let contentDiv = document.createElement('div');
        contentDiv.style.backgroundColor = '#fff';
        contentDiv.style.padding = '20px';
        contentDiv.style.borderRadius = '10px';
        contentDiv.innerHTML = `<p>${message}</p>
                                 <button>Close</button>`;

        // Close the modal when the close button is clicked
        contentDiv.querySelector('button').onclick = () => modalDiv.remove();

        // Close the modal when clicking outside of the contentDiv
        modalDiv.onclick = (e) => {
            if (e.target === modalDiv) {
                modalDiv.remove();
            }
        };

        // Append the content to the modal and the modal to the body
        modalDiv.appendChild(contentDiv);
        document.body.appendChild(modalDiv);
    }

    /**
     * Load the custom configuration to the BEE editor.
     * If an error occurs during the load, an error modal will be displayed.
     */
    function setCustomConfig() {
        // Toggle the BEE editor's structure view
        beePluginInstance.toggleStructure();

        // Attempt to save the current editor state and load the new configuration
        try {
            beePluginInstance.save();

            setTimeout(() => {
                beePluginInstance.loadConfig(myBeeConfig);
                setTimeout(() => {
                    // Reload the editor to apply the new configuration
                    beePluginInstance.reload();
                }, CONFIG_LOAD_DELAY);
            }, CONFIG_LOAD_DELAY);

            console.log('New config loaded');
        } catch (error) {
            // Log the error and show an error modal to the user
            console.error('Error loading configuration:', error);
            displayErrorModal('Failed to load the custom configuration. Please try again or contact support.');
        }
    }

    // Regularly check if the BEE plugin instance is available
    // When available, load the custom configuration and clear the interval
    const interval = setInterval(() => {
        if (typeof beePluginInstance !== 'undefined' && document.querySelector('#bee_plugin_container')) {
            setCustomConfig(() => beePluginInstance.toggleStructure());
            clearInterval(interval);
        }
    }, CONFIG_LOAD_DELAY);
})();
