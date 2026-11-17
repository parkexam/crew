"""목표, 밸런스, 시트 상호작용을 확인한다."""
import json
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3000"
OUT = Path("/tmp/balmatchum-shots")
OUT.mkdir(parents=True, exist_ok=True)

handle, token = sys.argv[1], sys.argv[2]
errors: list[str] = []


def shot(page, name: str) -> None:
    page.wait_for_timeout(500)
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=False)
    print("shot", name)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium")
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=2,
        locale="ko-KR",
        timezone_id="Asia/Seoul",
        permissions=[],
    )
    page = context.new_page()
    page.on(
        "console",
        lambda msg: errors.append(f"console.{msg.type}: {msg.text}")
        if msg.type == "error"
        else None,
    )
    page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))

    page.goto(BASE + "/", wait_until="networkidle")
    page.evaluate(
        "([handle, token]) => localStorage.setItem('balmatchum.session.v1', JSON.stringify({handle, token}))",
        [handle, token],
    )

    page.goto(BASE + "/goals", wait_until="networkidle")
    page.wait_for_timeout(1000)
    shot(page, "12b-goals")
    page.get_by_role("button", name=re.compile("목표 수정")).click()
    page.wait_for_timeout(500)
    shot(page, "13b-goals-edit")
    page.keyboard.press("Escape")
    page.wait_for_timeout(400)

    page.goto(BASE + "/balance", wait_until="networkidle")
    page.wait_for_timeout(1200)
    shot(page, "14-balance")
    page.mouse.wheel(0, 780)
    page.wait_for_timeout(500)
    shot(page, "15-balance-routine")
    routine_check = page.locator("button[aria-label$='완료']").first
    if routine_check.count() > 0:
        routine_check.click()
        page.wait_for_timeout(2200)
        shot(page, "16-balance-checked")
    page.mouse.wheel(0, 1000)
    page.wait_for_timeout(500)
    shot(page, "17-balance-library")

    library_item = page.locator("button", has_text=re.compile("푸시업")).first
    if library_item.count() > 0:
        library_item.click()
        page.wait_for_timeout(600)
        shot(page, "18-balance-detail")
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)

    page.goto(BASE + "/crew", wait_until="networkidle")
    page.wait_for_timeout(800)
    page.get_by_role("button", name=re.compile("^참여$")).click()
    page.wait_for_timeout(500)
    shot(page, "19-crew-join")
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)
    page.get_by_role("button", name="크루 만들기").click()
    page.wait_for_timeout(500)
    shot(page, "20-crew-create")
    page.keyboard.press("Escape")

    page.goto(BASE + "/", wait_until="networkidle")
    page.wait_for_timeout(900)
    page.get_by_role("button", name="내 프로필").click()
    page.wait_for_timeout(500)
    shot(page, "21-profile")

    print("ERRORS", json.dumps(errors, ensure_ascii=False, indent=2))
    browser.close()
