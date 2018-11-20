'use strict';
$(function() {
	// Declaring variables/replicants.
	var runDataArrayReplicant = nodecg.Replicant('runDataArray');
	var runDataActiveRunReplicant = nodecg.Replicant('runDataActiveRun');
	var runDataLastIDReplicant = nodecg.Replicant('runDataLastID');
	var defaultSetupTimeReplicant = nodecg.Replicant('defaultSetupTime', {defaultValue: 0});
	var runDataEditRunReplicant = nodecg.Replicant('runDataEditRun', {defaultValue: -1, persistent: false});
	var streamsReplicant = nodecg.Replicant('twitch-streams');
	var runInfo = {};
	var currentRunID = -1;
	
	// Dialog related elements for ease of access to change parts later.
	var dialogElement = $(nodecg.getDialog('run-info'));
	var dialogTitle = $('h2', dialogElement);
	var dialogConfirmButton = $('paper-button[dialog-confirm]', dialogElement);
	var dialogDismissButton = $('paper-button[dialog-dismiss]', dialogElement);
	
	// When the replicant used to store the run we want to edit is changed.
	runDataEditRunReplicant.on('change', (newVal, oldVal) => {
		if (newVal === undefined || newVal === null) return;
		currentRunID = newVal;
		
		// If we want to add a new run, the value is -1.
		if (newVal < 0) {
			resetInputs();
			dialogTitle.text('Add New Run');
			dialogConfirmButton.text('add run');
		}
		
		else {
			dialogTitle.text('Edit Run');
			dialogConfirmButton.text('save changes');
			
			runInfo = runDataArrayReplicant.value[getRunIndexInRunDataArray(newVal)];
			$('#allTeamsInput').html(''); // Remove blank data fields.
			
			// Populate fields with relevant data.
			$('#gameInput').val(runInfo.game);
			$('#gameTwitchInput').val(runInfo.gameTwitch);
			$('#categoryInput').val(runInfo.category);
			$('#estimateInput').val(runInfo.estimate);
			$('#systemInput').val(runInfo.system);
			$('#regionInput').val(runInfo.region);
			$('#setupTimeInput').val(runInfo.setupTime);
			
			// Currently only supporting the first runner in a team.
			var teamData = runInfo.teams;
			if (teamData.length === 0) {
				// nothing
			} else {
				for (var i = 0; i < teamData.length; i++) {
					var team = teamData[i];
					addTeamFields(team);
				}
			}
		}
	});
	
	// For when the "add/edit run" button is pressed.
	document.addEventListener('dialog-confirmed', () => {
		// Pulling data from the form to construct the run data object.
		var newRunData = {};
		
		newRunData.game = $('#gameInput').val();
		
		// Ghetto prompt if verification fails (for now).
		// Only picks up on checking if a game name is set; other things are just dropped for now.
		if (!newRunData.game.length) {
			alert('Run not saved because there was no game name provided.');
			return;
		}
		
		newRunData.gameTwitch = $('#gameTwitchInput').val();
		newRunData.category = $('#categoryInput').val();
		
		// Estimate processing.
		var estimate = $('#estimateInput').val();
		if (estimate.match(/^(\d+:)?(?:\d{1}|\d{2}):\d{2}$/) || !isNaN(estimate)) {
			var estimateInMS = timeToMS($('#estimateInput').val());
			newRunData.estimate = msToTime(estimateInMS);
			newRunData.estimateS = estimateInMS/1000;
		}
		else {
			newRunData.estimate = msToTime(0);
			newRunData.estimateS = 0;
		}
		
		// Setup time processing.
		var setupTime = $('#setupTimeInput').val();
		if (setupTime.match(/^(\d+:)?(?:\d{1}|\d{2}):\d{2}$/) || !isNaN(setupTime)) {
			var setupTimeInMS = timeToMS($('#setupTimeInput').val());
			newRunData.setupTime = msToTime(setupTimeInMS);
			newRunData.setupTimeS = setupTimeInMS/1000;
		}
		else {
			newRunData.setupTime = msToTime(0);
			newRunData.setupTimeS = 0;
		}
		
		newRunData.system = $('#systemInput').val();
		newRunData.region = $('#regionInput').val();
		newRunData.teams = [];
		newRunData.players = [];
		newRunData.screens = []; // unused
		newRunData.cameras = []; // unused
		newRunData.customData = {};
		newRunData.scheduled = undefined;
		newRunData.scheduledS = 0;
		
		// Going through every team
		$('.teamInput').each(function(index) {
			var $this = $(this);
			var teamName = $this.find('.teamNameInput').val();
			if (!teamName) return;

			var team = {
				name: teamName,
				custom: false,
				members: []
			};

			// get all players in the team
			// Going through all the player detail inputs to continue the above.
			$this.find('.playerInput').each(function(index) {
				var playerName = $(this).find('.playerNameInput').val();
				if (!playerName.length) return true; // Skip this player.
				
				// At some point we will try and pull these from speedrun.com.
				var twitchURI = $(this).find('.playerStreamInput').val();
				var region = $(this).find('.playerRegionInput').val();
				
				var memberObj = {
					names: {
						international: playerName
					},
					twitch: {
						uri: (twitchURI.length)?twitchURI:undefined
					},
					team: team.name,
					region: (region.length)?region:undefined
				};
				
				team.members.push(memberObj);
				newRunData.players.push(memberObj);
			});
			newRunData.teams.push(team);
		});
		

		// Add back the custom data if this is an edit and it's needed.
		if (runInfo && runInfo.customData)
			newRunData.customData = runInfo.customData;

		// Add back in the scheduled time data if applicable.
		if (runInfo && runInfo.scheduled)
			newRunData.scheduled = runInfo.scheduled;
		if (runInfo && runInfo.scheduledS)
			newRunData.scheduledS = runInfo.scheduledS;
		
		// If we're adding a new run.
		if (currentRunID < 0) {
			newRunData.runID = runDataLastIDReplicant.value;
			runDataLastIDReplicant.value++;
			if (!runDataArrayReplicant.value) // If there we no runs yet, make the array.
				runDataArrayReplicant.value = [newRunData];
			else
				runDataArrayReplicant.value.push(newRunData);
		}
		
		// If an old run is being edited.
		else {
			newRunData.runID = runInfo.runID;
			runDataArrayReplicant.value[getRunIndexInRunDataArray(runInfo.runID)] = newRunData;
			
			// If the run being edited is the currently active run, update those details too.
			if (runDataActiveRunReplicant.value && runInfo.runID == runDataActiveRunReplicant.value.runID) {
				runDataActiveRunReplicant.value = newRunData;
				// and update the streams// grab all runners
				var index = 0;
				for (index in newRunData.players) {
					const curPlayerTwitch = newRunData.players[index].twitch;
					if (!curPlayerTwitch || !curPlayerTwitch.uri) {
						nodecg.log.error('Twitch name for player '+index+' missing!');
						streamsReplicant.value[index].paused = true;
						streamsReplicant.value[index].hidden = true;
						continue;
					}
					const match = curPlayerTwitch.uri.match(/https?:\/\/www.twitch.tv\/(.*)/);
					if (match && match[1]) {
						streamsReplicant.value[index].channel = match[1];
						streamsReplicant.value[index].hidden = false;
					}
				}
				index++;
				// hide/mute/stop all other streams
				while (index < 4) {
					streamsReplicant.value[index].paused = true;
					streamsReplicant.value[index].hidden = true;
					index++;
				}
			}
		}
		
		runDataEditRunReplicant.value = -1;
		resetInputs();
	});
	
	// When the cancel/close button is pressed.
	document.addEventListener('dialog-dismissed', () => {
		runDataEditRunReplicant.value = -1;
		resetInputs();
	});
	
	// Needs moving to a seperate file; this is copy/pasted in a few places.
	// Gets index of the run in the array by the unique ID given to the run.
	function getRunIndexInRunDataArray(runID) {
		if (!runDataArrayReplicant.value) return -1;
		for (var i = 0; i < runDataArrayReplicant.value.length; i++) {
			if (runDataArrayReplicant.value[i].runID === runID) {
				return i;
			}
		}
		return -1;
	}
	
	$('#addExtraTeamButton').click(function() {
		addTeamFields();
	});

	function addTeamFields(teamInfo) {
		var teamInputs = '<div class="teamInput"><button type="button" class="removeTeamButton">- Remove Team</button><input class="teamNameInput" placeholder="Team Name"><div class="allPlayersInput"></div><button type="button" class="addExtraPlayerButton">+ Add Extra Player</button></div>';
		var $teamInputs = $(teamInputs);
		$teamInputs.find('button.removeTeamButton').click((event)=>{
			$(event.target).parent().remove();
		});
		$teamInputs.find('button.addExtraPlayerButton').click(()=>{
			addRunnerFields(null, $teamInputs.find('.allPlayersInput'));
		});
		$('#allTeamsInput').append($teamInputs);
		if (teamInfo) {
			$teamInputs.find('.teamNameInput').val(teamInfo.name);
			// if needed add players
			teamInfo.members.forEach(member => {
				addRunnerFields(member, $teamInputs.find('.allPlayersInput'));
			});
		}

	}
	
	function addRunnerFields(runnerInfo, $runnerContainer) {
		var $playerInputs = '<span class="playerInput">';
		
		// HTML for fields.
		$playerInputs += '<button type="button" class="removeRunnerButton">- Remove Player</button><input class="playerNameInput" placeholder="Player\'s Username"><input class="playerStreamInput" placeholder="Player\'s Stream URL (e.g. https://twitch.tv/trihex)"><input class="playerRegionInput" placeholder="Player\'s Country Code (e.g. SE)"></span>';
		
		$playerInputs = $($playerInputs);
		
		// If runner info was supplied to this function, fill it in.
		if (runnerInfo) {
			$playerInputs.find('.playerNameInput').val(runnerInfo.names.international);
			$playerInputs.find('.playerStreamInput').val(runnerInfo.twitch.uri);
			$playerInputs.find('.playerRegionInput').val(runnerInfo.region);
		}
		
		// Action to do when the "Remove Player" button is clicked.
		$('.removeRunnerButton', $playerInputs).click(event => {
			$(event.target).parent().remove();
		});
		
		$runnerContainer.append($playerInputs);
	}
	
	// Reset form and inputs back to default.
	function resetInputs() {
		$('#gameDetailsInputs input').val('');
		if (defaultSetupTimeReplicant.value > 0)
			$('#setupTimeInput').val(msToTime(defaultSetupTimeReplicant.value*1000));
		$('#allTeamsInput').html('');
	}
	
	// Needs moving to a seperate file; this is copy/pasted in a few places.
	function msToTime(duration) {
		var minutes = parseInt((duration/(1000*60))%60),
			hours = parseInt((duration/(1000*60*60))%24),
			seconds = parseInt((duration/1000)%60);
		
		hours = (hours < 10) ? '0' + hours : hours;
		minutes = (minutes < 10) ? '0' + minutes : minutes;
		seconds = (seconds < 10) ? '0' + seconds : seconds;

		return hours + ':' + minutes + ':' + seconds;
	}
	
	// Needs moving to a seperate file; this is copy/pasted in a few places.
	function timeToMS(duration) {
		var ts = duration.split(':');
		if (ts.length === 2) ts.unshift('00'); // Adds 0 hours if they are not specified.
		return Date.UTC(1970, 0, 1, ts[0], ts[1], ts[2]);
	}
});