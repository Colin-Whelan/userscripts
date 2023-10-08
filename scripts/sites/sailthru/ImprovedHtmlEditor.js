// ==UserScript==
// @name        HTML Editor - Better Ace IDE
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/template/*
// @grant       none
// @run-at      document-end
// @version     1.2
// @author      Colin Whelan
// @description Improved HTML Editor (Ace Editor) by updating the config settings. Update as needed to suit your preferences.
// Add the following:
// - custom IDE themes
// - The better 'find' window by default. Supports regex
// - Autosize editor
// - Default options
// ==/UserScript==

// Default Options
const fontSize = 13
const minLines = 16
const tabSize = 2
const dragDelay = 0
const fontFamily = "Fira Code"
const showPrintMargin = false

// how far the modal needs to be dragged to be prevent commands from executing.
// Prevents commands from running when dragging while allowing any jitter while clicking to still count as clicks
const dragThreshold = 10

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
    "find", "findAll", "findNext", "findPrevious", "gotoLine", "gotoPageDown", "gotoPageUp",
        "jumpToMatching", "navigateDown", "navigateFileEnd", "navigateFileStart",
        "navigateLeft", "navigateLineEnd", "navigateLineStart", "navigateRight",
        "navigateTo", "navigateUp", "navigateWordLeft", "navigateWordRight",
        "redo", "replace", "replaceAll", "selectAll", "selectMore",
        "selectMoreLines", "selectPageDown", "selectPageUp", "showKeyboardShortcuts",
        "showSettingsMenu", "sortLines", "splitLine", "toLowerCase", "toUpperCase",
        "toggleBlockComment", "toggleCommentLines", "toggleOverwrite", "transposeLetters", "undo"
    ];

  commandNames.forEach(function(name) {
    var cmd = defaultCommands.filter(function(c) {
      return c.name == name;
    })[0];
    if (cmd) {
      // console.log(cmd.name, cmd.bindKey.win)
      editor.commands.addCommand(cmd);
    }
  });
}

function improveEditor() {
  if (window.ace) {
    const editor = ace.edit("ace-editor");

    editor.session.setMode("ace/mode/html");

    // Set theme to Monokai
    editor.setTheme("ace/theme/monokai");

    // Other options:
    // 'ambiance', 'chaos', 'clouds', 'clouds_midnight', 'cobalt',
    // 'dawn', 'dreamweaver', 'eclipse',
    // 'github', 'idle_fingers', 'merbivore', 'merbivore_soft', 'mono_industrial',
    // 'monokai', 'pastel_on_dark', 'solarized_dark',
    // 'solarized_light', 'textmate', 'tomorrow',
    // 'tomorrow_night', 'tomorrow_night_blue', 'tomorrow_night_bright',
    // 'tomorrow_night_eighties', 'twilight', 'vibrant_ink', 'xcode'

    const editorDiv = document.getElementById("ace-editor");

    if (editorDiv) {
      const lineHeight = fontSize * 1.3; // Height of each line in px

      const setEditorOptions = () => {
        const windowHeight = window.innerHeight;
        const editorPosition = editorDiv.getBoundingClientRect();
        const availableHeight = windowHeight - editorPosition.top - 20; // 20px padding
        const lines = Math.floor(availableHeight / lineHeight);

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
          enableMultiSelect: false,
          enableAutoIndent: false,
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

        executeInPageContext(enableCommands(editor));
      };

      // Initial set and update on window resize
      setEditorOptions();
      window.addEventListener("resize", setEditorOptions);
      document.getElementById('editor').addEventListener('keydown', function(event) {
        if (event.ctrlKey && event.shiftKey && event.keyCode === 32) { // 32 is the keyCode for Spacebar
          showHelper(editor);
        }
      });

    }
  }
}

function createModal() {
  const modal = document.createElement('div');
  modal.id = 'aceEditorHelperModal';
  modal.style.position = 'fixed';
  modal.style.top = '20%';
  modal.style.left = '50%';
  modal.style.transform = 'none';
  modal.style.backgroundColor = '#FFF';
  modal.style.border = '1px solid #AAA';
  modal.style.padding = '10px';
  modal.style.zIndex = '9999';
  modal.style.display = 'none';
  modal.style.maxHeight = '70vh'; // 70% of the viewport height
  modal.style.overflowY = 'auto'; // Allow scrolling if the content exceeds the max height
  modal.style.borderRadius = '5px'; // Rounded edges
  modal.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'; // A subtle shadow
  modal.style.userSelect = 'none';

  makeModalDraggable(modal);

  const closeButton = document.createElement('button');
  closeButton.innerHTML = 'Close';
  closeButton.onclick = () => modal.style.display = 'none';

  // New styling for close button
  closeButton.style.backgroundColor = '#e4e4e4'; // Light grey background
  closeButton.style.border = 'none'; // Remove default border
  closeButton.style.borderRadius = '5px'; // Rounded edges
  closeButton.style.padding = '5px 10px'; // Padding for size
  closeButton.style.cursor = 'pointer'; // Indicate it's clickable
  closeButton.style.marginRight = '10px'; // Distance from helper text

  closeButton.addEventListener('mouseover', () => {
    closeButton.style.backgroundColor = '#d4d4d4'; // Slightly darker on hover
  });

  closeButton.addEventListener('mouseout', () => {
    closeButton.style.backgroundColor = '#e4e4e4'; // Revert to original color
  });

  const helperText = document.createElement('span');
  helperText.innerText = 'Click on a command to execute it.';
  helperText.style.color = '#888'; // Subdued color
  helperText.style.fontSize = '0.9em'; // Slightly smaller than default

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

function makeModalDraggable(modal) {
  let offsetX, offsetY, isDragging = false;

  modal.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const rect = modal.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    isDragging = true;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });


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
}

function populateModalWithCommands(editor, modal) {
  const commands = editor.commands.commands;
  let startX, startY, dragged = false;

  for (let commandName in commands) {
    if (commands.hasOwnProperty(commandName)) {
      const command = commands[commandName];

      // Create a div for each command
      const div = document.createElement('div');

      // Style the div
      div.style.padding = '8px 12px';
      div.style.margin = '4px 0';
      div.style.backgroundColor = '#f9f9f9';
      div.style.borderRadius = '3px';
      div.style.cursor = 'pointer';
      div.style.transition = 'background-color 0.3s';

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
      commandNameSpan.style.fontWeight = 'bold';
      commandNameSpan.style.color = '#333';
      commandNameSpan.style.textDecoration = 'underline';
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
