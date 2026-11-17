"""발맞춤 인증 화면을 실제 브라우저로 확인한다."""
import json
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3000"
OUT = Path("/tmp/balmatchum-shots")
OUT.mkdir(parents=True, exist_ok=True)

handle = sys.argv[1]
token = sys.argv[2]
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

    page.goto(BASE + "/run", wait_until="networkidle")
    page.wait_for_timeout(800)
    shot(page, "05-run-idle")
    page.get_by_role("main").get_by_role("button", name="러닝 시작").click()
    page.wait_for_timeout(3200)
    shot(page, "06-run-active")
    page.get_by_role("button", name=re.compile("러닝 종료")).click()
    page.wait_for_timeout(500)
    page.locator("input[placeholder='5.00']").fill("3.20")
    page.locator("input[placeholder='30:00']").fill("19:40")
    page.locator("input[placeholder='오늘 러닝은 어땠나요?']").fill("한강 3.2K, 마지막 500m는 질주")
    shot(page, "07-run-finish")
    page.get_by_role("button", name=re.compile("기록 저장하기")).click()
    page.wait_for_selector("text=기록을 저장했어요", timeout=15000)
    shot(page, "08-run-saved")

    page.get_by_role("button", name="홈으로 돌아가기").click()
    page.wait_for_selector("text=Today's run")
    page.wait_for_timeout(1200)
    shot(page, "09-home-after-run")

    page.goto(BASE + "/crew", wait_until="networkidle")
    page.wait_for_timeout(1200)
    shot(page, "10-crew-rank")
    page.get_by_role("button", name=re.compile("^피드$")).click()
    page.wait_for_timeout(600)
    shot(page, "11-crew-feed")

    page.goto(BASE + "/goals", wait_until="networkidle")
    page.wait_for_timeout(1000)
    shot(page, "12-goals")
    page.get_by_role("button", name=re.compile("목표 수정")).click()
    page.wait_for_timeout(500)
    shot(page, "13-goals-edit")
    page.get_by_role("button", name=re.compile("^닫기$")).first.click()

    page.goto(BASE + "/balance", wait_until="networkidle")
    page.wait_for_timeout(1200)
    shot(page, "14-balance")
    page.mouse.wheel(0, 820)
    page.wait_for_timeout(500)
    shot(page, "15-balance-routine")

    routine_check = page.locator("button[aria-label$='완료']").first
    if routine_check.count() > 0:
        routine_check.click()
        page.wait_for_timeout(2000)
        shot(page, "16-balance-checked")

    page.mouse.wheel(0, 1100)
    page.wait_for_timeout(500)
    shot(page, "17-balance-library")

    page.goto(BASE + "/", wait_until="networkidle")
    page.wait_for_timeout(1000)
    page.get_by_role("button", name="내 프로필").click()
    page.wait_for_timeout(500)
    shot(page, "18-profile")

    print("ERRORS", json.dumps(errors, ensure_ascii=False, indent=2))
    browser.close()
