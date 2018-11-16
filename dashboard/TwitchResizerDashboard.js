$(()=>{
    const bundleName = 'nodecg-speedcontrol'
    var streams = nodecg.Replicant('twitch-streams', bundleName);
    var player = undefined;
    const initWidth = 1024;
    const initHeight = 576;

    //Twitch aspect ratio 1024x576

    const $streamSelect = $('#stream-select');
    const $resizeContainer = $('#resize-container');
    var $playerFrame;

    const $leftInput = $('#left-percent');
    const $topInput = $('#top-percent');
    const $widthInput = $('#width-percent');
    const $heightInput = $('#height-percent');
    const $successMsg = $('#success-msg');
    streams.on('change', (newStreams, old)=>{
        selectHtml = '';
        for (var i in newStreams) {
            selectHtml += '<option value="'+i+'">'+i+":"+newStreams[i].channel+'</option>';
        }
        $streamSelect.html(selectHtml);
        if (!old || !player) {
            // page just loaded, create player
            player = new Twitch.Player(document.getElementById('resize-container'),{'channel':newStreams[0].channel, 'volume':0, 'width':1024, 'height':576});
            $playerFrame = $('#resize-container iframe');
            stream = newStreams[0];
            $leftInput.val(stream.leftPercent);
            $topInput.val(stream.topPercent);
            $widthInput.val(stream.widthPercent);
            $heightInput.val(stream.heightPercent);
            updateResize();
        } else if (newStreams[$streamSelect.val()] == old[$streamSelect.val()]) {
            // do nothing
        } else {
            // change channel
            updatePlayer(streams.value[$streamSelect.val()]);
        }
    });

    $streamSelect.on('change',(evt)=>{
        updatePlayer(streams.value[$streamSelect.val()]);
    });

    $('.resize-input').on('change', updateResize);

    function updateResize() {
        $successMsg.css('display','none');
        var width = initWidth*100/$widthInput.val();
        var height = initHeight*100/$heightInput.val();
        $resizeContainer.css('width',width);
        $resizeContainer.css('height',height);
        $playerFrame.css('left',$leftInput.val()/100*initWidth);
        $playerFrame.css('top',$topInput.val()/100*initHeight);
    }

    function updatePlayer(stream) {
        if (stream.channel != player.getChannel()) {
            $successMsg.css('display','none');
            player.setChannel(stream.channel);
            var width = initWidth*100/stream.widthPercent;
            var height = initHeight*100/stream.heightPercent;
            $resizeContainer.css('width',width);
            $resizeContainer.css('height',height);
            $playerFrame.css('left',stream.leftPercent/100*initWidth);
            $playerFrame.css('top',stream.topPercent/100*initHeight);
            $leftInput.val(stream.leftPercent);
            $topInput.val(stream.topPercent);
            $widthInput.val(stream.widthPercent);
            $heightInput.val(stream.heightPercent);
        }
    }

    $("#save-resize").click(()=> {
        streams.value[$streamSelect.val()].leftPercent = parseInt($leftInput.val());
        streams.value[$streamSelect.val()].topPercent = parseInt($topInput.val());
        streams.value[$streamSelect.val()].widthPercent = parseInt($widthInput.val());
        streams.value[$streamSelect.val()].heightPercent = parseInt($heightInput.val());
        $successMsg.css('display','inherit');
    })
});