"""화면 배율 작업용 추가 화면 상태 (docs/plan-ui-scale-1.md 2-3).
check-text-overflow.py 의 STATES 에 없던 연출·창. 기준 사진(capture-baseline.py)과 규칙 판정(scan-rule-sides.py)에 쓴다.
(이름, 준비 코드) — 앞 상태의 창이 남지 않도록 각 항목 끝에서 정리하지 않고, 다음 항목이 필요한 정리를 먼저 한다."""
CLOSE = "document.querySelectorAll('.collection-modal.show,#tier-modal.show,#result.show').forEach(m=>m.classList.remove('show'));"
# 2-3 시도 결과: 아래 3개 화면은 띄워서 판정·사진에 포함한다. 연출 함수(오라 강림, 함정 발동, 선공 배너, 시네마틱 스킬,
# 궁극기 컷씬, 캐릭터 어필)는 호출해도 이 방식으로는 화면에 뜨지 않아 제외했다 → 12_tools/ui-scale/unverified.md
EXTRA_STATES = [
    ("티어창", CLOSE + "openTierStatus()"),
    ("티어창 닫기", CLOSE),
    ("오라 각성 선택창", CLOSE + "playerHp=80;guardianAwakenChoice=null;activateGuardianAwakening()"),
    ("오라 각성 선택창 닫기", "document.querySelectorAll('.aura-awaken-choice').forEach(n=>n.remove())"),
    ("가챠 1회 뽑기", CLOSE + "openCollection('gacha');gachaPulling=false;pullCards(1)"),
    ("가챠 닫기", CLOSE),
]
