// ==UserScript==
// @name        Triggered Send Log - Time Picker
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/reports/transactional_log*
// @grant       none
// @version     1.1
// @author      Colin Whelan
// @description Adds a time picker to the Triggered Send Log. Does an ajax refresh in the background like Native. Works with standard date values or with the raw YYYYMMDDhhmmss date string.
// ==/UserScript==
function applyStyles() {
  // Create a style element
  let style = document.createElement('style');

  // Define the styles
  style.innerHTML = `
        .f_start_time, .f_end_time {
            width: 50px;
        }
        .flatpickr-calendar {
            width: 110px !important;
        }
        .flatpickr-time {
            width: 100% !important;
        }
        .flatpickr-time input {
            width: 28px !important;  // Set a fixed width for hour and minute inputs
            margin-right: 2px;      // Add a small margin to separate the inputs
        }
        .flatpickr-time-separator {
            width: auto !important;  // Allow the separator to take only the space it needs
        }
    `;

  // Append the style element to the document head
  document.head.appendChild(style);
}

function closestFiveMinutes() {
  let date = new Date();
  let minutes = date.getMinutes();
  let hours = date.getHours();
  let remainder = minutes % 5;
  let roundedMinutes = padWithZero(remainder === 0 ? minutes : minutes + (5 - remainder));

  let years = date.getFullYear();
  let months = padWithZero(date.getMonth() + 1);
  let days = padWithZero(date.getDate());


  if (document.getElementById('f_end_date').value.toString().length > 10) {
    document.getElementById('f_end_date').value = `${years}${months}${days}${hours}${roundedMinutes}00`
  }

  return `${padWithZero(date.getHours())}:${padWithZero(roundedMinutes)}`;
}

function insertAfter(referenceNode, newNode) {
  referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

function padWithZero(number) {
  return String(number).padStart(2, '0');
}

function isElementReady() {
  if (!document.getElementById('f_start_date')) {
    setTimeout(isElementReady, 1000);
  } else {
    // Append Flatpickr JS
    let script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/flatpickr';
    document.head.appendChild(script);

    // Append Flatpickr CSS
    let link = document.createElement('link');
    link.href = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    // Wait for script to load
    script.onload = function() {
      console.log("Flatpickr loaded");

      // Add input elements
      let inputStartTime = document.createElement('input');
      inputStartTime.type = 'text';
      inputStartTime.className = 'f_start_time';

      let inputEndTime = document.createElement('input');
      inputEndTime.type = 'text';
      inputEndTime.className = 'f_end_time';

      insertAfter(document.getElementById('f_start_date'), inputStartTime);
      insertAfter(document.getElementById('f_end_date'), inputEndTime);

      // Initialize Flatpickr as time picker
      flatpickr('.f_start_time', {
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i",
        time_24hr: true,
        defaultDate: "12:00",
        onChange: function(selectedDates, dateStr, instance) {
          updateDateTime('f_start_date');
        }
      });

      flatpickr('.f_end_time', {
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i",
        time_24hr: true,
        defaultDate: closestFiveMinutes(), // set the default value
        onChange: function(selectedDates, dateStr, instance) {
          updateDateTime('f_end_date');
        }
      });
    };
  }
}

function formatDate(dateValue, timeValue, dateInput, removeDay = false) {
  let dateParts = dateValue.split("/");

  if (dateParts.length === 3) {
    let days = padWithZero(dateParts[1]);
    if (removeDay) {
      days = padWithZero(days - 1);
    }
    const months = padWithZero(dateParts[0]);
    const years = padWithZero(dateParts[2]);
    let [hours, minutes] = timeValue.split(":").map(padWithZero);
    return `${years}${months}${days}${hours}${minutes}00`;
  } else {
    // already in the timestring
    let [hours, minutes] = timeValue.split(":").map(padWithZero);
    dateInput.value = dateInput.value.substring(0, 8) + hours + minutes + "00";
    return dateValue.substring(0, 8) + hours + minutes + "00";
  }
}

function updateDateTime(dateClass) {
  let dateInput = document.querySelector(`#${dateClass}`);

  // Always retrieve current values from both start and end date fields
  let start_date = document.querySelector("#f_start_date").value;
  let end_date = document.querySelector("#f_end_date").value;

  let start_time = document.querySelector(".f_start_time").value;
  let end_time = document.querySelector(".f_end_time").value;
  let timeStringFormat; // Store the time string format

  if (start_date && end_date) {

    start_date = formatDate(start_date, start_time, dateInput)
    end_date = formatDate(end_date, end_time, dateInput, true)

    // Send the values to the AJAX refresh
    ajax.refresh(dateInput, {
      start: 0,
      start_date: start_date,
      end_date: end_date
    });
  }
}

isElementReady();

applyStyles();
