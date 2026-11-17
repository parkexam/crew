"""발맞춤 주요 흐름을 실제 브라우저로 확인한다."""
import json
import re
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3000"
OUT = Path("/tmp/balmatchum-shots")
OUT.mkdir(parents=True, exist_ok=True)

errors: list[str] = []


def shot(page, name: str) -> None:
    page.wait_for_timeout(500)
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=False)
    print("shot", name)


with sync_playwright() as p:
    browser = p.chromium.launch()
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
    page.wait_for_selector("#nickname")
    page.fill("#nickname", "한지우")
    shot(page, "01-onboarding")

    page.get_by_role("button", name=re.compile("^다음")).click()
    page.wait_for_timeout(400)
    page.get_by_role("button", name=re.compile(r"^7\s*km$")).click()
    page.get_by_role("button", name=re.compile(r"^45\s*분$")).click()
    shot(page, "02-goal")

    page.get_by_role("button", name=re.compile("^다음")).click()
    page.wait_for_timeout(400)
    parts = page.locator("button", has_text=re.compile(r"^(가슴|등|어깨|팔|코어|하체|둔근)$"))
    print("part buttons:", parts.count())
    parts.nth(0).click()  # 가슴 = 자주 하는 부위
    # 거의 안 하는 부위 그룹에서 하체, 코어 선택 (앞의 7개 이후)
    labels = ["하체", "코어"]
    for label in labels:
        candidates = page.locator("button", has_text=re.compile(rf"^{label}$"))
        if candidates.count() >= 2:
            candidates.nth(1).click()
        else:
            candidates.nth(0).click()
    shot(page, "03-balance-survey")

    page.get_by_role("button", name=re.compile("크루 입장하기")).click()
    page.wait_for_selector("text=Today's run", timeout=15000)
    page.wait_for_timeout(800)
    shot(page, "04-home")

    session = page.evaluate("() => localStorage.getItem('balmatchum.session.v1')")
    print("SESSION", session)

    page.goto(BASE + "/run", wait_until="networkidle")
    shot(page, "05-run-idle")
    page.get_by_role("button", name="러닝 시작").click()
    page.wait_for_timeout(3200)
    shot(page, "06-run-active")
    page.get_by_role("button", name=re.compile("러닝 종료")).click()
    page.wait_for_timeout(500)
    shot(page, "07-run-finish")
    page.locator("input[placeholder='오늘 러닝은 어땠나요?']").fill("첫 러닝, 다리가 가볍다")
    page.get_by_role("button", name=re.compile("기록 저장하기")).click()
    page.wait_for_selector("text=기록을 저장했어요", timeout=15000)
    shot(page, "08-run-saved")

    page.get_by_role("button", name="홈으로 돌아가기").click()
    page.wait_for_selector("text=Today's run")
    page.wait_for_timeout(1200)
    shot(page, "09-home-after-run")

    page.goto(BASE + "/crew", wait_until="networkidle")
    page.wait_for_timeout(900)
    shot(page, "10-crew-rank")
    page.get_by_role("button", name=re.compile("^피드$")).click()
    page.wait_for_timeout(500)
    shot(page, "11-crew-feed")

    page.goto(BASE + "/goals", wait_until="networkidle")
    page.wait_for_timeout(900)
    shot(page, "12-goals")
    page.get_by_role("button", name=re.compile("목표 수정")).click()
    page.wait_for_timeout(400)
    shot(page, "13-goals-edit")
    page.get_by_role("button", name=re.compile("^취소$|^닫기$")).first.click()

    page.goto(BASE + "/balance", wait_until="networkidle")
    page.wait_for_timeout(1200)
    shot(page, "14-balance")
    page.mouse.wheel(0, 900)
    page.wait_for_timeout(500)
    shot(page, "15-balance-routine")

    routine_check = page.locator("button[aria-label$='완료']").first
    if routine_check.count() > 0:
        routine_check.click()
        page.wait_for_timeout(1800)
        shot(page, "16-balance-checked")

    page.mouse.wheel(0, 1200)
    page.wait_for_timeout(400)
    shot(page, "17-balance-library")

    page.goto(BASE + "/", wait_until="networkidle")
    page.wait_for_timeout(1000)
    page.get_by_role("button", name="내 프로필").click()
    page.wait_for_timeout(400)
    shot(page, "18-profile")

    print("ERRORS", json.dumps(errors, ensure_ascii=False, indent=2))
    browser.close()
