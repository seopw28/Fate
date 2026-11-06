# 05 Game Client

플레이어가 직접 사용하는 화면과 입력 흐름을 구현합니다.

## 영역

- `battle/`: 전투 보드와 입력
- `deck-builder/`: 덱 편집과 유효성 표시
- `collection/`: 보유 카드 탐색
- `card-detail/`: 카드 상세 정보
- `onboarding/`: 튜토리얼과 첫 플레이
- `settings/`: 접근성, 사운드, 그래픽 설정

## 현재 정본

- `app/index.shell.html`: 정적 HTML 셸
- `app/styles.css`: 목업 전체 스타일
- `app/modules/01-battle-core.js`: 전투 상태·판정·기본 UI
- `app/modules/02-battle-presentation.js`: 전투 연출·오라·입력 보강
- `app/modules/03-collection-progression.js`: 덱·도감·상점·합성·강화
- `app/app.sources.json`: 빌드 결합 순서

`dist/index.html`을 직접 고치지 않습니다. `npm run build`가 위 소스를 결합해 현재 목업과 동일한 결과를 생성합니다.

신규 규칙 판정은 클라이언트에 추가하지 않고 게임 엔진 결과를 표시합니다. 기존 목업의 DOM 기반 판정은 아직 위 모듈에 남아 있으며 `docs/frontend-handoff.md`의 순서로 이관합니다.
