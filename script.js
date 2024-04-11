/**
 * Copyright David Shumway 2020
 * License: GPLv3
 * Contact: dshumw2@uic.edu
 *
 * Rewrite intentions:
 * Contact: tavaresjanelle@gmail.com
 * Avoid pairing the same people in breakout rooms while handling that
 * participants can come and go at any point during the meeting. Persistent
 * storage of matches between meetings, as well.
 *
 * Notes:
 *  - For debugging purposes, you can mimic breakout rooms functionality
 *        on a "basic" account by enabling
 *      `MeetingConfig.meetingOptions.isEnableBreakoutRoom = true'
 *        in the browser console.
 */

/**
 * Global variables
 */
let logPrefix = 'Zoomie extension::';
let assignableUsers = [], // Assignable users
	assignButtons = [], // Assign buttons
	currentMatches = [],
	previousMatches = [],
	previousMatchesKey = "previousMatches",
	registeredMatches = new Map(),
	pendingMatches = new Map(),
	asterisksUsers = new Map(),
	matchesToAvoid = [], // based on username, which can change... FUN
	matchesToAvoidKey = "matchesToAvoid",
	cohosts = new Map(),
	elements = {
		userIgnoreSelect: null,
		userIgnoreSelectAccept: null,
		userIgnoreSelectTitle: null,
		autoButton: null,

		zoomieSettingsInput: null,
		zoomieSettingsInputAccept: null,
		zoomieSettingsInputTitle: null,
		settingsAutoButton: null,
	},
	breakoutRoomHeight = 0,
	generatedPairs = false,
	breakoutWindowOpen = false // Tracks breakout dialog state (open/closed)
;

/**
 * Initialize the program.
 */
function load() {
	// Add css styles
	add_styles()

	loadStorage()

	// Saved - time to close
	// Saved setting for auto-close time
	if (!localStorage['zoomie-closeTime']) {
		localStorage['zoomie-closeTime'] = 60;
	}

	// If less than 2 seconds, then zoom.us overwrites getBreakoutButton().
	//setTimeout(getBreakoutButton, 2000);
}

function updateStorage() {
	console.log(logPrefix + "updateStorage0: " + matchesToAvoid.length)
	localStorage.setItem(matchesToAvoidKey, JSON.stringify(matchesToAvoid))
	localStorage.setItem(previousMatchesKey, JSON.stringify(previousMatches))
	console.log(logPrefix + "updateStorage1: " + previousMatches.length)
}

function loadStorage() {
	console.log(logPrefix + " loadStorage0 ")
	let value = localStorage.getItem(matchesToAvoidKey)
	let str = JSON.stringify(value)
	if (str !== "null") {
		populateMatchesToAvoid(value)
	}
	console.log(logPrefix + " loadStorage1: " + matchesToAvoid.length)
	value = localStorage.getItem(previousMatchesKey)
	str = JSON.stringify(value)
	if (str !== "null") {
		populateMatches(value)
	}
	console.log(logPrefix + " loadStorage2: " + previousMatches.length)
}

/**
 * Add CSS styles
 */
function add_styles() {
	GM_addStyle(
		'.zoomie-ignoreContainer {' +
		'width:100%;' +
		'z-index:1002;' +
		'position:absolute;' +
		'display:none;' +
		'}'
	);
	GM_addStyle(
		'.zoomie-ignoreUsersTitle {' +
		'width:100%;' +
		'height:40px;' +
		'background-color: aliceblue;' +
		'padding:10px;' +
		'z-index:1002;' +
		//~ 'position:absolute;'+
		'display:none;' +
		'text-align:center;' +
		'font-size:18px;' +
		'font-weight:bold;}'
	);
	GM_addStyle('.zoomie-show {display: block !important;}');
	GM_addStyle('.zoomie-hide {display: none !important;}');
	GM_addStyle('.ignoreLegend {float: left; width: 26%; height: 50px; text-align: left; padding: 2px; text-decoration: underline;}');
	GM_addStyle('.ignoreListOdd {background-color: #cfcfcf}');
	GM_addStyle('.ignoreListEven {background-color: #efefef}');
	GM_addStyle('.zoomieRadio1 {cursor: pointer; zoom: 1.2; width: 8%;}');
	// try matching padding of legends
	GM_addStyle('.zoomieRadio2 {cursor: pointer; zoom: 1.2; width: 8%; margin-right: 10px !important;}');
	// 60px + 10px + 10px = 80px
	GM_addStyle('.zoomieSeconds {background-color: #efefef; border-bottom: 1px solid blue; cursor: pointer; width: 100%; height: 48px; padding: 6px;}');
	GM_addStyle('.zoomieSecondsInput {cursor: pointer; width: 60px; zoom: 1.2; border-radius: 8px; padding-left: 4px; text-align: center;}');

	GM_addStyle('.zoomieInput {cursor: pointer; width: 50%; height: 80%; word-break: break-all}');

	// Overwrites to zoom styles

	GM_addStyle('.common-window {border: 0 !important; box-shadow: none !important; -webkit-box-shadow: none !important;}');

	GM_addStyle('.ReactModal__Content {transform: none !important; top: 4% !important; left: 0 !important;}');
	GM_addStyle('.ReactModal__Content--after-open {transform: none !important; top: 4% !important; left: 0 !important;}');

	GM_addStyle('#boRoomMgmtWindow {width: 98% !important; position: fixed !important; margin-left: 1%;}');
}

// Set an interval to watch for boRoomMgmtWindow element to appear.
// Once it appears, then add the Zoomie button.
// Then, set another interval to check when the boRoomMgmtWindow
// disappears.
window.setInterval(function () {
	// Breakout window popup
	let breakoutWindowPopup = document.getElementById('boRoomMgmtWindow');
	if (breakoutWindowPopup && !breakoutWindowOpen) {
		// Attach the Zoomie button.
		console.log(logPrefix + 'Breakout window opened');
		breakoutWindowOpen = true;
		setTimeout(attachBreakoutContainer, 200);
	} else if (!breakoutWindowPopup && breakoutWindowOpen) {
		// Reset the breakoutWindowOpen boolean.
		breakoutWindowOpen = false;
	}

	// "Recreate" button popup
	let recreateButtonPopup = document.getElementsByClassName('recreate-paper__footer');
	if (recreateButtonPopup && recreateButtonPopup.length === 1 && !recreateButtonPopup[0].zoomie_mark) {
		recreateButtonPopup.zoomie_mark = 1;
		return [0].onclick = attachBreakoutContainer;
	}
}, 1000);


