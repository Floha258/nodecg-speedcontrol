'use strict';
var nodecg = require('./utils/nodecg-api-context').get();
var needle = require('needle');
var async = require('async');
var clone = require('clone');
var md = require('markdown-it')();
var removeMd = require('remove-markdown');

var runDataArray = [];
var runNumberIterator = -1;
var scheduleData;

var defaultSetupTimeReplicant = nodecg.Replicant('defaultSetupTime', {defaultValue: 0});
var horaroRunDataArrayReplicant = nodecg.Replicant('runDataArray', {defaultValue: []});
var scheduleImporting = nodecg.Replicant('horaroScheduleImporting', {defaultValue:{importing:false,item:0,total:0}, persistent:false});

// Temp cache for the user data from SR.com that is kept until the server is restarted.
var userDataCache = nodecg.Replicant('horaroImportUserDataCache', {defaultValue: {}, persistent: false});

var disableSRComLookup = nodecg.bundleConfig.schedule.disableSpeedrunComLookup || false;

nodecg.listenFor('loadScheduleData', (url, callback) => {
	// If the URL has a secret key in it, extract it and form the JSON URL correctly.
	if (url.match((/\?key=/))) url = `${url.match(/(.*?)(?=(\?key=))/)[0]}.json?key=${url.match(/(?<=(\?key=))(.*?)$/)[0]}`;
	else url = `${url}.json`;

	setScheduleData(url, () => callback(null, scheduleData));
});

