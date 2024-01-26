/*
 pre-reqs

 update/install nodejs
 update/install npm
 npm install selenium-webdriver


export DISPLAY_NAME=
export SESSION_LENGTH_SECONDS=
export ZOOM_MEETING_ID=
export ZOOM_MEETING_PASSCODE=

node farm.js
 */

const {until, By, Browser, Builder} = require("selenium-webdriver");
const firefox = require('selenium-webdriver/firefox');

const displayName = process.env.DISPLAY_NAME
const sessionSeconds = process.env.SESSION_LENGTH_SECONDS
const meetingID = process.env.ZOOM_MEETING_ID
const meetingPasscode = process.env.ZOOM_MEETING_PASSCODE

// close cookies popup
async function closeCookiesPopup(driver) {
    await driver.wait(until.elementLocated(By.id("onetrust-reject-all-handler")), 2000)
    await driver.findElement(By.id('onetrust-reject-all-handler')).click();
    console.log('cookie pop up gone');
}

async function termsAndPolicies(driver) {
    await driver.findElement(By.id('wc_agree1')).click();
    console.log('terms pop up gone');
}

async function joinMeeting(driver) {
    let inputname = await driver.wait(until.elementLocated(By.id("input-for-name")), 4000)
    await inputname.clear()
    inputname.sendKeys(displayName)

    let inputpasscode = await driver.wait(until.elementLocated(By.id("input-for-pwd")), 1000)
    await inputpasscode.sendKeys(meetingPasscode)

    let joinXPath = '/html/body/div[2]/div[2]/div/div[1]/div/div[2]/button'
    await driver.wait(until.elementIsEnabled(driver.findElement(By.xpath(joinXPath), 1000))).click();

    console.log("connected and waiting...")
    await driver.sleep(sessionSeconds * 1000)
    console.log("done waiting")
}

async function createParticipant(driver) {
    await driver.get('https://zoom.us/wc/' + meetingID + '/join').then(async () => {
        await closeCookiesPopup(driver);
        await driver.sleep(1000).then(async () => {
            await termsAndPolicies(driver);
            await joinMeeting(driver);
        });
    });
}

(async function main() {
    let fOps = new firefox.Options().headless() // deprecated, but it works
    let driver = new Builder()
        .setFirefoxOptions(fOps)
        .forBrowser(Browser.FIREFOX).build();
    try {
        await createParticipant(driver);
    } finally {
        await driver.quit();
    }
})();
