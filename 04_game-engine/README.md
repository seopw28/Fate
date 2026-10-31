# 04 Game Engine

화면이나 네트워크 없이 한 게임을 처음부터 끝까지 실행할 수 있는 결정론적 규칙 엔진을 구현합니다.

## 영역

- `state/`: 게임 상태
- `actions/`: 플레이어가 요청하는 행동
- `effects/`: 행동이 만드는 상태 변화
- `targeting/`: 대상 선택과 유효성 검사
- `rng/`: 시드 기반 무작위성
- `tests/`: 규칙, 예외, 회귀 테스트

엔진은 `shared/game-events`와 `shared/card-schema` 계약을 따라야 합니다.
