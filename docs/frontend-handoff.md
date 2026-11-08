# Fate FE 인수 가이드

2026-11-08 기준. 목업은 **동작과 연출의 기준**으로 넘긴다. 코드를 그대로 제품에 이어 붙이는 것은 권하지 않는다. 아래 "구조상 위험"이 그 이유다.

## 1. 현재 상태

- 서버 없는 정적 브라우저 목업. `npm run build`가 `05_game-client/app`과 카드·런타임 소스를 합쳐 `dist/`를 만든다.
- 앱 모듈 5개는 ES 모듈이 아니라 **하나의 classic script로 이어 붙여** 실행된다. 순서는 `05_game-client/app/app.sources.json`이 정한다.
- 카드 219장(챔프 169, 마법 41, 함정 9), 효과 ID 54종. 컴퓨터 상대와의 대전만 있다(유저 대전 없음).
- 저장은 브라우저 `localStorage` 두 키뿐이다: `primal-collection-v1`(재화·보유 카드·덱), `fate.audio.v2`(음량).

## 2. 정본과 생성물

| 영역 | 정본 | 생성물 |
|---|---|---|
| HTML | `05_game-client/app/index.shell.html` | `dist/index.html` |
| CSS | `05_game-client/app/styles.css` | `dist/index.html` 내부 style |
| 앱 | `05_game-client/app/modules/*.js` | `dist/index.html` 내부 script |
| 카드 | `03_card-data/sets/*.json` | `dist/runtime/cards.js` |
| 엔진·표현 런타임 | `04_game-engine/src`, `05_game-client/battle` | `dist/runtime/*.js` |
| 실행 에셋 | `dist/assets/` (WebP·MP3·WOFF2, 약 52MB) | 그대로 배포 |

## 3. 모듈 지도

| 모듈 | 크기 | 책임 |
|---|---|---|
| `00-platform-adapters.js` | 1KB | 저장소·경제 난수 주입 지점. 제품 FE는 `globalThis.__FATE_PLATFORM__`에 `storage`, `economyRandom`을 넣어 교체할 수 있다 |
| `01-battle-core.js` | 256KB | 전투 상태, 카드 생성, 드로우·마나·혈마나, 공격·피해, 마법·함정·궁극기·복수자, 묘지 재사용, 컴퓨터 AI |
| `02-battle-presentation.js` | 110KB | 성격 오라, 사운드, 애니메이션, 입력 모드, 전투 표현 |
| `03-collection-progression.js` | 79KB | 덱 편집, 도감, 뽑기, 합성, 강화, 역전 마법, 컬렉션 |
| `04-hero-pressure.js` | 7KB | 영웅 압박 챔프(스플래시·등장 피해·자폭) |

규칙 문서는 `02_game-design/game-rules/`의 01~10번이 정본이다. 결정과 미결은 `09-decisions-and-open-issues.md`에 모여 있다.

## 4. 구조상 위험 (재구현을 권하는 이유)

| 위험 | 실측 | 영향 |
|---|---|---|
| 함수 덮어쓰기 | 뒤 모듈이 앞 함수를 감싸 다시 정의하는 곳 31개 (`drawCard`, `castSpell`, `createRuntimeBattleCard` 등) | 실제 동작이 결합 순서에 달려 있다. 한 곳만 고치면 다른 래퍼에 묻힌다 |
| 화면 글자에서 상태 읽기 | 공격력·체력을 카드 DOM 텍스트에서 파싱 | 문구만 바꿔도 규칙이 바뀐다 |
| 한 줄 코드 | 500자 넘는 줄 219개, 최장 5,207자 | 리뷰·diff·blame이 사실상 불가 |
| 전역 상태 | 최상위 `let` 69개 | 상태 전이를 추적하기 어렵다 |
| 타이머 결합 | `setTimeout` 196곳 | 연출 시간이 규칙 순서를 정한다. 서버 판정과 맞추기 어렵다 |
| 엔진 미사용 | `04_game-engine`은 난수와 피해 계산 1개만 쓰임 | 규칙 대부분이 화면 코드 안에 있다 |

## 5. 제품화 때 나눌 책임

### FE 도메인 계층
- 전투 상태와 reducer
- 카드 선택·타깃 선택 command
- 서버 이벤트를 화면 상태로 바꾸는 selector
- 도메인 이벤트를 소비하는 VFX·SFX 큐

### 서버 계층
- 재화, 뽑기, 합성, 강화 결과
- 덱 저장과 유효성 검증
- 랭크와 보상 정산
- 난수 seed와 리플레이 검증
- 멱등성 키와 저장 데이터 마이그레이션

### 목업 전용 (제품으로 옮기지 않음)
- 로컬 데모 재화 보충과 주소 옵션 `?crackers=`, `?secretTest`, `?secretReset`, `?enhanceTest`
- 재현용 주소 옵션 `?seed=`, `?fixedStarter`, `?skipIntro`, `?guardian=`, `?difficulty=`, `?tab=`, `?match=`, `?sfxpack=`
- 가짜 리더보드와 로컬 랭크
- 로컬 AI 대전의 클라이언트 판정

## 6. 이관 순서

1. Playwright로 시작·소환·전투·마법·궁극기·복수자·결과 화면을 고정한다 (`12_tools/qa/`의 `qa:*` 검사를 출발점으로).
2. DOM 체력·공격력 파싱을 `BattleState`로 옮긴다.
3. 피해·보호막·사망을 순수 함수와 도메인 이벤트로 만든다.
4. 카드 효과 ID 54종을 registry 기반 handler로 옮긴다.
5. AI가 DOM 대신 같은 `BattleState`를 읽게 한다.
6. 컬렉션과 성장 기능을 repository 인터페이스 뒤로 옮긴다.
7. 원하는 FE 프레임워크에서 이벤트를 렌더링한다.

## 7. 알려진 문제

- 프로토타입 카드 5종의 그림이 없다(404): `characters/prototype/bloodbound-heroine`, `bloodbound-heroine-awakened`, `time-warden`, `time-warden-awakened`, `spells/prototype/prophecy-of-ruin`. `assetId`에 확장자가 없고 파일도 없다.
- 컴퓨터 상대의 묘지 재사용 판단은 임시 구현이다(턴 시작에 조건이 맞으면 항상 사용).

- 화면 배율 (2026-11-08): 목업은 CSS `zoom` 0.9 축소를 없애고 모든 크기를 1.0 기준 값으로 바꿨다. 재구현 때도 화면 전체 축소를 쓰지 말고 이 값을 그대로 쓴다. 자동 판정을 못 한 연출용 CSS 규칙(궁극기 컷씬·선공 배너·함정 발동 등)은 값을 그대로 둬 예전보다 약 10% 크게 보일 수 있다 → `12_tools/ui-scale/unverified.md`.

## 8. 인수 게이트

- `npm run build` 성공, `npm test` 성공
- 빌드 뒤 `git diff --exit-code -- dist` 성공
- `qa:*` 브라우저 검사 성공
- `dist` 직접 수정 없음
- 목업 전용 기능과 서버 책임이 티켓으로 분리됨
