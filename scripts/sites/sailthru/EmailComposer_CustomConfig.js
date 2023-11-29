// ==UserScript==
// @name        Email Composer - Custom Config
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/email-composer/*
// @grant       none
// @version     0.4
// @author      -
// @description Adds a custom config file for the BEE editor that overrides the defaults. Not all options are available. WIP
// ==/UserScript==

// Don't Edit!
let tokenCounter = 0
let tokensAvailable = 2000

function specialLinksHandler(resolve, reject) {
  if (reject) {
    console.log(reject);
  } else {
    console.log(resolve);
  }
}


// The configuration settings for the BEE editor. Edit as needed.
let myBeeConfig = {
  workspace: { // nothing happens
    type: 'mixed'
  },
  forceSanitizeHTML: false,
  loadingSpinnerTheme: 'dark', // Don't seem to do anything - https://docs.beefree.io/loading-spinner-theme/
  customCss: 'https://my-hosted-files.glitch.me/css/CustomBee.css', // Not working. https://docs.beefree.io/custom-css/
  autosave: 20, // Default
  language: 'en-US', // Default
  trackChanges: true, // Default
  preventClose: true, // Default
  contentDialog: {}, // Doesn't work. Editor might not be the latest version.
  defaultForm: { // For Page builder. No effect on emails.
    structure: {
      title: 'Form title',
      fields: {
        email: {type: 'email', label: 'Email'},
        password: {type: 'password', label: 'Password'},
        submit: {type: 'submit', label: ' ', attributes: {value: 'Login'}},
      },
      layout: [
        ['email', 'password', 'submit']
      ]
    }
  },
  hasDefaultForm: true,
  roleHash: "", // role management. Doesn't affect anything. https://docs.beefree.io/roles-and-permissions/
  editSingleRow: true,
  commenting: true, // Doesn't work. Not enabled on server.
  commentingThreadPreview: true, // Doesn't work. Not enabled on server.
  commentingNotifications: true, // Doesn't work. Not enabled on server.
  addOns: [
    {
          "id": "liveclicker_addon",
          "enabled": true // Can disable liveclicker_addon with this. Can't figure if it's possible to add others.
        }
  ],
  customAddOns: [
    {
      "uid": "liveclicker_addon",
      "name": "Liveclicker",
      "type": "html",
      "enabled": false,
    }
  ],
  disableLinkSanitize: true, // Doesn't work. Not enabled on server.
  disableBaseColors: true, // Disables default base colors
  disableColorHistory: false, // Disables Color History
  defaultColors: ['#ffffff', '#000000', '#95d24f', '#ff00dd', 'transparent'], // Dosesn't work. Doesn't override defaults
  sidebarPosition: 'left', // Changes Sidebar position
  editorFonts: { // Add addtional fonts.
    showDefaultFonts: false, // hide/show default fonts
    customFonts: [{
        name: "Comic Sans",
        fontFamily: "'Comic Sans MS', cursive, sans-serif"
      },
      {
        name: "Lobster",
        fontFamily: "'Lobster', Georgia, Times, serif",
        url: "https://fonts.googleapis.com/css?family=Lobster"
      },
      {
        name: "Oswald",
        fontFamily: "'Oswald', sans-serif",
        url: "https://fonts.googleapis.com/css2?family=Oswald:wght@200;300;400;500;600;700&display=swap",
        fontWeight: {
          200: 'Extra-light',
          300: 'Light',
          400: 'Regular',
          500: 'Medium',
          600: 'Semi-bold',
          700: 'Bold',
        }
      },
      // When showDefaultFonts = false, these standard fonts will still show
      {
          name: "Helvetica",
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      },
      {
          name: "Lucida",
          fontFamily: "'Lucida Grande', 'Lucida Sans', Geneva, Verdana, sans-serif"
      },
      {
          name: "Georgia",
          fontFamily: "Georgia, Times, 'Times New Roman', serif"
       },
       {
          name: "Lato",
          fontFamily: "'Lato', Tahoma, Verdana, sans-serif",
          url: "https://fonts.googleapis.com/css?family=Lato"
       },
       {
          name: "Montserrat",
          fontFamily: "'Montserrat', Trebuchet MS, Lucida Grande, Lucida Sans Unicode, sans-serif",
          url: "https://fonts.googleapis.com/css?family=Montserrat"
        }
      ]
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
    },
    {
      label: "Text ✏️",
      collapsable: false,
      collapsedOnLoad: false,
      modulesNames: [
        "Text",
        "List",
        "Paragraph",
        "Heading"
      ]
    },
    {
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
    },
    {
      label: "Layout",
      collapsable: true,
      collapsedOnLoad: true,
      modulesNames: [
        "Divider",
        "Spacer"
      ]
    },
    {
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
      },
      {
        key: "data-segment",
        value: ['travel', 'luxury'],
        target: "link"
      },
      {
        key: "class",
        value: ['dm_darkest', 'dm_darker', 'dm_dark'],
        target: "tag"
      }
    ]
  },
  metadata: { // Doesn't work. Not enabled on server.
    languages: [{
        value: 'en-us',
        label: 'English (US)'
      },
      {
        value: 'en-ca',
        label: 'English (Canada)'
      },
      {
        value: 'fr-ca',
        label: 'French (Canada)'
      }
    ]
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
  mergeTags: [ // Works now
    {
      name: 'First Name',
      value: '{first_name}'
    }, {
      name: 'Last Name',
      value: '{last_name}'
    }, {
      name: 'Email',
      value: '{email}'
    }
  ],
  mergeContents: [ // Works now
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
  specialLinks: [ // Works now
    {
      type: 'CustomConfigLinks',
      label: 'Unsubscribe link(TEST)',
      link: 'http://www.example.com/'
    }, {
      type: 'CustomConfigLinks',
      label: 'Preference center link(TEST)',
      link: 'http://www.example.com/2'
    }
  ],
  titleDefaultConfig: {
    bold: true
  },
  titleDefaultStyles: {
    h1: {
      color: 'red',
      'font-size': '34px',
      'font-family': 'Arial, sans-serif',
      'font-weight': '700',
      'link-color': 'blue',
      'line-height': '120%',
      'text-align': 'center',
      'direction': 'ltr',
      'letter-spacing': 0,
    },
    h2: {
      color: 'red',
      'font-size': '24px',
      'font-family': 'Arial, sans-serif',
      'font-weight': '700',
      'link-color': 'blue',
      'line-height': '120%',
      'text-align': 'center',
      'direction': 'ltr',
      'letter-spacing': 0,
    },
    h3: {
      color: 'black',
      'font-size': '14px',
      'font-family': 'Arial, sans-serif',
      'font-weight': '700',
      'link-color': 'blue',
      'line-height': '120%',
      'text-align': 'center',
      'direction': 'ltr',
      'letter-spacing': 0,
    },
  },
  contentDefaults: {
    title: {
      hideContentOnMobile: true,
      defaultHeadingLevel: 'h3',
      blockOptions: {
        paddingTop: '5px',
        paddingRight: '5px',
        paddingBottom: '5px',
        paddingLeft: '5px',
        align: "left", // block position, use the CSS above for text positioning
      }
    },
    button: {
      label: "My New Label",
      href: "http://www.google.com",
      width: "45%",
      styles: {
        color: "#ffffff",
        fontSize: '20px',
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
        hideContentOnMobile: false
      }
    },
    image: {
      alt: "My Alt Label",
      href: "http://www.google.com",
      src: "https://react.semantic-ui.com/images/wireframe/white-image.png",
      width: "250px", // optional - 100% default
      blockOptions: {
        paddingBottom: "0px",
        paddingLeft: "0px",
        paddingRight: "0px",
        paddingTop: "0px",
        align: "center",
        hideContentOnMobile: true
      }
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
        },
        {
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
        },
        {
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
        },
        {
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
        },
        {
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
        }
      ],
      blockOptions: {
        align: "center",
        hideContentOnMobile: true,
        paddingBottom: "10px",
        paddingLeft: "10px",
        paddingRight: "10px",
        paddingTop: "10px",
      }
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
    // Attempt to save to load the new configuration
    try {

      setTimeout(() => {
        beePluginInstance.loadConfig(myBeeConfig);
        console.log(myBeeConfig);

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
      setCustomConfig();
      clearInterval(interval);
    }
  }, CONFIG_LOAD_DELAY);
})();
