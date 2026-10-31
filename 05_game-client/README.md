# 05 Game Client

플레이어가 직접 사용하는 화면과 입력 흐름을 구현합니다.

## 영역

- `battle/`: 전투 보드와 입력
- `deck-builder/`: 덱 편집과 유효성 표시
- `collection/`: 보유 카드 탐색
- `card-detail/`: 카드 상세 정보
- `onboarding/`: 튜토리얼과 첫 플레이
- `settings/`: 접근성, 사운드, 그래픽 설정

규칙 판정은 클라이언트에서 재구현하지 않고 게임 엔진 결과를 표시합니다.
