// ==UserScript==
// @name        Improved Ace Editor for Zephyr and HTML
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/template/*
// @grant       none
// @run-at      document-end
// @version     1.0
// @author      Colin Whelan
// @description Improved HTML Editor (Ace Editor) by updating the config settings. Update as needed to suit your preferences.
// ==/UserScript==

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

        // Make Editor Resizable
        const editorDiv = document.getElementById("ace-editor");

        if (editorDiv) {
            // editorDiv.style.resize = "both";
            // editorDiv.style.overflow = "auto";

            const lineHeight = 15.7667; // Height of each line in px

            const setEditorOptions = () => {
                const windowHeight = window.innerHeight;
                const editorPosition = editorDiv.getBoundingClientRect();
                const availableHeight = windowHeight - editorPosition.top - 20; // 20px padding
                const lines = Math.floor(availableHeight / lineHeight);

                // Update other options
                editor.setOptions({
                    maxLines: lines,  // Default: 16
                    minLines: 16,  // Default: 16
                    showPrintMargin: false,  // Default: true
                    navigateWithinSoftTabs: true,  // Default: null
                    tabSize: 2, // Default: 4
                    wrap: true, // Default: "free"
                    wrapMethod: "code", // Default: null
                    indentedSoftWrap: true, // Default: null
                    animatedScroll: true, // Default: false
                    scrollPastEnd: 8, // Default: 0 - May not work
                    dragDelay: 0, // Default: 150

                    // WIP - Not working
                    enableBasicAutocompletion: true,
                    enableSnippets: true,
                    enableLiveAutocompletion: true
                });

              // console.log(ace.config)
              // console.log(editor.getOptions())
            };

            // Initial set and update on window resize
            setEditorOptions();
            window.addEventListener("resize", setEditorOptions);
        }

        console.log("Ace Editor improved with Zephyr support.");
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