nodecg.listenFor('importScheduleData', (columns, callback) => {
	nodecg.log.info('Horaro schedule import has started.');
	scheduleImporting.value.importing = true;
	scheduleImporting.value.item = 0;
	runDataArray = [];
	runNumberIterator = -1;

	var runItems = scheduleData.schedule.items;
	scheduleImporting.value.total = runItems.length;
	var defaultSetupTime = scheduleData.schedule.setup_t;
	defaultSetupTimeReplicant.value = defaultSetupTime;
	var itemCounter = 0;

	async.eachSeries(runItems, (run, callback) => {
		itemCounter++;
		scheduleImporting.value.item = itemCounter;
		
		// Check if the game name is part of the ignore list in the config.
		if (run.data && run.data.length && columns.game >= 0 && run.data[columns.game] && checkGameAgainstIgnoreList(run.data[columns.game])) {
			nodecg.log.warn('Run Number ' + itemCounter + ' has a \'Game\' name that is blacklisted in your config file, will not import.');
			return callback();
		}
			
		// We won't import runs with no game name.
		if(!run.data[columns.game] || run.data[columns.game] === '') {
			nodecg.log.error('Run Number ' + itemCounter + ' does not have any value for \'Game\'. This is not ok, will not Import.');
			return callback();
		}
		
		var runData = clone(nodecg.readReplicant('defaultRunDataObject'));
		
		// Game Name
		if (columns.game >= 0 && run.data[columns.game])
			runData.game = parseMarkdown(run.data[columns.game]).str;
		
		// Game Twitch Name
		if (columns.gameTwitch >= 0 && run.data[columns.gameTwitch])
			runData.gameTwitch = parseMarkdown(run.data[columns.gameTwitch]).str;
		
		// Scheduled date/time.
		runData.scheduledS = run.scheduled_t;
		runData.scheduled = run.scheduled;
		
		// Estimate
		runData.estimateS = run.length_t;
		runData.estimate = secondsToTime(run.length_t);
		
		// If the run has a custom setup time, use that.
		if (run.options && run.options.setup && run.options.setup.indexOf('m') > 0) {
			// Kinda dirty right now; assumes the format is Xm (e.g. 15m).
			var setupSeconds = parseInt(run.options.setup.slice(0, -1))*60;
			runData.setupTime = secondsToTime(setupSeconds);
			runData.setupTimeS = setupSeconds;
		}
		
		else {
			runData.setupTime = secondsToTime(defaultSetupTime);
			runData.setupTimeS = defaultSetupTime;
		}
		
		// Category
		if (columns.category >= 0 && run.data[columns.category])
			runData.category = parseMarkdown(run.data[columns.category]).str;
		
		// System
		if (columns.system >= 0 && run.data[columns.system])
			runData.system = parseMarkdown(run.data[columns.system]).str;
		
		// Region
		if (columns.region >= 0 && run.data[columns.region])
			runData.region = parseMarkdown(run.data[columns.region]).str;

		// Release
		if (columns.release >= 0 && run.data[columns.release])
			runData.release = parseMarkdown(run.data[columns.release]).str;
		
		// Custom Data
		// These are stored within the own object in the runData: "customData".
		Object.keys(columns.custom).forEach((col) => {
			runData.customData[col] = ''; // Make sure the key is set for all runs.
			if (columns.custom[col] >= 0 && run.data[columns.custom[col]])
				runData.customData[col] = parseMarkdown(run.data[columns.custom[col]]).str;
		});
		
		// Teams/Players (there's a lot of stuff here!)
		if (columns.player >= 0 && run.data[columns.player]) {
			var splitOption = columns.playerSplit; // 0: vs/vs. - 1: Comma (,) no teams
			var playerList = run.data[columns.player];
			var teamsRaw = [];

			// vs/vs.
			if (splitOption === 0) {
				playerList.split(/\s+vs\.?\s+/).forEach(team => {
					teamsRaw.push({
						name: (team.match(/^(.+)(?=:\s)/)) ? team.match(/^(.+)(?=:\s)/)[0] : null, // Either will be a string or null.
						players: team.replace(/^(.+)(:\s)/, '').split(/\s*,\s*/)
					})
				});
			}

			// Comma (,)
			else if (splitOption === 1) {
				playerList.split(/\s*,\s*/).forEach(team => {
					teamsRaw.push({
						name: (team.match(/^(.+)(?=:\s)/)) ? team.match(/^(.+)(?=:\s)/)[0] : null, // Either will be a string or null.
						players: [team.replace(/^(.+)(:\s)/, '')] // Making the single string into an array.
					})
				});
			}

			async.eachSeries(teamsRaw, function(rawTeam, callback) {
				// Getting the players on this team.
				var players = rawTeam.players;
				var team = clone(nodecg.readReplicant('defaultTeamObject'));
				runData.teamLastID++;
				team.id = runData.teamLastID;
				if (rawTeam.name) team.name = parseMarkdown(rawTeam.name).str;
				
				// Going through the list of players.
				async.eachSeries(players, function(rawPlayer, callback) {
					var playerName = parseMarkdown(rawPlayer).str;
					var URI = parseMarkdown(rawPlayer).url;
					
					getDataFromSpeedrunCom(playerName, URI, function(regionCode, twitchURI) {
						// Creating the player object.
						var player = clone(nodecg.readReplicant('defaultPlayerObject'));
						player.name = playerName;
						player.teamID = team.id;
						player.country = regionCode;
						runData.playerLastID++;
						player.id = runData.playerLastID;

						// Get/set Twitch username from URL.
						var url = twitchURI || URI;
						if (url && url.includes('twitch.tv')) {
							url = url.split('/')[url.split('/').length-1];
							player.social.twitch = url;
						}
						
						// Push this object to the relevant arrays where it is stored.
						team.players.push(player);
						callback();
					});
				}, function(err) {
					runData.teams.push(team);
					callback();
				});
			}, function(err) {
				// Adding run if we have player(s) and we've checked them all.
				horaro_AddRun(runData);
				callback();
			});
		}
		
		else {
			// Adding run if we have no players.
			horaro_AddRun(runData);
			callback();
		}
	}, function(err) {
		horaro_finalizeRunList();
		scheduleImporting.value.importing = false;
		nodecg.log.info('Horaro schedule import has successfully finished.');
		callback(null);
	});
});

function setScheduleData(url, callback) {
	needle.get(url, (err, resp) => {
		scheduleData = resp.body;
		callback();
	});
}

function checkGameAgainstIgnoreList(game) {
	// Checking if we have a list of games to ignore on the schedule.
	if (nodecg.bundleConfig && nodecg.bundleConfig.schedule && nodecg.bundleConfig.schedule.ignoreGamesWhileImporting) {
		var ignoredGames = nodecg.bundleConfig.schedule.ignoreGamesWhileImporting;
		for (var i = 0; i < ignoredGames.length; i++) {
			var regex = new RegExp('\\b' + ignoredGames[i] + '\\b');
			if (game.match(regex)) return true;
		}
	}
	// If we reach here, the game is fine to be used.
	return false;
}

