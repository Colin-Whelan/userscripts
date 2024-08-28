// ==UserScript==
// @name        Email Composer - See Usage
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/email-composer/*
// @match       https://my.sailthru.com/template/*
// @grant       none
// @version     1.3
// @run-at      document-idle
// @author      Colin Whelan
// @description Adds a button to show where the template is being used.
// ==/UserScript==

let buttonAdded = false;

function addStylesheet() {
    const style = document.createElement('style');
    style.textContent = `
        .template-usage-btn {
            margin: auto 8px;
            font-size: 12px;
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
        }
        .template-usage-btn:hover {
            opacity: 0.7;
        }
    `;
    document.head.appendChild(style);
}

function observeHeaderNavLinks() {
    const targetNode = document.querySelector('#header_nav_links');
    if (!targetNode) return;

    const config = { attributes: true, childList: true, subtree: true };
    const observer = new MutationObserver(() => {
        if (buttonAdded) return;

        const btn = document.createElement('button');
        btn.textContent = 'Template Usage';
        btn.classList.add('template-usage-btn');

        const idMatch = window.location.href.match(/(\d+)/);
        if (idMatch) {
            const id = idMatch[1];
            btn.addEventListener('click', () => window.location.href = `https://my.sailthru.com/email-composer/${id}/usage`);
        }

        const insertAfterElem = document.querySelector('#header_nav_links');
        if (insertAfterElem && insertAfterElem.parentNode) {
            insertAfterElem.appendChild(btn, insertAfterElem.nextSibling);

            buttonAdded = true;
            observer.disconnect();
        }
    });

    observer.observe(targetNode, config);
}

addStylesheet();
observeHeaderNavLinks();
