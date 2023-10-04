// ==UserScript==
// @name Global - Compact Status Banner
// @namespace Violentmonkey Scripts
// @match https://my.sailthru.com/*
// @grant none
// @version 1.0
// @author -
// @description Adds a status banner to the top of the page. status pulls from RSS feed and shows some details. Compact design, click to expand and collapse.
// ==/UserScript==

//time frame in days
const timeFrame = 1

// integer, minimum = 1
const maxUpdates = 2

const boxPadding = '8px 12px'
const boxColor = '#00a9fa'

const RSS_URL = `https://status.sailthru.com/rss`;

function formatDescription(description) {
  description = description.replace(/Normal update/gim, 'Latest update')
  description = description.replace(/GMT - /gim, 'GMT')
  description = description.replace(/Informational update/gim, '<br><strong>Informational update</strong>')
  description = description.replace(/Latest update/gim, '<br><strong>Latest update</strong>')

  // Strip <p> and </p> tags
  description = description.replace(/<\/?p>/g, '');

  //if the latest update exists, only show that
  if (description.includes('Latest update')) {
    let temp = description.split(`<strong>Latest update</strong>`)
    description = '<strong>Latest update</strong>'+temp[1]
  }

  return description
}

fetch(RSS_URL)
  .then(response => response.text())
  .then(str => new window.DOMParser().parseFromString(str, "text/xml"))
  .then(data => {

    // Create the wrapper element and the status div
    let wrapper = document.getElementById("wrapper");
    let statusDiv = document.createElement("div");
    statusDiv.setAttribute("id", "statusBanner");
    statusDiv.innerHTML = `
      <div id="updateCount"></div>
      <div id="updates" style="display: none;"></div> <!-- updates div is hidden by default -->
    `;

    // Set the styles for the status div
    statusDiv.style.backgroundColor = boxColor;
    statusDiv.style.textAlign = 'left';
    statusDiv.style.color = 'white';
    statusDiv.style.fontSize = '18px';
    statusDiv.style.fontWeight = 'bold';

    // Insert the status div into the wrapper element
    wrapper.insertAdjacentHTML("beforebegin", statusDiv.outerHTML);

    // Get all items from the data
    const items = data.querySelectorAll("item");

    // Create variables to keep track of updates
    let updatesDiv = document.getElementById("updates");
    let updateCount = 0;

    // Create a variable to store the text for the number of days
    let daysText = (timeFrame === 1) ? 'day' : 'days';

    items.forEach(function (update, index) {
      let pubDate = new Date(update.querySelector("pubDate").textContent)
      let link = update.querySelector("link").textContent

      let oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - timeFrame);

      let title = update.querySelector("title").textContent
      let description = update.querySelector("description").innerHTML

      if (pubDate > oneWeekAgo) {

        updateCount += 1;

        // Update the update count text
        let updateCountText = `There ${(updateCount === 1) ? 'has been' : 'have been'} ${updateCount} update${(updateCount === 1) ? '' : 's'} in the last ${timeFrame} ${daysText}`;
        let counter = document.getElementById("updateCount");
        counter.innerHTML = `<a href="https://status.sailthru.com/#!/" target="_blank" style="color: #ffffff; text-decoration: underline;">${updateCountText}.</a>`;

        // only show the first X number of updates
        if (updateCount <= maxUpdates) {
          // Set the padding for the status div
          document.getElementById("statusBanner").style.padding = boxPadding;

          // Create a new div for the update
          let updateDiv = document.createElement("div");
          updateDiv.setAttribute("id", `update${updateCount}`);

          // Get the title, description, and pubDate of the update
          let title = update.querySelector("title").textContent;
          let description = formatDescription(update.querySelector("description").innerHTML);

          updateDiv.innerHTML = `
            <div id="title${updateCount}" style="margin-top:12px; font-size:16px;"><a href="${link}" target="_blank" style="color: #ffffff; text-decoration: underline;">${title}</a> <span id="subtitle${updateCount}" style="font-size:12px;"> -- ${pubDate}</span></div>
            <div id="description${updateCount}" class="description" style="margin-top:8px; font-size:14px; font-weight:normal;">${description}</div>
          `;

          // Add the update div to the updates div
          updatesDiv.innerHTML += updateDiv.outerHTML;

          // Set the overflow and text-overflow styles for the update's description
          let thisDescription = document.getElementById(`description${updateCount}`);
          thisDescription.style.overflow = 'hidden';
          thisDescription.style.textOverflow = 'ellipsis';
        } else {
          // Update the update count text to show that some updates were not displayed
          // console.log('Update limit reached - not adding update to DOM');
          counter.innerHTML = `<a href="https://status.sailthru.com/#!/" target="_blank" style="color: #ffffff; text-decoration: underline;">There have been ${updateCount} updates in the last ${timeFrame} ${daysText}. - ${updateCount - maxUpdates} update(s) not shown</a>`;
        }
      }
    });

  // After processing the RSS data
    document.getElementById("statusBanner").addEventListener("click", function() {
      console.log('click')
      let updatesDiv = document.getElementById("updates");
      if (updatesDiv.style.display === "none") {
        updatesDiv.style.display = "block";
      } else {
        updatesDiv.style.display = "none";
      }
    });


    // Check if any updates were found
    if (updateCount === 0) {
      console.log('no ST rss updates found');
      document.getElementById("statusBanner").style.padding = boxPadding;
      let updateHTML = `<div id="noUpdates" style="padding:8px; font-size:16px;">There have been no updates in the last ${timeFrame} ${daysText}.</div>`;
      updatesDiv.innerHTML = updateHTML;
    }

    const descriptions = document.querySelectorAll(".description");

    descriptions.forEach(description => {

      // Save the original full text
      let originalText = description.innerText;

      // Set maximum number of characters to display
      const maxLength = 250;


      // Truncate the text if it exceeds the maximum length
      if (originalText.length > maxLength) {
        description.innerHTML = formatDescription(originalText.substring(0, maxLength) + "...");
      }

      // Check if the updates div has any content
      if (updatesDiv.innerHTML.length > 0) {
        // Add a click event listener to toggle the display of the updates div
        statusDiv.addEventListener("click", function () {
          updatesDiv.classList.toggle("hidden");
        });
        statusDiv.style.display = "block";
      } else {
        statusDiv.style.display = "none";
      }

    });

  })
  // if an error occurred, show a message
  .catch(error => {
    console.log("An error occurred: ", error);

    // Create the wrapper element and the status div
    let wrapper = document.getElementById("wrapper");
    let statusDiv = document.createElement("div");
    statusDiv.setAttribute("id", "statusBanner");

    // Set the styles for the status div
    statusDiv.style.backgroundColor = boxColor;
    statusDiv.style.textAlign = 'left';
    statusDiv.style.color = 'white';
    statusDiv.style.fontSize = '15px';
    statusDiv.style.fontWeight = 'bold';

    statusDiv.innerHTML = `<div id="noData" style="padding:8px; font-size:16px;">Error: No data received from the RSS feed. Reload to try again.</div>`;
    wrapper.insertAdjacentHTML("beforebegin", statusDiv.outerHTML);
  });

