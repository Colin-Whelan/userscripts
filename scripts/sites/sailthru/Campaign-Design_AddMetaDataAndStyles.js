// ==UserScript==
// @name        Campaign Design - Add Meta Data + Styles
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/campaign*
// @grant       none
// @version     1.0
// @author      Colin Whelan
// @description Adds buttons to the Campaign Designer page so you can add custom page title, favicon, and styles quickly and easily.
// ==/UserScript==

// Change these to suit your needs
const defaultTitle = 'Your Page Title'
const defaultFavicon = '<link rel="shortcut icon" type="image/png" href="path/to/your/favicon.ico"/>'
const defaultStyle = `<style>
  /* More readable alt text */
  img {
    font-size: 18px;
    line-height: 26px;
    color: #888888
  }

  /* Only supported on apple. Makes underlines same color */
  a:has(img) {
    color: #888888
  }

  /* Smaller text for icons */
  .socialBar img {
    font-size: 12px;
    line-height: 18px;
    color: #888888
  }
</style>`

const fontSize = 16; // font size in px
const minLines = 16; // min size of the editor
const tabSize = 2; // spaces per tab
const dragDelay = 0; // in ms. how long before dragging text will work
const fontFamily = "Fira Code"; // need to have font installed locally. Love this font: https://github.com/tonsky/FiraCode/
const showPrintMargin = false;
const theme = 'monokai';

let defaultEditor = true

function improveEditor() {
  if (window.ace && defaultEditor) {
    defaultEditor = false;

    console.log('Campaign Design - Add Meta Data + Styles - Improving editor');
    const editor = ace.edit("editor");

    editor.session.setMode("ace/mode/html");

    // Set theme to Monokai
    editor.setTheme(`ace/theme/${theme}`);

    const setEditorOptions = () => {

      // Update other options
      editor.setOptions({
        showPrintMargin: showPrintMargin, // Default: true
        navigateWithinSoftTabs: true, // Default: null
        tabSize: tabSize, // Default: 4
        wrap: true, // Default: "free"
        wrapMethod: "code", // Default: null
        indentedSoftWrap: true, // Default: null
        animatedScroll: true, // Default: false
        dragDelay: dragDelay, // Default: 150
        enableMultiSelect: true,
        enableAutoIndent: true,
        selectionStyle: 'line',

        // Gutter
        // firstLineNumber: 1,
        // fixedWidthGutter: true,

        //Font
        fontFamily: fontFamily,
        fontSize: fontSize,

        // WIP/Not working
        scrollPastEnd: 1, // Default: 0 - May not work
        enableBasicAutocompletion: true,
        enableSnippets: true,
        enableCodeLens: true,
        enableEmmet: true,
        enableInlineAutocompletion: true,
        enableLiveAutocompletion: true
      });
    };

    // Initial set and update on window resize
    setEditorOptions();
    addUI(); // Add UI elements
  }
}

// Add UI elements for injecting elements into the head
function addUI() {
  // Check if the UI already exists
  let uiContainer = document.getElementById('uiContainer');
  if (uiContainer) {
    return; // If it exists, do nothing
  }

  const wizardSidebar = document.getElementsByClassName('wizard_sidebar')[0].childNodes[0];
  if (!wizardSidebar) {
    console.log('Wizard sidebar not found');
    return;
  }

    uiContainer = document.createElement('div');
    uiContainer.id = 'uiContainer';
    uiContainer.style.position = 'absolute'; // Set position to relative or absolute
    uiContainer.style.marginLeft = '10px'; //
    uiContainer.style.marginTop = '320px';
    uiContainer.style.width = '200px'; //
    uiContainer.style.zIndex = '1000'; // Set a high z-index value
    uiContainer.style.boxSizing = 'border-box'; // This ensures padding does not add to the width


 // Attempt to get saved values from localStorage, or use default if not available
  const userTitle = localStorage.getItem('userTitle') || defaultTitle;
  const userLink = localStorage.getItem('userLink') || defaultFavicon;
  const userStyle = localStorage.getItem('userStyle') || defaultStyle;

  const elements = [
    { type: 'title', content: userTitle },
    { type: 'link', content: userLink },
    { type: 'style', content: userStyle }
  ];

    elements.forEach(element => {
      const textarea = document.createElement('textarea');
      textarea.id = `inject-${element.type}`;
      textarea.style.width = '190px';
      textarea.style.height = '100px';
      textarea.style.marginTop = '5px';
      textarea.style.marginBottom = '10px';
      textarea.style.border = `1px solid #ccc`;
      textarea.style.borderRadius = '4px';
      textarea.style.padding = '5px';
      textarea.style.zIndex = '1000'; // Set a high z-index value
      textarea.value = element.content;

      const button = document.createElement('button');
      button.textContent = `Inject ${element.type}`;
      button.style.marginBottom = '5px';
      button.style.width = '200px';
      button.style.backgroundColor = '#00a2be';
      button.style.color = 'white';
      button.style.border = 'none';
      button.style.borderRadius = '4px';
      button.style.padding = '10px 0';
      button.style.cursor = 'pointer';
      button.onclick = () => {
        const editor = ace.edit("editor");
        const newValue = textarea.value;
        // Save the new value to localStorage
        localStorage.setItem(`user${element.type.charAt(0).toUpperCase() + element.type.slice(1)}`, newValue);
        console.log('localStorage', `user${element.type.charAt(0).toUpperCase() + element.type.slice(1)}`, newValue)
        addElementsToHead(editor, [{ type: element.type, content: newValue }]);
      };

      uiContainer.appendChild(textarea);
      uiContainer.appendChild(button);
    });

    // Create 'Inject All' button
    const injectAllButton = document.createElement('button');
    injectAllButton.textContent = 'Inject All';
    injectAllButton.style.width = '100%';
    injectAllButton.style.backgroundColor = '#00a2be';
    injectAllButton.style.fontSize = '16px';
    injectAllButton.style.color = 'white';
    injectAllButton.style.width = '200px';
    injectAllButton.style.border = 'none';
    injectAllButton.style.marginTop = '5px';
    injectAllButton.style.borderRadius = '4px';
    injectAllButton.style.padding = '10px 0';
    injectAllButton.style.cursor = 'pointer';
    injectAllButton.onclick = () => {
      const editor = ace.edit("editor");
      const elementsToInject = elements.map(element => ({
        type: element.type,
        content: document.getElementById(`inject-${element.type}`).value
      }));
      addElementsToHead(editor, elementsToInject);
    };

    uiContainer.appendChild(injectAllButton);

    wizardSidebar.appendChild(uiContainer);
}

