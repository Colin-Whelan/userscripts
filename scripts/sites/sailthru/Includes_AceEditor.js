// ==UserScript==
// @name        Includes - Better Editor
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/includes*
// @grant       GM_addStyle
// @version     1.3
// @author      Colin Whelan
// @description Improve the editor experience for includes. only drawback is that each load counts as a change, so will be warned on each load while switching
// ==/UserScript==

// Default Options
const fontSize = 16 // font size in px
const minLines = 16 // min size of the editor
const tabSize = 2 // spaces per tab
const dragDelay = 0 // in ms. how long before dragging text will work
const fontFamily = "Fira Code" // need to have font installed locally. Love this font: https://github.com/tonsky/FiraCode/
const showPrintMargin = false

const lineHeight = fontSize * 1.3; // Height of each line in px

let editor; // Ace Editor instance
let iframe;

function loadAceEditor(callback) {
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/ace/1.4.13/ace.js';
  script.onload = callback;
  document.head.appendChild(script);
}

// Function to execute once the div is available
function rearrangeEditorElements() {
  // Hide the tabs navigation
  let tabNav = document.querySelector('.ui-tabs-nav');
  tabNav.style.display = 'none';
  document.querySelector('#tabs').style.paddingTop = '0px';

  // Show the preview tab permanently and reverse aria attributes
  let previewTab = document.querySelector('#tab-preview');
  previewTab.style.display = 'block';
  previewTab.style.marginRight = '3%';
  previewTab.style.float = 'right'; // Float to the right side
  previewTab.style.width = '35%'; // Use 50% width
  previewTab.setAttribute('aria-expanded', 'true');
  previewTab.setAttribute('aria-hidden', 'false');
  previewTab.style.height = '100%'
  previewTab.children[0].style.height = '100%'

  // Adjust tab content area
  let tabContent = document.querySelector('#tab-content');
  tabContent.style.float = 'left'; // Float to the left side
  tabContent.style.width = '60%'; // Use 45% width
  tabContent.style.padding = '5px';

  iframe = document.querySelector('iframe[name="preview"]');
  iframe.style.width = '640px'

  addCustomStyles(`
        form label, .form label {
            width: 90px;
        }
        .ui-widget input, .ui-widget select, .ui-widget textarea, .ui-widget button {
            width: 88%;
        }
        .ui-tabs .ui-tabs-panel {
            padding: 5px;
        }
        .CodeMirror {
            width: 90%;
        }

        .row.f_content_html.textarea.required {
        width: 98%;
        }

     `);

  // Adjust HTML Content and Text Content height
  htmlContent = document.querySelector('#f_content_html');
  let textContent = document.querySelector('#f_content_text');

  // Compute available space and rows
  const lineHeight = 14.4;
  let totalAvailableHeight = (window.innerHeight - tabContent.offsetTop - 110) * 0.6;

  iframe.style.height = `${totalAvailableHeight + 110}px`

  // Listen for changes in the textarea and update the iframe
  // htmlContent.addEventListener('input', updateIframeContent);
  initAceEditor();
  // Update iframe content on first load
  updateIframeContent()

  // let htmlContentHeight = 0.75 * totalAvailableHeight;
  let textContentHeight = 0.25 * totalAvailableHeight;

  // let htmlContentRows = Math.floor(htmlContentHeight / lineHeight);
  let textContentRows = Math.floor(textContentHeight / lineHeight);

  // htmlContent.setAttribute('rows', htmlContentRows);
  textContent.setAttribute('rows', textContentRows);

}

function addCustomStyles(cssString) {
  GM_addStyle(cssString);
}

function updateIframeContent() {
  if (iframe.contentWindow) {
    iframe.setAttribute("srcdoc", editor.getValue());
  }
}

function initAceEditor() {
  const htmlContent = document.querySelector('#f_content_html');
  // htmlContent.style.display = 'none'; // Hide the original textarea
  const parentContainer = htmlContent.parentElement;

  // Create a new div for Ace Editor and set its size
  const editorDiv = document.createElement('div');
  editorDiv.style.width = '100%';
  editorDiv.style.height = '600px'; // Adjust as per your requirements
  htmlContent.parentNode.appendChild(editorDiv);

  editor = ace.edit(editorDiv);
  editor.setTheme("ace/theme/monokai");
  editor.getSession().setMode("ace/mode/html");
  // editor.renderer.setShowGutter(true); // show line numbers


  const loadSelect = document.getElementById('load');

  if (loadSelect) {
    loadSelect.addEventListener('change', function() {
      const initialValue = htmlContent.value;

      setInterval(function() {
        // When the select value changes and after a delay, update the editor's value with the textarea's content
        const htmlContentValue = htmlContent.value;
        if (editor && htmlContentValue) {
          editor.setValue(htmlContentValue);
        }
      }, 100);
    });
  }

  // Update the textarea's value whenever the editor's content changes
  editor.getSession().on('change', function() {
    htmlContent.value = editor.getValue();
    updateIframeContent();

    // Activate the 'save' button
    const saveButton = document.getElementById('save');
    if (saveButton) {
      saveButton.removeAttribute('disabled');
      saveButton.textContent = 'Save';
    }


  });


  const windowHeight = window.innerHeight;
  const editorPosition = parentContainer.getBoundingClientRect();
  const availableHeight = (windowHeight - editorPosition.top - 20) * 0.55; // 20px padding
  let lines = Math.floor(availableHeight / lineHeight);

  if (!lines || lines < minLines) {
    lines = minLines
  }

  // Update other options
  editor.setOptions({
    maxLines: lines, // Default: 16
    minLines: lines, // Default: 16
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
    firstLineNumber: 1,
    fixedWidthGutter: true,

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


  editor.setValue(htmlContent.value);
  editorDiv.parentNode.appendChild(htmlContent);


  console.log(editor)
}

// Set up the mutation observer for the tab-content div
const observer = new MutationObserver(function(mutations, me) {
  let element = document.querySelector('#tab-content');
  if (element && !editor) {
    observer.disconnect()
    // stop listening to prevent duplicate events
    loadAceEditor(() => {
      rearrangeEditorElements();
    });
  }
});

// Start observing the document with the configured parameters
observer.observe(document, {
  childList: true,
  subtree: true
});
