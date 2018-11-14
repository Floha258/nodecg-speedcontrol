'use-strict'
$(function(){

    const $donationTotalView = $('#donationTotal');
    const $donationContainer = $('#donationContainer');
    const $pollContainer = $('#pollContainer');
    const $challengesContainer = $('#challengeContainer');
    const $newDonation = $('#new-donation');

    const donationTotal = nodecg.Replicant('tiltifyDonationTotal');
	const polls = nodecg.Replicant('tiltifyPolls');
	const incentives = nodecg.Replicant('tiltifyIncentives');
    const donations = nodecg.Replicant('tiltifyDonations');
    
    donationTotal.on('change',(newTotal, oldTotal) => {
        $donationTotalView.text(newTotal);
    });

    nodecg.listenFor('newDonation', () =>{
        $newDonation.show();
    });

    $newDonation.click(() => {
        $newDonation.hide();
    });

    // update the donations container if we get a new donation,
	// this shows name, comment and amount for the last 10 donations
	donations.on("change", (allDonations, old) => {
		var donationsHtml = '';
		for (var i in allDonations) {
            const dono = allDonations[i];
			donationsHtml += '<div class="donation">';
            donationsHtml += '<div class="donator">' + dono.name + '</div>';
            if (!dono.comment) {
                donationsHtml += '<div class="comment no-comment">No Comment</div>';
            } else {
                donationsHtml += '<div class="comment">' + dono.comment + '</div>';
            }
			donationsHtml += '<div class="amount">' + dono.amount + '</div>';
			donationsHtml += '</div>';
		}
		$donationContainer.html(donationsHtml);
    });
    
    polls.on('change', (allPolls, old) => {
        var pollHtml = '';
        for (var i in allPolls) {
            const poll = allPolls[i];
            if (poll.active) {
                pollHtml += '<div class="poll">';
            } else {
                pollHtml += '<div class="poll inactive">';
            }
            pollHtml += '<div class="poll-name">' + poll.name + '</div>';
            pollHtml += '<div class="poll-options">';
            for (var j in poll.options) {
                const option = poll.options[j];
                pollHtml += '<div class="poll-option">' + option.name + ': '+ option.totalAmountRaised + '$</div>';
            }
            pollHtml += '</div></div>';
        }
        $pollContainer.html(pollHtml);
    });

    incentives.on('change', (allChallenges, old) => {
        var challengeHtml = '';
        for (var i in allChallenges) {
            const challenge = allChallenges[i];
            if (challenge.active) {
                challengeHtml += '<div class="challenge">';
                challengeHtml += '<div class="challenge-name">' + challenge.name + '</div>';
            } else {
                challengeHtml += '<div class="challenge inactive">';
                challengeHtml += '<div class="challenge-name">[inactive]' + challenge.name + '</div>';
            }
            challengeHtml += '<div class="challenge-progress">' + challenge.totalAmountRaised + ' from ' + challenge.amount + '</div>';
            challengeHtml += '</div>'
        }
        $challengesContainer.html(challengeHtml);
    })
});