// ==UserScript==
// @name        Sailthru Environment Ring
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/*
// @grant       none
// @version     1.0
// @author      Colin Whelan
// @description Add colored ring to Sailthru pages to remind/warn the user what environtment they are in
// @require https://code.jquery.com/jquery-3.6.0.min.js
// ==/UserScript==

// avoids conflict with the code editor using jquery
var jq = $.noConflict();


let environtment = jq("#my-navbar-components :contains('Indigo')").text()


let wrapper = document.getElementById("wrapper");

let styles = {
  'DEV': '5px solid indigo',
  'QA': '5px solid green',
  'PROD': '5px solid red',
}

wrapper.style.boxSizing = 'border-box'

if(environtment.includes("DEV")){
  wrapper.style.border = styles.DEV
  // console.log('DEV')
}else if(environtment.includes("QA")){
  wrapper.style.border = styles.QA
  // console.log('QA')
}else if(!environtment.includes("DEV") && !environtment.includes("QA")){
  wrapper.style.border = styles.PROD
  // console.log('PROD')
} else {
  // console.log('UNKNOWN')
}
