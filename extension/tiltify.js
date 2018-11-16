'use strict';
var needle = require('needle');
var nodecg = require('./utils/nodecg-api-context').get();

const Pusher = require('pusher-js');

var requestOptions = {
	headers: {
		'Authorization': ''
	}
};

// Replicants
var donationTotal = nodecg.Replicant('tiltifyDonationTotal', {persistent:false, defaultValue:0});
var polls = nodecg.Replicant('tiltifyPolls', {persistent:false, defaultValue:[]});
var incentives = nodecg.Replicant('tiltifyIncentives', {persistent:false, defaultValue:[]});
var donations = nodecg.Replicant('tiltifyDonations', {persistent:false, defaultValue:[]});

// for testing
const enableTiltifyTestDonations = nodecg.bundleConfig.tiltify.enableFakeDonations;
// Static constants from the proprietary tiltify api
const tiltifyApiKey = "c0b88d914287a2f4ee32";
const tiltifyCluster = "mt1";

if (nodecg.bundleConfig && nodecg.bundleConfig.tiltify && nodecg.bundleConfig.tiltify.enable) {
	if (enableTiltifyTestDonations) {
		nodecg.log.info('Tiltify enable in test mode, only fake donations');
		var testDonations = [];
		var testPolls = [];
		var testChallenges = [];
		var testCampaign = {"amountRaised":0};
		var did = 0;
		function sendFakeDonation() {
			if (testDonations.length >= 10) {
				testDonations.pop();
			}
			var donationAmount = Math.floor(Math.random()*200 + 1);
			var testDono = {"id":did,"amount":donationAmount,"name":"donatorname","comment":"Greetings from germany!",
			"completedAt":1541438000000,"pollOptionId":123,"sustained":false};
			testDonations.unshift(testDono);
			testCampaign.amountRaised += donationAmount;
			_processRawDonation(testDono);
			did++;
			setTimeout(sendFakeDonation, Math.floor(Math.random() * 10000 + 2000));
		}
		nodecg.listenFor('refreshTiltify', doUpdate);
		sendFakeDonation();
	} else {
		if (!nodecg.bundleConfig.tiltify.token)
			nodecg.log.warn('Tiltify support is enabled but no API access token is set.');
		if (!nodecg.bundleConfig.tiltify.campaign)
			nodecg.log.warn('Tiltify support is enabled but no campaign ID is set.');
		
		if (!nodecg.bundleConfig.tiltify.token || !nodecg.bundleConfig.tiltify.campaign)
			return;
		requestOptions.headers['Authorization'] = 'Bearer '+nodecg.bundleConfig.tiltify.token;
		
		nodecg.log.info('Tiltify integration is enabled.');

		// Do the initial request, which also checks if the key is valid.
		needle.get('https://tiltify.com/api/v3/campaigns/'+nodecg.bundleConfig.tiltify.campaign, requestOptions, (err, resp) => {
			if (resp.statusCode === 403) {
				nodecg.log.warn('Your Tiltify API access token is not valid.');
				return;
			}

			if (resp.statusCode === 404) {
				nodecg.log.warn('The Tiltify campaign with the specified ID cannot be found.');
				return;
			}
			
			_processRawCampain(resp.body.data);
			setUpPusher();
			nodecg.listenFor('refreshTiltify', doUpdate);
			doUpdate();
		});
	}
}

function setUpPusher() {
	var tiltifyPusher = new Pusher(tiltifyApiKey, {cluster: tiltifyCluster});
	var channel = tiltifyPusher.subscribe("campaign."+nodecg.bundleConfig.tiltify.campaign);
	channel.bind("donation", _processRawDonation);
	channel.bind('campaign', _processRawCampain);
}

function _processRawDonation(donation) {
	nodecg.sendMessage('newDonation', donation);
	doUpdate();
}

function doUpdate() {
	nodecg.log.info('Updating tiltify stuff...');
	reqCampain();
	reqPolls();
	reqChallenges();
	reqDonations();
}

function reqCampain() {
	if (enableTiltifyTestDonations) {
		_processRawCampain(testCampaign);
		return;
	}
	needle.get('https://tiltify.com/api/v3/campaigns/'+nodecg.bundleConfig.tiltify.campaign, requestOptions, (err, resp) => {
		if (!err && resp.statusCode === 200)
			_processRawCampain(resp.body.data);
		else
			nodecg.log.error(err);
	});
}

function _processRawCampain(data) {
	// Update the donation total replicant if it has actually changed.
	if (data.amountRaised && donationTotal.value != data.amountRaised)
		donationTotal.value = data.amountRaised;
		nodecg.log.info("Updating total to "+donationTotal.value);
}

function reqDonations() {
	if (enableTiltifyTestDonations) {
		_processRawDonations(testDonations);
		return;
	}
	needle.get('https://tiltify.com/api/v3/campaigns/'+nodecg.bundleConfig.tiltify.campaign+"/donations", requestOptions, (err, resp) => {
		if (!err && resp.statusCode === 200)
			_processRawDonations(resp.body.data);
		else
			nodecg.log.error(err);
	});
}

function _processRawDonations(data) {
	if (donations.value != data) {
		donations.value = data;
	}
}

function reqPolls() {
	if (enableTiltifyTestDonations) {
		_processRawPolls(testPolls);
		return;
	}
	needle.get('https://tiltify.com/api/v3/campaigns/'+nodecg.bundleConfig.tiltify.campaign+'/polls', requestOptions, (err, resp) => {
			if (!err && resp.statusCode === 200)
		_processRawPolls(resp.body.data);
	else
		nodecg.log.error(err);
	});
}

/**
 * Datastructure: TODO
 */
function _processRawPolls(data) {
        if (polls.value != data)
                polls.value = data;
}

function reqChallenges() {
	if (enableTiltifyTestDonations) {
		_processRawChallenges(testChallenges);
		return;
	}
	needle.get('https://tiltify.com/api/v3/campaigns/'+nodecg.bundleConfig.tiltify.campaign+'/challenges', requestOptions, (err, resp) => {
			if(!err && resp.statusCode === 200)
					_processRawChallenges(resp.body.data);
	else
		nodecg.log.error(err);
	});
}

/**
 * Datastructure: {"type":"donation","data":{"id":1234,"amount":1,"name":"donatorname","comment":"Greetings from germany!",
 * "completedAt":1541438000000,"pollOptionId":123,"sustained":false}}
 */
function _processRawChallenges(data) {
        if (incentives.value != data)
		incentives.value = data;
}