/**
 * Retrieve breakout room dialog box height.
 */
window.onresize = function () {
	getBreakoutRoomHeight();
}

function getBreakoutRoomHeight() {
	let breakoutManager = document.getElementsByClassName('bo-mgmtwindow-content');
	if (breakoutManager && breakoutManager[0] && breakoutManager[0].style) {
		breakoutRoomHeight = parseInt(
			breakoutManager[0].style.height.replace('px', '')
		);
	}
}

/**
 *
 */
function detachSettings() {
	elements.ignoreContainer.parentNode.removeChild(elements.ignoreContainer);
}

/**
 * Attach the settings elements to the dialog box.
 */
function attachZoomie() {
	////////////////////////////////////////////////////////////////
	// Dialog container
	////////////////////////////////////////////////////////////////
	let a = document.getElementById('boRoomMgmtWindow');

	// Container for "-Auto-" button dialog
	let z = document.createElement('div');
	z.className = 'zoomie-ignoreContainer';
	a.insertBefore(z, a.firstChild);
	elements.ignoreContainer = z;

	// Ignore users title bar
	z = document.createElement('div');
	z.className = 'zoomie-ignoreUsersTitle';
	z.innerText = 'Zoomie';
	elements.ignoreContainer.appendChild(z);
	elements.userIgnoreSelectTitle = z;

	//////////////////////////////////////////
	// Ignore users main container
	//////////////////////////////////////////
	z = document.createElement('div');
	z.setAttribute('style', 'width:100%;z-index:1002;display:none;background-color:#eee;overflow:auto;');
	elements.ignoreContainer.appendChild(z);
	elements.userIgnoreSelect = z;
	if (assignableUsers.length) {
		z.innerHTML =
			'<div class="ignoreLegend" style="width: 45% !important;overflow:hidden;">Participant</div>' +
			'<div class="ignoreLegend" style="width: 45% !important;overflow:hidden;">Partners</div>' +
			'<br style="clear:both" />';
	}

	// Ignore users div to contain
	z = document.createElement('div');
	z.setAttribute('style', 'width:100%;height:400px;z-index:1004;display:none;background-color:#eee;overflow:auto;border-bottom:1px solid blue;');
	elements.ignoreContainer.appendChild(z);
	elements.userIgnoreSelectList = z;


	//////////////////////////////////////////
	// Auto-close
	//////////////////////////////////////////
	z = document.createElement('div');
	z.className = 'zoomieSeconds';
	z.setAttribute('style', 'display:none;');
	elements.ignoreContainer.appendChild(z);
	elements.autoCloseDiv = z;

	//
	z = document.createElement('label');
	z.innerText = 'Auto-close rooms after (seconds):  ';
	z.style.cursor = 'pointer';
	elements.autoCloseLabel = z;
	elements.autoCloseDiv.appendChild(z);

	// @TODO deprecate this setting
	z = document.createElement('input');
	z.type = 'number';
	z.min = 0; // No negatives
	z.size = 4;
	z.className = 'zoomieSecondsInput';
	z.value = parseInt(localStorage['zoomie-closeTime']); // parseInt for cleaning
	elements.autoCloseLabel.appendChild(z);
	z.onchange = function () {
		localStorage['zoomie-closeTime'] = parseInt(this.value);
	}


	//////////////////////////////////////////
	// Accept ignored users button
	//////////////////////////////////////////
	z = document.createElement('div');
	z.setAttribute('style', 'width: 100%; text-align: center; padding: 10px 0; background-color: #eee; border-bottom: 1px solid blue; display: none;');
	elements.ignoreContainer.appendChild(z);
	elements.okayButtonDiv = z;

	z = document.createElement('button');
	z.setAttribute('style', 'z-index:1002;display:none;');
	z.className = 'btn btn-primary';
	z.innerText = 'Okay';
	z.onclick = addToRooms;
	elements.okayButtonDiv.appendChild(z);
	elements.userIgnoreSelectAccept = z;

	//////////////////////////////////////////
	// Cancel button
	//////////////////////////////////////////
	z = document.createElement('button');
	z.setAttribute('style', 'z-index:1002;display:none;margin-left: 4px;');
	z.className = 'btn btn-primary';
	z.innerText = 'Cancel';
	z.onclick = cancelMatchesReview;
	elements.okayButtonDiv.appendChild(z);
	elements.userIgnoreSelectCancel = z;
}

function attachZoomieSettings() {
	////////////////////////////////////////////////////////////////
	// Dialog container
	////////////////////////////////////////////////////////////////
	let a = document.getElementById('boRoomMgmtWindow');

	// Container for "-Auto-" button dialog
	let z = document.createElement('div');
	z.className = 'zoomie-ignoreContainer';
	a.insertBefore(z, a.firstChild);
	elements.zoomieSettingsContainer = z;

	// Ignore users title bar
	z = document.createElement('div');
	z.className = 'zoomie-ignoreUsersTitle';
	z.innerText = 'Zoomie Settings';
	elements.zoomieSettingsContainer.appendChild(z);

	//////////////////////////////////////////
	// Zoomie settings main container
	//////////////////////////////////////////
	z = document.createElement('div');
	z.setAttribute('style', 'width:100%;z-index:1002;display:none;background-color:#eee;overflow:auto;');
	elements.zoomieSettingsContainer.appendChild(z);
	elements.zoomieSettingsInputTitle = z;
	z.innerHTML =
		'<div class="ignoreLegend" style="width: 50% !important;overflow:hidden;">Avoid Matches</div>' +
		'<div class="ignoreLegend" style="width: 50% !important;overflow:hidden;">Previous Matches</div>' +
		'<br style="clear:both" />';

	// Avoid matches div to contain
	z = document.createElement('div');
	z.setAttribute('style', 'width:100%;height:400px;z-index:1004;display:none;background-color:#eee;overflow:auto;border-bottom:1px solid blue;');
	elements.zoomieSettingsContainer.appendChild(z);
	elements.zoomieSettingsInput = z;

	//
	z = document.createElement('input');
	z.type = 'textarea';
	z.value = JSON.stringify(matchesToAvoid, null, 2);
	z.className = 'zoomieInput';
	elements.zoomieSettingsInput.appendChild(z);
	z.onchange = function () {
		populateMatchesToAvoid(this.value)
		updateStorage()
	}

	//
	z = document.createElement('input');
	z.type = 'textarea';
	z.value = JSON.stringify(previousMatches, null, 2);
	z.className = 'zoomieInput';
	elements.zoomieSettingsInput.appendChild(z);
	z.onchange = function () {
		populateMatches(this.value)
		updateStorage()
	}

	//////////////////////////////////////////
	// Accept settings button
	//////////////////////////////////////////
	z = document.createElement('div');
	z.setAttribute('style', 'width: 100%; text-align: center; padding: 10px 0; background-color: #eee; display:none; border-bottom: 1px solid blue;');
	elements.zoomieSettingsContainer.appendChild(z);
	elements.zoomieSettingButtonDiv = z;

	z = document.createElement('button');
	z.setAttribute('style', 'z-index:1002;');
	z.className = 'btn btn-primary';
	z.innerText = 'Okay';
	z.onclick = closeZoomieSettings;
	elements.zoomieSettingButtonDiv.appendChild(z);
	elements.zoomieSettingsInputAccept = z;
}

