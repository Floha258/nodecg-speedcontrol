# nodecg-speedcontrol

![Screenshot](READMES/img/README-screenshot.png)

*This is a bundle for [NodeCG](https://nodecg.com/); if you do not understand what that is, we advise you read their website first for more information.*

nodecg-speedcontrol, usually known as just "Speedcontrol", is a bundle for the [NodeCG](https://nodecg.com/) broadcast graphics framework/application developed for automating tasks for speedrunning marathons, mainly changing information on overlays and updating the Twitch information.

Some basic information:
- Import schedules from [Horaro](https://horaro.org/).
- By default, can store information on the run and the players, but can also be customised to store more if needed by advanced users.
- Automatically change Twitch title and/or game directory if needed.
- Automatically feature the current player(s) on the [FrankerFaceZ](https://www.frankerfacez.com/) featured channels function below the stream.
- Has an inbuilt timer (powered by [livesplit-core](https://github.com/LiveSplit/livesplit-core)); no need to have a seperate application open.
- Support for some donations trackers can be added with extra bundles (see below).

This bundle doesn't come with any graphics, you will need to create them yourself in another bundle. If you have no experience in developing, you can check out [speedcontrol-simpletext](https://github.com/speedcontrol/speedcontrol-simpletext) for an simple example bundle, or check out the [API documentation](READMES/API.md) if you're are more advanced user.

**If you were developing bundles that relied on this bundle before v1.x was released, please check [Migrating from v0.9 to v1.x](READMES/Migrating-from-v0.9-to-v1.x.md).**


## Installation

You will need [Node.js](https://nodejs.org) (10.x LTS tested) and [git](https://git-scm.com/) installed to install NodeCG, then see the [NodeCG documentation](http://nodecg.com/) on how to install that. I also suggest installing `nodecg-cli`; information on that is also on the documentation just linked.

- `nodecg install speedcontrol/nodecg-speedcontrol` to install the latest version of nodecg-speedcontrol

This bundle can run without any extra configuration, but it's needed to use all of the functionality. Please see the [Configuration documentation](READMES/Configuration.md) for more information. You may also want to read the [Schedule Formatting documentation](READMES/Schedule-Formatting.md) for advice on formatting your schedules before importing.

### tl;dr installation

Install [Node.js](https://nodejs.org) (10.x LTS tested) and [git](https://git-scm.com/), then make a folder anywhere and open a command prompt/shell/bash window, then run these commands in order:

```
npm install bower -g
npm install nodecg-cli -g
nodecg setup
nodecg install speedcontrol/nodecg-speedcontrol
nodecg start
```


## Basic Usage

Once installed, go to `https://localhost:9090` (unless you have overridden the defaults in the NodeCG config) to access the dashboard.

To import a schedule, go to the *Run Modifications* workspace along the top, and look for the *Horaro Schedule Import* panel. Paste in a Horaro schedule URL into the text box (it will be automatically pre-filled if you set `schedule.defaultURL` in this bundles config) and click *Load Schedule Data*.

![Schedule Import Before](READMES/img/schedule-import-1.png)

Next you will see a list of dropdowns. These are used to select which columns in your schedule relate to which information in the run data. The import tries to automatically select the appropriate columns, but if something is wrong you can change it here.
Also available here is an option on how the players in the *Players* column should be split; see the [Schedule Formatting documentation](READMES/Schedule-Formatting.md) for more information on what these options mean and how the *Players* column data should be formatted.
Once you have everything selected correctly, click on the *Import* button.

![Schedule Import Settings](READMES/img/schedule-import-2.png)

The schedule will begin importing. If you have the speedrun.com lookup enabled (by default it's enabled) this import may take a while, so be patient. Once the import is done, this panel will turn back to how it was before, and the runs will be listed in the *Run Player* and *Run Editor* panels.

![Schedule Importing](READMES/img/schedule-import-3.png)

To start "playing" runs, go back to the *Main Workspace* and find the *Run Player* panel, and click on the big *Play _* button at the top.

![Run Player Play Button](READMES/img/run-player-playbtn.png)

Next to the above panel should be the *Run Timer* panel. This should be very self explanitory; use the play button to start the timer and use the tick button to end it. You can also reset it if needed, pause it and also use the pencil to edit the time if needed for any reason.

![Run Timer Stopped](READMES/img/run-timer-stopped.png)

If you have enabled the Twitch integration in this bundle's config, there will be a panel in *Main Workspace* called *Twitch Control*, which will have a button to set up the connection with Twitch. Use this to connect the application to your Twitch account.

![Twitch Control Login](READMES/img/twitch-control-1.png)

Once you have done the above, make sure to turn the auto-sync on in the panel, otherwise it will not be done when you change runs. You can also manually update the title, game and the Twitch usernames for the FrankerFaceZ featured channels integration if you have this enabled.

![Twitch Control Logged In](READMES/img/twitch-control-2.png)


## Extra Support Bundles

Alongside the main bundle, there are some extra bundles that we maintain that you may also want to use for speedrunning marathons. See their GitHub pages for more detailed information on how to use them. Be warned they are somewhat undocumented as of now.

To easily install: `nodecg install speedcontrol/BUNDLE-NAME`
- [speedcontrol-tiltify](https://github.com/speedcontrol/speedcontrol-tiltify): Adds a frequently updating donation total amount for a Tiltify campaign you can use in layouts.
- [speedcontrol-srcomtracker](https://github.com/speedcontrol/speedcontrol-srcomtracker): Adds frequently updating donation total/goals/bidwars and messages for new donations for a marathon on [speedrun.com](https://www.speedrun.com) if they are enabled, that you can use in your layouts.
- [speedcontrol-flagcarrier](https://github.com/speedcontrol/speedcontrol-flagcarrier): Adds a server and replicants that can receive requests from ESA's [FlagCarrier android app](https://play.google.com/store/apps/details?id=de.oromit.flagcarrier) so this information can be used in your layouts.


## Where has this bundle been used before?

*(This is not an exhaustive list.)*

- All [European Speedrunner Assembly](https://www.esamarathon.com/) marathons starting from the Pre-ESA Marathon 2016, including the ESA ran Dreamhack speedrunning events in Sweden
- All [GTA Marathons](https://www.twitch.tv/gtamarathon) starting from GTA Marathon 2016
- [SpeedSouls Charity Marathon 2017 and 2018](https://www.twitch.tv/speedsouls)
- [Themeathon Pre-Marathon 2018](https://www.twitch.tv/themeathon)
- Several [Voltathon](https://www.twitch.tv/voltagegg) marathons
- All [DegenDash](https://www.twitch.tv/degendash) marathons
- Some marathons on [The Fast Force](https://www.twitch.tv/thefastforce) Twitch channel
- [A Race Against Time 3](https://www.twitch.tv/araceagainsttime) marathon
- [Power Up With Pride: Winter Pride 2018](https://www.twitch.tv/powerupwithpride) marathon


## Authors/Contributors

Originally developed by Charleon, now mainly developed by zoton2.

With help from:
- btrim
- Zephyyrr
- Planks


## Contribution/Development

The `master` branch will always be the most recent stable release, while all development work is done in the `dev` branch; if you want to use experimental unfinished features or contribute, use that branch.

If you need to report an issue, you can [do that on GitHub](https://github.com/speedcontrol/nodecg-speedcontrol/issues).

Feel free to raise an issue/Pull Request if you have used our bundle(s) for a marathon and would like to be linked above.
