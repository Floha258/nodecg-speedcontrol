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
	require('./stopwatch');
	require('./horaro-import');
	require('./twitchapi');
	require('./csscreater');
	require('./esacontroller');
	require('./ffzws');
	require('./g4g');
	require('./srcomdonations');
	require('./tiltify');
	require('./bingosync');
}