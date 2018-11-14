'use strict';
var needle = require('needle');
var nodecg = require('./utils/nodecg-api-context').get();

const Pusher = require('pusher-js');

var requestOptions = {
	headers: {
		'Authorization': ''
	}
};
// Static constants from the proprietary tiltify api
const tiltifyApiKey = "c0b88d914287a2f4ee32";
const tiltifyCluster = "mt1";

if (nodecg.bundleConfig && nodecg.bundleConfig.tiltify && nodecg.bundleConfig.tiltify.enable) {
	if (!nodecg.bundleConfig.tiltify.token)
		nodecg.log.warn('Tiltify support is enabled but no API access token is set.');
	if (!nodecg.bundleConfig.tiltify.campaign)
		nodecg.log.warn('Tiltify support is enabled but no campaign ID is set.');
	
	if (!nodecg.bundleConfig.tiltify.token || !nodecg.bundleConfig.tiltify.campaign)
		return;
	
	nodecg.log.info('Tiltify integration is enabled.');

	var donationTotal = nodecg.Replicant('tiltifyDonationTotal', {persistent:false, defaultValue:0});
        var polls = nodecg.Replicant('tiltifyPolls', {persistent:false, defaultValue:[]});
	var incentives = nodecg.Replicant('tiltifyIncentives', {persistent:false, defaultValue:[]});
	var donations = nodecg.Replicant('tiltifyDonations', {persistent:false, defaultValue:[]});
	requestOptions.headers['Authorization'] = 'Bearer '+nodecg.bundleConfig.tiltify.token;
	
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

function setUpPusher() {
	var tiltifyPusher = new Pusher(tiltifyApiKey, {cluster: tiltifyCluster});
	var channel = tiltifyPusher.subscribe("campaign."+nodecg.bundleConfig.tiltify.campaign);
	channel.bind("donation", _processRawDonation);
	channel.bind('campaign', _processRawCampain);
}

function _processRawDonation() {
	nodecg.sendMessage('newDonation');
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
	needle.get('https://tiltify.com/api/v3/campaigns/'+nodecg.bundleConfig.tiltify.campaign, requestOptions, (err, resp) => {
		if (!err && resp.statusCode === 200)
			_processRawCampain(resp.body.data);
		else
			nodecg.log.error(err);
	});
}

function _processRawCampain(data) {
	// Update the donation total replicant if it has actually changed.
	if (donationTotal.value != data.amountRaised)
		donationTotal.value = data.amountRaised;
		nodecg.log.info("Updating total to "+donationTotal.value);
}

function reqDonations() {
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