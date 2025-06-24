# Userscripts

These are my collection of userscripts that I use with [TamperMonkey](https://www.tampermonkey.net/) to enhance websites I use. 

Please be aware that these user scripts are dependent on the current structure of the vendor websites they interact with. If these sites update, the scripts may break or fail to function as intended.

Feel free to copy or modify as you like.

## Adding Scripts

The easiest way to add these scripts is with the 'raw' URL which allows for easy updates later.

1.  Install [TamperMonkey](https://www.tampermonkey.net/) on the browser of your choice - Pinning it to the toolbar is recommended.
2.  In a separate tab, navigate to the script of your choice.
3.  Click the 'Raw' button on the right hand side.
  ![in top right of the code section](https://cdn.glitch.global/4c74f8d5-b1a6-4a37-91dc-9b40f9d9d76e/firefox_TY0MXfG7ia.png?raw=true)
4.  Click the extension, then the Gear icon at the bottom to open the dashboard.
5.  Click 'Utilities' in the top right corner.
7.  Paste the URL of the raw script in the 'Install from URL' box and click 'Install'
8.  Click 'Install' in the top left.
9.  Reload the target page to see the new feature.

Now when you navigate to the page from '// @match' near the top of the script, the script will execute.

## Editing Variables

Sometimes, scripts will use variables that need to be customized before they can properly run. 

1. To update, go to the dashboard using the instructions above.
2. Click on the code button for the script in question. Looks like this: </>
3. Near the top of the file right after the information at the top should be the variables that are modifiable. - They will all use 'let' or 'const'

## Refreshing Scripts/Pull Updates
By default, enabled scripts will update every day.

If this is disabled, or you want to check more often, head to the dashboard and click the refresh button in the top left, or the one each script to only check one at a time.
If an update is found, the script will automatically update.

## Reporting Issues

If you encounter any issues, please report them. I will do my best to address and fix them in a timely manner.
