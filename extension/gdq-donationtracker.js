'use strict';

// Note: This uses a fork from the GDQ donation tracker (https://github.com/bingothon/bingothon-donation-tracker)
// that exposes some feeds, inspired by the PowerupWithPride fork (https://github.com/PowerUpWithPride/donation-tracker-toplevel)

var nodecg = require('./utils/nodecg-api-context').get();
var needle = require('needle');
var deepEqual = require('deep-equal');


if (nodecg.bundleConfig && nodecg.bundleConfig.donationtracker && nodecg.bundleConfig.donationtracker.enable ) {
    const donationTotalReplicant = nodecg.Replicant('donationTotal', {defaultValue: 0});
    const openBidsReplicant = nodecg.Replicant('trackerOpenBids', {defaultValue: []});
    const donationsReplicant = nodecg.Replicant('trackerDonations', {defaultValue: []});
    const feedUrl = nodecg.bundleConfig.donationtracker.url;
    const eventSlug = nodecg.bundleConfig.donationtracker.eventSlug;
    function doUpdate() {
        // current donation total
        needle.get(feedUrl + "/feed/current_donations/"+eventSlug, function(err, response) {
            if (err || !response.body || response.statusCode != 200) {
                nodecg.log.warn("error getting donation total!");
            } else {
                donationTotalReplicant.value = response.body.total;
                nodecg.log.info("Updating donation total to "+donationTotalReplicant.value);
            }
        });

        // all bids that are open
        needle.get(feedUrl + "/feed/upcoming_bids/"+eventSlug, function(err, response) {
            if (err || !response.body || response.statusCode != 200) {
                nodecg.log.warn("error getting bids!");
            } else {
                if (!deepEqual(openBidsReplicant.value, response.body.results)) {
                    openBidsReplicant.value = response.body.results;
                    nodecg.log.info("Updating upcoming bids to "+JSON.stringify(openBidsReplicant.value));
                }
            }
        });

        // last 20 donations (limited by the tracker)
        needle.get(feedUrl + "/feed/donations/"+eventSlug, function(err, response) {
            if (err || !response.body || response.statusCode != 200) {
                nodecg.log.warn("error getting donations!");
            } else {
                if (!deepEqual(donationsReplicant.value, response.body.results)) {
                    donationsReplicant.value = response.body.results;
                    nodecg.log.info("Updating donations to "+JSON.stringify(donationsReplicant.value));
                }
            }
        });
    }
    doUpdate();
    setInterval(doUpdate, 30000);
} else {
    nodecg.log.warn("donationtracker isn't enabled!");
}