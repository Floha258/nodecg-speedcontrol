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

		// testing, create fake donations and polls
		const testWords = ['Lorem', "Ipsum", "Dolar","Si","Achmet","Greetings","From","Germany","consetetur","sadipscing","elitr","sed","diam","nonumy","eirmod","hi","this","is","a","secret","message","please","help","me"];
		function randSentence(minWords, maxWords) {
			var words = minWords + Math.floor((maxWords-minWords)*Math.random());
			var sentence = "";
			for (var i = 1;i<words;i++) {
				sentence += testWords[Math.floor(Math.random()*testWords.length)] + " ";
			}
			sentence += testWords[Math.floor(Math.random()*testWords.length)];
			return sentence;
		}
		nodecg.log.info('Tiltify enable in test mode, only fake donations');
		var pollId = 0;
		var pollOptionId = 0;
		var challengeId = 0;
		var testDonations = [];
		var testPolls = [];
		var testChallenges = [];
		var testCampaign = {"amountRaised":0};

		// create test challenges
		for(var i = 0;i<8;i++) {
			testChallenges.push({
				"id":challengeId,
				"type":"Challenge",
				"name":randSentence(5,7),
				"totalAmountRaised":0,
				"amount":500+Math.floor(Math.random()*500),
				"campaignId":12345,
				"active":Math.random()<0.5,
				"endsAt":Date.now()+3600000,// ends in an hour
				"createdAt":Date.now(),
				"updatedAt":Date.now()});
			challengeId++;
		}
		// create test polls
		for(var i = 0;i<8;i++) {
			var nextPoll = {
				"id":pollId,
				"name":randSentence(4,8),
				"active":true,
				"type":"Poll",
				"campaignId":12345,
				"createdAt":Date.now(),
				"updatedAt":Date.now(),
				"options":[]};
			// testoptions
			for(var j=0;j<3;j++) {
				nextPoll.options.push({
					"id":pollOptionId,
					"pollId":pollId,
					"name":randSentence(1,3),
					"type":"PollOption",
					"totalAmountRaised":0,
					"createdAt":Date.now(),
					"updatedAt":Date.now()});
				pollOptionId++;
			}
			testPolls.push(nextPoll);
			pollId++;
		}
		var did = 0;
		function sendFakeDonation() {
			if (testDonations.length >= 10) {
				testDonations.pop();
			}
			var donationAmount = Math.floor(Math.random()*200 + 1);
			var testDono = {"id":did,"amount":donationAmount,"name":randSentence(1,2),"comment":randSentence(20,40),
				"completedAt":Date.now(),"sustained":false};
			
			// this donation either goes to nothing, a challenge or a poll
			var benefitOpt = Math.random();
			if (benefitOpt<0.3) {
				// supports nothing
			} else if (benefitOpt<0.6) {
				// supports a challenge
				var selectedChallenge = testChallenges[Math.floor(Math.random()*testChallenges.length)];
				selectedChallenge.totalAmountRaised += testDono.amount;
				testDono.challengeId = selectedChallenge.challengeId;
			} else {
				// supports a poll, grab poll fist...
				var selectedOptions = testPolls[Math.floor(Math.random()*testPolls.length)].options;
				var selectedOption = selectedOptions[Math.floor(Math.random()*selectedOptions.length)];
				selectedOption.totalAmountRaised += testDono.amount;
				testDono.pollOptionId = selectedOption.pollOptionId;
			}
			testDonations.unshift(testDono);
			testCampaign.amountRaised += donationAmount;
			_processRawDonation(testDono);
			did++;

			// schedule timeout for the next fake donation, between 2 and 12 secs
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
	channel.bind("donation", _processPusherDonation);
	channel.bind('campaign', _processPusherCampain);
}

function _processPusherDonation(data) {
	_processRawDonation(data.data);
}

function _processPusherCampain(data) {
	_processRawCampain(data.data);
}

/**
 * Datastructure: {"type":"donation","data":{"id":1234,"amount":1,"name":"donatorname","comment":"Greetings from germany!",
 * "completedAt":1541438000000,"pollOptionId":123,"sustained":false}}
 * 
 * Either pollOptionId, rewardId, challengeId or none of them are present, linking to the specified resource
 */
function _processRawDonation(donation) {
	nodecg.log.info("predonations:"+JSON.stringify(donation));
	// only process completed donations
	if (donation && donation.completedAt) {
		nodecg.log.info("donation: "+JSON.stringify(donation));
		nodecg.sendMessage('newDonation', donation);
		doUpdate();
	}
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
	nodecg.log.info("campaign: "+JSON.stringify(data));
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
	nodecg.log.info("donations: "+JSON.stringify(data));
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
 * Datastructure: [{"id":123,"name":"Polldescription","active":false,"type":"Poll","campaignId":12345,"createdAt":1525099745000,
 * "updatedAt":1526663265000,"options":
 * [{"id":1234,"pollId":123,"name":"Option 1","type":"PollOption",
 * "totalAmountRaised":8,"createdAt":1525099745000,"updatedAt":1525099745000}]}]
 */
function _processRawPolls(data) {
	nodecg.log.info("polls: "+JSON.stringify(data));
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
 * 
 * [{"id":1234,"type":"Challenge","name":"PollName","totalAmountRaised":0,"amount":500,
 * "campaignId":12345,"active":false,"endsAt":1524369600000,"createdAt":1523551888000,"updatedAt":1523553738000}]
 */
function _processRawChallenges(data) {
	nodecg.log.info("challenges: "+JSON.stringify(data));
        if (incentives.value != data)
		incentives.value = data;
}