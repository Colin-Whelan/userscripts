// ==UserScript==
// @name        Make SailThru Developer Documentation Wider
// @namespace   Violentmonkey Scripts
// @match       https://getstarted.sailthru.com/*
// @grant       none
// @version     1.0
// @author      -
// @description Make the content box wider
// ==/UserScript==

let contentWrapper = document.getElementsByClassName('content-wrapper')[0]
let contentBox = document.getElementsByClassName('content')[0]

contentWrapper.style.width = '80%'
contentBox.style.maxWidth = '90%'