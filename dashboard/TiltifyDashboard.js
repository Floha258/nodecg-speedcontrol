'use strict';
$(function() {
	// set up tiltify
	var $refreshTiltifyButton = $("#reloadTiltifyButton");

	var donationTotal = nodecg.Replicant('tiltifyDonationTotal', {persistent:false, defaultValue:0});
	var polls = nodecg.Replicant('tiltifyPolls', {persistent:false, defaultValue:[]});
	var incentives = nodecg.Replicant('tiltifyIncentives', {persistent:false, defaultValue:[]});
	var donations = nodecg.Replicant('tiltifyDonations', {persistent:false, defaultValue:[]});

	$refreshTiltifyButton.click(function() {
		nodecg.sendMessage('refreshTiltify');
	})
});