/**
 * After user clicks "Breakout Rooms" button, adds "Zoomie".
 */
async function attachBreakoutContainer() {
	// Check footer exists
	let y = document.getElementsByClassName(
		//'bo-mgmtwindow-content__footer'
		//'bo-room-not-started-footer__actions'
		'bo-room-not-started-footer__btn-wrapper'
	);
	if (!y.length) {
		setTimeout(attachBreakoutContainer, 100);
		return;
	}

	// Remove any users from rooms
	await resetPairings();

	// Add listener to "Open All Rooms" button but only if it exists.
	if (!attachOpenAllRooms()) {
		setTimeout(attachBreakoutContainer, 200);
		return;
	}

	// Gets height of window to work with.
	getBreakoutRoomHeight();

	// Remove button if exists.
	if (elements.autoButton) {
		try {
			elements.autoButton.parentNode.removeChild(elements.autoButton);
			elements.autoButton = null;
		} catch (e) {
			console.log(logPrefix + 'Could not remove autoButton');
		}
	}

	if (elements.settingsAutoButton) {
		try {
			elements.settingsAutoButton.parentNode.removeChild(elements.settingsAutoButton);
			elements.settingsAutoButton = null;
		} catch (e) {
			console.log(logPrefix + 'Could not remove autoButton');
		}
	}

	let z = document.createElement('button');
	y[0].insertBefore(z, y[0].firstChild);
	z.innerHTML = 'Zoomie Settings';
	z.onclick = showZoomieSettings;
	z.className =
		'zmu-btn bo-bottom-btn zmu-btn--default zmu-btn__outline--blue';
	// Changed Feb. 2021
	//'zmu-btn zm-btn-legacy zmu-btn--default zmu-btn__outline--blue';
	z.style.marginRight = '10px';
	elements.settingsAutoButton = z;

	// An "auto"-pair button that can be clicked any number
	// of times, continuously randomly permutating the
	// people into breakout rooms of size=2.
	z = document.createElement('button');
	y[0].insertBefore(z, y[0].firstChild);
	z.innerHTML = 'Zoomie';
	z.onclick = showMatchesReview;
	z.className =
		'zmu-btn bo-bottom-btn zmu-btn--default zmu-btn__outline--blue';
	// Changed Feb. 2021
	//'zmu-btn zm-btn-legacy zmu-btn--default zmu-btn__outline--blue';
	z.style.marginRight = '10px';
	elements.autoButton = z;
}

/**
 * Perform an action when Open All Rooms is clicked.
 *
 * Update (Feb. 2021): Button class updated.
 *
 * @return: Boolean True if listener was added to "Open All Rooms" button.
 */
function attachOpenAllRooms() {
	let openAllRoomsButton = document.getElementsByClassName(
		'zmu-btn bo-bottom-btn zmu-btn--primary zmu-btn__outline--blue'
		// prior to Feb. 2021
		// 'zmu-btn zm-btn-legacy bottom-btn zmu-btn--primary zmu-btn__outline--blue'
	);

	if (openAllRoomsButton[0]) {
		// Update July 2020: Zoom added a second button with same class name.
		for (let i = 0; i < openAllRoomsButton.length; i++) {
			if (openAllRoomsButton[i].innerText.trim() === 'Open All Rooms') {
				openAllRoomsButton[i].addEventListener('click', updatePairingsFinal, false);
				return true;
			}
		}
	}
	return false;
}

/**
 * Fire events when Open All Rooms is clicked.
 */
function attachCloseAllRooms() {
	let closeAllRoomsButton = document.getElementsByClassName(
		'zmu-btn zmu-btn--danger zmu-btn__outline--blue'
	);
	if (closeAllRoomsButton[0]) {
		// Update July 2020: Zoom added a second button with same class name.
		for (let i = 0; i < closeAllRoomsButton.length; i++) {
			if (closeAllRoomsButton[i].innerText.trim() === 'Close All Rooms') {
				closeAllRoomsButton[i].addEventListener('click', closeAllRooms, false);
				// If there is an "auto-close" set, then use it now.
				setTimeout(autoCloseRooms,
					parseInt(localStorage['zoomie-closeTime']) * 1000);
				break;
			}
		}
	} else {
		console.log(logPrefix + 'Missing "Close all rooms" button!');
		setTimeout(attachCloseAllRooms, 1000);
	}
}

/**
 *
 */
