// ==UserScript==
// @name        HTML Editor - Better Ace IDE
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/template/*
// @grant       none
// @run-at      document-end
// @version     1.1
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

function executeInPageContext(fn) {
    const script = document.createElement('script');
    script.textContent = '(' + fn.toString() + ')();';
    (document.head || document.documentElement).appendChild(script);
    script.parentNode.removeChild(script);
}

function enableCommands(editor) {
    var defaultCommands = ace.require("ace/commands/default_commands").commands;

    var commandNames = [
        "find", "togglecomment", "showSettingsMenu",
        "gotoline", "findnext", "findprevious", "indent",
        "outdent", "fold", "unfold", "foldall",
        "unfoldall", "toggleBlockComment", "transposeletters",
        "jumptomatching", "autoindent"
    ];

    commandNames.forEach(function(name) {
        var cmd = defaultCommands.filter(function(c) { return c.name == name; })[0];
        if (cmd) {
            console.log(cmd)
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

                // Update other options
                editor.setOptions({
                    maxLines: lines,  // Default: 16
                    minLines: minLines,  // Default: 16
                    showPrintMargin: showPrintMargin,  // Default: true
                    navigateWithinSoftTabs: true,  // Default: null
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
const config = { attributes: true, childList: false, subtree: false };
observer.observe(tabEditorDiv, config);
