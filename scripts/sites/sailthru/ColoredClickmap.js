// ==UserScript==
// @name        Sailthru Clickmap Heatmap - sailthru.com
// @namespace   Violentmonkey Scripts
// @match       https://my.sailthru.com/reports/campaign*
// @grant       none
// @version     1.0
// @author      -
// @description Converts the raw values of the campaign report to a colored heat map.
// @require https://code.jquery.com/jquery-3.6.0.min.js
// ==/UserScript==

// Wrap the code in a function
function updateHeatmap() {
    // Clear existing unique classes
    $('[class^="heatmap-"]').removeClass(function(index, className) {
        return (className.match(/(^|\s)heatmap-\S+/g) || []).join(' ');
    });

    let clickValues = [];

    const isPercentMode = $('.clickmap_select').val() === 'click_percentage';

    // Collect all the click numbers first
    $('td.pad span').each(function() {
        const text = $(this).text().trim().replace('%','');
        const isNumber = !isNaN(text) && !isNaN(parseFloat(text));
        const clicks = isNumber ? parseFloat(text) : null;

        if (!isNaN(clicks)) {
            clickValues.push(clicks);
        }
    });

    // Determine min and max click values
    const minClicks = Math.min(...clickValues);
    const maxClicks = Math.max(...clickValues);

    // Function to dynamically map click numbers to colors
    function getHeatmapColor(clicks) {
        const ratio = (clicks) / (maxClicks);
        let hue = 0;

        if (ratio < 0.25) {
            hue = 0 + (ratio / 0.25) * 30; // Red to Orange
        } else if (ratio < 0.5) {
            hue = 30 + ((ratio - 0.25) / 0.25) * 30; // Orange to Yellow
        } else if (ratio < 0.75) {
            hue = 60 + ((ratio - 0.5) / 0.25) * 60; // Yellow to Green
        } else {
            hue = 120; // Green
        }

        return `hsl(${hue}, 100%, 50%)`;
    }



    // Iterate over each <td> element containing the click number and image
    $('td.pad').each(function() {
        const $td = $(this);
        const $span = $td.find('span');

        const clicks = parseInt($span.text(), 10);
        if (!isNaN(clicks)) {
           const color = getHeatmapColor(clicks);

          // Generate a unique class for each color to add as a pseudo-element for the fade effect
          const uniqueClass = 'heatmap-' + clicks;
          // console.log('uniqueClass: ', uniqueClass, clicks)

          // Inject styles for the pseudo-element
          $('head').append(`
              <style>
                  .${uniqueClass}::before {
                      content: "";
                      position: absolute;
                      width: 400%;
                      height: 400%;
                      top: -150%;
                      left: -150%;
                      right: -150%;
                      bottom: -150%;
                      background: radial-gradient(circle, ${color} 0%, transparent 100%);
                      z-index: -1;
                  }
              </style>
          `);

          // Add the unique class to the span and adjust its position
          $span.addClass(uniqueClass);

          // Move the number down a bit to align with the image a bit better
          const thisImg = $td.find('img');
          if(thisImg.get(0)) {
            const marginTop = thisImg.get(0).height * .13

            $span.css({
                'margin-top': `${marginTop}px`,
                'font-weight': 'bold',
                'font-size': '16px',
                'color': 'white',
                'text-shadow': '0px 0px 3px black, 0px 0px 3px black, 0px 0px 3px black, 0px 0px 3px black'
            })
          } else {

            $span.css({
                'font-weight': 'bold',
                'font-size': '16px',
                'color': 'white',
                'text-shadow': '0px 0px 3px black, 0px 0px 3px black, 0px 0px 3px black, 0px 0px 3px black'
            })

          }
        }


    });
}

// Initially call the function to set up the heatmap
updateHeatmap();

// Add a change event listener to the select dropdown
$('.clickmap_select').change(function() {
    updateHeatmap();
});
