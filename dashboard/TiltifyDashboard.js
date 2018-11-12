'use strict';
$(function() {
	// set up tiltify
	var $refreshTiltifyButton = $("#reloadTiltifyButton");
	var $donationContainer = $("#donationContainer");
	var $tiltifyDonationTotal = $("#tiltifyDonationTotal");

	var donationTotal = nodecg.Replicant('tiltifyDonationTotal');
	var polls = nodecg.Replicant('tiltifyPolls');
	var incentives = nodecg.Replicant('tiltifyIncentives');
	var donations = nodecg.Replicant('tiltifyDonations');

	// set up refresh button
	$refreshTiltifyButton.click(function() {
		nodecg.sendMessage('refreshTiltify');
	})

	// set up donation total display
	
	donationTotal.on("change", (newTotal, oldTotal) => {
		$tiltifyDonationTotal.text("$"+newTotal);
	});

	// update the donations container if we get a new donation,
	// this shows name, comment and amount for the last 10 donations
	donations.on("change", (allDonations, old) => {
		var donationsHtml = '';
		for (var i in allDonations) {
			donationsHtml += '<div class="donation">';
			donationsHtml += '<div class="donator">' + allDonations[i].name + '</div>';
			donationsHtml += '<div class="comment">' + allDonations[i].comment + '</div>';
			donationsHtml += '<div class="amount">' + allDonations[i].amount + '</div>';
			donationsHtml += '</div>';
		}
		$donationContainer.html(donationsHtml);
	});
});