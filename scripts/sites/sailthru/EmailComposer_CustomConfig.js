// ==UserScript==
// @name        Email Composer - Custom Config
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/email-composer/*
// @grant       none
// @version     0.3
// @author      -
// @description Adds a custom config file for the BEE editor that overrides the defaults. Not all options are available. WIP
// ==/UserScript==

// Getting your Uid is a little tricky. The only way I know how is by:
// 1. Hitting F12 to open the developer tools
// 2. Going to the 'Network' tab (Reload the page if nothing shows up)
// 3. Click on the 'authinfo' File, from the 'bee-auth.getbee.io' Domain
// 4. Click on the 'Response' tab
// 5. Find the 'Uid' value from there, and paste here.
// This only needs to be done once per client. Should be consistent between spaces of a client.
const myUid = 'YourUidHere'

// Don't Edit!
let tokenCounter = 0
let tokensAvailable = 2000

// The configuration settings for the BEE editor. Edit as needed.
let myBeeConfig = {
  uid: myUid,
  container: 'bee_plugin_container',
  workspace: { // nothing happens
    type: 'mixed'
  },
  forceSanitizeHTML: false,
  autosave: 2, // Default
  language: 'en-US', // Default
  trackChanges: true, // Default
  preventClose: true, // Default
  editorFonts: {},
  contentDialog: {},
  defaultForm: {},
  roleHash: "",
  rowDisplayConditions: {},
  editSingleRow: true,
  commenting: true, // Doesn't work. Not enabled on server.
  commentingThreadPreview: true, // Doesn't work. Not enabled on server.
  commentingNotifications: true, // Doesn't work. Not enabled on server.
  addOns: [{
    id: "ai-integration", // Doesn't work. Not enabled on server.
    settings: {
      tokensAvailable: tokensAvailable,
      tokensUsed: tokenCounter,
      tokenLabel: 'tokens',
      isPromptDisabled: false,
      isSuggestionsDisabled: false,
    }
  }, ],
  disableLinkSanitize: true, // Doesn't work. Not enabled on server.
  disableBaseColors: true, // Disables default base colors
  disableColorHistory: false, // Disables Color History
  defaultColors: ['#ffffff', '#000000', '#95d24f', '#ff00dd', 'transparent'], // Dosesn't work. Doesn't override defaults
  sidebarPosition: 'left', // Changes Sidebar position
  editorFonts: { // Add addtional fonts. Not sure if fallbacks can be added here.
    showDefaultFonts: true,
    customFonts: [{
      name: "Comic Sans2",
      fontFamily: "'Comic Sans MS', cursive, sans-serif"
    }, {
      name: "Lobster2",
      fontFamily: "'Lobster', Georgia, Times, serif",
      url: "https://fonts.googleapis.com/css?family=Lobster"
    }]
  },
  modulesGroups: [ // Organize the modules into groups. Choose if they are collapsable and if they are collapsed on load.
    {
      label: "Main Content",
      collapsable: false,
      collapsedOnLoad: false,
      modulesNames: [
        "Button",
        "Html",
        "Menu"
      ]
    }, {
      label: "Text ✏️",
      collapsable: false,
      collapsedOnLoad: false,
      modulesNames: [
        "Text",
        "List",
        "Paragraph",
        "Heading"
      ]
    }, {
      label: "Media",
      collapsable: true,
      collapsedOnLoad: false,
      modulesNames: [
        "Video",
        "Image",
        "Gifs",
        "Icons",
        "Social"
      ]
    }, {
      label: "Layout",
      collapsable: true,
      collapsedOnLoad: true,
      modulesNames: [
        "Divider",
        "Spacer"
      ]
    }, {
      label: "AddOns",
      collapsable: true,
      collapsedOnLoad: true,
      modulesNames: [
        "Sticker", // Not working. Likely not enabled.
        "Liveclicker",
        "DynamicContent", // Don't know how this works yet. Not sure how it was enabled either.
        "Carousel", // Not working. Likely not enabled.
        "Form", // Not working. Likely not enabled.
        "QRCode" // Not working. Likely not enabled.
      ]
    }
  ],
  customAttributes: { // Add custom attributes. Shows Buttons and Images. Not working for Links. Won't work for every other element.
    enableOpenFields: true,
    attributes: [{
      key: "thisIsABoolean",
      value: true,
      target: "link"
    }, {
      key: "data-segment",
      value: ['travel', 'luxury'],
      target: "link"
    }, {
      key: "class",
      value: ['dm_darkest', 'dm_darker', 'dm_dark'],
      target: "tag"
    }]
  },
  metadata: { // Doesn't work. Not enabled on server.
    languages: [{
      value: 'en-us',
      label: 'English (US)'
    }, {
      value: 'en-ca',
      label: 'English (Canada)'
    }, {
      value: 'fr-ca',
      label: 'French (Canada)'
    }]
  },
  rowDisplayConditions: [{ // Create helper Display Conditions
    type: 'Last ordered catalog',
    label: 'Women',
    description: 'Only people whose last ordered item is part of the Women catalog will see this',
    before: '{% if lastOrder.catalog == \'Women\' %}',
    after: '{% endif %}',
  }, {
    type: 'Last ordered catalog',
    label: 'Men',
    description: 'Only people whose last ordered item is part of the Men catalog will see this',
    before: '{% if lastOrder.catalog == \'Men\' %}',
    after: '{% endif %}',
  }, {
    type: 'Last ordered catalog',
    label: 'Children',
    description: 'Only people whose last ordered item is part of the Children catalog will see this',
    before: '{% if lastOrder.catalog == \'Children\' %}',
    after: '{% endif %}',
  }],
  advancedPermissions: { // Configure which parts of the modules are editable. If implemented well, this could be decent guardrails. Devs configure guardrails while designers build emails.
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
  mergeTags: [ // Doesn't work.
    {
      name: 'First Name',
      value: '{first-name}'
    }, {
      name: 'Last Name',
      value: '{last-name}'
    }, {
      name: 'Email',
      value: '{email}'
    }, {
      name: 'Latest order date',
      value: '{order-date}'
    }
  ],
  mergeContents: [ // Doesn't work.
    {
      name: 'Headline news',
      value: '{headlines}'
    }, {
      name: 'Lastest blog articles',
      value: '{latest-articles}'
    }, {
      name: 'Latest products viewed',
      value: '{latest-products}'
    }
  ],
  specialLinks: [ // Doesn't work.
    {
      type: 'Frequently used',
      label: 'Unsubscribe link(TEST)',
      link: 'http://[unsubscribe](TEST)/'
    }, {
      type: 'Frequently used',
      label: 'Preference center link(TEST)',
      link: 'http://[preference_center](TEST)/'
    }
  ],
  contentDefaults: { // Not all options are working. eg. 'align' value not bein set correctly
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
    social: { // Works really well. there are defaults if the fields are removed/null.
      icons: [{
        type: 'custom',
        name: 'Facebook',
        image: {
          prefix: 'https://www.facebook.com/',
          alt: 'Facebook',
          src: `https://img.icons8.com/dusk/64/000000/facebook-new--v2.png`,
          title: '',
          href: 'https://www.facebook.com/'
        },
        text: ''
      }, {
        type: 'custom',
        name: 'Instagram',
        image: {
          prefix: 'https://www.instagram.com/',
          alt: 'Instagram',
          src: 'https://img.icons8.com/dusk/64/000000/instagram-new.png',
          title: '',
          href: 'https://www.instagram.com/indigo/'
        },
        text: ''
      }, {
        type: 'custom',
        name: 'Twitter',
        image: {
          prefix: 'https://twitter.com/',
          alt: 'Twitter',
          src: 'https://img.icons8.com/dusk/64/000000/x.png',
          title: '',
          href: 'https://twitter.com/chaptersindigo/'
        },
        text: ''
      }, {
        type: 'custom',
        name: 'Pinterest',
        image: {
          prefix: 'https://www.pinterest.ca/',
          alt: 'Pinterest',
          src: 'https://img.icons8.com/dusk/64/000000/pinterest.png',
          title: '',
          href: 'https://www.pinterest.ca/chaptersindigo/'
        },
        text: ''
      }, {
        type: 'custom',
        name: 'YouTube',
        image: {
          prefix: 'https://www.youtube.com/user/',
          alt: 'YouTube',
          src: 'https://img.icons8.com/dusk/64/000000/youtube.png',
          title: '',
          href: 'https://www.youtube.com/user/indigochapters'
        },
        text: ''
      }],
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
        console.log(myBeeConfig);

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
