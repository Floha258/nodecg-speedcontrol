// Stuff to improve/fix:
// Include all of the FFZ WS addresses.
// If the connection fails in some way, I'm pretty sure the whole program will crash.

'use strict';

var WebSocket = require('ws');
var tmi = require('tmi.js');
var async = require('async');

var nodeCgExport;
var accessToken;
var ffzWSAddress = 'wss://catbag.frankerfacez.com/';
var messageNumber;
var ffzWS;
var ffzWSConnected = false;

module.exports = function(nodecg) {
	console.log('FFZ WS');  // temp debug message
	
	//nodeCgExport.listenFor('updateFFZFollowing', setFFZFollowing);
	
	// Waits until the user has logged into their Twitch account before doing anything.
	nodecg.listenFor('twitchLoginSuccessful', function(oauth) {
		console.log(oauth);  // temp debug message
		accessToken = oauth;
		
		connectToWS(function() {
			// connection to ws done
			console.log('connected to FFZ WS');  // temp debug message
		});
	});
	
	nodeCgExport = nodecg;
}

function connectToWS(callback) {
	// Initial messages to send on connection.
	var messagesToSend = [
		'setuser "' + nodeCgExport.bundleConfig.user + '"',
		'sub "room.' + nodeCgExport.bundleConfig.user + '"',
		'sub "channel.' + nodeCgExport.bundleConfig.user + '"',
		'ready 0'
	];
	
	// Reset message number and connect.
	messageNumber = 1;
	ffzWS = new WebSocket(ffzWSAddress);
	
	ffzWS.once('open', function() {
		ffzWS.send('1 hello ["nodecg-speedcontrol",false]');
	});
	
	// If we disconnect, just run this function again after a delay to reconnect.
	ffzWS.once('close', function() {
		ffzWSConnected = false;
		setTimeout(connectToWS, 60000);
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
				function(err) {ffzWSConnected = true; if (callback) {callback();}}
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
		}
	});
}

// Used to update the following buttons/emoticons on Twitch.
// usernames is an array of Twitch usernames.
function setFFZFollowing(usernames) {
	// Checks to make sure we are connected and can do this.
	if (ffzWSConnected) {
		sendMessage('update_follow_buttons ' + JSON.stringify([nodeCgExport.bundleConfig.user,usernames]), function(message) {
			// message should be like: ok {"updated_clients":n}
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

// Used to send the auth code for updating the following buttons/emotes when needed.
function sendAuthThroughTwitchChat(auth) {
	// Settings for the temporary Twitch chat connection.
	var options = {
		options: {
			debug: true  // might want to turn off when in production
		},
		connection: {
			secure: true
		},
		identity: {
			username: nodeCgExport.bundleConfig.user,
			password: accessToken
		}
	};
	
	var client = new tmi.client(options);
	client.connect();
	
	client.once('connected', function(address, port) {
		// Send the auth code to the specific Twitch channel.
		client.say('frankerfacezauthorizer', 'AUTH ' + auth);
		
		// Giving it 5 seconds until we disconnect just to make sure the message was sent.
		setTimeout(function() {client.disconnect();}, 5000);
	});
}