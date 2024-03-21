import os
import time

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def cookies(driver):
    WebDriverWait(driver, 2).until(
        EC.presence_of_element_located((By.ID, "onetrust-reject-all-handler"))
    ).click()
    print('cookie pop up gone')

def terms_and_policies(driver):
    try:
        WebDriverWait(driver, 15).until(
            EC.element_to_be_clickable((By.ID, 'wc_agree1'))
        ).click()
        print('terms pop up gone')
    except Exception as e:
        print(e)

def join_meeting(driver):
    display_name = os.environ['HOSTNAME']
    session_seconds = os.environ['ZOOM_SESSION_LENGTH_SECONDS']
    meeting_passcode = os.environ['ZOOM_MEETING_PASSCODE']

    input_name = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.ID, "input-for-name"))
    )
    input_name.clear()
    input_name.send_keys(display_name)

    input_passcode = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.ID, "input-for-pwd"))
    )
    input_passcode.send_keys(meeting_passcode)

    join_xpath = '/html/body/div[2]/div[2]/div/div[1]/div/div[2]/button'
    WebDriverWait(driver, 1).until(
        EC.presence_of_element_located((By.XPATH, join_xpath))
    ).click()

    print("connected and waiting " + session_seconds + "...")
    time.sleep(int(session_seconds))

def leave_meeting(driver):
    print("done waiting")
    # assumes no waiting room
    leave_button = "/html/body/div[3]/div[2]/div/div[2]/div/div[1]/div[1]/footer/div[1]/div[3]/button"
    WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.XPATH, leave_button))
    ).click()
    leave_meeting_button = "/html/body/div[3]/div[2]/div/div[2]/div/div[1]/div[1]/footer/div[2]/div[2]/div/div/button"
    WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.XPATH, leave_meeting_button))
    ).click()
    print("left meeting")

def create_participant(driver):
    meeting_id = os.environ['ZOOM_MEETING_ID']
    driver.get('https://zoom.us/wc/' + meeting_id + '/join')
    cookies(driver)
    time.sleep(1)
    terms_and_policies(driver)
    join_meeting(driver)
    leave_meeting(driver)

try:
    opts = webdriver.FirefoxOptions()
    opts.add_argument("--no-sandbox")
    opts.add_argument("--headless")
    opts.add_argument("--disable-dev-shm-usage")
    driver = webdriver.Firefox(options=opts)

    create_participant(driver)
except Exception as e:
    print(e)

driver.close()
driver.quit()
