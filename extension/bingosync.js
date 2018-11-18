'use strict';

// source: https://raw.githubusercontent.com/GamesDoneQuick/sgdq18-layouts/master/src/extension/oot-bingo.ts

// Packages
const RequestPromise = require('request-promise');
const WebSocket = require('ws');
const cheerio = require('cheerio');
const equal = require('deep-equal');

// Ours
const SOCKET_KEY_REGEX = /temporarySocketKey\s+=\s+"(\S+)"/;

const nodecg = require('./utils/nodecg-api-context').get();
const log = new nodecg.Logger(`${nodecg.bundleName}:bingosync`);
const request = RequestPromise.defaults({jar: true}); // <= Automatically saves and re-uses cookies.
const boardRep = nodecg.Replicant('bingoboard', {'defaultValue':{'cells':[], 'boardHidden':false}});
const socketRep = nodecg.Replicant('bingosocket', {'defaultValue':{'roomCode':null,'passphrase':null,'status':'disconnected'}});
// always disconnected at startup, 
socketRep.value.status = 'disconnected';
let fullUpdateInterval;
let websocket = null;

const noop = () => {}; // tslint:disable-line:no-empty

nodecg.listenFor('joinBingosyncRoom', async (data, callback) => {
	callback = callback || noop; // tslint:disable-line:no-parameter-reassignment
	if (!data.passphrase || !data.roomCode) {
		callback('Need to specify passphrase and roomCode!');
		return;
	}
	socketRep.value = {
		...socketRep.value,
		...data
	};
	try {
		await joinRoom({
			siteUrl: 'https://bingosync.com',
			socketUrl: 'wss://sockets.bingosync.com',
			playerName: 'bingothon',
			roomCode: data.roomCode,
			passphrase: data.passphrase,
		});
		callback();
	} catch(error) {
		log.error(`Failed to join room ${data.roomCode}:`, error);
		callback(error.message);
	}
});

nodecg.listenFor('leaveBingosyncRoom', (_data, callback) => {
	callback = callback || noop; // tslint:disable-line:no-parameter-reassignment
	try {
		clearInterval(fullUpdateInterval);
		destroyWebsocket();
		socketRep.value.status = 'disconnected';
		socketRep.value.roomCode = '';
		socketRep.value.passphrase = '';
		callback();
	} catch (error) {
		log.error('Failed to leave room:', error);
		callback(error);
	}
});
/* Probably not needed
nodecg.listenFor('ootBingo:selectLine', (lineString, callback) => {
	callback = callback || noop; // tslint:disable-line:no-parameter-reassignment
	try {
		boardRep.value.selectedLine = lineString;
		callback();
	} catch (error) {
		callback(error);
	}
});

nodecg.listenFor('ootBingo:toggleLineFocus', (_data, callback) => {
	callback = callback || noop; // tslint:disable-line:no-parameter-reassignment
	try {
		boardRep.value.lineFocused = !boardRep.value.lineFocused;
		callback();
	} catch (error) {
		callback(error);
	}
});

nodecg.listenFor('ootBingo:toggleCard', (_data, callback) => {
	callback = callback || noop; // tslint:disable-line:no-parameter-reassignment
	try {
		boardRep.value.cardHidden = !boardRep.value.cardHidden;
		callback();
	} catch (error) {
		callback(error);
	}
});

nodecg.listenFor('ootBingo:toggleEmbiggen', (_data, callback) => {
	callback = callback || noop; // tslint:disable-line:no-parameter-reassignment
	try {
		boardRep.value.embiggen = !boardRep.value.embiggen;
		callback();
	} catch (error) {
		callback(error);
	}
});*/

recover().catch(error => {
	if (socketRep.value.roomCode && socketRep.value.passphrase) {
		log.error(`Failed to recover connection to room ${socketRep.value.roomCode}:`, error);
	}
});
async function recover() {
	// Restore previous connection on startup.
	if (socketRep.value.roomCode && socketRep.value.passphrase) {
		log.info(`Recovering connection to room ${socketRep.value.roomCode}`);
		await joinRoom(socketRep.value);
		log.info(`Successfully recovered connection to room ${socketRep.value.roomCode}`);
	}
}

