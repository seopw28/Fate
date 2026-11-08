# Fate 게임 규칙서 (PM 인수인계용)

> 기준 시점: 2026-11-06 · 기준 구현: `dist/index.html` + `dist/runtime/cards.js`
> **코드가 항상 정답입니다.** 이 문서는 코드를 읽어 정리한 "현재 확정 규칙"이며, 규칙이 바뀌면 같은 PR에서 이 문서도 갱신합니다.

## 이 게임은 무엇인가

캐릭터챗에서 애정과 라포를 쌓은 여성 캐릭터를 다시 만나고 끝까지 완결하는 1:1 카드 배틀 게임입니다. 상점 획득 어필 영상과 전투 궁극기 컷씬, 캐릭터 성격을 시각화한 오라가 판 전체를 뒤흔드는 역전 기억을 만듭니다. 전투 승률 경쟁보다 좋아하는 동일 카드를 모아 4차 강화까지 완성하는 수집·강화 목표를 우선하며, 전투 규칙과 카드 상점은 이 캐릭터 완결 경험을 지원합니다.

## 읽는 순서

| 순서 | 문서 | 내용 | 이런 때 읽으세요 |
|---|---|---|---|
| 1 | [01-overview.md](01-overview.md) | 승패, 자원, 한도 수치 한눈에 | 처음 인수받을 때 |
| 2 | [02-turn-and-combat.md](02-turn-and-combat.md) | 시작 세팅, 턴 흐름, 전투·피해·상태이상 | 전투 규칙 문의, 버그 재현 |
| 3 | [03-cards-and-effects.md](03-cards-and-effects.md) | 카드 유형·등급·효과 사전, 마법/함정 세팅 | 카드 기획·밸런스 |
| 4 | [04-ultimate-and-comeback.md](04-ultimate-and-comeback.md) | 궁극기, 복수자, 묘지 재사용 | 역전/후반 시스템 |
| 5 | [05-guardians.md](05-guardians.md) | 성격 오라 5종과 오라 각성 | 오라 밸런스 |
| 6 | [06-economy-and-deck.md](06-economy-and-deck.md) | 크래커 경제, 소환(가챠), 덱 편성, 저장 데이터 | 과금·경제 설계 |
| 7 | [07-opponent-ai.md](07-opponent-ai.md) | 상대 AI 행동, 공정성 장치 | 난이도 조정 |
| 8 | [08-controls-and-dev.md](08-controls-and-dev.md) | 단축키, 테스트용 주소 옵션, 개발·QA 명령 | 테스트/QA |
| 9 | [09-decisions-and-open-issues.md](09-decisions-and-open-issues.md) | 확정된 방침, **미해결 이슈·위험** | **꼭 먼저 읽을 것** |
| 10 | [10-audio-and-motion.md](10-audio-and-motion.md) | 피격 효과음 변주, 평타 모션 6종, 음원 라이선스 | 사운드·연출 조정 |

## 용어집

| 용어 | 뜻 |
|---|---|
| 하수인 | 전장에 소환하는 캐릭터 카드. 공격력(⚔)과 체력(♥)이 있음 |
| 소환사 / 본체 | 각 진영의 체력 게이지(100). 0이 되면 패배 |
| 필드 / 전장 | 하수인이 놓이는 줄. 내 전장 최대 5장 |
| 라운드(턴) | 내 턴 → 내 하수인 자동 전투 → 상대 턴. 한 사이클 |
| 마나 | 카드를 내는 자원. 매 턴 최대치가 1씩 증가(최대 10) |
| 혈마나 | 마나가 모자랄 때 소환사 체력으로 대신 내는 비용 |
| 등급 | 카드를 뽑을 때 굴리는 공격력 보너스 (C +0 / B +1 / A +2) |
| 크래커 | 게임 재화. 카드 뽑기에 쓰고, PvC 클리어 시 시스템 보상으로 획득 |
| 성격 오라 | 전투 시작 때 고르는 불·물·나무·금속·대지 5종 패시브 |
| 묘지 | 쓰러지거나 궁극기 발동의 제물·사용 처리가 된 내 하수인이 모이는 곳 (부활 효과가 참조, 덱에 하수인이 없을 때 카드 뽑기에서 체력 10을 내고 재사용) |

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
