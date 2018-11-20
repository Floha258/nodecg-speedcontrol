$(()=>{
    const bundleName = 'nodecg-speedcontrol';
    const bingoColors = nodecg.Replicant('bingo-colors', bundleName);
    const boardRep = nodecg.Replicant('bingoboard', bundleName);
    const socketRep = nodecg.Replicant('bingosocket', bundleName);

    const bingosyncButton = $('#bingosync-action');
    const roomCodeInput = $('#bingosync-roomcode');
    const passwordInput = $('#bingosync-password');
    const bingosyncErrorMsg = $('#bingosync-error');
    const hideShowBoard = $('#hide-show-board');
    const hideShowGoalCount = $('#hide-show-goalcount');
    const $playerSelects = [
        $('#player0-color'),
        $('#player1-color'),
        $('#player2-color'),
        $('#player3-color'),
    ];
    $('#update-colors').click(() => {
        for (var i in $playerSelects) {
            bingoColors.value[i] = $playerSelects[i].val();
        }
    });

    hideShowBoard.click(()=>{
        // toggle visible status
        boardRep.value.boardHidden = !boardRep.value.boardHidden;
    });

    hideShowGoalCount.click(() => {
        // toggle visible status
        boardRep.value.goalCountShown = !boardRep.value.goalCountShown; 
    });

    boardRep.on('change', (newVal, oldVal)=>{
        // update hide/show button description if status changed
        if (!oldVal || newVal.boardHidden != oldVal.boardHidden) {
            hideShowBoard.text(newVal.boardHidden ? 'Show board' : 'Hide board');
        }
        if (!oldVal || newVal.goalCountShown != oldVal.goalCountShown) {
            hideShowGoalCount.text(newVal.goalCountShown ? 'Hide goalcount' : 'Show goalcount');
        }
    });

    bingosyncButton.click(()=>{
        // check which action to do
        if (socketRep.value.status == 'connected') {
            nodecg.sendMessage('leaveBingosyncRoom');
        } else if (socketRep.value.status == 'connecting'){
            // disabled
        } else {
            nodecg.sendMessage('joinBingosyncRoom',{'roomCode':roomCodeInput.val(), 'passphrase':passwordInput.val()},
                (err)=>{
                    if (err) {
                        bingosyncErrorMsg.text(err);
                    } else {
                        bingosyncErrorMsg.text('');
                    }
            });
        }
    });
    socketRep.on('change', (newVal)=>{
        if (newVal.status == 'connected') {
            bingosyncButton.text('Disconnect');
            bingosyncButton.prop('disabled',false);
        } else if (newVal.status == 'connecting') {
            bingosyncButton.text('Wait...');
            bingosyncButton.prop('disabled',true);
        } else {
            bingosyncButton.text('Connect');
            bingosyncButton.prop('disabled',false);
        }
    });
});