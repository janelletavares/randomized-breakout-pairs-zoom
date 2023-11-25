/*
 pre-reqs

 update/install nodejs
 update/install npm
 npm install selenium-webdriver


export DISPLAY_NAME=
export ZOOM_USERNAME=
export ZOOM_PASSWORD=
export ZOOM_MEETING_ID=
export ZOOM_MEETING_PASSCODE=

node farm.js
 */


// Require selenium webdriver
let webdriver= require("selenium-webdriver");
const {until, By} = require("selenium-webdriver");

// Build new window of chrome
let driver =  new webdriver.Builder()
    .withCapabilities(webdriver.Capabilities.chrome())
   .forBrowser("firefox").
    build();

const displayName = process.env.DISPLAY_NAME
const username = process.env.ZOOM_USERNAME
const password = process.env.ZOOM_PASSWORD
const meetingID = process.env.ZOOM_MEETING_ID
const meetingPasscode = process.env.ZOOM_MEETING_PASSCODE
const actions = driver.actions({bridge: true });

// close cookies popup
function closePopups() {
    rejectCookiesButton = driver.wait(until.elementIsEnabled(driver.findElement(By.css('button#onetrust-reject-all-handler'), 10000)));
    actions.click(rejectCookiesButton).perform();
     console.log('Pop ups all gone');
}

function login() {
    closePopups()
    emailField = driver.wait(until.elementLocated(By.id("email")), 10000);
    emailField.sendKeys(username)

    passwordField = driver.wait(until.elementLocated(By.id("password")), 10000);
    passwordField.sendKeys(password)

    signInButton = driver.wait(until.elementLocated(By.xpath('//*[@id="js_btn_login"]')), 10000);
    actions.click(signInButton).perform();
}

function termsAndPolicies() {
    agreeButton = driver.wait(until.elementIsEnabled(driver.findElement(By.css('#wc_continue'), 10000)));
    actions.click(agreeButton).perform();
}
function joinMeeting() {
    inputname = driver.wait(until.elementLocated(By.id("input-for-name")), 1000)
    inputname.clear()
    inputname.sendKeys(displayName)

    inputpasscode = driver.wait(until.elementLocated(By.id("input-for-pwd")), 10000)
    inputpasscode.sendKeys(meetingPasscode)

    /*
    doesn't work :-(
    driver.sleep(5000).then(() => {
        joinButton = driver.wait(until.elementIsEnabled(driver.findElement(By.css('html body div.main div#root div.preview-root div.preview-new-flow div.preview-new-flow-content div.preview-meeting-info button.zm-btn.preview-join-button.zm-btn--default.zm-btn__outline--blue'), 10000)));
        actions.click(joinButton).perform();
    })
    */
}

driver.get('https://zoom.us/signin#/login').then(() => {
    driver.sleep(3000).then(() => {
        login()
        driver.sleep(10000).then(() => {
            driver.get('https://zoom.us/wc/' + meetingID + '/join').then(() => {
                driver.sleep(5000).then(() => {
                    joinMeeting();
                });
            });
        })
    })
})

