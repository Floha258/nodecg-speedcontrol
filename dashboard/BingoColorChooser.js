$(()=>{
    const bingoColors = nodecg.Replicant('bingo-colors', 'nodecg-speedcontrol');
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
});