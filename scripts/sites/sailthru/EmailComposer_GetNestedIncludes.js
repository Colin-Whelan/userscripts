// ==UserScript==
// @name        Get Nested Includes
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/template/*
// @grant       GM_addStyle
// @grant       GM_xmlhttpRequest
// @version     1.0
// @author      Colin Whelan
// @description Adds button to Sailthru Template Page for processing includes and copies to clipboard. For use with this: https://sailthru.zendesk.com/hc/en-us/community/posts/22560634415636
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(`
        #specialIncludeData {
            margin-left: 5px;
            margin-top: 15px;
            margin-bottom: 15px;
            background-color: rgb(0, 169, 250);
            background-image: none;
            border: none;
            border-radius: 4px;
            color: white;
            padding: 5px 10px;
            cursor: pointer;
            outline: none;
            transition: opacity 0.2s;
            width: 120px;
            line-height: 16px;
        }
        #specialIncludeData:hover {
            opacity: 0.7;
        }
        .clipboard-popup {
            position: fixed;
            bottom: 120px;
            left: 10px;
            background-color: rgb(0, 169, 250);
            color: white;
            padding: 10px;
            border-radius: 5px;
            z-index: 1000;
            display: none;
            animation: fadeOut 5s;
        }
        @keyframes fadeOut {
            from {opacity: 1;}
            to {opacity: 0;}
        }
    `);

    let includesJson = {};

    function addImagePickerButton() {
        const ulElement = document.getElementById('header_nav_links');

        const liElement = document.createElement('li');
        liElement.className = 'NavLinksComponent__NavBarItems-sc-1456pt8-1 hBHGeq';

        const button = document.createElement('button');
        button.textContent = 'Process \nIncludes';
        button.id = 'specialIncludeData';
        button.style.cursor = 'pointer';
        button.addEventListener('click', fetchIncludeData);

        liElement.appendChild(button);
        ulElement.appendChild(liElement);
    }

    function fetchIncludeData() {
        const timestamp = new Date().getTime();
        const url = `https://my.sailthru.com/ajax/include?id=init&_=${timestamp}`;

        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            onload: function(response) {
                const data = JSON.parse(response.responseText);
                processIncludes(data.options);
            }
        });
    }

    function processIncludes(options) {
        let includeNames = [];
        let includes = "";

        Object.keys(options).forEach(key => {
            includeNames.push(key);
            includes += `include"${key}", `
        });

        // Construct the strings to copy
        let includeNamesStr = "{includeNames = " + JSON.stringify(includeNames) + "}";
        let includesStr = "{includes = [" + includes + "]}";
        includesStr = includesStr.replace(', ]}',']}') // Sailthru requires this to be removed
        let combinedStr = includeNamesStr + "\n" + includesStr;

        // Copy the combined string to the clipboard
        copyToClipboard(combinedStr);
    }

    function showClipboardPopup() {
        const popup = document.createElement('div');
        popup.className = 'clipboard-popup';
        popup.textContent = 'Copied to clipboard!';
        document.body.appendChild(popup);
        popup.style.display = 'block';
        setTimeout(() => popup.style.display = 'none', 3000);
    }

    function copyToClipboard(text) {
        const textarea = document.createElement('textarea');
        textarea.textContent = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showClipboardPopup();
    }

    var checkExportButtonInterval = setInterval(function() {
        let target = document.getElementById('header_nav_links');
        if (target) {
            clearInterval(checkExportButtonInterval);
            addImagePickerButton();
        }
    }, 400);
})();