function addElementsToHead(editor, elements) {
  let content = editor.getValue();

  elements.forEach(element => {
    if (element.type === 'style') {

      const styleMarker = `<!-- Custom Style Marker -->`;
      if (content.includes(styleMarker)) {
        // Find the position of the style marker and the closing tag of the style block
        const markerIndex = content.indexOf(styleMarker);
        const closingStyleTagIndex = content.indexOf('</style>', markerIndex) + '</style>'.length;

        // Replace the content between the marker and the closing tag with the new style content
        content = content.slice(0, markerIndex + styleMarker.length) +
                  `\n${element.content}` +
                  content.slice(closingStyleTagIndex);
      } else {
        // Append style content if it doesn't exist
        const closingHeadIndex = content.indexOf('</head>');
        content = content.slice(0, closingHeadIndex) +
                  `\n${styleMarker}\n${element.content}` +
                  content.slice(closingHeadIndex);
      }
    } else if (element.type === 'link') {
      // Check if a favicon link already exists
      const faviconRegex = /<link rel="shortcut icon"[^>]*>/;
      if (faviconRegex.test(content)) {
        // Replace existing favicon
        content = content.replace(faviconRegex, element.content);
      } else {
        // Add favicon if it doesn't exist
        content = content.replace(/<head>/, `<head>\n${element.content}`);
      }
    } else if (element.type === 'title') {
      // Check if a title tag already exists
      const titleRegex = /<title>[^<]*<\/title>/;
      if (titleRegex.test(content)) {
        // Replace existing title
        content = content.replace(titleRegex, `<title>${element.content}</title>`);
      } else {
        // Add title if it doesn't exist
        content = content.replace(/<head>/, `<head>\n<title>${element.content}</title>`);
      }
    }
  });

  editor.setValue(content);
  editor.scrollToRow(0); // Scroll to the top of the document
  addUI();
}

function checkUrlAndToggleUI() {
  console.log('checkUrlAndToggleUI')
  const uiContainer = document.getElementById('uiContainer');
  if (!uiContainer && location.href.includes('/design')) {
    addUI(); // Create UI if it doesn't exist
  }

  if (window.location.href.includes('/design')) {
    uiContainer.style.display = 'block'; // Show UI if URL contains '/design'
  } else {
    // uiContainer.style.display = 'none'; // Hide UI otherwise
  }
}

function initObserver() {
  const editorDiv = document.getElementById('editor-pane');
  if (editorDiv) {
    const editorObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          const displayStyle = window.getComputedStyle(editorDiv).display;
          if (displayStyle === 'block') {
            improveEditor();
          }
        }
      });
    });

    const observerConfig = {
      attributes: true,
      childList: false,
      subtree: false
    };

    editorObserver.observe(editorDiv, observerConfig);
    waitForEditorPane();
  } else {
    console.log('Campaign Design - Add Meta Data + Styles - Editor pane not found');
  }
}

function waitForEditorPane() {
  const bodyObserver = new MutationObserver((mutations, observer) => {
    const editorDiv = document.getElementById('editor-pane');
    if (editorDiv) {
      initObserver();
      observer.disconnect(); // Stop observing once the editor pane is found
    }
  });

  bodyObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

waitForEditorPane();

// Watch for URL changes
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    console.log(url, lastUrl)
    lastUrl = url;
    checkUrlAndToggleUI();
  }

  if (!document.getElementById('uiContainer') && location.href.includes('/design')) {
    addUI(); // Create UI if it doesn't exist
  }
}).observe(document, { subtree: true, childList: true });

// Initial check
checkUrlAndToggleUI();