function autoCloseRooms() {
	let closeAllRoomsButton = document.getElementsByClassName(
		'zmu-btn zmu-btn--danger zmu-btn__outline--blue'
	);
	if (closeAllRoomsButton[0]) {
		// Update July 2020: Zoom added a second button with same class name.
		for (let i = 0; i < closeAllRoomsButton.length; i++) {
			if (closeAllRoomsButton[i].innerText.trim() === 'Close All Rooms') {
	setTimeout(() => {
				closeAllRoomsButton[i].click();
	}, 0);
				break;
			}
		}
	}
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * User accepted pairings and opened rooms, so finalize pairs list.
 */
async function updatePairingsFinal() {
	// Remove the -Auto- button.
	elements.autoButton.parentNode.removeChild(elements.autoButton);

	// Attach to close all rooms button.
	// @TODO not sure this is working anymor
	setTimeout(attachCloseAllRooms, 100);

	previousMatches = previousMatches.concat(currentMatches)
	currentMatches = []

	let merged = new Map([...registeredMatches, ...pendingMatches])
	registeredMatches = merged
	pendingMatches = new Map()

	updateStorage()

	// @TODO automate halfway broadcast message
	/*
	console.log(logPrefix+"waiting 3:30 until broadcast")
	//for (let i = 0; i < 7; i++) {
	//	await sleep(30000);
	//	console.log(logPrefix+"...30s...")
	//}
	let footer = document.getElementsByClassName(
	    "bo-room-in-progress-footer"
	)[0];
	let broadcast = footer.getElementsByClassName(
	    "bo-room-in-progress-footer__btn-broadcast"
	)[0];
	broadcast.click();
	console.log(logPrefix+"#1")

	let broadcastMessage = footer.getElementsByClassName(
	    "zmu-btn broadcastclassNameon-paper__btn zmu-btn--ghost zmu-btn__outline--blue"
	)[0];
	broadcastMessage.click();
	console.log(logPrefix+"#2")
	let textArea = footer.getElementsByClassName(
	    "bmaxLengthoadcastclassNamel__textarea"
	)[0];
	textArea.value = "H A L F W A Y   T H R O U G H !! :^)"
	console.log(logPrefix+"#3 filled")
	let send = footer.getElementsByClassName(
	    "bo-room-broadcast-panel__send-btn"
	)[0];
	send.click();
	console.log(logPrefix+"#4")

	 */
}

/**
 * Add back the -Auto- button.
 */
function closeAllRooms() {
	attachBreakoutContainer();
}

/**
 * Display BO matches for review
 */
function addMatchesReview() {
	let div = elements.userIgnoreSelectList;
	div.innerHTML = '';

	// No users?
	if (!assignableUsers || assignableUsers.length === 0) {
		div.innerHTML = '<br><center><b>No users found!</b></center><br>';
		return;
	}

	// All users loop
	for (let i in currentMatches) {
		let pnum = parseInt(i) + 1; // Participant number. Start at 1, not 0.
		let matches = currentMatches[i].Participants
		let z = document.createElement('div');
		z.setAttribute('style', 'width:100%;');
		z.className = 'ignoreList' + (i % 2 === 0 ? 'Odd' : 'Even');
		div.appendChild(z);

		let y = document.createElement('span');
		y.setAttribute('style', 'width: 5%;height:24px;overflow:hidden;display:inline-block;');
		y.innerText = '(' + (pnum < 10 ? '0' + pnum : pnum) + ') ';
		z.appendChild(y);


		let x = document.createElement('span');
		x.setAttribute('style', 'width: 25%;height:24px;border:1px solid blue;overflow:hidden;display:inline-block;text-align:center;');
		x.innerText = matches[0].DisplayName;
		z.appendChild(x);

		let w = document.createElement('span');
		w.setAttribute('style', 'width: 25%;height:24px;border:1px solid blue;overflow:hidden;display:inline-block;text-align:center;');
		w.innerText = matches[1].DisplayName;
		z.appendChild(w);
	}
}

/**
 * Hide & cancel
 */
function cancelMatchesReview() {
	detachSettings();
	// Show the default dialogs
	try {
		document.getElementsByClassName('window-content')[0].style.display = '';
	} catch (e) {

	}
}

/**
 * Hide ignore users dialog box and run the pairing program.
 */
function hideMatchesReview() {
	detachSettings();

	// Show the default dialogs
	try {
		document.getElementsByClassName('window-content')[0].style.display = '';
	} catch (e) {

	}
}

/**
 *
 */
async function addToRooms() {
	// hide the zoomie select dialog
	hideMatchesReview();

	// add users to rooms
	//let r = parseInt(localStorage['zoomie-roundNumber']);
	let roomNo = 0;

	// Sanity check. No pairs (e.g., none or one user present).
	if (!currentMatches) {
		// Exit silently.
		return;
	}
	// Sanity check. If there aren't enough rooms, then quit right off.
	if (assignButtons.length < currentMatches.length) {
		// Need to have more breakout rooms!
		// Alert the zoomie user.
		alert('Please create more breakout rooms. There are not enough rooms for every pair of participants.');
		return;
	}

	// Loop to add to rooms
	for (let i in currentMatches) {
		let p = currentMatches[i].Participants;
		if (p[0].DisplayName === null || p[1].DisplayName === null) continue; // Leave out solos
		// Made it past nulls. Open "Assign" dialog box.
		// Loops through checkboxes.
		// this finds all of the checkboxes, regardless of which popup they belong to
		//setTimeout(() => {
		console.log("addToRooms: room no "+roomNo);
		//await clickButtonWithTimeout(assignButtons[roomNo]);
		//await findPair(p);
		//await clickButtonWithTimeout(assignButtons[roomNo]);
/*
		clickWithPromise(assignButtons[roomNo])
			.then(function (result) {
				// if clicking doesn't happen inside a task, the result is not available to the rest of the code
				console.log("inside then: " + result)
				findPair(p, assignButtons[roomNo])
			})
			.catch(function() {
				console.log("balls");
			})

 */

		await asyncClick(assignButtons[roomNo])
		await asyncFindPair(p)
		await asyncClick(assignButtons[roomNo])
		roomNo++;
	}

}

function findPair(pair, element) {
	return new Promise((resolve) => {
	let availableParticipants = document.getElementsByClassName(
		//'zmu-data-selector-item__icon-text-wrapper zmu-data-selector-item__icon-text-wrapper--has-checkbox'
		//'zmu-data-selector-item'
		//'zmu-data-selector-item__text'
		'zmu-data-selector-item__text bo-room-assign-list-scrollbar__item-text'
		//'zmu-data-selector-item__checkbox'
	);
	console.log(logPrefix + "findPair: num avail part " + availableParticipants.length);

	for (let k = 0; k < availableParticipants.length; k++) {
		if (availableParticipants[k].innerText === pair[0].DisplayName
			|| availableParticipants[k].innerText === pair[1].DisplayName) {
			console.log(logPrefix + "findPair: clicking user checkbox [" + k + "] " + availableParticipants[k].innerText + " " );

		setTimeout(() => {
		//queueMicrotask(function() {
			if (availableParticipants[k]) {
				availableParticipants[k].click();
			} else {
			console.log(logPrefix + "findPair: wtf am i skipping "  + availableParticipants[k].innerText);
			}
		}, 0);  // also promise? queueMicrotask?
		}
	}
		setTimeout(() => {
	console.log(logPrefix + "findPair: closing assign menu");

			element.click();
		}, 0);
	resolve("find pair accomplished")
	});
}

async function asyncFindPair(pair) {
	let availableParticipants = document.getElementsByClassName(
		//'zmu-data-selector-item__icon-text-wrapper zmu-data-selector-item__icon-text-wrapper--has-checkbox'
		//'zmu-data-selector-item'
		//'zmu-data-selector-item__text'
		'zmu-data-selector-item__text bo-room-assign-list-scrollbar__item-text'
		//'zmu-data-selector-item__checkbox'
	);
	console.log(logPrefix + "findPair: num avail part " + availableParticipants.length);

	for (let k = 0; k < availableParticipants.length; k++) {
		if (availableParticipants[k].innerText === pair[0].DisplayName
			|| availableParticipants[k].innerText === pair[1].DisplayName) {
			console.log(logPrefix + "findPair: clicking user checkbox [" + k + "] " + availableParticipants[k].innerText + " " );
		await new Promise(r =>
		setTimeout(() => {
		//queueMicrotask(function() {
			//if (availableParticipants[k]) {
				availableParticipants[k].click();
			//}
			r();
		}, 0));  // also promise? queueMicrotask?
		}
	}
	return "done";
}

async function asyncClick(element) {
	element.click();
}

function clickWithPromise(element) {
	return new Promise((resolve) => {
		setTimeout(() => {
			element.click();
			console.log("clicked with promise");
			resolve("clicked");
		}, 0);
	});
}

/**
 *
 */
function closeZoomieSettings() {
	elements.zoomieSettingsContainer.parentNode.removeChild(elements.zoomieSettingsContainer);

	// Show the default dialogs
	try {
		document.getElementsByClassName('window-content')[0].style.display = '';
	} catch (e) {

	}
}

/**
 * The brains
 */
async function showMatchesReview() {
	// Close any popup dialog boxes that are opened when user clicks
	// any of the "Assign" buttons.
	await closeAssignPopups()
	await resetPairings()

	console.log("after awaits in showMatchesReview")
	// Update global user data.
	//setTimeout(() => {
	assignButtons = getAllAssignButtons();
	if (assignButtons[0]) {
		initializeAssignableUsers();
	}
}

function makeMatchesAndReview() {
	// Generate pairs if new run.
	generatedPairs = makeMatches(assignableUsers)
	console.log(logPrefix + "currentMatches " + currentMatches.length)

	// Attach the elements
	attachZoomie(); // Create the elements.
	elements.userIgnoreSelectTitle.className = 'zoomie-ignoreUsersTitle zoomie-show';
	elements.ignoreContainer.className = 'zoomie-ignoreContainer zoomie-show';
	elements.userIgnoreSelect.style.display = '';
	elements.userIgnoreSelectAccept.style.display = '';
	elements.autoCloseDiv.style.display = '';
	elements.userIgnoreSelectList.style.display = '';
	elements.okayButtonDiv.style.display = '';
	elements.userIgnoreSelectCancel.style.display = '';
	// Users
	addMatchesReview();

	// Hide the background dialogs
	try {
		document.getElementsByClassName('window-content')[0].style.display = 'none';
	} catch (e) {
		console.log(logPrefix + e)
	}
}

/**
 * Show Zoomie settings.
 */
async function showZoomieSettings() {
	// Close any popup dialog boxes that are opened when user clicks
	// any of the "Assign" buttons.
	await closeAssignPopups()
	await resetPairings()

		// Attach the elements
		attachZoomieSettings(); // Create the elements.
		elements.zoomieSettingsInputTitle.className = 'zoomie-ignoreUsersTitle zoomie-show';
		elements.zoomieSettingsContainer.className = 'zoomie-ignoreContainer zoomie-show';
		elements.zoomieSettingsInput.style.display = '';
		elements.zoomieSettingsInputAccept.style.display = '';
		elements.zoomieSettingButtonDiv.style.display = '';

		// Users
		// addMatchesReview();

		// Hide the background dialogs
		try {
			document.getElementsByClassName('window-content')[0].style.display = 'none';
		} catch (e) {

		}
}


/**
 * Closes all Assign button popups before running auto-assign.
 */
const visibleParticipantsPopUpClass1 = 'zmu-tooltip-zmu-paper'
const visibleParticipantsPopUpClass2 = 'bo-room-assign-list-scrollbar'

async function closeAssignPopups() {
		console.log("inside closeAssignPopups")
		let a = document.getElementsByClassName(
			'zmu-btn bo-room-item-container__ghost-blue zmu-btn--ghost ' +
			'zmu-btn__outline--blue zmu-btn--sm'
		);
		// zmu-data-selector
		// zmu-data-selector-item

		// alternative classes to try
		// 'zmu-tooltip__container'
		let x = document.getElementsByClassName(visibleParticipantsPopUpClass2);
		console.log(logPrefix + "cap: containers to close found: " + x.length);
		for (let i = 0; i < x.length; i++) {
			// all of the containers are there all of the time, but most are not visible
			if (x[i].innerHTML !== '') {
				// Typically only one opened at a time.
				// Thus, could break here.
				// But for the sake of completeness, it's worth it to
				// assume that in some case two dialog popups would
				// be open simultaneously.
				console.log(logPrefix + "cap: clicking a button");
		await new Promise(r =>
	setTimeout(() => {
				a[i].click();
			r();
	}, 0)
	);
			}
		}
}

async function resetPairings() {
	//return new Promise((resolve) => {
	currentMatches = []
	pendingMatches = new Map()

		console.log("inside resetpairings: "+assignButtons.length)
	// Go through every room and remove any users in the room.
	for (let i = 0; i < assignButtons.length; i++) {
		try {
			await asyncClick(assignButtons[i]);
			await removeAllParticipantsFromBORoom();
			await asyncClick(assignButtons[i]);
		} catch (e) {
			console.log(logPrefix + 'Could not reset pairings');

		}
		/*
		clickWithPromise()
			.then(function (result) {
				return
			})
			.then(() => clickWithPromise(assignButtons[i]))
			.catch(function () {
				console.log("did not reset pairs completely")
			})

		 */
	}
	//resolve("pairings have been reset")
	//});
}

async function removeAllParticipantsFromBORoom() {
	//return new Promise((resolve) => {
	let allCheckedBoxes = document.getElementsByClassName(
		'zmu-data-selector-item__checkbox zmu-data-selector-item__checkbox--checked'
	);
	for (let k = allCheckedBoxes.length - 1; k >= 0; k--) {
		console.log('removing user from room '+k);
		await new Promise(r =>
	setTimeout(() => {
		allCheckedBoxes[k].click(); // Unclick the user.
			r();
	}, 0)
	);
	}
	//resolve("all checked boxes unchecked")
//});
	return "done";
}

function duplicateOrAvoid(firstParticipant, secondParticipant) {
	if (firstParticipant.UniqueName === secondParticipant.UniqueName) {
		console.log(logPrefix + "GAHHHHH");
		return {duplicate: false, avoid: true, cohosts: false};
	}
	if (firstParticipant.UniqueName === "") {
		console.log(logPrefix + "GAHHHHH");
		return {duplicate: false, avoid: true, cohosts: false};
	}
	if (secondParticipant.UniqueName === "") {
		console.log(logPrefix + "GAHHHHH");
		return {duplicate: false, avoid: true, cohosts: false};
	}

	// Do not match cohosts
	if (isCohost(firstParticipant) && isCohost(secondParticipant)) {
		console.log(logPrefix + "trying to avoid matching cohosts")
		return {
			duplicate: false,
			avoid: false,
			cohosts: true,
		};
	}

	let one = registeredMatches.has(firstParticipant.UniqueName + secondParticipant.UniqueName)
	let two = registeredMatches.has(secondParticipant.UniqueName + firstParticipant.UniqueName)
	let duplicate = one && two


	let firstUniqueName = firstParticipant.UniqueName
	if (firstUniqueName !== "") {
		firstUniqueName = firstUniqueName.toLowerCase()
	}
	let secondUniqueName = secondParticipant.UniqueName
	if (secondUniqueName !== "") {
		secondUniqueName = secondUniqueName.toLowerCase()
	}
	let avoid = false
	for (let key in matchesToAvoid) {
		let firstAvoidLower = matchesToAvoid[key][0].toLowerCase()
		let secondAvoidLower = matchesToAvoid[key][1].toLowerCase()
		if (firstUniqueName.includes(firstAvoidLower)) {
			if (secondUniqueName.includes(secondAvoidLower)) {
				avoid = true
			}
		} else if (secondUniqueName.includes(firstAvoidLower)) {
			if (firstUniqueName.includes(secondAvoidLower)) {
				avoid = true
			}
		}
	}

	return {
		duplicate: duplicate,
		avoid: avoid,
		cohosts: false,
	};
}

// if no non duplicate found by the end, start over at the beginning
function replaceWithAnyNonduplicate(currentMatches, participants) {
	let participant = {DisplayName: participants[0], UniqueName: uniqueNameFromDisplayName(participants[0])}
	for (let i = 0; i < currentMatches.length; i++) {
		let match = currentMatches[i]
		let result = duplicateOrAvoid(participant, match.Participants[1])
		let dup = result.duplicate
		let avoid = result.avoid

		if (!dup && !avoid) {
			if (!match.Duplicate) {
				console.log(logPrefix + "Unmatching " + match.Participants[0].DisplayName + " and " + match.Participants[1].DisplayName);
				unregisterMatch(match.Participants[0].UniqueName, match.Participants[1].UniqueName)
			}
			console.log(logPrefix + "Matching " + participant.DisplayName + " and " + match.Participants[1].DisplayName);
			registerMatch(participant.UniqueName, match.Participants[1].UniqueName)
			currentMatches[i] = {
				Participants: [participant, match.Participants[1]],
				Duplicate: dup
			}
			participants[0] = match.Participants[0].DisplayName
			return true
		}

		result = duplicateOrAvoid(participant, match.Participants[0])
		dup = result.duplicate
		avoid = result.avoid
		if (!dup && !avoid) {
			if (!match.Duplicate) {
				console.log(logPrefix + "Unmatching " + match.Participants[0].DisplayName + " and " + match.Participants[1].DisplayName);
				unregisterMatch(match.Participants[1].UniqueName, match.Participants[0].UniqueName)
			}
			console.log(logPrefix + "Matching " + participant.DisplayName + " and " + match.Participants[0].DisplayName);
			registerMatch(participant.UniqueName, match.Participants[0].UniqueName)
			currentMatches[i] = {
				Participants: [participant, match.Participants[0]],
				Duplicate: dup
			}
			participants[0] = match.Participants[1].DisplayName
			return true
		}
	}
	return false
}

function replaceWithAnyCohost(currentMatches, participant) {
	console.log(logPrefix + "replaceWithAnyCohost: " + participant.DisplayName)
	let lastFoundCohost = -1
	for (let i = 0; i < currentMatches.length; i++) {
		let match = currentMatches[i]

		if (isCohost(match.Participants[0])) {
			let result = duplicateOrAvoid(participant, match.Participants[1])
			let dup = result.duplicate
			let avoid = result.avoid

			if (!avoid) {
				lastFoundCohost = i
			}
			if (!dup && !avoid) {
				if (!match.Duplicate) {
					console.log(logPrefix + "Unmatching " + match.Participants[0].DisplayName + " and " + match.Participants[1].DisplayName);
					unregisterMatch(match.Participants[0].UniqueName, match.Participants[1].UniqueName)
				}
				console.log(logPrefix + "Matching " + participant.DisplayName + " and " + match.Participants[1].DisplayName);
				registerMatch(participant.UniqueName, match.Participants[1].UniqueName)

				currentMatches[i] = {
					Participants: [participant, match.Participants[1]],
					Duplicate: dup
				}
				return true
			}
		}
		if (isCohost(match.Participants[1])) {
			let result = duplicateOrAvoid(participant, match.Participants[0])
			let dup = result.duplicate
			let avoid = result.avoid

			if (!avoid) {
				lastFoundCohost = i
			}
			if (!dup && !avoid) {
				if (!match.Duplicate) {
					console.log(logPrefix + "Unmatching " + match.Participants[0].DisplayName + " and " + match.Participants[1].DisplayName);
					unregisterMatch(match.Participants[0].UniqueName, match.Participants[1].UniqueName)
				}
				console.log(logPrefix + "Matching " + participant.DisplayName + " and " + match.Participants[0].DisplayName);
				registerMatch(participant.UniqueName, match.Participants[0].UniqueName)

				currentMatches[i] = {
					Participants: [participant, match.Participants[0]],
					Duplicate: dup
				}
				return true
			}
		}
	}

	if (lastFoundCohost !== -1) {
		let match = currentMatches[lastFoundCohost]
		if (isCohost(match.Participants[0])) {
			let result = duplicateOrAvoid(participant, match.Participants[1])
			let dup = result.duplicate
			let avoid = result.avoid

			if (!avoid) {
				if (!match.Duplicate) {
					console.log(logPrefix + "Unmatching " + match.Participants[0].DisplayName + " and " + match.Participants[1].DisplayName);
					unregisterMatch(match.Participants[0].UniqueName, match.Participants[1].UniqueName)
				}
				console.log(logPrefix + "Matching " + participant.DisplayName + " and " + match.Participants[1].DisplayName);
				registerMatch(participant.UniqueName, match.Participants[1].UniqueName)

				currentMatches[lastFoundCohost] = {
					Participants: [participant, match.Participants[1]],
					Duplicate: dup
				}
				return true
			}
		}
		if (isCohost(match.Participants[1])) {
			let result = duplicateOrAvoid(participant, match.Participants[0])
			let dup = result.duplicate
			let avoid = result.avoid

			if (!avoid) {
				if (!match.Duplicate) {
					console.log(logPrefix + "Unmatching " + match.Participants[0].DisplayName + " and " + match.Participants[1].DisplayName);
					unregisterMatch(match.Participants[0].UniqueName, match.Participants[1].UniqueName)
				}
				console.log(logPrefix + "Matching " + participant.DisplayName + " and " + match.Participants[0].DisplayName);
				registerMatch(participant.UniqueName, match.Participants[0].UniqueName)

				currentMatches[lastFoundCohost] = {
					Participants: [participant, match.Participants[1]],
					Duplicate: dup
				}
				return true
			}
		}
	}
	return false
}

function registerMatch(firstUniqueName, secondUniqueName) {
	pendingMatches.set(firstUniqueName + secondUniqueName, true)
	pendingMatches.set(secondUniqueName + firstUniqueName, true)
}

function unregisterMatch(firstUniqueName, secondUniqueName) {
	pendingMatches.delete(firstUniqueName + secondUniqueName)
	pendingMatches.delete(secondUniqueName + firstUniqueName)
}

function populateMatches(blob) {
	previousMatches = []
	if (blob === "" || blob === null || blob === "null") {
		blob = "[]"
	}
	try {
		previousMatches = JSON.parse(blob)
	} catch {
		previousMatches = []
	}
	registeredMatches.clear()

	for (let i = 0; i < previousMatches.length; i++) {
		// to registeredMatches
		registerMatch(previousMatches[i].Participants[0].UniqueName, previousMatches[i].Participants[1].UniqueName)
	}
}

function populateMatchesToAvoid(blob) {
	matchesToAvoid = []
	if (blob === "" || blob == null || blob === "null") {
		blob = "[]"
	}
	// format [][]string [['x', 'y'], ['a', 'b']]
	try {
		matchesToAvoid = JSON.parse(blob)
	} catch {
		matchesToAvoid = []
	}
}

function isCohost(participant) {
	if (participant.DisplayName.includes("***")) {
		// if a cohost is currently skipping breakouts, don't treat them like a cohost
		// this should be unnecessary
		console.log("skipping *** cohost")
		return false
	}
	return cohosts.get(participant.DisplayName) !== undefined
}

function makeMatches(assignableUsers) {
	currentMatches = []
	pendingMatches = new Map()
	let giveUp = new Map()

	let availableParticipants = [...assignableUsers]

	while (availableParticipants.length >= 2) {
		console.log(logPrefix + 'Remaining available participants to match ' + availableParticipants.length);
		let second = 1

		// shouldn't be necessary anymore
		if (availableParticipants[0] === "") {
			availableParticipants.splice(0, 1);
			continue
		}
		if (availableParticipants[second] === "") {
			availableParticipants.splice(second, 1);
			continue
		}
		let firstParticipant = {
			DisplayName: availableParticipants[0],
			UniqueName: uniqueNameFromDisplayName(availableParticipants[0])
		}
		let secondParticipant = {
			DisplayName: availableParticipants[second],
			UniqueName: uniqueNameFromDisplayName(availableParticipants[second])
		}

		let result = duplicateOrAvoid(firstParticipant, secondParticipant)
		let dup = result.duplicate
		let avoid = result.avoid
		let cohosts = result.cohosts
		let avoided = false
		let givingUp = false

		if (!((cohosts === true) && (availableParticipants.length !== 2))) {
			if (dup || avoid) {
				console.log(logPrefix + "found a duplicate (" + dup + ") avoid (" + avoid + ") between " + availableParticipants[0] + " and " + availableParticipants[second])
			}
			while ((dup || avoid || cohosts) && (second <= availableParticipants.length - 2) && !givingUp) { // -1 for index numbering and -1 for line 140
				console.log(logPrefix + "trying to fix")
				let attempted = giveUp.has(availableParticipants.length)
				let value = 1
				if (attempted) {
					value = giveUp.get(availableParticipants.length) + 1
				}
				giveUp.set(availableParticipants.length, value)
				if (!avoid && value >= (currentMatches.length + availableParticipants.length)) {
					console.log(logPrefix + "giving up")
					givingUp = true
					break
				}
				second++
				secondParticipant = {
					DisplayName: availableParticipants[second],
					UniqueName: uniqueNameFromDisplayName(availableParticipants[second])
				}
				result = duplicateOrAvoid(firstParticipant, secondParticipant)
				dup = result.duplicate
				avoid = result.avoid
				cohosts = result.cohosts
			}

			avoided = true
			if ((dup || avoid || cohosts) && !givingUp) {
				let attempted = giveUp.has(availableParticipants.length)
				let value = 1
				if (attempted) {
					value = giveUp.get(availableParticipants.length) + 1
				}
				giveUp.set(availableParticipants.length, value)
				if (!avoid && value >= (currentMatches.length + availableParticipants.length)) {
					console.log(logPrefix + "giving up")
					givingUp = true
					break
				}

				// if no non duplicate found by the end, start over at the beginning
				let ok = replaceWithAnyNonduplicate(currentMatches, availableParticipants)
				if (!ok) {
					avoided = false
					console.log(logPrefix + "Unable to avoid duplicate!")
				} else {
					dup = false
					avoid = false
					continue
				}
			}
		}

		if (givingUp || ((!dup && !avoid) || (dup && !avoided))) {
			registerMatch(firstParticipant.UniqueName, secondParticipant.UniqueName);
			console.log(logPrefix + "Matching " + availableParticipants[0] + " and " + availableParticipants[second] + " (" + second + ")");
			let m = {
				Duplicate: dup,
				Participants: [firstParticipant, secondParticipant]
			};
			currentMatches.push(m);
			availableParticipants.splice(second, 1);
			availableParticipants.splice(0, 1);
		} else {
			console.log(logPrefix + "Skipping participant because of avoid!")
			availableParticipants.splice(0, 1);
		}

		if (availableParticipants.length === 1) {
			firstParticipant = {
				DisplayName: availableParticipants[0],
				UniqueName: uniqueNameFromDisplayName(availableParticipants[0])
			}
			if (!isCohost(firstParticipant)) {
				console.log(logPrefix + "BAD! odd participant left out")
				// switch odd participant with any cohost

				let ok = replaceWithAnyCohost(currentMatches, firstParticipant)
				if (!ok) {
					console.log(logPrefix + "Well this is awkward... couldn't find a cohost to switch with the odd participant")
				}
			}
		}
	}

	return true
}

function uniqueNameFromDisplayName(displayName) {
	let parts = displayName.split(" ")
	let firstIndex = 0
	let secondIndex = 1


	for (let i = 0; i < parts.length; i++) {
		let part = parts[i]

		if (isPronoun(part) || isColor(part)) {
			if (i === 0) {
				firstIndex++
				secondIndex++
				continue
			}
			let concat = parts.slice(firstIndex, secondIndex).join(" ").trim()
			if (concat === "") {
				concat = displayName
			}
			return concat
		}
		secondIndex++
	}
	let concat = parts.slice(firstIndex, secondIndex).join(" ").trim()
	if (concat === "") {
		concat = displayName
	}
	return concat
}

function isColor(part) {
	let lower = part.toLowerCase().trim()
	switch (lower) {
		case "r":
		case "y":
		case "g":
			return true
		default:
			return false
	}
}

function isPronoun(part) {
	let lower = part.toLowerCase().trim()
	if (lower.includes("/")) {
		return true
	}
	if (lower.includes("(") || lower.includes(")")) {
		return true
	}
	switch (lower) {
		case "he":
		case "him":
		case "she":
		case "her":
		case "they":
		case "them":
			return true
		default:
			return false
	}

}

function initializeAssignableUsers() {
	clickWithPromise(assignButtons[0])
		.then((result) => {
			return new Promise((resolve) => {
				console.log("inside IAU promise")
				//setTimeout(() => { ???
				assignableUsers = []
				let x = document.getElementsByClassName(
					'zmu-data-selector-item__text bo-room-assign-list-scrollbar__item-text'
				);
				console.log("IAU: found available parts num: " + x.length)
				if (x.length === 0) {
					//alert('(Zoomie) No assignable users!');
					//closeAssignPopups()
					assignButtons[0].click(); // Close the box, maybe just resolve instead
					return false;
				}

				asterisksUsers.clear()
				let lastCohost = "";
				for (let i = 0; i < x.length; i++) {
					let username = x[i].innerText.trim()
					let skip = username.includes("***")
					if (skip) {
						asterisksUsers.set(username, true)
						continue
					}
					if (containsCohost(username) === true) {
						cohosts.set(username, true)
						continue
					}

					// Add an attribute for our purposes
					assignableUsers.push(username)
				}

				// grab lastCohost randomly from list
				let index = 0
				let key = Math.floor(Math.random() * cohosts.size);
				for (let username of cohosts.keys()) {
					if (index === key) {
						console.log(logPrefix + "last cohost: " + username)
						lastCohost = username
					} else {
						assignableUsers.push(username)
					}
					index++
				}

				assignableUsers = shuffle(assignableUsers);
				if (lastCohost !== "") {
					assignableUsers.push(lastCohost)
				}
				resolve();
			//}, 0);
			})
		})
		.then(() => {
			return clickWithPromise(assignButtons[0]);
		})
		.then(() => makeMatchesAndReview() )
		.catch((broken) => {
			console.log("oh noes "+broken)
		})
}

function containsCohost(username) {
	let lower = username.toLowerCase()
	return lower.includes("cohost") ||
		lower.includes("co-host") ||
		lower.includes("co host");
}

/*
* Fisher-Yates (aka Knuth) Shuffle.
 */
function shuffle(array) {
	let currentIndex = array.length, randomIndex;

	// While there remain elements to shuffle.
	while (currentIndex !== 0) {

		// Pick a remaining element.
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex--;

		// And swap it with the current element.
		[array[currentIndex], array[randomIndex]] = [
			array[randomIndex], array[currentIndex]];
	}

	return array;
}

function getAllAssignButtons() {
	let x = document.getElementsByClassName(
		'zmu-btn bo-room-item-container__ghost-blue zmu-btn--ghost zmu-btn__outline--blue zmu-btn--sm'
	);
	// @TODO click "Add Room" programmatically instead of requiring it manually
	if (x.length === 0) {
		alert('(Zoomie) No assignable buttons!');
		return false;
	}
	return x;
}

/**
 * Check for page load and then continue.
 */
let ih = '';
if (document.readyState === "complete"
	|| document.readyState === "interactive") {
	ih = document.body.innerHTML;

	load();
} else {
	document.onreadystatechange = function () {
		if (document.readyState === "complete"
			|| document.readyState === "interactive") {
			ih = document.body.innerHTML;
			load();
		}
	}
}

/**
 * GM functions
 */
function GM_addStyle(css) {
	let style = document.createElement('style');
	style.textContent = css;
	document.getElementsByTagName('head')[0].appendChild(style);
}