// Tries to find the specified user on speedrun.com and get their country/region and Twitch if needed.
function getDataFromSpeedrunCom(username, twitch, callback) {
	// If speedrun.com lookup is disabled, just return undefined here.
	if (disableSRComLookup) {
		return callback(undefined, undefined);
	}

	if (userDataCache.value[username]) {
		extractInfoFromSRComUserData(userDataCache.value[username], (SRComRegion, SRComTwitch) => {
			callback(SRComRegion, SRComTwitch);
		});
	}
	
	else {
		var foundUserData;
		
		// Gets the actual "Twitch" username (should work for other sites too, not tested) from the URL.
		if (twitch) {
			twitch = twitch.split('/');
			twitch = twitch[twitch.length-1];
		}
		
		async.waterfall([
			function(callback) {
				if (twitch) {
					var url = 'https://www.speedrun.com/api/v1/users?max=1&lookup='+twitch.toLowerCase();
					
					querySRComForUserData(url, function(data) {
						if (data) foundUserData = data;
						callback();
					});
				}
				
				else callback();
			},
			function(callback) {
				if (!foundUserData) {
					var url = 'https://www.speedrun.com/api/v1/users?max=1&lookup='+username.toLowerCase();
					
					querySRComForUserData(url, function(data) {
						if (data) foundUserData = data;
						callback();
					});
				}
				
				else callback();
			}
		], function(err, result) {
			var foundRegion, foundTwitch;
			
			if (foundUserData) {
				// Store in the very temp cache if the user was found.
				userDataCache.value[username] = foundUserData;
				
				extractInfoFromSRComUserData(foundUserData, (SRComRegion, SRComTwitch) => {
					foundRegion = SRComRegion;
					foundTwitch = SRComTwitch;
				});
			}
			
			// 1 second delay on calling back so we don't stress the Speedrun.com API too much.
			setTimeout(function() {callback(foundRegion, foundTwitch);}, 1000);
		});
	}
}

// Helper function for above.
function querySRComForUserData(url, callback) {
	var success = false;
	async.whilst(
		function() {return !success},
		function(callback) {
			needle.get(url, (err, resp) => {
				if (!err) {
					success = true;
					if (resp.body.data.length > 0)
						callback(resp.body.data[0]);
					else
						callback();
				}
				else
					callback();
			});
		},
		callback
	);
}

// Helper function for above.
function extractInfoFromSRComUserData(data, callback) {
	var regionCode = getUserRegionFromSRComUserData(data);
	var twitchURI = getTwitchFromSRComUserData(data);
	if (regionCode) var foundRegion = regionCode;
	if (twitchURI) var foundTwitch = twitchURI;
	callback(foundRegion, foundTwitch);
}

// Helper function for above.
function getUserRegionFromSRComUserData(data) {
	if (data.location)
		return data.location.country.code;
	else
		return false;
}

// Helper function for above.
function getTwitchFromSRComUserData(data) {
	if (data.twitch && data.twitch.uri)
		return data.twitch.uri;
	else
		return false;
}

// Used to parse Markdown from schedules.
// Currently returns URL of first link (if found) and a string with all formatting removed.
function parseMarkdown(str) {
	var results = {url: undefined, str: undefined};
	if (!str) return results; // If no string is provided, just end early.
	var res; try {res = md.parseInline(str);} catch(err) {} // Some stuff can break this, so catching it if needed.
	if (res && res[0] && res[0].children && res[0].children.length) {
		for (const child of res[0].children) {
			if (child.type === 'link_open' && child.attrs.length && child.attrs[0] && child.attrs[0].length && child.attrs[0][0] === 'href') {
				results.url = child.attrs[0][1];
				break;
			}
		}
	}
	results.str = removeMd(str);
	return results;
}

// Called as a process when pushing the "add run" button.
function horaro_AddRun(runData) {
	runNumberIterator++;
	runData.id = runNumberIterator;
	runDataArray.push(runData);
}

function horaro_finalizeRunList() {
	horaroRunDataArrayReplicant.value = runDataArray;
	horaro_SetLastID();
}

// All the runs have a unique ID attached to them.
var runDataLastID = nodecg.Replicant('runDataLastID');
function horaro_SetLastID() {
	runDataLastID.value = runNumberIterator;
}

function secondsToTime(duration) {
	var seconds = parseInt(duration % 60);
	var minutes = parseInt((duration / 60) % 60);
	var hours = parseInt(duration / (3600));
	
	hours = (hours < 10) ? '0' + hours : hours;
	minutes = (minutes < 10) ? '0' + minutes : minutes;
	seconds = (seconds < 10) ? '0' + seconds : seconds;
	
	return hours + ':' + minutes + ':' + seconds;
}