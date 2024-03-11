// ==UserScript==
// @name        Templates List - Gallery Search
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/templates-list*
// @grant       none
// @version     1.1
// @author      Colin Whelan
// @description Adds a search bar to the Idea Gallery
// ==/UserScript==

(function() {
    'use strict';

    let searchBar; // Define the searchBar variable outside of the createSearchBar function

    function addCustomStyles() {
        const styles = `
            #templateSearchBar {
                padding: 10px;
                border: 2px solid rgb(58, 122, 240);
                border-radius: 5px;
                box-shadow: 0px 0px 0px rgba(58, 122, 240, 0.5);
                transition: all 0.3s ease;
            }

            #templateSearchBar:focus {
                outline: none;
                box-shadow: 0px 0px 8px rgba(58, 122, 240, 0.7);
            }
        `;

        const styleSheet = document.createElement('style');
        styleSheet.type = 'text/css';
        styleSheet.innerText = styles;
        document.head.appendChild(styleSheet);
    }

    // Function to create the search bar
    function createSearchBar() {
        searchBar = document.createElement('input');
        searchBar.setAttribute('type', 'text');
        searchBar.setAttribute('id', 'templateSearchBar');
        searchBar.setAttribute('placeholder', 'Search Templates...');
        searchBar.style.margin = '10px';
        searchBar.style.width = '97.5%';
        searchBar.style.display = 'none'; // Initially hidden

        // Insert the search bar after the specified element
        const referenceNode = document.querySelector('.sc-bwzfXH.ghsZBw');
        if (referenceNode) {
            referenceNode.parentNode.insertBefore(searchBar, referenceNode.nextSibling);
        }

        // Event listener for search bar
        searchBar.addEventListener('input', filterTemplates);
    }

    // Function to filter templates based on search input
    function filterTemplates() {
        const searchValue = searchBar.value.toLowerCase();
        const parentElement = searchBar.nextElementSibling.firstElementChild;
        const templateDivs = Array.from(parentElement.children).filter(child => child.tagName === 'DIV');


        templateDivs.forEach(div => {
            console.log(div.firstElementChild)
            const templateName = div.firstElementChild.nextElementSibling.textContent.toLowerCase();
            if (templateName.includes(searchValue)) {
                div.style.display = '';
            } else {
                div.style.display = 'none';
            }
        });
    }

    // Function to check the URL and toggle search bar visibility
    function checkUrlAndUpdateSearchBar() {
        const currentUrl = window.location.href;
        if (currentUrl.endsWith('/gallery')) {
            searchBar.style.display = 'block';
        } else {
            if (searchBar) {
              searchBar.style.display = 'none';
            }
        }
    }

    // Initialize the script
    window.addEventListener('load', () => {
        createSearchBar();
        addCustomStyles();
        checkUrlAndUpdateSearchBar();
    });

    // MutationObserver to detect URL changes in SPA
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.type === 'childList' || mutation.type === 'attributes') {
                checkUrlAndUpdateSearchBar();
            }
        });
    });

    const config = { childList: true, subtree: true, attributes: true };
    observer.observe(document.body, config);
})();
