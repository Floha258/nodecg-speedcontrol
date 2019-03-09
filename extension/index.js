'use strict';

// Referencing other files.
var nodecgAPIContext = require('./utils/nodecg-api-context');

module.exports = function(nodecg) {
	// Store a reference to this NodeCG API context in a place where other libs can easily access it.
	// This must be done before any other files are `require`d.
	nodecgAPIContext.set(nodecg);

	// set up Replicants here so they don't have to be declared multiple times
	nodecg.Replicant('bingo-colors', {'persistent':false,'defaultValue':['red','red','red','red']});
    nodecg.Replicant('twitch-streams', {'persistent':false,'defaultValue':[
        {'channel':'speedrunslive','widthPercent':100,'heightPercent':100,'topPercent':0,'leftPercent':0,'quality':'chunked','volume':0.5,'paused':false,'hidden':true},
        {'channel':'speedrunslive','widthPercent':100,'heightPercent':100,'topPercent':0,'leftPercent':0,'quality':'chunked','volume':0.5,'paused':false,'hidden':true},
        {'channel':'speedrunslive','widthPercent':100,'heightPercent':100,'topPercent':0,'leftPercent':0,'quality':'chunked','volume':0.5,'paused':false,'hidden':true},
        {'channel':'speedrunslive','widthPercent':100,'heightPercent':100,'topPercent':0,'leftPercent':0,'quality':'chunked','volume':0.5,'paused':false,'hidden':true},
    ]});

	// Other extension files we need to load.
	require('./run-data');
	require('./timer');
	require('./horaro-import');
	require('./twitchapi');
	require('./ffzws');
	require('./bingosync');
	require('./gdq-donationtracker');
        require('./obs')(nodecg);

	if (nodecg.bundleConfig.discord) {
		if (!nodecg.bundleConfig.discord.test) {
			require('./discord');
		} else {
			const voiceActivity = nodecg.Replicant('voiceActivity', {
				defaultValue: {
					members: []
				}, persistent: true
			});
			const defaultAvatar = 'https://discordapp.com/assets/dd4dbc0016779df1378e7812eabaa04d.png';
			voiceActivity.value = {'members':[
				{id: 0, name: 'abc', avatar: defaultAvatar, isSpeaking: false},
				{id: 1, name: 'testlongname', avatar: defaultAvatar, isSpeaking: true},
				{id: 2, name: 'anotherone', avatar: defaultAvatar, isSpeaking: true},
				{id: 3, name: 'POGGERS', avatar: defaultAvatar, isSpeaking: false},
			]};
		}
	}

	// Basic return, currently to expose the set Twitch client ID to other extensions.
	return {
		twitchClientID: nodecg.bundleConfig.twitch.clientID
	}
}
