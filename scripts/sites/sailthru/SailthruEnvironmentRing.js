// ==UserScript==
// @name        Global - Environment Ring
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/*
// @grant       none
// @version     1.1
// @author      Colin Whelan
// @description Add colored ring to Sailthru pages to remind/warn the user what environtment they are in
// @require https://code.jquery.com/jquery-3.6.0.min.js
// ==/UserScript==

// avoids conflict with the code editor using jquery
var jq = $.noConflict();

// gets the environtment of the space
let environment = document.querySelector('.MenuItemContent__AppName-sc-14rb29y-1').textContent;
let wrapper = document.getElementById("wrapper");

// defaults to first item - will do partial matches. if envs like 'dev' + 'dev2' then list 'dev2' first.
let styles = {
  'PROD': '5px solid red',
  'DEV': '5px solid blue',
  'YOUR ENV NAME HERE': '5px solid green',
  // Add more environments as needed
}

wrapper.style.boxSizing = 'border-box';

// Get the first environment key as the default
let defaultEnv = Object.keys(styles)[0];

// Find the appropriate environment key based on the 'environment'
let envKey = Object.keys(styles).find(key => environment.includes(key)) || defaultEnv;

// Apply the corresponding style
wrapper.style.border = styles[envKey];
