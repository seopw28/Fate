# JS 안 px 값 분류 (2026-11-08, docs/plan-ui-scale-1.md 4-1)

JS에 직접 적힌 px 값 96개와 계산해서 붙이는 값(`+'px'`) 214곳을 봤다.

## 0.9배로 바꾼 것 (예전 축소 안 요소에 쓰이던 값) — convert-js.py

| 함수 | 내용 | 바꾼 곳 |
|---|---|---|
| showAvengerArrival | 복수자 강림 카드 낙하 거리 | 1 |
| showAvengerLandingImpact | 복수자 착지 때 전장·무대 흔들림 거리 | 2 |
| setUltimatePanelShown | 궁극기 패널 열고 닫을 때 위로 밀리는 거리 | 2 |
| showUltimateSpentDeath | 소진자 죽음 전장 흔들림 | 1 |
| castSpell · triggerTrap · triggerBattlecry | 대상 카드에 거는 테두리 빛(box-shadow) | 5 |
| flipReveal | 카드 뒤집기 원근(perspective 900→810) | 5 |
| summonLandingImpact | 소환 카드 착지 튕김, 마법진 균열 길이·파편 거리 | 3 |
| heroHealthImpact | 체력바 흔들림 | 1 |
| revealEnemyPlacementInOrder | 상대 카드 등장 거리 | 1 |
| updateGuardianChips | 오라 칩 왼쪽 여백 | 1 |
| playGuardianDescent | 오라 강림 전장 흔들림 | 1 |
| showCharacterAppeal | 가챠 캐릭터 연출 불꽃 거리(가챠 연출은 컬렉션 창 안) | 1 |

## 그대로 둔 것

- **화면 좌표로 화면 위에 따로 띄우는 효과**(대부분의 `+'px'`): 타격·방패·라벨·조준선·카드 비행·크래커 이동·궁극기 입자 등. 원래 축소 밖이라 1.0이었다.
  - 이 중 축소 안 요소를 화면 좌표로 옮기던 곳(예: 상대 레인 재배치 `arrangeEnemyLane`)은 예전에는 배율만큼 어긋났고, 축소가 없어진 지금은 정확해진다.
- **필드 교체·퇴장 잔상**(beginFieldSwap, retireFieldUnit): position:fixed 로 화면 위에 띄우는 잔상이라 그대로.
- **시네마틱 스킬 제목 글자 크기·여백**(showCinematicSkillEffect): 화면 위 연출이라 그대로.
- **테두리 두께 outline 2px**(applyBurn, applyEternalBlackFlame): CSS 변환과 같은 기준(테두리 두께는 유지).
- 0px, 주석 속 숫자, 소환 마법진 배율 측정용 좌표(0·100px).
