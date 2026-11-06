# TCG Game

Claude와 Codex가 서로 다른 작업 레인을 병렬로 개발할 수 있도록 구성한 TCG 프로젝트입니다.

## 작업 원칙

1. 각 에이전트는 배정된 최상위 폴더를 기본 작업 범위로 삼습니다.
2. 폴더 간 계약은 `shared/`에서만 정의합니다.
3. 카드 정의는 `03_card-data/`에서 관리합니다. 아직 엔진으로 이관되지 않은 레거시 효과 판정은 `05_game-client/app/modules/`에 명시적으로 격리합니다.
4. 신규 핵심 규칙은 `04_game-engine/`에 구현하고, 레거시 DOM 규칙은 FE 인수 계획에 따라 단계적으로 옮깁니다.
5. `dist/`는 빌드 결과물입니다. 화면 수정은 `05_game-client/app/`에서 하고 `npm run build`로 반영합니다.
6. 외부 에셋은 출처와 사용 권한을 기록한 뒤 사용합니다.

## 권장 착수 순서

1. `00_product`, `01_research`, `02_game-design`
2. `shared`, `03_card-data`, `04_game-engine`
3. `05_game-client`, `08_ai-bots`, `09_balance-lab`
4. `06_assets`, `07_vfx-motion`, `10_platform`
5. `11_qa`, `12_tools`, `13_legal`

각 작업 레인의 목표와 첫 산출물은 해당 폴더의 `README.md`를 참고합니다.

## 실행과 검증

```bash
npm run build
npm test
```

- HTML 셸: `05_game-client/app/index.shell.html`
- 스타일: `05_game-client/app/styles.css`
- 앱 모듈 순서: `05_game-client/app/app.sources.json`
- 생성 결과: `dist/`
- FE 인수 및 단계적 분리 계획: `docs/frontend-handoff.md`

## 미해결 TODO
- **이미지 큐**: 보호막 깨짐·유지 표시와 성격 오라 문양까지 2026-11-03 완료 → [06_assets/art-queue.md](06_assets/art-queue.md)
