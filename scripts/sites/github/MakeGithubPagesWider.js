// ==UserScript==
// @name        Make Github User Code Wider
// @namespace   Violentmonkey Scripts
// @match       https://github.com/*
// @grant       none
// @version     1.0
// @author      -
// @description Make the content box wider
// ==/UserScript==

let container = document.getElementsByClassName('container-xl')[0]
let article = document.getElementsByTagName('article')[0]

container.style.maxWidth = '90%'
article.style.maxWidth = '90%'