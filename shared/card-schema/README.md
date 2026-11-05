# Card Schema Contract

카드 스키마의 정본 위치입니다. 첫 구현에서는 다음 항목을 명시해야 합니다.

- 안정적인 `cardId`와 스키마 버전
- 표시 이름과 로컬라이징 키
- 카드 유형, 비용, 성격 오로라, 희귀도
- 효과 목록과 대상 선택 규칙
- 에셋 ID
- 덱 편성 제한

현재 실행 가능한 정본은 다음과 같습니다.

- 스키마: `03_card-data/schemas/card.schema.json`
- 첫 카드 세트: `03_card-data/sets/core-set.json`
- 검증기: `03_card-data/validators/validate-cards.mjs`

브라우저용 카드 데이터는 `npm run build:runtime`이 `dist/runtime/cards.js`로 생성합니다. `dist/`에 카드 정의를 직접 추가하지 않습니다.
