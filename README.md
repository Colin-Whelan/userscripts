# Userscripts for Violent Monkey

These are my collection of userscripts that I use with [Violent Monkey](https://violentmonkey.github.io/) to enhance websites I use. 

Feel free to copy or modify as you like.

- Grouped by the site they are used on

## Adding Scripts

The easiest way to add these scripts is with the URL which allows for easy updates later.

1.  Install [Violent Monkey](https://violentmonkey.github.io/) on the browser of your choice - I recommend pinning it to the toolbar.
2.  Click the extension, then the Gear icon to open the dashboard.
3.  Click the '+' in the top left corner and choose 'Install from URL'
4.  In a separate tab, navigate to the script of your choice.
5.  Click the 'Raw' button on the right hand side.
6.  Copy and paste this URL into the ViolentMonkey URL box.
7.  Click 'OK', then 'Confirm Installation' on the next page.
8.  Reload the dashboard to see the new script added.

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
