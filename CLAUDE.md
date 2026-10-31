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