async function joinRoom(
	{siteUrl = 'https://bingosync.com', socketUrl = 'wss://sockets.bingosync.com', roomCode, passphrase, playerName = 'bingothon'}) {
	socketRep.value.status = 'connecting';
	clearInterval(fullUpdateInterval);
	destroyWebsocket();

	log.info('Attempting to load room page.');
	const roomUrl = `${siteUrl}/room/${roomCode}`;
	let $ = await request({
		uri: roomUrl,
		transform(body) {
			return cheerio.load(body);
		}
	}).catch(error=>{
		// for whatever reason the normal promise reject algorithm doesn't work???
		// use the chance here to differentiate between 404 and others
		socketRep.value.status = 'error';
		if (error.statusCode == 404) {
			throw new Error("Room not found");
		} else {
			throw new Error("Couldn't get room page");
		}
	});
	log.info('Loaded room page.');

	// If input[name="csrfmiddlewaretoken"] exists on the page, then we must be on the "Join Room" form.
	// Else, we must be in the actual game room.
	const csrfTokenInput = $('input[name="csrfmiddlewaretoken"]');
	if (csrfTokenInput) {
		log.info('Joining room...');

		// POST to join the room.
		$ = await request({
			method: 'POST',
			uri: roomUrl,
			form: {
				room_name: $('input[name="room_name"]').val(),
				encoded_room_uuid: $('input[name="encoded_room_uuid"]').val(),
				creator_name: $('input[name="creator_name"]').val(),
				game_name: $('input[name="game_name"]').val(),
				player_name: playerName,
				passphrase: passphrase,
				csrfmiddlewaretoken: csrfTokenInput.val()
			},
			headers: {
				Referer: roomUrl
			},
			resolveWithFullResponse: true,
			simple: false,
			transform(body) {
				return cheerio.load(body);
			}
		}).catch(error=>{
			// for whatever reason the normal promise reject algorithm doesn't work???
			// use the chance here to differentiate between 404 and others
			socketRep.value.status = 'error';
			if (error.statusCode == 404) {
				throw new Error("Room not found");
			} else {
				throw new Error("Couldn't get room page");
			}
		});

		// check for incorrect passphrase error
		// if we are still on the login site the password was incorrect
		if ($('input[name="csrfmiddlewaretoken"]').length) {
			socketRep.value.status = 'error';
			throw new Error('Incorrect Passphrase');
		}

		log.info('Joined room.');
		log.info('Loading room page...');

		// Request the room page again, so that we can extract the socket token from it.
		$ = await request({
			uri: roomUrl,
			transform(body) {
				return cheerio.load(body);
			}
		}).catch(error=>{
			// for whatever reason the normal promise reject algorithm doesn't work???
			// use the chance here to differentiate between 404 and others
			socketRep.value.status = 'error';
			if (error.statusCode == 404) {
				throw new Error("Room not found");
			} else {
				throw new Error("Couldn't get room page");
			}
		});;
	}

	log.info('Loaded room page.');

	// Socket stuff
	const matches = $.html().match(SOCKET_KEY_REGEX);
	if (!matches) {
		socketRep.value.status = 'error';
		throw new Error('Socket key not found on page.');
	}

	const socketKey = matches[1];
	if (!socketKey) {
		socketRep.value.status = 'error';
		throw new Error('Socket key not found on page.');
	}

	const thisInterval = setInterval(() => {
		fullUpdate().catch(error => {
			socketRep.value.status = 'error';
			log.error('Failed to fullUpdate:', error);
		});
	}, 15 * 1000);
	fullUpdateInterval = thisInterval;

	await fullUpdate();
	await createWebsocket(socketUrl, socketKey);

	async function fullUpdate() {
		const newBoardState = await request({
			uri: `${roomUrl}/board`,
			json: true
		});

		// Bail if the room changed while this request was in-flight.
		if (fullUpdateInterval !== thisInterval) {
			return;
		}

		// Bail if nothing has changed.
		if (equal(boardRep.value.cells, newBoardState)) {
			return;
		}

		boardRep.value.cells = newBoardState;
	}
}

function createWebsocket(socketUrl, socketKey) {
	return new Promise((resolve, reject) => {
		let settled = false;

		log.info('Opening socket...');
		socketRep.value.status = 'connecting';
		websocket = new WebSocket(`${socketUrl}/broadcast`);

		websocket.onopen = () => {
			log.info('Socket opened.');
			if (websocket) {
				websocket.send(JSON.stringify({socket_key: socketKey}));
			}
		};

		websocket.onmessage = (event) => {
			let json;
			try {
				json = JSON.parse(event.data);
				log.info(event.data);
			} catch (error) { // tslint:disable-line:no-unused
				log.error('Failed to parse message:', event.data);
			}

			if (json.type === 'error') {
				clearInterval(fullUpdateInterval);
				destroyWebsocket();
				socketRep.value.status = 'error';
				log.error('Socket protocol error:', json.error ? json.error : json);
				if (!settled) {
					reject(new Error(json.error ? json.error : 'unknown error'));
					settled = true;
				}
				return;
			}

			if (!settled) {
				resolve();
				socketRep.value.status = 'connected';
				settled = true;
			}

			if (json.type === 'goal') {
				const index = parseInt(json.square.slot.slice(4), 10) - 1;
				boardRep.value.cells[index] = json.square;
			}
		};

		websocket.onclose = (event) => {
			socketRep.value.status = 'disconnected';
			log.info(`Socket closed (code: ${event.code}, reason: ${event.reason})`);
			destroyWebsocket();
			createWebsocket(socketUrl, socketKey).catch(() => {
				// Intentionally discard errors raised here.
				// They will have already been logged in the onmessage handler.
			});
		};
	});
}

function destroyWebsocket() {
	if (!websocket) {
		return;
	}

	try {
		websocket.onopen = noop;
		websocket.onmessage = noop;
		websocket.onclose = noop;
		websocket.close();
	} catch (_error) { // tslint:disable-line:no-unused
		// Intentionally discard error.
	}

	websocket = null;
}
