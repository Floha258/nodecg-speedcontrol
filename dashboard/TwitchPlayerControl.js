'use-strict'
$(()=>{
    const bundleName = 'nodecg-speedcontrol';
    // keeps track of which channel has sound, cause only one at a time can have sound, -1 is all muted
    var soundOnTwitchStream = nodecg.Replicant('sound-on-twitch-stream', bundleName, {'persistent':false,'defaultValue':-1});
    // main control panel for streams
    var streams = nodecg.Replicant('twitch-streams', bundleName);

    // handle muting/unmuting
    $('.stream-mute').click((elem)=> {
        // find out which stream was meant to be muted/unmuted
        const streamID = elem.currentTarget.parentElement.id;
        const streamNr = parseInt(streamID[streamID.length - 1]);
        if (soundOnTwitchStream.value == streamNr) {
            soundOnTwitchStream.value = -1;
        } else {
            soundOnTwitchStream.value = streamNr;
        }
    });

    soundOnTwitchStream.on('change', (newValue, old)=> {
        for (var i = 0;i < 4;i++) {
            $('#stream-control'+i).find('.stream-mute').text(i==newValue ? 'Mute':'Unmute');
        }
    });

    // handle refresh
    $('.stream-refresh').click((elem)=> {
        // find out which stream was meant to be refreshed
        const streamID = elem.currentTarget.parentElement.id;
        const streamNr = parseInt(streamID[streamID.length - 1]);
        nodecg.log.info('refreshing stream'+streamNr);
        nodecg.sendMessage('refreshStream',(streamNr));
    });
});