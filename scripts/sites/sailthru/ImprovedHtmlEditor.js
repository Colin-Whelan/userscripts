// ==UserScript==
// @name        HTML Editor - Better Ace IDE
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/template/*
// @grant       none
// @run-at      document-end
// @version     1.9
// @author      Colin Whelan
// @require    https://cdn.jsdelivr.net/npm/js-beautify@1.14.0/js/lib/beautify-html.js
// @description Improved HTML Editor (Ace Editor) by updating the config settings. Update as needed to suit your preferences. Also adds a helper menu for commands with 'Ctrl+Shift+space'
// Adds the following:
// - custom IDE themes
// - The better 'find' window by default. Supports regex
// - Autosize editor
// - Default options
// - Keybind/Command Helper
// - Optional Autosave - After a change is detected it waits for 'autoSaveDelay' and if there were no more changes, it saves. More changes reset the delay.
// - Prettify code - not perfect, but works better than expected. Uses 'smarty' format: https://smarty-php.github.io/smarty/4.x/designers/language-basic-syntax/
// - Fix bug in FF with scrolling. Adds custom 'Shift+scroll' behavior for better scrolling experience.
// - Added theme previewer/switcher
// - Added revision navigation - keeps the cursor locked to the same line
// ==/UserScript==

// Default Options
const fontSize = 16 // font size in px
const minLines = 16 // min size of the editor
const tabSize = 2 // spaces per tab
const dragDelay = 0 // in ms. how long before dragging text will work
const fontFamily = "Fira Code" // need to have font installed locally. Love this font: https://github.com/tonsky/FiraCode/
const showPrintMargin = false

const addThemePreviewer = true // if true, shows a dropdown of all available themes for quick previewing
const theme = 'monokai'
// Other themes:
// 'ambiance', 'chaos', 'clouds', 'clouds_midnight', 'cobalt', 'dawn', 'dreamweaver', 'eclipse', 'github', 'idle_fingers', 'merbivore', 'merbivore_soft', 'mono_industrial',
// 'monokai', 'pastel_on_dark', 'solarized_dark', 'solarized_light', 'textmate', 'tomorrow', 'tomorrow_night', 'tomorrow_night_blue', 'tomorrow_night_bright',
// 'tomorrow_night_eighties', 'twilight', 'vibrant_ink', 'xcode'

const addCustomScroll = true // in Firefox, scrolling jumps way too far. with this enabled, holding Shift while scrolling will scroll more normally
const scrollLines = 14 // # of lines to scroll at a time (approx)

const autoSaveEnabled = true // Whether the autosave is called when the editor changes
const autoSaveDelay = 5000 // in ms

// how far the keybind modal needs to be dragged to be prevent commands from executing.
// allows dragging without executing, and any small jitter while clicking will still count as a clicks
const dragThreshold = 10

// Script options - DO NOT EDIT
const lerpFactor = 0.25; // smoothscrolling sensitivity

let targetScrollTop = null;
let currentScrollTop = null;
let isAnimatingScroll = false;

const themes = [
  'ambiance', 'chaos', 'clouds', 'clouds_midnight', 'cobalt', 'dawn', 'dreamweaver', 'eclipse', 'github', 'idle_fingers',
  'merbivore', 'merbivore_soft', 'mono_industrial', 'monokai', 'pastel_on_dark', 'solarized_dark', 'solarized_light',
  'textmate', 'tomorrow', 'tomorrow_night', 'tomorrow_night_blue', 'tomorrow_night_bright', 'tomorrow_night_eighties',
  'twilight', 'vibrant_ink', 'xcode'
];

const themePreviewButtonStyles = {
  padding: "5px 10px",
  border: "1px solid #aaa",
  borderRadius: "5px",
  backgroundColor: "#f9f9f9",
  marginLeft: "10px",
  boxShadow: "inset 0 1px 3px rgba(0, 0, 0, 0.1)",
  color: "#333",
  fontSize: "14px",
  fontWeight: "bold"
}

function addThemeDropdown(editor) {
  const controls = document.getElementById("standard-controls");
  const prettifyButton = document.getElementById("beautifyCode");

  console.log(controls)

  if (!controls || !prettifyButton) return;

  const themeDropdown = document.createElement("select");
  themeDropdown.id = "themeSelector";

  // Populate the dropdown with themes
  themes.forEach(themeName => {
    const option = document.createElement("option");
    option.value = themeName;
    option.text = themeName.charAt(0).toUpperCase() + themeName.slice(1); // Capitalize theme name for display

    // Set the selected theme based on the `theme` value
    if (themeName === theme) {
      option.selected = true;
    }

    themeDropdown.appendChild(option);
  });

  // Add the event listener
  themeDropdown.addEventListener("change", function() {
    const selectedTheme = this.value;
    editor.setTheme(`ace/theme/${selectedTheme}`);
  });

  // Apply styles to the dropdown
  applyStyles(themeDropdown, themePreviewButtonStyles);

  // Insert the dropdown after the beautify button
  prettifyButton.insertAdjacentElement('afterend', themeDropdown);
}
function addThemeDropdown(editor) {
    const controls = document.getElementById("standard-controls");

    if (!controls) return;

    const themeDropdown = document.createElement("select");
    themeDropdown.id = "themeSelector";

    // Populate the dropdown with themes
    themes.forEach(themeName => {
        const option = document.createElement("option");
        option.value = themeName;
        option.text = themeName.charAt(0).toUpperCase() + themeName.slice(1); // Capitalize theme name for display

        // Set the selected theme based on the `theme` value
        if (themeName === theme) {
            option.selected = true;
        }

        themeDropdown.appendChild(option);
    });

    // Add the event listener
    themeDropdown.addEventListener("change", function() {
        const selectedTheme = this.value.toLowerCase();
        editor.setTheme(`ace/theme/${selectedTheme}`);
    });

    // Apply styles to the dropdown
    applyStyles(themeDropdown, themePreviewButtonStyles);

    // Append the dropdown to the controls
    controls.appendChild(themeDropdown);
}

function improveEditor() {
  if (window.ace) {
    const editor = ace.edit("ace-editor");

    editor.session.setMode("ace/mode/html");

    // Set theme to Monokai
    editor.setTheme(`ace/theme/${theme}`);

    const editorDiv = document.getElementById("ace-editor");

    if (editorDiv) {
      const lineHeight = fontSize * 1.3; // Height of each line in px

      const setEditorOptions = () => {
        const windowHeight = window.innerHeight;
        const editorPosition = editorDiv.getBoundingClientRect();
        const availableHeight = windowHeight - editorPosition.top - 20; // 20px padding
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
      };

      // Initial set and update on window resize
      setEditorOptions();
      window.addEventListener("resize", setEditorOptions);
      executeInPageContext(enableCommands(editor));
      document.getElementById('editor').addEventListener('keydown', function(event) {
        if (event.ctrlKey && event.shiftKey && event.keyCode === 32) { // 32 is the keyCode for Spacebar
          showHelper(editor);
        }
      });

      addPrettifyButton(editor);

      if (autoSaveEnabled) autoSave(editor, autoSaveDelay)
      if (addCustomScroll) addCustomScrolling(editor)
      if (addThemePreviewer) addThemeDropdown(editor)
      addRevisionButtons(editor);

    }
  }
}

function applyStyles(element, styles) {
  for (let property in styles) {
    if (styles.hasOwnProperty(property)) {
      element.style[property] = styles[property];
    }
  }
}

const modalStyles = {
  position: 'fixed',
  top: '20%',
  left: '50%',
  transform: 'none',
  backgroundColor: '#FFF',
  border: '1px solid #AAA',
  padding: '10px',
  zIndex: '9999',
  display: 'none',
  maxHeight: '70vh',
  overflowY: 'auto',
  borderRadius: '5px',
  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
  userSelect: 'none'
}

const closeButtonStyles = {
  backgroundColor: '#e4e4e4',
  border: 'none',
  borderRadius: '5px',
  padding: '5px 10px',
  cursor: 'pointer',
  marginRight: '10px'
}

const helperTextStyles = {
  color: '#888',
  fontSize: '0.9em'
}

const commandDivStyles = {
  padding: '8px 12px',
  margin: '4px 0',
  backgroundColor: '#f9f9f9',
  borderRadius: '3px',
  cursor: 'pointer',
  transition: 'background-color 0.3s'
}

const commandNameStyles = {
  fontWeight: 'bold',
  color: '#333',
  textDecoration: 'underline'
};

function createModal() {
  const modal = document.createElement('div');
  modal.id = 'aceEditorHelperModal';
  applyStyles(modal, modalStyles);

  makeModalDraggable(modal);

  const closeButton = document.createElement('button');
  closeButton.innerHTML = 'Close';
  closeButton.onclick = () => modal.style.display = 'none';
  applyStyles(closeButton, closeButtonStyles);

  closeButton.addEventListener('mouseover', () => {
    closeButton.style.backgroundColor = '#d4d4d4';
  });

  closeButton.addEventListener('mouseout', () => {
    closeButton.style.backgroundColor = '#e4e4e4';
  });

  const helperText = document.createElement('span');
  helperText.innerText = 'Click on a command to execute it.';
  applyStyles(helperText, helperTextStyles);

  modal.appendChild(closeButton);
  modal.appendChild(helperText);
  document.body.appendChild(modal);
  return modal;
}

function showHelper(editor) {
  let modal = document.getElementById('aceEditorHelperModal');

  if (!modal) { // If the modal doesn't exist, create it
    modal = createModal();
    populateModalWithCommands(editor, modal);
  }

  if (modal.style.display !== 'block') {
    modal.style.display = 'block';
  }
}

function executeInPageContext(fn) {
  if (fn) {
    const script = document.createElement('script');
    script.textContent = '(' + fn.toString() + ')();';
    (document.head || document.documentElement).appendChild(script);
    script.parentNode.removeChild(script);
  }
}

function enableCommands(editor) {
  var defaultCommands = ace.require("ace/commands/default_commands").commands;

  var commandNames = [
    "find", // Uses the better Ace editor 'find' menu by default
  ];

  // most are defined already
  // var commandNames = [
  //      "find", "togglecomment", "showSettingsMenu",
  //      "gotoline", "findnext", "findprevious", "indent",
  //      "outdent", "fold", "unfold", "foldall",
  //      "unfoldall", "toggleBlockComment", "transposeletters",
  //      "jumptomatching", "autoindent"
  //  ];

  commandNames.forEach(function(name) {
    var cmd = defaultCommands.filter(function(c) {
      return c.name == name;
    })[0];
    if (cmd) {
      editor.commands.addCommand(cmd);
    }
  });
}

function makeModalDraggable(modal) {
  let offsetX, offsetY, isDragging = false;

  function onMouseMove(e) {
    if (!isDragging) return;
    modal.style.left = (e.clientX - offsetX) + 'px';
    modal.style.top = (e.clientY - offsetY) + 'px';
  }

  function onMouseUp() {
    isDragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  modal.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const rect = modal.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    isDragging = true;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}

function populateModalWithCommands(editor, modal) {
  const commands = editor.commands.commands;
  const commandsToDisable = ['showSettingsMenu', 'selecttomatching', 'jumptomatching']
  let startX, startY, dragged = false;

  for (let commandName in commands) {
    if (commands.hasOwnProperty(commandName)) {
      const command = commands[commandName];
      if (commandsToDisable.includes(commandName)) continue // filter out the listed commandsToDisable

      // Create a div for each command
      const div = document.createElement('div');

      // Style the div
      applyStyles(div, commandDivStyles);

      // Add hover effect
      div.addEventListener('mouseover', () => {
        div.style.backgroundColor = '#e6e6e6';
      });
      div.addEventListener('mouseout', () => {
        div.style.backgroundColor = '#f9f9f9';
      });

      if (!command.bindKey) continue; // If bindKey is not defined, skip this iteration

      // Add command details to the div
      const commandNameSpan = document.createElement('span');
      commandNameSpan.textContent = commandName;

      // Style the command name
      applyStyles(commandNameSpan, commandNameStyles);

      div.appendChild(commandNameSpan); // Append the styled command name to the div

      div.innerHTML += ` - Win: ${command.bindKey.win} :: Mac: ${command.bindKey.mac}`;

      // Track when the mouse is pressed
      div.addEventListener('mousedown', (e) => {
        startX = e.clientX;
        startY = e.clientY;

      });

      div.addEventListener('mouseup', (e) => {
        const hasMovedMoreThanDragThreshold = Math.abs(e.clientX - startX) > dragThreshold || Math.abs(e.clientY - startY) > dragThreshold;

        if (!hasMovedMoreThanDragThreshold) {
          try {
            editor.execCommand(commandName);
            console.log(`Executed command: ${commandName}`);
          } catch (error) {
            console.error(`Error executing command: ${commandName}`, error);
          }
        }
      });

      modal.appendChild(div);
    }
  }
}

let saveTimeout
let isSaving = false; // Flag to identify save-triggered changes

function autoSave(updatedEditor, autoSaveDelay = 5000) {

  updatedEditor.session.on('change', function() {
    // console.log("Change detected. State: ", isSaving);

    // If the change was triggered by a save, ignore it
    if (isSaving) {
      // console.log("Change was triggered by a save. Ignoring this change.");
      return;
    }

    // Clear any existing timeout
    if (saveTimeout) {
      // console.log("Clearing existing save timeout");
      clearTimeout(saveTimeout);
    }

    // Start a new timeout to delay the saving
    saveTimeout = setTimeout(() => {
      initiateSave(autoSaveDelay);
    }, autoSaveDelay);
  });
}

function initiateSave(delay) {
  isSaving = true;
  // console.log("Initiating save...");
  saveFunction();

  // Reset the isSaving state after a delay
  setTimeout(() => {
    isSaving = false;
    // console.log("Resetting save state.");
  }, delay);
}

function saveFunction() {
  editor.ajax.save();
}

function addPrettifyButton(editor) {
  const controls = document.getElementById("standard-controls");

  if (!controls) return;

  const prettifyButton = document.createElement("button");
  prettifyButton.id = "prettifyCode";
  prettifyButton.innerText = "Prettify Code";

  if (document.getElementById("prettifyCode")) return

  controls.appendChild(prettifyButton);

  // Add the event listener
  prettifyButton.addEventListener("click", function() {
    prettifyEditorContent(editor);
  });
}

function prettifyEditorContent(editor) {
  const content = editor.getValue(); // Assuming `editor` is the global variable for Ace Editor
  const prettifiedContent = prettifyContent(content);
  const cursorPosition = editor.getCursorPosition();

  editor.setValue(prettifiedContent);

  editor.clearSelection();
  editor.scrollToLine(cursorPosition.row, true, false, function() {});
  editor.moveCursorToPosition(cursorPosition);
}

function prettifyContent(content) {
  // Prettify content using the `js_beautify` function
  let beautifiedHtml = html_beautify(content, {
    indent_size: 2,
    preserve_newlines: true,
    unformatted: ['code', 'pre', 'em', 'strong', 'span', '{', '}'],
    content_type: "html", // Specify the type of content being beautified
    templating: ["smarty"] // Specify the templating language
  });

  // if needed, could add more custom formatting here

  return beautifiedHtml;
}

function addCustomScrolling(editor) {
  editor.addEventListener('mousewheel', function(event) {
    if (event.domEvent.shiftKey) {
      let scrollAmount = 0;

      if (event.domEvent.wheelDelta) {
        scrollAmount = event.domEvent.wheelDelta / 40;
      } else if (event.domEvent.detail) {
        scrollAmount = -event.domEvent.detail;
      }

      if (targetScrollTop === null) {
        targetScrollTop = editor.session.getScrollTop();
      }

      targetScrollTop -= scrollAmount * fontSize * 0.417 * scrollLines;

      if (!isAnimatingScroll) {
        animateScroll();
      }

      event.domEvent.preventDefault();
      event.domEvent.stopPropagation();
    }
  });

  function animateScroll() {
    if (currentScrollTop === null) {
      currentScrollTop = targetScrollTop;
    }

    isAnimatingScroll = true;

    if (Math.abs(currentScrollTop - targetScrollTop) > 0.5) { // Reduced threshold for sensitivity
      currentScrollTop += (targetScrollTop - currentScrollTop) * lerpFactor;
      editor.session.setScrollTop(currentScrollTop);
      requestAnimationFrame(animateScroll);
    } else {
      currentScrollTop = targetScrollTop;
      editor.session.setScrollTop(currentScrollTop);
      isAnimatingScroll = false;
    }
  }
}

let url = window.location.href;
let templateId = url.split('#')[1];
function addRevisionButtons(editor) {
    const btnRevisions = document.getElementById("btnRevisions");

    if (!btnRevisions) return;

    const prevButton = document.createElement("button");
    prevButton.id = "prevRevision";
    prevButton.innerText = "Previous";

    const nextButton = document.createElement("button");
    nextButton.id = "nextRevision";
    nextButton.innerText = "Next";

    // Create an element for displaying the current revision number.
    const revisionDisplay = document.createElement("span");
    revisionDisplay.id = "currentRevisionDisplay";

    // Get current revision from the select element.
    const revisionSelect = document.getElementById("revisions_select");
    if (revisionSelect) {
        revisionDisplay.innerText = revisionSelect.value;
    }

    // Insert the buttons before and after the btnRevisions element.
    btnRevisions.parentNode.insertBefore(prevButton, btnRevisions);
    btnRevisions.parentNode.insertBefore(nextButton, btnRevisions.nextSibling);
    btnRevisions.parentNode.insertBefore(revisionDisplay, nextButton.nextSibling);

    // Event listeners remain the same as before.
    prevButton.addEventListener("click", function() {
        changeRevision(editor, -1);
    });

    nextButton.addEventListener("click", function() {
        changeRevision(editor, 1);
    });
}

function changeRevision(editor, direction) {
    const revisionsSelect = document.getElementById("revisions_select");
    const currentIndex = revisionsSelect.selectedIndex;

    if ((direction === -1 && currentIndex > 0) || (direction === 1 && currentIndex < revisionsSelect.length - 1)) {
        revisionsSelect.selectedIndex = currentIndex + direction;
        const revisionId = revisionsSelect.value;

        document.getElementById('currentRevisionDisplay').innerText = revisionId

        // Capture the current line number and column position.
        const cursorPosition = editor.getCursorPosition();

        // Step 4: Make an AJAX GET request.
        fetch(`https://my.sailthru.com/template/template?template_id=${templateId}&widget=editor&action=revision&revision_id=${revisionId}`)
            .then(response => response.json())
            .then(data => {
                console.log(data)
                editor.setValue(data.revision_html);

                // Scroll to the captured line number and column position.
                console.log(cursorPosition)

                editor.clearSelection();
                editor.scrollToLine(cursorPosition.row, true, false, function() {});
                editor.moveCursorToPosition(cursorPosition);
            })
            .catch(error => console.error("Error fetching revision:", error));
    }
}

// Watch the tab editor tab and run the improvement when it's focussed
const tabEditorDiv = document.getElementById('tab-editor');
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
      const displayStyle = window.getComputedStyle(tabEditorDiv).display;
      if (displayStyle === 'block') {
        improveEditor("ace-editor");
      }
    }
  });
});

const config = {
  attributes: true,
  childList: false,
  subtree: false
};

observer.observe(tabEditorDiv, config);
