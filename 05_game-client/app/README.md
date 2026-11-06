# Client source

이 폴더가 현재 브라우저 목업의 정본이다. `dist/`는 직접 수정하지 않는다.

## 파일 역할

1. `index.shell.html`: 정적 마크업과 런타임 스크립트 로드 순서
2. `styles.css`: 화면·연출 스타일
3. `modules/01-battle-core.js`: 레거시 전투 상태, 판정, AI, 기본 렌더링
4. `modules/02-battle-presentation.js`: 사운드, 오라, 연출, 조작 보강
5. `modules/03-collection-progression.js`: 덱, 도감, 상점, 합성, 강화

모듈은 아직 전역 스코프와 선언 순서에 의존하므로 개별 번들이 아니다. `app.sources.json` 순서를 바꾸면 안 된다. 신규 기능은 기존 함수를 다시 덮어쓰지 말고, 가능한 경우 `04_game-engine`의 명시적 상태 전이와 이벤트로 추가한다.

## 명령

- `npm run build`: 정본을 `dist/`로 생성
- `npm run check:source`: 결합된 앱 소스의 문법과 manifest 검증
- `npm test`: 빌드 후 전체 회귀 테스트

## 다음 분리 경계

1. DOM에서 체력·공격력을 읽는 판정을 순수 상태 객체로 이동
2. `damageUnit`, `castSpell`, `triggerBattlecry` 래퍼 체인을 효과 파이프라인으로 교체
3. 컬렉션 저장소를 `localStorage` 어댑터 뒤로 격리
4. 사운드·VFX를 도메인 이벤트 구독자로 이동
5. 문자열 검사 중심 테스트에 브라우저 E2E 추가
