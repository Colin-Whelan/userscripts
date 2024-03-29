// ==UserScript==
// @name        Email Composer - Auto-Save
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/email-composer/*
// @grant       none
// @version     1.0
// @author      Colin Whelan
// @description Auto-saves Templates based on an interval
// ==/UserScript==

var interval = '5 min';  // set your desired interval here

function convertToMilliseconds(timeStr) {
  var value = parseInt(timeStr);

  if (timeStr.includes('h')) {
      return value * 1000 * 60 * 60;
  } else if (timeStr.includes('m')) {
      return value * 1000 * 60;
  } else { // Assume seconds if no other unit is specified
      return value * 1000;
  }
}

var intervalMs = convertToMilliseconds(interval);

setInterval(function() {
  var buttons = document.querySelectorAll("button");
  for (var i = 0; i < buttons.length; i++) {
      var button = buttons[i];
      if (button.textContent.trim() === "Save") {
          button.click();
          console.log('Auto-saved');
          break;
      }
  }
}, intervalMs);
