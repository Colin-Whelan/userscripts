// ==UserScript==
// @name        Campaigns - Auto Save
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/campaign*
// @grant       none
// @version     1.0
// @author      Colin Whelan
// @description Auto-saves Campaigns based on an interval
// ==/UserScript==

var interval = '30s';  // set your desired interval here

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
  var divButtons = document.querySelectorAll(".action_label");
  
  for (var i = 0; i < divButtons.length; i++) {
      var divButton = divButtons[i];
      if (divButton.textContent.trim() === "Save") {
          divButton.click();
          console.log('Auto-saved');
          break;
      }
  }
}, intervalMs);
