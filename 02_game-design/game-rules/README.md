# Fate 게임 규칙서 (PM 인수인계용)

> 기준 시점: 2026-11-01 · 기준 구현: `dist/index.html` + `dist/runtime/cards.js`
> **코드가 항상 정답입니다.** 이 문서는 코드를 읽어 정리한 "현재 확정 규칙"이며, 규칙이 바뀌면 같은 PR에서 이 문서도 갱신합니다.

## 이 게임은 무엇인가

여성 캐릭터 카드만 등장하는 1:1 카드 배틀 게임입니다. 플레이어는 60장 덱의 캐릭터(챔프)를 전장에 내보내 상대 영웅의 체력(100)을 0으로 만들면 승리합니다. 상대는 AI(Noctis)이며, 재화(크래커)로 카드를 모으고(소환), 수호신을 고르고(전투 전), 승리하면 상대의 크래커를 빼앗는 구조입니다. 덱 상점(카드 소환)이 실질 결제 창구가 될 예정입니다.

## 읽는 순서

| 순서 | 문서 | 내용 | 이런 때 읽으세요 |
|---|---|---|---|
| 1 | [01-overview.md](01-overview.md) | 승패, 자원, 한도 수치 한눈에 | 처음 인수받을 때 |
| 2 | [02-turn-and-combat.md](02-turn-and-combat.md) | 시작 세팅, 턴 흐름, 전투·피해·상태이상 | 전투 규칙 문의, 버그 재현 |
| 3 | [03-cards-and-effects.md](03-cards-and-effects.md) | 카드 유형·등급·효과 사전, 마법/함정 세팅 | 카드 기획·밸런스 |
| 4 | [04-ultimate-and-comeback.md](04-ultimate-and-comeback.md) | 필살기, 역전 돌진, 최후의 발악 | 역전/후반 시스템 |
| 5 | [05-guardians.md](05-guardians.md) | 수호신 4종, 약자멸시 | 수호신 밸런스 |
| 6 | [06-economy-and-deck.md](06-economy-and-deck.md) | 크래커 경제, 소환(가챠), 덱 편성, 저장 데이터 | 과금·경제 설계 |
| 7 | [07-opponent-ai.md](07-opponent-ai.md) | 상대 AI 행동, 공정성 장치 | 난이도 조정 |
| 8 | [08-controls-and-dev.md](08-controls-and-dev.md) | 단축키, 테스트용 주소 옵션, 개발·QA 명령 | 테스트/QA |
| 9 | [09-decisions-and-open-issues.md](09-decisions-and-open-issues.md) | 확정된 방침, **미해결 이슈·위험** | **꼭 먼저 읽을 것** |
| 10 | [10-audio-and-motion.md](10-audio-and-motion.md) | 피격 효과음 변주, 평타 모션 6종, 음원 라이선스 | 사운드·연출 조정 |

## 용어집

| 용어 | 뜻 |
|---|---|
| 챔프 | 전장에 소환하는 캐릭터 카드. 공격력(⚔)과 체력(♥)이 있음 |
| 영웅 / 본체 | 각 진영의 체력 게이지(100). 0이 되면 패배 |
| 필드 / 전장 | 챔프가 놓이는 줄. 내 전장 최대 6장 |
| 라운드(턴) | 내 턴 → 내 챔프 자동 전투 → 상대 턴. 한 사이클 |
| 마나 | 카드를 내는 자원. 매 턴 최대치가 1씩 증가(최대 10) |
| 혈마나 | 마나가 모자랄 때 영웅 체력으로 대신 내는 비용 |
| 등급 | 카드를 뽑을 때 굴리는 공격력 보너스 (C +0 / B +1 / A +2 / S +3) |
| 크래커 | 게임 재화. 소환·수호신 선택에 쓰고, 승리하면 상대에게서 빼앗음 |
| 수호신 | 전투 시작 때 고르는 패시브(청룡/백호/주작/현무) |
| 약자멸시 | 수호신 없이 싸우는 선택지 (패배 시 크래커 소모) |
| 묘지 | 쓰러지거나 필살기로 쓴 내 챔프가 모이는 곳 (부활 효과가 참조) |

## 코드 위치 지도

| 무엇 | 어디 |
|---|---|
| 전투 규칙·UI 전부 | `dist/index.html` (한 파일에 규칙과 UI가 함께 있음) |
| 카드 데이터 원본 | `03_card-data/sets/core-set.json`, `character-expansions.json`, `battle-starter.json` |
| 카드 데이터 검증 | `03_card-data/validators/validate-cards.mjs` |
| 런타임용 카드 데이터 | `dist/runtime/cards.js` (원본에서 `npm run build:runtime`으로 생성) |
| 엔진(헤드리스 규칙) | `04_game-engine/src/` |
| 밸런스 시뮬레이터/리포트 | `09_balance-lab/` |
| 회귀 테스트 | `11_qa/regression/ui-contract.test.js` |
| 개발 규칙(글자 넘침 등) | 루트 `CLAUDE.md` |

## 문서를 고칠 때

- 수치는 반드시 코드의 상수/함수와 대조해서 씁니다. 추측이면 "해석" 또는 "가정"이라고 명시합니다.
- 확정된 방침은 [09-decisions-and-open-issues.md](09-decisions-and-open-issues.md)의 "확정 방침"에 이유와 함께 남깁니다.
- 이 폴더 외에 `02_game-design/card-system/advanced-mechanics.md`(고급 카드 메커니즘: 숙성/각성/종말)가 있습니다. 아직 UI에 노출되지 않은 엔진 쪽 설계라 이 규칙서의 범위 밖입니다.
