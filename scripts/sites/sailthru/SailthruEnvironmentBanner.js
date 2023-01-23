// ==UserScript==
// @name        Sailthru Environment Banner
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/*
// @grant       none
// @version     1.0
// @author      Colin Whelan
// @description Add colored banner to the top of Sailthru pages to remind/warn the user what environtment they are in
// @require https://code.jquery.com/jquery-3.6.0.min.js
// ==/UserScript==

// avoids conflict with the code editor using jquery
var jq = $.noConflict();


let environtment = jq("#my-navbar-components :contains('Indigo')").text()


// properties used in extraCSS later can overwrite defaults
let cssOptions = {
  "color": "white",
  "padding": "10px",
  "font-size": "16px",
  "text-align": "center"
};

let bannerText = '';
let extraCSS = {};

if(environtment.includes("DEV")){
  bannerText = "😄 DEV 😄 ";
  extraCSS = {"background": "indigo"}
  // console.log('DEV')
}else if(environtment.includes("QA")){
  bannerText = "📊 QA 📊";
  extraCSS = {"background": "green"}
  // console.log('QA')
}else if(environtment.includes("Indigo") && !environtment.includes("DEV") && !environtment.includes("QA")){
  bannerText = "⚠️ PROD ⚠️";
  extraCSS = {"background": "red", "font-weight": "bold"}
  // console.log('PROD')
} else {
  // console.log('UNKNOWN')
}

if(bannerText != ''){
  let banner = jq("<div>", {
      text: bannerText,
      css: {...cssOptions, ...extraCSS}
  });
  jq(".my_header").before(banner);
}