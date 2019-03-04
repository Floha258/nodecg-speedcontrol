'use strict';
$(function () {
    var $timer = $("#theTimer");
    var splitsBeforeStoppingMainTimer = 255;
    var stoppedTimers = 0;
    var moreThanOneTeam = false;
    var splitTimes = [];
    var lastTimerState = "";
// Replicant initialization

    var finishFlags = nodecg.Replicant('finishFlags', {defaultValue:[{hasFinished: false, finishTime: '', finishMedal: ''},{hasFinished: false, finishTime: '', finishMedal: ''},{hasFinished: false, finishTime: '', finishMedal: ''},{hasFinished: false, finishTime: '', finishMedal: ''},]});
    var stopWatchReplicant = nodecg.Replicant('stopwatch');
    stopWatchReplicant.on('change', function (newVal, oldVal) {
        if (!newVal) return;
        var time = newVal.time || '88:88:88';
        switch (newVal.state) {
            case 'paused':
                if(lastTimerState != newVal.state) {
                    $timer.css('color', '#555500');
                    disableMainTimerStopButton(true);
                    playerTimer_disablePersonalSplitButton(true);
                    playerTimer_disablePersonalResetButton(false);
                    disableMainResetButton(true);
					toggleEditButton(false);
                }
                break;
            case 'finished':
                if(lastTimerState != newVal.state) {
                    $timer.css('color', 'green');
                    disableMainTimerStopButton(true);
                    disableMainResetButton(false);
                    playerTimer_disablePersonalSplitButton(true);
                    playerTimer_disablePersonalResetButton(true);
					if (oldVal) nodecg.sendMessage("forceRefreshIntermission");
					toggleEditButton(true);
                }
                break;
            case 'running':
                if(lastTimerState != newVal.state) {
                    $timer.css('color', '#008BB9');
                    if (moreThanOneTeam) {
                        disableMainTimerStopButton(true);
                    }
                    else {
                        disableMainTimerStopButton(false);
                    }
                    disableMainResetButton(true);
                    playerTimer_disablePersonalResetButton(false);
                    playerTimer_disablePersonalSplitButton(false);
                    setPlayButtonToPauseButton();
					toggleEditButton(true);
                }
                break;
            case 'stopped':
                if(lastTimerState != newVal.state) {
                    disableMainTimerStopButton(true);
                    disableMainResetButton(true);
                    playerTimer_disablePersonalResetButton(false);
                    playerTimer_disablePersonalSplitButton(true);
                    $timer.css('color', 'gray');
					toggleEditButton(false);
                }
                break;
            default:
        }
        lastTimerState = newVal.state;
        playerTimer_SetTime(time);
    });

    var runDataActiveRunReplicant = nodecg.Replicant("runDataActiveRun");
    runDataActiveRunReplicant.on('change', function( newValue, oldValue) {
        if( typeof newValue !== 'undefined' && newValue !== '' ) {
            moreThanOneTeam = newValue.teams.length > 1;
              //|| (newValue.players.length >=2) && newValue.teams.length == 1);
            playerTimer_UpdateTimers(newValue);
        }
    });

    var runDataActiveRunRunnerListReplicant = nodecg.Replicant("runDataActiveRunRunnerList");
    // runDataActiveRunRunnerListReplicant.on("change", function (newValue, oldValue) {
    //     if (typeof newValue !== 'undefined' && newValue != '' ) {
    //         if (typeof runDataActiveRunReplicant.value !== 'undefined') {
    //           playerTimer_UpdateTimers(runDataActiveRunReplicant.value);
    //         }
    //
    //     }
    // });

    var finishedTimersReplicant = nodecg.Replicant('finishedTimers');
    finishedTimersReplicant.on('change', function(newValue, oldValue) {
        if(typeof newValue != 'undefined' && newValue != '') {
            if(splitTimes.length != newValue.length) {
                splitTimes = newValue;
                updateSplitTimerTextColor(newValue);
            }
        }
    });

    var activeRunStartTime = nodecg.Replicant('activeRunStartTime');

    function finishFlagForIndex(index) {
        // count finishers to set medal
        var finishers = 0;
        for(var i=0;i<finishFlags.value.length;i++) {
            if (finishFlags.value[i].hasFinished) {
                finishers++;
            }
        }
        if (finishers < 3) {
            finishFlags.value[index].finishMedal = finishers + 1;
        } else {
            finishFlags.value[index].finishMedal = null;
        }
        finishFlags.value[index].finishTime = stopWatchReplicant.value.time;
        finishFlags.value[index].hasFinished = true;
    }

    function unfinishFlagForIndex(index) {
        finishFlags.value[index].hasFinished = false;
    }

    function updateSplitTimerTextColor(timerArray) {
        $.each(timerArray, function(index, value){
            $('#toolbar'+value.index).css('color','#0000dd');
        });
    }

    function resetSplitTimerTextColor(index) {
        $('#toolbar'+index).css('color','white');
    }

    function resetSplitTimes() {
        finishedTimersReplicant.value = [];
        splitTimes = [];
        resetSplitTimerTextColor(0);
        resetSplitTimerTextColor(1);
        resetSplitTimerTextColor(2);
        resetSplitTimerTextColor(3);
        activeRunStartTime.value = 0;
    }

    function splitTimer(splitIndex) {
        var found = false;
        $.each(splitTimes, function(index, value){
            if(value.index == splitIndex) {
                found = true;
                value.time = stopWatchReplicant.value.time;
            }
        });
        if(!found) {
            var newSplit = createSplitTime(splitIndex);
            splitTimes.push(newSplit);
        }
        stoppedTimers = splitTimes.length;

        if (stoppedTimers >= splitsBeforeStoppingMainTimer) {
            nodecg.sendMessage("finishTime");
            nodecg.sendMessage("runEnded")
        }

        finishedTimersReplicant.value = splitTimes;

        $('#toolbar'+splitIndex).css('color','#0000dd');
    }

    function unSplitTimer(splitIndex) {
        var removeIndex = -1;
        $.each(splitTimes, function(index, value){
            if(value.index == splitIndex) {
                removeIndex = index;
                return;
            }
        });

        if(removeIndex != -1) {
            splitTimes.splice(removeIndex, 1);
            finishedTimersReplicant.value = splitTimes;
            resetSplitTimerTextColor(splitIndex);
        }
    }

    function createSplitTime(index) {
        var splitTime = {};
        splitTime.index = index;
        splitTime.time = stopWatchReplicant.value.time;
        splitTime.name = runDataActiveRunReplicant.value.teams[index].name;
        return splitTime;
    }

    function setPlayButtonToPauseButton() {
		$('#play').button();
        var options = {
            label: "pause",
            icons: {
                primary: "ui-icon-pause"
            }
        };
        $('#play').button("option", options);
    }

    function disableMainTimerStopButton(shouldDisable) {
        $("#stop").button({
            disabled: shouldDisable
        })
    }

    function playerTimer_disablePersonalSplitButton(shouldDisable) {
        $(".personalSplitButton").button({
            disabled: shouldDisable
        });
    }

    function playerTimer_disablePersonalResetButton(shouldDisable) {
        $(".personalResetButton").button({
            disabled: shouldDisable
        });
    }

    function disableMainResetButton(shouldDisable) {
        $("#reset").button({
            disabled: shouldDisable
        });
    }
	
	function toggleEditButton(option) {
		$("#edit").button({
			disabled: option
		});
	}

    nodecg.listenFor("resetTime", function () {
        var options = {
            label: "play",
            icons: {
                primary: "ui-icon-play"
            }
        };
        $("#play").button("option", options);
        resetSplitTimes();
    });

    function playerTimer_SetTime(timeHTML) {
        $timer.html(timeHTML);
    }

    function playerTimer_UpdateTimers(run) {
        var players = run.players;
        var toolbarPlayerSpecificHtml = '';
        if ( run.teams.length > 1 ) {
          $.each(run.teams, function( index, value ) {
            toolbarPlayerSpecificHtml += "" +
                '<div id="toolbar' + index + '" class="ui-widget-header ui-corner-all">' +
                '<button id="split' + index + '" class="personalSplitButton">split</button>' +
                '<button id="resetTime' + index + '" class="personalResetButton">reset</button>' +
                " " + value.name +
                '</div>';
          });
        }
        if( moreThanOneTeam ) {
            $('#playerSpecificToolbar').html(toolbarPlayerSpecificHtml);
			      $('#playerTimersHeader').show();

            $('.personalSplitButton').click(function () {
                var index = $(this).attr('id').replace('split', '');
                // kinda ugly: if there is a race with more people in team 1 and team 2 exists
                // the timer on the second screen has to be on the third
                // Maybe I will make this not ugly some day lmao
                if (index == 1 && runDataActiveRunReplicant.value.teams[0].members.length == 2) {
                    finishFlagForIndex(2);
                } else {
                    finishFlagForIndex(index);
                }
                splitTimer(index);
            });
            $('.personalResetButton').click(function () {
                var index = $(this).attr('id').replace('resetTime', '');
                // see above
                if (index == 1 && runDataActiveRunReplicant.value.teams[0].members.length == 2) {
                    unfinishFlagForIndex(2);
                } else {
                    unfinishFlagForIndex(index);
                }
                unSplitTimer(index);
            });

            var shouldBeDisabled = true;
            if (typeof stopWatchReplicant.value != 'undefined' &&
                stopWatchReplicant.value != '' &&
                stopWatchReplicant.value.state == "running") {
                shouldBeDisabled = false;
            }

            $(".personalSplitButton").button({
                text: false,
                disabled: shouldBeDisabled,
                icons: {
                    primary: "ui-icon-check"
                }
            });
            $(".personalResetButton").button({
                text: false,
                disabled: shouldBeDisabled,
                icons: {
                    primary: "ui-icon-close"
                }
            });
        }
        else {
            $('#playerSpecificToolbar').html(toolbarPlayerSpecificHtml);
			      $('#playerTimersHeader').hide();
        }
        splitsBeforeStoppingMainTimer = run.teams.length;
    }

    function OnPlay() {
        var options = {};
        if ($('#play').text().trim() === "play") {
            $("#reset").button({
                disabled: true
            });

            nodecg.sendMessage("startTime");
            if (activeRunStartTime.value === 0) {
                nodecg.sendMessage("runStarted");
            }
            options = {
                label: "pause",
                icons: {
                    primary: "ui-icon-pause"
                }
            };
        } else {
            nodecg.sendMessage("pauseTime");
            options = {
                label: "play",
                icons: {
                    primary: "ui-icon-play"
                }
            };
        }
        $('#play').button("option", options);
    }

    function OnReset() {
        nodecg.sendMessage("resetTime");
        resetSplitTimes();
        if ($('#play').text().trim() === "pause") {
            var options = {
                label: "play",
                icons: {
                    primary: "ui-icon-play"
                }
            };
            $('#play').button("option", options);
        }
        for(var i=0;i<4;i++) {
            unfinishFlagForIndex(i);
        }
    }

    function OnStop() {
        nodecg.sendMessage("finishTime");
        nodecg.sendMessage("runEnded", 0);
        if ($('#play').text().trim() === "pause") {
            var options = {
                label: "play",
                icons: {
                    primary: "ui-icon-play"
                }
            };
            $('#play').button("option", options);
        }
    }
	
	function OnEdit() {
		var currentTime = stopWatchReplicant.value.time || '00:00:00'
		var time = prompt("Please enter new time in either HH:MM:SS or MM:SS format.", currentTime);
		if (time.match(/^(\d+:)?(?:\d{1}|\d{2}):\d{2}$/)) nodecg.sendMessage("setTime", time);
		else alert("The new time is in the wrong format.");
	}

    function playerTimer_InitializeElements() {

        $("#play").button({
            text: false,
            icons: {
                primary: "ui-icon-play"
            }
        }).click(OnPlay);

        $("#reset").button({
            text: false,
            icons: {
                primary: "ui-icon-seek-prev"
            }
        }).click(OnReset);

        $("#stop").button({
            text: false,
            icons: {
                primary: "ui-icon-check"
            },
            disabled: true
        }).click(OnStop);
		
        $("#edit").button({
            text: false,
            icons: {
                primary: "ui-icon-pencil"
            }
        }).click(OnEdit);
    }

    function Initialize_EventListeners(nodecg) {
        //console.log(nodecg)
        nodecg.listenFor("start_run", "nodecg-speedcontrol", function() {
            OnPlay();
        })

        nodecg.listenFor("reset_run", "nodecg-speedcontrol", function() {
            OnReset();
        })

        nodecg.listenFor("reset_stop", "nodecg-speedcontrol", function() {
            OnStop();
        })

        nodecg.listenFor("split_timer", "nodecg-speedcontrol", function(id) {
            console.log("SPLIT-EVENT");
            console.log(id);
            if (moreThanOneTeam) {
                nodecg.sendMessage('timerSplit', id);
            }
            nodecg.sendMessage('timerSplit', id);
            splitTimer(id);
        })
    }

    playerTimer_InitializeElements();
    Initialize_EventListeners(nodecg);
})
