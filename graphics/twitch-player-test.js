'use strict';
$(function() {
    var streams = nodecg.Replicant('twitch-streams', {'persistent':false,'defaultValue':[
        {'channel':'speedrunslive','width':400,'height':350,'quality':'chunked','volume':0,'muted':true,'paused':false,'hidden':true},
        {'channel':'speedrunslive','width':400,'height':350,'quality':'chunked','volume':0,'muted':true,'paused':false,'hidden':true},
        {'channel':'speedrunslive','width':400,'height':350,'quality':'chunked','volume':0,'muted':true,'paused':false,'hidden':true},
        {'channel':'speedrunslive','width':400,'height':350,'quality':'chunked','volume':0,'muted':true,'paused':false,'hidden':true},
    ]});
    // streams.values is an array that consists of elements with the following attributes;
    // channel, width, height, quality, volume, muted, paused, hidden
    var playerList = [];
    streams.on('change', (newStreams, oldStreams) => {
        for(var i in newStreams) {
            const stream = newStreams[i];
            // create player if it doesn't exists
            // so all 4 players are always there just hidden, paused and muted maybe
            if (!playerList[i]) {
                var twitchContainer = document.getElementById('twitch-player'+i);
                if (!twitchContainer) {
                    // it's OK if a hidden stream has no html
                    if (!stream.hidden) {
                        nodecg.log.info('Tried to set up twitch player '+i+' but player doesn\' exist in html!');
                    }
                    continue;
                }
                createTwitchPlayer(i);
            } else {
                const oldStream = playerList[i];
                if (stream.hidden) {
                    $('#twitch-player'+i).hide();
                } else {
                    $('#twitch-player'+i).show();
                }
                if (oldStream.getQuality() != stream.quality) {
                    oldStream.setQuality(stream.quality);
                }
                if (oldStream.getVolume() != stream.volume) {
                    oldStream.setVolume(stream.volume);
                }
                if (oldStream.getMuted() != stream.muted) {
                    oldStream.setMuted(stream.muted);
                }
                if (oldStream.getChannel() != stream.channel) {
                    oldStream.setChannel(stream.channel);
                }
                // if (oldStream.getWidth() != stream.width) {
                //     oldStream.setWidth(stream.width);
                // }
                // if (oldStream.getHeight() != stream.height) {
                //     oldStream.setHeight(stream.height);
                // }
                if (oldStream.isPaused() != stream.paused) {
                    if (stream.paused) {
                        oldStream.pause();
                    } else {
                        oldStream.play();
                    }
                }
            }
        }
    });
    //     // register listeners to remotely control streams
    //     // refresh TODO
    nodecg.listenFor('refreshStream',(id) => {
        if (!playerList[id]) {
            nodecg.log.console.warn("Stream with given ID doesn't exist, can't refresh");
            return;
        }
        // delete old player
        $('#twitch-player'+id).html('');
        // and create new one
        createTwitchPlayer(id);
    })

    function createTwitchPlayer(id) {
        const stream = streams.value[id];
        var twitchContainer = document.getElementById('twitch-player'+id);
        if (stream.hidden) {
            $(twitchContainer).hide();
        } else {
            $(twitchContainer).show();
        }
        var playerOptions = {
            'channel':  stream.channel,
            'width':    stream.width,
            'height':   stream.height,
        }
        playerList[id] = new Twitch.Player(twitchContainer, playerOptions);
        playerList[id].showPlayerControls(false);
        playerList[id].setQuality(stream.quality);
        playerList[id].setVolume(stream.volume);
        playerList[id].setMuted(stream.muted);
        if (stream.paused) {
            playerList[id].pause();
        } else {
            playerList[id].play();
        }
    }
});