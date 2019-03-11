'use-strict'

var TwitchJS = require('twitch-js');

var nodecg = require('./utils/nodecg-api-context').get();

// Map<str, {response:bla, enabled:true, cooldown:0, lastUsed:123456}>
var chatCommandsRep = nodecg.Replicant('chatCommands', {defaultValue: {}});

// Setting up replicants.
var accessToken = nodecg.Replicant('twitchAccessToken');
var refreshToken = nodecg.Replicant('twitchRefreshToken');
var twitchChannelInfo = nodecg.Replicant('twitchChannelInfo');
var twitchChannelID = nodecg.Replicant('twitchChannelID');
var twitchChannelNameRep = nodecg.Replicant('twitchChannelName');

if (nodecg.bundleConfig && nodecg.bundleConfig.twitch && nodecg.bundleConfig.twitch.enable && nodecg.bundleConfig.twitch.chatBot) {
    nodecg.log.info("Twitch chat bot is enabled.");

    var options = {
		options: {
			//debug: true,  // might want to turn off when in production
		},
		connection: {
            secure: true,
            reconnect: true,
		},
		identity: {
			username: twitchChannelNameRep.value,
			password: accessToken.value,
		}
	};

    var client = new TwitchJS.client(options);
    
    // message handler function
    function messageHandler(channel, user, message, self) {
        // only listen to commands in chat
        if (self) return;
        if (user['message-type'] != 'chat') return;
        if (!message.startsWith('!')) return;
        var parts = message.split(' ', 3);
        // check mod only commands
        if ((user.mod || 'broadcaster' in user.badges) && parts.length >= 2) {
            // name of the command to edit
            var commandname = parts[1];
            if (parts.length == 2) {
                if (parts[0]=='!delcmd') {
                    if (chatCommandsRep.value.hasOwnProperty(commandname)) {
                        delete chatCommandsRep.value[commandname];
                        client.say(channel, `Command ${commandname} successfully deleted!`);
                    } else {
                        client.say(channel, `Command ${commandname} doesn't exist!`);
                    }
                }
            } else {
                if (parts[0]=='!addcmd') {
                    if (chatCommandsRep.value.hasOwnProperty(commandname)) {
                        client.say(channel, `Command ${commandname} already exists!`);
                    } else {
                        chatCommandsRep.value[commandname] = {response: parts[2], enabled: true, cooldown: 5, lastUsed: 0};
                        client.say(channel, `Command ${commandname} successfully added!`);
                    }
                }
                if (parts[0]=='!setcmd') {
                    if (chatCommandsRep.value.hasOwnProperty(commandname)) {
                        chatCommandsRep.value[commandname].response = parts[2];
                        client.say(channel, `Command ${commandname} successfully changed!`);
                    } else {
                        client.say(channel, `Command ${commandname} doesn't exist!`);
                    }
                }
                if (parts[0]=='!setcmdenabled') {
                    if (chatCommandsRep.value.hasOwnProperty(commandname)) {
                        chatCommandsRep.value[commandname].enabled = !!parts[2];
                        client.say(channel, `Command ${commandname} successfully enabled/disabled!`);
                    } else {
                        client.say(channel, `Command ${commandname} doesn't exist!`);
                    }
                }
                if (parts[0]=='!setcmdcooldown') {
                    if (chatCommandsRep.value.hasOwnProperty(commandname)) {
                        var cd = parseInt(parts[2]);
                        if (isNaN(cd)) {
                            client.say(channel, `${parts[2]} is not a number!`);
                        } else {
                            chatCommandsRep.value[commandname].cooldown = cd;
                            client.say(channel, `Command ${commandname} successfully changed!`);
                        }
                    } else {
                        client.say(channel, `Command ${commandname} doesn't exist!`);
                    }
                }
            }
        }
        if (chatCommandsRep.value.hasOwnProperty(parts[0].slice(1))) {
            var userCommand = chatCommandsRep.value[parts[0].slice(1)];
            if (userCommand &&
                userCommand.enabled &&
                (new Date().getTime() - userCommand.lastUsed) > userCommand.cooldown) {
                    client.say(channel, userCommand.response);
                    userCommand.lastUsed = new Date().getTime();
            }
        }
    }
    client.connect();
    client.once('connected', function(address, port) {
        client.on('message', messageHandler);
        client.join(twitchChannelNameRep.value)
            .catch(reason => {
                nodecg.log.error("Couldn't join channel: "+reason);
            }).then(data=>{
                nodecg.log.info("Joined channel: "+data);
            });
    });
}