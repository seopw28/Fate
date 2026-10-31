# TCG Game

Claude와 Codex가 서로 다른 작업 레인을 병렬로 개발할 수 있도록 구성한 TCG 프로젝트입니다.

## 작업 원칙

1. 각 에이전트는 배정된 최상위 폴더를 기본 작업 범위로 삼습니다.
2. 폴더 간 계약은 `shared/`에서만 정의합니다.
3. 카드 효과는 클라이언트 코드에 직접 넣지 않고 `03_card-data/`에서 관리합니다.
4. 핵심 규칙은 UI와 분리하여 `04_game-engine/`에서 테스트합니다.
5. `dist/`는 빌드 결과물로 취급하며 직접 수정하지 않습니다.
6. 외부 에셋은 출처와 사용 권한을 기록한 뒤 사용합니다.

## 권장 착수 순서

1. `00_product`, `01_research`, `02_game-design`
2. `shared`, `03_card-data`, `04_game-engine`
3. `05_game-client`, `08_ai-bots`, `09_balance-lab`
4. `06_assets`, `07_vfx-motion`, `10_platform`
5. `11_qa`, `12_tools`, `13_legal`

각 작업 레인의 목표와 첫 산출물은 해당 폴더의 `README.md`를 참고합니다.
