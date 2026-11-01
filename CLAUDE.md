# Fate 개발 규칙

## UI 텍스트 넘침 금지 (필수)
- 글자가 버튼/패널/카드 상자 밖으로 나가거나 잘리면 안 된다. 폰트는 지마켓산스(Inter 대비 폭이 넓음)라 특히 주의.
- UI 문구·폰트·레이아웃을 건드렸으면 **완료 보고 전에 반드시** 실행:
  1. `cd dist && python3 -m http.server 8765` (서버 기동)
  2. `npm run qa:overflow` → `OK: 넘침 없음`이어야 통과. FAIL이면 수정 후 재실행.
- 버튼에 `white-space:nowrap` 금지(줄바꿈 허용), 고정 폭/높이 상자에는 가장 긴 문구 상태(마나 10 필요, 긴 캐릭터명 등)로 확인.
- 동적으로 바뀌는 문구는 `12_tools/qa/check-text-overflow.py`의 `STATES`에 해당 상태를 추가한다.
- `dist/index.html`의 "지마켓산스 넘침 방지" CSS 블록은 삭제 금지.
- 검사기는 pseudo-element(::before 아이콘) 겹침은 못 잡으므로 스크린샷으로 눈으로도 확인.

## 스킬/마법/필살기 연출은 필드 기준 (필수)
- 연출 오버레이(`.cinematic-skill-fx`, `.ultimate-cutscene`, `.global-spell`, `.global-summon`, `.effect-narration`)는 화면 전체가 아니라 `.arena`(필드) 영역의 중앙에 표시한다. `syncFieldFrame()`이 `--field-left/top/width/height/cx/bottom`을 갱신한다.
- 새 연출은 `vw/vh/inset:0` 대신 `var(--field-width)`/`var(--field-height)` 기준으로 크기를 잡고, 오버레이 클래스는 `FIELD_OVERLAYS` 선택자에 추가한다.
- 연출 타이틀은 단어 단위로 줄바꿈한다(`typeSkillTitle`이 `.title-word`로 묶음). 단어 중간에서 끊기면 안 된다.

## Codex 이미지 생성 0순위 큐 (필수 상기)
- Codex(`image_gen`) 한도가 회복되면 **가장 먼저** 일러스트 없는 마법·함정 7장(`core.*`)부터 만든다. 목록·프롬프트·반영 절차는 `06_assets/art-queue.md` (P0 마법/함정 → P1 중복 사용 마법 → P2 토큰 → P3 수호신 아이콘).
- Fate 작업을 시작·종료할 때 사용자에게 이 미해결 큐를 한 번 상기시킨다. Claude는 이미지를 생성할 수 없고, 코드로 그린 SVG 일러스트는 쓰지 않는다.
