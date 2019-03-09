'use strict';

var WebSocket = require('ws');
var TwitchJS = require('twitch-js');
var async = require('async');

var nodecg = require('./utils/nodecg-api-context').get();
var accessToken;
var messageNumber;
var ffzWS;
var ffzWSConnected = false;
var pingTimeout;
var ffzFollowButtonsReplicant;
var twitchChannelName;

if (nodecg.bundleConfig && nodecg.bundleConfig.twitch && nodecg.bundleConfig.twitch.enable && nodecg.bundleConfig.twitch.ffzIntegration) {
	nodecg.log.info("FrankerFaceZ integration is enabled.");

	nodecg.listenFor('updateFFZFollowing', setFFZFollowing);
	
	// Used to store whatever the WS says are the current buttons on the page.
	ffzFollowButtonsReplicant = nodecg.Replicant('ffzFollowButtons', {persistent: false});
	
	// Waits until we have the Twitch access code before doing anything.
	twitchChannelName = nodecg.Replicant('twitchChannelName');
	var accessTokenReplicant = nodecg.Replicant('twitchAccessToken');
	twitchChannelName.on('change', function(newValue, oldValue) {
		accessToken = accessTokenReplicant.value;
		if (newValue && !oldValue)
			connectToWS(() => {/* connection to ws done */});
	});
	accessTokenReplicant.on('change', (newVal, oldVal) => {
		accessToken = newVal;
	});
}

function connectToWS(callback) {
	// Initial messages to send on connection.
	var messagesToSend = [
		'setuser "' + twitchChannelName.value + '"',
		'sub "room.' + twitchChannelName.value + '"',
		'sub "channel.' + twitchChannelName.value + '"',
		'ready 0'
	];

	// Reset message number and connect.
	messageNumber = 1;
	var serverURL = pickServer();
	ffzWS = new WebSocket(serverURL);
	nodecg.log.info('Connecting to FrankerFaceZ ('+serverURL+').');

	// Catching any errors with the connection. The "close" event is also fired if it's a disconnect.
	ffzWS.on('error', function(error) {
		nodecg.log.warn("Error occurred on the FrankerFaceZ connection:");
		nodecg.log.warn(error);
	});

	ffzWS.once('open', function() {
		nodecg.log.info('Connection to FrankerFaceZ successful.');
		ffzWS.send('1 hello ["nodecg-speedcontrol",false]');
	});

	// If we disconnect, just run this function again after a delay to reconnect.
	ffzWS.once('close', function() {
		nodecg.log.warn('Connection to FrankerFaceZ closed, will reconnect in 10 seconds.');
		ffzWSConnected = false;
		clearTimeout(pingTimeout);
		setTimeout(connectToWS, 10000);
	});

	ffzWS.once('message', function(data) {
		if (data.indexOf('1 ok') === 0) {
			messageNumber++;

			// Loop to send all the messages we need on connect.
			var i = 0;
			async.whilst(
				function() {return i < 4;},
				function(callback) {
					sendMessage(messagesToSend[i], function(message) {
						if (message === 'ok') {i++; callback();}
					});
				},
				function(err) {
					ffzWSConnected = true;
					pingTimeout = setTimeout(ping, 60000); // PING every minute
					if (callback) {callback();}
				}
			);
		}
	});

	// For -1 messages.
	ffzWS.on('message', function(data) {
		if (data.indexOf('-1') === 0) {
			// If we need to authorize with FFZ, gets the auth code and does that.
			// Original command will still be executed once authed, so no need for any other checking.
			if (data.indexOf('-1 do_authorize') === 0) {
				var authCode = JSON.parse(data.substr(16));
				sendAuthThroughTwitchChat(authCode);
			}

			// This is returned when the follower buttons are updated (including through this script).
			else if (data.indexOf('-1 follow_buttons') === 0) {
				//nodecg.log.info('Got follow_buttons from FrankerFaceZ connection.');
				ffzFollowButtonsReplicant.value = JSON.parse(data.substr(18))[twitchChannelName.value];
			}
		}
	});
}

// Used to update the following buttons/emoticons on Twitch.
// usernames is an array of Twitch usernames; if blank it will remove any channels already there.
function setFFZFollowing(usernames) {
	nodecg.log.info('Attempting to set FrankerFaceZ Twitch names.');
	// Checks to make sure we are connected and can do this.
	if (ffzWSConnected) {
		//nodecg.log.info('Sent FrankerFaceZ Twitch names.');
		sendMessage('update_follow_buttons ' + JSON.stringify([twitchChannelName.value,usernames]), function(message) {
			var updatedClients = JSON.parse(message.substr(3))['updated_clients'];
			nodecg.log.info('FrankerFaceZ buttons have been updated for ' + updatedClients + ' viewers.');
		});
	}
}

// Used to send a message over the WebSocket; calls back the message when it gets the "ok" message back.
function sendMessage(message, callback) {
	ffzWS.send(messageNumber + ' ' + message);
	var thisMessageNumber = messageNumber; messageNumber++;

	var messageEvent; ffzWS.on('message', messageEvent = function(data) {
		if (data.indexOf(thisMessageNumber + ' ok') === 0) {
			ffzWS.removeListener('message', messageEvent);
			if (callback) {callback(data.substr(data.indexOf(' ')+1));}
		}
	});
}

function ping() {
	var pongWaitTimeout;
	ffzWS.ping();

	var listenerFunc = function(data) {
		clearTimeout(pongWaitTimeout);
		pingTimeout = setTimeout(ping, 60000); // PING every minute
		ffzWS.removeListener('pong', listenerFunc);
	}
	ffzWS.on('pong', listenerFunc);
	
	// Disconnect if a PONG was not received within 10 seconds.
	pongWaitTimeout = setTimeout(function() {
		nodecg.log.warn('FrankerFaceZ PING/PONG failed, terminating connection.');
		ffzWS.removeListener('pong', listenerFunc);
		ffzWS.terminate();
	}, 10000);
}

// Used to send the auth code for updating the following buttons/emotes when needed.
function sendAuthThroughTwitchChat(auth) {
	nodecg.log.info('Attempting to authenticate with FrankerFaceZ.');
	
	// Settings for the temporary Twitch chat connection.
	var options = {
		options: {
			//debug: true  // might want to turn off when in production
		},
		connection: {
			secure: true
		},
		identity: {
			username: twitchChannelName.value,
			password: accessToken
		}
	};

	var client = new TwitchJS.client(options);
	client.connect();

	client.once('connected', function(address, port) {
		nodecg.log.info('Connected to Twitch chat to authenticate with FrankerFaceZ.');
		// Send the auth code to the specific Twitch channel.
		client.say('frankerfacezauthorizer', 'AUTH ' + auth);

		// Giving it 5 seconds until we disconnect just to make sure the message was sent.
		setTimeout(function() {client.disconnect();}, 5000);
	});
}

// Picks a server randomly, 1-2-2-2 split in which it picks.
function pickServer() {
	switch(randomInt(0, 7)) {
		case 0:
			return 'wss://catbag.frankerfacez.com/';
		case 1:
		case 2:
			return 'wss://andknuckles.frankerfacez.com/';
		case 3:
		case 4:
			return 'wss://tuturu.frankerfacez.com/';
		case 5:
		case 6:
			return 'wss://lilz.frankerfacez.com/';
	}
}

// Function to return a random integer.
function randomInt(low, high) {
	return Math.floor(Math.random() * (high - low) + low);
}
