"""데스크톱 레이아웃과 수정된 UI를 확인한다."""
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3000"
OUT = Path("/tmp/balmatchum-shots")
OUT.mkdir(parents=True, exist_ok=True)

handle, token = sys.argv[1], sys.argv[2]

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium")
    context = browser.new_context(
        viewport={"width": 1280, "height": 900},
        device_scale_factor=1,
        locale="ko-KR",
        timezone_id="Asia/Seoul",
    )
    page = context.new_page()
    page.goto(BASE + "/", wait_until="networkidle")
    page.evaluate(
        "([handle, token]) => localStorage.setItem('balmatchum.session.v1', JSON.stringify({handle, token}))",
        [handle, token],
    )
    page.goto(BASE + "/", wait_until="networkidle")
    page.wait_for_timeout(1200)
    page.screenshot(path=str(OUT / "30-desktop-home.png"))
    page.goto(BASE + "/balance", wait_until="networkidle")
    page.wait_for_timeout(1200)
    page.screenshot(path=str(OUT / "31-desktop-balance.png"))

    context2 = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=2,
        locale="ko-KR",
        timezone_id="Asia/Seoul",
    )
    page2 = context2.new_page()
    page2.goto(BASE + "/", wait_until="networkidle")
    page2.evaluate(
        "([handle, token]) => localStorage.setItem('balmatchum.session.v1', JSON.stringify({handle, token}))",
        [handle, token],
    )
    page2.goto(BASE + "/goals", wait_until="networkidle")
    page2.wait_for_timeout(900)
    page2.get_by_role("button", name=re.compile("목표 수정")).click()
    page2.wait_for_timeout(500)
    page2.screenshot(path=str(OUT / "32-goals-edit.png"))
    page2.keyboard.press("Escape")
    page2.goto(BASE + "/balance", wait_until="networkidle")
    page2.wait_for_timeout(900)
    page2.mouse.wheel(0, 780)
    page2.wait_for_timeout(500)
    page2.screenshot(path=str(OUT / "33-balance-routine.png"))
    print("done")
    browser.close()
