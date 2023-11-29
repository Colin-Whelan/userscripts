// ==UserScript==
// @name        Audience Builder - All Fields Modal
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/audience_builder*
// @grant       none
// @version     1.1
// @author      Colin Whelan
// @description Adds a button that when clicked shows a modal with all available fields with a proper search bar. Click a field to copy.
// ==/UserScript==
let allFields = [];
const delay = 2000;

(function() {
  'use strict';

  // CSS to fix rendering when helper is added
  const css2 = `
  #addFieldModalButton {
    float: left;
    margin: 8px 10px;
    padding: 8px 12px;
    border: none;
    background-color: #007bff;
    color: white;
    cursor: pointer;
    border-radius: 4px;
  }

  #availableFieldsModal {
    position: fixed;
    top: 10vh;
    right: 300px;
    width: 300px;
    height: 400px;
    overflow: auto;
    border: 1px solid #000;
    background: #fff;
    z-index: 10000;
    padding: 5px;
    box-shadow: 2px 2px 3px rgba(0,0,0,0.3);
  }

  #fieldCopied {
    position: fixed;
    bottom: 70px;
    right: 10px;
    background-color: black;
    border: 2px solid white;
    color: white;
    padding: 10px;
    z-index: 9999;
    display: none;
  }

  #searchInput {
    box-sizing: border-box;
    width: 100%;
    padding: 30px;
    border: 1px solid #ccc;
    border-radius: 0px 0px 4px 4px;
    padding: 5px 10px;
    margin-bottom: 10px;
  }

  #fieldsModalHeader {
    cursor: move;
    padding: 10px;
    background: #007bff;
    color: white;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    user-select: none;
  }

  #fieldModalList {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .listItem {
    padding: 5px 10px;
    cursor: pointer;
    border: 1px solid #eee;
    border-radius: 5px;
    word-break: break-all;
  }

  .listItem:hover {
    background-color: #eee;
    border-radius: 5px;
  }

  #emptyOption {
    padding: 5px 10px;
    color: #999;
  }
  `;

  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = css2;
  document.head.appendChild(styleSheet);


  let hideTooltipTimeout;

  //fetch the available fields for each letter in the alphabet
  async function start() {
    for (let charCode = 97; charCode <= 122; charCode++) {
      let letter = String.fromCharCode(charCode);
      let options = await fetchFields(letter);
      allFields.push(...options);
    }
    addButton();
  }

  function addButton() {
    const container = document.querySelector('.container-fluid');
    if (!container) return;

    const button = document.createElement('button');
    button.id = 'addFieldModalButton'
    button.textContent = 'Show Available Fields';
    button.onclick = () => showAvailableFieldsModal(allFields);
    container.appendChild(button);
  }

  // Function to fetch options starting with a given letter
  async function fetchFields(letter) {
    let url = `https://my.sailthru.com/uiapi/querybuilder/query/?term=${letter}`;
    try {
      let response = await fetch(url);
      if (response.ok) {
        let data = await response.json();
        return data;
      } else {
        return [];
      }
    } catch (error) {
      return [];
    }
  }

  // Function to create and show the modal with options
  function showAvailableFieldsModal(options) {
    if (document.getElementById('availableFieldsModal')) return

    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.id = 'fieldCopied'
    document.body.appendChild(tooltip);

    // Create search input
    let searchInput = document.createElement('input');
    searchInput.placeholder = 'Search...';
    searchInput.type = 'text';
    searchInput.id = 'searchInput';
    // Event listener for search input
    searchInput.addEventListener('input', filterOptions);
    searchInput.addEventListener('click', function(event) {
      searchInput.focus()
    });

    let modal = document.createElement('div');
    modal.id = 'availableFieldsModal';
    let header = document.createElement('div');
    header.id = 'fieldsModalHeader'
    header.textContent = 'Available Fields';

    modal.appendChild(header);
    modal.appendChild(searchInput); // Add search input to modal

    let list = document.createElement('ul');
    list.id = 'fieldModalList'

    // Function to filter options based on search input
    function filterOptions() {
      let searchText = searchInput.value.toLowerCase();
      console.log(searchText)
      list.innerHTML = ''; // Clear current list

      let filteredOptions = options.filter(option => option.toLowerCase().includes(searchText));
      filteredOptions.sort(); // Sort the filtered options alphabetically

      console.log(filteredOptions)

      filteredOptions.forEach(option => {
        let listItem = document.createElement('li');
        listItem.textContent = option;
        listItem.classList = ['listItem']

         // Define a variable outside the function to keep track of the timeout

        // Copy option to clipboard when clicked
        listItem.onclick = function() {
          navigator.clipboard.writeText(option).then(() => {
            tooltip.innerHTML = `Copied: '${option}'`;
            tooltip.style.display = 'block';

            // Clear any existing timeout to reset the timer
            clearTimeout(hideTooltipTimeout);

            // Set a new timeout
            hideTooltipTimeout = setTimeout(() => tooltip.style.display = 'none', 4000);
          }, () => {
            console.error('Failed to copy text: ', option);
          });
        };

        list.appendChild(listItem);
      });

      if (filteredOptions.length === 0) {
        let emptyOption = document.createElement('li');
        emptyOption.textContent = 'No options found';
        emptyOption.id = 'emptyOption'
        list.appendChild(emptyOption);
      }
    }

    modal.appendChild(list);

    document.body.appendChild(modal);

    filterOptions(); // Initial call to display all options

    // Make the modal draggable
    dragElement(modal);
  }


  function dragElement(elmnt) {
    var pos1 = 0,
      pos2 = 0,
      pos3 = 0,
      pos4 = 0;
    if (document.getElementById(elmnt.id + "header")) {
      // if present, the header is where you move the DIV from:
      document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
    } else {
      // otherwise, move the DIV from anywhere inside the DIV:
      elmnt.onmousedown = dragMouseDown;
    }

    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      // get the mouse cursor position at startup:
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      // call a function whenever the cursor moves:
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      // calculate the new cursor position:
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      // set the element's new position:
      elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
      elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
      // stop moving when mouse button is released:
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  start();
})();
