# Fate FE 인수 가이드

## 현재 상태

현재 구현은 정적 브라우저 목업이다. `npm run build`가 `05_game-client/app`과 카드·런타임 소스를 결합해 `dist`를 만든다. 기존 화면 동작을 유지하기 위해 레거시 앱 모듈은 하나의 classic script로 순서대로 결합된다.

## 정본과 생성물

| 영역 | 정본 | 생성물 |
|---|---|---|
| HTML | `05_game-client/app/index.shell.html` | `dist/index.html` |
| CSS | `05_game-client/app/styles.css` | `dist/index.html` 내부 style |
| 앱 | `05_game-client/app/modules/*.js` | `dist/index.html` 내부 script |
| 카드 | `03_card-data/sets/*.json` | `dist/runtime/cards.js` |
| 엔진·표현 런타임 | `04_game-engine/src`, `05_game-client/battle` | `dist/runtime/*.js` |

## 모듈 책임

- `01-battle-core`: 전투 상태, 카드 생성, AI, 공격·피해, 마법·궁극기
- `02-battle-presentation`: 오라, 사운드, 애니메이션, 입력 모드, 전투 표현 보강
- `03-collection-progression`: 덱, 도감, 뽑기, 합성, 강화, 컬렉션 탐색

이 분리는 인수 탐색 비용을 줄이기 위한 1차 경계다. 아직 전역 변수와 함수 선언 순서에 의존하므로 독립 모듈로 오해하면 안 된다.

## 제품화 전에 옮겨야 하는 책임

### FE 도메인 계층

- 전투 상태와 reducer
- 카드 선택·타깃 선택 command
- 서버 이벤트를 화면 상태로 변환하는 selector
- 도메인 이벤트를 소비하는 VFX·SFX 큐

### 서버 계층

- 재화, 뽑기, 합성, 강화 결과
- 덱 저장과 유효성 검증
- 랭크 및 보상 정산
- 난수 seed와 리플레이 검증
- 멱등성 키와 저장 데이터 마이그레이션

### 목업 전용으로 유지할 것

- 로컬 데모 재화 보충
- URL QA 옵션
- 가짜 리더보드와 로컬 랭크
- 로컬 AI 대전

## 이관 순서

1. Playwright로 시작·소환·전투·마법·궁극기·복수자·결과 화면을 고정한다.
2. DOM 체력/공격력 파싱을 `BattleState`로 옮긴다.
3. 피해·보호막·사망을 순수 함수와 도메인 이벤트로 만든다.
4. 카드 효과 ID 45종을 registry 기반 handler로 옮긴다.
5. AI가 DOM 대신 같은 `BattleState`를 읽게 한다.
6. 컬렉션과 성장 기능을 repository 인터페이스 뒤로 옮긴다.
7. 원하는 FE 프레임워크에서 이벤트를 렌더링한다.

## 인수 게이트

- `npm run build` 성공
- `npm test` 성공
- 빌드 뒤 `git diff --exit-code -- dist` 성공
- 목업 핵심 브라우저 시나리오 성공
- `dist` 직접 수정 없음
- 목업 전용 기능과 서버 책임이 티켓으로 분리됨
